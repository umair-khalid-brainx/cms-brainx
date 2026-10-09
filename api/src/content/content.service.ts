import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { hasPermission } from '../auth/permission.js';
import type { Prisma } from '../generated/prisma/client.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { UserRepository } from '../users/user.repository.js';
import { ContentRepository } from './content.repository.js';
import type { CreateContentDto, UpdateContentDto } from './dto/content.dto.js';
import { PreviewLinkRepository } from './preview-link.repository.js';
import { checkPublishable } from './publish-checks.js';

@Injectable()
export class ContentService {
  constructor(
    private readonly content: ContentRepository,
    private readonly users: UserRepository,
    private readonly previewLinks: PreviewLinkRepository,
    private readonly revalidation: RevalidationService,
  ) {}

  async list(userId: string) {
    const siteId = await this.resolveSiteId(userId);
    return this.content.findMany(siteId);
  }

  async listArchived(userId: string) {
    const siteId = await this.resolveSiteId(userId);
    return this.content.findManyArchived(siteId);
  }

  async get(userId: string, slug: string) {
    const siteId = await this.resolveSiteId(userId);
    const page = await this.content.findBySlug(siteId, slug);
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  /** What would stop this page being published, as saved now (CNT-12). */
  async checks(userId: string, slug: string) {
    return checkPublishable((await this.get(userId, slug)).blocks);
  }

  async create(userId: string, dto: CreateContentDto) {
    const siteId = await this.resolveSiteId(userId);
    const slug = await this.uniqueSlug(siteId, dto.slug ?? dto.title);
    const path = slug === 'home' ? '/' : `/${slug}`;

    return this.content.create(siteId, {
      title: dto.title,
      slug,
      path,
      blocks: dto.blocks as Prisma.InputJsonValue,
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

    // Any move to `published` — publish, restore, or re-publishing from the
    // editor — must pass the publish checks, against the blocks it would go
    // live with. Draft saves (no status, or `draft`) never are (CNT-12). An
    // autosave of an already-live page isn't either: blocking it mid-edit
    // would lose work, and the editor checks before its Publish (D-036).
    if (dto.status === 'published') {
      const checks = checkPublishable(dto.blocks ?? existing.blocks);
      if (checks.errors.length > 0) {
        throw new UnprocessableEntityException({ statusCode: 422, message: 'Fix these before publishing', ...checks });
      }
    }

    await this.content.update(membership.siteId, slug, {
      ...dto,
      blocks: dto.blocks as Prisma.InputJsonValue | undefined,
      ...(entering && { archivedAt: new Date() }),
      ...(leaving && { archivedAt: null }),
    });
    const updated = await this.content.findBySlug(membership.siteId, slug);

    // Live before or after this write → the public page changed: publish,
    // unpublish, archive, or a save to a live page. Refresh exactly that
    // site + path in `web`'s cache (CNT-08). Draft-only edits aren't public.
    if (existing.status === 'published' || updated?.status === 'published') {
      await this.revalidation.page(membership.site.subdomain, existing.path);
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

    const copySlug = await this.uniqueSlug(siteId, `${source.slug}-copy`);
    const parentPath = source.path.slice(0, source.path.lastIndexOf('/'));

    return this.content.create(siteId, {
      title: `${source.title} (copy)`,
      slug: copySlug,
      path: `${parentPath}/${copySlug}`,
      blocks: source.blocks as Prisma.InputJsonValue,
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

  private async uniqueSlug(siteId: string, base: string): Promise<string> {
    const slugified = slugify(base);
    let candidate = slugified;
    let suffix = 2;
    while (await this.content.findBySlug(siteId, candidate)) {
      candidate = `${slugified}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || 'untitled';
}
