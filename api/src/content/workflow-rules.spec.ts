import {
  lockedBecause,
  MAX_SCHEDULE_AHEAD_MS,
  mayWithdraw,
  missedScheduleNote,
  publishAtProblem,
  REVIEW_NOTE_MAX,
  scheduleProblem,
  submitProblem,
} from './workflow-rules.js';

describe('lockedBecause', () => {
  it('locks a page in review and a scheduled one, each saying how to unlock it', () => {
    expect(lockedBecause('in_review')).toMatch(/Withdraw it/);
    expect(lockedBecause('scheduled')).toMatch(/Unschedule it/);
  });

  it.each(['draft', 'published', 'archived'])('leaves a %s page unlocked', (status) => {
    expect(lockedBecause(status)).toBeNull();
  });
});

describe('submitProblem', () => {
  it('lets a draft be submitted', () => {
    expect(submitProblem('draft')).toBeNull();
  });

  it.each([
    ['in_review', 'This page is already waiting for review.'],
    ['scheduled', 'This page is already scheduled to go live.'],
    ['published', 'This page is already live.'],
    ['archived', 'Restore this page before submitting it.'],
  ])('refuses a %s page', (status, message) => {
    expect(submitProblem(status)).toBe(message);
  });
});

describe('scheduleProblem', () => {
  it('lets a draft be scheduled', () => {
    expect(scheduleProblem('draft')).toBeNull();
  });

  it.each([
    ['in_review', 'This page is waiting for review. Approve it to schedule it.'],
    ['scheduled', 'This page is already scheduled. Unschedule it to pick another time.'],
    ['published', 'This page is already live.'],
    ['archived', 'Restore this page before scheduling it.'],
  ])('refuses a %s page', (status, message) => {
    expect(scheduleProblem(status)).toBe(message);
  });
});

describe('publishAtProblem', () => {
  const now = new Date('2026-10-12T12:00:00.000Z');
  const at = (ms: number) => new Date(now.getTime() + ms);

  it('accepts a time in the future', () => {
    expect(publishAtProblem(at(60_000), now)).toBeNull();
  });

  it('refuses exactly now, and a time in the past', () => {
    expect(publishAtProblem(at(0), now)).toBe('Choose a time in the future.');
    expect(publishAtProblem(at(-1), now)).toBe('Choose a time in the future.');
  });

  it('accepts exactly two years ahead, and refuses a millisecond more', () => {
    expect(publishAtProblem(at(MAX_SCHEDULE_AHEAD_MS), now)).toBeNull();
    expect(publishAtProblem(at(MAX_SCHEDULE_AHEAD_MS + 1), now)).toBe('Choose a time within the next two years.');
  });

  it('refuses an invalid date', () => {
    expect(publishAtProblem(new Date('not a date'), now)).toBe('Choose a valid date and time.');
  });
});

describe('mayWithdraw', () => {
  it('lets the submitter withdraw', () => {
    expect(mayWithdraw({ userId: 'cat', submittedById: 'cat', canReview: false })).toBe(true);
  });

  it('lets a reviewer withdraw someone else’s page', () => {
    expect(mayWithdraw({ userId: 'ed', submittedById: 'cat', canReview: true })).toBe(true);
  });

  it('refuses anyone else, and nobody matches an unknown submitter', () => {
    expect(mayWithdraw({ userId: 'dan', submittedById: 'cat', canReview: false })).toBe(false);
    expect(mayWithdraw({ userId: 'dan', submittedById: null, canReview: false })).toBe(false);
  });
});

describe('missedScheduleNote', () => {
  it('names each problem and says the page is back in draft', () => {
    expect(missedScheduleNote(['Add a headline', 'Add a title'])).toBe(
      'Couldn’t go live at its scheduled time: Add a headline; Add a title. It’s back in draft.',
    );
  });

  it('names the first three and counts the rest', () => {
    const note = missedScheduleNote(['One', 'Two', 'Three', 'Four', 'Five']);
    expect(note).toContain('One; Two; Three (and 2 more).');
    expect(note).not.toContain('Four');
  });

  it('says nothing more for exactly three', () => {
    expect(missedScheduleNote(['a', 'b', 'c'])).not.toContain('more');
  });

  it('is cut to the length of a review note', () => {
    const note = missedScheduleNote(['x'.repeat(400), 'y'.repeat(400)]);
    expect(note).toHaveLength(REVIEW_NOTE_MAX);
  });
});
