import type { SiteFixture } from '@/site/types';

/**
 * Demo tenant A. Editorial type, tidal palette, soft shape.
 * Everything here is fixture data standing in for rows in `content`.
 */
export const corrick: SiteFixture = {
  settings: {
    slug: 'corrick',
    name: 'Corrick Oyster Co.',
    tagline: 'Damariscotta River, Maine',
    host: 'corrick.yourcms.com',
    nav: [
      { label: 'Shares', href: '#shares' },
      { label: 'Harvest log', href: '/harvest-log' },
      { label: 'Visit the farm', href: '/visit-the-farm' },
      { label: 'Wholesale', href: '/wholesale' },
    ],
    footer: {
      note: 'A five-acre lease on the east bank. Two boats, four people, one tide to work with.',
      groups: [
        {
          title: 'Buy',
          links: [
            { label: 'Spring shares', href: '#shares' },
            { label: 'Restaurant orders', href: '/wholesale' },
            { label: 'Shucking knives', href: '#shop' },
          ],
        },
        {
          title: 'The farm',
          links: [
            { label: 'How we grow', href: '#growing' },
            { label: 'Water quality', href: '#water' },
            { label: 'Farm tours', href: '/visit-the-farm' },
          ],
        },
      ],
    },
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
  },
  pages: [{
    path: '/',
    title: 'Corrick Oyster Co. — oysters from the Damariscotta',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'Lot 14 · Harvested at low water',
        headline: 'Oysters that taste like the tide that raised them',
        body: 'We grow in floating bags on the east bank of the Damariscotta, where the river turns salt twice a day. Nothing gets shipped that was not in the water this morning.',
        primaryAction: { label: 'Reserve a spring share', href: '#shares' },
        secondaryAction: { label: 'Read this week’s harvest log', href: '/harvest-log' },
        image: { src: '/media/corrick-flats.svg', alt: 'The tidal flats at low water, oyster cages in rows' },
        facts: [
          { label: 'Salinity', value: '28 ppt' },
          { label: 'Grow-out', value: '22 months' },
          { label: 'Cages in water', value: '1,340' },
        ],
      },
      {
        type: 'featureGrid',
        heading: 'How a share works',
        intro: 'Twenty weeks, one delivery a week, priced before the season opens so the boat gets paid in March rather than August.',
        ordered: true,
        items: [
          {
            title: 'Reserve in March',
            body: 'Shares are capped at what the lease can carry. When they are gone we stop taking names rather than thin the beds.',
          },
          {
            title: 'We harvest on your tide',
            body: 'Your bags come up the morning of your delivery day. You get a lot number and the salinity reading it was pulled at.',
          },
          {
            title: 'Collected Friday',
            body: 'Pick up at the co-op in Newcastle, or add river delivery within twelve miles of the landing.',
          },
        ],
      },
      {
        type: 'imageText',
        heading: 'Twelve feet of water at high tide, ankle-deep at low',
        body: 'The lease sits on a shelf that drains almost completely twice a day. That swing is the whole reason the oysters taste the way they do — they spend half their lives filtering a river and half filtering the Gulf of Maine coming back in.',
        image: {
          src: '/media/corrick-lot14.svg',
          alt: 'Survey drawing of Lot 14 showing cage rows and the low-water contour',
          caption: 'Lot 14 — cage rows and the mean low-water contour',
        },
        imagePosition: 'left',
        action: { label: 'How we grow', href: '#growing' },
      },
      {
        type: 'richText',
        heading: 'What we test, and how often',
        html: '<p>Water is sampled at the lease line three times a week through the season and after any rain event over half an inch. Results go in the harvest log the same day, whether or not they are good.</p><p>Closures are the state’s call, not ours. When the river closes we say so on the front page and refund that week of every share — we would rather lose the week than have you wonder.</p>',
      },
      {
        type: 'testimonial',
        quote: 'They send the salinity reading with the lot number. I have had suppliers who could not tell me what bay the oysters came from.',
        attribution: 'Nina Alvarez',
        role: 'Chef, The Lower Landing, Portland',
      },
      {
        type: 'cta',
        heading: 'Spring shares open March 1',
        body: 'Two hundred shares, twenty weeks, one river. Join the list and we will write to you the morning they open.',
        action: { label: 'Join the share list', href: '#shares' },
        note: 'No deposit until shares open.',
      },
    ],
  },
  {
    path: '/visit-the-farm',
    title: 'Visit the Farm — Corrick Oyster Co.',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'Newcastle, Maine',
        headline: 'Come down at low water and see the lease',
        body: 'We run tours off the co-op dock Thursday through Sunday, timed to whatever tide is lowest that week — that is when the cages are easiest to see and easiest to reach.',
        primaryAction: { label: 'Request a tour date', href: '#tour' },
        secondaryAction: { label: 'Back to the harvest log', href: '/harvest-log' },
        image: { src: '/media/corrick-visit-hero.svg', alt: 'The landing at the Newcastle co-op dock' },
        facts: [
          { label: 'Tours', value: 'Thu–Sun' },
          { label: 'Group size', value: 'Up to 8' },
          { label: 'Length', value: '90 min' },
        ],
      },
      {
        type: 'gallery',
        heading: 'The lease and the landing',
        images: [
          { src: '/media/corrick-visit-1.svg', alt: 'Cages exposed at low water', caption: 'Lot 14 at low water' },
          { src: '/media/corrick-visit-2.svg', alt: 'The two boats used for tending the lease', caption: 'Both boats, tending bags' },
          { src: '/media/corrick-visit-3.svg', alt: 'The tasting room at the co-op dock', caption: 'Tasting room, open for tours' },
          { src: '/media/corrick-visit-4.svg', alt: 'The Newcastle co-op dock at pickup time', caption: 'Friday pickup at the co-op' },
        ],
      },
      {
        type: 'teamGrid',
        heading: 'Who you’ll meet',
        intro: 'Two boats, four people — whoever is on the dock that day runs your tour.',
        members: [
          { name: 'Mara Corrick', role: 'Farmer, owner', bio: 'Holds the lease. Runs tours most Saturdays herself.', photo: { src: '/media/corrick-crew-1.svg', alt: 'Mara Corrick' } },
          { name: 'Dez Hutchins', role: 'Boat captain', bio: 'On the water before sunrise most tide days.', photo: { src: '/media/corrick-crew-2.svg', alt: 'Dez Hutchins' } },
          { name: 'Lina Ferro', role: 'Sorting and grading', bio: 'Runs the tasting room on tour days.', photo: { src: '/media/corrick-crew-3.svg', alt: 'Lina Ferro' } },
          { name: 'Jide Okafor', role: 'Deliveries', bio: 'Handles the twelve-mile river delivery route.', photo: { src: '/media/corrick-crew-4.svg', alt: 'Jide Okafor' } },
        ],
      },
      {
        type: 'faq',
        heading: 'Before you come down',
        items: [
          { question: 'Do I need to book ahead?', answer: 'Yes — tours are timed to the tide, so we confirm your date and time by email once you request one.' },
          { question: 'Is it kid-friendly?', answer: 'Yes, though the flats are muddy at low water — boots, not sandals.' },
          { question: 'Can we buy oysters on site?', answer: 'The tasting room sells by the dozen on tour days only.' },
        ],
      },
      {
        type: 'cta',
        heading: 'Next low tide worth seeing: check the schedule',
        body: 'Tours fill up around the best tides first.',
        action: { label: 'Request a tour date', href: '#tour' },
        note: 'Free — tasting room purchases are separate.',
      },
    ],
  },
  {
    path: '/wholesale',
    title: 'Wholesale — Corrick Oyster Co.',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'Restaurants and raw bars',
        headline: 'Case orders, priced by the week',
        body: 'The same lot numbers and salinity readings that go out with every share go out with every case — same-day pull, cold-packed, shipped or driven to Portland twice a week.',
        primaryAction: { label: 'See case pricing', href: '#pricing' },
        secondaryAction: { label: 'Read this week’s harvest log', href: '/harvest-log' },
        image: { src: '/media/corrick-wholesale-hero.svg', alt: 'Cases of oysters ready for wholesale delivery' },
        facts: [
          { label: 'Delivery', value: 'Tue & Fri' },
          { label: 'Min. order', value: '2 cases' },
          { label: 'Portland route', value: '2x weekly' },
        ],
      },
      {
        type: 'logoCloud',
        heading: 'Already on the menu at',
        logos: [
          { src: '/media/logo-lower-landing.svg', alt: 'The Lower Landing' },
          { src: '/media/logo-basin-oyster-bar.svg', alt: 'Basin Oyster Bar' },
          { src: '/media/logo-tide-table.svg', alt: 'Tide Table' },
          { src: '/media/logo-newcastle-coop.svg', alt: 'Newcastle Co-op' },
        ],
      },
      {
        type: 'pricingTable',
        heading: 'Case pricing',
        intro: 'Priced weekly against the lot coming up, not a fixed catalogue rate.',
        plans: [
          {
            name: 'Standard case',
            price: '$85',
            period: 'case',
            features: ['100 count', 'Single lot', 'Tue or Fri pickup'],
            action: { label: 'Order standard', href: '#pricing' },
            highlighted: false,
          },
          {
            name: 'Restaurant weekly',
            price: '$78',
            period: 'case/wk',
            features: ['100 count, standing order', 'Portland delivery included', 'Priority on limited lots'],
            action: { label: 'Start a standing order', href: '#pricing' },
            highlighted: true,
          },
          {
            name: 'Half case',
            price: '$48',
            period: 'case',
            features: ['50 count', 'Single lot', 'Tue or Fri pickup'],
            action: { label: 'Order half case', href: '#pricing' },
            highlighted: false,
          },
        ],
      },
      {
        type: 'contactForm',
        heading: 'Set up an account',
        intro: 'New restaurant accounts hear back within a day.',
        submitLabel: 'Request an account',
        fields: [
          { name: 'name', label: 'Name', fieldType: 'text', required: true },
          { name: 'restaurant', label: 'Restaurant', fieldType: 'text', required: true },
          { name: 'email', label: 'Email', fieldType: 'email', required: true },
          { name: 'message', label: 'Expected volume', fieldType: 'textarea', required: false },
        ],
      },
      {
        type: 'cta',
        heading: 'Friday’s pull ships Tuesday',
        body: 'Standing orders get first call on limited lots.',
        action: { label: 'Request an account', href: '#account' },
        note: 'No contract — cancel a standing order with a week’s notice.',
      },
    ],
  },
  {
    path: '/harvest-log',
    title: 'Harvest Log — Corrick Oyster Co.',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'Updated every sample day',
        headline: 'This week on Lot 14',
        body: 'Every reading we take at the lease line, posted the same day — good or bad.',
        image: { src: '/media/corrick-harvest-hero.svg', alt: 'Water testing equipment at the lease line' },
        facts: [
          { label: 'Salinity', value: '28 ppt' },
          { label: 'Water temp', value: '14°C' },
          { label: 'Status', value: 'Open' },
        ],
      },
      {
        type: 'stats',
        heading: 'Season so far',
        items: [
          { label: 'Samples taken', value: '61' },
          { label: 'Closures', value: '2' },
          { label: 'Days open', value: '94%' },
          { label: 'Weeks left', value: '6' },
        ],
      },
      {
        type: 'richText',
        heading: 'How to read this page',
        html: '<p>Salinity and temperature are sampled at the lease line three times a week. A closure means the state, not us, closed the river to harvest — usually after heavy rain.</p><p>Every share affected by a closure gets that week refunded automatically. You do not need to ask.</p>',
      },
      {
        type: 'testimonial',
        quote: 'I check the log before I check the weather. If the river’s open, service is on.',
        attribution: 'Nina Alvarez',
        role: 'Chef, The Lower Landing, Portland',
      },
      { type: 'spacer', size: 'sm' },
      {
        type: 'faq',
        heading: 'About closures',
        items: [
          { question: 'What causes a closure?', answer: 'Almost always rain — runoff raises bacteria counts at the lease line temporarily.' },
          { question: 'How long does one last?', answer: 'Usually 2–4 days, until two consecutive clean samples come back.' },
          { question: 'Do I get charged for a closed week?', answer: 'No — closed weeks are refunded automatically, no request needed.' },
        ],
      },
    ],
  }],
};
