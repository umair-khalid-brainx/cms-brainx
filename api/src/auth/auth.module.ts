import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// A standalone const, not inline in `imports`, so it can also be re-exported:
// `JwtAuthGuard` needs `JwtService` resolvable wherever it's used via
// `@UseGuards(JwtAuthGuard)`, and Nest instantiates a guard referenced that
// way in the *consuming* module's own injector — being exported here isn't
// enough on its own, the module using it (e.g. ContentModule) must also be
// able to resolve JwtService, which importing this whole module now covers.
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
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, jwtModule],
})
export class AuthModule {}
