/* Boots the game in Chromium, drives it hard, and fails on any console error.
   Run with `npm run smoke` while `npm run serve` is up, or let it start its
   own server with --serve. */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = 8123;

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".json": "application/json",
};

function serve() {
  return new Promise((res) => {
    const s = http.createServer((req, rq) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
      const file = p.endsWith("/") ? path.join(p, "index.html") : p;
      fs.readFile(file, (err, data) => {
        if (err) { rq.writeHead(404); rq.end("no"); return; }
        rq.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "text/plain" });
        rq.end(data);
      });
    });
    s.listen(PORT, () => res(s));
  });
}

(async () => {
  const server = await serve();
  /* The sandbox ships a pinned Chromium; never let Playwright fetch its own. */
  const pinned = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                  "/opt/pw-browsers/chromium/chrome-linux/chrome"].find(fs.existsSync);
  const browser = await chromium.launch(pinned ? { executablePath: pinned } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/favicon/i.test(m.text())) return;      /* not the game's problem */
    errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message + "\n" + (e.stack || "")));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.S7 && window.S7.views, null, { timeout: 10000 });

  /* click through the intro */
  for (let i = 0; i < 6; i++) {
    const open = await page.evaluate(() => !document.getElementById("m-intro").hidden);
    if (!open) break;
    await page.click("#introbox");
    await page.waitForTimeout(60);
  }

  await page.screenshot({ path: "tools/shot-01-shaft.png" });

  /* Generate a large sample of artifacts through the real pipeline: this is the
     part most likely to throw, because it runs every generator. */
  const genErrors = await page.evaluate(() => {
    const bad = [];
    for (const cu of S7.cultures.CULTURES) {
      const kinds = ["object"];
      if (cu.painting) kinds.push("painting");
      if (cu.sculpture) kinds.push("sculpture");
      for (const kind of kinds)
        for (const objectType of (kind === "object" ? cu.objects : [null]))
          for (let n = 0; n < 3; n++) {
            try {
              const a = S7.artifacts.makeArtifact((Math.random() * 1e9) | 0, 100, {
                culture: cu.id, kind, objectType,
              });
              S7.artifacts.spriteFor(a);
              if (!a.name || !a.notes) bad.push(cu.id + "/" + kind + ": empty text");
            } catch (e) {
              bad.push(cu.id + "/" + kind + "/" + objectType + ": " + e.message);
            }
          }
    }
    return bad;
  });

  /* Play the way a person would — buy whatever is affordable, brush, file an
     interpretation, accession, repeat — and report the curve at intervals.
     This is the only way to see whether the first ten minutes are any good. */
  const sim = await page.evaluate(() => {
    const S = S7.state.fresh(12345);
    S.started = true;
    const marks = [60, 300, 900, 1800, 3600, 7200];
    const out = { curve: [] };
    let t = 0, mark = 0;
    const DT = 0.25;

    function buyAnything() {
      for (let pass = 0; pass < 8; pass++) {
        let bought = false;
        for (const u of S7.upgrades.MUSEUM.concat(S7.upgrades.EXCAVATION)) {
          if (u.unlock && !u.unlock(S)) continue;
          if ((S.up[u.id] || 0) >= u.max) continue;
          const c = S7.upgrades.cost(S, u);
          if (S.funds < c) continue;
          S.funds -= c;
          S.up[u.id] = (S.up[u.id] || 0) + 1;
          if (u.eff) u.eff(S);
          bought = true;
        }
        if (!bought) break;
      }
      for (const r of S7.upgrades.RESEARCH)
        if (!S.research[r.id] && S.understanding >= r.cost) {
          S.understanding -= r.cost;
          S.research[r.id] = true;
          const e = S7.upgrades.RESEARCH_EFF[r.id];
          if (e) e(S);
        }
    }

    let sinceBuy = 0;
    while (t < marks[marks.length - 1]) {
      S7.game.step(S, DT);
      t += DT;
      if (S.active) {
        const A = S.active;
        if (S.stamina >= 1) S7.game.brush(S, 3 + (((t * 3) | 0) % 10), 3 + (((t * 7) | 0) % 10));
        if (!A.filed && S7.game.exposure(A) > 0.30)
          S7.game.fileInterpretation(S, A.artifact.readings.findIndex((r) => r.ok));
      }
      if (S.pending) S7.game.accession(S, true);
      sinceBuy += DT;
      if (sinceBuy >= 5) {
        sinceBuy = 0;
        buyAnything();
        /* keep admission near the going rate, the way a player would */
        S.admission = S7.museum.suggestedPrice(S7.museum.survey(S));
      }
      if (mark < marks.length && t >= marks[mark]) {
        const sv = S7.museum.survey(S);
        out.curve.push({
          at: marks[mark] + "s", depth: +S.depth.toFixed(1),
          day: S.day,
          funds: Math.round(S.funds), incPerSec: +S7.museum.incomeRate(S, sv).toFixed(2),
          coll: S.collection.length, rating: +sv.rating.toFixed(1),
          visPerDay: Math.round(S7.museum.visitorsPerDay(S, sv)),
          price: S.admission,
          U: Math.round(S.understanding),
        });
        mark++;
      }
    }
    const sv = S7.museum.survey(S);
    out.cultures = sv.cultures;
    out.finite = [S.depth, S.funds, sv.rating, S.understanding].every(Number.isFinite);
    return out;
  });

  /* Give the live state a collection so the museum renderers have something to
     draw, weighted toward the top of the shaft so room 0 is worth testing. */
  await page.evaluate(() => {
    const S = S7.debug.state();
    for (let i = 0; i < 40; i++) {
      const depth = i < 12 ? 2 + i * 1.2 : 40 + i * 20;
      const a = S7.artifacts.makeArtifact((Math.random() * 1e9) | 0, depth);
      a.no = String(i + 1).padStart(3, "0");
      a.display = true;
      S.collection.push(a);
    }
    S7.visitors.invalidate();
  });
  await page.click('[data-tab="museum"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tools/shot-02-museum.png" });
  /* Multi-floor museum: gift shop, café, stairs, upper storey. */
  await page.evaluate(() => S7.debug.tab("museum"));
  await page.waitForTimeout(400);
  const rehang = await page.evaluate(() => {
    const S = S7.debug.state();
    S.up.upper = 1;
    S.up.shop = 2;
    S.up.cafe = 1;
    S7.visitors.invalidate();
    const L = S7.visitors.getLayout(S);
    if (!L.rooms.some((r) => r.shop)) return "no gift shop room";
    if (!L.rooms.some((r) => r.cafe)) return "no café room";
    if (!L.rooms.some((r) => r.stairs)) return "no stairs";
    if ((L.floors || 1) < 2) return "no upper floor";
    /* Upper must sit above ground in world Y (negative base). */
    if (!(S7.visitors.floorBase(1) < S7.visitors.floorBase(0)))
      return "upper not above ground";
    /* Upper must share X with ground (stacked cutaway, not offset to the right). */
    const g0 = L.rooms.find((r) => (r.floor || 0) === 0 && r.exhibits && r.exhibits.length);
    const u0 = L.rooms.find((r) => r.floor === 1 && r.exhibits && r.exhibits.length);
    const stairs0 = L.rooms.find((r) => r.stairs && (r.floor || 0) === 0 && r.stairsTo === 1);
    const stairs1 = L.rooms.find((r) => r.stairs && r.floor === 1);
    if (stairs0 && stairs1 && Math.abs(stairs0.x - stairs1.x) > 4)
      return "stairwell not vertically aligned";
    if (g0 && u0 && u0.x > g0.x + g0.width + 200)
      return "upper floor offset too far right of ground";
    S.up.deepgal = 1;
    /* Deep-time finds should hang in the basement once the deep gallery opens. */
    for (let i = 0; i < 6; i++) {
      const a = S7.artifacts.makeArtifact(9000 + i, 520 + i * 20);
      a.no = "D" + i; a.display = true; S.collection.push(a);
    }
    S7.visitors.invalidate();
    const L2 = S7.visitors.getLayout(S);
    if (!L2.rooms.some((r) => r.floor === -1 && !r.stairs))
      return "no basement gallery room";
    if (!(S7.visitors.floorBase(-1) > S7.visitors.floorBase(0)))
      return "basement not below ground";
    /* Building envelope always reserves upper + basement so no black void. */
    if (L2.shellMin === undefined || L2.shellMax === undefined)
      return "missing shell envelope";
    if (L2.shellMin > -1 || L2.shellMax < 1) return "shell too small";
    if (!(L2.yMin < 0 && L2.yMax > L2.H)) return "envelope y range wrong";
    const basEx = L2.exhibits.filter((e) => e.floor === -1);
    if (!basEx.length) return "no basement exhibits";
    /* Case furniture must sit under the ceiling, not stretch from the roof. */
    const FLOOR_Y = S7.visitors.FLOOR_Y;
    const base = S7.visitors.floorBase(-1);
    for (const e of basEx) {
      if (e.mount === "wall") continue;
      const h = e.h || 20;
      const cBot = base + 92;
      const ceil = base + 14 + 8;
      const artTop = Math.max(ceil, cBot - h);
      if (artTop < base + 14) return "basement case above ceiling";
      const pedH = (base + FLOOR_Y + 8) - cBot;
      if (pedH < 4) return "basement pedestal inverted";
    }
    if (typeof S7.galleryView.goToFloor !== "function") return "no goToFloor";
    S7.galleryView.goToFloor(1);
    S7.galleryView.goToFloor(0);
    S7.galleryView.goToFloor(-1);
    return "ok";
  });

  /* Visitor numbers have to stay in the range an actual museum lives in. */
  const scale = await page.evaluate(() => {
    const out = [];
    for (const n of [1, 10, 40, 120, 260]) {
      const S = S7.state.fresh(4242);
      S.started = true;
      S.bonus.capacity = n * 2;
      for (let i = 0; i < n; i++) {
        const a = S7.artifacts.makeArtifact((Math.random() * 1e9) | 0, 5 + (i / n) * 800);
        a.no = String(i); a.display = true; S.collection.push(a);
      }
      const sv = S7.museum.survey(S);
      S.admission = S7.museum.suggestedPrice(sv);
      const p = S7.museum.projectedDay(S, sv);
      out.push({ items: n, rating: +sv.rating.toFixed(1), price: S.admission,
                 perDay: Math.round(p.visitors), dayTake: Math.round(p.gate + p.extra) });
    }
    return out;
  });

  /* The admission price has to be a decision, not a solved number. Sweep it
     across the going rate and check that the best price is close to the
     suggested one — if the optimum were at 3x, "what do I charge" would have a
     single right answer and there would be nothing to decide. */
  const pricing = await page.evaluate(() => {
    const S = S7.state.fresh(99);
    S.started = true;
    S.bonus.capacity = 200;
    for (let i = 0; i < 90; i++) {
      const a = S7.artifacts.makeArtifact((Math.random() * 1e9) | 0, 5 + (i / 90) * 800);
      a.no = String(i); a.display = true; S.collection.push(a);
    }
    const sv = S7.museum.survey(S);
    const suggested = S7.museum.suggestedPrice(sv);
    /* A settled fortnight at the going rate, so the grant is not still warming up. */
    S.admission = suggested;
    const settled = S7.museum.visitorsPerDay(S, sv);
    S.history = [];
    for (let d = 0; d < 14; d++) S.history.push({ day: d, visitors: settled, gate: 0, extra: 0 });

    const rows = [];
    for (const u of [0.5, 0.75, 1, 1.25, 1.5, 2, 3]) {
      S.admission = Math.round(suggested * u * 2) / 2;
      const v = S7.museum.visitorsPerDay(S, sv);
      /* A day is 480 open minutes at one minute a second, plus the night. */
      const take = v * S7.museum.perVisitor(S, sv) + S7.state.grantRate(S) * 540;
      rows.push({ x: u, price: S.admission, perDay: Math.round(v), day: Math.round(take) });
    }
    const best = rows.reduce((m, r) => (r.day > m.day ? r : m), rows[0]);
    const atRate = rows.find((r) => r.x === 1);
    return { suggested, rows, bestAt: best.x, penalty: +(1 - atRate.day / best.day).toFixed(3) };
  });

  /* Physical sizes should span from bead to monument, not cluster on one value. */
  const sizes = await page.evaluate(() => {
    const hs = [];
    for (let i = 0; i < 400; i++) {
      const a = S7.artifacts.makeArtifact((Math.random() * 1e9) | 0, 20 + Math.random() * 800);
      hs.push(S7.artifacts.physical(a).h);
    }
    hs.sort((x, y) => x - y);
    return { min: hs[0], median: hs[200], max: hs[hs.length - 1],
             monuments: hs.filter((h) => h >= 58).length };
  });

  await page.click('[data-tab="research"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tools/shot-03-research.png" });

  /* Save round-trip. */
  const saveOk = await page.evaluate(() => {
    const S = S7.state.fresh(777);
    S.started = true;
    for (let i = 0; i < 25; i++) S7.game.step(S, 1);
    for (let i = 0; i < 12; i++) {
      const a = S7.artifacts.makeArtifact((Math.random() * 1e9) | 0, 30 + i * 40);
      a.no = String(i).padStart(3, "0"); a.display = true;
      S.collection.push(a);
    }
    const txt = S7.save.exportText(S);
    const back = S7.save.importText(txt);
    if (!back) return "import failed";
    if (back.collection.length !== S.collection.length) return "collection length changed";
    for (let i = 0; i < S.collection.length; i++) {
      if (back.collection[i].name !== S.collection[i].name) return "name drift at " + i;
      if (back.collection[i].notes !== S.collection[i].notes) return "notes drift at " + i;
      if (JSON.stringify(back.collection[i].boon) !== JSON.stringify(S.collection[i].boon)) return "boon drift at " + i;
    }
    return "ok";
  });

  await browser.close();
  server.close();

  console.log("play curve (greedy player, real time):");
  for (const row of sim.curve) console.log("  ", JSON.stringify(row));
  console.log("  traditions on display:", sim.cultures, "· all finite:", sim.finite);
  console.log("save round-trip:", saveOk);
  console.log("art generators:", genErrors.length ? genErrors.slice(0, 20) : "all clean");
  console.log("museum scale (a real museum does tens to thousands a day):");
  for (const r of scale) console.log("  ", JSON.stringify(r));
  console.log("pricing sweep (going rate " + pricing.suggested + "):");
  for (const r of pricing.rows) console.log("  ", JSON.stringify(r));
  console.log("  best at", pricing.bestAt + "x the going rate · charging the going rate costs",
              Math.round(pricing.penalty * 100) + "%");
  console.log("artifact sizes:", JSON.stringify(sizes));
  console.log("museum layout:", rehang);
  console.log("console errors:", errors.length ? errors.slice(0, 20) : "none");

  /* The live curve is the one that matters. The isolated scale table only
     proves the formula; this proves that two hours of a greedy player driving
     every multiplier at once still lands on a number a museum could have. */
  const busiest = sim.curve.reduce((m, r) => Math.max(m, r.visPerDay), 0);
  const dearest = sim.curve.reduce((m, r) => Math.max(m, r.price), 0);
  console.log("busiest day on the curve:", busiest, "· dearest ticket:", dearest);

  const failed = errors.length || genErrors.length || saveOk !== "ok" || !sim.finite ||
                 !/^ok/.test(rehang) || sizes.max < 50 || sizes.min > 14 ||
                 scale[0].perDay > 60 ||           /* one object is not a day out */
                 scale[scale.length - 1].perDay > 12000 ||  /* nor is it the Louvre */
                 busiest > 12000 ||                /* and neither is hour two */
                 dearest > 40 ||                    /* nobody pays £40 to see a shaft */
                 pricing.bestAt > 1.5 || pricing.bestAt < 0.75 ||
                 pricing.penalty > 0.05;   /* the going rate must be honest advice */
  if (failed) { console.error("\nSMOKE FAILED"); process.exit(1); }
  console.log("\nSMOKE OK");
})();
