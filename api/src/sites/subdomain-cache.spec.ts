import type { ConfigService } from '@nestjs/config';
import type { MediaRepository } from '../media/media.repository.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { SiteRepository } from './site.repository.js';
import { SitesService } from './sites.service.js';
import { SubdomainCache } from './subdomain-cache.js';

/** An in-memory stand-in for the `sites` table that counts lookups. */
function fakeSites(initial: Record<string, string>) {
  const bySubdomain = new Map(Object.entries(initial));
  const repo = {
    findBySubdomain: vi.fn(async (subdomain: string) => {
      const id = bySubdomain.get(subdomain);
      return id ? { id, name: 'Site', subdomain } : null;
    }),
    findById: vi.fn(async (id: string) => {
      const entry = [...bySubdomain].find(([, siteId]) => siteId === id);
      return entry ? { id, name: 'Site', subdomain: entry[0] } : null;
    }),
    updateSubdomain: vi.fn(async (id: string, subdomain: string) => {
      for (const [name, siteId] of bySubdomain) if (siteId === id) bySubdomain.delete(name);
      bySubdomain.set(subdomain, id);
      return { id, name: 'Site', subdomain };
    }),
  };
  return { repo, bySubdomain, asRepository: repo as unknown as SiteRepository };
}

describe('SubdomainCache', () => {
  afterEach(() => vi.useRealTimers());

  it('looks a subdomain up once, then answers from memory', async () => {
    const { repo, asRepository } = fakeSites({ corrick: 'site-1' });
    const cache = new SubdomainCache(asRepository);

    expect(await cache.resolve('corrick')).toBe('site-1');
    expect(await cache.resolve('corrick')).toBe('site-1');
    expect(await cache.resolve('CORRICK')).toBe('site-1');
    expect(repo.findBySubdomain).toHaveBeenCalledTimes(1);
  });

  it('does not cache an unknown subdomain', async () => {
    const { repo, bySubdomain, asRepository } = fakeSites({});
    const cache = new SubdomainCache(asRepository);

    expect(await cache.resolve('newco')).toBeNull();
    expect(await cache.resolve('newco')).toBeNull();
    expect(repo.findBySubdomain).toHaveBeenCalledTimes(2);

    // Claimed later: resolves straight away, no stale miss in the way.
    bySubdomain.set('newco', 'site-2');
    expect(await cache.resolve('newco')).toBe('site-2');
  });

  it('looks up again once an entry is older than the TTL', async () => {
    vi.useFakeTimers();
    const { repo, asRepository } = fakeSites({ corrick: 'site-1' });
    const cache = new SubdomainCache(asRepository);

    await cache.resolve('corrick');
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await cache.resolve('corrick');
    expect(repo.findBySubdomain).toHaveBeenCalledTimes(2);
  });

  it('does not put back a mapping whose lookup was in flight during an invalidate', async () => {
    const { repo, asRepository } = fakeSites({ corrick: 'site-1' });
    const cache = new SubdomainCache(asRepository);

    const inFlight = cache.resolve('corrick');
    cache.invalidate('corrick'); // a rename lands before the lookup returns
    expect(await inFlight).toBe('site-1');

    await cache.resolve('corrick');
    expect(repo.findBySubdomain).toHaveBeenCalledTimes(2);
  });
});

describe('SitesService.updateSubdomain', () => {
  it('stops the old subdomain resolving immediately and the new one starts', async () => {
    const { asRepository } = fakeSites({ corrick: 'site-1' });
    const cache = new SubdomainCache(asRepository);
    const service = new SitesService(asRepository, cache, {} as MediaRepository, {} as RevalidationService, {} as ConfigService, {} as never);

    expect(await cache.resolve('corrick')).toBe('site-1'); // now cached
    expect(await cache.resolve('corrick-farm')).toBeNull();

    await service.updateSubdomain('site-1', 'corrick-farm');

    expect(await cache.resolve('corrick')).toBeNull();
    expect(await cache.resolve('corrick-farm')).toBe('site-1');
  });
});
