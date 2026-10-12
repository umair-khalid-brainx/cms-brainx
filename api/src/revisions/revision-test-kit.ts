import { REVISION_LIMIT, revisionsToPrune, type Snapshot } from './revision-rules.js';
import type { RevisionReason } from './revision-rules.js';
import type { RevisionRepository, RevisionRow } from './revision.repository.js';

type Stored = RevisionRow & { siteId: string };

/**
 * An in-memory stand-in for the `revisions` table, scoped by site like the real repository, for the specs of
 * ContentService and RevisionsService (GOV-01). `clock` is what new rows are stamped with.
 */
export function fakeRevisionRepository(names: Record<string, string> = {}) {
  const rows: Stored[] = [];
  const clock = { now: new Date() };
  let next = 1;
  const newestFirst = (siteId: string, contentId: string) =>
    rows.filter((r) => r.siteId === siteId && r.contentId === contentId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
  const withAuthor = (row: Stored): RevisionRow => ({ ...row, author: row.authorId ? { id: row.authorId, name: names[row.authorId] ?? row.authorId } : null });

  const repo = {
    findLatest: vi.fn(async (siteId: string, contentId: string) => {
      const row = newestFirst(siteId, contentId)[0];
      return row ? withAuthor(row) : null;
    }),
    findMany: vi.fn(async (siteId: string, contentId: string, take: number) => newestFirst(siteId, contentId).slice(0, take).map(withAuthor)),
    findById: vi.fn(async (siteId: string, contentId: string, id: string) => {
      const row = rows.find((r) => r.id === id && r.siteId === siteId && r.contentId === contentId);
      return row ? withAuthor(row) : null;
    }),
    insertAndPrune: vi.fn(async (siteId: string, contentId: string, input: { reason: RevisionReason; authorId: string | null; snapshot: Snapshot }, keep = REVISION_LIMIT) => {
      const row: Stored = {
        id: `rev-${String(next++).padStart(4, '0')}`,
        siteId,
        contentId,
        ...structuredClone(input.snapshot),
        reason: input.reason,
        authorId: input.authorId,
        createdAt: new Date(clock.now),
        updatedAt: new Date(clock.now),
        author: null,
      };
      rows.push(row);
      for (const id of revisionsToPrune(newestFirst(siteId, contentId).map((r) => r.id), keep)) rows.splice(rows.findIndex((r) => r.id === id), 1);
      return row;
    }),
    overwrite: vi.fn(async (siteId: string, contentId: string, id: string, snapshot: Snapshot) => {
      const row = rows.find((r) => r.id === id && r.siteId === siteId && r.contentId === contentId);
      if (row) Object.assign(row, structuredClone(snapshot), { updatedAt: new Date(clock.now) });
      return { count: row ? 1 : 0 };
    }),
  };
  return { repo: repo as unknown as RevisionRepository & typeof repo, rows, clock };
}
