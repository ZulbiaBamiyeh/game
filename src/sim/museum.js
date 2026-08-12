/* ============================================================================
   THE MUSEUM

   The economic engine. Nothing is sold — money arrives because people come to
   look, and people come because the collection is worth looking at.

       significance  ->  renown  ->  visitors  ->  spend  ->  funding

   Renown is unbounded and drives income. Rating is renown squashed into 0–100
   for the sign over the door, because "★ 0.4" reads better than "renown 4.7".
   ============================================================================ */
(function (S7) {
  "use strict";

  /* Soft cap: behaves like x while x is small, and can never exceed k.
     Facilities multiply the collection's pull; they do not replace it. A museum
     with a superb café and three sherds is still a museum with three sherds,
     and without this the fourteen facility lines multiply into each other and
     income leaves the screen inside half an hour. */
  const softCap = (x, k) => (k * x) / (k + x - 1);

  const displayed = (S) => S.collection.filter((a) => a.display !== false);

  const capacity = (S) => 6 + S.bonus.capacity;

  /* One pass over the collection produces everything the museum panel needs. */
  function survey(S) {
    const shown = displayed(S);
    let sig = 0;
    const cultures = new Set(), kinds = new Set(), eras = new Set();
    let best = null;
    for (const a of shown) {
      sig += a.significance;
      cultures.add(a.cultureId);
      kinds.add(a.kind + (a.objectType || ""));
      eras.add(S7.cultures.eraAt(a.depth).id);
      if (!best || a.significance > best.significance) best = a;
    }
    const cap = capacity(S);
    /* Overhang: things stacked in the corridor still count, but less. */
    const crowd = shown.length > cap ? Math.pow(cap / shown.length, 0.55) : 1;

    /* Breadth is what stops the optimal play being forty of the same sherd. */
    const breadthFactor = S.research.duplicate
      ? 1 + cultures.size * 0.14
      : 1 + cultures.size * 0.12;
    const varietyFactor = 1 + kinds.size * 0.05 + eras.size * 0.06;

    const renown = shown.length
      ? Math.pow(sig, 0.62) * breadthFactor * varietyFactor *
        softCap(S.mul.rating * (1 + S.add.rating), 25) * crowd
      : 0;

    return {
      shown, count: shown.length, sig, cap, crowd, best,
      cultures: cultures.size, kinds: kinds.size, eras: eras.size,
      renown,
      rating: 100 * renown / (renown + 6000),
    };
  }

  const visitorsPerMin = (S, sv) =>
    sv.renown > 0
      ? (0.4 + sv.renown * 1.1) * softCap(S.mul.visitors * (1 + S.add.visitors), 40)
      : 0;

  const spendPerVisitor = (S, sv) =>
    (1.1 + 0.04 * Math.sqrt(Math.max(0, sv.sig))) *
    softCap(S.mul.spend * (1 + S.add.spend), 20) *
    softCap(S.mul.dwell * (1 + S.add.dwell), 6);

  /* Funding per second: gate money plus the grant that keeps the lights on
     before the museum works at all. */
  function income(S, sv) {
    const gate = (visitorsPerMin(S, sv) / 60) * spendPerVisitor(S, sv);
    return gate + S7.state.grantRate(S) + S.bonus.flatIncome;
  }

  const stars = (rating) => rating / 20;

  /* A short verdict for the museum header. Deliberately unkind at the start. */
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

  /* Culture set completion — the long-tail collection goal. A set is complete
     when you hold every kind that culture can produce. */
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
    displayed, capacity, survey, visitorsPerMin, spendPerVisitor, income,
    stars, verdict, setsFor, softCap,
  };
})(window.S7 = window.S7 || {});
