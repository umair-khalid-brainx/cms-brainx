import type { Role } from './roles';

export type AuthenticatedUser = { id: string; email: string; name: string };
export type Membership = { siteId: string; siteName: string; role: Role };
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
