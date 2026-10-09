import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import type { ContentRepository } from '../content/content.repository.js';
import type { UserRepository } from '../users/user.repository.js';
import type { MediaRepository } from './media.repository.js';
import { MediaService } from './media.service.js';

const SITE = 'site-1';
const THUMB = 'abc-thumb.webp';
const RECORD = {
  id: 'media-1',
  siteId: SITE,
  url: `http://localhost:4001/uploads/${SITE}/abc.png`,
  filename: 'abc.png',
  mimetype: 'image/png',
  size: 3,
  thumbnailUrl: `http://localhost:4001/uploads/${SITE}/abc-thumb.webp`,
  createdAt: new Date(),
  uploadedBy: { id: 'user-1', name: 'Ada' },
};

function png(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } } })
    .png()
    .toBuffer();
}

async function imageFile(width = 800, height = 600) {
  const buffer = await png(width, height);
  return { mimetype: 'image/png', buffer, size: buffer.length } as Express.Multer.File;
}

function file(mimetype: string, contents: string) {
  const buffer = Buffer.from(contents);
  return { mimetype, buffer, size: buffer.length } as Express.Multer.File;
}

describe('MediaService', () => {
  let uploadsRoot: string;
  let service: MediaService;
  let media: { findById: ReturnType<typeof vi.fn>; updateSize: ReturnType<typeof vi.fn> };
  let content: { findReferencing: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    uploadsRoot = await mkdtemp(join(tmpdir(), 'media-spec-'));
    await mkdir(join(uploadsRoot, SITE));
    await writeFile(join(uploadsRoot, SITE, RECORD.filename), 'old');
    await writeFile(join(uploadsRoot, SITE, THUMB), 'old thumb');

    const users = { findByIdWithMemberships: vi.fn(async () => ({ memberships: [{ siteId: SITE }] })) };
    media = {
      // Scoped like the real repository: another site's id finds nothing.
      findById: vi.fn(async (siteId: string, id: string) => (siteId === SITE && id === RECORD.id ? RECORD : null)),
      updateSize: vi.fn(async () => ({ count: 1 })),
    };
    content = { findReferencing: vi.fn(async () => [{ id: 'c1', title: 'Home', path: 'home', status: 'published' }]) };
    // MediaService joins UPLOADS_DIR onto cwd, so it has to be relative.
    const uploadsDir = relative(process.cwd(), uploadsRoot);
    const config = { get: (key: string) => (key === 'UPLOADS_DIR' ? uploadsDir : undefined) };

    service = new MediaService(
      users as unknown as UserRepository,
      media as unknown as MediaRepository,
      content as unknown as ContentRepository,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => rm(uploadsRoot, { recursive: true, force: true }));

  describe('replace', () => {
    it('overwrites the file in place, keeping its URL, and records the new size', async () => {
      const upload = await imageFile();
      const result = await service.replace('user-1', RECORD.id, upload);

      expect(result.url).toBe(RECORD.url);
      expect(result.size).toBe(upload.size);
      expect(await readFile(join(uploadsRoot, SITE, RECORD.filename))).toEqual(upload.buffer);
      expect(media.updateSize).toHaveBeenCalledWith(SITE, RECORD.id, upload.size, RECORD.thumbnailUrl);
      // No temp file left behind: just the original and its thumbnail.
      expect((await readdir(join(uploadsRoot, SITE))).sort()).toEqual([THUMB, RECORD.filename].sort());
    });

    it('regenerates the thumbnail so the library stops showing the old picture', async () => {
      await service.replace('user-1', RECORD.id, await imageFile(1600, 900));

      const meta = await sharp(join(uploadsRoot, SITE, THUMB)).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(400);
    });

    it('refuses an undecodable image and leaves the original and its thumbnail untouched', async () => {
      await expect(service.replace('user-1', RECORD.id, file('image/png', 'not a png'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(await readFile(join(uploadsRoot, SITE, RECORD.filename), 'utf8')).toBe('old');
      expect(await readFile(join(uploadsRoot, SITE, THUMB), 'utf8')).toBe('old thumb');
      expect(media.updateSize).not.toHaveBeenCalled();
    });

    it('rejects a different type and leaves the original untouched', async () => {
      await expect(service.replace('user-1', RECORD.id, file('image/jpeg', 'jpeg'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(await readFile(join(uploadsRoot, SITE, RECORD.filename), 'utf8')).toBe('old');
      expect(media.updateSize).not.toHaveBeenCalled();
    });

    it('removes the file again and 404s if the row was deleted mid-replace', async () => {
      media.updateSize.mockResolvedValueOnce({ count: 0 });

      await expect(service.replace('user-1', RECORD.id, await imageFile())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(await readdir(join(uploadsRoot, SITE))).toEqual([]);
    });

    it('404s for a file that is not in the caller’s site', async () => {
      await expect(service.replace('user-1', 'other-site-media', await imageFile())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('usage', () => {
    it('searches the caller’s site for the host-independent part of the URL', async () => {
      const pages = await service.usage('user-1', RECORD.id);

      expect(content.findReferencing).toHaveBeenCalledWith(SITE, `/uploads/${SITE}/${RECORD.filename}`);
      expect(pages).toEqual([{ id: 'c1', title: 'Home', path: 'home', status: 'published' }]);
    });

    it('404s for a file that is not in the caller’s site', async () => {
      await expect(service.usage('user-1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
