/**
 * The four starter page layouts (TYP-05), seeded into `starter_layouts` and
 * offered on page creation by TYP-04. Data, not code-defined blocks (root
 * invariant 8): each is an ordinary `content.blocks` array in the flat
 * contract of `cms-blocks/src/types.ts` (invariant 7), so a page made from
 * one is indistinguishable from a page built by hand.
 *
 * Placeholder copy is generic, so a layout suits any tenant, and written as
 * instructions where the editor must replace it. Every layout passes the
 * publish checks as-is (CNT-12) — `starter-layouts.spec.ts` holds them to it —
 * which is why none has a block that needs an image: a starter must never be
 * the reason a new page can't be published.
 */

// Blocks are typed loosely (`api` can't import cms-blocks' types), so a
// misspelled optional prop wouldn't be caught here or by the publish checks;
// the spec at least holds every layout to registry types and required fields.
export type StarterLayout = {
  key: string;
  name: string;
  description: string;
  blocks: ({ type: string } & Record<string, unknown>)[];
};

export const STARTER_LAYOUTS: StarterLayout[] = [
  {
    key: 'landing',
    name: 'Landing',
    description:
      'A headline, three strengths, a few numbers, a quote and a call to action.',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'A short line about who you are',
        headline: 'Say what you do in one clear sentence',
        body: 'Follow it with a sentence or two about who it’s for and why it matters to them.',
        primaryAction: { label: 'Get in touch', href: '/contact' },
        secondaryAction: { label: 'Learn more', href: '/about' },
      },
      {
        type: 'featureGrid',
        heading: 'Why people choose us',
        intro:
          'Three reasons, each in a few words, with a sentence to back it up.',
        items: [
          {
            title: 'First strength',
            body: 'Describe what you do well and what it means for your customer.',
          },
          {
            title: 'Second strength',
            body: 'Keep it concrete: a number, a promise or a way of working.',
          },
          {
            title: 'Third strength',
            body: 'Finish with the reason that sets you apart from the rest.',
          },
        ],
      },
      {
        type: 'stats',
        heading: 'In numbers',
        // `00` so nobody publishes a figure they never checked.
        items: [
          { label: 'Your first number', value: '00' },
          { label: 'Your second number', value: '00' },
          { label: 'Your third number', value: '00' },
          { label: 'Your fourth number', value: '00' },
        ],
      },
      {
        type: 'testimonial',
        quote:
          'Put a short quote from a happy customer here. One or two sentences works best.',
        attribution: 'Customer name',
        role: 'Their role or company',
      },
      {
        type: 'cta',
        heading: 'Ready to talk?',
        body: 'Tell visitors the one thing you want them to do next.',
        action: { label: 'Get in touch', href: '/contact' },
      },
    ],
  },
  {
    key: 'about',
    name: 'About',
    description: 'Your story, the people behind it and a word from a customer.',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'About us',
        headline: 'The story behind the business',
        body: 'A sentence on how you started and what you still care about.',
      },
      {
        type: 'richText',
        heading: 'How we got here',
        html: '<p>Tell your story in a few short paragraphs: where you began, what you learned, and what you do differently today.</p><p>Keep it personal. Visitors read this page to decide whether they trust you.</p>',
      },
      {
        type: 'teamGrid',
        heading: 'The team',
        intro: 'The people your customers will work with.',
        members: [
          { name: 'Team member name', role: 'Their role' },
          { name: 'Team member name', role: 'Their role' },
          { name: 'Team member name', role: 'Their role' },
          { name: 'Team member name', role: 'Their role' },
        ],
      },
      {
        type: 'testimonial',
        quote: 'A short quote from a customer about working with your team.',
        attribution: 'Customer name',
        role: 'Their role or company',
      },
    ],
  },
  {
    key: 'contact',
    name: 'Contact',
    description:
      'A short welcome, a contact form and answers to common questions.',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'Contact',
        headline: 'Get in touch',
        body: 'Say how quickly you reply and the best way to reach you.',
      },
      {
        type: 'contactForm',
        heading: 'Send us a message',
        intro: 'Say how quickly you reply, so people know what to expect.',
        submitLabel: 'Send message',
        fields: [
          {
            name: 'name',
            label: 'Your name',
            fieldType: 'text',
            required: true,
          },
          {
            name: 'email',
            label: 'Email address',
            fieldType: 'email',
            required: true,
          },
          {
            name: 'message',
            label: 'How can we help?',
            fieldType: 'textarea',
            required: true,
          },
        ],
      },
      {
        type: 'faq',
        heading: 'Before you write',
        items: [
          {
            question: 'A question customers often ask',
            answer: 'A short, direct answer.',
          },
          {
            question: 'Another common question',
            answer: 'Answer it here so fewer people need to write in.',
          },
        ],
      },
    ],
  },
  {
    key: 'article',
    name: 'Article',
    description:
      'A title, a long piece of writing and a call to action at the end.',
    blocks: [
      {
        type: 'hero',
        eyebrow: 'News',
        headline: 'Your article title',
        body: 'A one-sentence summary that tells readers what they’ll learn.',
      },
      {
        type: 'richText',
        html: '<p>Start with the most important point. Readers decide in the first few lines whether to keep going.</p><h2>A subheading</h2><p>Break longer pieces into sections with subheadings, and keep paragraphs short.</p>',
      },
      {
        type: 'cta',
        heading: 'Want to know more?',
        body: 'Point readers to the next step.',
        action: { label: 'Contact us', href: '/contact' },
      },
    ],
  },
];
