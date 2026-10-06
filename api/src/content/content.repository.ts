import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Every method takes `siteId` as a required parameter (invariant 1) — there
// is no method here that can read or write across tenants by accident.
@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(siteId: string) {
    return this.prisma.content.findMany({ where: { siteId, archivedAt: null }, orderBy: { updatedAt: 'desc' } });
  }

  findManyArchived(siteId: string) {
    return this.prisma.content.findMany({ where: { siteId, archivedAt: { not: null } }, orderBy: { archivedAt: 'desc' } });
  }

  findBySlug(siteId: string, slug: string) {
    return this.prisma.content.findFirst({ where: { siteId, slug } });
  }

  /**
   * The only read the public site uses. "Live" means published *and* not
   * archived — a draft or archived page is indistinguishable from a missing
   * one to an anonymous visitor (D-030). Kept here rather than in the public
   * controller so no caller can forget either condition.
   */
  findLiveByPath(siteId: string, path: string) {
    return this.prisma.content.findFirst({ where: { siteId, path, status: 'published', archivedAt: null } });
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

  archive(siteId: string, slug: string) {
    return this.prisma.content.updateMany({ where: { siteId, slug }, data: { archivedAt: new Date() } });
  }
}
