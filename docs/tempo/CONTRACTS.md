# TEMPO — Frozen Contracts

Every signature, constant, and data shape in this file is **fixed**. Implement against
it exactly. Do not rename, do not add parameters, do not "improve" a shape. If a ticket
appears to require a change here, stop and ask.

Why this file exists: tickets are implemented in separate sessions that cannot see each
other's code. The only thing keeping them compatible is this document.

---

## 1. Layout

```
index.html
package.json                  type:module, scripts, playwright as sole devDependency
CLAUDE.md  CONTRACTS.md  DESIGN.md  TASKS.md
src/
  main.js                     bootstrap: build state, wire loop, start
  state.js                    createState() — the single game-state object
  core/
    loop.js  rng.js  pool.js  grid.js  math.js  input.js  audio.js
  game/
    tempo.js  player.js  bullets.js  weapons.js  enemies.js  spawner.js
    xp.js  upgrades.js  collision.js
  render/
    canvas.js  camera.js  palette.js  renderer.js  particles.js  hud.js
  ui/
    draft.js  menus.js
tests/
  *.test.js                   node --test, DOM-free
  guard.test.js               architecture rules (no DOM, no Math.random)
  smoke.mjs                   playwright
scripts/fetch-assets.mjs
assets/                       fetched only; never hand-committed
```

**Module rule.** `src/core/**` and `src/game/**` are DOM-free and unit-testable in
Node. Exceptions, permitted to touch the DOM: `core/input.js`, `core/audio.js`,
`src/render/**`, `src/ui/**`, `src/main.js`. Enforced by `tests/guard.test.js`.

---

## 2. Constants

All live in `src/constants.js` and are imported. Never inline a magic number that
appears here.

```js
export const SIM_HZ        = 120;    // fixed simulation rate
export const SIM_DT        = 1 / SIM_HZ;
export const MAX_FRAME_MS  = 100;    // clamp after tab-out; prevents spiral of death
export const MAX_STEPS     = 8;      // max sim steps per rendered frame

export const ARENA_W       = 2400;
export const ARENA_H       = 2400;

// Tempo — the core mechanic (DESIGN.md §2.1)
export const TEMPO_FLOOR   = 0.03;   // world never fully stops
export const TEMPO_CURVE   = 1.4;    // convex: a light touch buys a lot of slow-mo
export const TEMPO_SMOOTH  = 0.060;  // seconds; exponential damping toward target

// Player
export const PLAYER_MAX_SPEED = 260;  // px/s
export const PLAYER_ACCEL     = 2200; // px/s^2
export const PLAYER_FRICTION  = 1800; // px/s^2
export const PLAYER_RADIUS    = 10;
export const PLAYER_HP        = 100;
export const PLAYER_IFRAMES   = 0.60; // s real, after taking a hit

// Dash — forces tempo to 1.0, so escape is never free
export const DASH_SPEED       = 900;  // px/s
export const DASH_TIME        = 0.16; // s real
export const DASH_IFRAMES     = 0.22; // s real
export const DASH_COOLDOWN    = 3.0;  // s real
export const DASH_TEMPO_TAIL  = 0.35; // s real of forced full tempo after the dash

// Pulse gun (starting weapon)
export const PULSE_INTERVAL   = 0.22; // s WORLD time — this is what ties DPS to movement
export const PULSE_DAMAGE     = 10;
export const PULSE_SPEED      = 520;
export const PULSE_RADIUS     = 4;
export const PULSE_LIFE       = 1.4;  // s world

// Drifter (first enemy)
export const DRIFTER_HP       = 20;
export const DRIFTER_SPEED    = 70;
export const DRIFTER_RADIUS   = 11;
export const DRIFTER_DAMAGE   = 8;
export const DRIFTER_XP       = 1;

export const GRID_CELL        = 64;

export const POOL_BULLETS   = 2000;
export const POOL_ENEMIES   = 600;
export const POOL_PARTICLES = 3000;
export const POOL_XP        = 500;
export const POOL_NUMBERS   = 200;
```

---

## 3. Core modules

### 3.1 `core/math.js`

```js
export function clamp(v, lo, hi)
export function lerp(a, b, t)
export function expDamp(current, target, smoothingSeconds, dt) // frame-rate independent
export function len(x, y)
export function norm(x, y, out)      // out = {x,y}; zero vector -> {0,0}
export function angleTo(ax, ay, bx, by)
```

`expDamp` must be frame-rate independent: `target + (current - target) * Math.exp(-dt / smoothing)`.

### 3.2 `core/rng.js` — mulberry32

```js
export function createRng(seed)      // seed: uint32
// returns:
{
  next(),                            // float in [0,1)
  float(min, max),
  int(min, maxExclusive),
  pick(array),
  angle(),                           // [0, 2*PI)
  fork(),                            // independent child rng, derived deterministically
  seed                               // the original seed, read-only
}
```

Same seed must always produce the same sequence. No `Math.random()` anywhere.

### 3.3 `core/pool.js`

```js
export function createPool(factory, reset, capacity)
// factory() -> new object with `active:false`
// reset(obj) -> return obj to a clean inactive state
{
  spawn(),                 // -> object with active=true, or null if at capacity
  release(obj),
  releaseAll(),
  forEachActive(fn),       // fn(obj, index); must not allocate
  activeCount,             // getter
  capacity
}
```

Pools pre-allocate all `capacity` objects at construction. `spawn()` must never
allocate. Returning `null` at capacity is correct behavior, not an error — callers
handle it.

### 3.4 `core/grid.js` — spatial hash

```js
export function createGrid(cellSize, width, height)
{
  clear(),
  insert(obj),             // uses obj.x, obj.y
  query(x, y, radius, out) // pushes candidates into `out` array, returns out
}
```

`query` is broad-phase: it may return extras, never misses. Callers do the narrow
circle test. `out` is caller-owned and reused — `query` must not allocate.

### 3.5 `core/loop.js`

```js
export function createLoop({ update, render, now })
// update(SIM_DT) at a fixed SIM_HZ via accumulator
// render(alpha) once per rAF; alpha in [0,1) for interpolation
// now: optional () => ms, injectable so tests can drive a fake clock
{
  start(), stop(),
  step(frameMs),           // advances one frame manually; used by tests
  stats                    // { fps, simMs, renderMs, steps }
}
```

Clamp each frame to `MAX_FRAME_MS` and at most `MAX_STEPS` sim steps.

### 3.6 `core/input.js` (DOM allowed)

```js
export function createInput(target)
{
  axis,                    // {x,y} normalized, magnitude <= 1 — this drives tempo
  aim,                     // {x,y} unit vector from player toward the cursor
  aimScreen,               // {x,y} raw cursor position in canvas pixels
  pressed(action),         // 'dash' | 'pause' | 'walk'
  justPressed(action),
  endFrame(),              // clears the just-pressed edges; call once per rendered frame
  setVirtual(axis, aim)    // test hook: drive input programmatically
}
```

`walk` is a held modifier giving keyboard players a half-magnitude axis, so they get the
fine tempo control a gamepad stick has for free.

---

## 4. Game state

`src/state.js` exports `createState(seed)`. This object is the entire simulation. It is
DOM-free, and everything in `src/game/**` reads and writes it.

```js
{
  seed, rng,
  time:  { real: 0, world: 0 },      // seconds accumulated
  world: { scale: 1, forced: 0 },    // scale = the tempo scalar; forced = s remaining of forced full tempo
  run:   { over: false, elapsed: 0, kills: 0, level: 1, xp: 0, xpNext: 5 },
  input: { axisX: 0, axisY: 0, aimX: 1, aimY: 0, dash: false },  // copied in from core/input
  player: {
    x, y, vx, vy, hp, maxHp, radius,
    dashT: 0, dashCd: 0, iframes: 0, speed01: 0
  },
  weapons: [ /* see §5.2 */ ],
  bullets, enemies, particles, xpShards, numbers,   // pools from core/pool
  grid,
  events: []                          // append-only per-tick event list, drained by render/audio
}
```

`state.input` is a **plain data copy** of the input device, written once per tick by
`main.js`. Game modules never import `core/input.js` — that is what keeps them DOM-free
and testable.

`state.events` entries: `{ type, x, y, amount }` with `type` one of
`'hit' | 'kill' | 'shoot' | 'dash' | 'levelup' | 'playerHit'`. Render and audio drain
this list each frame; the simulation never calls into them directly.

### 4.1 Entity shapes

```js
// bullet
{ active, x, y, px, py, vx, vy, radius, damage, life, faction, pierce, hue }
// enemy
{ active, type, x, y, px, py, vx, vy, radius, hp, maxHp, speed,
  contactDamage, xp, state, stateT, flash }
// particle
{ active, x, y, vx, vy, life, maxLife, size, hue, kind }
// xp shard
{ active, x, y, vx, vy, value, magnet }
// damage number
{ active, x, y, vy, life, value, crit }
```

`px, py` are the previous-tick position, used for render interpolation. Every module
that moves an entity must set them before integrating. `faction` is `0` player, `1`
enemy.

---

## 5. Game modules

### 5.1 `game/tempo.js`

```js
export function updateTempo(state, dtReal)
```

Sets `state.world.scale`. Must implement DESIGN.md §2.1 exactly:

```
speed01  = clamp(len(player.vx, player.vy) / PLAYER_MAX_SPEED, 0, 1)
target   = TEMPO_FLOOR + (1 - TEMPO_FLOOR) * speed01 ** TEMPO_CURVE
if (state.world.forced > 0) target = 1        // dash overrides
state.world.scale = expDamp(state.world.scale, target, TEMPO_SMOOTH, dtReal)
```

Also decrements `state.world.forced` by `dtReal`, and stores `speed01` on the player.

### 5.2 Weapons

A weapon is data, not a class:

```js
{ id, cooldown, interval, damage, level, fire(state, weapon) }
```

`main.js` ticks each weapon by `dtWorld` — **never `dtReal`**. This one detail is what
makes damage output depend on movement, and it is the whole game. When
`cooldown <= 0`, call `fire()` and reset it to `interval`.

### 5.3 Signatures

```js
// game/player.js
export function updatePlayer(state, dtReal)   // real time: the player is always responsive

// game/bullets.js
export function spawnBullet(state, opts)      // opts: {x,y,vx,vy,damage,faction,radius,life,hue,pierce}
export function updateBullets(state, dtWorld)

// game/enemies.js
export function spawnEnemy(state, type, x, y)
export function updateEnemies(state, dtWorld)

// game/spawner.js
export function updateSpawner(state, dtWorld)

// game/collision.js
export function resolveCollisions(state, dtWorld)

// game/xp.js
export function spawnXp(state, x, y, value)
export function updateXp(state, dtWorld, dtReal)

// game/upgrades.js
export function rollDraft(state, count)       // -> array of upgrade defs, no duplicates
export function applyUpgrade(state, id)
```

**Which clock each system uses is a correctness requirement, not a style choice:**

| System | Clock |
|---|---|
| player movement, dash, i-frames, input | `dtReal` |
| weapon cooldowns, bullets, enemies, spawner, collisions, particles | `dtWorld` |
| XP magnetization | `dtReal` (must feel snappy even when frozen) |
| UI, menus, draft screen | `dtReal` |

`dtWorld = dtReal * state.world.scale`.

---

## 6. Render

`src/render/**` may touch the DOM. It **reads** state and never mutates it (except
draining `state.events`).

```js
// render/canvas.js
export function createCanvas(el)  // -> { ctx, width, height, dpr, resize() }
// render/camera.js
export function createCamera()    // -> { x, y, follow(state, dtReal), apply(ctx), screenToWorld(x,y,out) }
// render/palette.js
export function paletteAt(scale)  // -> { bg, fg, accent, enemy, bullet, vignette }  lerped by tempo
// render/renderer.js
export function createRenderer(ctx)
{
  mode,                            // 'procedural' | 'sprite'
  setMode(m),
  begin(state, camera, alpha),
  drawWorld(state, alpha),
  end()
}
```

The renderer is the **only** module that knows whether art is procedural or sprite-based
(DESIGN.md §5.4). Nothing else may branch on `mode`. `'procedural'` must remain fully
playable and good-looking forever — it is the fallback if asset sourcing fails.

---

## 7. Test hooks

`main.js` sets, in dev only:

```js
window.__TEMPO = { state, stats, input, setSeed(n), tick(frames) }
```

`tick(frames)` advances the sim deterministically without waiting for rAF, so
`tests/smoke.mjs` can drive thousands of frames in a moment and assert on the result.
Do not remove this — the Playwright suite depends on it.

The page must set `window.__TEMPO_READY = true` once boot completes.
