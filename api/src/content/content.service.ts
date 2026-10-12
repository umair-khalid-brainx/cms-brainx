import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { MenuRepository } from '../menus/menu.repository.js';
import { RedirectsService } from '../redirects/redirects.service.js';
import { checkPublishable } from './publish-checks.js';
import { sanitizeBlocks } from './sanitize.js';
import { normaliseSlug, slugProblem } from './slug.js';
import { parseSeo, readSeo } from './seo.js';
import { depthUnder, MAX_DEPTH, planMove, type PathMove, type TreePage } from './page-tree.js';
import { RESERVED_PREFIXES } from '../content-types/prefix.js';
import { TermsService, type CheckedAssignment } from '../taxonomy/terms.service.js';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly content: ContentRepository,
    private readonly users: UserRepository,
    private readonly previewLinks: PreviewLinkRepository,
    private readonly revalidation: RevalidationService,
    private readonly types: ContentTypeRepository,
    private readonly layouts: StarterLayoutRepository,
    private readonly redirects: RedirectsService,
    private readonly menus: MenuRepository,
    private readonly terms: TermsService,
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

  /** The editor's read: the page, and for an entry its categories and tags (TAX-01). */
  async getForEdit(userId: string, slug: string) {
    const page = await this.get(userId, slug);
    return this.withTerms(page);
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
    const { siteId, site } = await this.resolveMembership(userId);
    let created;
    try {
      created = await this.createRow(userId, siteId, dto);
    } catch (error) {
      // A category deleted between the check and the insert: the foreign key refuses the whole create.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003' && (dto.categoryIds?.length || dto.tags?.length)) {
        throw new ConflictException('A category or tag was just deleted. Reload the page and try again.');
      }
      throw error;
    }
    // A page always wins over a redirect from its address (GOV-05).
    await this.afterWrite('create', () => this.redirects.pathTaken(siteId, site.subdomain, created.path));
    return this.withTerms(created);
  }

  private async createRow(userId: string, siteId: string, dto: CreateContentDto) {
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
    if (dto.parentId && type) throw new BadRequestException('Only pages can sit under another page.');
    // Categories and tags are checked before anything is written (TAX-01).
    const checked = await this.terms.checkAssignment(siteId, type, { categoryIds: dto.categoryIds, tags: dto.tags });
    // Reserved words and type prefixes only matter at the top of the site.
    const slug = await this.uniqueSlug(siteId, dto.slug ?? dto.title, !type && !dto.parentId);
    // New tags are created only now, after every other check, right before the write.
    const links = await this.terms.materialise(siteId, checked);
    const row = {
      title: dto.title,
      slug,
      typeId: type?.id ?? null,
      parentId: dto.parentId ?? null,
      authorId: userId,
      // Sanitise on write (BLK-05, invariant 5): what is stored is already safe.
      blocks: sanitizeBlocks(startingBlocks) as Prisma.InputJsonValue,
      // Written with the entry, in the same statement.
      ...(links && { terms: { create: links.flatMap((link) => link.termIds.map((termId) => ({ termId }))) } }),
    };
    // An entry lives under its type's address; a page at the top (TYP-01).
    if (!dto.parentId) {
      return this.content.create(siteId, { ...row, path: type ? `/${type.prefix}/${slug}` : slug === 'home' ? '/' : `/${slug}` });
    }
    // A page under a parent (CNT-05): its address starts with the parent's, read under the
    // site's tree lock so the parent can't move away before this page is written.
    const parentId = dto.parentId;
    return this.content.createInTree(siteId, (tree) => {
      const parent = tree.find((candidate) => candidate.id === parentId);
      if (!parent) throw new BadRequestException('That parent page doesn’t exist on this site.');
      if (parent.path === '/') throw new BadRequestException('Pages can’t sit under the home page.');
      if (depthUnder(tree, parent.id) > MAX_DEPTH) {
        throw new BadRequestException(`Pages can be nested at most ${MAX_DEPTH} levels deep.`);
      }
      return { ...row, path: `${parent.path}/${slug}` };
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

    // SEO settings are checked before anything is written (SEO-01).
    let seo: Prisma.InputJsonValue | undefined;
    if (dto.seo !== undefined) {
      const parsed = parseSeo(dto.seo, membership.siteId);
      if (!parsed.ok) throw new BadRequestException(parsed.problems);
      seo = parsed.seo;
    }

    // Categories and tags (TAX-01): checked against the entry's type before anything is written, and
    // written in the same transaction as the entry.
    let checkedLinks: CheckedAssignment | null = null;
    if (dto.categoryIds !== undefined || dto.tags !== undefined) {
      const type = existing.typeId ? await this.types.findById(membership.siteId, existing.typeId) : null;
      checkedLinks = await this.terms.checkAssignment(membership.siteId, type, { categoryIds: dto.categoryIds, tags: dto.tags });
    }

    // A new slug or parent moves the page, and every page below it, to a new address
    // (CNT-04/05/06). Checked whole before anything is written.
    const move =
      dto.slug === undefined && dto.parentId === undefined
        ? null
        : await this.planMove(membership.siteId, membership.role, existing, { slug: dto.slug, parentId: dto.parentId });

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
    const { slug: _requestedSlug, parentId: _requestedParent, categoryIds: _categoryIds, tags: _tags, ...changes } = dto;
    const write = {
      ...changes,
      ...(move && { slug: move.slug, parentId: move.parentId }),
      blocks: blocks as Prisma.InputJsonValue | undefined,
      data: data as Prisma.InputJsonValue | undefined,
      seo,
      // Set the first time it goes live and kept after (TYP-03).
      ...(dto.status === 'published' && !existing.publishedAt && { publishedAt: new Date() }),
      ...(entering && { archivedAt: new Date() }),
      ...(leaving && { archivedAt: null }),
    };
    // Every address that changed: the page's own and, for a page, every page below it (CNT-06).
    let moves: PathMove[] = [];
    // New tags are created only now, after every check above, so a refused save leaves none behind.
    const links = await this.terms.materialise(membership.siteId, checkedLinks);
    try {
      if (move?.inTree) {
        moves = (await this.content.updateInTree(membership.siteId, slug, write, move.inTree)).moves;
      } else {
        await this.content.update(membership.siteId, slug, { ...write, ...(move && { path: move.path }) }, links ?? undefined);
        if (move) {
          const everPublished = existing.status === 'published' || Boolean(existing.publishedAt);
          moves = [{ id: existing.id, oldPath: existing.path, newPath: move.path, status: existing.status, everPublished }];
        }
      }
    } catch (error) {
      // Two pages moved to the same free address at the same moment: planMove's checks
      // pass for both, a unique index rejects the second write.
      // Too long in the queue behind other moves on this site (Prisma's transaction timeout).
      if (move && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
        throw new ConflictException('The site is busy with another move. Try again.');
      }
      // A category deleted between the check above and the write: the foreign key refuses it, and the
      // whole save (entry included) was rolled back.
      if (links && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('A category or tag was just deleted. Reload the page and try again.');
      }
      if (move && isUniqueViolation(error)) {
        throw move.slug === existing.slug ? new ConflictException('Another page took that address just now. Try again.') : takenSlug(move.slug);
      }
      throw error;
    }
    const updated = await this.content.findBySlug(membership.siteId, move?.slug ?? slug);

    // Live before or after this write → the public page changed: publish,
    // unpublish, archive, or a save to a live page. Refresh exactly that
    // site + path in `web`'s cache (CNT-08). Draft-only edits aren't public.
    if (existing.status === 'published' || updated?.status === 'published') {
      await this.revalidation.page(membership.site.subdomain, existing.path);
      // A moved page is also new at its new address (and gone from the old one, above).
      const own = moves.find((m) => m.id === existing.id);
      if (own) await this.revalidation.page(membership.site.subdomain, own.newPath);
      // An entry also sits in its type's listing (`/events`), which changed with it (TYP-03).
      if (existing.typeId) await this.revalidation.page(membership.site.subdomain, `/${existing.path.split('/')[1]}`);
    }
    // A menu points at pages (GOV-03): when one that is in a menu goes live or off, or moves, the header
    // and footer of every page of the site change, so the whole site is refreshed.
    const wentLiveOrOff = (existing.status === 'published') !== (updated?.status === 'published');
    if (wentLiveOrOff || moves.length > 0) {
      // After the save has committed, so a failure to ask is logged and never reported as a failed save.
      await this.afterWrite('menu refresh', async () => {
        if (await this.menus.usesPages(membership.siteId, [...new Set([existing.id, ...moves.map((m) => m.id)])])) {
          await this.revalidation.site(membership.site.subdomain);
        }
      });
    }
    // Live pages below a moved one changed address too (CNT-06): gone from the old, new at the new.
    for (const below of moves) {
      if (below.id === existing.id || below.status !== 'published') continue;
      await this.revalidation.page(membership.site.subdomain, below.oldPath);
      await this.revalidation.page(membership.site.subdomain, below.newPath);
    }
    // Old addresses that were ever public now redirect to the new ones; new ones lose any redirect (GOV-05).
    await this.afterWrite('move', () =>
      this.redirects.pagesMoved(
        membership.siteId,
        membership.site.subdomain,
        moves.map((m) => ({ from: m.oldPath, to: m.newPath, everPublished: m.everPublished })),
        userId,
      ),
    );
    // A move also says which addresses changed, old → new, for the editor.
    const result = updated ? await this.withTerms(updated) : updated;
    return move ? { ...result, moved: moves.map((m) => ({ from: m.oldPath, to: m.newPath })) } : result;
  }

  // A copy is always a fresh draft (CNT-10): duplicating a live page must
  // never put a second copy of it live. An archived page can't be copied —
  // that would bring it back into play, which needs content:delete (D-032).
  // `<slug>-copy`, then `-copy-2`, ... via uniqueSlug, next to the original —
  // same parent path, so this stays right once hierarchy (CNT-05) exists.
  async duplicate(userId: string, slug: string) {
    const { siteId, site } = await this.resolveMembership(userId);
    const copy = await this.duplicateRow(userId, siteId, slug);
    await this.afterWrite('duplicate', () => this.redirects.pathTaken(siteId, site.subdomain, copy.path));
    return copy;
  }

  private async duplicateRow(userId: string, siteId: string, slug: string) {
    const source = await this.content.findBySlug(siteId, slug);
    if (!source) throw new NotFoundException('Page not found');
    if (source.status === 'archived') throw new ConflictException('Restore this page before duplicating it');

    const copySlug = await this.uniqueSlug(siteId, `${source.slug}-copy`, source.typeId === null && source.parentId === null);
    const row = {
      title: `${source.title} (copy)`,
      slug: copySlug,
      // Same type and parent as the original; the copy's author is whoever made the copy.
      typeId: source.typeId,
      parentId: source.parentId,
      authorId: userId,
      data: source.data as Prisma.InputJsonValue,
      // The copy keeps the search settings but not the canonical address: two pages naming the
      // same canonical would tell search engines they are one (SEO-01).
      seo: { ...readSeo(source.seo), canonicalUrl: '' },
      // A write like any other, so rows saved before sanitising existed are cleaned here too.
      blocks: (Array.isArray(source.blocks)
        ? sanitizeBlocks(source.blocks as Parameters<typeof sanitizeBlocks>[0])
        : source.blocks) as Prisma.InputJsonValue,
    };
    const parentId = source.parentId;
    if (!parentId) return this.content.create(siteId, { ...row, path: `${source.path.slice(0, source.path.lastIndexOf('/'))}/${copySlug}` });
    // Under a parent: its address is read under the site's tree lock, like any create there (CNT-05).
    return this.content.createInTree(siteId, (tree) => {
      const parent = tree.find((candidate) => candidate.id === parentId);
      if (!parent) throw new ConflictException('This page’s parent page was just removed. Try again.');
      return { ...row, path: `${parent.path}/${copySlug}` };
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
    // Its child pages would lose their place (CNT-05); the database refuses it too.
    if ((await this.content.countChildren(siteId, existing.id)) > 0) {
      throw new ConflictException('Move or delete the pages under this one first.');
    }
    // A menu item for this page, and everything under it, would go with it (GOV-03): take the page out of the menu first.
    const menus = await this.menus.locationsUsing(siteId, existing.id);
    if (menus.length > 0) {
      throw new ConflictException(`This page is in the ${menus.join(' and ')} menu. Remove it from the menu first, then delete it.`);
    }
    try {
      await this.content.delete(siteId, slug);
    } catch (error) {
      // A page put under this one since the count above: the foreign key refuses the delete.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Move or delete the pages under this one first.');
      }
      throw error;
    }
  }

  /**
   * Redirect bookkeeping after a page write that has already committed (GOV-05). A failure
   * here mustn't report the save itself as failed: it's logged, and the redirect can be
   * added by hand on the Redirects screen.
   */
  private async afterWrite(what: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error(`Redirects not updated after a ${what}: ${error instanceof Error ? error.message : String(error)}`);
    }
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

  /** An entry with its categories and tags; a page comes back as it is (TAX-01). */
  private async withTerms<T extends { id: string; siteId: string; typeId: string | null }>(row: T) {
    if (!row.typeId) return row;
    const type = await this.types.findById(row.siteId, row.typeId);
    return { ...row, ...(await this.terms.forEntry(row.siteId, row.id, type)) };
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
   * Where a page moves to (CNT-04/05/06): a new slug, a new parent, or both, plus the
   * address of every page below it. Null when nothing actually changes. Refuses, with
   * words for the person, what can't be used; nothing is written until all of it passes.
   */
  private async planMove(
    siteId: string,
    role: Parameters<typeof hasPermission>[0],
    existing: { id: string; slug: string; path: string; status: string; typeId: string | null; parentId: string | null },
    requested: { slug?: string; parentId?: string | null },
  ): Promise<
    | { slug: string; parentId: string | null; path: string; inTree?: undefined }
    | { slug: string; parentId: string | null; path?: undefined; inTree: (pages: TreePage[]) => { path: string; descendants: { id: string; path: string }[]; moves: PathMove[] } }
    | null
  > {
    const page = !existing.typeId;
    const slug = requested.slug === undefined ? existing.slug : normaliseSlug(requested.slug);
    const parentId = requested.parentId === undefined ? existing.parentId : requested.parentId;
    const slugChanged = slug !== existing.slug;
    const parentChanged = parentId !== existing.parentId;
    if (!slugChanged && !parentChanged) return null;
    if (existing.path === '/') throw new BadRequestException('The home page’s address can’t be changed.');
    if (!page && parentId !== null) throw new BadRequestException('Only pages can sit under another page.');
    // Moving a live page changes the public site, so it sits at the same tier as
    // publishing (D-053); anyone who can edit can still move a draft. Checked first,
    // so a refused move says nothing about which addresses are taken.
    const mayMoveLive = hasPermission(role, 'content:publish');
    if (existing.status === 'published' && !mayMoveLive) throw new ForbiddenException('Missing permission: content:publish');

    // Reserved words and type prefixes only matter at the top of the site, so a child
    // page called "search" is fine until it moves up there.
    const topLevel = page && parentId === null;
    const problem = slugProblem(slug, topLevel);
    if (problem) throw new BadRequestException(problem);
    if (topLevel && (await this.types.prefixes(siteId)).includes(slug)) {
      throw new ConflictException(`/${slug} is the address of a content type’s listing. Choose a different address.`);
    }
    if (slugChanged && (await this.content.findBySlug(siteId, slug))) throw takenSlug(slug);

    if (!page) return { slug, parentId: null, path: `${existing.path.slice(0, existing.path.lastIndexOf('/'))}/${slug}` };
    // A page's new address depends on the tree, so it's worked out from the tree as it is
    // inside the write's transaction, under the site's lock (ContentRepository.updateInTree).
    return {
      slug,
      parentId,
      inTree: (pages) => {
        const plan = planMove(pages, existing.id, slug, parentId);
        if (!plan.ok) throw plan.conflict ? new ConflictException(plan.problem) : new BadRequestException(plan.problem);
        // A draft can have live pages below it: moving it moves them too.
        if (!mayMoveLive && plan.moves.some((m) => m.status === 'published')) {
          throw new ForbiddenException('Missing permission: content:publish');
        }
        const descendants = plan.moves.filter((m) => m.id !== existing.id).map((m) => ({ id: m.id, path: m.newPath }));
        return { path: plan.path, descendants, moves: plan.moves };
      },
    };
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
