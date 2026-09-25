import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { TeamService } from './team.service.js';
import { acceptInviteSchema, type AcceptInviteDto } from './dto/invite.dto.js';

// No JwtAuthGuard — this is what creates a session, so it's unauthenticated
// by definition. Anyone with the link can preview it; accepting requires a
// password, checked for real in TeamService.acceptInvite.
@Controller('invites')
export class InviteAcceptController {
  constructor(private readonly team: TeamService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.team.previewInvite(token);
  }

  @Post(':token/accept')
  accept(@Param('token') token: string, @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteDto) {
    return this.team.acceptInvite(token, body);
  }
}
