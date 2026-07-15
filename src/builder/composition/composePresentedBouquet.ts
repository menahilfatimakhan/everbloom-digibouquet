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

function wrapVaseGroup(assetId: string, kind: 'wrap' | 'vase'): string {
  const raw = PRESENTATION_SVGS[assetId];
  if (!raw) return '';
  const box = kind === 'vase' ? { x: 60, y: 130, w: 280, h: 200 } : { x: 40, y: 90, w: 320, h: 220 };
  return raw.replace('<svg ', `<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" overflow="visible" `);
}

function ribbonGroup(assetId: string, accent: string, accentDeep: string): string {
  if (assetId === 'none') return '';
  const raw = PRESENTATION_SVGS[assetId];
  if (!raw) return '';
  const nested = raw.replace(
    '<svg ',
    `<svg x="140" y="185" width="120" height="72" viewBox="0 0 200 120" overflow="visible" `
  );
  return `<g class="placement placement--ribbon" style="--presentation-fill:${accent};--presentation-fill-deep:${accentDeep}">${nested}</g>`;
}

export interface PresentedBouquet {
  viewBox: string;
  materialSvg: string;
  stemsSvg: string;
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

  const stemsSvg = `<path d="${layout.stemsPath}" fill="none" stroke="#4f7a52" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>`;

  return { viewBox: layout.viewBox, materialSvg, stemsSvg, bloomsSvg, ribbonSvg };
}
