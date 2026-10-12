import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REVISION_LIMIT, revisionsToPrune, type RevisionReason, type Snapshot } from './revision-rules.js';

export type RevisionRow = {
  id: string;
  contentId: string;
  title: string;
  blocks: unknown;
  data: unknown;
  seo: unknown;
  terms: unknown;
  status: 'draft' | 'published' | 'archived';
  reason: RevisionReason;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string } | null;
};

const WITH_AUTHOR = { author: { select: { id: true, name: true } } } as const;
// Newest first; `id` last so two saved in the same millisecond still have one order.
const NEWEST_FIRST: Prisma.RevisionOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

const asJson = (value: unknown) => value as Prisma.InputJsonValue;
const columns = (snapshot: Snapshot) => ({
  title: snapshot.title,
  blocks: asJson(snapshot.blocks),
  data: asJson(snapshot.data),
  seo: asJson(snapshot.seo),
  terms: asJson(snapshot.terms),
  status: snapshot.status,
});

// Every method takes `siteId` as a required parameter (invariant 1): a revision is only ever found, changed
// or deleted inside its own site, so another site's page id finds nothing.
@Injectable()
export class RevisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The newest revision of one page, whoever wrote it. */
  findLatest(siteId: string, contentId: string): Promise<RevisionRow | null> {
    return this.prisma.revision.findFirst({ where: { siteId, contentId }, orderBy: NEWEST_FIRST, include: WITH_AUTHOR }) as Promise<RevisionRow | null>;
  }

  /** The newest `take` revisions of one page. */
  findMany(siteId: string, contentId: string, take: number): Promise<RevisionRow[]> {
    return this.prisma.revision.findMany({ where: { siteId, contentId }, orderBy: NEWEST_FIRST, take, include: WITH_AUTHOR }) as Promise<RevisionRow[]>;
  }

  findById(siteId: string, contentId: string, id: string): Promise<RevisionRow | null> {
    return this.prisma.revision.findFirst({ where: { id, siteId, contentId }, include: WITH_AUTHOR }) as Promise<RevisionRow | null>;
  }

  /** Writes a new revision and, in the same transaction, deletes whatever falls beyond the newest 50. */
  insertAndPrune(siteId: string, contentId: string, input: { reason: RevisionReason; authorId: string | null; snapshot: Snapshot }, keep = REVISION_LIMIT) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.revision.create({ data: { siteId, contentId, reason: input.reason, authorId: input.authorId, ...columns(input.snapshot) } });
      const ids = await tx.revision.findMany({ where: { siteId, contentId }, orderBy: NEWEST_FIRST, select: { id: true } });
      const surplus = revisionsToPrune(ids.map((row) => row.id), keep);
      if (surplus.length > 0) await tx.revision.deleteMany({ where: { siteId, contentId, id: { in: surplus } } });
      return created;
    });
  }

  /** An autosave inside its window: the latest revision takes the newest state. Count 0 means it is gone. */
  overwrite(siteId: string, contentId: string, id: string, snapshot: Snapshot) {
    return this.prisma.revision.updateMany({ where: { id, siteId, contentId }, data: columns(snapshot) });
  }
}
