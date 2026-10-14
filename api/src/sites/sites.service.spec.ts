import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MediaRepository } from '../media/media.repository.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { UserRepository } from '../users/user.repository.js';
import type { SiteRepository } from './site.repository.js';
import { createSiteSchema } from './dto/site.dto.js';
import { contrastProblems, DEFAULT_THEME, themeSchema } from './site-theme.js';
import { SitesService } from './sites.service.js';
import type { SubdomainCache } from './subdomain-cache.js';

const SITE_ID = 'cmv51abc123';

function setup(library: { filename: string; mimetype: string }[] = [], env: Record<string, string> = { PUBLIC_ROOT_DOMAIN: 'yourcms.com' }) {
  type SiteRow = { id: string; name: string; subdomain: string; settings: unknown; host: string | null; domainStatus: 'pending' | 'verified' | null };
  const table: Record<string, SiteRow> = {
    [SITE_ID]: {
      id: SITE_ID,
      name: 'Corrick',
      subdomain: 'corrick',
      settings: { tagline: 'Old tagline', footerNote: 'Old note' },
      host: null,
      domainStatus: null,
    },
    other: { id: 'other', name: 'Kestrel', subdomain: 'kestrel', settings: {}, host: 'www.kestrelrigging.com', domainStatus: 'verified' },
  };
  const sites = {
    findById: vi.fn(async (id: string) => table[id] ?? null),
    updateSettings: vi.fn(async (id: string, data: { name?: string; settings: unknown }) => {
      Object.assign(table[id], data);
      return table[id];
    }),
    updateTheme: vi.fn(async (id: string, themeJson: unknown) => {
      Object.assign(table[id], { themeJson });
      return table[id];
    }),
    findByHost: vi.fn(async (host: string) => Object.values(table).find((site) => site.host === host) ?? null),
    updateDomain: vi.fn(async (id: string, host: string | null) => {
      Object.assign(table[id], { host, domainStatus: host ? 'pending' : null });
      return table[id];
    }),
  };
  const media = {
    findImage: vi.fn(async (siteId: string, path: string) => {
      const file = siteId === SITE_ID ? library.find((candidate) => candidate.filename === path.slice(path.lastIndexOf('/') + 1)) : undefined;
      return file && file.mimetype.startsWith('image/') ? { filename: file.filename, alt: null } : null;
    }),
  };
  const revalidation = { site: vi.fn(async () => {}) };
  const roles: Record<string, string[]> = { boss: ['owner'], staff: ['editor', 'administrator'], nobody: [] };
  const users = {
    findByIdWithMemberships: vi.fn(async (id: string) => ({ memberships: (roles[id] ?? []).map((role) => ({ role })) })),
  };
  const service = new SitesService(
    sites as unknown as SiteRepository,
    {} as SubdomainCache,
    media as unknown as MediaRepository,
    revalidation as unknown as RevalidationService,
    { get: (key: string) => env[key] } as unknown as ConfigService,
    users as unknown as UserRepository,
  );
  return { service, table, sites, revalidation, users };
}

describe('SitesService.getDetails (GOV-04)', () => {
  it('returns the title, address and settings, with empty values for what was never set', async () => {
    const { service } = setup();
    expect(await service.getDetails(SITE_ID)).toEqual({
      id: SITE_ID,
      name: 'Corrick',
      subdomain: 'corrick',
      tagline: 'Old tagline',
      footerNote: 'Old note',
      logo: '',
      customDomain: null,
      domainStatus: null,
    });
    expect((await service.getDetails('other')).tagline).toBe('');
  });

  it('is a 404 for a site that doesn’t exist', async () => {
    await expect(setup().service.getDetails('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SitesService.updateSettings (GOV-04)', () => {
  it('changes only what is sent, keeps the rest, and refreshes every page of the site', async () => {
    const { service, table, revalidation } = setup();
    const result = await service.updateSettings(SITE_ID, { tagline: '  Damariscotta River, Maine ' });
    expect(result).toMatchObject({ name: 'Corrick', tagline: 'Damariscotta River, Maine', footerNote: 'Old note', logo: '' });
    expect(table[SITE_ID].settings).toEqual({ tagline: 'Damariscotta River, Maine', footerNote: 'Old note', logo: '' });
    expect(revalidation.site).toHaveBeenCalledExactlyOnceWith('corrick');
  });

  it('saves the title in its own column, so every picker and page title follows', async () => {
    const { service, table } = setup();
    await service.updateSettings(SITE_ID, { name: ' Corrick Oyster Co. ' });
    expect(table[SITE_ID].name).toBe('Corrick Oyster Co.');
  });

  it('refuses a bad body with every problem named, and writes and refreshes nothing', async () => {
    const { service, sites, revalidation } = setup();
    await expect(service.updateSettings(SITE_ID, { name: ' ', tagline: 'x'.repeat(121) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateSettings(SITE_ID, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(sites.updateSettings).not.toHaveBeenCalled();
    expect(revalidation.site).not.toHaveBeenCalled();
  });

  it('takes a logo that is a picture in this site’s library, and can remove it again', async () => {
    const { service, table } = setup([{ filename: 'a1-b2.png', mimetype: 'image/png' }]);
    await service.updateSettings(SITE_ID, { logo: `http://localhost:4001/uploads/${SITE_ID}/a1-b2.png` });
    expect(table[SITE_ID].settings).toMatchObject({ logo: `/uploads/${SITE_ID}/a1-b2.png` });
    await service.updateSettings(SITE_ID, { logo: '' });
    expect(table[SITE_ID].settings).toMatchObject({ logo: '' });
  });

  it('refuses a logo from another site’s folder, one that isn’t in the library, and one that isn’t a picture', async () => {
    const { service, sites } = setup([{ filename: 'doc.pdf', mimetype: 'application/pdf' }]);
    for (const logo of ['/uploads/othersite/a1-b2.png', `/uploads/${SITE_ID}/missing.png`, `/uploads/${SITE_ID}/doc.pdf`]) {
      await expect(service.updateSettings(SITE_ID, { logo })).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(sites.updateSettings).not.toHaveBeenCalled();
  });

  it('never touches another site', async () => {
    const { service, table } = setup();
    await service.updateSettings(SITE_ID, { tagline: 'Mine' });
    expect(table.other.settings).toEqual({});
    expect(table.other.name).toBe('Kestrel');
  });
});

describe('SitesService custom domain (DEP-02)', () => {
  it('saves a cleaned-up domain as pending', async () => {
    const { service, table } = setup();
    const result = await service.setDomain(SITE_ID, '  https://WWW.CorrickOysters.com/menu ');
    expect(result).toMatchObject({ customDomain: 'www.corrickoysters.com', domainStatus: 'pending' });
    expect(table[SITE_ID]).toMatchObject({ host: 'www.corrickoysters.com', domainStatus: 'pending' });
  });

  it('refuses the platform’s own root domain and anything under it', async () => {
    const { service, sites } = setup();
    await expect(service.setDomain(SITE_ID, 'yourcms.com')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setDomain(SITE_ID, 'corrick.yourcms.com')).rejects.toBeInstanceOf(BadRequestException);
    expect(sites.updateDomain).not.toHaveBeenCalled();
  });

  it('refuses a domain another site has, and says so', async () => {
    const { service, sites } = setup();
    await expect(service.setDomain(SITE_ID, 'www.kestrelrigging.com')).rejects.toThrow(new ConflictException('Another site already uses that domain.'));
    expect(sites.updateDomain).not.toHaveBeenCalled();
  });

  it('keeps a verified domain as it is when the same one is saved again', async () => {
    const { service, sites } = setup();
    expect(await service.setDomain('other', 'WWW.kestrelrigging.com')).toMatchObject({ domainStatus: 'verified' });
    expect(sites.updateDomain).not.toHaveBeenCalled();
  });

  it('refuses every domain in production when the root domain isn’t configured', async () => {
    const { service, sites } = setup([], { NODE_ENV: 'production', PUBLIC_ROOT_DOMAIN: ' ' });
    await expect(service.setDomain(SITE_ID, 'www.corrickoysters.com')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sites.updateDomain).not.toHaveBeenCalled();
  });

  it('removes the domain and its status', async () => {
    const { service } = setup();
    expect(await service.removeDomain('other')).toMatchObject({ customDomain: null, domainStatus: null });
  });

  it('is a 404 for a site that doesn’t exist', async () => {
    await expect(setup().service.removeDomain('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SitesService.updateTheme', () => {
  const good = {
    typeSet: 'editorial',
    shape: 'soft',
    density: 'comfortable',
    texture: 'grain',
    palette: { paper: '#D9E0D8', surface: '#F1F4EF', ink: '#13201C', muted: '#556258', line: '#B6C2B5', brand: '#2E4A3E', onBrand: '#F1F4EF', accent: '#C8863C' },
  };

  it('saves a whole readable theme, returns it, and refreshes the site', async () => {
    const { service, sites, revalidation } = setup();
    const site = await service.updateTheme(SITE_ID, good);
    expect(sites.updateTheme).toHaveBeenCalledWith(SITE_ID, good);
    expect(site.theme).toEqual(good);
    expect(revalidation.site).toHaveBeenCalledWith('corrick');
  });

  it('writes nothing when a field is wrong, and names every problem', async () => {
    const { service, sites } = setup();
    const bad = { ...good, shape: 'round', palette: { ...good.palette, brand: 'green' } };
    await expect(service.updateTheme(SITE_ID, bad)).rejects.toMatchObject({
      response: { message: ['Choose a corner style from the list.', 'Brand must be a colour like #2E4A3E.'] },
    });
    expect(sites.updateTheme).not.toHaveBeenCalled();
  });

  it('refuses a theme whose text can’t be read', async () => {
    const { service, sites } = setup();
    await expect(service.updateTheme(SITE_ID, { ...good, palette: { ...good.palette, ink: good.palette.paper } })).rejects.toBeInstanceOf(BadRequestException);
    expect(sites.updateTheme).not.toHaveBeenCalled();
  });

  it('is a 404 for a site that doesn’t exist', async () => {
    await expect(setup().service.updateTheme('nope', good)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SitesService.create (MSI-02)', () => {
  function withCreate() {
    const ctx = setup();
    const created = vi.fn(async (data: { name: string; subdomain: string; themeJson: unknown }, ownerId: string) => ({ id: 'new1', ...data, ownerId }));
    Object.assign(ctx.sites, {
      createWithOwner: created,
      findBySubdomain: vi.fn(async (subdomain: string) => Object.values(ctx.table).find((site) => site.subdomain === subdomain) ?? null),
    });
    return { ...ctx, created };
  }

  it('makes the caller the owner of a new site with the default theme', async () => {
    const { service, created } = withCreate();
    const site = await service.create('boss', { name: 'Harbour Co', subdomain: 'harbour' });
    expect(site).toEqual({ id: 'new1', name: 'Harbour Co', subdomain: 'harbour', role: 'owner' });
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ name: 'Harbour Co', subdomain: 'harbour', themeJson: DEFAULT_THEME }), 'boss');
  });

  it('refuses someone who owns no site (an administrator, an editor, nobody)', async () => {
    const { service, created } = withCreate();
    await expect(service.create('staff', { name: 'X', subdomain: 'xsite' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create('nobody', { name: 'X', subdomain: 'xsite' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(created).not.toHaveBeenCalled();
  });

  it('refuses an address another site already has', async () => {
    const { service, created } = withCreate();
    await expect(service.create('boss', { name: 'X', subdomain: 'corrick' })).rejects.toBeInstanceOf(ConflictException);
    expect(created).not.toHaveBeenCalled();
  });

  it('the default theme passes the theme schema and the contrast rules', () => {
    expect(themeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
    // Oyster, the preset the theme editor offers first (admin/src/lib/themeEdit.test.ts pins the same values).
    expect(DEFAULT_THEME).toEqual({
      typeSet: 'editorial',
      shape: 'soft',
      density: 'comfortable',
      texture: 'grain',
      palette: { paper: '#D9E0D8', surface: '#F1F4EF', ink: '#13201C', muted: '#556258', line: '#B6C2B5', brand: '#2E4A3E', onBrand: '#F1F4EF', accent: '#C8863C' },
    })
    expect(contrastProblems(DEFAULT_THEME)).toEqual([]);
  });
});

describe('createSiteSchema (MSI-02)', () => {
  it('cleans up the address and refuses reserved or malformed ones and a blank title', () => {
    expect(createSiteSchema.parse({ name: ' Harbour ', subdomain: ' Harbour ' })).toEqual({ name: 'Harbour', subdomain: 'harbour' });
    expect(createSiteSchema.safeParse({ name: 'A', subdomain: 'admin' }).success).toBe(false);
    expect(createSiteSchema.safeParse({ name: 'A', subdomain: 'no spaces' }).success).toBe(false);
    expect(createSiteSchema.safeParse({ name: '  ', subdomain: 'okay-one' }).success).toBe(false);
    expect(createSiteSchema.safeParse({ name: 'A', subdomain: 'okay-one', siteId: 'x' }).success).toBe(false);
  });
});
