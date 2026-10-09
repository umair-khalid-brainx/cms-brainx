import { NotFoundException } from '@nestjs/common';
import type { ContentRepository } from '../content/content.repository.js';
import type { PreviewLinkRepository } from '../content/preview-link.repository.js';
import type { SiteRepository } from '../sites/site.repository.js';
import type { SubdomainCache } from '../sites/subdomain-cache.js';
import { PublicService } from './public.service.js';

const TOKEN_A = 'a'.repeat(43);
const TOKEN_B = 'b'.repeat(43);

/** Two sites, each with one preview link; lookups are honestly scoped by siteId. */
function setup() {
  const pages: Record<
    string,
    {
      siteId: string;
      title: string;
      path: string;
      status: string;
      blocks: unknown[];
      updatedAt: Date;
    }
  > = {
    [TOKEN_A]: {
      siteId: 'site-a',
      title: 'Draft A',
      path: '/a',
      status: 'draft',
      blocks: [],
      updatedAt: new Date(),
    },
    [TOKEN_B]: {
      siteId: 'site-b',
      title: 'Old B',
      path: '/b',
      status: 'archived',
      blocks: [],
      updatedAt: new Date(),
    },
  };
  const previewLinks = {
    findPageByToken: vi.fn(async (siteId: string, token: string) =>
      pages[token]?.siteId === siteId ? pages[token] : null,
    ),
  };
  const subdomainCache = {
    resolve: vi.fn(
      async (subdomain: string) =>
        ({ alpha: 'site-a', beta: 'site-b' })[subdomain] ?? null,
    ),
  };
  const service = new PublicService(
    {} as SiteRepository,
    {} as ContentRepository,
    previewLinks as unknown as PreviewLinkRepository,
    subdomainCache as unknown as SubdomainCache,
  );
  return { service, previewLinks };
}

describe('PublicService.getPreview', () => {
  it("shows a draft through its site's token, with its status", async () => {
    const { service } = setup();

    await expect(service.getPreview('alpha', TOKEN_A)).resolves.toMatchObject({
      title: 'Draft A',
      status: 'draft',
    });
  });

  it("won't open site A's token on site B's host", async () => {
    const { service, previewLinks } = setup();

    await expect(service.getPreview('beta', TOKEN_A)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(previewLinks.findPageByToken).toHaveBeenCalledWith(
      'site-b',
      TOKEN_A,
    );
  });

  it('hides an archived page even with a valid token', async () => {
    const { service } = setup();

    await expect(service.getPreview('beta', TOKEN_B)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses a malformed token without a database lookup', async () => {
    const { service, previewLinks } = setup();

    await expect(service.getPreview('alpha', 'short')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.getPreview('alpha', `${'a'.repeat(42)}!`),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(previewLinks.findPageByToken).not.toHaveBeenCalled();
  });

  it('is a 404 on an unknown site', async () => {
    const { service } = setup();

    await expect(service.getPreview('nobody', TOKEN_A)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
