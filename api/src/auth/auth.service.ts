import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Role } from '../generated/prisma/client.js';
import { UserRepository } from '../users/user.repository.js';

export type AuthenticatedUser = { id: string; email: string; name: string };
export type Membership = { siteId: string; siteName: string; role: Role };
export type SessionResponse = { user: AuthenticatedUser; memberships: Membership[] };
export type LoginResponse = SessionResponse & { accessToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.issueSession(user.id, user.email);
  }

  /**
   * Signs a token and builds the session response for a user we've already
   * authenticated by some means — a password (login) or an accepted invite.
   * Kept separate from `login` so accept-invite doesn't re-derive credential
   * verification logic, it just calls this once its own check has passed.
   */
  async issueSession(userId: string, email: string): Promise<LoginResponse> {
    const accessToken = await this.jwt.signAsync({ sub: userId, email });
    const session = await this.session(userId);
    if (!session) throw new UnauthorizedException('Invalid email or password');

    return { accessToken, ...session };
  }

  async session(userId: string): Promise<SessionResponse | null> {
    const user = await this.users.findByIdWithMemberships(userId);
    if (!user) return null;

    return {
      user: { id: user.id, email: user.email, name: user.name },
      memberships: user.memberships.map((membership) => ({
        siteId: membership.siteId,
        siteName: membership.site.name,
        role: membership.role,
      })),
    };
  }
}
