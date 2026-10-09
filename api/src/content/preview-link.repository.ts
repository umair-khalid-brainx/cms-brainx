import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Every method takes `siteId` (invariant 1) — including the public lookup by
// token, so a token can only ever open a page on the site whose host it was
// used on (CNT-09).
@Injectable()
export class PreviewLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByContent(siteId: string, contentId: string) {
    return this.prisma.previewLink.findFirst({ where: { siteId, contentId } });
  }

  /**
   * The page's link, creating it with `token` if it has none. An upsert on
   * the page's unique `contentId`, so two clicks at once still end up with
   * one link, not a unique-constraint error.
   */
  findOrCreate(siteId: string, contentId: string, token: string) {
    // `where` can only name a unique field, so it's `contentId` alone; safe
    // because the caller resolved `contentId` inside `siteId`, and a page
    // never changes site.
    return this.prisma.previewLink.upsert({
      where: { contentId },
      update: {},
      create: { siteId, contentId, token },
    });
  }

  deleteByContent(siteId: string, contentId: string) {
    return this.prisma.previewLink.deleteMany({ where: { siteId, contentId } });
  }

  /** The page a token opens on this site, or null. Its status is the caller's to judge. */
  async findPageByToken(siteId: string, token: string) {
    const link = await this.prisma.previewLink.findFirst({
      where: { siteId, token },
      include: { content: { include: { author: { select: { name: true } }, type: true } } },
    });
    return link?.content ?? null;
  }
}
