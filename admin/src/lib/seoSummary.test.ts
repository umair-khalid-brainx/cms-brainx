import { describe, expect, it } from 'vitest'
import { EMPTY_SEO } from './seo'
import { seoSummary } from './seoSummary'

describe('seoSummary', () => {
  it('is empty when nothing is set', () => {
    expect(seoSummary(EMPTY_SEO)).toEqual({ lines: [], empty: true })
  })
  it('lists only the filled fields, trimmed', () => {
    const { lines, empty } = seoSummary({ ...EMPTY_SEO, metaTitle: '  Hello ', ogTitle: '   ' })
    expect(empty).toBe(false)
    expect(lines).toEqual([{ label: 'Search title', value: 'Hello' }])
  })
  it('says when the page is hidden from search engines', () => {
    expect(seoSummary({ ...EMPTY_SEO, noindex: true }).lines).toEqual([{ label: 'Search engines', value: 'Hidden from search engines' }])
  })
})
