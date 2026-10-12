import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import type { ContentRepository } from '../content/content.repository.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import type { UserRepository } from '../users/user.repository.js';
import type { MediaRepository } from './media.repository.js';
import { MediaService, titleFromUploadName } from './media.service.js';

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
  let media: {
    findById: ReturnType<typeof vi.fn>;
    updateSize: ReturnType<typeof vi.fn>;
    updateDetails: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    isSiteLogo: ReturnType<typeof vi.fn>;
    clearSiteLogo: ReturnType<typeof vi.fn>;
  };
  let revalidation: { page: ReturnType<typeof vi.fn>; site: ReturnType<typeof vi.fn> };
  let content: { findReferencing: ReturnType<typeof vi.fn> };
  // Who is calling: an owner unless a spec says otherwise (GOV-07's live-file rule).
  let role: string;

  beforeEach(async () => {
    role = 'owner';
    uploadsRoot = await mkdtemp(join(tmpdir(), 'media-spec-'));
    await mkdir(join(uploadsRoot, SITE));
    await writeFile(join(uploadsRoot, SITE, RECORD.filename), 'old');
    await writeFile(join(uploadsRoot, SITE, THUMB), 'old thumb');

    const users = {
      findByIdWithMemberships: vi.fn(async () => ({ memberships: [{ siteId: SITE, role, site: { subdomain: 'alpha' } }] })),
    };
    media = {
      // Scoped like the real repository: another site's id finds nothing.
      findById: vi.fn(async (siteId: string, id: string) => (siteId === SITE && id === RECORD.id ? RECORD : null)),
      updateSize: vi.fn(async () => ({ count: 1 })),
      updateDetails: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async (data: Record<string, unknown>) => ({ id: 'new', ...data })),
      delete: vi.fn(async () => ({ count: 1 })),
      isSiteLogo: vi.fn(async () => false),
      clearSiteLogo: vi.fn(async () => {}),
    };
    revalidation = { page: vi.fn(async () => {}), site: vi.fn(async () => {}) };
    content = { findReferencing: vi.fn(async () => [{ id: 'c1', title: 'Home', path: 'home', status: 'published' }]) };
    // MediaService joins UPLOADS_DIR onto cwd, so it has to be relative.
    const uploadsDir = relative(process.cwd(), uploadsRoot);
    const config = { get: (key: string) => (key === 'UPLOADS_DIR' ? uploadsDir : undefined) };

    service = new MediaService(
      users as unknown as UserRepository,
      media as unknown as MediaRepository,
      content as unknown as ContentRepository,
      revalidation as unknown as RevalidationService,
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

    it('lists the site’s logo first when the file is the logo, since every page shows it (GOV-04)', async () => {
      media.isSiteLogo.mockResolvedValueOnce(true);
      const pages = await service.usage('user-1', RECORD.id);
      expect(media.isSiteLogo).toHaveBeenCalledWith(SITE, RECORD.filename);
      expect(pages[0]).toMatchObject({ title: 'The site’s logo', path: '(every page)' });
      expect(pages).toHaveLength(2);
    });
  });

  describe('remove and the site’s logo (GOV-04)', () => {
    it('deleting the logo takes it off the site and refreshes every page of the site', async () => {
      media.isSiteLogo.mockResolvedValueOnce(true);
      await service.remove('user-1', RECORD.id);
      expect(media.delete).toHaveBeenCalledWith(SITE, RECORD.id);
      expect(media.clearSiteLogo).toHaveBeenCalledWith(SITE);
      expect(revalidation.site).toHaveBeenCalledExactlyOnceWith('alpha');
    });

    it('deleting any other file leaves the site alone', async () => {
      await service.remove('user-1', RECORD.id);
      expect(media.delete).toHaveBeenCalledWith(SITE, RECORD.id);
      expect(media.clearSiteLogo).not.toHaveBeenCalled();
      expect(revalidation.site).not.toHaveBeenCalled();
    });
  });

  describe('documents (MED-04)', () => {
    const PDF = 'application/pdf';
    const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    it('stores a PDF with no thumbnail, under a generated name, titled from the upload name', async () => {
      const upload = { ...file(PDF, '%PDF-1.7 hello'), originalname: 'Brochure 2026.pdf' } as Express.Multer.File;
      const result = await service.store('user-1', upload);

      expect(result).toMatchObject({ mimetype: PDF, thumbnailUrl: null, title: 'Brochure 2026' });
      expect(String(result.filename)).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      expect(await readFile(join(uploadsRoot, SITE, String(result.filename)), 'utf8')).toBe('%PDF-1.7 hello');
    });

    it('stores a Word file', async () => {
      const upload = { mimetype: DOCX, buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]), size: 6 } as Express.Multer.File;
      expect(await service.store('user-1', upload)).toMatchObject({ mimetype: DOCX });
    });

    it('refuses a file that is not what its type claims, and writes nothing', async () => {
      const before = await readdir(join(uploadsRoot, SITE));

      await expect(service.store('user-1', file(PDF, '<html><script>alert(1)</script></html>'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(await readdir(join(uploadsRoot, SITE))).toEqual(before);
      expect(media.create).not.toHaveBeenCalled();
    });

    it('still refuses types that are not allowed', async () => {
      await expect(service.store('user-1', file('application/zip', 'PK'))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.store('user-1', file('text/html', '<p>'))).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('replacing a document (MED-04)', () => {
    const PDF_RECORD = {
      ...RECORD,
      id: 'doc-1',
      url: `http://localhost:4001/uploads/${SITE}/doc.pdf`,
      filename: 'doc.pdf',
      mimetype: 'application/pdf',
      thumbnailUrl: null,
    };

    beforeEach(async () => {
      await writeFile(join(uploadsRoot, SITE, 'doc.pdf'), '%PDF-old');
      media.findById.mockImplementation(async (siteId: string, id: string) =>
        siteId === SITE && id === PDF_RECORD.id ? PDF_RECORD : null,
      );
    });

    it('swaps in a real PDF, keeping the URL', async () => {
      const result = await service.replace('user-1', 'doc-1', file('application/pdf', '%PDF-new bytes'));

      expect(result.url).toBe(PDF_RECORD.url);
      expect(await readFile(join(uploadsRoot, SITE, 'doc.pdf'), 'utf8')).toBe('%PDF-new bytes');
    });

    it('refuses a file that is not a PDF and leaves the original in place', async () => {
      await expect(
        service.replace('user-1', 'doc-1', file('application/pdf', '<html><script>alert(1)</script></html>')),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await readFile(join(uploadsRoot, SITE, 'doc.pdf'), 'utf8')).toBe('%PDF-old');
      expect(media.updateSize).not.toHaveBeenCalled();
    });
  });

  describe('a file on the live site (GOV-07)', () => {
    it('refuses a contributor replacing a file a live page uses, and leaves it untouched', async () => {
      role = 'contributor';
      await expect(service.replace('user-1', RECORD.id, await imageFile())).rejects.toBeInstanceOf(ForbiddenException);
      expect(await readFile(join(uploadsRoot, SITE, RECORD.filename), 'utf8')).toBe('old');
      expect(media.updateSize).not.toHaveBeenCalled();
    });

    it('refuses a contributor replacing the site’s logo', async () => {
      role = 'contributor';
      content.findReferencing.mockResolvedValueOnce([]);
      media.isSiteLogo.mockResolvedValueOnce(true);
      await expect(service.replace('user-1', RECORD.id, await imageFile())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a contributor replacing a file a page in review uses', async () => {
      role = 'contributor';
      content.findReferencing.mockResolvedValueOnce([{ id: 'c3', title: 'Waiting', path: '/waiting', status: 'in_review' }]);
      await expect(service.replace('user-1', RECORD.id, await imageFile())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets a contributor replace a file only drafts use', async () => {
      role = 'contributor';
      content.findReferencing.mockResolvedValueOnce([{ id: 'c2', title: 'Draft', path: '/draft', status: 'draft' }]);
      await expect(service.replace('user-1', RECORD.id, await imageFile())).resolves.toMatchObject({ url: RECORD.url });
    });

    it('refuses a contributor’s alt text on a live file, but not its title', async () => {
      role = 'contributor';
      await expect(service.updateDetails('user-1', RECORD.id, { alt: 'New words' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(media.updateDetails).not.toHaveBeenCalled();
      await service.updateDetails('user-1', RECORD.id, { title: 'Library name' });
      expect(media.updateDetails).toHaveBeenCalledWith(SITE, RECORD.id, { title: 'Library name' });
    });
  });

  describe('updateDetails', () => {
    it('saves alt, title and description for the caller’s site', async () => {
      await service.updateDetails('user-1', RECORD.id, { alt: 'Oysters', title: 'Harvest', description: 'Morning haul' });

      expect(media.updateDetails).toHaveBeenCalledWith(SITE, RECORD.id, {
        alt: 'Oysters',
        title: 'Harvest',
        description: 'Morning haul',
      });
    });

    it('404s for a file that is not in the caller’s site, and writes nothing', async () => {
      await expect(service.updateDetails('user-1', 'other-site-media', { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(media.updateDetails).not.toHaveBeenCalled();
    });

    it('refuses alternative text on a document', async () => {
      media.findById.mockResolvedValueOnce({ ...RECORD, mimetype: 'application/pdf', filename: 'x.pdf' });

      await expect(service.updateDetails('user-1', RECORD.id, { alt: 'text' })).rejects.toBeInstanceOf(BadRequestException);
      expect(media.updateDetails).not.toHaveBeenCalled();
    });

    it('refreshes the live pages that use the file when its alt text changes', async () => {
      content.findReferencing.mockResolvedValueOnce([
        { id: 'c1', title: 'Home', path: '/', status: 'published' },
        { id: 'c2', title: 'Draft', path: '/draft', status: 'draft' },
      ]);

      await service.updateDetails('user-1', RECORD.id, { alt: 'New words' });

      expect(revalidation.page).toHaveBeenCalledTimes(1);
      expect(revalidation.page).toHaveBeenCalledWith('alpha', '/');
    });

    it('refreshes many live pages in parallel batches, not one after another', async () => {
      content.findReferencing.mockResolvedValueOnce(
        Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, title: `P${i}`, path: `/p${i}`, status: 'published' })),
      );
      let running = 0;
      let peak = 0;
      revalidation.page.mockImplementation(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
      });

      await service.updateDetails('user-1', RECORD.id, { alt: 'Changed' });

      expect(revalidation.page).toHaveBeenCalledTimes(25);
      expect(peak).toBeGreaterThan(1);
      expect(peak).toBeLessThanOrEqual(10);
    });

    it('leaves the live pages alone when only the title or description changes', async () => {
      await service.updateDetails('user-1', RECORD.id, { title: 'New title', description: 'New description' });

      expect(content.findReferencing).not.toHaveBeenCalled();
      expect(revalidation.page).not.toHaveBeenCalled();
    });
  });
});

describe('titleFromUploadName', () => {
  it.each([
    ['Price list 2026.docx', 'Price list 2026'],
    ['brochure.pdf', 'brochure'],
    ['archive.tar.gz', 'archive.tar'],
    ['C:\\Users\\ada\\Desktop\\menu.pdf', 'menu'],
    ['/etc/passwd.pdf', 'passwd'],
    ['  spaced   out  .xlsx', 'spaced out'],
    ['no-extension', 'no-extension'],
  ])('turns %j into %j', (input, expected) => {
    expect(titleFromUploadName(input)).toBe(expected);
  });

  it('decodes a UTF-8 name the browser sent as Latin-1', () => {
    expect(titleFromUploadName(Buffer.from('Café menu.pdf', 'utf8').toString('latin1'))).toBe('Café menu');
  });

  it('removes direction overrides, which could make a name read as something else', () => {
    // As a browser sends it: UTF-8 bytes, read as Latin-1.
    const sent = Buffer.from('invoice\u202Efdp.exe', 'utf8').toString('latin1');
    expect(titleFromUploadName(sent)).toBe('invoicefdp');
  });

  it('never cuts a character outside the basic range in half when it caps the length', () => {
    const title = titleFromUploadName(`${'😀'.repeat(300)}.pdf`) ?? '';
    expect(Array.from(title)).toHaveLength(200);
    expect(title).not.toContain('\ufffd');
  });

  it('gives nothing for an empty, missing or control-only name, and caps the length', () => {
    expect(titleFromUploadName(undefined)).toBeNull();
    expect(titleFromUploadName('')).toBeNull();
    expect(titleFromUploadName('\u0001\u0002.pdf')).toBeNull();
    expect(titleFromUploadName(`${'a'.repeat(500)}.pdf`)).toHaveLength(200);
  });
});
