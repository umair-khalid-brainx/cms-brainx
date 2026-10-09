import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Data } from '@puckeditor/core';
import type { EditorComponents } from '../puck/config';
import { getPage, publishPage, saveDraft, type Page } from './contentApi';

// BLK-03 persistence tests. Dragging blocks on the Puck canvas can't be
// driven headlessly, but every canvas action (add, delete, reorder,
// duplicate) ends as a new `data.content` array handed to saveDraft /
// publishPage. These tests build that array the way Puck would, save it,
// reload the page, and check the editor gets back exactly what it saved.
//
// `fetch` is replaced by an in-memory stand-in for `PATCH /content/:slug` and
// `GET /content/:slug`, so what's tested is the real translation between
// Puck's shape and the stored `content.blocks` contract (D-015), plus the
// real JSON round trip — not a mock of it.

vi.mock('./auth', () => ({
  getSession: () => ({ accessToken: 'test-token', user: { id: 'u1', email: 'e@x.test', name: 'Editor' }, memberships: [] }),
  clearSession: vi.fn(),
}));

type StoredRecord = { slug: string; title: string; path: string; status: string; blocks: unknown[]; archivedAt: null };

let db: Map<string, StoredRecord>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fakeApi(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const slug = new URL(String(input)).pathname.replace(/^\/content\//, '');
  const record = db.get(slug);
  if (!record) return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
  if (init?.method === 'PATCH') {
    const body = JSON.parse(String(init.body)) as Partial<StoredRecord>;
    Object.assign(record, body);
  }
  // Re-parse so the caller never shares object identity with the "database".
  return Promise.resolve(jsonResponse(200, JSON.parse(JSON.stringify(record))));
}

function seed(slug: string, blocks: unknown[] = []): void {
  db.set(slug, { slug, title: slug, path: `/${slug}`, status: 'draft', blocks, archivedAt: null });
}

async function load(slug: string): Promise<Page> {
  const page = await getPage(slug);
  if (!page) throw new Error(`page ${slug} not found`);
  return page;
}

type Item = { type: string; props: Record<string, unknown> };

function items(data: Data<EditorComponents>): Item[] {
  return data.content as unknown as Item[];
}

function withContent(data: Data<EditorComponents>, content: Item[]): Data<EditorComponents> {
  return { ...data, content } as unknown as Data<EditorComponents>;
}

// What an editor can see of a block: its type and fields, not Puck's id.
function visible(data: Data<EditorComponents>): { type: string; props: Record<string, unknown> }[] {
  return items(data).map(({ type, props }) => {
    const { id: _id, ...rest } = props;
    return { type, props: rest };
  });
}

function ids(data: Data<EditorComponents>): unknown[] {
  return items(data).map((item) => item.props.id);
}

const hero = { type: 'hero', heading: 'Fresh oysters', subheading: 'Since 1902' };
const rich = { type: 'richText', html: '<p>Our story</p>' };
const faq = { type: 'faq', heading: 'Questions', items: [{ question: 'Open Sundays?', answer: 'Yes' }] };
const spacer = { type: 'spacer', size: 'md' };

beforeEach(() => {
  db = new Map();
  vi.stubGlobal('fetch', vi.fn(fakeApi));
});

describe('add', () => {
  it('a block added to an empty page is there after save and reload', async () => {
    seed('home');
    const page = await load('home');
    expect(items(page.data)).toEqual([]);

    const added = { type: 'Hero', props: { id: 'Hero-new', heading: 'Fresh oysters', subheading: 'Since 1902' } };
    await saveDraft('home', withContent(page.data, [added]));

    const reloaded = await load('home');
    expect(visible(reloaded.data)).toEqual([{ type: 'Hero', props: { heading: 'Fresh oysters', subheading: 'Since 1902' } }]);
  });

  it('a block dropped between two others keeps that position', async () => {
    seed('home', [hero, faq]);
    const page = await load('home');
    const [first, last] = items(page.data);

    const added = { type: 'RichText', props: { id: 'RichText-new', html: '<p>Our story</p>' } };
    await saveDraft('home', withContent(page.data, [first, added, last]));

    const reloaded = await load('home');
    expect(items(reloaded.data).map((i) => i.type)).toEqual(['Hero', 'RichText', 'Faq']);
  });
});

describe('delete', () => {
  it('a deleted block stays gone after save and reload, and the rest keep their order', async () => {
    seed('home', [hero, rich, faq]);
    const page = await load('home');
    const [first, , last] = items(page.data);

    await saveDraft('home', withContent(page.data, [first, last]));

    const reloaded = await load('home');
    expect(visible(reloaded.data).map((b) => b.type)).toEqual(['Hero', 'Faq']);
    expect(db.get('home')?.blocks).toEqual([hero, faq]);
  });

  it('deleting the last block saves an empty page, not the old one', async () => {
    seed('home', [hero]);
    const page = await load('home');

    await saveDraft('home', withContent(page.data, []));

    expect(items((await load('home')).data)).toEqual([]);
  });
});

describe('reorder', () => {
  it('a block dragged to a new position keeps that position after save and reload', async () => {
    seed('home', [hero, rich, faq, spacer]);
    const page = await load('home');
    const [a, b, c, d] = items(page.data);

    // Drag the FAQ (third) to the top.
    await saveDraft('home', withContent(page.data, [c, a, b, d]));

    const reloaded = await load('home');
    expect(visible(reloaded.data).map((x) => x.type)).toEqual(['Faq', 'Hero', 'RichText', 'Spacer']);
    expect(db.get('home')?.blocks).toEqual([faq, hero, rich, spacer]);
  });

  it('two blocks of the same type swapped keep their own fields', async () => {
    const one = { type: 'richText', html: '<p>One</p>' };
    const two = { type: 'richText', html: '<p>Two</p>' };
    seed('home', [one, two]);
    const page = await load('home');
    const [a, b] = items(page.data);

    await saveDraft('home', withContent(page.data, [b, a]));

    const reloaded = await load('home');
    expect(visible(reloaded.data).map((x) => x.props.html)).toEqual(['<p>Two</p>', '<p>One</p>']);
  });
});

describe('duplicate', () => {
  it('a duplicated block is two blocks after save and reload, each with its own id', async () => {
    seed('home', [hero, faq]);
    const page = await load('home');
    const [first, last] = items(page.data);

    // Puck's duplicate: same props, new id, inserted right after the original.
    const copy = { type: first.type, props: { ...first.props, id: 'Hero-copy' } };
    await saveDraft('home', withContent(page.data, [first, copy, last]));

    const reloaded = await load('home');
    const heroProps = { heading: 'Fresh oysters', subheading: 'Since 1902' };
    expect(visible(reloaded.data)).toEqual([
      { type: 'Hero', props: heroProps },
      { type: 'Hero', props: heroProps },
      { type: 'Faq', props: { heading: 'Questions', items: [{ question: 'Open Sundays?', answer: 'Yes' }] } },
    ]);
    // Puck keys blocks by id — two blocks sharing one would edit as one.
    expect(new Set(ids(reloaded.data)).size).toBe(3);
  });

  it('editing the duplicate after reload does not change the original', async () => {
    seed('home', [hero]);
    const page = await load('home');
    const [original] = items(page.data);
    await saveDraft('home', withContent(page.data, [original, { type: 'Hero', props: { ...original.props, id: 'Hero-copy' } }]));

    const reloaded = await load('home');
    const [a, b] = items(reloaded.data);
    await saveDraft('home', withContent(reloaded.data, [a, { ...b, props: { ...b.props, heading: 'Changed copy' } }]));

    expect(visible((await load('home')).data).map((x) => x.props.heading)).toEqual(['Fresh oysters', 'Changed copy']);
  });
});

describe('what gets stored', () => {
  it('stores the flat cms-blocks contract with no Puck ids in it', async () => {
    seed('home');
    const page = await load('home');

    await saveDraft('home', withContent(page.data, [{ type: 'Hero', props: { id: 'Hero-x', heading: 'Hi' } }]));

    expect(db.get('home')?.blocks).toEqual([{ type: 'hero', heading: 'Hi' }]);
  });

  it('every block reloads with an id unique on the page', async () => {
    seed('home', [hero, hero, rich, rich, faq]);
    const reloaded = await load('home');

    expect(new Set(ids(reloaded.data)).size).toBe(5);
    expect(ids(reloaded.data).every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });

  it('publish saves the current blocks and marks the page published', async () => {
    seed('home', [hero]);
    const page = await load('home');
    const [first] = items(page.data);
    const added = { type: 'Spacer', props: { id: 'Spacer-new', size: 'md' } };

    await publishPage('home', withContent(page.data, [added, first]));

    const reloaded = await load('home');
    expect(reloaded.status).toBe('published');
    expect(visible(reloaded.data).map((x) => x.type)).toEqual(['Spacer', 'Hero']);
  });

  it('pricing table features survive the { text } <-> string translation', async () => {
    const pricing = {
      type: 'pricingTable',
      heading: 'Plans',
      plans: [{ name: 'Basic', price: '$10', features: ['A dozen oysters', 'Shucking knife'], action: { label: 'Buy', href: '/buy' } }],
    };
    seed('home', [pricing]);

    const page = await load('home');
    const plans = items(page.data)[0].props.plans as { features: unknown }[];
    expect(plans[0].features).toEqual([{ text: 'A dozen oysters' }, { text: 'Shucking knife' }]);

    // Duplicate it so the translation runs on more than one block.
    const [first] = items(page.data);
    await saveDraft('home', withContent(page.data, [first, { type: first.type, props: { ...first.props, id: 'PT-copy' } }]));

    expect(db.get('home')?.blocks).toEqual([pricing, pricing]);
  });

  // Puck's component names and the stored `type` differ only in the first
  // letter's case. If they drift for one block, that block saves under a
  // name the public site doesn't know.
  it.each([
    ['Hero', 'hero'],
    ['RichText', 'richText'],
    ['ImageText', 'imageText'],
    ['FeatureGrid', 'featureGrid'],
    ['Testimonial', 'testimonial'],
    ['Cta', 'cta'],
    ['LogoCloud', 'logoCloud'],
    ['Stats', 'stats'],
    ['Faq', 'faq'],
    ['Spacer', 'spacer'],
    ['Gallery', 'gallery'],
    ['PricingTable', 'pricingTable'],
    ['TeamGrid', 'teamGrid'],
    ['ContactForm', 'contactForm'],
  ])('%s is stored as "%s" and loads back as %s', async (puckType, storedType) => {
    seed('home');
    const page = await load('home');

    await saveDraft('home', withContent(page.data, [{ type: puckType, props: { id: 'x', heading: 'H' } }]));

    expect(db.get('home')?.blocks).toEqual([{ type: storedType, heading: 'H' }]);
    expect(items((await load('home')).data)[0].type).toBe(puckType);
  });
});
