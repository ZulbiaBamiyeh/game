/* Seeded RNG. Every artifact is generated from one integer seed, so the same
   accession number always regenerates byte-identical art and text — that is what
   lets the save file store a seed instead of a sprite. */
(function (S7) {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Wraps mulberry32 with the picks the content tables actually ask for. */
  function rng(seed) {
    const r = mulberry32(seed);
    const api = {
      seed: seed >>> 0,
      f: r,
      /* [lo,hi) float */
      range: (lo, hi) => lo + r() * (hi - lo),
      /* [lo,hi] integer */
      int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
      chance: (p) => r() < p,
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      /* Weighted pick. `weight` reads a number off each entry. */
      weighted: (arr, weight) => {
        let total = 0;
        for (const item of arr) total += weight(item);
        let t = r() * total;
        for (const item of arr) {
          t -= weight(item);
          if (t <= 0) return item;
        }
        return arr[arr.length - 1];
      },
      /* Fisher-Yates on a copy. */
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      /* n distinct entries, or all of them if n is too large. */
      sample: (arr, n) => api.shuffle(arr).slice(0, Math.min(n, arr.length)),
      /* Centred, bell-ish. Useful for jitter that should mostly be small. */
      spread: (mag) => (r() + r() + r() - 1.5) * (mag / 1.5),
      fork: () => rng((r() * 4294967296) >>> 0),
    };
    return api;
  }

  /* String -> 32-bit seed, for naming a run rather than numbering it. */
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  S7.rng = rng;
  S7.hashString = hashString;
})(window.S7 = window.S7 || {});
