import { describe, expect, it } from 'vitest';
import { choiceOptions, readChrome, sameChrome, type ChromePreset } from './chromeApi';

const preset = (id: string, location: 'header' | 'footer', name: string): ChromePreset => ({ id, location, name, tagline: '', logo: '', note: '', bottomText: '', usedBy: 0 });

describe('readChrome', () => {
  it('treats anything missing or malformed as the site’s own', () => {
    expect(readChrome(undefined)).toEqual({ header: 'default', footer: 'default' });
    expect(readChrome({ header: 3, footer: '' })).toEqual({ header: 'default', footer: 'default' });
    expect(readChrome({ header: 'hidden', footer: 'f1' })).toEqual({ header: 'hidden', footer: 'f1' });
  });
});

describe('choiceOptions', () => {
  it('offers the site’s own, the saved ones of that kind, and none', () => {
    const options = choiceOptions([preset('h1', 'header', 'Landing'), preset('f1', 'footer', 'Slim')], 'header');
    expect(options.map((option) => option.value)).toEqual(['default', 'h1', 'hidden']);
  });
});

describe('sameChrome', () => {
  it('compares both parts', () => {
    expect(sameChrome({ header: 'a', footer: 'b' }, { header: 'a', footer: 'b' })).toBe(true);
    expect(sameChrome({ header: 'a', footer: 'b' }, { header: 'a', footer: 'c' })).toBe(false);
  });
});
