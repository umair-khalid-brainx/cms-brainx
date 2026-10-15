import { apiGet, apiSend } from './api';
import { getSession } from './auth';
import { fromServer, toPayload, type Menu } from './menuEditor';

export type MenuLocation = 'header' | 'footer';

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');
  return token;
}

/** `presetId` names a saved header or footer; without it, the site's own menu. */
const path = (location: MenuLocation, presetId: string | null) => `/menus/${location}${presetId ? `?preset=${encodeURIComponent(presetId)}` : ''}`;

export async function getMenu(location: MenuLocation, presetId: string | null = null): Promise<Menu> {
  const body = await apiGet<{ items: Parameters<typeof fromServer>[0] }>(path(location, presetId), requireToken());
  return fromServer(body.items);
}

/**
 * Saves the whole menu (GOV-03): what is stored is exactly this tree, or, if anything is refused, nothing
 * changes. Returns the menu as stored, with the pages' current titles and statuses.
 */
export async function saveMenu(location: MenuLocation, menu: Menu, presetId: string | null = null): Promise<Menu> {
  const body = await apiSend<{ items: Parameters<typeof fromServer>[0] }>('PUT', path(location, presetId), toPayload(menu), requireToken());
  return fromServer(body.items);
}
