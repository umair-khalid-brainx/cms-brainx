import { bottomLine, choiceSchema, readChoice, resolveChoice, updatePresetSchema } from './chrome-rules.js';

const presets = [
  { id: 'h1', location: 'header' as const },
  { id: 'f1', location: 'footer' as const },
];

describe('readChoice', () => {
  it('counts anything missing or malformed as the site’s own', () => {
    expect(readChoice({})).toEqual({ header: 'default', footer: 'default' });
    expect(readChoice(null)).toEqual({ header: 'default', footer: 'default' });
    expect(readChoice({ header: 5, footer: '' })).toEqual({ header: 'default', footer: 'default' });
  });
  it('reads a stored choice', () => {
    expect(readChoice({ header: 'hidden', footer: 'f1' })).toEqual({ header: 'hidden', footer: 'f1' });
  });
});

describe('resolveChoice', () => {
  it('hides, uses a saved one of the right kind, and otherwise falls back to the site’s own', () => {
    expect(resolveChoice('hidden', 'header', presets)).toEqual({ kind: 'hidden' });
    expect(resolveChoice('h1', 'header', presets)).toEqual({ kind: 'preset', id: 'h1' });
    expect(resolveChoice('default', 'header', presets)).toEqual({ kind: 'default' });
    // A deleted one, or a footer's id offered as a header, never blanks the part.
    expect(resolveChoice('gone', 'header', presets)).toEqual({ kind: 'default' });
    expect(resolveChoice('f1', 'header', presets)).toEqual({ kind: 'default' });
  });
});

describe('choiceSchema', () => {
  it('takes either part, and refuses anything else', () => {
    expect(choiceSchema.safeParse({ header: 'hidden' }).success).toBe(true);
    expect(choiceSchema.safeParse({ header: '' }).success).toBe(false);
    expect(choiceSchema.safeParse({ sidebar: 'x' }).success).toBe(false);
  });
});

describe('bottomLine', () => {
  it('falls back to a copyright line, and fills in {year}', () => {
    expect(bottomLine('  ', 'Corrick', 2026)).toBe('© 2026 Corrick');
    expect(bottomLine('© {year} Corrick Oyster Co. All rights reserved.', 'Corrick', 2026)).toBe('© 2026 Corrick Oyster Co. All rights reserved.');
  });
});

describe('updatePresetSchema', () => {
  it('needs at least one setting and refuses an over-long bottom line', () => {
    expect(updatePresetSchema('s').safeParse({}).success).toBe(false);
    expect(updatePresetSchema('s').safeParse({ bottomText: 'x'.repeat(201) }).success).toBe(false);
    expect(updatePresetSchema('s').safeParse({ note: 'Hello', bottomText: '' }).success).toBe(true);
  });
});
