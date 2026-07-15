/**
 * mulberry32 — small, fast, deterministic PRNG. Same seed always produces
 * the same sequence, which is what makes arrangements reproducible (the
 * recipient sees exactly what the sender saw) and reshuffles a deliberate
 * "roll a new seed" action rather than nondeterministic layout.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

export function pickWeighted<T>(random: () => number, items: [T, number][]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
}
