import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Starter layouts are platform data shared by every site (TYP-05, D-038),
// not tenant content, so this is the one repository whose reads take no
// `siteId`: there is nothing here one tenant could see of another's.
@Injectable()
export class StarterLayoutRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByKey(key: string) {
    return this.prisma.starterLayout.findUnique({ where: { key }, select: { key: true, blocks: true } });
  }

  findAll() {
    return this.prisma.starterLayout.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { key: true, name: true, description: true, blocks: true },
    });
  }
}
