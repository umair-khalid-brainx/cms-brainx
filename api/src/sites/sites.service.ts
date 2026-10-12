import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { MediaRepository } from '../media/media.repository.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { SiteRepository } from './site.repository.js';
import { readSettings, updateSettingsSchema, type SiteSettings } from './site-settings.js';
import { SubdomainCache } from './subdomain-cache.js';

export type SiteSummary = { id: string; name: string; subdomain: string };
/** What Settings edits: the summary plus tagline, footer note and logo (GOV-04). */
export type SiteDetails = SiteSummary & SiteSettings;

@Injectable()
export class SitesService {
  constructor(
    private readonly sites: SiteRepository,
    private readonly subdomainCache: SubdomainCache,
    private readonly media: MediaRepository,
    private readonly revalidation: RevalidationService,
  ) {}

  async get(siteId: string): Promise<SiteSummary> {
    const site = await this.sites.findById(siteId);
    if (!site) throw new NotFoundException('Site not found');
    return { id: site.id, name: site.name, subdomain: site.subdomain };
  }

  async getDetails(siteId: string): Promise<SiteDetails> {
    const site = await this.sites.findById(siteId);
    if (!site) throw new NotFoundException('Site not found');
    return { id: site.id, name: site.name, subdomain: site.subdomain, ...readSettings(site.settings) };
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
    return { id: site.id, name: site.name, subdomain: site.subdomain, ...settings };
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
