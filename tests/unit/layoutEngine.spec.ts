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

  it('changing the greenery species does not move bloom placements (independent sub-seed)', () => {
    const a = composeLayout(baseState, FLOWER_META);
    const b = composeLayout({ ...baseState, greenery: 'fern' }, FLOWER_META);
    expect(a.blooms).toEqual(b.blooms);
    expect(a.greenery.map((g) => ({ ...g, assetId: 'x' }))).toEqual(
      b.greenery.map((g) => ({ ...g, assetId: 'x' }))
    );
  });

  it('flattenForRender orders placements back-to-front, then top-to-bottom within a layer', () => {
    const layout = composeLayout(baseState, FLOWER_META);
    const flat = flattenForRender(layout);
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
