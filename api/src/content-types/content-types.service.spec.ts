import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { UserRepository } from '../users/user.repository.js';
import type { ContentTypeRepository } from './content-type.repository.js';
import { ContentTypesService } from './content-types.service.js';

type Type = {
  id: string;
  siteId: string;
  name: string;
  singularName: string;
  prefix: string;
  isBuiltIn: boolean;
};

// An in-memory stand-in for the repository, honestly scoped by siteId like the
// real one: every method takes a site and never sees another's rows.
function setup(extra: { entries?: { siteId: string; typeId: string; status: string }[]; pages?: { siteId: string; path: string }[] } = {}) {
  const types: Type[] = [
    { id: 'blog-a', siteId: 'site-a', name: 'Posts', singularName: 'Post', prefix: 'blog', isBuiltIn: true },
    { id: 'events-a', siteId: 'site-a', name: 'Events', singularName: 'Event', prefix: 'events', isBuiltIn: false },
    { id: 'blog-b', siteId: 'site-b', name: 'Posts', singularName: 'Post', prefix: 'blog', isBuiltIn: true },
  ];
  const entries = extra.entries ?? [];
  const pages = extra.pages ?? [];
  let nextId = 1;

  const repo = {
    findMany: vi.fn(async (siteId: string) => types.filter((t) => t.siteId === siteId)),
    findById: vi.fn(async (siteId: string, id: string) => types.find((t) => t.siteId === siteId && t.id === id) ?? null),
    findByPrefix: vi.fn(async (siteId: string, prefix: string) =>
      types.find((t) => t.siteId === siteId && t.prefix === prefix) ?? null,
    ),
    create: vi.fn(async (siteId: string, data: Omit<Type, 'id' | 'siteId' | 'isBuiltIn'> & { isBuiltIn?: boolean }) => {
      const row = { isBuiltIn: false, ...data, id: `new-${nextId++}`, siteId };
      types.push(row);
      return row;
    }),
    update: vi.fn(async (siteId: string, id: string, data: Partial<Type>) => {
      const row = types.find((t) => t.siteId === siteId && t.id === id);
      if (row) Object.assign(row, data);
      return { count: row ? 1 : 0 };
    }),
    updatePrefixIfEmpty: vi.fn(async (siteId: string, id: string, prefix: string) => {
      const row = types.find((t) => t.siteId === siteId && t.id === id);
      const empty = !entries.some((e) => e.siteId === siteId && e.typeId === id);
      if (row && empty) row.prefix = prefix;
      return { count: row && empty ? 1 : 0 };
    }),
    delete: vi.fn(async (siteId: string, id: string) => {
      const at = types.findIndex((t) => t.siteId === siteId && t.id === id);
      if (at >= 0) types.splice(at, 1);
      return { count: at >= 0 ? 1 : 0 };
    }),
    countEntries: vi.fn(async (siteId: string) => {
      const counts = new Map<string, { active: number; total: number }>();
      for (const e of entries.filter((e) => e.siteId === siteId)) {
        const c = counts.get(e.typeId) ?? { active: 0, total: 0 };
        c.total += 1;
        if (e.status !== 'archived') c.active += 1;
        counts.set(e.typeId, c);
      }
      return counts;
    }),
    hasEntries: vi.fn(async (siteId: string, typeId: string) => entries.some((e) => e.siteId === siteId && e.typeId === typeId)),
    pageUses: vi.fn(async (siteId: string, prefix: string) =>
      pages.some((p) => p.siteId === siteId && (p.path === `/${prefix}` || p.path.startsWith(`/${prefix}/`))),
    ),
  };
  const users = {
    findByIdWithMemberships: vi.fn(async (id: string) => ({
      memberships: [{ siteId: id === 'alice' ? 'site-a' : 'site-b' }],
    })),
  };
  const service = new ContentTypesService(repo as unknown as ContentTypeRepository, users as unknown as UserRepository);
  return { service, repo, types };
}

describe('ContentTypesService.list', () => {
  it('shows only the caller’s site, with entry counts, locking built-in types and types with entries', async () => {
    const { service } = setup({
      entries: [
        { siteId: 'site-a', typeId: 'events-a', status: 'published' },
        { siteId: 'site-a', typeId: 'events-a', status: 'archived' },
        { siteId: 'site-b', typeId: 'blog-b', status: 'draft' },
      ],
    });

    const list = await service.list('alice');

    expect(list.map((t) => t.prefix)).toEqual(['blog', 'events']);
    expect(list.find((t) => t.prefix === 'events')).toMatchObject({ entryCount: 1, locked: true });
    expect(list.find((t) => t.prefix === 'blog')).toMatchObject({ entryCount: 0, locked: true });
  });

  it('leaves a type with no entries unlocked', async () => {
    const { service } = setup();

    expect((await service.list('alice')).find((t) => t.prefix === 'events')).toMatchObject({ entryCount: 0, locked: false });
  });
});

describe('ContentTypesService.create', () => {
  const dto = { name: 'Case studies', singularName: 'Case study', prefix: 'case-studies' };

  it('creates a type for the caller’s site', async () => {
    const { service, repo } = setup();

    await service.create('alice', dto);

    expect(repo.create).toHaveBeenCalledWith('site-a', dto);
  });

  it.each([
    ['too short', 'a'],
    ['uppercase', 'Events2'],
    ['a slash', 'a/b'],
    ['reserved', 'admin'],
  ])('refuses an address that is %s with a 400 and creates nothing', async (_label, prefix) => {
    const { service, repo } = setup();

    await expect(service.create('alice', { ...dto, prefix })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('refuses an address another type on the site already has, but not one only another site has', async () => {
    const { service } = setup();

    await expect(service.create('alice', { ...dto, prefix: 'events' })).rejects.toBeInstanceOf(ConflictException);
    // site-b has no "events", so bob may take it.
    await expect(service.create('bob', { ...dto, name: 'Events', prefix: 'events' })).resolves.toMatchObject({ prefix: 'events' });
  });

  it('refuses an address a page already uses, archived or not, including pages underneath it', async () => {
    const { service } = setup({ pages: [{ siteId: 'site-a', path: '/case-studies' }, { siteId: 'site-a', path: '/team/ada' }] });

    await expect(service.create('alice', dto)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.create('alice', { ...dto, name: 'Team', prefix: 'team' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a name another type already has, whatever its capitals', async () => {
    const { service } = setup();

    await expect(service.create('alice', { ...dto, name: 'events', prefix: 'happenings' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ContentTypesService.update', () => {
  it('renames a type any time', async () => {
    const { service, types } = setup({ entries: [{ siteId: 'site-a', typeId: 'events-a', status: 'published' }] });

    await service.update('alice', 'events-a', { name: 'Happenings', singularName: 'Happening' });

    expect(types.find((t) => t.id === 'events-a')).toMatchObject({ name: 'Happenings', prefix: 'events' });
  });

  it('moves the address while the type has no entries', async () => {
    const { service, types } = setup();

    await service.update('alice', 'events-a', { prefix: 'happenings' });

    expect(types.find((t) => t.id === 'events-a')?.prefix).toBe('happenings');
  });

  it('refuses to move the address once the type has entries, even archived ones', async () => {
    const { service, types } = setup({ entries: [{ siteId: 'site-a', typeId: 'events-a', status: 'archived' }] });

    await expect(service.update('alice', 'events-a', { prefix: 'happenings' })).rejects.toBeInstanceOf(ConflictException);
    expect(types.find((t) => t.id === 'events-a')?.prefix).toBe('events');
  });

  it('refuses to move the built-in type', async () => {
    const { service } = setup();

    await expect(service.update('alice', 'blog-a', { prefix: 'news' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets a request that repeats the current address through', async () => {
    const { service } = setup({ entries: [{ siteId: 'site-a', typeId: 'events-a', status: 'published' }] });

    await expect(service.update('alice', 'events-a', { name: 'Events', prefix: 'events' })).resolves.toBeTruthy();
  });

  it('refuses a new address that is bad, taken, or used by a page', async () => {
    const { service } = setup({ pages: [{ siteId: 'site-a', path: '/news' }] });

    await expect(service.update('alice', 'events-a', { prefix: 'Bad Address' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('alice', 'events-a', { prefix: 'blog' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.update('alice', 'events-a', { prefix: 'news' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a name another type has', async () => {
    const { service } = setup();

    await expect(service.update('alice', 'events-a', { name: 'posts' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('can’t reach another site’s type, and changes nothing there', async () => {
    const { service, types } = setup();

    await expect(service.update('alice', 'blog-b', { name: 'Hacked' })).rejects.toBeInstanceOf(NotFoundException);
    expect(types.find((t) => t.id === 'blog-b')?.name).toBe('Posts');
  });
});

describe('ContentTypesService.remove', () => {
  it('deletes an empty custom type', async () => {
    const { service, types } = setup();

    await service.remove('alice', 'events-a');

    expect(types.some((t) => t.id === 'events-a')).toBe(false);
  });

  it('refuses the built-in type', async () => {
    const { service, types } = setup();

    await expect(service.remove('alice', 'blog-a')).rejects.toBeInstanceOf(ConflictException);
    expect(types.some((t) => t.id === 'blog-a')).toBe(true);
  });

  it('refuses a type that still has entries, archived ones included', async () => {
    const { service, types } = setup({ entries: [{ siteId: 'site-a', typeId: 'events-a', status: 'archived' }] });

    await expect(service.remove('alice', 'events-a')).rejects.toBeInstanceOf(ConflictException);
    expect(types.some((t) => t.id === 'events-a')).toBe(true);
  });

  it('can’t reach another site’s type', async () => {
    const { service, types } = setup();

    await expect(service.remove('alice', 'blog-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(types.some((t) => t.id === 'blog-b')).toBe(true);
  });
});

describe('races that used to be a 500 (TYP-01 review)', () => {
  const known = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' });

  it('answers 409 when two creates claim one address at the same moment', async () => {
    const { service, repo } = setup();
    repo.create.mockRejectedValueOnce(known('P2002'));

    await expect(service.create('alice', { name: 'Things', singularName: 'Thing', prefix: 'things' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('answers 409 when an entry appears between the check and the address change, and moves nothing', async () => {
    const { service, repo, types } = setup();
    // The up-front check saw no entries; one is created before the write.
    repo.hasEntries.mockResolvedValueOnce(false);
    repo.updatePrefixIfEmpty.mockResolvedValueOnce({ count: 0 });

    await expect(service.update('alice', 'events-a', { prefix: 'happenings' })).rejects.toBeInstanceOf(ConflictException);
    expect(types.find((t) => t.id === 'events-a')?.prefix).toBe('events');
  });

  it('answers 409 when an entry appears between the check and the delete', async () => {
    const { service, repo } = setup();
    repo.delete.mockRejectedValueOnce(known('P2003'));

    await expect(service.remove('alice', 'events-a')).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets any other database error through unchanged', async () => {
    const { service, repo } = setup();
    repo.delete.mockRejectedValueOnce(new Error('connection lost'));

    await expect(service.remove('alice', 'events-a')).rejects.toThrow('connection lost');
  });
});
