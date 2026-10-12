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
import { MenuRepository } from '../menus/menu.repository.js';
import { MenusController } from '../menus/menus.controller.js';
import { MenusService } from '../menus/menus.service.js';
import { RedirectRepository } from '../redirects/redirect.repository.js';
import { RedirectsController } from '../redirects/redirects.controller.js';
import { RedirectsService } from '../redirects/redirects.service.js';

@Module({
  // AuthModule import brings in JwtModule (re-exported by AuthModule) so
  // JwtService is resolvable here — see the comment in auth.module.ts for why
  // JwtAuthGuard/PermissionsGuard also need to be listed as this module's own
  // providers.
  imports: [UsersModule, AuthModule, RevalidationModule, StarterLayoutsModule],
  // Redirects and menus live here rather than in modules of their own: moving or hiding a page
  // changes them (GOV-05, GOV-03), and they check page addresses, so they would otherwise import
  // each other.
  controllers: [ContentController, RedirectsController, MenusController],
  providers: [
    ContentRepository,
    ContentTypeRepository,
    PreviewLinkRepository,
    RedirectRepository,
    RedirectsService,
    MenuRepository,
    MenusService,
    ContentService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  // For PublicModule's live-page, preview, redirect and menu reads.
  exports: [ContentRepository, ContentTypeRepository, PreviewLinkRepository, RedirectRepository, MenuRepository],
})
export class ContentModule {}
