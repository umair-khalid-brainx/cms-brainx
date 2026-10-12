import { normaliseSlug } from './slug';

// The rules for categories and tags (TAX-01), mirrored from api/src/taxonomy/term-rules.ts so the editor
// can say what is wrong before a request goes out. The API stays the authority.

export const TERM_NAME_MAX = 60;
export const MAX_TAGS_PER_ENTRY = 20;

export type TermKind = 'category' | 'tag';
export type TermRef = { id: string; name: string; slug: string };
export type Term = TermRef & { kind: TermKind; entryCount: number };

/** What was typed, tidied the way the API does: spaces collapsed, trimmed. */
export function tidyTermName(raw: string): string {
  return raw.split('\u0000').join('').replace(/\s+/g, ' ').trim();
}

/** Two names are the same term when their slugs are: "News" and "news" are one. */
export function termKey(name: string): string {
  return normaliseSlug(tidyTermName(name));
}

/** Why this name can't be used, in words for the person typing; null when it is fine. */
export function nameProblem(raw: string, kind: TermKind): string | null {
  const name = tidyTermName(raw);
  if (!name) return `Enter a name for the ${kind}.`;
  if (name.length > TERM_NAME_MAX) return `Keep the ${kind} name to ${TERM_NAME_MAX} characters or fewer.`;
  if (!termKey(name)) return `The ${kind} name needs at least one letter or number.`;
  return null;
}

/** Adds a tag unless the entry already has it (any case) or is at the limit. `problem` says why not. */
export function addTag(tags: readonly string[], raw: string): { tags: string[]; added: boolean; problem?: string } {
  const problem = nameProblem(raw, 'tag');
  if (problem) return { tags: [...tags], added: false, problem };
  const name = tidyTermName(raw);
  if (tags.some((tag) => termKey(tag) === termKey(name))) {
    return { tags: [...tags], added: false, problem: `“${name}” is already added.` };
  }
  if (tags.length >= MAX_TAGS_PER_ENTRY) {
    return { tags: [...tags], added: false, problem: `An entry can have at most ${MAX_TAGS_PER_ENTRY} tags.` };
  }
  return { tags: [...tags, name], added: true };
}

/** Adds several typed or pasted at once ("news, launch"); stops reporting at the first thing it could not add. */
export function addTags(tags: readonly string[], raw: string): { tags: string[]; problem?: string } {
  let current = [...tags];
  let problem: string | undefined;
  for (const piece of raw.split(',')) {
    if (!piece.trim()) continue;
    const result = addTag(current, piece);
    current = result.tags;
    problem ??= result.problem;
  }
  return { tags: current, problem };
}

export function removeTag(tags: readonly string[], name: string): string[] {
  return tags.filter((tag) => termKey(tag) !== termKey(name));
}

export function removeLastTag(tags: readonly string[]): string[] {
  return tags.slice(0, -1);
}

/** Existing tags that match what is typed (any case, anywhere in the name) and aren't on the entry yet. */
export function tagSuggestions(all: readonly string[], chosen: readonly string[], query: string, limit = 8): string[] {
  const needle = tidyTermName(query).toLowerCase();
  if (!needle) return [];
  const taken = new Set(chosen.map(termKey));
  return all.filter((name) => name.toLowerCase().includes(needle) && !taken.has(termKey(name))).slice(0, limit);
}

/** The same tags, in any order and any case: nothing to save. */
export function sameTags(a: readonly string[], b: readonly string[]): boolean {
  const keys = (list: readonly string[]) => list.map(termKey).sort().join('\n');
  return a.length === b.length && keys(a) === keys(b);
}

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
}

/** "3 entries", "1 entry". */
export function entriesLabel(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}
