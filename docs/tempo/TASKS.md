# TEMPO — Ticket Queue

Work top to bottom. Take the first unticked box. One ticket per session, one commit per
ticket. Rules in `CLAUDE.md`; interfaces in `CONTRACTS.md`.

**Ticket anatomy** — *Depends* (must already be `[x]`), *Files* (the only files you may
touch), *Implement*, *Accept* (a command that must pass), *Do not* (known traps).

Phases A and B are written out in full because they set the precedent every later file
copies, and because Phase B decides whether the game is worth building at all. Phases
C–H are one-liners on purpose: they depend on what the B10 playtest reveals, and writing
them in detail now would be guessing. **Expand a phase into full tickets at the start of
that phase**, using the same anatomy.

---

## Phase A — Foundation

No gameplay. The goal is that by A9 there is a running, testable, measurable shell.

- [ ] **A1 — Scaffold**
  **Depends:** —
  **Files:** `index.html`, `package.json`, `.gitignore`, `src/main.js`, `src/constants.js`
  **Implement:** `package.json` with `"type": "module"`, no runtime deps, `playwright`
  as the only devDependency, and scripts `test` (`node --test tests/`), `smoke`
  (`node tests/smoke.mjs`), `serve` (`python3 -m http.server 8000`). `index.html`: full-
  window canvas `#game`, dark background, no margins, `<script type="module"
  src="src/main.js">`. `src/constants.js` verbatim from CONTRACTS §2. `main.js` sizes
  the canvas, fills it with the background color, sets `window.__TEMPO_READY = true`.
  **Accept:** `npm run serve` then load `localhost:8000` — a full-window dark canvas, no
  console errors. `git status` clean apart from intended files.
  **Do not:** add a bundler, TypeScript, or any runtime dependency.

- [ ] **A2 — Math helpers**
  **Depends:** A1 · **Files:** `src/core/math.js`, `tests/math.test.js`
  **Implement:** CONTRACTS §3.1 exactly.
  **Accept:** `node --test tests/math.test.js`. Must include a test that `expDamp` is
  frame-rate independent: 1 step of 0.1s and 10 steps of 0.01s land within 1e-6.
  **Do not:** implement `expDamp` as a naive `lerp(a, b, dt * k)` — it is frame-rate
  dependent and will make the tempo feel different at different refresh rates.

- [ ] **A3 — Seeded RNG**
  **Depends:** A2 · **Files:** `src/core/rng.js`, `tests/rng.test.js`
  **Implement:** mulberry32 per CONTRACTS §3.2, including `fork()`.
  **Accept:** `node --test tests/rng.test.js`. Tests: same seed → identical 1000-value
  sequence; different seeds → different sequences; `int()` respects bounds over 10k
  draws; two `fork()`s from the same parent state agree, and diverge from the parent.

- [ ] **A4 — Object pool**
  **Depends:** A3 · **Files:** `src/core/pool.js`, `tests/pool.test.js`
  **Implement:** CONTRACTS §3.3. Pre-allocate all `capacity` objects up front.
  **Accept:** `node --test tests/pool.test.js`. Tests: spawn/release round-trips reuse
  the same object identities (proving zero allocation); `spawn()` past capacity returns
  `null`; `forEachActive` visits exactly the active set; releasing during
  `forEachActive` is safe and does not skip an element.
  **Do not:** grow the pool on demand. Capacity is a budget; exceeding it must be
  visible, not papered over.

- [ ] **A5 — Spatial hash grid**
  **Depends:** A4 · **Files:** `src/core/grid.js`, `tests/grid.test.js`
  **Implement:** CONTRACTS §3.4. `query` reuses the caller's `out` array.
  **Accept:** `node --test tests/grid.test.js`. Tests: a brute-force cross-check —
  1000 random points (seeded), and for 100 random queries the grid result is a superset
  of the true in-radius set; `query` allocates no array of its own; objects outside the
  arena bounds do not throw.

- [ ] **A6 — Fixed-timestep loop**
  **Depends:** A5 · **Files:** `src/core/loop.js`, `tests/loop.test.js`
  **Implement:** CONTRACTS §3.5, accumulator-based, injectable `now`.
  **Accept:** `node --test tests/loop.test.js` with a fake clock. Tests: 1.0s of frames
  yields exactly `SIM_HZ` update calls; every update receives exactly `SIM_DT`; a 5000ms
  frame is clamped to at most `MAX_STEPS` steps; `alpha` stays in `[0,1)`.
  **Do not:** call `update` with a variable dt. The sim must be deterministic — seeded
  replays and every later sim test depend on it.

- [ ] **A7 — Architecture guard tests**
  **Depends:** A6 · **Files:** `tests/guard.test.js`
  **Implement:** Tests that read the source tree and fail on rule violations: (1) no
  `window`/`document`/`navigator`/`canvas` reference in `src/core/**` or `src/game/**`,
  excluding `core/input.js` and `core/audio.js`; (2) no `Math.random(` anywhere in
  `src/`; (3) no `TODO`/`FIXME` in `src/`.
  **Accept:** `node --test tests/guard.test.js` passes now, and demonstrably fails if
  you temporarily add `Math.random()` to a core file (check this, then undo it).
  **Do not:** weaken these later to make a ticket pass. They are the thing that keeps
  the simulation testable.

- [ ] **A8 — Canvas, camera, perf HUD**
  **Depends:** A7 · **Files:** `src/render/canvas.js`, `src/render/camera.js`,
  `src/render/hud.js`, `src/main.js`
  **Implement:** CONTRACTS §6 for canvas and camera. DPR-aware sizing that survives
  window resize. HUD drawing `stats` (fps, sim ms, render ms, steps, entity counts),
  toggled with `F3`, off by default.
  **Accept:** `npm run serve`, resize the window — no blurring or stretching; `F3`
  toggles a legible overlay reading ~60fps.
  **Do not:** re-create the canvas or its context on resize; scale the existing one.

- [ ] **A9 — Playwright smoke harness**
  **Depends:** A8 · **Files:** `tests/smoke.mjs`, `package.json`
  **Implement:** Launch Chromium from the preinstalled path, start the static server,
  load the page, wait for `window.__TEMPO_READY`, run ~3s, then assert: zero console
  errors, zero page errors, and `stats.fps >= 55`. Print a one-line summary. Save a
  screenshot to `tests/out/smoke.png`.
  **Accept:** `npm run smoke` exits 0 and writes the screenshot.
  **Do not:** run `playwright install`. Use `PLAYWRIGHT_BROWSERS_PATH` / an explicit
  `executablePath` — the browser is already on disk.

---

## Phase B — The core mechanic (the gate)

The point of Phase B is to answer one question as cheaply as possible: **is
freeze-and-commit actually fun?** Build nothing beyond what B10 needs to answer it.

- [ ] **B1 — Game state**
  **Depends:** A9 · **Files:** `src/state.js`, `tests/state.test.js`
  **Implement:** `createState(seed)` per CONTRACTS §4, wiring up the RNG, all five
  pools, and the grid.
  **Accept:** `node --test tests/state.test.js` — two states with the same seed are
  deeply equal; pools are at full capacity and zero active.

- [ ] **B2 — Tempo scalar**
  **Depends:** B1 · **Files:** `src/game/tempo.js`, `tests/tempo.test.js`
  **Implement:** CONTRACTS §5.1, exactly the formula in DESIGN.md §2.1.
  **Accept:** `node --test tests/tempo.test.js`. Tests: a stationary player settles to
  `TEMPO_FLOOR` (within 1e-3 after 2s); a full-speed player settles to 1.0; half speed
  gives less than half tempo (the curve is convex); `world.forced > 0` pins the scale to
  1.0 regardless of velocity; the result is frame-rate independent across dt = 1/60 vs
  1/240.
  **Do not:** clamp the low end to 0. The floor is deliberate — a fully stopped world
  lets the player disengage from the game.

- [ ] **B3 — Player movement and dash**
  **Depends:** B2 · **Files:** `src/game/player.js`, `tests/player.test.js`
  **Implement:** Accel/friction movement on `dtReal`, clamped to `PLAYER_MAX_SPEED`,
  bounded by the arena. Dash per CONTRACTS §2: sets `world.forced = DASH_TIME +
  DASH_TEMPO_TAIL`, grants i-frames, respects cooldown. Sets `px, py` before integrating.
  **Accept:** `node --test tests/player.test.js`. Tests: full input for 1s reaches
  max speed and does not exceed it; no input decelerates to rest; the player cannot
  leave the arena; a dash on cooldown is a no-op; a dash forces tempo to 1.0 for the
  full duration plus tail.

- [ ] **B4 — Bullets**
  **Depends:** B3 · **Files:** `src/game/bullets.js`, `tests/bullets.test.js`
  **Implement:** CONTRACTS §5.3. Pooled spawn, integrate on `dtWorld`, release on
  life expiry or leaving the arena.
  **Accept:** `node --test tests/bullets.test.js`. Tests: a bullet spawned with
  `world.scale = 0` does not move; at `scale = 1` it travels `speed * dt`; it is
  released exactly when `life` runs out; spawning past `POOL_BULLETS` does not throw.

- [ ] **B5 — Pulse gun**
  **Depends:** B4 · **Files:** `src/game/weapons.js`, `tests/weapons.test.js`
  **Implement:** The pulse gun as data per CONTRACTS §5.2, firing toward
  `state.input.aim`.
  **Accept:** `node --test tests/weapons.test.js`. **The critical test:** over 1s of
  simulated time at `world.scale = 0.1`, the gun fires ~10× fewer shots than at
  `scale = 1.0`. That is the mechanic — if this test does not exist, the ticket is not
  done.
  **Do not:** tick cooldowns on `dtReal`. It looks like a harmless fix and it deletes
  the entire game.

- [ ] **B6 — Drifter enemy**
  **Depends:** B5 · **Files:** `src/game/enemies.js`, `tests/enemies.test.js`
  **Implement:** Pooled spawn; the Drifter steers toward the player at `DRIFTER_SPEED`
  on `dtWorld`. Sets `px, py`.
  **Accept:** `node --test tests/enemies.test.js` — a drifter closes distance over 100
  ticks; it does not move at `scale = 0`.

- [ ] **B7 — Collisions**
  **Depends:** B6 · **Files:** `src/game/collision.js`, `tests/collision.test.js`
  **Implement:** Grid broad-phase, circle narrow-phase. Player bullets damage enemies
  (respecting `pierce`); enemies deal contact damage to the player unless
  `iframes > 0`. Push `'hit'`, `'kill'`, `'playerHit'` onto `state.events`.
  **Accept:** `node --test tests/collision.test.js`. Tests: an overlapping bullet and
  enemy produce one hit and the right damage; a killed enemy is released and emits
  `'kill'`; i-frames block contact damage; a non-piercing bullet is consumed by its
  first hit; 500 enemies + 1000 bullets resolve in under 4ms.

- [ ] **B8 — Spawner**
  **Depends:** B7 · **Files:** `src/game/spawner.js`, `tests/spawner.test.js`
  **Implement:** Drifters only, spawning off-screen on a ring around the player, at a
  rate that rises with `run.elapsed`. Ticks on `dtWorld`, so freezing time also freezes
  reinforcements.
  **Accept:** `node --test tests/spawner.test.js` — spawn count rises with elapsed
  time; nothing spawns inside the player's view radius; the pool cap is respected.

- [ ] **B9 — Procedural renderer**
  **Depends:** B8 · **Files:** `src/render/renderer.js`, `src/render/palette.js`,
  `src/main.js`
  **Implement:** `'procedural'` mode drawing player, enemies, and bullets as glowing
  vector shapes, interpolated by `alpha` between `px,py` and `x,y`. Bullet trail length
  scales with `world.scale`. `paletteAt(scale)` lerps cold-desaturated → warm-saturated.
  Wire the full sim into `main.js`, with each system on the clock CONTRACTS §5.3
  mandates.
  **Accept:** `npm run smoke` passes with ≥200 entities alive, and it is visibly
  playable at `localhost:8000`: moving speeds the world up, stopping nearly freezes it.
  **Do not:** use `shadowBlur` per entity per frame. Pre-render the glow sprite once to
  an offscreen canvas — this is the single biggest Canvas2D performance trap.

- [ ] **B10 — 🚦 GATE: the fun test**
  **Depends:** B9 · **Files:** `PLAYTEST.md`
  **Implement:** Nothing. Hand the build to a human, have them play five runs, and
  write down what they say in `PLAYTEST.md`: does the freeze-and-commit rhythm emerge on
  its own? Is tying DPS to movement tense or just punishing? Does the palette shift
  read without being told about it?
  **Accept:** A human has played it and `PLAYTEST.md` records the verdict.
  **Then:** if the mechanic lands, continue to Phase C. If it does not, apply the
  DESIGN.md §7.1 fallback — manual hold-to-fire, decoupling tempo from the trigger — and
  re-run this gate before building anything else.
  **Do not:** start Phase C before this gate is answered. Every ticket below assumes the
  answer was yes; content built on a mechanic that is not fun is wasted work.

---

## Phase C — Combat depth

One enemy per ticket — each is self-contained, which makes them ideal single-session
work. Every enemy needs a visible wind-up drawn on world time, or slowing down buys the
player nothing.

- [ ] **C1** Spitter — stops, telegraphs, fires a slow aimed orb
- [ ] **C2** Weaver — fast erratic flanker; bursts into a spread on death
- [ ] **C3** Bloom — stationary, radial bullet flower on a cadence
- [ ] **C4** Charger — telegraphs a line, then dashes it
- [ ] **C5** Sentinel — front-shielded; must be flanked
- [ ] **C6** `game/patterns.js` — reusable emitters (ring, arc, spiral, aimed spread)
- [ ] **C7** Perf pass — hit and hold the DESIGN.md §4.3 budget: 400 enemies + 1500
      bullets at 60fps, asserted in the smoke test so it cannot silently regress

## Phase D — Progression

- [ ] **D1** XP shards + magnetization (on `dtReal` — must feel snappy while frozen)
- [ ] **D2** Level curve and level-up trigger
- [ ] **D3** Draft UI — pauses on real time, three cards, keyboard + mouse
- [ ] **D4** Data-driven upgrade registry + the first 10 upgrades
- [ ] **D5** 20 more upgrades, including every tempo-bender in DESIGN.md §3.2
- [ ] **D6** Weapons 2–5, each with a distinct cadence so tempo feels different per build

## Phase E — Juice

- [ ] **E1** Particles (pooled) — impacts, deaths, dash trail
- [ ] **E2** Hitstop + screenshake, both toggleable
- [ ] **E3** Palette and vignette driven continuously by tempo
- [ ] **E4** Procedural WebAudio synth, with the global `detune` bus tied to
      `world.scale` — slowing time drags the whole mix down in pitch
- [ ] **E5** Floating damage numbers and XP pops

## Phase F — Assets

- [ ] **F1** `scripts/fetch-assets.mjs` + self-hosted Google font
- [ ] **F2** Sprite atlas and `'sprite'` render mode, behind `setMode` only
- [ ] **F3** `CREDITS.md` + `assets.lock.json` with per-file sha256
- [ ] **F4** Decide procedural vs sprite on looks — procedural is allowed to win

## Phase G — Meta

- [ ] **G1** Boss: Metronome — seizes control of the clock
- [ ] **G2** Boss: Coil — spiral patterns that punish haste
- [ ] **G3** Boss: The Conductor — phases that each invert a rule
- [ ] **G4** Menus, pause, run summary with a shareable seed
- [ ] **G5** `localStorage` save + meta-unlocks
- [ ] **G6** Gamepad and touch input

## Phase H — Polish

- [ ] **H1** Balance pass across the full 15 minutes
- [ ] **H2** Accessibility: reduced motion, colorblind palette, adjustable time floor,
      remappable keys
- [ ] **H3** Final perf verification against the §4.3 budget

---

## If you get stuck

Stop and report rather than improvising. In particular, **stop** if: a ticket seems to
need a `CONTRACTS.md` change; a test fails and you think the test is wrong; a ticket
needs a file outside its Files list; or the acceptance criteria are ambiguous.

Reverting a half-finished ticket and reporting the blocker is a good outcome. A ticket
marked `[x]` that does not actually pass its Accept command is the one genuinely bad
outcome — every later ticket builds on the assumption that it works.
