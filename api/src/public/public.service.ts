import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentRepository } from '../content/content.repository.js';
import { SiteRepository } from '../sites/site.repository.js';
import { SubdomainCache } from '../sites/subdomain-cache.js';

export type PublicSite = { name: string; subdomain: string; theme: unknown };
export type PublicPage = { title: string; path: string; blocks: unknown; updatedAt: Date };

/**
 * What an anonymous visitor of a tenant site may see. Returns only fields the
 * public site renders — no ids, no status, no timestamps beyond updatedAt —
 * so nothing internal leaks through a response nobody logged in to get.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly sites: SiteRepository,
    private readonly content: ContentRepository,
    private readonly subdomainCache: SubdomainCache,
  ) {}

  async getSite(subdomain: string): Promise<PublicSite> {
    // Name and theme are read fresh, not cached (D-035).
    const site = await this.sites.findById(await this.findSiteId(subdomain));
    if (!site) throw new NotFoundException('Site not found');
    return { name: site.name, subdomain: site.subdomain, theme: site.themeJson };
  }

  async getPage(subdomain: string, rawPath: string | undefined): Promise<PublicPage> {
    const siteId = await this.findSiteId(subdomain);
    const page = await this.content.findLiveByPath(siteId, normalisePath(rawPath));
    if (!page) throw new NotFoundException('Page not found');
    return { title: page.title, path: page.path, blocks: page.blocks, updatedAt: page.updatedAt };
  }

  private async findSiteId(subdomain: string): Promise<string> {
    const siteId = await this.subdomainCache.resolve(subdomain);
    if (!siteId) throw new NotFoundException('Site not found');
    return siteId;
  }
}

/** `undefined`, `''` and `/` are the home page; `/wholesale/` matches `/wholesale`. */
function normalisePath(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
