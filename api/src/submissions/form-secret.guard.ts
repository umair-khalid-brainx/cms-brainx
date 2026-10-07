import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const FORM_SECRET_HEADER = 'x-form-secret';

/**
 * Only `web`'s server action may submit a contact form (D-034): the public
 * endpoint is otherwise reachable by anyone, and the honeypot and rate limit
 * live in `web`. Fails closed — no secret configured means no submissions.
 */
@Injectable()
export class FormSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('FORM_SUBMIT_SECRET');
    if (!expected) throw new ServiceUnavailableException('Form submissions are not configured');

    const request = context.switchToHttp().getRequest<Request>();
    const given = request.headers[FORM_SECRET_HEADER];
    if (typeof given !== 'string' || !sameSecret(given, expected)) {
      throw new ForbiddenException('Invalid form secret');
    }
    return true;
  }
}

// Hash both sides first so timingSafeEqual gets equal-length buffers and the
// comparison doesn't leak the secret's length.
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
