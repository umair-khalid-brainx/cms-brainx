import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { SitesModule } from '../sites/sites.module.js';
import { ScheduledPublisher } from './scheduled-publisher.js';

// A module of its own because it needs both the sites and the content workflow: ContentModule can't import
// SitesModule, which reaches ContentModule through MediaModule.
@Module({
  imports: [ContentModule, SitesModule],
  providers: [ScheduledPublisher],
})
export class SchedulerModule {}
