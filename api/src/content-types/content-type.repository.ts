import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Every method takes `siteId` (invariant 1): a site only ever sees and changes
// its own types. This repository also answers the two questions about the
// `content` table that a type needs (does it have entries; does a page already
// sit at its address), so the rest of the code never has to ask them itself.
@Injectable()
export class ContentTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(siteId: string) {
    return this.prisma.contentType.findMany({
      where: { siteId },
      orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
    });
  }

  findById(siteId: string, id: string) {
    return this.prisma.contentType.findFirst({ where: { id, siteId } });
  }

  findByPrefix(siteId: string, prefix: string) {
    return this.prisma.contentType.findFirst({ where: { siteId, prefix } });
  }

  create(siteId: string, data: { name: string; singularName: string; prefix: string; isBuiltIn?: boolean }) {
    return this.prisma.contentType.create({ data: { ...data, siteId } });
  }

  update(siteId: string, id: string, data: { name?: string; singularName?: string; prefix?: string }) {
    return this.prisma.contentType.updateMany({ where: { id, siteId }, data });
  }

  delete(siteId: string, id: string) {
    return this.prisma.contentType.deleteMany({ where: { id, siteId } });
  }

  /** Entry counts per type: `active` excludes archived, `total` includes them. */
  async countEntries(siteId: string): Promise<Map<string, { active: number; total: number }>> {
    const rows = await this.prisma.content.groupBy({
      by: ['typeId', 'status'],
      where: { siteId, typeId: { not: null } },
      _count: { _all: true },
    });
    const counts = new Map<string, { active: number; total: number }>();
    for (const row of rows) {
      if (!row.typeId) continue;
      const entry = counts.get(row.typeId) ?? { active: 0, total: 0 };
      entry.total += row._count._all;
      if (row.status !== 'archived') entry.active += row._count._all;
      counts.set(row.typeId, entry);
    }
    return counts;
  }

  /** Any entry at all, archived included: a type with entries can't move or be deleted. */
  async hasEntries(siteId: string, typeId: string): Promise<boolean> {
    return (await this.prisma.content.count({ where: { siteId, typeId } })) > 0;
  }

  /** A page (not an entry) already at `/<prefix>` or under it, in any status. */
  async pageUses(siteId: string, prefix: string): Promise<boolean> {
    const found = await this.prisma.content.findFirst({
      where: { siteId, typeId: null, OR: [{ path: `/${prefix}` }, { path: { startsWith: `/${prefix}/` } }] },
      select: { id: true },
    });
    return found !== null;
  }

  async prefixes(siteId: string): Promise<string[]> {
    const rows = await this.prisma.contentType.findMany({ where: { siteId }, select: { prefix: true } });
    return rows.map((row) => row.prefix);
  }
}
