import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { SitesModule } from '../sites/sites.module.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';

@Module({
  imports: [ContentModule, SitesModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
