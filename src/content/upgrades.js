/* ============================================================================
   UPGRADES

   Two shops. The museum earns the money; the site spends it. Both start cheap
   and step often — the first ten minutes should contain a dozen purchases, not
   two, because the early game is where an idle game is won or lost.

   `unlock` gates what is even visible, so the shop grows as the player does
   rather than presenting forty rows on the first frame.
   ============================================================================ */
(function (S7) {
  "use strict";

  const EXCAVATION = [
    { id: "crew", name: "Take on a digger", base: 8, mul: 1.19, max: 18,
      desc: (l) => "Faster clearing. " + (l + 1) + " people on the face.",
      flavour: "Somebody has to bag the spoil.",
      unlock: () => true },

    { id: "drill", name: "Service the drill", base: 12, mul: 1.21, max: 18,
      desc: (l) => "Faster descent. The bit spins harder (mk " + (l + 1) + ").",
      flavour: "It came second-hand. That is fixable.",
      unlock: () => true },

    { id: "tools", name: "Issue hand tools", base: 20, mul: 1.28, max: 15,
      desc: () => "+1 brush charge. Finds clear faster.",
      flavour: "Trowels, brushes, and one very good dental pick.",
      unlock: (S) => S.stats.finds >= 1,
      eff: (S) => { S.maxStam += 1; S.stamina += 1; S.mul.stamRate *= 0.94; } },

    { id: "lamps", name: "String more lamps", base: 30, mul: 1.26, max: 15,
      desc: () => "Finds closer together. The shaft gets visibly brighter.",
      flavour: "You find more when you can see.",
      unlock: (S) => S.stats.finds >= 2,
      eff: (S) => { S.mul.findGap *= 0.96; } },

    { id: "sieve", name: "Build a spoil sieve", base: 55, mul: 1.30, max: 18,
      desc: () => "Finds closer together — less lost in the heap.",
      flavour: "Half of what matters is in the spoil.",
      unlock: (S) => S.stats.finds >= 4,
      eff: (S) => { S.mul.findGap *= 0.95; } },

    { id: "winch", name: "Rig a powered winch", base: 90, mul: 1.28, max: 18,
      desc: () => "+5% descent. A proper cable down the shaft.",
      flavour: "Down is easy. Up is the expensive direction.",
      unlock: (S) => S.depth >= 25,
      eff: (S) => { S.mul.descent *= 1.05; } },

    { id: "conserv", name: "Conservation bench", base: 140, mul: 1.34, max: 15,
      desc: () => "Finds come up in better condition more often.",
      flavour: "What you do in the first hour decides the next century.",
      unlock: (S) => S.stats.finds >= 8,
      eff: (S) => { S.bonus.condition += 0.05; } },

    { id: "survey", name: "Second survey team", base: 220, mul: 1.36, max: 15,
      desc: () => "Rarer finds turn up more often.",
      flavour: "Two pairs of eyes on the same square metre.",
      unlock: (S) => S.stats.finds >= 12,
      eff: (S) => { S.bonus.rarity += 0.04; } },

    { id: "lab", name: "Fit out a field lab", base: 320, mul: 1.34, max: 18,
      desc: () => "+12% Understanding from study and interpretations.",
      flavour: "A microscope, a kettle, and somewhere to put them.",
      unlock: (S) => S.depth >= 60,
      eff: (S) => { S.mul.understanding *= 1.12; } },

    { id: "shoring", name: "Deep-shaft shoring", base: 600, mul: 1.38, max: 15,
      desc: () => "+6% descent below 200 m. Tighter timber in the hole.",
      flavour: "Below two hundred metres the ground stops helping.",
      unlock: (S) => S.depth >= 150,
      eff: (S) => { S.mul.deepDescent *= 1.06; } },

    { id: "sonde", name: "Downhole sonde", base: 1400, mul: 1.40, max: 18,
      desc: () => "Finds closer together. A probe reads ahead of the bit.",
      flavour: "It sees the next find before the drill reaches it.",
      unlock: (S) => S.depth >= 260,
      eff: (S) => { S.mul.findGap *= 0.94; } },

    { id: "core", name: "Continuous core barrel", base: 4200, mul: 1.42, max: 18,
      desc: () => "+7% descent, +5% clearing. A thicker, hungrier bit.",
      flavour: "Nothing is lost between the ground and the tray.",
      unlock: (S) => S.depth >= 380,
      eff: (S) => { S.mul.descent *= 1.07; S.mul.clear *= 1.05; } },
  ];

  /* Museum shop: only things you can see on the floor plan — rooms, light,
     cases, staff. No abstract +6% leaflets. Old saves may still hold levels
     for retired ids; recompute simply ignores unknowns. */
  const MUSEUM = [
    { id: "cases", name: "Display cases", base: 12, mul: 1.22, max: 30,
      desc: (l) => "Glass cases on the floor. +" + 2 + " display space (lvl " + (l + 1) + ").",
      flavour: "Glass, a lock, and a light that is slightly too warm.",
      unlock: () => true,
      eff: (S) => { S.bonus.capacity += 2; } },

    { id: "lighting", name: "Gallery lighting", base: 18, mul: 1.24, max: 10,
      desc: () => "Track lights and warm pools on the wall. +6% rating.",
      flavour: "Most of what a museum sells is light.",
      unlock: () => true,
      eff: (S) => { S.mul.rating *= 1.06; } },

    { id: "labels", name: "Wall labels", base: 28, mul: 1.26, max: 8,
      desc: () => "Printed cards under every piece. +5% rating, people linger.",
      flavour: "A hundred and twenty words, and no more.",
      unlock: (S) => S.stats.accessioned >= 1,
      eff: (S) => { S.mul.rating *= 1.05; S.mul.dwell *= 1.05; } },

    { id: "shop", name: "Gift shop", base: 90, mul: 1.28, max: 8,
      desc: (l) => (l === 0 ? "Opens a gift shop off the entrance." : "Stock the shop (lvl " + (l + 1) + ").") +
        " Visitors buy souvenirs.",
      flavour: "Postcards, pencils, and a book nobody finishes.",
      unlock: (S) => S.stats.visitorsTotal >= 25,
      eff: (S) => { S.mul.spend *= 1.08; } },

    { id: "cafe", name: "Museum café", base: 200, mul: 1.32, max: 8,
      desc: (l) => (l === 0 ? "Opens a café with tables and a till." : "Expand the café (lvl " + (l + 1) + ").") +
        " Tea, cake, longer visits.",
      flavour: "The second most profitable room in any museum.",
      unlock: (S) => S.stats.visitorsTotal >= 80,
      eff: (S) => { S.mul.spend *= 1.09; S.mul.dwell *= 1.08; } },

    { id: "staff", name: "Hire floor staff", base: 140, mul: 1.30, max: 8,
      desc: () => "Cashiers and guides on the floor. +8% dwell, +5% spend.",
      flavour: "Someone who knows where the Roman glass is.",
      unlock: (S) => S.stats.accessioned >= 4,
      eff: (S) => { S.mul.dwell *= 1.08; S.mul.spend *= 1.05; S.mul.rating *= 1.03; } },

    { id: "upper", name: "Open the upper floor", base: 480, mul: 1.45, max: 3,
      desc: (l) => l === 0
        ? "A second storey, stairs, and more wall for the collection."
        : "Finish out the upper floor (lvl " + (l + 1) + "). +10 space, +8% visitors.",
      flavour: "The trustees signed. The builders start Monday.",
      unlock: (S) => S.stats.accessioned >= 10,
      eff: (S) => { S.bonus.capacity += 10; S.mul.visitors *= 1.08; S.mul.rating *= 1.04; } },

    { id: "research", name: "Research library", base: 2200, mul: 1.40, max: 4,
      desc: () => "A quiet room upstairs. +15% Understanding, +6% rating.",
      flavour: "Somebody whose whole job is the deep material.",
      unlock: (S) => S.depth >= 200 || (S.up.upper || 0) > 0,
      eff: (S) => { S.mul.understanding *= 1.15; S.mul.rating *= 1.06; } },

    { id: "deepgal", name: "The deep gallery", base: 6500, mul: 1.50, max: 4,
      desc: () => "Low-light hall for the strangest finds. +12 space, +10% rating.",
      flavour: "Thick glass. Soft voice. A queue that goes round the landing.",
      unlock: (S) => S.stats.deepFinds >= 1,
      eff: (S) => { S.bonus.capacity += 12; S.mul.rating *= 1.10; S.mul.visitors *= 1.06; } },
  ];

  /* Research is bought with Understanding, not money, and each line is bought
     once. These are the structural unlocks — the things that change what you
     can do rather than how fast you do it. Copy stays free of plot spoilers;
     the player should earn the weirdness in the shaft, not read it in a shop. */
  const RESEARCH = [
    { id: "typology", name: "Establish a typology", cost: 40,
      tag: "Method",
      desc: "Interpretation choices are sorted so the right one is easier to spot.",
      flavour: "Once you can name the type, you can name the type." },

    { id: "autobrush", name: "Standing excavation orders", cost: 90,
      tag: "Crew",
      desc: "The crew keep brushing a find while you are in the museum.",
      flavour: "They do not need you standing over them." },

    { id: "assay", name: "Portable assay kit", cost: 160,
      tag: "Lab",
      desc: "See what a find teaches before you decide to put it on show.",
      flavour: "Know the lesson before you sign for it." },

    { id: "duplicate", name: "Reference collection", cost: 300,
      tag: "Museum",
      desc: "Showing two of the same tradition no longer weakens the rating.",
      flavour: "A second example is still evidence." },

    { id: "seriation", name: "Seriation of the deposit", cost: 550,
      tag: "Site",
      desc: "Finds turn up closer together at every depth.",
      flavour: "The deposit has a pattern. Reading it helps." },

    { id: "stratspec", name: "Stratigraphic specialist", cost: 900,
      tag: "Site",
      desc: "+20% descent rate — she reads the spoil as you cut.",
      flavour: "She knows what is coming from the colour of the dirt." },

    { id: "provenance", name: "Provenance study", cost: 1500,
      tag: "Museum",
      desc: "+25% museum rating. The catalogue becomes citable.",
      flavour: "Where a thing came from is worth more than the thing." },

    { id: "floor", name: "Deep-section model", cost: 2600,
      tag: "Site",
      desc: "+30% descent below 400 m. The deep cut goes faster.",
      flavour: "The lower ground is not the same problem as the upper." },
  ];

  const RESEARCH_EFF = {
    seriation: (S) => { S.mul.findGap *= 0.88; },
    stratspec: (S) => { S.mul.descent *= 1.20; },
    provenance: (S) => { S.mul.rating *= 1.25; },
    floor: (S) => { S.mul.deepDescent *= 1.30; },
  };

  const ALL = {};
  for (const u of EXCAVATION.concat(MUSEUM)) ALL[u.id] = u;

  const EXC_IDS = {};
  for (const u of EXCAVATION) EXC_IDS[u.id] = true;

  /* Site equipment gets dearer the deeper the shaft goes — otherwise a museum
     that has started earning simply buys the whole excavation list at once and
     the bottom of the deposit arrives inside ten minutes. */
  const cost = (S, u) => {
    const depthTax = EXC_IDS[u.id] ? 1 + S.depth / 30 : 1;
    return Math.max(1, Math.round(
      u.base * Math.pow(u.mul, S.up[u.id] || 0) * depthTax * S.mul.cost / (1 + S.red.cost)));
  };

  S7.upgrades = { EXCAVATION, MUSEUM, RESEARCH, RESEARCH_EFF, ALL, cost };
})(window.S7 = window.S7 || {});
