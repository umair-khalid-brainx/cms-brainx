import { media, type SeedSite } from '../seed-types.js';

// Corrick Oyster Co. (D-064: the placeholder identity kept as a demo tenant): a family oyster farm on the
// Damariscotta River in Maine. Content for DEP-03; the theme matches what this demo has always used for it.

const MAGGIE = 'maggie@corrick.test';
const SAM = 'sam@corrick.test';
const LENA = 'lena@corrick.test';

export const corrick: SeedSite = {
  subdomain: 'corrick',
  name: 'Corrick Oyster Co.',
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
  members: [
    { email: MAGGIE, name: 'Maggie Corrick', role: 'author' },
    { email: SAM, name: 'Sam Doane', role: 'editor' },
    { email: LENA, name: 'Lena Ortiz', role: 'contributor' },
  ],
  library: [
    { file: 'corrick/river-dawn.jpg', title: 'River at dawn', alt: 'Mist lifting off a still river at dawn, a wooded shore beyond' },
    { file: 'corrick/tidal-flats.jpg', title: 'Oyster beds at low tide', alt: 'Rows of oyster beds exposed on the tidal flats at low water' },
    { file: 'corrick/crew-at-the-beds.jpg', title: 'Crew at the beds', alt: 'Two growers bent over the oyster beds in shallow water' },
    { file: 'corrick/harvest-day.jpg', title: 'Harvest day', alt: 'A grower standing waist-deep in the river, lifting a mesh tray of oysters' },
    { file: 'corrick/farm-tour.jpg', title: 'Farm tour', alt: 'Visitors on the tour boat watching the crew work the floating gear' },
    { file: 'corrick/winter-river.jpg', title: 'Winter on the river', alt: 'A work boat moored on a gray winter river below dark pines' },
    { file: 'corrick/floating-gear.jpg', title: 'Floating gear', alt: 'Lines of black floats marking the oyster gear across a calm bay' },
    { file: 'corrick/oysters-on-ice.jpg', title: 'Oysters on ice', alt: 'Freshly shucked oysters on crushed ice with lemon' },
    { file: 'corrick/raw-bar.jpg', title: 'The raw bar', alt: 'Oysters laid out on ice along a marble raw bar' },
    { file: 'corrick/oyster-pile.jpg', title: 'Today’s harvest', alt: 'A heap of freshly harvested oysters in their shells' },
    { file: 'corrick/shucking.jpg', title: 'Shucking', alt: 'A gloved hand holding an oyster open on the half shell' },
    { file: 'corrick/shells.jpg', title: 'Shells for the reef', alt: 'Hundreds of empty oyster shells piled together' },
  ],
  settings: {
    tagline: 'Oysters from the Damariscotta River',
    footerNote:
      'Corrick Oyster Co. has grown oysters on the east bank of the Damariscotta River, Maine, since 2011. Harvested to order, shipped the same day.',
    logo: { file: 'corrick/logo.svg', title: 'Corrick Oyster Co. logo', alt: 'Corrick Oyster Co.' },
  },
  menus: {
    header: [
      { label: 'The farm', page: '/farm' },
      { label: 'Our oysters', page: '/oysters' },
      { label: 'Visit', page: '/visit' },
      { label: 'Wholesale', page: '/wholesale', children: [{ label: 'How ordering works', page: '/wholesale/how-ordering-works' }] },
      { label: 'Journal', url: '/blog' },
    ],
    footer: [
      {
        label: 'The farm',
        page: '/farm',
        children: [
          { label: 'Our oysters', page: '/oysters' },
          { label: 'Visit the farm', page: '/visit' },
          { label: 'Journal', url: '/blog' },
        ],
      },
      {
        label: 'Trade',
        page: '/wholesale',
        children: [
          { label: 'How ordering works', page: '/wholesale/how-ordering-works' },
          { label: 'Contact us', page: '/contact' },
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
        metaDescription: 'Oysters grown in floating bags on the Damariscotta River, Maine. Harvested to order and shipped the same day.',
        ogImage: media('corrick/oysters-on-ice.jpg'),
      },
      blocks: [
        {
          type: 'hero',
          eyebrow: 'Lot 14 · Harvested at low water',
          headline: 'Oysters that taste like the tide that raised them',
          body: 'We grow in floating bags on the east bank of the Damariscotta, where the river turns salt twice a day. Everything we ship left the water that morning.',
          primaryAction: { label: 'Meet our oysters', href: '/oysters' },
          secondaryAction: { label: 'Visit the farm', href: '/visit' },
          image: { src: media('corrick/river-dawn.jpg'), alt: '' },
        },
        {
          type: 'featureGrid',
          heading: 'Three oysters, one river',
          intro: 'Same seed, different water. Where an oyster spends its last summer decides how it tastes.',
          items: [
            { label: 'Upper river', title: 'Corrick Point', body: 'Grown where fresh water meets the tide. Mild, sweet, a clean cucumber finish.' },
            { label: 'Mid river', title: 'Salt Ledge', body: 'Our everyday oyster. Firm, briny up front, a little mineral at the end.' },
            { label: 'Lower river', title: 'Winter Cove', body: 'Harvested only from November. Deep cups, full of salt, sweeter as the water cools.' },
          ],
        },
        {
          type: 'imageText',
          heading: 'Harvested to order',
          body: 'We don’t keep oysters waiting in a cooler. Orders close at 10 the night before; we lift at low water, grade on the boat and ship by noon.',
          image: { src: media('corrick/harvest-day.jpg'), alt: '' },
          imagePosition: 'right',
          action: { label: 'How wholesale works', href: '/wholesale' },
        },
        {
          type: 'testimonial',
          quote: 'We change most of our menu every week. The Corrick oysters have stayed on it for six years.',
          attribution: 'Nell Harrow',
          role: 'Chef, The Granary, Portland',
        },
        {
          type: 'cta',
          heading: 'Come out on the river',
          body: 'Ninety minutes on the boat with the crew, a dozen oysters shucked on deck. Tours run June to September.',
          action: { label: 'Book a farm tour', href: '/visit' },
        },
      ],
    },
    {
      title: 'The farm',
      slug: 'farm',
      path: '/farm',
      status: 'published',
      blocks: [
        {
          type: 'hero',
          eyebrow: 'Since 2011',
          headline: 'Four acres of river, worked by hand',
          body: 'Maggie and Tom Corrick started with two hundred bags and a borrowed skiff. Fourteen years later the farm runs to four acres of lease and a crew of six, and we still sort every oyster by hand.',
          image: { src: media('corrick/tidal-flats.jpg'), alt: '' },
        },
        {
          type: 'richText',
          heading: 'How an oyster grows here',
          html: '<p>Seed arrives in May no bigger than a fingernail. It spends its first summer in fine mesh bags at the surface, where the water is warmest and the food is richest, and we tumble it every two weeks so the shells grow deep instead of long.</p><p>By its second autumn an oyster has moved three times, each time into wider mesh and a little further down the river. It takes two to three years to reach market size. Nothing is fed and nothing is added: an oyster eats what the river carries past it, and cleans the water as it does.</p>',
        },
        {
          type: 'gallery',
          heading: 'A year on the water',
          images: [
            { src: media('corrick/crew-at-the-beds.jpg'), alt: '', caption: 'Turning the bags at low water' },
            { src: media('corrick/floating-gear.jpg'), alt: '', caption: 'The floating gear in summer' },
            { src: media('corrick/winter-river.jpg'), alt: '', caption: 'January: the gear goes down for the winter' },
          ],
        },
        {
          type: 'stats',
          items: [
            { label: 'Acres of lease', value: '4' },
            { label: 'Oysters harvested in 2025', value: '410,000' },
            { label: 'Years to market size', value: '2–3' },
          ],
        },
      ],
    },
    {
      title: 'Our oysters',
      slug: 'oysters',
      path: '/oysters',
      status: 'published',
      blocks: [
        {
          type: 'hero',
          eyebrow: 'Tasting notes',
          headline: 'Three oysters from one river',
          body: 'All three start as the same seed. The difference is where they finish: how much fresh water, how much salt, how cold the winter.',
          image: { src: media('corrick/oysters-on-ice.jpg'), alt: '' },
        },
        {
          type: 'featureGrid',
          items: [
            { label: 'Corrick Point', title: 'Mild and sweet', body: '2.5–3 in. Light brine, a soft sweetness and a clean cucumber finish. The one to give someone who says they don’t like oysters.' },
            { label: 'Salt Ledge', title: 'Our everyday oyster', body: '3 in. Firm meat, bright brine up front and a mineral finish. Most of our wholesale orders are these.' },
            { label: 'Winter Cove', title: 'November to March', body: '3–3.5 in, deep cups. Full salt and a long sweet finish that gets better as the river cools.' },
          ],
        },
        {
          type: 'faq',
          heading: 'Before you order',
          items: [
            { question: 'How long do they keep?', answer: 'Up to seven days from harvest in the fridge, cup side down under a damp cloth. Never in water and never sealed in plastic: they need to breathe.' },
            { question: 'Is it safe to eat oysters in summer?', answer: 'Yes. The old rule about months with an R dates from before refrigeration. Our water is tested weekly by the state, and summer oysters are leaner and sweeter.' },
            { question: 'Do you ship to homes?', answer: 'Yes, Tuesday to Thursday, in boxes of 50 or 100 packed with ice packs and seaweed. They arrive the next day.' },
          ],
        },
      ],
    },
    {
      title: 'Visit',
      slug: 'visit',
      path: '/visit',
      status: 'published',
      blocks: [
        {
          type: 'imageText',
          heading: 'Farm tours, June to September',
          body: 'Ninety minutes on the boat with the crew: how the gear works, how we grade, and a dozen oysters each shucked on deck. Tours leave the town dock at 10 and 2, weather permitting, for up to eight people.',
          image: { src: media('corrick/farm-tour.jpg'), alt: '' },
          imagePosition: 'left',
          action: { label: 'Ask about a date', href: '/contact' },
        },
        {
          type: 'faq',
          heading: 'Good to know',
          items: [
            { question: 'What should I bring?', answer: 'Layers and shoes you don’t mind getting wet. It is always colder on the water than on the dock.' },
            { question: 'Can children come?', answer: 'Yes, from age eight, with a life jacket we provide. They usually like the crabs more than the oysters.' },
            { question: 'What happens if it rains?', answer: 'Rain is fine. If the wind is too strong we move your tour to another day or refund it in full.' },
          ],
        },
      ],
    },
    {
      title: 'Wholesale',
      slug: 'wholesale',
      path: '/wholesale',
      status: 'published',
      blocks: [
        {
          type: 'hero',
          eyebrow: 'For restaurants and fishmongers',
          headline: 'Harvested the morning you need them',
          body: 'We supply around forty restaurants from Portland to Boston. Order by 10 pm and we lift, grade and ship the next morning.',
          primaryAction: { label: 'How ordering works', href: '/wholesale/how-ordering-works' },
          image: { src: media('corrick/oyster-pile.jpg'), alt: '' },
        },
        {
          type: 'stats',
          items: [
            { label: 'Restaurants we supply', value: '40' },
            { label: 'Hours from water to box', value: '4' },
            { label: 'Minimum order', value: '100' },
          ],
        },
      ],
    },
    {
      title: 'How ordering works',
      slug: 'how-ordering-works',
      path: '/wholesale/how-ordering-works',
      nested: true,
      status: 'published',
      blocks: [
        {
          type: 'richText',
          heading: 'How ordering works',
          html: '<ol><li>Send your order by 10 pm: variety, count, and the day you want them.</li><li>We harvest at the next low water and grade every oyster by hand on the boat.</li><li>Boxes leave the farm by noon, with the harvest date and lot on the tag.</li></ol><p>New accounts start with a tasting box of all three oysters, free. Prices are set each season and sent with your first order.</p>',
        },
        {
          type: 'contactForm',
          heading: 'Open a wholesale account',
          submitLabel: 'Send',
          fields: [
            { name: 'name', label: 'Your name', fieldType: 'text', required: true },
            { name: 'email', label: 'Email', fieldType: 'email', required: true },
            { name: 'business', label: 'Restaurant or shop', fieldType: 'text', required: true },
            { name: 'message', label: 'What you’re looking for', fieldType: 'textarea' },
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
          type: 'contactForm',
          heading: 'Get in touch',
          intro: 'Questions about an order, a tour or the farm. We answer within a day, except at low water.',
          submitLabel: 'Send message',
          fields: [
            { name: 'name', label: 'Your name', fieldType: 'text', required: true },
            { name: 'email', label: 'Email', fieldType: 'email', required: true },
            { name: 'message', label: 'Message', fieldType: 'textarea', required: true },
          ],
        },
      ],
    },
    {
      title: 'Summer tasting menu',
      slug: 'summer-menu',
      path: '/summer-menu',
      // A draft on purpose: shows the editor and the public 404 for unpublished work.
      status: 'draft',
      blocks: [
        { type: 'richText', heading: 'Summer tasting menu', html: '<p>Six oysters, three ways. Details to come.</p>' },
      ],
    },
    {
      title: 'Oyster Week 2026',
      slug: 'oyster-week',
      path: '/oyster-week',
      // Waiting for review (GOV-07): Lena wrote it, an editor approves or sends it back in the demo.
      status: 'in_review',
      submittedBy: LENA,
      submittedDaysAgo: 1,
      blocks: [
        {
          type: 'hero',
          eyebrow: 'Damariscotta · June 14–20',
          headline: 'Oyster Week is back',
          body: 'Seven days of tours, tastings and a shucking contest on the town dock. Every farm on the river opens its gear to visitors.',
          image: { src: media('corrick/raw-bar.jpg'), alt: '' },
        },
        {
          type: 'richText',
          heading: 'What’s on',
          html: '<ul><li>Daily farm tours at 10 and 2</li><li>Tasting flights at the raw bar every evening</li><li>The shucking contest, Saturday at noon</li></ul>',
        },
      ],
    },
  ],
  posts: [
    {
      title: 'Harvest day on the river',
      slug: 'harvest-day-on-the-river',
      status: 'published',
      author: MAGGIE,
      publishedDaysAgo: 3,
      excerpt: 'Low water at 5:40, three hundred bags to lift, and a crew that has done this a thousand times.',
      image: 'corrick/harvest-day.jpg',
      categories: ['Farm life'],
      tags: ['harvest', 'the river'],
      html: '<p>Low water was at 5:40 on Tuesday, so the crew was on the boat at five. A harvest day starts with the tide table, not the clock.</p><p>We lift the bags, tip the oysters onto the grading table and sort them by size and shape. Anything too small goes back in the water for another month; anything with a thin shell goes back too, because a thin shell means it grew too fast.</p><p>By nine the boxes were tagged with the lot and the harvest date, and by noon they were on the truck to Portland. Most of them were on a plate that evening.</p>',
    },
    {
      title: 'How to shuck an oyster without losing a thumb',
      slug: 'how-to-shuck-an-oyster',
      status: 'published',
      author: SAM,
      publishedDaysAgo: 9,
      excerpt: 'A glove, a short knife and the hinge. Everything else is practice.',
      image: 'corrick/shucking.jpg',
      categories: ['Kitchen'],
      tags: ['shucking', 'at home'],
      html: '<p>You need three things: a proper oyster knife (short and stiff, not a paring knife), a folded towel or a glove, and patience for the first dozen.</p><ol><li>Hold the oyster cup side down in the towel, hinge toward you.</li><li>Work the tip of the knife into the hinge and twist, like turning a key, until it pops.</li><li>Slide the blade along the top shell to cut the muscle, lift the lid, then cut under the meat to free it.</li></ol><p>Don’t tip out the liquor. That is the river, and it is the best part.</p>',
    },
    {
      title: 'Why we put the shells back',
      slug: 'why-we-put-the-shells-back',
      status: 'published',
      author: MAGGIE,
      publishedDaysAgo: 16,
      excerpt: 'Every shell our restaurants return goes back into the river to give the next generation somewhere to settle.',
      image: 'corrick/shells.jpg',
      categories: ['Sustainability'],
      tags: ['shells', 'the river'],
      html: '<p>Wild oysters need something hard to settle on, and the best thing is another oyster shell. For most of the last century the shells from Maine’s raw bars went to landfill.</p><p>Since 2019 we collect the shells from the restaurants we supply. They cure in the sun for a year, then go back into the river on the old reef below the farm. Last year that was eleven tons.</p>',
    },
    {
      title: 'Winter on the Damariscotta',
      slug: 'winter-on-the-damariscotta',
      status: 'published',
      author: MAGGIE,
      publishedDaysAgo: 30,
      excerpt: 'When the river freezes the gear goes down to the bottom, and the oysters sleep until March.',
      image: 'corrick/winter-river.jpg',
      categories: ['Farm life'],
      tags: ['winter', 'the river'],
      html: '<p>In January we sink the floating gear to the river bed, below where the ice can reach. The oysters stop feeding and close up until the water warms in March.</p><p>It is the quietest time on the farm, and the busiest in the shed: mending bags, building new gear and planning which seed goes where in spring. Winter Cove oysters are the exception. We harvest them right up to the freeze, when they are at their best.</p>',
    },
    {
      title: 'A night at the raw bar',
      slug: 'a-night-at-the-raw-bar',
      status: 'published',
      author: SAM,
      publishedDaysAgo: 45,
      excerpt: 'Two hundred oysters, three varieties and the question every guest asks: which one first?',
      image: 'corrick/raw-bar.jpg',
      categories: ['News'],
      tags: ['tasting', 'events'],
      html: '<p>For our end-of-season party we set up a raw bar in the shed and shucked two hundred oysters for the people who buy them every week.</p><p>The question everyone asks is which to eat first. Mild before salty: start with Corrick Point, then Salt Ledge, and finish with Winter Cove, or the salt will drown the others.</p>',
    },
    {
      title: 'Meet the crew',
      slug: 'meet-the-crew',
      status: 'published',
      author: MAGGIE,
      publishedDaysAgo: 60,
      excerpt: 'Six people, one boat and a lot of mesh bags. Who does what on the farm.',
      image: 'corrick/crew-at-the-beds.jpg',
      categories: ['Farm life'],
      tags: ['crew'],
      html: '<p>Maggie runs the farm and the seed. Sam runs wholesale and knows every chef on the coast by name. Lena joined last spring and runs the farm tours. Three more of us work the boat from May to November.</p><p>If you visit, you will meet whoever is on the water that day. Ask them about the gear: we could talk about mesh sizes for hours.</p>',
    },
    {
      title: 'Oyster Week tickets are on sale',
      slug: 'oyster-week-tickets',
      // Scheduled (GOV-07): goes live by itself five days after the seed runs.
      status: 'scheduled',
      scheduledBy: SAM,
      publishInDays: 5,
      author: SAM,
      excerpt: 'Tours, tastings and the shucking contest: book before the boats fill up.',
      image: 'corrick/oyster-pile.jpg',
      categories: ['News'],
      tags: ['events'],
      html: '<p>Tickets for Oyster Week tours and tastings are on sale now. Tours take eight people each and sold out in two days last year, so book early.</p>',
    },
  ],
};
