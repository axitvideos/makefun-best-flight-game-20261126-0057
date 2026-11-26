// Sunrise Courier — shared tuning constants.
// One place for every number the flight model, terrain and missions agree on,
// so a balance change never has to be hunted through three files.

export const GAME_TITLE = 'SUNRISE COURIER';
export const GAME_SUBTITLE = 'a dawn delivery flight';

// Canvas the game renders into (the page stretches it to the window).
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 800;

// Flight model.
export const FLIGHT = {
  maxSpeed: 80, // m/s at full throttle
  minSpeed: 18, // m/s at idle (still flying)
  accelRate: 7, // m/s^2 spooling up
  decelRate: 4, // m/s^2 spooling down
  maxRoll: 1.1, // radians of bank
  maxPitch: 0.30, // radians nose up / down
  stallSpeed: 28, // m/s: below this the wing quits and the nose drops
  stallSink: 6, // extra m/s of sink while stalled
  gravity: 9.81,
  fuelCapacity: 100,
  fuelBurnIdle: 0.1, // per second
  fuelBurnFull: 0.38, // per second at full throttle
  brakeDecel: 14, // m/s^2 with the airbrake held
  crashVerticalSpeed: 8, // m/s down onto the runway is survivable
  crashLandingSpeed: 58, // m/s over the runway is too fast to stay on it
  crashRoll: 0.55, // radians of bank at touchdown is a cartwheel
};

// Camera: chase position behind and above the aircraft.
export const CAMERA = {
  behind: 17, // metres behind the nose
  above: 5.5, // metres above the aircraft
  lookAhead: 46, // metres ahead of the nose the camera aims at
  pitchDown: 0.055, // radians the camera looks down
  fov: 1.22, // radians, vertical field of view
};

// World: the home airfield sits at the origin, runway pointing north (+z).
export const WORLD = {
  seed: 20261126,
  runwayHalfWidth: 22,
  runwayStartZ: 0,
  runwayEndZ: 900,
  cellSize: 250, // terrain field cell, metres
  viewDistance: 1900, // metres of terrain drawn ahead
  groundY: 0,
};

// Missions: three courses with different goals, fuel and clocks.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    blurb: 'Thread all 6 dawn rings, then bring her home on runway 27.',
    rings: 6,
    fuel: 100,
    timeLimit: 0, // 0 = no clock
  },
  {
    id: 'parcel-dash',
    name: 'Parcel Dash',
    blurb: 'Low-level delivery: 8 rings under 90 m, beat the 150 s clock.',
    rings: 8,
    fuel: 100,
    timeLimit: 150,
  },
  {
    id: 'dawn-patrol',
    name: 'Dawn Patrol',
    blurb: 'The full patrol: 10 rings, thin fuel, 150 s. Fly clean.',
    rings: 10,
    fuel: 110,
    timeLimit: 150,
  },
];

// Scoring.
export const SCORE = {
  ring: 100,
  ringStyleBonus: 25, // centred pass through a ring
  landing: 500,
  landingFuelBonusPerUnit: 4,
  timeBonusPerSecond: 5,
};

// Colours: one dawn palette shared by sky, ground and HUD.
export const PALETTE = {
  skyTop: '#2b3a6e',
  skyMid: '#7d6a9b',
  skyHorizon: '#f2a35e',
  sunCore: '#ffe9b0',
  groundBase: '#3d5a34',
  fieldGreens: ['#4a6b3a', '#5d7a42', '#6b7f3e', '#7a8446', '#8a7f4a'],
  river: '#4d7ea8',
  road: '#3a3a3f',
  runway: '#33343a',
  runwayMark: '#f5f2e4',
  ring: '#ffd94d',
  ringGlow: 'rgba(255, 217, 77, 0.35)',
  hudInk: '#eaf6ff',
  hudDim: 'rgba(234, 246, 255, 0.65)',
  hudAmber: '#ffb347',
  hudRed: '#ff5d4d',
  hudPanel: 'rgba(8, 14, 32, 0.55)',
};
