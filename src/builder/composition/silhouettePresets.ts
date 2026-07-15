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

export const SILHOUETTE_PRESETS: SilhouettePreset[] = [
  {
    id: 'dome',
    layerRadius: { back: 150, mid: 118, front: 92 },
    angleRange: [-172, -8],
    angleFactor: (angleDeg) => 1 - 0.12 * Math.cos((angleDeg * Math.PI) / 180),
    jitter: [0.85, 1.1],
    rotationJitter: 12,
  },
  {
    id: 'cascade',
    layerRadius: { back: 152, mid: 122, front: 96 },
    angleRange: [-172, 4],
    angleFactor: (angleDeg) => {
      // Extra reach on the right/lower side for a cascading drape.
      const drape = angleDeg > -60 ? 1 + ((angleDeg + 60) / 64) * 0.55 : 1;
      return drape;
    },
    jitter: [0.8, 1.15],
    rotationJitter: 16,
  },
  {
    id: 'wild',
    layerRadius: { back: 158, mid: 126, front: 100 },
    angleRange: [-178, -2],
    angleFactor: () => 1,
    jitter: [0.68, 1.4],
    rotationJitter: 24,
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
