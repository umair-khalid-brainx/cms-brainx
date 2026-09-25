// Stand-in for the current tenant until site-switching and a real settings
// API exist — same duplication-not-import reasoning as corrickPages.ts (see
// docs/DECISIONS.md D-017): matches web/src/fixtures/corrick.ts's settings,
// authored independently since admin can't import from web.
export const currentSite = {
  slug: 'corrick',
  name: 'Corrick Oyster Co.',
  tagline: 'Damariscotta River, Maine',
  host: 'corrick.yourcms.com',
};

const WEB_URL: string = import.meta.env.VITE_WEB_URL ?? 'http://127.0.0.1:3000';

/** The live (well — `web`'s preview stand-in for live) URL for a page path. */
export function siteUrl(path: string = '/'): string {
  const suffix = path === '/' ? '' : path;
  return `${WEB_URL}/preview/${currentSite.slug}${suffix}`;
}
