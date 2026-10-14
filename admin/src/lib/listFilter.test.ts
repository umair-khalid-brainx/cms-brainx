import { describe, expect, it } from 'vitest'
import { filterRows, statusCounts, updatedLabel } from './listFilter'

const rows = [
  { title: 'About us', path: '/about', status: 'published' as const },
  { title: 'Our team', path: '/about/team', status: 'draft' as const },
  { title: 'Harvest Log', path: '/news/harvest-log', status: 'published' as const },
]

describe('filterRows', () => {
  it('matches every word against title or path, in any case', () => {
    expect(filterRows(rows, 'ABOUT team', 'all').map((r) => r.title)).toEqual(['Our team'])
    expect(filterRows(rows, 'news', 'all').map((r) => r.title)).toEqual(['Harvest Log'])
  })
  it('combines with the status filter', () => {
    expect(filterRows(rows, '', 'published')).toHaveLength(2)
    expect(filterRows(rows, 'about', 'draft').map((r) => r.title)).toEqual(['Our team'])
  })
  it('returns everything for an empty query', () => {
    expect(filterRows(rows, '  ', 'all')).toHaveLength(3)
  })
})

describe('statusCounts', () => {
  it('counts per status', () => {
    expect(statusCounts(rows)).toMatchObject({ all: 3, published: 2, draft: 1, in_review: 0 })
  })
})

describe('updatedLabel', () => {
  const now = new Date('2026-10-14T12:00:00')
  it('says today, yesterday and days ago', () => {
    expect(updatedLabel('2026-10-14T08:00:00', now)).toBe('Today')
    expect(updatedLabel('2026-10-13T23:00:00', now)).toBe('Yesterday')
    expect(updatedLabel('2026-10-11T10:00:00', now)).toBe('3 days ago')
  })
  it('falls back to a date, and to empty', () => {
    expect(updatedLabel('2026-08-01T10:00:00', now)).toBe('1 Aug')
    expect(updatedLabel('', now)).toBe('')
  })
})
