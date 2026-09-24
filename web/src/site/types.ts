import type { Block } from '@/blocks/types';
import type { SiteTheme } from '@/theme/theme';

/**
 * Header and footer are per-site rather than per-page, so they live in site
 * settings alongside branding — not in the block system. Only content and
 * branding vary; the layout is fixed.
 */
export type SiteSettings = {
  slug: string;
  /** Wordmark text. A logo image replaces this once media exists. */
  name: string;
  tagline: string;
  /** Host this tenant answers on in production. Shown here for orientation. */
  host: string;
  nav: { label: string; href: string }[];
  footer: {
    note: string;
    groups: { title: string; links: { label: string; href: string }[] }[];
  };
  theme: SiteTheme;
};

export type SitePage = {
  path: string;
  title: string;
  blocks: Block[];
};

export type SiteFixture = {
  settings: SiteSettings;
  page: SitePage;
};
