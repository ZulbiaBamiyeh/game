/* Grabs the gallery and museum screenshots used in the design document and the
   README. Fast-forwards a save into a plausible mid-game rather than playing
   two hours of real time. Run with `node tools/shots.js`. */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = 8124;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
                ".png": "image/png", ".json": "application/json" };

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
  const pinned = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                  "/opt/pw-browsers/chromium/chrome-linux/chrome"].find(fs.existsSync);
  const browser = await chromium.launch(pinned ? { executablePath: pinned } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 1040 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.S7 && window.S7.views, null, { timeout: 10000 });
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => document.getElementById("m-intro").hidden)) break;
    await page.click("#introbox");
    await page.waitForTimeout(60);
  }

  /* Stock a mid-game museum: a broad collection, the facilities that go with
     it, and the clock parked in the middle of a busy afternoon. */
  await page.evaluate(() => {
    const S = S7.debug.state();
    S.bonus.capacity = 70;
    S.mul.visitors = 1.9; S.mul.rating = 1.7; S.mul.spend = 1.5; S.mul.dwell = 1.4;
    S.depth = 430;
    for (let i = 0; i < 46; i++) {
      const a = S7.artifacts.makeArtifact((Math.random() * 1e9) | 0, 8 + Math.pow(i / 46, 1.4) * 700);
      a.no = String(i + 1).padStart(3, "0");
      a.display = true;
      S.collection.push(a);
    }
    S.minute = 13 * 60 + 20;
    S.admission = S7.museum.suggestedPrice(S7.museum.survey(S));
    S7.debug.refresh();
  });

  await page.click('[data-tab="museum"]');
  await page.waitForTimeout(400);
  await page.evaluate(() => S7.galleryView.goToRoom(0));
  await page.waitForTimeout(9000);
  await page.screenshot({ path: "tools/ui-A-foyer.png" });

  await page.evaluate(() => S7.galleryView.goToRoom(2));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: "tools/ui-B-gallery.png" });

  await page.evaluate(() => S7.galleryView.goToRoom(5));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: "tools/ui-6-gallery-deep.png" });

  await page.click('[data-tab="site"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: "tools/ui-1-shaft.png" });

  await browser.close();
  server.close();
  console.log(errors.length ? errors : "shots ok");
})();
