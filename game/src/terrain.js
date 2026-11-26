// Sunrise Courier — the valley the game flies over.
// The world is procedural but fixed: one seeded layout with an airfield at the
// origin, a river valley, a road, patchwork fields and a course of target rings.
// Terrain here is data only; render.js turns it into pixels.

import { WORLD, PALETTE } from './config.js';
import { makeSeededRandom, hashCell, smoothNoise1D } from './rng.js';

export function buildTerrain(seed) {
  const random = makeSeededRandom(seed);

  // The river winds north through the valley, west of the runway.
  const riverPoints = [];
  for (let z = -2200; z <= 3200; z += 100) {
    const x = -520 + (smoothNoise1D(z * 0.0011, seed + 7) - 0.5) * 420;
    riverPoints.push({ x, z });
  }

  // Scattered trees: deterministic dots the renderer draws when close.
  const trees = [];
  for (let i = 0; i < 900; i++) {
    const x = (random() - 0.5) * 5200;
    const z = -2000 + random() * 5200;
    if (Math.abs(x) < 70 && z > -100 && z < 1000) continue; // keep the runway clear
    if (Math.abs(x + 520) < 60) continue; // keep the river clear
    trees.push({ x, z, size: 5 + random() * 7 });
  }

  // Clouds drift slowly; their base positions are fixed by the seed.
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: (random() - 0.5) * 5200,
      z: -1800 + random() * 4800,
      y: 260 + random() * 260,
      scale: 60 + random() * 130,
      drift: 1.5 + random() * 2.5,
    });
  }

  // Distant hill ridge: a skyline silhouette drawn behind the terrain.
  const hills = [];
  for (let i = 0; i < 48; i++) {
    hills.push({
      angle: (i / 48) * Math.PI * 2,
      height: 0.03 + smoothNoise1D(i * 0.35, seed + 21) * 0.10,
      shade: 0.55 + smoothNoise1D(i * 0.5, seed + 33) * 0.3,
    });
  }

  return { seed, riverPoints, trees, clouds, hills };
}

// Field colour for one terrain cell, stable across frames.
export function fieldColourForCell(cellX, cellZ, seed) {
  const h = hashCell(cellX, cellZ, seed);
  const palette = PALETTE.fieldGreens;
  return palette[Math.floor(h * palette.length) % palette.length];
}

// Centre x of the river at a given z (for the renderer and for ring safety).
export function riverXAt(z, seed) {
  return -520 + (smoothNoise1D(z * 0.0011, seed + 7) - 0.5) * 420;
}

// The ring course for a mission: rings weave across the valley, climbing
// gently, always ahead of the runway so the first one is visible on takeoff.
export function buildRingCourse(mission, seed) {
  const random = makeSeededRandom(seed + 101);
  const rings = [];
  let z = 650;
  let x = 0;
  let y = 75;
  for (let i = 0; i < mission.rings; i++) {
    const prevX = x;
    // Small lateral steps and a long enough leg between rings: the next
    // hoop must always be reachable without a desperate turn.
    x = Math.max(-420, Math.min(420, x + (random() - 0.5) * 360));
    if (Math.abs(x - prevX) > 200) x = prevX + Math.sign(x - prevX) * 200;
    if (i > 0 && Math.abs(x - riverXAt(z, seed)) < 90) x += x > 0 ? 120 : -120;
    y = Math.max(45, Math.min(150, y + (random() - 0.5) * 55));
    z += 480 + random() * 220;
    rings.push({ x, y, z, radius: 22, passed: false, centred: false });
  }
  // Final ring swings back toward the runway for the landing leg.
  const last = rings[rings.length - 1];
  if (last) {
    last.x = Math.max(-160, Math.min(160, last.x * 0.4));
    last.y = 70;
  }
  return rings;
}

// Is a ground point on the runway strip?
export function isOnRunway(x, z) {
  return (
    Math.abs(x) <= WORLD.runwayHalfWidth &&
    z >= WORLD.runwayStartZ - 40 &&
    z <= WORLD.runwayEndZ + 40
  );
}
