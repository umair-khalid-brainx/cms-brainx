import { STARTER_LAYOUTS } from '../../prisma/starter-layouts.js';
import { BLOCK_LABELS, checkPublishable } from '../content/publish-checks.js';

describe('STARTER_LAYOUTS (TYP-05)', () => {
  it('has the four agreed layouts, with unique keys', () => {
    expect(STARTER_LAYOUTS.map((l) => l.key)).toEqual([
      'landing',
      'about',
      'contact',
      'article',
    ]);
  });

  it('uses only block types from the registry', () => {
    const known = new Set(Object.keys(BLOCK_LABELS));
    for (const layout of STARTER_LAYOUTS) {
      for (const block of layout.blocks)
        expect(known, `${layout.key}: ${block.type}`).toContain(block.type);
    }
  });

  // A page made from a starter must be publishable straight away — the
  // starter should never be why "Publish" is refused (CNT-12).
  it.each(STARTER_LAYOUTS.map((l) => [l.key, l] as const))(
    '%s passes the publish checks with no warnings',
    (_key, layout) => {
      expect(checkPublishable(layout.blocks)).toEqual({
        errors: [],
        warnings: [],
      });
    },
  );
});
