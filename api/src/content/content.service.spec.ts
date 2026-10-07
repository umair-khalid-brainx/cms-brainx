import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { UserRepository } from '../users/user.repository.js';
import type { ContentRepository } from './content.repository.js';
import { ContentService } from './content.service.js';

type Row = {
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
) {
  const table = rows.map((row) => ({ ...row }));
  const content = {
    findBySlug: vi.fn(
      async (siteId: string, slug: string) =>
        table.find((r) => r.siteId === siteId && r.slug === slug) ?? null,
    ),
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
    findByIdWithMemberships: vi.fn(async (id: string) =>
      members[id] ? { id, memberships: [members[id]] } : null,
    ),
  };
  const service = new ContentService(
    content as unknown as ContentRepository,
    users as unknown as UserRepository,
  );
  return { service, table, content };
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
