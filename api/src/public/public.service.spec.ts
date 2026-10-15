import { NotFoundException } from '@nestjs/common';
import type { ChromeRepository } from '../chrome/chrome.repository.js';
import type { ContentRepository } from '../content/content.repository.js';
import type { PreviewLinkRepository } from '../content/preview-link.repository.js';
import type { SiteRepository } from '../sites/site.repository.js';
import type { SubdomainCache } from '../sites/subdomain-cache.js';
import type { ConfigService } from '@nestjs/config';
import type { ContentTypeRepository } from '../content-types/content-type.repository.js';
import type { MediaRepository } from '../media/media.repository.js';
import type { SubmissionRepository } from '../submissions/submission.repository.js';
import type { MenuRepository } from '../menus/menu.repository.js';
import type { TermRepository } from '../taxonomy/term.repository.js';
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
    NO_MENUS,
    {} as TermRepository,
    NO_PRESETS,
  );
  return { service, previewLinks };
}

// getPage reads the site's name for the page's title (SEO-01).
// A site with no menus and no saved headers or footers: what a page's chrome resolves against when a test doesn't care.
const NO_MENUS = { findForPublic: async () => ({ header: [], footer: [] }), findForPresets: async () => new Map() } as unknown as MenuRepository;
const NO_PRESETS = { list: async () => [] } as unknown as ChromeRepository;
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
      NO_MENUS,
      {} as TermRepository,
      NO_PRESETS,
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
      NO_MENUS,
      {} as TermRepository,
      NO_PRESETS,
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
      NO_MENUS,
      {} as TermRepository,
      NO_PRESETS,
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
    NO_MENUS,
    {} as TermRepository,
    NO_PRESETS,
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
      NO_MENUS,
      {} as TermRepository,
      NO_PRESETS,
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
      NO_MENUS,
      {} as TermRepository,
      NO_PRESETS,
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
      NO_MENUS,
      {} as TermRepository,
      NO_PRESETS,
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
      NO_MENUS,
      {} as TermRepository,
      NO_PRESETS,
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
      NO_MENUS,
      {} as TermRepository,
      NO_PRESETS,
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

describe('PublicService.getMenus (GOV-03)', () => {
  const stored = {
    header: [
      { label: 'About', contentId: 'live', url: null, children: [{ label: 'Team', contentId: 'draft', url: null }, { label: 'Map', contentId: null, url: '/find-us' }] },
      { label: 'Hidden', contentId: 'draft', url: null, children: [] },
    ],
    footer: [{ label: 'Shop', contentId: null, url: 'https://shop.example.com', children: [] }],
  };

  function setup() {
    const menus = { findForPublic: vi.fn(async (siteId: string) => (siteId === 'site-a' ? stored : { header: [], footer: [] })) };
    const content = {
      findFactsByIds: vi.fn(async (siteId: string, ids: readonly string[]) =>
        siteId === 'site-a'
          ? [{ id: 'live', path: '/company', status: 'published' }, { id: 'draft', path: '/draft', status: 'draft' }].filter((page) => ids.includes(page.id))
          : [],
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
      menus as unknown as MenuRepository,
      {} as TermRepository,
      NO_PRESETS,
    );
    return { service, menus, content };
  }

  it('shows page items at the page’s current address and leaves out pages that aren’t published', async () => {
    const { service, content } = setup();
    expect(await service.getMenus('alpha')).toEqual({
      header: [{ label: 'About', href: '/company', children: [{ label: 'Map', href: '/find-us' }] }],
      footer: [{ label: 'Shop', href: 'https://shop.example.com', children: [] }],
    });
    expect(content.findFactsByIds).toHaveBeenCalledWith('site-a', expect.arrayContaining(['live', 'draft']));
  });

  it('never mixes two sites, and an unknown site is a 404', async () => {
    const { service } = setup();
    expect(await service.getMenus('beta')).toEqual({ header: [], footer: [] });
    await expect(service.getMenus('nobody')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('asks for no pages at all when no item is a page', async () => {
    const { service, content, menus } = setup();
    menus.findForPublic.mockResolvedValueOnce({ header: [], footer: stored.footer });
    await service.getMenus('alpha');
    expect(content.findFactsByIds).not.toHaveBeenCalled();
  });
});


describe('PublicService term archives and related entries (TAX-02)', () => {
  const POSTS = {
    id: 'type-posts',
    siteId: 'site-a',
    name: 'Posts',
    singularName: 'Post',
    prefix: 'blog',
    hasCategories: true,
    hasTags: true,
    fields: [{ key: 'excerpt', label: 'Excerpt', kind: 'text', required: false }],
  };
  type Row = { id: string; siteId: string; title: string; path: string; status: string; typeId: string; publishedAt: Date; data: unknown; terms: string[]; type: typeof POSTS };
  const day = (n: number) => new Date(Date.UTC(2026, 9, n));
  const post = (id: string, n: number, terms: string[], extra: Partial<Row> = {}): Row => ({
    id, siteId: 'site-a', title: id.toUpperCase(), path: `/blog/${id}`, status: 'published', typeId: 'type-posts', publishedAt: day(n), data: { excerpt: `About ${id}` }, terms, type: POSTS, ...extra,
  });
  const TERMS = [
    { id: 'cat-news', siteId: 'site-a', kind: 'category', name: 'News', slug: 'news' },
    { id: 'tag-launch', siteId: 'site-a', kind: 'tag', name: 'Launch', slug: 'launch' },
    { id: 'cat-theirs', siteId: 'site-b', kind: 'category', name: 'News', slug: 'news' },
  ];

  /** An in-memory content table that filters the way the real queries do: site, status, type, terms, newest first. */
  function setup(rows: Row[], postsType: Partial<typeof POSTS> = {}) {
    const type = { ...POSTS, ...postsType };
    const table = rows.map((row) => ({ ...row, type }));
    const newest = (a: Row, b: Row) => b.publishedAt.getTime() - a.publishedAt.getTime();
    const content = {
      findPublishedByTerm: vi.fn(async (siteId: string, term: { id: string; kind: 'category' | 'tag' }, skip: number, take: number) => {
        const optedIn = (row: Row) => (term.kind === 'category' ? row.type.hasCategories : row.type.hasTags);
        const all = table.filter((r) => r.siteId === siteId && r.status === 'published' && optedIn(r) && r.terms.includes(term.id)).sort(newest);
        return { rows: all.slice(skip, skip + take), total: all.length };
      }),
      findRelated: vi.fn(async (siteId: string, typeId: string, termIds: string[], excludeIds: string[], take: number) =>
        termIds.length === 0
          ? []
          : table
              .filter((r) => r.siteId === siteId && r.typeId === typeId && r.status === 'published' && !excludeIds.includes(r.id) && r.terms.some((t) => termIds.includes(t)))
              .sort(newest)
              .slice(0, take),
      ),
      findLiveByPath: vi.fn(async (siteId: string, path: string) => table.find((r) => r.siteId === siteId && r.path === path && r.status === 'published') ?? null),
    };
    const terms = {
      findBySlug: vi.fn(async (siteId: string, kind: string, slug: string) => TERMS.find((t) => t.siteId === siteId && t.kind === kind && t.slug === slug) ?? null),
      findForContent: vi.fn(async (siteId: string, contentId: string) => {
        const row = table.find((r) => r.id === contentId);
        return TERMS.filter((t) => t.siteId === siteId && row?.terms.includes(t.id));
      }),
    };
    const media = { findByFilenames: vi.fn(async () => []), findAltsByFilenames: vi.fn(async () => []) };
    const service = new PublicService(
      sites,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      { resolve: vi.fn(async (sub: string) => ({ alpha: 'site-a', beta: 'site-b' })[sub] ?? null) } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      media as unknown as MediaRepository,
      {} as ContentTypeRepository,
      { get: () => undefined } as unknown as ConfigService,
      {} as RedirectRepository,
      NO_MENUS,
      terms as unknown as TermRepository,
      NO_PRESETS,
    );
    return { service, content, terms };
  }

  describe('archive', () => {
    it('lists the term and its published entries, newest first, in the listing’s item shape', async () => {
      const { service } = setup([post('old', 1, ['cat-news']), post('new', 3, ['cat-news']), post('other', 2, ['tag-launch'])]);
      const archive = await service.getTermArchive('alpha', 'category', 'news', undefined);
      expect(archive.term).toEqual({ name: 'News', slug: 'news', kind: 'category' });
      expect(archive.entries.map((e) => e.title)).toEqual(['NEW', 'OLD']);
      expect(archive.entries[0]).toEqual({ title: 'NEW', path: '/blog/new', publishedAt: day(3).toISOString(), summary: 'About new', image: null });
      expect(archive).toMatchObject({ page: 1, pageCount: 1, total: 2 });
    });

    it('leaves out drafts and archived entries, and entries of a type that no longer uses the kind', async () => {
      const rows = [post('live', 3, ['cat-news']), post('draft', 2, ['cat-news'], { status: 'draft' }), post('gone', 1, ['cat-news'], { status: 'archived' })];
      expect((await setup(rows).service.getTermArchive('alpha', 'category', 'news', undefined)).entries.map((e) => e.title)).toEqual(['LIVE']);
      const off = await setup(rows, { hasCategories: false }).service.getTermArchive('alpha', 'category', 'news', undefined);
      expect(off.entries).toEqual([]);
    });

    it('shows a site only its own terms and entries', async () => {
      const { service, content } = setup([post('mine', 1, ['cat-news']), post('theirs', 2, ['cat-theirs'], { siteId: 'site-b' })]);
      expect((await service.getTermArchive('beta', 'category', 'news', undefined)).entries.map((e) => e.title)).toEqual(['THEIRS']);
      expect(content.findPublishedByTerm).toHaveBeenCalledWith('site-b', expect.objectContaining({ id: 'cat-theirs' }), 0, 20);
      // a term of one kind is not found under the other
      await expect(service.getTermArchive('beta', 'tag', 'news', undefined)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is a 404 for an unknown term, kind or site, a NUL character and a bad page', async () => {
      const { service } = setup([post('a', 1, ['cat-news'])]);
      await expect(service.getTermArchive('alpha', 'category', 'nope', undefined)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getTermArchive('alpha', 'author', 'news', undefined)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getTermArchive('nobody', 'category', 'news', undefined)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getTermArchive('alpha', 'category', 'news\u0000', undefined)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getTermArchive('alpha', 'category', 'News', undefined)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getTermArchive('alpha', 'category', 'news', '0')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getTermArchive('alpha', 'category', 'news', 'x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('pages by 20: the second page holds the rest, and a page past the end is a 404', async () => {
      const rows = Array.from({ length: 23 }, (_, i) => post(`p${i}`, i + 1, ['cat-news']));
      const { service } = setup(rows);
      const first = await service.getTermArchive('alpha', 'category', 'news', undefined);
      expect(first.entries).toHaveLength(20);
      expect(first).toMatchObject({ page: 1, pageCount: 2, total: 23 });
      const second = await service.getTermArchive('alpha', 'category', 'news', '2');
      expect(second.entries.map((e) => e.title)).toEqual(['P2', 'P1', 'P0']);
      await expect(service.getTermArchive('alpha', 'category', 'news', '3')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('an existing term with no entries is an empty first page, not a 404', async () => {
      const { service } = setup([]);
      expect(await service.getTermArchive('alpha', 'category', 'news', undefined)).toMatchObject({ entries: [], total: 0, pageCount: 1 });
    });
  });

  describe('entry page', () => {
    const entry = (rows: Row[], postsType?: Partial<typeof POSTS>) => setup(rows, postsType).service.getPage('alpha', '/blog/me');

    it('carries its categories and tags as name and slug only', async () => {
      const page = await entry([post('me', 5, ['cat-news', 'tag-launch'])]);
      expect(page.entry?.categories).toEqual([{ name: 'News', slug: 'news' }]);
      expect(page.entry?.tags).toEqual([{ name: 'Launch', slug: 'launch' }]);
    });

    it('shows only the kinds its type has on', async () => {
      const page = await entry([post('me', 5, ['cat-news', 'tag-launch'])], { hasTags: false });
      expect(page.entry?.categories).toHaveLength(1);
      expect(page.entry?.tags).toEqual([]);
    });

    it('relates the newest entries sharing a category, never itself, in the listing’s item shape', async () => {
      const page = await entry([post('me', 5, ['cat-news']), post('a', 1, ['cat-news']), post('b', 3, ['cat-news']), post('c', 2, ['tag-launch'])]);
      expect(page.entry?.related.map((r) => r.title)).toEqual(['B', 'A']);
      expect(page.entry?.related[0]).toEqual({ title: 'B', path: '/blog/b', publishedAt: day(3).toISOString(), summary: 'About b', image: null });
    });

    it('tops up with tag matches only when fewer than three share a category, without repeats', async () => {
      const rows = [
        post('me', 9, ['cat-news', 'tag-launch']),
        post('c1', 1, ['cat-news', 'tag-launch']),
        post('t1', 8, ['tag-launch']),
        post('t2', 7, ['tag-launch']),
        post('t3', 6, ['tag-launch']),
      ];
      const { service, content } = setup(rows);
      const related = (await service.getPage('alpha', '/blog/me')).entry?.related.map((r) => r.title);
      // the category match comes first although it is the oldest; then the newest tag matches
      expect(related).toEqual(['C1', 'T1', 'T2']);
      // the tag pass asks only for what is left, and never for the entry itself or a chosen one
      expect(content.findRelated).toHaveBeenLastCalledWith('site-a', 'type-posts', ['tag-launch'], ['me', 'c1'], 2);
    });

    it('does not look at tags once three share a category', async () => {
      const rows = [post('me', 9, ['cat-news']), post('a', 1, ['cat-news']), post('b', 2, ['cat-news']), post('c', 3, ['cat-news'])];
      const { service, content } = setup(rows);
      expect((await service.getPage('alpha', '/blog/me')).entry?.related).toHaveLength(3);
      expect(content.findRelated).toHaveBeenCalledTimes(1);
    });

    it('is empty with nothing in common, with no terms, and when the type uses none', async () => {
      expect((await entry([post('me', 5, ['cat-news']), post('x', 1, [])])).entry?.related).toEqual([]);
      expect((await entry([post('me', 5, [])])).entry?.related).toEqual([]);
      const { service, terms } = setup([post('me', 5, ['cat-news']), post('a', 1, ['cat-news'])], { hasCategories: false, hasTags: false });
      expect((await service.getPage('alpha', '/blog/me')).entry).toMatchObject({ categories: [], tags: [], related: [] });
      expect(terms.findForContent).not.toHaveBeenCalled();
    });

    it('relates only entries of the same type', async () => {
      const other = post('event', 4, ['cat-news'], { typeId: 'type-events' });
      const page = await entry([post('me', 5, ['cat-news']), other]);
      expect(page.entry?.related).toEqual([]);
    });
  });
});

describe('PublicService.getChrome', () => {
  function build(stored: unknown, presetRows: object[] = []) {
    const sites = { findById: vi.fn(async () => ({ id: 'site-a', name: 'Alpha', settings: { tagline: 'Site tag', footerNote: 'Site note', footerBottom: '' } })) };
    const content = {
      findLiveByPath: vi.fn(async () => (stored === undefined ? null : { chrome: stored })),
      findFactsByIds: vi.fn(async () => [{ id: 'c1', path: '/farm', status: 'published' }]),
    };
    const own = { header: [{ label: 'Own', contentId: null, url: '/own' }], footer: [] };
    const menus = {
      findForPublic: vi.fn(async () => own),
      findForPresets: vi.fn(async () => new Map([['p1', [{ label: 'Farm', contentId: 'c1', url: null }]]])),
    };
    const service = new PublicService(
      sites as unknown as SiteRepository,
      content as unknown as ContentRepository,
      {} as PreviewLinkRepository,
      { resolve: vi.fn(async () => 'site-a') } as unknown as SubdomainCache,
      {} as SubmissionRepository,
      {} as MediaRepository,
      {} as ContentTypeRepository,
      { get: () => undefined } as unknown as ConfigService,
      {} as RedirectRepository,
      menus as unknown as MenuRepository,
      {} as TermRepository,
      { list: vi.fn(async () => presetRows) } as unknown as ChromeRepository,
    );
    return service;
  }

  it('gives the site’s own header and footer to a page that picks nothing, and to an address with no page', async () => {
    const chrome = await build({}).getChrome('alpha', '/x');
    expect(chrome.header).toMatchObject({ tagline: 'Site tag', nav: [{ label: 'Own', href: '/own' }] });
    expect(chrome.footer).toMatchObject({ note: 'Site note' });
    expect(chrome.footer?.bottomLine).toMatch(/^© \d{4} Alpha$/);
    expect((await build(undefined).getChrome('alpha', '/gone')).header).not.toBeNull();
  });

  it('hides a part the page hides, and uses a saved one’s words, links and bottom line', async () => {
    const preset = { id: 'p1', location: 'footer', name: 'Slim', tagline: '', logo: '', note: 'Slim note', bottomText: '© {year} Slim' };
    const chrome = await build({ header: 'hidden', footer: 'p1' }, [preset]).getChrome('alpha', '/x');
    expect(chrome.header).toBeNull();
    expect(chrome.footer).toMatchObject({ note: 'Slim note', groups: [{ label: 'Farm', href: '/farm' }] });
    expect(chrome.footer?.bottomLine).toMatch(/^© \d{4} Slim$/);
  });

  it('falls back to the site’s own when the saved one has been deleted', async () => {
    const chrome = await build({ header: 'gone', footer: 'gone' }).getChrome('alpha', '/x');
    expect(chrome.header?.tagline).toBe('Site tag');
    expect(chrome.footer?.note).toBe('Site note');
  });
});
