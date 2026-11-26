// Sunrise Courier — keyboard and mouse input.
// Keys are read as a held set each frame; the mouse steers by position when
// the pointer is down or simply moved over the canvas. Nothing here touches
// the network or the DOM beyond the canvas and its listeners.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0.5, // 0..1 across the canvas
    mouseY: 0.5, // 0..1 down the canvas
    mouseActive: false,
    clicked: false,
    clickX: 0,
    clickY: 0,
  };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) / rect.width;
    input.mouseY = (event.clientY - rect.top) / rect.height;
    input.mouseActive = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.clickX = (event.clientX - rect.left) / rect.width;
    input.clickY = (event.clientY - rect.top) / rect.height;
    input.clicked = true;
    input.mouseActive = true;
  });

  return input;
}

export function isKeyDown(input, code) {
  return input.keys.has(code);
}

// Consume a click: true once per physical click.
export function consumeClick(input) {
  if (!input.clicked) return null;
  input.clicked = false;
  return { x: input.clickX, y: input.clickY };
}

// Flight controls for one frame: bank, pitch, throttle change, brake.
export function readFlightControls(input) {
  let bank = 0;
  if (isKeyDown(input, 'ArrowLeft') || isKeyDown(input, 'KeyA')) bank -= 1;
  if (isKeyDown(input, 'ArrowRight') || isKeyDown(input, 'KeyD')) bank += 1;

  let pitch = 0;
  if (isKeyDown(input, 'ArrowUp')) pitch += 1;
  if (isKeyDown(input, 'ArrowDown')) pitch -= 1;

  // Mouse steering blends in gently: pointer right banks right, pointer
  // above centre pitches up. Keys always win when both are used.
  if (input.mouseActive) {
    const mouseBank = (input.mouseX - 0.5) * 1.6;
    const mousePitch = (0.5 - input.mouseY) * 1.1;
    if (bank === 0) bank = clamp(mouseBank, -1, 1);
    if (pitch === 0) pitch = clamp(mousePitch, -1, 1);
  }

  // W / S work the throttle; arrows work the stick.
  let throttleDelta = 0;
  if (isKeyDown(input, 'KeyW')) throttleDelta += 1;
  if (isKeyDown(input, 'KeyS')) throttleDelta -= 1;

  return {
    bank: clamp(bank, -1, 1),
    pitch: clamp(pitch, -1, 1),
    throttleDelta,
    brake: isKeyDown(input, 'Space'),
  };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? value : value;
}
