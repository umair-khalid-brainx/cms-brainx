import { apiGet, apiSend } from './api';
import { getSession } from './auth';
import { fromServer, toPayload, type Menu } from './menuEditor';

export type MenuLocation = 'header' | 'footer';

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');
  return token;
}

export async function getMenu(location: MenuLocation): Promise<Menu> {
  const body = await apiGet<{ items: Parameters<typeof fromServer>[0] }>(`/menus/${location}`, requireToken());
  return fromServer(body.items);
}

/**
 * Saves the whole menu (GOV-03): what is stored is exactly this tree, or, if anything is refused, nothing
 * changes. Returns the menu as stored, with the pages' current titles and statuses.
 */
export async function saveMenu(location: MenuLocation, menu: Menu): Promise<Menu> {
  const body = await apiSend<{ items: Parameters<typeof fromServer>[0] }>('PUT', `/menus/${location}`, toPayload(menu), requireToken());
  return fromServer(body.items);
}
