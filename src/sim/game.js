/* ============================================================================
   THE SIMULATION

   Descent, excavation, interpretation, accession, and the clock that runs
   while the tab is closed. No DOM in this file: the UI reads state and calls
   these, never the other way round.
   ============================================================================ */
(function (S7) {
  "use strict";

  const CELL = 4;                    /* excavation grid cell, in sprite pixels */
  const GRID = S7.raster.SZ / CELL;  /* 16 x 16 */

  /* ---------- keystones ---------------------------------------------------
     Fixed-depth finds that carry the story. Everything else is random; these
     are not, and they are the only artifacts with written text. */

  const KEYSTONES = [
    { depth: 28, culture: "industrial", kind: "object", objectType: "ledger",
      condition: "part", rarity: "signif",
      name: "Ledger, partial",
      notes: "Nineteen bound pages, water-damaged. It records deliveries of fill material to this site. " +
             "The deliveries run across forty years. There is no corresponding excavation recorded anywhere, " +
             "by anyone, in that period. Forty years of carting soil to a place nobody was digging.",
      beat: "The ledger says the ground here was <b>brought in</b>. Somebody spent forty years filling this hole." },

    { depth: 152, culture: "rome", kind: "sculpture",
      condition: "sound", rarity: "signif",
      name: "Portrait head, unidentified",
      notes: "Recovered intact from a void left deliberately in the fill. The head faces upward. " +
             "There is no body, and no sign that there ever was one — the neck was finished, not broken. " +
             "Whoever placed it wanted it looking at whoever came down after.",
      beat: "It was <b>placed</b>, facing up. The deposit is not a rubbish pit. It is arranged." },

    { depth: 336, culture: "magdalenian", kind: "painting",
      condition: "fine", rarity: "signif",
      name: "Painted block, detached",
      notes: "A block of painted limestone, cut free of its parent rock with a clean edge on all six sides. " +
             "Cave paintings are not portable. This one was made portable, by someone with the means to " +
             "quarry a wall and the reason to want a piece of it down here.",
      beat: "The cave art was <b>cut out and carried here</b>. This is a collection. Somebody has been collecting." },

    { depth: 438, culture: "neanderthal", kind: "sculpture",
      condition: "excep", rarity: "unique",
      name: "Worked form, Neanderthal context",
      notes: "Unquestionably worked, unquestionably Neanderthal, and unquestionably not a tool. " +
             "It has no edge, no point, no bearing surface, and it has been finished to a standard " +
             "that took a very long time. It was made because somebody wanted it to exist.",
      beat: "Below four hundred metres the material is <b>older than art is supposed to be</b>. It is also better made." },

    { depth: 520, culture: "cretaceous", kind: "sculpture",
      condition: "fine", rarity: "unique",
      name: "Dinosaur skull, complete",
      notes: "A theropod skull, mineralised, recovered from a packed void at five hundred and twenty metres. " +
             "There is no river gravel, no bone bed, no natural context of any kind. It was wrapped, " +
             "set upright, and covered. Somebody wanted a dinosaur in the collection.",
      beat: "Below the human record the deposit holds <b>deep time on purpose</b>. This is a museum in the ground." },

    { depth: 680, culture: "unattr_a", kind: "sculpture",
      condition: "excep", rarity: "unique",
      name: "Seated form, hands raised",
      notes: "The eleventh of this form. Seated, arms raised, hands covering the face; the face is not modelled " +
             "beneath them. Eight-turn spiral incised on the back of each hand, counterclockwise, on every one. " +
             "There is no tradition in the literature that this belongs to. There is no tradition in the " +
             "literature that anything below this depth belongs to.",
      beat: "Unattributed. Not undated — <b>unattributable</b>. There is no culture in the record that made these." },

    { depth: 760, culture: "anachronic", kind: "object", objectType: "watch",
      condition: "sound", rarity: "unique",
      name: "Wristwatch",
      notes: "A mechanical wristwatch on a perished leather strap, recovered from sealed fill at 760 metres. " +
             "The sediment above shows no intrusion of any kind: no shaft, no void, no disturbance. " +
             "The layers above this watch have been undisturbed for longer than wristwatches have existed. " +
             "I have left the age field blank. I am not able to fill it in a way that is true.",
      beat: "The watch <b>postdates its own depth</b>. The deposit was not filled from the top down." },

    { depth: 812, culture: "anachronic", kind: "object", objectType: "marker",
      condition: "excep", rarity: "unique",
      name: "Survey marker, capped",
      notes: "A brass datum plate on an iron stem, of the pattern this institute has used since 1974. " +
             "The number stamped on the cap is the next accession number in our sequence. " +
             "We have not issued it yet. I am recording this and I am not going to interpret it.",
      beat: "The marker at the floor carries <b>our own next accession number</b>. Somebody filled this shaft, " +
            "in order, from the bottom, and they knew who would dig it out.",
      final: true },
  ];

  /* ---------- log --------------------------------------------------------- */

  function log(S, text, cls) {
    S.log.unshift({ t: text, c: cls || "", at: Math.round(S.depth * 10) / 10 });
    if (S.log.length > 80) S.log.pop();
  }

  /* ---------- milestones --------------------------------------------------
     One-shot notices. They exist to make the first twenty minutes feel like a
     staircase rather than a ramp. */

  const MILESTONES = [
    { id: "firstFind", when: (S) => S.stats.finds >= 1,
      text: "First contact. The crew have something in the matrix." },
    { id: "firstAcc", when: (S) => S.stats.accessioned >= 1,
      text: "The collection has one object in it. Technically, the museum is open.", cls: "good" },
    { id: "firstVisitor", when: (S) => S.stats.visitorsTotal >= 1,
      text: "Somebody came in, looked at everything, and left. Takings: not nothing.", cls: "good" },
    { id: "tenVisitors", when: (S) => S.stats.visitorsTotal >= 10,
      text: "Ten visitors. One of them asked a question you could not answer." },
    { id: "fiveAcc", when: (S) => S.stats.accessioned >= 5,
      text: "Five objects. The room reads as a collection rather than a shelf.", cls: "good" },
    { id: "hundred", when: (S) => S.depth >= 100,
      text: "One hundred metres. No natural process puts this much fill in one place." },
    { id: "twoCultures", when: (S, sv) => sv.cultures >= 3,
      text: "Three traditions on display, from one hole in one field. Visitors have started noticing.", cls: "good" },
    { id: "star1", when: (S, sv) => sv.rating >= 20,
      text: "One star. A genuine regional museum.", cls: "good" },
    { id: "star2", when: (S, sv) => sv.rating >= 40,
      text: "Two stars. The county has put you on the road signs.", cls: "good" },
    { id: "star3", when: (S, sv) => sv.rating >= 60,
      text: "Three stars. There are coaches in the car park.", cls: "good" },
    { id: "star4", when: (S, sv) => sv.rating >= 80,
      text: "Four stars. People are flying in for the deep gallery.", cls: "good" },
    { id: "deep", when: (S) => S.depth >= 320,
      text: "Below three hundred metres the fill goes cold and the finds stop being ordinary.", cls: "warn" },
    { id: "dark", when: (S) => S.depth >= 410,
      text: "The long dark. Everything from here is older than our species is good at.", cls: "warn" },
    { id: "unattr", when: (S) => S.depth >= 515,
      text: "Unattributed deposit. The catalogue has stopped naming things.", cls: "warn" },
    { id: "floor", when: (S) => S.depth >= 640,
      text: "Deposit floor. The fill below is sterile — no pollen, no fauna, no organic content. " +
            "It did not settle here. It was brought.", cls: "warn" },
  ];

  /* `sv` is passed in when the caller already has one — the survey is O(n) over
     the collection and this runs every tick. */
  function checkMilestones(S, sv) {
    sv = sv || S7.museum.survey(S);
    for (const m of MILESTONES) {
      if (S.milestones[m.id]) continue;
      if (!m.when(S, sv)) continue;
      S.milestones[m.id] = true;
      log(S, m.text, m.cls);
    }
  }

  /* ---------- find generation --------------------------------------------- */

  function nextSeed(S) {
    /* Deterministic per accession, so a save reproduces exactly what you saw. */
    return S7.hashString(S.seed + ":" + S.accession + ":" + Math.round(S.depth * 10));
  }

  function mintFind(S, depth, opts) {
    S.accession++;
    const a = S7.artifacts.makeArtifact(nextSeed(S), depth, Object.assign({
      condBonus: S.bonus.condition,
      rareBonus: S.bonus.rarity,
    }, opts || {}));
    a.no = String(S.accession).padStart(3, "0");
    /* Later sites are richer ground — the deposits get better, not just bigger. */
    a.significance = Math.round(a.significance * S7.state.siteBonus(S) * 10) / 10;
    return a;
  }

  /* ---------- sites --------------------------------------------------------
     The prestige loop. The shaft is disposable; the museum is not. Opening a
     new site resets depth and every piece of site equipment, keeps the whole
     collection, the museum, and the research, and pays a standing bonus. */

  const SITE_NAMES = ["Site 7", "Site 3", "Site 12", "Site 22", "Site 41",
                      "Site 58", "Site 90", "Site 114"];

  const siteName = (S) => SITE_NAMES[Math.min(SITE_NAMES.length - 1, (S.sites || 1) - 1)] +
    ((S.sites || 1) > SITE_NAMES.length ? " (" + S.sites + ")" : "");

  const canOpenNewSite = (S) => !!S.milestones.ending;

  function openNewSite(S) {
    if (!canOpenNewSite(S)) return false;
    S.sites = (S.sites || 1) + 1;
    S.depth = 0;
    S.funds = 0;
    S.nextFindAt = 4;
    S.active = null;
    S.pending = null;
    S.stamTimer = 0;
    for (const u of S7.upgrades.EXCAVATION) S.up[u.id] = 0;
    /* Milestones about depth fire again at the new site; the museum ones do not. */
    for (const id of ["hundred", "deep", "dark", "unattr", "floor", "exhausted"])
      delete S.milestones[id];
    S7.state.recompute(S);
    S.stamina = S.maxStam;
    log(S, "<b>" + siteName(S) + "</b> opened. The geophysics came back the same way. " +
           "The collection travels with you; the equipment does not.", "good");
    return true;
  }

  function keystoneDue(S) {
    const k = KEYSTONES[S.keyIdx];
    return k && S.depth >= k.depth ? k : null;
  }

  function mintKeystone(S, k) {
    return mintFind(S, k.depth, {
      culture: k.culture, kind: k.kind, objectType: k.objectType,
      condition: k.condition, rarity: k.rarity,
      name: k.name, notes: k.notes, keystone: true,
    });
  }

  /* ---------- excavation --------------------------------------------------- */

  function beginDig(S, artifact) {
    /* The clearing order is noise-sorted so the matrix comes away in patches
       rather than in scanlines. */
    const order = [];
    const r = S7.rng(artifact.seed ^ 0x51ed270b);
    for (let i = 0; i < GRID * GRID; i++)
      order.push([i, S7.raster.fbm((i % GRID) * 0.42, ((i / GRID) | 0) * 0.42, artifact.seed % 977) + r.f() * 0.12]);
    order.sort((a, b) => a[1] - b[1]);

    S.active = {
      artifact,
      grid: new Uint8Array(GRID * GRID),
      order: order.map((o) => o[0]),
      ptr: 0, cleared: 0, total: GRID * GRID,
      filed: false, filedAt: 0, filedOk: null, filedIdx: null,
      autoTimer: 0,
    };
    S.stats.finds++;
    if (S7.cultures.eraAt(artifact.depth).id === "unattr" ||
        S7.cultures.eraAt(artifact.depth).id === "floor") S.stats.deepFinds++;
    log(S, "<b>" + artifact.depth.toFixed(1) + " m</b> — contact. Something is in the matrix.");
    return S.active;
  }

  /* Player brush stroke. Returns cells revealed. */
  function brush(S, gx, gy) {
    const A = S.active;
    if (!A || S.stamina < 1) return 0;
    const R = S.brushR;
    let hit = 0;
    for (let y = Math.floor(gy - R); y <= gy + R; y++)
      for (let x = Math.floor(gx - R); x <= gx + R; x++) {
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
        if ((x - gx) * (x - gx) + (y - gy) * (y - gy) > R * R + 0.3) continue;
        const i = y * GRID + x;
        if (A.grid[i]) continue;
        A.grid[i] = 1; A.cleared++; hit++;
      }
    if (hit) S.stamina--;
    return hit;
  }

  const exposure = (A) => A.cleared / A.total;

  /* Filing early is the risk: fewer pixels, more Understanding. */
  const multiplierFor = (p) => (p < 0.25 ? 4 : p < 0.45 ? 3 : p < 0.70 ? 2 : 1);

  function fileInterpretation(S, idx) {
    const A = S.active;
    if (!A || A.filed) return;
    A.filed = true;
    A.filedAt = exposure(A);
    A.filedIdx = idx;
    A.filedOk = idx >= 0 ? A.artifact.readings[idx].ok : null;
    S.stats.filed++;
    if (A.filedOk) S.stats.correct++;
    log(S, idx >= 0
      ? "Interpretation filed at " + Math.round(A.filedAt * 100) + "% exposure."
      : "Judgement withheld. The record will note that no interpretation was offered.");
  }

  /* Called when the grid is fully cleared. Moves the dig into `pending`, which
     is what the accession dialog reads. */
  function finishDig(S) {
    const A = S.active;
    if (!A) return null;
    const mult = A.filedIdx !== null && A.filedIdx >= 0 ? multiplierFor(A.filedAt) : 0;
    const base = (3 + A.artifact.depth * 0.05) * A.artifact.condition.mult * A.artifact.rarity.mult;
    const und = Math.round(base * (A.filedOk ? mult : mult * 0.35) *
                           S.mul.understanding * (1 + S.add.understanding));
    S.pending = { artifact: A.artifact, understanding: und, mult, filedOk: A.filedOk, filedIdx: A.filedIdx, filedAt: A.filedAt };
    S.active = null;
    return S.pending;
  }

  /* The player accepts the find into the collection. This is where the boon
     becomes permanent — there is no un-accessioning. */
  function accession(S, onDisplay) {
    const p = S.pending;
    if (!p) return;
    const a = p.artifact;
    a.display = onDisplay !== false;
    S.understanding += p.understanding;
    S7.boons.apply(S, a.boon);
    S.collection.push(a);
    S.stats.accessioned++;
    S.pending = null;
    log(S, "Item " + a.no + " accessioned — " + a.name.toLowerCase() + ". " +
           S7.boons.text(a.boon) + ".", "good");
    if (a.keystone) {
      const k = KEYSTONES.find((x) => x.name === a.name);
      if (k) log(S, k.beat, "warn");
      if (k && k.final) S.milestones.ending = true;
    }
    checkMilestones(S);
  }

  /* ---------- the door -------------------------------------------------------
     One visitor, through the entrance, ticket paid. This is the only place gate
     money enters the game — there is no continuous income trickle any more. */

  function admit(S, sv) {
    const extra = S7.museum.secondarySpend(S, sv);
    S.funds += S.admission + extra;
    S.today.visitors += 1;
    S.today.gate += S.admission;
    S.today.extra += extra;
    S.stats.visitorsTotal += 1;
    S.stats.gateTotal += S.admission;
    S.stats.earned += S.admission + extra;
    /* The gallery walks one of these in through the front door when it can keep
       up; the queue is capped so a busy day does not stack up thousands of
       unwalked arrivals. */
    if (S.pendingArrivals < 40) S.pendingArrivals++;
  }

  function closeBooks(S) {
    const t = S.today;
    S.yesterday = { day: S.day, visitors: t.visitors, gate: t.gate, extra: t.extra };
    S.history.push(S.yesterday);
    if (S.history.length > 14) S.history.shift();
    S.stats.bestDay = Math.max(S.stats.bestDay || 0, t.gate + t.extra);
    if (t.visitors > 0)
      log(S, "<b>Day " + S.day + " closed.</b> " + Math.round(t.visitors) +
             " through the door — " + Math.round(t.gate) + " on admissions, " +
             Math.round(t.extra) + " in the shop and café.", "good");
  }

  /* The museum clock, the door, and the till. Returns the survey so the caller
     does not have to compute it twice. */
  function runMuseum(S, dt) {
    const sv = S7.museum.survey(S);
    const wasOpen = S7.museum.isOpen(S);

    /* The Institute grant runs whether or not anyone came. */
    const standing = S7.museum.standingIncome(S) * dt;
    S.funds += standing;
    S.stats.earned += standing;

    if (wasOpen) {
      S.arrivalAcc += S7.museum.arrivalRate(S, sv) * dt * S7.museum.clockRate(S);
      let guard = 0;
      while (S.arrivalAcc >= 1 && guard++ < 500) { S.arrivalAcc -= 1; admit(S, sv); }
      if (guard >= 500) S.arrivalAcc = 0;          /* absurd rate; do not spin */
    }

    S.minute += dt * S7.museum.clockRate(S);
    if (S.minute >= S7.museum.DAY_MINUTES) { S.minute -= S7.museum.DAY_MINUTES; S.day++; }

    const nowOpen = S7.museum.isOpen(S);
    if (wasOpen && !nowOpen) closeBooks(S);
    if (!wasOpen && nowOpen) {
      S.today = { visitors: 0, gate: 0, extra: 0 };
      S.arrivalAcc = 0;
      if (sv.count > 0) log(S, "Day " + S.day + ". Doors open at nine.");
    }
    return sv;
  }

  /* ---------- the tick ----------------------------------------------------- */

  function step(S, dt) {
    if (!S.started) return;
    S.stats.playtime += dt;

    const sv = runMuseum(S, dt);

    /* brush charges */
    if (S.stamina < S.maxStam) {
      S.stamTimer += dt;
      const period = S7.state.staminaPeriod(S);
      while (S.stamTimer >= period && S.stamina < S.maxStam) { S.stamTimer -= period; S.stamina++; }
    }

    if (S.pending) { checkMilestones(S, sv); return; }   /* waiting on the player */

    if (S.active) {
      const A = S.active;
      A.autoTimer += dt * S7.state.clearRate(S);
      while (A.autoTimer >= 1 && A.cleared < A.total) {
        A.autoTimer -= 1;
        while (A.ptr < A.order.length && A.grid[A.order[A.ptr]]) A.ptr++;
        if (A.ptr < A.order.length) { A.grid[A.order[A.ptr]] = 1; A.cleared++; A.ptr++; }
      }
      if (A.cleared >= A.total) finishDig(S);
    } else if (!S7.state.atFloor(S)) {
      S.depth = Math.min(S7.cultures.MAX_DEPTH, S.depth + S7.state.descentRate(S) * dt);
      const k = keystoneDue(S);
      if (k) {
        S.depth = k.depth;
        S.keyIdx++;
        S.nextFindAt = S.depth + S7.state.findGap(S);
        beginDig(S, mintKeystone(S, k));
      } else if (S.depth >= S.nextFindAt) {
        S.nextFindAt = S.depth + S7.state.findGap(S);
        beginDig(S, mintFind(S, S.depth));
      }
    } else if (!S.milestones.exhausted) {
      S.milestones.exhausted = true;
      log(S, "Bedrock. The deposit is exhausted and the shaft will not go further. " +
             "The museum keeps its doors open; the drill has nowhere left to be.", "warn");
    }
    checkMilestones(S, sv);
  }

  /* ---------- offline ------------------------------------------------------
     Away time is worth half rate, capped at twelve hours. Finds encountered
     while away are excavated and accessioned by the crew — no interpretation
     bonus, because you were not there to file one. */

  const OFFLINE_CAP = 12 * 3600;
  /* One full cycle of the museum clock in real seconds: 480 open, then the
     night at 16x. */
  const CYCLE_SECONDS = S7.museum.OPEN_MINUTES + (S7.museum.DAY_MINUTES - S7.museum.OPEN_MINUTES) / S7.museum.NIGHT_SPEED;

  function catchUp(S, seconds) {
    const t = Math.min(OFFLINE_CAP, Math.max(0, seconds));
    if (t < 60 || !S.started) return null;
    const rate = 0.5 * S.mul.offline * (1 + S.add.offline);
    const report = { seconds: t, funds: 0, depth: 0, finds: [], days: 0, visitors: 0 };

    /* Coarse integration: one step a minute is plenty for an idle curve, and
       keeps a twelve-hour absence under a thousand iterations. */
    const stepSize = 60;
    for (let elapsed = 0; elapsed < t; elapsed += stepSize) {
      const sv = S7.museum.survey(S);
      /* Days, not seconds: a chunk of stepSize real seconds is that fraction
         of a museum day, and a day is worth a day's admissions. */
      const days = (stepSize / CYCLE_SECONDS) * rate;
      const v = S7.museum.visitorsPerDay(S, sv) * days;
      const gain = v * S7.museum.perVisitor(S, sv) + S7.museum.standingIncome(S) * stepSize * rate;
      S.funds += gain; S.stats.earned += gain; report.funds += gain;
      S.stats.visitorsTotal += v;
      S.stats.gateTotal += v * S.admission;
      report.days += days;
      report.visitors += v;

      if (S.pending || S.active) continue;    /* a dig left open blocks descent */
      if (S7.state.atFloor(S)) continue;
      const before = S.depth;
      S.depth = Math.min(S7.cultures.MAX_DEPTH, S.depth + S7.state.descentRate(S) * stepSize * rate);
      report.depth += S.depth - before;

      let guard = 0;
      while (guard++ < 8) {
        const k = keystoneDue(S);
        if (k) {
          /* Keystones are never auto-accessioned. The crew leave it half
             excavated and wait for you, and the catch-up stops here. */
          S.depth = k.depth; S.keyIdx++;
          S.nextFindAt = S.depth + S7.state.findGap(S);
          beginDig(S, mintKeystone(S, k));
          return finalise(S, report, elapsed);
        }
        if (S.depth < S.nextFindAt) break;
        S.nextFindAt = S.depth + S7.state.findGap(S);
        const a = mintFind(S, S.depth);
        S.stats.finds++;
        a.display = true;
        S7.boons.apply(S, a.boon);
        S.collection.push(a);
        S.stats.accessioned++;
        report.finds.push(a);
      }
    }
    return finalise(S, report, t);
  }

  function finalise(S, report, elapsed) {
    report.seconds = elapsed;
    /* Move the clock on so the museum does not resume mid-afternoon on a day
       that finished hours ago. */
    S.day += Math.floor(report.days);
    S.today = { visitors: 0, gate: 0, extra: 0 };
    S.minute = S7.museum.OPEN_AT - 5;
    if (report.finds.length)
      log(S, "While the site was unattended the crew lifted and accessioned " +
             report.finds.length + " item" + (report.finds.length === 1 ? "" : "s") + ".");
    checkMilestones(S);
    return report;
  }

  S7.game = {
    CELL, GRID, KEYSTONES, MILESTONES,
    SITE_NAMES, siteName, canOpenNewSite, openNewSite,
    admit, closeBooks, runMuseum,
    log, checkMilestones, mintFind, beginDig, brush, exposure, multiplierFor,
    fileInterpretation, finishDig, accession, step, catchUp,
  };
})(window.S7 = window.S7 || {});
