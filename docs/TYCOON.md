# The Hollow Museum — tycoon design

**The pitch.** You are given a condemned building over a hole in a field, and the
hole never stops producing. Build the museum around it: buy the land, raise the
storeys, partition the floors, hang the collection, hire the people who look
after it, and keep the doors open. The deeper the shaft goes the stranger the
material gets, until you are curating things that have no business existing and
deciding who is allowed to know.

This document is the plan for turning what exists into that game. It is
opinionated on purpose — every open question is answered, because a plan that
lists options is a plan nobody can build from.

---

## 1. The one decision everything else follows from

**This is Project Highrise, not Two Point Hospital.**

Two Point Hospital and Parkitect are *top-down* builders. Top-down is the right
interface for room shape and circulation, and the wrong one for us, because:

- Every person sprite would need four to eight facings. We have one, side-on.
- Every artifact would need a top-down representation. Paintings have none.
- The 2,559-line renderer and its entire visual identity would go in the bin.

Project Highrise, Mad Games Tycoon and Software Inc are *side-elevation* builders
— a dollhouse cross-section where you buy floor area and partition it. Side-on is
excellent for that, and it is exactly what we already draw. The existing stair
system is already a working model of the hardest part (vertical circulation).

So: **a side-elevation dollhouse museum.** Everything below assumes it.

---

## 2. The building

### The plot

The world is a grid.

| Unit | Size | Notes |
|---|---|---|
| **Column** | 24 world px wide | The atom of floor area. Buy them left and right. |
| **Storey** | 178 world px pitch (existing `FLOOR_PITCH`) | Basement −2 … roof +4. |
| **Cell** | one column on one storey | What you own, what you pay rates on. |

You start with **12 columns × 1 storey** (ground) — a shed. Land is bought a
column at a time and gets dearer the further from the shaft you go. Storeys are
bought whole and cost more the higher they are; the basement costs more than the
first floor because you are digging next to your own hole.

This is the primary money sink, and unlike the old upgrade shop it is *spatial* —
buying a column is worthless unless you have something to put in it.

### Rooms

Within a storey you drag out a span of columns and choose a room type. Rooms have
a minimum span, a cost to fit out, a daily running cost, and rules.

| Room | Min | Purpose | Rule |
|---|---|---|---|
| **Gallery** | 4 | Holds exhibits | The only room that earns rating |
| **Lobby** | 5 | Admissions desk, cloakroom | Exactly one, must touch the street |
| **Stairwell** | 3 | Vertical circulation | Must align across the storeys it serves |
| **Lift shaft** | 2 | Faster circulation, accessible | Continuous from lowest to highest served storey |
| **Toilets** | 3 | Need: bladder | One per ~250 visitors/day or queues form |
| **Café** | 5 | Needs: hunger, thirst, rest | Wants to be near the lobby or the halfway point |
| **Gift shop** | 4 | Spend on the way out | Only earns if it is on the exit path |
| **Cloakroom** | 2 | Reduces visitor encumbrance | Raises satisfaction in wet seasons |
| **Store** | 3 | Off-display collection | Condition decays slower than on display |
| **Workshop** | 4 | Conservation | Where conservators repair |
| **Office** | 3 | Admin capacity | Caps how many staff you can employ |
| **Staff room** | 3 | Morale | Staff without one lose morale daily |
| **Plant room** | 2 | Climate control | Extends its effect a fixed radius |
| **Research library** | 5 | Draws scholars, enables publication | |
| **Lecture theatre** | 6 | Events, school programmes | |

**Adjacency and circulation are the puzzle.** A gallery only earns if visitors
can *reach* it. A lift shaft eats two columns on every storey it passes. Toilets
on the third floor when the café is in the basement means unhappy people walking.
The building is a graph and the player is laying it out.

### What this replaces

The current `visitors.js` layout function generates rooms automatically from the
collection. That goes. Rooms become player-authored data in `S.building`, and the
layout function becomes a *reader* of that data rather than an author of it.

---

## 3. The visitor

The single most important change in the whole plan: **reputation stops being a
formula and becomes the aggregate of individual experiences.**

Every visitor is an agent (we have these) carrying:

```js
{
  segment,          // family | school | tourist | scholar | local | enthusiast
  interests: [],    // era ids and kinds they came to see
  needs: { energy, bladder, hunger, thirst, boredom },   // 0..1, rise over time
  wallet,           // what they can spend
  patience,         // how long they queue before balking
  satisfaction,     // 0..1, the number that matters
  seen: Set,        // pieces actually looked at
}
```

They arrive, queue, pay, and then run a simple utility loop: *the most pressing
thing right now is either an unmet need or an unseen exhibit I care about.* They
walk there. If the walk is too long, satisfaction drops. If they queue too long,
they balk and satisfaction drops hard. When they leave they write a review
(`content/reviews.js` already exists) whose sentiment is computed from what
actually happened to them.

**Satisfaction moves on:**

| Event | Effect |
|---|---|
| Saw a piece matching an interest | +, scaled by its display quality |
| Saw a star piece | ++ |
| Long walk with nothing on the way | − |
| Queued past patience | −− and they skip the room |
| Need hit 1.0 with no facility reachable | −−− and they leave early |
| Dirty room | − per room |
| Crowded room (over capacity) | − |
| Guided tour joined | ++ |
| Bench available when tired | + |

A visitor who leaves at 0.2 satisfaction tells everyone. A visitor who leaves at
0.9 comes back and brings people. That is the reputation engine, and it is
*legible*: the player can watch one person have a bad day and understand exactly
why.

### Why this matters more than anything else

It converts every building decision into an observable consequence. Put the
toilets too far away and you will *see* someone hurry across three rooms and
leave. That is what a tycoon game is.

---

## 4. Money, and the ability to lose

The current game cannot be lost. That is the reason it doesn't feel like a
tycoon. Every one of these is new:

**Income**
- Admission (existing, keep the elastic price curve — it's good)
- Gift shop and café (existing, but now gated on the room being on the path)
- Donations box — scales with satisfaction, not footfall
- **Memberships** — a member pays once a year, visits often, spends more on site
- **Venue hire** — close a wing for an evening, take a fee, annoy day visitors
- Grants — the Institute's, tied to the quarterly review

**Costs**
- **Staff wages**, paid daily. The dominant cost and the reason payroll is a
  decision rather than a formality.
- Utilities per room per day — a plant room is expensive to run
- Rates on owned cells, whether or not they are used
- Conservation materials
- Loan fees and insurance on borrowed pieces
- Marketing campaigns
- **Debt.** Construction can be financed. Interest accrues daily.

**Failure.** Past a debt ceiling the Institute takes over: staff are dismissed,
wings close, and you play on in a smaller building. Twice in a row and the run
ends. Not a hard fail-state on day one — a spiral you can see coming and pull out
of, which is more interesting than a game over screen.

---

## 5. Staff

| Role | Wage/day | What they do |
|---|---|---|
| **Front of house** | £70 | Desk throughput. Too few → queue at the door → balking. |
| **Guide** | £85 | Runs tours (exists). Raises satisfaction in their assigned wing. |
| **Curator** | £120 | Raises display quality of an assigned wing; unlocks rotation. |
| **Conservator** | £130 | Repairs condition in the workshop. |
| **Security** | £80 | Prevents theft and damage. High-value pieces need cover. |
| **Cleaner** | £60 | Cleanliness decays with footfall; dirty rooms hurt satisfaction. |
| **Excavator** | £90 | Staffs the dig. More diggers, more finds. |

Each has **skill 1–5** (better costs more), **morale** (falls without a staff
room, breaks, or fair pay), and an **assignment** (a wing, a floor, or a room).
Morale at zero means they quit, usually at the worst time.

Hiring is a genuine decision because the wage bill is relentless and the money
comes in per visitor.

---

## 6. Curation — the part that should be delicious

An exhibit's **draw** is not just the object. It is:

```
draw = significance
     × displayQuality      // case, lighting, plinth, space around it
     × labelQuality        // written by a curator, or not
     × coherence           // does it belong with its neighbours
     × freshness           // has this room changed lately
     × (isStarPiece ? 1.6 : 1)
```

- **Display quality.** Four case tiers, three lighting tiers, plinths, rope,
  vitrine vs open mount. Each costs money and floor space. A masterpiece in a
  bad case is wasted.
- **Coherence.** Pieces of one culture or one era hung together score higher than
  a jumble. This is what makes *arranging* the collection a real activity and
  finally rewards the Rehang mode that already exists.
- **Freshness.** A room untouched for 60 days loses draw. Rotating pieces in from
  store restores it. **This is what gives the store a purpose** and turns curation
  from a one-time setup into an ongoing job.
- **Star piece.** Each room's best object anchors it and appears on the room sign.

### Condition and conservation

Artifacts decay on display — faster in bad cases, in dirty rooms, without climate
control, and in daylight. A conservator in a workshop restores them. Let a
masterpiece rot and it drops a rarity tier permanently. This makes the plant room
and the case tiers matter, and gives conservators a job with visible stakes.

---

## 7. Where artifacts come from

Five channels, deliberately different in rhythm:

| Channel | Cost | Rhythm | What it's for |
|---|---|---|---|
| **The dig** | Wages + gear | Continuous trickle | The premise. Depth = era. Unpredictable. |
| **Auction** | Cash, competitive | 3–5 lots, refreshed weekly | Targeting a specific gap |
| **Donations** | Free | Random, reputation-gated | Mostly junk, occasionally extraordinary |
| **Loans** | Fee + insurance | 30–90 days, must return | The blockbuster exhibition beat |
| **Expeditions** | Staff + cash + weeks | Lumpy, themed haul | A gamble with a story |

The dig stays central to the fiction but stops being the main screen. It becomes
a panel: fund it, staff it, choose a depth band to work, and it produces. The
excavation minigame survives as an optional "supervise personally" action worth a
bonus, for players who like it.

**Loans deserve special attention.** Borrowing a famous piece for eight weeks
gives a huge temporary draw, costs a fee, requires security cover, and must go
back on time. It creates the single best beat in any museum game: *the queue
round the block, and then the empty plinth.*

---

## 8. Reputation, and why you cannot please everyone

Not one rating. **Six audience segments, each with its own reputation**, each
drawn by different things:

| Segment | Drawn by | Repelled by |
|---|---|---|
| **Families** | Dinosaurs, big things, café, interactivity | Long walks, no toilets, quiet rules |
| **Schools** | Breadth, good labels, lecture theatre | High price, no space to sit |
| **Scholars** | Rarity, research library, publications | Crowds, gift-shop tat |
| **Tourists** | Star pieces, photogenic rooms, gift shop | Obscurity, no signage |
| **Locals** | Cheap tickets, café, events, being open | Price rises, closures |
| **Enthusiasts** | Depth in one collection, completeness | Shallow breadth |

**This is the strategic core of the game.** A dinosaur-and-café museum is a
family museum: high footfall, low spend per head, needs enormous circulation. A
collection of unattributable Neanderthal work with a research library is a
scholar's museum: low footfall, high grants, publishes papers. Both are viable.
They want *different buildings*.

Segment mix determines who walks through the door, which determines what your
building needs, which determines what you should build next. That is a strategy
game.

---

## 9. The eerie arc — what no other museum game has

Below about 400 m the material stops being explicable, and this becomes a
*narrative* system rather than a numeric one:

- **Scholars flock. Families are disturbed.** The segment mix shifts under you.
- Some pieces carry **effects**: visitors linger unnaturally long (good for spend,
  bad for capacity); staff morale in that wing drops; cleanliness decays faster;
  the room's ambient sound changes.
- **Press attention.** Newspaper events that spike footfall and scrutiny.
- **The Institute starts asking questions.** Quarterly reviews get pointed.
- Eventually a real decision: **publish or conceal.** Publishing brings scholars,
  funding, and scrutiny. Concealing keeps the collection but the Institute's
  patience is finite. This is the endgame fork, and it should have three endings.

This is the spine that stops the game being a spreadsheet with pixel art.

---

## 10. Time, goals, and progression

- **Day**: 09:00–17:00, one museum-minute per real second (existing). ~8 min real.
- **Week**: auction refresh, wage bill, cleaning cycle.
- **Season**: footfall multipliers — summer and half-term peaks, February dead.
- **Quarter**: **Institute review.** Three targets (visitors, rating, one
  wildcard). Hit them → grant. Miss → funding cut and a pointed letter.
- **Year**: the long arc; star rating reviewed.

**Star rating 1–5** gates unlocks, so the game teaches itself in order:

| Star | Requires | Unlocks |
|---|---|---|
| ★ | Doors open, 1 gallery | Café, gift shop, first storey up |
| ★★ | 25 rating, 200 visitors/day | Guides, curators, auction house, basement |
| ★★★ | 45 rating, 3 complete traditions | Loans, research library, lift shafts, +2 storeys |
| ★★★★ | 65 rating, publication | Expeditions, lecture theatre, memberships |
| ★★★★★ | 85 rating, the deep collection | Venue hire, the endgame fork |

---

## 11. What this means for the existing code

**Kept whole (~9,000 lines).** Everything in `src/art/` — 59 object generators,
19 painting traditions, 14 sculptural forms, the people. `content/cultures.js`,
`artifacts.js`, `remarks.js`, `reviews.js`, `skeletons.js`, `lore.js`. All of
`core/`. `ui/audio.js`. The renderer in `ui/gallery.js` and the agent movement,
pathing, stairs and tours in `visitors.js`.

**Rewritten (~3,000 lines).**
- `sim/museum.js` — economy replaced by per-visitor satisfaction and segments
- `sim/visitors.js` — the layout half becomes a reader of `S.building`; the agent
  half gains needs and utility-based target selection
- `ui/views.js` — panels for build, staff, acquisition, finance
- `sim/state.js` and `save.js` — new state shape, save v3 with a migration

**Cut (~1,500 lines).**
- `content/upgrades.js` — the linear shop is replaced by building and hiring
- `content/boons.js` — a random permanent buff per artifact is an idle-game
  mechanic. Artifacts should be valuable for *what they are*, not for a dice roll
  stapled to them. This is the one deletion I would argue hardest for.
- `ui/shaft.js` / `digview.js` demoted from main screen to a funded panel

---

## 12. Build order

Each stage ends playable. Nothing is a big-bang rewrite.

| # | Stage | What lands | Feels like |
|---|---|---|---|
| **0** | **Foundations** | `S.building` grid, save v3 + migration, layout reads the grid instead of authoring it. No visible change. | Same game |
| **1** | **Build mode** | Buy columns and storeys, drag out rooms, place stairs and lifts, demolish. Existing rooms become the starting building. | A sandbox — the first genuinely new thing |
| **2** | **Needs and satisfaction** | Visitor needs, utility targeting, balking, per-visitor satisfaction, reviews from real experience. Toilets, benches, café matter. | Suddenly a tycoon |
| **3** | **Staff and payroll** | Seven roles, wages, skill, morale, assignment, the office cap. Debt and the loss spiral. | Consequences |
| **4** | **Curation** | Display quality tiers, coherence, freshness, rotation, star pieces, condition decay and conservation. | The collection becomes a craft |
| **5** | **Acquisition** | Auction, donations, loans, expeditions. The dig becomes a funded panel. | Strategy over supply |
| **6** | **Audiences** | Six segments with separate reputations and separate demands. | Real strategic identity |
| **7** | **Calendar** | Seasons, quarterly Institute reviews, star ratings and the unlock spine. | Shape and pressure |
| **8** | **The eerie arc** | Deep-material effects, press, the publish-or-conceal fork, three endings. | A game with something to say |
| **9** | **Polish** | Tutorial, onboarding, a proper build UI, sound for every action, balance pass, accessibility. | Finished |

**Stages 1–3 are the game.** If we only ever shipped those, it would already be a
tycoon. Everything after deepens it.

---

## 13. What "very polished" has to mean

Non-negotiables, checked every stage:

- **Every action has feedback.** A sound, a number that moves, a person who
  reacts. Placing a room should feel like placing a room.
- **Every number is explainable.** Hover anything and it tells you what it is
  made of. The "needs attention" panel already proves the pattern.
- **Nothing is ever a wall of grey placeholders.** Locked content is described,
  not hidden behind "???".
- **The building is always legible.** You should be able to read circulation at a
  glance — where people are going and where they are stuck.
- **Failure is visible three days out.** The player must be able to see the
  spiral coming.
- **The smoke test grows with the game.** It already fails the build on
  unrealistic footfall, a solved ticket price and a dead crowd; it should also
  fail on unreachable rooms, impossible circulation and unwinnable economies.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Build UI in a side elevation is fiddly | Prototype it first in stage 1 and be willing to change the column size |
| Pathing cost with 96 agents on a player-built graph | Precompute a room-graph on build change; agents path room-to-room, not pixel-to-pixel |
| Six segments is too much to balance | Ship stage 6 with three (family, scholar, tourist) and add the rest once the maths holds |
| Losing the idle audience | Keep offline progress and keep the dig producing while away |
| Scope | Stages 1–3 are the commitment; 4–9 are sequenced so we can stop anywhere and still have a game |
