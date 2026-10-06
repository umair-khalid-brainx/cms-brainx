import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { SiteRepository } from './site.repository.js';
import { SubdomainCache } from './subdomain-cache.js';

export type SiteSummary = { id: string; name: string; subdomain: string };

@Injectable()
export class SitesService {
  constructor(
    private readonly sites: SiteRepository,
    private readonly subdomainCache: SubdomainCache,
  ) {}

  async get(siteId: string): Promise<SiteSummary> {
    const site = await this.sites.findById(siteId);
    if (!site) throw new NotFoundException('Site not found');
    return { id: site.id, name: site.name, subdomain: site.subdomain };
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
