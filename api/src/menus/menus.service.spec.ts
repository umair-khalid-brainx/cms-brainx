import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ContentRepository } from '../content/content.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { UserRepository } from '../users/user.repository.js';
import type { MenuRepository } from './menu.repository.js';
import type { MenuInput } from './menu-tree.js';
import { MenusService } from './menus.service.js';

function setup() {
  // Pages by site: the service must only ever look in the caller's own.
  const pages: Record<string, string[]> = { 'site-a': ['p1', 'p2'], 'site-b': ['b1'] };
  const saved: { siteId: string; location: string; menu: MenuInput }[] = [];
  const menus = {
    findTree: vi.fn(async () => []),
    replaceTree: vi.fn(async (siteId: string, location: string, menu: MenuInput) => {
      saved.push({ siteId, location, menu });
    }),
  };
  const content = {
    findFactsByIds: vi.fn(async (siteId: string, ids: readonly string[]) =>
      ids.filter((id) => (pages[siteId] ?? []).includes(id)).map((id) => ({ id, path: `/${id}`, status: 'published' })),
    ),
  };
  const users = {
    findByIdWithMemberships: vi.fn(async (id: string) =>
      id === 'alice'
        ? { memberships: [{ siteId: 'site-a', site: { subdomain: 'alpha' } }] }
        : id === 'bob'
          ? { memberships: [{ siteId: 'site-b', site: { subdomain: 'beta' } }] }
          : { memberships: [] },
    ),
  };
  const revalidation = { site: vi.fn(async () => {}) };
  const service = new MenusService(
    menus as unknown as MenuRepository,
    content as unknown as ContentRepository,
    users as unknown as UserRepository,
    revalidation as unknown as RevalidationService,
  );
  return { service, menus, content, revalidation, saved };
}

describe('MenusService.save (GOV-03)', () => {
  it('saves the whole menu for the caller’s site and refreshes every page of it', async () => {
    const { service, saved, revalidation } = setup();
    await service.save('alice', 'header', {
      items: [{ label: 'About', contentId: 'p1', children: [{ label: 'Team', contentId: 'p2' }] }, { label: 'Shop', url: 'https://shop.example.com' }],
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ siteId: 'site-a', location: 'header' });
    expect(saved[0].menu.items[0].children[0]).toMatchObject({ label: 'Team', contentId: 'p2' });
    expect(revalidation.site).toHaveBeenCalledExactlyOnceWith('alpha');
  });

  it('can empty a menu', async () => {
    const { service, saved } = setup();
    await service.save('alice', 'footer', { items: [] });
    expect(saved[0].menu.items).toEqual([]);
  });

  it('refuses a bad body with every problem named, and writes and refreshes nothing', async () => {
    const { service, saved, revalidation } = setup();
    await expect(service.save('alice', 'header', { items: [{ label: ' ', url: 'javascript:alert(1)' }, { label: 'Both', contentId: 'p1', url: '/x' }] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.save('alice', 'header', { nope: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(saved).toEqual([]);
    expect(revalidation.site).not.toHaveBeenCalled();
  });

  it('refuses a page that belongs to another site, or does not exist, and writes nothing', async () => {
    const { service, saved } = setup();
    await expect(service.save('alice', 'header', { items: [{ label: 'Theirs', contentId: 'b1' }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.save('alice', 'header', { items: [{ label: 'Nope', contentId: 'zzz' }] })).rejects.toBeInstanceOf(BadRequestException);
    expect(saved).toEqual([]);
  });

  it('checks the pages against the caller’s site, so the same id is fine on the site that owns it', async () => {
    const { service, saved, content } = setup();
    await service.save('bob', 'header', { items: [{ label: 'Mine', contentId: 'b1' }] });
    expect(content.findFactsByIds).toHaveBeenCalledWith('site-b', ['b1']);
    expect(saved[0].siteId).toBe('site-b');
  });

  it('answers a page deleted between the check and the write like any other missing page, not a 500', async () => {
    const { service, menus, revalidation } = setup();
    menus.replaceTree.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );
    await expect(service.save('alice', 'header', { items: [{ label: 'About', contentId: 'p1' }] })).rejects.toBeInstanceOf(BadRequestException);
    expect(revalidation.site).not.toHaveBeenCalled();
  });

  it('lets any other failure through as it is', async () => {
    const { service, menus } = setup();
    menus.replaceTree.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.save('alice', 'header', { items: [] })).rejects.toThrow('connection lost');
  });

  it('is for someone with a site', async () => {
    await expect(setup().service.save('nobody', 'header', { items: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('MenusService.get', () => {
  it('reads the caller’s own site’s menu', async () => {
    const { service, menus } = setup();
    expect(await service.get('alice', 'footer')).toEqual({ location: 'footer', items: [] });
    expect(menus.findTree).toHaveBeenCalledWith('site-a', 'footer');
  });
});
