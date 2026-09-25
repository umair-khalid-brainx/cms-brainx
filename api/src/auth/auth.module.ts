import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';

// A standalone const, not inline in `imports`, so it can also be re-exported:
// `JwtAuthGuard`/`PermissionsGuard` need `JwtService`/`UserRepository`
// resolvable wherever they're used via `@UseGuards(...)`, and Nest
// instantiates a guard referenced that way in the *consuming* module's own
// injector — being exported here isn't enough on its own, the module using it
// (e.g. ContentModule, TeamModule) must also be able to resolve those
// dependencies, which importing this whole module now covers.
const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService): JwtModuleOptions => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
    // JwtModuleOptions wants a `StringValue` literal for expiresIn; this comes
    // from env at runtime, so there's no way to satisfy that without a cast.
    signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '1d' } as JwtModuleOptions['signOptions'],
  }),
});

@Module({
  imports: [UsersModule, jwtModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  // AuthService is exported too: TeamService.acceptInvite reuses
  // AuthService.issueSession to build a login-shaped response after its own
  // invite-acceptance checks, rather than re-deriving that logic.
  exports: [AuthService, JwtAuthGuard, PermissionsGuard, jwtModule],
})
export class AuthModule {}
