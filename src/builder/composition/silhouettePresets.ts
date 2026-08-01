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

/** Shapes the envelope by how *vertical* a bloom's angle is: full reach
 * straight up, pulled in to `sides` out at the horizontal extremes.
 *
 * The envelope used to be shaped from cos(angle), which is asymmetric — it
 * reached ~10% further to the left than the right and gave every arrangement
 * a lopsided list. Worse, it reached *furthest* at the horizontal extremes,
 * which is where a bouquet should be tightest: blooms at the far edges ended
 * up level with the vase rim and a long way from it, reading as though they
 * were floating beside the bouquet rather than growing out of it.
 */
function domeFactor(sides: number) {
  return (angleDeg: number) => sides + (1 - sides) * Math.abs(Math.sin((angleDeg * Math.PI) / 180));
}

// Presentation is vase-only (no wrap opening to stay narrow enough to fit
// inside), so the fan can use a generous arc — but it stops well short of
// horizontal at both ends. A bloom placed near horizontal has its *centre*
// just above the rim, and the art then hangs a half-height below it, leaving
// flowers dangling past the vase neck with nothing holding them up.
// Even coverage of the arc comes from layoutEngine.ts's stratified angle
// assignment, not from these ranges alone.
// Radii sit ~12% wider than the arrangement strictly needs at six blooms. Ten
// blooms will not fit the tighter envelope without burying each other — at the
// previous size a ten-stem bouquet had 17 of its 45 pairs overlapping — and the
// extra room costs little at low counts, where the depth floor holds blooms out
// near the rim anyway.
export const SILHOUETTE_PRESETS: SilhouettePreset[] = [
  {
    id: 'dome',
    layerRadius: { back: 181, mid: 147, front: 112 },
    angleRange: [-158, -22],
    angleFactor: domeFactor(0.78),
    jitter: [0.94, 1.05],
    rotationJitter: 9,
  },
  {
    id: 'cascade',
    layerRadius: { back: 186, mid: 150, front: 114 },
    angleRange: [-161, -19],
    // Same dome, with one shoulder allowed to reach a little further for a
    // soft asymmetric drape — deliberate, unlike the old accidental lean.
    angleFactor: (angleDeg) => {
      const drape = angleDeg > -60 ? 1 + ((angleDeg + 60) / 48) * 0.12 : 1;
      return domeFactor(0.8)(angleDeg) * drape;
    },
    jitter: [0.92, 1.07],
    rotationJitter: 10,
  },
  {
    id: 'wild',
    layerRadius: { back: 188, mid: 152, front: 116 },
    angleRange: [-163, -17],
    angleFactor: domeFactor(0.86),
    jitter: [0.88, 1.1],
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
