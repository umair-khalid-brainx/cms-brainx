import type { SiteTheme } from 'cms-blocks';
import type { PublicSite } from '@/lib/publicApi';

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
  nav: { label: string; href: string }[];
  footer: {
    note: string;
    groups: { title: string; links: { label: string; href: string }[] }[];
  };
  theme: SiteTheme;
};

/**
 * The header and footer of a site: its name, logo, tagline and footer note (GOV-04). The
 * navigation and the footer's link groups come with the menus (`GOV-03`), so they are empty here.
 */
export function settingsFromSite(site: PublicSite): SiteSettings {
  return {
    name: site.name,
    logoUrl: site.logo?.url ?? null,
    tagline: site.tagline,
    nav: [],
    footer: { note: site.footerNote, groups: [] },
    theme: site.theme,
  };
}
