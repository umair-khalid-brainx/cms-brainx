import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { hasPermission } from '../auth/permission.js';
import type { Prisma } from '../generated/prisma/client.js';
import { UserRepository } from '../users/user.repository.js';
import { ContentRepository } from './content.repository.js';
import type { CreateContentDto, UpdateContentDto } from './dto/content.dto.js';

@Injectable()
export class ContentService {
  constructor(
    private readonly content: ContentRepository,
    private readonly users: UserRepository,
  ) {}

  async list(userId: string) {
    const siteId = await this.resolveSiteId(userId);
    return this.content.findMany(siteId);
  }

  async get(userId: string, slug: string) {
    const siteId = await this.resolveSiteId(userId);
    const page = await this.content.findBySlug(siteId, slug);
    if (!page) throw new NotFoundException('Page not found');
    return page;
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

    await this.content.update(membership.siteId, slug, {
      ...dto,
      blocks: dto.blocks as Prisma.InputJsonValue | undefined,
    });
    return this.content.findBySlug(membership.siteId, slug);
  }

  async remove(userId: string, slug: string): Promise<void> {
    const siteId = await this.resolveSiteId(userId);
    const existing = await this.content.findBySlug(siteId, slug);
    if (!existing) throw new NotFoundException('Page not found');
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
