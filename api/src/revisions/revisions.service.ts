import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { hasPermission } from '../auth/permission.js';
import { Prisma } from '../generated/prisma/client.js';
import { ContentTypeRepository } from '../content-types/content-type.repository.js';
import { ContentRepository, PAGE_CHANGED } from '../content/content.repository.js';
import { sanitizeBlocks } from '../content/sanitize.js';
import { readSeo } from '../content/seo.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { TermRepository } from '../taxonomy/term.repository.js';
import type { TermLinks } from '../taxonomy/terms.service.js';
import { UserRepository } from '../users/user.repository.js';
import {
  decideRecording,
  reasonForSave,
  splitRestorableTerms,
  type LatestRevision,
  type PageStatus,
  type RevisionReason,
  type SaveRequest,
  type Snapshot,
  type TermSnapshot,
} from './revision-rules.js';
import { RevisionRepository, type RevisionRow } from './revision.repository.js';
import { lockedBecause } from '../content/workflow-rules.js';

/** The list shows this many, which is also how many are kept. */
const LIST_LIMIT = 50;

type PageRow = { id: string; siteId: string; typeId: string | null; title: string; blocks: unknown; data: unknown; seo: unknown; status: PageStatus };

/**
 * Revisions of pages and entries (GOV-01, D-062): recording one after a save, listing, reading one and
 * restoring it. The rules of when and what to keep are in revision-rules.ts.
 */
@Injectable()
export class RevisionsService {
  private readonly logger = new Logger(RevisionsService.name);
  /** The time of a save; a spec replaces it to move the clock. */
  now: () => Date = () => new Date();

  constructor(
    private readonly revisions: RevisionRepository,
    private readonly content: ContentRepository,
    private readonly terms: TermRepository,
    private readonly types: ContentTypeRepository,
    private readonly users: UserRepository,
    private readonly revalidation: RevalidationService,
  ) {}

  /**
   * Called by ContentService.update once its write has committed, with the page as it now is. Records
   * nothing for a request that changed no content (a move alone). A failure is logged by the caller and
   * never fails the save.
   */
  async recordSave(siteId: string, userId: string, statusBefore: PageStatus, request: SaveRequest, page: PageRow): Promise<void> {
    const reason = reasonForSave(request, statusBefore);
    if (reason) await this.record(siteId, userId, reason, page);
  }

  /** Records `page`'s state as it is now: inserts, overwrites the latest autosave, or does nothing (the rules decide). */
  async record(siteId: string, userId: string | null, reason: RevisionReason, page: PageRow): Promise<void> {
    const snapshot = await this.snapshotOf(siteId, page);
    const latest = await this.revisions.findLatest(siteId, page.id);
    const decision = decideRecording({ reason, authorId: userId, snapshot, latest: latest && toLatest(latest), now: this.now() });
    if (decision.action === 'skip') return;
    if (decision.action === 'update') {
      const written = await this.revisions.overwrite(siteId, page.id, decision.id, snapshot);
      if (written.count > 0) return;
    }
    await this.revisions.insertAndPrune(siteId, page.id, { reason, authorId: userId, snapshot });
  }

  async list(userId: string, slug: string) {
    const { siteId, page } = await this.pageOf(userId, slug);
    const rows = await this.revisions.findMany(siteId, page.id, LIST_LIMIT);
    return rows.map((row) => ({ id: row.id, createdAt: row.createdAt, savedAt: row.updatedAt, reason: row.reason, status: row.status, title: row.title, author: row.author }));
  }

  /** One revision whole, for the compare screen (GOV-02). */
  async get(userId: string, slug: string, id: string) {
    const { siteId, page } = await this.pageOf(userId, slug);
    const row = await this.revisions.findById(siteId, page.id, id);
    if (!row) throw new NotFoundException('Revision not found');
    return {
      id: row.id,
      createdAt: row.createdAt,
      savedAt: row.updatedAt,
      reason: row.reason,
      status: row.status,
      title: row.title,
      blocks: row.blocks,
      data: row.data,
      seo: row.seo,
      terms: asTerms(row.terms),
      author: row.author,
    };
  }

  /**
   * Puts a revision's title, blocks, field values, SEO and terms back, and leaves the page's status and
   * address alone. First the page as it stands is kept (`before_restore`, unless the latest revision already
   * holds exactly that), then the content is replaced, then the result is recorded (`restore`).
   * Blocks are sanitised again on write. Terms deleted since are dropped and named in the answer.
   */
  async restore(
    userId: string,
    slug: string,
    id: string,
    /** The publish checks, for a live page: what would stop this content being live (supplied by the controller, which can reach ContentService). */
    checkLive: (page: PageRow, snapshot: { blocks: unknown; data: unknown }) => Promise<{ errors: unknown[]; warnings?: unknown[] }>,
  ) {
    const { siteId, role, subdomain, page } = await this.pageOf(userId, slug);
    // A page in review or scheduled is locked, a restore included (GOV-07).
    const locked = lockedBecause(page.status);
    if (locked) throw new ConflictException(locked);
    // A live page changes on the site straight away, so it needs the same permission as publishing (D-062).
    if (page.status === 'published' && !hasPermission(role, 'content:publish')) {
      throw new ForbiddenException('Missing permission: content:publish');
    }
    const revision = await this.revisions.findById(siteId, page.id, id);
    if (!revision) throw new NotFoundException('Revision not found');

    // A live page can't be put back into a state that couldn't be published today: a block type since
    // removed, a required field since added. The same refusal as saving a live page (D-062).
    if (page.status === 'published') {
      const checks = await checkLive(page, { blocks: sanitizeBlocks(Array.isArray(revision.blocks) ? (revision.blocks as Parameters<typeof sanitizeBlocks>[0]) : []), data: revision.data });
      if (checks.errors.length > 0) {
        throw new UnprocessableEntityException({ statusCode: 422, message: 'This page is live, and that version can’t be published as it is', ...checks });
      }
    }

    const type = page.typeId ? await this.types.findById(siteId, page.typeId) : null;
    const wanted = asTerms(revision.terms);
    const existing = new Map((wanted.length > 0 ? await this.terms.findByIds(siteId, wanted.map((term) => term.id)) : []).map((term) => [term.id, term]));
    const { keep, dropped } = splitRestorableTerms(wanted, existing, type);
    const links: TermLinks | undefined =
      type && (type.hasCategories || type.hasTags)
        ? [
            ...(type.hasCategories ? [{ kind: 'category' as const, termIds: keep.filter((t) => t.kind === 'category').map((t) => t.id) }] : []),
            ...(type.hasTags ? [{ kind: 'tag' as const, termIds: keep.filter((t) => t.kind === 'tag').map((t) => t.id) }] : []),
          ]
        : undefined;
    const termsBefore = links ? (await this.terms.findForContent(siteId, page.id)).map((term) => term.id).sort().join() : '';

    // The page as it stands is saved first; if that fails nothing has been replaced.
    await this.record(siteId, userId, 'before_restore', page);

    let written;
    try {
      written = await this.content.update(
        siteId,
        page.slug,
        {
          title: revision.title,
          blocks: sanitizeBlocks(Array.isArray(revision.blocks) ? (revision.blocks as Parameters<typeof sanitizeBlocks>[0]) : []) as Prisma.InputJsonValue,
          data: revision.data as Prisma.InputJsonValue,
          seo: readSeo(revision.seo) as Prisma.InputJsonValue,
        },
        links,
        // Only while it still has the status checked above: not after it went into review or live (GOV-07).
        page.status,
      );
    } catch (error) {
      // A category or tag deleted between the check above and the write: the foreign key refuses, nothing was replaced.
      if (links && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('A category or tag was just deleted. Reload the page and try again.');
      }
      throw error;
    }
    // Deleted, or its status changed (into review, say), since it was read: nothing was replaced.
    if (written.count === 0) throw new ConflictException(PAGE_CHANGED);

    const after = await this.content.findBySlug(siteId, page.slug);
    if (!after) throw new NotFoundException('Page not found');
    try {
      await this.record(siteId, userId, 'restore', after);
    } catch (error) {
      this.logger.error(`The restore stands, but its revision was not recorded: ${error instanceof Error ? error.message : String(error)}`);
    }

    // The public page, only when it is live (a draft isn't public); an entry's listing too, and its term
    // archives when its terms changed (D-061).
    if (after.status === 'published') {
      await this.revalidation.page(subdomain, after.path);
      if (after.typeId) await this.revalidation.page(subdomain, `/${after.path.split('/')[1]}`);
      const termsAfter = links ? (await this.terms.findForContent(siteId, page.id)).map((term) => term.id).sort().join() : '';
      if (after.typeId && termsAfter !== termsBefore) await this.revalidation.site(subdomain);
    }
    return { restored: true, from: { id: revision.id, createdAt: revision.createdAt, savedAt: revision.updatedAt }, droppedTerms: dropped.map(({ name, kind }) => ({ name, kind })) };
  }

  async snapshotOf(siteId: string, page: PageRow): Promise<Snapshot> {
    const terms: TermSnapshot[] = page.typeId
      ? (await this.terms.findForContent(siteId, page.id)).map(({ id, name, kind }) => ({ id, name, kind }))
      : [];
    return { title: page.title, blocks: page.blocks, data: page.data, seo: page.seo, terms, status: page.status };
  }

  private async pageOf(userId: string, slug: string) {
    const membership = (await this.users.findByIdWithMemberships(userId))?.memberships[0];
    if (!membership) throw new ForbiddenException('No site membership');
    const page = await this.content.findBySlug(membership.siteId, slug);
    if (!page) throw new NotFoundException('Page not found');
    return { siteId: membership.siteId, role: membership.role, subdomain: membership.site.subdomain, page };
  }
}

function toLatest(row: RevisionRow): LatestRevision {
  return {
    id: row.id,
    reason: row.reason,
    authorId: row.authorId,
    createdAt: row.createdAt,
    snapshot: { title: row.title, blocks: row.blocks, data: row.data, seo: row.seo, terms: asTerms(row.terms), status: row.status },
  };
}

/** A stored term snapshot read back; anything malformed is ignored. */
function asTerms(stored: unknown): TermSnapshot[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (item): item is TermSnapshot =>
      typeof item === 'object' && item !== null && typeof item.id === 'string' && typeof item.name === 'string' && (item.kind === 'category' || item.kind === 'tag'),
  );
}
