// Sunrise Courier — screenshot staging for the entry's own screenshots.
// ?shot=title|flight|rings|landing&seed=N puts the game into a fixed,
// deterministic state and renders one frame, so the screenshots shipped
// with the entry are real renders of this code in a browser. Normal play
// never passes ?shot=, so this path changes nothing for the player.
// The staging also writes diagnostics into #diag: resource loads, errors.

import { MISSIONS } from './config.js';
import { buildTerrain, buildRingCourse } from './terrain.js';
import { createPlane, stepFlight } from './plane.js';

const FIXED_DT = 1 / 60;

export function parseShotQuery(search) {
  const params = new URLSearchParams(search);
  return {
    shot: params.get('shot') || '',
    seed: Number(params.get('seed') || 1),
  };
}

// Build the exact state one named shot shows. Returns { world, plane,
// rings, mission, screen } where screen is 'title' | 'flying' | 'ended'.
export function stageShot(shot, seed) {
  const mission = MISSIONS[0];
  const world = buildTerrain(20261126 + seed);
  const rings = buildRingCourse(mission, 20261126 + seed);
  const plane = createPlane(mission);

  if (shot === 'title') {
    return { world, plane, rings, mission, screen: 'title', selectedMission: 0 };
  }

  if (shot === 'flight') {
    // Cruise at full throttle toward the first ring, steering onto its
    // line, frozen about 300 m out: the hoop fills the frame ahead,
    // runway and river behind, HUD lit.
    flyTowardRing(plane, rings, 0, 300);
    const dist = Math.max(0, Math.round(rings[0].z - plane.z));
    plane.message = `RING 1/6 — ${dist} M`;
    plane.messageTimer = 99;
    return { world, plane, rings, mission, screen: 'flying', selectedMission: 0 };
  }

  if (shot === 'rings') {
    // Thread the first ring and close on the second: the hoop fills the
    // frame and the score has already ticked up.
    simulateUntilRing(plane, rings, 0);
    flyTowardRing(plane, rings, 1, 260);
    return { world, plane, rings, mission, screen: 'flying', selectedMission: 0 };
  }

  if (shot === 'landing') {
    // Final approach: low over the threshold, gear down, runway filling
    // the frame, speed bled back for touchdown.
    for (const ring of rings) ring.passed = true;
    plane.x = 6;
    plane.z = -260;
    plane.alt = 26;
    plane.heading = 0;
    plane.pitch = -0.04;
    plane.roll = 0;
    plane.speed = 46;
    plane.throttle = 0.35;
    plane.fuel = 61;
    plane.score = 625;
    plane.ringsPassed = 6;
    simulate(plane, rings, 150, { bank: 0, pitch: -0.04, throttleDelta: 0 });
    return { world, plane, rings, mission, screen: 'flying', selectedMission: 0 };
  }

  return { world, plane, rings, mission, screen: 'title', selectedMission: 0 };
}

function simulate(plane, rings, steps, controls) {
  for (let i = 0; i < steps; i++) {
    if (plane.crashed || plane.landed) break;
    stepFlight(plane, controls, rings, FIXED_DT);
  }
}

// Fly toward a ring until `stopBefore` metres out (or 40 s pass), steering
// onto its line and matching its altitude. Steering aims at the heading
// that points at the ring, not just at the offset, so the approach
// converges instead of oscillating across the line.
function steerTowardRing(plane, ring) {
  const desiredHeading = Math.atan2(ring.x - plane.x, ring.z - plane.z);
  let headingError = desiredHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const bank = Math.max(-0.6, Math.min(0.6, headingError * 2.2));
  const climb = ring.y > plane.alt + 4 ? 0.14 : ring.y < plane.alt - 4 ? -0.12 : 0;
  return { bank, pitch: climb, throttleDelta: 1, brake: false };
}

function flyTowardRing(plane, rings, index, stopBefore) {
  const ring = rings[index];
  for (let i = 0; i < 2400; i++) {
    if (plane.crashed || plane.landed) break;
    if (ring.z - plane.z <= stopBefore) break;
    stepFlight(plane, steerTowardRing(plane, ring), rings, FIXED_DT);
  }
}

// Fly straight until the named ring is scored (or 40 s pass).
function simulateUntilRing(plane, rings, index) {
  for (let i = 0; i < 2400; i++) {
    if (plane.crashed || plane.landed || rings[index].passed) break;
    stepFlight(plane, steerTowardRing(plane, rings[index]), rings, FIXED_DT);
  }
}

// Diagnostics for the maker: how many resources loaded, any errors seen.
export function writeShotDiagnostics() {
  const diag = document.getElementById('diag');
  if (!diag) return;
  const resources = performance.getEntriesByType('resource') || [];
  const external = resources.filter((r) => !r.name.startsWith(window.location.origin));
  diag.textContent = JSON.stringify({
    resources: resources.length,
    external: external.length,
    errors: window.__shotErrors ? window.__shotErrors.length : 0,
  });
  document.title = 'shot-ready';
}
