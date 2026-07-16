import { describe, expect, it } from 'vitest';
import { createBouquetStore } from '../../src/builder/state/bouquetState';
import { createInitialState, MAX_BLOOMS } from '../../src/builder/state/schema';

describe('bouquetState mutators', () => {
  it('adds and accumulates quantity per species', () => {
    const store = createBouquetStore(createInitialState());
    store.addBloom('rose');
    store.addBloom('rose');
    store.addBloom('peony');
    expect(store.speciesQty('rose')).toBe(2);
    expect(store.speciesQty('peony')).toBe(1);
    expect(store.totalQty()).toBe(3);
  });

  it('refuses to add past MAX_BLOOMS', () => {
    const store = createBouquetStore(createInitialState());
    for (let i = 0; i < MAX_BLOOMS + 5; i++) store.addBloom('rose');
    expect(store.totalQty()).toBe(MAX_BLOOMS);
  });

  it('decrementBloom removes the species entirely at qty 1', () => {
    const store = createBouquetStore(createInitialState());
    store.addBloom('rose');
    store.decrementBloom('rose');
    expect(store.speciesQty('rose')).toBe(0);
    expect(store.getState().blooms.find((b) => b.species === 'rose')).toBeUndefined();
  });

  it('removeSpecies clears a species regardless of quantity', () => {
    const store = createBouquetStore(createInitialState());
    store.addBloom('rose');
    store.addBloom('rose');
    store.addBloom('rose');
    store.removeSpecies('rose');
    expect(store.speciesQty('rose')).toBe(0);
  });

  it('applyOccasion sets card.message when a suggestion is provided', () => {
    const store = createBouquetStore(createInitialState());
    store.applyOccasion('birthday', [{ species: 'sunflower', qty: 6 }], 'sunset-blush', 'Happy birthday!');
    expect(store.getState().card.message).toBe('Happy birthday!');
    expect(store.getState().occasion).toBe('birthday');
    expect(store.getState().presentation.theme).toBe('sunset-blush');
  });

  it('applyOccasion leaves card.message untouched when no suggestion is provided', () => {
    const store = createBouquetStore(createInitialState());
    store.setCard({ message: 'My own words' });
    store.applyOccasion('congrats', [{ species: 'tulip', qty: 6 }], 'lavender-dream');
    expect(store.getState().card.message).toBe('My own words');
  });

  it('applyOccasion overwrites a previous suggestion on a second call', () => {
    const store = createBouquetStore(createInitialState());
    store.applyOccasion('birthday', [{ species: 'sunflower', qty: 6 }], 'sunset-blush', 'First message');
    store.applyOccasion('sympathy', [{ species: 'lily', qty: 6 }], 'ivory-sage', 'Second message');
    expect(store.getState().card.message).toBe('Second message');
  });

  it('reshuffleArrangement changes the seed', () => {
    const store = createBouquetStore(createInitialState());
    const before = store.getState().arrangementSeed;
    store.reshuffleArrangement();
    expect(store.getState().arrangementSeed).not.toBe(before);
  });

  it('subscribers are notified on every mutation', () => {
    const store = createBouquetStore(createInitialState());
    let calls = 0;
    store.subscribe(() => calls++);
    store.addBloom('rose');
    store.setGreenery('fern');
    store.setCard({ greeting: 'Hi' });
    expect(calls).toBe(3);
  });
});
