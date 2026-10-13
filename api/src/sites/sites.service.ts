import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { MediaRepository } from '../media/media.repository.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { SiteRepository } from './site.repository.js';
import { readSettings, updateSettingsSchema, type SiteSettings } from './site-settings.js';
import { SubdomainCache } from './subdomain-cache.js';
import { domainProblem, normaliseDomain } from './custom-domain.js';
import { ConfigService } from '@nestjs/config';

export type SiteSummary = { id: string; name: string; subdomain: string };
/** A site's custom domain and whether its DNS record is confirmed (DEP-02); both null without one. */
export type SiteDomain = { customDomain: string | null; domainStatus: 'pending' | 'verified' | null };
/**
 * What Settings edits: the summary plus tagline, footer note and logo (GOV-04), and the custom domain (DEP-02).
 * `theme` is the site's stored theme, read by the editor so its canvas looks like this site (B-16); not edited here.
 */
export type SiteDetails = SiteSummary & SiteSettings & SiteDomain & { theme: unknown };

function domainOf(site: { host: string | null; domainStatus: 'pending' | 'verified' | null }): SiteDomain {
  return { customDomain: site.host, domainStatus: site.host ? site.domainStatus : null };
}

@Injectable()
export class SitesService {
  constructor(
    private readonly sites: SiteRepository,
    private readonly subdomainCache: SubdomainCache,
    private readonly media: MediaRepository,
    private readonly revalidation: RevalidationService,
    private readonly config: ConfigService,
  ) {}

  async get(siteId: string): Promise<SiteSummary> {
    const site = await this.sites.findById(siteId);
    if (!site) throw new NotFoundException('Site not found');
    return { id: site.id, name: site.name, subdomain: site.subdomain };
  }

  async getDetails(siteId: string): Promise<SiteDetails> {
    const site = await this.sites.findById(siteId);
    if (!site) throw new NotFoundException('Site not found');
    return { id: site.id, name: site.name, subdomain: site.subdomain, ...readSettings(site.settings), ...domainOf(site), theme: site.themeJson };
  }

  /**
   * A custom domain for the site (DEP-02, D-066), saved as pending. Display only: nothing serves the site on
   * it yet, and nothing checks its DNS. Cleaned up first (`https://WWW.Example.com/` is `www.example.com`);
   * the platform's own root domain and a domain another site has are refused. Replaces any domain it had.
   */
  async setDomain(siteId: string, value: string): Promise<SiteDetails> {
    const domain = normaliseDomain(value);
    const problem = domainProblem(domain, this.rootDomain());
    if (problem) throw new BadRequestException(problem);
    const current = await this.getDetails(siteId);
    if (current.customDomain === domain) return current;
    const owner = await this.sites.findByHost(domain);
    if (owner && owner.id !== siteId) throw new ConflictException('Another site already uses that domain.');
    try {
      await this.sites.updateDomain(siteId, domain);
    } catch (error) {
      // Two sites adding the same domain at the same moment: the unique index refuses the second.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Another site already uses that domain.');
      }
      throw error;
    }
    return this.getDetails(siteId);
  }

  /**
   * The platform's own root domain, which no custom domain may sit on. `lvh.me` locally; in production a missing
   * value would let a tenant claim `api.<root>` or another tenant's address, so custom domains are refused instead.
   */
  private rootDomain(): string {
    const root = this.config.get<string>('PUBLIC_ROOT_DOMAIN')?.trim();
    if (root) return root;
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException('Custom domains aren’t set up on this server yet (PUBLIC_ROOT_DOMAIN).');
    }
    return 'lvh.me';
  }

  /** Takes the custom domain off the site. Nothing to undo elsewhere: it was never served. */
  async removeDomain(siteId: string): Promise<SiteDetails> {
    await this.getDetails(siteId);
    await this.sites.updateDomain(siteId, null);
    return this.getDetails(siteId);
  }

  /**
   * Title, tagline, footer note and logo (GOV-04). Only what is sent changes; everything is
   * checked before anything is written, and the logo must be a picture that is in this site's
   * own library. Every page of the site shows the header and footer, so every page is refreshed.
   */
  async updateSettings(siteId: string, body: unknown): Promise<SiteDetails> {
    const current = await this.getDetails(siteId);
    const parsed = updateSettingsSchema(siteId).safeParse(body);
    if (!parsed.success) throw new BadRequestException([...new Set(parsed.error.issues.map((issue) => issue.message))]);
    const { name, ...changes } = parsed.data;

    if (changes.logo && !(await this.media.findImage(siteId, changes.logo))) {
      throw new BadRequestException('Choose a picture from this site’s media library');
    }

    const settings: SiteSettings = {
      tagline: changes.tagline ?? current.tagline,
      footerNote: changes.footerNote ?? current.footerNote,
      logo: changes.logo ?? current.logo,
    };
    const site = await this.sites.updateSettings(siteId, { ...(name !== undefined && { name }), settings });
    await this.revalidation.site(site.subdomain);
    return { id: site.id, name: site.name, subdomain: site.subdomain, ...settings, ...domainOf(site), theme: site.themeJson };
  }

  /**
   * Format and reserved names are already checked by the DTO. The old
   * subdomain stops resolving immediately and becomes free for any site to
   * take — no redirect from it (D-031). Clearing the old name from the
   * cache is what makes "immediately" true (D-035); the new name needs no
   * clearing because misses are never cached.
   */
  async updateSubdomain(siteId: string, subdomain: string): Promise<SiteSummary> {
    const current = await this.get(siteId);
    if (current.subdomain === subdomain) return current;

    const taken = await this.sites.findBySubdomain(subdomain);
    if (taken) throw new ConflictException('That address is already taken');

    try {
      const site = await this.sites.updateSubdomain(siteId, subdomain);
      this.subdomainCache.invalidate(current.subdomain);
      return { id: site.id, name: site.name, subdomain: site.subdomain };
    } catch (error) {
      // Two sites claiming the same free name at the same moment: the check
      // above passes for both, the unique index rejects the second write.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That address is already taken');
      }
      throw error;
    }
  }
}
