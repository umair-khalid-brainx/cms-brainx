import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BLOCK_LABELS, checkPublishable } from './publish-checks.js';

const fields = (checks: ReturnType<typeof checkPublishable>['errors']) =>
  checks.map((p) => `${p.blockIndex}:${p.field}`);

describe('checkPublishable', () => {
  it('refuses a page with no blocks', () => {
    const { errors } = checkPublishable([]);
    expect(errors).toEqual([
      expect.objectContaining({
        blockIndex: null,
        message: 'Add at least one block',
      }),
    ]);
  });

  it('passes a complete page with no warnings', () => {
    const result = checkPublishable([
      {
        type: 'hero',
        headline: 'Hello',
        primaryAction: { label: 'Go', href: '/go' },
      },
      { type: 'richText', html: '<p>Body</p>' },
      { type: 'spacer', size: 'md' },
      {
        type: 'cta',
        heading: 'Ready?',
        action: { label: 'Start', href: '#start' },
      },
    ]);
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it('flags blank required text, including rich text that is only tags', () => {
    const { errors } = checkPublishable([
      { type: 'hero', headline: '   ' },
      { type: 'richText', html: '<p>&nbsp;</p>' },
      { type: 'testimonial', quote: 'Great', attribution: '' },
    ]);
    expect(fields(errors)).toEqual(['0:headline', '1:html', '2:attribution']);
    expect(errors[0]).toMatchObject({
      blockType: 'hero',
      blockLabel: 'Hero',
      message: 'Add a headline',
    });
  });

  it('treats an untouched optional link as absent, but a half-filled one as broken', () => {
    const { errors } = checkPublishable([
      {
        type: 'hero',
        headline: 'Hi',
        primaryAction: { label: '', href: '' },
        secondaryAction: { label: 'More', href: '' },
      },
    ]);
    expect(fields(errors)).toEqual(['0:secondaryAction.href']);
  });

  it('requires a required link in full', () => {
    const { errors } = checkPublishable([
      { type: 'cta', heading: 'Go', action: { label: '', href: '' } },
    ]);
    expect(errors).toEqual([
      expect.objectContaining({
        field: 'action',
        message: 'Add text and a link to the button',
      }),
    ]);
  });

  it('flags missing images, and only warns about missing alt text', () => {
    const result = checkPublishable([
      {
        type: 'imageText',
        heading: 'H',
        body: 'B',
        image: { src: '', alt: '' },
        imagePosition: 'left',
      },
      {
        type: 'gallery',
        images: [
          { src: '/a.jpg', alt: '' },
          { src: '/b.jpg', alt: 'B' },
        ],
      },
    ]);
    expect(fields(result.errors)).toEqual(['0:image.src']);
    expect(fields(result.warnings)).toEqual(['1:images.0.alt']);
  });

  it('flags empty lists and incomplete items', () => {
    const { errors } = checkPublishable([
      { type: 'faq', items: [] },
      { type: 'stats', items: [{ label: 'Farms', value: '' }] },
      {
        type: 'pricingTable',
        plans: [
          {
            name: 'Pro',
            price: '£9',
            features: [],
            action: { label: 'Buy', href: '' },
          },
        ],
      },
      { type: 'contactForm', submitLabel: 'Send', fields: [] },
    ]);
    expect(fields(errors)).toEqual([
      '0:items',
      '1:items.0.value',
      '2:plans.0.action.href',
      '3:fields',
    ]);
  });

  it('refuses a block type it has no rule for', () => {
    const { errors } = checkPublishable([
      { type: 'embed', url: 'https://example.com' },
    ]);
    expect(errors).toEqual([
      expect.objectContaining({
        blockIndex: 0,
        blockType: 'embed',
        field: null,
      }),
    ]);
  });

  // `api` can't import cms-blocks, so this is what keeps the two lists in
  // step: a new block type in the shared contract fails here until it has a
  // publish rule (D-036).
  it('has a rule for every block type in cms-blocks/src/types.ts', () => {
    const contract = readFileSync(
      resolve(__dirname, '../../../cms-blocks/src/types.ts'),
      'utf8',
    );
    const contractTypes = [...contract.matchAll(/^\s+type: '(\w+)';$/gm)]
      .map((m) => m[1])
      .sort();
    expect(contractTypes.length).toBeGreaterThan(0);
    expect(Object.keys(BLOCK_LABELS).sort()).toEqual(contractTypes);
  });
});
