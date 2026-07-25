// Generador pseudoaleatorio DETERMINISTICO sembrado con la cedula.
// La misma cedula produce siempre exactamente el mismo perfil, lo que hace
// que la demo sea reproducible y que un lote sea estable entre corridas.

// Hash de string -> semilla de 32 bits (xmur3).
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// PRNG mulberry32: rapido, buena distribucion para datos sinteticos.
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next: () => number; // [0, 1)
  int: (min: number, max: number) => number; // entero inclusivo
  pick: <T>(arr: readonly T[]) => T;
  weighted: <T>(items: readonly { value: T; weight: number }[]) => T;
  bool: (p?: number) => boolean;
  normal: (mean: number, sd: number) => number;
  lognormal: (mu: number, sigma: number) => number;
}

export function makeRng(seedStr: string): Rng {
  const seedFn = xmur3(seedStr);
  const rand = mulberry32(seedFn());

  const normal = (mean: number, sd: number): number => {
    // Box-Muller.
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * sd + mean;
  };

  return {
    next: rand,
    int: (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)],
    weighted: <T>(items: readonly { value: T; weight: number }[]): T => {
      const total = items.reduce((s, i) => s + i.weight, 0);
      let r = rand() * total;
      for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item.value;
      }
      return items[items.length - 1].value;
    },
    bool: (p = 0.5) => rand() < p,
    normal,
    lognormal: (mu: number, sigma: number) => Math.exp(normal(mu, sigma)),
  };
}
