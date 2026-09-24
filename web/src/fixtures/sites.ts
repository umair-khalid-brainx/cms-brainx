import type { SiteFixture } from '@/site/types';
import { corrick } from './corrick';
import { kestrel } from './kestrel';

/**
 * Stands in for the `sites` table until host resolution is wired to the
 * database. Keyed by slug so the preview routes can look a tenant up the same
 * way the real catch-all route will look one up by host.
 */
export const siteFixtures: Record<string, SiteFixture> = {
  corrick,
  kestrel,
};

export const siteSlugs = Object.keys(siteFixtures);

export function getSiteFixture(slug: string): SiteFixture | undefined {
  return siteFixtures[slug];
}
