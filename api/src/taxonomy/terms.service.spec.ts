import { withActive } from '../users/test-support.js';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import { fakeTermRepository } from './term-test-kit.js';
import { TermsService } from './terms.service.js';

const members: Record<string, string> = { alice: 'site-a', bob: 'site-b' };
const users = {
  findByIdWithMemberships: vi.fn(async (id: string) => ({ id, memberships: [{ siteId: members[id], site: { subdomain: members[id].replace('site-', 'sub-') } }] })),
};

function setup() {
  const kit = fakeTermRepository();
  const revalidation = { site: vi.fn(async () => {}) };
  const service = new TermsService(kit.repo, withActive(users), revalidation as unknown as RevalidationService);
  return { service, revalidation, ...kit };
}

const posts = { name: 'Posts', hasCategories: true, hasTags: true };

describe('TermsService lists (TAX-01)', () => {
  it('creates a category and a tag with the same name side by side', async () => {
    const { service } = setup();
    await service.create('alice', { kind: 'category', name: 'News' });
    await service.create('alice', { kind: 'tag', name: 'News' });
    expect((await service.list('alice')).map((t) => `${t.kind}:${t.slug}`)).toEqual(['category:news', 'tag:news']);
  });

  it('refuses a second one with the same slug, whatever the case, in the same kind', async () => {
    const { service } = setup();
    await service.create('alice', { kind: 'category', name: 'News' });
    await expect(service.create('alice', { kind: 'category', name: ' news ' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a bad name with a 400', async () => {
    const { service } = setup();
    await expect(service.create('alice', { kind: 'tag', name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('alice', { kind: 'tag', name: 'x'.repeat(61) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('shows each site only its own terms', async () => {
    const { service } = setup();
    await service.create('alice', { kind: 'category', name: 'News' });
    expect(await service.list('bob')).toEqual([]);
    await service.create('bob', { kind: 'category', name: 'News' });
    expect(await service.list('alice')).toHaveLength(1);
  });

  it('renames: new name and new slug', async () => {
    const { service } = setup();
    const term = await service.create('alice', { kind: 'category', name: 'News' });
    expect(await service.rename('alice', term.id, { name: 'Company News' })).toMatchObject({ name: 'Company News', slug: 'company-news' });
  });

  it('lets a term change only its capitalisation', async () => {
    const { service } = setup();
    const term = await service.create('alice', { kind: 'tag', name: 'news' });
    expect(await service.rename('alice', term.id, { name: 'News' })).toMatchObject({ name: 'News', slug: 'news' });
  });

  it('refuses a rename onto another term of the same kind', async () => {
    const { service } = setup();
    await service.create('alice', { kind: 'category', name: 'News' });
    const other = await service.create('alice', { kind: 'category', name: 'Updates' });
    await expect(service.rename('alice', other.id, { name: 'news' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('cannot rename or delete another site’s term', async () => {
    const { service } = setup();
    const term = await service.create('alice', { kind: 'category', name: 'News' });
    await expect(service.rename('bob', term.id, { name: 'Mine' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('bob', term.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.list('alice')).toHaveLength(1);
  });

  it('delete unlinks the term from its entries', async () => {
    const { service, links, setLinks } = setup();
    const term = await service.create('alice', { kind: 'category', name: 'News' });
    setLinks('site-a', 'entry-1', [{ kind: 'category', termIds: [term.id] }]);
    expect((await service.list('alice'))[0].entryCount).toBe(1);
    await service.remove('alice', term.id);
    expect(links).toEqual([]);
    expect(await service.list('alice')).toEqual([]);
  });
});

describe('TermsService refreshes the public site (TAX-02)', () => {
  it('renaming and deleting a term refresh its own site, once each', async () => {
    const { service, revalidation } = setup();
    const term = await service.create('alice', { kind: 'category', name: 'News' });
    expect(revalidation.site).not.toHaveBeenCalled();
    await service.rename('alice', term.id, { name: 'Company News' });
    expect(revalidation.site).toHaveBeenLastCalledWith('sub-a');
    await service.remove('alice', term.id);
    expect(revalidation.site).toHaveBeenCalledTimes(2);
    expect(revalidation.site).toHaveBeenLastCalledWith('sub-a');
  });

  it('refreshes nothing when the change is refused', async () => {
    const { service, revalidation } = setup();
    const term = await service.create('alice', { kind: 'category', name: 'News' });
    await expect(service.rename('bob', term.id, { name: 'Mine' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('bob', term.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(revalidation.site).not.toHaveBeenCalled();
  });
});

describe('TermsService.resolveAssignment', () => {
  it('returns null when nothing is asked', async () => {
    const { service } = setup();
    expect(await service.resolveAssignment('site-a', posts, {})).toBeNull();
    expect(await service.resolveAssignment('site-a', null, {})).toBeNull();
  });

  it('accepts existing categories and creates new tags', async () => {
    const { service, terms } = setup();
    const news = await service.create('alice', { kind: 'category', name: 'News' });
    const links = await service.resolveAssignment('site-a', posts, { categoryIds: [news.id], tags: ['Launch'] });
    expect(links).toEqual([
      { kind: 'category', termIds: [news.id] },
      { kind: 'tag', termIds: [expect.any(String)] },
    ]);
    expect(terms.filter((t) => t.kind === 'tag').map((t) => t.name)).toEqual(['Launch']);
  });

  it('reuses an existing tag whatever the case it is typed in', async () => {
    const { service, terms } = setup();
    const tag = await service.create('alice', { kind: 'tag', name: 'Launch' });
    const links = await service.resolveAssignment('site-a', posts, { tags: ['LAUNCH', 'launch '] });
    expect(links).toEqual([{ kind: 'tag', termIds: [tag.id] }]);
    expect(terms).toHaveLength(1);
  });

  it('refuses a category id from another site', async () => {
    const { service } = setup();
    const theirs = await service.create('bob', { kind: 'category', name: 'Secret' });
    await expect(service.resolveAssignment('site-a', posts, { categoryIds: [theirs.id] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an id that is a tag, or one that does not exist', async () => {
    const { service } = setup();
    const tag = await service.create('alice', { kind: 'tag', name: 'x' });
    await expect(service.resolveAssignment('site-a', posts, { categoryIds: [tag.id] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resolveAssignment('site-a', posts, { categoryIds: ['nope'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a kind the type has not opted into, and creates nothing', async () => {
    const { service, terms } = setup();
    const noTags = { ...posts, hasTags: false };
    await expect(service.resolveAssignment('site-a', noTags, { tags: ['Launch'] })).rejects.toBeInstanceOf(BadRequestException);
    expect(terms).toEqual([]);
  });

  it('refuses terms on a page', async () => {
    const { service } = setup();
    await expect(service.resolveAssignment('site-a', null, { tags: ['x'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('leaves an opted-out kind alone when the request for it is empty', async () => {
    const { service } = setup();
    const links = await service.resolveAssignment('site-a', { ...posts, hasTags: false }, { categoryIds: [], tags: [] });
    expect(links).toEqual([{ kind: 'category', termIds: [] }]);
  });

  it('refuses more than 20 tags', async () => {
    const { service } = setup();
    const many = Array.from({ length: 21 }, (_, i) => `t${i}`);
    await expect(service.resolveAssignment('site-a', posts, { tags: many })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TermsService.forEntry', () => {
  it('shows only the kinds the type still has on, keeping the stored links', async () => {
    const { service, setLinks } = setup();
    const cat = await service.create('alice', { kind: 'category', name: 'News' });
    const tag = await service.create('alice', { kind: 'tag', name: 'Launch' });
    setLinks('site-a', 'e1', [
      { kind: 'category', termIds: [cat.id] },
      { kind: 'tag', termIds: [tag.id] },
    ]);
    expect(await service.forEntry('site-a', 'e1', posts)).toEqual({
      categories: [{ id: cat.id, name: 'News', slug: 'news' }],
      tags: [{ id: tag.id, name: 'Launch', slug: 'launch' }],
    });
    expect((await service.forEntry('site-a', 'e1', { ...posts, hasTags: false })).tags).toEqual([]);
    // Switched back on: they are there again.
    expect((await service.forEntry('site-a', 'e1', posts)).tags).toHaveLength(1);
    expect(await service.forEntry('site-a', 'e1', null)).toEqual({ categories: [], tags: [] });
  });
});
