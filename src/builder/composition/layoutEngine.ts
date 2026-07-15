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
}

export interface ComposedLayout {
  viewBox: string;
  center: { x: number; y: number };
  silhouette: 'dome' | 'cascade' | 'wild';
  greenery: Placement[];
  blooms: Placement[];
  /** Gathered-stem path, drawn beneath everything else so only the lower
   * "tied" portion peeks out below the flower heads — grounds the
   * composition instead of leaving the lower canvas empty. */
  stemsPath: string;
}

const STEM_TIE_OFFSET_Y = 90;

function buildStemsPath(blooms: Placement[], center: { x: number; y: number }): string {
  const tie = { x: center.x, y: center.y + STEM_TIE_OFFSET_Y };
  return blooms
    .map((b) => {
      const midX = (b.x + tie.x) / 2;
      const midY = (b.y + tie.y) / 2;
      return `M${b.x.toFixed(1)},${b.y.toFixed(1)} Q${midX.toFixed(1)},${midY.toFixed(1)} ${tie.x},${tie.y}`;
    })
    .join(' ');
}

const VIEWBOX_SIZE = 400;
const CENTER = { x: 200, y: 246 };

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

function placeInLayer(
  layer: LayerName,
  footprintRadius: number,
  preset: ReturnType<typeof pickSilhouette>,
  random: () => number,
  placedInLayer: { x: number; y: number; footprintRadius: number }[]
): { x: number; y: number; angleDeg: number } {
  const [minAngle, maxAngle] = preset.angleRange;
  let best = { x: CENTER.x, y: CENTER.y, angleDeg: minAngle };

  for (let attempt = 0; attempt < 12; attempt++) {
    const angleDeg = randRange(random, minAngle, maxAngle);
    const angleRad = (angleDeg * Math.PI) / 180;
    const jitterFactor = randRange(random, preset.jitter[0], preset.jitter[1]);
    const radius =
      preset.layerRadius[layer] * preset.angleFactor(angleDeg) * (0.55 + 0.45 * random()) * jitterFactor;
    const x = CENTER.x + radius * Math.cos(angleRad);
    const y = CENTER.y + radius * Math.sin(angleRad);

    const collides = placedInLayer.some(
      (p) => distance({ x, y }, p) < (p.footprintRadius + footprintRadius) * 0.5
    );

    best = { x, y, angleDeg };
    if (!collides) return best;
  }
  return best;
}

export function composeLayout(
  state: Pick<BouquetState, 'blooms' | 'arrangementSeed' | 'greenery'>,
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

  const placedByLayer: Record<LayerName, { x: number; y: number; footprintRadius: number }[]> = {
    back: [],
    mid: [],
    front: [],
  };

  const blooms: Placement[] = instances.map((species, index) => {
    const meta = flowerMeta[species] ?? { footprintRadius: 36, layerBias: 'mid' as LayerName };
    const layer = assignLayer(meta.layerBias, bloomRandom);
    const { x, y } = placeInLayer(layer, meta.footprintRadius, preset, bloomRandom, placedByLayer[layer]);
    placedByLayer[layer].push({ x, y, footprintRadius: meta.footprintRadius });
    return {
      id: `bloom-${species}-${index}`,
      assetId: species,
      kind: 'bloom',
      x,
      y,
      rotation: randRange(bloomRandom, -preset.rotationJitter, preset.rotationJitter),
      scale: randRange(bloomRandom, 0.85, 1.15),
      layer,
    };
  });

  const greeneryCount = Math.min(16, 10 + Math.floor(totalQty / 3));
  const greeneryPlaced: { x: number; y: number; footprintRadius: number }[] = [];
  const greeneryAssetId = state.greenery ?? 'eucalyptus';
  const greenery: Placement[] = Array.from({ length: greeneryCount }, (_, index) => {
    const footprintRadius = 26;
    const { x, y } = placeInLayer('back', footprintRadius, preset, greeneryRandom, greeneryPlaced);
    greeneryPlaced.push({ x, y, footprintRadius });
    return {
      id: `greenery-${index}`,
      assetId: greeneryAssetId,
      kind: 'greenery',
      x,
      y,
      rotation: randRange(greeneryRandom, -20, 20),
      scale: randRange(greeneryRandom, 0.8, 1.25),
      layer: 'back',
    };
  });

  return {
    viewBox: `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`,
    center: CENTER,
    silhouette: preset.id,
    greenery,
    blooms,
    stemsPath: buildStemsPath(blooms, CENTER),
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
