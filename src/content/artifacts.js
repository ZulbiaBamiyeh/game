/* ============================================================================
   ARTIFACTS

   Turns a seed and a depth into a complete accession record: what it is, what
   it is made of, what shape it is in, what the field notes say about it, what
   it is worth to the museum, and what it teaches the crew.

   Nothing here is stored as a sprite. `sprite(a)` regenerates the art from
   a.seed on demand, which is why a save file is a few kilobytes.
   ============================================================================ */
(function (S7) {
  "use strict";
  const C = S7.cultures;

  /* ---------- condition ---------------------------------------------------
     Condition is the main lever on value, and the main thing a conservation
     bench buys you. */

  const CONDITIONS = [
    { id: "frag", n: "Fragmentary", mult: 0.55, w: 26, note: "Substantially incomplete." },
    { id: "poor", n: "Poor",        mult: 0.75, w: 24, note: "Stable but much reduced." },
    { id: "part", n: "Partial",     mult: 1.00, w: 22, note: "Recognisable, with losses." },
    { id: "sound", n: "Sound",      mult: 1.35, w: 18, note: "Complete or near enough." },
    { id: "fine", n: "Fine",        mult: 1.85, w: 8,  note: "Better than the context deserves." },
    { id: "excep", n: "Exceptional", mult: 2.60, w: 2, note: "One of the best of its kind anywhere." },
  ];

  const RARITIES = [
    { id: "common",   n: "Common",      mult: 1.00, w: 100, css: "r-common" },
    { id: "uncommon", n: "Uncommon",    mult: 1.45, w: 44,  css: "r-uncommon" },
    { id: "rare",     n: "Rare",        mult: 2.30, w: 16,  css: "r-rare" },
    { id: "signif",   n: "Significant", mult: 3.80, w: 5,   css: "r-signif" },
    { id: "unique",   n: "Unique",      mult: 6.50, w: 1,   css: "r-unique" },
  ];

  /* ---------- vocabulary --------------------------------------------------
     Object nouns are per-type, because "vessel" covers an amphora and a
     cooking pot and the label should not say "vessel" every time. */

  const OBJECT_NOUNS = {
    cap: ["Bottle cap, crown type", "Crown closure", "Cap, crimped"],
    console: ["Handheld console", "Electronic toy, portable", "Games device"],
    tag: ["Identification disc", "Collar tag, stamped", "Tag, punched"],
    key: ["Key, domestic", "Key, warded", "Key, single"],
    bottle: ["Bottle, glass", "Vessel, glass, patinated", "Phial"],
    coin: ["Coin, struck", "Issue, struck", "Currency piece"],
    needle: ["Needle, eyed", "Pin, shafted", "Awl"],
    nail: ["Nail, hand-forged", "Spike, wrought", "Fastener, square section"],
    buckle: ["Buckle, cast", "Belt fitting", "Buckle with tongue"],
    torc: ["Neck ring", "Torc, twisted", "Collar, penannular"],
    mirror: ["Mirror, polished", "Speculum", "Mirror with decorated reverse"],
    blade: ["Blade, tapering", "Knife", "Blade fragment, midribbed"],
    handaxe: ["Handaxe, bifacial", "Core tool", "Biface"],
    spearpoint: ["Point, pressure-flaked", "Spear point", "Projectile point"],
    sherd: ["Sherd, painted", "Pottery fragment", "Vessel fragment, banded"],
    vessel: ["Vessel, complete", "Jar, footed", "Storage vessel"],
    lamp: ["Lamp, spouted", "Lamp, fuelled", "Vessel lamp"],
    bonefrag: ["Bone, long, fragment", "Skeletal fragment", "Bone, worked?"],
    bead: ["Beads, strung", "Bead string", "Ornament, drilled"],
    figurine: ["Figure, seated", "Figurine, hands raised", "Anthropomorphic figure"],
    tablet: ["Tablet, inscribed", "Inscribed slab", "Text block"],
    seal: ["Seal, carved", "Stamp seal", "Seal with device"],
    blockStone: ["Block, dressed", "Marker, worked stone", "Ashlar fragment"],
    ledger: ["Ledger, partial", "Bound account book", "Register, water-damaged"],
    watch: ["Wristwatch", "Watch, mechanical"],
    marker: ["Survey marker", "Datum plate", "Benchmark, capped"],
    bell: ["Bell, cast", "Clapper bell", "Bell, small"],
    astrolabe: ["Astrolabe, planispheric", "Instrument, engraved", "Astrolabe plate"],
  };

  /* Fallback so a missing entry never breaks a run. */
  const nounFor = (type) => OBJECT_NOUNS[type] || ["Object, unidentified"];

  const QUALIFIERS = {
    frag: [", fragmentary", ", in pieces", ", one corner only"],
    poor: [", much reduced", ", surface lost", ", heavily degraded"],
    part: [", with losses", ", partial", ", incomplete"],
    sound: ["", "", ", complete"],
    fine: [", well preserved", ", fine condition", ""],
    excep: [", exceptional", ", complete and unworn", ""],
  };

  /* ---------- field notes -------------------------------------------------
     The voice of the survey. One line about the thing, one about the ground it
     came out of, and — deeper down — one the writer would rather not have
     had to put in the record. */

  const NOTE_KIND = {
    object: [
      "Recorded in situ before lifting. Nothing about the surrounding matrix is remarkable.",
      "Lifted whole. The soil came away cleanly, which usually means it was placed rather than dropped.",
      "One of a small scatter at this depth, all of a type, all facing the same way.",
      "The wear is consistent with use, and then it stops. Whatever ended its working life ended it abruptly.",
      "Tool marks survive across the whole surface without a break — one hand, one sitting.",
      "The manufacture is competent and unhurried. Somebody had time.",
    ],
    painting: [
      "Lifted on a plaster backing. The pigment is stable and has not been consolidated.",
      "The ground layer is intact beneath the losses, so the image can be read even where the paint has gone.",
      "Pigment analysis is pending. The binder appears to be organic and has not degraded as far as it should have.",
      "The composition runs off the edge on two sides. This was cut from something larger.",
      "There is an underdrawing visible in raking light. The finished image departs from it.",
      "The palette is limited to four pigments, all of them locally available, all of them ground fine.",
    ],
    sculpture: [
      "The breaks are old. It was already in this condition when it entered the deposit.",
      "Traces of paint survive in the undercuts. It was not meant to be seen as bare stone.",
      "Tool marks on the reverse are coarse. It was made to be viewed from one side only.",
      "The proportions are canonical to within a few millimetres. There was a rule and it was followed.",
      "Drill marks in the hair are the standard depth. Workshop production, not a single hand.",
      "The base was never finished. It was made to be set into something.",
    ],
  };

  const NOTE_EERIE = [
    /* 0 — ordinary */
    [
      "Filed without comment.",
      "Nothing in the context contradicts the attribution.",
      "Consistent with the rest of the horizon.",
    ],
    /* 1 — a detail that will not sit still */
    [
      "The horizon above this find is undisturbed. There is no mechanism by which it got here.",
      "It is nine hundred kilometres from anywhere this type has been recorded before.",
      "The layer it came out of is thirty centimetres thick and contains nothing else at all.",
      "There is a spiral incised on the underside. Eight turns, counterclockwise. I have started counting them.",
      "It was packed. Not buried — packed, in a void deliberately left for it.",
    ],
    /* 2 — the deposit stops being deniable */
    [
      "Sediment above shows no intrusion of any kind. This did not fall down a shaft. It was placed and then covered.",
      "The eight-turn spiral again, on the base, counterclockwise. That is eleven of them now.",
      "There is no decay. At this depth and this age there is no mechanism for there to be no decay.",
      "It was wrapped before burial, in something that has itself entirely gone, leaving the impression and nothing else.",
      "The crew have stopped asking me what the deep material is. I take that as a bad sign rather than a good one.",
      "Two of these were recovered within a metre, identical to tolerances I cannot measure in the field.",
    ],
    /* 3 — unattributed */
    [
      "There is no accepted context for this object. There is no unaccepted context for it either. I have left the field blank.",
      "The workmanship is excellent and belongs to no tradition in the literature. I have checked. I have had others check.",
      "It is not weathered. It has been in the ground for longer than the ground has been there and it is not weathered.",
      "The figures have their hands raised over their faces. They do on all of them. The faces are not modelled underneath.",
      "I have catalogued it as Group A on the basis that it resembles the other things I have catalogued as Group A.",
      "The material is not in the reference collection. It is not, as far as I can determine, in any reference collection.",
    ],
    /* 4 — the floor */
    [
      "The manufacture postdates the depth. Both measurements have been repeated. Neither has moved.",
      "It is stamped with an accession number in a hand I recognise, in a format this institute adopted last year.",
      "This is the fourth object recovered below the floor that could not have existed when it was buried.",
      "The number on the base is the next one in our sequence. We have not issued it yet.",
      "I am recording this and I am not going to interpret it.",
    ],
  ];

  const NOTE_MATERIAL = {
    metal: ["The corrosion product is stable and has not been removed.",
            "Sound metal survives beneath the surface layer.",
            "Cast in one piece and finished by hand; the seam has been filed away."],
    stone: ["The stone is not local. The nearest source is a long way from here.",
            "Ground and polished on every face, including the ones nobody would see.",
            "There is a natural flaw through the middle that the carver has worked around."],
    organic: ["Survival at this depth is exceptional and I do not have an explanation for it.",
              "The surface is porous and has taken up salts from the surrounding fill.",
              "Cut marks near one end. Working, not butchery."],
    ceramic: ["Evenly fired throughout, which takes a controlled kiln.",
              "The fabric contains a temper I do not recognise.",
              "Wheel-thrown, walls under four millimetres. Confident work."],
    other: ["Retained for further analysis.",
            "Photographed and recorded before lifting.",
            "Catalogued from the field. The full record will follow."],
  };

  const MATERIAL_FAMILY = {
    bronze: "metal", brass: "metal", iron: "metal", steel: "metal", silver: "metal",
    gold: "metal", alum: "metal", rust: "metal",
    stone: "stone", granite: "stone", basalt: "stone", marble: "stone", obsid: "stone",
    chalk: "stone", ice: "stone",
    bone: "organic", leather: "organic", wood: "organic", paper: "organic",
    clay: "ceramic", sand: "ceramic", celadon: "ceramic", glass: "ceramic",
  };

  const MATERIAL_LABEL = {
    bronze: "Bronze, cast", brass: "Brass", iron: "Wrought iron", steel: "Steel",
    silver: "Silver, struck", gold: "Gold", alum: "Aluminium alloy", rust: "Ferrous, corroded",
    stone: "Stone, worked", granite: "Granite", basalt: "Basalt", marble: "Marble",
    obsid: "Obsidian", chalk: "Limestone", ice: "Material undetermined",
    bone: "Bone", leather: "Leather and paper", wood: "Timber", paper: "Paper",
    clay: "Fired clay", sand: "Fired clay, buff", celadon: "Glazed ceramic", glass: "Glass",
    plastic: "Moulded polymer", lcd: "Glass and polymer", timber: "Timber",
  };

  /* ---------- interpretation ---------------------------------------------
     Three readings, one right. Filing early is worth more, and being wrong is
     recorded either way. */

  const READINGS = {
    object: [
      ["Domestic, in everyday use", "Ritual deposit, placed deliberately", "Trade good, in transit",
       "Manufacturing waste, discarded", "Personal ornament", "Structural fitting"],
    ],
    painting: [
      ["Devotional image, for display", "Funerary, for a closed chamber", "Decorative scheme, domestic",
       "Instructional or record-keeping", "Workshop trial piece", "Commissioned portrait"],
    ],
    sculpture: [
      ["Cult image, publicly sited", "Grave good, interred with a body", "Architectural element",
       "Votive offering, mass produced", "Portrait of an individual", "Apotropaic figure"],
    ],
  };

  /* ---------- assembly ---------------------------------------------------- */

  function pickCulture(rng, depth) {
    const era = C.eraAt(depth);
    const ids = era.cultures;
    /* Bias toward the first culture listed, so each band has a dominant one. */
    const idx = Math.min(ids.length - 1, Math.floor(Math.pow(rng.f(), 1.5) * ids.length));
    return C.byId[ids[idx]];
  }

  function pickKind(rng, culture) {
    const opts = [{ k: "object", w: 58 }];
    if (culture.painting) opts.push({ k: "painting", w: 22 });
    if (culture.sculpture) opts.push({ k: "sculpture", w: 20 });
    return rng.weighted(opts, (o) => o.w).k;
  }

  function rollWeighted(rng, table, bonusLast) {
    const w = table.map((t, i) => t.w * (i >= table.length - 2 ? 1 + (bonusLast || 0) * 8 : 1));
    let total = w.reduce((a, b) => a + b, 0), t = rng.f() * total;
    for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return table[i]; }
    return table[0];
  }

  function materialOf(rng, kind, culture, objectType) {
    if (kind === "sculpture") return rng.pick(culture.sculpture.materials);
    if (kind === "painting") return "paper";
    const guess = {
      coin: ["silver", "gold", "bronze", "brass"], blade: ["bronze", "iron", "steel", "obsid"],
      vessel: ["clay", "sand", "celadon", "stone"], sherd: ["clay", "sand", "stone"],
      bead: ["stone", "bone", "glass", "gold"], torc: ["gold", "bronze", "silver"],
      mirror: ["bronze", "silver", "obsid"], handaxe: ["obsid", "granite", "basalt", "stone"],
      spearpoint: ["obsid", "stone", "bone", "bronze"], tablet: ["clay", "stone", "sand"],
      seal: ["stone", "bone", "obsid", "celadon"], blockStone: ["stone", "granite", "chalk", "basalt"],
      lamp: ["clay", "bronze", "stone"], needle: ["bone", "bronze", "iron"],
      buckle: ["bronze", "brass", "iron", "silver"], key: ["brass", "steel", "iron"],
      tag: ["alum", "brass", "steel"], cap: ["rust", "steel", "alum"],
      bonefrag: ["bone"], bottle: ["glass"], nail: ["rust"], console: ["plastic"],
      ledger: ["leather"], watch: ["steel"], marker: ["brass"], figurine: ["clay", "stone", "bone", "sand"],
      bell: ["bronze", "brass"], astrolabe: ["brass", "bronze"],
    }[objectType];
    return guess ? rng.pick(guess) : "stone";
  }

  function buildNotes(rng, a, culture) {
    const lines = [];
    lines.push(rng.pick(NOTE_KIND[a.kind]));
    const fam = MATERIAL_FAMILY[a.material] || "other";
    if (rng.chance(0.7)) lines.push(rng.pick(NOTE_MATERIAL[fam]));
    /* The strangeness is not uniform: deep finds almost always carry a line,
       shallow ones almost never do. */
    const tier = culture.eerie;
    const p = tier === 0 ? 0.10 : tier === 1 ? 0.55 : 0.92;
    if (rng.chance(p)) lines.push(rng.pick(NOTE_EERIE[tier]));
    else if (tier === 0) lines.push(rng.pick(NOTE_EERIE[0]));
    return lines.join(" ");
  }

  function buildName(rng, a, culture) {
    const q = rng.pick(QUALIFIERS[a.condition.id]);
    if (a.kind === "object") return rng.pick(nounFor(a.objectType)) + q;
    if (a.kind === "painting") return culture.paintNoun + q;
    return culture.sculptNoun + q;
  }

  function buildReadings(rng, a) {
    const pool = READINGS[a.kind][0];
    const three = rng.sample(pool, 3);
    const correct = rng.int(0, 2);
    return three.map((t, i) => ({ t, ok: i === correct }));
  }

  /* The whole record. `depth` in metres, `seed` any 32-bit integer.

     Every roll below happens in the same order on every call, and overrides are
     applied *after* the roll rather than instead of it. That is load-bearing:
     a save pins the culture, kind, condition and rarity, and if pinning one of
     them skipped a draw, every later draw would shift and the artifact would
     come back with a different name and different field notes. */
  function makeArtifact(seed, depth, opts) {
    opts = opts || {};
    const rng = S7.rng(seed);

    const rolledCulture = pickCulture(rng, depth);
    const culture = opts.culture ? (C.byId[opts.culture] || rolledCulture) : rolledCulture;

    const rolledKind = pickKind(rng, culture);
    const kind = opts.kind || rolledKind;

    const rolledObject = rng.pick(culture.objects);
    const objectType = kind === "object" ? (opts.objectType || rolledObject) : null;

    const rolledCond = rollWeighted(rng, CONDITIONS, opts.condBonus || 0);
    const condition = opts.condition
      ? (CONDITIONS.find((c) => c.id === opts.condition) || rolledCond) : rolledCond;

    const rolledRare = rollWeighted(rng, RARITIES, opts.rareBonus || 0);
    const rarity = opts.rarity
      ? (RARITIES.find((r) => r.id === opts.rarity) || rolledRare) : rolledRare;

    const material = materialOf(rng, kind, culture, objectType);

    const a = {
      seed: seed >>> 0,
      depth: Math.round(depth * 10) / 10,
      cultureId: culture.id,
      kind, objectType, material,
      condition, rarity,
      no: opts.no || "000",
      keystone: !!opts.keystone,
    };
    const rolledName = buildName(rng, a, culture);
    const rolledNotes = buildNotes(rng, a, culture);
    a.name = opts.name || rolledName;
    a.notes = opts.notes || rolledNotes;
    a.readings = buildReadings(rng, a);

    /* Significance drives everything the museum pays for. */
    const kindWeight = kind === "painting" ? 1.35 : kind === "sculpture" ? 1.55 : 1.0;
    a.significance = Math.round(
      (6 + depth * 0.055) * kindWeight * condition.mult * rarity.mult * 10) / 10;

    /* The upgrade this piece teaches. Rolled here so it can be shown before
       the player commits to accessioning it. */
    a.boon = S7.boons.roll(rng, a);
    return a;
  }

  /* ---------- art dispatch ------------------------------------------------ */

  const spriteCache = new Map();

  function spriteFor(a) {
    const key = a.seed + ":" + a.kind + ":" + (a.objectType || "") + ":" + a.cultureId;
    let c = spriteCache.get(key);
    if (c) return c;
    const culture = C.byId[a.cultureId];
    /* Art uses its own stream so changing the text tables never changes a
       sprite the player has already seen. */
    const rng = S7.rng((a.seed ^ 0x9e3779b9) >>> 0);
    let B;
    if (a.kind === "painting") B = S7.paintings.paint(rng, culture.painting);
    else if (a.kind === "sculpture") B = S7.sculptures.carve(rng, culture.sculpture);
    else B = S7.objects.make(rng, { object: a.objectType });
    c = S7.raster.bake(B);
    if (spriteCache.size > 400) spriteCache.clear();
    spriteCache.set(key, c);
    return c;
  }

  const thumbCache = new Map();
  function thumbFor(a, size) {
    const key = a.seed + ":" + size;
    let t = thumbCache.get(key);
    if (t) return t;
    t = S7.raster.thumb(spriteFor(a), size);
    if (thumbCache.size > 400) thumbCache.clear();
    thumbCache.set(key, t);
    return t;
  }

  const materialLabel = (m) => MATERIAL_LABEL[m] || "Undetermined";

  S7.artifacts = {
    CONDITIONS, RARITIES, makeArtifact, spriteFor, thumbFor, materialLabel,
    OBJECT_NOUNS,
  };
})(window.S7 = window.S7 || {});
