/* ============================================================================
   THE MUSEUM

   The economic engine, and it works the way a museum actually works: people
   come through the door, they pay at the desk, and that is the money.

       collection ──▶ renown ──▶ visitors per day ──▶ admissions ──▶ funding

   Everything is in real units. A one-room local collection does twenty or
   thirty people a day. A serious county museum does a few hundred. A national
   collection does three or four thousand. Nothing in here is ever "13.6k per
   minute", which is what it used to say and which is nobody's museum.

   The day is 09:00 to 17:00, and one museum minute is one real second, so an
   open day takes eight minutes to play and the night is compressed.
   ============================================================================ */
(function (S7) {
  "use strict";

  /* ---------- the clock ---------------------------------------------------- */

  const OPEN_AT = 9 * 60;             /* 09:00 */
  const CLOSE_AT = 17 * 60;           /* 17:00 */
  const DAY_MINUTES = 24 * 60;
  const OPEN_MINUTES = CLOSE_AT - OPEN_AT;   /* 480 */
  const NIGHT_SPEED = 16;             /* the closed hours run at 16x */

  const isOpen = (S) => S.minute >= OPEN_AT && S.minute < CLOSE_AT;

  /* How fast the museum clock runs, in museum-minutes per real second. */
  const clockRate = (S) => (isOpen(S) ? 1 : NIGHT_SPEED);

  function clockText(S) {
    const m = Math.floor(S.minute);
    const h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }

  /* Footfall over the day: quiet at opening, a long lunchtime peak, a tail-off
     before close. Integrates to 1 across the open hours. */
  function arrivalShape(minute) {
    if (minute < OPEN_AT || minute >= CLOSE_AT) return 0;
    const t = (minute - OPEN_AT) / OPEN_MINUTES;          /* 0..1 */
    const peak = Math.exp(-Math.pow((t - 0.46) / 0.30, 2));
    return 0.35 + peak;                                    /* never truly dead */
  }
  /* Mean of arrivalShape over the open day, so the rate normalises to the
     day's total no matter how the curve is shaped. */
  const SHAPE_MEAN = (() => {
    let sum = 0;
    for (let m = OPEN_AT; m < CLOSE_AT; m++) sum += arrivalShape(m);
    return sum / OPEN_MINUTES;
  })();

  /* ---------- the collection ------------------------------------------------ */

  /* Soft cap: behaves like x while x is small, and can never exceed k.
     Facilities multiply the collection's pull; they do not replace it.
     Guard non-positive x so a bad mul can never push footfall negative. */
  const softCap = (x, k) => {
    if (!(x > 0) || !(k > 0)) return 0;
    return (k * x) / (k + x - 1);
  };

  const displayed = (S) => S.collection.filter((a) => a.display !== false);

  const capacity = (S) => 6 + S.bonus.capacity;

  function survey(S) {
    const shown = displayed(S);
    let sig = 0;
    const cultures = new Set(), kinds = new Set(), eras = new Set();
    let best = null;
    for (const a of shown) {
      sig += a.significance;
      cultures.add(a.cultureId);
      kinds.add(a.kind + (a.objectType || a.skeletonPart || ""));
      eras.add(S7.cultures.eraAt(a.depth).id);
      if (!best || a.significance > best.significance) best = a;
    }

    /* Complete dinosaur mounts are the Hall's jackpot — assembled bone by bone. */
    let skeletons = { bonus: 0, complete: [] };
    if (S7.skeletons) {
      skeletons = S7.skeletons.ratingBonus(S);
      sig += skeletons.bonus;
    }

    const cap = capacity(S);
    /* Mounted skeletons are huge but should not count as capacity spam. */
    const mountCount = skeletons.complete ? skeletons.complete.length : 0;
    const capLoad = Math.max(0, shown.length);
    const crowd = capLoad > cap ? Math.pow(cap / capLoad, 0.55) : 1;

    const breadthFactor = S.research.duplicate
      ? 1 + cultures.size * 0.14
      : 1 + cultures.size * 0.12;
    const varietyFactor = 1 + kinds.size * 0.05 + eras.size * 0.06
      + mountCount * 0.35;

    const renown = (shown.length || mountCount)
      ? Math.pow(sig, 0.62) * breadthFactor * varietyFactor *
        softCap(S.mul.rating * (1 + S.add.rating), 25) * crowd
      : 0;

    return {
      shown, count: shown.length, sig, cap, crowd, best,
      cultures: cultures.size, kinds: kinds.size, eras: eras.size,
      renown, skeletons,
      rating: 100 * renown / (renown + 6000),
    };
  }

  /* ---------- admission ------------------------------------------------------
     The price is the player's decision and the only one that cuts both ways.
     `suggested` is what a museum of this standing could reasonably charge;
     going over it costs you footfall, going under buys you some. */

  const suggestedPrice = (sv) => Math.max(2, Math.round((2.5 + sv.rating * 0.16) * 2) / 2);

  function priceFactor(S, sv) {
    const suggested = suggestedPrice(sv);
    const p = Math.max(0, S.admission);
    /* Free entry is worth about a 60% lift; charging double the going rate
       costs nearly 60% of the gate. The exponent is what makes the price a
       decision: demand this elastic means the gate alone peaks just above the
       going rate, so the choice is a genuine one between a full house and a
       fat margin rather than a number with one right answer. */
    return 1.6 / (1 + 0.6 * Math.pow(p / suggested, 2.2));
  }

  /* How many people would come through the door on a day like today.

     Hung off the rating rather than off raw renown, and that is the whole
     trick: the rating already saturates towards 100, so the busiest possible
     day is a number a real museum could have. PEAK_DAY is what a rating-100
     collection does at its suggested price; outreach can roughly treble it,
     which puts the absolute ceiling near eleven thousand a day — the Louvre
     on a bad Tuesday, and the most any building on this site could hold. */

  const PEAK_DAY = 4200;
  const OUTREACH_CAP = 2.6;

  function visitorsPerDay(S, sv) {
    if (sv.count === 0) return 0;
    const standing = Math.pow(Math.max(0, sv.rating) / 100, 1.25);
    const outreach = softCap(S.mul.visitors * (1 + S.add.visitors), OUTREACH_CAP);
    return Math.max(0, PEAK_DAY * standing * outreach * priceFactor(S, sv));
  }

  /* Arrivals per museum-minute at the current time of day. */
  function arrivalRate(S, sv) {
    if (!isOpen(S)) return 0;
    return (visitorsPerDay(S, sv) / OPEN_MINUTES) * (arrivalShape(S.minute) / SHAPE_MEAN);
  }

  /* Small till extras always on: postcards at the desk, a leaflet rack. */
  function baseExtra(S, sv) {
    const rating = Math.min(1, Math.max(0, sv.rating) / 100);
    return (0.35 + 0.9 * rating) *
      softCap(S.mul.spend * (1 + S.add.spend), 1.8);
  }

  /* Gift shop basket — only if the shop room exists. Scales with level. */
  function shopSpend(S, sv) {
    const lvl = S.up.shop || 0;
    if (lvl <= 0) return 0;
    const rating = Math.min(1, Math.max(0, sv.rating) / 100);
    return (1.4 + lvl * 0.45 + 1.6 * rating) *
      softCap(S.mul.spend * (1 + S.add.spend), 2.6);
  }

  /* Café order — tea and cake. Dwell upgrades make people linger and order more. */
  function cafeSpend(S, sv) {
    const lvl = S.up.cafe || 0;
    if (lvl <= 0) return 0;
    const rating = Math.min(1, Math.max(0, sv.rating) / 100);
    return (2.0 + lvl * 0.55 + 1.8 * rating) *
      softCap(S.mul.spend * (1 + S.add.spend), 2.6) *
      softCap(S.mul.dwell * (1 + S.add.dwell), 1.6);
  }

  /* Chance a given visitor uses each amenity (expected value when the crowd
     is not being walked on the museum tab). */
  function amenityRates(S) {
    const shopLvl = S.up.shop || 0;
    const cafeLvl = S.up.cafe || 0;
    return {
      shop: shopLvl > 0 ? Math.min(0.72, 0.32 + shopLvl * 0.028) : 0,
      cafe: cafeLvl > 0 ? Math.min(0.65, 0.26 + cafeLvl * 0.025) : 0,
    };
  }

  function amenityExpected(S, sv) {
    const r = amenityRates(S);
    const shop = r.shop * shopSpend(S, sv);
    const cafe = r.cafe * cafeSpend(S, sv);
    return { shop, cafe, total: shop + cafe };
  }

  /* Full secondary take per visitor for projections and offline days. */
  function secondarySpend(S, sv) {
    return baseExtra(S, sv) + amenityExpected(S, sv).total;
  }

  const perVisitor = (S, sv) => S.admission + secondarySpend(S, sv);

  /* Live income in funding per real second — what the header shows. Arrivals
     are per museum-minute and the clock runs at clockRate museum-minutes per
     real second, so the two multiply. */
  function incomeRate(S, sv) {
    return arrivalRate(S, sv) * clockRate(S) * perVisitor(S, sv) + standingIncome(S);
  }

  /* Standing income that has nothing to do with the door: the Institute grant,
     and any loan fees the collection has earned. Per real second. */
  const standingIncome = (S) => S7.state.grantRate(S) + S.bonus.flatIncome;

  /* A day's takings, for the panel — not used to pay the player, who is paid
     one visitor at a time. */
  function projectedDay(S, sv) {
    const v = visitorsPerDay(S, sv);
    const amen = amenityExpected(S, sv);
    return {
      visitors: v,
      gate: v * S.admission,
      extra: v * secondarySpend(S, sv),
      shop: v * amen.shop,
      cafe: v * amen.cafe,
      base: v * baseExtra(S, sv),
    };
  }

  const stars = (rating) => rating / 20;

  function verdict(sv) {
    if (sv.count === 0) return "Nothing on display. The doors are not open.";
    if (sv.rating < 3) return "One room, a handful of objects, and no reason to visit twice.";
    if (sv.rating < 8) return "Locals only, and mostly by accident.";
    if (sv.rating < 15) return "A modest regional collection. School parties on Tuesdays.";
    if (sv.rating < 25) return "Worth an afternoon. People are starting to come on purpose.";
    if (sv.rating < 40) return "A serious collection. The county is proud of it.";
    if (sv.rating < 55) return "Nationally significant. There is a queue at opening.";
    if (sv.rating < 70) return "One of the great collections. Scholars book months ahead.";
    if (sv.rating < 85) return "People fly here for this. The deep gallery is never empty.";
    return "There is nothing else like it. The Hollow Museum is the only place this sequence is known.";
  }

  /* ---------- what needs attention -------------------------------------------
     A tycoon game diagnoses. It is not enough to show a rating and a verdict:
     the player needs to know *why* it is what it is and what the next useful
     thing to do about it is. Everything here is read off state that is already
     computed for other purposes, ranked so the most expensive mistake is at
     the top, and capped so the panel is a to-do list rather than a wall.

     `fix` is the upgrade id to nudge toward, if there is one. */

  function advice(S, sv) {
    const out = [];
    const add = (w, id, title, body, fix) => out.push({ w, id, title, body, fix });
    const stored = S.collection.length - sv.count;
    const cap = sv.cap;
    const price = S.admission;
    const suggested = suggestedPrice(sv);
    const lvl = (id) => S.up[id] || 0;
    const cost = (id) => S7.upgrades.cost(S, S7.upgrades.ALL[id]);
    const afford = (id) => S7.upgrades.ALL[id] && S.funds >= cost(id);

    if (sv.count === 0) {
      add(100, "closed", "The doors are shut",
          "Nothing is on display, so nobody is coming. Accession a find and put it on show.");
      return out;
    }

    /* Overcrowding is the most expensive thing a player does by accident. */
    if (sv.count > cap) {
      const lost = Math.round((1 - sv.crowd) * 100);
      add(90, "crowded", "Overcrowded galleries",
          sv.count + " pieces in space for " + cap + ". The clutter is costing you " +
          lost + "% of the rating." +
          (S7.upgrades.ALL.cases ? " Cases are " + Math.round(cost("cases")) + "." : ""),
          "cases");
    } else if (stored > 0 && sv.count < cap) {
      add(70, "store", "Space going spare",
          stored + " piece" + (stored === 1 ? "" : "s") + " in store and room for " +
          (cap - sv.count) + " more on the walls. Anything in store earns you nothing at the door.");
    }

    /* Pricing, in both directions. */
    if (price > suggested * 1.45) {
      add(76, "dear", "The ticket is over the odds",
          "You charge " + price + " against a going rate of " + suggested +
          ". Footfall is down to " + Math.round(priceFactor(S, sv) * 100 / 1.6) +
          "% of what a free door would draw, and the grant follows the turnstile.");
    } else if (price < suggested * 0.55 && sv.rating > 6) {
      add(58, "cheap", "You are underselling the place",
          "A collection at " + sv.rating.toFixed(0) + "/100 could ask " + suggested +
          ". You are asking " + price + ".");
    }

    /* Rooms that are barely rooms. */
    let thin = 0, thinName = "";
    const byEra = {};
    for (const a of sv.shown) {
      const e = S7.cultures.eraAt(a.depth);
      byEra[e.id] = byEra[e.id] || { n: 0, name: e.name };
      byEra[e.id].n++;
    }
    for (const k in byEra) if (byEra[k].n === 1) { thin++; thinName = byEra[k].name; }
    if (thin >= 2) {
      add(48, "thin", thin + " galleries with one piece in them",
          "A room hung with a single object reads as an empty room. Dig on, or move " +
          "pieces together with Rehang until each band has something to say.");
    } else if (thin === 1) {
      add(30, "thin1", "A gallery with one piece in it",
          thinName + " has a single object on show.");
    }

    /* Amenities that pay for themselves. */
    if (lvl("shop") === 0 && S.stats.visitorsTotal >= 40) {
      add(62, "shop", "No gift shop",
          "Every visitor walks past where it would be. A shop takes money from people " +
          "who have already paid to get in." + (afford("shop") ? " You can afford one." : ""),
          "shop");
    }
    if (lvl("cafe") === 0 && lvl("shop") > 0 && S.stats.visitorsTotal >= 150) {
      add(50, "cafe", "No café",
          "The café is the second most profitable room in any museum, and it makes " +
          "people stay longer, which makes them spend more.",
          "cafe");
    }
    if (lvl("upper") === 0 && S.collection.length >= 18 && afford("upper")) {
      add(56, "upper", "A second storey is affordable",
          "You have the collection for it and the money for it. More floor is more " +
          "display space and more reason to come.",
          "upper");
    }

    /* Understanding sitting in the bank does nothing at all. */
    const nextRes = S7.upgrades.RESEARCH.find((r) => !S.research[r.id]);
    if (nextRes && S.understanding >= nextRes.cost) {
      add(66, "research", "Research waiting to be bought",
          "You are holding " + Math.round(S.understanding) + " Understanding and " +
          nextRes.name + " costs " + nextRes.cost + ". It buys what money cannot.");
    }

    /* One piece from a complete tradition is the most motivating fact you can
       show somebody who is deciding whether to keep digging. */
    const sets = setsFor(S);
    const nearly = sets.filter((x) => !x.complete && x.want - x.have === 1);
    if (nearly.length) {
      add(44, "set", nearly.length === 1
            ? "One piece from completing " + nearly[0].culture.name
            : nearly.length + " traditions are one piece from complete",
          "Completing a tradition is a permanent standing bonus.");
    }

    /* Light is the cheapest rating in the game and players miss it. */
    if (lvl("lighting") < 3 && afford("lighting")) {
      add(40, "lighting", "The galleries are underlit",
          "Most of what a museum sells is light. It is also the cheapest rating on " +
          "the list at " + Math.round(cost("lighting")) + ".",
          "lighting");
    }

    out.sort((a, b) => b.w - a.w);
    return out.slice(0, 4);
  }

  /* Culture set completion — the long-tail collection goal. */
  function setsFor(S) {
    const held = {};
    for (const a of S.collection) {
      const c = (held[a.cultureId] = held[a.cultureId] || { kinds: new Set(), n: 0 });
      c.kinds.add(a.kind === "object" ? "o:" + a.objectType : a.kind);
      c.n++;
    }
    return S7.cultures.CULTURES.map((cu) => {
      const want = [];
      if (cu.painting) want.push("painting");
      if (cu.sculpture) want.push("sculpture");
      for (const o of cu.objects) want.push("o:" + o);
      const h = held[cu.id];
      const have = h ? want.filter((w) => h.kinds.has(w)).length : 0;
      return { culture: cu, want: want.length, have, n: h ? h.n : 0, complete: have >= want.length };
    });
  }

  S7.museum = {
    OPEN_AT, CLOSE_AT, DAY_MINUTES, OPEN_MINUTES, NIGHT_SPEED,
    isOpen, clockRate, clockText, arrivalShape,
    displayed, capacity, survey, softCap,
    suggestedPrice, priceFactor, visitorsPerDay, arrivalRate, PEAK_DAY,
    baseExtra, shopSpend, cafeSpend, amenityRates, amenityExpected,
    secondarySpend, perVisitor, standingIncome, projectedDay, incomeRate,
    stars, verdict, setsFor, advice,
  };
})(window.S7 = window.S7 || {});
