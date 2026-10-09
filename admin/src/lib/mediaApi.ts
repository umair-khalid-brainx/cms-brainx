import { apiDelete, apiGet, apiUpload } from './api';
import { getSession } from './auth';

export type MediaItem = {
  id: string;
  siteId: string;
  url: string;
  /** 400px WebP for PNG/JPEG/WebP uploads; null for SVG, GIF, video and pre-MED-01 files. */
  thumbnailUrl: string | null;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

/** What a grid should show: the small thumbnail when there is one, else the original. */
export function previewUrl(item: MediaItem): string {
  return item.thumbnailUrl ?? item.url;
}

/** A short format label for files that are shown as-is rather than thumbnailed. */
export function formatBadge(item: MediaItem): string | null {
  if (item.mimetype === 'image/gif') return 'GIF';
  if (item.mimetype === 'image/svg+xml') return 'SVG';
  return null;
}

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
