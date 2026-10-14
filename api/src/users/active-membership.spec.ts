import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { activeSiteMiddleware } from '../common/active-site.js';
import { UserRepository } from './user.repository.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const memberships = [
  { siteId: 'site-a', role: 'owner', site: { subdomain: 'a' } },
  { siteId: 'site-b', role: 'editor', site: { subdomain: 'b' } },
];
const repo = new UserRepository({
  user: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'none' ? { memberships: [] } : { memberships }) },
} as unknown as PrismaService);

/** Runs `fn` the way a request with this header would: inside the middleware's store. */
function withHeader<T>(header: string | undefined, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = { headers: header === undefined ? {} : { 'x-site-id': header } };
    activeSiteMiddleware(req as never, {} as never, () => void fn().then(resolve, reject));
  });
}

describe('findActiveMembership (MSI-01)', () => {
  it('falls back to the first membership without a header', async () => {
    expect((await withHeader(undefined, () => repo.findActiveMembership('u')))?.siteId).toBe('site-a');
  });

  it('picks the membership the header names, with that site role', async () => {
    const m = await withHeader('site-b', () => repo.findActiveMembership('u'));
    expect(m).toMatchObject({ siteId: 'site-b', role: 'editor' });
  });

  it('is 403 for a site the caller does not belong to', async () => {
    await expect(withHeader('site-z', () => repo.findActiveMembership('u'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is null for a user with no membership and no header', async () => {
    expect(await withHeader(undefined, () => repo.findActiveMembership('none'))).toBeNull();
  });

  it('treats a blank header as absent', async () => {
    expect((await withHeader('  ', () => repo.findActiveMembership('u')))?.siteId).toBe('site-a');
  });
});
