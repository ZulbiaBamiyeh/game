# Site 7 — Deep Survey

An idle excavation-and-museum game. You are handed a worthless dig site and a room in
town the Institute is calling a museum. You dig down; what you lift goes on display;
people pay to look at it; that money buys a better drill.

Somewhere around four hundred metres it stops being archaeology.

**[docs/DESIGN.md](docs/DESIGN.md)** is the design document — premise, every formula,
the content tables, the art pipeline and the roadmap.
[A typeset PDF of it](docs/Site7-Deep-Survey-Design.pdf) is in the same folder.

## Running it

```sh
npm run serve     # static server on :8000
```

`index.html` also opens straight from the filesystem — the scripts are plain, not
modules, specifically so that it does. No build step, no runtime dependencies.

```sh
npm install       # playwright, dev-only
npm run smoke     # headless Chromium: console errors, every art generator,
                  # the balance curve, and a save round-trip
npm run docs      # regenerate the design PDF from docs/DESIGN.md
```

Open `tools/contact.html` through the server to see every sprite generator on one page.
That is the fastest way to check whether a change to the shared art layers broke a
tradition.

## What is in here

- **130 procedural sprite generators** — 30 object types, 19 painting traditions with
  their own frames and pigments, 14 sculptural forms. No image files ship with the game:
  an artifact is a seed and a function, which is why a save with two hundred artifacts
  is a few kilobytes.
- **34 cultures across 11 depth bands**, from modern refuse at the top to material with
  no accepted context at the bottom. Depth is chronology.
- **A museum economy** — significance to renown to visitors to spend to funding — with
  the whole thing bounded so the numbers stay on screen.
- **24 random permanent upgrades**, one rolled per artifact, plus two shops, a research
  list, offline progress and a prestige loop.

## Layout

```
index.html   styles.css
src/core/    seeded RNG, pixel raster toolkit
src/art/     shared motifs; paintings, sculpture, objects
src/content/ cultures, artifacts, boons, upgrades, lore
src/sim/     state, museum economy, game loop, save
src/ui/      shaft renderer, excavation renderer, DOM panels
tools/       smoke test, art contact sheet, PDF generator
docs/tempo/  an unrelated earlier project, kept for reference
```

Nothing under `src/core`, `src/content` or `src/sim` touches the DOM — the simulation is
a pure function of state, which is what lets the smoke test run an hour of play in a
second. Nothing anywhere calls `Math.random()` where an artifact is generated; a save
could not otherwise reproduce what the player saw.
