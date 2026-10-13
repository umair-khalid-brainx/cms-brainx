import type { Role } from '../generated/prisma/client.js';
import { hasPermission, ROLE_PERMISSIONS } from './permission.js';

const roles = Object.keys(ROLE_PERMISSIONS) as Role[];

describe('role permissions (GOV-06, GOV-07)', () => {
  it('a viewer can read and nothing else', () => {
    expect(ROLE_PERMISSIONS.viewer).toEqual(['content:read']);
  });

  it('only owner, administrator and editor can review', () => {
    expect(roles.filter((role) => hasPermission(role, 'content:review')).sort()).toEqual(['administrator', 'editor', 'owner']);
  });

  it('an author can publish but not review', () => {
    expect(hasPermission('author', 'content:publish')).toBe(true);
    expect(hasPermission('author', 'content:review')).toBe(false);
  });

  it('a contributor can write, but neither publish nor review', () => {
    expect(hasPermission('contributor', 'content:write')).toBe(true);
    expect(hasPermission('contributor', 'content:publish')).toBe(false);
    expect(hasPermission('contributor', 'content:review')).toBe(false);
  });

  it('every role can read', () => {
    expect(roles.every((role) => hasPermission(role, 'content:read'))).toBe(true);
  });
});
