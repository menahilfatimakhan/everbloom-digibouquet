import type { BouquetState } from '../state/schema';
import { composeLayout, flattenForRender } from './layoutEngine';
import { placementsToSvgBody } from './renderPlacements';
import type { PresentationPiece } from '../assetRegistry';
import {
  FLOWER_META,
  FLOWER_SVGS,
  GREENERY_SVGS,
  PRESENTATION,
  PRESENTATION_SVGS,
  flowerCssVars,
  greeneryCssVars,
} from '../assetRegistry';

/** Where the bouquet gathers — the point every vessel's rim and every bow's
 * knot has to line up with. Matches the layout's own CENTER (see
 * layoutEngine.ts), which is what the blooms fan out from. */
const RIM_AT = { x: 220, y: 258.5 };

/** A bow is tied around the stems just above the rim, not level with it. */
const RIBBON_KNOT_RISE = 6;

/** A vessel or ribbon, as described in content/presentation.json. Each piece is
 * traced tight to its own drawing (tools/vectorize-art.mjs), so it carries no
 * consistent margin to position against; instead it declares
 *
 *   aspect  width / height of the drawn art
 *   anchor  where its rim (vessel) or knot (bow) sits, as a fraction of height
 *   height  how tall it should render, in composed units
 *
 * which is enough to place any of them without the compositor knowing anything
 * about the individual piece. The previous constants were fitted by hand to one
 * specific vase drawn on one specific canvas, and every new vessel — a wide
 * bowl, a tall cone — would have needed its own set. */
/** Positions a piece so its anchor point lands on `at`. */
function pieceBox(piece: PresentationPiece, at: { x: number; y: number }) {
  const h = piece.height;
  const w = h * piece.aspect;
  return { x: at.x - w / 2, y: at.y - h * piece.anchor, w, h };
}

function nest(raw: string, box: { x: number; y: number; w: number; h: number }): string {
  return raw.replace(
    '<svg ',
    `<svg x="${box.x.toFixed(2)}" y="${box.y.toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" preserveAspectRatio="none" overflow="visible" `
  );
}

function vaseGroup(piece: PresentationPiece): string {
  const raw = PRESENTATION_SVGS[piece.id];
  if (!raw) return '';
  return nest(raw, pieceBox(piece, RIM_AT));
}

function ribbonGroup(piece: PresentationPiece): string {
  if (piece.id === 'none') return '';
  const raw = PRESENTATION_SVGS[piece.id];
  if (!raw) return '';
  const nested = nest(raw, pieceBox(piece, { x: RIM_AT.x, y: RIM_AT.y - RIBBON_KNOT_RISE }));
  // Class retained for the reveal's untie step, which looks the group up by it.
  return `<g class="placement placement--ribbon">${nested}</g>`;
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
  const layout = composeLayout(state, FLOWER_META);
  const placements = flattenForRender(layout);

  const bloomsSvg = placementsToSvgBody(
    placements,
    (p) => (p.kind === 'bloom' ? FLOWER_SVGS[p.assetId] : GREENERY_SVGS[p.assetId]),
    (p) => (p.kind === 'bloom' ? flowerCssVars(p.assetId) : greeneryCssVars(p.assetId))
  );

  const vaseId = presentation.vase ?? PRESENTATION.vases[0].id;
  const vasePiece = PRESENTATION.vases.find((v) => v.id === vaseId);
  const materialSvg = vasePiece
    ? `<g class="placement placement--material">${vaseGroup(vasePiece)}</g>`
    : '';

  const ribbonPiece = presentation.ribbon
    ? PRESENTATION.ribbons.find((r) => r.id === presentation.ribbon)
    : undefined;
  const ribbonSvg = ribbonPiece ? ribbonGroup(ribbonPiece) : '';

  return { viewBox: layout.viewBox, materialSvg, bloomsSvg, ribbonSvg };
}
