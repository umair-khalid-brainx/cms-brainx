import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import { ContentRepository } from '../content/content.repository.js';
import { SITEMAP_LIMIT as SITEMAP_ROWS } from './sitemap-view.js';
import { ContentTypeRepository } from '../content-types/content-type.repository.js';
import { parseStoredFields, type FieldDefinition } from '../content-types/field-definitions.js';
import type { Prisma } from '../generated/prisma/client.js';
import { TermRepository } from '../taxonomy/term.repository.js';
import type { TermKind } from '../taxonomy/term-rules.js';
import { PreviewLinkRepository } from '../content/preview-link.repository.js';
import { MediaRepository } from '../media/media.repository.js';
import { ChromeRepository } from '../chrome/chrome.repository.js';
import { bottomLine, readChoice, resolveChoice } from '../chrome/chrome-rules.js';
import { MenuRepository } from '../menus/menu.repository.js';
import { publicMenu, storedPageIds, type PublicMenuItem } from '../menus/menu-tree.js';
import { RedirectRepository } from '../redirects/redirect.repository.js';
import { readSeo } from '../content/seo.js';
import { mediaValue } from '../content-types/field-values.js';
import { readSettings } from '../sites/site-settings.js';
import { buildSeo, entryPicture, type PublicSeo, type SeoImage } from './seo-view.js';
import { buildSitemap, type Sitemap } from './sitemap-view.js';
import { normaliseRedirectPath } from '../redirects/redirect-rules.js';
import { SiteRepository } from '../sites/site.repository.js';
import { SubdomainCache } from '../sites/subdomain-cache.js';
import type { CreateSubmissionDto, SubmissionAnswer } from '../submissions/dto/submission.dto.js';
import { SubmissionRepository } from '../submissions/submission.repository.js';
import {
  buildEntryFields,
  listingItem,
  mediaFilenames,
  type FileInfo,
  type ListingItem,
  type PublicField,
} from './entry-view.js';
import { ARCHIVE_PAGE_SIZE, mergeRelated, pageCount, parsePage, RELATED_LIMIT } from './term-view.js';
import { filenamesNeedingAlt, withLibraryAlt } from './image-alt.js';

/** A header as a page shows it, or null when the page hides it. */
export type PublicHeader = { logo: { url: string } | null; tagline: string; nav: PublicMenuItem[] };
/** A footer as a page shows it, or null when the page hides it. `bottomLine` is final text. */
export type PublicFooter = { note: string; bottomLine: string; groups: PublicMenuItem[] };
export type PublicChrome = { header: PublicHeader | null; footer: PublicFooter | null };

export type PublicSite = {
  name: string;
  subdomain: string;
  theme: unknown;
  /** Shown beside the name in the header; empty if none (GOV-04). */
  tagline: string;
  /** Shown in the footer; empty if none. */
  footerNote: string;
  /** The logo, as a full address, or null when none is set or its file has left the library. */
  logo: { url: string } | null;
};
/** What an entry shows above its page content (TYP-03). Absent for an ordinary page. */
export type PublicEntry = {
  type: { name: string; singularName: string; prefix: string };
  /** The author's name only. */
  author: string | null;
  publishedAt: Date | null;
  fields: PublicField[];
  /** Only the kinds its type has switched on (TAX-02); each links to `/category/<slug>` or `/tag/<slug>`. */
  categories: PublicTerm[];
  tags: PublicTerm[];
  /** Up to 3 newest published entries of the same type that share a category, else a tag; empty when none. */
  related: ListingItem[];
};
export type PublicTerm = { name: string; slug: string };
export type PublicPage = {
  title: string;
  path: string;
  blocks: unknown;
  updatedAt: Date;
  entry?: PublicEntry;
  /** What search engines and link previews get (SEO-01), fallbacks already applied. */
  seo: PublicSeo;
};
export type PublicListing = {
  type: { name: string; singularName: string; prefix: string };
  entries: ListingItem[];
};
/** A category or tag and one page of the published entries that carry it, newest first (TAX-02). */
export type PublicTermArchive = {
  term: { name: string; slug: string; kind: TermKind };
  entries: ListingItem[];
  page: number;
  pageCount: number;
  total: number;
};

// A type's listing shows this many, newest first. Term archives are paged (ARCHIVE_PAGE_SIZE); the type
// listing is not yet (B-34).
const LISTING_LIMIT = 50;
// A preview is never indexed (CNT-09), so it carries no search settings.
// Any status but archived (that is a 404): a reviewer previews a page in review, or a scheduled one (GOV-07).
export type PreviewPage = Omit<PublicPage, 'seo'> & { status: 'draft' | 'published' | 'in_review' | 'scheduled'; chrome: PublicChrome };

// What `randomBytes(32).toString('base64url')` produces; anything else is
// refused before touching the database.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * What an anonymous visitor of a tenant site may see. Returns only what the
 * public site renders — no ids, no status, no email; the author's name and the
 * dates shown on a page — so nothing internal leaks through a response nobody
 * logged in to get.
 */
@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly sites: SiteRepository,
    private readonly content: ContentRepository,
    private readonly previewLinks: PreviewLinkRepository,
    private readonly subdomainCache: SubdomainCache,
    private readonly submissions: SubmissionRepository,
    private readonly media: MediaRepository,
    private readonly types: ContentTypeRepository,
    private readonly config: ConfigService,
    private readonly redirects: RedirectRepository,
    private readonly menus: MenuRepository,
    private readonly terms: TermRepository,
    private readonly chromes: ChromeRepository,
  ) {}

  async getSite(subdomain: string): Promise<PublicSite> {
    // Name and theme are read fresh, not cached (D-035).
    const site = await this.sites.findById(await this.findSiteId(subdomain));
    if (!site) throw new NotFoundException('Site not found');
    const settings = readSettings(site.settings);
    const logo = settings.logo ? await this.libraryImage(site.id, settings.logo) : null;
    return {
      name: site.name,
      subdomain: site.subdomain,
      theme: site.themeJson,
      tagline: settings.tagline,
      footerNote: settings.footerNote,
      logo: logo && { url: logo.url },
    };
  }

  /**
   * The header and footer menus (GOV-03): page items at the page's current address, and nothing that
   * points at a page that isn't published. Read from this site's own items and pages only.
   */
  async getMenus(subdomain: string): Promise<Record<'header' | 'footer', PublicMenuItem[]>> {
    const siteId = await this.findSiteId(subdomain);
    const stored = await this.menus.findForPublic(siteId);
    const ids = storedPageIds(stored.header, stored.footer);
    const pages = new Map((ids.length > 0 ? await this.content.findFactsByIds(siteId, ids) : []).map((page) => [page.id, page]));
    return { header: publicMenu(stored.header, pages), footer: publicMenu(stored.footer, pages) };
  }

  /**
   * The addresses this site wants search engines to find (SEO-02): live pages and entries that
   * aren't noindex, and a listing per type. Another site's pages never appear: the rows are
   * read for this site only.
   */
  async getSitemap(subdomain: string): Promise<Sitemap> {
    const siteId = await this.findSiteId(subdomain);
    const rows = await this.content.findSitemapRows(siteId);
    const sitemap = buildSitemap(rows.slice(0, SITEMAP_ROWS));
    if (rows.length > SITEMAP_ROWS || sitemap.truncated) {
      this.logger.warn(`${subdomain} has more live addresses than one sitemap holds; the last ones are left out`);
    }
    return sitemap;
  }

  /**
   * Where an old address sends visitors (GOV-05), asked by `web` only after no page or
   * listing answered, so a page always wins. 404 when it redirects nowhere.
   */
  async getRedirect(subdomain: string, rawPath: string | undefined): Promise<{ to: string }> {
    const path = normaliseRedirectPath(rawPath ?? '');
    const redirect = path ? await this.redirects.findByFrom(await this.findSiteId(subdomain), path) : null;
    if (!redirect) throw new NotFoundException('No redirect');
    return { to: redirect.toPath };
  }

  async getPage(subdomain: string, rawPath: string | undefined): Promise<PublicPage> {
    if (rawPath?.includes('\u0000')) throw new NotFoundException('Page not found');
    const siteId = await this.findSiteId(subdomain);
    const page = await this.content.findLiveByPath(siteId, normalisePath(rawPath));
    if (!page) throw new NotFoundException('Page not found');
    const entry = page.type ? await this.entryOf(siteId, page, page.type) : undefined;
    return {
      title: page.title,
      path: page.path,
      blocks: await this.withLibraryAlt(siteId, page.blocks),
      updatedAt: page.updatedAt,
      ...(entry && { entry }),
      seo: await this.seoOf(siteId, page, entry),
    };
  }

  /**
   * A content type's published entries, newest first: the page at `/events`. An unknown address,
   * or another site's, is the same 404 as a missing page (D-030).
   */
  async getListing(subdomain: string, prefix: string): Promise<PublicListing> {
    // Exact, like every page address: `/Events` is no address, so no second URL for one listing.
    // A NUL character can't be in an address and Postgres refuses it, so it is a plain 404.
    if (prefix.includes('\u0000')) throw new NotFoundException('Page not found');
    const siteId = await this.findSiteId(subdomain);
    const type = await this.types.findByPrefix(siteId, prefix);
    if (!type) throw new NotFoundException('Page not found');
    const fields = parseStoredFields(type.fields);
    const rows = await this.content.findPublishedByType(siteId, type.id, LISTING_LIMIT);
    const files = await this.filesFor(siteId, fields, rows.map((row) => row.data));
    const origin = this.apiOrigin();
    return {
      type: { name: type.name, singularName: type.singularName, prefix: type.prefix },
      entries: rows.map((row) => listingItem(row, fields, files, origin)),
    };
  }

  /**
   * The page at `/category/news` or `/tag/launch` (TAX-02): the term and a page of the published entries
   * carrying it, newest first, only of types that still have that kind on. An unknown term or kind, another
   * site's term, or a page past the end is the same 404 as a missing page (D-030).
   */
  async getTermArchive(subdomain: string, kind: string, slug: string, rawPage: string | undefined): Promise<PublicTermArchive> {
    // Slugs and kinds are exact, like every address. A NUL can't be in one and Postgres refuses it.
    if (!isTermKind(kind) || slug.includes('\u0000')) throw new NotFoundException('Page not found');
    const page = parsePage(rawPage);
    if (page === null) throw new NotFoundException('Page not found');
    const siteId = await this.findSiteId(subdomain);
    const term = await this.terms.findBySlug(siteId, kind, slug);
    if (!term) throw new NotFoundException('Page not found');
    const { rows, total } = await this.content.findPublishedByTerm(siteId, term, (page - 1) * ARCHIVE_PAGE_SIZE, ARCHIVE_PAGE_SIZE);
    if (page > pageCount(total)) throw new NotFoundException('Page not found');
    // Entries of different types have different fields: each is shaped by its own type's.
    const fieldsOf = rows.map((row) => parseStoredFields(row.type?.fields));
    const files = await this.filesForRows(siteId, rows.map((row, i) => ({ fields: fieldsOf[i], data: row.data })));
    const origin = this.apiOrigin();
    return {
      term: { name: term.name, slug: term.slug, kind: term.kind },
      entries: rows.map((row, i) => listingItem(row, fieldsOf[i], files, origin)),
      page,
      pageCount: pageCount(total),
      total,
    };
  }

  /**
   * A page behind a preview link (CNT-09): its latest saved blocks, draft or
   * published. Unknown, revoked, another site's, or archived → the same 404,
   * so a guessed token learns nothing. Live pages still come only from
   * `findLiveByPath`; this is a separate door that needs the token.
   */
  async getPreview(subdomain: string, token: string): Promise<PreviewPage> {
    if (!TOKEN_SHAPE.test(token)) throw new NotFoundException('Preview not found');
    const siteId = await this.findSiteId(subdomain);
    const page = await this.previewLinks.findPageByToken(siteId, token);
    if (!page || page.status === 'archived') throw new NotFoundException('Preview not found');
    const entry = page.type ? await this.entryOf(siteId, page, page.type) : undefined;
    return {
      title: page.title,
      path: page.path,
      blocks: await this.withLibraryAlt(siteId, page.blocks),
      updatedAt: page.updatedAt,
      status: page.status,
      chrome: await this.chromeOf(siteId, page.chrome),
      ...(entry && { entry }),
    };
  }

  /**
   * The header and footer for the page at `rawPath` (live pages only; anything else, like a listing or
   * a missing page, gets the site's own). A part the page hides is null; one it names that no longer
   * exists falls back to the site's own.
   */
  async getChrome(subdomain: string, rawPath: string | undefined): Promise<PublicChrome> {
    if (rawPath?.includes('\u0000')) return this.chromeOf(await this.findSiteId(subdomain), undefined);
    const siteId = await this.findSiteId(subdomain);
    const page = await this.content.findLiveByPath(siteId, normalisePath(rawPath));
    return this.chromeOf(siteId, page?.chrome);
  }

  private async chromeOf(siteId: string, stored: unknown): Promise<PublicChrome> {
    const [site, presets, own] = await Promise.all([this.sites.findById(siteId), this.chromes.list(siteId), this.menus.findForPublic(siteId)]);
    if (!site) throw new NotFoundException('Site not found');
    const settings = readSettings(site.settings);
    const choice = readChoice(stored);
    const header = resolveChoice(choice.header, 'header', presets);
    const footer = resolveChoice(choice.footer, 'footer', presets);
    const used = presets.filter((preset) => (header.kind === 'preset' && preset.id === header.id) || (footer.kind === 'preset' && preset.id === footer.id));
    const theirs = await this.menus.findForPresets(siteId, used.map((preset) => preset.id));
    const preset = (resolved: typeof header) => (resolved.kind === 'preset' ? used.find((candidate) => candidate.id === resolved.id) : undefined);
    const headerPreset = preset(header);
    const footerPreset = preset(footer);
    const ids = storedPageIds(own.header, own.footer, ...theirs.values());
    const pages = new Map((ids.length > 0 ? await this.content.findFactsByIds(siteId, ids) : []).map((p) => [p.id, p]));
    const year = new Date().getFullYear();

    const logoPath = headerPreset?.logo || settings.logo;
    const logo = header.kind === 'hidden' || !logoPath ? null : await this.libraryImage(siteId, logoPath);
    return {
      header:
        header.kind === 'hidden'
          ? null
          : {
              logo: logo && { url: logo.url },
              tagline: headerPreset ? headerPreset.tagline : settings.tagline,
              nav: publicMenu(headerPreset ? (theirs.get(headerPreset.id) ?? []) : own.header, pages),
            },
      footer:
        footer.kind === 'hidden'
          ? null
          : {
              note: footerPreset ? footerPreset.note : settings.footerNote,
              bottomLine: bottomLine(footerPreset?.bottomText || settings.footerBottom, site.name, year),
              groups: publicMenu(footerPreset ? (theirs.get(footerPreset.id) ?? []) : own.footer, pages),
            },
    };
  }

  /** The page's search and sharing settings with fallbacks applied (SEO-01). */
  private async seoOf(siteId: string, page: { title: string; path: string; seo: unknown }, entry: PublicEntry | undefined): Promise<PublicSeo> {
    const site = await this.sites.findById(siteId);
    const chosen = readSeo(page.seo).ogImage;
    const socialImage = chosen ? await this.libraryImage(siteId, chosen) : null;
    // The logo is the last resort, so it is only looked up when nothing else would be the picture.
    const logoPath = readSettings(site?.settings).logo;
    const needsLogo = !socialImage && !entryPicture(entry?.fields) && logoPath !== '';
    const logo = needsLogo ? await this.libraryImage(siteId, logoPath) : null;
    return buildSeo({
      page,
      siteName: site?.name ?? '',
      entryFields: entry?.fields,
      socialImage,
      // The logo's alt text is the site's name, as in the header.
      siteLogo: logo && { url: logo.url, alt: site?.name ?? '' },
    });
  }

  /** A picture from this site's library, or null when the file has since been deleted or isn't an image. */
  private async libraryImage(siteId: string, stored: string): Promise<SeoImage | null> {
    // Checked again on the way out, not only when saved: a value edited by hand in the database
    // must never become a picture address (invariant 5's spirit; the rule is the one saving uses).
    const checked = mediaValue(siteId).safeParse(stored);
    if (!checked.success) return null;
    const file = await this.media.findImage(siteId, checked.data);
    return file && { url: `${this.apiOrigin()}${checked.data}`, alt: file.alt ?? '' };
  }

  private apiOrigin(): string {
    return (this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4001').replace(/\/+$/, '');
  }

  /** The library's details for every file the given entries' media fields name, in one query. */
  private async filesFor(siteId: string, fields: readonly FieldDefinition[], datas: unknown[]): Promise<Map<string, FileInfo>> {
    return this.filesForRows(siteId, datas.map((data) => ({ fields, data })));
  }

  /** The same lookup for rows that each have their own type's fields. */
  private async filesForRows(siteId: string, rows: { fields: readonly FieldDefinition[]; data: unknown }[]): Promise<Map<string, FileInfo>> {
    const names = [...new Set(rows.flatMap((row) => mediaFilenames(row.fields, row.data)))];
    if (names.length === 0) return new Map();
    const found = await this.media.findByFilenames(siteId, names);
    return new Map(found.map((row) => [row.filename, { mimetype: row.mimetype, alt: row.alt, title: row.title }]));
  }

  private async entryOf(
    siteId: string,
    page: { id: string; data: unknown; publishedAt: Date | null; author: { name: string } | null },
    type: { id: string; name: string; singularName: string; prefix: string; fields: unknown; hasCategories?: boolean; hasTags?: boolean },
  ): Promise<PublicEntry> {
    const fields = parseStoredFields(type.fields);
    const files = await this.filesFor(siteId, fields, [page.data]);
    const { categories, tags, related } = await this.termsOf(siteId, page, type, fields);
    return {
      type: { name: type.name, singularName: type.singularName, prefix: type.prefix },
      author: page.author?.name ?? null,
      publishedAt: page.publishedAt,
      fields: buildEntryFields(fields, page.data, files, this.apiOrigin()),
      categories,
      tags,
      related,
    };
  }

  /**
   * An entry's categories and tags (only the kinds its type has on) and its related entries (TAX-02):
   * the newest published ones of the same type sharing a category, then, only if fewer than three,
   * ones sharing a tag. No lookup at all for a type that uses neither.
   */
  private async termsOf(
    siteId: string,
    page: { id: string },
    type: { id: string; hasCategories?: boolean; hasTags?: boolean },
    typeFields: readonly FieldDefinition[],
  ) {
    const none = { categories: [] as PublicTerm[], tags: [] as PublicTerm[], related: [] as ListingItem[] };
    if (!type.hasCategories && !type.hasTags) return none;
    const own = await this.terms.findForContent(siteId, page.id);
    const categoryRows = type.hasCategories ? own.filter((term) => term.kind === 'category') : [];
    const tagRows = type.hasTags ? own.filter((term) => term.kind === 'tag') : [];
    const shown = ({ name, slug }: { name: string; slug: string }): PublicTerm => ({ name, slug });

    const byCategory = await this.content.findRelated(siteId, type.id, categoryRows.map((t) => t.id), [page.id], RELATED_LIMIT);
    const byTag =
      byCategory.length < RELATED_LIMIT
        ? await this.content.findRelated(siteId, type.id, tagRows.map((t) => t.id), [page.id, ...byCategory.map((r) => r.id)], RELATED_LIMIT - byCategory.length)
        : [];
    const picked = mergeRelated(byCategory, byTag);
    const files = await this.filesFor(siteId, typeFields, picked.map((row) => row.data));
    const origin = this.apiOrigin();
    return {
      categories: categoryRows.map(shown),
      tags: tagRows.map(shown),
      related: picked.map((row) => listingItem(row, typeFields, files, origin)),
    };
  }

  // Images with no alt text of their own use their library file's (MED-04, D-047):
  // one scoped query per page view, and none when every image has its own.
  private async withLibraryAlt(siteId: string, blocks: unknown): Promise<unknown> {
    const filenames = filenamesNeedingAlt(blocks, siteId);
    if (filenames.length === 0) return blocks;
    const rows = await this.media.findAltsByFilenames(siteId, filenames);
    const alts = new Map(rows.flatMap((row) => (row.alt?.trim() ? [[row.filename, row.alt] as const] : [])));
    return withLibraryAlt(blocks, siteId, alts);
  }

  /**
   * Stores one contact form submission (BLK-06, D-042). Reached only through
   * FormSecretGuard, i.e. from `web`'s server action, which has already run
   * the honeypot and rate limit. The form's fields are read from the live
   * page, never from the request, so required fields are enforced here
   * whatever the browser did.
   */
  async submit(subdomain: string, dto: CreateSubmissionDto): Promise<{ ok: true }> {
    const siteId = await this.findSiteId(subdomain);
    const page = await this.content.findLiveByPath(siteId, normalisePath(dto.path));
    if (!page) throw new NotFoundException('Page not found');

    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const form = contactFormSchema.safeParse(blocks[dto.blockIndex]);
    // The page was edited between the visitor loading it and submitting.
    if (!form.success) throw new BadRequestException('This form has changed. Reload the page and try again.');

    const answers = collectAnswers(form.data.fields, dto.values);
    await this.submissions.create(siteId, {
      contentId: page.id,
      pageTitle: page.title,
      pagePath: page.path,
      answers: answers as Prisma.InputJsonValue,
    });
    return { ok: true };
  }

  private async findSiteId(subdomain: string): Promise<string> {
    const siteId = await this.subdomainCache.resolve(subdomain);
    if (!siteId) throw new NotFoundException('Site not found');
    return siteId;
  }
}

const isTermKind = (value: string): value is TermKind => value === 'category' || value === 'tag';

/** `undefined`, `''` and `/` are the home page; `/wholesale/` matches `/wholesale`. */
function normalisePath(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

// The stored shape of a contactForm block (cms-blocks/types.ts ContactFormBlock),
// re-declared rather than imported: api doesn't depend on cms-blocks.
const contactFormSchema = z.object({
  type: z.literal('contactForm'),
  fields: z.array(
    z.object({
      name: z.string().min(1),
      label: z.string(),
      fieldType: z.enum(['text', 'email', 'textarea']),
      required: z.boolean().optional(),
    }),
  ),
});

type ContactFormField = z.infer<typeof contactFormSchema>['fields'][number];

const MAX_LENGTH: Record<ContactFormField['fieldType'], number> = { text: 500, email: 320, textarea: 5000 };
// Deliberately loose — "something@something.something". The browser's own
// type="email" check is the friendly one; this just stops obvious junk.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One answer per field the editor defined, in the form's order. Values for
 * names the form doesn't have are dropped, not stored.
 */
function collectAnswers(fields: ContactFormField[], values: Record<string, string>): SubmissionAnswer[] {
  const errors: string[] = [];
  const answers = fields.map((field) => {
    // Own keys only: a field named `constructor` must not read Object.prototype's.
    const value = Object.hasOwn(values, field.name) ? values[field.name].trim() : '';
    const label = field.label || field.name;
    if (field.required && !value) errors.push(`${label} is required`);
    else if (value.length > MAX_LENGTH[field.fieldType]) errors.push(`${label} is too long`);
    else if (field.fieldType === 'email' && value && !EMAIL.test(value)) errors.push(`${label} must be an email address`);
    return { name: field.name, label, value };
  });
  if (errors.length) throw new BadRequestException(errors);
  if (answers.every((answer) => !answer.value)) throw new BadRequestException('The form is empty');
  return answers;
}
