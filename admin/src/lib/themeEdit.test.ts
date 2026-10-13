import { describe, expect, it } from 'vitest'
import { COLOUR_FIELDS, THEME_PRESETS, contrastProblems, contrastRatio, drawable, isHex, presetOf, sameTheme } from './themeEdit'

const oyster = THEME_PRESETS[0].theme

describe('theme presets', () => {
  it('are all readable and have every colour as a whole hex', () => {
    for (const preset of THEME_PRESETS) {
      expect(contrastProblems(preset.theme), preset.name).toEqual([])
      for (const { key } of COLOUR_FIELDS) expect(isHex(preset.theme.palette[key]), `${preset.name} ${key}`).toBe(true)
    }
  })
})

describe('contrast', () => {
  it('measures black on white as 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('warns, in words, when text sits on its own colour', () => {
    const bad = { ...oyster, palette: { ...oyster.palette, onBrand: oyster.palette.brand } }
    expect(contrastProblems(bad)).toEqual(['Text on the brand colour is hard to read. Pick a text colour that stands out from Brand.'])
  })

  it('stays quiet while a colour is half typed', () => {
    expect(contrastProblems({ ...oyster, palette: { ...oyster.palette, ink: '#12' } })).toEqual([])
  })
})

describe('presetOf / sameTheme', () => {
  it('finds the preset a theme is exactly, ignoring hex case, and none once changed', () => {
    const upper = { ...oyster, palette: { ...oyster.palette, brand: oyster.palette.brand.toUpperCase() } }
    expect(presetOf(upper)?.id).toBe('oyster')
    expect(presetOf({ ...oyster, shape: 'sharp' })).toBeUndefined()
    expect(sameTheme(oyster, { ...oyster, texture: 'grid' })).toBe(false)
  })
})

describe('drawable', () => {
  it('keeps the last whole colour for any that is half typed', () => {
    const half = { ...oyster, palette: { ...oyster.palette, brand: '#2E4' } }
    expect(drawable(half, oyster).palette.brand).toBe(oyster.palette.brand)
  })
})
