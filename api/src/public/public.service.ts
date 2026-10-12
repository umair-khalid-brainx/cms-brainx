import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import { ContentRepository } from '../content/content.repository.js';
import { ContentTypeRepository } from '../content-types/content-type.repository.js';
import { parseStoredFields, type FieldDefinition } from '../content-types/field-definitions.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PreviewLinkRepository } from '../content/preview-link.repository.js';
import { MediaRepository } from '../media/media.repository.js';
import { RedirectRepository } from '../redirects/redirect.repository.js';
import { readSeo } from '../content/seo.js';
import { buildSeo, type PublicSeo, type SeoImage } from './seo-view.js';
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
import { filenamesNeedingAlt, withLibraryAlt } from './image-alt.js';

export type PublicSite = { name: string; subdomain: string; theme: unknown };
/** What an entry shows above its page content (TYP-03). Absent for an ordinary page. */
export type PublicEntry = {
  type: { name: string; singularName: string; prefix: string };
  /** The author's name only. */
  author: string | null;
  publishedAt: Date | null;
  fields: PublicField[];
};
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

// A listing shows this many, newest first. Paging comes with the archive pages (TAX-02).
const LISTING_LIMIT = 50;
// A preview is never indexed (CNT-09), so it carries no search settings.
export type PreviewPage = Omit<PublicPage, 'seo'> & { status: 'draft' | 'published' };

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
  ) {}

  async getSite(subdomain: string): Promise<PublicSite> {
    // Name and theme are read fresh, not cached (D-035).
    const site = await this.sites.findById(await this.findSiteId(subdomain));
    if (!site) throw new NotFoundException('Site not found');
    return { name: site.name, subdomain: site.subdomain, theme: site.themeJson };
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
      ...(entry && { entry }),
    };
  }

  /** The page's search and sharing settings with fallbacks applied (SEO-01). */
  private async seoOf(siteId: string, page: { title: string; path: string; seo: unknown }, entry: PublicEntry | undefined): Promise<PublicSeo> {
    const site = await this.sites.findById(siteId);
    const chosen = readSeo(page.seo).ogImage;
    return buildSeo({
      page,
      siteName: site?.name ?? '',
      entryFields: entry?.fields,
      socialImage: chosen ? await this.libraryImage(siteId, chosen) : null,
    });
  }

  /** A picture from this site's library, or null when the file has since been deleted or isn't an image. */
  private async libraryImage(siteId: string, path: string): Promise<SeoImage | null> {
    const filename = path.slice(path.lastIndexOf('/') + 1);
    const [file] = await this.media.findByFilenames(siteId, [filename]);
    if (!file || !file.mimetype.startsWith('image/')) return null;
    return { url: `${this.apiOrigin()}${path}`, alt: file.alt ?? '' };
  }

  private apiOrigin(): string {
    return (this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4001').replace(/\/+$/, '');
  }

  /** The library's details for every file the given entries' media fields name, in one query. */
  private async filesFor(siteId: string, fields: readonly FieldDefinition[], datas: unknown[]): Promise<Map<string, FileInfo>> {
    const names = [...new Set(datas.flatMap((data) => mediaFilenames(fields, data)))];
    if (names.length === 0) return new Map();
    const rows = await this.media.findByFilenames(siteId, names);
    return new Map(rows.map((row) => [row.filename, { mimetype: row.mimetype, alt: row.alt, title: row.title }]));
  }

  private async entryOf(
    siteId: string,
    page: { data: unknown; publishedAt: Date | null; author: { name: string } | null },
    type: { name: string; singularName: string; prefix: string; fields: unknown },
  ): Promise<PublicEntry> {
    const fields = parseStoredFields(type.fields);
    const files = await this.filesFor(siteId, fields, [page.data]);
    return {
      type: { name: type.name, singularName: type.singularName, prefix: type.prefix },
      author: page.author?.name ?? null,
      publishedAt: page.publishedAt,
      fields: buildEntryFields(fields, page.data, files, this.apiOrigin()),
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
