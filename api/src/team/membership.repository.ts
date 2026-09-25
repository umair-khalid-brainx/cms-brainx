import { Injectable } from '@nestjs/common';
import type { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MEMBERSHIP_SELECT = {
  id: true,
  userId: true,
  siteId: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.SiteMembershipSelect;

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  // select, not include: `user` must never carry `passwordHash` into an API
  // response — `include: { user: true }` would pull the whole row.
  findManyBySite(siteId: string) {
    return this.prisma.siteMembership.findMany({
      where: { siteId },
      select: MEMBERSHIP_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(siteId: string, membershipId: string) {
    return this.prisma.siteMembership.findFirst({ where: { id: membershipId, siteId }, select: MEMBERSHIP_SELECT });
  }

  findByUserAndSite(userId: string, siteId: string) {
    return this.prisma.siteMembership.findUnique({ where: { userId_siteId: { userId, siteId } } });
  }

  countOwners(siteId: string) {
    return this.prisma.siteMembership.count({ where: { siteId, role: 'owner' } });
  }

  updateRole(siteId: string, membershipId: string, role: Role) {
    return this.prisma.siteMembership.updateMany({ where: { id: membershipId, siteId }, data: { role } });
  }

  delete(siteId: string, membershipId: string) {
    return this.prisma.siteMembership.deleteMany({ where: { id: membershipId, siteId } });
  }

  upsert(userId: string, siteId: string, role: Role) {
    return this.prisma.siteMembership.upsert({
      where: { userId_siteId: { userId, siteId } },
      update: { role },
      create: { userId, siteId, role },
    });
  }
}
