# Site 7 — Deep Survey

**An idle excavation-and-museum game.** You are handed a worthless dig site and a room
in town that the Institute is calling a museum. You dig down. What you lift goes on
display. People pay to look at it. That money buys a better drill, which gets you
deeper, where the material is older and stranger, which draws more people.

Somewhere around four hundred metres it stops being archaeology.

---

## 1. The premise

> **Site 7 is not a site. It is a collection, buried in order, by someone who knew who
> would dig it up.**

Everything in the game falls out of that one sentence:

| The idea | The mechanic it produces |
|---|---|
| The deposit is *curated*, oldest at the bottom | Depth **is** chronology. One tradition per band. |
| Someone chose the best surviving example of each | Finds are unusually good for their context, and get better with depth. |
| It is a collection, so it is not for sale | **Nothing is ever sold.** Money comes only from visitors. |
| It was accessioned, not hidden | The floor is stamped with the player's own next accession number. |
| The geophysics at Site 3 came back the same way | The prestige loop: other sites, same impossible sounding. |

### The reveal, staged

Seven **keystone** finds sit at fixed depths and are the only artifacts with
hand-written text. Everything else in the game is procedural; these are the spine.

| Depth | Find | What it establishes |
|---|---|---|
| 28 m | Ledger, partial | The fill was *delivered* — forty years of carting soil to a hole nobody was digging. |
| 152 m | Portrait head | It was **placed**, facing up, in a void left for it. Not a rubbish pit. Arranged. |
| 336 m | Painted block, detached | Cave art was quarried out of a wall and carried here. Somebody has been *collecting*. |
| 438 m | Worked form, Neanderthal | Older than art is supposed to be. Better made than it is supposed to be. |
| 548 m | Seated form, hands raised | Unattributable. No tradition in the literature made these. |
| 706 m | Wristwatch | Sealed fill, no intrusion. The object **postdates its own depth**. |
| 812 m | Survey marker | Stamped with the *next* accession number in the Institute's sequence. Not yet issued. |

The eight-turn counterclockwise spiral recurs from the first silver coin to the last
sculpture. Nobody in the game ever explains it.

---

## 2. The core loop

```
      descend  ──▶  find  ──▶  excavate  ──▶  interpret  ──▶  accession
         ▲                                                        │
         │                                                        ▼
      buy gear ◀── funding ◀── visitors ◀── rating ◀────────  display
                                                                  │
                                                                  ▼
                                                        random permanent upgrade
```

Two currencies and one score:

- **Funding** — from the museum door. Buys everything with a price.
- **Understanding** — from interpreting finds correctly, and *early*. Buys research,
  which is the structural unlocks money cannot reach.
- **Rating** (0–100, shown as stars) — the museum's public standing. Not spendable;
  it is the thing that produces visitors.

### The excavation minigame

A find arrives as a 16×16 grid of matrix over a 64×64 sprite. The crew clear it on
their own at `clearRate`. Brushing clears a patch **now, where you choose**, spending
one of a small pool of recharging charges.

The decision the minigame exists to create: **file your interpretation before you can
see what it is.** Three readings, one correct.

| Exposure when filed | Multiplier |
|---|---|
| under 25 % | ×4 |
| 25–45 % | ×3 |
| 45–70 % | ×2 |
| over 70 % | ×1 |

A wrong reading still pays 35 % of the multiplier, and stays in the record. Withholding
judgement pays nothing. Brushing is therefore not "clear it faster" — it is *buying
information*, and every charge you spend lowers the multiplier you could have had.

### Accession

Every artifact carries a **boon**: a permanent, random upgrade, rolled from a table of
24 and scaled by the piece's significance. This is the slot-machine moment. You cannot
re-roll and you cannot un-accession. You choose only whether it goes on **display**
(counts toward the rating, occupies display space) or into **store** (keeps the boon,
takes no space).

---

## 3. The museum

The economic engine. It is deliberately pathetic at the start — one room, four objects,
"no reason to visit twice" — and the climb out is the first hour of the game.

```
significance ──▶ renown ──▶ rating ──▶ footfall ──▶ the till ──▶ funding
```

### The trading day

The museum opens at **09:00** and closes at **17:00**. One museum minute is one real
second, so a trading day is eight minutes of watching and the closed hours run at 16×
— long enough that closing time means something, short enough that you are never
waiting for the game.

Footfall over the day is a curve, not a constant: quiet at opening, a long peak around
half past one, a tail-off before close. It is normalised against its own mean, so the
shape moves people around inside the day without changing the day's total.

At 17:00 the book closes. The day's visitors, gate and secondary spend go into a
fortnight of history, the best day is remembered, and the log gets a line.

### Where the money comes from

**Every pound is a person.** There is no income rate being integrated behind the
scenes. Arrivals accumulate a fraction per tick; when the fraction crosses one, a
visitor is admitted — the funds go up by the admission plus their secondary spend, the
counter ticks, and a person is pushed through the street doors to walk to the desk and
pay it. What the header calls income is that same figure differentiated for display.

```js
sig       = Σ significance of everything on display
crowd     = shown > cap ? (cap / shown) ^ 0.55 : 1
breadth   = 1 + distinctCultures × 0.12
variety   = 1 + distinctForms × 0.05 + distinctEras × 0.06
renown    = sig^0.62 × breadth × variety × softCap(ratingMul, 25) × crowd
rating    = 100 × renown / (renown + 6000)         // the 0–100 sign over the door

suggested = max(2, round₂(2.5 + rating × 0.16))    // what you could fairly charge
priceFac  = 1.55 / (1 + 0.55 × (price / suggested)^1.45)

perDay    = 4200 × (rating/100)^1.25 × softCap(visitorMul, 2.6) × priceFac
perMinute = perDay / 480 × shape(timeOfDay)
spend     = (0.8 + 2.2 × rating/100) × softCap(spendMul, 2.4) × softCap(dwellMul, 1.5)
take      = admission + spend                      // per person, at the door
```

**Footfall hangs off the rating, not off renown, and that is the whole trick.** The
rating already saturates towards 100, so the busiest possible day is a number a real
museum could have. `PEAK_DAY = 4200` is what a rating-100 collection does at its
suggested price; outreach can roughly treble it, which puts the absolute ceiling near
eleven thousand a day. An earlier version hung footfall off `renown^0.92`, which is
unbounded, and two hours of play reached 720,000 visitors a day. That is not a museum,
it is a spreadsheet.

`softCap(x, k) = kx / (k + x − 1)` — behaves like `x` while `x` is small and can never
exceed `k`. **This is load-bearing.** Fourteen facility upgrade lines each multiplying
income produced a curve that left the screen inside half an hour; the soft cap says
that facilities *multiply the collection's pull, they do not replace it*. A museum with
a superb café and three sherds is still a museum with three sherds.

`breadth` is what stops the optimal play being forty of the same sherd. `crowd` is what
makes display cases worth buying.

### The price of a ticket

The admission price is the only decision in the game that cuts both ways, and it is the
player's. `suggested` is what a museum of this standing could fairly charge — £2.50 at
the start, rising to about £18 for a world collection. Charge under it and footfall
lifts; free entry is worth about a 55% lift. Charge over it and the gate thins; double
the suggested price costs about 40% of it.

Because secondary spend is per head and does not care what the ticket cost, a museum
with a good café and shop genuinely can do better on a cheap ticket and a full house.
The till panel shows the going rate, what your price is doing to footfall as a
percentage, today's book, yesterday's, and a fortnight of bars.

### What it is worth in real money

| On display | Rating | Ticket | Visitors/day | A day's take |
|---|---|---|---|---|
| 1 | 0.2 | £2.50 | 1 | £5 |
| 10 | 3.0 | £3.00 | 53 | £203 |
| 40 | 14.3 | £5.00 | 369 | £2,258 |
| 120 | 29.9 | £7.50 | 927 | £8,300 |
| 260 | 44.3 | £9.50 | 1,516 | £17,091 |

A village collection, a town museum, a county museum, a regional one, and something a
coach party would detour for. `npm run smoke` prints this table on every run.

### Rating bands

| Rating | Verdict |
|---|---|
| 0 | Nothing on display. The doors are not open. |
| < 3 | One room, a handful of objects, and no reason to visit twice. |
| < 15 | A modest regional collection. School parties on Tuesdays. |
| < 40 | A serious collection. The county is proud of it. |
| < 70 | One of the great collections. Scholars book months ahead. |
| ≥ 85 | There is nothing else like it, because there is nowhere else like Site 7. |

### The floor

The museum tab opens on a side-on cutaway of the building: one long horizontal
strip, one room per depth band in depth order, joined by doorways. Drag it, wheel
it, arrow-key it, or use the room dots. Clicking any exhibit opens its record.

Exhibits are mounted by class — paintings hang on the wall under a spotlight,
sculpture goes on a plinth behind a rope, objects sit in vitrines on timber
pedestals — and everything that stands on the floor, visitors included, is
depth-sorted together, so a visitor can walk behind one plinth and in front of
the next.

**Everything has a real size.** `physical(a)` gives each artifact a display
height in logical pixels, from a table keyed on object type, carver or painter,
then jittered per seed, scaled by condition, and occasionally — likeliest for
significant pieces — multiplied into something monumental. The range runs from a
7-pixel bottle cap to a 96-pixel panel that fills the wall from skirting to
picture rail. A handheld console is 13; a portrait bust is 31; a T-pillar is 70
and stands taller than the people looking at it. Slot widths come from the same
number, so a colossal head is given a bay of wall and a bead is not.

Rendering an arbitrary size without wrecking the pixels takes two paths:
downscales are smoothed, because nearest-neighbour below 1:1 drops whole rows out
of the art; upscales go nearest-neighbour to the next whole multiple and are then
smoothed down to the target, which keeps hard pixel edges instead of producing
rows two wide beside rows three wide.

**Benches**, one per stretch of room. Elders head for them readily, everyone else
after they have been walking a while; a seated visitor gets a separate sprite
with the hips at seat height. Seats are claimed, so two people never occupy one.

**Rehanging.** The `Rehang` toggle turns dragging from panning the building into
carrying a piece. Drop it anywhere along the wall or through a doorway into
another room; a gold line shows where it will land, and carrying it to the edge
of the frame walks the building along under it. Rooms are era bands by default,
but `a.room` and `a.slot` override that and both are saved — the hang is the
curator's, not the stratigraphy's.

**Clicking says what it is.** A click selects: the piece gets a ring, a gallery
label appears beside it with name, tradition, period, support and accession
number, and the caption bar under the floor fills in with condition, rarity,
depth and the field notes. Double-click, or the button in the caption, opens the
full record.

**The entrance hall** is room zero, in front of every gallery. Street doors with
the daylight coming through them and spilling across the parquet, a rope line, a
leaflet rack, the admissions desk with a member of staff behind it, a card reader
and a till. Arrivals come through the doors, take a ticket in the queue — ranked
by arrival, not by where they are standing, or two who arrive in the same second
both think they are first and walk into each other forever — reach the desk, pay,
and a `+£4` floats off them and fades. Then they go and look at the art.

**The crowd.** Visitors are pixel people generated from a seed like everything
else, 18×24, baked once into a six-frame walk (contact, down, pass, ×2 — the
shortest cycle that reads as weight moving rather than legs scissoring) plus
poses for standing, looking, photographing, pointing, sitting and talking. Seven
archetypes — adult, child, tourist, scholar, school group, elder, staff — each
with its own gait, dwell time, accessories and vocabulary. Proportions carry the
read at this size, not detail: shoulders are 8 pixels and the head is 5, because
a head as wide as the body is a column, not a person.

How many are in the building is `arrivals per minute × dwell minutes`, capped at
42 — which is as many as a strip of rooms can legibly hold. A separation pass
pushes people out of each other in both x and depth, so a popular exhibit gets a
cluster rather than six sprites in one pixel.

**What they say** is picked from weighted buckets, most specific first: the
object's class, its specific type, its tradition, its condition, its rarity, and
its `eerie` tier — then who is speaking, then ambient chatter that has nothing to
do with the art and is mostly about the café. Two visitors looking at the same
thing can fall into a scripted exchange. The result is that a Benin head gets
"lost-wax casting, and they were doing it better than Europe was", a Jōmon figure
gets "every single one that's ever been found was broken before it was buried, on
purpose", and the unattributed rooms get "can we go to the next room. Please."

Rendering runs at two resolutions on one canvas, deliberately: the world is drawn
at an integer 2× so artifacts land 1:1 and people 3:1 with no fractional
sampling, then labels and speech bubbles are drawn afterwards at the canvas's own
resolution. Six-pixel text scaled up is unreadable; crisp text over pixel art
looks intentional. At most four visitors talk at once, and bubbles claim space
for the frame so a pair in conversation stacks upward instead of blanking the
exhibit they are discussing.

The crowd only simulates while the museum tab is open. Nobody is walking around
behind the Research tab.

---

## 4. Progression and pacing

### Why the numbers stay on screen

Three separate bounds, each doing a different job:

1. **Boons stack additively.** Upgrades multiply (`S.mul`) because every upgrade has a
   level cap. Artifacts add (`S.add` / `S.red`, applied as `1 + add` and `/(1 + red)`)
   because there is no cap on how many artifacts you can lift, and a percentage
   multiplying an unbounded count is a finite-time blow-up.
2. **The ground fights back.** `resistance = 1 + depth/9` divides descent. Every era is
   a wall you buy your way through, not a stretch you coast. Site equipment also costs
   `× (1 + depth/30)` — a museum that has started earning cannot simply buy the whole
   excavation list at once.
3. **The shaft has a floor at 830 m.** This is what bounds *everything* downstream:
   artifact significance scales with depth, collection size is the integral of
   `1/findGap`, and both are finite because depth is.

### Measured curve

A greedy optimiser (buys everything the instant it is affordable, brushes and files
perfectly), in real time:

| Elapsed | Day | Depth | Finds | Rating | Ticket | Visitors/day | Income |
|---|---|---|---|---|---|---|---|
| 1 min | 1 | 8 m | 1 | 0.1 | £2.50 | 1 | £0.34 /s |
| 5 min | 1 | 28 m | 6 | 0.3 | £2.50 | 3 | £0.47 /s |
| 15 min | 2 | 69 m | 13 | 2.1 | £3.00 | 39 | £0.92 /s |
| 30 min | 4 | 114 m | 20 | 6.7 | £3.50 | 185 | £3.62 /s |
| 60 min | 7 | 209 m | 31 | 39.2 | £9.00 | 2,375 | £59.92 /s |
| 120 min | 14 | 707 m | 91 | 92.7 | £17.50 | 9,653 | £797.57 /s |

Two hours of *perfect* play does not quite reach the floor at 830 m, and the busiest
day it ever sees is under ten thousand — a number the Louvre would recognise. A human
playing casually, with offline progress at half rate, takes several sessions.

`npm run smoke` prints this table on every run and **fails the build** if any row goes
over 12,000 visitors a day or £40 a ticket. That assertion is on the live curve, not on
the isolated scale table above it: the formula being right in isolation is not the same
claim as the formula surviving a greedy player driving every multiplier at once, and it
was the second claim that used to be false.

### Tuning knobs, in order of leverage

| Want | Change |
|---|---|
| Longer run | `resistance` divisor in `src/sim/state.js` (currently `/9`) |
| More/fewer finds | `find` per era in `cultures.js`, and the `findGap` floor `2.2 + depth×0.015` |
| Slower rating climb | the `+ 6000` in `rating` and the `softCap` ceilings in `museum.js` |
| Busier or quieter museum | `PEAK_DAY` and `OUTREACH_CAP` in `museum.js` |
| Longer or shorter trading day | `OPEN_AT` / `CLOSE_AT` / `NIGHT_SPEED` in `museum.js` |
| Punchier early game | `base` and `mul` on the first four upgrades in `upgrades.js` |

### Prestige — opening a new site

Unlocked when the last keystone is accessioned. Resets depth, funding and **all site
equipment**; keeps the collection, the museum, and the research. Every rate gains a
standing **+45 %** per site opened, and later sites yield proportionally more
significant material.

The shaft is disposable. The museum is not. That is the whole point of the fiction, and
it is also the prestige mechanic.

---

## 5. Content

### Depth bands

Depth is time. The boundaries are drawn sharp on screen because their sharpness is the
evidence.

| Depth | Band | Period | Traditions |
|---|---|---|---|
| 0–18 m | Overburden | 1950 – present | Contemporary |
| 18–45 m | Industrial fill | 1750 – 1950 | Industrial, Victorian |
| 45–80 m | Early modern | 1400 – 1750 | Renaissance, Edo, Mughal, Benin |
| 80–125 m | Medieval | 500 – 1400 CE | Byzantine, Norse, Song, Islamic, Khmer |
| 125–180 m | Classical | 800 BCE – 500 CE | Rome, Greece, Han, Maya, Nazca |
| 180–245 m | Bronze Age | 3000 – 800 BCE | Egypt, Minoan, Sumer, Shang, Indus |
| 245–320 m | Neolithic | 10000 – 3000 BCE | Çatalhöyük, Jōmon, Cucuteni, enclosure builders |
| 320–410 m | Upper Palaeolithic | 40000 – 10000 BCE | Magdalenian, Gravettian |
| 410–515 m | **The long dark** | 200000 – 40000 BCE | Neanderthal, Denisovan |
| 515–640 m | **Unattributed** | no accepted context | Groups A, B, C |
| 640–830 m | **Deposit floor** | postdates its own depth | Anachronic assemblage |

**34 traditions.** Each owns a painting style, a sculptural form, a pool of object
types and its own vocabulary, plus an `eerie` tier from 0 (ordinary archaeology) to 4
(the catalogue has stopped pretending). The tier drives which pool the field notes draw
from, so the writing goes cold at exactly the depth the art does.

### Artifact classes

- **Objects** — 30 generators: coins, blades, vessels, sherds, lamps, seals, tablets,
  beads, handaxes, spearpoints, torcs, mirrors, astrolabes, bells, needles…
- **Paintings** — 19 traditions, each with its own frame, ground, pigments and rules
  about what may be depicted: gilt-framed Victorian oil, Edo woodblock, Byzantine
  gold-ground icon, Song ink scroll, Islamic tile panel, Maya codex leaf, Roman fresco,
  Greek black-figure, Egyptian tomb register, Minoan marine fresco, Çatalhöyük wall
  painting, Magdalenian cave block, Neanderthal ochre panel, and three unattributable
  ones.
- **Sculpture** — 14 forms: portrait bust, Cycladic figure, shabti, colossal head, cast
  head, draped torso, terracotta soldier, dogū, Venus figurine, carved antler, worked
  Neanderthal form, stele, animal statue, and the seated form with its hands over its
  face.

Every one is **procedural and seeded**, so a generator is not one artifact, it is an
endless family of them. Composition, palette, figure count, material and damage are all
rolled per piece.

### Condition and rarity

| Condition | × | Rarity | × |
|---|---|---|---|
| Fragmentary | 0.55 | Common | 1.00 |
| Poor | 0.75 | Uncommon | 1.45 |
| Partial | 1.00 | Rare | 2.30 |
| Sound | 1.35 | Significant | 3.80 |
| Fine | 1.85 | Unique | 6.50 |
| Exceptional | 2.60 | | |

```
significance = (6 + depth × 0.055) × kindWeight × condition × rarity × siteBonus
```
`kindWeight`: object 1.0, painting 1.35, sculpture 1.55.

### Collections

A tradition's set is complete when you hold every form it can produce. 34 sets, most of
them 6–10 forms. This is the long-tail goal that outlives the story.

---

## 6. The art pipeline

No image files ship with the game. An artifact is **a seed and a generator function**,
which is why a save file with two hundred artifacts is a few kilobytes.

```
seed ──▶ mulberry32 ──▶ generator ──▶ 64×64 buffer of hex strings ──▶ bake to canvas
```

Three layers:

1. **`core/raster.js`** — the buffer, ~50 named 8-step colour ramps, value noise and
   fBm, shape primitives (ellipse, poly, quadratic bezier, rounded rect), and the ageing
   operators every generator ends with: `outline`, `chipEdges`, `weather`, `crust`,
   `relight`.
   *Colour discipline: nothing writes an arbitrary colour.* Everything picks a step from
   a named ramp. That is what stops 130 procedural sprites from looking like 130
   unrelated sprites.
2. **`art/motifs.js`** — the marks cultures share. A bison is a bison whether it is on a
   cave wall or a Greek vase; what changes is the pigment, the ground, and the rules
   about where it may be placed. Beasts (five body plans from one skeleton), profile and
   frontal figures, portrait busts, hand stencils, spirals, meanders, interlace, girih
   stars, arabesques, mountains, wave crests, glyph blocks in six scripts, and the damage
   operators — craquelure, flaking, patina.
3. **`art/paintings.js`, `sculptures.js`, `objects.js`** — the traditions themselves,
   each a short function because the two layers below it do the work.

Paintings are marks on a surface; sculpture is a lit volume, built from shaded masses
under a single key light from the upper left, and then broken — because almost nothing
survives whole. The damage is rolled per piece, and the museum pays differently for
each.

`tools/contact.html` renders every generator twice on one page. It is the fastest way to
see whether a change to the shared layers broke a tradition.

---

## 7. Code map

Vanilla JS, Canvas2D, **no build step and no runtime dependencies**. Plain scripts, not
modules, so `index.html` opens from the filesystem as well as from a server.

```
index.html            page shell
styles.css            all styling; theme is one block of CSS variables
src/
  core/rng.js         seeded mulberry32 + the picks the content tables need
  core/raster.js      pixel buffer, ramps, noise, shapes, ageing
  art/motifs.js       shared marks
  art/paintings.js    19 painting traditions + 7 frame styles
  art/sculptures.js   14 sculptural forms
  art/objects.js      30 object types
  content/cultures.js 34 traditions, 11 depth bands
  content/artifacts.js assembly: name, notes, readings, condition, significance
  content/boons.js    24 random permanent upgrades
  content/upgrades.js two shops + the research list
  content/lore.js     intro, ending, era notes
  sim/state.js        the state object and every derived rate
  sim/museum.js       the clock, rating, footfall, admission, collection sets
  sim/game.js         descent, excavation, keystones, offline catch-up, prestige
  sim/save.js         localStorage + export/import
  art/people.js       visitor sprites, seven archetypes
  content/remarks.js  what visitors say, keyed to the art in front of them
  sim/visitors.js     room layout and the crowd state machine
  ui/shaft.js         the shaft cross-section renderer
  ui/digview.js       the excavation renderer
  ui/gallery.js       the museum floor: rooms, exhibits, crowd, bubbles
  ui/views.js         every DOM panel
  main.js             boot, frame, modals, wiring
tools/
  smoke.js            headless: errors, every generator, the balance curve, save round-trip
  shots.js            stocks a mid-game museum and grabs the screenshots
  contact.html        every sprite generator on one page
  makepdf.py          typesets this document
.github/workflows/
  deploy.yml          publishes the repository root to Cloudflare Pages
```

**Rules the code keeps to.** No DOM under `src/core`, `src/content` or `src/sim` — the
simulation is a pure function of state, which is what makes `smoke.js` able to run an
hour of play in a second. No `Math.random()` anywhere an artifact is generated; all of
it goes through the seeded RNG, or a save could not reproduce what the player saw.

### Save format

Each artifact serialises to `{seed, depth, culture, kind, objectType, condition, rarity,
boon, display}` and is rehydrated by re-running the same generators. Art, name and
field notes all come back byte-identical because they were never anything but functions
of the seed.

This makes `makeArtifact` order-sensitive: every roll happens on every call, and
overrides are applied *after* the roll rather than instead of it. Pinning one field
without consuming its draw would shift every later draw and the artifact would come back
with a different name.

---

## 8. What is not built yet

Ranked by value per unit of work.

1. **Audio.** Nothing at all yet. A drill loop that changes pitch with depth, a soft
   brush, a room tone that gets quieter as you go deeper into the museum, and one
   camera shutter would do most of the work.
2. **Multiple concurrent sites.** Prestige currently replaces the site. Running two at
   once, each with its own drill and its own band of the deposit, is the obvious next
   layer — and the fiction already has Site 3 reported.
3. **Conservation.** A queue where damaged pieces improve condition over real time.
   Gives the store a purpose beyond overflow.
4. **Loans and exhibitions.** Send a piece away for a period: lose its display
   contribution, gain a large lump and a rating bump on return.
5. **Pay for a good hang.** Rearranging works, but nothing rewards it yet. A
   coherence bonus — pieces of one tradition kept together, sizes alternating
   rather than clumping — would turn the Rehang mode from a toy into a decision.
6. **Deeper keystone chain.** The floor at 830 m ends the story cleanly; the anachronic
   band could carry two or three more written finds before it.
7. **Mobile polish.** It reflows and the excavation works with touch, but the stat bar
   wants a compact mode and the modals want to be sheets.

---

## 9. Running it

| Command | Does |
|---|---|
| `npm run serve` | static server on :8000 |
| `npm run smoke` | headless Chromium: console errors, every art generator, the balance curve, save round-trip |
| `npm run docs` | regenerate this document as a PDF |
| `node tools/shots.js` | regrab the screenshots from a stocked mid-game museum |

`index.html` also opens directly from the filesystem — the scripts are plain, not
modules, specifically so that it does.

### Deployment

There is nothing to build, so deployment is "copy the repository somewhere with a web
server". `.github/workflows/deploy.yml` pushes the root to **Cloudflare Pages** on every
commit to the working branch and on `main`. It needs two repository secrets:

| Secret | Where it comes from |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** (or a custom token with `Account · Cloudflare Pages · Edit`) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → the ID in the right-hand column, or in the URL |

Add them under *Settings → Secrets and variables → Actions*. The project name the
workflow deploys to is `site7-deep-survey`; change `projectName` in the workflow if the
Pages project is called something else. Until the secrets exist the workflow skips
rather than fails.
