import { describe, expect, it } from 'vitest'
import { collapseToOne, toggleSection } from './settingsSections'

describe('toggleSection', () => {
  it('opens a closed group next to the others on a wide screen', () => {
    expect(toggleSection(['general'], 'seo', false)).toEqual(['general', 'seo'])
  })
  it('closes an open group', () => {
    expect(toggleSection(['general', 'seo'], 'seo', false)).toEqual(['general'])
    expect(toggleSection(['seo'], 'seo', true)).toEqual([])
  })
  it('opens only that group on a small screen', () => {
    expect(toggleSection(['general'], 'seo', true)).toEqual(['seo'])
  })
})

describe('collapseToOne', () => {
  it('keeps the first open group', () => {
    expect(collapseToOne(['url', 'seo'])).toEqual(['url'])
    expect(collapseToOne([])).toEqual([])
  })
})
