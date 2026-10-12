import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { RevisionsService } from '../revisions/revisions.service.js';
import type { UserRepository } from '../users/user.repository.js';
import type { ContentRepository } from './content.repository.js';
import type { ContentService } from './content.service.js';
import { WorkflowService } from './workflow.service.js';

type Row = {
  id: string;
  siteId: string;
  slug: string;
  path: string;
  status: string;
  typeId: string | null;
  blocks: unknown;
  data: unknown;
  publishedAt: Date | null;
  publishAt: Date | null;
  submittedById: string | null;
  submittedAt: Date | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  scheduledById: string | null;
  /** When it was last written; approve and schedule refuse a page saved since they read it. */
  updatedAt?: Date;
};

const page = (overrides: Partial<Row> = {}): Row => ({
  id: 'p1',
  siteId: 'site-a',
  slug: 'about',
  path: '/about',
  status: 'draft',
  typeId: null,
  blocks: [{ type: 'hero', headline: 'Hello' }],
  data: {},
  publishedAt: null,
  publishAt: null,
  submittedById: null,
  submittedAt: null,
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  scheduledById: null,
  ...overrides,
});

const NOW = new Date('2026-10-12T12:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 60 * 60 * 1000;

/**
 * WorkflowService over an in-memory `content` table holding pages of two sites. `transition` honours its
 * from-statuses and `dueBy` like the real conditional write. ContentService and RevisionsService are stubs:
 * what is checked here is that the workflow calls them, not what they do.
 */
function setup(rows: Row[] = [page()]) {
  const table = rows.map((r) => ({ ...r }));
  const members: Record<string, { siteId: string; role: string }> = {
    cat: { siteId: 'site-a', role: 'contributor' },
    dan: { siteId: 'site-a', role: 'contributor' },
    ann: { siteId: 'site-a', role: 'author' },
    ed: { siteId: 'site-a', role: 'editor' },
    zed: { siteId: 'site-b', role: 'owner' },
  };
  const content = {
    findBySlug: vi.fn(async (siteId: string, slug: string) => {
      const row = table.find((r) => r.siteId === siteId && r.slug === slug);
      return row ? { ...row } : null;
    }),
    transition: vi.fn(async (siteId: string, id: string, from: readonly string[], data: Partial<Row>, dueBy?: Date, unchangedSince?: Date) => {
      const row = table.find(
        (r) =>
          r.siteId === siteId &&
          r.id === id &&
          from.includes(r.status) &&
          (!dueBy || (r.publishAt !== null && r.publishAt <= dueBy)) &&
          (!unchangedSince || r.updatedAt?.getTime() === unchangedSince.getTime()),
      );
      if (row) Object.assign(row, data);
      return { count: row ? 1 : 0 };
    }),
    findInReview: vi.fn(async (siteId: string) => table.filter((r) => r.siteId === siteId && r.status === 'in_review')),
    findDue: vi.fn(async (siteId: string, now: Date) =>
      table
        .filter((r) => r.siteId === siteId && r.status === 'scheduled' && r.publishAt !== null && r.publishAt <= now)
        .sort((a, b) => (a.publishAt as Date).getTime() - (b.publishAt as Date).getTime())
        .map((r) => ({ ...r })),
    ),
    findWorkflowPeople: vi.fn(async () => ({ submittedBy: null, reviewedBy: null, scheduledBy: null })),
  };
  const users = {
    findByIdWithMemberships: vi.fn(async (id: string) =>
      members[id]
        ? { id, memberships: [{ ...members[id], site: { id: members[id].siteId, subdomain: members[id].siteId.replace('site-', '') } }] }
        : null,
    ),
  };
  const pages = {
    publishChecksFor: vi.fn(async () => ({ errors: [] as { message: string }[], warnings: [] as unknown[] })),
    refreshPublic: vi.fn(async () => {}),
    getForEdit: vi.fn(async (_userId: string, slug: string) => ({ slug })),
  };
  const revisions = { record: vi.fn(async () => {}) };
  const service = new WorkflowService(
    content as unknown as ContentRepository,
    users as unknown as UserRepository,
    pages as unknown as ContentService,
    revisions as unknown as RevisionsService,
  );
  service.now = () => NOW;
  const current = (slug = 'about', siteId = 'site-a') => table.find((r) => r.slug === slug && r.siteId === siteId) as Row;
  return { service, table, content, pages, revisions, current };
}

const failing = { errors: [{ blockIndex: 0, field: 'headline', message: 'Add a headline' }], warnings: [] };

describe('WorkflowService.submit', () => {
  it('sends a draft to review, recording who submitted it and clearing the old review note', async () => {
    const s = setup([page({ reviewNote: 'Fix the hero', reviewedById: 'ed', reviewedAt: later(-HOUR) })]);

    await s.service.submit('cat', 'about');

    expect(s.current()).toMatchObject({
      status: 'in_review',
      submittedById: 'cat',
      submittedAt: NOW,
      reviewNote: null,
      reviewedById: null,
      reviewedAt: null,
    });
    expect(s.revisions.record).toHaveBeenCalledWith('site-a', 'cat', 'status', expect.objectContaining({ status: 'in_review' }));
    expect(s.pages.getForEdit).toHaveBeenCalledWith('cat', 'about');
  });

  it.each([
    ['in_review', 'This page is already waiting for review.'],
    ['scheduled', 'This page is already scheduled to go live.'],
    ['published', 'This page is already live.'],
    ['archived', 'Restore this page before submitting it.'],
  ])('refuses a %s page with 409, and writes nothing', async (status, message) => {
    const s = setup([page({ status })]);

    await expect(s.service.submit('cat', 'about')).rejects.toThrow(new ConflictException(message));
    expect(s.content.transition).not.toHaveBeenCalled();
    expect(s.revisions.record).not.toHaveBeenCalled();
  });
});

describe('WorkflowService.withdraw', () => {
  const inReview = () => setup([page({ status: 'in_review', submittedById: 'cat', submittedAt: later(-HOUR) })]);

  it('lets the submitter take the page back to draft', async () => {
    const s = inReview();
    await s.service.withdraw('cat', 'about');
    expect(s.current()).toMatchObject({ status: 'draft', submittedById: null, submittedAt: null });
    expect(s.revisions.record).toHaveBeenCalledWith('site-a', 'cat', 'status', expect.objectContaining({ status: 'draft' }));
  });

  it('lets a reviewer withdraw it', async () => {
    const s = inReview();
    await s.service.withdraw('ed', 'about');
    expect(s.current().status).toBe('draft');
  });

  it('refuses another contributor with 403', async () => {
    const s = inReview();
    await expect(s.service.withdraw('dan', 'about')).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.current().status).toBe('in_review');
  });

  it('refuses a page that isn’t in review with 409', async () => {
    const s = setup();
    await expect(s.service.withdraw('cat', 'about')).rejects.toBeInstanceOf(ConflictException);
    expect(s.content.transition).not.toHaveBeenCalled();
  });
});

describe('WorkflowService.approve', () => {
  const inReview = (overrides: Partial<Row> = {}) =>
    setup([page({ status: 'in_review', submittedById: 'cat', submittedAt: later(-HOUR), ...overrides })]);

  it('publishes now, refreshes the public site, and records a publish', async () => {
    const s = inReview();

    await s.service.approve('ed', 'about', {});

    expect(s.current()).toMatchObject({ status: 'published', publishedAt: NOW, reviewedById: 'ed', reviewedAt: NOW, reviewNote: null });
    expect(s.pages.refreshPublic).toHaveBeenCalledWith({ id: 'site-a', subdomain: 'a' }, expect.objectContaining({ id: 'p1' }), 'published');
    expect(s.revisions.record).toHaveBeenCalledWith('site-a', 'ed', 'publish', expect.objectContaining({ status: 'published' }));
  });

  it('keeps the first publish date of a page that was live before', async () => {
    const first = new Date('2026-01-01T00:00:00.000Z');
    const s = inReview({ publishedAt: first });
    await s.service.approve('ed', 'about', {});
    expect(s.current().publishedAt).toEqual(first);
  });

  it('schedules for publishAt, with the reviewer as the one who scheduled it, and refreshes nothing', async () => {
    const s = inReview();

    await s.service.approve('ed', 'about', { publishAt: later(HOUR) });

    expect(s.current()).toMatchObject({ status: 'scheduled', publishAt: later(HOUR), scheduledById: 'ed', reviewedById: 'ed' });
    expect(s.pages.refreshPublic).not.toHaveBeenCalled();
    expect(s.revisions.record).toHaveBeenCalledWith('site-a', 'ed', 'status', expect.objectContaining({ status: 'scheduled' }));
  });

  it('refuses a page that fails the publish checks with 422, and writes nothing', async () => {
    const s = inReview();
    s.pages.publishChecksFor.mockResolvedValueOnce(failing);

    const error = await s.service.approve('ed', 'about', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).getResponse()).toMatchObject({ errors: failing.errors });
    expect(s.content.transition).not.toHaveBeenCalled();
    expect(s.revisions.record).not.toHaveBeenCalled();
  });

  it('refuses a publishAt in the past with 422', async () => {
    const s = inReview();
    await expect(s.service.approve('ed', 'about', { publishAt: later(-1) })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(s.content.transition).not.toHaveBeenCalled();
  });

  it('refuses a page that isn’t in review with 409', async () => {
    const s = setup();
    await expect(s.service.approve('ed', 'about', {})).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('WorkflowService.reject', () => {
  it('sends the page back to draft with the note and who reviewed it', async () => {
    const s = setup([page({ status: 'in_review', submittedById: 'cat' })]);

    await s.service.reject('ed', 'about', { note: 'Fix the hero' });

    expect(s.current()).toMatchObject({ status: 'draft', reviewNote: 'Fix the hero', reviewedById: 'ed', reviewedAt: NOW });
    expect(s.pages.refreshPublic).not.toHaveBeenCalled();
    expect(s.revisions.record).toHaveBeenCalledWith('site-a', 'ed', 'status', expect.objectContaining({ status: 'draft' }));
  });

  it('refuses a page that isn’t in review with 409', async () => {
    const s = setup();
    await expect(s.service.reject('ed', 'about', { note: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('WorkflowService.schedule and unschedule', () => {
  it('schedules a draft, recording who scheduled it', async () => {
    const s = setup([page({ reviewNote: 'Old note' })]);

    await s.service.schedule('ann', 'about', { publishAt: later(HOUR) });

    expect(s.current()).toMatchObject({ status: 'scheduled', publishAt: later(HOUR), scheduledById: 'ann', reviewNote: null });
    expect(s.revisions.record).toHaveBeenCalledWith('site-a', 'ann', 'status', expect.objectContaining({ status: 'scheduled' }));
  });

  it.each(['in_review', 'scheduled', 'published', 'archived'])('refuses a %s page with 409', async (status) => {
    const s = setup([page({ status })]);
    await expect(s.service.schedule('ann', 'about', { publishAt: later(HOUR) })).rejects.toBeInstanceOf(ConflictException);
    expect(s.content.transition).not.toHaveBeenCalled();
  });

  it('refuses a time in the past with 422', async () => {
    const s = setup();
    await expect(s.service.schedule('ann', 'about', { publishAt: later(-HOUR) })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(s.content.transition).not.toHaveBeenCalled();
  });

  it('refuses a draft that fails the publish checks with 422', async () => {
    const s = setup();
    s.pages.publishChecksFor.mockResolvedValueOnce(failing);
    await expect(s.service.schedule('ann', 'about', { publishAt: later(HOUR) })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(s.current().status).toBe('draft');
  });

  it('unschedules back to draft, off the schedule', async () => {
    const s = setup([page({ status: 'scheduled', publishAt: later(HOUR), scheduledById: 'ann' })]);

    await s.service.unschedule('ann', 'about');

    expect(s.current()).toMatchObject({ status: 'draft', publishAt: null, scheduledById: null });
    expect(s.revisions.record).toHaveBeenCalledWith('site-a', 'ann', 'status', expect.objectContaining({ status: 'draft' }));
  });

  it('refuses to unschedule a page that isn’t scheduled with 409', async () => {
    const s = setup();
    await expect(s.service.unschedule('ann', 'about')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('WorkflowService stays inside the caller’s site', () => {
  it('can’t reach another site’s page, and never writes to it', async () => {
    const s = setup([page({ status: 'in_review' }), page({ id: 'p9', siteId: 'site-b', slug: 'secret', path: '/secret', status: 'in_review' })]);

    await expect(s.service.approve('ed', 'secret', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.service.submit('cat', 'secret')).rejects.toBeInstanceOf(NotFoundException);
    expect(s.content.findBySlug).toHaveBeenCalledWith('site-a', 'secret');
    expect(s.content.transition).not.toHaveBeenCalled();
    expect(s.current('secret', 'site-b').status).toBe('in_review');
  });

  it('lists only the caller’s site’s queue', async () => {
    const s = setup([page({ status: 'in_review' }), page({ id: 'p9', siteId: 'site-b', slug: 'secret', status: 'in_review' })]);
    expect((await s.service.queue('ed')).map((r) => r.id)).toEqual(['p1']);
    expect(s.content.findInReview).toHaveBeenCalledWith('site-a');
  });
});

describe('WorkflowService publishes only what it checked', () => {
  it('refuses to approve a page saved since it was read (withdrawn, edited, resubmitted)', async () => {
    const read = new Date('2026-10-12T11:00:00.000Z');
    const s = setup([page({ status: 'in_review', submittedById: 'cat', updatedAt: read })]);
    // Between the read and the write, the page changed and came back into review.
    s.pages.publishChecksFor.mockImplementationOnce(async () => {
      s.current().updatedAt = new Date('2026-10-12T11:30:00.000Z');
      return { errors: [], warnings: [] };
    });

    await expect(s.service.approve('ed', 'about', {})).rejects.toThrow(ConflictException);
    expect(s.current().status).toBe('in_review');
    expect(s.pages.refreshPublic).not.toHaveBeenCalled();
  });

  it('passes the version it read to approve and schedule, and none to the other steps', async () => {
    const read = new Date('2026-10-12T11:00:00.000Z');
    const s = setup([page({ status: 'in_review', submittedById: 'cat', updatedAt: read })]);
    await s.service.approve('ed', 'about', { publishAt: later(HOUR) });
    expect(s.content.transition).toHaveBeenLastCalledWith('site-a', 'p1', ['in_review'], expect.any(Object), undefined, read);
    await s.service.unschedule('ann', 'about');
    expect(s.content.transition).toHaveBeenLastCalledWith('site-a', 'p1', ['scheduled'], expect.any(Object), undefined, undefined);
  });
});

describe('WorkflowService.approve approves the version the reviewer read', () => {
  it('refuses when the page changed after the reviewer opened it, and writes nothing', async () => {
    const opened = new Date('2026-10-12T11:00:00.000Z');
    // Withdrawn, edited and resubmitted while the reviewer was reading: a newer version is in review now.
    const s = setup([page({ status: 'in_review', submittedById: 'cat', updatedAt: new Date('2026-10-12T11:20:00.000Z') })]);

    await expect(s.service.approve('ed', 'about', { version: opened })).rejects.toThrow(
      new ConflictException('This page changed since you opened it. Reload it to read the latest version.'),
    );
    expect(s.content.transition).not.toHaveBeenCalled();
    expect(s.current().status).toBe('in_review');
  });

  it('approves when it is the version the reviewer read', async () => {
    const opened = new Date('2026-10-12T11:00:00.000Z');
    const s = setup([page({ status: 'in_review', submittedById: 'cat', updatedAt: opened })]);
    await s.service.approve('ed', 'about', { version: new Date(opened.getTime()) });
    expect(s.current().status).toBe('published');
  });
});

describe('WorkflowService.publishNow', () => {
  const scheduled = (overrides: Partial<Row> = {}) =>
    setup([page({ status: 'scheduled', publishAt: later(HOUR), scheduledById: 'ann', submittedById: 'cat', ...overrides })]);

  it('publishes a scheduled page in one step, clears the schedule, refreshes, and records a publish', async () => {
    const s = scheduled();

    await s.service.publishNow('ann', 'about');

    expect(s.current()).toMatchObject({ status: 'published', publishAt: null, scheduledById: null, submittedById: null, publishedAt: NOW });
    expect(s.pages.refreshPublic).toHaveBeenCalledWith({ id: 'site-a', subdomain: 'a' }, expect.objectContaining({ id: 'p1' }), 'published');
    expect(s.revisions.record).toHaveBeenCalledWith('site-a', 'ann', 'publish', expect.objectContaining({ status: 'published' }));
  });

  it('leaves it scheduled when it no longer passes the checks', async () => {
    const s = scheduled();
    s.pages.publishChecksFor.mockResolvedValueOnce(failing);

    await expect(s.service.publishNow('ann', 'about')).rejects.toThrow(UnprocessableEntityException);
    expect(s.current()).toMatchObject({ status: 'scheduled', publishAt: later(HOUR) });
  });

  it('refuses a page that isn’t scheduled', async () => {
    const s = setup([page({ status: 'draft' })]);
    await expect(s.service.publishNow('ann', 'about')).rejects.toThrow(ConflictException);
  });
});

describe('WorkflowService loses a race with 409', () => {
  it('refuses when someone else moved the page first, and records nothing', async () => {
    const s = setup([page({ status: 'in_review', submittedById: 'cat' })]);
    // Read as in review; by the write, another reviewer has already acted.
    s.content.transition.mockResolvedValueOnce({ count: 0 });

    await expect(s.service.approve('ed', 'about', {})).rejects.toThrow(ConflictException);
    expect(s.pages.refreshPublic).not.toHaveBeenCalled();
    expect(s.revisions.record).not.toHaveBeenCalled();
  });
});

describe('WorkflowService.publishDue', () => {
  const site = { id: 'site-a', subdomain: 'a' };
  const scheduled = (overrides: Partial<Row>) => page({ status: 'scheduled', scheduledById: 'ann', publishAt: later(-60_000), ...overrides });

  it('publishes only the pages whose time has come, as the person who scheduled them', async () => {
    const s = setup([
      scheduled({ id: 'p1', slug: 'due', path: '/due' }),
      scheduled({ id: 'p2', slug: 'not-yet', path: '/not-yet', publishAt: later(HOUR) }),
      scheduled({ id: 'p3', siteId: 'site-b', slug: 'other', path: '/other' }),
    ]);

    expect(await s.service.publishDue(site, NOW)).toBe(1);

    expect(s.current('due')).toMatchObject({ status: 'published', publishAt: null, publishedAt: NOW });
    expect(s.current('not-yet').status).toBe('scheduled');
    expect(s.current('other', 'site-b').status).toBe('scheduled');
    expect(s.revisions.record).toHaveBeenCalledExactlyOnceWith('site-a', 'ann', 'publish', expect.objectContaining({ slug: 'due' }));
    expect(s.pages.refreshPublic).toHaveBeenCalledExactlyOnceWith(site, expect.objectContaining({ id: 'p1' }), 'published');
  });

  it('keeps the first publish date of a page that was live before', async () => {
    const first = new Date('2026-01-01T00:00:00.000Z');
    const s = setup([scheduled({ publishedAt: first })]);
    await s.service.publishDue(site, NOW);
    expect(s.current().publishedAt).toEqual(first);
  });

  it('sends a page that now fails the checks back to draft with a note, and doesn’t count it', async () => {
    const s = setup([scheduled({})]);
    s.pages.publishChecksFor.mockResolvedValueOnce(failing);

    expect(await s.service.publishDue(site, NOW)).toBe(0);

    expect(s.current()).toMatchObject({ status: 'draft', publishAt: null, scheduledById: null, reviewedById: null, reviewedAt: NOW });
    expect(s.current().reviewNote).toBe('Couldn’t go live at its scheduled time: Add a headline. It’s back in draft.');
    expect(s.revisions.record).toHaveBeenCalledExactlyOnceWith('site-a', 'ann', 'status', expect.objectContaining({ status: 'draft' }));
    expect(s.pages.refreshPublic).not.toHaveBeenCalled();
  });

  it('skips a page someone else claimed first, without counting or recording it', async () => {
    const s = setup([scheduled({})]);
    s.content.transition.mockResolvedValueOnce({ count: 0 });

    expect(await s.service.publishDue(site, NOW)).toBe(0);
    expect(s.revisions.record).not.toHaveBeenCalled();
    expect(s.pages.refreshPublic).not.toHaveBeenCalled();
  });

  it('claims with the tick’s time, so a page rescheduled later in the meantime is left alone', async () => {
    const s = setup([scheduled({})]);
    await s.service.publishDue(site, NOW);
    expect(s.content.transition).toHaveBeenCalledWith('site-a', 'p1', ['scheduled'], expect.anything(), NOW);
  });

  it('still publishes when the revision can’t be written', async () => {
    const s = setup([scheduled({})]);
    s.revisions.record.mockRejectedValueOnce(new Error('revisions table down'));

    expect(await s.service.publishDue(site, NOW)).toBe(1);
    expect(s.current().status).toBe('published');
    expect(s.pages.refreshPublic).toHaveBeenCalled();
  });
});

describe('WorkflowService revision failures', () => {
  it('never fail a step that has committed', async () => {
    const s = setup();
    s.revisions.record.mockRejectedValueOnce(new Error('revisions table down'));
    await expect(s.service.submit('cat', 'about')).resolves.toEqual({ slug: 'about' });
    expect(s.current().status).toBe('in_review');
  });
});
