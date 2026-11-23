// Keyboard input. Held keys are polled for movement; one-shot presses go through a small
// bit-flag queue so a press is never lost between frames and never fires twice.

export const ACTION_PRIMARY = 1; // Space: confirm, punch on foot, handbrake in a car
export const ACTION_ENTER = 2; // E: enter / exit a car, start a mission
export const ACTION_CONFIRM = 4; // Enter: confirm menus
export const ACTION_PAUSE = 8; // P / Escape
export const ACTION_MUTE = 16; // M

const PRIMARY_CODES = new Set(['Space']);
const CONFIRM_CODES = new Set(['Enter', 'NumpadEnter']);
const ENTER_CODES = new Set(['KeyE']);
const PAUSE_CODES = new Set(['KeyP', 'Escape']);
const MUTE_CODES = new Set(['KeyM']);
const CAPTURED = new Set([
  'Space',
  'Enter',
  'NumpadEnter',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyE',
  'KeyP',
  'KeyM',
  'Escape',
  'ShiftLeft',
  'ShiftRight',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export function createInput() {
  const held = new Set();
  let queued = 0;

  function onKeyDown(event) {
    if (CAPTURED.has(event.code)) event.preventDefault();
    if (event.repeat) {
      held.add(event.code);
      return;
    }
    held.add(event.code);
    if (PRIMARY_CODES.has(event.code)) queued |= ACTION_PRIMARY;
    else if (CONFIRM_CODES.has(event.code)) queued |= ACTION_CONFIRM;
    else if (ENTER_CODES.has(event.code)) queued |= ACTION_ENTER;
    else if (PAUSE_CODES.has(event.code)) queued |= ACTION_PAUSE;
    else if (MUTE_CODES.has(event.code)) queued |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function clearHeld() {
    held.clear();
  }

  function direction() {
    let x = 0;
    let y = 0;
    if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
    if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
    if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  function run() {
    return held.has('ShiftLeft') || held.has('ShiftRight');
  }

  function takeActions() {
    const actions = queued;
    queued = 0;
    return actions;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearHeld);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearHeld();
  });

  return {
    direction,
    run,
    takeActions,
    clearHeld,
    actions: { ACTION_PRIMARY, ACTION_ENTER, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE },
  };
}
