import type { PageStatus } from './contentApi'

// The Pages and Posts lists search and filter in the browser (ADM-04): a site's lists are short and already
// loaded, so no request is made per keystroke.

type Row = { title: string; path: string; status: PageStatus }

export type StatusFilter = 'all' | PageStatus

/** Rows whose title or path contains every word typed (any case), and whose status matches. */
export function filterRows<T extends Row>(rows: readonly T[], query: string, status: StatusFilter): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false
    const haystack = `${row.title} ${row.path}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

/** How many rows are in each status, for the filter's labels. */
export function statusCounts(rows: readonly Row[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: rows.length, draft: 0, published: 0, in_review: 0, scheduled: 0, archived: 0 }
  for (const row of rows) counts[row.status] += 1
  return counts
}

/** "Today", "Yesterday", "3 days ago", else "14 Oct" (with the year when it is not this one). */
export function updatedLabel(iso: string, now: Date = new Date()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }) })
}
