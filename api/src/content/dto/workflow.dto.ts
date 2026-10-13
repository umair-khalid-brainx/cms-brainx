import { z } from 'zod';
import { REVIEW_NOTE_MAX } from '../workflow-rules.js';

// A moment, as the browser sends it: an ISO 8601 string with its offset (`2026-10-14T09:00:00.000Z`).
// Whether it is in the future is the service's check, against its own clock.
const moment = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/**
 * Approving a submitted page (GOV-07): publish it now, or at `publishAt`. `version` is the page's `updatedAt` as
 * the reviewer's editor loaded it: the approval is of that version, and is refused if the page changed since
 * (withdrawn, edited and resubmitted while the reviewer was reading).
 */
export const approveSchema = z.object({ version: moment, publishAt: moment.optional() }).strict();
/** `version` is optional to the service (its specs, the scheduler's own steps); the route always requires it. */
export type ApproveDto = { version?: Date; publishAt?: Date };

/** Sending a submitted page back: the note says what to change. */
export const rejectSchema = z.object({ note: z.string().trim().min(1, 'Say what needs to change').max(REVIEW_NOTE_MAX) }).strict();
export type RejectDto = z.infer<typeof rejectSchema>;

/** Scheduling a draft directly (a publisher). */
export const scheduleSchema = z.object({ publishAt: moment }).strict();
export type ScheduleDto = z.infer<typeof scheduleSchema>;
