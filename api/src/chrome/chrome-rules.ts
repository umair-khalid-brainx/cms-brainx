import { z } from 'zod';
import { optionalMediaValue } from '../content-types/field-values.js';
import { BOTTOM_TEXT_MAX, FOOTER_NOTE_MAX, TAGLINE_MAX } from '../sites/site-settings.js';
import { MENU_LOCATIONS, type MenuLocation } from '../menus/menu-tree.js';

// Which header and footer a page shows, and the saved ones it can pick from (pure rules, no database).
// A page's choice is `default` (the site's own), `hidden`, or the id of a saved header or footer.

export const PRESET_NAME_MAX = 60;
export const PER_LOCATION_MAX = 30;

export const DEFAULT_CHOICE = 'default';
export const HIDDEN_CHOICE = 'hidden';

export type ChromeChoice = { header: string; footer: string };

/** A stored choice read back: anything missing or malformed counts as the site's own. */
export function readChoice(stored: unknown): ChromeChoice {
  const record = typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const part = (key: MenuLocation) => (typeof record[key] === 'string' && record[key] !== '' ? (record[key] as string) : DEFAULT_CHOICE);
  return { header: part('header'), footer: part('footer') };
}

/** The body of a page save: either part may be left out, meaning unchanged. */
export const choiceSchema = z.object({ header: z.string().min(1).max(100).optional(), footer: z.string().min(1).max(100).optional() }).strict();

const text = (max: number, what: string) => z.string().trim().max(max, `${what} can be at most ${max} characters.`);
const name = z.string().trim().min(1, 'A saved header or footer needs a name.').max(PRESET_NAME_MAX, `A name can be at most ${PRESET_NAME_MAX} characters.`);

export const createPresetSchema = z.object({
  location: z.enum(MENU_LOCATIONS),
  name,
  /** Start with a copy of the site's own links, so a new one is never an empty bar. Default yes. */
  copyLinks: z.boolean().default(true),
});

export function updatePresetSchema(siteId: string) {
  return z
    .object({
      name: name.optional(),
      tagline: text(TAGLINE_MAX, 'The tagline').optional(),
      logo: optionalMediaValue(siteId).optional(),
      note: text(FOOTER_NOTE_MAX, 'The footer note').optional(),
      bottomText: text(BOTTOM_TEXT_MAX, 'The bottom line').optional(),
    })
    .strict()
    .refine((body) => Object.values(body).some((value) => value !== undefined), { message: 'Provide at least one setting to change' });
}

export type UpdatePresetDto = z.infer<ReturnType<typeof updatePresetSchema>>;

export type PresetFacts = { id: string; location: MenuLocation };

/** What a page's choice for one part turns into once saved presets are known. */
export type Resolved = { kind: 'hidden' } | { kind: 'default' } | { kind: 'preset'; id: string };

/** A deleted or foreign preset id falls back to the site's own rather than blanking the part. */
export function resolveChoice(choice: string, location: MenuLocation, presets: readonly PresetFacts[]): Resolved {
  if (choice === HIDDEN_CHOICE) return { kind: 'hidden' };
  const preset = presets.find((candidate) => candidate.id === choice && candidate.location === location);
  return preset ? { kind: 'preset', id: preset.id } : { kind: 'default' };
}

/** The text of the line at the very bottom: `{year}` becomes the current year, so a copyright line needn't be retyped yearly. */
export function bottomLine(text: string, siteName: string, year: number): string {
  const line = text.trim();
  return line === '' ? `© ${year} ${siteName}` : line.replaceAll('{year}', String(year));
}
