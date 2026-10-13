import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ContentTypeRepository } from '../content-types/content-type.repository.js';
import type { ContentRepository } from '../content/content.repository.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import { fakeTermRepository } from '../taxonomy/term-test-kit.js';
import type { TermRepository } from '../taxonomy/term.repository.js';
import type { TermLinks } from '../taxonomy/terms.service.js';
import type { UserRepository } from '../users/user.repository.js';
import { AUTOSAVE_WINDOW_MS, REVISION_LIMIT } from './revision-rules.js';
import { fakeRevisionRepository } from './revision-test-kit.js';
import { RevisionsService } from './revisions.service.js';

/** The publish checks of a live page, when nothing is wrong. */
const passes = async () => ({ errors: [] as unknown[] });

type Row = {
  id: string;
  siteId: string;
  slug: string;
  path: string;
  title: string;
  status: 'draft' | 'published' | 'archived' | 'in_review' | 'scheduled';
  blocks: unknown;
  data: unknown;
  seo: unknown;
  typeId: string | null;
};

const page = (overrides: Partial<Row> = {}): Row => ({
  id: 'p1',
  siteId: 'site-a',
  slug: 'about',
  path: '/about',
  title: 'About',
  status: 'draft',
  blocks: [{ type: 'hero', headline: 'Hello' }],
  data: {},
  seo: {},
  typeId: null,
  ...overrides,
});

function setup(rows: Row[] = [page()], typeRows: { id: string; siteId: string; prefix: string; hasCategories: boolean; hasTags: boolean }[] = []) {
  const table = rows.map((r) => ({ ...r }));
  const termKit = fakeTermRepository([
    { id: 'c1', siteId: 'site-a', kind: 'category', name: 'News', slug: 'news' },
    { id: 't1', siteId: 'site-a', kind: 'tag', name: 'fair', slug: 'fair' },
  ]);
  const revisionKit = fakeRevisionRepository({ ann: 'Ann', bob: 'Bob' });
  const members: Record<string, { siteId: string; role: string }> = {
    ann: { siteId: 'site-a', role: 'owner' },
    bob: { siteId: 'site-a', role: 'contributor' },
    zed: { siteId: 'site-b', role: 'owner' },
  };
  const content = {
    findBySlug: vi.fn(async (siteId: string, slug: string) => {
      const row = table.find((r) => r.siteId === siteId && r.slug === slug);
      return row ? { ...row } : null;
    }),
    // Like the real one: with a status, it writes only while the page still has it (GOV-07).
    update: vi.fn(async (siteId: string, slug: string, data: Partial<Row>, links?: TermLinks, status?: string) => {
      const row = table.find((r) => r.siteId === siteId && r.slug === slug && (!status || r.status === status));
      if (row) Object.assign(row, data);
      if (row && links) termKit.setLinks(siteId, row.id, links);
      return { count: row ? 1 : 0 };
    }),
  };
  const users = {
    findByIdWithMemberships: vi.fn(async (id: string) =>
      members[id] ? { id, memberships: [{ ...members[id], site: { subdomain: members[id].siteId.replace('site-', '') } }] } : null,
    ),
  };
  const types = { findById: vi.fn(async (siteId: string, id: string) => typeRows.find((t) => t.siteId === siteId && t.id === id) ?? null) };
  const revalidation = { page: vi.fn(async () => {}), site: vi.fn(async () => {}) };
  const service = new RevisionsService(
    revisionKit.repo,
    content as unknown as ContentRepository,
    termKit.repo as unknown as TermRepository,
    types as unknown as ContentTypeRepository,
    users as unknown as UserRepository,
    revalidation as unknown as RevalidationService,
  );
  service.now = () => revisionKit.clock.now;
  const current = (slug = 'about') => ({ ...(table.find((r) => r.slug === slug) as Row) });
  return { service, table, content, revisionKit, termKit, revalidation, current };
}

const minutes = (n: number) => n * 60_000;

describe('RevisionsService.recordSave: throttle', () => {
  it('overwrites the same author’s autosave inside 10 minutes, so the newest state is the one kept', async () => {
    const { service, table, revisionKit, current } = setup();
    await service.recordSave('site-a', 'ann', 'draft', { blocks: [] }, current());
    table[0].title = 'Second';
    revisionKit.clock.now = new Date(revisionKit.clock.now.getTime() + minutes(3));
    await service.recordSave('site-a', 'ann', 'draft', { title: 'Second' }, current());

    expect(revisionKit.rows).toHaveLength(1);
    expect(revisionKit.rows[0]).toMatchObject({ reason: 'autosave', title: 'Second' });
  });

  it('writes a new revision once the window has passed', async () => {
    const { service, table, revisionKit, current } = setup();
    await service.recordSave('site-a', 'ann', 'draft', { blocks: [] }, current());
    table[0].title = 'Later';
    revisionKit.clock.now = new Date(revisionKit.clock.now.getTime() + AUTOSAVE_WINDOW_MS + 1);
    await service.recordSave('site-a', 'ann', 'draft', { title: 'Later' }, current());

    expect(revisionKit.rows.map((r) => r.title)).toEqual(['About', 'Later']);
  });

  it('writes a separate revision for another user, and does not touch the first one', async () => {
    const { service, table, revisionKit, current } = setup();
    await service.recordSave('site-a', 'ann', 'draft', { blocks: [] }, current());
    table[0].title = 'Bob’s';
    await service.recordSave('site-a', 'bob', 'draft', { title: 'Bob’s' }, current());

    expect(revisionKit.rows.map((r) => [r.authorId, r.title])).toEqual([['ann', 'About'], ['bob', 'Bob’s']]);
  });

  it('starts a new row after a publish, so the newest state stays at the top', async () => {
    const { service, table, revisionKit, current } = setup();
    await service.recordSave('site-a', 'ann', 'draft', { blocks: [] }, current());
    table[0].status = 'published';
    await service.recordSave('site-a', 'ann', 'draft', { status: 'published' }, current());
    table[0].title = 'Edited live';
    await service.recordSave('site-a', 'ann', 'published', { title: 'Edited live' }, current());

    expect(revisionKit.rows.map((r) => r.reason)).toEqual(['autosave', 'publish', 'autosave']);
  });

  it('records nothing for an autosave that changed nothing', async () => {
    const { service, revisionKit, current } = setup();
    await service.recordSave('site-a', 'ann', 'draft', { blocks: [] }, current());
    await service.recordSave('site-a', 'ann', 'draft', { blocks: [] }, current());
    expect(revisionKit.rows).toHaveLength(1);
    expect(revisionKit.repo.overwrite).not.toHaveBeenCalled();
  });

  it('records nothing for a move alone', async () => {
    const { service, revisionKit, current } = setup();
    await service.recordSave('site-a', 'ann', 'draft', {}, current());
    expect(revisionKit.rows).toHaveLength(0);
  });
});

describe('RevisionsService.recordSave: events and pruning', () => {
  it('always records a publish, a status change and an archive, with the status the page had then', async () => {
    const { service, table, revisionKit, current } = setup();
    table[0].status = 'published';
    await service.recordSave('site-a', 'ann', 'draft', { status: 'published' }, current());
    await service.recordSave('site-a', 'ann', 'draft', { status: 'published' }, current());
    table[0].status = 'draft';
    await service.recordSave('site-a', 'ann', 'published', { status: 'draft' }, current());
    table[0].status = 'archived';
    await service.recordSave('site-a', 'ann', 'draft', { status: 'archived' }, current());

    expect(revisionKit.rows.map((r) => [r.reason, r.status])).toEqual([
      ['publish', 'published'],
      ['publish', 'published'],
      ['status', 'draft'],
      ['status', 'archived'],
    ]);
  });

  it('keeps the newest 50 of a page and deletes the older ones', async () => {
    const { service, table, revisionKit, current } = setup();
    for (let i = 0; i < REVISION_LIMIT + 5; i++) {
      table[0].title = `Title ${i}`;
      revisionKit.clock.now = new Date(revisionKit.clock.now.getTime() + 1000);
      await service.recordSave('site-a', 'ann', 'draft', { status: 'draft', title: 'x' }, current());
      // Each one is its own row: a status change is never overwritten.
      table[0].status = i % 2 ? 'draft' : 'archived';
      await service.record('site-a', 'ann', 'status', current());
    }
    const listed = await service.list('ann', 'about');
    expect(listed).toHaveLength(REVISION_LIMIT);
    expect(revisionKit.rows.length).toBe(REVISION_LIMIT);
    expect(listed[0].title).toBe(`Title ${REVISION_LIMIT + 4}`);
  });

  it('snapshots the entry’s terms by name and id', async () => {
    const { service, termKit, revisionKit, current } = setup([page({ typeId: 'ty1' })], [{ id: 'ty1', siteId: 'site-a', prefix: 'blog', hasCategories: true, hasTags: true }]);
    termKit.setLinks('site-a', 'p1', [{ kind: 'category', termIds: ['c1'] }, { kind: 'tag', termIds: ['t1'] }]);
    await service.recordSave('site-a', 'ann', 'draft', { categoryIds: ['c1'] }, current());
    expect(revisionKit.rows[0].terms).toEqual([
      { id: 'c1', name: 'News', kind: 'category' },
      { id: 't1', name: 'fair', kind: 'tag' },
    ]);
  });
});

describe('RevisionsService.restore', () => {
  const entryTypes = [{ id: 'ty1', siteId: 'site-a', prefix: 'blog', hasCategories: true, hasTags: true }];

  async function withHistory(rows = [page()], types: typeof entryTypes = []) {
    const s = setup(rows, types);
    // An old state is recorded, then the page moves on.
    s.table[0].title = 'Old title';
    s.table[0].blocks = [{ type: 'richText', html: '<p>old</p>' }];
    s.table[0].seo = { metaTitle: 'Old SEO' };
    await s.service.record('site-a', 'ann', 'publish', s.current());
    const oldId = s.revisionKit.rows[0].id;
    s.revisionKit.clock.now = new Date(s.revisionKit.clock.now.getTime() + minutes(30));
    s.table[0].title = 'Newer title';
    s.table[0].blocks = [{ type: 'hero', headline: 'Newer' }];
    s.table[0].seo = {};
    return { ...s, oldId };
  }

  it('keeps the current state first, replaces the content, keeps status and address, and records the result', async () => {
    const s = await withHistory();
    s.table[0].status = 'draft';

    const result = await s.service.restore('ann', 'about', s.oldId, passes);

    expect(s.current()).toMatchObject({ title: 'Old title', status: 'draft', slug: 'about', path: '/about', blocks: [{ type: 'richText', html: '<p>old</p>' }], seo: { metaTitle: 'Old SEO' } });
    expect(s.revisionKit.rows.map((r) => [r.reason, r.title])).toEqual([
      ['publish', 'Old title'],
      ['before_restore', 'Newer title'],
      ['restore', 'Old title'],
    ]);
    expect(result).toMatchObject({ restored: true, droppedTerms: [] });
  });

  it('keeps the page’s own status when the snapshot had another', async () => {
    const s = await withHistory();
    s.table[0].status = 'published';
    // The old revision recorded `draft`: the live page stays live.
    s.revisionKit.rows[0].status = 'draft';

    await s.service.restore('ann', 'about', s.oldId, passes);

    expect(s.current().status).toBe('published');
    expect(s.revisionKit.rows.at(-1)).toMatchObject({ reason: 'restore', status: 'published' });
    expect(s.revalidation.page).toHaveBeenCalledWith('a', '/about');
  });

  it('refuses to put a live page into a state that could not be published, and writes nothing', async () => {
    const s = await withHistory();
    s.table[0].status = 'published';
    const rowsBefore = s.revisionKit.rows.length;
    const check = vi.fn(async () => ({ errors: [{ blockIndex: 0, field: null, message: 'Gone' }] }));

    await expect(s.service.restore('ann', 'about', s.oldId, check)).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(s.current().title).toBe('Newer title');
    expect(s.revisionKit.rows).toHaveLength(rowsBefore);
  });

  it('does not run the publish checks for a draft', async () => {
    const s = await withHistory();
    s.table[0].status = 'draft';
    const check = vi.fn(async () => ({ errors: [{ message: 'x' }] }));
    await s.service.restore('ann', 'about', s.oldId, check);
    expect(check).not.toHaveBeenCalled();
  });

  it('does not keep a before_restore row when the latest revision already holds the current state', async () => {
    const s = setup();
    await s.service.record('site-a', 'ann', 'publish', s.current());
    s.table[0].title = 'Changed';
    await s.service.record('site-a', 'ann', 'status', s.current());
    s.table[0].title = 'About';
    await s.service.record('site-a', 'ann', 'status', s.current());
    const before = s.revisionKit.rows.length;
    const target = s.revisionKit.rows[0].id;

    await s.service.restore('ann', 'about', target, passes);

    expect(s.revisionKit.rows.map((r) => r.reason).slice(before)).toEqual(['restore']);
  });

  it('sanitises the blocks again on write', async () => {
    const s = await withHistory();
    s.revisionKit.rows[0].blocks = [{ type: 'richText', html: '<p>ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>' }];

    await s.service.restore('ann', 'about', s.oldId, passes);

    const html = (s.current().blocks as { html: string }[])[0].html;
    expect(html).toContain('<p>ok</p>');
    expect(html).not.toContain('script');
    expect(html).not.toContain('javascript:');
  });

  it('puts terms back, drops deleted ones silently and names them in the answer', async () => {
    const s = await withHistory([page({ typeId: 'ty1' })], entryTypes);
    s.revisionKit.rows[0].terms = [
      { id: 'c1', name: 'News', kind: 'category' },
      { id: 't1', name: 'fair', kind: 'tag' },
      { id: 'gone', name: 'Old tag', kind: 'tag' },
    ];

    const result = await s.service.restore('ann', 'about', s.oldId, passes);

    expect(s.termKit.links).toEqual(expect.arrayContaining([{ contentId: 'p1', termId: 'c1' }, { contentId: 'p1', termId: 't1' }]));
    expect(s.termKit.links).toHaveLength(2);
    expect(result.droppedTerms).toEqual([{ name: 'Old tag', kind: 'tag' }]);
  });

  it('refreshes the whole site when a live entry’s terms changed', async () => {
    const s = await withHistory([page({ typeId: 'ty1', status: 'published', path: '/blog/about' })], entryTypes);
    s.revisionKit.rows[0].terms = [{ id: 'c1', name: 'News', kind: 'category' }];

    await s.service.restore('ann', 'about', s.oldId, passes);

    expect(s.revalidation.site).toHaveBeenCalledWith('a');
    expect(s.revalidation.page).toHaveBeenCalledWith('a', '/blog/about');
  });

  it('does not revalidate a draft', async () => {
    const s = await withHistory();
    await s.service.restore('ann', 'about', s.oldId, passes);
    expect(s.revalidation.page).not.toHaveBeenCalled();
    expect(s.revalidation.site).not.toHaveBeenCalled();
  });

  it('refuses a contributor on a live page, and writes nothing', async () => {
    const s = await withHistory();
    s.table[0].status = 'published';
    const before = s.revisionKit.rows.length;

    await expect(s.service.restore('bob', 'about', s.oldId, passes)).rejects.toBeInstanceOf(ForbiddenException);

    expect(s.content.update).not.toHaveBeenCalled();
    expect(s.revisionKit.rows).toHaveLength(before);
  });

  it.each(['in_review', 'scheduled'] as const)('refuses to restore a %s page with 409, and records nothing', async (status) => {
    const s = await withHistory();
    s.table[0].status = status;
    const before = s.revisionKit.rows.length;

    await expect(s.service.restore('ann', 'about', s.oldId, passes)).rejects.toBeInstanceOf(ConflictException);

    expect(s.content.update).not.toHaveBeenCalled();
    expect(s.revisionKit.rows).toHaveLength(before);
    expect(s.current().title).toBe('Newer title');
  });

  it('replaces nothing when the page went into review between the read and the write (409)', async () => {
    const s = await withHistory();
    // The checks run between the read and the write; by then the page was submitted.
    const intoReview = async () => {
      s.table[0].status = 'in_review';
      return { errors: [] };
    };
    s.table[0].status = 'published';

    await expect(s.service.restore('ann', 'about', s.oldId, intoReview)).rejects.toBeInstanceOf(ConflictException);
    expect(s.current().title).toBe('Newer title');
  });

  it('lets a contributor restore a draft', async () => {
    const s = await withHistory();
    await expect(s.service.restore('bob', 'about', s.oldId, passes)).resolves.toMatchObject({ restored: true });
    expect(s.current().title).toBe('Old title');
  });

  it('does not find another site’s page or revision', async () => {
    const s = await withHistory();
    // zed belongs to site-b, which has no page called "about".
    await expect(s.service.restore('zed', 'about', s.oldId, passes)).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.service.list('zed', 'about')).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.service.get('zed', 'about', s.oldId)).rejects.toBeInstanceOf(NotFoundException);
    expect(s.content.update).not.toHaveBeenCalled();
  });

  it('does not find a revision of another page of the same site', async () => {
    const s = setup([page(), page({ id: 'p2', slug: 'contact', path: '/contact', title: 'Contact' })]);
    await s.service.record('site-a', 'ann', 'publish', s.current('contact'));
    await expect(s.service.restore('ann', 'about', s.revisionKit.rows[0].id, passes)).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.service.get('ann', 'about', s.revisionKit.rows[0].id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RevisionsService.list and get', () => {
  it('lists newest first with the author’s name, and returns one revision whole', async () => {
    const s = setup();
    await s.service.record('site-a', 'ann', 'publish', s.current());
    s.revisionKit.clock.now = new Date(s.revisionKit.clock.now.getTime() + 1000);
    s.table[0].title = 'Second';
    await s.service.record('site-a', 'bob', 'status', s.current());

    const list = await s.service.list('ann', 'about');
    expect(list.map((r) => [r.title, r.reason, r.author?.name])).toEqual([['Second', 'status', 'Bob'], ['About', 'publish', 'Ann']]);
    expect(list[0]).not.toHaveProperty('blocks');

    const one = await s.service.get('ann', 'about', list[1].id);
    expect(one).toMatchObject({ title: 'About', blocks: [{ type: 'hero', headline: 'Hello' }], terms: [], status: 'draft' });
  });
});
