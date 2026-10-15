import type { PublicChrome, PublicSite } from '@/lib/publicApi';

/**
 * What a page shows when the header/footer lookup fails: the site's own words with no links, so an API
 * hiccup costs a page its navigation rather than the page itself (the old layout did the same for menus).
 */
export function fallbackChrome(site: PublicSite): PublicChrome {
  return {
    header: { logo: site.logo, tagline: site.tagline, nav: [] },
    footer: { note: site.footerNote, bottomLine: `© ${new Date().getFullYear()} ${site.name}`, groups: [] },
  };
}
