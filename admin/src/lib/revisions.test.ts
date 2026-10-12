import { describe, expect, it } from 'vitest';
import {
  authorName,
  dayHeading,
  groupByDay,
  REASON_LABEL,
  reasonLabel,
  restoreWarning,
  titleChanges,
  whenLabel,
  type RevisionSummary,
} from './revisions';

const rev = (id: string, createdAt: Date, extra: Partial<RevisionSummary> = {}): RevisionSummary => ({
  id,
  createdAt: createdAt.toISOString(),
  savedAt: createdAt.toISOString(),
  reason: 'autosave',
  status: 'draft',
  title: 'Page',
  author: { id: 'u1', name: 'Ann' },
  ...extra,
});

const NOW = new Date(2026, 9, 12, 15, 0);

describe('dayHeading', () => {
  it('says Today and Yesterday, then the date', () => {
    expect(dayHeading(new Date(2026, 9, 12, 9, 0), NOW)).toBe('Today');
    expect(dayHeading(new Date(2026, 9, 11, 23, 59), NOW)).toBe('Yesterday');
    expect(dayHeading(new Date(2026, 9, 3, 12, 0), NOW)).toBe('Saturday 3 October');
  });

  it('adds the year for another year, and handles a month boundary for yesterday', () => {
    expect(dayHeading(new Date(2025, 11, 31, 12, 0), NOW)).toBe('Wednesday 31 December 2025');
    expect(dayHeading(new Date(2026, 8, 30, 12, 0), new Date(2026, 9, 1, 8, 0))).toBe('Yesterday');
  });
});

describe('groupByDay', () => {
  it('groups newest-first revisions under one heading per day, keeping order', () => {
    const days = groupByDay(
      [
        rev('a', new Date(2026, 9, 12, 14, 0)),
        rev('b', new Date(2026, 9, 12, 9, 0)),
        rev('c', new Date(2026, 9, 11, 17, 0)),
        rev('d', new Date(2026, 9, 3, 8, 0)),
      ],
      NOW,
    );
    expect(days.map((d) => [d.heading, d.revisions.map((r) => r.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['Saturday 3 October', ['d']],
    ]);
  });

  it('returns nothing for no revisions', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe('labels', () => {
  it('names every reason in words', () => {
    expect(REASON_LABEL).toMatchObject({
      publish: 'Published',
      status: 'Status changed',
      restore: 'Restored',
      autosave: 'Autosave',
    });
  });

  it('names a status change by where the page went', () => {
    expect(reasonLabel({ reason: 'status', status: 'draft' })).toBe('Unpublished');
    expect(reasonLabel({ reason: 'status', status: 'archived' })).toBe('Archived');
    expect(reasonLabel({ reason: 'publish', status: 'published' })).toBe('Published');
    expect(reasonLabel({ reason: 'before_restore', status: 'draft' })).toBe('Before a restore');
  });

  it('finds the versions whose title changed from the next older one', () => {
    const list = [rev('c', NOW, { title: 'New' }), rev('b', NOW, { title: 'Old' }), rev('a', NOW, { title: 'Old' })];
    expect([...titleChanges(list)]).toEqual([['c', 'New']]);
  });

  it('writes when a version was made', () => {
    expect(whenLabel(new Date(2026, 9, 12, 10, 42).toISOString(), NOW)).toBe('10:42 today');
    expect(whenLabel(new Date(2026, 9, 11, 10, 42).toISOString(), NOW)).toBe('10:42 yesterday');
    expect(whenLabel(new Date(2026, 9, 3, 10, 42).toISOString(), NOW)).toBe('10:42 on 3 October');
  });

  it('names a removed author', () => {
    expect(authorName({ author: null })).toBe('A removed user');
    expect(authorName({ author: { id: 'u', name: 'Ann' } })).toBe('Ann');
  });
});

describe('restoreWarning', () => {
  it('says a live page changes on the site straight away', () => {
    expect(restoreWarning('published', false)[0]).toMatch(/live.*straight away/);
  });

  it('says the status stays for a draft and an archived page', () => {
    expect(restoreWarning('draft', false)[0]).toMatch(/stays a draft/);
    expect(restoreWarning('archived', false)[0]).toMatch(/stays archived/);
  });

  it('mentions unsaved edits only when there are some', () => {
    expect(restoreWarning('draft', true).join(' ')).toMatch(/haven’t been saved yet/);
    expect(restoreWarning('draft', false).join(' ')).not.toMatch(/haven’t been saved yet/);
  });
});
