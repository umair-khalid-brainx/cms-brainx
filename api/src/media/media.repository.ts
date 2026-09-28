import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MEDIA_SELECT = {
  id: true,
  siteId: true,
  url: true,
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

  create(data: Prisma.MediaUncheckedCreateInput) {
    return this.prisma.media.create({ data, select: MEDIA_SELECT });
  }

  delete(siteId: string, id: string) {
    return this.prisma.media.deleteMany({ where: { id, siteId } });
  }
}
