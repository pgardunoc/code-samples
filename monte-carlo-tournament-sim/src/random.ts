// Small seedable PRNG (mulberry32). Every simulation run is reproducible from
// its seed — if you can't replay a run, you can't debug why the model spat out
// a given probability, and "trust me, it was 62%" is not a model.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Knuth's algorithm for sampling from a Poisson distribution. Goals in a
// football match are well-approximated by a Poisson process, which is why it's
// the workhorse of most scoreline models: one parameter (expected goals) gives
// you a whole distribution of plausible scorelines.
export function samplePoisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}
