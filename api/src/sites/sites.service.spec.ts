import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MediaRepository } from '../media/media.repository.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { SiteRepository } from './site.repository.js';
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
  const service = new SitesService(
    sites as unknown as SiteRepository,
    {} as SubdomainCache,
    media as unknown as MediaRepository,
    revalidation as unknown as RevalidationService,
    { get: (key: string) => env[key] } as unknown as ConfigService,
  );
  return { service, table, sites, revalidation };
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
