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
      { label: 'Harvest log', href: '#log' },
      { label: 'Visit the farm', href: '#visit' },
      { label: 'Wholesale', href: '#wholesale' },
    ],
    footer: {
      note: 'A five-acre lease on the east bank. Two boats, four people, one tide to work with.',
      groups: [
        {
          title: 'Buy',
          links: [
            { label: 'Spring shares', href: '#shares' },
            { label: 'Restaurant orders', href: '#wholesale' },
            { label: 'Shucking knives', href: '#shop' },
          ],
        },
        {
          title: 'The farm',
          links: [
            { label: 'How we grow', href: '#growing' },
            { label: 'Water quality', href: '#water' },
            { label: 'Farm tours', href: '#visit' },
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
  page: {
    path: '/',
    title: 'Corrick Oyster Co. — oysters from the Damariscotta',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'Lot 14 · Harvested at low water',
        headline: 'Oysters that taste like the tide that raised them',
        body: 'We grow in floating bags on the east bank of the Damariscotta, where the river turns salt twice a day. Nothing gets shipped that was not in the water this morning.',
        primaryAction: { label: 'Reserve a spring share', href: '#shares' },
        secondaryAction: { label: 'Read this week’s harvest log', href: '#log' },
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
};
