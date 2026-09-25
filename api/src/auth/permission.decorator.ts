import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permission.js';

export const PERMISSION_KEY = 'permission';

/** Marks a handler as requiring a permission; read by PermissionsGuard. */
export const RequirePermission = (permission: PermissionKey) => SetMetadata(PERMISSION_KEY, permission);
