/* ============================================================================
   STATE

   One plain object, no classes, no framework. Everything the game needs to
   resume is in here and everything in here survives JSON.stringify — which is
   the whole reason artifacts are stored as seeds rather than pixels.
   ============================================================================ */
(function (S7) {
  "use strict";

  const VERSION = 3;

  function fresh(seed) {
    const S = {
      version: VERSION,
      seed: seed >>> 0,
      started: false,
      intro: 0,

      depth: 0,
      funds: 0,
      understanding: 0,
      sites: 1,               /* Site 7 is the first. Others follow. */

      up: {},                 /* upgrade id -> level */
      research: {},           /* research id -> true */

      /* Two separate channels, and the split matters.

         `mul` is what purchased upgrades and research do: they multiply, and
         every one of them has a level cap, so the product is bounded.

         `add` and `red` are what artifacts do: they accumulate linearly and
         are applied as (1 + add) and / (1 + red). There is no limit on how
         many artifacts a player can lift, and a percentage multiplying an
         unbounded count is a curve that leaves the screen inside an hour. */
      mul: {
        descent: 1, deepDescent: 1, clear: 1, findGap: 1, stamRate: 1,
        rating: 1, visitors: 1, spend: 1, dwell: 1,
        grant: 1, cost: 1, understanding: 1, offline: 1,
      },
      add: {
        descent: 0, deepDescent: 0, clear: 0, rating: 0, visitors: 0,
        spend: 0, dwell: 0, grant: 0, understanding: 0, offline: 0,
      },
      red: { findGap: 0, stamRate: 0, cost: 0 },
      bonus: { condition: 0, rarity: 0, capacity: 0, twin: 0, flatIncome: 0 },
      flags: { climate: false },

      stamina: 6, maxStam: 6, stamTimer: 0, brushR: 1.6,

      collection: [],         /* accessioned artifacts, oldest first */
      pending: null,          /* a finished dig awaiting the accession decision */
      active: null,           /* the dig in progress */

      nextFindAt: 4,
      accession: 0,
      keyIdx: 0,

      stats: {
        finds: 0, accessioned: 0, visitorsTotal: 0, earned: 0,
        deepFinds: 0, playtime: 0, correct: 0, filed: 0,
      },
      milestones: {},
      log: [],
      lastSeen: Date.now(),
      tab: "site",
    };
    for (const u of S7.upgrades.EXCAVATION.concat(S7.upgrades.MUSEUM)) S.up[u.id] = 0;
    return S;
  }

  /* Multipliers are derived, not stored: they are rebuilt from scratch on load
     by replaying every purchase and every boon. That way a balance change to
     an upgrade takes effect on existing saves instead of being baked in. */
  function recompute(S) {
    S.mul = {
      descent: 1, deepDescent: 1, clear: 1, findGap: 1, stamRate: 1,
      rating: 1, visitors: 1, spend: 1, dwell: 1,
      grant: 1, cost: 1, understanding: 1, offline: 1,
    };
    S.add = {
      descent: 0, deepDescent: 0, clear: 0, rating: 0, visitors: 0,
      spend: 0, dwell: 0, grant: 0, understanding: 0, offline: 0,
    };
    S.red = { findGap: 0, stamRate: 0, cost: 0 };
    S.bonus = { condition: 0, rarity: 0, capacity: 0, twin: 0, flatIncome: 0 };
    S.flags = { climate: false };
    S.maxStam = 6;
    S.brushR = 1.6;

    for (const u of S7.upgrades.EXCAVATION.concat(S7.upgrades.MUSEUM)) {
      const lvl = S.up[u.id] || 0;
      if (!u.eff) continue;
      for (let i = 0; i < lvl; i++) u.eff(S);
    }
    for (const id in S.research) {
      if (!S.research[id]) continue;
      const eff = S7.upgrades.RESEARCH_EFF[id];
      if (eff) eff(S);
    }
    for (const a of S.collection) if (a.boon) S7.boons.apply(S, a.boon);
    if (S.stamina > S.maxStam) S.stamina = S.maxStam;
  }

  /* ---------- derived rates ---------------------------------------------- */

  /* Each site opened is a permanent standing bonus — the museum keeps what it
     learned even though the shaft starts again at nothing. */
  const siteBonus = (S) => 1 + ((S.sites || 1) - 1) * 0.45;

  /* The ground fights back. Resistance rising with depth is what keeps the
     shaft from being a formality once the museum starts printing money: every
     era is a wall you have to buy your way through, not a stretch you coast. */
  const resistance = (S) => 1 + S.depth / 9;

  const atFloor = (S) => S.depth >= S7.cultures.MAX_DEPTH - 0.001;

  const descentRate = (S) =>
    atFloor(S) ? 0 :
    0.55 * (1 + (S.up.drill || 0) * 0.12) * S.mul.descent * (1 + S.add.descent) * siteBonus(S) *
    (S.depth >= 200 ? S.mul.deepDescent * (1 + S.add.deepDescent) : 1) / resistance(S);

  const clearRate = (S) =>
    5 * (1 + (S.up.crew || 0) * 0.30) * S.mul.clear * (1 + S.add.clear) * siteBonus(S);

  /* Finds thin out with depth. Without this the descent rate and the find rate
     feed each other and the late game becomes an unreadable blur. */
  /* The floor rises with depth: the deposit thins as you go down, so finds per
     metre cannot climb for ever no matter how good your sieve gets. */
  const findGap = (S) =>
    Math.max(2.2 + S.depth * 0.015,
             S7.cultures.eraAt(S.depth).find * (1 + S.depth / 700) *
             S.mul.findGap / (1 + S.red.findGap));

  const grantRate = (S) => (0.30 + S.depth * 0.005) * S.mul.grant * (1 + S.add.grant);

  const staminaPeriod = (S) => Math.max(0.25, 1.5 * S.mul.stamRate / (1 + S.red.stamRate));

  S7.state = {
    VERSION, fresh, recompute,
    descentRate, clearRate, findGap, grantRate, staminaPeriod, siteBonus, resistance, atFloor,
  };
})(window.S7 = window.S7 || {});
