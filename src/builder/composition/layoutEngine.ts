import type { BouquetState } from '../state/schema';
import { mulberry32, pickWeighted, randRange } from './seededRandom';
import { pickSilhouette, type LayerName } from './silhouettePresets';
import { FOOTPRINT_TO_RENDER_SIZE } from './renderPlacements';

export interface SpeciesMeta {
  footprintRadius: number;
  layerBias: LayerName;
}

export interface Placement {
  id: string;
  assetId: string;
  kind: 'bloom' | 'greenery';
  x: number;
  y: number;
  rotation: number;
  scale: number;
  /** Horizontal-only multiplier for art whose square canvas needs fanning out
   * to fill a wider-than-tall space. Applied inside the placement rather than
   * as part of its transform — GSAP animates `.placement` and rewrites that
   * transform as a matrix, which silently discards a non-uniform scale. Omitted
   * for everything but the greenery backdrop; it must never distort a bloom. */
  widthScale?: number;
  layer: LayerName;
  /** Half the intended visual footprint, in viewBox units — the renderer
   * sizes the art from this directly, so it's also what collision spacing
   * is measured against. Keeping these in lockstep is what keeps blooms
   * from rendering far larger than the space they were spaced for. */
  footprintRadius: number;
}

export interface ComposedLayout {
  viewBox: string;
  center: { x: number; y: number };
  silhouette: 'dome' | 'cascade' | 'wild';
  greenery: Placement[];
  blooms: Placement[];
}

const VIEWBOX_SIZE = 440;
const CENTER = { x: 220, y: 258 };

/** Greenery is drawn as a single backdrop, not a scattering of sprigs.
 *
 * Each greenery asset is already a whole gathered spray — stems tied at the
 * bottom, foliage fanning up and out. Repeating one across the arrangement
 * therefore reads as several tiny bunches rather than one bouquet's worth of
 * foliage, which is what the sprig-ring approach produced once the art changed.
 * Placing it once, large, behind the blooms lets the art's own composition do
 * the work.
 *
 * Height of the spray's *drawn* area in viewBox units. Blooms top out around
 * y=30 and the gather sits at y=258, so filling roughly that span covers the
 * bouquet without the fronds being clipped by the 440-unit frame. */
const GREENERY_BACKDROP_HEIGHT = 236;

/** The traced art is padded so the drawing occupies this fraction of its
 * square box (tools/vectorize-art.mjs FILL_RATIO). Anchoring has to be done in
 * terms of the drawing, not the box — otherwise the transparent margin throws
 * the base off by ~8% of the height, which is enough to lift the whole spray
 * clear of the blooms it is meant to sit behind. */
const ART_FILL_RATIO = 0.85;

/** How far below the vase rim the cut stem ends sit, so they finish behind the
 * rim rather than stopping short in mid-air. */
const GREENERY_BASE_OFFSET = 16;

/** Horizontal stretch. The sprays are drawn on a square canvas, but a bouquet
 * is wider than it is tall — at a height that clears the frame, an unstretched
 * spray ends up narrower than the blooms and reads as a stripe behind them
 * instead of foliage they are nestled into. Fanning the bunch wider is what a
 * florist does by hand anyway. */
const GREENERY_WIDTH_STRETCH = 1.5;

/** Derived independently of arrangementSeed's bloom PRNG stream, so swapping
 * which greenery species is drawn never reshuffles bloom placement — only an
 * actual "try a new arrangement" (which changes arrangementSeed itself)
 * reshuffles greenery positions too. */
const GREENERY_SEED_SALT = 0x9e3779b1;

const LAYER_RANK: Record<LayerName, number> = { back: 0, mid: 1, front: 2 };
const LAYER_NEIGHBORS: Record<LayerName, LayerName[]> = {
  back: ['mid'],
  mid: ['back', 'front'],
  front: ['mid'],
};

function assignLayer(bias: LayerName, random: () => number): LayerName {
  const neighbors = LAYER_NEIGHBORS[bias];
  const weights: [LayerName, number][] = [[bias, 0.65]];
  const neighborWeight = 0.35 / neighbors.length;
  for (const n of neighbors) weights.push([n, neighborWeight]);
  return pickWeighted(random, weights);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Splits an angle range into `count` roughly-equal slots and returns one
 * angle per slot (jittered within the slot, then slot-order shuffled) —
 * this is the fix for "flowers aren't evenly spaced": picking every angle
 * fully at random (no memory of where earlier instances landed) lets
 * several instances roll angles close together purely by chance, clumping
 * one side of the fan while leaving the other empty. Stratifying guarantees
 * every instance gets its own share of the arc while still looking organic. */
function stratifiedAngles(count: number, [minAngle, maxAngle]: [number, number], random: () => number): number[] {
  if (count === 0) return [];
  const slotWidth = (maxAngle - minAngle) / count;
  const angles = Array.from({ length: count }, (_, i) => {
    const slotStart = minAngle + i * slotWidth;
    return slotStart + slotWidth * randRange(random, 0.12, 0.88);
  });
  for (let i = angles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [angles[i], angles[j]] = [angles[j], angles[i]];
  }
  return angles;
}

function placeAtAngle(
  angleDeg: number,
  layer: LayerName,
  footprintRadius: number,
  preset: ReturnType<typeof pickSilhouette>,
  random: () => number,
  placedInLayer: { x: number; y: number; footprintRadius: number }[],
  /** How much overlap to tolerate: 1 = centers must be a full combined-radius
   * apart (no overlap at all), lower = petals allowed to touch/overlap a bit
   * for a natural clustered look. Blooms want a fairly strict value so
   * individual flowers stay legible; greenery can pack tighter. */
  overlapTolerance: number
): { x: number; y: number } {
  let best = { x: CENTER.x, y: CENTER.y };

  for (let attempt = 0; attempt < 20; attempt++) {
    // Small nudges around the assigned slot angle (not a full re-roll across
    // the whole layer range) so collision retries can't undo the stratified
    // spacing that keeps instances from clumping in the first place.
    const nudgedAngle = angleDeg + randRange(random, -4, 4);
    const angleRad = (nudgedAngle * Math.PI) / 180;
    const jitterFactor = randRange(random, preset.jitter[0], preset.jitter[1]);
    const radius =
      preset.layerRadius[layer] * preset.angleFactor(nudgedAngle) * (0.6 + 0.4 * random()) * jitterFactor;
    const x = CENTER.x + radius * Math.cos(angleRad);
    const y = CENTER.y + radius * Math.sin(angleRad);

    const collides = placedInLayer.some(
      (p) => distance({ x, y }, p) < (p.footprintRadius + footprintRadius) * overlapTolerance
    );

    best = { x, y };
    if (!collides) return best;
  }
  return best;
}

export function composeLayout(
  state: Pick<BouquetState, 'blooms' | 'arrangementSeed' | 'greenery'> &
    Partial<Pick<BouquetState, 'arrangementOverrides'>>,
  flowerMeta: Record<string, SpeciesMeta>
): ComposedLayout {
  const totalQty = state.blooms.reduce((sum, b) => sum + b.qty, 0);
  const bloomRandom = mulberry32(state.arrangementSeed);
  const greeneryRandom = mulberry32(state.arrangementSeed ^ GREENERY_SEED_SALT);
  const preset = pickSilhouette(totalQty, bloomRandom);

  const instances: string[] = [];
  for (const b of state.blooms) {
    for (let i = 0; i < b.qty; i++) instances.push(b.species);
  }
  // Seeded shuffle so mixed species read as blended, not clumped by pick order.
  for (let i = instances.length - 1; i > 0; i--) {
    const j = Math.floor(bloomRandom() * (i + 1));
    [instances[i], instances[j]] = [instances[j], instances[i]];
  }

  // Pass 1: assign every instance to a layer before placing anything, so
  // each layer's angular slots can be divided across its *actual* member
  // count rather than placed one-at-a-time with no memory of the others.
  const layerOf = instances.map((species) => {
    const meta = flowerMeta[species] ?? { footprintRadius: 36, layerBias: 'mid' as LayerName };
    return assignLayer(meta.layerBias, bloomRandom);
  });

  const indicesByLayer: Record<LayerName, number[]> = { back: [], mid: [], front: [] };
  layerOf.forEach((layer, i) => indicesByLayer[layer].push(i));

  const anglesByIndex = new Map<number, number>();
  (Object.keys(indicesByLayer) as LayerName[]).forEach((layer) => {
    const indices = indicesByLayer[layer];
    const angles = stratifiedAngles(indices.length, preset.angleRange, bloomRandom);
    indices.forEach((i, slot) => anglesByIndex.set(i, angles[slot]));
  });

  const placedByLayer: Record<LayerName, { x: number; y: number; footprintRadius: number }[]> = {
    back: [],
    mid: [],
    front: [],
  };

  const overrides = state.arrangementOverrides ?? {};
  const blooms: Placement[] = instances.map((species, index) => {
    const meta = flowerMeta[species] ?? { footprintRadius: 36, layerBias: 'mid' as LayerName };
    const layer = layerOf[index];
    const angle = anglesByIndex.get(index)!;
    const id = `bloom-${species}-${index}`;
    const placed = placeAtAngle(angle, layer, meta.footprintRadius, preset, bloomRandom, placedByLayer[layer], 0.82);
    // A manual drag override replaces the algorithmic position outright, but
    // still feeds into collision spacing for blooms placed after it so later
    // instances don't land on top of a spot the sender deliberately chose.
    const { x, y } = overrides[id] ?? placed;
    placedByLayer[layer].push({ x, y, footprintRadius: meta.footprintRadius });
    return {
      id,
      assetId: species,
      kind: 'bloom',
      x,
      y,
      rotation: randRange(bloomRandom, -preset.rotationJitter, preset.rotationJitter),
      scale: randRange(bloomRandom, 0.92, 1.08),
      layer,
      footprintRadius: meta.footprintRadius,
    };
  });

  // One spray, placed deliberately behind the blooms — see
  // GREENERY_BACKDROP_SIZE. It sits on the back layer so every bloom paints
  // over it, and carries only a whisper of rotation: the art is already
  // symmetric about its own stem, and tilting a full bouquet's worth of
  // foliage reads as a mistake rather than as looseness.
  const greeneryAssetId = state.greenery ?? 'eucalyptus';
  const greeneryBox = GREENERY_BACKDROP_HEIGHT / ART_FILL_RATIO;
  const greenery: Placement[] = [
    {
      id: 'greenery-backdrop',
      assetId: greeneryAssetId,
      kind: 'greenery',
      x: CENTER.x,
      // Anchor the drawing's bottom edge, not the padded box's.
      y: CENTER.y + GREENERY_BASE_OFFSET - GREENERY_BACKDROP_HEIGHT / 2,
      rotation: randRange(greeneryRandom, -2.5, 2.5),
      scale: 1,
      widthScale: GREENERY_WIDTH_STRETCH,
      layer: 'back',
      footprintRadius: greeneryBox / FOOTPRINT_TO_RENDER_SIZE,
    },
  ];

  return {
    viewBox: `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`,
    center: CENTER,
    silhouette: preset.id,
    greenery,
    blooms,
  };
}

/** Merges greenery + blooms into a single paint-order list.
 *
 * Greenery paints first unconditionally — it is one full-width backdrop, so
 * ordering it against the blooms by y (as when it was a ring of small sprigs)
 * would let the spray paint over any back-layer bloom that happened to sit
 * higher than the spray's own centre, burying a flower behind the foliage.
 *
 * Blooms then run back layer to front, sorted by y within each layer so lower
 * ones sit in front of higher ones — natural depth without cross-layer
 * z-fighting between a low back bloom and a high focal one. */
export function flattenForRender(layout: ComposedLayout): Placement[] {
  const blooms = [...layout.blooms].sort((a, b) => {
    const rankDiff = LAYER_RANK[a.layer] - LAYER_RANK[b.layer];
    if (rankDiff !== 0) return rankDiff;
    return a.y - b.y;
  });
  return [...layout.greenery, ...blooms];
}
