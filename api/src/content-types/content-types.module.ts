import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { ContentModule } from '../content/content.module.js';
import { UsersModule } from '../users/users.module.js';
import { ContentTypesController } from './content-types.controller.js';
import { ContentTypesService } from './content-types.service.js';

// The repository itself lives in ContentModule (which creates entries and needs
// it too); this module is the screens' API over it. Same guard wiring as the
// other feature modules (see auth.module.ts).
@Module({
  imports: [UsersModule, AuthModule, ContentModule],
  controllers: [ContentTypesController],
  providers: [ContentTypesService, JwtAuthGuard, PermissionsGuard],
})
export class ContentTypesModule {}
