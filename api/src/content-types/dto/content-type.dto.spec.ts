import { createContentTypeSchema, updateContentTypeSchema } from './content-type.dto.js';

describe('content type DTOs', () => {
  it('trims names, drops NUL characters and refuses blank ones', () => {
    expect(createContentTypeSchema.parse({ name: '  Ev\u0000ents ', singularName: 'Event', prefix: ' events ' })).toEqual({
      name: 'Events',
      singularName: 'Event',
      prefix: 'events',
    });
    expect(createContentTypeSchema.safeParse({ name: '\u0000', singularName: 'x', prefix: 'xx' }).success).toBe(false);
    expect(createContentTypeSchema.safeParse({ name: '   ', singularName: 'x', prefix: 'xx' }).success).toBe(false);
  });

  it('leaves an uppercase address as typed so the rules can refuse it', () => {
    expect(createContentTypeSchema.parse({ name: 'A', singularName: 'A', prefix: 'Events' }).prefix).toBe('Events');
  });

  it('refuses an empty update, non-strings and over-long names', () => {
    expect(updateContentTypeSchema.safeParse({}).success).toBe(false);
    expect(updateContentTypeSchema.safeParse({ name: 5 }).success).toBe(false);
    expect(createContentTypeSchema.safeParse({ name: 'a'.repeat(61), singularName: 'x', prefix: 'xx' }).success).toBe(false);
  });
});

describe('content type opt-ins (TAX-01)', () => {
  it('accepts hasCategories and hasTags on create and update, and defaults to leaving them out', () => {
    expect(createContentTypeSchema.parse({ name: 'Events', singularName: 'Event', prefix: 'events' })).not.toHaveProperty('hasTags');
    expect(createContentTypeSchema.parse({ name: 'Events', singularName: 'Event', prefix: 'events', hasTags: true }).hasTags).toBe(true);
    expect(updateContentTypeSchema.parse({ hasCategories: false }).hasCategories).toBe(false);
  });

  it('refuses a non-boolean', () => {
    expect(updateContentTypeSchema.safeParse({ hasTags: 'yes' }).success).toBe(false);
  });
});
