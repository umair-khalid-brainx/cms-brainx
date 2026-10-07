import type { ConfigService } from '@nestjs/config';
import { RevalidationService } from './revalidation.service.js';

function service(env: Record<string, string | undefined>) {
  return new RevalidationService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

const configured = {
  WEB_REVALIDATE_URL: 'http://web.test/__revalidate',
  REVALIDATE_SECRET: 's3cret',
};

describe('RevalidationService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs the site and path with the shared secret', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await service(configured).page('corrick', '/about');

    expect(fetch).toHaveBeenCalledWith(
      'http://web.test/__revalidate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-revalidate-secret': 's3cret' }),
        body: JSON.stringify({ subdomain: 'corrick', path: '/about' }),
      }),
    );
  });

  it('never throws when web is down or refuses — the publish still stands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
    );
    await expect(
      service(configured).page('corrick', '/'),
    ).resolves.toBeUndefined();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 403 })),
    );
    await expect(
      service(configured).page('corrick', '/'),
    ).resolves.toBeUndefined();
  });

  it('does nothing when not configured', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await service({}).page('corrick', '/');

    expect(fetch).not.toHaveBeenCalled();
  });
});
