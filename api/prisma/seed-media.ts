import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { makeThumbnail, thumbnailFilenameFor } from '../src/media/thumbnail.js';

// Files the seed puts in a site's media library (GOV-08b, DEP-03): copied from `prisma/seed-media/` into the
// uploads folder the API serves, with a library row, the same shape an upload through `POST /media` makes
// (MediaService.store): a random file name (the tenant boundary for `/uploads`), a 400px WebP thumbnail for
// pictures sharp can read, alt text and a title.

const SEED_MEDIA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'seed-media');

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

export type SeedMedia = {
  /** Path under `prisma/seed-media/`, e.g. `kestrel/logo.svg`. */
  file: string;
  /**
   * The library title. Also what makes a re-run find the row it made before, so the seed never adds the same
   * file twice: a title the owner changes since means the seed adds it again, which is the safe direction.
   */
  title: string;
  alt?: string;
  description?: string;
};

/** The library row for `media` on this site, made (file copied, thumbnail written) only if it isn't there yet. */
export async function ensureMedia(prisma: PrismaClient, siteId: string, uploaderId: string, media: SeedMedia) {
  const existing = await prisma.media.findFirst({ where: { siteId, title: media.title } });
  if (existing) return existing;

  const source = join(SEED_MEDIA_DIR, media.file);
  const extension = extname(media.file).toLowerCase();
  const mimetype = MIME_BY_EXTENSION[extension];
  if (!mimetype) throw new Error(`Seed media ${media.file}: unsupported type ${extension}`);

  const buffer = await readFile(source);
  const siteDir = join(process.cwd(), process.env.UPLOADS_DIR ?? 'uploads', siteId);
  const filename = `${randomUUID()}${extension === '.jpeg' ? '.jpg' : extension}`;
  const publicUrl = (process.env.API_PUBLIC_URL ?? 'http://localhost:4001').replace(/\/+$/, '');
  const thumbnail = await makeThumbnail(buffer, mimetype);
  const thumbnailUrl = thumbnail ? `${publicUrl}/uploads/${siteId}/${thumbnailFilenameFor(filename)}` : null;

  // The row first: if it can't be written, no file is left in the uploads folder with nothing pointing at it.
  const row = await prisma.media.create({
    data: {
      siteId,
      url: `${publicUrl}/uploads/${siteId}/${filename}`,
      thumbnailUrl,
      filename,
      mimetype,
      size: buffer.length,
      alt: media.alt ?? null,
      title: media.title,
      description: media.description ?? null,
      uploadedByUserId: uploaderId,
    },
  });
  try {
    await mkdir(siteDir, { recursive: true });
    await writeFile(join(siteDir, filename), buffer);
    if (thumbnail) await writeFile(join(siteDir, thumbnailFilenameFor(filename)), thumbnail);
  } catch (error) {
    await prisma.media.delete({ where: { id: row.id } });
    throw error;
  }
  return row;
}

/** How pages, settings and fields refer to a library file: the short `/uploads/<site>/<file>` form (TYP-02). */
export function mediaPath(siteId: string, filename: string): string {
  return `/uploads/${siteId}/${filename}`;
}
