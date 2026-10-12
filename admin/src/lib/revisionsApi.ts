import { apiGet, apiSend } from './api';
import { getSession } from './auth';
import type { PageStatus } from './contentApi';
import type { Block } from './diffBlocks';
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

/** One version in full (GOV-02): what the compare screen lays side by side. */
export type RevisionDetail = RevisionSummary & {
  blocks: Block[];
  data: Record<string, unknown>;
  seo: Record<string, unknown>;
  terms: { id?: string; name: string; kind: 'category' | 'tag' }[];
};

export function getRevision(slug: string, id: string): Promise<RevisionDetail> {
  return apiGet<RevisionDetail>(`/content/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(id)}`, token());
}

/** The page as it is now, read the same way as a revision so the two compare directly ("Current version"). */
export type CurrentPage = {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  typeId: string | null;
  blocks: Block[];
  data: Record<string, unknown>;
  seo: Record<string, unknown>;
  terms: { name: string; kind: 'category' | 'tag' }[];
};

type ContentRecord = Omit<CurrentPage, 'terms'> & { categories?: { name: string }[]; tags?: { name: string }[] };

export async function getCurrentPage(slug: string): Promise<CurrentPage> {
  const record = await apiGet<ContentRecord>(`/content/${encodeURIComponent(slug)}`, token());
  const { categories = [], tags = [], ...rest } = record;
  return {
    ...rest,
    seo: (rest.seo ?? {}) as Record<string, unknown>,
    data: (rest.data ?? {}) as Record<string, unknown>,
    terms: [
      ...categories.map((term) => ({ name: term.name, kind: 'category' as const })),
      ...tags.map((term) => ({ name: term.name, kind: 'tag' as const })),
    ],
  };
}
