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
    { id: "frag", n: "In pieces",   mult: 0.55, w: 26, note: "Only parts of it are left." },
    { id: "poor", n: "Worn",        mult: 0.75, w: 24, note: "Holds together, but a lot is missing." },
    { id: "part", n: "Incomplete",  mult: 1.00, w: 22, note: "You can still tell what it is." },
    { id: "sound", n: "Good",       mult: 1.35, w: 18, note: "Whole, or near enough." },
    { id: "fine", n: "Excellent",   mult: 1.85, w: 8,  note: "Surprisingly well kept for where it was found." },
    { id: "excep", n: "Exceptional", mult: 2.60, w: 2, note: "One of the best of its kind you are likely to see." },
  ];

  const RARITIES = [
    { id: "common",   n: "Common",      mult: 1.00, w: 100, css: "r-common" },
    { id: "uncommon", n: "Uncommon",    mult: 1.45, w: 44,  css: "r-uncommon" },
    { id: "rare",     n: "Rare",        mult: 2.30, w: 16,  css: "r-rare" },
    { id: "signif",   n: "Important",   mult: 3.80, w: 5,   css: "r-signif" },
    { id: "unique",   n: "One of a kind", mult: 6.50, w: 1, css: "r-unique" },
  ];

  /* ---------- vocabulary --------------------------------------------------
     Plain names a visitor could read off a label. Condition is shown next to
     the name, so it does not need to be baked into the title. */

  const OBJECT_NOUNS = {
    cap: ["Bottle cap", "Crown bottle top", "Metal bottle cap"],
    console: ["Handheld games console", "Pocket games device", "Electronic toy"],
    tag: ["ID tag", "Stamped metal tag", "Collar tag"],
    key: ["House key", "Old iron key", "Door key"],
    bottle: ["Glass bottle", "Small glass flask", "Clear glass bottle"],
    coin: ["Coin", "Struck coin", "Small coin"],
    needle: ["Sewing needle", "Bone needle", "Awl"],
    nail: ["Hand-forged nail", "Iron nail", "Square nail"],
    buckle: ["Belt buckle", "Cast buckle", "Buckle with pin"],
    torc: ["Neck ring", "Twisted metal collar", "Open neck ring"],
    mirror: ["Hand mirror", "Polished metal mirror", "Decorated mirror"],
    blade: ["Knife blade", "Small knife", "Tapered blade"],
    handaxe: ["Stone handaxe", "Flaked stone tool", "Bifacial handaxe"],
    spearpoint: ["Spear point", "Flaked stone point", "Projectile point"],
    sherd: ["Painted potsherd", "Broken pottery", "Pottery fragment"],
    vessel: ["Storage jar", "Clay pot", "Footed jar"],
    lamp: ["Oil lamp", "Spouted lamp", "Clay lamp"],
    bonefrag: ["Worked bone", "Long bone fragment", "Bone piece"],
    bead: ["String of beads", "Drilled beads", "Bead necklace"],
    figurine: ["Small figurine", "Seated figure", "Clay figure"],
    tablet: ["Inscribed tablet", "Clay tablet", "Writing tablet"],
    seal: ["Carved seal", "Stamp seal", "Seal stone"],
    blockStone: ["Dressed stone block", "Worked stone", "Cut stone marker"],
    ledger: ["Account book", "Bound ledger", "Water-damaged register"],
    watch: ["Wristwatch", "Mechanical watch"],
    marker: ["Survey marker", "Datum plate", "Benchmark plate"],
    bell: ["Small bell", "Cast bell", "Hand bell"],
    astrolabe: ["Astrolabe", "Engraved instrument", "Brass astrolabe"],
    /* Egypt */
    scarab: ["Scarab seal", "Carved scarab", "Heart scarab"],
    canopic: ["Canopic jar", "Organ jar", "Canopic vessel"],
    ankh: ["Ankh amulet", "Symbol of life", "Gold ankh"],
    ushabti: ["Ushabti figure", "Servant figure", "Faience ushabti"],
    pectoral: ["Broad collar", "Pectoral ornament", "Beaded pectoral"],
    /* Dinosaurs */
    dinoTooth: ["Dinosaur tooth", "Serrated predator tooth", "Fossil tooth"],
    dinoBone: ["Dinosaur limb bone", "Fossil long bone", "Hollow limb bone"],
    dinoFemur: ["Dinosaur femur", "Massive femur", "Hindlimb femur"],
    dinoTibia: ["Dinosaur tibia", "Lower leg bone", "Tibia"],
    dinoHumerus: ["Dinosaur humerus", "Forelimb bone", "Humerus"],
    dinoJaw: ["Dinosaur jaw", "Dentary", "Lower jaw"],
    dinoVert: ["Dinosaur vertebra", "Caudal vertebra", "Dorsal vertebra"],
    dinoRib: ["Dinosaur rib", "Curved rib", "Rib element"],
    dinoPelvis: ["Dinosaur pelvis", "Hip girdle", "Pelvic block"],
    dinoTail: ["Tail vertebrae", "Caudal series", "Tail section"],
    dinoClaw: ["Dinosaur claw", "Raptorial claw", "Pedal claw"],
    eggFossil: ["Dinosaur egg", "Fossil egg clutch piece", "Mineralised egg"],
    trackSlab: ["Footprint slab", "Trackway block", "Three-toed print"],
    /* Fossils */
    ammonite: ["Ammonite", "Spiral ammonite", "Pyritised ammonite"],
    trilobite: ["Trilobite", "Complete trilobite", "Enrolled trilobite"],
    fernFossil: ["Fern fossil", "Carbonised fern", "Leaf impression"],
    crinoid: ["Crinoid stem", "Sea lily fossil", "Crinoid calyx"],
    fishFossil: ["Fossil fish", "Fish on slab", "Complete fish fossil"],
    coralFossil: ["Fossil coral", "Colonial coral", "Rugose coral"],
    /* Minerals */
    geode: ["Crystal geode", "Amethyst geode half", "Lined geode"],
    crystal: ["Crystal cluster", "Mineral crystal", "Terminated crystal"],
    goldNugget: ["Gold nugget", "Native gold", "River gold"],
    meteorite: ["Meteorite", "Iron meteorite", "Stony meteorite"],
    opal: ["Opal", "Precious opal", "Play-of-colour opal"],
    pyrite: ["Pyrite cube", "Fool's gold", "Cubic pyrite"],
    fluorite: ["Fluorite", "Fluorite octahedra", "Banded fluorite"],
  };

  /* Fallback so a missing entry never breaks a run. */
  const nounFor = (type) => OBJECT_NOUNS[type] || ["Unidentified object"];

  /* Light touch only — most of the time the bare noun is enough. */
  const QUALIFIERS = {
    frag: ["", " (fragment)", " (broken)"],
    poor: ["", " (worn)", ""],
    part: ["", "", " (incomplete)"],
    sound: ["", "", ""],
    fine: ["", "", ""],
    excep: ["", "", ""],
  };

  /* ---------- field notes -------------------------------------------------
     Short, plain sentences. Written the way someone would actually describe
     a find to a colleague, not to a catalogue card. */

  const NOTE_KIND = {
    object: [
      "Found in place and lifted carefully.",
      "Came out of clean ground in one piece.",
      "One of several similar finds from this level.",
      "Shows the ordinary wear of having been used.",
      "No maker's mark, but clearly made with care.",
      "A common type — there are others like it here.",
    ],
    painting: [
      "The paint is stable. The image is still easy to read.",
      "Some paint has gone, but the picture underneath still holds together.",
      "The colours look local, ground fine, and carefully laid on.",
      "The picture is cut off at two edges — this was part of something larger.",
      "You can just make out a sketch under the finished paint.",
      "Only a few colours were used, all of them available nearby.",
    ],
    sculpture: [
      "The breaks are old. It went into the ground already like this.",
      "A little paint still hides in the crevices — it was meant to be coloured.",
      "The back is rough. It was only meant to be seen from the front.",
      "The proportions are careful and regular. Someone was following a rule.",
      "The detail is clean and even — workshop work, not a one-off.",
      "The base was left unfinished. It was meant to sit in a socket.",
    ],
  };

  const NOTE_GALLERY = {
    egypt: [
      "The work is pure Nile — somebody wanted this tradition complete.",
      "Packed with care, the way a tomb kit is packed.",
    ],
    dinosaurs: [
      "Bone mineralised through. It has no business sitting in a human deposit.",
      "A showpiece. Whoever placed it knew what a museum would do with it.",
    ],
    fossils: [
      "A slab that would stop a gallery queue. Deep time, carefully boxed.",
      "The matrix is wrong for this depth. The specimen is not.",
    ],
    minerals: [
      "Still sharp in the crystal faces. It was never rolled in a river.",
      "A cabinet specimen, not a chance pebble.",
    ],
  };

  const NOTE_EERIE = [
    /* 0 — ordinary */
    [
      "Nothing else of note.",
      "An ordinary find, in the best sense.",
      "Fits well with everything else from this depth.",
    ],
    /* 1 — a detail that will not sit still */
    [
      "The ground above it is undisturbed. There is no obvious way it got here.",
      "This type is usually found hundreds of kilometres away.",
      "The layer around it is empty — thirty centimetres of fill and nothing else.",
      "There is a spiral scratched on the underside: eight turns, anti-clockwise.",
      "It was not just buried. It was packed into a space left open for it.",
    ],
    /* 2 — the deposit stops being deniable */
    [
      "Nothing has cut through the ground above. It was put here, then covered.",
      "Another eight-turn spiral on the base. That is eleven of them so far.",
      "It should have decayed at this age and depth. It has not.",
      "It was wrapped before burial. The wrapping is gone; the shape of it remains.",
      "The crew have stopped asking what the deep material is. That is not a good sign.",
      "Two of these came up within a metre of each other, almost identical.",
    ],
    /* 3 — unattributed */
    [
      "There is no accepted home for this object, and no rejected one either.",
      "Beautifully made, and not like anything in the books. I have checked twice.",
      "It has been in the ground longer than the ground has been here, and it is not weathered.",
      "The figures cover their faces with their hands. The faces underneath are blank.",
      "I have labelled it Group A because it looks like the other Group A things.",
      "The material is not in our reference set, or anyone else's that I can find.",
    ],
    /* 4 — the floor */
    [
      "It was made after the depth says it was buried. We measured both again.",
      "It carries an accession number in our own handwriting, from last year's format.",
      "This is the fourth thing from below the floor that could not have existed when it was buried.",
      "The number on the base is the next one in our sequence. We have not issued it yet.",
      "I am writing this down. I am not going to explain it.",
    ],
  ];

  const NOTE_MATERIAL = {
    metal: ["The surface corrosion is stable and we have left it on.",
            "Clean metal still sits under the outer layer.",
            "Cast in one piece and finished by hand."],
    stone: ["The stone is not from around here.",
            "Every face is ground smooth, even the ones you would never see.",
            "There is a natural crack the carver worked around."],
    organic: ["It should not have survived this deep, and yet it has.",
              "The surface is porous and has taken on salts from the fill.",
              "Cut marks near one end look like working, not butchery."],
    ceramic: ["Evenly fired all the way through — a careful kiln.",
              "The clay mix has grit in it that I do not recognise.",
              "Thrown on a wheel, with walls only a few millimetres thick."],
    pigment: ["We have not yet identified what holds the paint together.",
              "The paint sits straight on the ground with nothing underneath.",
              "Painted wet-into-wet — finished in one go.",
              "The support is sound. Nothing has needed patching."],
    synthetic: ["The plastic has kept its shape well.",
                "Moulding seams are still visible on the case.",
                "The colour has barely faded."],
    other: ["Good enough to show as found.",
            "Nothing unusual about the material.",
            "A straightforward piece to write up."],
  };

  /* What a painting is actually on. "Paper" for a Roman fresco and a Song
     scroll alike was wrong on the label and, worse, pulled the note pool for
     organic finds — which is how a framed print ended up described as having
     butchery marks near one end. */
  const PAINTING_SUPPORT = {
    modern: "canvas", victorian: "canvas", anachronic: "canvas",
    renaissance: "panel", byzantine: "panel",
    ukiyoe: "printpaper", maya: "barkpaper", miniature: "vellum",
    song: "silk", norse: "plank", islamic: "tile", greek: "vasefabric",
    roman: "plaster", egyptian: "plaster", minoan: "plaster", neolithic: "plaster",
    palaeo: "rockface", neander: "rockface", unattributed: "unknownpig",
  };

  const MATERIAL_FAMILY = {
    bronze: "metal", brass: "metal", iron: "metal", steel: "metal", silver: "metal",
    gold: "metal", alum: "metal", rust: "metal",
    stone: "stone", granite: "stone", basalt: "stone", marble: "stone", obsid: "stone",
    chalk: "stone", ice: "stone",
    bone: "organic", leather: "organic", wood: "organic", paper: "organic",
    clay: "ceramic", sand: "ceramic", celadon: "ceramic", glass: "ceramic",
    canvas: "pigment", panel: "pigment", printpaper: "pigment", barkpaper: "pigment",
    vellum: "pigment", silk: "pigment", plank: "pigment", plaster: "pigment",
    rockface: "pigment", unknownpig: "pigment", tile: "ceramic", vasefabric: "ceramic",
    plastic: "synthetic", lcd: "synthetic",
  };

  const MATERIAL_LABEL = {
    bronze: "Cast bronze", brass: "Brass", iron: "Wrought iron", steel: "Steel",
    silver: "Silver", gold: "Gold", alum: "Aluminium", rust: "Corroded iron",
    stone: "Worked stone", granite: "Granite", basalt: "Basalt", marble: "Marble",
    obsid: "Obsidian", chalk: "Limestone", ice: "Unknown material",
    bone: "Bone", leather: "Leather and paper", wood: "Wood", paper: "Paper",
    clay: "Fired clay", sand: "Buff clay", celadon: "Glazed ceramic", glass: "Glass",
    plastic: "Plastic", lcd: "Glass and plastic", timber: "Wood",
    canvas: "Oil on canvas", panel: "Paint on wood panel",
    printpaper: "Print on paper", barkpaper: "Paint on bark paper",
    vellum: "Paint and gold on vellum", silk: "Ink on silk",
    plank: "Paint on wood", plaster: "Paint on plaster",
    rockface: "Paint on rock", unknownpig: "Paint, binder unknown",
    tile: "Glazed tile", vasefabric: "Painted pottery",
  };

  /* ---------- interpretation ---------------------------------------------
     Three readings, one right. Filing early is worth more, and being wrong is
     recorded either way. Plain wording — these are choices the player reads
     mid-dig, not catalogue entries. */

  const READINGS = {
    object: [
      ["Used every day at home", "Left as an offering on purpose", "A trade good, still moving",
       "Workshop scrap, thrown away", "Personal ornament", "Part of a building or fitting"],
    ],
    painting: [
      ["Made for worship and display", "Made for a tomb or closed room", "Decoration for a house",
       "A teaching or record picture", "A workshop practice piece", "A commissioned portrait"],
    ],
    sculpture: [
      ["A public religious image", "Buried with someone", "Part of a building",
       "A mass-produced offering", "A portrait of a real person", "A protective figure"],
    ],
  };

  /* ---------- assembly ---------------------------------------------------- */

  function pickCulture(rng, depth) {
    const era = C.eraAt(depth);
    const ids = era.cultures;
    if (ids.length === 1) return C.byId[ids[0]];

    /* Position inside the band: 0 at the top, 1 at the bottom. */
    const ei = C.eraIndex(depth);
    const from = ei <= 0 ? 0 : C.ERAS[ei - 1].to;
    const span = Math.max(1, era.to >= 1e8 ? C.MAX_DEPTH - from : era.to - from);
    const pos = Math.max(0, Math.min(1, (depth - from) / span));

    /* Geological bands list youngest first — deeper in the band → older taxa.
       Human bands keep a mild first-culture bias with real scatter. */
    const geological = !!(era.id === "mesozoic" || era.id === "fossils" || era.id === "minerals");
    let idx;
    if (geological) {
      /* Blend depth position with noise so the floor of the band is older. */
      const u = Math.min(0.999, Math.max(0, pos * 0.75 + rng.f() * 0.35));
      idx = Math.min(ids.length - 1, Math.floor(u * ids.length));
    } else {
      idx = Math.min(ids.length - 1, Math.floor(Math.pow(rng.f(), 1.15) * ids.length));
    }
    return C.byId[ids[idx]];
  }

  function pickKind(rng, culture, depth) {
    const deep = depth / C.MAX_DEPTH;
    const opts = [{ k: "object", w: 58 }];
    if (culture.painting) opts.push({ k: "painting", w: 22 });
    if (culture.sculpture) opts.push({ k: "sculpture", w: 20 });
    /* Minerals and fossils are mostly specimens, not pictures. */
    if (culture.gallery === "minerals" || culture.gallery === "fossils")
      return rng.weighted([
        { k: "object", w: 78 },
        { k: "sculpture", w: culture.sculpture ? 18 + deep * 20 : 0 },
      ], (o) => o.w).k;
    if (culture.gallery === "dinosaurs")
      return rng.weighted([
        { k: "object", w: 55 },
        { k: "sculpture", w: culture.sculpture ? 30 + deep * 35 : 0 },
      ], (o) => o.w).k;
    return rng.weighted(opts, (o) => o.w).k;
  }

  /* How hard the deep end of the rarity table is pushed. Near the surface this
     is almost nothing; by the floor uniques are realistic. */
  function depthRarityBonus(depth) {
    const t = Math.max(0, Math.min(1.15, depth / C.MAX_DEPTH));
    return Math.pow(t, 1.25) * 0.62;
  }

  function rollWeighted(rng, table, bonusLast) {
    const w = table.map((t, i) => {
      /* Lift the rare end of the table; higher tiers feel depth more. */
      const tier = i / Math.max(1, table.length - 1);
      const lift = 1 + (bonusLast || 0) * (2 + tier * 10);
      return t.w * lift;
    });
    let total = w.reduce((a, b) => a + b, 0), t = rng.f() * total;
    for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return table[i]; }
    return table[0];
  }

  /* Showpiece object types — more likely deeper, so a skull or geode is a
     reward for staying in the hole, not a surface lottery ticket. */
  const SHOWPIECE = {
    egypt: ["canopic", "pectoral", "ankh", "scarab"],
    dinosaurs: ["dinoBone", "eggFossil", "trackSlab", "dinoTooth", "dinoClaw"],
    fossils: ["fishFossil", "ammonite", "trilobite", "fernFossil"],
    minerals: ["geode", "meteorite", "crystal", "goldNugget", "opal"],
  };

  function pickObjectType(rng, culture, depth) {
    const objs = culture.objects;
    if (!objs || !objs.length) return null;
    const deep = depth / C.MAX_DEPTH;
    const pool = SHOWPIECE[culture.gallery];
    if (pool && deep > 0.35 && rng.chance(0.12 + deep * 0.45)) {
      const hits = objs.filter((o) => pool.indexOf(o) >= 0);
      if (hits.length) return rng.pick(hits);
    }
    return objs[Math.floor(Math.pow(rng.f(), 0.85) * objs.length)];
  }

  function materialOf(rng, kind, culture, objectType) {
    if (kind === "sculpture") return rng.pick(culture.sculpture.materials);
    if (kind === "painting")
      return PAINTING_SUPPORT[(culture.painting || {}).painter] || "panel";
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
      scarab: ["stone", "gold", "celadon", "obsid"], canopic: ["stone", "sand", "clay", "celadon"],
      ankh: ["gold", "bronze", "stone"], ushabti: ["celadon", "sand", "stone", "clay"],
      pectoral: ["gold", "stone", "glass"],
      dinoTooth: ["bone"], dinoBone: ["bone"], dinoClaw: ["bone"],
      dinoFemur: ["bone"], dinoTibia: ["bone"], dinoHumerus: ["bone"], dinoJaw: ["bone"],
      dinoVert: ["bone"], dinoRib: ["bone"], dinoPelvis: ["bone"], dinoTail: ["bone"],
      eggFossil: ["stone", "chalk", "sand"], trackSlab: ["stone", "sand", "chalk"],
      ammonite: ["stone", "chalk", "gold"], trilobite: ["stone", "chalk"], fernFossil: ["stone", "chalk", "sand"],
      crinoid: ["stone", "chalk"], fishFossil: ["stone", "chalk"], coralFossil: ["stone", "chalk", "sand"],
      geode: ["stone", "basalt", "chalk"], crystal: ["obsid", "gold", "stone"], goldNugget: ["gold"],
      meteorite: ["iron", "stone", "obsid"], opal: ["stone"], pyrite: ["gold"], fluorite: ["stone", "obsid"],
    }[objectType];
    return guess ? rng.pick(guess) : "stone";
  }

  function buildNotes(rng, a, culture) {
    const lines = [];
    lines.push(rng.pick(NOTE_KIND[a.kind] || NOTE_KIND.object));
    const fam = MATERIAL_FAMILY[a.material] || "other";
    if (rng.chance(0.7)) lines.push(rng.pick(NOTE_MATERIAL[fam] || NOTE_MATERIAL.other));
    if (culture.gallery && NOTE_GALLERY[culture.gallery] && rng.chance(0.55))
      lines.push(rng.pick(NOTE_GALLERY[culture.gallery]));
    /* The strangeness is not uniform: deep finds almost always carry a line,
       shallow ones almost never do. */
    const tier = culture.eerie;
    const p = tier === 0 ? 0.10 : tier === 1 ? 0.55 : 0.92;
    if (rng.chance(p)) lines.push(rng.pick(NOTE_EERIE[tier] || NOTE_EERIE[0]));
    else if (tier === 0) lines.push(rng.pick(NOTE_EERIE[0]));
    return lines.join(" ");
  }

  function buildName(rng, a, culture) {
    /* Condition is shown as its own field; only a light qualifier, and often
       none, so titles stay readable on the wall label. */
    const q = rng.pick(QUALIFIERS[a.condition.id] || [""]);
    if (a.kind === "object") return rng.pick(nounFor(a.objectType)) + q;
    if (a.kind === "painting") return (culture.paintNoun || "Painting") + q;
    return (culture.sculptNoun || "Sculpture") + q;
  }

  /* One short line for the caption strip: what it is, in human words. */
  function blurb(a) {
    const mat = materialLabel(a.material);
    if (a.kind === "painting") return "A painting on " + mat.toLowerCase().replace(/^paint on /, "") + ".";
    if (a.kind === "sculpture") return "A sculpture in " + mat.toLowerCase() + ".";
    return mat + ".";
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

    /* Dinosaur finds are mostly skeleton elements — bone by bone — so the hall
       can be assembled. Occasional eggs/tracks remain as free finds. */
    let skeletonRoll = null;
    if (!opts.keystone && culture.gallery === "dinosaurs" && S7.skeletons && rng.chance(0.88)) {
      skeletonRoll = S7.skeletons.rollPart(rng, culture.id, opts.heldSkeletons || null);
    }

    let kind, objectType, skeletonId, skeletonPart, skPartDef;
    if (skeletonRoll && !opts.kind && !opts.objectType) {
      skPartDef = skeletonRoll.part;
      skeletonId = skeletonRoll.kit.id;
      skeletonPart = skeletonRoll.partId;
      kind = skPartDef.kind;
      objectType = skPartDef.objectType || null;
    } else {
      const rolledKind = pickKind(rng, culture, depth);
      kind = opts.kind || rolledKind;
      const rolledObject = kind === "object" ? pickObjectType(rng, culture, depth) : null;
      objectType = kind === "object" ? (opts.objectType || rolledObject) : null;
      skeletonId = opts.skeletonId || null;
      skeletonPart = opts.skeletonPart || null;
    }
    /* Pinned rehydration always wins. */
    if (opts.kind) kind = opts.kind;
    if (opts.objectType !== undefined && opts.objectType !== null) objectType = opts.objectType;
    if (opts.skeletonId) skeletonId = opts.skeletonId;
    if (opts.skeletonPart) skeletonPart = opts.skeletonPart;
    if (skeletonPart && S7.skeletons) skPartDef = S7.skeletons.partDef(skeletonPart);

    const rolledCond = rollWeighted(rng, CONDITIONS, opts.condBonus || 0);
    const condition = opts.condition
      ? (CONDITIONS.find((c) => c.id === opts.condition) || rolledCond) : rolledCond;

    let rareBonus = (opts.rareBonus || 0) + depthRarityBonus(depth);
    if (culture.gallery === "dinosaurs") rareBonus += 0.06;
    if (skeletonPart === "skull") rareBonus += 0.08;
    if (culture.gallery === "minerals") rareBonus += 0.03;
    if (culture.gallery === "fossils") rareBonus += 0.03;
    if (culture.gallery === "egypt") rareBonus += 0.02;
    const rolledRare = rollWeighted(rng, RARITIES, rareBonus);
    const rarity = opts.rarity
      ? (RARITIES.find((r) => r.id === opts.rarity) || rolledRare) : rolledRare;

    const material = opts.material || (skeletonId ? "bone" : materialOf(rng, kind, culture, objectType));

    const a = {
      seed: seed >>> 0,
      depth: Math.round(depth * 10) / 10,
      cultureId: culture.id,
      kind, objectType, material,
      condition, rarity,
      no: opts.no || "000",
      keystone: !!opts.keystone,
      skeletonId: skeletonId || undefined,
      skeletonPart: skeletonPart || undefined,
    };

    if (skeletonId && skeletonPart && S7.skeletons && !opts.name) {
      const kit = S7.skeletons.byId[skeletonId];
      const p = skPartDef || S7.skeletons.partDef(skeletonPart);
      a.name = (kit ? kit.short + " " : "") + (p ? p.label : "bone");
      a.notes = "Element of a " + (kit ? kit.name : "dinosaur") + " skeleton (" +
        (p ? p.label.toLowerCase() : "bone") + "). Recovered separately — the rest of the " +
        "animal is still in the deposit, if it is here at all.";
      if (kit) a.notes += " Collect every part to mount the complete " + kit.short.toLowerCase() + ".";
    } else {
      a.name = opts.name || buildName(rng, a, culture);
      a.notes = opts.notes || buildNotes(rng, a, culture);
    }
    if (opts.name) a.name = opts.name;
    if (opts.notes) a.notes = opts.notes;
    a.readings = buildReadings(rng, a);

    const kindWeight = kind === "painting" ? 1.35 : kind === "sculpture" ? 1.55 : 1.0;
    let galleryWeight = 1;
    if (culture.gallery === "dinosaurs") galleryWeight = 1.4;
    else if (culture.gallery === "fossils") galleryWeight = 1.2;
    else if (culture.gallery === "minerals") galleryWeight = 1.22;
    else if (culture.gallery === "egypt") galleryWeight = 1.15;
    const depthWeight = 1 + depth * 0.0012;
    let partSig = skPartDef ? skPartDef.sig : 0;
    a.significance = Math.round(
      ((5 + depth * 0.075) * kindWeight * galleryWeight * depthWeight *
        condition.mult * rarity.mult + partSig) * 10) / 10;

    a.boon = S7.boons.roll(rng, a);
    return a;
  }

  /* ---------- physical size ------------------------------------------------
     How big the thing actually is, in the gallery's logical pixels, where the
     wall is 98 tall and a visitor is 33. Everything used to draw at one size,
     which made a handheld console the same height as a portrait bust.

     `h` is display height; `w` is how much wall it needs, which is more than
     its own width because things need air around them. */

  const OBJECT_SIZE = {
    cap: 7, coin: 10, tag: 10, seal: 11, watch: 11, bead: 12, needle: 12,
    buckle: 12, key: 13, nail: 13, lamp: 13, console: 13, spearpoint: 15,
    handaxe: 15, torc: 17, sherd: 16, figurine: 17, astrolabe: 17, ledger: 17,
    mirror: 19, bottle: 19, tablet: 19, bell: 20, bonefrag: 21, blade: 24,
    vessel: 29, blockStone: 32, marker: 36,
    scarab: 12, ankh: 16, ushabti: 22, canopic: 26, pectoral: 24,
    dinoTooth: 18, dinoClaw: 22, ammonite: 22, trilobite: 18, crinoid: 16,
    goldNugget: 14, pyrite: 16, fluorite: 18, opal: 15, meteorite: 22,
    crystal: 24, geode: 28, fernFossil: 30, fishFossil: 32, coralFossil: 26,
    eggFossil: 24, dinoBone: 40, dinoFemur: 42, dinoTibia: 36, dinoHumerus: 32,
    dinoJaw: 30, dinoVert: 26, dinoRib: 34, dinoPelvis: 38, dinoTail: 40,
    trackSlab: 40,
  };

  const CARVER_SIZE = {
    venus: 15, neanderForm: 15, antler: 17, shabti: 21, cycladic: 23,
    dogu: 25, castHead: 27, bust: 31, anachronicBust: 31, beastStatue: 35,
    coveredFace: 36, torso: 42, soldier: 45, crystalForm: 38, dinoSkull: 52,
    dinoMount: 94, colossal: 62, stele: 70,
  };

  const PAINTER_SIZE = {
    miniature: 13, maya: 19, greek: 21, ukiyoe: 23, byzantine: 27, norse: 29,
    renaissance: 30, modern: 31, anachronic: 31, minoan: 31, victorian: 35,
    islamic: 35, unattributed: 35, song: 41, neolithic: 43, egyptian: 45,
    neander: 45, roman: 47, palaeo: 51,
  };

  const MIN_H = 7, MAX_H = 96;

  function physical(a) {
    if (a._phys) return a._phys;
    if (a.skeletonMount && S7.skeletons && S7.skeletons.byId[a.skeletonMount]) {
      const kit = S7.skeletons.byId[a.skeletonMount];
      return (a._phys = { h: kit.mountH, w: Math.round(kit.mountH * 1.4) + 36, monumental: true });
    }
    const cu = C.byId[a.cultureId];
    let base;
    if (a.skeletonPart && S7.skeletons && S7.skeletons.PARTS[a.skeletonPart])
      base = S7.skeletons.PARTS[a.skeletonPart].size;
    else if (a.kind === "object") base = OBJECT_SIZE[a.objectType] || 18;
    else if (a.kind === "sculpture") {
      if (a.skeletonPart === "skull") base = CARVER_SIZE.dinoSkull;
      else base = CARVER_SIZE[(cu && cu.sculpture) ? cu.sculpture.carver : "bust"] || 30;
    } else base = PAINTER_SIZE[(cu && cu.painting) ? cu.painting.painter : "modern"] || 30;

    /* Same seed, different stream: size must not shift if the text tables move. */
    const rng = S7.rng((a.seed ^ 0x2545f491) >>> 0);
    let h = base * rng.range(0.82, 1.24);

    /* Fragments are what is left of something. Exceptional pieces survived
       whole, which usually means they were bigger to begin with. */
    h *= 0.80 + a.condition.mult * 0.16;

    /* Now and then the deposit gives up something monumental — a wall-filling
       panel, a pillar taller than the people looking at it. Significance makes
       it likelier, and those are the pieces a room gets built around. */
    const monumentChance = a.kind === "object" ? 0.015 : 0.05 + Math.min(0.16, a.significance / 340);
    if (rng.chance(monumentChance)) h *= rng.range(1.9, 2.9);

    h = Math.max(MIN_H, Math.min(MAX_H, Math.round(h)));
    const monumental = h >= 58;
    /* Wall bay width — generous air so mounts never sit shoulder-to-shoulder. */
    const w = Math.max(36, Math.round(h * (a.kind === "painting" ? 1.22 : 1.0)) + 28);
    return (a._phys = { h, w, monumental });
  }

  /* ---------- art dispatch ------------------------------------------------ */

  const spriteCache = new Map();

  function spriteFor(a) {
    const key = a.seed + ":" + a.kind + ":" + (a.objectType || "") + ":" + a.cultureId +
      ":" + (a.skeletonPart || "") + ":" + (a.skeletonMount || "");
    let c = spriteCache.get(key);
    if (c) return c;
    const culture = C.byId[a.cultureId] || { sculpture: { carver: "bust", materials: ["bone"] } };
    const rng = S7.rng((a.seed ^ 0x9e3779b9) >>> 0);
    let B;
    if (a.skeletonMount)
      B = S7.sculptures.carve(rng, { carver: "dinoMount", materials: ["bone"] });
    else if (a.kind === "painting") B = S7.paintings.paint(rng, culture.painting);
    else if (a.kind === "sculpture") {
      const carver = a.skeletonPart === "skull" ? "dinoSkull"
        : (culture.sculpture && culture.sculpture.carver) || "bust";
      const mats = (culture.sculpture && culture.sculpture.materials) || ["bone"];
      B = S7.sculptures.carve(rng, { carver, materials: mats });
    } else B = S7.objects.make(rng, { object: a.objectType });
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

  /* An artifact at an arbitrary pixel size, cached.

     Downscales are smoothed, because nearest-neighbour below 1:1 drops whole
     pixel rows out of the art. Upscales go nearest-neighbour to the next whole
     multiple first and are then smoothed down to the target, which keeps the
     hard pixel edges instead of producing rows that are two wide next to rows
     that are three wide. */
  const scaleCache = new Map();

  function scaledFor(a, px) {
    px = Math.max(4, Math.round(px));
    const src = spriteFor(a);
    if (px === S7.raster.SZ) return src;
    const key = a.seed + ":" + (a.objectType || a.kind) + ":s" + px;
    let c = scaleCache.get(key);
    if (c) return c;

    if (px < S7.raster.SZ) {
      c = S7.raster.thumb(src, px);
    } else {
      const mult = Math.ceil(px / S7.raster.SZ);
      const big = document.createElement("canvas");
      big.width = big.height = S7.raster.SZ * mult;
      const bg = big.getContext("2d");
      bg.imageSmoothingEnabled = false;
      bg.drawImage(src, 0, 0, big.width, big.height);
      if (big.width === px) c = big;
      else c = S7.raster.thumb(big, px);
    }
    if (scaleCache.size > 260) scaleCache.clear();
    scaleCache.set(key, c);
    return c;
  }

  const materialLabel = (m) => MATERIAL_LABEL[m] || "Undetermined";

  S7.artifacts = {
    CONDITIONS, RARITIES, makeArtifact, spriteFor, thumbFor, scaledFor,
    materialLabel, physical, blurb, OBJECT_NOUNS,
  };
})(window.S7 = window.S7 || {});
