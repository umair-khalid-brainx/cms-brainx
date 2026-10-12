import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { createRedirectSchema, type CreateRedirectDto } from './dto/redirect.dto.js';
import { RedirectsService } from './redirects.service.js';

// The Redirects screen (GOV-05). Anyone who can read content can see them; adding or
// removing one changes where public addresses go, so it sits at the publishing tier.
@Controller('redirects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest) {
    return this.redirects.list(request.user.sub);
  }

  @Post()
  @RequirePermission('content:publish')
  create(@Req() request: AuthenticatedRequest, @Body(new ZodValidationPipe(createRedirectSchema)) body: CreateRedirectDto) {
    return this.redirects.create(request.user.sub, body);
  }

  @Delete(':id')
  @RequirePermission('content:publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.redirects.remove(request.user.sub, id);
  }
}
