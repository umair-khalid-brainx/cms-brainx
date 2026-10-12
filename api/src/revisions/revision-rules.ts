// When a revision is kept, and which ones are thrown away (GOV-01, D-062). Pure: no database, no clock of its
// own, so every rule below is a plain function a spec can call.

export type RevisionReason = 'publish' | 'status' | 'restore' | 'autosave' | 'before_restore';
export type PageStatus = 'draft' | 'published' | 'archived';

/** The newest revisions kept per page; older ones are deleted after each insert. */
export const REVISION_LIMIT = 50;
/** One autosave revision per page per person per this long; inside it the latest one is overwritten. */
export const AUTOSAVE_WINDOW_MS = 10 * 60 * 1000;

export type TermSnapshot = { id: string; name: string; kind: 'category' | 'tag' };

/** What a revision keeps of a page: everything an editor can change except its address and parent. */
export type Snapshot = {
  title: string;
  blocks: unknown;
  data: unknown;
  seo: unknown;
  terms: TermSnapshot[];
  status: PageStatus;
};

/** The parts of an update request that are content (not address, not parent). */
export type SaveRequest = {
  title?: unknown;
  blocks?: unknown;
  data?: unknown;
  seo?: unknown;
  categoryIds?: unknown;
  tags?: unknown;
  status?: PageStatus;
};

/**
 * Why a save is worth a revision, or null when it isn't (a move alone, an empty request).
 * Publishing is any request for `published`, a re-publish of a live page included ("Publish" on a live
 * page is how its changes go out); any other status change is `status`; the rest is an autosave.
 */
export function reasonForSave(request: SaveRequest, statusBefore: PageStatus): RevisionReason | null {
  if (request.status === 'published') return 'publish';
  if (request.status !== undefined && request.status !== statusBefore) return 'status';
  const content = [request.title, request.blocks, request.data, request.seo, request.categoryIds, request.tags];
  return content.some((value) => value !== undefined) ? 'autosave' : null;
}

/** The latest revision of the page, whoever wrote it, with what the decision needs. */
export type LatestRevision = { id: string; reason: RevisionReason; authorId: string | null; createdAt: Date; snapshot: Snapshot };

export type Decision = { action: 'skip' } | { action: 'insert' } | { action: 'update'; id: string };

/**
 * What to do with a state about to be recorded.
 * - publish, status and restore always insert: they are events, even when nothing else changed.
 * - autosave and before_restore are skipped when identical to the latest revision (nothing to keep).
 * - an autosave overwrites the latest revision, in place, when that is one of this author's own autosaves
 *   less than the window old. It has to be the latest of all: after a publish or someone else's save the
 *   newest state must sit at the top of the list, so a new row starts.
 */
export function decideRecording(input: { reason: RevisionReason; authorId: string | null; snapshot: Snapshot; latest: LatestRevision | null; now: Date }): Decision {
  const { reason, authorId, snapshot, latest, now } = input;
  if (reason === 'publish' || reason === 'status' || reason === 'restore') return { action: 'insert' };
  if (latest && snapshotsEqual(latest.snapshot, snapshot)) return { action: 'skip' };
  if (
    reason === 'autosave' &&
    latest &&
    latest.reason === 'autosave' &&
    authorId !== null &&
    latest.authorId === authorId &&
    now.getTime() - latest.createdAt.getTime() < AUTOSAVE_WINDOW_MS
  ) {
    return { action: 'update', id: latest.id };
  }
  return { action: 'insert' };
}

/** Ids of the revisions to delete: everything beyond the newest `keep`. Input is newest first. */
export function revisionsToPrune(idsNewestFirst: readonly string[], keep = REVISION_LIMIT): string[] {
  return idsNewestFirst.slice(keep);
}

/** Key order is not meaning: Postgres stores JSON with its own key order, so compare a sorted form. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  const sortedTerms = (terms: TermSnapshot[]) => [...terms].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return canonical({ ...a, terms: sortedTerms(a.terms) }) === canonical({ ...b, terms: sortedTerms(b.terms) });
}

/**
 * Which of a snapshot's terms can be put back. Only kinds the entry's type uses are touched (an opted-out
 * kind keeps its stored links, D-060, and is neither restored nor reported). Of those, a term still on the
 * site with the same kind is kept; one that was deleted is dropped, and reported by name.
 */
export function splitRestorableTerms(
  snapshot: readonly TermSnapshot[],
  existing: ReadonlyMap<string, { kind: 'category' | 'tag' }>,
  typeUses: { hasCategories: boolean; hasTags: boolean } | null,
): { keep: TermSnapshot[]; dropped: TermSnapshot[] } {
  const keep: TermSnapshot[] = [];
  const dropped: TermSnapshot[] = [];
  for (const term of snapshot) {
    const used = typeUses !== null && (term.kind === 'category' ? typeUses.hasCategories : typeUses.hasTags);
    if (!used) continue;
    const found = existing.get(term.id);
    (found && found.kind === term.kind ? keep : dropped).push(term);
  }
  return { keep, dropped };
}
