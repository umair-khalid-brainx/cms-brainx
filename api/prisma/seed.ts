import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { STARTER_LAYOUTS } from './starter-layouts.js';

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
};

type SeedSite = {
  host: string;
  subdomain: string;
  name: string;
  theme: Prisma.InputJsonValue;
  owner: { email: string; name: string };
  pages: SeedPage[];
};

// Blocks use the flat contract from cms-blocks/types.ts (invariant 7) directly
// — `api` doesn't depend on that package, so these are hand-written, not imported.

const corrick: SeedSite = {
  host: 'corrick.yourcms.com',
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

// The second tenant (GOV-08a), so isolation is tested with two real hosts.
// Theme and copy recovered from the deleted `web/src/fixtures/kestrel.ts`
// (`f161fd8`); its `/media/*.svg` images no longer exist, so no block here
// references an image.
const kestrel: SeedSite = {
  host: 'kestrel.yourcms.com',
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
          facts: [
            { label: 'Turbines surveyed 2025', value: '412' },
            { label: 'Mean time on rope', value: '3.4 h' },
            { label: 'RIDDOR incidents', value: '0' },
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
          action: { label: 'Request a survey window', href: '#survey' },
          note: 'Method statement and insurance certs sent with every quote.',
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
          html: '<p>A survey window is four days for a six-turbine site, assuming wind under 12 m/s at hub height. We work to your permit system or ours, whichever your site prefers, and the rescue plan is filed before the first technician leaves the ground.</p><p>Every descent is logged. If a technician stands down for weather, that is in the report too — an unexplained gap in the record is worth less than an explained one.</p>',
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
  const site = await prisma.site.upsert({
    where: { host: spec.host },
    update: {},
    create: {
      host: spec.host,
      subdomain: spec.subdomain,
      name: spec.name,
      themeJson: spec.theme,
    },
  });

  // Resets the owner's password to DEV_PASSWORD on every run, on purpose.
  const user = await prisma.user.upsert({
    where: { email: spec.owner.email },
    update: { passwordHash },
    create: { email: spec.owner.email, name: spec.owner.name, passwordHash },
  });

  await prisma.siteMembership.upsert({
    where: { userId_siteId: { userId: user.id, siteId: site.id } },
    update: { role: 'owner' },
    create: { userId: user.id, siteId: site.id, role: 'owner' },
  });

  // `update: {}` — a re-run never overwrites pages someone has since edited.
  for (const page of spec.pages) {
    await prisma.content.upsert({
      where: { siteId_path: { siteId: site.id, path: page.path } },
      update: {},
      create: { ...page, siteId: site.id },
    });
  }

  console.log(
    `Ensured ${user.email} owns ${site.name} (${site.subdomain}, ${spec.pages.length} seed pages)`,
  );
}

// Global, not per site (TYP-05, D-038). Unlike pages, a re-run *does*
// overwrite: the layouts are platform data owned by this file, not
// something a tenant edits.
async function seedStarterLayouts(): Promise<void> {
  for (const [sortOrder, layout] of STARTER_LAYOUTS.entries()) {
    const data = { ...layout, blocks: layout.blocks as Prisma.InputJsonValue, sortOrder };
    await prisma.starterLayout.upsert({ where: { key: layout.key }, update: data, create: data });
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
