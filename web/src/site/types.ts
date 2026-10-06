import type { SiteTheme } from 'cms-blocks';
import type { PublicSite } from '@/lib/publicApi';

/**
 * Header and footer are per-site rather than per-page, so they live in site
 * settings alongside branding — not in the block system. Only content and
 * branding vary; the layout is fixed.
 */
export type SiteSettings = {
  /** Wordmark text. A logo image replaces this once media exists. */
  name: string;
  tagline: string;
  nav: { label: string; href: string }[];
  footer: {
    note: string;
    groups: { title: string; links: { label: string; href: string }[] }[];
  };
  theme: SiteTheme;
};

/**
 * The database stores a site's name and theme, but not yet its tagline,
 * navigation or footer links — that's `GOV-04`. Until then the header and
 * footer show the site name only.
 */
export function settingsFromSite(site: PublicSite): SiteSettings {
  return {
    name: site.name,
    tagline: '',
    nav: [],
    footer: { note: '', groups: [] },
    theme: site.theme,
  };
}
