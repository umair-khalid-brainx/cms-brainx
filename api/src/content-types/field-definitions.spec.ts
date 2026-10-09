import {
  FIELD_KINDS,
  fieldInputSchema,
  keyFromLabel,
  normaliseFields,
  parseStoredFields,
  type FieldDefinition,
} from './field-definitions.js';

const def = (key: string, kind: FieldDefinition['kind'] = 'text', extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  key,
  label: key,
  kind,
  required: false,
  ...extra,
});

describe('the field palette', () => {
  it('has exactly the six kinds, and refuses a seventh', () => {
    expect([...FIELD_KINDS]).toEqual(['text', 'richText', 'date', 'media', 'select', 'link']);
    expect(fieldInputSchema.safeParse({ label: 'Count', kind: 'number' }).success).toBe(false);
    expect(fieldInputSchema.safeParse({ label: 'Photos', kind: 'gallery' }).success).toBe(false);
    for (const kind of FIELD_KINDS) expect(fieldInputSchema.safeParse({ label: 'x', kind }).success).toBe(true);
  });
});

describe('keyFromLabel', () => {
  it.each([
    ['Event date', 'event_date'],
    ['Venue', 'venue'],
    ['Straße & Café', 'strasse_cafe'.replace('strasse', 'stra_e')],
    ['  Price (£)  ', 'price'],
    ['2026 dates', 'f_2026_dates'],
    ['!!!', ''],
  ])('%j becomes %j', (label, expected) => {
    expect(keyFromLabel(label)).toBe(expected);
  });

  it('stays within 40 characters', () => {
    expect(keyFromLabel('word '.repeat(30)).length).toBeLessThanOrEqual(40);
  });
});

describe('normaliseFields', () => {
  it('gives new fields a key from their label, unique among the type', () => {
    const { fields, problems } = normaliseFields(
      [{ label: 'Venue', kind: 'text', required: true }, { label: 'VENUE', kind: 'text', required: false }],
      [],
    );
    expect(problems).toEqual(expect.arrayContaining([expect.stringContaining('two fields called')]));
    expect(fields.map((f) => f.key)).toEqual(['venue', 'venue_2']);
  });

  it('keeps an existing field’s key and kind, and lets its name and required flag change', () => {
    const { fields, problems } = normaliseFields(
      [{ key: 'venue', label: 'Where', kind: 'text', required: true }],
      [def('venue')],
    );
    expect(problems).toEqual([]);
    expect(fields).toEqual([{ key: 'venue', label: 'Where', kind: 'text', required: true }]);
  });

  it('refuses to change an existing field’s kind', () => {
    const { problems } = normaliseFields([{ key: 'venue', label: 'Venue', kind: 'date', required: false }], [def('venue')]);
    expect(problems[0]).toContain("can't change from text to date");
  });

  it('refuses a key that is not one of the type’s own', () => {
    const { problems } = normaliseFields([{ key: 'ghost', label: 'Ghost', kind: 'text', required: false }], [def('venue')]);
    expect(problems[0]).toContain("doesn't exist");
  });

  it('removing a field from the list just drops it; a new field never reuses a live key', () => {
    const { fields } = normaliseFields([{ label: 'Venue', kind: 'text', required: false }], [def('venue')]);
    expect(fields.map((f) => f.key)).toEqual(['venue_2']);
  });

  it('needs at least one option for a select, and removes duplicate options; other kinds carry none', () => {
    expect(normaliseFields([{ label: 'Kind', kind: 'select', required: false }], []).problems[0]).toContain('at least one option');
    const ok = normaliseFields([{ label: 'Kind', kind: 'select', required: false, options: ['A', 'B', 'A'] }], []);
    expect(ok.fields[0].options).toEqual(['A', 'B']);
    const text = normaliseFields([{ label: 'Note', kind: 'text', required: false, options: ['x'] }], []);
    expect(text.fields[0]).not.toHaveProperty('options');
  });

  it('refuses a label with no letters or digits, and more than 30 fields', () => {
    expect(normaliseFields([{ label: '!!!', kind: 'text', required: false }], []).problems[0]).toContain('letters or numbers');
    const many = Array.from({ length: 31 }, (_, i) => ({ label: `Field ${i}`, kind: 'text' as const, required: false }));
    expect(normaliseFields(many, []).problems[0]).toContain('up to 30');
  });
});

describe('parseStoredFields', () => {
  it('reads a good list and returns none for a damaged one', () => {
    expect(parseStoredFields([def('a')])).toHaveLength(1);
    expect(parseStoredFields('nope')).toEqual([]);
    expect(parseStoredFields([{ key: 'A!', label: 'x', kind: 'text' }])).toEqual([]);
    expect(parseStoredFields([{ key: 'a', label: 'x', kind: 'number' }])).toEqual([]);
  });
});
