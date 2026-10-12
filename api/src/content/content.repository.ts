import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SITEMAP_LIMIT } from '../public/sitemap-view.js';

const TREE_FIELDS = { id: true, parentId: true, slug: true, path: true, status: true, publishedAt: true } as const;
// Waiting for the site's tree lock counts against the transaction's time, so allow more
// than Prisma's 5 s: moves queue behind each other instead of failing.
export const TREE_TRANSACTION = { maxWait: 10_000, timeout: 20_000 };
/** Every page of the site (never entries), just what the page tree needs (CNT-05). */
function pageTree(client: Prisma.TransactionClient, siteId: string): Promise<TreePageRow[]> {
  return client.content.findMany({ where: { siteId, typeId: null }, select: TREE_FIELDS });
}

export type TreePageRow = { id: string; parentId: string | null; slug: string; path: string; status: string; publishedAt: Date | null };

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

  /** The address and status of these pages and entries of the site, by id (menus, GOV-03). */
  findFactsByIds(siteId: string, ids: readonly string[]) {
    return this.prisma.content.findMany({ where: { siteId, id: { in: [...ids] } }, select: { id: true, path: true, status: true } });
  }

  countChildren(siteId: string, id: string) {
    return this.prisma.content.count({ where: { siteId, parentId: id } });
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

  /**
   * Every live page and entry of a site, just what the sitemap needs (SEO-02). Never a draft or an
   * archived one. Capped at the 50,000 addresses a sitemap file may hold; `take` is one more
   * than that, so a caller can tell a site has more than fits.
   */
  findSitemapRows(siteId: string) {
    return this.prisma.content.findMany({
      where: { siteId, status: 'published' },
      select: { path: true, typeId: true, seo: true, updatedAt: true },
      orderBy: { path: 'asc' },
      take: SITEMAP_LIMIT + 1,
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

  update(siteId: string, slug: string, data: Prisma.ContentUncheckedUpdateManyInput) {
    // `updateMany` rather than `update` because it takes a where clause with
    // `siteId` — this keeps the write scoped to the tenant without a second
    // existence check.
    return this.prisma.content.updateMany({ where: { siteId, slug }, data });
  }

  /**
   * A write that moves pages in the tree (CNT-05/06): `plan` gets the site's page tree as
   * it is inside the transaction and returns this page's new path and the descendants'.
   * One lock per site (a Postgres advisory lock, released at commit) runs moves and
   * creates-under-a-parent one at a time, so two of them can never plan from the same
   * old tree — no loop from two crossing moves, no child left at a stale path. The page
   * and its descendants land together or not at all (invariant 9). `plan` may throw to
   * refuse; nothing is written then.
   */
  updateInTree<T extends { path: string; descendants: { id: string; path: string }[] }>(
    siteId: string,
    slug: string,
    data: Prisma.ContentUncheckedUpdateManyInput,
    plan: (pages: TreePageRow[]) => T,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`;
      const planned = plan(await pageTree(tx, siteId));
      const own = await tx.content.updateMany({ where: { siteId, slug }, data: { ...data, path: planned.path } });
      // Deleted while we waited for the lock: don't move its children on its behalf.
      if (own.count === 0) throw new NotFoundException('Page not found');
      if (planned.descendants.length > 0) {
        // The whole subtree in one statement, however many children, so the lock is held briefly.
        const rows = Prisma.join(planned.descendants.map(({ id, path }) => Prisma.sql`(${id}, ${path})`));
        await tx.$executeRaw`
          UPDATE content AS c SET path = v.path
          FROM (VALUES ${rows}) AS v(id, path)
          WHERE c.site_id = ${siteId} AND c.id = v.id`;
      }
      return planned;
    }, TREE_TRANSACTION);
  }

  /** Creates a page under a parent, under the same per-site lock as a move, so the parent can't move away meanwhile. */
  createInTree(siteId: string, plan: (pages: TreePageRow[]) => Omit<Prisma.ContentUncheckedCreateInput, 'siteId'>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`;
      const data = plan(await pageTree(tx, siteId));
      return tx.content.create({ data: { ...data, siteId } });
    }, TREE_TRANSACTION);
  }

  delete(siteId: string, slug: string) {
    return this.prisma.content.deleteMany({ where: { siteId, slug } });
  }
}
