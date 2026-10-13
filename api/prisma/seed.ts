import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { STARTER_LAYOUTS } from './starter-layouts.js';
import { ensureMedia, mediaPath, type SeedMedia } from './seed-media.js';

// One-off seed for local development — run manually with `npm run db:seed`.
// Not wired into `prisma migrate reset`'s seed hook (FND-06 proper); this just
// needs to exist once right now, not run automatically on every reset.
// Re-runnable: everything is an upsert, and existing pages are left alone.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Dev-only credentials, shared by every seeded owner.
const DEV_PASSWORD = '1234567890';

type SeedPage = {
  title: string;
  slug: string;
  path: string;
  status: 'draft' | 'published';
  blocks: Prisma.InputJsonValue;
  /** The page this one sits under (CNT-05) is the one at its path minus the last segment; listed before it. */
  nested?: boolean;
};

/**
 * A menu item: a page of the site by its path, or a link (GOV-03). Two levels, like the menu builder. By path,
 * not slug: a path is unique per site, and an entry can't take a page's (GOV-08b review).
 */
type SeedMenuItem = { label: string; page?: string; url?: string; children?: SeedMenuItem[] };

type SeedSite = {
  subdomain: string;
  name: string;
  theme: Prisma.InputJsonValue;
  owner: { email: string; name: string };
  pages: SeedPage[];
  /**
   * Header and footer text and the logo (GOV-04). Filled in only where the site has none, so an edit in Settings
   * survives a re-run; one an owner cleared on purpose comes back, which is fine for a dev seed.
   */
  settings?: { tagline?: string; footerNote?: string; logo?: SeedMedia };
  /** Written only to a location that has no items yet, so menus built in the admin survive a re-run. */
  menus?: { header?: SeedMenuItem[]; footer?: SeedMenuItem[] };
};

// Blocks use the flat contract from cms-blocks/types.ts (invariant 7) directly
// — `api` doesn't depend on that package, so these are hand-written, not imported.

const corrick: SeedSite = {
  subdomain: 'corrick',
  name: 'Corrick Oyster Co.',
  // Matches admin/src/puck/config.tsx — the same theme used everywhere else this demo touches.
  theme: {
    typeSet: 'editorial',
    shape: 'soft',
    density: 'comfortable',
    texture: 'grain',
    palette: {
      paper: '#D9E0D8',
      surface: '#F1F4EF',
      ink: '#13201C',
      muted: '#556258',
      line: '#B6C2B5',
      brand: '#2E4A3E',
      onBrand: '#F1F4EF',
      accent: '#C8863C',
    },
  },
  owner: { email: 'umair.khalid@brainxtech.com', name: 'Umair Khalid' },
  pages: [
    {
      title: 'Home',
      slug: 'home',
      path: '/',
      status: 'published',
      blocks: [
        {
          type: 'hero',
          eyebrow: 'Lot 14 · Harvested at low water',
          headline: 'Oysters that taste like the tide that raised them',
          body: 'We grow in floating bags on the east bank of the Damariscotta, where the river turns salt twice a day.',
          primaryAction: { label: 'Reserve a spring share', href: '#shares' },
        },
        {
          type: 'richText',
          heading: 'About the farm',
          html: '<p>Family-run since 2011. Everything shipped left the water that morning.</p>',
        },
      ],
    },
  ],
};

// The second tenant (GOV-08a), so isolation is tested with two real hosts; branded and filled out in GOV-08b
// (D-064: the placeholder identities are kept as the demo tenants). A rope-access crew that inspects and repairs
// wind turbine blades and towers. Theme first recovered from the deleted `web/src/fixtures/kestrel.ts` (`f161fd8`).
const kestrel: SeedSite = {
  subdomain: 'kestrel',
  name: 'Kestrel Rigging',
  theme: {
    typeSet: 'technical',
    shape: 'sharp',
    density: 'tight',
    texture: 'grid',
    palette: {
      paper: '#0E1116',
      surface: '#171C23',
      ink: '#E6EAEF',
      muted: '#8E9AAA',
      line: '#2A323C',
      brand: '#FF6B1A',
      onBrand: '#100A05',
      accent: '#F2C230',
    },
  },
  owner: { email: 'owner@kestrel.test', name: 'Kestrel Owner' },
  settings: {
    tagline: 'Rope access for wind turbines',
    footerNote:
      'Kestrel Rigging Ltd. An IRATA member company working onshore and offshore across the UK and the North Sea. Every technician is GWO certified.',
    logo: { file: 'kestrel/logo.svg', title: 'Kestrel Rigging logo', alt: 'Kestrel Rigging' },
  },
  menus: {
    header: [
      {
        label: 'Capability',
        page: '/capability',
        children: [
          { label: 'Blade inspection', page: '/capability/blade-inspection' },
          { label: 'Leading-edge repair', page: '/capability/leading-edge-repair' },
          { label: 'Tower and weld testing', page: '/capability/tower-testing' },
        ],
      },
      { label: 'About', page: '/about' },
      { label: 'Contact', page: '/contact' },
    ],
    footer: [
      {
        label: 'Capability',
        page: '/capability',
        children: [
          { label: 'Blade inspection', page: '/capability/blade-inspection' },
          { label: 'Leading-edge repair', page: '/capability/leading-edge-repair' },
          { label: 'Tower and weld testing', page: '/capability/tower-testing' },
        ],
      },
      {
        label: 'Company',
        page: '/about',
        children: [
          { label: 'About the crew', page: '/about' },
          { label: 'Request a survey window', page: '/contact' },
          { label: 'IRATA International', url: 'https://irata.org' },
        ],
      },
    ],
  },
  pages: [
    {
      title: 'Home',
      slug: 'home',
      path: '/',
      status: 'published',
      blocks: [
        {
          type: 'hero',
          eyebrow: 'IRATA L3 · Working height to 165 m',
          headline: 'Blade inspection without a crane on site',
          body: 'Two technicians on rope reach the leading edge in under an hour. No crane mobilisation, no road closure, no waiting on a weather window wide enough to lift.',
          primaryAction: { label: 'See our capability', href: '/capability' },
          secondaryAction: { label: 'Request a survey window', href: '/contact' },
          facts: [
            { label: 'Turbines surveyed 2025', value: '412' },
            { label: 'Mean time on rope', value: '3.4 h' },
            { label: 'RIDDOR incidents', value: '0' },
          ],
        },
        {
          type: 'featureGrid',
          heading: 'One crew, one mobilisation',
          intro: 'Inspection, repair and testing on the same visit, unless the damage needs a workshop.',
          items: [
            {
              label: 'LEI',
              title: 'Blade inspection',
              body: 'Close-visual inspection with photographs at every station, graded and mapped so next year’s survey compares in minutes.',
            },
            {
              label: 'REP',
              title: 'Leading-edge repair',
              body: 'Erosion and grade 3 damage repaired on rope, cured under heat blankets with a logged profile.',
            },
            {
              label: 'NDT',
              title: 'Tower and weld testing',
              body: 'Magnetic particle and ultrasonic testing on flanges and welds by a certified Level 2 inspector.',
            },
          ],
        },
        {
          type: 'testimonial',
          quote:
            'The comparison against last year’s survey took ten minutes because the station numbering had not moved. That is not normal in this industry.',
          attribution: 'Dan Whitlock',
          role: 'Asset manager, Northmoor Wind',
        },
        {
          type: 'cta',
          heading: 'Q4 survey windows are filling',
          body: 'Send the site, turbine count and model. You get a window and a fixed price inside two working days.',
          action: { label: 'Request a survey window', href: '/contact' },
          note: 'Method statement and insurance certificates sent with every quote.',
        },
      ],
    },
    {
      title: 'Capability',
      slug: 'capability',
      path: '/capability',
      status: 'published',
      blocks: [
        {
          type: 'featureGrid',
          heading: 'Capability',
          intro:
            'One crew, one mobilisation. Inspection and repair are the same visit unless the damage needs a workshop.',
          items: [
            {
              label: 'LEI',
              title: 'Leading-edge inspection',
              body: 'Close-visual to IEC 61400-3 with photo capture at every station. Findings graded 1–5 and mapped to blade station.',
            },
            {
              label: 'NDT',
              title: 'Weld and tower testing',
              body: 'MPI and ultrasonic on tower flanges and welds, carried out on rope with a certified Level 2 inspector.',
            },
            {
              label: 'REP',
              title: 'Composite repair',
              body: 'Wet lay-up and pre-preg repairs to grade 3 damage, cured under heat blanket with a logged cure profile.',
            },
          ],
        },
        {
          type: 'richText',
          heading: 'How we work a site',
          html: '<p>A survey window is four days for a six-turbine site, assuming wind under 12 m/s at hub height. We work to your permit system or ours, whichever your site prefers, and the rescue plan is filed before the first technician leaves the ground.</p><p>Every descent is logged. If a technician stands down for weather, that is in the report too — an unexplained gap in the record is worth less than an explained one.</p><p>Read more about <a href="/capability/blade-inspection">blade inspection</a>, <a href="/capability/leading-edge-repair">leading-edge repair</a> and <a href="/capability/tower-testing">tower and weld testing</a>.</p>',
        },
      ],
    },
    {
      title: 'Blade inspection',
      slug: 'blade-inspection',
      path: '/capability/blade-inspection',
      nested: true,
      status: 'published',
      blocks: [
        {
          type: 'hero',
          eyebrow: 'Inspection',
          headline: 'Every blade station photographed, graded and mapped',
          body: 'Two technicians descend each blade along the leading and trailing edge. Every finding is photographed, graded 1 to 5 and pinned to its station, so you can compare this year with last year in one sitting.',
          primaryAction: { label: 'Request a survey window', href: '/contact' },
        },
        {
          type: 'stats',
          heading: 'A typical six-turbine site',
          items: [
            { label: 'Days on site', value: '4' },
            { label: 'Photographs per blade', value: '180' },
            { label: 'Working days to the report', value: '5' },
          ],
        },
        {
          type: 'faq',
          heading: 'Questions site managers ask',
          items: [
            {
              question: 'Do you need the turbine stopped for the whole survey?',
              answer: 'Only while a technician is on that blade. We lock the rotor with the blade pointing down, survey it, and rotate to the next. A turbine is usually back in service the same afternoon.',
            },
            {
              question: 'What wind speed stops work?',
              answer: '12 m/s at hub height for inspection. Repairs that need a cure stop earlier, depending on temperature and humidity, and we log every stand-down in the report.',
            },
            {
              question: 'Can you work to our permit system?',
              answer: 'Yes. We work to yours or ours, and file our rescue plan with your site lead before anyone leaves the ground.',
            },
          ],
        },
      ],
    },
    {
      title: 'Leading-edge repair',
      slug: 'leading-edge-repair',
      path: '/capability/leading-edge-repair',
      nested: true,
      status: 'published',
      blocks: [
        {
          type: 'richText',
          heading: 'Leading-edge repair',
          html: '<p>Rain, hail and salt wear the leading edge of a blade down to the laminate. Left alone, erosion costs output long before it costs a blade. We repair it on rope, on the same visit as the inspection where we can.</p><ul><li>Filler and coating repairs to grade 2 erosion, applied by hand and faired to profile.</li><li>Wet lay-up and pre-preg laminate repairs to grade 3 damage, cured under heat blankets.</li><li>Leading-edge protection shells and tapes fitted to the manufacturer’s procedure.</li></ul><p>Every cure is logged: temperature, humidity and time, with photographs before, during and after.</p>',
        },
        {
          type: 'cta',
          heading: 'Have last year’s inspection report?',
          body: 'Send it with your enquiry and we will price the repairs from it before we arrive.',
          action: { label: 'Send your report', href: '/contact' },
        },
      ],
    },
    {
      title: 'Tower and weld testing',
      slug: 'tower-testing',
      path: '/capability/tower-testing',
      nested: true,
      status: 'published',
      blocks: [
        {
          type: 'richText',
          heading: 'Tower and weld testing',
          html: '<p>Flange bolts, tower welds and the transition piece are inspected on rope by a Level 2 inspector, with no platform or crane needed.</p>',
        },
        {
          type: 'featureGrid',
          heading: 'Methods',
          items: [
            {
              title: 'Magnetic particle inspection',
              body: 'Surface and near-surface cracks in welds and flanges, recorded with photographs and positions.',
            },
            {
              title: 'Ultrasonic testing',
              body: 'Wall thickness and internal weld defects, with readings logged against the tower’s drawings.',
            },
            {
              title: 'Bolt tension checks',
              body: 'Torque and tension sampling on flange bolts, to your maintenance schedule or the manufacturer’s.',
            },
          ],
        },
      ],
    },
    {
      title: 'About',
      slug: 'about',
      path: '/about',
      status: 'published',
      blocks: [
        {
          type: 'hero',
          eyebrow: 'About Kestrel',
          headline: 'A small crew that writes everything down',
          body: 'Kestrel Rigging started in 2016 with four technicians and one van. We now run three crews, onshore and offshore, and we still log every descent.',
        },
        {
          type: 'teamGrid',
          heading: 'Who you will meet on site',
          members: [
            { name: 'Ruth Calder', role: 'Operations director, IRATA Level 3', bio: 'Plans every survey window and writes the rescue plans.' },
            { name: 'Tomasz Nowak', role: 'Lead technician, IRATA Level 3', bio: 'Leads the blade repair crew. Twelve years on rope.' },
            { name: 'Aisha Rahman', role: 'NDT inspector, PCN Level 2', bio: 'Runs the tower and weld testing and signs off every report.' },
          ],
        },
        {
          type: 'stats',
          heading: 'Our safety record',
          items: [
            { label: 'Descents logged since 2016', value: '18,400' },
            { label: 'Lost-time incidents', value: '0' },
            { label: 'Technicians GWO certified', value: '100%' },
          ],
        },
      ],
    },
    {
      title: 'Contact',
      slug: 'contact',
      path: '/contact',
      status: 'published',
      blocks: [
        {
          type: 'richText',
          heading: 'Request a survey window',
          html: '<p>Tell us the site, the turbine count and model, and when you would like us there. You get a window and a fixed price inside two working days.</p>',
        },
        {
          type: 'contactForm',
          heading: 'Your site',
          submitLabel: 'Request a survey window',
          fields: [
            { name: 'name', label: 'Your name', fieldType: 'text', required: true },
            { name: 'email', label: 'Email', fieldType: 'email', required: true },
            { name: 'company', label: 'Company', fieldType: 'text' },
            { name: 'site', label: 'Site, turbine count and model', fieldType: 'textarea', required: true },
          ],
        },
      ],
    },
    {
      title: 'Method statements',
      slug: 'method-statements',
      path: '/method-statements',
      // Left as a draft on purpose: proves a draft is a 404 on the public site.
      status: 'draft',
      blocks: [
        {
          type: 'richText',
          heading: 'Method statements',
          html: '<p>Our method statements for blade inspection, leading-edge repair and tower NDT. Updated every January.</p>',
        },
      ],
    },
  ],
};

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

  // `update: {}` — a re-run never overwrites pages someone has since edited. A child page finds its parent by
  // path; parents come first in the list.
  for (const { nested, ...page } of spec.pages) {
    // By path, which is unique per site: the parent is exactly the page this path sits under (invariant 9).
    const parentPath = page.path.slice(0, page.path.lastIndexOf('/'));
    const parent = nested
      ? await prisma.content.findUnique({ where: { siteId_path: { siteId: site.id, path: parentPath } }, select: { id: true, typeId: true } })
      : null;
    if (nested && !parent) throw new Error(`Seed page ${page.path}: no page at ${parentPath} seeded before it`);
    if (parent?.typeId) throw new Error(`Seed page ${page.path}: ${parentPath} is an entry, and only pages can have pages under them`);
    await prisma.content.upsert({
      where: { siteId_path: { siteId: site.id, path: page.path } },
      update: {},
      create: {
        ...page,
        siteId: site.id,
        parentId: parent?.id ?? null,
        authorId: user.id,
        ...(page.status === 'published' && { publishedAt: new Date() }),
      },
    });
  }

  await seedSettings(site, user.id, spec.settings);
  await seedMenus(site.id, spec.menus);

  // The built-in Posts type at /blog on every site (TYP-01). Never overwritten, so a
  // rename done in the admin survives a re-run.
  await prisma.contentType.upsert({
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

  console.log(
    `Ensured ${user.email} owns ${site.name} (${site.subdomain}, ${spec.pages.length} seed pages)`,
  );
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
        if (item.page && !contentId) throw new Error(`Seed menu item ${item.label}: no page ${item.page}`);
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
