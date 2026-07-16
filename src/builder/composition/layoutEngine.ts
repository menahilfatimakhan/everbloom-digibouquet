import type { BouquetState } from '../state/schema';
import { mulberry32, pickWeighted, randRange } from './seededRandom';
import { pickSilhouette, type LayerName } from './silhouettePresets';

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
const GREENERY_FOOTPRINT_RADIUS = 24;

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

  // Fewer, more deliberate sprigs read as "accent greenery"; a dense ring
  // read as a bushy tangle that fought the blooms for attention.
  const greeneryCount = Math.min(9, 5 + Math.floor(totalQty / 4));
  const greeneryAngles = stratifiedAngles(greeneryCount, preset.angleRange, greeneryRandom);
  const greeneryPlaced: { x: number; y: number; footprintRadius: number }[] = [];
  const greeneryAssetId = state.greenery ?? 'eucalyptus';
  const greenery: Placement[] = greeneryAngles.map((angle, index) => {
    const { x, y } = placeAtAngle(
      angle,
      'back',
      GREENERY_FOOTPRINT_RADIUS,
      preset,
      greeneryRandom,
      greeneryPlaced,
      0.6
    );
    greeneryPlaced.push({ x, y, footprintRadius: GREENERY_FOOTPRINT_RADIUS });
    return {
      id: `greenery-${index}`,
      assetId: greeneryAssetId,
      kind: 'greenery',
      x,
      y,
      rotation: randRange(greeneryRandom, -15, 15),
      scale: randRange(greeneryRandom, 0.85, 1.1),
      layer: 'back',
      footprintRadius: GREENERY_FOOTPRINT_RADIUS,
    };
  });

  return {
    viewBox: `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`,
    center: CENTER,
    silhouette: preset.id,
    greenery,
    blooms,
  };
}

/** Merges greenery + blooms into a single paint-order list: back layer
 * first (greenery interleaved with any back-biased blooms), then mid, then
 * front, sorted by y within each layer so lower elements sit in front of
 * higher ones within that layer — natural depth without cross-layer
 * z-fighting between a low greenery sprig and a high focal bloom. */
export function flattenForRender(layout: ComposedLayout): Placement[] {
  return [...layout.greenery, ...layout.blooms].sort((a, b) => {
    const rankDiff = LAYER_RANK[a.layer] - LAYER_RANK[b.layer];
    if (rankDiff !== 0) return rankDiff;
    return a.y - b.y;
  });
}
