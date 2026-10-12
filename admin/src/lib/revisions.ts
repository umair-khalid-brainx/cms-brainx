import type { PageStatus } from './contentApi';

// The History panel's plain helpers (GOV-01): what a revision is called, and how a list of them is
// grouped under day headings. No React, no fetching, so they can be tested directly.

export type RevisionReason = 'publish' | 'status' | 'restore' | 'autosave' | 'before_restore';

export type RevisionSummary = {
  id: string;
  createdAt: string;
  /** When it last took a new state: an autosave overwrites its row inside the window, so this is later than `createdAt`. Shown in the list. */
  savedAt: string;
  reason: RevisionReason;
  /** The page's status at that moment. */
  status: PageStatus;
  title: string;
  author: { id: string; name: string } | null;
};

/** Words, not only colour, say why a revision exists. */
export const REASON_LABEL: Record<RevisionReason, string> = {
  publish: 'Published',
  status: 'Status changed',
  restore: 'Restored',
  autosave: 'Autosave',
  before_restore: 'Before a restore',
};

/** The row's badge: a status change names where the page went ("Unpublished", "Archived"). */
export function reasonLabel(revision: Pick<RevisionSummary, 'reason' | 'status'>): string {
  if (revision.reason === 'status') {
    if (revision.status === 'draft') return 'Unpublished';
    if (revision.status === 'archived') return 'Archived';
    return 'Status changed to Live';
  }
  return REASON_LABEL[revision.reason];
}

/** Ids of the revisions whose title differs from the next older one, mapped to that title. */
export function titleChanges(revisions: readonly RevisionSummary[]): Map<string, string> {
  const changed = new Map<string, string>();
  revisions.forEach((revision, index) => {
    const older = revisions[index + 1];
    if (older && older.title !== revision.title) changed.set(revision.id, revision.title);
  });
  return changed;
}

export const STATUS_LABEL: Record<PageStatus, string> = { draft: 'Draft', published: 'Live', archived: 'Archived' };

export type RevisionDay = { key: string; heading: string; revisions: RevisionSummary[] };

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** "3 October", with the year when it isn't this one. */
function dateLabel(date: Date, now: Date): string {
  const base = `${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'long' })}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/** "Today", "Yesterday", then the date ("Saturday 3 October", with the year when it isn't this one). */
export function dayHeading(date: Date, now: Date): string {
  const key = dayKey(date);
  if (key === dayKey(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === dayKey(yesterday)) return 'Yesterday';
  return `${date.toLocaleDateString('en-GB', { weekday: 'long' })} ${dateLabel(date, now)}`;
}

/** The list (newest first, as the API sends it) under one heading per local day, keeping the order. */
export function groupByDay(revisions: readonly RevisionSummary[], now: Date = new Date()): RevisionDay[] {
  const days: RevisionDay[] = [];
  for (const revision of revisions) {
    const date = new Date(revision.savedAt);
    const key = dayKey(date);
    const last = days.at(-1);
    if (last && last.key === key) last.revisions.push(revision);
    else days.push({ key, heading: dayHeading(date, now), revisions: [revision] });
  }
  return days;
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** For the announcement and the confirm: "10:42 today", "10:42 yesterday", "10:42 on 3 October". */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const heading = dayHeading(date, now);
  const time = timeLabel(iso);
  if (heading === 'Today') return `${time} today`;
  if (heading === 'Yesterday') return `${time} yesterday`;
  return `${time} on ${dateLabel(date, now)}`;
}

export function authorName(revision: Pick<RevisionSummary, 'author'>): string {
  return revision.author?.name ?? 'A removed user';
}

/** What the restore confirm says: a live page changes on the site at once, anything else keeps its status. */
export function restoreWarning(status: PageStatus, hasUnsavedEdits: boolean): string[] {
  const lines =
    status === 'published'
      ? ['This page is live. Restoring changes it on your site straight away.']
      : status === 'archived'
        ? ['The page stays archived. Only its content changes.']
        : ['The page stays a draft. Only its content changes.'];
  lines.push(
    'Title, content, search settings and categories or tags go back to this version. The page’s address stays the same.',
  );
  if (hasUnsavedEdits) lines.push('Edits in the editor that haven’t been saved yet will be replaced.');
  else lines.push('What is on the page now is kept in the history first, so you can undo this.');
  return lines;
}

/** What the editor says after a restore, here so the History panel and the Compare screen word it alike. */
export function restoredNotice(droppedTerms: readonly { name: string }[], revision: Pick<RevisionSummary, 'savedAt'>): string {
  const left = droppedTerms.map((term) => term.name);
  return (
    `Restored the version from ${whenLabel(revision.savedAt)}.` +
    (left.length > 0 ? ` Left out, because they no longer exist: ${left.join(', ')}.` : '')
  );
}

/** One line for a version in a picker: "10:42 today, Published, Ann". */
export function revisionOptionLabel(revision: RevisionSummary): string {
  return `${whenLabel(revision.savedAt)}, ${reasonLabel(revision)}, ${authorName(revision)}`;
}
