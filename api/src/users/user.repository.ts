import { ForbiddenException, Injectable } from '@nestjs/common';
import { requestedSiteId } from '../common/active-site.js';
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
      // Oldest first: "the first membership" is the site someone joined first, and stays so when they add more.
      include: { memberships: { include: { site: true }, orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * The membership the request acts under: the one for the `X-Site-Id` header,
   * else the caller's first. Null when the user has none; 403 when the header
   * names a site they don't belong to (MSI-01).
   */
  async findActiveMembership(userId: string) {
    const user = await this.findByIdWithMemberships(userId);
    const memberships = user?.memberships ?? [];
    const wanted = requestedSiteId();
    if (!wanted) return memberships[0] ?? null;
    const match = memberships.find((m) => m.siteId === wanted);
    if (!match) throw new ForbiddenException('Not a member of this site');
    return match;
  }

  findMembership(userId: string, siteId: string) {
    return this.prisma.siteMembership.findUnique({ where: { userId_siteId: { userId, siteId } } });
  }

  createUser(data: { email: string; name: string; passwordHash: string }) {
    return this.prisma.user.create({ data });
  }
}
