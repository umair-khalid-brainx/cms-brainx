import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import type { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// BLK-06 / D-034. Requires a running database. Fixtures are written straight
// through PrismaService because there is no API for creating a site; the
// code under test only ever goes through the repositories.

const SECRET = 'test-form-secret';
const RUN = `t${Date.now()}`;

const FORM_BLOCK = {
  type: 'contactForm',
  submitLabel: 'Send',
  fields: [
    { name: 'name', label: 'Name', fieldType: 'text', required: true },
    { name: 'email', label: 'Email', fieldType: 'email', required: true },
    { name: 'message', label: 'Message', fieldType: 'textarea' },
  ],
};

describe('Contact form submissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const siteIds: string[] = [];
  const userIds: string[] = [];

  async function makeSite(label: string) {
    const site = await prisma.site.create({
      data: { host: `${label}-${RUN}.test`, subdomain: `${label}-${RUN}`, name: `Site ${label}` },
    });
    siteIds.push(site.id);
    await prisma.content.create({
      data: { siteId: site.id, title: 'Contact', slug: 'contact', path: '/contact', status: 'published', blocks: [{ type: 'hero', title: 'Hi' }, FORM_BLOCK] },
    });
    await prisma.content.create({
      data: { siteId: site.id, title: 'Draft', slug: 'draft', path: '/draft', status: 'draft', blocks: [FORM_BLOCK] },
    });
    return site;
  }

  async function makeMember(key: string, siteId: string, role: Role) {
    const user = await prisma.user.create({
      data: { email: `${key}-${RUN}@example.test`, name: key, passwordHash: 'x', memberships: { create: { siteId, role } } },
    });
    userIds.push(user.id);
    tokens[key] = await app.get(JwtService).signAsync({ sub: user.id, email: user.email });
  }

  const submit = (subdomain: string, body: object, secret: string | null = SECRET) => {
    const req = request(app.getHttpServer()).post(`/public/sites/${subdomain}/submissions`);
    if (secret !== null) req.set('x-form-secret', secret);
    return req.send(body);
  };

  const valid = { path: '/contact', blockIndex: 1, values: { name: 'Ada', email: 'ada@example.com', message: 'Hello there' } };

  beforeAll(async () => {
    process.env.FORM_SUBMIT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const a = await makeSite('a');
    const b = await makeSite('b');
    await makeMember('ownerA', a.id, 'owner');
    await makeMember('ownerB', b.id, 'owner');
    await makeMember('contributorA', a.id, 'contributor');
  });

  afterAll(async () => {
    await prisma.site.deleteMany({ where: { id: { in: siteIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects a submission without the shared secret', async () => {
    await submit(`a-${RUN}`, valid, null).expect(403);
    await submit(`a-${RUN}`, valid, 'wrong').expect(403);
  });

  it('stores a valid submission for that site, with labels, in field order', async () => {
    await submit(`a-${RUN}`, { ...valid, values: { ...valid.values, injected: 'nope' } }).expect(201);
    const rows = await prisma.submission.findMany({ where: { siteId: siteIds[0] } });
    expect(rows).toHaveLength(1);
    expect(rows[0].pagePath).toBe('/contact');
    expect(rows[0].answers).toEqual([
      { name: 'name', label: 'Name', value: 'Ada' },
      { name: 'email', label: 'Email', value: 'ada@example.com' },
      { name: 'message', label: 'Message', value: 'Hello there' },
    ]);
  });

  it('enforces required fields and email format on the server', async () => {
    const missing = await submit(`a-${RUN}`, { ...valid, values: { email: 'ada@example.com' } }).expect(400);
    expect(missing.body.message).toContain('Name is required');
    const badEmail = await submit(`a-${RUN}`, { ...valid, values: { name: 'Ada', email: 'not-an-email' } }).expect(400);
    expect(badEmail.body.message).toContain('Email must be an email address');
  });

  it('treats a field named like an Object.prototype key as a normal field', async () => {
    const odd = { ...FORM_BLOCK, fields: [{ name: 'constructor', label: 'Odd', fieldType: 'text', required: true }] };
    await prisma.content.create({
      data: { siteId: siteIds[0], title: 'Odd', slug: 'odd', path: '/odd', status: 'published', blocks: [odd] },
    });
    const missing = await submit(`a-${RUN}`, { path: '/odd', blockIndex: 0, values: {} }).expect(400);
    expect(missing.body.message).toContain('Odd is required');
    await submit(`a-${RUN}`, { path: '/odd', blockIndex: 0, values: { constructor: 'fine' } }).expect(201);
    await prisma.submission.deleteMany({ where: { siteId: siteIds[0], pagePath: '/odd' } });
  });

  it('rejects a block index that is not a contact form, and pages that are not live', async () => {
    await submit(`a-${RUN}`, { ...valid, blockIndex: 0 }).expect(400);
    await submit(`a-${RUN}`, { ...valid, path: '/draft', blockIndex: 0 }).expect(404);
    await submit('no-such-site', valid).expect(404);
  });

  it('lists only the caller’s own site’s submissions', async () => {
    await submit(`b-${RUN}`, { ...valid, values: { name: 'Bea', email: 'bea@example.com' } }).expect(201);

    const listA = await request(app.getHttpServer()).get('/submissions').set('Authorization', `Bearer ${tokens.ownerA}`).expect(200);
    expect(listA.body.total).toBe(1);
    expect(listA.body.items).toHaveLength(1);
    expect(listA.body.items[0].preview).toBe('Ada');

    const listB = await request(app.getHttpServer()).get('/submissions').set('Authorization', `Bearer ${tokens.ownerB}`).expect(200);
    expect(listB.body.items).toHaveLength(1);
    expect(listB.body.items[0].preview).toBe('Bea');

    const idA = listA.body.items[0].id as string;
    const detail = await request(app.getHttpServer()).get(`/submissions/${idA}`).set('Authorization', `Bearer ${tokens.ownerA}`).expect(200);
    expect(detail.body.answers).toHaveLength(3);
    // Site B's owner can't open site A's submission even with its id.
    await request(app.getHttpServer()).get(`/submissions/${idA}`).set('Authorization', `Bearer ${tokens.ownerB}`).expect(404);
  });

  it('pages through a site’s submissions newest first, and refuses another site’s id as a cursor', async () => {
    // 55 more for site A, straight into the table: going through the endpoint
    // would be identical work 55 times. Distinct timestamps keep the order exact.
    const base = Date.now();
    await prisma.submission.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        siteId: siteIds[0],
        pageTitle: 'Contact',
        pagePath: '/contact',
        answers: [{ name: 'name', label: 'Name', value: `Bulk ${i}` }],
        createdAt: new Date(base + i * 1000),
      })),
    });
    const auth = { Authorization: `Bearer ${tokens.ownerA}` };

    const first = await request(app.getHttpServer()).get('/submissions').set(auth).expect(200);
    expect(first.body.total).toBe(56);
    expect(first.body.items).toHaveLength(50);
    expect(first.body.items[0].preview).toBe('Bulk 54');
    expect(first.body.nextCursor).toBe(first.body.items[49].id);

    const second = await request(app.getHttpServer()).get(`/submissions?after=${first.body.nextCursor}`).set(auth).expect(200);
    expect(second.body.items).toHaveLength(6);
    expect(second.body.nextCursor).toBeNull();
    expect(second.body.items.at(-1).preview).toBe('Ada');
    const ids = [...first.body.items, ...second.body.items].map((item: { id: string }) => item.id);
    expect(new Set(ids).size).toBe(56);

    const otherSite = await request(app.getHttpServer()).get('/submissions').set('Authorization', `Bearer ${tokens.ownerB}`).expect(200);
    await request(app.getHttpServer()).get(`/submissions?after=${otherSite.body.items[0].id}`).set(auth).expect(400);
  });

  it('requires submissions:read', async () => {
    await request(app.getHttpServer()).get('/submissions').set('Authorization', `Bearer ${tokens.contributorA}`).expect(403);
    await request(app.getHttpServer()).get('/submissions').expect(401);
  });
});
