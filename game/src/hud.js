// Sunrise Courier — the cockpit instruments and screens.
// Everything the pilot needs is drawn on the canvas so the screenshots show
// it: airspeed, altitude, heading tape, fuel, throttle, score, mission clock
// and warnings, plus the title, pause and end-of-flight screens.

import { VIEW_WIDTH, VIEW_HEIGHT, PALETTE, MISSIONS } from './config.js';

const W = VIEW_WIDTH;
const H = VIEW_HEIGHT;

const FONT = 'system-ui, sans-serif';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function label(ctx, text, x, y, size, colour, align = 'left') {
  ctx.fillStyle = colour || PALETTE.hudDim;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size, align = 'left') {
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function knots(speedMs) {
  return Math.round(speedMs * 1.94384);
}

function feet(altM) {
  return Math.round(altM * 3.28084);
}

function compassPoint(headingDeg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(headingDeg / 45) % 8];
}

// In-flight instruments. `plane` is the flight model, `rings` the course.
export function drawHud(ctx, plane, rings, mission) {
  // Top-left: airspeed.
  panel(ctx, 18, 18, 168, 74);
  label(ctx, 'AIRSPEED', 32, 42, 12);
  value(ctx, `${knots(plane.speed)}`, 32, 74, 30);
  label(ctx, 'KT', 108, 74, 13);
  // Stall warning flashes beside the speed.
  if (plane.stalled) {
    ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? PALETTE.hudRed : PALETTE.hudAmber;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('STALL', 196, 52);
  }

  // Top-right: altitude and vertical speed.
  panel(ctx, W - 186, 18, 168, 74);
  label(ctx, 'ALTITUDE', W - 172, 42, 12);
  value(ctx, `${feet(plane.alt)}`, W - 172, 74, 30, 'left');
  label(ctx, 'FT', W - 76, 74, 13);
  const vs = Math.round(plane.verticalSpeed * 196.85);
  label(ctx, vs >= 0 ? `▲ ${vs} FPM` : `▼ ${-vs} FPM`, W - 172, 88, 12, PALETTE.hudDim);

  // Top-centre: heading tape with the compass point.
  const headingDeg = ((plane.heading * 180) / Math.PI % 360 + 360) % 360;
  panel(ctx, W / 2 - 130, 18, 260, 56);
  value(ctx, `${String(Math.round(headingDeg)).padStart(3, '0')}° ${compassPoint(headingDeg)}`, W / 2, 52, 24, 'center');
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 8, 62);
  ctx.lineTo(W / 2, 70);
  ctx.lineTo(W / 2 + 8, 62);
  ctx.stroke();

  // Bottom-left: fuel and throttle.
  panel(ctx, 18, H - 92, 220, 74);
  label(ctx, 'FUEL', 32, H - 66, 12);
  drawBar(ctx, 32, H - 56, 120, 10, plane.fuel / 100, plane.fuel < 20 ? PALETTE.hudRed : PALETTE.hudAmber);
  value(ctx, `${Math.round(plane.fuel)}%`, 160, H - 46, 15);
  label(ctx, 'THR', 32, H - 26, 12);
  drawBar(ctx, 32, H - 22, 120, 10, plane.throttle, '#7fd4ff');
  value(ctx, `${Math.round(plane.throttle * 100)}%`, 160, H - 12, 15);

  // Bottom-right: score, rings and the mission clock.
  panel(ctx, W - 238, H - 92, 220, 74);
  label(ctx, 'SCORE', W - 224, H - 66, 12);
  value(ctx, `${plane.score}`, W - 224, H - 38, 26);
  label(ctx, `RINGS ${plane.ringsPassed}/${plane.ringsTotal}`, W - 224, H - 16, 12);
  if (mission.timeLimit > 0) {
    const t = Math.max(0, Math.ceil(plane.timeLeft));
    const colour = t <= 20 ? PALETTE.hudRed : PALETTE.hudInk;
    ctx.fillStyle = colour;
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, W - 32, H - 38);
  }

  // Attitude ball: a small artificial horizon under the compass.
  drawAttitudeBall(ctx, plane);

  // Next-ring distance readout, centred under the horizon.
  const next = rings.find((r) => !r.passed);
  if (next) {
    const dist = Math.max(0, Math.round(next.z - plane.z));
    label(ctx, `NEXT RING ${dist} M — ALT ${Math.round(next.y * 3.28)} FT`, W / 2, H - 108, 14, PALETTE.hudDim, 'center');
  }

  // Transient centre message (ring scored, fuel warning).
  if (plane.messageTimer > 0 && plane.message) {
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(plane.message, W / 2, H * 0.20);
  }
  if (plane.fuel > 0 && plane.fuel < 20) {
    ctx.fillStyle = Math.floor(performance.now() / 400) % 2 ? PALETTE.hudRed : PALETTE.hudAmber;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', W / 2, H * 0.24);
  }
}

function drawBar(ctx, x, y, w, h, frac, colour) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function drawAttitudeBall(ctx, plane) {
  const cx = W / 2;
  const cy = H - 52;
  const r = 30;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#7fb2e8';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = '#6b4a2f';
  const horizonOffset = Math.max(-r, Math.min(r, plane.pitch * r * 2.2));
  ctx.save();
  ctx.translate(cx, cy + horizonOffset);
  ctx.rotate(-plane.roll);
  ctx.fillRect(-r, 0, r * 2, r);
  ctx.restore();
  ctx.strokeStyle = PALETTE.hudInk;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = PALETTE.hudInk;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

// Title screen: name, mission choice, controls.
export function drawTitleScreen(ctx, selectedMission) {
  ctx.fillStyle = 'rgba(8, 12, 28, 0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.sunCore;
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText('SUNRISE COURIER', W / 2, 190);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = '24px ' + FONT;
  ctx.fillText('a dawn delivery flight', W / 2, 228);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillText('CHOOSE YOUR SORTIE — press 1, 2 or 3, or click', W / 2, 300);

  MISSIONS.forEach((mission, i) => {
    const y = 340 + i * 86;
    const selected = i === selectedMission;
    ctx.fillStyle = selected ? 'rgba(255, 217, 77, 0.16)' : PALETTE.hudPanel;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 330, y, 660, 70, 10);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = PALETTE.ring;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = 'bold 22px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}. ${mission.name}`, W / 2 - 310, y + 30);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '15px ' + FONT;
    ctx.fillText(mission.blurb, W / 2 - 310, y + 54);
  });

  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '16px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('W / S throttle · A / D bank · mouse steers · SPACE airbrake · P pause · M mute', W / 2, 640);
  ctx.fillText('Fly the rings, then land on runway 27. Watch the fuel — and mind the stall.', W / 2, 668);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText('Press ENTER or click to fly', W / 2, 716);
}

// Pause overlay.
export function drawPauseScreen(ctx) {
  ctx.fillStyle = 'rgba(8, 12, 28, 0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.font = '18px ' + FONT;
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('Press P to resume · R to restart the sortie', W / 2, H / 2 + 28);
}

// End-of-flight screen: landed or crashed, score breakdown, restart.
export function drawEndScreen(ctx, plane, mission) {
  ctx.fillStyle = 'rgba(8, 12, 28, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const landed = plane.landed;
  ctx.fillStyle = landed ? '#7fd4a0' : PALETTE.hudRed;
  ctx.font = 'bold 52px ' + FONT;
  ctx.fillText(landed ? 'DELIVERED' : 'CRASHED', W / 2, 210);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = '20px ' + FONT;
  ctx.fillText(plane.crashReason, W / 2, 252);
  panel(ctx, W / 2 - 260, 290, 520, 190);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '16px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`Mission: ${mission.name}`, W / 2 - 236, 330);
  ctx.fillText(`Rings flown: ${plane.ringsPassed} / ${plane.ringsTotal}`, W / 2 - 236, 360);
  ctx.fillText(`Flight time: ${Math.round(plane.elapsed)} s`, W / 2 - 236, 390);
  ctx.fillText(`Fuel left: ${Math.round(plane.fuel)}%`, W / 2 - 236, 420);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 30px ' + FONT;
  ctx.fillText(`SCORE  ${plane.score}`, W / 2 - 236, 462);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText('Press R or click to fly again', W / 2, 540);
}
