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

// Vase art is authored on a 320x320 viewBox; its rim (where the flowers
// should appear to emerge from) sits at local (160,130). This box places
// that anchor point at the right spot relative to the bouquet composition's
// own CENTER (see layoutEngine.ts).
const VASE_BOX = { x: 68, y: 135, w: 304, h: 304 };
// Ribbon art is authored on a 200x130 viewBox with its knot at local (100,65).
// Sized+positioned so that knot anchor lands just above the vase rim (which
// itself sits at composed y≈258.5, see VASE_BOX above) — tied around the
// stems as they gather, rather than the old wrap-neck placement lower down.
// Deliberately smaller than a statement bow for a cuter accent look.
const RIBBON_BOX = { x: 164, y: 227.8, w: 112, h: 72.8 };

function vaseGroup(assetId: string): string {
  const raw = PRESENTATION_SVGS[assetId];
  if (!raw) return '';
  return raw.replace(
    '<svg ',
    `<svg x="${VASE_BOX.x}" y="${VASE_BOX.y}" width="${VASE_BOX.w}" height="${VASE_BOX.h}" overflow="visible" `
  );
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

  const vaseId = presentation.vase ?? PRESENTATION.vases[0].id;
  const vaseContent = PRESENTATION.vases.find((v) => v.id === vaseId);
  const materialSvg = vaseContent
    ? `<g class="placement placement--material" style="--presentation-fill:${vaseContent.fill};--presentation-fill-deep:${vaseContent.fillDeep}">${vaseGroup(vaseId)}</g>`
    : '';

  const ribbonSvg = presentation.ribbon ? ribbonGroup(presentation.ribbon, theme.accent, theme.accentDeep) : '';

  return { viewBox: layout.viewBox, materialSvg, bloomsSvg, ribbonSvg };
}
