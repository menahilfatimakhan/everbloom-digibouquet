export const SCHEMA_VERSION = 1;

export const MIN_BLOOMS = 6;
export const MAX_BLOOMS = 10;

export const CARD_LIMITS = {
  greeting: 40,
  message: 500,
  signature: 40,
} as const;

export interface BloomSelection {
  species: string;
  qty: number;
}

export interface PresentationState {
  type: 'wrap' | 'vase';
  wrap: string | null;
  vase: string | null;
  ribbon: string | null;
  theme: string;
}

export interface CardState {
  greeting: string;
  message: string;
  signature: string;
  font: string;
  /** id into content/cardThemes.json — the card panel's own paper/border look.
   * Added after v1 shipped; intentionally does NOT bump SCHEMA_VERSION (see
   * decode.ts) since isValidBouquetState() never validated card.font either —
   * old tokens missing this field decode fine and get a default at read time. */
  theme: string;
  /** SVG path `d` data drawn on a 300x100 signature pad, or null if skipped. */
  doodle: string | null;
}

export interface BouquetState {
  v: number;
  blooms: BloomSelection[];
  greenery: string | null;
  arrangementSeed: number;
  occasion: string | null;
  presentation: PresentationState;
  card: CardState;
}

export function createInitialState(): BouquetState {
  return {
    v: SCHEMA_VERSION,
    blooms: [],
    greenery: null,
    arrangementSeed: Math.floor(Math.random() * 2 ** 31),
    occasion: null,
    presentation: {
      type: 'wrap',
      wrap: 'kraft-cone',
      vase: null,
      ribbon: 'satin-bow',
      theme: 'lavender-dream',
    },
    card: {
      greeting: '',
      message: '',
      signature: '',
      font: 'monospace',
      theme: 'classic-cream',
      doodle: null,
    },
  };
}

export function totalBloomCount(state: Pick<BouquetState, 'blooms'>): number {
  return state.blooms.reduce((sum, b) => sum + b.qty, 0);
}

export function isBloomCountValid(state: Pick<BouquetState, 'blooms'>): boolean {
  const total = totalBloomCount(state);
  return total >= MIN_BLOOMS && total <= MAX_BLOOMS;
}

/**
 * Structural validation for state arriving over the wire (URL token or API
 * payload) — not exhaustive content validation, just enough to guarantee the
 * rest of the app can safely read the shape without throwing.
 */
export function isValidBouquetState(value: unknown): value is BouquetState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<BouquetState>;
  if (typeof s.v !== 'number') return false;
  if (!Array.isArray(s.blooms)) return false;
  if (
    !s.blooms.every(
      (b) => b && typeof b.species === 'string' && typeof b.qty === 'number' && b.qty > 0
    )
  ) {
    return false;
  }
  if (typeof s.arrangementSeed !== 'number') return false;
  if (!s.presentation || typeof s.presentation !== 'object') return false;
  if (!s.card || typeof s.card !== 'object') return false;
  if (typeof s.card.greeting !== 'string' || typeof s.card.message !== 'string') return false;
  return true;
}

/**
 * Fills in defaults for fields added after a record/token was created, so
 * older data (missing e.g. `card.theme`) still renders correctly instead of
 * needing a SCHEMA_VERSION bump + migration. Call after isValidBouquetState
 * has already confirmed the base shape. Safe to call on already-complete
 * state — every fill is a no-op if the field is already present.
 */
export function hydrateBouquetState(state: BouquetState): BouquetState {
  if (!state.card.theme) {
    state = { ...state, card: { ...state.card, theme: 'classic-cream' } };
  }
  return state;
}
