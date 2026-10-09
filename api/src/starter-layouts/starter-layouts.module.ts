import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { UsersModule } from '../users/users.module.js';
import { StarterLayoutRepository } from './starter-layout.repository.js';
import { StarterLayoutsController } from './starter-layouts.controller.js';

// Same guard-wiring gotcha as ContentModule (see auth.module.ts).
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [StarterLayoutsController],
  providers: [StarterLayoutRepository, JwtAuthGuard, PermissionsGuard],
  // ContentService copies a layout's blocks into a new page (TYP-04).
  exports: [StarterLayoutRepository],
})
export class StarterLayoutsModule {}
