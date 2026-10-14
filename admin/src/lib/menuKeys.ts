// Keyboard rules shared by Menu and Select (ADM-03), kept pure so they are tested without a DOM.
// Items that are disabled stay in the list (so people can see why) but are skipped by the keys.

export type NavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

/** The index the focus moves to for an arrow/Home/End key, or `current` when nothing can take it. */
export function moveIndex(key: NavKey, current: number, disabled: boolean[]): number {
  const count = disabled.length
  if (count === 0 || disabled.every(Boolean)) return -1
  const step = (from: number, dir: 1 | -1) => {
    let i = from
    for (let n = 0; n < count; n++) {
      i = (i + dir + count) % count
      if (!disabled[i]) return i
    }
    return current
  }
  if (key === 'Home') return disabled.findIndex((d) => !d)
  if (key === 'End') return disabled.length - 1 - [...disabled].reverse().findIndex((d) => !d)
  if (current < 0) return key === 'ArrowDown' ? step(-1, 1) : step(0, -1)
  return step(current, key === 'ArrowDown' ? 1 : -1)
}

/** Type-ahead: the next enabled label starting with `typed`, searching on from `current`; -1 if none. */
export function typeAheadIndex(typed: string, current: number, labels: string[], disabled: boolean[]): number {
  const needle = typed.toLowerCase()
  if (!needle) return -1
  const count = labels.length
  // Typing one letter again cycles to the next match; typing a longer prefix stays on a match.
  const start = needle.length === 1 ? current + 1 : Math.max(current, 0)
  for (let n = 0; n < count; n++) {
    const i = (start + n) % count
    if (!disabled[i] && labels[i].toLowerCase().startsWith(needle)) return i
  }
  return -1
}

export type Placement = { top: number; left: number; minWidth: number; maxHeight: number; up: boolean }

/** Where a popup goes relative to its trigger: below if it fits, above if not, nudged to stay on screen. */
export function placePopup(
  trigger: { top: number; bottom: number; left: number; right: number; width: number },
  popup: { width: number; height: number },
  viewport: { width: number; height: number },
  align: 'start' | 'end' = 'start',
  gap = 6,
  margin = 8,
): Placement {
  const below = viewport.height - trigger.bottom - gap - margin
  const above = trigger.top - gap - margin
  const up = popup.height > below && above > below
  const room = up ? above : below
  const height = Math.min(popup.height, Math.max(room, 120))
  const top = up ? trigger.top - gap - height : trigger.bottom + gap
  const width = Math.max(popup.width, trigger.width)
  let left = align === 'end' ? trigger.right - width : trigger.left
  left = Math.min(Math.max(left, margin), Math.max(viewport.width - width - margin, margin))
  return { top, left, minWidth: trigger.width, maxHeight: Math.max(room, 120), up }
}
