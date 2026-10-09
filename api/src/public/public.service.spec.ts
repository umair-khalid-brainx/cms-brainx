import { NotFoundException } from '@nestjs/common';
import type { ContentRepository } from '../content/content.repository.js';
import type { PreviewLinkRepository } from '../content/preview-link.repository.js';
import type { SiteRepository } from '../sites/site.repository.js';
import type { SubdomainCache } from '../sites/subdomain-cache.js';
import type { MediaRepository } from '../media/media.repository.js';
import type { SubmissionRepository } from '../submissions/submission.repository.js';
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
    {} as SubmissionRepository,
    {} as MediaRepository,
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

describe('PublicService.getPage image alt text (MED-04, D-047)', () => {
  const SITE = 'site-a';
  const SRC = `http://localhost:4001/uploads/${SITE}/aaa-111.png`;

  function setupPage(blocks: unknown[]) {
    const content = { findLiveByPath: vi.fn(async () => ({ title: 'Home', path: '/', blocks, updatedAt: new Date() })) };
    const media = {
      findAltsByFilenames: vi.fn(async (siteId: string, names: string[]) =>
        siteId === SITE ? names.filter((n) => n === 'aaa-111.png').map((filename) => ({ filename, alt: 'Library alt' })) : [],
      ),
    };
    const subdomainCache = { resolve: vi.fn(async () => SITE) };
    const service = new PublicService(
      {} as SiteRepository,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      subdomainCache as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
    );
    return { service, media };
  }

  it('fills an empty alt from the library, for this site only', async () => {
    const { service, media } = setupPage([{ type: 'hero', image: { src: SRC, alt: '' } }]);

    const page = await service.getPage('alpha', '/');

    expect(page.blocks).toEqual([{ type: 'hero', image: { src: SRC, alt: 'Library alt' } }]);
    expect(media.findAltsByFilenames).toHaveBeenCalledWith(SITE, ['aaa-111.png']);
  });

  it('keeps alt text typed on the page, and does not even look it up', async () => {
    const blocks = [{ type: 'hero', image: { src: SRC, alt: 'Mine' } }];
    const { service, media } = setupPage(blocks);

    expect((await service.getPage('alpha', '/')).blocks).toEqual(blocks);
    expect(media.findAltsByFilenames).not.toHaveBeenCalled();
  });

  it('does the same for a page opened through a preview link', async () => {
    const TOKEN = 'a'.repeat(43);
    const blocks = [{ type: 'hero', image: { src: SRC, alt: '' } }];
    const previewLinks = {
      findPageByToken: vi.fn(async () => ({ title: 'D', path: '/d', status: 'draft', blocks, updatedAt: new Date() })),
    };
    const media = { findAltsByFilenames: vi.fn(async () => [{ filename: 'aaa-111.png', alt: 'Library alt' }]) };
    const service = new PublicService(
      {} as SiteRepository,
      {} as ContentRepository,
      previewLinks as unknown as PreviewLinkRepository,
      { resolve: vi.fn(async () => SITE) } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
    );

    const page = await service.getPreview('alpha', TOKEN);

    expect(page.blocks).toEqual([{ type: 'hero', image: { src: SRC, alt: 'Library alt' } }]);
  });

  it('makes no lookup for a page with no images', async () => {
    const { service, media } = setupPage([{ type: 'richText', html: '<p>x</p>' }]);

    await service.getPage('alpha', '/');

    expect(media.findAltsByFilenames).not.toHaveBeenCalled();
  });
});
