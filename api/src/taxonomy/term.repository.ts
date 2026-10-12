import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TermInput, TermKind } from './term-rules.js';

export type TermRow = { id: string; kind: TermKind; name: string; slug: string };

// Every method takes `siteId` as a required parameter (invariant 1): a site only ever sees and
// changes its own terms, and an id from another site simply isn't found.
@Injectable()
export class TermRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Every term of the site with how many entries carry it, for the Categories & Tags screen. */
  async findAllWithCounts(siteId: string): Promise<(TermRow & { entryCount: number })[]> {
    const rows = await this.prisma.term.findMany({
      where: { siteId },
      orderBy: { name: 'asc' },
      select: { id: true, kind: true, name: true, slug: true, _count: { select: { entries: true } } },
    });
    return rows.map(({ _count, ...term }) => ({ ...term, entryCount: _count.entries }));
  }

  findById(siteId: string, id: string): Promise<TermRow | null> {
    return this.prisma.term.findFirst({ where: { id, siteId }, select: { id: true, kind: true, name: true, slug: true } });
  }

  findByIds(siteId: string, ids: readonly string[]): Promise<TermRow[]> {
    return this.prisma.term.findMany({ where: { siteId, id: { in: [...ids] } }, select: { id: true, kind: true, name: true, slug: true } });
  }

  findBySlug(siteId: string, kind: TermKind, slug: string): Promise<TermRow | null> {
    return this.prisma.term.findFirst({ where: { siteId, kind, slug }, select: { id: true, kind: true, name: true, slug: true } });
  }

  create(siteId: string, kind: TermKind, term: TermInput): Promise<TermRow> {
    return this.prisma.term.create({ data: { siteId, kind, ...term }, select: { id: true, kind: true, name: true, slug: true } });
  }

  /** Count 0 means it isn't this site's (or is gone). */
  update(siteId: string, id: string, term: TermInput) {
    return this.prisma.term.updateMany({ where: { id, siteId }, data: term });
  }

  /** The links go with it (the foreign key cascades), so every entry just loses the term. */
  delete(siteId: string, id: string) {
    return this.prisma.term.deleteMany({ where: { id, siteId } });
  }

  /**
   * The tags with these slugs, creating the ones that don't exist yet. `skipDuplicates` makes two people
   * typing the same new tag at once both end up with the one that won, instead of one of them failing.
   */
  async findOrCreateTags(siteId: string, tags: readonly TermInput[]): Promise<TermRow[]> {
    if (tags.length === 0) return [];
    const where = { siteId, kind: 'tag' as const, slug: { in: tags.map((tag) => tag.slug) } };
    const select = { id: true, kind: true, name: true, slug: true } as const;
    const existing = await this.prisma.term.findMany({ where, select });
    const have = new Set(existing.map((tag) => tag.slug));
    const missing = tags.filter((tag) => !have.has(tag.slug));
    if (missing.length === 0) return existing;
    await this.prisma.term.createMany({ data: missing.map((tag) => ({ siteId, kind: 'tag' as const, ...tag })), skipDuplicates: true });
    return this.prisma.term.findMany({ where, select });
  }

  /** The terms of one entry, by name. */
  findForContent(siteId: string, contentId: string): Promise<TermRow[]> {
    return this.prisma.term.findMany({
      where: { siteId, entries: { some: { contentId } } },
      orderBy: { name: 'asc' },
      select: { id: true, kind: true, name: true, slug: true },
    });
  }
}
