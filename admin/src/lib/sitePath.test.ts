import { describe, expect, it } from 'vitest'
import { scoped } from './sitePath'

const BASE = '/sites/s1'

describe('scoped (MSI-03)', () => {
  it('puts the site in front of an in-site path', () => {
    expect(scoped('/pages', BASE)).toBe('/sites/s1/pages')
    expect(scoped('/editor/home?x=1', BASE)).toBe('/sites/s1/editor/home?x=1')
    expect(scoped({ pathname: '/pages', search: '?a=1' }, BASE)).toEqual({ pathname: '/sites/s1/pages', search: '?a=1' })
  })

  it('leaves pages outside a site alone', () => {
    for (const path of ['/login', '/lost-password', '/reset-password?token=t', '/accept-invite', '/sites', '/account'])
      expect(scoped(path, BASE)).toBe(path)
  })

  it('never prefixes twice, and leaves relative paths alone', () => {
    expect(scoped('/sites/s1/pages', BASE)).toBe('/sites/s1/pages')
    expect(scoped('dashboard', BASE)).toBe('dashboard')
  })

  it('does not mistake an in-site path that merely starts with those letters for an outside one', () => {
    expect(scoped('/sitesettings', BASE)).toBe('/sites/s1/sitesettings')
    expect(scoped('/accounts', BASE)).toBe('/sites/s1/accounts')
  })
})
