import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { UsersModule } from '../users/users.module.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

// Same module-wiring gotcha as ContentModule/TeamModule (see auth.module.ts):
// JwtAuthGuard/PermissionsGuard must be this module's own providers too, not
// just exported by AuthModule.
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [MediaController],
  providers: [MediaService, JwtAuthGuard, PermissionsGuard],
})
export class MediaModule {}
