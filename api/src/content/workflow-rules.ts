// The review and scheduling workflow (GOV-07, D-065). Pure: no database, no clock of its own, so every rule
// below is a plain function a spec can call. ContentService and WorkflowService apply them.

export type ContentStatus = 'draft' | 'published' | 'archived' | 'in_review' | 'scheduled';

/** The furthest ahead a page can be scheduled. Further than this is far more likely a typo in the year. */
export const MAX_SCHEDULE_AHEAD_MS = 2 * 366 * 24 * 60 * 60 * 1000;
/** How long a reviewer's note can be. */
export const REVIEW_NOTE_MAX = 500;

/**
 * Why a page can't be changed right now, or null when it can. A page in review is locked so the reviewer
 * approves exactly what was submitted; a scheduled one so what goes live is what was approved. Every write
 * to the page's content, address, status or terms is refused while locked, a restore included.
 */
export function lockedBecause(status: ContentStatus | string): string | null {
  if (status === 'in_review') return 'This page is waiting for review. Withdraw it to make changes.';
  if (status === 'scheduled') return 'This page is scheduled to go live. Unschedule it to make changes.';
  return null;
}

/** A page can be submitted for review only from draft: a live page is already out, an archived one is in the bin. */
export function submitProblem(status: ContentStatus | string): string | null {
  if (status === 'draft') return null;
  if (status === 'in_review') return 'This page is already waiting for review.';
  if (status === 'scheduled') return 'This page is already scheduled to go live.';
  if (status === 'published') return 'This page is already live.';
  return 'Restore this page before submitting it.';
}

/** A page can be scheduled only from draft (or straight from review, by approving it). */
export function scheduleProblem(status: ContentStatus | string): string | null {
  if (status === 'draft') return null;
  if (status === 'in_review') return 'This page is waiting for review. Approve it to schedule it.';
  if (status === 'scheduled') return 'This page is already scheduled. Unschedule it to pick another time.';
  if (status === 'published') return 'This page is already live.';
  return 'Restore this page before scheduling it.';
}

/**
 * Whether `publishAt` is a time a page can be scheduled for, given the time now. Must be in the future (a
 * past time would mean "publish now", which is the Publish button's job) and within two years.
 */
export function publishAtProblem(publishAt: Date, now: Date): string | null {
  if (Number.isNaN(publishAt.getTime())) return 'Choose a valid date and time.';
  if (publishAt.getTime() <= now.getTime()) return 'Choose a time in the future.';
  if (publishAt.getTime() - now.getTime() > MAX_SCHEDULE_AHEAD_MS) return 'Choose a time within the next two years.';
  return null;
}

/** Whether this person may take a page out of review: the one who submitted it, or anyone who can review. */
export function mayWithdraw(input: { userId: string; submittedById: string | null; canReview: boolean }): boolean {
  return input.canReview || (input.submittedById !== null && input.submittedById === input.userId);
}

/** The note a scheduled page carries when it couldn't go live at its time, naming what stopped it. */
export function missedScheduleNote(problems: readonly string[]): string {
  const list = problems.slice(0, 3).join('; ');
  const more = problems.length > 3 ? ` (and ${problems.length - 3} more)` : '';
  return `Couldn’t go live at its scheduled time: ${list}${more}. It’s back in draft.`.slice(0, REVIEW_NOTE_MAX);
}
