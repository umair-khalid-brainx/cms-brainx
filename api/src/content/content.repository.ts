import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Every method takes `siteId` as a required parameter (invariant 1) — there
// is no method here that can read or write across tenants by accident.
@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `typeId` null lists ordinary pages; an id lists that type's entries (TYP-01).
  // Entries never appear among the pages, and the reverse.
  findMany(siteId: string, typeId: string | null) {
    return this.prisma.content.findMany({
      where: { siteId, typeId, status: { not: 'archived' } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findManyArchived(siteId: string, typeId: string | null) {
    return this.prisma.content.findMany({
      where: { siteId, typeId, status: 'archived' },
      orderBy: { archivedAt: 'desc' },
    });
  }

  findBySlug(siteId: string, slug: string) {
    return this.prisma.content.findFirst({ where: { siteId, slug } });
  }

  /**
   * The only read the public site uses. "Live" means `status = published` —
   * a draft or archived page is indistinguishable from a missing one to an
   * anonymous visitor (D-030). Archived is a status of its own (D-032), so
   * this one condition already excludes it; there's no second flag to forget.
   */
  findLiveByPath(siteId: string, path: string) {
    return this.prisma.content.findFirst({
      where: { siteId, path, status: 'published' },
      // The author's name only (never their email) and the type, for an entry's public header (TYP-03).
      include: { author: { select: { name: true } }, type: true },
    });
  }

  /** A type's published entries, newest first (TYP-03). Never drafts or archived ones. */
  findPublishedByType(siteId: string, typeId: string, take: number) {
    return this.prisma.content.findMany({
      where: { siteId, typeId, status: 'published' },
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take,
    });
  }

  /**
   * Pages and entries (any status) whose blocks or custom field values mention `needle` anywhere — used to warn
   * before deleting a media file a page still uses (MED-02, B-12). A runtime
   * scan of the JSONB as text rather than a usage table kept in sync on every
   * save: always accurate, and cheap at one site's page count.
   */
  findReferencing(siteId: string, needle: string) {
    return this.prisma.$queryRaw<{ id: string; title: string; path: string; status: string }[]>`
      SELECT id, title, path, status::text AS status
      FROM content
      WHERE site_id = ${siteId}
        AND (strpos(blocks::text, ${needle}) > 0 OR strpos(data::text, ${needle}) > 0)
      ORDER BY title`;
  }

  create(siteId: string, data: Omit<Prisma.ContentUncheckedCreateInput, 'siteId'>) {
    return this.prisma.content.create({ data: { ...data, siteId } });
  }

  update(siteId: string, slug: string, data: Prisma.ContentUpdateInput) {
    // `updateMany` rather than `update` because the unique key we have is
    // (siteId, path)/id, not (siteId, slug) — this keeps the write scoped to
    // the tenant without a second existence check.
    return this.prisma.content.updateMany({ where: { siteId, slug }, data });
  }

  delete(siteId: string, slug: string) {
    return this.prisma.content.deleteMany({ where: { siteId, slug } });
  }
}
