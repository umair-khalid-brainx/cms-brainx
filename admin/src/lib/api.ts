import { getActiveSiteId } from './activeSite';
import { clearSession } from './auth';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4001';

export class ApiError extends Error {
  status: number;
  /** The parsed error response, for callers that need more than `message` (e.g. a 422's problem list). */
  body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** `X-Site-Id` for the site the admin is in (MSI-01): the API acts on it after checking the caller belongs there. */
function siteHeader(): Record<string, string> {
  const siteId = getActiveSiteId();
  return siteId ? { 'X-Site-Id': siteId } : {};
}

type ErrorBody = { message?: string | string[] };

// A 401 on an authenticated call means the token itself is dead
// (expired/invalid) — never "wrong password", since that only happens on
// POST /auth/login, which never sends a token. Safe to treat as "session is
// over" and force a re-login.
function handleUnauthorized(status: number): void {
  if (status !== 401) return;
  clearSession();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

/** Unauthenticated POST — /auth/login and /invites/:token/accept; a 401 here means bad credentials, not a dead session. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handle<T>(response);
}

export async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, ...siteHeader() },
  });
  handleUnauthorized(response.status);
  return handle<T>(response);
}

/** Unauthenticated GET — for invite preview, reached before any session exists. */
export async function apiGetPublic<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  return handle<T>(response);
}

/** Authenticated POST/PATCH — for content writes, once a session exists. */
export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  body: unknown,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...siteHeader() },
    body: JSON.stringify(body),
  });
  handleUnauthorized(response.status);
  return handle<T>(response);
}

/** Authenticated multipart upload — no Content-Type set manually, so fetch adds the multipart boundary itself. */
export async function apiUpload<T>(
  path: string,
  body: FormData,
  accessToken: string,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...siteHeader() },
    body,
  });
  handleUnauthorized(response.status);
  return handle<T>(response);
}

/** Authenticated DELETE — no request body, no response body (204). */
export async function apiDelete(path: string, accessToken: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}`, ...siteHeader() },
  });
  handleUnauthorized(response.status);
  await handle<void>(response);
}

async function handle<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = (data ?? {}) as ErrorBody;
    const message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? 'Request failed');
    throw new ApiError(response.status, message, data);
  }
  return data as T;
}
