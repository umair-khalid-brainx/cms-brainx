import { apiGet } from './api';
import { getSession } from './auth';

export type SubmissionSummary = {
  id: string;
  createdAt: string;
  pageTitle: string;
  pagePath: string;
  preview: string;
};

export type SubmissionPage = {
  items: SubmissionSummary[];
  nextCursor: string | null;
  total: number;
};

export type SubmissionAnswer = { name: string; label: string; value: string };

export type Submission = {
  id: string;
  createdAt: string;
  pageTitle: string;
  pagePath: string;
  answers: SubmissionAnswer[];
};

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');
  return token;
}

/** Newest first, 50 per page; pass the previous page's `nextCursor` for the next one. */
export function listSubmissions(after?: string): Promise<SubmissionPage> {
  const query = after ? `?after=${encodeURIComponent(after)}` : '';
  return apiGet(`/submissions${query}`, requireToken());
}

export function getSubmission(id: string): Promise<Submission> {
  return apiGet(`/submissions/${encodeURIComponent(id)}`, requireToken());
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
