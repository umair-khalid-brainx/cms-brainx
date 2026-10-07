import { NotFoundException } from '@nestjs/common';
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

  it("can't reach another site's page, and never writes to it", async () => {
    const { service, content } = setup();

    await expect(service.duplicate('alice', 'secret')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(content.findBySlug).toHaveBeenCalledWith('site-a', 'secret');
    expect(content.create).not.toHaveBeenCalled();
  });
});
