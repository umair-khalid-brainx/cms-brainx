import { apiDelete, apiGet, apiSend } from './api';
import { getSession } from './auth';

/** A site's redirect (GOV-05): `auto` ones were made when a published page moved. */
export type Redirect = {
  id: string;
  fromPath: string;
  /** A path on this site, or a full https:// address. */
  toPath: string;
  source: 'manual' | 'auto';
  createdAt: string;
  createdBy: string | null;
};

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');
  return token;
}

export function listRedirects(): Promise<Redirect[]> {
  return apiGet('/redirects', requireToken());
}

/** The API normalises both addresses and refuses, with a message, what can't work. */
export function createRedirect(fromPath: string, toPath: string): Promise<Redirect> {
  return apiSend('POST', '/redirects', { fromPath, toPath }, requireToken());
}

export function deleteRedirect(id: string): Promise<void> {
  return apiDelete(`/redirects/${encodeURIComponent(id)}`, requireToken());
}
