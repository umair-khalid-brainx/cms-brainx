// The rules for a site's redirects (GOV-05), as pure functions over its current list,
// so each one can be tested without a database:
// - never a chain: every redirect points straight at its final address;
// - never a loop: a redirect that would lead back to its own address is refused;
// - a page always wins: an address a page now has can't redirect anywhere (the service
//   removes those before adding anything).

export const REDIRECT_PATH_MAX = 500;

export type RedirectRow = { fromPath: string; toPath: string };

/**
 * A path on the site: `/old-page`, lowercase, no trailing slash, no query or fragment, and
 * only printable ASCII once percent-encoding is decoded, as page addresses are (slugs are
 * ASCII). Null when it isn't one. Stored and looked up in this one form, so `/Old-Page/`
 * and `/old%2Dpage` find the same redirect.
 */
export function normaliseRedirectPath(input: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(input.trim()).toLowerCase();
  } catch {
    return null;
  }
  if (!path.startsWith('/') || path.length > REDIRECT_PATH_MAX) return null;
  if (!/^[\x21-\x7e]+$/.test(path) || /[?#\\]/.test(path) || path.includes('//')) return null;
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** Where a redirect may point: a path on the site, or a full http(s) address elsewhere. Null when it's neither. */
export function normaliseRedirectTarget(input: string): string | null {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return value.length <= REDIRECT_PATH_MAX && url.hostname ? url.toString() : null;
    } catch {
      return null;
    }
  }
  return normaliseRedirectPath(value);
}

export type RedirectPlan =
  | { ok: true; to: string; rewrites: RedirectRow[] }
  | { ok: false; problem: string };

/**
 * What adding `from → to` does to the existing list: the address it really points at (one
 * step further if `to` itself redirects) and the existing redirects that pointed at `from`,
 * which now point there too. Refused when it would lead back to `from`. (A rename back to
 * an old address never gets here as a loop: the page now at that address removes its
 * redirect first.)
 */
export function planRedirect(existing: readonly RedirectRow[], from: string, to: string): RedirectPlan {
  if (from === to) return { ok: false, problem: 'A redirect can’t point at its own address.' };
  // The list never has chains, so one step finds the end.
  const finalTo = existing.find((row) => row.fromPath === to)?.toPath ?? to;
  if (finalTo === from) return { ok: false, problem: `${to} already redirects back to ${from}, which would make a loop.` };

  // Nothing that points at `from` can be `finalTo` itself: that would be the loop refused above.
  const rewrites = existing
    .filter((row) => row.toPath === from && row.fromPath !== from)
    .map((row) => ({ fromPath: row.fromPath, toPath: finalTo }));
  return { ok: true, to: finalTo, rewrites };
}
