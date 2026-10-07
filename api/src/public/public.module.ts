import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { SitesModule } from '../sites/sites.module.js';
import { FormSecretGuard } from '../submissions/form-secret.guard.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';

@Module({
  imports: [ContentModule, SitesModule, SubmissionsModule],
  controllers: [PublicController],
  providers: [PublicService, FormSecretGuard],
})
export class PublicModule {}
