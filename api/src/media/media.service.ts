import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ContentRepository } from '../content/content.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { MediaRepository } from './media.repository.js';

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

@Injectable()
export class MediaService {
  constructor(
    private readonly users: UserRepository,
    private readonly media: MediaRepository,
    private readonly content: ContentRepository,
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
    await writeFile(join(siteDir, filename), file.buffer);

    const publicUrl = this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4001';
    const url = `${publicUrl}/uploads/${siteId}/${filename}`;

    return this.media.create({
      siteId,
      url,
      filename,
      mimetype: file.mimetype,
      size: file.size,
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

    const { count } = await this.media.updateSize(siteId, id, file.size);
    if (count === 0) {
      // A Delete landed between the lookup and the rename: the rename just
      // put a file back on disk with no row behind it. Remove it again.
      await rm(finalPath, { force: true });
      throw new NotFoundException('Media not found');
    }
    return { ...record, size: file.size };
  }

  /** Pages whose blocks still reference this file — shown before Delete (B-12). */
  async usage(userId: string, id: string) {
    const siteId = await this.resolveSiteId(userId);
    const record = await this.media.findById(siteId, id);
    if (!record) throw new NotFoundException('Media not found');
    // Match on the host-independent part of the URL, so a page saved under a
    // different API_PUBLIC_URL still counts as using the file.
    return this.content.findReferencing(siteId, `/uploads/${siteId}/${record.filename}`);
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
