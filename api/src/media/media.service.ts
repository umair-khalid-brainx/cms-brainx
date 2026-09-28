import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { UserRepository } from '../users/user.repository.js';

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
    private readonly config: ConfigService,
  ) {}

  async store(userId: string, file: Express.Multer.File): Promise<{ url: string }> {
    const extension = ALLOWED_TYPES[file.mimetype];
    if (!extension) throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);

    // Same "caller's first membership" convention as ContentService — see its
    // resolveSiteId comment. Uploads happen from inside the editor, which
    // already carries that same limitation for content routes.
    const siteId = await this.resolveSiteId(userId);

    const uploadsRoot = this.config.get<string>('UPLOADS_DIR') ?? 'uploads';
    const siteDir = join(process.cwd(), uploadsRoot, siteId);
    await mkdir(siteDir, { recursive: true });

    // A random, unguessable filename is the tenant boundary here (ARCHITECTURE.md's
    // "a guessed URL must not cross tenants") — the /uploads static route itself
    // isn't auth-checked per request, so this is what keeps one tenant's files
    // from being enumerated via another's.
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(join(siteDir, filename), file.buffer);

    const publicUrl = this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4001';
    return { url: `${publicUrl}/uploads/${siteId}/${filename}` };
  }

  private async resolveSiteId(userId: string): Promise<string> {
    const user = await this.users.findByIdWithMemberships(userId);
    const membership = user?.memberships[0];
    if (!membership) throw new ForbiddenException('No site membership');
    return membership.siteId;
  }
}
