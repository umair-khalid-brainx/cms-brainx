import { apiDelete, apiGet, apiSend, apiUpload } from './api';
import { getSession } from './auth';

export type MediaItem = {
  id: string;
  siteId: string;
  url: string;
  /** 400px WebP for PNG/JPEG/WebP uploads; null for SVG, GIF, video and pre-MED-01 files. */
  thumbnailUrl: string | null;
  /** Library text (MED-04). Alt is the default for pages that leave their own empty. */
  alt: string | null;
  title: string | null;
  description: string | null;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

type KindInfo = { label: string; extension: string; tone: 'pdf' | 'word' | 'excel' | null };

const KINDS: Record<string, KindInfo> = {
  'application/pdf': { label: 'PDF document', extension: 'PDF', tone: 'pdf' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    label: 'Word document',
    extension: 'DOCX',
    tone: 'word',
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    label: 'Excel spreadsheet',
    extension: 'XLSX',
    tone: 'excel',
  },
  'image/png': { label: 'PNG image', extension: 'PNG', tone: null },
  'image/jpeg': { label: 'JPEG image', extension: 'JPG', tone: null },
  'image/webp': { label: 'WebP image', extension: 'WEBP', tone: null },
  'image/gif': { label: 'GIF image', extension: 'GIF', tone: null },
  'image/svg+xml': { label: 'SVG image', extension: 'SVG', tone: null },
  'video/mp4': { label: 'MP4 video', extension: 'MP4', tone: null },
  'video/webm': { label: 'WebM video', extension: 'WEBM', tone: null },
};

/** The type as a person would say it, not as a MIME string. */
export function typeLabel(mimetype: string): string {
  return KINDS[mimetype]?.label ?? mimetype;
}

export const isImage = (item: Pick<MediaItem, 'mimetype'>) => item.mimetype.startsWith('image/');
export const isVideo = (item: Pick<MediaItem, 'mimetype'>) => item.mimetype.startsWith('video/');
/** Anything that is neither an image nor a video: PDF, Word, Excel. Shown as a file tile, never as a picture. */
export const isDocument = (item: Pick<MediaItem, 'mimetype'>) => !isImage(item) && !isVideo(item);

/** Label and colour family for a document's file tile. */
export function documentKind(mimetype: string): { extension: string; label: string; tone: 'pdf' | 'word' | 'excel' | null } {
  const kind = KINDS[mimetype];
  return kind ?? { extension: 'FILE', label: mimetype, tone: null };
}

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

export type MediaDetails = { alt?: string; title?: string; description?: string };

/** Alternative text, title and description. An empty string clears the field. */
export function updateMediaDetails(id: string, details: MediaDetails): Promise<MediaItem> {
  return apiSend('PATCH', `/media/${id}`, details, requireToken());
}

/** The types the library takes, for a file picker's `accept`. */
export const UPLOAD_ACCEPT =
  'image/*,video/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function deleteMedia(id: string): Promise<void> {
  return apiDelete(`/media/${id}`, requireToken());
}
