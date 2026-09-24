import type { SiteFixture } from '@/site/types';

/**
 * Demo tenant B. Technical type, dark industrial palette, sharp shape.
 * Same block components as tenant A — only `theme` and content differ.
 */
export const kestrel: SiteFixture = {
  settings: {
    slug: 'kestrel',
    name: 'Kestrel Rigging',
    tagline: 'Rope access · IRATA L3',
    host: 'kestrel.yourcms.com',
    nav: [
      { label: 'Capability', href: '#capability' },
      { label: 'Method statements', href: '#methods' },
      { label: 'Certification', href: '#certs' },
      { label: 'Request a survey', href: '#survey' },
    ],
    footer: {
      note: 'Rope-access inspection and repair for onshore wind. Eleven technicians, all IRATA certified, all on our own books.',
      groups: [
        {
          title: 'Services',
          links: [
            { label: 'Blade inspection', href: '#lei' },
            { label: 'Leading-edge repair', href: '#repair' },
            { label: 'Tower and weld NDT', href: '#ndt' },
          ],
        },
        {
          title: 'Compliance',
          links: [
            { label: 'Method statements', href: '#methods' },
            { label: 'Insurance and certs', href: '#certs' },
            { label: 'Incident record', href: '#safety' },
          ],
        },
      ],
    },
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
  },
  page: {
    path: '/',
    title: 'Kestrel Rigging — rope-access blade inspection and repair',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'IRATA L3 · Working height to 165 m',
        headline: 'Blade inspection without a crane on site',
        body: 'Two technicians on rope reach the leading edge in under an hour. No crane mobilisation, no road closure, no waiting on a weather window wide enough to lift.',
        primaryAction: { label: 'Request a survey window', href: '#survey' },
        secondaryAction: { label: 'Download the method statement', href: '#methods' },
        image: { src: '/media/kestrel-blade.svg', alt: 'Blade elevation with inspection stations marked along the leading edge' },
        facts: [
          { label: 'Turbines surveyed 2025', value: '412' },
          { label: 'Mean time on rope', value: '3.4 h' },
          { label: 'RIDDOR incidents', value: '0' },
        ],
      },
      {
        type: 'featureGrid',
        heading: 'Capability',
        intro: 'One crew, one mobilisation. Inspection and repair are the same visit unless the damage needs a workshop.',
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
        type: 'imageText',
        heading: 'Findings come back mapped to blade station, not described in prose',
        body: 'Every defect is logged against its station number, radius and blade face, with photographs at fixed distance. Two surveys a year apart can be compared directly, which is the only way to tell erosion from a bad photograph.',
        image: {
          src: '/media/kestrel-access.svg',
          alt: 'Rope access rigging diagram with anchor points and height markers',
          caption: 'WTG-07 · twin-rope descent from hub anchor',
        },
        imagePosition: 'right',
        action: { label: 'See a sample report', href: '#reports' },
      },
      {
        type: 'richText',
        heading: 'How we work a site',
        html: '<p>A survey window is four days for a six-turbine site, assuming wind under 12 m/s at hub height. We work to your permit system or ours, whichever your site prefers, and the rescue plan is filed before the first technician leaves the ground.</p><p>Every descent is logged. If a technician stands down for weather, that is in the report too — an unexplained gap in the record is worth less than an explained one.</p>',
      },
      {
        type: 'testimonial',
        quote: 'The comparison against last year’s survey took ten minutes because the station numbering had not moved. That is not normal in this industry.',
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
};
