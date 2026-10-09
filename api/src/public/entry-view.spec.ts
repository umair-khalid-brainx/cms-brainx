import type { FieldDefinition } from '../content-types/field-definitions.js';
import { buildEntryFields, listingItem, mediaFilenames, type FileInfo } from './entry-view.js';

const ORIGIN = 'http://api.test';
const fields: FieldDefinition[] = [
  { key: 'summary', label: 'Summary', kind: 'text', required: false },
  { key: 'when', label: 'When', kind: 'date', required: false },
  { key: 'room', label: 'Room', kind: 'select', required: false, options: ['Hall'] },
  { key: 'photo', label: 'Photo', kind: 'media', required: false },
  { key: 'slides', label: 'Slides', kind: 'media', required: false },
  { key: 'register', label: 'Register', kind: 'link', required: false },
  { key: 'about', label: 'About', kind: 'richText', required: false },
  { key: 'old', label: 'Old', kind: 'text', required: false, hidden: true },
];
const files = new Map<string, FileInfo>([
  ['p-1.png', { mimetype: 'image/png', alt: 'A view of the harbour', title: 'Harbour' }],
  ['s-1.pdf', { mimetype: 'application/pdf', alt: null, title: null }],
]);
const data = {
  summary: 'A day out',
  when: '2026-11-02',
  room: 'Hall',
  photo: '/uploads/s/p-1.png',
  slides: '/uploads/s/s-1.pdf',
  register: { label: 'Book', href: 'https://x.com' },
  about: '<p>Hi</p>',
  old: 'hidden value',
};

describe('buildEntryFields', () => {
  it('shapes every kind, in the type’s order, with files as full addresses', () => {
    const shaped = buildEntryFields(fields, data, files, ORIGIN);

    expect(shaped.map((f) => f.key)).toEqual(['summary', 'when', 'room', 'photo', 'slides', 'register', 'about']);
    expect(shaped[3]).toMatchObject({
      kind: 'media',
      file: { url: 'http://api.test/uploads/s/p-1.png', name: 'Harbour', alt: 'A view of the harbour', isImage: true },
    });
    expect(shaped[4]).toMatchObject({ kind: 'media', file: { name: 's-1.pdf', alt: '', isImage: false, mimetype: 'application/pdf' } });
    expect(shaped[5]).toMatchObject({ kind: 'link', link: { label: 'Book', href: 'https://x.com' } });
  });

  it('leaves out hidden fields, empty values, and files no longer in the library', () => {
    const shaped = buildEntryFields(fields, { summary: '', when: null, photo: '/uploads/s/gone.png', old: 'x', register: { label: 'x', href: '' } }, files, ORIGIN);

    expect(shaped).toEqual([]);
  });

  it('copes with data that is missing or not an object', () => {
    for (const bad of [null, undefined, 'x', [1]]) expect(buildEntryFields(fields, bad, files, ORIGIN)).toEqual([]);
  });

  it('shows a value the way it was saved, without cleaning it again', () => {
    const html = '<p>kept <strong>as is</strong></p>';
    expect(buildEntryFields(fields, { about: html }, files, ORIGIN)[0]).toMatchObject({ kind: 'richText', html });
  });
});

describe('mediaFilenames', () => {
  it('lists the files of visible media fields only, once each', () => {
    expect(mediaFilenames(fields, { ...data, slides: '/uploads/s/p-1.png' })).toEqual(['p-1.png']);
    expect(mediaFilenames(fields, null)).toEqual([]);
  });
});

describe('listingItem', () => {
  const row = (extra = {}) => ({ title: 'Fair', path: '/events/fair', publishedAt: new Date('2026-10-01T10:00:00Z'), data, ...extra });

  it('gives the title, address, date, a short summary and the first picture', () => {
    expect(listingItem(row(), fields, files, ORIGIN)).toEqual({
      title: 'Fair',
      path: '/events/fair',
      publishedAt: '2026-10-01T10:00:00.000Z',
      summary: 'A day out',
      image: { url: 'http://api.test/uploads/s/p-1.png', alt: 'A view of the harbour' },
    });
  });

  it('cuts a long summary and never uses a document as the picture', () => {
    const long = listingItem(row({ data: { summary: 'word '.repeat(80), slides: '/uploads/s/s-1.pdf' } }), fields, files, ORIGIN);
    expect(long.summary!.length).toBeLessThanOrEqual(201);
    expect(long.summary!.endsWith('…')).toBe(true);
    expect(long.image).toBeNull();
  });

  it('copes with an entry that has no values or no publish date', () => {
    expect(listingItem(row({ data: {}, publishedAt: null }), fields, files, ORIGIN)).toMatchObject({
      publishedAt: null,
      summary: null,
      image: null,
    });
  });
});
