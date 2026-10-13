import { z } from 'zod';

// A site's look (`sites.theme_json`), edited by the client in Settings. The shape is `cms-blocks`' `SiteTheme`; the
// repos can't share code, so it is restated here and the two must be kept in step. Fixed choices and 8 colours, never
// free-form fonts or CSS: a client can restyle its site but not break it (invariant 8).

export const TYPE_SETS = ['editorial', 'technical'] as const;
export const SHAPES = ['soft', 'sharp'] as const;
export const DENSITIES = ['comfortable', 'tight'] as const;
export const TEXTURES = ['none', 'grain', 'grid'] as const;

export const PALETTE_KEYS = ['paper', 'surface', 'ink', 'muted', 'line', 'brand', 'onBrand', 'accent'] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

/** The same plain-language names the editor's colour fields use, so an error names what the client sees. */
const COLOUR_NAMES: Record<PaletteKey, string> = {
  paper: 'Background',
  surface: 'Panel',
  ink: 'Text',
  muted: 'Secondary text',
  line: 'Lines',
  brand: 'Brand',
  onBrand: 'Text on brand',
  accent: 'Accent',
};

const HEX = /^#[0-9a-f]{6}$/i;

const colour = (key: PaletteKey) => z.string().regex(HEX, `${COLOUR_NAMES[key]} must be a colour like #2E4A3E.`);

export const themeSchema = z
  .object({
    typeSet: z.enum(TYPE_SETS, { message: 'Choose a type set from the list.' }),
    shape: z.enum(SHAPES, { message: 'Choose a corner style from the list.' }),
    density: z.enum(DENSITIES, { message: 'Choose a spacing from the list.' }),
    texture: z.enum(TEXTURES, { message: 'Choose a texture from the list.' }),
    palette: z
      .object({
        paper: colour('paper'),
        surface: colour('surface'),
        ink: colour('ink'),
        muted: colour('muted'),
        line: colour('line'),
        brand: colour('brand'),
        onBrand: colour('onBrand'),
        accent: colour('accent'),
      })
      .strict(),
  })
  .strict();

export type SiteTheme = z.infer<typeof themeSchema>;

/** WCAG relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio of two `#rrggbb` colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Body text needs 4.5:1 (WCAG AA). */
export const MIN_CONTRAST = 4.5;

/**
 * The pairs a visitor has to read: text on the page and on a panel, secondary text on the page, and text on a brand
 * button. A theme that fails one is refused with a sentence naming it, so a saved theme can't have unreadable body text (accent is not checked, B-41).
 */
const READABLE_PAIRS: { text: PaletteKey; on: PaletteKey; message: string }[] = [
  { text: 'ink', on: 'paper', message: 'Text is hard to read on the background. Pick a darker text or a lighter background (or the reverse).' },
  { text: 'ink', on: 'surface', message: 'Text is hard to read on panels. Pick colours with more difference between Text and Panel.' },
  { text: 'muted', on: 'paper', message: 'Secondary text is hard to read on the background. Make it stronger or the background plainer.' },
  { text: 'onBrand', on: 'brand', message: 'Text on the brand colour is hard to read. Pick a text colour that stands out from Brand.' },
];

export function contrastProblems(theme: SiteTheme): string[] {
  return READABLE_PAIRS.filter(({ text, on }) => contrastRatio(theme.palette[text], theme.palette[on]) < MIN_CONTRAST).map(
    ({ message }) => message,
  );
}
