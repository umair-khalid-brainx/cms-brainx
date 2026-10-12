import type { SiteTheme } from 'cms-blocks';
import type { MenuItem, PublicMenus, PublicSite } from '@/lib/publicApi';

/**
 * Header and footer are per-site rather than per-page, so they live in site
 * settings alongside branding — not in the block system. Only content and
 * branding vary; the layout is fixed.
 */
export type SiteSettings = {
  /** Wordmark text, and the logo's alternative text. */
  name: string;
  /** A logo from the media library; replaces the wordmark text in the header when set (GOV-04). */
  logoUrl: string | null;
  tagline: string;
  /** The header menu: top items, each with the items that drop down from it (GOV-03). */
  nav: MenuItem[];
  footer: {
    note: string;
    /** The footer menu: each top item is a group's title, the items under it its links. */
    groups: MenuItem[];
  };
  theme: SiteTheme;
};

/**
 * The header and footer of a site: its name, logo, tagline and footer note (GOV-04), and its two
 * menus (GOV-03). A site with no menus yet simply has an empty navigation and no footer groups.
 */
export function settingsFromSite(site: PublicSite, menus: PublicMenus | null = null): SiteSettings {
  return {
    name: site.name,
    logoUrl: site.logo?.url ?? null,
    tagline: site.tagline,
    nav: menus?.header ?? [],
    footer: { note: site.footerNote, groups: menus?.footer ?? [] },
    theme: site.theme,
  };
}
