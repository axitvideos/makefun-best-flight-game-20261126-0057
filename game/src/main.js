// Sunrise Courier — boot and the game loop.
// Owns the screen state machine (title -> flying -> paused -> ended),
// steps the flight model at a fixed 60 Hz, and draws the world plus the
// instruments every animation frame. Shot mode (?shot=...) renders one
// staged frame instead of starting the loop, for the entry's screenshots.

import { VIEW_WIDTH, VIEW_HEIGHT, WORLD, MISSIONS } from './config.js';
import { buildTerrain, buildRingCourse } from './terrain.js';
import { createPlane, stepFlight } from './plane.js';
import { createCamera, updateCamera, renderFrame } from './render.js';
import { drawHud, drawTitleScreen, drawPauseScreen, drawEndScreen } from './hud.js';
import { createInput, consumeClick, readFlightControls, isKeyDown } from './input.js';
import {
  createAudio,
  startAudio,
  updateAudio,
  playRingChime,
  playLandingThud,
  playCrashSound,
  toggleMute,
} from './audio.js';
import { parseShotQuery, stageShot, writeShotDiagnostics } from './shots.js';

const canvas = document.getElementById('flight-canvas');
const ctx = canvas.getContext('2d');

window.__shotErrors = [];
window.addEventListener('error', (event) => {
  window.__shotErrors.push(String(event.message || event.error || 'error'));
});

function resizeCanvas() {
  const w = window.innerWidth || VIEW_WIDTH;
  const h = window.innerHeight || VIEW_HEIGHT;
  // Assigning width/height clears the canvas, so only resize when the
  // size actually changed.
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const input = createInput(canvas);
const audio = createAudio();
const camera = createCamera();

let screen = 'title'; // title | flying | paused | ended
let selectedMission = 0;
let mission = MISSIONS[0];
let world = buildTerrain(WORLD.seed);
let rings = buildRingCourse(mission, WORLD.seed);
let plane = createPlane(mission);
let lastTime = 0;
let accumulator = 0;
const STEP = 1 / 60;

function startMission(index) {
  selectedMission = index;
  mission = MISSIONS[index];
  world = buildTerrain(WORLD.seed);
  rings = buildRingCourse(mission, WORLD.seed);
  plane = createPlane(mission);
  screen = 'flying';
  startAudio(audio);
}

function restartMission() {
  startMission(selectedMission);
}

function handleTitleInput() {
  if (isKeyDown(input, 'Digit1')) startMission(0);
  else if (isKeyDown(input, 'Digit2')) startMission(1);
  else if (isKeyDown(input, 'Digit3')) startMission(2);
  else if (isKeyDown(input, 'Enter')) startMission(selectedMission);
  const click = consumeClick(input);
  if (click) {
    // Click a mission card, or anywhere else to fly the selected one.
    for (let i = 0; i < MISSIONS.length; i++) {
      const y = 340 + i * 86;
      const scaleY = canvas.height / VIEW_HEIGHT;
      const scaleX = canvas.width / VIEW_WIDTH;
      const top = (y * scaleY) / canvas.height;
      const bottom = ((y + 70) * scaleY) / canvas.height;
      const left = ((VIEW_WIDTH / 2 - 330) * scaleX) / canvas.width;
      const right = ((VIEW_WIDTH / 2 + 330) * scaleX) / canvas.width;
      if (click.y >= top && click.y <= bottom && click.x >= left && click.x <= right) {
        startMission(i);
        return;
      }
    }
    startMission(selectedMission);
  }
}

function handleFlyingInput() {
  if (isKeyDown(input, 'KeyP')) {
    screen = 'paused';
    input.keys.delete('KeyP');
    return;
  }
  if (isKeyDown(input, 'KeyM')) {
    toggleMute(audio);
    input.keys.delete('KeyM');
  }
  if (isKeyDown(input, 'KeyR')) {
    restartMission();
    input.keys.delete('KeyR');
  }
}

function handlePausedInput() {
  if (isKeyDown(input, 'KeyP')) {
    screen = 'flying';
    input.keys.delete('KeyP');
  }
  if (isKeyDown(input, 'KeyR')) {
    restartMission();
    input.keys.delete('KeyR');
  }
}

function handleEndedInput() {
  if (isKeyDown(input, 'KeyR') || isKeyDown(input, 'Enter')) {
    restartMission();
    input.keys.delete('KeyR');
    input.keys.delete('Enter');
    return;
  }
  if (consumeClick(input)) restartMission();
}

function stepGame() {
  const controls = readFlightControls(input);
  const event = stepFlight(plane, controls, rings, STEP);
  if (event === 'ring') {
    const ring = rings[plane.ringsPassed - 1];
    playRingChime(audio, ring ? ring.centred : false);
  } else if (event === 'landed') {
    playLandingThud(audio);
    screen = 'ended';
  } else if (event === 'crashed') {
    playCrashSound(audio);
    screen = 'ended';
  }
  updateAudio(audio, plane);
}

function drawGame(time) {
  ctx.setTransform(canvas.width / VIEW_WIDTH, 0, 0, canvas.height / VIEW_HEIGHT, 0, 0);
  updateCamera(camera, plane);
  renderFrame(ctx, world, plane, rings, camera, time);
  if (screen === 'title') {
    drawTitleScreen(ctx, selectedMission);
  } else if (screen === 'paused') {
    drawHud(ctx, plane, rings, mission);
    drawPauseScreen(ctx);
  } else if (screen === 'ended') {
    drawHud(ctx, plane, rings, mission);
    drawEndScreen(ctx, plane, mission);
  } else {
    drawHud(ctx, plane, rings, mission);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function frame(timestamp) {
  const time = timestamp / 1000;
  if (!lastTime) lastTime = timestamp;
  let elapsed = Math.min(0.1, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  if (screen === 'title') handleTitleInput();
  else if (screen === 'flying') handleFlyingInput();
  else if (screen === 'paused') handlePausedInput();
  else if (screen === 'ended') handleEndedInput();

  if (screen === 'flying') {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepGame();
      accumulator -= STEP;
      if (screen !== 'flying') break;
    }
  }
  drawGame(time);
  requestAnimationFrame(frame);
}

// Screenshot mode: stage one deterministic frame and keep repainting it,
// so a resize or a late layout pass can never leave a cleared canvas in
// the screenshot. The staged state never advances, so every repaint is
// the same frame.
const query = parseShotQuery(window.location.search);
if (query.shot) {
  const staged = stageShot(query.shot, query.seed);
  world = staged.world;
  plane = staged.plane;
  rings = staged.rings;
  mission = staged.mission;
  selectedMission = staged.selectedMission;
  screen = staged.screen;
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  writeShotDiagnostics();
  const repaintShot = () => {
    drawGame(12);
    requestAnimationFrame(repaintShot);
  };
  requestAnimationFrame(repaintShot);
} else {
  requestAnimationFrame(frame);
}
