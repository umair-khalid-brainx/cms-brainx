import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { activeSiteMiddleware } from './common/active-site.js';
import { AuthModule } from './auth/auth.module.js';
import { ChromeModule } from './chrome/chrome.module.js';
import { ContentModule } from './content/content.module.js';
import { ContentTypesModule } from './content-types/content-types.module.js';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PublicModule } from './public/public.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { SitesModule } from './sites/sites.module.js';
import { StarterLayoutsModule } from './starter-layouts/starter-layouts.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { TeamModule } from './team/team.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ContentModule,
    ChromeModule,
    ContentTypesModule,
    TeamModule,
    MediaModule,
    SitesModule,
    StarterLayoutsModule,
    SubmissionsModule,
    PublicModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(activeSiteMiddleware).forRoutes('*');
  }
}
