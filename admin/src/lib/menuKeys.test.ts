import { describe, expect, it } from 'vitest'
import { moveIndex, placePopup, typeAheadIndex } from './menuKeys'

describe('moveIndex', () => {
  const disabled = [false, true, false, false]
  it('skips disabled items and wraps', () => {
    expect(moveIndex('ArrowDown', 0, disabled)).toBe(2)
    expect(moveIndex('ArrowDown', 3, disabled)).toBe(0)
    expect(moveIndex('ArrowUp', 0, disabled)).toBe(3)
    expect(moveIndex('ArrowUp', 2, disabled)).toBe(0)
  })
  it('Home and End land on the first and last enabled item', () => {
    expect(moveIndex('Home', 3, [true, false, false, true])).toBe(1)
    expect(moveIndex('End', 0, [true, false, false, true])).toBe(2)
  })
  it('starts from the ends when nothing is focused', () => {
    expect(moveIndex('ArrowDown', -1, disabled)).toBe(0)
    expect(moveIndex('ArrowUp', -1, disabled)).toBe(3)
  })
  it('returns -1 when every item is disabled', () => {
    expect(moveIndex('ArrowDown', 0, [true, true])).toBe(-1)
  })
})

describe('typeAheadIndex', () => {
  const labels = ['Draft', 'Duplicate', 'Delete', 'Edit']
  it('cycles on a repeated first letter and skips disabled', () => {
    expect(typeAheadIndex('d', 0, labels, [false, false, false, false])).toBe(1)
    expect(typeAheadIndex('d', 1, labels, [false, false, true, false])).toBe(0)
  })
  it('keeps a longer prefix on the current match', () => {
    expect(typeAheadIndex('du', 1, labels, [false, false, false, false])).toBe(1)
    expect(typeAheadIndex('x', 0, labels, [false, false, false, false])).toBe(-1)
  })
})

describe('placePopup', () => {
  const trigger = { top: 100, bottom: 130, left: 50, right: 90, width: 40 }
  it('opens below when it fits', () => {
    const p = placePopup(trigger, { width: 160, height: 120 }, { width: 800, height: 600 })
    expect(p.up).toBe(false)
    expect(p.top).toBe(136)
  })
  it('flips above near the bottom edge', () => {
    const p = placePopup({ ...trigger, top: 560, bottom: 590 }, { width: 160, height: 200 }, { width: 800, height: 600 })
    expect(p.up).toBe(true)
    expect(p.top).toBeLessThan(560)
  })
  it('aligns to the end and stays on screen', () => {
    const p = placePopup(trigger, { width: 160, height: 100 }, { width: 800, height: 600 }, 'end')
    expect(p.left).toBe(8)
    const r = placePopup({ ...trigger, left: 780, right: 800 }, { width: 160, height: 100 }, { width: 800, height: 600 })
    expect(r.left).toBe(632)
  })
})
