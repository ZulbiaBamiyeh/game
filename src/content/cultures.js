/* ============================================================================
   CULTURES

   Thirty-four traditions, ordered by depth. Each one owns a painting style, a
   sculptural form, a pool of objects, and its own vocabulary — so an artifact
   raised from 210 m is recognisably Bronze Age Aegean and an artifact from
   470 m is recognisably nothing at all.

   `eerie` is the tell. 0 is ordinary archaeology. By 3 the catalogue entries
   have stopped pretending.
   ============================================================================ */
(function (S7) {
  "use strict";

  const CULTURES = [
    /* ---------- 0: the top of the shaft --------------------------------- */
    { id: "modern", name: "Contemporary refuse", short: "Contemporary", region: "local",
      period: "c. 1950–present", eerie: 0,
      painting: { painter: "modern", frame: "minimal" }, paintNoun: "Framed print",
      sculpture: { carver: "bust", materials: ["marble", "alum", "plastic"] }, sculptNoun: "Cast head",
      objects: ["cap", "console", "tag", "key", "bottle", "coin", "needle", "ring", "comb"] },

    { id: "industrial", name: "Industrial horizon", short: "Industrial", region: "local",
      period: "c. 1750–1950", eerie: 0,
      painting: { painter: "victorian", frame: "wood" }, paintNoun: "Oil painting on board",
      objects: ["nail", "bottle", "key", "coin", "tag", "needle", "buckle", "weight", "ladle"] },

    { id: "victorian", name: "Victorian collection", short: "Victorian", region: "imported",
      period: "c. 1830–1900", eerie: 0,
      painting: { painter: "victorian", frame: "gilt" }, paintNoun: "Portrait of an unknown sitter",
      sculpture: { carver: "bust", materials: ["marble", "granite"] }, sculptNoun: "Portrait bust",
      objects: ["coin", "mirror", "bead", "needle", "ledger", "key", "brooch", "earring", "comb"] },

    /* ---------- 45–80 m: early modern ------------------------------------ */
    { id: "renaissance", name: "Renaissance Europe", short: "Renaissance", region: "Italian peninsula",
      period: "c. 1400–1600", eerie: 0,
      painting: { painter: "renaissance", frame: "gilt" }, paintNoun: "Panel painting",
      sculpture: { carver: "bust", materials: ["marble"] }, sculptNoun: "Marble bust",
      objects: ["coin", "blade", "mirror", "vessel", "torc", "ring", "brooch"] },

    { id: "edo", name: "Edo Japan", short: "Edo", region: "Honshū",
      period: "c. 1603–1868", eerie: 0,
      painting: { painter: "ukiyoe", frame: "lacquer" }, paintNoun: "Woodblock print",
      sculpture: { carver: "beastStatue", materials: ["wood", "bronze", "granite"] }, sculptNoun: "Guardian figure",
      objects: ["blade", "mirror", "seal", "vessel", "bead", "comb", "ladle"] },

    { id: "mughal", name: "Mughal India", short: "Mughal", region: "Deccan",
      period: "c. 1526–1750", eerie: 0,
      painting: { painter: "miniature", frame: "gilt" }, paintNoun: "Miniature painting",
      sculpture: { carver: "torso", materials: ["marble", "stone"] }, sculptNoun: "Broken figure",
      objects: ["blade", "bead", "mirror", "seal", "torc", "coin", "earring", "ring"] },

    { id: "benin", name: "Kingdom of Benin", short: "Benin", region: "Bight of Benin",
      period: "c. 1300–1700", eerie: 0,
      sculpture: { carver: "castHead", materials: ["bronze", "brass"] }, sculptNoun: "Commemorative bronze head",
      objects: ["torc", "bead", "blade", "mirror", "bell", "ring", "weight"] },

    /* ---------- 80–125 m: medieval --------------------------------------- */
    { id: "byzantine", name: "Byzantium", short: "Byzantine", region: "Eastern Mediterranean",
      period: "c. 500–1450", eerie: 0,
      painting: { painter: "byzantine", frame: "gilt" }, paintNoun: "Religious icon",
      sculpture: { carver: "torso", materials: ["marble", "granite"] }, sculptNoun: "Draped torso",
      objects: ["coin", "torc", "bead", "lamp", "vessel", "buckle", "ring", "brooch"] },

    { id: "norse", name: "Norse settlement", short: "Norse", region: "North Atlantic",
      period: "c. 793–1100", eerie: 0,
      painting: { painter: "norse", frame: "wood" }, paintNoun: "Painted wooden plank",
      sculpture: { carver: "stele", materials: ["granite", "stone"] }, sculptNoun: "Carved stone",
      objects: ["blade", "torc", "bead", "buckle", "needle", "nail", "coin", "axehead", "comb", "weight"] },

    { id: "song", name: "Song China", short: "Song", region: "Yangtze basin",
      period: "c. 960–1279", eerie: 0,
      painting: { painter: "song", frame: "scroll" }, paintNoun: "Hanging scroll",
      sculpture: { carver: "beastStatue", materials: ["celadon", "stone", "bronze"] }, sculptNoun: "Glazed animal figure",
      objects: ["vessel", "coin", "mirror", "bead", "seal", "ladle", "spindle"] },

    { id: "islamic", name: "Islamic Golden Age", short: "Islamic", region: "Mesopotamia",
      period: "c. 750–1250", eerie: 0,
      painting: { painter: "islamic", frame: "wood" }, paintNoun: "Decorated tile panel",
      objects: ["vessel", "coin", "mirror", "bead", "lamp", "tablet", "astrolabe", "ring", "earring"] },

    { id: "khmer", name: "Khmer Empire", short: "Khmer", region: "Mekong",
      period: "c. 802–1431", eerie: 0,
      sculpture: { carver: "torso", materials: ["stone", "granite", "basalt"] }, sculptNoun: "Torso from a doorway",
      objects: ["blade", "bead", "torc", "vessel", "bell", "ring", "spindle"] },

    /* ---------- 125–180 m: classical ------------------------------------- */
    { id: "rome", name: "Roman provinces", short: "Roman", region: "Western Empire",
      period: "c. 200 BCE–450 CE", eerie: 0,
      painting: { painter: "roman", frame: "fragment" }, paintNoun: "Piece of wall painting",
      sculpture: { carver: "bust", materials: ["marble", "granite", "bronze"] }, sculptNoun: "Portrait head",
      objects: ["coin", "lamp", "buckle", "blade", "nail", "key", "vessel", "mirror"] },

    { id: "greece", name: "Archaic Greece", short: "Greek", region: "Aegean",
      period: "c. 700–300 BCE", eerie: 0,
      painting: { painter: "greek", frame: "fragment" }, paintNoun: "Painted pottery scene",
      sculpture: { carver: "bust", materials: ["marble"] }, sculptNoun: "Youth's head from a statue",
      objects: ["vessel", "coin", "blade", "lamp", "bead", "mirror"] },

    { id: "han", name: "Han China", short: "Han", region: "Yellow River",
      period: "c. 206 BCE–220 CE", eerie: 0,
      painting: { painter: "song", frame: "scroll" }, paintNoun: "Silk painting",
      sculpture: { carver: "soldier", materials: ["clay", "sand"] }, sculptNoun: "Tomb figure",
      objects: ["mirror", "coin", "blade", "vessel", "seal", "bead"] },

    { id: "maya", name: "Maya lowlands", short: "Maya", region: "Petén",
      period: "c. 250–900 CE", eerie: 0,
      painting: { painter: "maya", frame: "fragment" }, paintNoun: "Painted book page",
      sculpture: { carver: "stele", materials: ["granite", "basalt", "stone"] }, sculptNoun: "Broken carved stone",
      objects: ["vessel", "bead", "blade", "seal", "tablet"] },

    { id: "nazca", name: "Nazca", short: "Nazca", region: "South Pacific coast",
      period: "c. 100 BCE–800 CE", eerie: 0,
      painting: { painter: "minoan", frame: "fragment" }, paintNoun: "Painted cloth fragment",
      objects: ["vessel", "sherd", "bead", "needle", "figurine"] },

    /* ---------- 180–245 m: bronze ---------------------------------------- */
    { id: "egypt", name: "Dynastic Egypt", short: "Egyptian", region: "Lower Nile",
      period: "c. 3100–332 BCE", eerie: 0, gallery: "egypt",
      painting: { painter: "egyptian", frame: "fragment" }, paintNoun: "Piece of tomb painting",
      sculpture: { carver: "shabti", materials: ["stone", "sand", "celadon", "gold"] }, sculptNoun: "Funerary figure",
      objects: ["vessel", "bead", "tablet", "seal", "blade", "lamp", "figurine", "mirror",
               "scarab", "canopic", "ankh", "ushabti", "pectoral"] },

    { id: "minoan", name: "Minoan Crete", short: "Minoan", region: "Aegean",
      period: "c. 2600–1100 BCE", eerie: 0,
      painting: { painter: "minoan", frame: "fragment" }, paintNoun: "Piece of fresco",
      sculpture: { carver: "cycladic", materials: ["marble", "chalk"] }, sculptNoun: "Folded-arm figure",
      objects: ["vessel", "sherd", "seal", "blade", "bead"] },

    { id: "sumer", name: "Sumer", short: "Sumerian", region: "Lower Mesopotamia",
      period: "c. 3500–1900 BCE", eerie: 0,
      sculpture: { carver: "stele", materials: ["stone", "granite", "basalt"] }, sculptNoun: "Offering stone",
      objects: ["tablet", "seal", "bead", "blade", "vessel"] },

    { id: "shang", name: "Shang dynasty", short: "Shang", region: "Yellow River",
      period: "c. 1600–1046 BCE", eerie: 0,
      sculpture: { carver: "beastStatue", materials: ["bronze"] }, sculptNoun: "Ritual bronze figure",
      objects: ["vessel", "blade", "mirror", "seal", "bead", "tablet"] },

    { id: "indus", name: "Indus Valley", short: "Indus", region: "Sindh",
      period: "c. 3300–1300 BCE", eerie: 1,
      sculpture: { carver: "torso", materials: ["stone", "chalk"] }, sculptNoun: "Small torso",
      objects: ["seal", "bead", "vessel", "blade", "figurine"] },

    /* ---------- 245–320 m: neolithic ------------------------------------- */
    { id: "catal", name: "Çatalhöyük", short: "Anatolian Neolithic", region: "Konya plain",
      period: "c. 7500–5700 BCE", eerie: 0,
      painting: { painter: "neolithic", frame: "rock" }, paintNoun: "Lifted wall painting",
      sculpture: { carver: "venus", materials: ["stone", "clay"] }, sculptNoun: "Seated figure",
      objects: ["sherd", "bead", "blade", "spearpoint", "needle", "handaxe"] },

    { id: "jomon", name: "Jōmon", short: "Jōmon", region: "Honshū",
      period: "c. 14000–300 BCE", eerie: 0,
      sculpture: { carver: "dogu", materials: ["clay", "sand"] }, sculptNoun: "Clay figurine",
      objects: ["vessel", "sherd", "bead", "spearpoint"] },

    { id: "cucuteni", name: "Cucuteni–Trypillia", short: "Cucuteni", region: "Dniester",
      period: "c. 5500–2750 BCE", eerie: 1,
      painting: { painter: "neolithic", frame: "fragment" }, paintNoun: "Painted plaster",
      sculpture: { carver: "cycladic", materials: ["clay", "chalk"] }, sculptNoun: "Standing figure",
      objects: ["vessel", "sherd", "figurine", "bead"] },

    { id: "gobekli", name: "Pre-pottery enclosure", short: "Enclosure", region: "Upper Euphrates",
      period: "c. 9500–8000 BCE", eerie: 1,
      sculpture: { carver: "stele", materials: ["granite", "basalt", "stone"] }, sculptNoun: "Carved pillar fragment",
      objects: ["handaxe", "spearpoint", "bead", "blockStone"] },

    /* ---------- 320–410 m: upper palaeolithic ---------------------------- */
    { id: "magdalenian", name: "Magdalenian", short: "Magdalenian", region: "Franco-Cantabria",
      period: "c. 17000–12000 BCE", eerie: 1,
      painting: { painter: "palaeo", frame: "rock" }, paintNoun: "Painted rock, cut free",
      sculpture: { carver: "antler", materials: ["bone"] }, sculptNoun: "Carved antler",
      objects: ["spearpoint", "bead", "bonefrag", "needle", "handaxe"] },

    { id: "gravettian", name: "Gravettian", short: "Gravettian", region: "Central Danube",
      period: "c. 31000–22000 BCE", eerie: 1,
      painting: { painter: "palaeo", frame: "rock" }, paintNoun: "Ochre-painted panel",
      sculpture: { carver: "venus", materials: ["stone", "bone", "clay"] }, sculptNoun: "Female figurine",
      objects: ["bead", "spearpoint", "bonefrag", "needle"] },

    /* ---------- 410–515 m: the long dark --------------------------------- */
    { id: "neanderthal", name: "Neanderthal deposit", short: "Neanderthal", region: "unprovenanced",
      period: "c. 120000–40000 BCE", eerie: 2,
      painting: { painter: "neander", frame: "rock" }, paintNoun: "Marked rock panel",
      sculpture: { carver: "neanderForm", materials: ["stone", "bone", "obsid"] }, sculptNoun: "Worked stone form",
      objects: ["handaxe", "spearpoint", "bonefrag", "bead"] },

    { id: "denisovan", name: "Denisovan deposit", short: "Denisovan", region: "unprovenanced",
      period: "c. 200000–50000 BCE", eerie: 2,
      painting: { painter: "neander", frame: "rock" }, paintNoun: "Pigment-stained panel",
      sculpture: { carver: "neanderForm", materials: ["stone", "bone", "obsid"] }, sculptNoun: "Worked ornament",
      objects: ["bead", "bonefrag", "handaxe", "needle"] },

    /* ---------- deep time: geology the deposit was never meant to hold ----- */
    /* Listed youngest → oldest so deeper picks inside the band land on older taxa. */
    { id: "cretaceous", name: "Cretaceous assemblage", short: "Cretaceous", region: "deep time",
      period: "c. 145–66 Ma", eerie: 1, gallery: "dinosaurs",
      sculpture: { carver: "dinoSkull", materials: ["bone", "stone", "chalk"] }, sculptNoun: "Dinosaur skull",
      objects: ["dinoTooth", "dinoBone", "dinoClaw", "dinoFemur", "dinoJaw", "dinoVert",
                "dinoRib", "dinoPelvis", "dinoTail", "eggFossil", "trackSlab"] },

    { id: "jurassic", name: "Jurassic assemblage", short: "Jurassic", region: "deep time",
      period: "c. 201–145 Ma", eerie: 1, gallery: "dinosaurs",
      sculpture: { carver: "dinoSkull", materials: ["bone", "stone"] }, sculptNoun: "Predator skull",
      objects: ["dinoTooth", "dinoBone", "dinoClaw", "dinoFemur", "dinoTibia", "dinoHumerus",
                "dinoJaw", "dinoVert", "dinoRib", "dinoPelvis", "dinoTail", "ammonite"] },

    { id: "triassic", name: "Triassic assemblage", short: "Triassic", region: "deep time",
      period: "c. 252–201 Ma", eerie: 1, gallery: "dinosaurs",
      sculpture: { carver: "dinoSkull", materials: ["bone", "stone"] }, sculptNoun: "Early reptile skull",
      objects: ["dinoBone", "dinoTooth", "dinoFemur", "dinoVert", "dinoRib", "dinoPelvis",
                "dinoTail", "trackSlab"] },

    { id: "paleozoic", name: "Paleozoic fossils", short: "Paleozoic", region: "deep time",
      period: "c. 541–252 Ma", eerie: 1, gallery: "fossils",
      objects: ["trilobite", "ammonite", "fernFossil", "crinoid", "fishFossil", "coralFossil"] },

    { id: "minerals", name: "Mineral veins", short: "Minerals", region: "geological",
      period: "no single age", eerie: 0, gallery: "minerals",
      sculpture: { carver: "crystalForm", materials: ["obsid", "granite", "marble"] }, sculptNoun: "Crystal cluster",
      objects: ["geode", "crystal", "goldNugget", "meteorite", "opal", "pyrite", "fluorite"] },

    /* ---------- unattributed --------------------------------------------- */
    { id: "unattr_a", name: "Unattributed, Group A", short: "Group A", region: "—",
      period: "no accepted context", eerie: 3,
      painting: { painter: "unattributed", frame: "wood" }, paintNoun: "Panel of unclear subject",
      sculpture: { carver: "coveredFace", materials: ["marble", "basalt"] }, sculptNoun: "Seated figure",
      objects: ["coin", "tablet", "seal", "figurine", "blockStone"] },

    { id: "unattr_b", name: "Unattributed, Group B", short: "Group B", region: "—",
      period: "no accepted context", eerie: 3,
      painting: { painter: "unattributed", frame: "lacquer" }, paintNoun: "Panel with a spiral",
      sculpture: { carver: "coveredFace", materials: ["obsid", "ice", "marble"] }, sculptNoun: "Large seated figure",
      objects: ["torc", "blockStone", "tablet", "coin", "mirror"] },

    { id: "unattr_c", name: "Unattributed, Group C", short: "Group C", region: "—",
      period: "no accepted context", eerie: 3,
      painting: { painter: "unattributed", frame: "gilt" }, paintNoun: "Panel with covered faces",
      sculpture: { carver: "coveredFace", materials: ["ice", "obsid"] }, sculptNoun: "Figure with hands raised",
      objects: ["seal", "tablet", "coin", "figurine", "torc"] },

    /* ---------- floor of the deposit ------------------------------------ */
    { id: "anachronic", name: "Anachronic assemblage", short: "Anachronic", region: "—",
      period: "postdates its own depth", eerie: 4,
      painting: { painter: "anachronic", frame: "gilt" }, paintNoun: "Panel showing a shaft",
      sculpture: { carver: "anachronicBust", materials: ["marble"] }, sculptNoun: "Bust in modern dress",
      objects: ["watch", "marker", "console", "ledger", "tablet"] },
  ];

  const byId = {};
  for (const c of CULTURES) byId[c.id] = c;

  /* Named museum rooms that pull related finds out of the pure depth stack —
     Egypt, dinosaurs, fossils, minerals — so the building feels curated. */
  const GALLERIES = [
    { id: "egypt", name: "Egyptian gallery", period: "Dynastic Nile", short: "Egypt",
      theme: "egypt", order: 40 },
    { id: "dinosaurs", name: "Hall of dinosaurs", period: "Mesozoic", short: "Dinosaurs",
      theme: "dino", order: 80 },
    { id: "fossils", name: "Fossil gallery", period: "Deep time", short: "Fossils",
      theme: "fossil", order: 81 },
    { id: "minerals", name: "Mineral vault", period: "Geological", short: "Minerals",
      theme: "mineral", order: 82 },
  ];
  const galleryById = {};
  for (const g of GALLERIES) galleryById[g.id] = g;

  /* Which room a find belongs in by default. Themed cultures get a named
     hall; everything else stays with its depth band. */
  function galleryIdFor(a) {
    if (a.room) return a.room;
    const cu = byId[a.cultureId];
    if (cu && cu.gallery) return cu.gallery;
    return eraAt(a.depth).id;
  }

  /* ---------- depth bands -------------------------------------------------
     Depth is time. Each band names its own stratum, so the shaft wall changes
     colour as the centuries go by. Deep time (dinosaurs, fossils, minerals)
     sits below the human record — curatorial order, not geology. */

  const ERAS = [
    { id: "overburden", name: "Overburden",              to: 18,   ramp: "soil",    period: "1950 – present",
      cultures: ["modern"], find: 4.0 },
    { id: "industrial", name: "Industrial fill",         to: 45,   ramp: "clayb",   period: "1750 – 1950",
      cultures: ["industrial", "victorian", "modern"], find: 5.0 },
    { id: "earlymod",   name: "Early modern horizon",    to: 80,   ramp: "loess",   period: "1400 – 1750",
      cultures: ["renaissance", "edo", "mughal", "benin", "victorian"], find: 6.0 },
    { id: "medieval",   name: "Medieval horizon",        to: 125,  ramp: "clayb",   period: "500 – 1400 CE",
      cultures: ["byzantine", "norse", "song", "islamic", "khmer"], find: 7.0 },
    { id: "classical",  name: "Classical horizon",       to: 180,  ramp: "gravel",  period: "800 BCE – 500 CE",
      cultures: ["rome", "greece", "han", "maya", "nazca"], find: 8.0 },
    { id: "bronze",     name: "Bronze Age horizon",      to: 245,  ramp: "loess",   period: "3000 – 800 BCE",
      cultures: ["egypt", "minoan", "sumer", "shang", "indus"], find: 9.0 },
    { id: "neolithic",  name: "Neolithic horizon",       to: 320,  ramp: "chalk",   period: "10000 – 3000 BCE",
      cultures: ["catal", "jomon", "cucuteni", "gobekli"], find: 10.0 },
    { id: "palaeo",     name: "Upper Palaeolithic",      to: 400,  ramp: "peat",    period: "40000 – 10000 BCE",
      cultures: ["magdalenian", "gravettian"], find: 11.0 },
    { id: "longdark",   name: "The long dark",           to: 480,  ramp: "permaf",  period: "200000 – 40000 BCE",
      cultures: ["neanderthal", "denisovan"], find: 12.0 },
    /* Deep time: younger geology first (shallower), older below — so a
       dinosaur is already a deep find, and Paleozoic fossils sit deeper still. */
    { id: "mesozoic",   name: "Mesozoic horizon",        to: 560,  ramp: "basalt",  period: "252 – 66 Ma",
      cultures: ["cretaceous", "jurassic", "triassic"], find: 12.5 },
    { id: "fossils",    name: "Paleozoic fossils",       to: 630,  ramp: "chalk",   period: "541 – 252 Ma",
      cultures: ["paleozoic"], find: 13.0 },
    { id: "minerals",   name: "Mineral veins",           to: 680,  ramp: "gravel",  period: "geological",
      cultures: ["minerals"], find: 12.5 },
    { id: "unattr",     name: "Unattributed deposit",    to: 750,  ramp: "basalt",  period: "no accepted context",
      cultures: ["unattr_a", "unattr_b", "unattr_c"], find: 14.0 },
    { id: "floor",      name: "Deposit floor",           to: 1e9,  ramp: "sterile", period: "anachronic",
      cultures: ["anachronic", "unattr_c"], find: 15.0 },
  ];

  /* The shaft has a bottom, and it is a real one: below this is bedrock that
     has not been disturbed in ninety million years. Everything in the economy
     is bounded because this number is. */
  const MAX_DEPTH = 830;

  const eraAt = (d) => ERAS.find((e) => d < e.to) || ERAS[ERAS.length - 1];
  const eraIndex = (d) => Math.max(0, ERAS.findIndex((e) => d < e.to));

  S7.cultures = {
    CULTURES, byId, ERAS, eraAt, eraIndex, MAX_DEPTH,
    GALLERIES, galleryById, galleryIdFor,
  };
})(window.S7 = window.S7 || {});
