/** The page settings panel's collapsible groups (ADM-07), in the order they appear. */
export const SECTION_IDS = ['general', 'url', 'seo', 'chrome', 'terms', 'publishing'] as const
export type SectionId = (typeof SECTION_IDS)[number]

/**
 * The open groups after a header is pressed. With `single` (small screens) opening one closes the rest, so the
 * panel never becomes one very long scroll; otherwise each group toggles on its own.
 */
export function toggleSection(open: readonly SectionId[], id: SectionId, single: boolean): SectionId[] {
  if (open.includes(id)) return open.filter((value) => value !== id)
  return single ? [id] : [...open, id]
}

/** On entering single mode, keeps only the first open group (a list can't stay several-open there). */
export function collapseToOne(open: readonly SectionId[]): SectionId[] {
  return open.slice(0, 1)
}
