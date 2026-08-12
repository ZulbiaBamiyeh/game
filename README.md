# Site 7 — Deep Survey

An idle excavation-and-museum game. You are handed a worthless dig site and a room in
town the Institute is calling a museum. You dig down; what you lift goes on display;
people pay at the door to look at it; that money buys a better drill.

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
npm install            # playwright, dev-only
npm run smoke          # headless Chromium: console errors, every art generator,
                       # the balance curve, and a save round-trip
npm run docs           # regenerate the design PDF from docs/DESIGN.md
node tools/shots.js    # regrab the screenshots from a stocked mid-game museum
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
- **A museum you can walk through** — a side-on cutaway of the building, an entrance
  hall and then one room per depth band, with a crowd of procedurally generated visitors
  who queue at the desk, stop at exhibits, photograph them, point things out, sit on the
  benches and talk about what they are looking at. What they say is keyed to the actual
  object in front of them: its class, its culture, its condition and how far down it came
  from. Click any piece for its gallery label; hit Rehang to drag it somewhere else on
  the wall.
- **Everything at its own size**, from a seven-pixel bottle cap to a panel that fills the
  wall floor to ceiling. A handheld console is a handheld console next to a portrait bust.
- **A museum that trades by the day.** It opens at nine and closes at five; one museum
  minute is one real second. Every pound is a person: arrivals come through the street
  doors, queue, and pay the admission *you* set. Price it over the going rate and the
  gate thins; price it under and the place fills up. The day's book closes at five and
  joins a fortnight of history.
- **Numbers a museum would recognise.** One room does tens of visitors a day, a county
  museum a few hundred, and the finished collection about ten thousand — with the smoke
  test failing the build if the live play curve ever leaves that range.
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
tools/       smoke test, art contact sheet, screenshots, PDF generator
docs/tempo/  an unrelated earlier project, kept for reference
```

## Deploying

There is no build step, so any static host will do. `.github/workflows/deploy.yml`
publishes to **Cloudflare Pages** on every push. It needs two repository secrets, added
under *Settings → Secrets and variables → Actions*:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers**, or a custom token with `Account · Cloudflare Pages · Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages → the account ID in the sidebar |

The workflow deploys to a Pages project called `site7-deep-survey`; if yours is named
something else, change `--project-name` in the workflow. Until both secrets exist the
job logs a notice and skips, so it never shows a red tick for a missing credential.

Nothing under `src/core`, `src/content` or `src/sim` touches the DOM — the simulation is
a pure function of state, which is what lets the smoke test run an hour of play in a
second. Nothing anywhere calls `Math.random()` where an artifact is generated; a save
could not otherwise reproduce what the player saw.
