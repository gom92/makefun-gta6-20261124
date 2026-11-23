import {
  COURIER_PACKAGES,
  MISSIONS,
  PEDS,
  PED_COLORS,
  PICKUPS,
  PLACES,
  PLAYER,
  ROADS,
  ROOF_COLORS,
  SAVE_KEY,
  SPECIAL,
  TRAFFIC,
  VEHICLES,
  WANTED,
  WORLD,
} from './config.js';
import { angleDelta, clamp, dist, dist2 } from './random.js';

export const EVENT_CRASH = 1;
export const EVENT_PUNCH = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MISSION_DONE = 8;
export const EVENT_MISSION_FAIL = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WASTED = 64;
export const EVENT_ENTER = 128;
export const EVENT_EXIT = 256;
export const EVENT_WANTED = 512;
export const EVENT_UI = 1024;

const TAU = Math.PI * 2;
const NO_EVENT = 0;
const noop = () => {};

function loadSave() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return {};
    return value;
  } catch {
    return {};
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function createWorld(random) {
  let nextCarId = 1;
  let nextPedId = 1;
  const saved = loadSave();

  const state = {
    time: 0,
    player: {
      x: PLACES.start.x,
      y: PLACES.start.y,
      angle: -Math.PI / 2,
      health: PLAYER.maxHealth,
      inCar: null,
      punch: 0,
      punchCooldown: 0,
      hurtCooldown: 0,
      phase: 0,
      moving: false,
      running: false,
    },
    cash: Number.isFinite(saved.cash) ? Math.max(0, Math.round(saved.cash)) : 0,
    totalEarned: Number.isFinite(saved.totalEarned) ? Math.max(0, Math.round(saved.totalEarned)) : 0,
    bestEarnings: Number.isFinite(saved.bestEarnings) ? Math.max(0, Math.round(saved.bestEarnings)) : 0,
    completed: Array.isArray(saved.completed) ? saved.completed.filter((id) => typeof id === 'string') : [],
    cars: [],
    peds: [],
    buildings: [],
    trees: [],
    pickups: [],
    startMarkers: Object.values(MISSIONS).map((m) => ({
      id: m.id,
      x: m.marker.x,
      y: m.marker.y,
      title: m.title,
      reward: m.reward,
      blurb: m.blurb,
    })),
    missionMarkers: [],
    mission: null,
    wanted: 0,
    quiet: 0,
    bustTimer: 0,
    lastLoss: 0,
    toast: null,
    actionHint: '',
    shake: 0,
    muted: false,
    passive: false,
  };

  function saveGame() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          cash: state.cash,
          totalEarned: state.totalEarned,
          bestEarnings: state.bestEarnings,
          completed: state.completed,
        }),
      );
    } catch {
      // Storage can be disabled; the run then keeps its money for this visit only.
    }
  }

  function toast(text, seconds = 2.6) {
    state.toast = { text, time: seconds, max: seconds };
  }

  function playerPos() {
    const car = state.player.inCar;
    return car ? { x: car.x, y: car.y } : { x: state.player.x, y: state.player.y };
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    for (const roadX of ROADS.vertical) {
      const d = Math.abs(x - roadX);
      if (!best || d < best.d) best = { x: roadX, y, d, axis: 'v' };
    }
    for (const roadY of ROADS.horizontal) {
      const d = Math.abs(y - roadY);
      if (!best || d < best.d) best = { x, y: roadY, d, axis: 'h' };
    }
    return best;
  }

  function randomSidewalkPoint() {
    if (random.chance(0.5)) {
      const x = random.pick(ROADS.vertical);
      const y = random.range(90, 2290);
      const side = random.sign();
      return { x: clamp(x + side * 55, 30, WORLD.width - 30), y };
    }
    const y = random.pick(ROADS.horizontal);
    const x = random.range(90, WORLD.width - 90);
    const side = random.sign();
    return { x, y: clamp(y + side * 55, 30, 2290) };
  }

  function randomGroundPoint() {
    const point = randomSidewalkPoint();
    return point;
  }

  function makeBuilding(x, y, w, h, special = null) {
    const windows = [];
    const cols = Math.max(2, Math.floor((w - 18) / 22));
    const rows = Math.max(2, Math.floor((h - 18) / 22));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        windows.push({
          x: x + 10 + ((w - 20) * (col + 0.5)) / cols,
          y: y + 10 + ((h - 20) * (row + 0.5)) / rows,
          lit: special === 'hospital' ? random.chance(0.8) : random.chance(0.46),
        });
      }
    }
    return {
      x,
      y,
      w,
      h,
      special,
      roof: special ? null : random.pick(ROOF_COLORS),
      accent: random.pick(ROOF_COLORS),
      windows,
      ac: { x: x + w * 0.68, y: y + h * 0.22, w: Math.min(18, w * 0.16), h: Math.min(14, h * 0.16) },
    };
  }

  function generateCity() {
    const half = WORLD.roadWidth / 2;
    const walk = WORLD.sidewalk;
    const zones = [SPECIAL.park, SPECIAL.hospital, SPECIAL.chop, SPECIAL.garage];

    const specials = [
      { zone: SPECIAL.hospital, kind: 'hospital', color: '#e6e9ec' },
      { zone: SPECIAL.chop, kind: 'chop', color: '#50726a' },
      { zone: SPECIAL.garage, kind: 'garage', color: '#70757b' },
    ];
    for (const item of specials) {
      const b = makeBuilding(item.zone.x, item.zone.y, item.zone.w, item.zone.h, item.kind);
      b.roof = item.color;
      state.buildings.push(b);
    }

    for (let i = 0; i < ROADS.vertical.length - 1; i += 1) {
      for (let j = 0; j < ROADS.horizontal.length - 1; j += 1) {
        const x0 = ROADS.vertical[i] + half + walk + 6;
        const x1 = ROADS.vertical[i + 1] - half - walk - 6;
        const y0 = ROADS.horizontal[j] + half + walk + 6;
        const y1 = ROADS.horizontal[j + 1] - half - walk - 6;
        const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        if (block.w < 40 || block.h < 40) continue;
        if (zones.some((zone) => rectsOverlap(block, zone))) continue;
        if (random.chance(0.18)) continue;
        if (random.chance(0.48)) {
          const insetX = random.range(0, 10);
          const insetY = random.range(0, 8);
          state.buildings.push(
            makeBuilding(
              block.x + insetX,
              block.y + insetY,
              block.w - insetX * 2,
              block.h - insetY * 2,
            ),
          );
        } else {
          const vertical = block.w >= block.h;
          const gap = random.range(6, 12);
          if (vertical) {
            const split = block.w * random.range(0.4, 0.6);
            const inset = random.range(0, 5);
            state.buildings.push(makeBuilding(block.x + inset, block.y + inset, split - gap, block.h - inset * 2));
            state.buildings.push(
              makeBuilding(block.x + split + gap, block.y + inset, block.w - split - gap - inset, block.h - inset * 2),
            );
          } else {
            const split = block.h * random.range(0.4, 0.6);
            const inset = random.range(0, 5);
            state.buildings.push(makeBuilding(block.x + inset, block.y + inset, block.w - inset * 2, split - gap));
            state.buildings.push(
              makeBuilding(block.x + inset, block.y + split + gap, block.w - inset * 2, block.h - split - gap - inset),
            );
          }
        }
      }
    }

    const park = SPECIAL.park;
    let planted = 0;
    let guard = 0;
    while (planted < 26 && guard < 800) {
      guard += 1;
      const x = random.range(park.x + 18, park.x + park.w - 18);
      const y = random.range(park.y + 18, park.y + park.h - 18);
      if (state.trees.some((t) => dist2(t.x, t.y, x, y) < 30 * 30)) continue;
      state.trees.push({ x, y, r: random.range(13, 21), kind: 'round', phase: random.range(0, TAU) });
      planted += 1;
    }

    for (let x = 120; x < WORLD.width - 80; x += random.range(150, 240)) {
      state.trees.push({
        x: x + random.range(-30, 30),
        y: random.range(2350, 2420),
        r: random.range(14, 20),
        kind: 'palm',
        phase: random.range(0, TAU),
      });
    }
    for (let y = 880; y < 2180; y += 360) {
      state.trees.push({ x: 3040 + 57, y: y + random.range(-40, 40), r: random.range(13, 18), kind: 'palm', phase: random.range(0, TAU) });
      state.trees.push({ x: 3040 - 57, y: y + random.range(-40, 40), r: random.range(13, 18), kind: 'palm', phase: random.range(0, TAU) });
    }
    for (let x = 320; x < WORLD.width - 200; x += 520) {
      state.trees.push({ x: x + random.range(-40, 40), y: 2227, r: random.range(12, 17), kind: 'palm', phase: random.range(0, TAU) });
    }
  }

  function makeCar(type, x, y, angle, role = 'parked', options = {}) {
    const spec = VEHICLES[type];
    const car = {
      id: nextCarId,
      type,
      x,
      y,
      angle,
      speed: 0,
      health: 100,
      maxHealth: 100,
      role,
      driver: role === 'traffic' ? 'npc' : role === 'police' ? 'police' : null,
      cruise: random.range(TRAFFIC.speedMin, TRAFFIC.speedMax),
      stopTimer: 0,
      stopCooldown: random.range(0, 2),
      crashCooldown: 0,
      hitCooldown: 0,
      stunTimer: 0,
      stuck: 0,
      wrecked: false,
      wreckAge: 0,
      phase: random.range(0, TAU),
      axis: options.axis ?? null,
      dir: options.dir ?? 1,
      lane: options.lane ?? 0,
      missionCar: options.missionCar ?? null,
    };
    nextCarId += 1;
    if (spec.length === undefined) throw new Error(`unknown car ${type}`);
    return car;
  }

  function spawnTrafficCar() {
    if (random.chance(0.5)) {
      const x = random.pick(ROADS.vertical);
      const dir = random.sign();
      const y = random.range(80, 2320);
      const lane = dir > 0 ? -24 : 24;
      const car = makeCar(random.pick(['sedan', 'sedan', 'taxi', 'van', 'sports', 'truck']), x + lane, y, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'traffic', { axis: 'v', dir, lane });
      state.cars.push(car);
    } else {
      const y = random.pick(ROADS.horizontal);
      const dir = random.sign();
      const x = random.range(80, WORLD.width - 80);
      const lane = dir > 0 ? 24 : -24;
      const car = makeCar(random.pick(['sedan', 'sedan', 'taxi', 'van', 'sports', 'truck']), x, y + lane, dir > 0 ? 0 : Math.PI, 'traffic', { axis: 'h', dir, lane });
      state.cars.push(car);
    }
  }

  function spawnParkedCar() {
    if (random.chance(0.5)) {
      const x = random.pick(ROADS.vertical);
      const y = random.range(260, 2180);
      const side = random.sign();
      state.cars.push(makeCar(random.pick(['sedan', 'taxi', 'van', 'truck', 'sports']), x + side * 34, y, side > 0 ? -Math.PI / 2 : Math.PI / 2, 'parked'));
    } else {
      const y = random.pick(ROADS.horizontal);
      const x = random.range(260, WORLD.width - 260);
      const side = random.sign();
      state.cars.push(makeCar(random.pick(['sedan', 'taxi', 'van', 'truck', 'sports']), x, y + side * 34, side > 0 ? Math.PI : 0, 'parked'));
    }
  }

  function makePedestrian(x, y) {
    const target = randomSidewalkPoint();
    return {
      id: nextPedId++,
      x,
      y,
      targetX: target.x,
      targetY: target.y,
      speed: random.range(PEDS.speed * 0.8, PEDS.speed * 1.25),
      color: random.pick(PED_COLORS),
      phase: random.range(0, TAU),
      fleeTimer: 0,
      fleeX: x,
      fleeY: y,
      hitCooldown: 0,
    };
  }

  function spawnPedestrian() {
    const point = randomSidewalkPoint();
    state.peds.push(makePedestrian(point.x, point.y));
  }

  function randomPickupPoint() {
    const point = randomGroundPoint();
    return { x: point.x, y: point.y };
  }

  function spawnPickup() {
    const point = randomPickupPoint();
    state.pickups.push({
      x: point.x,
      y: point.y,
      active: true,
      respawn: 0,
      phase: random.range(0, TAU),
    });
  }

  function relocatePickup(item) {
    const point = randomPickupPoint();
    item.x = point.x;
    item.y = point.y;
    item.active = true;
    item.respawn = 0;
  }

  function scarePeds(x, y, radius = PEDS.fleeRadius) {
    for (const ped of state.peds) {
      if (dist2(ped.x, ped.y, x, y) <= radius * radius) {
        ped.fleeTimer = PEDS.fleeTime;
        const dx = ped.x - x;
        const dy = ped.y - y;
        const length = Math.hypot(dx, dy) || 1;
        ped.fleeX = clamp(ped.x + (dx / length) * 420, 30, WORLD.width - 30);
        ped.fleeY = clamp(ped.y + (dy / length) * 420, 30, WORLD.waterY - 30);
      }
    }
  }

  function addWanted(amount, reason, emit = noop) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + amount, 0, WANTED.max);
    state.quiet = 0;
    if (state.wanted > before) {
      emit(EVENT_WANTED);
      if (reason) toast(`Wanted level up — ${reason}`);
    }
  }

  function setWanted(amount, emit = noop) {
    const before = state.wanted;
    state.wanted = clamp(Math.round(amount), 0, WANTED.max);
    state.quiet = 0;
    if (state.wanted !== before) emit(EVENT_WANTED);
    if (state.wanted === 0) {
      state.bustTimer = 0;
      state.cars = state.cars.filter((car) => car.role !== 'police');
    }
  }

  function clearPolice() {
    state.cars = state.cars.filter((car) => car.role !== 'police');
  }

  function spawnPoliceNear(count = 1, minDistance = WANTED.spawnMin, maxDistance = WANTED.spawnMax) {
    const origin = playerPos();
    for (let i = 0; i < count; i += 1) {
      const angle = random.range(0, TAU);
      const distance = random.range(minDistance, maxDistance);
      const point = nearestRoadPoint(origin.x + Math.cos(angle) * distance, origin.y + Math.sin(angle) * distance);
      const car = makeCar('police', clamp(point.x, 40, WORLD.width - 40), clamp(point.y, 40, WORLD.waterY - 40), 0, 'police');
      car.angle = Math.atan2(origin.y - car.y, origin.x - car.x);
      car.speed = random.range(120, 220);
      state.cars.push(car);
    }
    return state.cars.filter((car) => car.role === 'police');
  }

  function syncPolice() {
    const target = WANTED.policeByStar[state.wanted] ?? 0;
    let police = state.cars.filter((car) => car.role === 'police');
    if (police.length > target) {
      const order = police
        .slice()
        .sort((a, b) => {
          if (a.wrecked !== b.wrecked) return a.wrecked ? -1 : 1;
          return dist2(b.x, b.y, state.player.x, state.player.y) - dist2(a.x, a.y, state.player.x, state.player.y);
        });
      const remove = new Set(order.slice(target));
      state.cars = state.cars.filter((car) => !remove.has(car));
      police = state.cars.filter((car) => car.role === 'police');
    }
    while (police.filter((car) => !car.wrecked).length < target) {
      spawnPoliceNear(1);
      police = state.cars.filter((car) => car.role === 'police');
    }
  }

  function giveCar(type, x, y, angle, options = {}) {
    const car = makeCar(type, x, y, angle, options.role ?? 'parked', options);
    if (options.speed !== undefined) car.speed = options.speed;
    if (options.health !== undefined) car.health = options.health;
    if (options.missionCar !== undefined) car.missionCar = options.missionCar;
    state.cars.push(car);
    return car;
  }

  function enterCar(car, silent = false, emit = noop) {
    const player = state.player;
    if (!car || car.wrecked) return false;
    if (car.role === 'police') {
      toast('Police cruisers are locked.');
      return false;
    }
    player.inCar = car;
    car.driver = 'player';
    if (car.role === 'traffic') car.role = 'parked';
    car.speed = Math.min(Math.abs(car.speed), 140);
    player.x = car.x;
    player.y = car.y;
    emit(EVENT_ENTER);
    if (!silent && !car.missionCar && state.wanted < WANTED.max) {
      addWanted(WANTED.starCrime.steal, 'Grand theft auto', emit);
      scarePeds(car.x, car.y);
    }
    return true;
  }

  function exitCar(emit = noop) {
    const player = state.player;
    const car = player.inCar;
    if (!car) return;
    const side = Math.PI / 2;
    const offset = VEHICLES[car.type].width / 2 + 22;
    let x = car.x + Math.cos(car.angle + side) * offset;
    let y = car.y + Math.sin(car.angle + side) * offset;
    x = clamp(x, WORLD.edge, WORLD.width - WORLD.edge);
    y = clamp(y, WORLD.edge, WORLD.waterY - 20);
    player.x = x;
    player.y = y;
    player.inCar = null;
    car.driver = null;
    car.speed *= 0.4;
    emit(EVENT_EXIT);
  }

  function teleportPlayer(x, y) {
    const player = state.player;
    if (player.inCar) {
      player.inCar.x = x;
      player.inCar.y = y;
      player.inCar.speed = Math.min(player.inCar.speed, 80);
    }
    player.x = x;
    player.y = y;
  }

  function startMission(id, emit = noop) {
    if (state.mission) return false;
    const def = MISSIONS[id];
    if (!def) return false;
    if (id === 'firstFare') {
      const taxi = state.cars.find((car) => car.missionCar === 'firstFare');
      if (!taxi) return false;
      taxi.wrecked = false;
      taxi.health = taxi.maxHealth;
      taxi.speed = 0;
      enterCar(taxi, true);
      state.mission = {
        id,
        title: def.title,
        reward: def.reward,
        timeLeft: def.time,
        stage: 'pickup',
        stageText: 'Pick up the fare on Ocean Ave',
        objectives: [{ x: PLACES.oceanPickup.x, y: PLACES.oceanPickup.y, label: 'FARE' }],
        stageFlash: 0,
        carId: taxi.id,
      };
      toast('First Fare — pick up the fare on Ocean Ave');
    } else if (id === 'hotWheels') {
      const comet = state.cars.find((car) => car.missionCar === 'hotWheels');
      if (!comet) return false;
      comet.wrecked = false;
      comet.health = comet.maxHealth;
      setWanted(2, emit);
      state.mission = {
        id,
        title: def.title,
        reward: def.reward,
        timeLeft: def.time,
        stage: 'steal',
        stageText: 'Steal the Comet GT outside Sunset Motel',
        objectives: [{ x: comet.x, y: comet.y, label: 'COMET GT' }],
        stageFlash: 0,
        carId: comet.id,
      };
      scarePeds(PLACES.sunsetMotel.x, PLACES.sunsetMotel.y);
      toast('Hot Wheels — boost the Comet GT');
    } else if (id === 'courier') {
      state.mission = {
        id,
        title: def.title,
        reward: def.reward,
        timeLeft: def.time,
        stage: 'collect',
        stageText: 'Collect the packages (0/3)',
        objectives: COURIER_PACKAGES.map((p, index) => ({ x: p.x, y: p.y, label: `PKG ${index + 1}`, done: false })),
        stageFlash: 0,
        collected: 0,
      };
      toast('Courier Run — collect three packages');
    } else {
      return false;
    }
    emit(EVENT_UI);
    saveGame();
    return true;
  }

  function failMission(reason, emit = noop, quiet = false) {
    if (!state.mission) return;
    state.mission = null;
    if (!quiet) {
      toast(`Mission failed — ${reason}`, 3.4);
      emit(EVENT_MISSION_FAIL);
    }
  }

  function completeMission(emit = noop) {
    const mission = state.mission;
    if (!mission) return;
    state.cash += mission.reward;
    state.totalEarned += mission.reward;
    state.bestEarnings = Math.max(state.bestEarnings, state.totalEarned);
    if (!state.completed.includes(mission.id)) state.completed.push(mission.id);
    state.mission = null;
    toast(`${mission.title} complete — +$${mission.reward}`, 3.6);
    emit(EVENT_MISSION_DONE);
    saveGame();
  }

  function resolvePlayerBuildings() {
    const player = state.player;
    const radius = PLAYER.radius;
    for (const b of state.buildings) {
      if (
        player.x > b.x - radius &&
        player.x < b.x + b.w + radius &&
        player.y > b.y - radius &&
        player.y < b.y + b.h + radius
      ) {
        const left = player.x - (b.x - radius);
        const right = b.x + b.w + radius - player.x;
        const top = player.y - (b.y - radius);
        const bottom = b.y + b.h + radius - player.y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) player.x = b.x - radius;
        else if (min === right) player.x = b.x + b.w + radius;
        else if (min === top) player.y = b.y - radius;
        else player.y = b.y + b.h + radius;
      }
    }
    player.x = clamp(player.x, WORLD.edge, WORLD.width - WORLD.edge);
    player.y = clamp(player.y, WORLD.edge, WORLD.waterY - 16);
  }

  function resolveCarBuildings(car) {
    const spec = VEHICLES[car.type];
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    const hw = (Math.abs(cos) * spec.length + Math.abs(sin) * spec.width) / 2;
    const hh = (Math.abs(sin) * spec.length + Math.abs(cos) * spec.width) / 2;
    let hit = false;
    for (const b of state.buildings) {
      if (car.x + hw > b.x && car.x - hw < b.x + b.w && car.y + hh > b.y && car.y - hh < b.y + b.h) {
        const left = car.x + hw - b.x;
        const right = b.x + b.w - (car.x - hw);
        const top = car.y + hh - b.y;
        const bottom = b.y + b.h - (car.y - hh);
        const min = Math.min(left, right, top, bottom);
        if (min === left) car.x = b.x - hw;
        else if (min === right) car.x = b.x + b.w + hw;
        else if (min === top) car.y = b.y - hh;
        else car.y = b.y + b.h + hh;
        hit = true;
      }
    }
    if (car.x < WORLD.edge) {
      car.x = WORLD.edge;
      hit = true;
    }
    if (car.x > WORLD.width - WORLD.edge) {
      car.x = WORLD.width - WORLD.edge;
      hit = true;
    }
    if (car.y < WORLD.edge) {
      car.y = WORLD.edge;
      hit = true;
    }
    if (car.y > WORLD.waterY - 24) {
      car.y = WORLD.waterY - 24;
      hit = true;
    }
    return hit;
  }

  function damageCar(car, amount, emit) {
    if (car.wrecked) return;
    car.health = Math.max(0, car.health - amount);
    if (car.health <= 0) {
      car.wrecked = true;
      car.speed = 0;
      car.wreckAge = 0;
      state.shake = Math.max(state.shake, 10);
      emit(EVENT_CRASH);
      if (car.missionCar && state.mission && state.mission.carId === car.id) {
        failMission('Your ride was wrecked', emit);
      }
    }
  }

  function crashCar(car, strength, emit) {
    if (car.crashCooldown > 0) return;
    car.crashCooldown = 0.28;
    state.shake = Math.max(state.shake, Math.min(12, 4 + strength * 0.02));
    damageCar(car, clamp(strength * 0.022, 2, 16), emit);
    emit(EVENT_CRASH);
  }

  function updateWalking(dt, input, emit) {
    const player = state.player;
    player.punch = Math.max(0, player.punch - dt);
    player.punchCooldown = Math.max(0, player.punchCooldown - dt);

    if (input.enter) {
      if (player.inCar) {
        exitCar(emit);
      } else {
        let target = null;
        if (!state.mission) {
          for (const marker of state.startMarkers) {
            if (dist(player.x, player.y, marker.x, marker.y) <= PLAYER.markerRange + 8) {
              target = marker;
              break;
            }
          }
        }
        if (target) {
          if (!startMission(target.id, emit)) toast('Mission is not available right now.');
        } else {
          let nearest = null;
          let best = PLAYER.enterRange;
          for (const car of state.cars) {
            if (car.role === 'police' || car.wrecked) continue;
            const d = dist(player.x, player.y, car.x, car.y);
            if (d < best) {
              best = d;
              nearest = car;
            }
          }
          if (nearest) {
            if (nearest.role === 'police') toast('Police cruisers are locked.');
            else enterCar(nearest, false, emit);
          }
        }
      }
    }

    if (player.inCar) return;

    if (input.primary && player.punchCooldown <= 0) {
      player.punch = PLAYER.punchTime;
      player.punchCooldown = PLAYER.punchCooldown;
      emit(EVENT_PUNCH);
      let hit = false;
      for (const ped of state.peds) {
        const dx = ped.x - player.x;
        const dy = ped.y - player.y;
        if (dx * dx + dy * dy > PLAYER.punchReach * PLAYER.punchReach) continue;
        const dot = (dx * Math.cos(player.angle) + dy * Math.sin(player.angle)) / (Math.hypot(dx, dy) || 1);
        if (dot < -0.15) continue;
        ped.fleeTimer = PEDS.fleeTime;
        ped.fleeX = clamp(ped.x + dx * 2.6, 30, WORLD.width - 30);
        ped.fleeY = clamp(ped.y + dy * 2.6, 30, WORLD.waterY - 30);
        hit = true;
      }
      if (hit) {
        addWanted(WANTED.starCrime.punch, 'Assault', emit);
        scarePeds(player.x, player.y);
        toast('Assault! Keep moving.');
      }
    }

    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const moving = input.x !== 0 || input.y !== 0;
    player.running = input.run && moving;
    player.moving = moving;
    if (moving) {
      player.x += input.x * speed * dt;
      player.y += input.y * speed * dt;
      player.angle = Math.atan2(input.y, input.x);
      player.phase += (input.run ? 11 : 7) * dt;
    }
    resolvePlayerBuildings();

    player.hurtCooldown = Math.max(0, player.hurtCooldown - dt);
    player.health = Math.min(PLAYER.maxHealth, player.health + PLAYER.regen * dt);
  }

  function updateDriving(dt, input, emit) {
    const player = state.player;
    const car = player.inCar;
    if (!car) return;
    const spec = VEHICLES[car.type];
    if (car.wrecked) {
      car.speed = 0;
      if (input.enter) exitCar(emit);
      return;
    }
    car.crashCooldown = Math.max(0, car.crashCooldown - dt);

    const throttle = -input.y;
    if (throttle > 0) car.speed += spec.accel * dt;
    else if (throttle < 0) {
      if (car.speed > 0) car.speed -= spec.accel * 1.7 * dt;
      else car.speed -= spec.reverse * dt;
    } else {
      car.speed *= 1 - 1.15 * dt;
    }
    if (input.primary) car.speed *= 1 - 3.6 * dt;
    if (Math.abs(car.speed) < 3 && throttle === 0) car.speed = 0;

    if (Math.abs(car.speed) > 4) {
      const grip = Math.min(1, Math.abs(car.speed) / 190);
      car.angle += input.x * spec.turn * dt * Math.sign(car.speed) * (0.4 + 0.6 * grip);
    }
    car.speed = clamp(car.speed, -spec.reverse, spec.maxSpeed);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    if (resolveCarBuildings(car)) {
      const strength = Math.abs(car.speed);
      car.speed = -car.speed * 0.18;
      crashCar(car, strength, emit);
    }
    player.x = car.x;
    player.y = car.y;
    player.health = Math.min(PLAYER.maxHealth, player.health + PLAYER.regen * dt);
    player.hurtCooldown = Math.max(0, player.hurtCooldown - dt);

    if (input.enter) exitCar(emit);
  }

  function updatePlayer(dt, input, emit) {
    if (state.player.inCar) updateDriving(dt, input, emit);
    else updateWalking(dt, input, emit);
  }

  function nearestIntersectionDistance(car) {
    if (car.axis === 'v') {
      let best = Infinity;
      for (const y of ROADS.horizontal) best = Math.min(best, Math.abs(car.y - y));
      return best;
    }
    let best = Infinity;
    for (const x of ROADS.vertical) best = Math.min(best, Math.abs(car.x - x));
    return best;
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.role !== 'traffic' || car.wrecked) continue;
      if (car.driver === 'player') continue;
      car.stopCooldown = Math.max(0, car.stopCooldown - dt);
      if (car.stopTimer > 0) {
        car.stopTimer -= dt;
        car.speed = 0;
        continue;
      }
      if (car.stopCooldown <= 0 && nearestIntersectionDistance(car) < 18) {
        if (random.chance(TRAFFIC.stopChance)) {
          car.stopTimer = random.range(TRAFFIC.stopMin, TRAFFIC.stopMax);
          car.speed = 0;
        }
        car.stopCooldown = TRAFFIC.stopCooldown;
      }
      if (car.stopTimer > 0) continue;
      car.speed = car.cruise;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.axis === 'v') {
        if (car.dir > 0 && car.y > WORLD.height + 60) car.y = -60;
        if (car.dir < 0 && car.y < -60) car.y = WORLD.height + 60;
      } else {
        if (car.dir > 0 && car.x > WORLD.width + 60) car.x = -60;
        if (car.dir < 0 && car.x < -60) car.x = WORLD.width + 60;
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      ped.hitCooldown = Math.max(0, ped.hitCooldown - dt);
      ped.fleeTimer = Math.max(0, ped.fleeTimer - dt);
      let tx = ped.targetX;
      let ty = ped.targetY;
      let speed = ped.speed;
      if (ped.fleeTimer > 0) {
        tx = ped.fleeX;
        ty = ped.fleeY;
        speed = PEDS.fleeSpeed;
      }
      const dx = tx - ped.x;
      const dy = ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        const point = randomSidewalkPoint();
        ped.targetX = point.x;
        ped.targetY = point.y;
        if (ped.fleeTimer <= 0) {
          tx = ped.targetX;
          ty = ped.targetY;
        }
      } else {
        ped.x += (dx / d) * speed * dt;
        ped.y += (dy / d) * speed * dt;
        ped.phase += speed * dt * 0.09;
      }
      ped.x = clamp(ped.x, 20, WORLD.width - 20);
      ped.y = clamp(ped.y, 20, WORLD.waterY - 20);
    }
  }

  function updatePolice(dt, emit) {
    syncPolice();
    const player = state.player;
    const target = playerPos();
    let nearestDistance = Infinity;
    for (const car of state.cars) {
      if (car.role !== 'police') continue;
      if (car.wrecked) {
        car.speed *= 0.8;
        car.wreckAge += dt;
        continue;
      }
      car.crashCooldown = Math.max(0, car.crashCooldown - dt);
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      const d = Math.hypot(dx, dy);
      nearestDistance = Math.min(nearestDistance, d);
      const desired = Math.atan2(dy, dx);
      const turn = clamp(angleDelta(car.angle, desired), -3.4 * dt, 3.4 * dt);
      car.angle += turn;
      const spec = VEHICLES.police;
      if (d > 78) car.speed = Math.min(spec.maxSpeed, car.speed + spec.accel * dt);
      else car.speed = Math.max(0, car.speed - spec.accel * 2.0 * dt);
      const prevX = car.x;
      const prevY = car.y;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (resolveCarBuildings(car)) {
        const strength = Math.abs(car.speed);
        car.speed = -car.speed * 0.12;
        crashCar(car, strength, emit);
      }
      const moved = dist(car.x, car.y, prevX, prevY);
      if (moved < 0.5 && d > 160) car.stuck += dt;
      else car.stuck = 0;
      if (car.stuck > 2.4) {
        const point = nearestRoadPoint(target.x + random.range(-420, 420), target.y + random.range(-420, 420));
        car.x = clamp(point.x, 50, WORLD.width - 50);
        car.y = clamp(point.y, 50, WORLD.waterY - 50);
        car.angle = Math.atan2(target.y - car.y, target.x - car.x);
        car.speed = 240;
        car.stuck = 0;
      }
    }

    if (!player.inCar && nearestDistance < 36) {
      state.bustTimer += dt;
      if (state.bustTimer >= PLAYER.bustSeconds) {
        applyRespawn('busted');
        emit(EVENT_BUSTED);
        return;
      }
    } else {
      state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    }

    const seen = state.cars.some(
      (car) => car.role === 'police' && !car.wrecked && dist(car.x, car.y, target.x, target.y) < WANTED.vision,
    );
    if (state.wanted > 0) {
      if (seen) state.quiet = 0;
      else state.quiet += dt;
      const limit = WANTED.decaySeconds[state.wanted - 1] ?? 999;
      if (state.quiet >= limit) {
        state.wanted = Math.max(0, state.wanted - 1);
        state.quiet = 0;
        if (state.wanted === 0) toast('You lost the cops. Wanted level cleared.');
        else toast(`Wanted level down to ${state.wanted}.`);
      }
    } else {
      state.quiet = 0;
    }
  }

  function collidePlayerCar(emit) {
    const player = state.player;
    const car = player.inCar;
    if (!car || car.wrecked) return;
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      if (other.role === 'parked' && other.driver === null && dist(car.x, car.y, other.x, other.y) > 58) continue;
      const specA = VEHICLES[car.type];
      const specB = VEHICLES[other.type];
      const minDistance = (specA.length + specB.length) * 0.32;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d >= minDistance || d < 0.001) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = minDistance - d;
      car.x -= nx * overlap * 0.5;
      car.y -= ny * overlap * 0.5;
      other.x += nx * overlap * 0.5;
      other.y += ny * overlap * 0.5;
      const relative = Math.abs(car.speed - other.speed);
      car.speed *= 0.72;
      other.speed *= 0.5;
      if (car.crashCooldown <= 0 && (other.role === 'police' || relative > 90)) {
        car.crashCooldown = 0.35;
        state.shake = Math.max(state.shake, 7);
        damageCar(car, other.role === 'police' ? 7 : 5, emit);
        if (other.role === 'police') {
          damageCar(other, 5, emit);
          player.health = Math.max(0, player.health - 4);
          if (player.health <= 0) {
            applyRespawn('wasted');
            emit(EVENT_WASTED);
            return;
          }
        } else if (other.role === 'traffic') {
          damageCar(other, 6, emit);
          addWanted(1, 'Reckless driving', emit);
        }
        emit(EVENT_CRASH);
      }
    }
  }

  function collidePlayerOnFoot(emit) {
    const player = state.player;
    if (player.inCar) return;
    for (const car of state.cars) {
      if (car.wrecked || car.driver === 'player') continue;
      if (car.role === 'parked' && Math.abs(car.speed) < 20) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < 25 && (Math.abs(car.speed) > 45 || car.role === 'police')) {
        if (player.hurtCooldown > 0) break;
        player.hurtCooldown = PLAYER.hurtCooldown;
        const damage = car.role === 'police' ? 16 : 12;
        player.health = Math.max(0, player.health - damage);
        const away = Math.atan2(player.y - car.y, player.x - car.x);
        player.x = clamp(player.x + Math.cos(away) * 24, WORLD.edge, WORLD.width - WORLD.edge);
        player.y = clamp(player.y + Math.sin(away) * 24, WORLD.edge, WORLD.waterY - 16);
        state.shake = Math.max(state.shake, 9);
        emit(EVENT_CRASH);
        if (car.role === 'traffic') toast('Watch the traffic!');
        if (player.health <= 0) {
          applyRespawn('wasted');
          emit(EVENT_WASTED);
          return;
        }
        break;
      }
    }
  }

  function hitPedsWithCar(emit) {
    const player = state.player;
    const car = player.inCar;
    if (!car || car.wrecked || Math.abs(car.speed) < 90) return;
    for (const ped of state.peds) {
      if (ped.hitCooldown > 0) continue;
      if (dist(ped.x, ped.y, car.x, car.y) > 34) continue;
      ped.hitCooldown = 3;
      ped.fleeTimer = PEDS.fleeTime;
      ped.fleeX = clamp(ped.x + Math.cos(car.angle) * 380, 30, WORLD.width - 30);
      ped.fleeY = clamp(ped.y + Math.sin(car.angle) * 380, 30, WORLD.waterY - 30);
      addWanted(WANTED.starCrime.hitPed, 'Hit and run', emit);
      scarePeds(car.x, car.y);
      toast('Hit and run!');
      break;
    }
  }

  function updatePickups(dt, emit) {
    const pos = playerPos();
    for (const item of state.pickups) {
      if (item.active) {
        if (dist(pos.x, pos.y, item.x, item.y) <= PICKUPS.radius) {
          item.active = false;
          item.respawn = random.range(PICKUPS.respawnMin, PICKUPS.respawnMax);
          state.cash += PICKUPS.amount;
          state.totalEarned += PICKUPS.amount;
          state.bestEarnings = Math.max(state.bestEarnings, state.totalEarned);
          toast(`+$${PICKUPS.amount}`);
          emit(EVENT_PICKUP);
          saveGame();
        }
      } else {
        item.respawn -= dt;
        if (item.respawn <= 0) relocatePickup(item);
      }
    }
  }

  function updateMission(dt, emit) {
    const mission = state.mission;
    if (!mission) return;
    mission.timeLeft -= dt;
    if (mission.timeLeft <= 0) {
      failMission('Time ran out', emit);
      return;
    }
    const player = state.player;
    const pos = playerPos();
    const car = player.inCar;

    if (mission.id === 'firstFare') {
      const taxi = state.cars.find((c) => c.id === mission.carId);
      if (taxi && taxi.wrecked) {
        failMission('The taxi was wrecked', emit);
        return;
      }
      if (mission.stage === 'pickup') {
        if (car && car.id === mission.carId && dist(car.x, car.y, PLACES.oceanPickup.x, PLACES.oceanPickup.y) < 68) {
          mission.stage = 'dropoff';
          mission.stageText = 'Take the fare to Marina Hotel';
          mission.objectives = [{ x: PLACES.marinaHotel.x, y: PLACES.marinaHotel.y, label: 'MARINA HOTEL' }];
          mission.stageFlash = 2;
          toast('Fare aboard — Marina Hotel, step on it!');
          emit(EVENT_UI);
        }
      } else if (mission.stage === 'dropoff') {
        if (car && car.id === mission.carId && dist(car.x, car.y, PLACES.marinaHotel.x, PLACES.marinaHotel.y) < 70) {
          completeMission(emit);
        }
      }
    } else if (mission.id === 'hotWheels') {
      const comet = state.cars.find((c) => c.id === mission.carId);
      if (comet && comet.wrecked) {
        failMission('The Comet GT was wrecked', emit);
        return;
      }
      if (mission.stage === 'steal') {
        if (car && car.id === mission.carId) {
          mission.stage = 'deliver';
          mission.stageText = 'Deliver the Comet GT to the chop shop';
          mission.objectives = [{ x: PLACES.chopDoor.x, y: PLACES.chopDoor.y, label: 'CHOP SHOP' }];
          mission.stageFlash = 2;
          toast('Comet secured — lose the heat at the chop shop!');
          emit(EVENT_UI);
        }
      } else if (mission.stage === 'deliver') {
        if (car && car.id === mission.carId && dist(car.x, car.y, PLACES.chopDoor.x, PLACES.chopDoor.y) < 74) {
          completeMission(emit);
        }
      }
    } else if (mission.id === 'courier') {
      if (mission.stage === 'collect') {
        for (const objective of mission.objectives) {
          if (objective.done) continue;
          if (dist(pos.x, pos.y, objective.x, objective.y) < 52) {
            objective.done = true;
            mission.collected += 1;
            mission.stageFlash = 2;
            toast(`Package ${mission.collected}/3 secured`);
            emit(EVENT_PICKUP);
          }
        }
        const remaining = mission.objectives.filter((o) => !o.done);
        mission.stageText = `Collect the packages (${mission.collected}/3)`;
        mission.objectives = mission.objectives.filter((o) => !o.done);
        if (mission.collected >= 3) {
          mission.stage = 'deliver';
          mission.stageText = 'Deliver the packages to Bayfront Garage';
          mission.objectives = [{ x: PLACES.garageDoor.x, y: PLACES.garageDoor.y, label: 'BAYFRONT GARAGE' }];
          toast('All packages collected — Bayfront Garage!');
          emit(EVENT_UI);
        } else if (remaining.length === mission.objectives.length) {
          // no change
        }
      } else if (mission.stage === 'deliver') {
        if (dist(pos.x, pos.y, PLACES.garageDoor.x, PLACES.garageDoor.y) < 74) {
          completeMission(emit);
        }
      }
    }

    if (state.mission && state.mission.stageFlash > 0) state.mission.stageFlash -= dt;
  }

  function applyRespawn(kind) {
    const player = state.player;
    if (player.inCar) {
      const car = player.inCar;
      car.driver = null;
      player.inCar = null;
    }
    const loss = state.cash > 0 ? Math.min(state.cash, Math.max(25, Math.round(state.cash * 0.15))) : 0;
    state.cash -= loss;
    state.lastLoss = loss;
    state.player.health = PLAYER.maxHealth;
    state.player.x = PLACES.hospitalDoor.x + (kind === 'wasted' ? 26 : -26);
    state.player.y = PLACES.hospitalDoor.y;
    state.player.angle = -Math.PI / 2;
    state.player.punch = 0;
    state.player.hurtCooldown = 1;
    state.wanted = 0;
    state.quiet = 0;
    state.bustTimer = 0;
    state.shake = 0;
    state.toast = null;
    state.cars = state.cars.filter((car) => car.role !== 'police');
    if (state.mission) {
      const missionId = state.mission.id;
      state.mission = null;
      toast(`${MISSIONS[missionId]?.title ?? 'Mission'} failed — you were ${kind === 'busted' ? 'busted' : 'wasted'}`, 3.2);
    }
    saveGame();
  }

  function updateHint() {
    const player = state.player;
    if (player.inCar) {
      state.actionHint = '';
      return;
    }
    if (!state.mission) {
      for (const marker of state.startMarkers) {
        if (dist(player.x, player.y, marker.x, marker.y) <= PLAYER.markerRange + 8) {
          state.actionHint = `Press E — ${marker.title} ($${marker.reward})`;
          return;
        }
      }
    }
    let nearest = null;
    let best = PLAYER.enterRange;
    for (const car of state.cars) {
      if (car.wrecked) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < best) {
        best = d;
        nearest = car;
      }
    }
    if (nearest) {
      state.actionHint = nearest.role === 'police' ? 'Police cruiser — locked' : `Press E — Enter ${VEHICLES[nearest.type].label}`;
    } else {
      state.actionHint = '';
    }
  }

  function cleanup(dt) {
    state.cars = state.cars.filter((car) => {
      if (car.role === 'police' && car.wrecked) return car.wreckAge < 6;
      return true;
    });
  }

  function seedWorld() {
    generateCity();
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < 8; i += 1) spawnParkedCar();
    for (let i = 0; i < PEDS.count; i += 1) spawnPedestrian();
    for (let i = 0; i < PICKUPS.count; i += 1) spawnPickup();

    const taxi = makeCar('taxi', PLACES.taxiStand.x, PLACES.taxiStand.y + 72, -Math.PI / 2, 'parked', { missionCar: 'firstFare' });
    state.cars.push(taxi);
    const comet = makeCar('sports', PLACES.sunsetMotel.x, PLACES.sunsetMotel.y + 82, Math.PI / 2, 'parked', { missionCar: 'hotWheels' });
    state.cars.push(comet);

    for (const marker of state.startMarkers) {
      if (marker.id === 'firstFare') {
        marker.x = PLACES.taxiStand.x;
        marker.y = PLACES.taxiStand.y;
      } else if (marker.id === 'hotWheels') {
        marker.x = PLACES.sunsetMotel.x;
        marker.y = PLACES.sunsetMotel.y;
      } else if (marker.id === 'courier') {
        marker.x = PLACES.courierStart.x;
        marker.y = PLACES.courierStart.y;
      }
    }
  }

  function step(dt, input) {
    const control = input ?? { x: 0, y: 0, run: false, primary: false, enter: false };
    let events = 0;
    const emit = (flag) => {
      events |= flag;
    };

    state.time += dt;
    state.player.punchCooldown = Math.max(0, state.player.punchCooldown - dt);
    if (state.toast) {
      state.toast.time -= dt;
      if (state.toast.time <= 0) state.toast = null;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 26 * dt);

    if (!state.passive) updatePlayer(dt, control, emit);
    updateTraffic(dt);
    updatePeds(dt);
    if (!state.passive) {
      updatePolice(dt, emit);
      collidePlayerCar(emit);
      collidePlayerOnFoot(emit);
      hitPedsWithCar(emit);
      updatePickups(dt, emit);
      updateMission(dt, emit);
      cleanup(dt);
      updateHint();
    }
    return events;
  }

  seedWorld();

  return {
    state,
    step,
    save: saveGame,
    toast,
    addWanted,
    setWanted,
    spawnPoliceNear,
    clearPolice,
    giveCar,
    enterCar,
    exitCar,
    teleportPlayer,
    startMission,
    failMission,
    completeMission,
    nearestRoadPoint,
    playerPos,
  };
}
