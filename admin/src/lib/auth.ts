import type { Role } from './roles';

export type AuthenticatedUser = { id: string; email: string; name: string };
export type Membership = { siteId: string; siteName: string; siteSubdomain: string; role: Role };
export type Session = { accessToken: string; user: AuthenticatedUser; memberships: Membership[] };

const STORAGE_KEY = 'cms-admin.session';

// localStorage, not an httpOnly cookie — fine for this POC (one SPA, no XSS
// surface beyond what Vite/React already control); revisit if this ever
// serves untrusted content.
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Best-effort — private browsing / blocked storage shouldn't crash the app.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Replaces the stored user and memberships with fresh ones from the API,
 * keeping the token. Lets a subdomain rename (or a role change by someone
 * else) show up without logging out and back in.
 */
export function refreshSession(fresh: Pick<Session, 'user' | 'memberships'>): void {
  const session = getSession();
  if (!session) return;
  setSession({ ...session, user: fresh.user, memberships: fresh.memberships });
}
