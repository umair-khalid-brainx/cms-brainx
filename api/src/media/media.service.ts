import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ContentRepository } from '../content/content.repository.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { UserRepository } from '../users/user.repository.js';
import type { UpdateMediaDto } from './dto/media.dto.js';
import { isDocumentType, matchesDocumentSignature } from './file-signature.js';
import { MediaRepository } from './media.repository.js';
import { InvalidImageError, makeThumbnail } from './thumbnail.js';

// Whitelist, not a denylist derived from the client-supplied filename — the
// stored extension always comes from this map, never from the upload's
// original name, so there's no path-traversal or extension-spoofing surface.
// Deliberately excludes anything executable; svg is allowed because it's only
// ever referenced from an <img src>, where browsers don't run embedded script.
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  // Documents (MED-04, req. 4). Checked against their first bytes, not just the
  // claimed type — see file-signature.ts.
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

/**
 * A readable title from the name the file was uploaded with ("Price list 2026.docx"
 * becomes "Price list 2026"), so the library isn't a wall of generated names. It is
 * only a starting point the person can edit; the stored file name stays our own.
 * Browsers send the name as UTF-8 bytes read as Latin-1, so it is decoded back.
 */
export function titleFromUploadName(originalName: string | undefined): string | null {
  if (!originalName) return null;
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  const base = decoded.split(/[\\/]/).pop() ?? '';
  const withoutExtension = base.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  const cleaned = Array.from(
    withoutExtension
      // Direction overrides can make "invoice\u202Efdp.exe" read as something else in the library.
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    // By code point, so a character outside the basic range is never cut in half.
    .slice(0, 200)
    .join('');
  return cleaned || null;
}

const REVALIDATE_BATCH = 10;

// Sits next to the original in the same site folder: <uuid>.png → <uuid>-thumb.webp.
function thumbnailFilenameFor(filename: string): string {
  return `${filename.slice(0, filename.lastIndexOf('.'))}-thumb.webp`;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly users: UserRepository,
    private readonly media: MediaRepository,
    private readonly content: ContentRepository,
    private readonly revalidation: RevalidationService,
    private readonly config: ConfigService,
  ) {}

  async list(userId: string) {
    const siteId = await this.resolveSiteId(userId);
    return this.media.findManyBySite(siteId);
  }

  async store(userId: string, file: Express.Multer.File) {
    const extension = ALLOWED_TYPES[file.mimetype];
    if (!extension) throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    this.assertGenuineDocument(file);

    // Same "caller's first membership" convention as ContentService — see its
    // resolveSiteId comment. Uploads happen from inside the editor, which
    // already carries that same limitation for content routes.
    const siteId = await this.resolveSiteId(userId);

    const siteDir = this.siteDir(siteId);
    await mkdir(siteDir, { recursive: true });

    // A random, unguessable filename is the tenant boundary here (ARCHITECTURE.md's
    // "a guessed URL must not cross tenants") — the /uploads static route itself
    // isn't auth-checked per request, so this is what keeps one tenant's files
    // from being enumerated via another's.
    const filename = `${randomUUID()}.${extension}`;

    // Generated before anything is written, so a file that fails to decode
    // leaves nothing behind on disk.
    let thumbnail: Buffer | null;
    try {
      thumbnail = await makeThumbnail(file.buffer, file.mimetype);
    } catch (error) {
      if (error instanceof InvalidImageError) throw new BadRequestException(error.message);
      throw error;
    }

    const publicUrl = this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4001';
    await writeFile(join(siteDir, filename), file.buffer);
    const url = `${publicUrl}/uploads/${siteId}/${filename}`;

    let thumbnailUrl: string | null = null;
    if (thumbnail) {
      const thumbnailFilename = thumbnailFilenameFor(filename);
      await writeFile(join(siteDir, thumbnailFilename), thumbnail);
      thumbnailUrl = `${publicUrl}/uploads/${siteId}/${thumbnailFilename}`;
    }

    return this.media.create({
      siteId,
      url,
      thumbnailUrl,
      filename,
      mimetype: file.mimetype,
      size: file.size,
      title: titleFromUploadName(file.originalname),
      uploadedByUserId: userId,
    });
  }

  /**
   * Swaps a file's bytes while keeping its URL, so every page using it picks
   * up the new file with no edits. Same mimetype only: the URL ends in the
   * original extension, and a .png URL serving JPEG bytes is a lie (MED-02).
   */
  async replace(userId: string, id: string, file: Express.Multer.File) {
    const siteId = await this.resolveSiteId(userId);
    const record = await this.media.findById(siteId, id);
    if (!record) throw new NotFoundException('Media not found');
    if (file.mimetype !== record.mimetype) {
      throw new BadRequestException(`Replacement must be the same type as the original (${record.mimetype})`);
    }

    this.assertGenuineDocument(file);

    // Same rule as store(): decode first, so a bad file leaves the old one untouched.
    let thumbnail: Buffer | null;
    try {
      thumbnail = await makeThumbnail(file.buffer, file.mimetype);
    } catch (error) {
      if (error instanceof InvalidImageError) throw new BadRequestException(error.message);
      throw error;
    }

    // Write beside the original, then rename over it: rename is atomic on one
    // filesystem, so a visitor mid-request gets the old file or the new one,
    // never a half-written one.
    const siteDir = this.siteDir(siteId);
    await mkdir(siteDir, { recursive: true });
    const tempPath = join(siteDir, `${randomUUID()}.tmp`);
    const finalPath = join(siteDir, record.filename);
    try {
      await writeFile(tempPath, file.buffer);
      await rename(tempPath, finalPath);
    } catch (error) {
      // The uploads folder is served publicly — don't leave a stray .tmp in it.
      await rm(tempPath, { force: true });
      throw error;
    }

    // The thumbnail is a separate file, so a replaced image would keep showing
    // the old picture in the library and picker without this (MED-01 x MED-02).
    let thumbnailUrl = record.thumbnailUrl;
    const thumbnailPath = join(siteDir, thumbnailFilenameFor(record.filename));
    if (thumbnail) {
      await writeFile(thumbnailPath, thumbnail);
      const publicUrl = this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4001';
      thumbnailUrl = `${publicUrl}/uploads/${siteId}/${thumbnailFilenameFor(record.filename)}`;
    }

    const { count } = await this.media.updateSize(siteId, id, file.size, thumbnailUrl);
    if (count === 0) {
      // A Delete landed between the lookup and the rename: the rename just
      // put a file back on disk with no row behind it. Remove it again.
      await rm(finalPath, { force: true });
      await rm(thumbnailPath, { force: true });
      throw new NotFoundException('Media not found');
    }
    return { ...record, size: file.size, thumbnailUrl };
  }

  /**
   * Alternative text, title and description (MED-04). A page that leaves an
   * image's own alt empty uses the library's on the live site, so changing it
   * here refreshes the live pages that use the file.
   */
  async updateDetails(userId: string, id: string, dto: UpdateMediaDto) {
    const membership = await this.resolveMembership(userId);
    const { siteId } = membership;
    const record = await this.media.findById(siteId, id);
    if (!record) throw new NotFoundException('Media not found');
    if (dto.alt !== undefined && dto.alt !== null && !record.mimetype.startsWith('image/')) {
      throw new BadRequestException('Alternative text is for images');
    }

    const { count } = await this.media.updateDetails(siteId, id, dto);
    if (count === 0) throw new NotFoundException('Media not found');

    if (dto.alt !== undefined && dto.alt !== record.alt) {
      const pages = await this.content.findReferencing(siteId, `/uploads/${siteId}/${record.filename}`);
      // A logo can sit on many pages and each refresh can take seconds if `web` is slow,
      // so they go in small parallel batches rather than one after another.
      const live = pages.filter((page) => page.status === 'published');
      for (let start = 0; start < live.length; start += REVALIDATE_BATCH) {
        await Promise.all(
          live.slice(start, start + REVALIDATE_BATCH).map((page) => this.revalidation.page(membership.site.subdomain, page.path)),
        );
      }
    }
    return this.media.findById(siteId, id);
  }

  /** Pages whose blocks still reference this file — shown before Delete (B-12). */
  async usage(userId: string, id: string) {
    const siteId = await this.resolveSiteId(userId);
    const record = await this.media.findById(siteId, id);
    if (!record) throw new NotFoundException('Media not found');
    // Match on the host-independent part of the URL, so a page saved under a
    // different API_PUBLIC_URL still counts as using the file.
    const pages = await this.content.findReferencing(siteId, `/uploads/${siteId}/${record.filename}`);
    // The site's logo is shown on every page, so it counts too (GOV-04): the warning before Delete says so.
    const logo = (await this.media.isSiteLogo(siteId, record.filename))
      ? [{ id: siteId, title: 'The site’s logo', path: '(every page)', status: 'published' }]
      : [];
    return [...logo, ...pages];
  }

  async remove(userId: string, id: string): Promise<void> {
    const membership = await this.resolveMembership(userId);
    const { siteId } = membership;
    const record = await this.media.findById(siteId, id);
    if (!record) throw new NotFoundException('Media not found');

    // A deleted logo is taken off the site and every page is refreshed, so no header keeps pointing at a missing file.
    const wasLogo = await this.media.isSiteLogo(siteId, record.filename);
    await this.media.delete(siteId, id);
    if (wasLogo) {
      await this.media.clearSiteLogo(siteId);
      await this.revalidation.site(membership.site.subdomain);
    }
    // Best-effort: the DB row is the source of truth for what the library
    // shows, so a leftover orphaned file if this fails isn't user-visible —
    // but it shouldn't fail the request either.
    await rm(join(this.siteDir(siteId), record.filename), { force: true });
    if (record.thumbnailUrl) await rm(join(this.siteDir(siteId), thumbnailFilenameFor(record.filename)), { force: true });
  }

  private siteDir(siteId: string): string {
    const uploadsRoot = this.config.get<string>('UPLOADS_DIR') ?? 'uploads';
    return join(process.cwd(), uploadsRoot, siteId);
  }

  private async resolveSiteId(userId: string): Promise<string> {
    return (await this.resolveMembership(userId)).siteId;
  }

  private async resolveMembership(userId: string) {
    const user = await this.users.findByIdWithMemberships(userId);
    const membership = user?.memberships[0];
    if (!membership) throw new ForbiddenException('No site membership');
    return membership;
  }

  private assertGenuineDocument(file: Express.Multer.File): void {
    if (isDocumentType(file.mimetype) && !matchesDocumentSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException("This file doesn't look like the kind of document it says it is");
    }
  }
}
