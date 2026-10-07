import { apiDelete, apiGet, apiUpload } from './api';
import { getSession } from './auth';

export type MediaItem = {
  id: string;
  siteId: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');
  return token;
}

export function listMedia(): Promise<MediaItem[]> {
  return apiGet('/media', requireToken());
}

export function uploadMedia(file: File): Promise<MediaItem> {
  const body = new FormData();
  body.append('file', file);
  return apiUpload('/media', body, requireToken());
}

/** A page whose blocks still reference a media file. */
export type MediaUsage = { id: string; title: string; path: string; status: string };

/** Swaps the file's bytes, keeping its URL. Must be the same type as the original. */
export function replaceMedia(id: string, file: File): Promise<MediaItem> {
  const body = new FormData();
  body.append('file', file);
  return apiUpload(`/media/${id}`, body, requireToken(), 'PUT');
}

export function getMediaUsage(id: string): Promise<MediaUsage[]> {
  return apiGet(`/media/${id}/usage`, requireToken());
}

export function deleteMedia(id: string): Promise<void> {
  return apiDelete(`/media/${id}`, requireToken());
}
