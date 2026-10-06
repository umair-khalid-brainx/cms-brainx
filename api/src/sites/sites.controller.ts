import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { updateSubdomainSchema, type UpdateSubdomainDto } from './dto/site.dto.js';
import { SitesService } from './sites.service.js';

// Explicit :siteId, like TeamController — PermissionsGuard checks the
// caller's membership of *that* site, never trusts a body field (invariant 5).
@Controller('sites/:siteId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  // Any member may read their site's address; every role has content:read.
  @Get()
  @RequirePermission('content:read')
  get(@Param('siteId') siteId: string) {
    return this.sites.get(siteId);
  }

  @Patch('subdomain')
  @RequirePermission('site:manage')
  updateSubdomain(
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(updateSubdomainSchema)) body: UpdateSubdomainDto,
  ) {
    return this.sites.updateSubdomain(siteId, body.subdomain);
  }
}
