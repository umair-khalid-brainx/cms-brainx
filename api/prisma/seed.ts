import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';

// One-off seed for local development — run manually with `npm run db:seed`.
// Not wired into `prisma migrate reset`'s seed hook (FND-06 proper); this just
// needs to exist once right now, not run automatically on every reset.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main(): Promise<void> {
  const site = await prisma.site.upsert({
    where: { host: 'corrick.yourcms.com' },
    update: {},
    create: {
      host: 'corrick.yourcms.com',
      name: 'Corrick Oyster Co.',
      // Matches web/src/fixtures/corrick.ts and admin/src/puck/config.tsx —
      // the same theme already used everywhere else this demo touches.
      themeJson: {
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
    },
  });

  const passwordHash = await bcrypt.hash('1234567890', 10);
  const user = await prisma.user.upsert({
    where: { email: 'umair.khalid@brainxtech.com' },
    update: { passwordHash },
    create: {
      email: 'umair.khalid@brainxtech.com',
      name: 'Umair Khalid',
      passwordHash,
    },
  });

  await prisma.siteMembership.upsert({
    where: { userId_siteId: { userId: user.id, siteId: site.id } },
    update: { role: 'owner' },
    create: { userId: user.id, siteId: site.id, role: 'owner' },
  });

  // One real page so `admin`'s Pages list isn't empty on a fresh clone, now
  // that CNT-01 replaced the localStorage-backed pagesStore. Blocks use the
  // flat contract from cms-blocks/types.ts (invariant 7) directly — `api`
  // doesn't depend on that package, so this is hand-written, not imported.
  await prisma.content.upsert({
    where: { siteId_path: { siteId: site.id, path: '/' } },
    update: {},
    create: {
      siteId: site.id,
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
  });

  console.log(`Seeded ${user.email} as owner of ${site.name} (${site.host})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
