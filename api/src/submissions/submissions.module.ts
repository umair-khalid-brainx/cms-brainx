import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { UsersModule } from '../users/users.module.js';
import { SubmissionRepository } from './submission.repository.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';

// Same guard-wiring gotcha as ContentModule (see auth.module.ts).
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [SubmissionsController],
  providers: [SubmissionRepository, SubmissionsService, JwtAuthGuard, PermissionsGuard],
  // For PublicModule's submit endpoint.
  exports: [SubmissionRepository],
})
export class SubmissionsModule {}
