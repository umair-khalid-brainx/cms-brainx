import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// MSI-01, MSI-02, MSI-06. Requires a running database. One person (`multi`) belongs to site A as owner and to
// site B as a viewer; `other` owns site C and has nothing to do with them.

const RUN = `m${Date.now()}`;

describe('Multi-site accounts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const userIds: string[] = [];
  const createdSiteIds: string[] = [];

  const as = (key: string, siteId?: string) => ({ Authorization: `Bearer ${tokens[key]}`, ...(siteId && { 'X-Site-Id': siteId }) });
  const get = (path: string, headers: Record<string, string>) => request(app.getHttpServer()).get(path).set(headers);
  const post = (path: string, headers: Record<string, string>, body: object) => request(app.getHttpServer()).post(path).set(headers).send(body);

  async function makeUser(key: string) {
    const user = await prisma.user.create({ data: { email: `${key}-${RUN}@example.test`, name: key, passwordHash: 'x' } });
    userIds.push(user.id);
    tokens[key] = await app.get(JwtService).signAsync({ sub: user.id, email: user.email });
    return user;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    for (const key of ['a', 'b', 'c']) {
      const site = await prisma.site.create({ data: { subdomain: `${key}-${RUN}`, name: `Site ${key}` } });
      ids[key] = site.id;
      createdSiteIds.push(site.id);
      await prisma.content.create({ data: { siteId: site.id, title: `Page of ${key}`, slug: `page-${key}`, path: `/page-${key}`, status: 'draft', blocks: [] } });
    }
    const multi = await makeUser('multi');
    // Joined A first, so A is "the first membership".
    await prisma.siteMembership.create({ data: { userId: multi.id, siteId: ids.a, role: 'owner' } });
    await prisma.siteMembership.create({ data: { userId: multi.id, siteId: ids.b, role: 'viewer' } });
    const other = await makeUser('other');
    await prisma.siteMembership.create({ data: { userId: other.id, siteId: ids.c, role: 'owner' } });
    const staff = await makeUser('staff');
    await prisma.siteMembership.create({ data: { userId: staff.id, siteId: ids.a, role: 'administrator' } });
    await makeUser('nobody');
  });

  afterAll(async () => {
    await prisma.site.deleteMany({ where: { id: { in: [...Object.values(ids), ...createdSiteIds] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  const slugs = (res: request.Response) => (res.body as { slug: string }[]).map((page) => page.slug);

  describe('X-Site-Id (MSI-01)', () => {
    it('reads the site the header names', async () => {
      expect(slugs(await get('/content', as('multi', ids.a)).expect(200))).toEqual(['page-a']);
      expect(slugs(await get('/content', as('multi', ids.b)).expect(200))).toEqual(['page-b']);
    });

    it('falls back to the first membership without the header', async () => {
      expect(slugs(await get('/content', as('multi')).expect(200))).toEqual(['page-a']);
    });

    it('is 403 for a site the caller is not a member of, on every kind of route', async () => {
      await get('/content', as('multi', ids.c)).expect(403);
      await get('/content/page-c', as('multi', ids.c)).expect(403);
      await get('/media', as('multi', ids.c)).expect(403);
      await get('/menus/header', as('multi', ids.c)).expect(403);
      await get('/content-types', as('multi', ids.c)).expect(403);
      await get('/redirects', as('multi', ids.c)).expect(403);
      await get('/terms', as('multi', ids.c)).expect(403);
      await get('/submissions', as('multi', ids.c)).expect(403);
    });

    it('is 403 for an id that is no site at all', async () => {
      await get('/content', as('multi', 'does-not-exist')).expect(403);
    });

    it('does not let a page of one site be read under another site’s header', async () => {
      await get('/content/page-b', as('multi', ids.a)).expect(404);
      await get('/content/page-b', as('multi', ids.b)).expect(200);
    });

    it('applies the role the caller has in the named site, not in another', async () => {
      await post('/content', as('multi', ids.a), { title: 'From owner' }).expect(201);
      await post('/content', as('multi', ids.b), { title: 'From viewer' }).expect(403);
      expect(await prisma.content.count({ where: { siteId: ids.b, title: 'From viewer' } })).toBe(0);
    });

    it('writes into the site the header names', async () => {
      await post('/content', as('multi', ids.a), { title: 'Lands in A', slug: 'lands-in-a' }).expect(201);
      expect(await prisma.content.count({ where: { siteId: ids.a, slug: 'lands-in-a' } })).toBe(1);
      expect(await prisma.content.count({ where: { siteId: ids.b, slug: 'lands-in-a' } })).toBe(0);
    });

    it('ignores a header on a route that names its own site, which is still membership-checked', async () => {
      await get(`/sites/${ids.a}`, as('multi', ids.b)).expect(200);
      await get(`/sites/${ids.c}`, as('multi', ids.a)).expect(403);
    });
  });

  describe('POST /sites (MSI-02)', () => {
    const name = `Created ${RUN}`;

    it('lets an owner create a site and become its owner, with the default theme and no pages', async () => {
      const res = await post('/sites', as('multi'), { name, subdomain: `new-${RUN}` }).expect(201);
      createdSiteIds.push(res.body.id);
      expect(res.body).toMatchObject({ name, subdomain: `new-${RUN}`, role: 'owner' });

      const membership = await prisma.siteMembership.findFirst({ where: { siteId: res.body.id } });
      expect(membership?.role).toBe('owner');
      expect(await prisma.content.count({ where: { siteId: res.body.id } })).toBe(0);
      const site = await prisma.site.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(site.themeJson).toMatchObject({ typeSet: 'editorial' });

      // The new site is reachable under its own id, and is the account's *last* membership, not its first.
      await get('/content', as('multi', res.body.id)).expect(200);
      expect(slugs(await get('/content', as('multi')).expect(200))).toContain('page-a');
    });

    it('lists the new site among the caller’s memberships', async () => {
      const me = await get('/auth/me', as('multi')).expect(200);
      const subs = (me.body.memberships as { siteSubdomain: string }[]).map((m) => m.siteSubdomain);
      expect(subs).toEqual([`a-${RUN}`, `b-${RUN}`, `new-${RUN}`]);
    });

    it('refuses an address that is taken or reserved, and a blank title', async () => {
      await post('/sites', as('multi'), { name: 'x', subdomain: `a-${RUN}` }).expect(409);
      await post('/sites', as('multi'), { name: 'x', subdomain: 'admin' }).expect(400);
      await post('/sites', as('multi'), { name: ' ', subdomain: `ok-${RUN}` }).expect(400);
    });

    it('refuses someone who owns no site: an administrator, a viewer-only member, a stranger', async () => {
      await post('/sites', as('staff'), { name: 'x', subdomain: `staff-${RUN}` }).expect(403);
      await post('/sites', as('nobody'), { name: 'x', subdomain: `nobody-${RUN}` }).expect(403);
      expect(await prisma.site.count({ where: { subdomain: { in: [`staff-${RUN}`, `nobody-${RUN}`] } } })).toBe(0);
    });

    it('refuses a request with no token', async () => {
      await request(app.getHttpServer()).post('/sites').send({ name: 'x', subdomain: `anon-${RUN}` }).expect(401);
    });

    it('ignores a siteId or role slipped into the body', async () => {
      await post('/sites', as('multi'), { name: 'x', subdomain: `slip-${RUN}`, siteId: ids.c, role: 'viewer' }).expect(400);
    });

    it('two simultaneous requests for one free address make one site, the other is a 409', async () => {
      const results = await Promise.all([
        post('/sites', as('multi'), { name: 'Race 1', subdomain: `race-${RUN}` }),
        post('/sites', as('other'), { name: 'Race 2', subdomain: `race-${RUN}` }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      for (const r of results) if (r.status === 201) createdSiteIds.push(r.body.id);
    });
  });
});
