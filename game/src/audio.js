// Sunrise Courier — synthesised sound, no audio files.
// Every sound is built in WebAudio at run time: an engine drone that follows
// the throttle, wind that follows the speed, and short cues for rings,
// landings and crashes. Nothing is fetched, nothing is stored.

export function createAudio() {
  return {
    context: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windGain: null,
    windSource: null,
    muted: false,
    started: false,
  };
}

// Must be called from a user gesture (click / key) the first time.
export function startAudio(audio) {
  if (audio.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audio.context = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(ctx.destination);

    // Engine: two detuned saws through a low-pass, pitch follows throttle.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 70;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0.0;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();

    // Wind: looped noise through a band-pass, loudness follows airspeed.
    const noiseLength = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) data[i] = Math.random() * 2 - 1;
    audio.windSource = ctx.createBufferSource();
    audio.windSource.buffer = noiseBuffer;
    audio.windSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 0.6;
    audio.windGain = ctx.createGain();
    audio.windGain.gain.value = 0.0;
    audio.windSource.connect(windFilter);
    windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSource.start();

    audio.started = true;
  } catch (error) {
    // Sound is garnish: a browser without WebAudio still flies.
    audio.started = false;
  }
}

// Called every frame while flying: drone and wind track the aircraft.
export function updateAudio(audio, plane) {
  if (!audio.started || !audio.context) return;
  const t = audio.context.currentTime;
  const throttle = plane ? plane.throttle : 0;
  const speed = plane ? plane.speed : 0;
  audio.engineOsc.frequency.setTargetAtTime(58 + throttle * 95 + speed * 0.35, t, 0.1);
  audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : 0.05 + throttle * 0.06, t, 0.1);
  audio.windGain.gain.setTargetAtTime(audio.muted ? 0 : Math.min(0.22, speed / 420), t, 0.15);
}

function playTone(audio, frequency, startAt, duration, type, volume) {
  if (!audio.started || !audio.context || audio.muted) return;
  try {
    const ctx = audio.context;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
    gain.gain.linearRampToValueAtTime(volume || 0.2, ctx.currentTime + startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(ctx.currentTime + startAt);
    osc.stop(ctx.currentTime + startAt + duration + 0.05);
  } catch (error) {
    // A failed cue never stops the game.
  }
}

function playNoiseBurst(audio, duration, volume, filterFreq) {
  if (!audio.started || !audio.context || audio.muted) return;
  try {
    const ctx = audio.context;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 900;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
  } catch (error) {
    // A failed cue never stops the game.
  }
}

// Two-note chime when a ring is threaded.
export function playRingChime(audio, centred) {
  playTone(audio, 880, 0, 0.22, 'sine', 0.22);
  playTone(audio, centred ? 1318 : 1174, 0.09, 0.3, 'sine', 0.2);
}

// Soft thud and a low settling tone for a good landing.
export function playLandingThud(audio) {
  playNoiseBurst(audio, 0.25, 0.35, 500);
  playTone(audio, 196, 0.05, 0.5, 'sine', 0.18);
}

// A crash is a burst of noise and a falling tone.
export function playCrashSound(audio) {
  playNoiseBurst(audio, 0.7, 0.5, 700);
  playTone(audio, 220, 0, 0.6, 'sawtooth', 0.12);
  playTone(audio, 55, 0.15, 0.8, 'sine', 0.25);
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  return audio.muted;
}
