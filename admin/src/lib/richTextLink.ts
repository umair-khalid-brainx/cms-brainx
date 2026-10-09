// Turns what a person typed into the link box into an address the page can
// safely link to, or null if it can't be one. Only web, email, in-page and
// same-site addresses are allowed, the same set the API's sanitiser keeps
// (BLK-05) — `javascript:` and friends are refused here so the editor never
// offers something the server would silently strip.
export function normaliseHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  // `//host` and `/\host` look relative but point at another site, and the API
  // drops them; a backslash is never part of an address the editor should keep.
  if (/^\/[\\/]/.test(value) || value.includes('\\')) return null;
  // Something must follow the scheme: a bare "https://" is not an address.
  if (/^(https?:\/\/|mailto:)./i.test(value) || /^\/[^/\\]/.test(value) || /^#./.test(value) || value === '/') return value;
  // "example.com/about" typed without a scheme: assume https.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value)) return `https://${value}`;
  return null;
}
