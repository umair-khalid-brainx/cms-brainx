import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/**
 * The site a request is acting on, taken from the `X-Site-Id` header (MSI-01).
 * Held per request so the services' membership lookup can read it without every
 * method growing a parameter. Absent header → the caller's first membership.
 * The header is only a *request*: the lookup still checks the caller belongs to
 * that site, so a forged id is a 403, never another tenant's data.
 */
const store = new AsyncLocalStorage<{ siteId?: string }>();

export const SITE_ID_HEADER = 'x-site-id';

export function requestedSiteId(): string | undefined {
  return store.getStore()?.siteId;
}

export function activeSiteMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.headers[SITE_ID_HEADER];
  const siteId = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  store.run({ siteId }, next);
}
