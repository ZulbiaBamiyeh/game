# TEMPO — Design & Build Plan

> A top-down arena survivor where **time only moves as fast as you do.**

Status: **plan only.** No code written yet. This document is the build contract.

---

## 1. The hook

Stand still and the world nearly freezes — bullets hang in the air like beads on a
string, and you can read the whole board. Move, and the world catches up. Sprint, and
it runs at full speed.

Your guns fire on *world* time. Your body moves on *real* time.

That single asymmetry is the entire game:

- **You must move to deal damage.** Frozen time means frozen guns. Camping is not a
  strategy, it's a stalemate.
- **You must stop to survive.** The only way to read a dense bullet pattern is to
  drain the tempo out of it.
- So every second is a wager: *how much danger do I unfreeze in exchange for damage?*

It's SUPERHOT's time mechanic fused with a bullet-heaven progression loop. The
mechanic is one scalar multiplied into the simulation, which makes it cheap to build
and extremely rich to design around.

### Why this is fun
The tension resolves into a natural rhythm — **read, commit, escape, read** — and the
player authors that rhythm themselves. Slow moments are puzzle-like and legible; fast
moments are chaos you *chose*. Upgrades then attack the rhythm from both ends (some
reward stillness, some forbid it), so builds change how the game *feels*, not just how
big the numbers are.

---

## 2. Core mechanics

### 2.1 The tempo scalar

```
speed01   = clamp(|playerVelocity| / maxSpeed, 0, 1)
targetTS  = TIME_FLOOR + (1 - TIME_FLOOR) * speed01^TIME_CURVE
worldScale = expDamp(worldScale, targetTS, TEMPO_SMOOTHING, dtReal)
```

- `TIME_FLOOR = 0.03` — the world never fully stops (fully-stopped worlds let players
  disengage; a crawl keeps pressure on).
- `TIME_CURVE = 1.4` — slightly convex, so a light tap of the stick buys a lot of
  slow-mo. Rewards precise, small inputs.
- `TEMPO_SMOOTHING ≈ 60ms` — smoothed so tempo never pops between frames.

Everything in the world (enemy AI, bullets, spawn timers, weapon cooldowns, status
effects, particles) integrates against `dtWorld = dtReal * worldScale`.
Player movement, aiming, dash input, and UI integrate against `dtReal`. The player is
always 100% responsive — that's non-negotiable for feel.

### 2.2 Dash

A burst of real-world displacement with i-frames — but it **forces `worldScale = 1.0`**
for its duration plus a short recovery tail. So dashing out of a bullet wall also
un-freezes that wall. Escape is never free. ~3s cooldown, cooldown runs on real time.

### 2.3 Weapons

Auto-firing, on world time. You never press a fire button; you *pilot the clock*. Start
with one weapon, hold up to 5. Aim is mouse-directed, with an auto-aim assist toggle
(nearest / lowest-HP targeting).

### 2.4 Legibility as a system

Because reading telegraphs is the core skill, telegraphing is a first-class feature:

- Bullet trail length scales with `worldScale` — the screen shows you your own tempo.
- Palette shifts continuously: **slow = desaturated, cold blue, tight vignette;
  fast = saturated, warm, bloomy.** Peripheral-vision feedback with no HUD cost.
- All SFX are pitch-shifted by `worldScale`. Slowing time audibly drags the whole mix
  down. This is free with WebAudio `detune`/`playbackRate` and is a huge juice win.
- Every enemy attack has a wind-up drawn in world time, so slowing down genuinely
  buys reading time rather than just shrinking the numbers.

---

## 3. Content

### 3.1 Enemies

| # | Name | Behavior | Teaches |
|---|------|----------|---------|
| 1 | **Drifter** | Slow melee chaser, swarms | Crowd shaping |
| 2 | **Spitter** | Stops, fires a slow aimed orb | Basic dodging |
| 3 | **Weaver** | Fast erratic flanker, bursts into a spread on death | Kill-order / spacing |
| 4 | **Bloom** | Stationary, radial bullet flower on a cadence | Pattern reading (gorgeous frozen) |
| 5 | **Charger** | Telegraphs a line, then dashes it | Commitment timing |
| 6 | **Sentinel** | Shielded from the front; must be flanked | Positioning under pressure |

**Bosses** at 5:00, 10:00, 15:00:

- **Metronome** — periodically seizes the clock, forcing `worldScale` to 1.0 or to the
  floor regardless of your movement. Fights you for control of the core mechanic.
- **Coil** — spiral bullet patterns that are trivially readable when slow and lethal
  when fast, forcing long frozen stretches where you deal almost no damage. A DPS-check
  against your own patience.
- **The Conductor** — final. Splits into phases that each invert a rule (guns fire on
  real time; movement drains HP; tempo inverted).

### 3.2 Progression

- Enemies drop XP shards that magnetize to the player.
- Level-up pauses the game and offers a **draft of 3 upgrades** from a weighted pool.
- Target: **~30 upgrades**, of which at least a third bend the tempo mechanic:
  - **Cold Blood** — +100% damage while `worldScale < 0.2`.
  - **Overclock** — raises your time floor to 0.25 (you can never fully freeze) but
    +30% fire rate. A build-defining downside.
  - **Afterimage** — dash leaves a decoy that pulls enemy fire.
  - **Entropy** — enemies take bonus damage proportional to current `worldScale`.
  - **Flywheel** — damage ramps the longer you hold tempo above 0.8.
  - **Stillwater** — regenerate HP only while nearly frozen.
- Run length: **15 minutes**, escalating waves + 3 bosses.
- Meta-progression in `localStorage`: unlock starting weapons and characters; a run
  summary screen with a shareable seed.

---

## 4. Technical plan

### 4.1 Stack

**Vanilla JavaScript + Canvas2D + ES modules. No framework, no build step.**
Run with `python3 -m http.server` and open the page. Chosen so the game is genuinely
self-authored end to end, has zero dependency rot, and stays trivially portable.

### 4.2 Architecture

```
index.html
src/
  main.js            bootstrap, canvas sizing, DPR handling
  core/loop.js       fixed-timestep accumulator (120Hz sim) + interpolated render
  core/input.js      keyboard / mouse / gamepad / touch, unified action map
  core/rng.js        seeded PRNG (seeds are shareable and reproducible)
  core/pool.js       object pools
  core/grid.js       spatial hash for broad-phase collision
  core/audio.js      procedural WebAudio synth
  game/tempo.js      the world-scale scalar — the heart of the game
  game/player.js  game/weapons.js  game/enemies.js  game/bullets.js
  game/spawner.js game/upgrades.js game/boss/*.js
  render/           camera, layers, particles, palette, atlas generation, HUD
  ui/               menus, draft screen, pause, run summary
assets/             fetched — never hand-committed binaries without provenance
scripts/fetch-assets.mjs
```

Key decisions:

- **Fixed 120Hz simulation** with an accumulator, render interpolated. Determinism
  matters: seeded runs must replay identically, and a variable-rate sim would make the
  tempo scalar frame-dependent.
- **Object pooling** for bullets, particles, enemies, damage numbers. Target zero
  steady-state allocation so GC never stutters a dodge.
- **Spatial hash grid** (cell ≈ 64px) for broad-phase; circle-vs-circle narrow phase.
- **Pre-rendered glow/particle sprites** onto offscreen canvases at load. Canvas2D
  handles thousands of `drawImage` calls fine; it does *not* handle thousands of
  per-frame `shadowBlur` or gradient constructions.

### 4.3 Performance budget

**60fps with 400 active enemies and 1500 active bullets** on a mid-range laptop.
Instrumented with a toggleable perf HUD (sim ms / render ms / entity counts) from M0,
so regressions are caught the day they land rather than at the end.

Escape hatch if Canvas2D tops out: swap `render/` for a small custom WebGL sprite-batch
renderer. The renderer is deliberately kept behind a narrow interface so this is a
contained change, not a rewrite.

### 4.4 Audio: fully procedural

All sound is synthesized at runtime with WebAudio — no audio files at all.

- Shots: short FM blip, pitch varying per weapon.
- Hits: filtered noise burst with a fast envelope.
- Boss: detuned saw stack with an LFO.
- Global `detune` bus driven by `worldScale` for the time-drag effect.

This sidesteps the hardest asset-licensing problem entirely, keeps the download tiny,
and gets the tempo-pitch coupling for free.

---

## 5. Asset plan (and the network constraint)

### 5.1 Verified sandbox network policy

Probed at plan time. **This is the binding constraint on asset sourcing** — recorded
here so future sessions don't rediscover it:

| Host | Result |
|---|---|
| `git clone` any public GitHub repo | ✅ works |
| `raw.githubusercontent.com` | ✅ 200 |
| `registry.npmjs.org` (incl. search + license metadata) | ✅ works |
| `fonts.googleapis.com` / `fonts.gstatic.com` | ✅ works |
| `api.github.com` | ⚠️ scoped to this repo only — **no code/repo search** |
| `codeload.github.com` (tarball endpoint) | ❌ 403 |
| `kenney.nl`, `opengameart.org`, `freesound.org`, `commons.wikimedia.org` | ❌ 403 at proxy |

The usual game-asset sites are unreachable, and GitHub search is unavailable, so assets
must come from **git clone**, **npm**, or **Google Fonts**, with sources pinned by name
rather than discovered by search.

### 5.2 Sources

1. **Font** — Google Fonts (`Press Start 2P`, with `Silkscreen` for body text).
   Download the WOFF2 at build time and self-host; no runtime CDN dependency. (OFL.)
2. **Sprites** — CC0 packs mirrored on npm and GitHub. Verified example:
   `kenney-hexagon-pack` on npm publishes `license: "CC0 1.0"`, and
   `sanderfrenken/Universal-LPC-Spritesheet-Character-Generator` clones successfully.
   Exact packages get pinned in `assets.lock.json` during M5.
3. **Effects art** — generated procedurally into an offscreen atlas at load: glows,
   soft particles, shockwave rings, bullet trails, vignette. No license, resolution
   independent, and it's what gives the game its look anyway.
4. **Audio** — none fetched; fully synthesized (§4.4).

### 5.3 `scripts/fetch-assets.mjs`

One command, `npm run assets`, that:

- downloads each pinned source over the verified channels,
- **reads and records the declared license**, refusing anything not CC0/OFL/CC-BY,
- writes `CREDITS.md` with source URL + license + author per asset,
- writes `assets.lock.json` with a sha256 per file so fetches are reproducible and
  tamper-evident,
- is idempotent and skips already-valid files.

### 5.4 Asset risk & fallback

Because I can't browse asset sites or search GitHub, sprite sourcing is the least
certain part of this plan. Mitigation: the renderer ships a **`procedural` mode** that
draws every entity as vector shapes — glowing polygons, rings, trails. The game must be
fully playable and good-looking with **zero external art**, with fetched sprites as an
upgrade layer. This is a hard requirement on the renderer interface, not an afterthought.

Given the neon-on-dark, tempo-driven palette, procedural vector art may honestly end up
being the better look. Fetched sprites will be evaluated against it, not assumed superior.

---

## 6. Milestones

| # | Milestone | Deliverable | Done when |
|---|---|---|---|
| **M0** | Skeleton | Canvas, DPR scaling, fixed-timestep loop, input map, perf HUD | Stable 60fps empty loop; inputs logged |
| **M1** | **Core mechanic — the fun test** | Player, tempo scalar, one weapon, one enemy | *A neutral player finds freeze-and-commit fun.* **Gate: this must pass before anything else is built.** |
| **M2** | Combat depth | 6 enemy archetypes, bullet patterns, spatial hash, pooling | 300+ entities at 60fps; all telegraphs readable |
| **M3** | Progression | XP, level-up draft, ~30 upgrades, 5 weapons | A 15-min run is completable with varied builds |
| **M4** | Juice | Particles, shake, hitstop, palette shift, procedural audio | Every hit reads and feels good; audio tracks tempo |
| **M5** | Assets | `fetch-assets.mjs`, atlas, font, `CREDITS.md`, `assets.lock.json` | `npm run assets` reproducible from clean clone |
| **M6** | Meta & shell | 3 bosses, menus, pause, save, run summary, touch + gamepad | Playable start-to-finish with no dev shortcuts |
| **M7** | Balance & polish | Tuning pass, accessibility, perf budget verified | Meets §4.3 budget; difficulty curve holds up |

**M1 is a gate, not a step.** The whole design rests on one untested feel hypothesis.
If it isn't fun in a rough prototype, no amount of content saves it — so it gets tested
on the cheapest possible build.

---

## 7. Risks

1. **Auto-fire may fight the tempo mechanic.** Tying DPS to movement could read as
   punishing rather than tense.
   *Fallback:* switch to manual hold-to-fire, so the player chooses tempo and trigger
   independently. Decided at M1, on evidence.
2. **Canvas2D throughput.** *Mitigation:* pooling, pre-rendered sprites, spatial hash;
   escape hatch is the WebGL batch renderer behind the same interface (§4.3).
3. **Asset availability.** *Mitigation:* procedural render mode (§5.4).
4. **Slow-mo nausea / accessibility.** *Mitigation:* screenshake toggle, reduced-motion
   mode, adjustable time floor as an assist, colorblind-safe palette, remappable keys.
5. **Scope creep.** Explicitly out: multiplayer, netcode, level editor, 3D, procedural
   music, mobile app packaging.

---

## 8. Controls

| Action | Keyboard/Mouse | Gamepad | Touch |
|---|---|---|---|
| Move (drives tempo) | WASD / arrows | Left stick | Virtual stick |
| Aim | Mouse | Right stick | Auto-aim |
| Dash | Space / RMB | A / RB | Tap button |
| Pause | Esc | Start | Button |

Auto-aim is a toggle, not a difficulty setting — the game is about tempo, not flick aim.
Analog input matters: a gamepad's partial stick deflection gives fine tempo control, so
keyboard gets a modifier key for a deliberate half-speed walk.

---

## 9. Open questions for the build

1. Should stillness regenerate a resource (shield/ammo) to actively reward freezing, or
   is dodging its own reward? Lean: no — keep the tension pure, revisit if M1 feels flat.
2. One long 15-minute run, or three ~5-minute acts with a choice between them? Lean:
   acts, for pacing and a natural save point — but decide after M3.
3. Does the tempo scalar apply to *enemy* wind-ups at full strength, or damped? Full
   strength is more legible; damped is harder. Tune at M2.
