import { apiDelete, apiGet, apiSend } from './api';
import { getSession } from './auth';
import type { Term, TermKind } from './terms';

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');
  return token;
}

/** Every category and tag of the site with how many entries carry it (TAX-01). */
export function listTerms(): Promise<Term[]> {
  return apiGet('/terms', requireToken());
}

export function createTerm(kind: TermKind, name: string): Promise<Term> {
  return apiSend('POST', '/terms', { kind, name }, requireToken());
}

/** A rename changes the slug with the name; the API answers 409 when another term already has it. */
export function renameTerm(id: string, name: string): Promise<Term> {
  return apiSend('PATCH', `/terms/${encodeURIComponent(id)}`, { name }, requireToken());
}

export function deleteTerm(id: string): Promise<void> {
  return apiDelete(`/terms/${encodeURIComponent(id)}`, requireToken());
}
