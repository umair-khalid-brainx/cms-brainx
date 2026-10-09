import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Every method takes siteId (invariant 1), same pattern as ContentRepository.
@Injectable()
export class SubmissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Newest first, one page at a time. `after` is the id of the last row of the
   * previous page; it is looked up within this site only, so another site's
   * id can't be used as a cursor. `id` breaks ties between equal timestamps.
   */
  async findPageBySite(siteId: string, take: number, after?: string) {
    const cursor = after ? await this.prisma.submission.findFirst({ where: { id: after, siteId }, select: { id: true } }) : null;
    if (after && !cursor) return null;
    return this.prisma.submission.findMany({
      where: { siteId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    });
  }

  countBySite(siteId: string) {
    return this.prisma.submission.count({ where: { siteId } });
  }

  findById(siteId: string, id: string) {
    return this.prisma.submission.findFirst({ where: { id, siteId } });
  }

  create(siteId: string, data: Omit<Prisma.SubmissionUncheckedCreateInput, 'siteId'>) {
    return this.prisma.submission.create({ data: { ...data, siteId } });
  }
}
