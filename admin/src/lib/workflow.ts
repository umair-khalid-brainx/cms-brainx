// What the review and scheduling screens say and accept (GOV-07). Times are entered and shown in the browser's
// own time zone, and sent to the API as UTC. Pure functions, so the specs can pass their own `now`.

import type { PageStatus } from './contentApi';

/** "Tue 14 Oct, 09:00", with the year when it isn't this one. */
export function scheduleLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

/** The browser's time zone by name ("Asia/Karachi"), said next to every time picker so nobody has to guess. */
export function timeZoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time';
}

const pad = (value: number) => String(value).padStart(2, '0');

/** A date as `<input type="datetime-local">` wants it: local time, to the minute. */
export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A `datetime-local` value read as local time, as the ISO moment the API takes; null when it isn't a date. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * What the time picker suggests: tomorrow at 09:00, a time people actually publish at. When that is already
 * past (it never is, but a clock can be wrong) the next whole hour.
 */
export function suggestedPublishTime(now: Date = new Date()): Date {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  if (tomorrow.getTime() > now.getTime()) return tomorrow;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0);
}

/** Why a picked time can't be used, or null. The API checks again against its own clock. */
export function publishTimeProblem(value: string, now: Date = new Date()): string | null {
  const iso = fromLocalInput(value);
  if (!iso) return 'Choose a date and time.';
  if (new Date(iso).getTime() <= now.getTime()) return 'Choose a time in the future.';
  return null;
}

/** How long something has been waiting: "just now", "5 minutes", "3 hours", "2 days". */
export function waitingFor(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** A page whose content nobody can change until it leaves review or the schedule. */
export function isLocked(status: PageStatus): boolean {
  return status === 'in_review' || status === 'scheduled';
}

/** What the editor offers one person for one page (GOV-07). Affordance only: the API enforces every rule. */
export type EditorAccess = {
  /** Puck is read-only, autosave is off, Page settings is hidden. */
  readOnly: boolean;
  /** Why, in a sentence for the state strip; null when it can be edited. */
  readOnlyNote: string | null;
  /** The top bar's Publish button and Schedule… beside it. */
  publish: boolean;
  schedule: boolean;
  /** The top bar's Submit for review button, in place of Publish. */
  submit: boolean;
  /** The strip's Approve and Send back, for a page in review. */
  review: boolean;
  /** The strip's Withdraw, for a page in review. */
  withdraw: boolean;
  /** The strip's Publish now and Unschedule, for a scheduled page. */
  manageSchedule: boolean;
};

export function editorAccess(
  page: { status: PageStatus; submittedById: string | null },
  person: { userId: string | undefined; canWrite: boolean; canPublish: boolean; canReview: boolean },
): EditorAccess {
  const { status } = page;
  const readOnlyNote = !person.canWrite
    ? 'You can look at this page but not change it.'
    : status === 'in_review'
      ? 'Locked while it waits for review.'
      : status === 'scheduled'
        ? 'Locked until it goes live. Unschedule it to make changes.'
        : status === 'published' && !person.canPublish
          ? 'This page is live. Only people who can publish can change it.'
          : null;
  return {
    readOnly: readOnlyNote !== null,
    readOnlyNote,
    publish: person.canPublish && (status === 'draft' || status === 'published'),
    schedule: person.canPublish && status === 'draft',
    submit: person.canWrite && !person.canPublish && status === 'draft',
    review: person.canReview && status === 'in_review',
    // The submitter, or a reviewer who wants it back in draft without writing a note.
    withdraw:
      status === 'in_review' && person.canWrite && (person.canReview || (page.submittedById !== null && page.submittedById === person.userId)),
    manageSchedule: person.canPublish && status === 'scheduled',
  };
}
