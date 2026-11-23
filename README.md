# NEON BAY

A top-down 2D open-world crime game in the spirit of GTA, built for the
make.fun "Make GTA 6" bounty (gta6-01). Plain static files — no build step,
no external assets, no network requests. The sunset city (3600×2600), its
traffic, pedestrians, vehicles, police chases, wanted stars, three missions
and all sound are generated in code: Canvas 2D for art, WebAudio for the
engine, sirens and effects.

## The game

Rico Vance arrives in Neon Bay broke. Walk the streets, steal cars, run
fares and deliveries, and either lose the cops or wake up at St. Mary
Hospital. Getting busted or wasted costs 15% of your cash (minimum $25).
Cash, best earnings and completed missions persist in `localStorage`.

Missions (start at the markers on the map):

- **First Fare** — $150. Take the yellow taxi from the stand to Ocean Ave,
  pick up the fare and drop them at Marina Hotel.
- **Hot Wheels** — $300. Boost the Comet GT outside Sunset Motel and deliver
  it to the Chop Shop while the cops chase you.
- **Courier Run** — $250. Collect three packages around the city and reach
  Bayfront Garage before the timer runs out.

Stealing a parked car raises your wanted level; so do reckless driving and
hit-and-runs. Police cruisers chase, ram and try to bust you on foot — get
too close to one while wanted and the bust timer starts. Cash pickups worth
$25 are scattered around the city. Your health regenerates slowly; a police
ram at speed can still waste you.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move on foot, steer and throttle in a car |
| Shift | Run |
| Space | Start / confirm; punch on foot; handbrake in a car |
| Enter | Confirm menus |
| E | Enter or exit a car; start a mission at its marker |
| P or Esc | Pause / resume |
| M | Mute / unmute |

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Open `http://localhost:8080` and press Space. `?debug=1&seed=7` exposes
`window.__neonBay` for inspection and makes the city deterministic.

## Files

```
main.ts                  hand-in plumbing: copies game/ + screenshots/ to
                         the output dir and writes dossier.json
serve.ts                 tiny static server for local play (port 8080)
shots.json               screenshot list: name + ?shot= URL for each shot
game/index.html          canvas page, loads src/main.js
game/src/config.js       world layout, vehicles, missions, tuning constants
game/src/random.js       seeded RNG
game/src/input.js        keyboard input (held keys + one-shot action queue)
game/src/world.js        simulation: player, cars, traffic, police, wanted
                         level, missions, pickups, collisions, respawns
game/src/render.js       Canvas 2D drawing: city, cars, HUD, title/pause/
                         busted/wasted screens
game/src/audio.js        WebAudio: engine hum, sirens, crash/pickup/win
game/src/main.js         game loop, screens, shot staging entry point
game/src/shots.js        staged scenes for the four screenshots
tools/game-test.mjs     headless Playwright checks (29 checks, seed 7)
tools/take-shots.mjs     renders the four screenshots at 1280×720
tools/package.json       playwright-core dependency for the tools above
vendor/makefun-game.ts   vendored make.fun dossier builder (do not edit)
```

## Tests and screenshots

```sh
cd tools && npm install   # playwright-core
node game-test.mjs        # 29 checks against http://localhost:8080
node take-shots.mjs       # writes screenshots/*.jpg (1280×720, seed 7)
```

Screenshots (all staged with `?shot=<name>&seed=7`, deterministic):

1. `1-chase.jpg` — **cover.** Rico in the sports car at speed, three
   police cruisers in pursuit behind him, 3 wanted stars.
2. `2-taxi.jpg` — First Fare in progress: the taxi mid-run to Marina Hotel.
3. `3-street.jpg` — Rico on foot downtown, traffic and pedestrians around
   him, a $25 cash pickup nearby.
4. `4-title.jpg` — the title screen over the living city.

## Build the submission

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`out/` holds `game/`, `screenshots/` and `dossier.json`.
