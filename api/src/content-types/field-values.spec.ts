import type { FieldDefinition } from './field-definitions.js';
import { mergeEntryData, missingRequired, parseEntryData } from './field-values.js';

const SITE = 'site1';
const FILE = `http://localhost:4001/uploads/${SITE}/aaa-111.pdf`;

const fields: FieldDefinition[] = [
  { key: 'summary', label: 'Summary', kind: 'text', required: true },
  { key: 'body', label: 'Body', kind: 'richText', required: false },
  { key: 'when', label: 'When', kind: 'date', required: false },
  { key: 'file', label: 'File', kind: 'media', required: false },
  { key: 'kind', label: 'Kind', kind: 'select', required: false, options: ['Talk', 'Workshop'] },
  { key: 'more', label: 'More', kind: 'link', required: false },
];

const ok = (raw: unknown) => {
  const result = parseEntryData(fields, raw, SITE);
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result;
};
const problems = (raw: unknown) => {
  const result = parseEntryData(fields, raw, SITE);
  return result.ok ? [] : result.problems;
};

describe('parseEntryData: each kind', () => {
  it('accepts good values of all six kinds', () => {
    const result = ok({
      summary: '  A talk  ',
      body: '<p>Hi</p><script>x()</script>',
      when: '2026-02-28',
      file: FILE,
      kind: 'Talk',
      more: { label: 'Book', href: 'https://example.com/book' },
    });
    expect(Object.fromEntries(result.values)).toEqual({
      summary: 'A talk',
      body: '<p>Hi</p>', // sanitised on write
      when: '2026-02-28',
      file: `/uploads/${SITE}/aaa-111.pdf`, // stored in its short form
      kind: 'Talk',
      more: { label: 'Book', href: 'https://example.com/book' },
    });
  });

  it.each([
    ['text too long', { summary: 'a'.repeat(501) }, 'Summary'],
    ['text not a string', { summary: 5 }, 'Summary'],
    ['date in the wrong shape', { when: '28/02/2026' }, 'When'],
    ['date that does not exist', { when: '2026-02-30' }, 'does not exist'],
    ['date with time', { when: '2026-02-28T10:00:00Z' }, 'When'],
    ['media from another site', { file: 'http://localhost:4001/uploads/site2/aaa-111.pdf' }, 'media library'],
    ['media from outside', { file: 'https://evil.example/x.pdf' }, 'media library'],
    ['an option that is not listed', { kind: 'Party' }, 'listed options'],
    ['a link that runs a script', { more: { label: 'x', href: 'javascript:alert(1)' } }, 'must start with'],
    ['a link with no text', { more: { label: '', href: 'https://a.com' } }, 'text of the link'],
    ['a protocol-relative link', { more: { label: 'x', href: '//evil.com' } }, 'must start with'],
    ['link as a string', { more: 'https://a.com' }, 'More'],
  ])('refuses %s', (_label, raw, expected) => {
    expect(problems(raw).join(' ')).toContain(expected);
  });

  it.each([
    ['javascript: with the marker after it', `javascript:alert(1)//uploads/${SITE}/a.png`],
    ['a query string', `/uploads/${SITE}/a.png?x=1`],
    ['a fragment', `/uploads/${SITE}/a.png#x`],
    ['a path inside another path', `/x/uploads/${SITE}/a.png`],
    ['a nested path', `/uploads/${SITE}/sub/a.png`],
    ['no extension', `/uploads/${SITE}/abc`],
    ['an extension with a dot trick', `/uploads/${SITE}/a.png.html/`],
    ['a data URL', `data:text/html,/uploads/${SITE}/a.png`],
    ['a protocol-relative address', `//evil.com/uploads/${SITE}/a.png`],
    ['a NUL character', `/uploads/${SITE}/a\u0000.png`],
    ['a space', `/uploads/${SITE}/a b.png`],
  ])('refuses media with %s', (_label, url) => {
    expect(problems({ file: url }).join(' ')).toContain('media library');
  });

  it('stores media in the short form whichever way it came in, dropping any host', () => {
    for (const url of [`/uploads/${SITE}/a-1.png`, `http://localhost:4001/uploads/${SITE}/a-1.png`, `https://evil.com/uploads/${SITE}/a-1.png`]) {
      expect(ok({ file: url }).values.get('file')).toBe(`/uploads/${SITE}/a-1.png`);
    }
  });

  it('cleans a NUL character out of formatted text and refuses it in a link address', () => {
    expect(ok({ body: '<p>a\u0000b</p>' }).values.get('body')).toBe('<p>ab</p>');
    expect(problems({ more: { label: 'x', href: 'https://a.com/\u0000' } }).join(' ')).toContain('characters');
  });

  it.each(['/\u200b/evil.com', 'https://a.com/\u2028x', 'https://a.com/a\ufeffb'])('refuses hidden characters in a link: %j', (href) => {
    expect(problems({ more: { label: 'x', href } }).join(' ')).toContain('characters');
  });

  it('accepts same-site, mail and in-page links', () => {
    for (const href of ['/about', 'mailto:a@b.com', '#top', 'http://a.com']) {
      expect(ok({ more: { label: 'x', href } }).values.get('more')).toEqual({ label: 'x', href });
    }
  });

  it('reports every problem at once, by the field’s name', () => {
    expect(problems({ summary: 5, when: 'x', kind: 'Party' })).toHaveLength(3);
  });

  it('refuses anything that is not an object', () => {
    for (const raw of [null, 'x', 5, ['a']]) expect(parseEntryData(fields, raw, SITE).ok).toBe(false);
  });
});

describe('parseEntryData: blanks and unknown keys', () => {
  it('treats blank values as clearing the field, whatever the kind', () => {
    const result = ok({ summary: '', when: null, file: '   ', kind: '', more: { label: '', href: '' } });
    expect(result.values.size).toBe(0);
    expect([...result.cleared].sort()).toEqual(['file', 'kind', 'more', 'summary', 'when']);
  });

  it('ignores keys that are not current fields (including prototype keys)', () => {
    const result = ok(JSON.parse('{"nope":1,"__proto__":{"x":1},"summary":"ok"}'));
    expect([...result.values.keys()]).toEqual(['summary']);
  });

  it('counts a link with no address, and formatted text with no words, as blank', () => {
    expect(ok({ more: { label: 'x', href: '' } }).cleared.has('more')).toBe(true);
    for (const html of ['<p></p>', '<p><br></p>', '<p>&nbsp;</p>', ' <p> </p> ']) expect(ok({ body: html }).cleared.has('body')).toBe(true);
  });

  it('leaves fields that were not sent untouched', () => {
    const result = ok({ summary: 'x' });
    expect(result.cleared.size).toBe(0);
  });
});

describe('mergeEntryData', () => {
  it('applies values, removes cleared ones and keeps hidden fields’ values', () => {
    const merged = mergeEntryData(
      { summary: 'old', when: '2026-01-01', hidden_field: 'kept' },
      { values: new Map([['summary', 'new']]), cleared: new Set(['when']) },
    );
    expect(merged).toEqual({ summary: 'new', hidden_field: 'kept' });
  });

  it('copes with data that is missing or not an object', () => {
    for (const existing of [null, undefined, 'x', [1]]) {
      expect(mergeEntryData(existing, { values: new Map([['a', 1]]), cleared: new Set() })).toEqual({ a: 1 });
    }
  });

  it('does not mutate what it was given', () => {
    const existing = { a: 1 };
    mergeEntryData(existing, { values: new Map([['a', 2]]), cleared: new Set() });
    expect(existing).toEqual({ a: 1 });
  });
});

describe('missingRequired', () => {
  it('does not count an empty paragraph or a link with no address as filled', () => {
    const required: FieldDefinition[] = [
      { key: 'b', label: 'B', kind: 'richText', required: true },
      { key: 'l', label: 'L', kind: 'link', required: true },
    ];
    expect(missingRequired(required, { b: '<p></p>', l: { label: 'x', href: '' } }).map((f) => f.key)).toEqual(['b', 'l']);
    expect(missingRequired(required, { b: '<p>Hi</p>', l: { label: 'x', href: '/a' } })).toEqual([]);
  });

  it('lists required fields with no value', () => {
    expect(missingRequired(fields, {}).map((f) => f.key)).toEqual(['summary']);
    expect(missingRequired(fields, { summary: '  ' }).map((f) => f.key)).toEqual(['summary']);
    expect(missingRequired(fields, { summary: 'x' })).toEqual([]);
    expect(missingRequired(fields, null).map((f) => f.key)).toEqual(['summary']);
  });
});
