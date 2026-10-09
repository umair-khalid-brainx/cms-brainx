// The address prefix of a content type: the first part of every entry's address
// (`/events/summer-fair`). It is chosen by a client's staff, so the rules are
// strict, because the prefix becomes part of the public site's address space.

export const PREFIX_MIN = 2;
export const PREFIX_MAX = 40;

// One segment of lowercase letters and digits, hyphen-separated: no slashes, no
// dots, no uppercase, no leading or trailing hyphen.
export const PREFIX_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Addresses the platform or a later ticket already owns on every tenant's host.
// An entry at one of these could shadow it, so no type may take one.
export const RESERVED_PREFIXES: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'preview', // draft preview links (CNT-09)
  'internal', // web's revalidate hook (CNT-08)
  'uploads',
  'static',
  'assets',
  'category', // archive pages (TAX-02)
  'categories',
  'tag',
  'tags',
  'author',
  'authors',
  'search',
  'feed',
  'rss',
  'sitemap', // SEO-02
  'robots',
  'login',
  'home', // the home page's own slug
]);

/** Why a prefix can't be used, in words for the person typing it; null when it is fine. */
export function prefixProblem(prefix: string): string | null {
  if (prefix.length < PREFIX_MIN || prefix.length > PREFIX_MAX) {
    return `The address must be ${PREFIX_MIN} to ${PREFIX_MAX} characters long.`;
  }
  if (!PREFIX_PATTERN.test(prefix)) {
    return 'Use only lowercase letters, numbers and single hyphens, like "case-studies".';
  }
  if (RESERVED_PREFIXES.has(prefix)) {
    return `"${prefix}" is used by the site itself. Choose a different address.`;
  }
  return null;
}

/** "Case Studies!" becomes "case-studies": a starting suggestion, never applied silently. */
export function suggestPrefix(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, PREFIX_MAX)
    .replace(/-+$/, '');
}
