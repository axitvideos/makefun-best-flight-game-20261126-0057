// Sunrise Courier — deterministic randomness.
// Every random choice in the world comes from a seeded generator, so the same
// seed always builds the same valley, the same fields and the same clouds.
// Screenshots and replays can therefore be reproduced exactly.

export function makeSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable 0..1 hash of an integer grid cell, for terrain colours that never
// shimmer as the camera moves: the same cell always draws the same field.
export function hashCell(cellX, cellZ, seed) {
  let h = (cellX * 374761393 + cellZ * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth 1D value noise for the river meander and the hill skyline.
export function smoothNoise1D(x, seed) {
  const xi = Math.floor(x);
  const frac = x - xi;
  const a = hashCell(xi, 0, seed);
  const b = hashCell(xi + 1, 0, seed);
  const u = frac * frac * (3 - 2 * frac);
  return a + (b - a) * u;
}
