import { updateMediaSchema } from './media.dto.js';

describe('updateMediaSchema', () => {
  it('trims, and turns a blank box into null so it clears the field', () => {
    expect(updateMediaSchema.parse({ alt: '  Oysters  ', title: '', description: '   ' })).toEqual({
      alt: 'Oysters',
      title: null,
      description: null,
    });
  });

  it('keeps only the fields it knows, so nothing else can be written', () => {
    expect(updateMediaSchema.parse({ title: 'x', siteId: 'other', url: 'http://evil', mimetype: 'text/html' })).toEqual({
      title: 'x',
    });
  });

  it.each([{}, { siteId: 'other' }, { alt: null }, { alt: 123 }, { title: ['x'] }, 'text', null])(
    'refuses %j',
    (body) => {
      expect(updateMediaSchema.safeParse(body).success).toBe(false);
    },
  );

  it('enforces the length limits after trimming', () => {
    expect(updateMediaSchema.safeParse({ alt: 'a'.repeat(500) }).success).toBe(true);
    expect(updateMediaSchema.safeParse({ alt: 'a'.repeat(501) }).success).toBe(false);
    expect(updateMediaSchema.safeParse({ title: `${'a'.repeat(200)}   ` }).success).toBe(true);
    expect(updateMediaSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false);
    expect(updateMediaSchema.safeParse({ description: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('removes a NUL character, which the database would reject with a 500', () => {
    expect(updateMediaSchema.parse({ title: 'a\u0000b', description: '\u0000' })).toEqual({ title: 'ab', description: null });
  });
});
