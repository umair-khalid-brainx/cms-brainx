import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getActiveMembership, preferredSiteId, setActiveSiteId, siteBase } from './activeSite'
import { canCreateSite } from './roles'

const memberships = [
  { siteId: 'a', siteName: 'A', siteSubdomain: 'a', role: 'viewer' },
  { siteId: 'b', siteName: 'B', siteSubdomain: 'b', role: 'owner' },
]

function stubStorage(extra: Record<string, string> = {}) {
  const store: Record<string, string> = {
    'cms-admin.session': JSON.stringify({ accessToken: 't', user: { id: 'u', email: 'e', name: 'n' }, memberships }),
    ...extra,
  }
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => void (store[key] = value),
    removeItem: (key: string) => void delete store[key],
  } as Storage
}

describe('active site (MSI-03)', () => {
  beforeEach(() => stubStorage())
  afterEach(() => setActiveSiteId(null))

  it('uses the membership of the site in the address, with that site’s role', () => {
    setActiveSiteId('b')
    expect(getActiveMembership()).toMatchObject({ siteId: 'b', role: 'owner' })
    setActiveSiteId('a')
    expect(getActiveMembership()?.role).toBe('viewer')
  })

  it('falls back to the first membership when none (or an unknown site) is active', () => {
    expect(getActiveMembership()?.siteId).toBe('a')
    setActiveSiteId('zzz')
    expect(getActiveMembership()?.siteId).toBe('a')
  })

  it('lands on the last site used if still a member, else the first', () => {
    expect(preferredSiteId()).toBe('a')
    stubStorage({ 'cms-admin.lastSite': 'b' })
    expect(preferredSiteId()).toBe('b')
    stubStorage({ 'cms-admin.lastSite': 'removed-site' })
    expect(preferredSiteId()).toBe('a')
  })

  it('builds the in-site prefix', () => {
    setActiveSiteId('b')
    expect(siteBase()).toBe('/sites/b')
  })
})

describe('canCreateSite (MSI-04)', () => {
  it('is true only for someone who owns a site', () => {
    expect(canCreateSite([{ role: 'viewer' }, { role: 'owner' }])).toBe(true)
    expect(canCreateSite([{ role: 'administrator' }, { role: 'editor' }])).toBe(false)
    expect(canCreateSite([])).toBe(false)
    expect(canCreateSite(undefined)).toBe(false)
  })
})
