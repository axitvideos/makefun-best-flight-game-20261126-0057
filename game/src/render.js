// Sunrise Courier — the chase-camera renderer.
// A pinhole camera rides behind the aircraft and looks down the valley:
// sky, sun and a hill skyline above the horizon, projected patchwork fields,
// river, road and runway below it, target rings floating ahead, and the
// courier herself drawn as a banked sprite in the middle of the frame.

import { VIEW_WIDTH, VIEW_HEIGHT, CAMERA, WORLD, PALETTE } from './config.js';
import { fieldColourForCell } from './terrain.js';

const W = VIEW_WIDTH;
const H = VIEW_HEIGHT;
const FOCAL = (H / 2) / Math.tan(CAMERA.fov / 2);

export function createCamera() {
  return { x: 0, y: 0, z: 0, heading: 0, pitch: CAMERA.pitchDown };
}

// Chase the plane: sit behind and above her, look ahead down the nose.
export function updateCamera(camera, plane) {
  const sinH = Math.sin(plane.heading);
  const cosH = Math.cos(plane.heading);
  camera.x = plane.x - sinH * CAMERA.behind;
  camera.z = plane.z - cosH * CAMERA.behind;
  camera.y = plane.alt + CAMERA.above;
  camera.heading = plane.heading;
  camera.pitch = CAMERA.pitchDown + plane.pitch * 0.35;
}

// Project a world point to screen space. Returns null behind the camera.
export function project(camera, wx, wy, wz) {
  const dx = wx - camera.x;
  const dz = wz - camera.z;
  const dy = wy - camera.y;
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  const fwd = dx * sinH + dz * cosH;
  const rgt = dx * cosH - dz * sinH;
  if (fwd < 2) return null;
  const cosP = Math.cos(camera.pitch);
  const sinP = Math.sin(camera.pitch);
  const fwd2 = fwd * cosP + dy * sinP;
  const up2 = -fwd * sinP + dy * cosP;
  if (fwd2 < 2) return null;
  const horizonY = H * 0.5 - Math.tan(camera.pitch) * FOCAL;
  return {
    x: W / 2 + (rgt * FOCAL) / fwd2,
    y: horizonY - (up2 * FOCAL) / fwd2,
    depth: fwd2,
    scale: FOCAL / fwd2,
  };
}

export function horizonScreenY(camera) {
  return H * 0.5 - Math.tan(camera.pitch) * FOCAL;
}

// One full frame: sky, terrain, rings, aircraft, in painter's order.
export function renderFrame(ctx, world, plane, rings, camera, time) {
  drawSky(ctx, camera, world, time);
  drawGround(ctx, world, plane, camera, time);
  drawRings(ctx, rings, camera, time);
  drawPlaneShadow(ctx, plane, camera);
  drawPlaneSprite(ctx, plane);
}

function drawSky(ctx, camera, world, time) {
  const horizonY = horizonScreenY(camera);
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.55, PALETTE.skyMid);
  sky.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, Math.max(horizonY, 1));

  // Low sun, ahead-left of the dawn heading so it stays in frame but
  // never sits dead centre behind the flight-path messages.
  const sunX = W * 0.30 + Math.sin(camera.heading * 2) * 24;
  const sunY = horizonY - H * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
  glow.addColorStop(0, 'rgba(255, 233, 176, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 190, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  ctx.fillStyle = PALETTE.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();

  // Hill skyline: a dark ridge that turns with the heading.
  ctx.fillStyle = '#2c3350';
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let i = 0; i <= 64; i++) {
    const frac = i / 64;
    const viewAngle = (frac - 0.5) * 1.9; // radians across the screen
    const worldAngle = camera.heading + viewAngle;
    const wrapped = ((worldAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.floor((wrapped / (Math.PI * 2)) * world.hills.length) % world.hills.length;
    const hill = world.hills[idx];
    ctx.lineTo(frac * W, horizonY - hill.height * H * hill.shade);
  }
  ctx.lineTo(W, horizonY);
  ctx.closePath();
  ctx.fill();

  // Clouds drift with time; far ones drawn first so near ones overlap.
  const sorted = [...world.clouds].sort((a, b) => {
    const da = cloudDepth(a, camera, time);
    const db = cloudDepth(b, camera, time);
    return db - da;
  });
  for (const cloud of sorted) drawCloud(ctx, cloud, camera, time);
}

function cloudDepth(cloud, camera, time) {
  const cx = cloud.x + time * cloud.drift;
  const dx = cx - camera.x;
  const dz = cloud.z - camera.z;
  return dx * Math.sin(camera.heading) + dz * Math.cos(camera.heading);
}

function drawCloud(ctx, cloud, camera, time) {
  const cx = cloud.x + time * cloud.drift;
  const p = project(camera, cx, cloud.y, cloud.z);
  if (!p || p.depth < 30) return;
  const s = p.scale * cloud.scale;
  if (s < 4) return;
  ctx.fillStyle = 'rgba(255, 244, 230, 0.85)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x - s * 0.55, p.y + s * 0.08, s * 0.6, s * 0.24, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x + s * 0.55, p.y + s * 0.06, s * 0.65, s * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround(ctx, world, plane, camera) {
  const horizonY = horizonScreenY(camera);
  // Base ground wash so no gap ever shows sky below the horizon.
  const wash = ctx.createLinearGradient(0, horizonY, 0, H);
  wash.addColorStop(0, '#6b5a3d');
  wash.addColorStop(0.25, PALETTE.groundBase);
  wash.addColorStop(1, '#2c4426');
  ctx.fillStyle = wash;
  ctx.fillRect(0, Math.max(horizonY, 0), W, H - Math.max(horizonY, 0));

  // Patchwork fields: project each cell's four corners, far cells first.
  const cell = WORLD.cellSize;
  const range = WORLD.viewDistance;
  const minCX = Math.floor((plane.x - range) / cell);
  const maxCX = Math.floor((plane.x + range) / cell);
  const minCZ = Math.floor((plane.z - range) / cell);
  const maxCZ = Math.floor((plane.z + range) / cell);
  const quads = [];
  for (let cz = minCZ; cz <= maxCZ; cz++) {
    for (let cx = minCX; cx <= maxCX; cx++) {
      const x0 = cx * cell;
      const z0 = cz * cell;
      const centreX = x0 + cell / 2;
      const centreZ = z0 + cell / 2;
      const dx = centreX - camera.x;
      const dz = centreZ - camera.z;
      const fwd = dx * Math.sin(camera.heading) + dz * Math.cos(camera.heading);
      if (fwd < 10 || fwd > range) continue;
      quads.push({ cx, cz, x0, z0, fwd });
    }
  }
  quads.sort((a, b) => b.fwd - a.fwd);
  for (const q of quads) {
    const p00 = project(camera, q.x0, 0, q.z0);
    const p10 = project(camera, q.x0 + cell, 0, q.z0);
    const p11 = project(camera, q.x0 + cell, 0, q.z0 + cell);
    const p01 = project(camera, q.x0, 0, q.z0 + cell);
    if (!p00 || !p10 || !p11 || !p01) continue;
    ctx.fillStyle = fieldColourForCell(q.cx, q.cz, world.seed);
    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y);
    ctx.lineTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(p01.x, p01.y);
    ctx.closePath();
    ctx.fill();
  }

  drawRiver(ctx, world, camera);
  drawRoad(ctx, camera);
  drawRunway(ctx, camera);
  drawTrees(ctx, world, camera);
}

// The river as a ribbon of projected quads following its meander.
function drawRiver(ctx, world, camera) {
  ctx.fillStyle = PALETTE.river;
  for (let i = 0; i < world.riverPoints.length - 1; i++) {
    const a = world.riverPoints[i];
    const b = world.riverPoints[i + 1];
    const half = 26;
    const pA1 = project(camera, a.x - half, 0.5, a.z);
    const pA2 = project(camera, a.x + half, 0.5, a.z);
    const pB1 = project(camera, b.x - half, 0.5, b.z);
    const pB2 = project(camera, b.x + half, 0.5, b.z);
    if (!pA1 || !pA2 || !pB1 || !pB2) continue;
    ctx.beginPath();
    ctx.moveTo(pA1.x, pA1.y);
    ctx.lineTo(pB1.x, pB1.y);
    ctx.lineTo(pB2.x, pB2.y);
    ctx.lineTo(pA2.x, pA2.y);
    ctx.closePath();
    ctx.fill();
  }
}

// The valley road runs north-south east of the airfield, dashed centre line.
function drawRoad(ctx, camera) {
  const roadX = 420;
  const half = 7;
  drawStrip(ctx, camera, roadX - half, roadX + half, -2200, 3200, PALETTE.road);
  ctx.fillStyle = '#e8e2c8';
  for (let z = -2100; z < 3200; z += 90) {
    drawStrip(ctx, camera, roadX - 1.2, roadX + 1.2, z, z + 45, '#e8e2c8');
  }
}

function drawStrip(ctx, camera, x0, x1, z0, z1, colour) {
  const p00 = project(camera, x0, 0.6, z0);
  const p10 = project(camera, x1, 0.6, z0);
  const p11 = project(camera, x1, 0.6, z1);
  const p01 = project(camera, x0, 0.6, z1);
  if (!p00 || !p10 || !p11 || !p01) return;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(p00.x, p00.y);
  ctx.lineTo(p10.x, p10.y);
  ctx.lineTo(p11.x, p11.y);
  ctx.lineTo(p01.x, p01.y);
  ctx.closePath();
  ctx.fill();
}

// Runway 27: asphalt strip with threshold bars, centre dashes and numbers.
function drawRunway(ctx, camera) {
  const hw = WORLD.runwayHalfWidth;
  drawStrip(ctx, camera, -hw, hw, WORLD.runwayStartZ, WORLD.runwayEndZ, PALETTE.runway);
  // Threshold bars at both ends.
  for (const z of [WORLD.runwayStartZ + 18, WORLD.runwayEndZ - 18]) {
    for (let k = -2; k <= 2; k++) {
      drawStrip(ctx, camera, k * 8 - 2.5, k * 8 + 2.5, z - 12, z + 12, PALETTE.runwayMark);
    }
  }
  // Centreline dashes.
  ctx.fillStyle = PALETTE.runwayMark;
  for (let z = WORLD.runwayStartZ + 90; z < WORLD.runwayEndZ - 60; z += 90) {
    drawStrip(ctx, camera, -1.5, 1.5, z, z + 42, PALETTE.runwayMark);
  }
  // Runway number "27" near the near threshold, drawn as two projected bars.
  drawRunwayNumber(ctx, camera);
}

function drawRunwayNumber(ctx, camera) {
  const p = project(camera, 0, 1, WORLD.runwayStartZ + 300);
  if (!p || p.depth > 700) return;
  const s = p.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(s * 0.9, s * 0.9);
  ctx.fillStyle = PALETTE.runwayMark;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('27', 0, 0);
  ctx.restore();
}

// Trees are cheap dots that only appear when close enough to read:
// a trunk tick and a two-lobed canopy so they read as trees, not blobs.
function drawTrees(ctx, world, camera) {
  for (const tree of world.trees) {
    const dx = tree.x - camera.x;
    const dz = tree.z - camera.z;
    const fwd = dx * Math.sin(camera.heading) + dz * Math.cos(camera.heading);
    if (fwd < 8 || fwd > 900) continue;
    const p = project(camera, tree.x, 0, tree.z);
    if (!p) continue;
    const r = Math.max(1, p.scale * tree.size * 0.4);
    ctx.fillStyle = '#24401f';
    ctx.beginPath();
    ctx.arc(p.x - r * 0.4, p.y - r * 0.7, r * 0.75, 0, Math.PI * 2);
    ctx.arc(p.x + r * 0.4, p.y - r * 0.8, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f5230';
    ctx.beginPath();
    ctx.arc(p.x, p.y - r * 1.1, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Target rings: glowing hoops standing on the course, pulsing gently.
function drawRings(ctx, rings, camera, time) {
  const sorted = [...rings].filter((r) => !r.passed).sort((a, b) => {
    const da = ringDepth(a, camera);
    const db = ringDepth(b, camera);
    return db - da;
  });
  for (const ring of sorted) drawRing(ctx, ring, camera, time);
}

function ringDepth(ring, camera) {
  const dx = ring.x - camera.x;
  const dz = ring.z - camera.z;
  return dx * Math.sin(camera.heading) + dz * Math.cos(camera.heading);
}

function drawRing(ctx, ring, camera, time) {
  const depth = ringDepth(ring, camera);
  if (depth < 4) return;
  const pulse = 1 + Math.sin(time * 2.4 + ring.z * 0.01) * 0.05;
  const radius = ring.radius * pulse;
  const segments = 20;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    // Ring plane faces the pilot: circle in the plane perpendicular to north.
    const p = project(camera, ring.x + Math.cos(a) * radius, ring.y + Math.sin(a) * radius, ring.z);
    if (!p) return;
    pts.push(p);
  }
  // Soft glow first, then the crisp hoop, then the chevron markers.
  // Minimum widths keep a distant hoop readable instead of hairline.
  ctx.strokeStyle = PALETTE.ringGlow;
  ctx.lineWidth = Math.max(5, pts[0].scale * 7);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = PALETTE.ring;
  ctx.lineWidth = Math.max(3, pts[0].scale * 2.4);
  ctx.stroke();
  const top = project(camera, ring.x, ring.y + radius, ring.z);
  if (top) {
    ctx.fillStyle = PALETTE.ring;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - 12);
    ctx.lineTo(top.x + 9, top.y + 6);
    ctx.lineTo(top.x - 9, top.y + 6);
    ctx.closePath();
    ctx.fill();
  }
}

// Soft ellipse on the ground under the aircraft, fading with altitude.
function drawPlaneShadow(ctx, plane, camera) {
  if (plane.alt > 260) return;
  const p = project(camera, plane.x, 0.4, plane.z);
  if (!p) return;
  const alpha = Math.max(0.08, 0.34 - plane.alt / 800);
  // Screen-sized with altitude: a low plane throws a plane-sized shadow.
  const rx = Math.max(12, 170 - plane.alt * 0.45);
  ctx.fillStyle = `rgba(10, 16, 10, ${alpha.toFixed(2)})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, rx * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

// The courier from behind and above: wings, tail, fuselage, nav lights.
// Drawn fixed at frame centre so the chase camera never fights the pilot.
function drawPlaneSprite(ctx, plane) {
  const cx = W / 2;
  const cy = H * 0.62;
  const bank = plane.roll;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bank);
  // Prop wash blur behind the tail.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.beginPath();
  ctx.ellipse(0, 26, 26, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main wings: tapered, slight dihedral, sunlit top.
  ctx.fillStyle = '#e8e4da';
  ctx.beginPath();
  ctx.moveTo(-150, 6);
  ctx.lineTo(-14, -6);
  ctx.lineTo(14, -6);
  ctx.lineTo(150, 6);
  ctx.lineTo(138, 20);
  ctx.lineTo(0, 12);
  ctx.lineTo(-138, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c94f3d';
  ctx.fillRect(-150, 6, 300, 5);
  // Fuselage: rounded body narrowing to the tail.
  const body = ctx.createLinearGradient(-14, 0, 14, 0);
  body.addColorStop(0, '#d8d2c4');
  body.addColorStop(0.5, '#f4efe2');
  body.addColorStop(1, '#d8d2c4');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -64);
  ctx.quadraticCurveTo(15, -40, 13, 6);
  ctx.quadraticCurveTo(12, 34, 6, 52);
  ctx.lineTo(-6, 52);
  ctx.quadraticCurveTo(-12, 34, -13, 6);
  ctx.quadraticCurveTo(-15, -40, 0, -64);
  ctx.closePath();
  ctx.fill();
  // Tailplane and fin.
  ctx.fillStyle = '#c94f3d';
  ctx.beginPath();
  ctx.moveTo(-42, 44);
  ctx.lineTo(42, 44);
  ctx.lineTo(30, 54);
  ctx.lineTo(-30, 54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c94f3d';
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(0, 66);
  ctx.lineTo(10, 58);
  ctx.lineTo(8, 34);
  ctx.closePath();
  ctx.fill();
  // Registration on the tail.
  ctx.fillStyle = '#2b2b30';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N27SK', 0, 50);
  // Navigation lights: red port, green starboard, white tail.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-150, 12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e08a';
  ctx.beginPath();
  ctx.arc(150, 12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 54, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
