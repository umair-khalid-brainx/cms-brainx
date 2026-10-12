import { EMPTY_SETTINGS, readSettings, updateSettingsSchema } from './site-settings.js';

const SITE = 'cmv51abc123';
const parse = (input: unknown) => updateSettingsSchema(SITE).safeParse(input);

describe('updateSettingsSchema (GOV-04)', () => {
  it('takes any part on its own, trimmed', () => {
    expect(parse({ tagline: '  River oysters  ' })).toMatchObject({ success: true, data: { tagline: 'River oysters' } });
    expect(parse({ name: ' Corrick ' })).toMatchObject({ success: true, data: { name: 'Corrick' } });
  });

  it('refuses an empty body, an empty title, and over-long text, with messages for the person', () => {
    expect(parse({}).success).toBe(false);
    const empty = parse({ name: '   ' });
    expect(!empty.success && empty.error.issues[0].message).toBe('The site title can’t be empty.');
    const long = parse({ tagline: 'x'.repeat(121), footerNote: 'y'.repeat(401) });
    expect(!long.success && long.error.issues.map((i) => i.message)).toEqual([
      'The tagline can be at most 120 characters.',
      'The footer note can be at most 400 characters.',
    ]);
  });

  it('lets the logo be empty (to remove it) or a file of this site’s library, stored in the short form', () => {
    expect(parse({ logo: '' })).toMatchObject({ success: true, data: { logo: '' } });
    expect(parse({ logo: `http://localhost:4001/uploads/${SITE}/a1-b2.png` })).toMatchObject({
      success: true,
      data: { logo: `/uploads/${SITE}/a1-b2.png` },
    });
  });

  it('refuses a logo from another site, another host or a script', () => {
    for (const bad of ['/uploads/othersite/a.png', 'https://evil.com/a.png', 'javascript:alert(1)']) {
      const result = parse({ logo: bad });
      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].message).toBe('Choose a file from this site’s media library');
    }
  });
});

describe('readSettings', () => {
  it('reads back what was stored, and treats anything missing or malformed as empty', () => {
    expect(readSettings({ tagline: 'T', logo: 5 })).toEqual({ ...EMPTY_SETTINGS, tagline: 'T' });
    expect(readSettings(null)).toEqual(EMPTY_SETTINGS);
    expect(readSettings([])).toEqual(EMPTY_SETTINGS);
  });
});
