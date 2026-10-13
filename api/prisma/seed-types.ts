import type { Prisma } from '../src/generated/prisma/client.js';
import type { SeedMedia } from './seed-media.js';

// The shape of a demo site in the seed (GOV-08b, DEP-03). Blocks use the flat contract from cms-blocks/types.ts
// (invariant 7) directly; `api` doesn't depend on that package, so they are hand-written, not imported.
//
// A picture is named by its file under `prisma/seed-media/`: in a block, `@media:corrick/river-dawn.jpg` becomes
// the file's full address in the site's library (what the editor stores); in an entry's media field the seed
// stores the short `/uploads/<site>/<file>` form (TYP-02). Every file used must be in the site's `library`.

export type SeedStatus = 'draft' | 'published' | 'in_review' | 'scheduled';

/** Someone on the team besides the owner (GOV-06), with the seed's dev password. */
export type SeedMember = { email: string; name: string; role: 'administrator' | 'editor' | 'author' | 'contributor' | 'viewer' };

/** Where a page or post stands in review and scheduling (GOV-07), by the members' emails. */
export type SeedWorkflow = {
  /** For `in_review`: who submitted it, and how long ago. */
  submittedBy?: string;
  submittedDaysAgo?: number;
  /** For `scheduled`: who scheduled it, and how many days from the seed run it goes live. */
  scheduledBy?: string;
  publishInDays?: number;
};

export type SeedPage = SeedWorkflow & {
  title: string;
  slug: string;
  path: string;
  status: SeedStatus;
  blocks: Prisma.InputJsonValue;
  /** The page this one sits under (CNT-05) is the one at its path minus the last segment; listed before it. */
  nested?: boolean;
  /** Search and sharing settings (SEO-01); the share image as `@media:<file>`. */
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
};

/** A post of the built-in Posts type at `/blog` (TYP-01, TAX-01). */
export type SeedPost = SeedWorkflow & {
  title: string;
  slug: string;
  status: SeedStatus;
  /** Who wrote it, by email: the owner or one of the members. */
  author: string;
  /** How many days before the seed run it went live; posts list newest first by this. */
  publishedDaysAgo?: number;
  excerpt: string;
  /** The featured image, a file in the site's library. */
  image: string;
  categories: string[];
  tags: string[];
  /** The body, as a rich-text block's HTML. */
  html: string;
};

/**
 * A menu item: a page of the site by its path, or a link (GOV-03). Two levels, like the menu builder. By path,
 * not slug: a path is unique per site, and an entry can't take a page's (GOV-08b review).
 */
export type SeedMenuItem = { label: string; page?: string; url?: string; children?: SeedMenuItem[] };

export type SeedSite = {
  subdomain: string;
  name: string;
  theme: Prisma.InputJsonValue;
  owner: { email: string; name: string };
  members?: SeedMember[];
  /** The site's media library: every picture its pages, posts and settings use. */
  library?: SeedMedia[];
  pages: SeedPage[];
  posts?: SeedPost[];
  /**
   * Header and footer text and the logo (GOV-04). Filled in only where the site has none, so an edit in Settings
   * survives a re-run; one an owner cleared on purpose comes back, which is fine for a dev seed.
   */
  settings?: { tagline?: string; footerNote?: string; logo?: SeedMedia };
  /** Written only to a location that has no items yet, so menus built in the admin survive a re-run. */
  menus?: { header?: SeedMenuItem[]; footer?: SeedMenuItem[] };
};

/** `@media:<file>` in a block: the file's address in the site's library, filled in by the seed. */
export const media = (file: string) => `@media:${file}`;
