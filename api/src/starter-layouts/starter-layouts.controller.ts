import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { StarterLayoutRepository } from './starter-layout.repository.js';

// Read-only: the layouts come from the seed (prisma/starter-layouts.ts). For
// TYP-04's create-page screen, so it needs the same right as creating a page.
@Controller('starter-layouts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StarterLayoutsController {
  constructor(private readonly layouts: StarterLayoutRepository) {}

  @Get()
  @RequirePermission('content:write')
  list() {
    return this.layouts.findAll();
  }
}
