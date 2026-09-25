import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { UsersModule } from '../users/users.module.js';
import { InviteAcceptController } from './invite-accept.controller.js';
import { InviteRepository } from './invite.repository.js';
import { MembershipRepository } from './membership.repository.js';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

@Module({
  // AuthModule brings JwtModule (for JwtAuthGuard) and exports AuthService
  // itself (TeamService.acceptInvite reuses AuthService.issueSession rather
  // than re-deriving session-building logic). Same JwtAuthGuard/
  // PermissionsGuard own-provider requirement as ContentModule — see
  // auth.module.ts's comment for why.
  imports: [UsersModule, AuthModule],
  controllers: [TeamController, InviteAcceptController],
  providers: [MembershipRepository, InviteRepository, TeamService, JwtAuthGuard, PermissionsGuard],
})
export class TeamModule {}
