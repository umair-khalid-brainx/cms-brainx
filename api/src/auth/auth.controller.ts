import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService, type LoginResponse, type SessionResponse } from './auth.service.js';
import { loginSchema, type LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginDto): Promise<LoginResponse> {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: AuthenticatedRequest): Promise<SessionResponse> {
    const session = await this.auth.session(request.user.sub);
    if (!session) throw new NotFoundException('User no longer exists');
    return session;
  }
}
