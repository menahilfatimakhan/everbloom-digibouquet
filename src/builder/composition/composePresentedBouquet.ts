import type { BouquetState } from '../state/schema';
import { composeLayout, flattenForRender } from './layoutEngine';
import { placementsToSvgBody } from './renderPlacements';
import {
  FLOWER_META,
  FLOWER_SVGS,
  GREENERY_SVGS,
  PRESENTATION,
  PRESENTATION_SVGS,
  flowerCssVars,
  greeneryCssVars,
} from '../assetRegistry';

// Wrap/vase art is authored on a 320x320 viewBox. A wrap's "neck" (where
// stems gather) sits at local (160,250); a vase's rim (where the flowers
// should appear to emerge from) sits at local (160,130). These boxes place
// each so that anchor point lands at the right spot relative to the bouquet
// composition's own CENTER (see layoutEngine.ts). Sized generously (scale
// ~0.95) so the wrap's flared opening actually spans wider than the
// bloom fan's worst-case spread — a too-narrow wrap left blooms visually
// floating outside it.
const WRAP_BOX = { x: 68, y: 63, w: 304, h: 304 };
const VASE_BOX = { x: 68, y: 135, w: 304, h: 304 };
// Ribbon art is authored on a 200x130 viewBox with its knot at local (100,65).
const RIBBON_BOX = { x: 155, y: 243, w: 130, h: 84.5 };

function wrapVaseGroup(assetId: string, kind: 'wrap' | 'vase'): string {
  const raw = PRESENTATION_SVGS[assetId];
  if (!raw) return '';
  const box = kind === 'vase' ? VASE_BOX : WRAP_BOX;
  return raw.replace('<svg ', `<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" overflow="visible" `);
}

function ribbonGroup(assetId: string, accent: string, accentDeep: string): string {
  if (assetId === 'none') return '';
  const raw = PRESENTATION_SVGS[assetId];
  if (!raw) return '';
  const nested = raw.replace(
    '<svg ',
    `<svg x="${RIBBON_BOX.x}" y="${RIBBON_BOX.y}" width="${RIBBON_BOX.w}" height="${RIBBON_BOX.h}" overflow="visible" `
  );
  return `<g class="placement placement--ribbon" style="--presentation-fill:${accent};--presentation-fill-deep:${accentDeep}">${nested}</g>`;
}

export interface PresentedBouquet {
  viewBox: string;
  materialSvg: string;
  bloomsSvg: string;
  ribbonSvg: string;
}

/** The single source of truth for "what does this bouquet actually look
 * like" — used by the Arrange preview, Send stage, keepsake export, and the
 * recipient reveal page, so they can never visually drift from each other. */
export function composePresentedBouquet(state: BouquetState): PresentedBouquet {
  const { presentation } = state;
  const theme = PRESENTATION.themes.find((t) => t.id === presentation.theme) ?? PRESENTATION.themes[0];
  const layout = composeLayout(state, FLOWER_META);
  const placements = flattenForRender(layout);

  const bloomsSvg = placementsToSvgBody(
    placements,
    (p) => (p.kind === 'bloom' ? FLOWER_SVGS[p.assetId] : GREENERY_SVGS[p.assetId]),
    (p) => (p.kind === 'bloom' ? flowerCssVars(p.assetId) : greeneryCssVars(p.assetId))
  );

  const materialId = presentation.type === 'wrap' ? presentation.wrap : presentation.vase;
  const materialContent =
    presentation.type === 'wrap'
      ? PRESENTATION.wraps.find((w) => w.id === materialId)
      : PRESENTATION.vases.find((v) => v.id === materialId);
  const materialSvg =
    materialId && materialContent
      ? `<g class="placement placement--material" style="--presentation-fill:${materialContent.fill};--presentation-fill-deep:${materialContent.fillDeep}">${wrapVaseGroup(materialId, presentation.type)}</g>`
      : '';

  const ribbonSvg = presentation.ribbon ? ribbonGroup(presentation.ribbon, theme.accent, theme.accentDeep) : '';

  return { viewBox: layout.viewBox, materialSvg, bloomsSvg, ribbonSvg };
}
