import {
  createInitialState,
  MAX_BLOOMS,
  type BouquetState,
  type CardState,
  type PresentationState,
} from './schema';

type Listener = (state: BouquetState) => void;

/**
 * Hand-rolled store: one mutable state object, explicit named mutators, and a
 * tiny pub/sub for re-render. No framework/library — keeps the builder's
 * logic readable without learning Redux/Zustand/Svelte-store conventions.
 */
export function createBouquetStore(initial?: BouquetState) {
  let state: BouquetState = initial ?? createInitialState();
  const listeners = new Set<Listener>();

  function notify() {
    for (const listener of listeners) listener(state);
  }

  function getState(): BouquetState {
    return state;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function replaceState(next: BouquetState) {
    state = next;
    notify();
  }

  function speciesQty(speciesId: string): number {
    return state.blooms.find((b) => b.species === speciesId)?.qty ?? 0;
  }

  function totalQty(): number {
    return state.blooms.reduce((sum, b) => sum + b.qty, 0);
  }

  function addBloom(speciesId: string) {
    if (totalQty() >= MAX_BLOOMS) return;
    const existing = state.blooms.find((b) => b.species === speciesId);
    const blooms = existing
      ? state.blooms.map((b) => (b.species === speciesId ? { ...b, qty: b.qty + 1 } : b))
      : [...state.blooms, { species: speciesId, qty: 1 }];
    state = { ...state, blooms };
    notify();
  }

  function removeSpecies(speciesId: string) {
    state = { ...state, blooms: state.blooms.filter((b) => b.species !== speciesId) };
    notify();
  }

  function decrementBloom(speciesId: string) {
    const existing = state.blooms.find((b) => b.species === speciesId);
    if (!existing) return;
    if (existing.qty <= 1) {
      removeSpecies(speciesId);
      return;
    }
    state = {
      ...state,
      blooms: state.blooms.map((b) => (b.species === speciesId ? { ...b, qty: b.qty - 1 } : b)),
    };
    notify();
  }

  function setGreenery(greeneryId: string | null) {
    state = { ...state, greenery: greeneryId };
    notify();
  }

  function reshuffleArrangement() {
    state = { ...state, arrangementSeed: Math.floor(Math.random() * 2 ** 31) };
    notify();
  }

  function applyOccasion(
    occasionId: string,
    blooms: { species: string; qty: number }[],
    theme: string,
    cardMessage?: string
  ) {
    state = {
      ...state,
      occasion: occasionId,
      blooms,
      presentation: { ...state.presentation, theme },
      arrangementSeed: Math.floor(Math.random() * 2 ** 31),
      card: cardMessage !== undefined ? { ...state.card, message: cardMessage } : state.card,
    };
    notify();
  }

  function setPresentation(partial: Partial<PresentationState>) {
    state = { ...state, presentation: { ...state.presentation, ...partial } };
    notify();
  }

  function setCard(partial: Partial<CardState>) {
    state = { ...state, card: { ...state.card, ...partial } };
    notify();
  }

  return {
    getState,
    subscribe,
    replaceState,
    speciesQty,
    totalQty,
    addBloom,
    removeSpecies,
    decrementBloom,
    setGreenery,
    reshuffleArrangement,
    applyOccasion,
    setPresentation,
    setCard,
  };
}

export type BouquetStore = ReturnType<typeof createBouquetStore>;
