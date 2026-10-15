import { BadRequestException, Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { MENU_LOCATIONS, type MenuLocation } from './menu-tree.js';
import { MenusService } from './menus.service.js';

function asLocation(value: string): MenuLocation {
  if ((MENU_LOCATIONS as readonly string[]).includes(value)) return value as MenuLocation;
  throw new BadRequestException(`A menu is one of: ${MENU_LOCATIONS.join(', ')}.`);
}

// The Menus screen (GOV-03). Anyone who can read content can see a menu; changing one changes every
// page of the public site, so it needs site:manage, like the rest of the site's identity.
@Controller('menus')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Get(':location')
  @RequirePermission('content:read')
  get(@Req() request: AuthenticatedRequest, @Param('location') location: string, @Query('preset') preset?: string) {
    return this.menus.get(request.user.sub, asLocation(location), preset || undefined);
  }

  // The service checks the body itself, so every problem is named in one answer.
  @Put(':location')
  @RequirePermission('site:manage')
  save(@Req() request: AuthenticatedRequest, @Param('location') location: string, @Body() body: unknown, @Query('preset') preset?: string) {
    return this.menus.save(request.user.sub, asLocation(location), body, preset || undefined);
  }
}
