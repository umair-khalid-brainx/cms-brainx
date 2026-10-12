// Revision comparison (GOV-02): pure functions, no React, no fetching. D-063 has the reasoning.
//
// Saved blocks carry no id and the stored block contract must not change, so two block lists are aligned
// by sequence:
//
//   1. LCS (longest common subsequence, O(n*m)) over each block's EXACT key (the whole block, canonical
//      JSON). Blocks matched here are Unchanged.
//   2. Between those anchors, LCS again over a SOFT key: the block's type plus its main text (headline,
//      heading, quote, ...). A match here is the same block whose other props were edited: Changed.
//   3. Still unmatched in the same gap: LCS over the type alone. A block of the same type at the same
//      relative position whose text was edited is Changed, not Removed + Added.
//   4. Whatever is left is Removed (old side) or Added (new side).
//
// Moves: a reordered block is not tracked. Moving B above A shows as Removed + Added, because following a
// block across the page would need an id we deliberately don't store.

export type Block = { type: string } & Record<string, unknown>;

export type RowTag = 'added' | 'removed' | 'changed' | 'unchanged';

/** A piece of a word-level diff; render as a text node, never as HTML. */
export type WordSegment = { type: 'same' | 'add' | 'del'; text: string };

export type PropChange = {
  /** Machine path, e.g. `items[1].title`. */
  path: string;
  /** Plain language, e.g. `Items 2 › Title`. */
  label: string;
  /** null = empty / not there. */
  before: string | null;
  after: string | null;
  /** Present for rich text and longer text: the words that differ. */
  words?: WordSegment[];
};

export type BlockRow = {
  tag: RowTag;
  type: string;
  label: string;
  /** The block's main text, for telling two blocks of one type apart. */
  preview: string;
  oldIndex: number | null;
  newIndex: number | null;
  changes: PropChange[];
};

export const BLOCK_LABELS: Record<string, string> = {
  hero: 'Hero',
  richText: 'Rich text',
  imageText: 'Image and text',
  featureGrid: 'Feature grid',
  testimonial: 'Testimonial',
  cta: 'Call to action',
  logoCloud: 'Logo cloud',
  stats: 'Stats',
  faq: 'FAQ',
  spacer: 'Spacer',
  gallery: 'Gallery',
  pricingTable: 'Pricing table',
  teamGrid: 'Team grid',
  contactForm: 'Contact form',
  videoEmbed: 'Video',
};

const PROP_LABELS: Record<string, string> = {
  src: 'Image',
  alt: 'Alt text',
  href: 'Link',
  html: 'Content',
  fieldType: 'Field type',
  url: 'Video link',
  imagePosition: 'Image position',
  submitLabel: 'Button text',
  primaryAction: 'Primary button',
  secondaryAction: 'Secondary button',
  action: 'Button',
  ordered: 'Numbered',
};

/** Props the editor derives from another prop; reporting them next to their source would say it twice. */
const DERIVED_PROPS = new Set(['provider', 'videoId']);

/** Props that name a block, in order of preference. */
const MAIN_TEXT_PROPS = ['headline', 'heading', 'quote', 'title', 'name', 'url', 'html', 'attribution'];

function humanize(key: string): string {
  if (PROP_LABELS[key]) return PROP_LABELS[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function blockLabel(type: string): string {
  return BLOCK_LABELS[type] ?? humanize(type);
}

// ---------- text ----------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const TAG = /<\/?[a-z][^>]*>/i;

export function looksLikeHtml(value: string): boolean {
  return TAG.test(value);
}

/**
 * Stored rich text as plain text: block ends become spaces, tags are dropped, entities decoded (once, after
 * the tags are gone, so `&lt;b&gt;` stays the literal text "<b>"). The result is only ever shown as a text node.
 */
export function htmlToText(html: string): string {
  const withoutScripts = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const spaced = withoutScripts.replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|tr)>|<br\s*\/?>/gi, ' ');
  return decodeEntities(spaced.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Longest common subsequence of two sequences: pairs of matching indexes, in order. O(n*m). */
function lcs<T>(a: readonly T[], b: readonly T[]): [number, number][] {
  // A common start and end are matched outright: only the middle needs the table (a small edit to a long text).
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  if (head > 0 || tail > 0) {
    const middle = lcs(a.slice(head, a.length - tail), b.slice(head, b.length - tail)).map(([i, j]): [number, number] => [
      i + head,
      j + head,
    ]);
    const start = Array.from({ length: head }, (_, i): [number, number] => [i, i]);
    const end = Array.from({ length: tail }, (_, k): [number, number] => [a.length - tail + k, b.length - tail + k]);
    return [...start, ...middle, ...end];
  }
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return [];
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** Word-level diff of two plain texts (HTML is stripped first). Adjacent words of one kind form one segment. */
export function diffWords(before: string, after: string): WordSegment[] {
  const toWords = (value: string) => {
    const text = looksLikeHtml(value) ? htmlToText(value) : value;
    return text.split(/\s+/).filter(Boolean);
  };
  const a = toWords(before);
  const b = toWords(after);
  const segments: WordSegment[] = [];
  const push = (type: WordSegment['type'], word: string) => {
    const last = segments.at(-1);
    if (last && last.type === type) last.text += ` ${word}`;
    else segments.push({ type, text: word });
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...lcs(a, b), [a.length, b.length] as [number, number]]) {
    while (i < pi) push('del', a[i++]);
    while (j < pj) push('add', b[j++]);
    if (pi < a.length) {
      push('same', a[pi]);
      i = pi + 1;
      j = pj + 1;
    }
  }
  return segments;
}

// ---------- values ----------

type Leaf = string | number | boolean | null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Not set, or switched off: an optional yes/no that was never saved reads the same as one saved as No. */
const isOff = (value: unknown) => value === undefined || value === null || value === '' || value === false;

/** A leaf as the person reads it: null for empty, "Yes"/"No" for booleans, rich text as plain text. */
export function formatLeaf(value: Leaf | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') {
    const text = looksLikeHtml(value) ? htmlToText(value) : value;
    return text === '' ? null : text;
  }
  return String(value);
}

/** Any stored value as one line of text: for field values, which can be a link or a file, not only text. */
export function describeValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value.map(describeValue).filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (isPlainObject(value)) {
    const parts = Object.entries(value)
      .map(([key, inner]) => {
        const text = describeValue(inner);
        return text === null ? null : `${humanize(key)}: ${text}`;
      })
      .filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join('; ') : null;
  }
  return formatLeaf(value as Leaf);
}

/** Every leaf of a value under a readable path. Arrays are indexed from 1 in the label, from 0 in the path. */
function flatten(
  value: unknown,
  path: string,
  labels: string[],
  out: Map<string, { label: string; leaf: Leaf; rich: boolean }>,
  key: string,
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const next = [...labels];
      next[next.length - 1] = `${next[next.length - 1]} ${index + 1}`;
      flatten(item, `${path}[${index}]`, next, out, key);
    });
    return;
  }
  if (isPlainObject(value)) {
    for (const [name, inner] of Object.entries(value)) {
      if (DERIVED_PROPS.has(name) && labels.length === 1) continue;
      flatten(inner, path ? `${path}.${name}` : name, [...labels, humanize(name)], out, name);
    }
    return;
  }
  out.set(path, {
    label: labels.join(' › '),
    leaf: (value ?? null) as Leaf,
    rich: key === 'html' || (typeof value === 'string' && looksLikeHtml(value)),
  });
}

function leavesOf(block: Block) {
  const out = new Map<string, { label: string; leaf: Leaf; rich: boolean }>();
  const { type: _type, ...props } = block;
  for (const [name, value] of Object.entries(props)) {
    if (DERIVED_PROPS.has(name)) continue;
    flatten(value, name, [humanize(name)], out, name);
  }
  return out;
}

function textChange(path: string, label: string, before: string | null, after: string | null, rich: boolean): PropChange {
  const change: PropChange = { path, label, before, after };
  if (before !== null && after !== null && (rich || /\s/.test(before) || /\s/.test(after))) {
    change.words = diffWords(before, after);
  }
  return change;
}

/** Whether a rich-text value's stored markup differs: bold, a link or an address changed even if the words didn't. */
function richChanged(a: Block, b: Block): boolean {
  const left = leavesOf(a);
  const right = leavesOf(b);
  for (const [path, leaf] of right) {
    if (leaf.rich && typeof leaf.leaf === 'string' && left.get(path)?.leaf !== leaf.leaf) return true;
  }
  return false;
}

/** The props that differ between two blocks of one type, at leaf level. */
export function diffProps(a: Block, b: Block): PropChange[] {
  const left = leavesOf(a);
  const right = leavesOf(b);
  const paths = [...new Set([...right.keys(), ...left.keys()])];
  // Keep the new block's property order, then props only the old one had.
  const changes: PropChange[] = [];
  for (const path of paths) {
    const before = left.get(path);
    const after = right.get(path);
    const x = formatLeaf(before?.leaf);
    const y = formatLeaf(after?.leaf);
    if (x === y || (isOff(before?.leaf) && isOff(after?.leaf))) continue;
    changes.push(textChange(path, (after ?? before)!.label, x, y, Boolean(before?.rich || after?.rich)));
  }
  return changes;
}

// ---------- blocks ----------

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function mainText(block: Block): string {
  for (const name of MAIN_TEXT_PROPS) {
    const value = block[name];
    if (typeof value === 'string' && value.trim() !== '') return looksLikeHtml(value) ? htmlToText(value) : value.trim();
  }
  return '';
}

const PREVIEW_MAX = 70;

function previewOf(block: Block): string {
  const text = mainText(block);
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
}

/** Aligns two block lists and says what happened to each block. See the file comment for the algorithm. */
export function diffBlocks(oldBlocks: readonly Block[], newBlocks: readonly Block[]): BlockRow[] {
  const exact = (block: Block) => canonical(block);
  const soft = (block: Block) => `${block.type}\u0000${mainText(block)}`;
  const byType = (block: Block) => block.type;
  const keyFns = [exact, soft, byType];

  const rows: BlockRow[] = [];
  const row = (tag: RowTag, oldIndex: number | null, newIndex: number | null, changes: PropChange[] = []): BlockRow => {
    const block = (newIndex !== null ? newBlocks[newIndex] : oldBlocks[oldIndex!])!;
    return { tag, type: block.type, label: blockLabel(block.type), preview: previewOf(block), oldIndex, newIndex, changes };
  };

  function align(oStart: number, oEnd: number, nStart: number, nEnd: number, level: number) {
    const olds = oldBlocks.slice(oStart, oEnd);
    const news = newBlocks.slice(nStart, nEnd);
    if (level >= keyFns.length) {
      olds.forEach((_, i) => rows.push(row('removed', oStart + i, null)));
      news.forEach((_, j) => rows.push(row('added', null, nStart + j)));
      return;
    }
    const key = keyFns[level];
    const pairs = lcs(olds.map(key), news.map(key));
    let o = oStart;
    let n = nStart;
    for (const [pi, pj] of pairs) {
      align(o, oStart + pi, n, nStart + pj, level + 1);
      const oi = oStart + pi;
      const nj = nStart + pj;
      let changes = level === 0 ? [] : diffProps(oldBlocks[oi], newBlocks[nj]);
      // Same words, different stored content: bold, a link or its address changed. Not hidden as 'unchanged'.
      if (level > 0 && changes.length === 0 && richChanged(oldBlocks[oi], newBlocks[nj])) {
        changes = [{ path: '(formatting)', label: 'Formatting or links', before: 'as before', after: 'changed' }];
      }
      rows.push(row(changes.length === 0 ? 'unchanged' : 'changed', oi, nj, changes));
      o = oi + 1;
      n = nj + 1;
    }
    align(o, oEnd, n, nEnd, level + 1);
  }

  align(0, oldBlocks.length, 0, newBlocks.length, 0);
  return rows;
}

// ---------- the rows above the blocks ----------

export type DetailRow = {
  group: 'Title' | 'Fields' | 'Search and sharing' | 'Categories and tags';
  key: string;
  label: string;
  before: string | null;
  after: string | null;
  words?: WordSegment[];
  /** Terms only: names that were added / removed. */
  termsAdded?: string[];
  termsRemoved?: string[];
};

export type Snapshot = {
  title: string;
  blocks: Block[];
  data: Record<string, unknown>;
  seo: Record<string, unknown>;
  terms: { name: string; kind: 'category' | 'tag' }[];
};

export const SEO_LABELS: Record<string, string> = {
  metaTitle: 'Meta title',
  metaDescription: 'Meta description',
  canonicalUrl: 'Canonical address',
  ogTitle: 'Social title',
  ogDescription: 'Social description',
  ogImage: 'Social image',
  noindex: 'Hidden from search engines',
};

/** Keys whose value differs, in the order given by `keys`; `label` names each. */
export function diffRecord(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  labels: Record<string, string> = {},
  keys?: readonly string[],
): { key: string; label: string; before: string | null; after: string | null; words?: WordSegment[] }[] {
  const all = keys ?? [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const out: ReturnType<typeof diffRecord> = [];
  for (const key of all) {
    const before = describeValue(a[key]);
    const after = describeValue(b[key]);
    if (before === after || (isOff(a[key]) && isOff(b[key]))) continue;
    const change = textChange(key, labels[key] ?? humanize(key), before, after, false);
    out.push({ key, label: change.label, before, after, words: change.words });
  }
  return out;
}

/** Names added to and removed from a list of terms of one kind (matched by name, ignoring case). */
export function diffTerms(a: readonly { name: string }[], b: readonly { name: string }[]) {
  const norm = (name: string) => name.trim().toLowerCase();
  const had = new Set(a.map((term) => norm(term.name)));
  const has = new Set(b.map((term) => norm(term.name)));
  return {
    added: b.filter((term) => !had.has(norm(term.name))).map((term) => term.name),
    removed: a.filter((term) => !has.has(norm(term.name))).map((term) => term.name),
  };
}

const SEO_KEYS = Object.keys(SEO_LABELS);

/** Title, field values, SEO and terms: only what changed. `fieldLabels` maps a field key to its label. */
export function diffDetails(a: Snapshot, b: Snapshot, fieldLabels: Record<string, string> = {}): DetailRow[] {
  const rows: DetailRow[] = [];
  if (a.title !== b.title) {
    const change = textChange('title', 'Title', a.title || null, b.title || null, false);
    rows.push({ group: 'Title', key: 'title', label: 'Title', before: change.before, after: change.after, words: change.words });
  }
  const fieldKeys = [...new Set([...Object.keys(b.data ?? {}), ...Object.keys(a.data ?? {})])];
  for (const row of diffRecord(a.data ?? {}, b.data ?? {}, fieldLabels, fieldKeys)) rows.push({ group: 'Fields', ...row });
  for (const row of diffRecord(a.seo ?? {}, b.seo ?? {}, SEO_LABELS, SEO_KEYS))
    rows.push({ group: 'Search and sharing', ...row });
  for (const kind of ['category', 'tag'] as const) {
    const before = a.terms.filter((term) => term.kind === kind);
    const after = b.terms.filter((term) => term.kind === kind);
    const { added, removed } = diffTerms(before, after);
    if (added.length === 0 && removed.length === 0) continue;
    rows.push({
      group: 'Categories and tags',
      key: kind,
      label: kind === 'category' ? 'Categories' : 'Tags',
      before: before.map((term) => term.name).join(', ') || null,
      after: after.map((term) => term.name).join(', ') || null,
      termsAdded: added,
      termsRemoved: removed,
    });
  }
  return rows;
}

/** For the live region: "1 block changed, 2 added, 1 removed", or "No differences". */
export function summarize(rows: readonly BlockRow[], detailCount: number): string {
  const count = (tag: RowTag) => rows.filter((row) => row.tag === tag).length;
  const plural = (n: number) => `${n} block${n === 1 ? '' : 's'}`;
  const parts: string[] = [];
  if (count('changed')) parts.push(`${plural(count('changed'))} changed`);
  if (count('added')) parts.push(`${count('added')} added`);
  if (count('removed')) parts.push(`${count('removed')} removed`);
  if (detailCount) parts.push(`${detailCount} detail${detailCount === 1 ? '' : 's'} changed`);
  return parts.length > 0 ? parts.join(', ') : 'No differences';
}

/** A block's props as label/value lines, for showing an added, removed or unchanged block in full. */
export function blockProps(block: Block): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  for (const { label, leaf } of leavesOf(block).values()) {
    const value = formatLeaf(leaf);
    if (value !== null) lines.push({ label, value });
  }
  return lines;
}
