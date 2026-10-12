import { describe, expect, it } from 'vitest';
import { editorAccess, fromLocalInput, isLocked, publishTimeProblem, suggestedPublishTime, toLocalInput, waitingFor } from './workflow';
import type { PageStatus } from './contentApi';

const now = new Date(2026, 9, 12, 14, 30);

describe('time picker values', () => {
  it('round-trips a local time through the datetime-local format', () => {
    const value = toLocalInput(new Date(2026, 9, 14, 9, 5));
    expect(value).toBe('2026-10-14T09:05');
    expect(new Date(fromLocalInput(value)!).getTime()).toBe(new Date(2026, 9, 14, 9, 5).getTime());
  });

  it('reads anything that is not a full date and time as nothing', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('2026-10-14')).toBeNull();
    expect(fromLocalInput('2026-13-40T99:99')).toBeNull();
  });

  it('suggests tomorrow at nine', () => {
    expect(suggestedPublishTime(now)).toEqual(new Date(2026, 9, 13, 9, 0));
  });

  it('refuses a time that is not in the future', () => {
    expect(publishTimeProblem(toLocalInput(now), now)).toBe('Choose a time in the future.');
    expect(publishTimeProblem('', now)).toBe('Choose a date and time.');
    expect(publishTimeProblem(toLocalInput(new Date(2026, 9, 12, 14, 31)), now)).toBeNull();
  });
});

describe('waitingFor', () => {
  it('says how long, in the largest whole unit', () => {
    expect(waitingFor(null, now)).toBe('');
    expect(waitingFor(new Date(2026, 9, 12, 14, 30, 20).toISOString(), now)).toBe('just now');
    expect(waitingFor(new Date(2026, 9, 12, 14, 29).toISOString(), now)).toBe('1 minute');
    expect(waitingFor(new Date(2026, 9, 12, 12, 0).toISOString(), now)).toBe('2 hours');
    expect(waitingFor(new Date(2026, 9, 9, 14, 30).toISOString(), now)).toBe('3 days');
  });
});

describe('editorAccess', () => {
  const people = {
    viewer: { userId: 'v', canWrite: false, canPublish: false, canReview: false },
    contributor: { userId: 'c', canWrite: true, canPublish: false, canReview: false },
    author: { userId: 'a', canWrite: true, canPublish: true, canReview: false },
    editor: { userId: 'e', canWrite: true, canPublish: true, canReview: true },
  };
  const page = (status: PageStatus, submittedById: string | null = null) => ({ status, submittedById });

  it('locks a page in review or scheduled for everyone', () => {
    for (const status of ['in_review', 'scheduled'] as const) {
      expect(isLocked(status)).toBe(true);
      for (const person of Object.values(people)) expect(editorAccess(page(status, 'c'), person).readOnly).toBe(true);
    }
  });

  it('gives a contributor Submit for review on a draft, and no Publish', () => {
    const access = editorAccess(page('draft'), people.contributor);
    expect(access).toMatchObject({ readOnly: false, submit: true, publish: false, schedule: false });
  });

  it('makes a live page read-only for a contributor only', () => {
    expect(editorAccess(page('published'), people.contributor).readOnly).toBe(true);
    expect(editorAccess(page('published'), people.author)).toMatchObject({ readOnly: false, publish: true, schedule: false });
  });

  it('lets reviewers approve, and the submitter or a reviewer withdraw', () => {
    expect(editorAccess(page('in_review', 'c'), people.editor)).toMatchObject({ review: true, withdraw: true });
    expect(editorAccess(page('in_review', 'c'), people.contributor)).toMatchObject({ review: false, withdraw: true });
    expect(editorAccess(page('in_review', 'someone-else'), people.contributor).withdraw).toBe(false);
    // An author may submit too, and withdraw what it submitted, but never review.
    expect(editorAccess(page('in_review', 'a'), people.author)).toMatchObject({ review: false, withdraw: true });
  });

  it('gives publishers Publish now and Unschedule on a scheduled page', () => {
    expect(editorAccess(page('scheduled'), people.author).manageSchedule).toBe(true);
    expect(editorAccess(page('scheduled'), people.contributor).manageSchedule).toBe(false);
  });

  it('gives a viewer nothing but a note', () => {
    const access = editorAccess(page('draft'), people.viewer);
    expect(access).toMatchObject({ readOnly: true, publish: false, submit: false, schedule: false, review: false });
    expect(access.readOnlyNote).toBe('You can look at this page but not change it.');
  });
});
