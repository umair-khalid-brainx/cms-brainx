import type { UserRepository } from './user.repository.js';

type WithMemberships = { findByIdWithMemberships: (id: string) => Promise<{ memberships: unknown[] } | null | undefined> };

/**
 * Specs mock `findByIdWithMemberships`; this adds the `findActiveMembership`
 * the services now call, resolving to the first membership (no `X-Site-Id`).
 */
export function withActive(users: WithMemberships): UserRepository {
  return {
    ...users,
    findActiveMembership: async (id: string) => (await users.findByIdWithMemberships(id))?.memberships[0] ?? null,
  } as unknown as UserRepository;
}
