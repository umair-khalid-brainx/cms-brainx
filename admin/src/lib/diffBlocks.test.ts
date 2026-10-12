import { describe, expect, it } from 'vitest';
import {
  diffBlocks,
  diffDetails,
  diffRecord,
  diffTerms,
  diffWords,
  htmlToText,
  summarize,
  type Block,
  type Snapshot,
} from './diffBlocks';

const hero = (headline: string, extra: Record<string, unknown> = {}): Block => ({ type: 'hero', headline, ...extra });
const text = (html: string, heading = 'About'): Block => ({ type: 'richText', heading, html });
const spacer = (size = 'md'): Block => ({ type: 'spacer', size });
const tags = (rows: ReturnType<typeof diffBlocks>) => rows.map((row) => row.tag);

describe('diffBlocks', () => {
  it('an optional yes/no that was never saved is the same as one saved as No', () => {
    expect(diffRecord({}, { noindex: false }, {}, ['noindex'])).toEqual([]);
    expect(diffRecord({ noindex: false }, { noindex: true }, {}, ['noindex'])).toHaveLength(1);
  });

  it('an empty prop appearing is not a formatting change', () => {
    const rows = diffBlocks([hero('A')], [hero('A', { subheading: '' })]);
    expect(rows[0].tag).toBe('unchanged');
  });

  it('a formatting-only edit (same words, new bold or link) is Changed, not Unchanged', () => {
    const rows = diffBlocks([text('<p>Hello world</p>')], [text('<p>Hello <b>world</b></p>')]);
    expect(rows[0].tag).toBe('changed');
    expect(rows[0].changes[0]).toMatchObject({ label: 'Formatting or links' });
  });

  it('a long text with one changed word still diffs correctly (common start and end are trimmed)', () => {
    const long = Array.from({ length: 5000 }, (_, i) => `w${i}`);
    const edited = [...long];
    edited[2500] = 'CHANGED';
    const segments = diffWords(long.join(' '), edited.join(' '));
    expect(segments.filter((s) => s.type !== 'same').map((s) => [s.type, s.text])).toEqual([
      ['del', 'w2500'],
      ['add', 'CHANGED'],
    ]);
  });

  it('marks identical lists as all unchanged', () => {
    const blocks = [hero('A'), text('<p>x</p>'), spacer()];
    const rows = diffBlocks(blocks, structuredClone(blocks));
    expect(tags(rows)).toEqual(['unchanged', 'unchanged', 'unchanged']);
    expect(rows.every((row) => row.changes.length === 0)).toBe(true);
  });

  it('handles empty lists', () => {
    expect(diffBlocks([], [])).toEqual([]);
    expect(tags(diffBlocks([], [hero('A')]))).toEqual(['added']);
    expect(tags(diffBlocks([hero('A')], []))).toEqual(['removed']);
  });

  it('finds an inserted block', () => {
    const rows = diffBlocks([hero('A'), spacer()], [hero('A'), text('<p>new</p>'), spacer()]);
    expect(tags(rows)).toEqual(['unchanged', 'added', 'unchanged']);
    expect(rows[1]).toMatchObject({ type: 'richText', label: 'Rich text', oldIndex: null, newIndex: 1 });
  });

  it('finds a deleted block', () => {
    const rows = diffBlocks([hero('A'), text('<p>x</p>'), spacer()], [hero('A'), spacer()]);
    expect(tags(rows)).toEqual(['unchanged', 'removed', 'unchanged']);
    expect(rows[1]).toMatchObject({ oldIndex: 1, newIndex: null });
  });

  it('shows a reorder as Removed + Added (moves are not tracked)', () => {
    const a = hero('A');
    const b = text('<p>b</p>');
    const rows = diffBlocks([a, b], [b, a]);
    expect(tags(rows).sort()).toEqual(['added', 'removed', 'unchanged']);
  });

  it('matches a block whose props changed as Changed, not Removed + Added', () => {
    const rows = diffBlocks([hero('Fresh', { body: 'old body' })], [hero('Fresh', { body: 'new body' })]);
    expect(tags(rows)).toEqual(['changed']);
    expect(rows[0].changes).toMatchObject([{ path: 'body', label: 'Body', before: 'old body', after: 'new body' }]);
    expect(rows[0].changes[0].words).toEqual([
      { type: 'del', text: 'old' },
      { type: 'add', text: 'new' },
      { type: 'same', text: 'body' },
    ]);
  });

  it('matches a same-type block at the same position even when its main text changed', () => {
    const rows = diffBlocks([spacer(), hero('Old headline'), spacer()], [spacer(), hero('New headline'), spacer()]);
    expect(tags(rows)).toEqual(['unchanged', 'changed', 'unchanged']);
    expect(rows[1].changes[0]).toMatchObject({ label: 'Headline', before: 'Old headline', after: 'New headline' });
  });

  it('does not pair blocks of different types', () => {
    expect(tags(diffBlocks([hero('A')], [text('<p>x</p>')]))).toEqual(['removed', 'added']);
  });

  it('reports a nested prop change with a readable path', () => {
    const before: Block = {
      type: 'featureGrid',
      heading: 'Why',
      items: [
        { title: 'One', body: 'a' },
        { title: 'Two', body: 'b' },
      ],
    };
    const after: Block = {
      type: 'featureGrid',
      heading: 'Why',
      items: [
        { title: 'One', body: 'a' },
        { title: 'Two', body: 'changed' },
      ],
    };
    const [row] = diffBlocks([before], [after]);
    expect(row.tag).toBe('changed');
    expect(row.changes).toEqual([{ path: 'items[1].body', label: 'Items 2 › Body', before: 'b', after: 'changed' }]);
  });

  it('reports list items added and removed at leaf level', () => {
    const before: Block = { type: 'stats', items: [{ label: 'A', value: '1' }] };
    const after: Block = {
      type: 'stats',
      items: [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
      ],
    };
    const [row] = diffBlocks([before], [after]);
    expect(row.changes.map((change) => [change.label, change.before, change.after])).toEqual([
      ['Items 2 › Label', null, 'B'],
      ['Items 2 › Value', null, '2'],
    ]);
  });

  it('formats booleans and numbers', () => {
    const [row] = diffBlocks(
      [{ type: 'featureGrid', ordered: false, items: [] }],
      [{ type: 'featureGrid', ordered: true, items: [] }],
    );
    expect(row.changes).toEqual([{ path: 'ordered', label: 'Numbered', before: 'No', after: 'Yes' }]);
  });

  it('compares rich text as plain text with word-level segments', () => {
    const [row] = diffBlocks(
      [text('<p>We open <strong>daily</strong> at nine &amp; close at five.</p>')],
      [text('<p>We open <strong>daily</strong> at ten &amp; close at five.</p>')],
    );
    const change = row.changes[0];
    expect(change.before).toBe('We open daily at nine & close at five.');
    expect(change.after).toBe('We open daily at ten & close at five.');
    expect(change.words).toEqual([
      { type: 'same', text: 'We open daily at' },
      { type: 'del', text: 'nine' },
      { type: 'add', text: 'ten' },
      { type: 'same', text: '& close at five.' },
    ]);
    expect(JSON.stringify(change)).not.toContain('<strong>');
  });

  it('keeps identical duplicate blocks apart and matches them in order', () => {
    const rows = diffBlocks([spacer(), spacer(), spacer()], [spacer(), spacer()]);
    expect(tags(rows)).toEqual(['unchanged', 'unchanged', 'removed']);
  });

  it('ignores props the editor derives (video provider and id)', () => {
    const a: Block = { type: 'videoEmbed', url: 'https://youtu.be/aaaaaaaaaaa', provider: 'youtube', videoId: 'aaaaaaaaaaa' };
    const b: Block = { type: 'videoEmbed', url: 'https://youtu.be/bbbbbbbbbbb', provider: 'youtube', videoId: 'bbbbbbbbbbb' };
    const [row] = diffBlocks([a], [b]);
    expect(row.changes.map((change) => change.path)).toEqual(['url']);
  });

  it('stays fast on 300 blocks', () => {
    const old = Array.from({ length: 300 }, (_, i) => text(`<p>para ${i}</p>`, `H${i}`));
    const next = [
      ...old.slice(0, 100),
      hero('inserted'),
      ...old.slice(101, 250).map((b, i) => (i === 3 ? { ...b, heading: 'edited' } : b)),
      ...old.slice(250),
    ];
    const start = performance.now();
    const rows = diffBlocks(old, next);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(rows.filter((row) => row.tag === 'changed')).toHaveLength(1);
    expect(rows.filter((row) => row.tag === 'removed' || row.tag === 'added').length).toBeGreaterThan(0);
  });
});

describe('htmlToText / diffWords', () => {
  it('strips tags, decodes entities once, and keeps literal escaped markup as text', () => {
    expect(htmlToText('<p>Fish &amp; chips</p><p>&lt;b&gt; &#8211; &#x41;</p>')).toBe('Fish & chips <b> – A');
    expect(htmlToText('<script>alert(1)</script><p>ok</p>')).toBe('ok');
  });

  it('returns one same segment for equal text and nothing for two empties', () => {
    expect(diffWords('a b', 'a b')).toEqual([{ type: 'same', text: 'a b' }]);
    expect(diffWords('', '')).toEqual([]);
  });

  it('shows insertions and deletions', () => {
    expect(diffWords('a b c', 'a c d')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'same', text: 'c' },
      { type: 'add', text: 'd' },
    ]);
  });
});

describe('diffRecord / diffTerms / diffDetails', () => {
  it('lists only keys that differ, with labels', () => {
    expect(diffRecord({ venue: 'Hall', when: '2026-01-01' }, { venue: 'Barn', when: '2026-01-01' }, { venue: 'Venue' })).toEqual([
      { key: 'venue', label: 'Venue', before: 'Hall', after: 'Barn', words: undefined },
    ]);
  });

  it('treats empty and missing as the same, and describes links', () => {
    expect(diffRecord({ a: '' }, {})).toEqual([]);
    const [row] = diffRecord({}, { book: { label: 'Book', href: '/x' } });
    expect(row.after).toBe('Label: Book; Link: /x');
  });

  it('names terms added and removed, ignoring case', () => {
    expect(diffTerms([{ name: 'News' }, { name: 'Old' }], [{ name: 'news' }, { name: 'New' }])).toEqual({
      added: ['New'],
      removed: ['Old'],
    });
  });

  const snap = (extra: Partial<Snapshot> = {}): Snapshot => ({ title: 'T', blocks: [], data: {}, seo: {}, terms: [], ...extra });

  it('gathers title, fields, SEO and terms; nothing when identical', () => {
    expect(diffDetails(snap(), snap())).toEqual([]);
    const rows = diffDetails(
      snap({ seo: { metaTitle: 'a', noindex: false }, terms: [{ name: 'News', kind: 'category' }] }),
      snap({
        title: 'T2',
        data: { venue: 'Barn' },
        seo: { metaTitle: 'b', noindex: true },
        terms: [
          { name: 'Events', kind: 'category' },
          { name: 'x', kind: 'tag' },
        ],
      }),
      { venue: 'Venue' },
    );
    expect(rows.map((row) => `${row.group}/${row.label}`)).toEqual([
      'Title/Title',
      'Fields/Venue',
      'Search and sharing/Meta title',
      'Search and sharing/Hidden from search engines',
      'Categories and tags/Categories',
      'Categories and tags/Tags',
    ]);
    expect(rows[3]).toMatchObject({ before: 'No', after: 'Yes' });
    expect(rows[4]).toMatchObject({ termsAdded: ['Events'], termsRemoved: ['News'] });
  });
});

describe('summarize', () => {
  it('counts', () => {
    expect(summarize([], 0)).toBe('No differences');
    const rows = diffBlocks([hero('A', { body: 'x' }), spacer()], [hero('A', { body: 'y' }), text('<p>z</p>')]);
    expect(summarize(rows, 1)).toBe('1 block changed, 1 added, 1 removed, 1 detail changed');
  });
});
