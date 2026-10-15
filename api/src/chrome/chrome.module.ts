import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { ContentModule } from '../content/content.module.js';
import { MediaModule } from '../media/media.module.js';
import { SitesModule } from '../sites/sites.module.js';
import { RevalidationModule } from '../revalidation/revalidation.module.js';
import { UsersModule } from '../users/users.module.js';
import { ChromeController } from './chrome.controller.js';
import { ChromeService } from './chrome.service.js';

// Its own module because it needs the media library (MediaModule imports ContentModule, so ContentModule can't).
// ChromeRepository lives in ContentModule: the menus and the page save check a page's choice against it.
@Module({
  imports: [UsersModule, AuthModule, ContentModule, MediaModule, RevalidationModule, SitesModule],
  controllers: [ChromeController],
  providers: [ChromeService, JwtAuthGuard, PermissionsGuard],
})
export class ChromeModule {}
