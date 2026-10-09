import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { hasPermission } from '../auth/permission.js';
import { Prisma } from '../generated/prisma/client.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { UserRepository } from '../users/user.repository.js';
import { ContentRepository } from './content.repository.js';
import type { CreateContentDto, UpdateContentDto } from './dto/content.dto.js';
import { StarterLayoutRepository } from '../starter-layouts/starter-layout.repository.js';
import { ContentTypeRepository } from '../content-types/content-type.repository.js';
import { parseStoredFields, visibleFields, type FieldDefinition } from '../content-types/field-definitions.js';
import { mergeEntryData, missingRequired, parseEntryData } from '../content-types/field-values.js';
import { PreviewLinkRepository } from './preview-link.repository.js';
import { checkPublishable } from './publish-checks.js';
import { sanitizeBlocks } from './sanitize.js';
import { normaliseSlug, slugProblem } from './slug.js';
import { RESERVED_PREFIXES } from '../content-types/prefix.js';

@Injectable()
export class ContentService {
  constructor(
    private readonly content: ContentRepository,
    private readonly users: UserRepository,
    private readonly previewLinks: PreviewLinkRepository,
    private readonly revalidation: RevalidationService,
    private readonly types: ContentTypeRepository,
    private readonly layouts: StarterLayoutRepository,
  ) {}

  /** Pages, or with `typePrefix` the entries of that content type (TYP-01). */
  async list(userId: string, typePrefix?: string) {
    const siteId = await this.resolveSiteId(userId);
    return this.content.findMany(siteId, (await this.resolveType(siteId, typePrefix))?.id ?? null);
  }

  async listArchived(userId: string, typePrefix?: string) {
    const siteId = await this.resolveSiteId(userId);
    return this.content.findManyArchived(siteId, (await this.resolveType(siteId, typePrefix))?.id ?? null);
  }

  async get(userId: string, slug: string) {
    const siteId = await this.resolveSiteId(userId);
    const page = await this.content.findBySlug(siteId, slug);
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  /** What would stop this page being published, as saved now (CNT-12). */
  async checks(userId: string, slug: string) {
    const page = await this.get(userId, slug);
    return this.withRequiredFields(
      this.allowFieldOnlyEntry(checkPublishable(page.blocks), page.typeId, page.data),
      await this.fieldsOf(page.siteId, page.typeId),
      page.data,
    );
  }

  async create(userId: string, dto: CreateContentDto) {
    const siteId = await this.resolveSiteId(userId);
    const type = await this.resolveType(siteId, dto.type);
    // A starter layout is copied on the server from the platform's own table, never taken from the
    // request, so a page can only start from what was seeded (TYP-04).
    let startingBlocks = dto.blocks;
    if (dto.layout) {
      if (dto.blocks.length > 0) throw new BadRequestException('Choose a layout or send blocks, not both');
      const layout = await this.layouts.findByKey(dto.layout);
      if (!layout) throw new NotFoundException('Starter layout not found');
      startingBlocks = structuredClone(layout.blocks) as typeof dto.blocks;
    }
    const slug = await this.uniqueSlug(siteId, dto.slug ?? dto.title, !type);
    // An entry lives under its type's address; a page at the top (TYP-01).
    const path = type ? `/${type.prefix}/${slug}` : slug === 'home' ? '/' : `/${slug}`;

    return this.content.create(siteId, {
      title: dto.title,
      slug,
      path,
      typeId: type?.id ?? null,
      authorId: userId,
      // Sanitise on write (BLK-05, invariant 5): what is stored is already safe.
      blocks: sanitizeBlocks(startingBlocks) as Prisma.InputJsonValue,
    });
  }

  async update(userId: string, slug: string, dto: UpdateContentDto) {
    const membership = await this.resolveMembership(userId);
    const existing = await this.content.findBySlug(membership.siteId, slug);
    if (!existing) throw new NotFoundException('Page not found');

    // content:write (checked by PermissionsGuard at the route) covers a plain
    // draft save; publishing is a step up, checked here because PATCH handles
    // both through the same route and the guard can't see into the body.
    if (dto.status === 'published' && !hasPermission(membership.role, 'content:publish')) {
      throw new ForbiddenException('Missing permission: content:publish');
    }

    // Archiving takes a page off the live site and restoring puts one back
    // into play, so both directions sit at the same tier as hard delete
    // (D-029/D-032). A restore to `published` needs content:publish as well.
    const entering = dto.status === 'archived' && existing.status !== 'archived';
    const leaving = dto.status !== undefined && dto.status !== 'archived' && existing.status === 'archived';
    if ((entering || leaving) && !hasPermission(membership.role, 'content:delete')) {
      throw new ForbiddenException('Missing permission: content:delete');
    }

    // A new slug moves the page to a new address (CNT-04). Checked before anything is written.
    const rename = dto.slug === undefined ? null : await this.planRename(membership.siteId, membership.role, existing, dto.slug);

    // Sanitise on write (BLK-05, invariant 5), before the checks below so they
    // judge what would actually be stored.
    const blocks = dto.blocks ? sanitizeBlocks(dto.blocks) : undefined;

    // An entry's custom fields (TYP-02): checked against its type on every write.
    // The saved values keep any field the type has since hidden.
    // Looked up only when needed: a plain autosave of blocks never touches the type.
    const needsFields = dto.data !== undefined || dto.status === 'published';
    // A live entry can't have a needed field emptied: its values follow the same rule as publishing.
    const keepsLiveRules = dto.data !== undefined && dto.status === undefined && existing.status === 'published';
    const fields = needsFields ? await this.fieldsOf(membership.siteId, existing.typeId) : [];
    let data: Record<string, unknown> | undefined;
    if (dto.data !== undefined) {
      if (!existing.typeId) throw new BadRequestException('Only entries of a content type have fields');
      const parsed = parseEntryData(fields, dto.data, membership.siteId);
      if (!parsed.ok) throw new BadRequestException(parsed.problems);
      data = mergeEntryData(existing.data, parsed);
      if (keepsLiveRules) {
        const problems = this.withRequiredFields({ errors: [] }, fields, data).errors;
        if (problems.length > 0) {
          throw new UnprocessableEntityException({ statusCode: 422, message: 'This entry is live, so these can’t be emptied', errors: problems, warnings: [] });
        }
      }
    }

    // Any move to `published` — publish, restore, or re-publishing from the
    // editor — must pass the publish checks, against the blocks it would go
    // live with. Draft saves (no status, or `draft`) never are (CNT-12). An
    // autosave of an already-live page isn't either: blocking it mid-edit
    // would lose work, and the editor checks before its Publish (D-036).
    if (dto.status === 'published') {
      const checks = this.withRequiredFields(
        this.allowFieldOnlyEntry(checkPublishable(blocks ?? existing.blocks), existing.typeId, data ?? existing.data),
        fields,
        data ?? existing.data,
      );
      if (checks.errors.length > 0) {
        throw new UnprocessableEntityException({ statusCode: 422, message: 'Fix these before publishing', ...checks });
      }
    }

    // The slug the client sent is never written as-is: only the normalised one, with its path.
    const { slug: _requestedSlug, ...changes } = dto;
    try {
      await this.content.update(membership.siteId, slug, {
        ...changes,
        ...(rename && { slug: rename.slug, path: rename.path }),
        blocks: blocks as Prisma.InputJsonValue | undefined,
        data: data as Prisma.InputJsonValue | undefined,
        // Set the first time it goes live and kept after (TYP-03).
        ...(dto.status === 'published' && !existing.publishedAt && { publishedAt: new Date() }),
        ...(entering && { archivedAt: new Date() }),
        ...(leaving && { archivedAt: null }),
      });
    } catch (error) {
      // Two pages moved to the same free slug at the same moment: planRename's check
      // passes for both, the unique index rejects the second write.
      if (rename && isUniqueViolation(error)) throw takenSlug(rename.slug);
      throw error;
    }
    const updated = await this.content.findBySlug(membership.siteId, rename?.slug ?? slug);

    // Live before or after this write → the public page changed: publish,
    // unpublish, archive, or a save to a live page. Refresh exactly that
    // site + path in `web`'s cache (CNT-08). Draft-only edits aren't public.
    if (existing.status === 'published' || updated?.status === 'published') {
      await this.revalidation.page(membership.site.subdomain, existing.path);
      // A moved page is also new at its new address (and gone from the old one, above).
      if (rename) await this.revalidation.page(membership.site.subdomain, rename.path);
      // An entry also sits in its type's listing (`/events`), which changed with it (TYP-03).
      if (existing.typeId) await this.revalidation.page(membership.site.subdomain, `/${existing.path.split('/')[1]}`);
    }
    return updated;
  }

  // A copy is always a fresh draft (CNT-10): duplicating a live page must
  // never put a second copy of it live. An archived page can't be copied —
  // that would bring it back into play, which needs content:delete (D-032).
  // `<slug>-copy`, then `-copy-2`, ... via uniqueSlug, next to the original —
  // same parent path, so this stays right once hierarchy (CNT-05) exists.
  async duplicate(userId: string, slug: string) {
    const siteId = await this.resolveSiteId(userId);
    const source = await this.content.findBySlug(siteId, slug);
    if (!source) throw new NotFoundException('Page not found');
    if (source.status === 'archived') throw new ConflictException('Restore this page before duplicating it');

    const copySlug = await this.uniqueSlug(siteId, `${source.slug}-copy`, source.typeId === null);
    const parentPath = source.path.slice(0, source.path.lastIndexOf('/'));

    return this.content.create(siteId, {
      title: `${source.title} (copy)`,
      slug: copySlug,
      path: `${parentPath}/${copySlug}`,
      // Same type as the original; the copy's author is whoever made the copy.
      typeId: source.typeId,
      authorId: userId,
      data: source.data as Prisma.InputJsonValue,
      // A write like any other, so rows saved before sanitising existed are cleaned here too.
      blocks: (Array.isArray(source.blocks)
        ? sanitizeBlocks(source.blocks as Parameters<typeof sanitizeBlocks>[0])
        : source.blocks) as Prisma.InputJsonValue,
    });
  }

  // A page's preview link (CNT-09): one per page, no expiry, until revoked.
  // Only the token goes back; admin knows where `web` serves it.
  async getPreviewLink(userId: string, slug: string) {
    const page = await this.get(userId, slug);
    const link = await this.previewLinks.findByContent(page.siteId, page.id);
    if (!link) throw new NotFoundException('This page has no preview link');
    return { token: link.token, createdAt: link.createdAt };
  }

  async createPreviewLink(userId: string, slug: string) {
    const page = await this.get(userId, slug);
    if (page.status === 'archived') throw new ConflictException('Restore this page before sharing a preview');
    // 32 random bytes: the token is the only thing standing between a draft
    // and anyone who has the URL, so it must be unguessable.
    const link = await this.previewLinks.findOrCreate(page.siteId, page.id, randomBytes(32).toString('base64url'));
    return { token: link.token, createdAt: link.createdAt };
  }

  async revokePreviewLink(userId: string, slug: string): Promise<void> {
    const page = await this.get(userId, slug);
    await this.previewLinks.deleteByContent(page.siteId, page.id);
  }

  // Only archived pages can be hard-deleted — the pages list offers Delete
  // Permanently on the Archived tab alone (see PagesListPage.tsx), and this
  // guard means that's structural, not just a UI affordance a client could
  // bypass by calling the API directly.
  async remove(userId: string, slug: string): Promise<void> {
    const siteId = await this.resolveSiteId(userId);
    const existing = await this.content.findBySlug(siteId, slug);
    if (!existing) throw new NotFoundException('Page not found');
    if (existing.status !== 'archived') throw new ConflictException('Archive this page before deleting it permanently');
    await this.content.delete(siteId, slug);
  }

  // Takes the user's first site membership — correct while every seeded user
  // belongs to exactly one site. Team/invite routes don't make this same
  // assumption (they take an explicit :siteId) because that feature is what
  // makes multi-membership users common; content routes still do, and are a
  // real spot to revisit once a site switcher exists. See DECISIONS.md D-023.
  private async resolveSiteId(userId: string): Promise<string> {
    return (await this.resolveMembership(userId)).siteId;
  }

  private async resolveMembership(userId: string) {
    const user = await this.users.findByIdWithMemberships(userId);
    const membership = user?.memberships[0];
    if (!membership) throw new ForbiddenException('No site membership');
    return membership;
  }

  /** The custom fields of an entry's type; none for a page. */
  private async fieldsOf(siteId: string, typeId: string | null): Promise<FieldDefinition[]> {
    if (!typeId) return [];
    return visibleFields(parseStoredFields((await this.types.findById(siteId, typeId))?.fields));
  }

  /**
   * An entry made only of field values (an event with a date and a venue, no body) can go live:
   * "add at least one block" is dropped when the entry has any value, so long as nothing else is wrong.
   */
  private allowFieldOnlyEntry<T extends { errors: { blockIndex: number | null; field: string | null; message: string }[] }>(
    checks: T,
    typeId: string | null,
    data: unknown,
  ): T {
    const hasValue = typeof data === 'object' && data !== null && Object.keys(data).length > 0;
    if (typeId && hasValue) {
      checks.errors = checks.errors.filter((e) => !(e.blockIndex === null && e.field === null && e.message === 'Add at least one block'));
    }
    return checks;
  }

  /** Adds "fill this in" errors for required fields with no value, so publishing waits for them. */
  private withRequiredFields<T extends { errors: { blockIndex: number | null; blockType: string | null; blockLabel: string | null; field: string | null; message: string }[] }>(
    checks: T,
    fields: readonly FieldDefinition[],
    data: unknown,
  ): T {
    for (const field of missingRequired(fields, data)) {
      checks.errors.push({
        blockIndex: null,
        blockType: null,
        blockLabel: null,
        field: `data.${field.key}`,
        message: `Fill in “${field.label}”`,
      });
    }
    return checks;
  }

  private async resolveType(siteId: string, prefix: string | undefined) {
    if (!prefix) return null;
    const type = await this.types.findByPrefix(siteId, prefix);
    if (!type) throw new NotFoundException('Content type not found');
    return type;
  }

  /**
   * The slug and path a page moves to, or null when the slug didn't actually change
   * (CNT-04). Refuses, with words for the person, what can't be used. The path keeps
   * everything before the last part: an entry stays under its type's prefix.
   */
  private async planRename(
    siteId: string,
    role: Parameters<typeof hasPermission>[0],
    existing: { slug: string; path: string; status: string; typeId: string | null },
    requested: string,
  ) {
    const page = !existing.typeId;
    const slug = normaliseSlug(requested);
    if (slug === existing.slug) return null;
    if (existing.path === '/') throw new BadRequestException('The home page’s address can’t be changed.');
    // Moving a live page changes the public site, so it sits at the same tier as
    // publishing (D-053); anyone who can edit can still move a draft.
    if (existing.status === 'published' && !hasPermission(role, 'content:publish')) {
      throw new ForbiddenException('Missing permission: content:publish');
    }
    const problem = slugProblem(slug, page);
    if (problem) throw new BadRequestException(problem);
    if (page && (await this.types.prefixes(siteId)).includes(slug)) {
      throw new ConflictException(`/${slug} is the address of a content type’s listing. Choose a different address.`);
    }
    if (await this.content.findBySlug(siteId, slug)) throw takenSlug(slug);
    return { slug, path: `${existing.path.slice(0, existing.path.lastIndexOf('/'))}/${slug}` };
  }

  // Slugs are unique across the whole site, because admin routes by slug alone.
  // A page also can't take a content type's address (`/events` is the type's
  // listing) or a word the site itself uses (`/sitemap.xml`'s `sitemap`), so it
  // gets a suffix instead (TYP-01, CNT-04) — the same words a rename refuses.
  // `home` is the exception: a page created as "Home" becomes the home page.
  private async uniqueSlug(siteId: string, base: string, page: boolean): Promise<string> {
    const slugified = slugify(base);
    const taken = page
      ? new Set([...(await this.types.prefixes(siteId)), ...[...RESERVED_PREFIXES].filter((word) => word !== 'home')])
      : new Set<string>();
    let candidate = slugified;
    let suffix = 2;
    while (taken.has(candidate) || (await this.content.findBySlug(siteId, candidate))) {
      candidate = `${slugified}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}

function takenSlug(slug: string): ConflictException {
  return new ConflictException(`Another page or entry already uses “${slug}”. Choose a different address.`);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Created slugs and changed slugs follow the same rules (CNT-04).
function slugify(value: string): string {
  return normaliseSlug(value) || 'untitled';
}
