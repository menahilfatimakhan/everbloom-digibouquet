import { describe, expect, it } from 'vitest';
import { FLORIOGRAPHY, FLOWERS, MEANING_BY_ID } from '../../src/builder/assetRegistry';

describe('floriography.json <-> flowers.json id sync', () => {
  it('has exactly one floriography entry per flower, matching ids', () => {
    const flowerIds = new Set(FLOWERS.map((f) => f.id));
    const floriographyIds = new Set(FLORIOGRAPHY.map((f) => f.id));

    expect(floriographyIds).toEqual(flowerIds);
  });

  it('every meaning is a non-empty string', () => {
    for (const entry of FLORIOGRAPHY) {
      expect(entry.meaning.length).toBeGreaterThan(0);
    }
  });

  it('MEANING_BY_ID resolves every flower id', () => {
    for (const flower of FLOWERS) {
      expect(MEANING_BY_ID[flower.id]).toBeTruthy();
    }
  });
});
