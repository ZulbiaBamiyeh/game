/* ============================================================================
   BOOT AND LOOP

   Owns the frame, the modals, and the wiring between the DOM and the sim.
   ============================================================================ */
(function (S7) {
  "use strict";
  const V = S7.views, G = S7.game, M = S7.museum, U = S7.upgrades;
  const $ = V.$;

  let S = null;
  let crowd = null;                 /* the people walking around the museum */
  let last = performance.now();
  let saveTimer = 0, uiTimer = 0, idleLine = 0, idleTimer = 0;
  let viewedArtifact = null;

  const show = (id, on) => { $(id).hidden = !on; };

  /* ---------- intro -------------------------------------------------------- */

  function renderIntro() {
    const page = S7.lore.INTRO[S.intro];
    if (!page) { endIntro(); return; }
    $("introbox").innerHTML =
      '<div class="introline">' + page.html +
      '<div class="sig"><span>' + V.esc(page.cta) + '</span>' +
      '<span class="dots">' + S7.lore.INTRO.map((_, i) => (i === S.intro ? "●" : "○")).join(" ") + '</span>' +
      '</div></div>';
    show("m-intro", true);
  }

  function advanceIntro() {
    S.intro++;
    if (S.intro >= S7.lore.INTRO.length) endIntro();
    else renderIntro();
  }

  function endIntro() {
    show("m-intro", false);
    if (!S.started) {
      S.started = true;
      G.log(S, "Shaft opened at Site 7. One drill, one digger, and a room in town.");
      G.log(S, "Institute expects a preliminary report inside the year.");
    }
    refreshAll();
  }

  /* ---------- tabs ---------------------------------------------------------- */

  function setTab(name) {
    S.tab = name;
    for (const b of $("tabs").querySelectorAll("button"))
      b.classList.toggle("on", b.getAttribute("data-tab") === name);
    for (const id of ["site", "museum", "research", "log"])
      show("v-" + id, id === name);
    S7.audio.setZone(name === "log" ? null : name);
    refreshAll();
  }

  /* ---------- sound toggle ---------------------------------------------------- */

  function renderMuteButton() {
    const b = $("btn-mute");
    const on = S7.audio.isEnabled();
    b.textContent = "Sound: " + (on ? "on" : "off");
    b.classList.toggle("muted", !on);
  }

  /* ---------- purchases ------------------------------------------------------ */

  function buy(id) {
    const u = U.ALL[id];
    if (!u) return;
    const cost = U.cost(S, u);
    if (S.funds < cost || (S.up[id] || 0) >= u.max) return;
    S.funds -= cost;
    S.up[id] = (S.up[id] || 0) + 1;
    if (u.eff) u.eff(S);
    /* Museum amenity purchases change the floor plan; force a rebuild so the
       café, wing, or gift shop appears on the next frame rather than after a
       rehang. */
    if (S7.upgrades.MUSEUM.some((m) => m.id === id)) S7.galleryView.invalidate();
    G.log(S, u.name + " — level " + S.up[id] + ".");
    refreshAll();
  }

  function buyResearch(id) {
    const r = U.RESEARCH.find((x) => x.id === id);
    if (!r || S.research[id] || S.understanding < r.cost) return;
    S.understanding -= r.cost;
    S.research[id] = true;
    const eff = U.RESEARCH_EFF[id];
    if (eff) eff(S);
    G.log(S, "Research: " + r.name + ".", "good");
    refreshAll();
  }

  /* Admission steps in halves under a fiver and whole units above it, which is
     how museums actually price. */
  function setPrice(dir) {
    const step = S.admission < 5 ? 0.5 : S.admission < 20 ? 1 : 5;
    S.admission = Math.max(0, Math.round((S.admission + dir * step) * 2) / 2);
    refreshAll();
  }

  function newSite() {
    if (!G.canOpenNewSite(S)) return;
    if (!window.confirm("Close " + G.siteName(S) + " and open " + V.nextSite(S) +
        "?\n\nDepth and all site equipment reset. The collection, the museum and the " +
        "research are permanent, and every rate gains a standing +45%.")) return;
    G.openNewSite(S);
    setTab("site");
  }

  /* ---------- excavation ----------------------------------------------------- */

  const HINT = "The crew are clearing the matrix. Brush anywhere to expose a particular " +
               "area before you commit to a reading.";
  let hintTimer = 0;
  function flashHint(t) { $("dig-hint").textContent = t; hintTimer = 2.6; }

  function onBrush(cell) {
    if (!S.active) return;
    if (S.stamina < 1) { flashHint("No brush charges left. The crew keep clearing regardless."); return; }
    const hit = G.brush(S, cell.gx, cell.gy);
    if (hit) S7.digView.puff(cell.px, cell.py, S7.cultures.eraAt(S.active.artifact.depth).ramp);
  }

  function openInterpret() {
    const A = S.active;
    if (!A || A.filed) return;
    const p = G.exposure(A);
    const mult = G.multiplierFor(p);
    /* Preview what a correct filing right now would pay. */
    const preview = Math.max(1, Math.round(
      G.understandingBase(A.artifact) * mult *
      S.mul.understanding * (1 + S.add.understanding)));
    $("i-prompt").textContent = describe(A.artifact);
    $("i-reveal").textContent = Math.round(p * 100) + "% exposed · correct reading now ≈ " +
      V.fmt(preview) + " Understanding (" + mult + "×)";
    let readings = A.artifact.readings;
    if (S.research.typology && readings[readings.length - 1].ok) {
      /* A typology means the correct reading is never the last one you read. */
      readings = readings.slice();
      const t = readings[0]; readings[0] = readings[readings.length - 1]; readings[readings.length - 1] = t;
      A.artifact.readings = readings;
    }
    $("i-opts").innerHTML = readings.map((o, i) =>
      '<button class="action" data-opt="' + i + '"><span class="bt">' + V.esc(o.t) + '</span></button>').join("");
    for (const b of $("i-opts").querySelectorAll("[data-opt]"))
      b.addEventListener("click", () => {
        G.fileInterpretation(S, parseInt(b.getAttribute("data-opt"), 10));
        show("m-interp", false);
        refreshAll();
      });
    show("m-interp", true);
  }

  /* A one-line description of what is visible so far, while still half buried. */
  function describe(a) {
    if (a.kind === "painting") return "A painted surface, only partly uncovered.";
    if (a.kind === "sculpture") return "A carved form in " + S7.artifacts.materialLabel(a.material).toLowerCase() + ".";
    return "Something " + S7.artifacts.materialLabel(a.material).toLowerCase() + ", still in the ground.";
  }

  /* ---------- the accession dialog -------------------------------------------- */

  function openFound() {
    const p = S.pending;
    if (!p) return;
    const a = p.artifact;
    const uLine = '<div class="uaward"><span>Understanding</span><b>+' +
      V.fmt(p.understanding) + '</b></div>';
    let v;
    if (p.filedIdx === null || p.filedIdx < 0)
      v = '<div class="verd">No interpretation was filed. The find still teaches something ' +
          'from being lifted and catalogued — file next time for a larger award.</div>' + uLine;
    else if (p.filedOk)
      v = '<div class="verd good">Your reading holds. Filed at ' + Math.round(p.filedAt * 100) +
          '% exposure — ' + p.mult + '× award.</div>' + uLine;
    else
      v = '<div class="verd bad">Your reading does not survive full exposure. Partial credit ' +
          'for the attempt. Correct: ' +
          V.esc(a.readings.filter((o) => o.ok)[0].t.toLowerCase()) + '.</div>' + uLine;

    $("f-verdict").innerHTML = v;
    $("f-record").innerHTML = V.recordHTML(S, a);
    $("f-boon").innerHTML = V.boonHTML(a.boon, "Study result",
      "condition: " + a.condition.n.toLowerCase() + (p.filedOk ? ". Your correct filing sharpened the analysis." : "."));
    V.paintRecords($("f-record"), S);
    show("m-found", true);
  }

  function doAccession(display) {
    G.accession(S, display);
    show("m-found", false);
    if (S.milestones.ending && !S.milestones.endingShown) {
      S.milestones.endingShown = true;
      $("introbox").innerHTML = '<div class="introline">' + S7.lore.ENDING +
        '<div class="sig"><span>Close the file</span></div></div>';
      S.intro = S7.lore.INTRO.length;
      show("m-intro", true);
    }
    refreshAll();
  }

  /* ---------- artifact record viewer ------------------------------------------- */

  function openArtifact(a) {
    if (!a) return;
    viewedArtifact = a;
    $("v-record").innerHTML = V.recordHTML(S, a) +
      V.boonHTML(a.boon, "In effect, permanently", null);
    V.paintRecords($("v-record"), S);
    $("v-toggle").querySelector(".bt").textContent =
      a.display === false ? "Put on display" : "Move to store";
    show("m-view", true);
  }

  /* ---------- offline report ---------------------------------------------------- */

  function showOffline(report) {
    if (!report) return;
    let html = '<p class="hint">The site ran without you for ' + V.fmtTime(report.seconds) +
      '. Away time is worth half rate.</p>';
    html += '<div class="offrow"><span>Funding banked</span><span>' + V.fmt(report.funds) + '</span></div>';
    html += '<div class="offrow"><span>Descended</span><span>' + report.depth.toFixed(1) + ' m</span></div>';
    html += '<div class="offrow"><span>Lifted and accessioned</span><span>' + report.finds.length + '</span></div>';
    if (report.understanding)
      html += '<div class="offrow"><span>Understanding from finds</span><span>+' +
        V.fmt(report.understanding) + '</span></div>';
    if (report.finds.length) {
      html += '<div class="offgrid">' + report.finds.slice(0, 24).map((a) =>
        '<canvas width="64" height="64" data-rec="' + a.no + '"></canvas>').join("") + '</div>';
      html += '<p class="hint" style="margin-top:9px">No interpretations were filed for these — you were ' +
        'not there to file them. The study results still apply.</p>';
    }
    $("o-body").innerHTML = html;
    V.paintRecords($("o-body"), S);
    show("m-offline", true);
  }

  /* ---------- menu ------------------------------------------------------------- */

  function openMenu() {
    $("menu-body").innerHTML =
      '<p class="hint">Progress saves to this browser automatically. The save is a short ' +
      'text string — every artifact is stored as the seed that generated it.</p>' +
      '<div class="rowbtns">' +
      '<button class="action" id="mn-export"><span class="bt">Copy save to clipboard</span></button>' +
      '<button class="action" id="mn-import"><span class="bt">Restore from a save string</span></button>' +
      '</div>' +
      '<div class="rowbtns"><button class="action" id="mn-wipe">' +
      '<span class="bt dangerous">Abandon Site 7 and start again</span>' +
      '<span class="bd">Deletes the collection. There is no undo.</span></button></div>';

    $("mn-export").addEventListener("click", () => {
      const text = S7.save.exportText(S);
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => window.prompt("Save string:", text));
      else window.prompt("Save string:", text);
    });
    $("mn-import").addEventListener("click", () => {
      const text = window.prompt("Paste a save string:");
      if (!text) return;
      const loaded = S7.save.importText(text);
      if (!loaded) { window.alert("That save string could not be read."); return; }
      S = loaded;
      show("m-menu", false);
      refreshAll();
    });
    $("mn-wipe").addEventListener("click", () => {
      if (!window.confirm("Abandon the survey and delete the collection?")) return;
      S7.save.wipe();
      S = S7.state.fresh((Math.random() * 4294967296) >>> 0);
      show("m-menu", false);
      renderIntro();
      refreshAll();
    });
    show("m-menu", true);
  }

  /* ---------- the gallery floor --------------------------------------------------- */

  /* The label under the floor: what you just clicked on. Written the way a
     gallery label is written — name, where it is from, a short note — not a
     dump of every field on the accession card. Room intro boards pass
     `{ board:true, room }` instead of an artifact. */
  function showCaption(sel) {
    const box = $("gal-caption");
    if (!sel) {
      box.innerHTML = '<p class="caphint">Click a piece to read its label, or a room board for the era. ' +
        'Double-click a piece for the full record.</p>';
      return;
    }
    if (sel.board && sel.room) {
      showRoomCaption(sel.room);
      return;
    }
    const a = sel;
    const cu = S7.cultures.byId[a.cultureId];
    const phys = S7.artifacts.physical(a);
    const where = cu
      ? (cu.name + (cu.period && cu.period !== "—" ? ", " + cu.period : ""))
      : "No accepted source";
    const facts = [
      "Item " + a.no,
      a.condition.n,
      a.rarity.n,
      "found at " + a.depth.toFixed(1) + " m",
    ];
    if (phys.monumental) facts.push("monumental");
    box.innerHTML =
      '<div class="caprow"><div>' +
      '<p class="capname"><span class="capdot ' + a.rarity.css + '"></span>' + V.esc(a.name) + '</p>' +
      '<p class="capmeta">' + V.esc(where) +
      ' · ' + V.esc(S7.artifacts.materialLabel(a.material)) + '</p>' +
      '<p class="capnote">' + V.esc(facts.join(" · ")) + '</p>' +
      '<p class="capnote capdesc">' + V.esc(a.notes) + '</p>' +
      '</div>' +
      '<button class="action" id="cap-open" style="width:auto;flex:none">' +
      '<span class="bt">Full record</span></button></div>';
    const btn = $("cap-open");
    if (btn) btn.addEventListener("click", () => openArtifact(a));
  }

  /* Intro board click: the era this gallery covers, and which traditions the
     pieces on these walls actually come from. */
  function showRoomCaption(room) {
    const box = $("gal-caption");
    const era = room.era || {};
    const exhibits = room.exhibits || [];
    const byCulture = new Map();
    let minD = Infinity, maxD = -Infinity;
    for (const e of exhibits) {
      const a = e.a;
      const id = a.cultureId || "?";
      if (!byCulture.has(id)) byCulture.set(id, { n: 0, depths: [] });
      const row = byCulture.get(id);
      row.n++;
      row.depths.push(a.depth);
      if (a.depth < minD) minD = a.depth;
      if (a.depth > maxD) maxD = a.depth;
    }
    const sources = [...byCulture.entries()]
      .map(([id, row]) => {
        const cu = S7.cultures.byId[id];
        const name = cu ? cu.name : "Unknown tradition";
        const period = cu && cu.period && cu.period !== "—" ? cu.period : null;
        const line = name + (period ? " (" + period + ")" : "") +
          " — " + row.n + (row.n === 1 ? " piece" : " pieces");
        return { line, n: row.n };
      })
      .sort((p, q) => q.n - p.n);

    /* Depth band of this era from the table, if we know it. */
    const eraDef = S7.cultures.ERAS.find((e) => e.id === era.id);
    let band = era.period || "";
    if (eraDef) {
      const from = eraDef === S7.cultures.ERAS[0] ? 0
        : S7.cultures.ERAS[S7.cultures.ERAS.indexOf(eraDef) - 1].to;
      const to = eraDef.to >= 1e8 ? S7.cultures.MAX_DEPTH : eraDef.to;
      band = era.period + " · " + from + "–" + to + " m in the shaft";
    }

    let html =
      '<div class="caprow"><div>' +
      '<p class="capname">' + V.esc(era.name || "Gallery") + '</p>' +
      '<p class="capmeta">' + V.esc(band) + '</p>' +
      '<p class="capnote">' + exhibits.length +
      (exhibits.length === 1 ? " piece on these walls" : " pieces on these walls");
    if (exhibits.length && isFinite(minD))
      html += " · lifted between " + minD.toFixed(1) + " m and " + maxD.toFixed(1) + " m";
    html += "</p>";

    if (sources.length) {
      html += '<p class="capnote capdesc"><b>Finds in this room come from</b></p><ul class="capsources">';
      for (const s of sources.slice(0, 8))
        html += "<li>" + V.esc(s.line) + "</li>";
      if (sources.length > 8)
        html += "<li>…and " + (sources.length - 8) + " more</li>";
      html += "</ul>";
    } else {
      html += '<p class="capnote capdesc">Nothing on the walls yet.</p>';
    }
    html += "</div></div>";
    box.innerHTML = html;
  }

  function renderRoomBar() {
    const rooms = S7.galleryView.rooms();
    const here = S7.galleryView.currentRoom();
    $("gal-room").textContent = here ? here.era.name : "—";
    $("gal-period").textContent = here && here.era.period ? here.era.period : "";

    /* Floor switcher */
    const floorsEl = $("gal-floors");
    if (floorsEl) {
      const maxF = rooms.reduce((m, r) => Math.max(m, r.floor || 0), 0);
      const sigF = String(maxF);
      if (floorsEl.dataset.sig !== sigF) {
        floorsEl.dataset.sig = sigF;
        floorsEl.innerHTML = "";
        if (maxF > 0) {
          for (let f = maxF; f >= 0; f--) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "galfloor";
            b.textContent = f === 0 ? "Ground" : f === 1 ? "Upper" : "Floor " + f;
            b.addEventListener("click", () => S7.galleryView.goToFloor(f));
            floorsEl.appendChild(b);
          }
        }
      }
      const hereF = here ? (here.floor || 0) : 0;
      floorsEl.querySelectorAll(".galfloor").forEach((b, i, arr) => {
        const f = maxF - i;
        b.classList.toggle("on", f === hereF);
      });
    }

    /* Compact room chips — no dropdown. */
    const map = $("gal-map");
    const sig = rooms.map((r) => r.era.id + ":" + (r.floor || 0) + ":" +
      (r.exhibits ? r.exhibits.length : 0)).join("|");
    if (map.dataset.sig !== sig) {
      map.dataset.sig = sig;
      map.innerHTML = "";
      rooms.forEach((r, i) => {
        const n = r.exhibits ? r.exhibits.length : 0;
        const label = (r.era.short || r.era.name || "Room").replace(/ horizon$/i, "");
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "galchip" +
          (r.featured ? " featured" : "") +
          (r.foyer ? " foyer" : "") +
          (r.shop || r.cafe ? " amenity" : "") +
          (r.stairs ? " stairs" : "");
        chip.innerHTML = "<b>" + V.esc(label) + "</b>" +
          (n ? "<span>" + n + "</span>" :
            r.foyer || r.amenity || r.stairs ? "<span>" +
              (r.floor ? "↑" : "·") + "</span>" : "<span>—</span>");
        chip.title = r.era.name + (r.era.period ? " · " + r.era.period : "") +
          (r.floor ? " · upper floor" : "");
        chip.addEventListener("click", () => S7.galleryView.goToRoom(i));
        map.appendChild(chip);
      });
    }
    const chips = map.querySelectorAll(".galchip");
    rooms.forEach((r, i) => {
      if (chips[i]) chips[i].classList.toggle("on", r === here);
    });
    if (here) {
      const hi = rooms.indexOf(here);
      if (hi >= 0) {
        const onChip = chips[hi];
        if (onChip && onChip.scrollIntoView)
          onChip.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    }

    const sv = M.survey(S);
    $("gal-crowd").textContent = sv.count === 0
      ? "closed to the public"
      : !M.isOpen(S)
        ? "closed · doors open at nine"
        : crowd.agents.length + " in the building · " + Math.round(S.today.visitors) +
          " through the door today";
  }

  /* ---------- refresh ------------------------------------------------------------ */

  function refreshAll() {
    V.renderStats(S);
    V.renderLog(S);
    if (S.tab === "site") V.renderShops(S, buy);
    if (S.tab === "museum") {
      V.renderShops(S, buy);
      V.renderMuseum(S, openArtifact);
      for (const b of document.querySelectorAll("[data-price]"))
        b.addEventListener("click", () => setPrice(parseInt(b.getAttribute("data-price"), 10)));
    }
    if (S.tab === "research") V.renderResearch(S, buyResearch, newSite);
  }

  /* Cheap per-frame updates: the things that change every tick. */
  function refreshLive() {
    V.renderStats(S);
    const digging = !!S.active;
    show("digpanel", digging);
    $("c-shaft").hidden = digging;
    $("c-dig").hidden = !digging;

    if (digging) {
      const A = S.active;
      $("ov-l").textContent = "Excavating · item " + A.artifact.no;
      $("ov-r").textContent = Math.round(G.exposure(A) * 100) + "% exposed";
      $("progbar").style.width = (100 * G.exposure(A)) + "%";
      show("btn-interpret", !A.filed && G.exposure(A) >= 0.12);
      const st = $("stam");
      if (st.children.length !== S.maxStam) {
        st.innerHTML = "";
        for (let i = 0; i < S.maxStam; i++) st.appendChild(document.createElement("i"));
      }
      for (let i = 0; i < S.maxStam; i++) st.children[i].className = i < S.stamina ? "on" : "";
    } else {
      $("ov-l").textContent = S7.lore.IDLE_LINES[idleLine];
      const era = S7.cultures.eraAt(S.depth);
      $("ov-r").textContent = S7.lore.ERA_NOTE[era.id] || "";
      const gap = S7.state.findGap(S);
      const prev = S.nextFindAt - gap;
      $("progbar").style.width = Math.max(0, Math.min(100, 100 * (S.depth - prev) / gap)) + "%";
    }
  }

  /* ---------- the frame ---------------------------------------------------------- */

  function tick(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;

    if (S.started) {
      const hadPending = !!S.pending;
      G.step(S, dt);
      if (!hadPending && S.pending) openFound();
    }

    if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $("dig-hint").textContent = HINT; }
    idleTimer += dt;
    if (idleTimer > 4) { idleTimer = 0; idleLine = (idleLine + 1) % S7.lore.IDLE_LINES.length; }

    if (S.tab === "site") {
      if (S.active) S7.digView.draw(S, dt);
      else S7.shaftView.draw(S, dt);
      show("shaft-recenter", !S.active && S7.shaftView.isPanned());
    } else if (S.tab === "museum") {
      /* The crowd only exists while you are looking at it. Nobody is
         simulating footsteps behind the Research tab. */
      S7.visitors.step(crowd, S, dt, S7.visitors.getLayout(S));
      S7.galleryView.draw(S, crowd, dt);
      renderRoomBar();
    }

    refreshLive();

    uiTimer += dt;
    if (uiTimer > 0.5) { uiTimer = 0; refreshAll(); }

    saveTimer += dt;
    if (saveTimer > 12) {
      saveTimer = 0;
      if (S7.save.save(S)) {
        const f = $("saveflag");
        f.classList.add("on");
        setTimeout(() => f.classList.remove("on"), 900);
      }
    }

    requestAnimationFrame(tick);
  }

  /* ---------- boot ---------------------------------------------------------------- */

  function boot() {
    const loaded = S7.save.load();
    let report = null;
    if (loaded) {
      S = loaded.state;
      report = G.catchUp(S, loaded.away);
    } else {
      S = S7.state.fresh((Math.random() * 4294967296) >>> 0);
    }

    S7.shaftView.init($("c-shaft"));
    S7.digView.init($("c-dig"), onBrush);
    S7.galleryView.init($("c-gallery"), {
      onOpen: openArtifact,
      onSelect: showCaption,
    });
    crowd = S7.visitors.create(S.seed ^ 0x5bf03635);

    $("app").hidden = false;
    $("dig-hint").textContent = HINT;

    for (const b of $("tabs").querySelectorAll("button"))
      b.addEventListener("click", () => setTab(b.getAttribute("data-tab")));

    $("btn-interpret").addEventListener("click", openInterpret);
    $("i-skip").addEventListener("click", () => {
      G.fileInterpretation(S, -1);
      show("m-interp", false);
      refreshAll();
    });
    $("f-display").addEventListener("click", () => doAccession(true));
    $("f-store").addEventListener("click", () => doAccession(false));
    $("v-close").addEventListener("click", () => show("m-view", false));
    $("v-toggle").addEventListener("click", () => {
      if (!viewedArtifact) return;
      viewedArtifact.display = viewedArtifact.display === false;
      openArtifact(viewedArtifact);
      refreshAll();
    });
    $("o-ok").addEventListener("click", () => show("m-offline", false));
    $("shaft-recenter").addEventListener("click", () => S7.shaftView.recenter());
    $("gal-prev").addEventListener("click", () => S7.galleryView.nudge(-1));
    $("gal-next").addEventListener("click", () => S7.galleryView.nudge(1));
    S7.audio.init();
    renderMuteButton();
    $("btn-mute").addEventListener("click", () => {
      S7.audio.setEnabled(!S7.audio.isEnabled());
      renderMuteButton();
    });
    $("btn-menu").addEventListener("click", openMenu);
    $("mn-close").addEventListener("click", () => show("m-menu", false));
    $("introbox").addEventListener("click", () => {
      if (S.intro >= S7.lore.INTRO.length) { show("m-intro", false); return; }
      advanceIntro();
    });

    window.addEventListener("keydown", (e) => {
      if (S.tab !== "museum") return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") { S7.galleryView.nudge(-1); e.preventDefault(); }
      if (e.key === "ArrowRight") { S7.galleryView.nudge(1); e.preventDefault(); }
    });

    window.addEventListener("beforeunload", () => S7.save.save(S));
    document.addEventListener("visibilitychange", () => { if (document.hidden) S7.save.save(S); });

    setTab(S.tab || "site");
    if (!S.started) renderIntro();
    else if (S.pending) openFound();
    if (report && (report.funds > 0 || report.finds.length)) showOffline(report);

    refreshAll();
    requestAnimationFrame(tick);
  }

  /* Handles for the smoke test and for anyone poking at this in a console. */
  S7.debug = {
    state: () => S,
    refresh: refreshAll,
    tab: setTab,
    crowd: () => crowd,
    skipTo: (metres) => { S.depth = Math.min(S7.cultures.MAX_DEPTH, metres); refreshAll(); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window.S7 = window.S7 || {});
