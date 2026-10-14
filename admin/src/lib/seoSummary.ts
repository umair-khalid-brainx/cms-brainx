import type { Seo } from './seo'

// A page's search settings said in a few plain lines for the read-only side panel (ADM-05). No new data: it reads the
// `seo` the list already carries.

export type SeoLine = { label: string; value: string }

/** The lines worth showing: only what was filled in, plus "Hidden from search engines" when noindex is on. */
export function seoSummary(seo: Seo): { lines: SeoLine[]; empty: boolean } {
  const lines: SeoLine[] = []
  const add = (label: string, value: string) => {
    if (value.trim()) lines.push({ label, value: value.trim() })
  }
  add('Search title', seo.metaTitle)
  add('Search description', seo.metaDescription)
  add('Canonical address', seo.canonicalUrl)
  add('Share title', seo.ogTitle)
  add('Share description', seo.ogDescription)
  add('Share image', seo.ogImage)
  if (seo.noindex) lines.push({ label: 'Search engines', value: 'Hidden from search engines' })
  return { lines, empty: lines.length === 0 }
}
