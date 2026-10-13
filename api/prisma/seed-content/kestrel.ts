import { media, type SeedSite } from '../seed-types.js';

const RUTH = 'ruth@kestrel.test';
const TOMASZ = 'tomasz@kestrel.test';

// The second tenant (GOV-08a), so isolation is tested with two real hosts; branded and filled out in GOV-08b
// (D-064: the placeholder identities are kept as the demo tenants). A rope-access crew that inspects and repairs
// wind turbine blades and towers. Theme first recovered from the deleted `web/src/fixtures/kestrel.ts` (`f161fd8`).
export const kestrel: SeedSite = {
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
  members: [
    { email: RUTH, name: 'Ruth Calder', role: 'administrator' },
    { email: TOMASZ, name: 'Tomasz Nowak', role: 'author' },
  ],
  library: [
    { file: 'kestrel/offshore-farm.jpg', title: 'Offshore wind farm', alt: 'Rows of offshore wind turbines standing in a calm blue sea' },
    { file: 'kestrel/crew-safety.jpg', title: 'Crew in safety gear', alt: 'A technician in a yellow helmet and harness looking out at an offshore turbine' },
    { file: 'kestrel/harness.jpg', title: 'Harness and carabiners', alt: 'Carabiners and descenders hanging from a rope-access harness' },
    { file: 'kestrel/turbines-fog.jpg', title: 'View from the nacelle', alt: 'Looking down from the top of a turbine at others rising out of a forest' },
    { file: 'kestrel/onshore-farm.jpg', title: 'Onshore wind farm', alt: 'Wind turbines among fields under a summer sky' },
    { file: 'kestrel/nacelle.jpg', title: 'Rotor from below', alt: 'A turbine rotor seen from the foot of the tower against a pale sky' },
    { file: 'kestrel/blades-on-racks.jpg', title: 'Blades on racks', alt: 'Two turbine blade roots held in green steel transport frames' },
    { file: 'kestrel/offshore-logistics.jpg', title: 'On the vessel', alt: 'The deck of a working vessel with wind turbines on the shore beyond' },
  ],
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
      seo: {
        metaDescription: 'Rope-access inspection and repair for wind turbine blades and towers, onshore and offshore. IRATA member company.',
        ogImage: media('kestrel/offshore-farm.jpg'),
      },
      blocks: [
        {
          type: 'hero',
          eyebrow: 'IRATA L3 · Working height to 165 m',
          headline: 'Blade inspection without a crane on site',
          body: 'Two technicians on rope reach the leading edge in under an hour. No crane mobilisation, no road closure, no waiting on a weather window wide enough to lift.',
          primaryAction: { label: 'See our capability', href: '/capability' },
          secondaryAction: { label: 'Request a survey window', href: '/contact' },
          image: { src: media('kestrel/offshore-farm.jpg'), alt: '' },
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
              body: 'Close-visual to the manufacturer’s inspection criteria, with photo capture at every station. Findings graded 1–5 and mapped to blade station.',
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
          image: { src: media('kestrel/turbines-fog.jpg'), alt: '' },
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
          type: 'imageText',
          heading: 'Repairs in the frame, not on the ground',
          body: 'Blades are repaired where they hang. When a blade does have to come down, we meet it in the yard and repair it in its transport frame before it goes back up.',
          image: { src: media('kestrel/blades-on-racks.jpg'), alt: '' },
          imagePosition: 'right',
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
          type: 'imageText',
          heading: 'From the water, the same way',
          body: 'Where a site is reached by boat, we work from the vessel and the tower’s access platform, under your marine coordination. The method and the report are the same as on land.',
          image: { src: media('kestrel/offshore-logistics.jpg'), alt: '' },
          imagePosition: 'left',
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
          image: { src: media('kestrel/crew-safety.jpg'), alt: '' },
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
          type: 'gallery',
          heading: 'On site',
          images: [
            { src: media('kestrel/harness.jpg'), alt: '', caption: 'Every kit checked and logged before each shift' },
            { src: media('kestrel/onshore-farm.jpg'), alt: '', caption: 'A six-turbine onshore site, survey week' },
            { src: media('kestrel/nacelle.jpg'), alt: '', caption: 'Where the work starts: the rotor from the tower base' },
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
  posts: [
    {
      title: 'What 412 blade surveys taught us about leading-edge erosion',
      slug: 'leading-edge-erosion-lessons',
      status: 'published',
      author: RUTH,
      publishedDaysAgo: 6,
      excerpt: 'Erosion starts sooner and further in than most maintenance plans assume. Three things we now check on every blade.',
      image: 'kestrel/blades-on-racks.jpg',
      categories: ['Field notes'],
      tags: ['blades', 'erosion'],
      html: '<p>Last year we surveyed 412 turbines. Three patterns came up often enough to change how we work.</p><ol><li>Erosion starts in the outer third of the blade, where the tip moves fastest, years before it shows from the ground.</li><li>Grade 2 damage left for one winter is usually grade 3 by spring.</li><li>Repairs last longest when the cure is logged: temperature, humidity and time, every time.</li></ol><p>None of this is new. What is new is having the same station numbers every year, so the comparison takes minutes.</p>',
    },
    {
      title: 'A day offshore',
      slug: 'a-day-offshore',
      status: 'published',
      author: TOMASZ,
      publishedDaysAgo: 20,
      excerpt: 'Up at four, on the vessel at six, on rope by eight. What an offshore inspection day looks like.',
      image: 'kestrel/offshore-logistics.jpg',
      categories: ['Field notes'],
      tags: ['offshore'],
      html: '<p>Offshore days start in the dark. The crew transfer vessel leaves at six, and the first transfer to the turbine is planned around the swell, not the clock.</p><p>Once we are on the transition piece the work is the same as onshore: rescue plan filed, kit checked, two technicians on rope. The difference is the weather window, which offshore can close in an hour.</p>',
    },
    {
      title: 'Why we log every stand-down',
      slug: 'why-we-log-every-stand-down',
      status: 'published',
      author: RUTH,
      publishedDaysAgo: 41,
      excerpt: 'A gap in a report is worth less than an explained one. Weather stops work; it shouldn’t stop the record.',
      image: 'kestrel/turbines-fog.jpg',
      categories: ['Safety'],
      tags: ['reporting', 'weather'],
      html: '<p>When the wind picks up past our limit, the crew comes down. That happens on most sites, most weeks.</p><p>What we do differently is write it down: the time, the wind speed at hub height, and who made the call. An asset manager reading the report a year later can see why a turbine wasn’t finished, instead of guessing.</p>',
    },
  ],
};
