import { Injectable } from '@nestjs/common';
import type { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Never selects tokenHash — nobody but the creator should see anything
// token-related, and even then only the raw token once, at creation.
const INVITE_SELECT = {
  id: true,
  siteId: true,
  email: true,
  role: true,
  invitedByUserId: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
} satisfies Prisma.InviteSelect;

@Injectable()
export class InviteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPendingBySite(siteId: string) {
    return this.prisma.invite.findMany({
      where: { siteId, acceptedAt: null, revokedAt: null },
      select: INVITE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findPendingByEmail(siteId: string, email: string) {
    return this.prisma.invite.findFirst({ where: { siteId, email, acceptedAt: null, revokedAt: null } });
  }

  findByTokenHash(tokenHash: string) {
    return this.prisma.invite.findUnique({ where: { tokenHash }, include: { site: true } });
  }

  findById(siteId: string, inviteId: string) {
    return this.prisma.invite.findFirst({ where: { id: inviteId, siteId } });
  }

  create(data: {
    siteId: string;
    email: string;
    role: Role;
    tokenHash: string;
    invitedByUserId: string;
    expiresAt: Date;
  }) {
    return this.prisma.invite.create({ data, select: INVITE_SELECT });
  }

  revoke(siteId: string, inviteId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.invite.updateMany({
      where: { id: inviteId, siteId, acceptedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  markAccepted(id: string) {
    return this.prisma.invite.update({ where: { id }, data: { acceptedAt: new Date() } });
  }
}
