import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { UserRepository } from '../users/user.repository.js';
import type { ContentRepository } from './content.repository.js';
import type { PreviewLinkRepository } from './preview-link.repository.js';
import { ContentService } from './content.service.js';

type Row = {
  id?: string;
  siteId: string;
  title: string;
  slug: string;
  path: string;
  status: string;
  blocks: unknown;
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
) {
  const table = rows.map((row) => ({ ...row }));
  const content = {
    // A copy, like Prisma's: a later update must not change a row the
    // service already read.
    findBySlug: vi.fn(async (siteId: string, slug: string) => {
      const row = table.find((r) => r.siteId === siteId && r.slug === slug);
      return row ? { ...row } : null;
    }),
    create: vi.fn(
      async (siteId: string, data: Omit<Row, 'siteId' | 'status'>) => {
        const row = { status: 'draft', ...data, siteId };
        table.push(row);
        return row;
      },
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
  const service = new ContentService(
    content as unknown as ContentRepository,
    users as unknown as UserRepository,
    previewLinks as PreviewLinkRepository,
    revalidation as unknown as RevalidationService,
  );
  return { service, table, content, revalidation };
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

  it('on update, and the publish checks see the cleaned blocks', async () => {
    const { service, table } = setup([
      { siteId: 'site-a', title: 'P', slug: 'p', path: '/p', status: 'draft', blocks: [] },
    ]);

    await service.update('owner', 'p', { blocks: dirty });

    expect(table[0].blocks).toEqual(clean);
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
