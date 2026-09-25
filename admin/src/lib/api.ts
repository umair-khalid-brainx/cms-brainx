import { clearSession } from './auth';

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4001';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

/** Unauthenticated POST — only /auth/login uses this; a 401 there means wrong password. */
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
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  handleUnauthorized(response.status);
  return handle<T>(response);
}

/** Authenticated POST/PATCH — for content writes, once a session exists. */
export async function apiSend<T>(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  handleUnauthorized(response.status);
  return handle<T>(response);
}

/** Authenticated DELETE — no request body, no response body (204). */
export async function apiDelete(path: string, accessToken: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  handleUnauthorized(response.status);
  await handle<void>(response);
}

async function handle<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = (data ?? {}) as ErrorBody;
    const message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? 'Request failed');
    throw new ApiError(response.status, message);
  }
  return data as T;
}
