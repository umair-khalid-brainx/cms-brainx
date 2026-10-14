import { withActive } from '../users/test-support.js';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { ContentTypeRepository } from '../content-types/content-type.repository.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { RedirectEntry, RedirectRepository } from './redirect.repository.js';
import { RedirectsService } from './redirects.service.js';

type Row = RedirectEntry & { id: string; siteId: string };

/** In-memory redirects for two sites, with the real repository's change semantics (plan, then write the difference). */
function setup(pagePaths: Record<string, string[]> = { 'site-a': ['/live-page'] }) {
  let table: Row[] = [];
  let nextId = 1;
  const repo = {
    findAll: vi.fn(async (siteId: string) => table.filter((r) => r.siteId === siteId).map((r) => ({ ...r, createdAt: new Date(), createdBy: null }))),
    findByFrom: vi.fn(async (siteId: string, fromPath: string) => table.find((r) => r.siteId === siteId && r.fromPath === fromPath) ?? null),
    change: vi.fn(async (siteId: string, plan: (current: RedirectEntry[], pagePaths: ReadonlySet<string>) => RedirectEntry[]) => {
      const current = table.filter((r) => r.siteId === siteId);
      // Like the real one: pages as they are now, and never a redirect from a page's address.
      const paths = new Set(pagePaths[siteId] ?? []);
      const next = plan(
        current.map(({ fromPath, toPath, source, createdById }) => ({ fromPath, toPath, source, createdById })),
        paths,
      ).filter((n) => !paths.has(n.fromPath));
      const touched = [
        ...current.filter((r) => !next.some((n) => n.fromPath === r.fromPath)).map((r) => r.fromPath),
        ...next.filter((n) => !current.some((r) => r.fromPath === n.fromPath && r.toPath === n.toPath)).map((n) => n.fromPath),
      ];
      table = [
        ...table.filter((r) => r.siteId !== siteId),
        ...next.map((n) => ({ ...n, siteId, id: current.find((r) => r.fromPath === n.fromPath)?.id ?? `r${nextId++}` })),
      ];
      return { touched };
    }),
    findById: vi.fn(async (siteId: string, id: string) => table.find((r) => r.siteId === siteId && r.id === id) ?? null),
  };
  const types = { prefixes: vi.fn(async (siteId: string) => (siteId === 'site-a' ? ['blog'] : [])) };
  const members: Record<string, string> = { alice: 'site-a', bob: 'site-b' };
  const users = {
    findByIdWithMemberships: vi.fn(async (id: string) => ({
      id,
      memberships: [{ siteId: members[id], site: { subdomain: members[id].replace('site-', '') } }],
    })),
  };
  const revalidation = { page: vi.fn(async () => {}) };
  const service = new RedirectsService(
    repo as unknown as RedirectRepository,
    types as unknown as ContentTypeRepository,
    withActive(users),
    revalidation as unknown as RevalidationService,
  );
  const rows = (siteId = 'site-a') =>
    table
      .filter((r) => r.siteId === siteId)
      .map((r) => `${r.fromPath} → ${r.toPath} (${r.source})`)
      .sort();
  // A page moving in or out, as the content table would show it at the next change.
  const setPages = (siteId: string, paths: string[]) => {
    pagePaths[siteId] = paths;
  };
  return { service, rows, revalidation, setPages, repo };
}

describe('RedirectsService.create (GOV-05)', () => {
  it('normalises both addresses and refreshes the old one on the public site', async () => {
    const { service, rows, revalidation } = setup();
    await service.create('alice', { fromPath: ' /Old-Page/ ', toPath: '/New-Page' });
    expect(rows()).toEqual(['/old-page → /new-page (manual)']);
    expect(revalidation.page).toHaveBeenCalledWith('a', '/old-page');
  });

  it('takes a full https address as the target', async () => {
    const { service, rows } = setup();
    await service.create('alice', { fromPath: '/shop', toPath: 'https://shop.example.com/' });
    expect(rows()).toEqual(['/shop → https://shop.example.com/ (manual)']);
  });

  it('refuses bad addresses, the home page, a page’s address and a type’s listing', async () => {
    const { service, rows } = setup();
    await expect(service.create('alice', { fromPath: 'old', toPath: '/new' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('alice', { fromPath: '/old', toPath: 'javascript:alert(1)' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('alice', { fromPath: '/', toPath: '/new' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('alice', { fromPath: '/live-page', toPath: '/new' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.create('alice', { fromPath: '/blog', toPath: '/new' })).rejects.toBeInstanceOf(ConflictException);
    expect(rows()).toEqual([]);
  });

  it('refuses a second redirect from the same address, and a loop', async () => {
    const { service } = setup();
    await service.create('alice', { fromPath: '/a', toPath: '/b' });
    await expect(service.create('alice', { fromPath: '/a', toPath: '/c' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.create('alice', { fromPath: '/b', toPath: '/a' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('never leaves a chain: A → B then B → C makes A → C', async () => {
    const { service, rows, revalidation } = setup();
    await service.create('alice', { fromPath: '/a', toPath: '/b' });
    await service.create('alice', { fromPath: '/b', toPath: '/c' });
    expect(rows()).toEqual(['/a → /c (manual)', '/b → /c (manual)']);
    expect(revalidation.page).toHaveBeenCalledWith('a', '/a');
  });

  it('keeps each site’s redirects to itself', async () => {
    const { service, rows } = setup();
    await service.create('alice', { fromPath: '/a', toPath: '/b' });
    await service.create('bob', { fromPath: '/a', toPath: '/z' });
    expect(rows('site-a')).toEqual(['/a → /b (manual)']);
    expect(rows('site-b')).toEqual(['/a → /z (manual)']);
    expect(await service.list('bob')).toHaveLength(1);
  });
});

describe('RedirectsService.remove', () => {
  it('removes one of this site’s redirects only', async () => {
    const { service, rows } = setup();
    const made = await service.create('alice', { fromPath: '/a', toPath: '/b' });
    await expect(service.remove('bob', made.id)).rejects.toBeInstanceOf(NotFoundException);
    await service.remove('alice', made.id);
    expect(rows()).toEqual([]);
  });
});

describe('RedirectsService.pagesMoved (automatic redirects)', () => {
  it('redirects each address that was ever public, not one that never was', async () => {
    const { service, rows } = setup();
    await service.pagesMoved(
      'site-a',
      'a',
      [
        { from: '/about', to: '/company', everPublished: true },
        { from: '/about/draft', to: '/company/draft', everPublished: false },
      ],
      'alice',
    );
    expect(rows()).toEqual(['/about → /company (auto)']);
  });

  it('a second move collapses the chain: /a → /b, then /b → /c gives /a → /c', async () => {
    const { service, rows } = setup();
    await service.pagesMoved('site-a', 'a', [{ from: '/a', to: '/b', everPublished: true }], 'alice');
    await service.pagesMoved('site-a', 'a', [{ from: '/b', to: '/c', everPublished: true }], 'alice');
    expect(rows()).toEqual(['/a → /c (auto)', '/b → /c (auto)']);
  });

  it('renaming back to an old address: the page wins, and there is never a loop', async () => {
    const { service, rows, setPages } = setup();
    setPages('site-a', ['/b']);
    await service.pagesMoved('site-a', 'a', [{ from: '/a', to: '/b', everPublished: true }], 'alice');
    setPages('site-a', ['/a']);
    await service.pagesMoved('site-a', 'a', [{ from: '/b', to: '/a', everPublished: true }], 'alice');
    expect(rows()).toEqual(['/b → /a (auto)']);
  });

  it('two quick moves whose redirect updates land in the wrong order still end right', async () => {
    // The page went /a → /b → /a; the second move's update runs first.
    const { service, rows, setPages } = setup();
    setPages('site-a', ['/a']);
    await service.pagesMoved('site-a', 'a', [{ from: '/b', to: '/a', everPublished: true }], 'alice');
    await service.pagesMoved('site-a', 'a', [{ from: '/a', to: '/b', everPublished: true }], 'alice');
    expect(rows()).toEqual(['/b → /a (auto)']);
  });

  it('a page moving onto an address with a manual redirect takes it over', async () => {
    const { service, rows, setPages } = setup();
    await service.create('alice', { fromPath: '/promo', toPath: '/sale' });
    setPages('site-a', ['/promo']);
    await service.pagesMoved('site-a', 'a', [{ from: '/draft', to: '/promo', everPublished: false }], 'alice');
    expect(rows()).toEqual([]);
  });
});

describe('RedirectsService.pathTaken', () => {
  it('a new page at an address removes the redirect from it', async () => {
    const { service, rows, revalidation, setPages } = setup();
    await service.create('alice', { fromPath: '/promo', toPath: '/sale' });
    revalidation.page.mockClear();
    setPages('site-a', ['/promo']);
    await service.pathTaken('site-a', 'a', '/promo');
    expect(rows()).toEqual([]);
    expect(revalidation.page).toHaveBeenCalledWith('a', '/promo');
  });

  it('does nothing, not even a locked read of the site, when no redirect starts at the address', async () => {
    const { service, repo, revalidation } = setup();
    await service.pathTaken('site-a', 'a', '/brand-new');
    expect(repo.change).not.toHaveBeenCalled();
    expect(revalidation.page).not.toHaveBeenCalled();
  });
});

describe('RedirectsService.create when a page takes the address first', () => {
  it('answers 409, not an empty 201', async () => {
    const { service, repo } = setup();
    // The page appears right after the redirect is written and removes it before it is read back.
    repo.findByFrom.mockResolvedValueOnce(null);
    await expect(service.create('alice', { fromPath: '/race', toPath: '/x' })).rejects.toBeInstanceOf(ConflictException);
  });
});

