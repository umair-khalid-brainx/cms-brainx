import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { ContentService } from '../content/content.service.js';
import { RevisionsService } from './revisions.service.js';

// Restoring a live page also needs content:publish; the body isn't what says so, the page's status is, so
// that check sits in RevisionsService.restore (as in ContentService.update).
@Controller('content/:slug/revisions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RevisionsController {
  constructor(
    private readonly revisions: RevisionsService,
    private readonly content: ContentService,
  ) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.revisions.list(request.user.sub, slug);
  }

  @Get(':id')
  @RequirePermission('content:read')
  get(@Req() request: AuthenticatedRequest, @Param('slug') slug: string, @Param('id') id: string) {
    return this.revisions.get(request.user.sub, slug, id);
  }

  @Post(':id/restore')
  @RequirePermission('content:write')
  restore(@Req() request: AuthenticatedRequest, @Param('slug') slug: string, @Param('id') id: string) {
    return this.revisions.restore(request.user.sub, slug, id, (page, snapshot) =>
      this.content.publishChecksFor(page.siteId, page.typeId, snapshot.blocks, snapshot.data),
    );
  }
}
