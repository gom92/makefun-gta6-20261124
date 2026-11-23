import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const NEUTRAL = { x: 0, y: 0, run: false, primary: false, enter: false };

function simulate(world, seconds, control = () => NEUTRAL) {
  const steps = Math.max(1, Math.round(seconds / STEP));
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, control(i * STEP));
  }
}

function clearRoad(world, axis, centre, from, to, pad = 80) {
  world.state.cars = world.state.cars.filter((car) => {
    if (car.role === 'police' || car.driver === 'player') return true;
    if (axis === 'v') return !(Math.abs(car.x - centre) < pad && car.y > from && car.y < to);
    return !(Math.abs(car.y - centre) < pad && car.x > from && car.x < to);
  });
}

function placeTraffic(world, car, axis, dir, roadCoord, along, speed) {
  if (!car) return;
  car.role = 'traffic';
  car.driver = 'npc';
  car.axis = axis;
  car.dir = dir;
  car.stopTimer = 0;
  car.stopCooldown = 12;
  car.wrecked = false;
  car.health = car.maxHealth;
  car.speed = speed;
  car.cruise = speed;
  if (axis === 'v') {
    car.x = roadCoord + (dir > 0 ? -24 : 24);
    car.y = along;
    car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y = roadCoord + (dir > 0 ? 24 : -24);
    car.x = along;
    car.angle = dir > 0 ? 0 : Math.PI;
  }
}

function chaseShot(world) {
  const state = world.state;
  state.passive = false;
  state.mission = null;
  state.toast = null;
  state.cash = 1875;
  state.bestEarnings = 4820;
  state.completed = ['firstFare', 'courier'];
  state.wanted = 0;
  state.quiet = 0;
  state.bustTimer = 0;
  world.clearPolice();
  clearRoad(world, 'v', 3040, 900, 2320, 90);

  const car = world.giveCar('sports', 3040, 1900, -Math.PI / 2, { role: 'parked', speed: 500, missionCar: 'shotChase' });
  car.health = 100;
  world.enterCar(car, true);

  world.setWanted(3);
  world.clearPolice();
  const police = [];
  for (let i = 0; i < 3; i += 1) {
    const cruiser = world.giveCar('police', 3040, 2040 + i * 110, -Math.PI / 2, { role: 'police', speed: 200 });
    cruiser.driver = 'police';
    cruiser.health = 100;
    police.push(cruiser);
  }

  simulate(world, 0.95, () => ({ x: 0, y: -1, run: false, primary: false, enter: false }));

  if (car.wrecked || car.health < 70) {
    car.wrecked = false;
    car.health = 100;
  }
  if (car.speed < 260) car.speed = 470;
  state.wanted = 3;
  state.quiet = 0;
  state.toast = null;
  for (let i = 0; i < police.length; i += 1) {
    const cruiser = police[i];
    if (cruiser.wrecked) {
      cruiser.wrecked = false;
      cruiser.health = 100;
    }
    if (Math.abs(cruiser.x - car.x) > 220 || cruiser.y < car.y) {
      cruiser.x = car.x + (i === 2 ? 26 : 0);
      cruiser.y = car.y + 150 + i * 105;
      cruiser.angle = -Math.PI / 2;
      cruiser.speed = 260;
    }
  }
  return { screen: SCREEN_PLAY };
}

function taxiShot(world) {
  const state = world.state;
  state.passive = false;
  state.mission = null;
  state.toast = null;
  state.cash = 640;
  state.bestEarnings = 4820;
  state.completed = ['firstFare'];
  state.wanted = 0;
  state.bustTimer = 0;
  world.clearPolice();
  clearRoad(world, 'v', 3040, 900, 1950, 95);

  if (!world.startMission('firstFare')) return { screen: SCREEN_PLAY };
  world.teleportPlayer(3040, 1120);
  const car = state.player.inCar;
  if (!car) return { screen: SCREEN_PLAY };
  car.speed = 0;
  simulate(world, 0.35, () => NEUTRAL);

  world.teleportPlayer(3040, 1250);
  car.angle = Math.PI / 2;
  car.speed = 200;
  car.health = 100;
  simulate(world, 0.9, () => ({ x: 0, y: -1, run: false, primary: false, enter: false }));

  if (car.wrecked || car.health < 80) {
    car.wrecked = false;
    car.health = 100;
  }
  if (car.speed < 150) car.speed = 380;
  state.wanted = 0;
  state.quiet = 0;
  world.clearPolice();
  state.cars = state.cars.filter((other) => other === car || other.role === 'police' || Math.hypot(other.x - car.x, other.y - car.y) > 150);
  if (state.mission) {
    state.mission.timeLeft = 48;
    state.mission.stage = 'dropoff';
    state.mission.stageText = 'Take the fare to Marina Hotel';
    state.mission.objectives = [{ x: 3040, y: 1720, label: 'MARINA HOTEL' }];
  }
  state.toast = null;
  return { screen: SCREEN_PLAY };
}

function streetShot(world) {
  const state = world.state;
  state.passive = false;
  state.mission = null;
  state.toast = null;
  state.cash = 1260;
  state.bestEarnings = 4820;
  state.completed = ['firstFare'];
  state.wanted = 0;
  world.clearPolice();
  if (state.player.inCar) world.exitCar();
  state.player.x = 1385;
  state.player.y = 740;
  state.player.angle = Math.PI / 2;
  state.player.health = 100;
  state.player.hurtCooldown = 2;

  const traffic = state.cars.filter((car) => car.role === 'traffic');
  placeTraffic(world, traffic[0], 'v', 1, 1440, 610, 150);
  placeTraffic(world, traffic[1], 'v', 1, 1440, 1010, 132);
  placeTraffic(world, traffic[2], 'h', 1, 820, 1080, 158);
  placeTraffic(world, traffic[3], 'h', -1, 820, 1770, 140);
  placeTraffic(world, traffic[4], 'v', -1, 1840, 950, 126);

  const spots = [
    [1495, 760],
    [1495, 882],
    [1385, 900],
    [1540, 765],
    [1350, 790],
    [1600, 880],
  ];
  for (let i = 0; i < spots.length && i < state.peds.length; i += 1) {
    state.peds[i].x = spots[i][0];
    state.peds[i].y = spots[i][1];
    state.peds[i].targetX = spots[i][0] + (i % 2 === 0 ? 120 : -110);
    state.peds[i].targetY = spots[i][1] + (i % 3 === 0 ? 60 : -40);
    state.peds[i].fleeTimer = 0;
  }

  const pickup = state.pickups[0];
  if (pickup) {
    pickup.x = 1535;
    pickup.y = 700;
    pickup.active = true;
    pickup.respawn = 0;
  }

  simulate(world, 0.55, () => ({ x: 0, y: 0.45, run: false, primary: false, enter: false }));
  state.toast = null;
  state.player.health = 100;
  return { screen: SCREEN_PLAY };
}

function titleShot(world) {
  const state = world.state;
  state.passive = true;
  state.mission = null;
  state.toast = null;
  state.cash = 1450;
  state.bestEarnings = 4820;
  state.completed = ['firstFare', 'courier'];
  state.wanted = 0;
  world.clearPolice();
  if (state.player.inCar) world.exitCar();
  state.player.x = 1640;
  state.player.y = 1300;
  state.player.angle = 0;

  const traffic = state.cars.filter((car) => car.role === 'traffic');
  placeTraffic(world, traffic[0], 'v', 1, 1840, 980, 160);
  placeTraffic(world, traffic[1], 'v', -1, 1840, 1560, 150);
  placeTraffic(world, traffic[2], 'h', 1, 1120, 1460, 165);
  placeTraffic(world, traffic[3], 'h', -1, 1420, 2080, 155);
  placeTraffic(world, traffic[4], 'v', 1, 1440, 1320, 145);
  placeTraffic(world, traffic[5], 'h', 1, 820, 1760, 160);

  for (let i = 0; i < 6 && i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    ped.x = 1790 + (i % 3) * 42;
    ped.y = 1190 + Math.floor(i / 3) * 70;
    ped.targetX = ped.x + (i % 2 === 0 ? 80 : -80);
    ped.targetY = ped.y + 30;
  }

  simulate(world, 1.2, () => NEUTRAL);
  state.toast = null;
  return { screen: SCREEN_TITLE };
}

export function stageShot(name, world) {
  if (name === 'chase') return chaseShot(world);
  if (name === 'taxi') return taxiShot(world);
  if (name === 'street') return streetShot(world);
  if (name === 'title') return titleShot(world);
  return { screen: SCREEN_TITLE };
}
