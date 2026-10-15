import { apiDelete, apiGet, apiSend } from './api';
import { getSession } from './auth';
import type { MenuLocation } from './menusApi';

/** A saved header or footer a page can pick instead of the site's own. */
export type ChromePreset = {
  id: string;
  location: MenuLocation;
  name: string;
  /** Headers: shown beside the name; logo is a library path. Empty means the site's own. */
  tagline: string;
  logo: string;
  /** Footers: the note under the name, and the line at the very bottom. Empty means the site's own. */
  note: string;
  bottomText: string;
  /** How many pages and entries use it. */
  usedBy: number;
};

/** What a page shows for the header or footer: the site's own, nothing, or a saved one's id. */
export const DEFAULT_CHOICE = 'default';
export const HIDDEN_CHOICE = 'hidden';
export type PageChrome = { header: string; footer: string };
export const EMPTY_CHROME: PageChrome = { header: DEFAULT_CHOICE, footer: DEFAULT_CHOICE };

/** A stored choice read back: anything missing or malformed is the site's own. */
export function readChrome(value: unknown): PageChrome {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const part = (key: MenuLocation) => (typeof record[key] === 'string' && record[key] !== '' ? (record[key] as string) : DEFAULT_CHOICE);
  return { header: part('header'), footer: part('footer') };
}

export const sameChrome = (a: PageChrome, b: PageChrome) => a.header === b.header && a.footer === b.footer;

/** The API's limits (api/src/chrome/chrome-rules.ts; the repos can't share code, so keep these in step). */
export const PRESET_NAME_MAX = 60;
export const BOTTOM_TEXT_MAX = 200;

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');
  return token;
}

export const listPresets = () => apiGet<ChromePreset[]>('/chrome-presets', requireToken());

/** New ones start with a copy of the site's own links, so a new header is never an empty bar. */
export const createPreset = (location: MenuLocation, name: string) =>
  apiSend<ChromePreset>('POST', '/chrome-presets', { location, name }, requireToken());

export const updatePreset = (id: string, changes: Partial<Pick<ChromePreset, 'name' | 'tagline' | 'logo' | 'note' | 'bottomText'>>) =>
  apiSend<ChromePreset>('PATCH', `/chrome-presets/${id}`, changes, requireToken());

export const deletePreset = (id: string) => apiDelete(`/chrome-presets/${id}`, requireToken());

/** The choices a page can make for one part, in the order the picker shows them. */
export function choiceOptions(presets: readonly ChromePreset[], location: MenuLocation): { value: string; label: string }[] {
  const what = location === 'header' ? 'header' : 'footer';
  return [
    { value: DEFAULT_CHOICE, label: `Site ${what} (default)` },
    ...presets.filter((preset) => preset.location === location).map((preset) => ({ value: preset.id, label: preset.name })),
    { value: HIDDEN_CHOICE, label: `No ${what} on this page` },
  ];
}
