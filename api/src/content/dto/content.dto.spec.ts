import { createContentSchema } from './content.dto.js';

describe('createContentSchema layout (TYP-04)', () => {
  it('accepts a layout key, or none', () => {
    expect(createContentSchema.parse({ title: 'x', layout: 'landing' }).layout).toBe('landing');
    expect(createContentSchema.parse({ title: 'x' }).layout).toBeUndefined();
  });

  it.each(['', 'a'.repeat(65), 5, null, ['landing'], { key: 'landing' }])('refuses %j', (layout) => {
    expect(createContentSchema.safeParse({ title: 'x', layout }).success).toBe(false);
  });
});
