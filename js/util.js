// Shared helpers: seeded randomness, value noise, small math.
'use strict';

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: (t) => t * t * (3 - 2 * t),
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  // Shortest signed difference between two angles.
  angDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },
  valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = U.smooth(x - xi), yf = U.smooth(y - yi);
    const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed);
    const c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
    return U.lerp(U.lerp(a, b, xf), U.lerp(c, d, xf), yf);
  },
  fbm(x, y, seed, oct = 4) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += U.valueNoise(x * f, y * f, seed + i * 101) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  },
  pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; },
  weighted(rng, items, wf) {
    let total = 0;
    for (const it of items) total += Math.max(0, wf(it));
    if (total <= 0) return null;
    let r = rng() * total;
    for (const it of items) { r -= Math.max(0, wf(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  },
  // Gaussian-ish via sum of uniforms.
  gauss(rng) { return (rng() + rng() + rng() + rng() - 2) / 2; },
  fmtKg(kg) { return kg < 1 ? Math.round(kg * 1000) + ' g' : kg.toFixed(2) + ' kg'; },
  fmtMoney(n) { return '$' + Math.floor(n).toLocaleString(); },
  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  },
};

const RNG = U.mulberry32(Date.now() & 0xffffffff);
