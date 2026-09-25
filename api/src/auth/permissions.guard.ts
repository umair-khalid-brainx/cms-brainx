import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRepository } from '../users/user.repository.js';
import { PERMISSION_KEY } from './permission.decorator.js';
import { hasPermission, type PermissionKey } from './permission.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

/**
 * Runs after JwtAuthGuard (always paired with it via @UseGuards(JwtAuthGuard,
 * PermissionsGuard)) — request.user is already populated.
 *
 * siteId resolution: a route with a `:siteId` param (team/invite routes) uses
 * it directly. A route without one (content routes) falls back to the
 * caller's first site membership — the same simplification
 * ContentService.resolveSiteId already makes; see DECISIONS.md D-020/D-023
 * for why that's accepted for now and where it stops being accepted.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride, not get(..., context.getHandler()) alone: a
    // class-level @RequirePermission (TeamController's pattern) only attaches
    // metadata to the class, not to each individual method — reading only
    // context.getHandler() would silently find nothing and let everyone
    // through (confirmed the hard way: an Editor could list a site's members
    // until this was fixed). This checks the handler first, then falls back
    // to the class, which also still supports ContentController's per-method
    // decorators.
    const required = this.reflector.getAllAndOverride<PermissionKey | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const siteId = await this.resolveSiteId(request);
    if (!siteId) throw new ForbiddenException('No site membership');

    const membership = await this.users.findMembership(request.user.sub, siteId);
    if (!membership) throw new ForbiddenException('Not a member of this site');
    if (!hasPermission(membership.role, required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }

  private async resolveSiteId(request: AuthenticatedRequest): Promise<string | undefined> {
    const paramSiteId = request.params.siteId;
    if (typeof paramSiteId === 'string') return paramSiteId;

    const user = await this.users.findByIdWithMemberships(request.user.sub);
    return user?.memberships[0]?.siteId;
  }
}
