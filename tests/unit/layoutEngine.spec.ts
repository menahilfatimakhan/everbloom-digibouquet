import { describe, expect, it } from 'vitest';
import { composeLayout, flattenForRender, type SpeciesMeta } from '../../src/builder/composition/layoutEngine';

const FLOWER_META: Record<string, SpeciesMeta> = {
  rose: { footprintRadius: 40, layerBias: 'front' },
  peony: { footprintRadius: 46, layerBias: 'front' },
  anemone: { footprintRadius: 36, layerBias: 'mid' },
  delphinium: { footprintRadius: 26, layerBias: 'back' },
};

const baseState = {
  blooms: [
    { species: 'rose', qty: 3 },
    { species: 'peony', qty: 2 },
    { species: 'anemone', qty: 2 },
  ],
  arrangementSeed: 42,
  greenery: 'eucalyptus',
};

describe('composeLayout', () => {
  it('is deterministic for a given seed + state', () => {
    const a = composeLayout(baseState, FLOWER_META);
    const b = composeLayout(baseState, FLOWER_META);
    expect(a).toEqual(b);
  });

  it('produces a different layout for a different seed', () => {
    const a = composeLayout(baseState, FLOWER_META);
    const b = composeLayout({ ...baseState, arrangementSeed: 43 }, FLOWER_META);
    expect(a.blooms).not.toEqual(b.blooms);
  });

  it('produces one bloom placement per unit of quantity, across all species', () => {
    const layout = composeLayout(baseState, FLOWER_META);
    expect(layout.blooms).toHaveLength(7); // 3 + 2 + 2
    const bySpecies = layout.blooms.reduce<Record<string, number>>((acc, p) => {
      acc[p.assetId] = (acc[p.assetId] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySpecies).toEqual({ rose: 3, peony: 2, anemone: 2 });
  });

  it('places greenery as a single spray behind the blooms, whatever the bloom count', () => {
    // Each greenery asset is a whole gathered bunch, so it gets placed once and
    // sized to back the arrangement. Repeating it — as the old sprig ring did —
    // reads as several tiny bouquets rather than one bed of foliage.
    for (const qty of [1, 4, 10]) {
      const layout = composeLayout({ ...baseState, blooms: [{ species: 'rose', qty }] }, FLOWER_META);
      expect(layout.greenery).toHaveLength(1);
      expect(layout.greenery[0].layer).toBe('back');
    }

    const layout = composeLayout(baseState, FLOWER_META);
    const [spray] = layout.greenery;
    // Wider than any bloom, and centred, so blooms nestle into it rather than
    // sitting beside it.
    const widest = Math.max(...layout.blooms.map((b) => b.footprintRadius));
    expect(spray.footprintRadius).toBeGreaterThan(widest * 2);
    expect(spray.x).toBe(layout.center.x);
    // Every bloom paints over it.
    expect(flattenForRender(layout)[0].id).toBe(spray.id);
  });

  it('changing the greenery species does not move bloom placements (independent sub-seed)', () => {
    const a = composeLayout(baseState, FLOWER_META);
    const b = composeLayout({ ...baseState, greenery: 'fern' }, FLOWER_META);
    expect(a.blooms).toEqual(b.blooms);
    expect(a.greenery.map((g) => ({ ...g, assetId: 'x' }))).toEqual(
      b.greenery.map((g) => ({ ...g, assetId: 'x' }))
    );
  });

  it('flattenForRender orders blooms back-to-front, then top-to-bottom within a layer', () => {
    const layout = composeLayout(baseState, FLOWER_META);
    // The greenery backdrop is painted ahead of all of them and is excluded
    // from this ordering by design — see flattenForRender.
    const flat = flattenForRender(layout).filter((p) => p.kind === 'bloom');
    const layerRank = { back: 0, mid: 1, front: 2 } as const;
    for (let i = 1; i < flat.length; i++) {
      const prev = flat[i - 1];
      const curr = flat[i];
      const prevRank = layerRank[prev.layer];
      const currRank = layerRank[curr.layer];
      expect(currRank).toBeGreaterThanOrEqual(prevRank);
      if (currRank === prevRank) {
        expect(curr.y).toBeGreaterThanOrEqual(prev.y);
      }
    }
  });
});
