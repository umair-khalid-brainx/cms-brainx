import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { MediaRepository } from '../media/media.repository.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { SiteRepository } from './site.repository.js';
import { SitesService } from './sites.service.js';
import type { SubdomainCache } from './subdomain-cache.js';

const SITE_ID = 'cmv51abc123';

function setup(library: { filename: string; mimetype: string }[] = []) {
  const table: Record<string, { id: string; name: string; subdomain: string; settings: unknown }> = {
    [SITE_ID]: { id: SITE_ID, name: 'Corrick', subdomain: 'corrick', settings: { tagline: 'Old tagline', footerNote: 'Old note' } },
    other: { id: 'other', name: 'Kestrel', subdomain: 'kestrel', settings: {} },
  };
  const sites = {
    findById: vi.fn(async (id: string) => table[id] ?? null),
    updateSettings: vi.fn(async (id: string, data: { name?: string; settings: unknown }) => {
      Object.assign(table[id], data);
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
