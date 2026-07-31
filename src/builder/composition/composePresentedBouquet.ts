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

// Vase art is authored on a 320x320 viewBox; its rim — where the flowers
// should appear to emerge from — sits at local (160,130). Everything below is
// derived so that anchor lands exactly on the bouquet composition's own CENTER
// (220, 258.5; see layoutEngine.ts), whatever size the vessel is drawn at.
const VASE_RIM = { x: 160 / 320, y: 130 / 320 };
const RIM_AT = { x: 220, y: 258.5 };

/** Vessel size in composed units. Pulled back from the original 304 — at that
 * size the vase filled ~69% of the frame and read as the subject, with the
 * blooms as a garnish on top of it. The flowers are the point. */
const VASE_SIZE = 252;

const VASE_BOX = {
  x: RIM_AT.x - VASE_SIZE * VASE_RIM.x,
  y: RIM_AT.y - VASE_SIZE * VASE_RIM.y,
  w: VASE_SIZE,
  h: VASE_SIZE,
};

// Ribbon art is authored on a 200x130 viewBox with its knot at local (100,65),
// tied around the stems as they gather just above the rim. Scaled with the
// vessel so the bow stays in proportion to the neck it is tied around.
const RIBBON_SIZE = { w: 112 * (VASE_SIZE / 304), h: 72.8 * (VASE_SIZE / 304) };
const RIBBON_BOX = {
  x: RIM_AT.x - RIBBON_SIZE.w / 2,
  y: RIM_AT.y + 5.7 - RIBBON_SIZE.h / 2,
  w: RIBBON_SIZE.w,
  h: RIBBON_SIZE.h,
};

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
