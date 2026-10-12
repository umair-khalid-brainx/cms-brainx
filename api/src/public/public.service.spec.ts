import { NotFoundException } from '@nestjs/common';
import type { ContentRepository } from '../content/content.repository.js';
import type { PreviewLinkRepository } from '../content/preview-link.repository.js';
import type { SiteRepository } from '../sites/site.repository.js';
import type { SubdomainCache } from '../sites/subdomain-cache.js';
import type { ConfigService } from '@nestjs/config';
import type { ContentTypeRepository } from '../content-types/content-type.repository.js';
import type { MediaRepository } from '../media/media.repository.js';
import type { SubmissionRepository } from '../submissions/submission.repository.js';
import type { RedirectRepository } from '../redirects/redirect.repository.js';
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
    sites,
    {} as ContentRepository,
    previewLinks as unknown as PreviewLinkRepository,
    subdomainCache as unknown as SubdomainCache,
    {} as SubmissionRepository,
    {} as MediaRepository,
    {} as ContentTypeRepository,
    { get: () => undefined } as unknown as ConfigService,
    {} as RedirectRepository,
  );
  return { service, previewLinks };
}

// getPage reads the site's name for the page's title (SEO-01).
const sites = { findById: vi.fn(async () => ({ name: 'Alpha' })) } as unknown as SiteRepository;

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
      sites,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      subdomainCache as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
      {} as ContentTypeRepository,
      { get: () => undefined } as unknown as ConfigService,
      {} as RedirectRepository,
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
      sites,
      {} as ContentRepository,
      previewLinks as unknown as PreviewLinkRepository,
      { resolve: vi.fn(async () => SITE) } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
      {} as ContentTypeRepository,
      { get: () => undefined } as unknown as ConfigService,
      {} as RedirectRepository,
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

describe('PublicService entries and listings (TYP-03)', () => {
  const TYPE = {
    id: 'type-events',
    siteId: 'site-a',
    name: 'Events',
    singularName: 'Event',
    prefix: 'events',
    fields: [
      { key: 'summary', label: 'Summary', kind: 'text', required: false },
      { key: 'photo', label: 'Photo', kind: 'media', required: false },
    ],
  };
  const ROWS = [
    { title: 'Newest', path: '/events/newest', publishedAt: new Date('2026-10-02T00:00:00Z'), data: { summary: 'S1', photo: '/uploads/site-a/p-1.png' } },
    { title: 'Older', path: '/events/older', publishedAt: new Date('2026-10-01T00:00:00Z'), data: {} },
  ];

  function setup() {
    const content = {
      findPublishedByType: vi.fn(async (siteId: string, typeId: string) => (siteId === 'site-a' && typeId === 'type-events' ? ROWS : [])),
      findLiveByPath: vi.fn(async () => ({
        title: 'Newest', path: '/events/newest', blocks: [], updatedAt: new Date(), data: ROWS[0].data, publishedAt: ROWS[0].publishedAt,
        author: { name: 'Ada' }, type: TYPE,
      })),
    };
    const types = {
      findByPrefix: vi.fn(async (siteId: string, prefix: string) => (siteId === 'site-a' && prefix === 'events' ? TYPE : null)),
    };
    const media = {
      findByFilenames: vi.fn(async () => [{ filename: 'p-1.png', mimetype: 'image/png', alt: 'Harbour', title: null }]),
      findAltsByFilenames: vi.fn(async () => []),
    };
    const service = new PublicService(
      sites,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      { resolve: vi.fn(async (sub: string) => ({ alpha: 'site-a', beta: 'site-b' })[sub] ?? null) } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
      types as unknown as ContentTypeRepository,
      { get: (key: string) => (key === 'API_PUBLIC_URL' ? 'http://api.test/' : undefined) } as unknown as ConfigService,
      {} as RedirectRepository,
    );
    return { service, content, media };
  }

  it('lists a type’s published entries with summary and picture, asking for them newest first', async () => {
    const { service, content } = setup();

    const listing = await service.getListing('alpha', 'events');

    expect(listing.type).toEqual({ name: 'Events', singularName: 'Event', prefix: 'events' });
    expect(listing.entries.map((e) => e.title)).toEqual(['Newest', 'Older']);
    expect(listing.entries[0]).toMatchObject({ summary: 'S1', image: { url: 'http://api.test/uploads/site-a/p-1.png', alt: 'Harbour' } });
    expect(content.findPublishedByType).toHaveBeenCalledWith('site-a', 'type-events', 50);
  });

  it('answers 404 for an unknown address, another site’s address and an unknown site', async () => {
    const { service } = setup();

    await expect(service.getListing('alpha', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getListing('beta', 'events')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getListing('nobody', 'events')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds the entry’s header details to a page that is an entry: author name only, type, fields', async () => {
    const { service } = setup();

    const page = await service.getPage('alpha', '/events/newest');

    expect(page.entry).toMatchObject({
      type: { prefix: 'events' },
      author: 'Ada',
      publishedAt: ROWS[0].publishedAt,
    });
    expect(page.entry?.fields.map((f) => f.key)).toEqual(['summary', 'photo']);
    expect(JSON.stringify(page)).not.toContain('@');
  });

  it('leaves an ordinary page without an entry', async () => {
    const { service, content } = setup();
    content.findLiveByPath.mockResolvedValueOnce({ title: 'About', path: '/about', blocks: [], updatedAt: new Date(), data: {}, publishedAt: null, author: null, type: null } as never);

    expect((await service.getPage('alpha', '/about')).entry).toBeUndefined();
  });

  it('leaks nothing but what a visitor sees: no email, ids, status or site id in the serialised page', async () => {
    const { service } = setup();

    const json = JSON.stringify(await service.getPage('alpha', '/events/newest'));

    for (const forbidden of ['email', '@', 'siteId', 'authorId', 'isBuiltIn', 'status', 'password']) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('is exact about a listing’s address and answers 404 to a NUL character instead of a database error', async () => {
    const { service } = setup();

    await expect(service.getListing('alpha', 'Events')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getListing('alpha', 'events\u0000')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getPage('alpha', '/x\u0000')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PublicService.getRedirect (GOV-05)', () => {
  const redirects = {
    findByFrom: vi.fn(async (siteId: string, fromPath: string) =>
      siteId === 'site-a' && fromPath === '/old' ? { toPath: '/new' } : null,
    ),
  };
  const service = new PublicService(
    {} as SiteRepository,
    {} as ContentRepository,
    {} as PreviewLinkRepository,
    { resolve: vi.fn(async (sub: string) => ({ alpha: 'site-a', beta: 'site-b' })[sub] ?? null) } as unknown as SubdomainCache,
    {} as SubmissionRepository,
    {} as MediaRepository,
    {} as ContentTypeRepository,
    { get: () => undefined } as unknown as ConfigService,
    redirects as unknown as RedirectRepository,
  );

  it('answers where an old address goes, normalising the path it is asked about', async () => {
    expect(await service.getRedirect('alpha', '/Old/')).toEqual({ to: '/new' });
  });

  it('is a 404 on another site, for an unknown address, or a path that isn’t one', async () => {
    await expect(service.getRedirect('beta', '/old')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getRedirect('alpha', '/nowhere')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getRedirect('alpha', 'old?x=1')).rejects.toBeInstanceOf(NotFoundException);
  });
});


describe('PublicService.getPage SEO (SEO-01)', () => {
  const live = (seo: unknown) => ({
    id: 'p1',
    siteId: 'site-a',
    title: 'About us',
    path: '/about',
    status: 'published',
    blocks: [],
    data: {},
    seo,
    updatedAt: new Date('2026-10-12'),
    publishedAt: null,
    author: null,
    type: null,
  });

  function setup(seo: unknown, library: { filename: string; mimetype: string; alt: string | null }[] = []) {
    const content = { findLiveByPath: vi.fn(async (siteId: string) => (siteId === 'site-a' ? live(seo) : null)) };
    const media = {
      findByFilenames: vi.fn(async (siteId: string, names: string[]) =>
        siteId === 'site-a' ? library.filter((file) => names.includes(file.filename)).map((file) => ({ ...file, title: null })) : [],
      ),
      findImage: vi.fn(async (siteId: string, path: string) => {
        const file = siteId === 'site-a' ? library.find((candidate) => candidate.filename === path.slice(path.lastIndexOf('/') + 1)) : undefined;
        return file && file.mimetype.startsWith('image/') ? { filename: file.filename, alt: file.alt } : null;
      }),
      findAltsByFilenames: vi.fn(async () => []),
    };
    return new PublicService(
      sites,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      { resolve: vi.fn(async (sub: string) => ({ alpha: 'site-a', beta: 'site-b' })[sub] ?? null) } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
      {} as ContentTypeRepository,
      { get: (key: string) => (key === 'API_PUBLIC_URL' ? 'http://api.test/' : undefined) } as unknown as ConfigService,
      {} as RedirectRepository,
    );
  }

  it('returns the title with the site’s name, and nothing else, for a page with no settings', async () => {
    expect((await setup({}).getPage('alpha', '/about')).seo).toMatchObject({ title: 'About us · Alpha', description: null, noindex: false });
  });

  it('returns what staff entered, noindex included', async () => {
    const seo = (await setup({ metaTitle: 'About the farm', metaDescription: 'Who we are', noindex: true }).getPage('alpha', '/about')).seo;
    expect(seo).toMatchObject({ title: 'About the farm', description: 'Who we are', noindex: true });
  });

  it('turns the chosen social image into an absolute address, with the library’s alt text', async () => {
    const service = setup({ ogImage: '/uploads/sitea/a1.png' }, [{ filename: 'a1.png', mimetype: 'image/png', alt: 'A farm' }]);
    expect((await service.getPage('alpha', '/about')).seo.social.image).toEqual({ url: 'http://api.test/uploads/sitea/a1.png', alt: 'A farm' });
  });

  it('drops a social image that was deleted from the library, or isn’t a picture', async () => {
    expect((await setup({ ogImage: '/uploads/sitea/gone.png' }).getPage('alpha', '/about')).seo.social.image).toBeNull();
    const pdf = setup({ ogImage: '/uploads/sitea/doc.pdf' }, [{ filename: 'doc.pdf', mimetype: 'application/pdf', alt: null }]);
    expect((await pdf.getPage('alpha', '/about')).seo.social.image).toBeNull();
  });
});

describe('PublicService.getSitemap (SEO-02)', () => {
  const row = (path: string, extra: Record<string, unknown> = {}) => ({
    path,
    typeId: null,
    seo: {},
    updatedAt: new Date('2026-10-12T08:00:00.000Z'),
    ...extra,
  });

  function setup() {
    const content = {
      findSitemapRows: vi.fn(async (siteId: string) =>
        siteId === 'site-a' ? [row('/'), row('/hidden', { seo: { noindex: true } }), row('/blog/a', { typeId: 't' })] : [row('/other')],
      ),
    };
    const service = new PublicService(
      sites,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      { resolve: vi.fn(async (sub: string) => ({ alpha: 'site-a', beta: 'site-b' })[sub] ?? null) } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      {} as MediaRepository,
      {} as ContentTypeRepository,
      { get: () => undefined } as unknown as ConfigService,
      {} as RedirectRepository,
    );
    return { service, content };
  }

  it('lists only this site’s indexable addresses, with a listing for the type', async () => {
    const { service, content } = setup();
    const { entries } = await service.getSitemap('alpha');
    expect(entries.map((e) => e.path)).toEqual(['/', '/blog', '/blog/a']);
    expect(content.findSitemapRows).toHaveBeenCalledWith('site-a');
  });

  it('never mixes two sites, and an unknown site is a 404', async () => {
    const { service } = setup();
    expect((await service.getSitemap('beta')).entries.map((e) => e.path)).toEqual(['/other']);
    await expect(service.getSitemap('nobody')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PublicService.getSitemap past the limit (SEO-02)', () => {
  it('stops at the limit and leaves the extra row out', async () => {
    const rows = Array.from({ length: 50_001 }, (_, i) => ({
      path: `/p${String(i).padStart(5, '0')}`,
      typeId: null,
      seo: {},
      updatedAt: new Date('2026-10-12T08:00:00.000Z'),
    }));
    const service = new PublicService(
      sites,
      { findSitemapRows: vi.fn(async () => rows) } as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      { resolve: vi.fn(async () => 'site-a') } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      {} as MediaRepository,
      {} as ContentTypeRepository,
      { get: () => undefined } as unknown as ConfigService,
      {} as RedirectRepository,
    );
    const { entries } = await service.getSitemap('alpha');
    expect(entries).toHaveLength(50_000);
    expect(entries.at(-1)?.path).toBe('/p49999');
  });
});

describe('PublicService.getSite branding (GOV-04)', () => {
  const site = (settings: unknown) => ({ id: 'site-a', name: 'Corrick', subdomain: 'alpha', themeJson: {}, settings });

  function setup(settings: unknown, library: { filename: string; mimetype: string; alt: string | null }[] = []) {
    const sites = { findById: vi.fn(async () => site(settings)) };
    const content = { findLiveByPath: vi.fn(async () => null) };
    const media = {
      findByFilenames: vi.fn(async (siteId: string, names: string[]) =>
        siteId === 'site-a' ? library.filter((file) => names.includes(file.filename)).map((file) => ({ ...file, title: null })) : [],
      ),
      findImage: vi.fn(async (siteId: string, path: string) => {
        const file = siteId === 'site-a' ? library.find((candidate) => candidate.filename === path.slice(path.lastIndexOf('/') + 1)) : undefined;
        return file && file.mimetype.startsWith('image/') ? { filename: file.filename, alt: file.alt } : null;
      }),
      findAltsByFilenames: vi.fn(async () => []),
    };
    return new PublicService(
      sites as unknown as SiteRepository,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      { resolve: vi.fn(async () => 'site-a') } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
      {} as ContentTypeRepository,
      { get: (key: string) => (key === 'API_PUBLIC_URL' ? 'http://api.test/' : undefined) } as unknown as ConfigService,
      {} as RedirectRepository,
    );
  }

  it('returns the tagline, the footer note and the logo as a full address', async () => {
    const service = setup({ tagline: 'River oysters', footerNote: 'Since 1980', logo: '/uploads/sitea/l1.png' }, [
      { filename: 'l1.png', mimetype: 'image/png', alt: null },
    ]);
    expect(await service.getSite('alpha')).toMatchObject({
      name: 'Corrick',
      tagline: 'River oysters',
      footerNote: 'Since 1980',
      logo: { url: 'http://api.test/uploads/sitea/l1.png' },
    });
  });

  it('ignores a logo path that was edited by hand into something that is not this site’s library file', async () => {
    for (const logo of ['javascript:alert(1)', 'https://evil.com/a.png', '/uploads/othersite/l1.png', '/uploads/sitea/../x.png']) {
      const service = setup({ logo }, [{ filename: 'l1.png', mimetype: 'image/png', alt: null }]);
      expect((await service.getSite('alpha')).logo).toBeNull();
    }
  });

  it('returns empty values and no logo for a site that never set them, or whose logo left the library', async () => {
    expect(await setup({}).getSite('alpha')).toMatchObject({ tagline: '', footerNote: '', logo: null });
    expect((await setup({ logo: '/uploads/sitea/gone.png' }).getSite('alpha')).logo).toBeNull();
  });

  it('never exposes the stored settings object itself', async () => {
    const json = JSON.stringify(await setup({ tagline: 'T', logo: '' }).getSite('alpha'));
    expect(json).not.toContain('settings');
    expect(json).not.toContain('siteId');
  });
});


describe('PublicService.getPage looks the logo up only when it would be the picture (GOV-04)', () => {
  function setup(seo: unknown) {
    const withLogo = { findById: vi.fn(async () => ({ id: 'site-a', name: 'Alpha', settings: { logo: '/uploads/sitea/logo.png' } })) };
    const content = {
      findLiveByPath: vi.fn(async () => ({
        id: 'p1',
        siteId: 'site-a',
        title: 'About',
        path: '/about',
        status: 'published',
        blocks: [],
        data: {},
        seo,
        updatedAt: new Date('2026-10-12'),
        publishedAt: null,
        author: null,
        type: null,
      })),
    };
    const files = [
      { filename: 'logo.png', mimetype: 'image/png', alt: null },
      { filename: 'chosen.png', mimetype: 'image/png', alt: null },
    ];
    const media = {
      findImage: vi.fn(async (_siteId: string, path: string) => {
        const file = files.find((candidate) => candidate.filename === path.slice(path.lastIndexOf('/') + 1));
        return file ? { filename: file.filename, alt: file.alt } : null;
      }),
      findAltsByFilenames: vi.fn(async () => []),
    };
    const service = new PublicService(
      withLogo as unknown as SiteRepository,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      { resolve: vi.fn(async () => 'site-a') } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
      {} as ContentTypeRepository,
      { get: () => undefined } as unknown as ConfigService,
      {} as RedirectRepository,
    );
    return { service, media };
  }

  it('a page with a social image of its own never looks the logo up', async () => {
    const { service, media } = setup({ ogImage: '/uploads/sitea/chosen.png' });
    expect((await service.getPage('alpha', '/about')).seo.social.image?.url).toContain('chosen.png');
    expect(media.findImage).toHaveBeenCalledTimes(1);
  });

  it('a page with nothing of its own looks it up and uses it', async () => {
    const { service, media } = setup({});
    expect((await service.getPage('alpha', '/about')).seo.social.image?.url).toContain('logo.png');
    expect(media.findImage).toHaveBeenCalledTimes(1);
  });
});
