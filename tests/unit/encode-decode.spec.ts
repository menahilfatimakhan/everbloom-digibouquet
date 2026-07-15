import { describe, expect, it } from 'vitest';
import { encodeState } from '../../src/builder/state/encode';
import { decodeState } from '../../src/builder/state/decode';
import { createInitialState } from '../../src/builder/state/schema';

describe('state URL encode/decode round-trip', () => {
  it('round-trips a bouquet state exactly', () => {
    const state = {
      ...createInitialState(),
      blooms: [
        { species: 'rose', qty: 4 },
        { species: 'anemone', qty: 3 },
      ],
      greenery: 'eucalyptus',
      card: {
        greeting: 'Menahil',
        message: 'A message with — em dashes, emoji 🌸, and "quotes".',
        signature: 'Everbloom',
        font: 'caveat',
        doodle: 'M10,10 L20,20 L30,10',
      },
    };

    const token = encodeState(state);
    const decoded = decodeState(token);

    expect(decoded).toEqual(state);
  });

  it('returns null for a garbage token instead of throwing', () => {
    expect(decodeState('not-a-real-token')).toBeNull();
    expect(decodeState('')).toBeNull();
  });

  it('rejects a token whose schema version is newer than supported', () => {
    const state = { ...createInitialState(), v: 999 };
    const token = encodeState(state);
    expect(decodeState(token)).toBeNull();
  });

  it('rejects structurally invalid decoded payloads', () => {
    const token = encodeState({ v: 1, blooms: 'not-an-array' } as never);
    expect(decodeState(token)).toBeNull();
  });
});
