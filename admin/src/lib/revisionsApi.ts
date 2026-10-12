import { apiGet, apiSend } from './api';
import { getSession } from './auth';
import type { RevisionSummary } from './revisions';

// The page's saved versions (GOV-01). The rules of what is kept live only in the API.

function token(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.accessToken;
}

/** The newest 50 versions of a page, newest first. */
export function listRevisions(slug: string): Promise<RevisionSummary[]> {
  return apiGet<RevisionSummary[]>(`/content/${encodeURIComponent(slug)}/revisions`, token());
}

export type RestoreResult = {
  restored: true;
  from: { id: string; createdAt: string; savedAt: string };
  /** Categories or tags in that version that have been deleted since, so they were left out. */
  droppedTerms: { name: string; kind: 'category' | 'tag' }[];
};

export function restoreRevision(slug: string, id: string): Promise<RestoreResult> {
  return apiSend<RestoreResult>(
    'POST',
    `/content/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(id)}/restore`,
    {},
    token(),
  );
}
