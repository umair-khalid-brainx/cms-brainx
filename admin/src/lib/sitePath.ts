import type { To } from 'react-router'

// In-site screens write their links as `/pages`, `/editor/home`: the path *within* a site. `scoped` puts the
// site in front (`/sites/<id>/pages`), so no screen builds that prefix by hand and none can forget it (MSI-03).
// Anything that isn't a site screen (login, the all-sites and account pages, an already-prefixed path) is left alone.
const OUTSIDE_A_SITE = /^\/(login|lost-password|reset-password|accept-invite|sites|account)(?=[/?#]|$)/

export function scoped(to: To, base: string): To {
  if (typeof to === 'string') return to.startsWith('/') && !OUTSIDE_A_SITE.test(to) ? base + to : to
  if (to.pathname?.startsWith('/') && !OUTSIDE_A_SITE.test(to.pathname)) return { ...to, pathname: base + to.pathname }
  return to
}
