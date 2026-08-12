/* ============================================================================
   VIEWS

   Every panel that is made of DOM rather than pixels. Reads state, writes
   markup. Nothing in here mutates the simulation except through S7.game.
   ============================================================================ */
(function (S7) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const M = S7.museum, U = S7.upgrades, A = S7.artifacts, C = S7.cultures;

  /* ---------- formatting -------------------------------------------------- */

  const SUFFIX = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

  function fmt(n) {
    if (!isFinite(n)) return "—";
    const neg = n < 0; n = Math.abs(n);
    if (n < 1000) return (neg ? "-" : "") + (n < 10 ? Math.round(n * 10) / 10 : Math.round(n));
    let i = 0;
    while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
    return (neg ? "-" : "") + (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n)) + SUFFIX[i];
  }

  function fmtTime(s) {
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h) return h + "h " + m + "m";
    if (m) return m + "m " + (s % 60) + "s";
    return s + "s";
  }

  function starString(rating) {
    const st = rating / 20;
    let out = "";
    for (let i = 1; i <= 5; i++) out += st >= i - 0.25 ? "★" : st >= i - 0.75 ? "⯪" : "☆";
    return out;
  }

  /* What the next site will be called, for the prestige button. */
  const nextSite = (S) => S7.game.SITE_NAMES[
    Math.min(S7.game.SITE_NAMES.length - 1, (S.sites || 1))];

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* ---------- stat bar ---------------------------------------------------- */

  function renderStats(S) {
    const sv = M.survey(S);
    $("s-depth").textContent = S.depth.toFixed(1) + " m";
    $("s-rate").textContent = S7.state.descentRate(S).toFixed(2) + " m/s";
    $("s-funds").textContent = fmt(S.funds);
    $("s-inc").textContent = "+" + fmt(M.incomeRate(S, sv)) + "/s";
    $("s-stars").textContent = starString(sv.rating);
    $("s-rating").textContent = sv.rating.toFixed(1) + " / 100";
    const open = M.isOpen(S);
    $("s-vis").textContent = Math.round(S.today.visitors) + " today";
    $("s-vistot").textContent = open
      ? "~" + fmt(M.visitorsPerDay(S, sv)) + "/day · open"
      : "closed · " + fmt(S.stats.visitorsTotal) + " to date";
    $("s-und").textContent = fmt(S.understanding);
    $("s-coll").textContent = S.collection.length + " accessioned";
    $("tab-mus-n").textContent = S.collection.length ? "(" + S.collection.length + ")" : "";

    const h1 = document.querySelector(".topbar h1");
    /* The museum keeps its name; the field code only appears once you open a second site. */
    const title = S.sites > 1
      ? "The Hollow Museum · " + S7.game.siteName(S)
      : "The Hollow Museum";
    if (h1 && h1.textContent !== title) h1.textContent = title;

    const clock = $("s-clock");
    if (clock) {
      clock.textContent = "Day " + S.day + " · " + M.clockText(S);
      clock.classList.toggle("shut", !open);
    }

    const era = C.eraAt(S.depth);
    $("strat-name").textContent = era.name;
    $("strat-period").textContent = era.period;
  }

  /* ---------- shops -------------------------------------------------------- */

  function shopHTML(S, list) {
    let html = "", shown = 0;
    for (const u of list) {
      if (u.unlock && !u.unlock(S)) continue;
      shown++;
      const lvl = S.up[u.id] || 0;
      const cost = U.cost(S, u);
      const maxed = lvl >= u.max;
      const can = !maxed && S.funds >= cost;
      html +=
        '<button class="action' + (can ? " afford" : "") + '" data-buy="' + u.id + '"' +
        (can ? "" : " disabled") + '>' +
        '<span class="bt">' + esc(u.name) +
        (maxed ? '<span class="cost">max</span>'
               : '<span class="cost' + (can ? "" : " no") + '">' + fmt(cost) + '</span>') +
        (lvl ? '<span class="lvl">lv ' + lvl + '</span>' : "") +
        '</span>' +
        '<span class="bd">' + esc(maxed ? "At maximum." : u.desc(lvl)) + '</span>' +
        (lvl === 0 && u.flavour ? '<span class="bf">' + esc(u.flavour) + '</span>' : "") +
        '</button>';
    }
    if (!shown) html = '<p class="hint">Nothing available yet.</p>';
    return html;
  }

  function renderShops(S, buy) {
    $("shop-dig").innerHTML = shopHTML(S, U.EXCAVATION);
    $("shop-mus").innerHTML = shopHTML(S, U.MUSEUM);
    for (const el of document.querySelectorAll("[data-buy]"))
      el.addEventListener("click", () => buy(el.getAttribute("data-buy")));

    const nextLocked = U.EXCAVATION.find((u) => u.unlock && !u.unlock(S));
    $("exp-note").textContent = nextLocked ? "more unlocks as the survey progresses" : "";
  }

  function renderResearch(S, buyResearch, onNewSite) {
    /* Understanding meter — the currency of this tab, front and centre. */
    const nextRes = U.RESEARCH.find((r) => !S.research[r.id]);
    const uHave = S.understanding;
    const uNeed = nextRes ? nextRes.cost : 0;
    const uPct = nextRes ? Math.min(100, Math.round(100 * uHave / Math.max(1, uNeed))) : 100;
    let html =
      '<div class="resmeter">' +
      '<div class="resmeter-top"><span>Understanding</span><span>' +
      fmt(uHave) + (nextRes ? " / " + fmt(uNeed) : "") + "</span></div>" +
      '<div class="resbar"><i style="width:' + uPct + '%"></i></div>' +
      '<p class="reshint">' +
      (nextRes
        ? (uHave >= uNeed
          ? "Ready to buy: " + esc(nextRes.name) + "."
          : fmt(Math.max(0, uNeed - uHave)) + " more to unlock the next line. " +
            "File interpretations while excavating to earn Understanding.")
        : "Every research line is held. The programme is complete.") +
      "</p></div>";

    if (S7.game.canOpenNewSite(S)) {
      html += '<button class="action primary" data-newsite="1">' +
        '<span class="bt">Open ' + esc(nextSite(S)) + '<span class="cost">+45% rates</span></span>' +
        '<span class="bd">' + esc(S7.game.siteName(S)) + ' is finished. Depth and site gear reset; ' +
        'the collection, museum, and research stay.</span>' +
        '<span class="bf">Another field. Another sounding.</span>' +
        '</button>';
    }

    /* Show every completed line, plus the next two still locked — no wall of
       endgame spoilers on day one. */
    let lockedShown = 0;
    for (const r of U.RESEARCH) {
      const owned = !!S.research[r.id];
      if (!owned) {
        if (lockedShown >= 2) continue;
        lockedShown++;
      }
      const can = !owned && uHave >= r.cost;
      const far = !owned && !can;
      const tag = r.tag ? '<span class="restag">' + esc(r.tag) + "</span>" : "";
      html +=
        '<button class="action rescard' + (can ? " afford" : "") + (owned ? " owned" : "") +
        (far ? " locked" : "") + '" data-res="' + r.id + '"' +
        (can ? "" : " disabled") + ">" +
        '<span class="bt">' + tag + esc(owned || !far ? r.name : "Sealed brief") +
        '<span class="cost' + (owned || can ? "" : " no") + '">' +
        (owned ? "held" : fmt(r.cost) + " U") + "</span></span>" +
        '<span class="bd">' + esc(owned || !far ? r.desc
          : "Spend Understanding on the open briefs first.") + "</span>" +
        (owned || !far
          ? '<span class="bf">' + esc(r.flavour) + "</span>"
          : "") +
        "</button>";
    }
    $("researchlist").innerHTML = html;
    for (const el of document.querySelectorAll("[data-res]"))
      el.addEventListener("click", () => buyResearch(el.getAttribute("data-res")));
    const ns = document.querySelector("[data-newsite]");
    if (ns && onNewSite) ns.addEventListener("click", onNewSite);

    /* statistics — keep it short and useful, not a spreadsheet */
    const acc = S.stats.filed ? Math.round(100 * S.stats.correct / S.stats.filed) : 0;
    const rows = [
      ["Site", S7.game.siteName(S)],
      ["Depth", S.depth.toFixed(1) + " m"],
      ["Finds / accessioned", S.stats.finds + " / " + S.stats.accessioned],
      ["On display", M.survey(S).count],
      ["Interpretations", S.stats.filed + (S.stats.filed ? " · " + acc + "% right" : "")],
      ["Visitors to date", fmt(S.stats.visitorsTotal)],
      ["Time on site", fmtTime(S.stats.playtime)],
    ];
    $("statlist").innerHTML = rows.map((r) =>
      '<div class="field"><div class="fk">' + esc(r[0]) + '</div><div class="fv">' + esc(r[1]) + '</div></div>').join("");

    /* Deposit log: only name what you have reached. Future bands stay blank so
       the research tab does not spoil what is under the drill. */
    const here = C.eraAt(S.depth);
    $("eralist").innerHTML = C.ERAS.map((e) => {
      const reached = S.depth >= e.to || e.id === here.id;
      const state = e.id === here.id ? "on" : (S.depth >= e.to ? "past" : "future");
      if (!reached) {
        return '<div class="erarow future">' +
          '<span class="era-unknown">Not yet reached</span>' +
          '<span class="ep">???</span></div>';
      }
      const from = e === C.ERAS[0] ? 0 : C.ERAS[C.ERAS.indexOf(e) - 1].to;
      const to = e.to >= 1e8 ? "…" : String(e.to);
      return '<div class="erarow ' + state + '">' +
        '<span>' + esc(e.name) +
        '<span class="era-depth">' + from + "–" + to + " m</span></span>" +
        '<span class="ep">' + esc(e.period) + "</span></div>";
    }).join("");
  }

  /* ---------- museum ------------------------------------------------------- */

  function renderMuseum(S, openArtifact) {
    const sv = M.survey(S);
    $("m-stars").textContent = starString(sv.rating);
    $("m-rating").textContent = sv.rating.toFixed(1);
    $("m-verdict").textContent = M.verdict(sv);

    const proj = M.projectedDay(S, sv);
    const metrics = [
      ["On display", sv.count],
      ["Traditions", sv.cultures],
      ["Visitors/day", fmt(proj.visitors)],
      ["Admission", fmt(S.admission)],
      ["Per visitor", fmt(M.perVisitor(S, sv))],
      ["A day's take", fmt(proj.gate + proj.extra)],
    ];
    $("m-metrics").innerHTML = metrics.map((m) =>
      '<div><div class="mk">' + esc(m[0]) + '</div><div class="mv">' + esc(m[1]) + '</div></div>').join("");

    renderTill(S, sv);

    const pct = sv.cap ? Math.min(100, 100 * sv.count / sv.cap) : 0;
    const fill = $("capfill");
    fill.style.width = pct + "%";
    fill.classList.toggle("over", sv.count > sv.cap);
    $("m-cap").textContent = sv.count > sv.cap
      ? sv.count + " on display in space for " + sv.cap + " — overcrowding is costing you " +
        Math.round((1 - sv.crowd) * 100) + "% of the rating"
      : sv.count + " on display, space for " + sv.cap;

    /* galleries, grouped by the band the material came from */
    const groups = new Map();
    for (const a of S.collection) {
      const e = C.eraAt(a.depth);
      if (!groups.has(e.id)) groups.set(e.id, { era: e, items: [] });
      groups.get(e.id).items.push(a);
    }
    let html = "";
    if (!S.collection.length)
      html = '<p class="hint">Nothing accessioned yet. The first thing you lift opens the doors.</p>';
    for (const e of C.ERAS) {
      const g = groups.get(e.id);
      if (!g) continue;
      const onShow = g.items.filter((a) => a.display !== false).length;
      html += '<div class="gallery"><div class="plinth"><span>' + esc(e.name) +
        '</span><em>' + esc(e.period) + ' · ' + onShow + " shown / " + g.items.length + '</em></div><div class="grid">';
      for (const a of g.items)
        html += '<button class="cellx' + (a.display === false ? " stored" : "") + '" data-art="' + a.no + '" ' +
          'title="' + esc(a.name) + '">' +
          '<canvas width="64" height="64" data-no="' + a.no + '"></canvas>' +
          '<span class="rq ' + a.rarity.css + '"></span>' +
          '<span class="cn">' + a.no + '</span></button>';
      html += '</div></div>';
    }
    $("galleries").innerHTML = html;
    $("gal-note").textContent = S.collection.length
      ? "click a piece to read the record" : "";

    const byNo = new Map(S.collection.map((a) => [a.no, a]));
    for (const cv of $("galleries").querySelectorAll("canvas[data-no]")) {
      const a = byNo.get(cv.getAttribute("data-no"));
      if (!a) continue;
      const g = cv.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(A.spriteFor(a), 0, 0);
    }
    for (const b of $("galleries").querySelectorAll("[data-art]"))
      b.addEventListener("click", () => openArtifact(byNo.get(b.getAttribute("data-art"))));

    /* Collections. Skeleton mounts first, then culture form sets. */
    let setsHtml = "";
    if (S7.skeletons) {
      const active = S7.skeletons.progress(S).filter((x) => x.have > 0 || x.complete);
      if (active.length) {
        setsHtml += '<div class="skhead">Dinosaur mounts · assemble bone by bone</div>';
        for (const x of active) {
          const pct = Math.round(100 * x.have / x.want);
          setsHtml += '<div class="setrow' + (x.complete ? " done" : "") + '">' +
            '<div class="sn">' + esc(x.kit.mountName) +
            (x.complete ? " · complete" : "") + "</div>" +
            '<div class="sp">' + x.have + " / " + x.want + " elements" +
            (x.complete ? " · hall rating bonus" : "") + "</div>" +
            '<div class="sbar"><i style="width:' + pct + '%"></i></div></div>';
        }
      }
    }
    const allSets = M.setsFor(S);
    const sets = allSets.filter((x) => x.n > 0);
    const remaining = allSets.length - sets.length;
    sets.sort((a, b) => (b.have / b.want) - (a.have / a.want));
    setsHtml += sets.map((x) => {
      const pc = Math.round(100 * x.have / x.want);
      return '<div class="setrow' + (x.complete ? " done" : "") + '">' +
        '<div class="sn">' + esc(x.culture.name) + '</div>' +
        '<div class="sp">' + x.have + " / " + x.want + " forms · " + x.n + " held</div>" +
        '<div class="sbar"><i style="width:' + pc + '%"></i></div></div>';
    }).join("") || (setsHtml ? "" : '<p class="hint">Nothing accessioned yet.</p>');
    $("sets").innerHTML = setsHtml;
    const setsPanel = $("sets") && $("sets").closest(".panel");
    const note = setsPanel && setsPanel.querySelector(".lblnote");
    if (note) note.textContent = remaining
      ? remaining + " tradition" + (remaining === 1 ? "" : "s") + " still unencountered"
      : "every tradition encountered";

    renderReviews(S, sv);
  }

  function renderReviews(S, sv) {
    const box = $("m-reviews");
    const note = $("reviews-note");
    if (!box || !S7.reviews) return;
    if (sv.count === 0) {
      box.innerHTML = '<p class="hint">No visitors yet — no reviews. Put something on display and open the doors.</p>';
      if (note) note.textContent = "waiting for the first guest";
      return;
    }
    const list = S7.reviews.pick(sv.rating, S.day, 4);
    const band = S7.reviews.bandFor(sv.rating);
    if (note) note.textContent = band.tag + " · guest book, day " + S.day;
    box.innerHTML = list.map((r) =>
      '<blockquote class="review">' +
        '<div class="review-top">' +
          '<span class="review-stars">' + S7.reviews.starString(r.stars) + "</span>" +
          '<cite class="review-name">' + esc(r.name) + "</cite>" +
        "</div>" +
        '<p class="review-text">“' + esc(r.text) + '”</p>' +
      "</blockquote>"
    ).join("");
  }

  /* ---------- the till ------------------------------------------------------
     Admission price is the one number the player sets directly, and it cuts
     both ways: charge over the going rate and the gate thins out. */

  function renderTill(S, sv) {
    const box = $("till");
    if (!box) return;
    const suggested = M.suggestedPrice(sv);
    const factor = M.priceFactor(S, sv);
    const rel = S.admission < suggested * 0.6 ? "well under the going rate"
              : S.admission < suggested * 0.95 ? "a little cheap"
              : S.admission <= suggested * 1.15 ? "about right"
              : S.admission <= suggested * 1.6 ? "on the steep side"
              : "more than people will pay";
    const today = S.today;
    const y = S.yesterday;

    box.innerHTML =
      '<div class="tillrow">' +
        '<button class="ghost" data-price="-1" type="button">−</button>' +
        '<div class="price"><b>' + fmt(S.admission) + '</b><span>admission</span></div>' +
        '<button class="ghost" data-price="1" type="button">+</button>' +
        '<div class="pricenote">' + esc(rel) + '<br><span>going rate ' + fmt(suggested) +
        ' · footfall ' + Math.round(factor * 100) + '%</span></div>' +
      '</div>' +
      '<div class="tillbook">' +
        '<div><span>Today</span><b>' + Math.round(today.visitors) + '</b> in · ' +
          fmt(today.gate) + ' gate</div>' +
        '<div><span>Gift shop</span><b>' + fmt(today.shop || 0) + '</b></div>' +
        '<div><span>Café</span><b>' + fmt(today.cafe || 0) + '</b></div>' +
        (y ? '<div><span>Day ' + y.day + '</span><b>' + Math.round(y.visitors) + '</b> in · ' +
             fmt(y.gate + y.extra) + ' total</div>'
           : '<div><span>Yesterday</span>no trading yet</div>') +
        '<div class="wide"><span>Grant</span><b>' + fmt(S7.state.grantRate(S)) + '/s</b> · set on ' +
          Math.round(S7.state.attendance(S)) + ' a day</div>' +
      '</div>' +
      '<p class="hint">Tickets at the door. Gift shop and café take money when ' +
      'visitors walk into those rooms. The Institute grant follows attendance.</p>' +
      (S.history.length > 1 ? historyStrip(S) : "");
  }

  /* Fourteen days of takings as a row of bars. */
  function historyStrip(S) {
    const max = Math.max(1, ...S.history.map((d) => d.gate + d.extra));
    return '<div class="tillhist">' + S.history.map((d) => {
      const h = Math.max(2, Math.round(26 * (d.gate + d.extra) / max));
      return '<i style="height:' + h + 'px" title="Day ' + d.day + ': ' +
             fmt(d.gate + d.extra) + '"></i>';
    }).join("") + '</div>';
  }

  /* ---------- records ------------------------------------------------------ */

  function recordHTML(S, a, opts) {
    opts = opts || {};
    const cu = C.byId[a.cultureId];
    const era = C.eraAt(a.depth);
    const kindLabel = a.kind === "object" ? "Object" : a.kind === "painting" ? "Painting" : "Sculpture";
    const fields = [
      ["From", cu ? cu.name : "Unknown"],
      ["Region", cu && cu.eerie >= 3 ? "Not established" : (cu ? cu.region : "—")],
      ["Period", a.keystone && a.name === "Wristwatch" ? "" : (cu ? cu.period : "—")],
      ["Type", kindLabel],
      ["Material", A.materialLabel(a.material)],
      ["Condition", a.condition.n + " — " + a.condition.note],
      ["Rarity", a.rarity.n],
      ["Found at", a.depth.toFixed(1) + " m · " + era.name],
      ["Significance", a.significance.toFixed(1)],
    ];
    let f = "";
    for (const [k, v] of fields)
      f += '<div class="field"><div class="fk">' + esc(k) + '</div><div class="fv ' +
        (v ? "" : "blank") + '">' + esc(v || "—") + '</div></div>';

    const cold = cu && cu.eerie >= 2 ? " cold" : "";
    return '<div class="rec">' +
      '<canvas class="recart" width="64" height="64" data-rec="' + a.no + '"></canvas>' +
      '<div class="no">Item ' + a.no + '</div>' +
      '<div class="nm">' + esc(a.name) + '</div>' +
      '<div class="sub">' + esc(era.period) + '</div>' +
      f +
      '<div class="note' + cold + '">' + esc(a.notes) + '</div>' +
      '</div>';
  }

  /* Records are injected as HTML, so their canvases are painted afterwards. */
  function paintRecords(root, S) {
    const byNo = new Map(S.collection.map((x) => [x.no, x]));
    if (S.pending) byNo.set(S.pending.artifact.no, S.pending.artifact);
    if (S.active && S.active.artifact) byNo.set(S.active.artifact.no, S.active.artifact);
    for (const cv of root.querySelectorAll("canvas[data-rec]")) {
      const a = byNo.get(cv.getAttribute("data-rec"));
      if (!a) continue;
      const g = cv.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(A.spriteFor(a), 0, 0);
    }
  }

  function boonHTML(boon, header, note) {
    const t = S7.boons.tier(boon);
    return '<div class="boon' + (t >= 3 ? " t3" : "") + '">' +
      '<div class="bk">' + esc(header || "Study result") + '</div>' +
      '<div class="bv">' + esc(S7.boons.text(boon)) + '</div>' +
      '<div class="bn">' + esc(S7.boons.label(boon)) + (note ? " · " + note : "") + '</div></div>';
  }

  /* ---------- log ---------------------------------------------------------- */

  function renderLog(S) {
    const line = (l) =>
      '<p class="' + l.c + '"><span class="d">' + (l.at !== undefined ? l.at.toFixed(0) + "m" : "") + '</span>' + l.t + '</p>';
    $("log-full").innerHTML = S.log.map(line).join("");
    $("log-mini").innerHTML = S.log.slice(0, 14).map(line).join("");
  }

  S7.views = {
    $, fmt, fmtTime, starString, esc,
    renderStats, renderShops, renderResearch, renderMuseum, renderLog, renderTill, nextSite,
    recordHTML, paintRecords, boonHTML, shopHTML,
  };
})(window.S7 = window.S7 || {});
