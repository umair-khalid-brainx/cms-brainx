import { Injectable } from '@nestjs/common';
import { SiteRepository } from './site.repository.js';

/** Safety net only — a rename clears its entry straight away (`invalidate`). */
const TTL_MS = 5 * 60 * 1000;

type Entry = { siteId: string; expiresAt: number };

/**
 * In-memory `subdomain → siteId` map for the public site, so a page view
 * doesn't cost a site lookup every time (FND-04, D-035).
 *
 * - Only the id is cached. Name and theme are read fresh, so editing them
 *   never needs to touch this cache.
 * - Misses are never cached: a subdomain that's free now can be claimed by a
 *   rename at any moment, and must resolve as soon as it is. Not caching
 *   misses also keeps the map no bigger than the number of sites.
 * - Lives in this process's memory: correct for one API process. A second
 *   process wouldn't see another's `invalidate` — the TTL bounds how long it
 *   could serve the old name.
 */
@Injectable()
export class SubdomainCache {
  private readonly entries = new Map<string, Entry>();
  // Bumped by every invalidate. A lookup that started before a rename and
  // finishes after it must not put the old mapping back.
  private generation = 0;

  constructor(private readonly sites: SiteRepository) {}

  async resolve(subdomain: string): Promise<string | null> {
    const key = subdomain.toLowerCase();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.siteId;
    this.entries.delete(key);

    const generation = this.generation;
    const site = await this.sites.findBySubdomain(key);
    if (!site) return null;
    if (generation === this.generation) {
      this.entries.set(key, { siteId: site.id, expiresAt: Date.now() + TTL_MS });
    }
    return site.id;
  }

  invalidate(subdomain: string): void {
    this.generation++;
    this.entries.delete(subdomain.toLowerCase());
  }
}
