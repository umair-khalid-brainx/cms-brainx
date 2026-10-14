import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { createSiteSchema, setDomainSchema, updateSubdomainSchema, type CreateSiteDto, type SetDomainDto, type UpdateSubdomainDto } from './dto/site.dto.js';
import { SitesService } from './sites.service.js';

// Not tied to a site: the caller is making a new one (MSI-02). JwtAuthGuard only; SitesService checks
// that they own a site, because "owner" is a role on a site, not on the account.
@Controller('sites')
@UseGuards(JwtAuthGuard)
export class CreateSiteController {
  constructor(private readonly sites: SitesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(createSiteSchema)) body: CreateSiteDto) {
    return this.sites.create(req.user.sub, body);
  }
}

// Explicit :siteId, like TeamController — PermissionsGuard checks the
// caller's membership of *that* site, never trusts a body field (invariant 5).
@Controller('sites/:siteId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  // Any member may read their site's address and settings; every role has content:read.
  @Get()
  @RequirePermission('content:read')
  get(@Param('siteId') siteId: string) {
    return this.sites.getDetails(siteId);
  }

  // Title, tagline, footer note and logo (GOV-04). The service checks the body itself, so every
  // problem is named in one answer.
  @Patch('settings')
  @RequirePermission('site:manage')
  updateSettings(@Param('siteId') siteId: string, @Body() body: unknown) {
    return this.sites.updateSettings(siteId, body);
  }

  // The site's look: type set, corners, spacing, texture and 8 colours. Replaced whole; same right as the settings.
  @Patch('theme')
  @RequirePermission('site:manage')
  updateTheme(@Param('siteId') siteId: string, @Body() body: unknown) {
    return this.sites.updateTheme(siteId, body);
  }

  // The site's custom domain (DEP-02): saved as pending, display only. Same right as the subdomain.
  @Put('domain')
  @RequirePermission('site:manage')
  setDomain(@Param('siteId') siteId: string, @Body(new ZodValidationPipe(setDomainSchema)) body: SetDomainDto) {
    return this.sites.setDomain(siteId, body.domain);
  }

  @Delete('domain')
  @RequirePermission('site:manage')
  removeDomain(@Param('siteId') siteId: string) {
    return this.sites.removeDomain(siteId);
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
