// Sunrise Courier — the flight model.
// A small prop courier plane: throttle sets target speed, banking turns the
// nose, pitch trades speed for altitude, fuel and stall turn every sortie
// into decisions. All state lives in one plain object, stepped at 60 Hz.

import { FLIGHT, WORLD, SCORE } from './config.js';
import { isOnRunway } from './terrain.js';

export function createPlane(mission) {
  return {
    // Position: x east, z north, alt metres above the valley floor.
    x: 0,
    z: -320,
    alt: 55,
    heading: 0, // radians, 0 = north (+z), grows clockwise
    pitch: 0,
    roll: 0,
    speed: 42,
    verticalSpeed: 0,
    throttle: 0.62,
    fuel: mission.fuel,
    damage: 0,
    gearDown: true,
    airbrake: false,
    stalled: false,
    score: 0,
    ringsPassed: 0,
    ringsTotal: mission.rings,
    elapsed: 0,
    timeLeft: mission.timeLimit,
    landed: false,
    crashed: false,
    crashReason: '',
    message: '',
    messageTimer: 0,
  };
}

// One fixed step of flight. `input` carries bank (-1..1), pitch (-1..1),
// throttleDelta (-1..1) and brake from input.js. Returns an event string
// ('ring', 'stall', 'fuel-low', 'landed', 'crashed', 'timeout') or ''.
export function stepFlight(plane, input, rings, dt) {
  if (plane.crashed || plane.landed) return '';
  plane.elapsed += dt;
  // The clock races the ring course only: once the last ring is threaded
  // the delivery is made and the flight home is untimed.
  if (plane.timeLeft > 0 && plane.ringsPassed < plane.ringsTotal) {
    plane.timeLeft -= dt;
    if (plane.timeLeft <= 0) {
      plane.timeLeft = 0;
      return endFlight(plane, 'crashed', 'Out of time — the dawn mail never arrived.');
    }
  }

  // Throttle spools toward the pilot's command.
  plane.throttle = clamp(plane.throttle + input.throttleDelta * dt * 0.55, 0, 1);
  if (plane.fuel <= 0) plane.throttle = 0;
  // A banked wing pays induced drag: hard turns bleed speed, so a tight
  // turn means throttling back first — turn discipline matters.
  const bankDrag = Math.abs(plane.roll) * 14;
  const targetSpeed = FLIGHT.minSpeed + plane.throttle * (FLIGHT.maxSpeed - FLIGHT.minSpeed) - bankDrag;
  const rate = targetSpeed > plane.speed ? FLIGHT.accelRate : FLIGHT.decelRate;
  plane.speed = approach(plane.speed, targetSpeed, rate * dt);
  if (input.brake) plane.speed = Math.max(12, plane.speed - FLIGHT.brakeDecel * dt);

  // Bank and pitch ease toward the pilot's command; the wing auto-levels.
  const rollTarget = input.bank * FLIGHT.maxRoll;
  plane.roll = approach(plane.roll, rollTarget, 2.4 * dt);
  const pitchTarget = input.pitch * FLIGHT.maxPitch;
  plane.pitch = approach(plane.pitch, pitchTarget, 1.6 * dt);

  // A banked wing turns the nose: turn rate = g * tan(roll) / speed.
  const turnRate = (FLIGHT.gravity * Math.tan(plane.roll)) / Math.max(plane.speed, 20);
  plane.heading += turnRate * dt;

  // Stall: below stall speed the wing quits, the nose drops and she sinks.
  plane.stalled = plane.speed < FLIGHT.stallSpeed;
  const sink = plane.stalled ? FLIGHT.stallSink : 0;
  plane.verticalSpeed = Math.sin(plane.pitch) * plane.speed - sink;
  plane.alt += plane.verticalSpeed * dt;

  // Move over the ground.
  plane.x += Math.sin(plane.heading) * plane.speed * dt;
  plane.z += Math.cos(plane.heading) * plane.speed * dt;

  // Fuel burns with throttle; empty tanks mean a glide to wherever is below.
  const burn = FLIGHT.fuelBurnIdle + plane.throttle * FLIGHT.fuelBurnFull;
  plane.fuel = Math.max(0, plane.fuel - burn * dt);

  // Rings: crossing a ring's plane inside its circle scores it.
  for (const ring of rings) {
    if (ring.passed) continue;
    const prevZ = plane.z - Math.cos(plane.heading) * plane.speed * dt;
    if (prevZ < ring.z && plane.z >= ring.z) {
      const dx = plane.x - ring.x;
      const dy = plane.alt - ring.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= ring.radius) {
        ring.passed = true;
        ring.centred = dist <= ring.radius * 0.45;
        plane.ringsPassed += 1;
        plane.score += SCORE.ring + (ring.centred ? SCORE.ringStyleBonus : 0);
        plane.message = ring.centred
          ? `RING ${plane.ringsPassed}/${plane.ringsTotal} — DEAD CENTRE! +${SCORE.ring + SCORE.ringStyleBonus}`
          : `RING ${plane.ringsPassed}/${plane.ringsTotal} +${SCORE.ring}`;
        plane.messageTimer = 2.2;
        return 'ring';
      }
    }
  }

  if (plane.messageTimer > 0) plane.messageTimer -= dt;

  // Ground contact decides landing or crash.
  if (plane.alt <= WORLD.groundY) {
    plane.alt = WORLD.groundY;
    return touchDown(plane);
  }
  if (plane.fuel <= 0 && plane.alt < 12) {
    plane.message = 'FUEL EMPTY — GLIDING';
    plane.messageTimer = 1.5;
  }
  return plane.stalled ? 'stall' : '';
}

function touchDown(plane) {
  const onRunway = isOnRunway(plane.x, plane.z);
  const hardHit = plane.verticalSpeed < -FLIGHT.crashVerticalSpeed;
  const tooFast = plane.speed > FLIGHT.crashLandingSpeed;
  const cartwheel = Math.abs(plane.roll) > FLIGHT.crashRoll;
  if (!onRunway) {
    return endFlight(plane, 'crashed', 'Down in the fields — the courier never reached the strip.');
  }
  if (hardHit || tooFast || cartwheel) {
    const why = hardHit
      ? 'Slammed onto the runway — the gear folded.'
      : tooFast
        ? 'Too fast on touchdown — she ran off the end.'
        : 'Touched down banked — a cartwheel across the grass.';
    return endFlight(plane, 'crashed', why);
  }
  plane.score += SCORE.landing + Math.round(plane.fuel * SCORE.landingFuelBonusPerUnit);
  return endFlight(plane, 'landed', 'Down safe on runway 27. The dawn mail is delivered.');
}

function endFlight(plane, kind, reason) {
  plane.crashReason = reason;
  if (kind === 'crashed') {
    plane.crashed = true;
    plane.damage = 100;
    return 'crashed';
  }
  plane.landed = true;
  return 'landed';
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
