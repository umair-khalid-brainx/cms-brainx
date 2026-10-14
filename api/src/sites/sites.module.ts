import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { MediaModule } from '../media/media.module.js';
import { RevalidationModule } from '../revalidation/revalidation.module.js';
import { UsersModule } from '../users/users.module.js';
import { SiteRepository } from './site.repository.js';
import { CreateSiteController, SitesController } from './sites.controller.js';
import { SitesService } from './sites.service.js';
import { SubdomainCache } from './subdomain-cache.js';

@Module({
  // Same JwtAuthGuard/PermissionsGuard own-provider requirement as
  // ContentModule — see auth.module.ts. SiteRepository and SubdomainCache are
  // exported for PublicModule's host-to-site lookup; SubdomainCache is a
  // singleton here, so the rename in SitesService clears the same map
  // PublicService reads.
  // MediaModule: the logo must be in the site's library; RevalidationModule: a settings change refreshes
  // every page of the site (GOV-04).
  imports: [UsersModule, AuthModule, MediaModule, RevalidationModule],
  controllers: [SitesController, CreateSiteController],
  providers: [SiteRepository, SubdomainCache, SitesService, JwtAuthGuard, PermissionsGuard],
  exports: [SiteRepository, SubdomainCache],
})
export class SitesModule {}
