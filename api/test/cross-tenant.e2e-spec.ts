import 'reflect-metadata';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// GOV-08b (FND-03 folded in): the cross-tenant hunt as a repeatable spec. Two throwaway sites, each with an
// owner and one of everything, built through the API itself. Then, as each owner in turn, every authenticated
// route is called with the other site's slugs, ids and siteId (403/404, the other site's rows unchanged, and no
// response carrying any of its ids or text), and every public route on each host must show only that host's data.
//
// Requires a running database (api/.env). Sites and users are created straight through PrismaService because
// there is no API for that; everything else goes through the routes under test. All of it is removed afterwards.
//
// Adding a route: one row in ADMIN_ROUTES / SLUG_ROUTES / PUBLIC_ROUTES. The "every route is covered" test reads the
// controllers' own metadata and fails until it has one.

const RUN = `t${Date.now()}`;
const FORM_SECRET = `cross-tenant-${RUN}`;
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? 'uploads';

const PAGE_KEYS = ['parent', 'child', 'story', 'contact', 'review', 'draft', 'archived', 'gallery', 'shared'] as const;
type PageKey = (typeof PAGE_KEYS)[number];
type Page = { id: string; slug: string; path: string; title: string };

/** One tenant, as built in beforeAll. Every id here is the other tenant's ammunition. */
type Fx = {
  tag: string;
  siteId: string;
  subdomain: string;
  token: string;
  userIds: string[];
  ownerMembershipId: string;
  editorMembershipId: string;
  inviteId: string;
  typeId: string;
  prefix: string;
  fieldKey: string;
  categoryId: string;
  categorySlug: string;
  tagId: string;
  tagSlug: string;
  mediaId: string;
  mediaUrl: string;
  filename: string;
  pages: Record<PageKey, Page>;
  previewToken: string;
  revisionId: string;
  redirectId: string;
  submissionId: string;
};
type Ctx = { me: Fx; them: Fx };
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * One call. `route` is the controller's route (`PATCH /content/:slug`), used for the coverage check; `path` is
 * the concrete address. `expect` is the allowed statuses (default 403/404). `contains` must appear in the
 * response (so a list that is empty for the wrong reason fails). `allow` are the other tenant's markers that may
 * legitimately appear (only: what this tenant itself stored).
 */
type Row = {
  route: string;
  name?: string;
  path: (c: Ctx) => string;
  body?: (c: Ctx) => unknown;
  file?: boolean;
  headers?: Record<string, string>;
  expect?: number[];
  contains?: (c: Ctx) => string[];
  allow?: (c: Ctx) => string[];
};

const DENIED = [403, 404];
/** Each gallery embeds the other site's picture by address (its siteId and filename): this site's own content. */
const BORROWED = (c: Ctx) => [c.them.siteId, c.them.filename];
const FUTURE = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const hero = (headline: string, image?: { src: string; alt: string }) => ({ type: 'hero', headline, ...(image && { image }) });
const FORM_BLOCK = {
  type: 'contactForm',
  submitLabel: 'Send',
  fields: [
    { name: 'name', label: 'Name', fieldType: 'text', required: true },
    { name: 'email', label: 'Email', fieldType: 'email', required: true },
  ],
};

// ---- Authenticated routes, called as `me` with `them`'s ids ----------------------------------------------------

/** Every route addressed by a page slug, tried with each of the other site's pages. */
const SLUG_ROUTES: Row[] = [
  { route: 'GET /content/:slug', path: () => '' },
  { route: 'GET /content/:slug/checks', path: () => '' },
  { route: 'POST /content/:slug/duplicate', path: () => '' },
  { route: 'GET /content/:slug/preview-link', path: () => '' },
  { route: 'POST /content/:slug/preview-link', path: () => '' },
  { route: 'DELETE /content/:slug/preview-link', path: () => '' },
  { route: 'PATCH /content/:slug', path: () => '', body: () => ({ title: 'pwned', status: 'published' }) },
  { route: 'POST /content/:slug/submit', path: () => '' },
  { route: 'POST /content/:slug/withdraw', path: () => '' },
  { route: 'POST /content/:slug/approve', path: () => '', body: () => ({ version: new Date().toISOString() }) },
  { route: 'POST /content/:slug/reject', path: () => '', body: () => ({ note: 'pwned' }) },
  { route: 'POST /content/:slug/schedule', path: () => '', body: () => ({ publishAt: FUTURE() }) },
  { route: 'POST /content/:slug/publish-now', path: () => '' },
  { route: 'POST /content/:slug/unschedule', path: () => '' },
  { route: 'DELETE /content/:slug', path: () => '' },
  { route: 'GET /content/:slug/revisions', path: () => '' },
  { route: 'GET /content/:slug/revisions/:id', path: () => '' },
  { route: 'POST /content/:slug/revisions/:id/restore', path: () => '' },
];

/** The other site's pages, by slug, crossed with every slug route. */
const VICTIM_PAGES: PageKey[] = ['parent', 'child', 'story', 'contact', 'review', 'draft', 'archived', 'gallery'];

function slugRows(): Row[] {
  return VICTIM_PAGES.flatMap((key) =>
    SLUG_ROUTES.map((row) => ({
      ...row,
      name: `${row.route} [their ${key}]`,
      path: (c: Ctx) =>
        row.route
          .split(' ')[1]
          .replace(':slug', c.them.pages[key].slug)
          .replace(':id', c.them.revisionId),
    })),
  );
}

const ADMIN_ROUTES: Row[] = [
  // Who am I: only my own site.
  { route: 'GET /auth/me', path: () => '/auth/me', expect: [200], contains: (c) => [c.me.siteId] },

  // Lists: my rows, none of theirs.
  { route: 'GET /content', path: () => '/content', expect: [200], contains: (c) => [c.me.pages.parent.id, c.me.pages.child.id], allow: BORROWED },
  { route: 'GET /content', name: 'GET /content?type=<mine>', path: (c) => `/content?type=${c.me.prefix}`, expect: [200], contains: (c) => [c.me.pages.story.id] },
  { route: 'GET /content', name: 'GET /content?type=<theirs>', path: (c) => `/content?type=${c.them.prefix}` },
  { route: 'GET /content/archived', path: () => '/content/archived', expect: [200], contains: (c) => [c.me.pages.archived.id] },
  { route: 'GET /content/archived', name: 'GET /content/archived?type=<theirs>', path: (c) => `/content/archived?type=${c.them.prefix}` },
  { route: 'GET /content/review-queue', path: () => '/content/review-queue', expect: [200], contains: (c) => [c.me.pages.review.id] },
  { route: 'GET /content/:slug', name: 'GET /content/shared (same slug on both sites)', path: () => '/content/shared', expect: [200], contains: (c) => [c.me.pages.shared.id] },
  // Writes to the slug both sites have: each must land on my own row; the snapshot proves theirs is untouched (GOV-08b review).
  { route: 'PATCH /content/:slug', name: 'PATCH /content/shared (same slug on both sites)', path: () => '/content/shared', body: (c) => ({ title: `${c.me.tag} Shared, edited` }), expect: [200], contains: (c) => [c.me.pages.shared.id] },
  { route: 'POST /content/:slug/preview-link', name: 'POST /content/shared/preview-link (same slug)', path: () => '/content/shared/preview-link', expect: [200, 201] },
  { route: 'GET /content/:slug/revisions', name: 'GET /content/shared/revisions (same slug)', path: () => '/content/shared/revisions', expect: [200] },
  { route: 'GET /content/:slug', name: 'GET /content/<my entry> (with terms)', path: (c) => `/content/${c.me.pages.story.slug}`, expect: [200], contains: (c) => [c.me.categoryId, c.me.tagId] },
  { route: 'GET /content/:slug/revisions', name: 'GET my revisions', path: (c) => `/content/${c.me.pages.draft.slug}/revisions`, expect: [200], contains: (c) => [c.me.revisionId] },
  { route: 'GET /media', path: () => '/media', expect: [200], contains: (c) => [c.me.mediaId] },
  { route: 'GET /media/:id/usage', name: 'GET my media usage', path: (c) => `/media/${c.me.mediaId}/usage`, expect: [200], contains: (c) => [c.me.pages.story.id] },
  { route: 'GET /menus/:location', name: 'GET /menus/header', path: () => '/menus/header', expect: [200], contains: (c) => [c.me.pages.parent.id, c.me.pages.child.id] },
  { route: 'GET /menus/:location', name: 'GET /menus/footer', path: () => '/menus/footer', expect: [200], contains: (c) => [c.me.pages.contact.id] },
  { route: 'GET /redirects', path: () => '/redirects', expect: [200], contains: (c) => [c.me.redirectId] },
  { route: 'GET /terms', path: () => '/terms', expect: [200], contains: (c) => [c.me.categoryId, c.me.tagId] },
  { route: 'GET /content-types', path: () => '/content-types', expect: [200], contains: (c) => [c.me.typeId] },
  { route: 'GET /submissions', path: () => '/submissions', expect: [200], contains: (c) => [c.me.submissionId] },
  { route: 'GET /sites/:siteId', name: 'GET my site', path: (c) => `/sites/${c.me.siteId}`, expect: [200], contains: (c) => [c.me.tag] },
  { route: 'GET /sites/:siteId/team/members', name: 'GET my members', path: (c) => `/sites/${c.me.siteId}/team/members`, expect: [200], contains: (c) => [c.me.editorMembershipId] },
  { route: 'GET /sites/:siteId/team/invites', name: 'GET my invites', path: (c) => `/sites/${c.me.siteId}/team/invites`, expect: [200], contains: (c) => [c.me.inviteId] },
  { route: 'GET /starter-layouts', path: () => '/starter-layouts', expect: [200] },

  // My own page with their revision id.
  { route: 'GET /content/:slug/revisions/:id', name: 'GET my page, their revision', path: (c) => `/content/${c.me.pages.draft.slug}/revisions/${c.them.revisionId}` },
  { route: 'POST /content/:slug/revisions/:id/restore', name: 'restore their revision onto my page', path: (c) => `/content/${c.me.pages.draft.slug}/revisions/${c.them.revisionId}/restore` },

  // Their ids smuggled in a body, on my own site.
  { route: 'POST /content', name: 'create under their parent page', path: () => '/content', body: (c) => ({ title: 'Stray', parentId: c.them.pages.parent.id }), expect: [400] },
  { route: 'POST /content', name: 'create an entry of their type', path: () => '/content', body: (c) => ({ title: 'Stray', type: c.them.prefix }), expect: [404] },
  { route: 'POST /content', name: 'create an entry with their category', path: () => '/content', body: (c) => ({ title: 'Stray', type: c.me.prefix, categoryIds: [c.them.categoryId] }), expect: [400] },
  { route: 'POST /content', name: 'create with no ids at all (stays on my site)', path: () => '/content', body: (c) => ({ title: `${c.me.tag} Fresh` }), expect: [201] },
  { route: 'PATCH /content/:slug', name: 'move my page under their parent', path: (c) => `/content/${c.me.pages.draft.slug}`, body: (c) => ({ parentId: c.them.pages.parent.id }), expect: [400] },
  { route: 'PATCH /content/:slug', name: 'tag my entry with their category', path: (c) => `/content/${c.me.pages.story.slug}`, body: (c) => ({ categoryIds: [c.them.categoryId] }), expect: [400] },
  { route: 'PATCH /content/:slug', name: 'their file in my entry’s media field', path: (c) => `/content/${c.me.pages.story.slug}`, body: (c) => ({ data: { [c.me.fieldKey]: c.them.mediaUrl } }), expect: [400] },
  { route: 'PATCH /content/:slug', name: 'their file as my share image', path: (c) => `/content/${c.me.pages.draft.slug}`, body: (c) => ({ seo: { ogImage: c.them.mediaUrl } }), expect: [400] },
  { route: 'PUT /menus/:location', name: 'their page in my menu', path: () => '/menus/header', body: (c) => ({ items: [{ label: 'Stray', contentId: c.them.pages.parent.id }] }), expect: [400] },
  { route: 'PATCH /sites/:siteId/settings', name: 'their file as my logo', path: (c) => `/sites/${c.me.siteId}/settings`, body: (c) => ({ logo: c.them.mediaUrl }), expect: [400] },

  // Their media.
  { route: 'PATCH /media/:id', path: (c) => `/media/${c.them.mediaId}`, body: () => ({ alt: 'pwned' }) },
  { route: 'PUT /media/:id', path: (c) => `/media/${c.them.mediaId}`, file: true },
  { route: 'GET /media/:id/usage', path: (c) => `/media/${c.them.mediaId}/usage` },
  { route: 'DELETE /media/:id', path: (c) => `/media/${c.them.mediaId}` },
  { route: 'POST /media', name: 'upload (stays on my site)', path: () => '/media', file: true, expect: [201] },

  // Their redirects, terms, types, submissions.
  { route: 'DELETE /redirects/:id', path: (c) => `/redirects/${c.them.redirectId}` },
  { route: 'POST /redirects', name: 'add a redirect (stays on my site)', path: () => '/redirects', body: (c) => ({ fromPath: `/${c.me.tag}-later`, toPath: '/elsewhere' }), expect: [201] },
  { route: 'PATCH /terms/:id', path: (c) => `/terms/${c.them.categoryId}`, body: () => ({ name: 'pwned' }) },
  { route: 'PATCH /terms/:id', name: 'PATCH their tag', path: (c) => `/terms/${c.them.tagId}`, body: () => ({ name: 'pwned' }) },
  { route: 'DELETE /terms/:id', path: (c) => `/terms/${c.them.categoryId}` },
  { route: 'POST /terms', name: 'add a term (stays on my site)', path: () => '/terms', body: (c) => ({ kind: 'tag', name: `${c.me.tag} extra` }), expect: [201] },
  { route: 'PATCH /content-types/:id', path: (c) => `/content-types/${c.them.typeId}`, body: () => ({ name: 'pwned' }) },
  { route: 'DELETE /content-types/:id', path: (c) => `/content-types/${c.them.typeId}` },
  { route: 'POST /content-types', name: 'add a type (stays on my site)', path: () => '/content-types', body: (c) => ({ name: `${c.me.tag} Extra`, singularName: 'Extra', prefix: `${c.me.tag}-extra` }), expect: [201] },
  { route: 'GET /submissions/:id', path: (c) => `/submissions/${c.them.submissionId}` },
  { route: 'GET /submissions', name: 'their submission as my cursor', path: (c) => `/submissions?after=${c.them.submissionId}`, expect: [400] },

  // Their site, by siteId.
  { route: 'GET /sites/:siteId', path: (c) => `/sites/${c.them.siteId}` },
  { route: 'PATCH /sites/:siteId/settings', path: (c) => `/sites/${c.them.siteId}/settings`, body: () => ({ tagline: 'pwned' }) },
  { route: 'PUT /sites/:siteId/domain', path: (c) => `/sites/${c.them.siteId}/domain`, body: () => ({ domain: `www.pwned${RUN}.com` }) },
  { route: 'DELETE /sites/:siteId/domain', path: (c) => `/sites/${c.them.siteId}/domain` },
  { route: 'PATCH /sites/:siteId/subdomain', path: (c) => `/sites/${c.them.siteId}/subdomain`, body: () => ({ subdomain: `pwned${RUN}` }) },

  // Their team: by their siteId, and by mine with their membership and invite ids.
  { route: 'GET /sites/:siteId/team/members', path: (c) => `/sites/${c.them.siteId}/team/members` },
  { route: 'PATCH /sites/:siteId/team/members/:membershipId', path: (c) => `/sites/${c.them.siteId}/team/members/${c.them.editorMembershipId}`, body: () => ({ role: 'viewer' }) },
  { route: 'PATCH /sites/:siteId/team/members/:membershipId', name: 'my siteId, their member', path: (c) => `/sites/${c.me.siteId}/team/members/${c.them.editorMembershipId}`, body: () => ({ role: 'viewer' }) },
  { route: 'PATCH /sites/:siteId/team/members/:membershipId', name: 'my siteId, their owner', path: (c) => `/sites/${c.me.siteId}/team/members/${c.them.ownerMembershipId}`, body: () => ({ role: 'viewer' }) },
  { route: 'DELETE /sites/:siteId/team/members/:membershipId', path: (c) => `/sites/${c.them.siteId}/team/members/${c.them.editorMembershipId}` },
  { route: 'DELETE /sites/:siteId/team/members/:membershipId', name: 'my siteId, their member', path: (c) => `/sites/${c.me.siteId}/team/members/${c.them.editorMembershipId}` },
  { route: 'GET /sites/:siteId/team/invites', path: (c) => `/sites/${c.them.siteId}/team/invites` },
  { route: 'POST /sites/:siteId/team/invites', path: (c) => `/sites/${c.them.siteId}/team/invites`, body: () => ({ email: `stray-${RUN}@example.test`, role: 'administrator' }) },
  { route: 'DELETE /sites/:siteId/team/invites/:inviteId', path: (c) => `/sites/${c.them.siteId}/team/invites/${c.them.inviteId}` },
  { route: 'DELETE /sites/:siteId/team/invites/:inviteId', name: 'my siteId, their invite', path: (c) => `/sites/${c.me.siteId}/team/invites/${c.them.inviteId}` },

  ...slugRows(),
];

// ---- Public routes, on `me`'s host -------------------------------------------------------------------------------

const PUB = (c: Ctx) => `/public/sites/${c.me.subdomain}`;
const LIVE: PageKey[] = ['parent', 'child', 'story', 'contact', 'shared'];
const NOT_HERE: PageKey[] = ['parent', 'child', 'story', 'contact', 'gallery', 'draft', 'review', 'archived'];

const PUBLIC_ROUTES: Row[] = [
  { route: 'GET /public/sites/:subdomain', path: PUB, expect: [200], contains: (c) => [`${c.me.tag} tagline`, c.me.filename] },
  ...LIVE.map((key) => ({
    route: 'GET /public/sites/:subdomain/page',
    name: `my live ${key} page`,
    path: (c: Ctx) => `${PUB(c)}/page?path=${encodeURIComponent(c.me.pages[key].path)}`,
    expect: [200],
    contains: (c: Ctx) => [c.me.pages[key].title],
  })),
  // My page shows my own picture's library alt text, and never theirs, though it embeds their file's address.
  {
    route: 'GET /public/sites/:subdomain/page',
    name: 'library alt text on my page is mine only',
    path: (c) => `${PUB(c)}/page?path=${encodeURIComponent(c.me.pages.gallery.path)}`,
    expect: [200],
    contains: (c) => [`${c.me.tag} alt`],
    allow: BORROWED,
  },
  ...NOT_HERE.map((key) => ({
    route: 'GET /public/sites/:subdomain/page',
    name: `their ${key} page on my host`,
    path: (c: Ctx) => `${PUB(c)}/page?path=${encodeURIComponent(c.them.pages[key].path)}`,
    expect: [404],
  })),
  { route: 'GET /public/sites/:subdomain/menus', path: (c) => `${PUB(c)}/menus`, expect: [200], contains: (c) => [c.me.pages.child.path, c.me.pages.contact.path] },
  { route: 'GET /public/sites/:subdomain/sitemap', path: (c) => `${PUB(c)}/sitemap`, expect: [200], contains: (c) => [c.me.pages.child.path, c.me.pages.story.path] },
  { route: 'GET /public/sites/:subdomain/redirect', name: 'my redirect', path: (c) => `${PUB(c)}/redirect?path=/${c.me.tag}-old`, expect: [200], contains: (c) => [c.me.pages.parent.path] },
  { route: 'GET /public/sites/:subdomain/redirect', name: 'the same old address on both sites', path: (c) => `${PUB(c)}/redirect?path=/shared-old`, expect: [200], contains: (c) => [c.me.pages.parent.path] },
  { route: 'GET /public/sites/:subdomain/redirect', name: 'their redirect on my host', path: (c) => `${PUB(c)}/redirect?path=/${c.them.tag}-old`, expect: [404] },
  { route: 'GET /public/sites/:subdomain/types/:prefix', name: 'my listing', path: (c) => `${PUB(c)}/types/${c.me.prefix}`, expect: [200], contains: (c) => [c.me.pages.story.title] },
  { route: 'GET /public/sites/:subdomain/types/:prefix', name: 'their listing on my host', path: (c) => `${PUB(c)}/types/${c.them.prefix}`, expect: [404] },
  { route: 'GET /public/sites/:subdomain/terms/:kind/:slug', name: 'my category', path: (c) => `${PUB(c)}/terms/category/${c.me.categorySlug}`, expect: [200], contains: (c) => [c.me.pages.story.title] },
  { route: 'GET /public/sites/:subdomain/terms/:kind/:slug', name: 'my tag', path: (c) => `${PUB(c)}/terms/tag/${c.me.tagSlug}`, expect: [200], contains: (c) => [c.me.pages.story.title] },
  { route: 'GET /public/sites/:subdomain/terms/:kind/:slug', name: 'their category on my host', path: (c) => `${PUB(c)}/terms/category/${c.them.categorySlug}`, expect: [404] },
  { route: 'GET /public/sites/:subdomain/terms/:kind/:slug', name: 'their tag on my host', path: (c) => `${PUB(c)}/terms/tag/${c.them.tagSlug}`, expect: [404] },
  { route: 'GET /public/sites/:subdomain/preview/:token', name: 'my preview', path: (c) => `${PUB(c)}/preview/${c.me.previewToken}`, expect: [200], contains: (c) => [c.me.pages.draft.title] },
  { route: 'GET /public/sites/:subdomain/preview/:token', name: 'their preview token on my host', path: (c) => `${PUB(c)}/preview/${c.them.previewToken}`, expect: [404] },
  {
    route: 'POST /public/sites/:subdomain/submissions',
    name: 'a submission to their contact page through my host',
    path: (c) => `${PUB(c)}/submissions`,
    headers: { 'x-form-secret': FORM_SECRET },
    body: (c) => ({ path: c.them.pages.contact.path, blockIndex: 1, values: { name: 'Stray', email: 'stray@example.com' } }),
    expect: [404],
  },
];

/** Routes with no tenant to cross, and why. Anything else must have a row above. */
const NOT_TENANT_ROUTES: Record<string, string> = {
  'GET /': 'service name and version only',
  'GET /health': 'database ping and uptime only',
  'POST /auth/login': 'takes an email and password, no site; used by this spec to log both owners in',
  'GET /invites/:token': 'keyed on an unguessable invite token, not a site: holding the token is the permission',
  'POST /invites/:token/accept': 'same: the invite token is the capability, and the site comes from the invite row',
};

// -------------------------------------------------------------------------------------------------------------------

describe('Cross-tenant isolation (GOV-08b, FND-03)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let png: Buffer;
  const fx: Partial<Record<'a' | 'b', Fx>> = {};

  const call = (token: string | null, method: Method, path: string, opts: { body?: unknown; file?: boolean; headers?: Record<string, string> } = {}) => {
    let req = request(app.getHttpServer())[method](path);
    if (token) req = req.set('Authorization', `Bearer ${token}`);
    for (const [name, value] of Object.entries(opts.headers ?? {})) req = req.set(name, value);
    if (opts.file) return req.attach('file', png, { filename: 'tiny.png', contentType: 'image/png' });
    return opts.body === undefined ? req : req.send(opts.body as object);
  };

  /** A call that must succeed, for building fixtures. */
  async function ok(token: string | null, method: Method, path: string, body?: unknown, file = false) {
    const res = await call(token, method, path, { body, file, headers: { 'x-form-secret': FORM_SECRET } });
    if (res.status >= 300) throw new Error(`${method.toUpperCase()} ${path} → ${res.status}: ${res.text}`);
    return res.body;
  }

  // Everything made so far, recorded the moment it exists: a setup that fails halfway still cleans up after itself.
  const created = { siteIds: [] as string[], userIds: [] as string[] };

  async function makeTenant(key: 'a' | 'b'): Promise<Fx> {
    const tag = `${key === 'a' ? 'alpha' : 'bravo'}${RUN}`;
    const password = randomBytes(12).toString('hex');
    const passwordHash = await bcrypt.hash(password, 4);
    const site = await prisma.site.create({ data: { subdomain: tag, name: `${tag} site` } });
    created.siteIds.push(site.id);
    const owner = await prisma.user.create({
      data: { email: `owner-${tag}@example.test`, name: `${tag} owner`, passwordHash, memberships: { create: { siteId: site.id, role: 'owner' } } },
      include: { memberships: true },
    });
    created.userIds.push(owner.id);
    const editor = await prisma.user.create({
      data: { email: `editor-${tag}@example.test`, name: `${tag} editor`, passwordHash: 'x', memberships: { create: { siteId: site.id, role: 'editor' } } },
      include: { memberships: true },
    });
    created.userIds.push(editor.id);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email: owner.email, password });
    if (!login.body.accessToken) throw new Error(`login failed: ${login.status} ${login.text}`);
    const token: string = login.body.accessToken;

    const type = await ok(token, 'post', '/content-types', {
      name: `${tag} Stories`,
      singularName: 'Story',
      prefix: `${tag}-stories`,
      hasCategories: true,
      hasTags: true,
      fields: [{ label: 'Cover', kind: 'media' }],
    });
    const category = await ok(token, 'post', '/terms', { kind: 'category', name: `${tag} Cat` });
    const media = await ok(token, 'post', '/media', undefined, true);
    await ok(token, 'patch', `/media/${media.id}`, { alt: `${tag} alt` });
    const mediaPath = `/uploads/${site.id}/${media.filename}`;

    const create = async (body: object) => (await ok(token, 'post', '/content', body)) as Page & { status: string };
    const publish = (slug: string) => ok(token, 'patch', `/content/${slug}`, { status: 'published' });

    const parent = await create({ title: `${tag} Parent`, slug: `${tag}-parent`, blocks: [hero(`${tag} parent`)] });
    await publish(parent.slug);
    const child = await create({ title: `${tag} Child`, slug: `${tag}-child`, parentId: parent.id, blocks: [hero(`${tag} child`)] });
    await publish(child.slug);
    const shared = await create({ title: `${tag} Shared`, slug: 'shared', blocks: [hero(`${tag} shared`)] });
    await publish(shared.slug);
    const story = await create({ title: `${tag} Story`, slug: `${tag}-story`, type: type.prefix, categoryIds: [category.id], tags: [`${tag} tag`] });
    const fieldKey: string = type.fields[0].key;
    await ok(token, 'patch', `/content/${story.slug}`, { data: { [fieldKey]: mediaPath }, status: 'published' });
    const contact = await create({ title: `${tag} Contact`, slug: `${tag}-contact`, blocks: [hero(`${tag} contact`), FORM_BLOCK] });
    await publish(contact.slug);
    const review = await create({ title: `${tag} Review`, slug: `${tag}-review`, blocks: [hero(`${tag} review`)] });
    await ok(token, 'post', `/content/${review.slug}/submit`);
    const draft = await create({ title: `${tag} Draft`, slug: `${tag}-draft`, blocks: [hero(`${tag} draft`)] });
    await ok(token, 'patch', `/content/${draft.slug}`, { blocks: [hero(`${tag} draft, saved`)] });
    const preview = await ok(token, 'post', `/content/${draft.slug}/preview-link`);
    const archived = await create({ title: `${tag} Archived`, slug: `${tag}-archived`, blocks: [hero(`${tag} archived`)] });
    await ok(token, 'patch', `/content/${archived.slug}`, { status: 'archived' });
    // Filled in once both libraries exist (an image of the other site's, with no alt text of its own).
    const gallery = await create({ title: `${tag} Gallery`, slug: `${tag}-gallery`, blocks: [hero(`${tag} gallery`, { src: media.url, alt: '' })] });
    await publish(gallery.slug);

    await ok(token, 'put', '/menus/header', {
      items: [
        { label: `${tag} Parent`, contentId: parent.id, children: [{ label: `${tag} Child`, contentId: child.id }] },
        { label: `${tag} Story`, contentId: story.id },
      ],
    });
    await ok(token, 'put', '/menus/footer', { items: [{ label: `${tag} Contact`, contentId: contact.id }] });
    const redirect = await ok(token, 'post', '/redirects', { fromPath: `/${tag}-old`, toPath: parent.path });
    await ok(token, 'post', '/redirects', { fromPath: '/shared-old', toPath: parent.path });
    await ok(null, 'post', `/public/sites/${tag}/submissions`, { path: contact.path, blockIndex: 1, values: { name: `${tag} sender`, email: 'sender@example.com' } });
    const submissions = await ok(token, 'get', '/submissions');
    await ok(token, 'patch', `/sites/${site.id}/settings`, { tagline: `${tag} tagline`, footerNote: `${tag} footer`, logo: mediaPath });
    await ok(token, 'put', `/sites/${site.id}/domain`, { domain: `www.${tag}.com` });
    const invite = await ok(token, 'post', `/sites/${site.id}/team/invites`, { email: `invitee-${tag}@example.test`, role: 'editor' });
    const revisions = await ok(token, 'get', `/content/${draft.slug}/revisions`);
    const terms = await ok(token, 'get', `/content/${story.slug}`);

    const page = (p: Page): Page => ({ id: p.id, slug: p.slug, path: p.path, title: p.title });
    return {
      tag,
      siteId: site.id,
      subdomain: tag,
      token,
      userIds: [owner.id, editor.id],
      ownerMembershipId: owner.memberships[0].id,
      editorMembershipId: editor.memberships[0].id,
      inviteId: invite.id,
      typeId: type.id,
      prefix: type.prefix,
      fieldKey,
      categoryId: category.id,
      categorySlug: category.slug,
      tagId: terms.tags[0].id,
      tagSlug: terms.tags[0].slug,
      mediaId: media.id,
      mediaUrl: media.url,
      filename: media.filename,
      pages: {
        parent: page(parent),
        child: page(child),
        story: page(story),
        contact: page(contact),
        review: page(review),
        draft: page(draft),
        archived: page(archived),
        gallery: page(gallery),
        shared: page(shared),
      },
      previewToken: preview.token,
      revisionId: revisions[0].id,
      redirectId: redirect.id,
      submissionId: submissions.items[0].id,
    };
  }

  /** Everything a site owns, as stored, plus its uploaded file's bytes. Equal before and after = untouched. */
  async function snapshot(f: Fx) {
    const where = { siteId: f.siteId };
    const orderBy = { id: 'asc' } as const;
    const [site, content, types, terms, links, media, menu, redirects, previews, revisions, submissions, members, invites, file] = await Promise.all([
      prisma.site.findUnique({ where: { id: f.siteId } }),
      prisma.content.findMany({ where, orderBy }),
      prisma.contentType.findMany({ where, orderBy }),
      prisma.term.findMany({ where, orderBy }),
      prisma.contentTerm.findMany({ where: { content: where }, orderBy: [{ contentId: 'asc' }, { termId: 'asc' }] }),
      prisma.media.findMany({ where, orderBy }),
      prisma.menuItem.findMany({ where, orderBy }),
      prisma.redirect.findMany({ where, orderBy }),
      prisma.previewLink.findMany({ where, orderBy }),
      prisma.revision.findMany({ where, orderBy }),
      prisma.submission.findMany({ where, orderBy }),
      prisma.siteMembership.findMany({ where, orderBy }),
      prisma.invite.findMany({ where, orderBy }),
      readFile(join(process.cwd(), UPLOADS_DIR, f.siteId, f.filename)).then((bytes) => createHash('sha256').update(bytes).digest('hex')),
    ]);
    return { site, content, types, terms, links, media, menu, redirects, previews, revisions, submissions, members, invites, file };
  }

  /** Every id and the tag text of a tenant: none of it may appear in a response to the other. */
  const markers = (f: Fx) => [
    f.tag,
    f.siteId,
    f.ownerMembershipId,
    f.editorMembershipId,
    f.inviteId,
    f.typeId,
    f.categoryId,
    f.tagId,
    f.mediaId,
    f.filename,
    f.previewToken,
    f.revisionId,
    f.redirectId,
    f.submissionId,
    ...PAGE_KEYS.map((key) => f.pages[key].id),
  ];

  async function check(c: Ctx, row: Row, token: string | null) {
    const method = row.route.split(' ')[0].toLowerCase() as Method;
    const before = await snapshot(c.them);
    const res = await call(token, method, row.path(c), { body: row.body?.(c), file: row.file, headers: row.headers });
    expect(row.expect ?? DENIED, `${res.status}: ${res.text.slice(0, 300)}`).toContain(res.status);
    const allowed = new Set(row.allow?.(c) ?? []);
    const leaked = markers(c.them).filter((marker) => !allowed.has(marker) && res.text.includes(marker));
    expect(leaked, 'the other tenant’s ids or text in the response').toEqual([]);
    for (const wanted of row.contains?.(c) ?? []) expect(res.text).toContain(wanted);
    expect(await snapshot(c.them), 'the other tenant’s rows changed').toEqual(before);
  }

  beforeAll(async () => {
    process.env.FORM_SUBMIT_SECRET = FORM_SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 120, b: 40 } } }).png().toBuffer();

    fx.a = await makeTenant('a');
    fx.b = await makeTenant('b');
    // Each gallery also embeds the other site's picture, alt-less, so the library-alt fallback is tried across sites.
    for (const [me, them] of [[fx.a, fx.b], [fx.b, fx.a]] as const) {
      await ok(me.token, 'patch', `/content/${me.pages.gallery.slug}`, {
        blocks: [hero(`${me.tag} gallery`, { src: me.mediaUrl, alt: '' }), hero('Borrowed', { src: them.mediaUrl, alt: '' })],
      });
    }
  }, 60_000);

  afterAll(async () => {
    const siteIds = created.siteIds;
    if (prisma && siteIds.length > 0) {
      // Children and types are Restrict, so pages go first, flattened, then the sites cascade the rest.
      await prisma.content.updateMany({ where: { siteId: { in: siteIds } }, data: { parentId: null } });
      await prisma.content.deleteMany({ where: { siteId: { in: siteIds } } });
      await prisma.site.deleteMany({ where: { id: { in: siteIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    }
    for (const id of siteIds) await rm(join(process.cwd(), UPLOADS_DIR, id), { recursive: true, force: true });
    await app?.close();
  });

  const DIRECTIONS = [
    ['alpha', 'bravo'],
    ['bravo', 'alpha'],
  ] as const;
  const ctx = (who: 'alpha' | 'bravo'): Ctx => (who === 'alpha' ? { me: fx.a as Fx, them: fx.b as Fx } : { me: fx.b as Fx, them: fx.a as Fx });

  describe.each(DIRECTIONS)('as %s’s owner, against %s', (who) => {
    it.each(ADMIN_ROUTES.map((row) => [row.name ?? row.route, row] as const))('%s', async (_name, row) => {
      const c = ctx(who);
      await check(c, row, c.me.token);
    });
  });

  describe.each(DIRECTIONS)('on %s’s public host, never %s’s data', (who) => {
    it.each(PUBLIC_ROUTES.map((row) => [row.name ?? row.route, row] as const))('%s', async (_name, row) => {
      await check(ctx(who), row, null);
    });

    it('a form submission carrying their page id is stored against my own page, never theirs', async () => {
      const { me, them } = ctx(who);
      const theirsBefore = await prisma.submission.count({ where: { siteId: them.siteId } });
      await call(null, 'post', `/public/sites/${me.subdomain}/submissions`, {
        headers: { 'x-form-secret': FORM_SECRET },
        body: { path: me.pages.contact.path, blockIndex: 1, contentId: them.pages.contact.id, siteId: them.siteId, values: { name: 'Smuggler', email: 'smuggler@example.com' } },
      }).expect(201);
      const stored = await prisma.submission.findFirst({ where: { siteId: me.siteId }, orderBy: { createdAt: 'desc' } });
      expect(stored?.contentId).toBe(me.pages.contact.id);
      expect(await prisma.submission.count({ where: { siteId: them.siteId } })).toBe(theirsBefore);
      expect(await prisma.submission.count({ where: { contentId: them.pages.contact.id, siteId: me.siteId } })).toBe(0);
    });
  });

  it('every route the controllers declare has a row here, or a reason it has no tenant to cross', () => {
    const declared = new Set<string>();
    for (const module of app.get(ModulesContainer).values()) {
      for (const wrapper of module.controllers.values()) {
        const controller = wrapper.metatype as unknown as { prototype: Record<string, unknown> };
        const base = [Reflect.getMetadata('path', controller) ?? ''].flat()[0] as string;
        for (const key of Object.getOwnPropertyNames(controller.prototype)) {
          const handler = controller.prototype[key];
          if (key === 'constructor' || typeof handler !== 'function') continue;
          const path = Reflect.getMetadata('path', handler) as string | string[] | undefined;
          if (path === undefined) continue;
          const method = RequestMethod[Reflect.getMetadata('method', handler) as RequestMethod];
          const full = `/${[base, [path].flat()[0]].join('/')}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
          declared.add(`${method} ${full}`);
        }
      }
    }
    expect(declared.size).toBeGreaterThan(40);
    const covered = new Set([...ADMIN_ROUTES, ...PUBLIC_ROUTES].map((row) => row.route));
    const missing = [...declared].filter((route) => !covered.has(route) && !(route in NOT_TENANT_ROUTES));
    expect(missing).toEqual([]);
    // And no row names a route that doesn't exist (a typo would silently test nothing).
    expect([...covered, ...Object.keys(NOT_TENANT_ROUTES)].filter((route) => !declared.has(route))).toEqual([]);
  });
});
