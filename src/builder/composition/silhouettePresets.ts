export type LayerName = 'back' | 'mid' | 'front';

export interface SilhouettePreset {
  id: 'dome' | 'cascade' | 'wild';
  /** Base envelope radius per layer, in viewBox units, before per-angle shaping. */
  layerRadius: Record<LayerName, number>;
  /** Fan angle range in degrees, standard SVG coords (0 = right, negative = up). */
  angleRange: [number, number];
  /** Returns a radius multiplier for a given angle (degrees), shaping the envelope. */
  angleFactor: (angleDeg: number) => number;
  /** Extra random radius jitter multiplier range. */
  jitter: [number, number];
  /** Extra per-instance rotation jitter, in degrees. */
  rotationJitter: number;
}

// Presentation is vase-only now (no wrap opening to stay narrow enough to
// fit inside), so the fan can use a fuller arc than before — blooms just
// need to emerge plausibly above the vase rim, not be contained by it.
// Actual even coverage of this arc comes from layoutEngine.ts's stratified
// angle assignment, not from these ranges alone.
export const SILHOUETTE_PRESETS: SilhouettePreset[] = [
  {
    id: 'dome',
    layerRadius: { back: 168, mid: 136, front: 104 },
    angleRange: [-172, -8],
    angleFactor: (angleDeg) => 1 - 0.1 * Math.cos((angleDeg * Math.PI) / 180),
    jitter: [0.92, 1.06],
    rotationJitter: 9,
  },
  {
    id: 'cascade',
    layerRadius: { back: 172, mid: 140, front: 106 },
    angleRange: [-172, 6],
    angleFactor: (angleDeg) => {
      // A gentle extra reach on one side for a soft drape.
      const drape = angleDeg > -55 ? 1 + ((angleDeg + 55) / 61) * 0.2 : 1;
      return drape;
    },
    jitter: [0.9, 1.08],
    rotationJitter: 10,
  },
  {
    id: 'wild',
    layerRadius: { back: 176, mid: 142, front: 108 },
    angleRange: [-176, -4],
    angleFactor: () => 1,
    jitter: [0.85, 1.12],
    rotationJitter: 13,
  },
];

export function pickSilhouette(bloomCount: number, random: () => number): SilhouettePreset {
  // Denser selections lean toward the more contained "dome"; looser/smaller
  // ones can wander into "cascade"/"wild" without looking sparse-and-messy.
  const domeWeight = bloomCount >= 9 ? 0.55 : 0.35;
  const roll = random();
  if (roll < domeWeight) return SILHOUETTE_PRESETS[0];
  if (roll < domeWeight + (1 - domeWeight) / 2) return SILHOUETTE_PRESETS[1];
  return SILHOUETTE_PRESETS[2];
}
