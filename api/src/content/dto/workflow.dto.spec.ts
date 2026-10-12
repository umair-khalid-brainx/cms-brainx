import { approveSchema, rejectSchema, scheduleSchema } from './workflow.dto.js';

describe('approveSchema', () => {
  // The version the reviewer's editor loaded: its `updatedAt`.
  const version = '2026-10-12T11:00:00.000Z';

  it('takes the version alone: publish now', () => {
    expect(approveSchema.parse({ version })).toEqual({ version: new Date(version) });
  });

  it('requires the version the reviewer read', () => {
    expect(approveSchema.safeParse({}).success).toBe(false);
    expect(approveSchema.safeParse({ publishAt: '2026-10-14T09:00:00.000Z' }).success).toBe(false);
  });

  it('accepts an ISO time with an offset, as a Date', () => {
    expect(approveSchema.parse({ version, publishAt: '2026-10-14T09:00:00.000Z' }).publishAt).toEqual(new Date('2026-10-14T09:00:00.000Z'));
    expect(approveSchema.parse({ version, publishAt: '2026-10-14T14:00:00+05:00' }).publishAt).toEqual(new Date('2026-10-14T09:00:00.000Z'));
  });

  it('refuses a time without an offset, and a date alone', () => {
    expect(approveSchema.safeParse({ version, publishAt: '2026-10-14T09:00:00' }).success).toBe(false);
    expect(approveSchema.safeParse({ version, publishAt: '2026-10-14' }).success).toBe(false);
  });

  it('refuses extra keys', () => {
    expect(approveSchema.safeParse({ version, status: 'published' }).success).toBe(false);
  });
});

describe('rejectSchema', () => {
  it('trims the note', () => {
    expect(rejectSchema.parse({ note: '  Fix the hero  ' })).toEqual({ note: 'Fix the hero' });
  });

  it('refuses a missing, empty or blank note', () => {
    expect(rejectSchema.safeParse({}).success).toBe(false);
    expect(rejectSchema.safeParse({ note: '' }).success).toBe(false);
    expect(rejectSchema.safeParse({ note: '   ' }).success).toBe(false);
  });

  it('takes 500 characters and refuses 501', () => {
    expect(rejectSchema.safeParse({ note: 'x'.repeat(500) }).success).toBe(true);
    expect(rejectSchema.safeParse({ note: 'x'.repeat(501) }).success).toBe(false);
  });

  it('refuses extra keys', () => {
    expect(rejectSchema.safeParse({ note: 'x', publishAt: '2026-10-14T09:00:00.000Z' }).success).toBe(false);
  });
});

describe('scheduleSchema', () => {
  it('requires publishAt', () => {
    expect(scheduleSchema.safeParse({}).success).toBe(false);
  });

  it('accepts an ISO time with an offset, as a Date', () => {
    expect(scheduleSchema.parse({ publishAt: '2026-10-14T09:00:00.000Z' })).toEqual({ publishAt: new Date('2026-10-14T09:00:00.000Z') });
  });

  it('refuses a time without an offset', () => {
    expect(scheduleSchema.safeParse({ publishAt: '2026-10-14T09:00:00' }).success).toBe(false);
  });
});
