// NEON BAY — every tuning number and colour in one place.
// The world is 3600 x 2600 world pixels. A 96 px road grid cuts the city into blocks;
// the beach and the bay fill the south edge. All gameplay reads its numbers from here.

/** The fixed simulation step: 60 updates a second whatever the display does. */
export const STEP = 1 / 60;

export const WORLD = {
  width: 3600,
  height: 2600,
  roadWidth: 96,
  sidewalk: 14,
  beachY: 2340,
  waterY: 2480,
  edge: 24,
};

/** Main-road centre lines. Every odd number below is a seeded city, not a fixed map. */
export const ROADS = {
  vertical: [240, 640, 1040, 1440, 1840, 2240, 2640, 3040, 3360],
  horizontal: [220, 520, 820, 1120, 1420, 1720, 2020, 2280],
  namesV: {
    240: 'Harbor St',
    640: 'Ash Ave',
    1040: 'Vine St',
    1440: 'Central Blvd',
    1840: 'Sunset Blvd',
    2240: 'Bay St',
    2640: 'Gold Coast Dr',
    3040: 'Ocean Ave',
    3360: 'East Pier',
  },
  namesH: {
    220: 'North Ridge',
    520: 'Palms Rd',
    820: 'Sunset Blvd',
    1120: 'Downtown Ave',
    1420: 'Market St',
    1720: 'Marina Way',
    2020: 'Dockside Rd',
    2280: 'Shoreline Dr',
  },
};

/** Named places. Buildings sit in their own block; target points sit on the road grid. */
export const SPECIAL = {
  park: { x: 1488, y: 1168, w: 304, h: 204, name: 'Neon Park' },
  hospital: { x: 688, y: 568, w: 304, h: 204, name: 'St. Mary Hospital' },
  chop: { x: 288, y: 2068, w: 304, h: 164, name: 'Chop Shop' },
  garage: { x: 2288, y: 2068, w: 304, h: 164, name: 'Bayfront Garage' },
};

export const PLACES = {
  start: { x: 1040, y: 1260 },
  hospitalDoor: { x: 840, y: 796 },
  taxiStand: { x: 1040, y: 880 },
  sunsetMotel: { x: 2640, y: 560 },
  courierStart: { x: 1840, y: 1420 },
  oceanPickup: { x: 3040, y: 1120 },
  marinaHotel: { x: 3040, y: 1720 },
  chopDoor: { x: 440, y: 2068 },
  garageDoor: { x: 2440, y: 2068 },
  bayfront: { x: 2440, y: 2068 },
};

export const PLAYER = {
  radius: 10,
  walkSpeed: 150,
  runSpeed: 250,
  maxHealth: 100,
  regen: 2.5,
  punchTime: 0.28,
  punchCooldown: 0.4,
  punchReach: 42,
  enterRange: 58,
  markerRange: 64,
  hurtCooldown: 0.6,
  bustSeconds: 1.4,
};

/** Six vehicle classes; the numbers drive both physics and looks. */
export const VEHICLES = {
  sedan: {
    label: 'Sedan',
    length: 64,
    width: 30,
    accel: 430,
    reverse: 280,
    maxSpeed: 540,
    turn: 2.7,
    color: '#b23a36',
    roof: '#8e2b29',
  },
  sports: {
    label: 'Comet GT',
    length: 66,
    width: 30,
    accel: 560,
    reverse: 300,
    maxSpeed: 700,
    turn: 3.0,
    color: '#f2c53d',
    roof: '#c99a22',
  },
  taxi: {
    label: 'Taxi',
    length: 64,
    width: 30,
    accel: 450,
    reverse: 280,
    maxSpeed: 560,
    turn: 2.8,
    color: '#f0b52a',
    roof: '#c98f16',
  },
  truck: {
    label: 'Truck',
    length: 84,
    width: 34,
    accel: 330,
    reverse: 220,
    maxSpeed: 430,
    turn: 2.1,
    color: '#64808f',
    roof: '#4a616e',
  },
  van: {
    label: 'Van',
    length: 74,
    width: 32,
    accel: 380,
    reverse: 250,
    maxSpeed: 470,
    turn: 2.3,
    color: '#4f8a5b',
    roof: '#3a6d45',
  },
  police: {
    label: 'Police Cruiser',
    length: 66,
    width: 30,
    accel: 520,
    reverse: 300,
    maxSpeed: 650,
    turn: 3.1,
    color: '#2b5d9e',
    roof: '#1c4275',
  },
};

export const TRAFFIC = {
  count: 16,
  speedMin: 120,
  speedMax: 190,
  stopMin: 0.6,
  stopMax: 2.0,
  stopChance: 0.55,
  stopCooldown: 5,
};

export const PEDS = {
  count: 26,
  speed: 42,
  fleeSpeed: 125,
  fleeRadius: 360,
  fleeTime: 3.5,
  roamRadius: 620,
};

export const PICKUPS = {
  count: 8,
  amount: 25,
  radius: 24,
  respawnMin: 18,
  respawnMax: 38,
};

export const WANTED = {
  max: 5,
  decaySeconds: [14, 20, 28, 38, 50],
  policeByStar: [0, 1, 2, 3, 4, 4],
  vision: 1050,
  spawnMin: 560,
  spawnMax: 820,
  sirenRange: 950,
  starCrime: {
    steal: 1,
    punch: 1,
    hitPed: 1,
    ramPolice: 1,
  },
};

export const MISSIONS = {
  firstFare: {
    id: 'firstFare',
    title: 'First Fare',
    reward: 150,
    time: 75,
    marker: { x: PLACES.taxiStand.x, y: PLACES.taxiStand.y },
    blurb: 'Take the yellow taxi to Ocean Ave.',
  },
  hotWheels: {
    id: 'hotWheels',
    title: 'Hot Wheels',
    reward: 300,
    time: 100,
    marker: { x: PLACES.sunsetMotel.x, y: PLACES.sunsetMotel.y },
    blurb: 'Boost the Comet GT outside Sunset Motel.',
  },
  courier: {
    id: 'courier',
    title: 'Courier Run',
    reward: 250,
    time: 120,
    marker: { x: PLACES.courierStart.x, y: PLACES.courierStart.y },
    blurb: 'Collect three packages and reach Bayfront Garage.',
  },
};

export const COURIER_PACKAGES = [
  { x: 1040, y: 1420 },
  { x: 2240, y: 520 },
  { x: 3360, y: 1120 },
];

export const CAMERA = {
  walkZoom: 1.0,
  carZoom: 0.72,
  titleZoom: 0.56,
  follow: 7.5,
  titlePanX: 250,
  titlePanY: 150,
};

export const COLORS = {
  bay: '#123a55',
  grassA: '#5d7a4a',
  grassB: '#698850',
  grassLine: '#557043',
  park: '#4d7a42',
  parkPath: '#b8a273',
  road: '#30343a',
  roadEdge: '#262a2f',
  sidewalk: '#9b9a90',
  sidewalkLine: '#89887f',
  lane: '#e6d27b',
  crosswalk: '#e8e4d5',
  sand: '#d8bd8a',
  sandDark: '#c8aa75',
  water: '#1f517c',
  waterDeep: '#173f60',
  foam: '#9dc7d4',
  wall: '#6f5a55',
  windowsLit: '#ffd27a',
  windowsDark: '#3b4654',
  tree: '#356b39',
  treeLight: '#447a45',
  trunk: '#6b4a2f',
  player: '#e4483f',
  playerDark: '#a92c2a',
  skin: '#e9b98d',
  gold: '#f5c542',
  goldDark: '#b68a18',
  marker: '#ffd75e',
  money: '#62d67a',
  danger: '#e8504a',
  policeBlue: '#4b8fe0',
  policeRed: '#e8505c',
  hudBg: 'rgba(8, 14, 24, 0.74)',
  hudLine: 'rgba(255, 214, 120, 0.35)',
  text: '#f4efe4',
  muted: '#a9b2bd',
  shadow: 'rgba(8, 10, 18, 0.30)',
  sunset: 'rgba(255, 122, 61, 0.10)',
  neon: '#58e0d0',
  neonPink: '#ff5fa2',
};

export const PED_COLORS = ['#d9c25a', '#7aa4c4', '#c46b5a', '#8a76b8', '#6fb08a', '#d18a4e', '#b5b5a8', '#cf6b8e'];

export const ROOF_COLORS = ['#b5654a', '#c47b52', '#a85a4a', '#c98d5a', '#9c5a4f', '#b07a51', '#d19a63', '#a9675b'];

export const SAVE_KEY = 'neon-bay.save.v1';

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const MONO = '"Courier New", "DejaVu Sans Mono", monospace';

export const FALLBACK_SEED = 7;
