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

// Kept deliberately calm and contained: earlier values let blooms fan out
// close to the horizontal, so a wrap/vase graphic (sized to hold a compact
// dome of flowers) couldn't visually contain the spread — blooms floated
// outside it. Staying within roughly ±20° of vertical keeps the whole
// arrangement inside the wrap's opening at any seed.
export const SILHOUETTE_PRESETS: SilhouettePreset[] = [
  {
    id: 'dome',
    layerRadius: { back: 152, mid: 124, front: 96 },
    angleRange: [-158, -22],
    angleFactor: (angleDeg) => 1 - 0.1 * Math.cos((angleDeg * Math.PI) / 180),
    jitter: [0.94, 1.04],
    rotationJitter: 7,
  },
  {
    id: 'cascade',
    layerRadius: { back: 156, mid: 128, front: 98 },
    angleRange: [-158, -14],
    angleFactor: (angleDeg) => {
      // A gentle extra reach on one side for a soft drape — subtle enough
      // that nothing drifts outside the bouquet's overall silhouette.
      const drape = angleDeg > -50 ? 1 + ((angleDeg + 50) / 36) * 0.12 : 1;
      return drape;
    },
    jitter: [0.92, 1.05],
    rotationJitter: 8,
  },
  {
    id: 'wild',
    layerRadius: { back: 160, mid: 130, front: 100 },
    angleRange: [-164, -16],
    angleFactor: () => 1,
    jitter: [0.88, 1.08],
    rotationJitter: 10,
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
