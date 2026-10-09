import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { ContentRepository } from '../content/content.repository.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PreviewLinkRepository } from '../content/preview-link.repository.js';
import { SiteRepository } from '../sites/site.repository.js';
import { SubdomainCache } from '../sites/subdomain-cache.js';
import type { CreateSubmissionDto, SubmissionAnswer } from '../submissions/dto/submission.dto.js';
import { SubmissionRepository } from '../submissions/submission.repository.js';

export type PublicSite = { name: string; subdomain: string; theme: unknown };
export type PublicPage = { title: string; path: string; blocks: unknown; updatedAt: Date };
export type PreviewPage = PublicPage & { status: 'draft' | 'published' };

// What `randomBytes(32).toString('base64url')` produces; anything else is
// refused before touching the database.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * What an anonymous visitor of a tenant site may see. Returns only fields the
 * public site renders — no ids, no status, no timestamps beyond updatedAt —
 * so nothing internal leaks through a response nobody logged in to get.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly sites: SiteRepository,
    private readonly content: ContentRepository,
    private readonly previewLinks: PreviewLinkRepository,
    private readonly subdomainCache: SubdomainCache,
    private readonly submissions: SubmissionRepository,
  ) {}

  async getSite(subdomain: string): Promise<PublicSite> {
    // Name and theme are read fresh, not cached (D-035).
    const site = await this.sites.findById(await this.findSiteId(subdomain));
    if (!site) throw new NotFoundException('Site not found');
    return { name: site.name, subdomain: site.subdomain, theme: site.themeJson };
  }

  async getPage(subdomain: string, rawPath: string | undefined): Promise<PublicPage> {
    const siteId = await this.findSiteId(subdomain);
    const page = await this.content.findLiveByPath(siteId, normalisePath(rawPath));
    if (!page) throw new NotFoundException('Page not found');
    return { title: page.title, path: page.path, blocks: page.blocks, updatedAt: page.updatedAt };
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
    return { title: page.title, path: page.path, blocks: page.blocks, updatedAt: page.updatedAt, status: page.status };
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
