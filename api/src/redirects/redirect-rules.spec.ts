import { normaliseRedirectPath, normaliseRedirectTarget, planRedirect } from './redirect-rules.js';

describe('normaliseRedirectPath (GOV-05)', () => {
  it('lowercases and drops a trailing slash', () => {
    expect(normaliseRedirectPath(' /Old-Page/ ')).toBe('/old-page');
    expect(normaliseRedirectPath('/')).toBe('/');
  });

  it('decodes percent-encoding, so both spellings find the same redirect', () => {
    expect(normaliseRedirectPath('/old%2Dpage')).toBe('/old-page');
  });

  it('refuses what isn’t a plain path on the site', () => {
    for (const bad of ['old-page', '/a b', '/a?x=1', '/a#top', '//evil.com', 'https://x.com/a', '/a\\b', '/café', '/a\x7f', '/%zz']) {
      expect(normaliseRedirectPath(bad)).toBeNull();
    }
  });
});

describe('normaliseRedirectTarget', () => {
  it('takes a site path or a full http(s) address', () => {
    expect(normaliseRedirectTarget('/New/')).toBe('/new');
    expect(normaliseRedirectTarget('https://example.com/shop')).toBe('https://example.com/shop');
  });

  it('refuses other schemes and broken addresses', () => {
    for (const bad of ['javascript:alert(1)', 'ftp://x.com', 'https://', 'mailto:a@b.c']) {
      expect(normaliseRedirectTarget(bad)).toBeNull();
    }
  });
});

describe('planRedirect: no chains, no loops', () => {
  it('a plain new redirect', () => {
    expect(planRedirect([], '/a', '/b')).toEqual({ ok: true, to: '/b', rewrites: [] });
  });

  it('adding B → C rewrites A → B to A → C', () => {
    const plan = planRedirect([{ fromPath: '/a', toPath: '/b' }], '/b', '/c');
    expect(plan).toEqual({ ok: true, to: '/c', rewrites: [{ fromPath: '/a', toPath: '/c' }] });
  });

  it('adding A → B when B → C exists points A straight at C', () => {
    expect(planRedirect([{ fromPath: '/b', toPath: '/c' }], '/a', '/b')).toMatchObject({ ok: true, to: '/c' });
  });

  it('refuses a redirect to itself, or one that leads back', () => {
    expect(planRedirect([], '/a', '/a').ok).toBe(false);
    expect(planRedirect([{ fromPath: '/b', toPath: '/a' }], '/a', '/b').ok).toBe(false);
  });

  it('a rename back works once the page at the old address has removed its redirect', () => {
    // /a → /b exists; the page moves back to /a, so /a → /b goes first (a page wins), then /b → /a is added.
    expect(planRedirect([{ fromPath: '/a', toPath: '/b' }], '/b', '/a').ok).toBe(false);
    expect(planRedirect([], '/b', '/a')).toEqual({ ok: true, to: '/a', rewrites: [] });
  });
});
