import type { SiteTheme } from 'cms-blocks'

const TYPE_SETS = ['editorial', 'technical']
const SHAPES = ['soft', 'sharp']
const DENSITIES = ['comfortable', 'tight']
const TEXTURES = ['none', 'grain', 'grid']
const COLOURS = ['paper', 'surface', 'ink', 'muted', 'line', 'brand', 'onBrand', 'accent']

/**
 * A site's stored theme (`sites.theme_json`) as the canvas can use it, or null when it isn't a whole theme: the
 * editor then shows its neutral fallback rather than a half-styled page (B-16). The API stores what the seed and
 * the theme presets wrote; nothing here trusts it further than that.
 */
export function readSiteTheme(value: unknown): SiteTheme | null {
  if (typeof value !== 'object' || value === null) return null
  const theme = value as Record<string, unknown>
  const palette = theme.palette as Record<string, unknown> | undefined
  const choices =
    TYPE_SETS.includes(theme.typeSet as string) &&
    SHAPES.includes(theme.shape as string) &&
    DENSITIES.includes(theme.density as string) &&
    TEXTURES.includes(theme.texture as string)
  const colours = typeof palette === 'object' && palette !== null && COLOURS.every((key) => typeof palette[key] === 'string')
  return choices && colours ? (theme as unknown as SiteTheme) : null
}
