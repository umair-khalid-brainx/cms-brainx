import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AuthService, type LoginResponse } from '../auth/auth.service.js';
import type { Role } from '../generated/prisma/client.js';
import { UserRepository } from '../users/user.repository.js';
import { InviteRepository } from './invite.repository.js';
import { MembershipRepository } from './membership.repository.js';
import type { AcceptInviteDto, CreateInviteDto } from './dto/invite.dto.js';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class TeamService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly invites: InviteRepository,
    private readonly users: UserRepository,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  listMembers(siteId: string) {
    return this.memberships.findManyBySite(siteId);
  }

  async updateMemberRole(siteId: string, membershipId: string, role: Role) {
    const membership = await this.memberships.findById(siteId, membershipId);
    if (!membership) throw new NotFoundException('Member not found');
    if (membership.role === 'owner' && role !== 'owner') {
      await this.assertNotLastOwner(siteId, 'demote');
    }
    await this.memberships.updateRole(siteId, membershipId, role);
    return this.memberships.findById(siteId, membershipId);
  }

  async removeMember(siteId: string, membershipId: string): Promise<void> {
    const membership = await this.memberships.findById(siteId, membershipId);
    if (!membership) throw new NotFoundException('Member not found');
    if (membership.role === 'owner') {
      await this.assertNotLastOwner(siteId, 'remove');
    }
    await this.memberships.delete(siteId, membershipId);
  }

  listInvites(siteId: string) {
    return this.invites.findPendingBySite(siteId);
  }

  async createInvite(siteId: string, invitedByUserId: string, dto: CreateInviteDto) {
    const email = normalizeEmail(dto.email);

    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      const existingMembership = await this.memberships.findByUserAndSite(existingUser.id, siteId);
      if (existingMembership) {
        throw new ConflictException('This person is already a member — change their role instead of inviting them again');
      }
    }

    // Auto-revoke rather than requiring a separate call first — friendlier,
    // and the old link becomes unusable the moment a fresh one is issued.
    const pending = await this.invites.findPendingByEmail(siteId, email);
    if (pending) await this.invites.revoke(siteId, pending.id);

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invite = await this.invites.create({
      siteId,
      email,
      role: dto.role,
      tokenHash: hashToken(token),
      invitedByUserId,
      expiresAt,
    });

    const adminUrl = this.config.get<string>('ADMIN_URL') ?? 'http://localhost:5173';
    return { ...invite, token, acceptUrl: `${adminUrl}/accept-invite?token=${token}` };
  }

  async revokeInvite(siteId: string, inviteId: string): Promise<void> {
    const result = await this.invites.revoke(siteId, inviteId);
    if (result.count === 0) throw new NotFoundException('Invite not found');
  }

  async previewInvite(token: string) {
    const invite = await this.findValidInvite(token);
    const existingAccount = (await this.users.findByEmail(invite.email)) !== null;
    return { email: invite.email, role: invite.role, siteName: invite.site.name, existingAccount };
  }

  /**
   * If `invite.email` already has an account, this attaches a new membership
   * to it rather than creating a duplicate user — but that requires proving
   * the caller actually owns that account. A password is always required,
   * and for the existing-account case it's checked against the real stored
   * hash before anything happens, not just trusted because they had the link.
   */
  async acceptInvite(token: string, dto: AcceptInviteDto): Promise<LoginResponse> {
    const invite = await this.findValidInvite(token);
    const existingUser = await this.users.findByEmail(invite.email);

    let userId: string;
    if (existingUser) {
      const valid = await bcrypt.compare(dto.password, existingUser.passwordHash);
      if (!valid) throw new UnauthorizedException('Incorrect password for this account');
      userId = existingUser.id;
    } else {
      if (!dto.name) throw new ForbiddenException('A name is required to create a new account');
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const created = await this.users.createUser({ email: invite.email, name: dto.name, passwordHash });
      userId = created.id;
    }

    await this.memberships.upsert(userId, invite.siteId, invite.role);
    await this.invites.markAccepted(invite.id);

    return this.auth.issueSession(userId, invite.email);
  }

  private async assertNotLastOwner(siteId: string, action: string): Promise<void> {
    const ownerCount = await this.memberships.countOwners(siteId);
    if (ownerCount <= 1) {
      throw new ConflictException(`Cannot ${action} the last owner of this site`);
    }
  }

  // One generic "invalid or expired" outcome for not-found/expired/accepted/
  // revoked — doesn't leak which state a token is actually in.
  private async findValidInvite(token: string) {
    const invite = await this.invites.findByTokenHash(hashToken(token));
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) {
      throw new NotFoundException('This invite link is invalid or has expired');
    }
    return invite;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
