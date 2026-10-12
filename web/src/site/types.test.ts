import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { settingsFromSite } from './types.ts';
import type { PublicSite } from '@/lib/publicApi';

const site: PublicSite = {
  name: 'Corrick Oyster Co.',
  subdomain: 'corrick',
  theme: {} as PublicSite['theme'],
  tagline: 'Damariscotta River, Maine',
  footerNote: 'Grown since 1980.',
  logo: { url: 'http://api/uploads/s/l1.png' },
};

describe('settingsFromSite (GOV-04)', () => {
  it('carries the name, logo, tagline and footer note into the header and footer', () => {
    const settings = settingsFromSite(site);
    assert.equal(settings.name, 'Corrick Oyster Co.');
    assert.equal(settings.logoUrl, 'http://api/uploads/s/l1.png');
    assert.equal(settings.tagline, 'Damariscotta River, Maine');
    assert.equal(settings.footer.note, 'Grown since 1980.');
  });

  it('has no logo when the site has none, and no navigation or footer groups when it has no menus', () => {
    const settings = settingsFromSite({ ...site, logo: null, tagline: '', footerNote: '' });
    assert.equal(settings.logoUrl, null);
    assert.equal(settings.tagline, '');
    assert.deepEqual(settings.nav, []);
    assert.deepEqual(settings.footer.groups, []);
  });

  it('takes the header menu as the navigation and the footer menu as the footer’s groups (GOV-03)', () => {
    const header = [{ label: 'About', href: '/about', children: [{ label: 'Team', href: '/about/team' }] }];
    const footer = [{ label: 'Visit', href: null, children: [{ label: 'Directions', href: '/find-us' }] }];
    const settings = settingsFromSite(site, { header, footer });
    assert.deepEqual(settings.nav, header);
    assert.deepEqual(settings.footer.groups, footer);
  });
});
