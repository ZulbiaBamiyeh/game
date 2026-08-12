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
     Facilities multiply the collection's pull; they do not replace it. */
  const softCap = (x, k) => (k * x) / (k + x - 1);

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
    return PEAK_DAY * standing * outreach * priceFactor(S, sv);
  }

  /* Arrivals per museum-minute at the current time of day. */
  function arrivalRate(S, sv) {
    if (!isOpen(S)) return 0;
    return (visitorsPerDay(S, sv) / OPEN_MINUTES) * (arrivalShape(S.minute) / SHAPE_MEAN);
  }

  /* What each visitor leaves behind beyond the ticket: postcards, a coffee,
     the occasional book nobody finishes. */
  function secondarySpend(S, sv) {
    const base = 0.8 + 2.2 * Math.min(1, Math.max(0, sv.rating) / 100);
    return base *
      softCap(S.mul.spend * (1 + S.add.spend), 2.4) *
      softCap(S.mul.dwell * (1 + S.add.dwell), 1.5);
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
    return { visitors: v, gate: v * S.admission, extra: v * secondarySpend(S, sv) };
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
    return "There is nothing else like it, because there is nowhere else like Site 7.";
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
    secondarySpend, perVisitor, standingIncome, projectedDay, incomeRate,
    stars, verdict, setsFor,
  };
})(window.S7 = window.S7 || {});
