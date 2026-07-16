import flowersData from '../content/flowers.json';
import greeneryData from '../content/greenery.json';
import presentationData from '../content/presentation.json';
import occasionsData from '../content/occasions.json';
import cardFontsData from '../content/cardFonts.json';
import cardThemesData from '../content/cardThemes.json';
import floriographyData from '../content/floriography.json';
import type { SpeciesMeta } from './composition/layoutEngine';
import type { LayerName } from './composition/silhouettePresets';

export interface FlowerContent {
  id: string;
  name: string;
  footprintRadius: number;
  layerBias: LayerName;
  fill: string;
  fillDeep: string;
  center: string;
}

export interface GreeneryContent {
  id: string;
  name: string;
  fill: string;
  fillDeep: string;
}

export interface FloriographyEntry {
  id: string;
  meaning: string;
}

export interface CardThemeContent {
  id: string;
  name: string;
  paper: string;
  paperDeep: string;
  ink: string;
  borderColor: string;
  edge: 'clean' | 'torn';
}

export const FLOWERS = flowersData as FlowerContent[];
export const GREENERY = greeneryData as GreeneryContent[];
export const FLORIOGRAPHY = floriographyData as FloriographyEntry[];
export const PRESENTATION = presentationData as {
  wraps: { id: string; name: string; fill: string; fillDeep: string }[];
  vases: { id: string; name: string; fill: string; fillDeep: string }[];
  ribbons: { id: string; name: string; fill: string }[];
  themes: { id: string; name: string; accent: string; accentDeep: string; paper: string }[];
};
export const OCCASIONS = occasionsData as {
  id: string;
  label: string;
  suggestedTheme: string;
  suggestedCardMessage: string;
  suggestedBlooms: { species: string; qty: number }[];
}[];
export const CARD_FONTS = cardFontsData as {
  id: string;
  name: string;
  family: string;
  googleFont: string | null;
}[];
export const CARD_THEMES = cardThemesData as CardThemeContent[];

const flowerSvgModules = import.meta.glob('../assets/svg/flowers/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const greenerySvgModules = import.meta.glob('../assets/svg/greenery/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const presentationSvgModules = import.meta.glob('../assets/svg/presentation/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function indexById(modules: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(modules)) {
    const match = path.match(/([^/]+)\.svg$/);
    if (match) out[match[1]] = content;
  }
  return out;
}

export const FLOWER_SVGS = indexById(flowerSvgModules);
export const GREENERY_SVGS = indexById(greenerySvgModules);
export const PRESENTATION_SVGS = indexById(presentationSvgModules);

export const FLOWER_BY_ID: Record<string, FlowerContent> = Object.fromEntries(
  FLOWERS.map((f) => [f.id, f])
);
export const GREENERY_BY_ID: Record<string, GreeneryContent> = Object.fromEntries(
  GREENERY.map((g) => [g.id, g])
);
export const CARD_THEME_BY_ID: Record<string, CardThemeContent> = Object.fromEntries(
  CARD_THEMES.map((t) => [t.id, t])
);

export const FLOWER_META: Record<string, SpeciesMeta> = Object.fromEntries(
  FLOWERS.map((f) => [f.id, { footprintRadius: f.footprintRadius, layerBias: f.layerBias }])
);

/** id -> meaning, the lookup floriography tooltips actually use. */
export const MEANING_BY_ID: Record<string, string> = Object.fromEntries(
  FLORIOGRAPHY.map((f) => [f.id, f.meaning])
);

export function flowerCssVars(speciesId: string): Record<string, string> {
  const f = FLOWER_BY_ID[speciesId];
  if (!f) return {};
  return { '--bloom-fill': f.fill, '--bloom-fill-deep': f.fillDeep, '--bloom-center': f.center };
}

export function greeneryCssVars(greeneryId: string): Record<string, string> {
  const g = GREENERY_BY_ID[greeneryId];
  if (!g) return {};
  return { '--greenery-fill': g.fill, '--greenery-fill-deep': g.fillDeep };
}

export function cardThemeCssVars(themeId: string): Record<string, string> {
  const t = CARD_THEME_BY_ID[themeId] ?? CARD_THEMES[0];
  return {
    '--card-paper': t.paper,
    '--card-paper-deep': t.paperDeep,
    '--card-ink': t.ink,
    '--card-border-color': t.borderColor,
    // Doodle stroke follows the theme's ink color so a Midnight signature
    // stays legible instead of rendering brand-purple-on-near-black.
    '--card-doodle-stroke': t.ink,
  };
}
