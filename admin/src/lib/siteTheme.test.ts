import { describe, expect, it } from 'vitest'
import { readSiteTheme } from './siteTheme'

const kestrel = {
  typeSet: 'technical',
  shape: 'sharp',
  density: 'tight',
  texture: 'grid',
  palette: { paper: '#0E1116', surface: '#171C23', ink: '#E6EAEF', muted: '#8E9AAA', line: '#2A323C', brand: '#FF6B1A', onBrand: '#100A05', accent: '#F2C230' },
}

describe('readSiteTheme (B-16)', () => {
  it('takes a whole stored theme as it is', () => {
    expect(readSiteTheme(kestrel)).toEqual(kestrel)
  })

  it('refuses an empty, partial or unknown theme, so the canvas falls back instead of half-styling', () => {
    expect(readSiteTheme({})).toBeNull()
    expect(readSiteTheme(null)).toBeNull()
    expect(readSiteTheme({ ...kestrel, shape: 'round' })).toBeNull()
    expect(readSiteTheme({ ...kestrel, palette: { ...kestrel.palette, brand: undefined } })).toBeNull()
  })
})
