import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { SubmissionsService } from './submissions.service.js';

// Read-only in BLK-06. Status changes and internal notes are BLK-08 (D-034).
@Controller('submissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('submissions:read')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  // `?after=<id>` for the next page (PAGE_SIZE per page, newest first).
  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('after') after?: string) {
    return this.submissions.list(request.user.sub, after || undefined);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.submissions.get(request.user.sub, id);
  }
}
