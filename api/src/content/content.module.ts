import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RevalidationModule } from '../revalidation/revalidation.module.js';
import { UsersModule } from '../users/users.module.js';
import { ContentController } from './content.controller.js';
import { ContentRepository } from './content.repository.js';
import { ContentService } from './content.service.js';
import { StarterLayoutsModule } from '../starter-layouts/starter-layouts.module.js';
import { ContentTypeRepository } from '../content-types/content-type.repository.js';
import { PreviewLinkRepository } from './preview-link.repository.js';

@Module({
  // AuthModule import brings in JwtModule (re-exported by AuthModule) so
  // JwtService is resolvable here — see the comment in auth.module.ts for why
  // JwtAuthGuard/PermissionsGuard also need to be listed as this module's own
  // providers.
  imports: [UsersModule, AuthModule, RevalidationModule, StarterLayoutsModule],
  controllers: [ContentController],
  providers: [ContentRepository, ContentTypeRepository, PreviewLinkRepository, ContentService, JwtAuthGuard, PermissionsGuard],
  // For PublicModule's live-page and preview reads.
  exports: [ContentRepository, ContentTypeRepository, PreviewLinkRepository],
})
export class ContentModule {}
