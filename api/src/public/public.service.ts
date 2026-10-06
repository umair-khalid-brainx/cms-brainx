import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentRepository } from '../content/content.repository.js';
import { SiteRepository } from '../sites/site.repository.js';

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
  ) {}

  async getSite(subdomain: string): Promise<PublicSite> {
    const site = await this.findSite(subdomain);
    return { name: site.name, subdomain: site.subdomain, theme: site.themeJson };
  }

  async getPage(subdomain: string, rawPath: string | undefined): Promise<PublicPage> {
    const site = await this.findSite(subdomain);
    const page = await this.content.findLiveByPath(site.id, normalisePath(rawPath));
    if (!page) throw new NotFoundException('Page not found');
    return { title: page.title, path: page.path, blocks: page.blocks, updatedAt: page.updatedAt };
  }

  private async findSite(subdomain: string) {
    const site = await this.sites.findBySubdomain(subdomain.toLowerCase());
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }
}

/** `undefined`, `''` and `/` are the home page; `/wholesale/` matches `/wholesale`. */
function normalisePath(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
