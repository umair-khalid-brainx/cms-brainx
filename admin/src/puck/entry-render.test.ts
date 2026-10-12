import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EntryHeader, EntryList, RelatedEntries, TermArchive, formatDate, termHref, type EntryView, type TermArchiveView, type TypeListing } from 'cms-blocks';

// The public site's entry header and listing (TYP-03) live in cms-blocks, which has no
// test runner of its own; they are rendered here the way `web` renders them.

const entry = (fields: EntryView['fields'], extra: Partial<EntryView> = {}): EntryView => ({
  type: { name: 'Events', singularName: 'Event', prefix: 'events' },
  author: 'Ada Lovelace',
  publishedAt: '2026-10-09T14:41:26.661Z',
  fields,
  ...extra,
});
const header = (e: EntryView) => renderToStaticMarkup(createElement(EntryHeader, { title: 'Summer fair', entry: e }));

describe('formatDate', () => {
  it('writes a date or a timestamp in words, the same day in every time zone', () => {
    expect(formatDate('2026-11-02')).toBe('November 2, 2026');
    expect(formatDate('2026-11-02T23:30:00Z')).toBe('November 2, 2026');
    expect(formatDate(null)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});

describe('EntryHeader', () => {
  const all: EntryView['fields'] = [
    { key: 'photo', label: 'Photo', kind: 'media', file: { url: 'http://api/uploads/s/p.jpg', name: 'p', alt: 'The fair', mimetype: 'image/jpeg', isImage: true } },
    { key: 'summary', label: 'Summary', kind: 'text', text: 'A short line' },
    { key: 'venue', label: 'Venue', kind: 'text', text: 'Main hall' },
    { key: 'when', label: 'When', kind: 'date', date: '2026-11-02' },
    { key: 'room', label: 'Room', kind: 'select', text: 'Hall' },
    { key: 'slides', label: 'Slides', kind: 'media', file: { url: 'http://api/uploads/s/s.pdf', name: 's', alt: '', mimetype: 'application/pdf', isImage: false } },
    { key: 'book', label: 'Book', kind: 'link', link: { label: 'Book a seat', href: 'https://x.com/book' } },
    { key: 'about', label: 'About', kind: 'richText', html: '<p>Hello <strong>there</strong></p>' },
  ];

  it('shows the title, author, date, lead picture, facts, actions and body, each as what it is', () => {
    const html = header(entry(all));

    expect(html).toContain('<h1');
    expect(html).toContain('Summer fair');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('October 9, 2026');
    expect(html).toContain('src="http://api/uploads/s/p.jpg"');
    expect(html).toContain('alt="The fair"');
    expect(html).toContain('Main hall');
    expect(html).toContain('November 2, 2026');
    expect(html).toContain('href="https://x.com/book"');
    expect(html).toContain('Book a seat');
    expect(html).toContain('Slides (PDF)');
    expect(html).toContain('href="http://api/uploads/s/s.pdf"');
    expect(html).toContain('<strong>there</strong>');
    expect(html).toContain('href="/events"');
  });

  it('leads with an excerpt or summary instead of listing it as a fact', () => {
    const html = header(entry(all));
    expect(html).toContain('A short line');
    expect(html).not.toContain('>Summary<'); // not a label in the facts list
    expect(html).toContain('>Venue<'); // an ordinary short text is a fact
  });

  it('also leads with any long text', () => {
    const long = 'x'.repeat(120);
    expect(header(entry([{ key: 'note', label: 'Note', kind: 'text', text: long }]))).not.toContain('>Note<');
  });

  it('does not make an empty body column when there is no formatted text', () => {
    const html = header(entry([{ key: 'venue', label: 'Venue', kind: 'text', text: 'Main hall' }]));
    expect(html).toContain('Main hall');
    expect(html).not.toContain('lg:grid-cols');
  });

  it('copes with an entry that has no fields, no author and no date', () => {
    const html = header(entry([], { author: null, publishedAt: null }));
    expect(html).toContain('Summer fair');
    expect(html).not.toContain('<time');
  });

  it('uses the library’s words for a picture’s alt, and nothing when there are none', () => {
    const noAlt: EntryView['fields'] = [{ key: 'p', label: 'P', kind: 'media', file: { url: 'u', name: 'p', alt: '', mimetype: 'image/png', isImage: true } }];
    expect(header(entry(noAlt))).toContain('alt=""');
  });

  it('takes colours only from the site’s theme variables', () => {
    expect(header(entry(all))).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('EntryList', () => {
  const listing = (entries: TypeListing['entries']): TypeListing => ({
    type: { name: 'Events', singularName: 'Event', prefix: 'events' },
    entries,
  });
  const render = (l: TypeListing) => renderToStaticMarkup(createElement(EntryList, { listing: l }));

  it('lists entries in the order given, each linking to its page, with date, summary and picture', () => {
    const html = render(
      listing([
        { title: 'Newest', path: '/events/newest', publishedAt: '2026-10-02T00:00:00Z', summary: 'S1', image: { url: 'http://api/a.jpg', alt: 'A' } },
        { title: 'Older', path: '/events/older', publishedAt: null, summary: null, image: null },
      ]),
    );

    expect(html.indexOf('Newest')).toBeLessThan(html.indexOf('Older'));
    expect(html).toContain('href="/events/newest"');
    expect(html).toContain('October 2, 2026');
    expect(html).toContain('S1');
    expect(html).toContain('src="http://api/a.jpg"');
    expect((html.match(/<img/g) ?? []).length).toBe(1);
  });

  it('says so when nothing is published', () => {
    expect(render(listing([]))).toContain('Nothing has been published here yet.');
  });
});

describe('termHref (TAX-02)', () => {
  it('is /category/<slug> or /tag/<slug>, with /page/N after the first page', () => {
    expect(termHref('category', 'news')).toBe('/category/news');
    expect(termHref('tag', 'q4-report', 1)).toBe('/tag/q4-report');
    expect(termHref('tag', 'q4-report', 3)).toBe('/tag/q4-report/page/3');
  });
});

describe('EntryHeader terms (TAX-02)', () => {
  it('shows categories and tags as links to their archives, in lists named for what they are', () => {
    const html = header(entry([], { categories: [{ name: 'News', slug: 'news' }], tags: [{ name: 'Q4 Report', slug: 'q4-report' }, { name: 'Launch', slug: 'launch' }] }));
    expect(html).toContain('aria-label="Categories"');
    expect(html).toContain('href="/category/news"');
    expect(html).toContain('aria-label="Tags"');
    expect(html).toContain('href="/tag/q4-report"');
    expect(html).toContain('href="/tag/launch"');
    expect(html).toContain('Q4 Report');
  });

  it('shows no empty list when there are none, or when the answer predates terms', () => {
    for (const html of [header(entry([], { categories: [], tags: [] })), header(entry([]))]) {
      expect(html).not.toContain('aria-label="Categories"');
      expect(html).not.toContain('aria-label="Tags"');
    }
  });

  it('takes colours only from the site’s theme variables', () => {
    const html = header(entry([], { categories: [{ name: 'News', slug: 'news' }], tags: [{ name: 'Launch', slug: 'launch' }] }));
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/(?:bg|text|border|outline|decoration)-(?:red|blue|gray|slate|zinc|neutral|stone|white|black)/);
  });
});

describe('RelatedEntries (TAX-02)', () => {
  const related = [
    { title: 'Next one', path: '/blog/next-one', publishedAt: '2026-10-02T00:00:00Z', summary: 'S1', image: { url: 'http://api/a.jpg', alt: 'A' } },
    { title: 'Another', path: '/blog/another', publishedAt: null, summary: null, image: null },
  ];
  const render = (entries: Parameters<typeof RelatedEntries>[0]['entries']) => renderToStaticMarkup(createElement(RelatedEntries, { entries }));

  it('shows a Related heading and a card per entry, each linking to it, in the order given', () => {
    const html = render(related);
    expect(html).toContain('>Related<');
    expect(html.indexOf('Next one')).toBeLessThan(html.indexOf('Another'));
    expect(html).toContain('href="/blog/next-one"');
    expect(html).toContain('October 2, 2026');
    expect(html).toContain('src="http://api/a.jpg"');
  });

  it('is absent when there is nothing related', () => {
    expect(render([])).toBe('');
    expect(render(undefined)).toBe('');
  });

  it('takes colours only from the site’s theme variables', () => {
    expect(render(related)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('TermArchive (TAX-02)', () => {
  const archive = (extra: Partial<TermArchiveView> = {}): TermArchiveView => ({
    term: { name: 'News', slug: 'news', kind: 'category' },
    entries: [{ title: 'Newest', path: '/blog/newest', publishedAt: '2026-10-02T00:00:00Z', summary: 'S1', image: null }],
    page: 1,
    pageCount: 1,
    total: 1,
    ...extra,
  });
  const render = (a: TermArchiveView) => renderToStaticMarkup(createElement(TermArchive, { archive: a }));

  it('names the term in the heading and lists its entries as the type listing does', () => {
    const html = render(archive());
    expect(html).toMatch(/<h1[^>]*>Category: (<!-- -->)?News/);
    expect(html).toContain('href="/blog/newest"');
    expect(html).toContain('S1');
    expect(html).not.toContain('aria-label="Pages"');
  });

  it('says Tag for a tag, and says so when nothing is published under it', () => {
    const html = render(archive({ term: { name: 'Launch', slug: 'launch', kind: 'tag' }, entries: [], total: 0 }));
    expect(html).toMatch(/Tag: (<!-- -->)?Launch/);
    expect(html).toContain('Nothing has been published under this tag yet.');
  });

  it('pages: the middle page links both ways, the first only onward, the last only back', () => {
    const middle = render(archive({ page: 2, pageCount: 3 }));
    expect(middle).toContain('href="/category/news"'); // newer: page 1 has no /page/1
    expect(middle).toContain('href="/category/news/page/3"');
    expect(middle).toContain('Page 2 of 3');
    const first = render(archive({ page: 1, pageCount: 2 }));
    expect(first).toContain('href="/category/news/page/2"');
    expect(first).not.toContain('rel="prev"');
    const last = render(archive({ page: 2, pageCount: 2 }));
    expect(last).toContain('rel="prev"');
    expect(last).not.toContain('rel="next"');
  });

  it('takes colours only from the site’s theme variables', () => {
    expect(render(archive({ pageCount: 2 }))).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
