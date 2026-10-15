import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ChromeService } from './chrome.service.js';

// Saved headers and footers. Anyone who can read content can list them (the page picker needs it);
// changing one changes every page that uses it, so it needs site:manage, like the menus.
@Controller('chrome-presets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChromeController {
  constructor(private readonly chrome: ChromeService) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest) {
    return this.chrome.list(request.user.sub);
  }

  @Post()
  @RequirePermission('site:manage')
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.chrome.create(request.user.sub, body);
  }

  @Patch(':id')
  @RequirePermission('site:manage')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.chrome.update(request.user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('site:manage')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.chrome.remove(request.user.sub, id);
  }
}
