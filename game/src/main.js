import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_PICKUP, EVENT_PUNCH, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PRIMARY, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) {
  if (statusLine) statusLine.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const state = world.state;
  window.__shotInfo = {
    screen: scene.screen,
    cash: state.cash,
    wanted: state.wanted,
    health: state.player.health,
    car: state.player.inCar
      ? {
          type: state.player.inCar.type,
          x: Math.round(state.player.inCar.x),
          y: Math.round(state.player.inCar.y),
          speed: Math.round(state.player.inCar.speed),
          health: state.player.inCar.health,
          wrecked: state.player.inCar.wrecked,
        }
      : null,
    player: { x: Math.round(state.player.x), y: Math.round(state.player.y) },
    mission: state.mission ? { id: state.mission.id, stage: state.mission.stage, timeLeft: Math.round(state.mission.timeLeft) } : null,
    toast: state.toast ? state.toast.text : null,
    police: state.cars.filter((c) => c.role === 'police').map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), wrecked: c.wrecked })),
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      best: world.state.bestEarnings,
      muted: audio.isMuted(),
      shot: true,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput();
  world.state.passive = true;
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  window.addEventListener('keydown', () => audio.unlock(), { once: true, capture: true });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });

  function handleWorldEvents(events) {
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION_DONE) {
      audio.win();
      announce(`Mission complete. Cash ${world.state.cash}.`);
    }
    if (events & EVENT_MISSION_FAIL) audio.fail();
    if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      audio.fail();
      accumulator = 0;
      announce(`Busted. Hospital bill ${world.state.lastLoss} dollars. Press Space to continue.`);
    } else if (events & EVENT_WASTED) {
      screen = SCREEN_WASTED;
      audio.fail();
      accumulator = 0;
      announce(`Wasted. Hospital bill ${world.state.lastLoss} dollars. Press Space to continue.`);
    }
  }

  function startPlaying() {
    screen = SCREEN_PLAY;
    world.state.passive = false;
    accumulator = 0;
    audio.unlock();
    audio.click();
    announce('Playing NEON BAY. Rico Vance is on the street.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += real;

    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }

    if (screen === SCREEN_TITLE) {
      if (actions & (ACTION_PRIMARY | ACTION_CONFIRM)) startPlaying();
      while (accumulator >= STEP && screen === SCREEN_TITLE) {
        world.step(STEP, { x: 0, y: 0, run: false, primary: false, enter: false });
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        accumulator = 0;
        announce('Paused.');
      } else {
        const dir = input.direction();
        const control = {
          x: dir.x,
          y: dir.y,
          run: input.run(),
          primary: (actions & ACTION_PRIMARY) !== 0,
          enter: (actions & ACTION_ENTER) !== 0,
        };
        let stepped = 0;
        while (accumulator >= STEP && screen === SCREEN_PLAY) {
          const stepControl = stepped === 0 ? control : { ...control, primary: false, enter: false };
          const events = world.step(STEP, stepControl);
          handleWorldEvents(events);
          accumulator -= STEP;
          stepped += 1;
          if (events & (EVENT_BUSTED | EVENT_WASTED)) break;
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      accumulator = 0;
      if (actions & (ACTION_PAUSE | ACTION_PRIMARY | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        audio.click();
        announce('Playing.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      accumulator = 0;
      if (actions & (ACTION_PRIMARY | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        audio.click();
        announce('Back on the street. St. Mary Hospital.');
      }
    }

    const car = world.state.player.inCar;
    if (screen === SCREEN_PLAY && car && !car.wrecked) {
      audio.setEngine(Math.min(1, Math.abs(car.speed) / 640));
    } else {
      audio.setEngine(0);
    }
    audio.setSiren(screen === SCREEN_PLAY && world.state.wanted > 0);
    audio.update(real);

    renderer.draw(world.state, screen, { best: world.state.bestEarnings, muted });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused because the tab lost focus.');
    }
  });

  announce('NEON BAY. Press Space to start.');
  if (params.has('debug')) {
    window.__neonBay = { world, renderer, audio, screen: () => screen };
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
