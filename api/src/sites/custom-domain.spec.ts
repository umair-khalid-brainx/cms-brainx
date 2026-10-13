import { domainProblem, normaliseDomain } from './custom-domain.js';

describe('normaliseDomain (DEP-02)', () => {
  it('keeps only the host name, lower-cased', () => {
    expect(normaliseDomain('  https://WWW.Example.com/menu?x=1 ')).toBe('www.example.com');
    expect(normaliseDomain('example.com.')).toBe('example.com');
    expect(normaliseDomain('shop.example.com:8080')).toBe('shop.example.com');
    expect(normaliseDomain('//example.com/x')).toBe('example.com');
  });

  it('stores an internationalised name in its xn-- form', () => {
    expect(normaliseDomain('München.de')).toBe('xn--mnchen-3ya.de');
  });
});

describe('domainProblem (DEP-02)', () => {
  const root = 'yourcms.com';

  it('accepts a bare domain and a name under one', () => {
    expect(domainProblem('example.com', root)).toBeNull();
    expect(domainProblem('www.corrick-oysters.co.uk', root)).toBeNull();
  });

  it('refuses what isn’t a domain', () => {
    for (const bad of ['', 'localhost', 'exa mple.com', '-bad.com', 'bad-.com', 'example.c', 'example.123', `${'a'.repeat(64)}.com`]) {
      expect(domainProblem(bad, root)).not.toBeNull();
    }
  });

  it('accepts an internationalised ending, and refuses endings that are never public', () => {
    expect(domainProblem('shop.xn--p1ai', root)).toBeNull();
    for (const reserved of ['app.localhost', 'foo.test', 'printer.local', 'www.example', 'x.invalid']) {
      expect(domainProblem(reserved, root)).toMatch(/never work/);
    }
  });

  it('refuses the platform’s own addresses', () => {
    expect(domainProblem('yourcms.com', root)).toMatch(/free ones/);
    expect(domainProblem('corrick.yourcms.com', root)).toMatch(/free ones/);
    expect(domainProblem('notyourcms.com', root)).toBeNull();
  });
});
