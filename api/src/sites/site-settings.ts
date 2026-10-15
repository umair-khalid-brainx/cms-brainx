import { z } from 'zod';
import { optionalMediaValue } from '../content-types/field-values.js';

// What a site's public header and footer show besides its name (GOV-04), kept in `Site.settings`.
// The name itself stays its own column: it is what every site picker and page title uses.

export const SITE_NAME_MAX = 100;
export const TAGLINE_MAX = 120;
export const FOOTER_NOTE_MAX = 400;
export const BOTTOM_TEXT_MAX = 200;

export type SiteSettings = {
  tagline: string;
  footerNote: string;
  /** The line at the very bottom of the footer; `{year}` becomes the current year. Empty: "© <year> <site name>". */
  footerBottom: string;
  /** A picture in this site's media library (`/uploads/<site>/<file>`), or empty. */
  logo: string;
};

export const EMPTY_SETTINGS: SiteSettings = { tagline: '', footerNote: '', footerBottom: '', logo: '' };

/** The rules for one site's settings: every part optional, and the logo a file of its own library. */
export function updateSettingsSchema(siteId: string) {
  const text = (max: number, what: string) => z.string().trim().max(max, `${what} can be at most ${max} characters.`);
  return z
    .object({
      name: z.string().trim().min(1, 'The site title can’t be empty.').max(SITE_NAME_MAX, `The site title can be at most ${SITE_NAME_MAX} characters.`).optional(),
      tagline: text(TAGLINE_MAX, 'The tagline').optional(),
      footerNote: text(FOOTER_NOTE_MAX, 'The footer note').optional(),
      footerBottom: text(BOTTOM_TEXT_MAX, 'The footer bottom line').optional(),
      logo: optionalMediaValue(siteId).optional(),
    })
    .refine((body) => Object.values(body).some((value) => value !== undefined), { message: 'Provide at least one setting to change' });
}

export type UpdateSettingsDto = z.infer<ReturnType<typeof updateSettingsSchema>>;

/** A stored value read back: anything missing or malformed counts as empty. */
export function readSettings(stored: unknown): SiteSettings {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return EMPTY_SETTINGS;
  const record = stored as Record<string, unknown>;
  const text = (key: keyof SiteSettings) => (typeof record[key] === 'string' ? (record[key] as string) : '');
  return { tagline: text('tagline'), footerNote: text('footerNote'), footerBottom: text('footerBottom'), logo: text('logo') };
}
