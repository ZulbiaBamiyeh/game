/* ============================================================================
   BOONS — the random permanent upgrade an artifact teaches you

   Nothing in the collection is ever sold. What an object is worth is what
   studying it changes about how the survey works, and that is rolled, not
   chosen: opening a find is the slot machine at the centre of the game.

   Magnitude scales with the piece's significance, so a Fine Rare sculpture is
   both a better exhibit and a better teacher than a fragmentary sherd.

   Boons stack ADDITIVELY (S.add / S.red), not multiplicatively. There is no
   cap on how many artifacts you can lift, and a percentage that multiplies an
   unbounded count is a curve that leaves the screen inside an hour. Purchased
   upgrades multiply, because those have level caps.
   ============================================================================ */
(function (S7) {
  "use strict";

  /* cat: which shop the effect belongs to, for colour-coding the reveal.
     w:   relative frequency. tier: 0 common, 1 uncommon, 2 rare, 3 landmark. */
  const BOONS = [
    /* ---- excavation ---- */
    { id: "descent", cat: "dig", tier: 0, w: 100, label: "Improved shoring",
      fmt: (v) => "+" + v + "% descent rate",
      roll: (r) => r.int(2, 5), apply: (S, v) => { S.add.descent += v / 100; } },
    { id: "clear", cat: "dig", tier: 0, w: 100, label: "Refined clearing method",
      fmt: (v) => "+" + v + "% clearing rate",
      roll: (r) => r.int(4, 11), apply: (S, v) => { S.add.clear += v / 100; } },
    { id: "freq", cat: "dig", tier: 0, w: 80, label: "Sharper eyes on the spoil",
      fmt: (v) => "−" + v + "% distance between finds",
      roll: (r) => r.int(2, 6), apply: (S, v) => { S.red.findGap += v / 100; } },
    { id: "stam", cat: "dig", tier: 1, w: 46, label: "Better hand tools",
      fmt: (v) => "+" + v + " brush charge" + (v > 1 ? "s" : ""),
      roll: (r) => r.int(1, 2), apply: (S, v) => { S.maxStam += v; S.stamina += v; } },
    { id: "regen", cat: "dig", tier: 0, w: 70, label: "Practised technique",
      fmt: (v) => "−" + v + "% brush recovery time",
      roll: (r) => r.int(4, 10), apply: (S, v) => { S.red.stamRate += v / 100; } },
    { id: "radius", cat: "dig", tier: 1, w: 34, label: "Broader brush",
      fmt: () => "+0.4 brush radius",
      roll: () => 1, apply: (S) => { S.brushR += 0.4; } },
    { id: "cond", cat: "dig", tier: 2, w: 22, label: "Careful lifting",
      fmt: (v) => "+" + v + "% chance of better condition",
      roll: (r) => r.int(3, 8), apply: (S, v) => { S.bonus.condition += v / 100; } },
    { id: "rare", cat: "dig", tier: 2, w: 16, label: "Instinct for the unusual",
      fmt: (v) => "+" + v + "% chance of a rarer find",
      roll: (r) => r.int(2, 6), apply: (S, v) => { S.bonus.rarity += v / 100; } },
    { id: "deep", cat: "dig", tier: 2, w: 20, label: "Deep-shaft ventilation",
      fmt: (v) => "+" + v + "% descent below 200 m",
      roll: (r) => r.int(4, 9), apply: (S, v) => { S.add.deepDescent += v / 100; } },

    /* ---- museum ---- */
    { id: "rating", cat: "mus", tier: 0, w: 90, label: "Comparative material",
      fmt: (v) => "+" + v + "% museum rating",
      roll: (r) => r.int(2, 5), apply: (S, v) => { S.add.rating += v / 100; } },
    { id: "draw", cat: "mus", tier: 0, w: 85, label: "Word of mouth",
      fmt: (v) => "+" + v + "% visitors",
      roll: (r) => r.int(3, 9), apply: (S, v) => { S.add.visitors += v / 100; } },
    { id: "spend", cat: "mus", tier: 0, w: 85, label: "A piece people talk about",
      fmt: (v) => "+" + v + "% spend per visitor",
      roll: (r) => r.int(3, 10), apply: (S, v) => { S.add.spend += v / 100; } },
    { id: "cap", cat: "mus", tier: 1, w: 40, label: "Efficient hanging",
      fmt: (v) => "+" + v + " display space",
      roll: (r) => r.int(1, 3), apply: (S, v) => { S.bonus.capacity += v; } },
    { id: "dwell", cat: "mus", tier: 1, w: 44, label: "People stay longer",
      fmt: (v) => "+" + v + "% dwell time",
      roll: (r) => r.int(4, 12), apply: (S, v) => { S.add.dwell += v / 100; } },
    { id: "press", cat: "mus", tier: 2, w: 18, label: "Written up in the press",
      fmt: (v) => "+" + v + "% rating and visitors",
      roll: (r) => r.int(4, 10), apply: (S, v) => { S.add.rating += v / 100; S.add.visitors += v / 100; } },
    { id: "loan", cat: "mus", tier: 2, w: 16, label: "Loan requests from abroad",
      fmt: (v) => "+" + v + " funding per minute, flat",
      roll: (r) => r.int(2, 8), apply: (S, v) => { S.bonus.flatIncome += v / 60; } },

    /* ---- economy ---- */
    { id: "cost", cat: "eco", tier: 0, w: 75, label: "Favourable procurement",
      fmt: (v) => "−" + v + "% upgrade costs",
      roll: (r) => r.int(2, 5), apply: (S, v) => { S.red.cost += v / 100; } },
    { id: "grant", cat: "eco", tier: 0, w: 80, label: "Institute interest",
      fmt: (v) => "+" + v + "% grant income",
      roll: (r) => r.int(4, 12), apply: (S, v) => { S.add.grant += v / 100; } },
    { id: "offline", cat: "eco", tier: 1, w: 34, label: "The night watchman takes notes",
      fmt: (v) => "+" + v + "% progress while away",
      roll: (r) => r.int(5, 15), apply: (S, v) => { S.add.offline += v / 100; } },
    { id: "under", cat: "eco", tier: 0, w: 70, label: "Better field recording",
      fmt: (v) => "+" + v + "% Understanding",
      roll: (r) => r.int(4, 11), apply: (S, v) => { S.add.understanding += v / 100; } },

    /* ---- landmark: rare, loud, and worth stopping for ---- */
    { id: "twin", cat: "special", tier: 3, w: 7, label: "It was not alone down there",
      fmt: (v) => "+" + v + "% chance a find comes up in pairs",
      roll: (r) => r.int(4, 10), apply: (S, v) => { S.bonus.twin += v / 100; } },
    { id: "wing", cat: "special", tier: 3, w: 5, label: "A benefactor comes forward",
      fmt: (v) => "+" + v + " display space and +10% rating",
      roll: (r) => r.int(4, 9), apply: (S, v) => { S.bonus.capacity += v; S.add.rating += 0.10; } },
    { id: "sense", cat: "special", tier: 3, w: 5, label: "You start to know where to dig",
      fmt: (v) => "−" + v + "% distance between finds, permanently",
      roll: (r) => r.int(6, 12), apply: (S, v) => { S.red.findGap += v / 100; } },
    { id: "compound", cat: "special", tier: 3, w: 4, label: "The collection compounds",
      fmt: (v) => "+" + v + "% to every rate you have",
      roll: (r) => r.int(2, 5), apply: (S, v) => {
        const k = v / 100;
        S.add.descent += k; S.add.clear += k; S.add.rating += k;
        S.add.visitors += k; S.add.spend += k; S.add.grant += k;
      } },
  ];

  const byId = {};
  for (const b of BOONS) byId[b.id] = b;

  /* Significance pushes both which boon you get and how big it is. */
  function roll(rng, artifact) {
    const sig = artifact ? artifact.significance : 8;
    const lift = Math.min(2.4, sig / 22);             /* 0 .. 2.4 */
    const def = rng.weighted(BOONS, (b) => b.w * (b.tier >= 2 ? 0.35 + lift : 1));
    const base = def.roll(rng);
    const scale = 0.75 + Math.min(1.6, sig / 26);     /* 0.75 .. 2.35 */
    const value = Math.max(1, Math.round(base * scale));
    return { id: def.id, v: value };
  }

  function apply(state, boon) {
    const def = byId[boon.id];
    if (def) def.apply(state, boon.v);
  }

  const label = (boon) => (byId[boon.id] || { label: "—" }).label;
  const text = (boon) => (byId[boon.id] ? byId[boon.id].fmt(boon.v) : "—");
  const cat = (boon) => (byId[boon.id] || { cat: "dig" }).cat;
  const tier = (boon) => (byId[boon.id] || { tier: 0 }).tier;

  S7.boons = { BOONS, byId, roll, apply, label, text, cat, tier };
})(window.S7 = window.S7 || {});
