import { withActive } from '../users/test-support.js';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { MediaRepository } from '../media/media.repository.js';
import type { MenuRepository } from '../menus/menu.repository.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { SiteRepository } from '../sites/site.repository.js';
import type { ChromeRepository } from './chrome.repository.js';
import { ChromeService } from './chrome.service.js';

function setup(over: { count?: number; createError?: unknown } = {}) {
  const row = { id: 'p1', location: 'footer', name: 'Slim', tagline: '', logo: '', note: 'Own note', bottomText: '' };
  const presets = {
    count: vi.fn(async () => over.count ?? 0),
    create: vi.fn(async (_site: string, data: object) => {
      if (over.createError) throw over.createError;
      return { ...row, ...data };
    }),
    find: vi.fn(async () => row),
    remove: vi.fn(async () => true),
    usage: vi.fn(async () => new Map()),
  };
  const menus = {
    findTree: vi.fn(async () => [{ label: 'The farm', contentId: 'c1', url: null, page: null, children: [] }]),
    replaceTree: vi.fn(async () => {}),
  };
  const sites = { findById: vi.fn(async () => ({ settings: { tagline: 'Tag', footerNote: 'Own note' } })) };
  const users = { findByIdWithMemberships: vi.fn(async () => ({ memberships: [{ siteId: 'site-a', site: { subdomain: 'alpha' } }] })) };
  const service = new ChromeService(
    presets as unknown as ChromeRepository,
    menus as unknown as MenuRepository,
    {} as MediaRepository,
    withActive(users),
    sites as unknown as SiteRepository,
    { site: vi.fn(async () => {}) } as unknown as RevalidationService,
  );
  return { service, presets, menus };
}

describe('ChromeService.create', () => {
  it('starts a footer as a copy of the site’s own note and links', async () => {
    const { service, presets, menus } = setup();
    await service.create('alice', { location: 'footer', name: 'Slim' });
    expect(presets.create).toHaveBeenCalledWith('site-a', { location: 'footer', name: 'Slim', note: 'Own note' });
    expect(menus.replaceTree).toHaveBeenCalledWith('site-a', 'footer', { items: [{ label: 'The farm', contentId: 'c1', children: [] }] }, 'p1');
  });

  it('refuses past the cap, and a name already used', async () => {
    await expect(setup({ count: 30 }).service.create('alice', { location: 'header', name: 'X' })).rejects.toBeInstanceOf(BadRequestException);
    const dup = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    await expect(setup({ createError: dup }).service.create('alice', { location: 'header', name: 'X' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('leaves nothing behind when copying the links fails', async () => {
    const { service, presets, menus } = setup();
    menus.replaceTree.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' }));
    await expect(service.create('alice', { location: 'footer', name: 'Slim' })).rejects.toBeInstanceOf(ConflictException);
    expect(presets.remove).toHaveBeenCalledWith('site-a', 'p1');
  });
});
