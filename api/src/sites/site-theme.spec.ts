import { contrastProblems, contrastRatio, themeSchema, type SiteTheme } from './site-theme.js';
import { corrick } from '../../prisma/seed-content/corrick.js';
import { kestrel } from '../../prisma/seed-content/kestrel.js';

const theme = (): SiteTheme => structuredClone(corrick.theme) as SiteTheme;

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#2E4A3E', '#2E4A3E')).toBe(1);
  });
});

describe('themeSchema', () => {
  it('accepts both seeded demo themes, and both are readable', () => {
    for (const site of [corrick, kestrel]) {
      const parsed = themeSchema.parse(site.theme);
      expect(contrastProblems(parsed)).toEqual([]);
    }
  });

  it('names a colour that isn’t #rrggbb in the client’s words', () => {
    const bad = { ...theme(), palette: { ...theme().palette, onBrand: 'white' } };
    const result = themeSchema.safeParse(bad);
    expect(result.success ? [] : result.error.issues.map((i) => i.message)).toEqual(['Text on brand must be a colour like #2E4A3E.']);
  });

  it('refuses a choice outside the fixed lists, and any extra field', () => {
    expect(themeSchema.safeParse({ ...theme(), typeSet: 'comic-sans' }).success).toBe(false);
    expect(themeSchema.safeParse({ ...theme(), css: 'body{}' }).success).toBe(false);
    expect(themeSchema.safeParse({ ...theme(), palette: { ...theme().palette, glow: '#ffffff' } }).success).toBe(false);
  });

  it('refuses a theme missing a colour', () => {
    const { accent: _accent, ...palette } = theme().palette;
    expect(themeSchema.safeParse({ ...theme(), palette }).success).toBe(false);
  });
});

describe('contrastProblems', () => {
  it('flags text that can’t be read on the background', () => {
    const t = theme();
    t.palette.ink = t.palette.paper;
    expect(contrastProblems(t)).toContain('Text is hard to read on the background. Pick a darker text or a lighter background (or the reverse).');
  });

  it('flags text on the brand colour', () => {
    const t = theme();
    t.palette.onBrand = t.palette.brand;
    expect(contrastProblems(t)).toEqual(['Text on the brand colour is hard to read. Pick a text colour that stands out from Brand.']);
  });
});
