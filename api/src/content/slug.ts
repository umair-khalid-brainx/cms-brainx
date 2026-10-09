import { RESERVED_PREFIXES } from '../content-types/prefix.js';

// A page's or entry's slug: the last part of its address (`/about/our-team`). Always
// normalised here on the server, whatever the client sends (CNT-04).

export const SLUG_MAX = 80;

/** "Our Café & Team!" becomes "our-cafe-team"; '' when nothing usable is left. */
export function normaliseSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}

/**
 * Why a slug someone chose can't be used, in words for them; null when it is fine.
 * `page` is false for an entry: an entry sits under its type's prefix (`/events/...`),
 * so the site-level reserved words don't apply to it.
 */
export function slugProblem(slug: string, page: boolean): string | null {
  if (!slug) return 'The address needs at least one letter or number.';
  if (page && RESERVED_PREFIXES.has(slug)) return `"${slug}" is used by the site itself. Choose a different address.`;
  return null;
}
