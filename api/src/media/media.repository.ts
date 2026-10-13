import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { readSettings } from '../sites/site-settings.js';

const MEDIA_SELECT = {
  id: true,
  siteId: true,
  url: true,
  thumbnailUrl: true,
  alt: true,
  title: true,
  description: true,
  filename: true,
  mimetype: true,
  size: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.MediaSelect;

// Every method takes siteId (invariant 1), same pattern as ContentRepository.
@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyBySite(siteId: string) {
    return this.prisma.media.findMany({ where: { siteId }, select: MEDIA_SELECT, orderBy: { createdAt: 'desc' } });
  }

  findById(siteId: string, id: string) {
    return this.prisma.media.findFirst({ where: { id, siteId }, select: MEDIA_SELECT });
  }

  create(siteId: string, data: Omit<Prisma.MediaUncheckedCreateInput, 'siteId'>) {
    return this.prisma.media.create({ data: { ...data, siteId }, select: MEDIA_SELECT });
  }

  updateSize(siteId: string, id: string, size: number, thumbnailUrl: string | null) {
    return this.prisma.media.updateMany({ where: { id, siteId }, data: { size, thumbnailUrl } });
  }

  updateDetails(siteId: string, id: string, data: { alt?: string | null; title?: string | null; description?: string | null }) {
    return this.prisma.media.updateMany({ where: { id, siteId }, data });
  }

  /**
   * Library alt text for the files a page uses, by stored filename — the live
   * site's fallback for images whose own alt is empty (MED-04, D-047). Only
   * files with some text, and only this site's.
   */
  findAltsByFilenames(siteId: string, filenames: string[]) {
    return this.prisma.media.findMany({
      where: { siteId, filename: { in: filenames }, alt: { not: null } },
      select: { filename: true, alt: true },
    });
  }

  /** What the public entry page needs to show a file: its type and the library's words, by stored name. */
  findByFilenames(siteId: string, filenames: string[]) {
    return this.prisma.media.findMany({
      where: { siteId, filename: { in: filenames } },
      select: { filename: true, mimetype: true, alt: true, title: true },
    });
  }

  /**
   * A picture in this site's library, by the path it is stored under (`/uploads/<site>/<file>`), or null when the
   * file isn't in the library or isn't an image. One place for "is this a usable picture", so saving a logo or a
   * social image and showing it agree (SEO-01, GOV-04).
   */
  async findImage(siteId: string, path: string): Promise<{ filename: string; alt: string | null } | null> {
    const filename = path.slice(path.lastIndexOf('/') + 1);
    const [file] = await this.findByFilenames(siteId, [filename]);
    return file && file.mimetype.startsWith('image/') ? { filename: file.filename, alt: file.alt } : null;
  }

  /** Whether this file is the site's logo (GOV-04): deleting it would leave the header pointing at nothing. */
  async isSiteLogo(siteId: string, filename: string): Promise<boolean> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { settings: true } });
    return readSettings(site?.settings).logo.endsWith(`/${filename}`);
  }

  /** Takes the logo off the site, keeping the rest of its settings. */
  async clearSiteLogo(siteId: string): Promise<void> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { settings: true } });
    if (!site) return;
    await this.prisma.site.update({ where: { id: siteId }, data: { settings: { ...readSettings(site.settings), logo: '' } } });
  }

  delete(siteId: string, id: string) {
    return this.prisma.media.deleteMany({ where: { id, siteId } });
  }
}
