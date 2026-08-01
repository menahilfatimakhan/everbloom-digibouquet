import type { BouquetState } from '../state/schema';
import { composeLayout, flattenForRender } from './layoutEngine';
import { placementsToSvgBody } from './renderPlacements';
import type { PresentationPiece, VesselOption } from '../assetRegistry';
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

/** The vessel option that means "don't draw one" — see presentation.json. */
const NO_VESSEL_ID = 'none';

/** How far down the frame a hand-tied bouquet reaches: the gather plus the cut
 * stem ends below it. Used to crop the frame when no vessel is drawn. */
const HAND_TIED_DEPTH = 300;

/** Narrows a vessel choice to one that can actually be drawn. Returns
 * undefined for "No Vessel", and for any entry missing its geometry. */
function drawableVessel(v: VesselOption | undefined): PresentationPiece | undefined {
  if (!v || v.id === NO_VESSEL_ID) return undefined;
  if (v.aspect === undefined || v.anchor === undefined || v.height === undefined) return undefined;
  return { id: v.id, aspect: v.aspect, anchor: v.anchor, height: v.height };
}

/**
 * Positions a piece so its anchor point lands on `at`.
 *
 * Every piece is traced tight to its own drawing (tools/vectorize-art.mjs), so
 * it carries no consistent margin to position against; instead it declares its
 * aspect, where its rim or knot sits as a fraction of its height, and how tall
 * to render. That is enough to place any of them without this file knowing
 * anything about the individual piece — the constants it replaced were fitted
 * by hand to one vase on one canvas, and a wide bowl and a tall cone would each
 * have needed their own.
 */
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

  // A vessel is optional: "No Vessel" sends the bouquet hand-tied, exactly as
  // it is gathered. The fallback covers a *missing* value only — an explicit
  // "none" must not be quietly replaced with the first vase.
  const vaseId = presentation.vase ?? PRESENTATION.vases[0].id;
  const vasePiece = drawableVessel(PRESENTATION.vases.find((v) => v.id === vaseId));
  const materialSvg = vasePiece
    ? `<g class="placement placement--material">${vaseGroup(vasePiece)}</g>`
    : '';

  // "ribbon" means a bow, and the theme decides which one — so the colour
  // control drives the tie's colour instead of duplicating every bow as its own
  // entry in the ribbon list. "twine" carries its own art; "none" draws nothing.
  const ribbonChoice = PRESENTATION.ribbons.find((r) => r.id === presentation.ribbon);
  const themeChoice =
    PRESENTATION.themes.find((t) => t.id === presentation.theme) ?? PRESENTATION.themes[0];
  const ribbonPiece =
    ribbonChoice?.id === 'ribbon' ? themeChoice.bow : ribbonChoice?.piece;
  const ribbonSvg = ribbonPiece ? ribbonGroup(ribbonPiece) : '';

  // The layout's own frame is square because it reserves room below the gather
  // for a vessel. With none drawn, that lower third is empty and the bouquet
  // floats in the top of its own box, so the frame is cropped to the
  // arrangement — the gathered stem ends sit at roughly HAND_TIED_DEPTH.
  const viewBox = vasePiece ? layout.viewBox : `0 0 ${layout.frameWidth} ${HAND_TIED_DEPTH}`;

  return { viewBox, materialSvg, bloomsSvg, ribbonSvg };
}
