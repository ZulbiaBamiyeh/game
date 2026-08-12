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
      desc: (l) => "Clearing rate. " + (l + 1) + " on shift.",
      flavour: "Somebody has to move the spoil.",
      unlock: () => true },

    { id: "drill", name: "Service the drill", base: 12, mul: 1.21, max: 18,
      desc: (l) => "Descent rate, rating " + (l + 1) + ".",
      flavour: "It came second-hand and it shows.",
      unlock: () => true },

    { id: "tools", name: "Issue hand tools", base: 20, mul: 1.28, max: 15,
      desc: () => "+1 brush charge, faster recovery.",
      flavour: "Trowels, brushes, and one very good dental pick.",
      unlock: (S) => S.stats.finds >= 1,
      eff: (S) => { S.maxStam += 1; S.stamina += 1; S.mul.stamRate *= 0.94; } },

    { id: "lamps", name: "String more lamps", base: 30, mul: 1.26, max: 15,
      desc: () => "−4% distance between finds. The shaft gets brighter.",
      flavour: "You see more when you can see.",
      unlock: (S) => S.stats.finds >= 2,
      eff: (S) => { S.mul.findGap *= 0.96; } },

    { id: "sieve", name: "Build a spoil sieve", base: 55, mul: 1.30, max: 18,
      desc: () => "−5% distance between finds.",
      flavour: "Half of what matters is in the spoil heap.",
      unlock: (S) => S.stats.finds >= 4,
      eff: (S) => { S.mul.findGap *= 0.95; } },

    { id: "winch", name: "Rig a powered winch", base: 90, mul: 1.28, max: 18,
      desc: () => "+5% descent rate.",
      flavour: "Down is easy. Up is the expensive direction.",
      unlock: (S) => S.depth >= 25,
      eff: (S) => { S.mul.descent *= 1.05; } },

    { id: "conserv", name: "Conservation bench", base: 140, mul: 1.34, max: 15,
      desc: () => "+5% chance of better condition on every find.",
      flavour: "What you do in the first hour decides the next century.",
      unlock: (S) => S.stats.finds >= 8,
      eff: (S) => { S.bonus.condition += 0.05; } },

    { id: "survey", name: "Second survey team", base: 220, mul: 1.36, max: 15,
      desc: () => "+4% chance of a rarer find.",
      flavour: "Two pairs of eyes on the same square metre.",
      unlock: (S) => S.stats.finds >= 12,
      eff: (S) => { S.bonus.rarity += 0.04; } },

    { id: "lab", name: "Fit out a field lab", base: 320, mul: 1.34, max: 18,
      desc: () => "+12% Understanding from all sources.",
      flavour: "A microscope, a kettle, and somewhere to put them.",
      unlock: (S) => S.depth >= 60,
      eff: (S) => { S.mul.understanding *= 1.12; } },

    { id: "shoring", name: "Deep-shaft shoring", base: 600, mul: 1.38, max: 15,
      desc: () => "+6% descent below 200 m.",
      flavour: "Below two hundred metres the ground stops helping.",
      unlock: (S) => S.depth >= 150,
      eff: (S) => { S.mul.deepDescent *= 1.06; } },

    { id: "sonde", name: "Downhole sonde", base: 1400, mul: 1.40, max: 18,
      desc: () => "−6% distance between finds, and it reads deeper than the drill.",
      flavour: "It sees the next find before the drill reaches it.",
      unlock: (S) => S.depth >= 260,
      eff: (S) => { S.mul.findGap *= 0.94; } },

    { id: "core", name: "Continuous core barrel", base: 4200, mul: 1.42, max: 18,
      desc: () => "+7% descent, +5% clearing.",
      flavour: "Nothing is lost between the ground and the tray.",
      unlock: (S) => S.depth >= 380,
      eff: (S) => { S.mul.descent *= 1.07; S.mul.clear *= 1.05; } },
  ];

  const MUSEUM = [
    { id: "cases", name: "Buy display cases", base: 10, mul: 1.20, max: 40,
      desc: (l) => "+2 display space (" + (l * 2 + 2) + " total from cases).",
      flavour: "Glass, a lock, and a light that is slightly too warm.",
      unlock: () => true,
      eff: (S) => { S.bonus.capacity += 2; } },

    { id: "lighting", name: "Improve the lighting", base: 14, mul: 1.22, max: 12,
      desc: () => "+5% museum rating.",
      flavour: "Most of what a museum sells is light.",
      unlock: () => true,
      eff: (S) => { S.mul.rating *= 1.05; } },

    { id: "labels", name: "Write proper labels", base: 18, mul: 1.23, max: 12,
      desc: () => "+5% rating, +3% dwell time.",
      flavour: "A hundred and twenty words, and no more.",
      unlock: (S) => S.stats.accessioned >= 1,
      eff: (S) => { S.mul.rating *= 1.05; S.mul.dwell *= 1.03; } },

    { id: "tickets", name: "Print tickets", base: 22, mul: 1.33, max: 12,
      desc: () => "+6% spend per visitor.",
      flavour: "Suggested donation, firmly suggested.",
      unlock: (S) => S.stats.visitorsTotal >= 5,
      eff: (S) => { S.mul.spend *= 1.06; } },

    { id: "leaflet", name: "Leaflet the town", base: 30, mul: 1.24, max: 12,
      desc: () => "+6% visitors.",
      flavour: "Nobody knows you are here. That is fixable.",
      unlock: (S) => S.stats.visitorsTotal >= 15,
      eff: (S) => { S.mul.visitors *= 1.06; } },

    { id: "plinths", name: "Commission plinths", base: 48, mul: 1.26, max: 12,
      desc: () => "+6% rating, +1 display space.",
      flavour: "Height is respect. Everyone knows this and nobody says it.",
      unlock: (S) => S.stats.accessioned >= 3,
      eff: (S) => { S.mul.rating *= 1.06; S.bonus.capacity += 1; } },

    { id: "shop", name: "Open a gift shop", base: 75, mul: 1.25, max: 12,
      desc: () => "+7% spend per visitor.",
      flavour: "Postcards, pencils, and a book nobody finishes.",
      unlock: (S) => S.stats.visitorsTotal >= 40,
      eff: (S) => { S.mul.spend *= 1.07; } },

    { id: "guides", name: "Train the volunteers", base: 110, mul: 1.27, max: 12,
      desc: () => "+9% dwell time, +5% rating.",
      flavour: "Enthusiasm, unpaid, and better than most audio guides.",
      unlock: (S) => S.stats.accessioned >= 6,
      eff: (S) => { S.mul.dwell *= 1.09; S.mul.rating *= 1.05; } },

    { id: "cafe", name: "Put in a café", base: 180, mul: 1.40, max: 12,
      desc: () => "+8% spend, +6% dwell time.",
      flavour: "The café is the second most profitable room in any museum.",
      unlock: (S) => S.stats.visitorsTotal >= 150,
      eff: (S) => { S.mul.spend *= 1.08; S.mul.dwell *= 1.06; } },

    { id: "climate", name: "Climate control", base: 260, mul: 1.30, max: 12,
      desc: () => "+6% rating. Condition stops degrading on display.",
      flavour: "Nineteen degrees, fifty per cent, forever.",
      unlock: (S) => S.stats.accessioned >= 10,
      eff: (S) => { S.mul.rating *= 1.06; S.flags.climate = true; } },

    { id: "wing", name: "Open a new wing", base: 420, mul: 1.32, max: 12,
      desc: () => "+8 display space, +6% visitors.",
      flavour: "The trustees have been persuaded.",
      unlock: (S) => S.stats.accessioned >= 14,
      eff: (S) => { S.bonus.capacity += 8; S.mul.visitors *= 1.06; } },

    { id: "press", name: "Court the press", base: 700, mul: 1.33, max: 12,
      desc: () => "+8% visitors.",
      flavour: "One good Sunday feature is worth a year of leaflets.",
      unlock: (S) => S.stats.visitorsTotal >= 800,
      eff: (S) => { S.mul.visitors *= 1.08; } },

    { id: "touring", name: "Send a touring show", base: 1600, mul: 1.35, max: 12,
      desc: () => "+7% visitors, +6% spend.",
      flavour: "The collection travels. The reputation travels further.",
      unlock: (S) => S.stats.accessioned >= 25,
      eff: (S) => { S.mul.visitors *= 1.07; S.mul.spend *= 1.06; } },

    { id: "research", name: "Endow a research post", base: 3800, mul: 1.36, max: 12,
      desc: () => "+18% Understanding, +8% rating.",
      flavour: "Somebody whose whole job is the deep material.",
      unlock: (S) => S.depth >= 320,
      eff: (S) => { S.mul.understanding *= 1.18; S.mul.rating *= 1.06; } },

    { id: "deepgal", name: "The deep gallery", base: 9000, mul: 1.52, max: 12,
      desc: () => "+14 display space, +12% rating, +10% visitors.",
      flavour: "Low light, thick glass, and a queue that goes round the block.",
      unlock: (S) => S.stats.deepFinds >= 1,
      eff: (S) => { S.bonus.capacity += 14; S.mul.rating *= 1.12; S.mul.visitors *= 1.06; } },
  ];

  /* Research is bought with Understanding, not money, and each line is bought
     once. These are the structural unlocks — the things that change what you
     can do rather than how fast you do it. */
  const RESEARCH = [
    { id: "typology", name: "Establish a typology", cost: 40,
      desc: "Interpretation options are ordered. The correct reading is never last.",
      flavour: "Once you can name the type, you can name the type." },

    { id: "autobrush", name: "Standing excavation orders", cost: 90,
      desc: "The crew keep clearing a find even while you are looking at the museum.",
      flavour: "They do not actually need you standing over them." },

    { id: "assay", name: "Portable assay kit", cost: 160,
      desc: "The study result is shown before you commit to accessioning.",
      flavour: "Know what it teaches before you sign for it." },

    { id: "duplicate", name: "Reference collection", cost: 300,
      desc: "Duplicate cultures on display no longer dilute breadth.",
      flavour: "A second one of a thing is still evidence." },

    { id: "seriation", name: "Seriation of the deposit", cost: 550,
      desc: "−12% distance between finds at every depth.",
      flavour: "The deposit has an order. Reading it tells you where to stop." },

    { id: "stratspec", name: "Stratigraphic specialist", cost: 900,
      desc: "+20% descent rate.",
      flavour: "She can tell you what is coming from the colour of the spoil." },

    { id: "provenance", name: "Provenance study", cost: 1500,
      desc: "+25% museum rating. The catalogue becomes citable.",
      flavour: "Where a thing came from is worth more than the thing." },

    { id: "floor", name: "Model the deposit floor", cost: 2600,
      desc: "+30% descent below 400 m. Reveals how deep this goes.",
      flavour: "There is a bottom. Somebody put it there." },
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
