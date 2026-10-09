// The same normalising the API does (api/src/content/slug.ts), so the editor can
// show what an address will become before it's saved. The API stays the authority.

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

/** Everything in a path before its last part: `/events` for `/events/fair`, '' for `/about`. */
export function parentPath(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}
