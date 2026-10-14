import type { Palette, SiteTheme } from 'cms-blocks'

// What the Theme card on Settings edits. The API checks everything again (api/src/sites/site-theme.ts); the
// repos can't share code, so the contrast rule and its wording are restated here and kept in step. Here they only
// give the live warning while someone is still choosing.

export type PaletteKey = keyof Palette

/** The 8 colours in the order they're shown, with the plain words and the one-line hint a client sees. */
export const COLOUR_FIELDS: { key: PaletteKey; label: string; hint: string }[] = [
  { key: 'paper', label: 'Background', hint: 'The page behind everything.' },
  { key: 'surface', label: 'Panel', hint: 'Cards and boxes that sit on the page.' },
  { key: 'ink', label: 'Text', hint: 'Headings and body copy.' },
  { key: 'muted', label: 'Secondary text', hint: 'Captions, dates and small print.' },
  { key: 'line', label: 'Lines', hint: 'Dividers and card borders.' },
  { key: 'brand', label: 'Brand', hint: 'Main buttons and links.' },
  { key: 'onBrand', label: 'Text on brand', hint: 'Words inside a brand-coloured button.' },
  { key: 'accent', label: 'Accent', hint: 'Used sparingly, for emphasis.' },
]

export const TYPE_SET_OPTIONS = [
  { value: 'editorial', label: 'Editorial', hint: 'Serif headings, friendly body' },
  { value: 'technical', label: 'Technical', hint: 'Narrow headings, mono details' },
] as const
export const SHAPE_OPTIONS = [
  { value: 'soft', label: 'Soft', hint: 'Rounded corners' },
  { value: 'sharp', label: 'Sharp', hint: 'Square corners' },
] as const
export const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable', hint: 'Generous space' },
  { value: 'tight', label: 'Tight', hint: 'More on screen' },
] as const
export const TEXTURE_OPTIONS = [
  { value: 'none', label: 'None', hint: 'Flat colour' },
  { value: 'grain', label: 'Grain', hint: 'Fine paper noise' },
  { value: 'grid', label: 'Grid', hint: 'Faint blueprint lines' },
] as const

export type ThemePreset = { id: string; name: string; note: string; theme: SiteTheme }

/** Starting points. The first two are the demo sites' own looks; anything can be changed after picking one. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'oyster',
    name: 'Oyster',
    note: 'Soft greens, serif headings',
    theme: {
      typeSet: 'editorial',
      shape: 'soft',
      density: 'comfortable',
      texture: 'grain',
      palette: { paper: '#D9E0D8', surface: '#F1F4EF', ink: '#13201C', muted: '#556258', line: '#B6C2B5', brand: '#2E4A3E', onBrand: '#F1F4EF', accent: '#C8863C' },
    },
  },
  {
    id: 'rigging',
    name: 'Rigging',
    note: 'Dark, sharp, orange brand',
    theme: {
      typeSet: 'technical',
      shape: 'sharp',
      density: 'tight',
      texture: 'grid',
      palette: { paper: '#0E1116', surface: '#171C23', ink: '#E6EAEF', muted: '#8E9AAA', line: '#2A323C', brand: '#FF6B1A', onBrand: '#100A05', accent: '#F2C230' },
    },
  },
  {
    id: 'harbour',
    name: 'Harbour',
    note: 'Clean light, blue brand',
    theme: {
      typeSet: 'technical',
      shape: 'soft',
      density: 'comfortable',
      texture: 'none',
      palette: { paper: '#F4F7FA', surface: '#FFFFFF', ink: '#0F1B2D', muted: '#52627A', line: '#D3DBE5', brand: '#1F4FD8', onBrand: '#FFFFFF', accent: '#E0A100' },
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    note: 'Lilac grey, serif headings',
    theme: {
      typeSet: 'editorial',
      shape: 'soft',
      density: 'comfortable',
      texture: 'none',
      palette: { paper: '#EEEAF3', surface: '#F9F7FB', ink: '#1B1426', muted: '#5B5069', line: '#D2C9DE', brand: '#5B3A8C', onBrand: '#F9F7FB', accent: '#C27A00' },
    },
  },
]

export const isHex = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value)

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** WCAG contrast ratio of two `#rrggbb` colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const MIN_CONTRAST = 4.5

const READABLE_PAIRS: { text: PaletteKey; on: PaletteKey; message: string }[] = [
  { text: 'ink', on: 'paper', message: 'Text is hard to read on the background. Pick a darker text or a lighter background (or the reverse).' },
  { text: 'ink', on: 'surface', message: 'Text is hard to read on panels. Pick colours with more difference between Text and Panel.' },
  { text: 'muted', on: 'paper', message: 'Secondary text is hard to read on the background. Make it stronger or the background plainer.' },
  { text: 'onBrand', on: 'brand', message: 'Text on the brand colour is hard to read. Pick a text colour that stands out from Brand.' },
]

/** What would be hard to read in this theme; empty when it is fine. Colours that aren't whole hex yet are skipped. */
export function contrastProblems(theme: SiteTheme): string[] {
  return READABLE_PAIRS.filter(({ text, on }) => {
    const [a, b] = [theme.palette[text], theme.palette[on]]
    return isHex(a) && isHex(b) && contrastRatio(a, b) < MIN_CONTRAST
  }).map(({ message }) => message)
}

export function sameTheme(a: SiteTheme, b: SiteTheme): boolean {
  return (
    a.typeSet === b.typeSet &&
    a.shape === b.shape &&
    a.density === b.density &&
    a.texture === b.texture &&
    COLOUR_FIELDS.every(({ key }) => a.palette[key].toLowerCase() === b.palette[key].toLowerCase())
  )
}

/** The preset a theme is exactly, if any: it is shown as selected until something is changed. */
export function presetOf(theme: SiteTheme): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => sameTheme(preset.theme, theme))
}

/** The theme with each colour that isn't a whole `#rrggbb` yet swapped for the one it had before: safe to draw. */
export function drawable(draft: SiteTheme, fallback: SiteTheme): SiteTheme {
  const palette = { ...draft.palette }
  for (const { key } of COLOUR_FIELDS) if (!isHex(palette[key])) palette[key] = fallback.palette[key]
  return { ...draft, palette }
}
