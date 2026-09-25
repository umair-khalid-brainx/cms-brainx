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

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handle<T>(response);
}

// A 401 here means the token itself is dead (expired/invalid) — never "wrong
// password", since that only happens on apiPost to /auth/login, which never
// sends a token. Safe to treat as "session is over" and force a re-login,
// which is the piece that was missing: nothing previously caught this at all.
export async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401) {
    clearSession();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
  return handle<T>(response);
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
