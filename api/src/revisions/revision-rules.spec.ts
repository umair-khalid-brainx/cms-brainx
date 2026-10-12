import {
  AUTOSAVE_WINDOW_MS,
  REVISION_LIMIT,
  decideRecording,
  reasonForSave,
  revisionsToPrune,
  snapshotsEqual,
  splitRestorableTerms,
  type LatestRevision,
  type Snapshot,
} from './revision-rules.js';

const snap = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  title: 'About',
  blocks: [{ type: 'hero', headline: 'Hi' }],
  data: {},
  seo: {},
  terms: [],
  status: 'draft',
  ...overrides,
});
const NOW = new Date('2026-10-12T10:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const latest = (overrides: Partial<LatestRevision> = {}): LatestRevision => ({
  id: 'rev-1',
  reason: 'autosave',
  authorId: 'ann',
  createdAt: ago(60_000),
  snapshot: snap({ title: 'Older' }),
  ...overrides,
});

describe('reasonForSave', () => {
  it('calls any request for published a publish, a re-publish of a live page too', () => {
    expect(reasonForSave({ status: 'published' }, 'draft')).toBe('publish');
    expect(reasonForSave({ status: 'published', blocks: [] }, 'published')).toBe('publish');
  });

  it('calls any other change of status a status change', () => {
    expect(reasonForSave({ status: 'draft' }, 'published')).toBe('status');
    expect(reasonForSave({ status: 'archived' }, 'draft')).toBe('status');
  });

  it('calls a save of content an autosave, whichever part of the content it is', () => {
    for (const request of [{ title: 'x' }, { blocks: [] }, { data: {} }, { seo: {} }, { categoryIds: [] }, { tags: [] }]) {
      expect(reasonForSave(request, 'draft')).toBe('autosave');
    }
    // Same status sent again is not a status change.
    expect(reasonForSave({ status: 'draft', title: 'x' }, 'draft')).toBe('autosave');
  });

  it('keeps nothing for a move alone', () => {
    expect(reasonForSave({}, 'draft')).toBeNull();
    expect(reasonForSave({ status: 'draft' }, 'draft')).toBeNull();
  });
});

describe('decideRecording', () => {
  it('overwrites the same author’s latest autosave inside the window', () => {
    const decision = decideRecording({ reason: 'autosave', authorId: 'ann', snapshot: snap(), latest: latest(), now: NOW });
    expect(decision).toEqual({ action: 'update', id: 'rev-1' });
  });

  it('starts a new one once the window has passed', () => {
    const decision = decideRecording({
      reason: 'autosave',
      authorId: 'ann',
      snapshot: snap(),
      latest: latest({ createdAt: ago(AUTOSAVE_WINDOW_MS) }),
      now: NOW,
    });
    expect(decision).toEqual({ action: 'insert' });
    const justInside = decideRecording({ reason: 'autosave', authorId: 'ann', snapshot: snap(), latest: latest({ createdAt: ago(AUTOSAVE_WINDOW_MS - 1) }), now: NOW });
    expect(justInside.action).toBe('update');
  });

  it('never overwrites another author’s autosave', () => {
    expect(decideRecording({ reason: 'autosave', authorId: 'bob', snapshot: snap(), latest: latest(), now: NOW })).toEqual({ action: 'insert' });
  });

  it('never overwrites a revision that is not an autosave, or one that is not the latest', () => {
    for (const reason of ['publish', 'status', 'restore', 'before_restore'] as const) {
      expect(decideRecording({ reason: 'autosave', authorId: 'ann', snapshot: snap(), latest: latest({ reason }), now: NOW })).toEqual({ action: 'insert' });
    }
  });

  it('inserts the first revision of a page', () => {
    expect(decideRecording({ reason: 'autosave', authorId: 'ann', snapshot: snap(), latest: null, now: NOW })).toEqual({ action: 'insert' });
  });

  it('always records a publish, a status change and a restore, even when nothing differs', () => {
    for (const reason of ['publish', 'status', 'restore'] as const) {
      const same = latest({ reason: 'autosave', snapshot: snap() });
      expect(decideRecording({ reason, authorId: 'ann', snapshot: snap(), latest: same, now: NOW })).toEqual({ action: 'insert' });
    }
  });

  it('skips an autosave identical to the latest revision', () => {
    const same = latest({ reason: 'publish', snapshot: snap() });
    expect(decideRecording({ reason: 'autosave', authorId: 'ann', snapshot: snap(), latest: same, now: NOW })).toEqual({ action: 'skip' });
  });

  it('keeps the state before a restore only when the latest revision does not already hold it', () => {
    const same = latest({ snapshot: snap() });
    expect(decideRecording({ reason: 'before_restore', authorId: 'ann', snapshot: snap(), latest: same, now: NOW })).toEqual({ action: 'skip' });
    // Different, and inside the window of her own autosave: still a new row, never an overwrite.
    expect(decideRecording({ reason: 'before_restore', authorId: 'ann', snapshot: snap({ title: 'Edited' }), latest: same, now: NOW })).toEqual({ action: 'insert' });
  });
});

describe('snapshotsEqual', () => {
  it('ignores key order, which Postgres does not keep', () => {
    expect(snapshotsEqual(snap({ seo: { a: 1, b: 2 } }), snap({ seo: { b: 2, a: 1 } }))).toBe(true);
  });

  it('ignores the order terms are listed in', () => {
    const a = { id: 'a', name: 'A', kind: 'tag' as const };
    const b = { id: 'b', name: 'B', kind: 'tag' as const };
    expect(snapshotsEqual(snap({ terms: [a, b] }), snap({ terms: [b, a] }))).toBe(true);
  });

  it('sees a changed title, block, status or term', () => {
    expect(snapshotsEqual(snap(), snap({ title: 'Other' }))).toBe(false);
    expect(snapshotsEqual(snap(), snap({ blocks: [] }))).toBe(false);
    expect(snapshotsEqual(snap(), snap({ status: 'published' }))).toBe(false);
    expect(snapshotsEqual(snap(), snap({ terms: [{ id: 'a', name: 'A', kind: 'tag' }] }))).toBe(false);
  });
});

describe('revisionsToPrune', () => {
  it('keeps the newest 50 and returns the older ones', () => {
    const ids = Array.from({ length: 53 }, (_, i) => `r${i}`);
    expect(REVISION_LIMIT).toBe(50);
    expect(revisionsToPrune(ids)).toEqual(['r50', 'r51', 'r52']);
  });

  it('returns nothing at or under the limit', () => {
    expect(revisionsToPrune(Array.from({ length: 50 }, (_, i) => `r${i}`))).toEqual([]);
    expect(revisionsToPrune([])).toEqual([]);
  });
});

describe('splitRestorableTerms', () => {
  const cat = { id: 'c1', name: 'News', kind: 'category' as const };
  const tag = { id: 't1', name: 'fair', kind: 'tag' as const };
  const both = { hasCategories: true, hasTags: true };

  it('keeps terms that still exist and drops, by name, the ones that were deleted', () => {
    const existing = new Map([['c1', { kind: 'category' as const }]]);
    expect(splitRestorableTerms([cat, tag], existing, both)).toEqual({ keep: [cat], dropped: [tag] });
  });

  it('leaves a kind the type no longer uses alone: neither restored nor reported', () => {
    const existing = new Map([['c1', { kind: 'category' as const }], ['t1', { kind: 'tag' as const }]]);
    expect(splitRestorableTerms([cat, tag], existing, { hasCategories: true, hasTags: false })).toEqual({ keep: [cat], dropped: [] });
  });

  it('touches nothing for a page', () => {
    expect(splitRestorableTerms([cat], new Map(), null)).toEqual({ keep: [], dropped: [] });
  });
});
