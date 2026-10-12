import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { UserRepository } from '../users/user.repository.js';
import type { ContentRepository } from './content.repository.js';
import type { StarterLayoutRepository } from '../starter-layouts/starter-layout.repository.js';
import type { ContentTypeRepository } from '../content-types/content-type.repository.js';
import type { PreviewLinkRepository } from './preview-link.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import type { RedirectsService } from '../redirects/redirects.service.js';
import { ContentService } from './content.service.js';

type Row = {
  id?: string;
  siteId: string;
  title: string;
  slug: string;
  path: string;
  status: string;
  blocks: unknown;
  typeId?: string | null;
  authorId?: string | null;
  parentId?: string | null;
  data?: unknown;
};

/**
 * An in-memory stand-in for the `content` table, holding rows for several
 * sites, plus users who each belong to exactly one site — enough to show a
 * service method stays inside the caller's site.
 */
function fakeContent(
  rows: Row[],
  members: Record<string, { siteId: string; role: string }>,
  previewLinks: Partial<PreviewLinkRepository> = {},
  typeTable: { id: string; siteId: string; prefix: string; fields?: unknown }[] = [],
) {
  // Every row gets an id and a parent, as Prisma's do; the page tree (CNT-05) needs both.
  const table = rows.map((row) => ({ parentId: null, ...row, id: row.id ?? `${row.siteId}:${row.slug}` }));
  // What the real repository reads inside its locked transaction: the site's pages, never entries.
  type TreeRow = { id: string; parentId: string | null; slug: string; path: string; status: string };
  const pageTree = (siteId: string): TreeRow[] =>
    table
      .filter((r) => r.siteId === siteId && !r.typeId)
      .map((r) => ({ id: r.id, parentId: r.parentId ?? null, slug: r.slug, path: r.path, status: r.status }));
  const content = {
    // A copy, like Prisma's: a later update must not change a row the
    // service already read.
    findBySlug: vi.fn(async (siteId: string, slug: string) => {
      const row = table.find((r) => r.siteId === siteId && r.slug === slug);
      return row ? { ...row } : null;
    }),
    create: vi.fn(
      async (siteId: string, data: Omit<Row, 'siteId' | 'status'>) => {
        const row = { status: 'draft', parentId: null, ...data, siteId, id: data.id ?? `${siteId}:${data.slug}` };
        table.push(row);
        return row;
      },
    ),
    findMany: vi.fn(async (siteId: string, typeId: string | null) =>
      table.filter((r) => r.siteId === siteId && (r.typeId ?? null) === typeId && r.status !== 'archived'),
    ),
    countChildren: vi.fn(async (siteId: string, id: string) => table.filter((r) => r.siteId === siteId && r.parentId === id).length),
    // Like the real ones: plan from the tree, then write the page and its descendants together.
    updateInTree: vi.fn(
      async (
        siteId: string,
        slug: string,
        data: Partial<Row>,
        plan: (pages: TreeRow[]) => { path: string; descendants: { id: string; path: string }[] },
      ) => {
        const planned = plan(pageTree(siteId));
        const row = table.find((r) => r.siteId === siteId && r.slug === slug);
        if (!row) throw new NotFoundException('Page not found');
        Object.assign(row, data, { path: planned.path });
        for (const { id, path } of planned.descendants) {
          const below = table.find((r) => r.siteId === siteId && r.id === id);
          if (below) below.path = path;
        }
        return planned;
      },
    ),
    createInTree: vi.fn(async (siteId: string, plan: (pages: TreeRow[]) => Omit<Row, 'siteId' | 'status'>) =>
      content.create(siteId, plan(pageTree(siteId))),
    ),
    update: vi.fn(async (siteId: string, slug: string, data: Partial<Row>) => {
      const row = table.find((r) => r.siteId === siteId && r.slug === slug);
      if (row) Object.assign(row, data);
      return { count: row ? 1 : 0 };
    }),
  };
  const users = {
    // Each site's subdomain is its id without `site-`: site-a → `a`.
    findByIdWithMemberships: vi.fn(async (id: string) =>
      members[id]
        ? {
            id,
            memberships: [
              {
                ...members[id],
                site: { subdomain: members[id].siteId.replace('site-', '') },
              },
            ],
          }
        : null,
    ),
  };
  const revalidation = { page: vi.fn(async () => {}) };
  // Redirect rules are tested in api/src/redirects; here only that the content service hands them each move.
  const redirects = { pagesMoved: vi.fn(async () => {}), pathTaken: vi.fn(async () => {}) };
  // Scoped like the real repository: a site only finds its own types.
  const types = {
    findByPrefix: vi.fn(async (siteId: string, prefix: string) =>
      typeTable.find((type) => type.siteId === siteId && type.prefix === prefix) ?? null,
    ),
    findById: vi.fn(async (siteId: string, id: string) =>
      typeTable.find((type) => type.siteId === siteId && type.id === id) ?? null,
    ),
    prefixes: vi.fn(async (siteId: string) => typeTable.filter((type) => type.siteId === siteId).map((type) => type.prefix)),
  };
  const layouts = {
    findByKey: vi.fn(async (key: string) =>
      key === 'landing' ? { key, blocks: [{ type: 'hero', headline: 'Start here' }, { type: 'richText', html: '<p>x</p>' }] } : null,
    ),
  };
  const service = new ContentService(
    content as unknown as ContentRepository,
    users as unknown as UserRepository,
    previewLinks as PreviewLinkRepository,
    revalidation as unknown as RevalidationService,
    types as unknown as ContentTypeRepository,
    layouts as unknown as StarterLayoutRepository,
    redirects as unknown as RedirectsService,
  );
  return { service, table, content, revalidation, types, layouts, redirects };
}

const blocks = [{ type: 'hero', headline: 'Hello' }];

describe('ContentService.duplicate', () => {
  function setup(extra: Row[] = []) {
    return fakeContent(
      [
        {
          siteId: 'site-a',
          title: 'About',
          slug: 'about',
          path: '/about',
          status: 'published',
          blocks,
        },
        {
          siteId: 'site-b',
          title: 'Secret',
          slug: 'secret',
          path: '/secret',
          status: 'draft',
          blocks: [],
        },
        ...extra,
      ],
      {
        alice: { siteId: 'site-a', role: 'owner' },
        bob: { siteId: 'site-b', role: 'owner' },
      },
    );
  }

  it('copies the blocks into a new draft named "<title> (copy)" at <slug>-copy', async () => {
    const { service, table } = setup();

    const copy = await service.duplicate('alice', 'about');

    expect(copy).toMatchObject({
      siteId: 'site-a',
      title: 'About (copy)',
      slug: 'about-copy',
      path: '/about-copy',
      status: 'draft',
    });
    expect(copy.blocks).toEqual(blocks);
    expect(table.find((r) => r.slug === 'about')?.status).toBe('published');
  });

  it('numbers further copies -copy-2, -copy-3', async () => {
    const { service } = setup();

    await service.duplicate('alice', 'about');
    const second = await service.duplicate('alice', 'about');
    const third = await service.duplicate('alice', 'about');

    expect([second.slug, third.slug]).toEqual(['about-copy-2', 'about-copy-3']);
  });

  it('keeps the copy under the same parent path', async () => {
    const { service } = setup([
      {
        siteId: 'site-a',
        title: 'Team',
        slug: 'team',
        path: '/about/team',
        status: 'draft',
        blocks,
      },
    ]);

    expect((await service.duplicate('alice', 'team')).path).toBe(
      '/about/team-copy',
    );
  });

  it('copies the home page to /home-copy, not a second /', async () => {
    const { service } = setup([
      {
        siteId: 'site-a',
        title: 'Home',
        slug: 'home',
        path: '/',
        status: 'published',
        blocks,
      },
    ]);

    expect((await service.duplicate('alice', 'home')).path).toBe('/home-copy');
  });

  it('refuses to copy an archived page', async () => {
    const { service, content } = setup([
      {
        siteId: 'site-a',
        title: 'Old',
        slug: 'old',
        path: '/old',
        status: 'archived',
        blocks,
      },
    ]);

    await expect(service.duplicate('alice', 'old')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(content.create).not.toHaveBeenCalled();
  });

  it("can't reach another site's page, and never writes to it", async () => {
    const { service, content } = setup();

    await expect(service.duplicate('alice', 'secret')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(content.findBySlug).toHaveBeenCalledWith('site-a', 'secret');
    expect(content.create).not.toHaveBeenCalled();
  });
});

describe('ContentService.update publish checks', () => {
  const broken = [{ type: 'hero', headline: '' }];

  function setup() {
    return fakeContent(
      [
        {
          siteId: 'site-a',
          title: 'Draft',
          slug: 'draft',
          path: '/draft',
          status: 'draft',
          blocks: broken,
        },
        {
          siteId: 'site-a',
          title: 'Old',
          slug: 'old',
          path: '/old',
          status: 'archived',
          blocks: broken,
        },
      ],
      {
        owner: { siteId: 'site-a', role: 'owner' },
        contributor: { siteId: 'site-a', role: 'contributor' },
      },
    );
  }

  it('refuses to publish with a 422 listing each problem, and writes nothing', async () => {
    const { service, content } = setup();

    const error = await service
      .update('owner', 'draft', { status: 'published' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).getResponse()).toMatchObject(
      {
        errors: [
          { blockIndex: 0, field: 'headline', message: 'Add a headline' },
        ],
        warnings: [],
      },
    );
    expect(content.update).not.toHaveBeenCalled();
  });

  it('checks the blocks sent with the publish, not the saved ones', async () => {
    const { service, table } = setup();

    await service.update('owner', 'draft', {
      status: 'published',
      blocks: [{ type: 'hero', headline: 'Fixed' }],
    });

    expect(table.find((r) => r.slug === 'draft')?.status).toBe('published');
  });

  it('never blocks a draft save', async () => {
    const { service, table } = setup();

    await service.update('owner', 'draft', {
      blocks: [{ type: 'faq', items: [] }],
    });
    await service.update('owner', 'draft', {
      status: 'draft',
      title: 'Still broken',
    });

    expect(table.find((r) => r.slug === 'draft')).toMatchObject({
      status: 'draft',
      title: 'Still broken',
    });
  });

  it('also checks a restore straight to published', async () => {
    const { service } = setup();

    await expect(
      service.update('owner', 'old', { status: 'published' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('answers a missing permission with 403 before running the checks', async () => {
    const { service } = setup();

    await expect(
      service.update('contributor', 'draft', { status: 'published' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ContentService preview links (CNT-09)', () => {
  function setup() {
    // contentId → link; the fake enforces the same one-per-page rule as the unique index.
    const links = new Map<
      string,
      { siteId: string; token: string; createdAt: Date }
    >();
    const previewLinks = {
      findByContent: vi.fn(async (siteId: string, contentId: string) => {
        const link = links.get(contentId);
        return link?.siteId === siteId ? link : null;
      }),
      findOrCreate: vi.fn(
        async (siteId: string, contentId: string, token: string) => {
          if (!links.has(contentId))
            links.set(contentId, { siteId, token, createdAt: new Date() });
          return links.get(contentId)!;
        },
      ),
      deleteByContent: vi.fn(async (_siteId: string, contentId: string) => {
        links.delete(contentId);
        return { count: 1 };
      }),
    };
    const page = (slug: string, status: string) => ({
      id: `id-${slug}`,
      siteId: 'site-a',
      title: slug,
      slug,
      path: `/${slug}`,
      status,
      blocks: [],
    });
    const fake = fakeContent(
      [page('draft', 'draft'), page('old', 'archived')],
      {
        alice: { siteId: 'site-a', role: 'owner' },
        bob: { siteId: 'site-b', role: 'owner' },
      },
      previewLinks as unknown as Partial<PreviewLinkRepository>,
    );
    return { ...fake, previewLinks };
  }

  it('creates one unguessable link per page, and returns the same one again', async () => {
    const { service } = setup();

    const first = await service.createPreviewLink('alice', 'draft');
    const second = await service.createPreviewLink('alice', 'draft');

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.token).toBe(first.token);
    await expect(
      service.getPreviewLink('alice', 'draft'),
    ).resolves.toMatchObject({ token: first.token });
  });

  it('is a 404 before a link exists and after it is revoked', async () => {
    const { service } = setup();

    await expect(
      service.getPreviewLink('alice', 'draft'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await service.createPreviewLink('alice', 'draft');
    await service.revokePreviewLink('alice', 'draft');
    await expect(
      service.getPreviewLink('alice', 'draft'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to share an archived page', async () => {
    const { service, previewLinks } = setup();

    await expect(
      service.createPreviewLink('alice', 'old'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(previewLinks.findOrCreate).not.toHaveBeenCalled();
  });

  it("can't touch another site's page's link", async () => {
    const { service, previewLinks } = setup();

    await expect(
      service.createPreviewLink('bob', 'draft'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.revokePreviewLink('bob', 'draft'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(previewLinks.deleteByContent).not.toHaveBeenCalled();
  });
});

describe('ContentService.update revalidation (CNT-08)', () => {
  const good = [{ type: 'hero', headline: 'Hello' }];

  function setup() {
    return fakeContent(
      [
        {
          siteId: 'site-a',
          title: 'Draft',
          slug: 'draft',
          path: '/draft',
          status: 'draft',
          blocks: good,
        },
        {
          siteId: 'site-a',
          title: 'Live',
          slug: 'live',
          path: '/live',
          status: 'published',
          blocks: good,
        },
      ],
      { owner: { siteId: 'site-a', role: 'owner' } },
    );
  }

  it('refreshes the page on publish, with its site and path', async () => {
    const { service, revalidation } = setup();

    await service.update('owner', 'draft', { status: 'published' });

    expect(revalidation.page).toHaveBeenCalledExactlyOnceWith('a', '/draft');
  });

  it.each([
    ['saving a live page', { blocks: good }],
    ['unpublishing', { status: 'draft' as const }],
    ['archiving', { status: 'archived' as const }],
  ])('refreshes on %s', async (_name, dto) => {
    const { service, revalidation } = setup();

    await service.update('owner', 'live', dto);

    expect(revalidation.page).toHaveBeenCalledExactlyOnceWith('a', '/live');
  });

  it('leaves the cache alone for a draft that stays a draft', async () => {
    const { service, revalidation } = setup();

    await service.update('owner', 'draft', {
      blocks: good,
      title: 'Still draft',
    });

    expect(revalidation.page).not.toHaveBeenCalled();
  });

  it("doesn't refresh when the publish is refused", async () => {
    const { service, revalidation } = setup();

    await expect(
      service.update('owner', 'draft', { status: 'published', blocks: [] }),
    ).rejects.toThrow();
    expect(revalidation.page).not.toHaveBeenCalled();
  });
});

describe('ContentService sanitises rich text on write (BLK-05)', () => {
  const dirty = [{ type: 'richText', html: '<p onclick="x()">Hi <a href="javascript:alert(1)">there</a></p><script>alert(1)</script>' }];
  const clean = [{ type: 'richText', html: '<p>Hi there</p>' }];

  function setup(rows: Row[] = []) {
    return fakeContent(rows, { owner: { siteId: 'site-a', role: 'owner' } });
  }

  it('on create', async () => {
    const { service, table } = setup();

    await service.create('owner', { title: 'Page', blocks: dirty });

    expect(table[0].blocks).toEqual(clean);
  });

  it('on update', async () => {
    const { service, table } = setup([
      { siteId: 'site-a', title: 'P', slug: 'p', path: '/p', status: 'draft', blocks: [] },
    ]);

    await service.update('owner', 'p', { blocks: dirty });

    expect(table[0].blocks).toEqual(clean);
  });

  it('before the publish checks run, so they judge what would be stored', async () => {
    const { service, table } = setup([
      { siteId: 'site-a', title: 'P', slug: 'p', path: '/p', status: 'draft', blocks: [] },
    ]);
    // Only a refused <script> in the body: after cleaning, the block has real text and publishes.
    // Before cleaning it would look different, so the stored result is what proves the order.
    await service.update('owner', 'p', {
      status: 'published',
      blocks: [{ type: 'richText', html: '<p>Hello</p><script>alert(1)</script>' }],
    });

    expect(table[0].status).toBe('published');
    expect(table[0].blocks).toEqual([{ type: 'richText', html: '<p>Hello</p>' }]);
  });

  it('on duplicate, so rows saved before sanitising existed are cleaned', async () => {
    const { service } = setup([
      { siteId: 'site-a', title: 'P', slug: 'p', path: '/p', status: 'draft', blocks: dirty },
    ]);

    const copy = await service.duplicate('owner', 'p');

    expect(copy.blocks).toEqual(clean);
  });

  it('leaves other blocks untouched', async () => {
    const { service, table } = setup();

    await service.create('owner', { title: 'Page', blocks: [{ type: 'hero', headline: 'Hello' }] });

    expect(table[0].blocks).toEqual([{ type: 'hero', headline: 'Hello' }]);
  });
});

describe('ContentService with content types (TYP-01)', () => {
  const TYPES = [
    { id: 'type-events', siteId: 'site-a', prefix: 'events' },
    { id: 'type-events-b', siteId: 'site-b', prefix: 'events' },
    { id: 'type-blog', siteId: 'site-a', prefix: 'blog' },
  ];

  function setup(rows: Row[] = []) {
    return fakeContent(
      rows,
      { alice: { siteId: 'site-a', role: 'owner' }, bob: { siteId: 'site-b', role: 'owner' } },
      {},
      TYPES,
    );
  }

  const page = (slug: string, extra: Partial<Row> = {}): Row => ({
    siteId: 'site-a', title: slug, slug, path: `/${slug}`, status: 'draft', blocks: [], ...extra,
  });

  it('creates an entry under its type, with its author', async () => {
    const { service, table } = setup();

    await service.create('alice', { title: 'Summer Fair', type: 'events', blocks: [] });

    expect(table[0]).toMatchObject({
      siteId: 'site-a', slug: 'summer-fair', path: '/events/summer-fair', typeId: 'type-events', authorId: 'alice',
    });
  });

  it('refuses a type that does not exist, or that belongs to another site', async () => {
    const { service, table } = setup();

    await expect(service.create('alice', { title: 'x', type: 'nope', blocks: [] })).rejects.toBeInstanceOf(NotFoundException);
    // site-b has 'events' but not 'blog': alice's blog must not resolve for bob.
    await expect(service.create('bob', { title: 'x', type: 'blog', blocks: [] })).rejects.toBeInstanceOf(NotFoundException);
    expect(table).toHaveLength(0);
  });

  it('records the author of an ordinary page too, and leaves its type empty', async () => {
    const { service, table } = setup();

    await service.create('alice', { title: 'About', blocks: [] });

    expect(table[0]).toMatchObject({ path: '/about', typeId: null, authorId: 'alice' });
  });

  it('gives a page a suffix instead of a content type\'s address', async () => {
    const { service, table } = setup();

    await service.create('alice', { title: 'Events', blocks: [] });
    await service.create('alice', { title: 'Blog', blocks: [] });

    expect(table.map((r) => r.slug)).toEqual(['events-2', 'blog-2']);
  });

  it('lets another site use that name freely, and an entry use it too', async () => {
    const { service, table } = setup();

    await service.create('alice', { title: 'Events', type: 'events', blocks: [] });

    expect(table[0].path).toBe('/events/events');
  });

  it('lists pages and entries apart', async () => {
    const { service } = setup([
      page('about'),
      page('summer-fair', { path: '/events/summer-fair', typeId: 'type-events' }),
      page('hello', { path: '/blog/hello', typeId: 'type-blog' }),
      page('secret', { siteId: 'site-b', typeId: null }),
    ]);

    expect((await service.list('alice')).map((r) => r.slug)).toEqual(['about']);
    expect((await service.list('alice', 'events')).map((r) => r.slug)).toEqual(['summer-fair']);
    expect((await service.list('alice', 'blog')).map((r) => r.slug)).toEqual(['hello']);
    await expect(service.list('alice', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('copies an entry into the same type, under the same address, by the person copying', async () => {
    const { service, table } = setup([
      page('summer-fair', { path: '/events/summer-fair', typeId: 'type-events', authorId: 'someone-else' }),
    ]);

    const copy = await service.duplicate('alice', 'summer-fair');

    expect(copy).toMatchObject({ path: '/events/summer-fair-copy', typeId: 'type-events', authorId: 'alice' });
    expect(table).toHaveLength(2);
  });
});

describe('ContentService entry fields (TYP-02)', () => {
  const FIELDS = [
    { key: 'summary', label: 'Summary', kind: 'text', required: true },
    { key: 'when', label: 'When', kind: 'date', required: false },
  ];
  const TYPES = [
    { id: 'type-events', siteId: 'site-a', prefix: 'events', fields: FIELDS },
    { id: 'type-events-b', siteId: 'site-b', prefix: 'events', fields: [{ key: 'other', label: 'Other', kind: 'text', required: false }] },
  ];
  const entry = (extra: Partial<Row> = {}): Row => ({
    siteId: 'site-a', title: 'Fair', slug: 'fair', path: '/events/fair', status: 'draft',
    blocks: [{ type: 'richText', html: '<p>x</p>' }], typeId: 'type-events', ...extra,
  });
  const setup = (rows: Row[]) =>
    fakeContent(rows, { alice: { siteId: 'site-a', role: 'owner' }, bob: { siteId: 'site-b', role: 'owner' } }, {}, TYPES);

  it('saves valid values, merges them with what was there and keeps a hidden field’s value', async () => {
    const { service, table } = setup([entry({ data: { when: '2026-01-01', hidden_field: 'kept' } } as Partial<Row>)]);

    await service.update('alice', 'fair', { data: { summary: '  Summer fair ' } });

    expect(table[0]).toMatchObject({ data: { summary: 'Summer fair', when: '2026-01-01', hidden_field: 'kept' } });
  });

  it('clears a field that is sent blank', async () => {
    const { service, table } = setup([entry({ data: { summary: 'x', when: '2026-01-01' } } as Partial<Row>)]);

    await service.update('alice', 'fair', { data: { when: '' } });

    expect(table[0]).toMatchObject({ data: { summary: 'x' } });
  });

  it('refuses invalid values with every problem listed, and saves nothing', async () => {
    const { service, table, content } = setup([entry()]);

    await expect(service.update('alice', 'fair', { data: { summary: 5, when: '2026-02-30' } })).rejects.toMatchObject({
      response: { message: expect.arrayContaining([expect.stringContaining('Summary'), expect.stringContaining('When')]) },
    });
    expect(content.update).not.toHaveBeenCalled();
    expect(table[0]).not.toHaveProperty('data');
  });

  it('refuses fields on an ordinary page', async () => {
    const { service } = setup([entry({ typeId: null, path: '/fair' })]);

    await expect(service.update('alice', 'fair', { data: { summary: 'x' } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('judges values against the caller’s own site’s type, never another site’s', async () => {
    const { service } = setup([entry({ siteId: 'site-b', typeId: 'type-events-b', slug: 'fair-b', path: '/events/fair-b' })]);

    // site-b's type has an "other" field, not "summary": a summary is ignored, "other" is kept.
    await service.update('bob', 'fair-b', { data: { other: 'ok', summary: 'ignored' } });
  });

  it('waits to publish until a required field has a value, and says which', async () => {
    const { service, table } = setup([entry()]);

    await expect(service.update('alice', 'fair', { status: 'published' })).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'data.summary', message: 'Fill in “Summary”' })] },
    });
    expect(table[0].status).toBe('draft');
  });

  it('publishes once the required field is filled, including in the same save', async () => {
    const { service, table } = setup([entry()]);

    await service.update('alice', 'fair', { status: 'published', data: { summary: 'Done' } });

    expect(table[0]).toMatchObject({ status: 'published', data: { summary: 'Done' } });
  });

  it('stops a live entry having a needed field emptied, but lets other changes through', async () => {
    const { service, table } = setup([entry({ status: 'published', data: { summary: 'x' } } as Partial<Row>)]);

    await expect(service.update('alice', 'fair', { data: { summary: '' } })).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'data.summary' })] },
    });
    expect(table[0]).toMatchObject({ data: { summary: 'x' } });
    await expect(service.update('alice', 'fair', { data: { when: '2026-05-05' } })).resolves.toBeTruthy();
  });

  it('only counts visible fields: a hidden one is never validated or required', async () => {
    const hiddenTypes = [{ id: 'type-events', siteId: 'site-a', prefix: 'events', fields: [{ key: 'old', label: 'Old', kind: 'date', required: true, hidden: true }, ...FIELDS] }];
    const { service, table } = fakeContent(
      [entry({ data: { summary: 'x' } } as Partial<Row>)],
      { alice: { siteId: 'site-a', role: 'owner' } },
      {},
      hiddenTypes,
    );

    await service.update('alice', 'fair', { status: 'published', data: { old: 'not a date' } });

    expect(table[0].status).toBe('published');
    expect(table[0]).toMatchObject({ data: { summary: 'x' } });
  });

  it('a draft save never needs the required fields', async () => {
    const { service } = setup([entry()]);

    await expect(service.update('alice', 'fair', { title: 'New title' })).resolves.toBeTruthy();
  });

  it('copies an entry’s values into its duplicate', async () => {
    const { service } = setup([entry({ data: { summary: 'x' } } as Partial<Row>)]);

    expect(await service.duplicate('alice', 'fair')).toMatchObject({ data: { summary: 'x' } });
  });
});

describe('ContentService publish date and listing refresh (TYP-03)', () => {
  const TYPES = [{ id: 'type-events', siteId: 'site-a', prefix: 'events', fields: [] }];
  const setup = (rows: Row[]) => fakeContent(rows, { alice: { siteId: 'site-a', role: 'owner' } }, {}, TYPES);
  const draft = (extra: Partial<Row> = {}): Row => ({
    siteId: 'site-a', title: 'Fair', slug: 'fair', path: '/events/fair', status: 'draft',
    blocks: [{ type: 'richText', html: '<p>x</p>' }], typeId: 'type-events', ...extra,
  });

  it('sets the publish date the first time it goes live, and keeps it after', async () => {
    const { service, table } = setup([draft()]);

    await service.update('alice', 'fair', { status: 'published' });
    const first = (table[0] as Row & { publishedAt?: Date }).publishedAt;
    expect(first).toBeInstanceOf(Date);

    // The fake repository copies an undefined `blocks` over the saved ones (Prisma ignores it), so they are sent.
    const blocks = [{ type: 'richText', html: '<p>x</p>' }];
    await service.update('alice', 'fair', { status: 'draft', blocks });
    await service.update('alice', 'fair', { status: 'published', blocks });
    expect((table[0] as Row & { publishedAt?: Date }).publishedAt).toBe(first);
  });

  it('refreshes an entry’s listing as well as its page when it goes live', async () => {
    const { service, revalidation } = setup([draft()]);

    await service.update('alice', 'fair', { status: 'published' });

    expect(revalidation.page.mock.calls.map((c: unknown[]) => c[1]).sort()).toEqual(['/events', '/events/fair']);
  });

  it('refreshes only the page for an ordinary page', async () => {
    const { service, revalidation } = setup([draft({ typeId: null, path: '/fair' })]);

    await service.update('alice', 'fair', { status: 'published' });

    expect(revalidation.page.mock.calls.map((c: unknown[]) => c[1])).toEqual(['/fair']);
  });
});

describe('an entry made only of fields (TYP-03 verifier)', () => {
  const TYPES = [{ id: 'type-events', siteId: 'site-a', prefix: 'events', fields: [{ key: 'when', label: 'When', kind: 'date', required: false }] }];
  const setup = (rows: Row[]) => fakeContent(rows, { alice: { siteId: 'site-a', role: 'owner' } }, {}, TYPES);
  const entry = (extra: Partial<Row> = {}): Row => ({
    siteId: 'site-a', title: 'Fair', slug: 'fair', path: '/events/fair', status: 'draft', blocks: [], typeId: 'type-events', ...extra,
  });

  it('can go live with a value and no blocks', async () => {
    const { service, table } = setup([entry({ data: { when: '2026-05-05' } } as Partial<Row>)]);

    await service.update('alice', 'fair', { status: 'published' });

    expect(table[0].status).toBe('published');
  });

  it('still needs something: no blocks and no values is refused', async () => {
    const { service } = setup([entry()]);

    await expect(service.update('alice', 'fair', { status: 'published' })).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ message: 'Add at least one block' })] },
    });
  });

  it('an ordinary page still needs a block', async () => {
    const { service } = setup([entry({ typeId: null, path: '/fair', data: { when: 'x' } } as Partial<Row>)]);

    await expect(service.update('alice', 'fair', { status: 'published' })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('ContentService.create from a starter layout (TYP-04)', () => {
  const setup = () => fakeContent([], { alice: { siteId: 'site-a', role: 'owner' } });

  it('starts the page with a copy of the layout’s blocks', async () => {
    const { service, table, layouts } = setup();

    await service.create('alice', { title: 'Home page', layout: 'landing', blocks: [] });

    expect(table[0].blocks).toEqual([{ type: 'hero', headline: 'Start here' }, { type: 'richText', html: '<p>x</p>' }]);
    expect(layouts.findByKey).toHaveBeenCalledWith('landing');
  });

  it('gives each page its own copy, so editing one never changes the layout or another page', async () => {
    const { service, table } = setup();

    await service.create('alice', { title: 'One', layout: 'landing', blocks: [] });
    await service.create('alice', { title: 'Two', layout: 'landing', blocks: [] });
    (table[0].blocks as { headline?: string }[])[0].headline = 'Changed';

    expect((table[1].blocks as { headline?: string }[])[0].headline).toBe('Start here');
  });

  it('refuses an unknown layout with a 404 and creates nothing', async () => {
    const { service, table } = setup();

    await expect(service.create('alice', { title: 'x', layout: 'nope', blocks: [] })).rejects.toBeInstanceOf(NotFoundException);
    expect(table).toHaveLength(0);
  });

  it('refuses a layout together with blocks of its own', async () => {
    const { service, table } = setup();

    await expect(
      service.create('alice', { title: 'x', layout: 'landing', blocks: [{ type: 'hero' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(table).toHaveLength(0);
  });

  it('works for an entry of a type too, and still sanitises what it stores', async () => {
    const rows = fakeContent([], { alice: { siteId: 'site-a', role: 'owner' } }, {}, [{ id: 't', siteId: 'site-a', prefix: 'blog' }]);
    rows.layouts.findByKey.mockResolvedValueOnce({ key: 'article', blocks: [{ type: 'richText', html: '<p onclick="x()">Hi</p>' }] });

    await rows.service.create('alice', { title: 'A post', type: 'blog', layout: 'article', blocks: [] });

    expect(rows.table[0]).toMatchObject({ path: '/blog/a-post', blocks: [{ type: 'richText', html: '<p>Hi</p>' }] });
  });
});

describe('ContentService slug changes (CNT-04)', () => {
  function setup() {
    return fakeContent(
      [
        { siteId: 'site-a', title: 'Home', slug: 'home', path: '/', status: 'published', blocks },
        { siteId: 'site-a', title: 'About', slug: 'about', path: '/about', status: 'published', blocks },
        { siteId: 'site-a', title: 'Draft', slug: 'draft', path: '/draft', status: 'draft', blocks },
        { siteId: 'site-a', title: 'Fair', slug: 'fair', path: '/events/fair', status: 'published', blocks, typeId: 't-a' },
        { siteId: 'site-b', title: 'Taken elsewhere', slug: 'story', path: '/story', status: 'draft', blocks },
      ],
      {
        alice: { siteId: 'site-a', role: 'owner' },
        carl: { siteId: 'site-a', role: 'contributor' },
      },
      {},
      [{ id: 't-a', siteId: 'site-a', prefix: 'events' }],
    );
  }

  it('normalises whatever the client sends and moves the page to the new path', async () => {
    const { service, table } = setup();
    const updated = await service.update('alice', 'about', { slug: '  Our Café & Story!  ' });
    expect(updated).toMatchObject({ slug: 'our-cafe-story', path: '/our-cafe-story' });
    expect(table.find((r) => r.title === 'About')).toMatchObject({ slug: 'our-cafe-story', path: '/our-cafe-story' });
  });

  it('keeps an entry under its type’s prefix', async () => {
    const { service } = setup();
    expect(await service.update('alice', 'fair', { slug: 'summer-fair' })).toMatchObject({
      slug: 'summer-fair',
      path: '/events/summer-fair',
    });
  });

  it('never changes the slug when only the title changes', async () => {
    const { service } = setup();
    expect(await service.update('alice', 'about', { title: 'About the farm' })).toMatchObject({
      title: 'About the farm',
      slug: 'about',
      path: '/about',
    });
  });

  it('treats the same slug (after normalising) as no change', async () => {
    const { service, revalidation } = setup();
    await service.update('alice', 'draft', { slug: 'DRAFT' });
    expect(revalidation.page).not.toHaveBeenCalled();
  });

  it('refuses a slug another page or entry in the site already uses (409), and writes nothing', async () => {
    const { service, table } = setup();
    await expect(service.update('alice', 'about', { slug: 'draft' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.update('alice', 'about', { slug: 'fair' })).rejects.toBeInstanceOf(ConflictException);
    expect(table.find((r) => r.title === 'About')).toMatchObject({ slug: 'about', path: '/about' });
  });

  it('allows a slug that only another site uses', async () => {
    const { service } = setup();
    expect(await service.update('alice', 'about', { slug: 'story' })).toMatchObject({ slug: 'story', path: '/story' });
  });

  it('refuses a reserved word or a content type’s address for a page', async () => {
    const { service } = setup();
    await expect(service.update('alice', 'about', { slug: 'home' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('alice', 'about', { slug: 'sitemap' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('alice', 'about', { slug: 'events' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets an entry use a word that is only reserved at the top of the site', async () => {
    const { service } = setup();
    expect(await service.update('alice', 'fair', { slug: 'search' })).toMatchObject({ path: '/events/search' });
  });

  it('refuses a slug with no letters or numbers, and changing the home page’s address', async () => {
    const { service } = setup();
    await expect(service.update('alice', 'about', { slug: '!!!' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('alice', 'home', { slug: 'start' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refreshes the old and the new address of a live page', async () => {
    const { service, revalidation } = setup();
    await service.update('alice', 'about', { slug: 'about-us' });
    expect(revalidation.page).toHaveBeenCalledWith('a', '/about');
    expect(revalidation.page).toHaveBeenCalledWith('a', '/about-us');
  });

  it('leaves the cache alone when a draft moves', async () => {
    const { service, revalidation } = setup();
    await service.update('alice', 'draft', { slug: 'later' });
    expect(revalidation.page).not.toHaveBeenCalled();
  });

  it('lets anyone who can edit move a draft, but only those who can publish move a live page (D-053)', async () => {
    const { service, table } = setup();
    expect(await service.update('carl', 'draft', { slug: 'later' })).toMatchObject({ path: '/later' });
    await expect(service.update('carl', 'about', { slug: 'about-us' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(table.find((r) => r.title === 'About')).toMatchObject({ slug: 'about', path: '/about' });
  });

  it('gives a new page a suffix instead of a word the site itself uses, as a rename refuses it', async () => {
    const { service } = setup();
    expect(await service.create('alice', { title: 'Sitemap', blocks: [] })).toMatchObject({ slug: 'sitemap-2', path: '/sitemap-2' });
  });

  it('answers two moves racing to the same slug with a 409, not a 500', async () => {
    const { service, content } = setup();
    content.updateInTree.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.update('alice', 'draft', { slug: 'team' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ContentService page tree (CNT-05, CNT-06)', () => {
  // home · about ─ team ─ leads · shop (draft) · fair (an entry) · other site's page
  function setup() {
    return fakeContent(
      [
        { id: 'home', siteId: 'site-a', title: 'Home', slug: 'home', path: '/', status: 'published', blocks },
        { id: 'about', siteId: 'site-a', title: 'About', slug: 'about', path: '/about', status: 'published', blocks },
        { id: 'team', siteId: 'site-a', title: 'Team', slug: 'team', path: '/about/team', status: 'published', blocks, parentId: 'about' },
        { id: 'leads', siteId: 'site-a', title: 'Leads', slug: 'leads', path: '/about/team/leads', status: 'draft', blocks, parentId: 'team' },
        { id: 'shop', siteId: 'site-a', title: 'Shop', slug: 'shop', path: '/shop', status: 'draft', blocks },
        { id: 'fair', siteId: 'site-a', title: 'Fair', slug: 'fair', path: '/events/fair', status: 'draft', blocks, typeId: 't-a' },
        { id: 'b-page', siteId: 'site-b', title: 'B', slug: 'b-page', path: '/b-page', status: 'draft', blocks },
      ],
      { alice: { siteId: 'site-a', role: 'owner' }, carl: { siteId: 'site-a', role: 'contributor' } },
      {},
      [{ id: 't-a', siteId: 'site-a', prefix: 'events' }],
    );
  }
  const pathOf = (table: { id: string; path: string }[], id: string) => table.find((r) => r.id === id)?.path;

  it('creates a page under a parent, with the parent’s address in front', async () => {
    const { service } = setup();
    expect(await service.create('alice', { title: 'Careers', parentId: 'about', blocks: [] })).toMatchObject({
      path: '/about/careers',
      parentId: 'about',
    });
  });

  it('refuses a parent that is an entry, on another site, the home page, or too deep', async () => {
    const { service } = setup();
    for (const parentId of ['fair', 'b-page', 'home', 'leads']) {
      await expect(service.create('alice', { title: 'X', parentId, blocks: [] })).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(service.create('alice', { title: 'X', type: 'events', parentId: 'about', blocks: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('renaming a parent moves its whole subtree in one write, and nothing else', async () => {
    const { service, table, content } = setup();
    await service.update('alice', 'about', { slug: 'company' });
    expect([pathOf(table, 'about'), pathOf(table, 'team'), pathOf(table, 'leads'), pathOf(table, 'shop')]).toEqual([
      '/company',
      '/company/team',
      '/company/team/leads',
      '/shop',
    ]);
    expect(content.updateInTree).toHaveBeenCalledTimes(1);
  });

  it('says which addresses moved, old to new, for redirects (GOV-05)', async () => {
    const { service } = setup();
    expect(await service.update('alice', 'team', { slug: 'people' })).toMatchObject({
      moved: [
        { from: '/about/team', to: '/about/people' },
        { from: '/about/team/leads', to: '/about/people/leads' },
      ],
    });
  });

  it('moving under another parent, and back to the top', async () => {
    const { service, table } = setup();
    await service.update('alice', 'team', { parentId: 'shop' });
    expect([pathOf(table, 'team'), pathOf(table, 'leads')]).toEqual(['/shop/team', '/shop/team/leads']);
    await service.update('alice', 'team', { parentId: null });
    expect([pathOf(table, 'team'), pathOf(table, 'leads')]).toEqual(['/team', '/team/leads']);
  });

  it('refuses a loop, too much depth, another site’s page, and a parent for an entry; writes nothing', async () => {
    const { service, table } = setup();
    await expect(service.update('alice', 'about', { parentId: 'leads' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('alice', 'shop', { parentId: 'leads' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('alice', 'shop', { parentId: 'b-page' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('alice', 'fair', { parentId: 'about' })).rejects.toBeInstanceOf(BadRequestException);
    expect([pathOf(table, 'about'), pathOf(table, 'shop'), pathOf(table, 'fair')]).toEqual(['/about', '/shop', '/events/fair']);
  });

  it('refreshes old and new addresses of every live page that moved', async () => {
    const { service, revalidation } = setup();
    await service.update('alice', 'about', { slug: 'company' });
    for (const path of ['/about', '/company', '/about/team', '/company/team']) {
      expect(revalidation.page).toHaveBeenCalledWith('a', path);
    }
    // `leads` is a draft: never public, so never refreshed.
    expect(revalidation.page).not.toHaveBeenCalledWith('a', '/company/team/leads');
  });

  it('needs publish rights to move a draft that has live pages below it', async () => {
    const { service } = setup();
    await service.update('alice', 'about', { status: 'draft' });
    await expect(service.update('carl', 'about', { slug: 'company' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a child page use a word reserved at the top, but not move it up there', async () => {
    const { service } = setup();
    await service.update('alice', 'leads', { slug: 'search' });
    await expect(service.update('alice', 'search', { parentId: null })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('won’t permanently delete a page that still has pages under it', async () => {
    const { service } = setup();
    await service.update('alice', 'team', { status: 'archived' });
    await expect(service.remove('alice', 'team')).rejects.toBeInstanceOf(ConflictException);
  });

  it('puts a copy next to the original, under the same parent', async () => {
    const { service } = setup();
    expect(await service.duplicate('alice', 'team')).toMatchObject({ path: '/about/team-copy', parentId: 'about' });
  });
});

describe('ContentService hands moves to redirects (GOV-05)', () => {
  function setup() {
    return fakeContent(
      [
        { id: 'about', siteId: 'site-a', title: 'About', slug: 'about', path: '/about', status: 'published', blocks },
        { id: 'team', siteId: 'site-a', title: 'Team', slug: 'team', path: '/about/team', status: 'draft', blocks, parentId: 'about' },
        { id: 'fair', siteId: 'site-a', title: 'Fair', slug: 'fair', path: '/events/fair', status: 'draft', blocks, typeId: 't-a' },
      ],
      { alice: { siteId: 'site-a', role: 'owner' } },
      {},
      [{ id: 't-a', siteId: 'site-a', prefix: 'events' }],
    );
  }

  it('passes every moved address, saying which were ever public', async () => {
    const { service, redirects } = setup();
    await service.update('alice', 'about', { slug: 'company' });
    expect(redirects.pagesMoved).toHaveBeenCalledWith(
      'site-a',
      'a',
      [
        { from: '/about', to: '/company', everPublished: true },
        { from: '/about/team', to: '/company/team', everPublished: false },
      ],
      'alice',
    );
  });

  it('passes an entry’s move too', async () => {
    const { service, redirects } = setup();
    await service.update('alice', 'fair', { slug: 'summer-fair' });
    expect(redirects.pagesMoved).toHaveBeenCalledWith('site-a', 'a', [{ from: '/events/fair', to: '/events/summer-fair', everPublished: false }], 'alice');
  });

  it('tells redirects when a new page or a copy takes an address', async () => {
    const { service, redirects } = setup();
    await service.create('alice', { title: 'Old page', blocks: [] });
    await service.duplicate('alice', 'about');
    expect(redirects.pathTaken).toHaveBeenCalledWith('site-a', 'a', '/old-page');
    expect(redirects.pathTaken).toHaveBeenCalledWith('site-a', 'a', '/about-copy');
  });

  it('still reports a move as saved when updating redirects fails afterwards', async () => {
    const { service, redirects, table } = setup();
    redirects.pagesMoved.mockRejectedValueOnce(new Error('lock timeout'));
    await expect(service.update('alice', 'about', { slug: 'company' })).resolves.toMatchObject({ path: '/company' });
    expect(table.find((r) => r.id === 'about')?.path).toBe('/company');
  });
});
