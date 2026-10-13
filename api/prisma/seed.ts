import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { STARTER_LAYOUTS } from './starter-layouts.js';
import { ensureMedia, mediaPath } from './seed-media.js';
import type { SeedMenuItem, SeedPage, SeedPost, SeedSite, SeedWorkflow } from './seed-types.js';
import { parseSeo } from '../src/content/seo.js';
import { sanitizeBlocks } from '../src/content/sanitize.js';
import { normaliseSlug } from '../src/content/slug.js';
import { corrick } from './seed-content/corrick.js';
import { kestrel } from './seed-content/kestrel.js';

// The demo seed (FND-06, GOV-08b, DEP-03): both tenants with their team, media, pages, posts, settings and menus.
// Run with `npm run db:seed`; not wired into `prisma migrate reset`. Re-runnable: it only adds what is missing and
// never overwrites what someone has edited. The content itself is in seed-content/, its shape in seed-types.ts.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Dev-only credentials, shared by every seeded owner and team member.
const DEV_PASSWORD = '1234567890';

const DAY_MS = 24 * 60 * 60 * 1000;

type Library = Map<string, { url: string; filename: string; alt: string }>;

/**
 * Replaces each `@media:<file>` string in `value` with that file's address in the site's library (the full URL
 * the editor stores in a block). A file the site's `library` doesn't list is a mistake in the seed: it throws.
 * An image left without alt text gets the library's, as if the editor had filled it in: the public site would use
 * the library's anyway (D-047), but the publish checks ask for it on the block (DEP-03 review).
 */
function withMedia<T>(value: T, library: Library): T {
  if (typeof value === 'string' && value.startsWith('@media:')) return fileOf(value, library).url as T;
  if (Array.isArray(value)) return value.map((item) => withMedia(item, library)) as T;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const resolved = Object.fromEntries(Object.entries(record).map(([key, item]) => [key, withMedia(item, library)]));
    if (typeof record.src === 'string' && record.src.startsWith('@media:') && record.alt === '') {
      resolved.alt = fileOf(record.src, library).alt;
    }
    return resolved as T;
  }
  return value;
}

function fileOf(reference: string, library: Library) {
  const file = library.get(reference.replace(/^@media:/, ''));
  if (!file) throw new Error(`Seed: ${reference} is not in the site's library`);
  return file;
}


async function seedSite(spec: SeedSite, passwordHash: string): Promise<void> {
  // Resets the owner's password to DEV_PASSWORD on every run, on purpose.
  const user = await prisma.user.upsert({
    where: { email: spec.owner.email },
    update: { passwordHash },
    create: { email: spec.owner.email, name: spec.owner.name, passwordHash },
  });

  // The site this owner already owns, if any, so a site whose subdomain was renamed since (D-031) isn't seeded a
  // second time; otherwise by subdomain. Not by `host`: that is a custom domain an owner adds (DEP-02).
  const owned = await prisma.siteMembership.findFirst({
    where: { userId: user.id, role: 'owner' },
    orderBy: { createdAt: 'asc' },
    select: { site: true },
  });
  const site =
    owned?.site ??
    (await prisma.site.upsert({
      where: { subdomain: spec.subdomain },
      update: {},
      create: {
        subdomain: spec.subdomain,
        name: spec.name,
        themeJson: spec.theme,
      },
    }));

  await prisma.siteMembership.upsert({
    where: { userId_siteId: { userId: user.id, siteId: site.id } },
    update: { role: 'owner' },
    create: { userId: user.id, siteId: site.id, role: 'owner' },
  });

  // The team (GOV-06): authors of the posts, and who submitted or scheduled what (GOV-07). A role changed in the
  // admin since is kept.
  const people = new Map<string, string>([[spec.owner.email, user.id]]);
  for (const member of spec.members ?? []) {
    const person = await prisma.user.upsert({
      where: { email: member.email },
      update: { passwordHash },
      create: { email: member.email, name: member.name, passwordHash },
    });
    await prisma.siteMembership.upsert({
      where: { userId_siteId: { userId: person.id, siteId: site.id } },
      update: {},
      create: { userId: person.id, siteId: site.id, role: member.role },
    });
    people.set(member.email, person.id);
  }
  const personId = (email: string | undefined) => {
    if (!email) return null;
    const id = people.get(email);
    if (!id) throw new Error(`Seed: ${email} is not the owner or a member of ${spec.subdomain}`);
    return id;
  };

  // The media library (MED-01/04): every picture the pages and posts use.
  const library: Library = new Map();
  for (const file of spec.library ?? []) {
    const row = await ensureMedia(prisma, site.id, user.id, file);
    library.set(file.file, { url: row.url, filename: row.filename, alt: row.alt ?? file.alt ?? '' });
  }

  // A page is created only when the site has neither its path nor its slug (`alreadyThere`), so a re-run never
  // overwrites or duplicates one someone has since edited or moved. A child finds its parent by path; parents first.
  for (const page of spec.pages) await seedPage(site.id, user.id, page, library, personId);

  // The built-in Posts type at /blog on every site (TYP-01). Never overwritten, so a
  // rename done in the admin survives a re-run.
  const posts = await prisma.contentType.upsert({
    where: { siteId_prefix: { siteId: site.id, prefix: 'blog' } },
    update: {},
    create: {
      siteId: site.id,
      name: 'Posts',
      singularName: 'Post',
      prefix: 'blog',
      isBuiltIn: true,
      // Posts come with both lists on (TAX-01); every other type starts with them off.
      hasCategories: true,
      hasTags: true,
      // Req. 3: a summary and a featured image.
      fields: [
        { key: 'excerpt', label: 'Excerpt', kind: 'text', required: false },
        { key: 'featured_image', label: 'Featured image', kind: 'media', required: false },
      ],
    },
  });
  for (const post of spec.posts ?? []) await seedPost(site.id, posts.id, post, library, personId);

  await seedSettings(site, user.id, spec.settings);
  await seedMenus(site.id, spec.menus);

  console.log(
    `Ensured ${user.email} owns ${site.name} (${site.subdomain}: ${spec.pages.length} pages, ${spec.posts?.length ?? 0} posts, ${library.size} files)`,
  );
}

/** Review and schedule fields for a page or post (GOV-07), relative to now so the demo always looks current. */
function workflowFields(item: SeedWorkflow & { status: string }, personId: (email: string | undefined) => string | null, now: Date) {
  if (item.status === 'in_review') {
    return { submittedById: personId(item.submittedBy), submittedAt: new Date(now.getTime() - (item.submittedDaysAgo ?? 0) * DAY_MS) };
  }
  if (item.status === 'scheduled') {
    return { scheduledById: personId(item.scheduledBy), publishAt: new Date(now.getTime() + (item.publishInDays ?? 1) * DAY_MS) };
  }
  return {};
}

/**
 * Whether the site already has this page or post: by path (where the seed would put it) or by slug (where an owner
 * may have moved it since). Either way the seed leaves it alone, so a re-run never adds a second one (DEP-03 review).
 */
async function alreadyThere(siteId: string, path: string, slug: string): Promise<boolean> {
  return (await prisma.content.count({ where: { siteId, OR: [{ path }, { slug }] } })) > 0;
}

async function seedPage(siteId: string, ownerId: string, page: SeedPage, library: Library, personId: (email: string | undefined) => string | null) {
  if (await alreadyThere(siteId, page.path, page.slug)) return;
  const { nested, seo, submittedBy: _s, submittedDaysAgo: _sd, scheduledBy: _sb, publishInDays: _p, ...fields } = page;
  // By path, which is unique per site: the parent is exactly the page this path sits under (invariant 9).
  const parentPath = page.path.slice(0, page.path.lastIndexOf('/'));
  const parent = nested
    ? await prisma.content.findUnique({ where: { siteId_path: { siteId, path: parentPath } }, select: { id: true, typeId: true } })
    : null;
  // The owner moved or deleted the parent since: leave this page out rather than stop the whole seed.
  if (nested && !parent) {
    console.warn(`Seed: skipped ${page.path}, no page at ${parentPath} any more`);
    return;
  }
  if (parent?.typeId) throw new Error(`Seed page ${page.path}: ${parentPath} is an entry, and only pages can have pages under them`);
  const now = new Date();
  await prisma.content.create({
    data: {
      ...fields,
      // Sanitised on write like any save (invariant 5), so the seed can't store what the app wouldn't.
      blocks: sanitizeBlocks(withMedia(fields.blocks, library) as Parameters<typeof sanitizeBlocks>[0]) as Prisma.InputJsonValue,
      // Through the app's own rules, so the stored shape is the one a save in Page settings makes (SEO-01). A share
      // image is in the short `/uploads/<site>/<file>` form, like every media value.
      ...(seo && { seo: seoOf(seo, library, siteId) }),
      siteId,
      parentId: parent?.id ?? null,
      // A page waiting for review was written by whoever submitted it; the rest by the owner.
      authorId: (page.status === 'in_review' && personId(page.submittedBy)) || ownerId,
      ...(page.status === 'published' && { publishedAt: now }),
      ...workflowFields(page, personId, now),
    },
  });
}

async function seedPost(siteId: string, typeId: string, post: SeedPost, library: Library, personId: (email: string | undefined) => string | null) {
  const now = new Date();
  const image = library.get(post.image);
  if (!image) throw new Error(`Seed post ${post.slug}: ${post.image} is not in the site's library`);
  const path = `/blog/${post.slug}`;
  if (await alreadyThere(siteId, path, post.slug)) return;

  // Categories and tags (TAX-01): found or made by slug. Only reached for a post that isn't there, so a term an
  // owner renamed since is made again under its old name only if they also deleted the post.
  const termIds: string[] = [];
  for (const [kind, names] of [['category', post.categories], ['tag', post.tags]] as const) {
    for (const name of names) {
      const term = await prisma.term.upsert({
        where: { siteId_kind_slug: { siteId, kind, slug: normaliseSlug(name) } },
        update: {},
        create: { siteId, kind, name, slug: normaliseSlug(name) },
      });
      termIds.push(term.id);
    }
  }

  await prisma.content.create({
    data: {
      siteId,
      typeId,
      title: post.title,
      slug: post.slug,
      path,
      status: post.status,
      authorId: personId(post.author),
      blocks: sanitizeBlocks([{ type: 'richText', html: post.html }]) as Prisma.InputJsonValue,
      data: { excerpt: post.excerpt, featured_image: mediaPath(siteId, image.filename) },
      // Dated as if written then, so the admin's list (newest edit first) and the public one agree.
      ...(post.status === 'published' && (() => {
        const when = new Date(now.getTime() - (post.publishedDaysAgo ?? 0) * DAY_MS);
        return { publishedAt: when, createdAt: when, updatedAt: when };
      })()),
      ...workflowFields(post, personId, now),
      terms: { create: termIds.map((termId) => ({ termId })) },
    },
  });
}

/** A page's search settings in the stored shape, checked by the app's own rules (content/seo.ts). */
function seoOf(seo: NonNullable<SeedPage['seo']>, library: Library, siteId: string): Prisma.InputJsonValue {
  const parsed = parseSeo({ ...seo, ...(seo.ogImage && { ogImage: mediaPath(siteId, fileOf(seo.ogImage, library).filename) }) }, siteId);
  if (!parsed.ok) throw new Error(`Seed: bad search settings: ${JSON.stringify(parsed.problems)}`);
  return parsed.seo as Prisma.InputJsonValue;
}

/** Tagline, footer note and logo (GOV-04): each only where the site has none, so edits in Settings survive. */
async function seedSettings(site: { id: string; settings: Prisma.JsonValue }, uploaderId: string, settings: SeedSite['settings']) {
  if (!settings) return;
  const current = (typeof site.settings === 'object' && site.settings !== null ? site.settings : {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };
  if (!current.tagline && settings.tagline) next.tagline = settings.tagline;
  if (!current.footerNote && settings.footerNote) next.footerNote = settings.footerNote;
  if (!current.logo && settings.logo) {
    const logo = await ensureMedia(prisma, site.id, uploaderId, settings.logo);
    next.logo = mediaPath(site.id, logo.filename);
  }
  await prisma.site.update({ where: { id: site.id }, data: { settings: next as Prisma.InputJsonValue } });
}

/** Header and footer menus (GOV-03), each written only to a location that is still empty. */
async function seedMenus(siteId: string, menus: SeedSite['menus']) {
  for (const location of ['header', 'footer'] as const) {
    const items = menus?.[location];
    if (!items || (await prisma.menuItem.count({ where: { siteId, location } })) > 0) continue;
    const write = async (list: SeedMenuItem[], parentId: string | null) => {
      for (const [position, item] of list.entries()) {
        const contentId = item.page
          ? (await prisma.content.findUnique({ where: { siteId_path: { siteId, path: item.page } }, select: { id: true } }))?.id
          : undefined;
        // A page the owner moved or deleted since: leave the item out rather than stop the whole seed.
        if (item.page && !contentId) {
          console.warn(`Seed: skipped menu item ${item.label}, no page at ${item.page} any more`);
          continue;
        }
        const row = await prisma.menuItem.create({
          data: { siteId, location, parentId, position, label: item.label, contentId: contentId ?? null, url: item.url ?? null },
        });
        if (item.children) await write(item.children, row.id);
      }
    };
    await write(items, null);
  }
}

// Global, not per site (TYP-05, D-038). Unlike pages, a re-run *does*
// overwrite: the layouts are platform data owned by this file, not
// something a tenant edits. It never deletes, though: a layout removed from
// the file stays in the table until removed by hand.
async function seedStarterLayouts(): Promise<void> {
  for (const [sortOrder, layout] of STARTER_LAYOUTS.entries()) {
    const data = {
      ...layout,
      blocks: layout.blocks as Prisma.InputJsonValue,
      sortOrder,
    };
    await prisma.starterLayout.upsert({
      where: { key: layout.key },
      update: data,
      create: data,
    });
  }
  console.log(`Ensured ${STARTER_LAYOUTS.length} starter layouts`);
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  await seedSite(corrick, passwordHash);
  await seedSite(kestrel, passwordHash);
  await seedStarterLayouts();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
