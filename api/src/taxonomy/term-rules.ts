import { normaliseSlug } from '../content/slug.js';

// The rules for categories and tags (TAX-01), kept free of the database so they can be tested alone.
// A term is identified by its slug, which is derived from its name: "News" and "news" are the same
// category, so the tag typed while tagging is matched without regard to case (D-060).

export const TERM_KINDS = ['category', 'tag'] as const;
export type TermKind = (typeof TERM_KINDS)[number];

export const TERM_NAME_MAX = 60;
/** More than this on one entry is a pile, not a label. */
export const MAX_TAGS_PER_ENTRY = 20;

export type TermInput = { name: string; slug: string };

export const KIND_LABEL: Record<TermKind, { one: string; many: string }> = {
  category: { one: 'category', many: 'categories' },
  tag: { one: 'tag', many: 'tags' },
};

/** What was typed, tidied: no NUL (Postgres refuses it), no line breaks, runs of spaces made one, trimmed. */
export function tidyTermName(raw: string): string {
  return raw
    .split('\u0000')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A usable name and its slug, or why not, in words for the person typing. */
export function parseTermName(raw: unknown, kind: TermKind): { ok: true; term: TermInput } | { ok: false; problem: string } {
  const label = KIND_LABEL[kind].one;
  if (typeof raw !== 'string') return { ok: false, problem: `Enter a name for the ${label}.` };
  const name = tidyTermName(raw);
  if (!name) return { ok: false, problem: `Enter a name for the ${label}.` };
  if (name.length > TERM_NAME_MAX) return { ok: false, problem: `Keep the ${label} name to ${TERM_NAME_MAX} characters or fewer.` };
  const slug = normaliseSlug(name);
  if (!slug) return { ok: false, problem: `The ${label} name needs at least one letter or number.` };
  return { ok: true, term: { name, slug } };
}

/**
 * The tags typed for one entry: each checked, repeats dropped (by slug, so "News" and "news" are one,
 * the first spelling kept), and no more than {@link MAX_TAGS_PER_ENTRY}.
 */
export function parseTagNames(raw: readonly unknown[]): { ok: true; tags: TermInput[] } | { ok: false; problems: string[] } {
  const tags = new Map<string, TermInput>();
  const problems: string[] = [];
  for (const entry of raw) {
    const parsed = parseTermName(entry, 'tag');
    if (!parsed.ok) problems.push(parsed.problem);
    else if (!tags.has(parsed.term.slug)) tags.set(parsed.term.slug, parsed.term);
  }
  if (problems.length > 0) return { ok: false, problems: [...new Set(problems)] };
  if (tags.size > MAX_TAGS_PER_ENTRY) return { ok: false, problems: [`An entry can have at most ${MAX_TAGS_PER_ENTRY} tags.`] };
  return { ok: true, tags: [...tags.values()] };
}

type OptIn = { name: string; hasCategories: boolean; hasTags: boolean };

/** Why this type can't take the kinds asked for, or null. A page (no type) can take neither. */
export function optInProblem(type: OptIn | null, wants: Record<TermKind, boolean>): string | null {
  if (!type) return wants.category || wants.tag ? 'Only entries of a content type can have categories and tags.' : null;
  if (wants.category && !type.hasCategories) return `${type.name} doesn’t use categories. Turn them on for the type first.`;
  if (wants.tag && !type.hasTags) return `${type.name} doesn’t use tags. Turn them on for the type first.`;
  return null;
}

/**
 * Whether every id asked for is a category of this site. `found` is what the site's own lookup returned
 * (it is scoped by site, so another site's id simply isn't there). Returns the ids, repeats dropped.
 */
export function checkCategoryIds(
  ids: readonly string[],
  found: readonly { id: string; kind: TermKind }[],
): { ok: true; ids: string[] } | { ok: false; problem: string } {
  const unique = [...new Set(ids)];
  const known = new Map(found.map((term) => [term.id, term.kind]));
  if (unique.some((id) => known.get(id) !== 'category')) {
    return { ok: false, problem: 'One of those categories doesn’t exist on this site. Reload and try again.' };
  }
  return { ok: true, ids: unique };
}
