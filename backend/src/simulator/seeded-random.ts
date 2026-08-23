export interface SeededRandom {
  next(): number;
  int(maxExclusive: number): number;
  intInclusive(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

/** Mulberry32 — same seed always yields the same sequence. */
export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;

  function next(): number {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    int(maxExclusive: number): number {
      if (maxExclusive <= 0) {
        throw new Error("maxExclusive must be positive");
      }
      return Math.floor(next() * maxExclusive);
    },
    intInclusive(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty list");
      }
      return items[Math.floor(next() * items.length)] as T;
    },
  };
}

export function shuffleInPlace<T>(items: T[], random: SeededRandom): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = random.int(i + 1);
    const current = items[i] as T;
    items[i] = items[j] as T;
    items[j] = current;
  }
  return items;
}
