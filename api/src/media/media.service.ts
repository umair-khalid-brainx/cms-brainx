import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { UserRepository } from '../users/user.repository.js';
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
};

// Sits next to the original in the same site folder: <uuid>.png → <uuid>-thumb.webp.
function thumbnailFilenameFor(filename: string): string {
  return `${filename.slice(0, filename.lastIndexOf('.'))}-thumb.webp`;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly users: UserRepository,
    private readonly media: MediaRepository,
    private readonly config: ConfigService,
  ) {}

  async list(userId: string) {
    const siteId = await this.resolveSiteId(userId);
    return this.media.findManyBySite(siteId);
  }

  async store(userId: string, file: Express.Multer.File) {
    const extension = ALLOWED_TYPES[file.mimetype];
    if (!extension) throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);

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
      uploadedByUserId: userId,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const siteId = await this.resolveSiteId(userId);
    const record = await this.media.findById(siteId, id);
    if (!record) throw new NotFoundException('Media not found');

    await this.media.delete(siteId, id);
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
    const user = await this.users.findByIdWithMemberships(userId);
    const membership = user?.memberships[0];
    if (!membership) throw new ForbiddenException('No site membership');
    return membership.siteId;
  }
}
