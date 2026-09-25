import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { TeamService } from './team.service.js';
import { createInviteSchema, type CreateInviteDto } from './dto/invite.dto.js';
import { updateMembershipSchema, type UpdateMembershipDto } from './dto/membership.dto.js';

// Owner/Administrator only (members:manage) — every route here takes an
// explicit :siteId rather than resolving it from the caller's first
// membership, unlike ContentController. See DECISIONS.md D-023: this feature
// is exactly what makes multi-membership users common, so guessing "whichever
// site is first" would be actively wrong for team management.
@Controller('sites/:siteId/team')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('members:manage')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  listMembers(@Param('siteId') siteId: string) {
    return this.team.listMembers(siteId);
  }

  @Patch('members/:membershipId')
  updateMember(
    @Param('siteId') siteId: string,
    @Param('membershipId') membershipId: string,
    @Body(new ZodValidationPipe(updateMembershipSchema)) body: UpdateMembershipDto,
  ) {
    return this.team.updateMemberRole(siteId, membershipId, body.role);
  }

  @Delete('members/:membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(@Param('siteId') siteId: string, @Param('membershipId') membershipId: string): Promise<void> {
    await this.team.removeMember(siteId, membershipId);
  }

  @Get('invites')
  listInvites(@Param('siteId') siteId: string) {
    return this.team.listInvites(siteId);
  }

  @Post('invites')
  createInvite(
    @Req() request: AuthenticatedRequest,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(createInviteSchema)) body: CreateInviteDto,
  ) {
    return this.team.createInvite(siteId, request.user.sub, body);
  }

  @Delete('invites/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvite(@Param('siteId') siteId: string, @Param('inviteId') inviteId: string): Promise<void> {
    await this.team.revokeInvite(siteId, inviteId);
  }
}
