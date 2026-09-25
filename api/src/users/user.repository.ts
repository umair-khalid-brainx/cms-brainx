import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Users aren't tenant-scoped content (invariant 1 is about `content`), but
 * `PrismaService` access still goes through a repository per invariant 2.
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByIdWithMemberships(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { memberships: { include: { site: true } } },
    });
  }
}
