/* ============================================================================
   PAINTINGS

   Nineteen traditions, one renderer. Each painter is handed a seeded rng and an
   empty 64x64 buffer and draws a picture that could only have come from its own
   culture — the frame, the ground, the pigments and the rules about what may be
   depicted all move together.

   Every painter is called many times over a playthrough and must never produce
   the same picture twice. Composition, palette selection, figure count and
   damage are all rolled.
   ============================================================================ */
(function (S7) {
  "use strict";
  const R = S7.raster, M = S7.motifs;
  const { put, get, tone, shift, clamp, fbm, hsh, rectFill, ellipseFill, lineTo,
          curveTo, polyFill, roundRect, outline, chipEdges } = R;

  /* ---------- frames ------------------------------------------------------
     Returns the picture field the painter may use. */

  const FRAMES = {
    /* Heavy carved and gilded, the whole nineteenth century in one moulding. */
    gilt(B, rng) {
      const p = 7;
      rectFill(B, 0, 0, 63, 63, (x, y) => {
        const d = Math.min(x, y, 63 - x, 63 - y);
        let t = 0.44 + Math.sin(d * 1.15) * 0.26 + (fbm(x * 0.5, y * 0.5, 31) - 0.5) * 0.14;
        if (d < 1) t -= 0.28;
        if (d > p - 2) t -= 0.20;
        return tone("gold", clamp(t, 0, 1));
      });
      /* corner ornament */
      for (const [cx, cy] of [[4, 4], [59, 4], [4, 59], [59, 59]])
        ellipseFill(B, cx, cy, 3, 3, (x, y, dx, dy) =>
          tone("gold", clamp(0.50 + R.domeLight(dx, dy, 3) * 0.42, 0, 1)));
      for (let i = 0; i < 300; i++) {           /* rubbed to the bole beneath */
        const x = rng.int(0, 63), y = rng.int(0, 63);
        if (Math.min(x, y, 63 - x, 63 - y) < p && rng.chance(0.5))
          put(B, x, y, tone("redochre", 0.26));
      }
      return { x0: p, y0: p, x1: 63 - p, y1: 63 - p };
    },
    /* Plain moulded wood — a working frame, not a statement. */
    wood(B, rng) {
      const p = 5;
      rectFill(B, 0, 0, 63, 63, (x, y) => {
        const d = Math.min(x, y, 63 - x, 63 - y);
        let t = 0.36 + (d / p) * 0.20 + (fbm(x * 0.9, y * 0.25, 17) - 0.5) * 0.26;
        if (d === 0 || d === p - 1) t -= 0.18;
        return tone("wood", clamp(t, 0, 1));
      });
      return { x0: p, y0: p, x1: 63 - p, y1: 63 - p };
    },
    /* Black lacquer with a thin gold fillet. */
    lacquer(B, rng) {
      const p = 5;
      rectFill(B, 0, 0, 63, 63, (x, y) => {
        const d = Math.min(x, y, 63 - x, 63 - y);
        return tone("lacquer", clamp(0.30 + Math.sin(d * 1.6) * 0.16 + (hsh(x, y, 7) - 0.5) * 0.08, 0, 1));
      });
      rectFill(B, p - 1, p - 1, 63 - p + 1, 63 - p + 1, (x, y) => {
        const d = Math.min(x - (p - 1), y - (p - 1), 63 - p + 1 - x, 63 - p + 1 - y);
        return d < 1 ? tone("gold", 0.68) : null;
      });
      return { x0: p, y0: p, x1: 63 - p, y1: 63 - p };
    },
    /* Hanging scroll: silk mount above and below, wooden rollers. */
    scroll(B, rng) {
      rectFill(B, 6, 2, 57, 61, (x, y) =>
        tone("sand", clamp(0.56 + (fbm(x * 0.4, y * 0.4, 5) - 0.5) * 0.16, 0, 1)));
      rectFill(B, 4, 1, 59, 4, (x, y) => tone("wood", clamp(0.40 + Math.sin((y - 1) * 1.6) * 0.22, 0, 1)));
      rectFill(B, 4, 59, 59, 62, (x, y) => tone("wood", clamp(0.40 + Math.sin((y - 59) * 1.6) * 0.22, 0, 1)));
      return { x0: 9, y0: 9, x1: 54, y1: 54 };
    },
    /* No frame at all: a fragment of plaster prised off a wall. */
    fragment(B, rng) {
      return { x0: 3, y0: 4, x1: 60, y1: 59, ragged: true };
    },
    /* Cut into stone or plaster in situ — the "frame" is the rock. */
    rock(B, rng) {
      rectFill(B, 0, 0, 63, 63, (x, y) => {
        const n = fbm(x * 0.12, y * 0.12, 23);
        return tone("granite", clamp(0.30 + n * 0.34, 0, 1));
      });
      return { x0: 5, y0: 5, x1: 58, y1: 58, blend: true };
    },
    /* Thin modern aluminium, or none at all. */
    minimal(B, rng) {
      rectFill(B, 0, 0, 63, 63, () => tone("alum", 0.44));
      return { x0: 2, y0: 2, x1: 61, y1: 61 };
    },
  };

  /* Ragged the picture edge after painting, for fragments. */
  function ragEdge(B, rng, f) {
    const seed = rng.int(1, 9999);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const dx = Math.min(x - f.x0, f.x1 - x), dy = Math.min(y - f.y0, f.y1 - y);
        const d = Math.min(dx, dy);
        if (d > 7) continue;
        if (d < 0 || fbm(x * 0.14, y * 0.14, seed) * 9 < 6 - d) put(B, x, y, null);
      }
    R.relight(B, "chalk", 2, -2);
  }

  /* ---------- painters ----------------------------------------------------
     Signature: (B, rng, f) where f is the picture field from the frame. */

  const PAINTERS = {

    /* --- 1950 to now: the top two metres of any site anywhere ----------- */
    modern(B, rng, f) {
      const fields = rng.int(2, 4);
      const ramps = rng.sample(["vermil", "lapis", "saffron", "ivory", "charcoal", "teal", "plum"], fields);
      let y = f.y0;
      for (let i = 0; i < fields; i++) {
        const h = Math.round((f.y1 - f.y0) / fields);
        M.wash(B, rng, { x0: f.x0, y0: y, x1: f.x1, y1: Math.min(f.y1, y + h), ramp: ramps[i],
                         t: rng.range(0.30, 0.72), grain: 0.10, seed: rng.int(1, 999) });
        y += h;
      }
      if (rng.chance(0.5)) {
        const bx = rng.int(f.x0 + 6, f.x1 - 10);
        rectFill(B, bx, f.y0 + 4, bx + rng.int(3, 9), f.y1 - 4,
          () => tone(rng.pick(["charcoal", "ivory"]), rng.range(0.1, 0.9)));
      }
      if (rng.chance(0.4)) M.spiral(B, rng, { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2,
        s: 16, turns: rng.int(3, 6), ramp: "charcoal", t: 0.16, seed: rng.int(1, 99) });
    },

    /* --- 1750-1950: soot-darkened oil, sitter unnamed ------------------- */
    victorian(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "umber",
                       t: rng.range(0.20, 0.30), grain: 0.20, vignette: 0.22, seed: rng.int(1, 999) });
      M.portraitBust(B, rng, {
        x: (f.x0 + f.x1) / 2 + rng.spread(3), y: f.y0 + (f.y1 - f.y0) * 0.40, s: (f.y1 - f.y0) * 0.34,
        ramp: rng.pick(["charcoal", "lacquer", "indigo"]), t: 0.18,
        skin: rng.pick(["sand", "ivory"]), hair: rng.pick(["umber", "charcoal", "ochre"]),
        seed: rng.int(1, 999), key: rng.range(-0.6, -0.2),
      });
      if (rng.chance(0.4))    /* white lace collar, the only bright note */
        ellipseFill(B, (f.x0 + f.x1) / 2, f.y0 + (f.y1 - f.y0) * 0.72, 11, 4,
          (x, y) => (fbm(x * 0.7, y * 0.7, 9) > 0.44 ? tone("ivory", 0.86) : null));
      M.patina(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "umber", seed: rng.int(1, 99) });
      M.craquelure(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "umber", seed: rng.int(1, 999) });
    },

    /* --- 1400-1750: tempera on panel, a window behind the head ---------- */
    renaissance(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "charcoal", t: 0.20, grain: 0.12, seed: rng.int(1, 999) });
      /* the window */
      const wx0 = f.x0 + 2, wx1 = f.x0 + 20;
      M.wash(B, rng, { x0: wx0, y0: f.y0 + 2, x1: wx1, y1: f.y0 + 26, ramp: "lapis", t: 0.62, grain: 0.10, seed: rng.int(1, 99) });
      M.mountains(B, rng, { x0: wx0, x1: wx1, y1: f.y0 + 26, h: 12, peaks: 3, ramp: "celadon", t: 0.34, seed: rng.int(1, 99) });
      M.tree(B, rng, { x: wx0 + 5, y: f.y0 + 26, s: 9, ramp: "umber", t: 0.24, leaf: "malach", seed: rng.int(1, 99) });
      M.portraitBust(B, rng, {
        x: (f.x0 + f.x1) / 2 + 6, y: f.y0 + (f.y1 - f.y0) * 0.42, s: (f.y1 - f.y0) * 0.32,
        ramp: rng.pick(["vermil", "tyrian", "lacquer", "indigo"]), t: 0.30,
        skin: "sand", hair: rng.pick(["umber", "ochre"]), seed: rng.int(1, 999), key: -0.5,
      });
      M.craquelure(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "umber", density: 0.026, seed: rng.int(1, 999) });
      if (rng.chance(0.3)) M.flaking(B, rng, { x0: f.x0, y0: f.y1 - 10, x1: f.x1, y1: f.y1, amount: 0.14, ground: "sand", seed: rng.int(1, 99) });
    },

    /* --- Edo Japan: flat blocks, a hard horizon, one weather event ------ */
    ukiyoe(B, rng, f) {
      const skyT = rng.range(0.52, 0.80);
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "sand", t: 0.74, grain: 0.06, seed: rng.int(1, 999) });
      rectFill(B, f.x0, f.y0, f.x1, f.y0 + 16, (x, y) =>
        tone("indigo", clamp(skyT - (y - f.y0) * 0.02, 0, 1)));
      const sea = f.y0 + 24;
      rectFill(B, f.x0, sea, f.x1, f.y1, (x, y) =>
        tone("lapis", clamp(0.34 + Math.sin(y * 0.5 + Math.sin(x * 0.2) * 2) * 0.10, 0, 1)));
      const kind = rng.int(0, 2);
      if (kind === 0) {
        M.mountains(B, rng, { x0: f.x0, x1: f.x1, y1: sea, h: 20, peaks: 1, ramp: "indigo", t: 0.30, snow: true, seed: rng.int(1, 99) });
      } else if (kind === 1) {
        M.waveCrest(B, rng, { x0: f.x0, x1: f.x1 - 4, y: sea + 8, amp: 11, ramp: "lapis", t: 0.18, foam: "ivory", w: 2, seed: rng.int(1, 99) });
        M.boat(B, rng, { x: f.x0 + 12, y: sea + 16, s: 6, ramp: "umber", t: 0.24, oars: 4, seed: rng.int(1, 99) });
      } else {
        for (let i = 0; i < rng.int(2, 4); i++)
          M.tree(B, rng, { x: rng.int(f.x0 + 6, f.x1 - 6), y: sea + rng.int(2, 12), s: rng.int(10, 16),
            ramp: "charcoal", t: 0.20, leaf: rng.pick(["vermil", "tyrian"]), leafT: 0.52, seed: rng.int(1, 99) });
      }
      M.sunDisc(B, rng, { x: f.x1 - 10, y: f.y0 + 7, s: 4, ramp: "vermil", t: 0.52, seed: 1 });
      /* signature cartouche, bottom left, always */
      rectFill(B, f.x0 + 2, f.y1 - 15, f.x0 + 8, f.y1 - 2, () => tone("vermil", 0.44));
      M.glyphBlock(B, rng, { x0: f.x0 + 3, y0: f.y1 - 14, x1: f.x0 + 8, y1: f.y1 - 3,
        style: "kanji", cw: 4, ch: 4, ramp: "ivory", t: 0.82, seed: rng.int(1, 99) });
    },

    /* --- Persian / Mughal miniature: gold, tiny figures, no perspective - */
    miniature(B, rng, f) {
      M.goldGround(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, seed: rng.int(1, 999) });
      rectFill(B, f.x0 + 3, f.y0 + 3, f.x1 - 3, f.y1 - 3, (x, y) =>
        tone("malach", clamp(0.34 + (fbm(x * 0.3, y * 0.3, 13) - 0.5) * 0.20, 0, 1)));
      M.arabesque(B, rng, { x0: f.x0 + 4, x1: f.x1 - 4, y0: f.y0 + 4, y1: f.y1 - 4,
        stems: rng.int(4, 7), amp: 6, ramp: "gold", t: 0.68, seed: rng.int(1, 99) });
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++)
        M.figureFrontal(B, rng, {
          x: f.x0 + 8 + i * ((f.x1 - f.x0 - 12) / Math.max(1, n - 1)),
          y: f.y0 + rng.int(20, 32), s: 15,
          ramp: rng.pick(["tyrian", "lapis", "vermil", "saffron"]), t: 0.42,
          skin: "sand", halo: rng.chance(0.4), seed: rng.int(1, 99),
        });
      /* border rule */
      rectFill(B, f.x0 + 2, f.y0 + 2, f.x1 - 2, f.y1 - 2, (x, y) => {
        const d = Math.min(x - f.x0 - 2, y - f.y0 - 2, f.x1 - 2 - x, f.y1 - 2 - y);
        return d < 1 ? tone("lapis", 0.24) : null;
      });
    },

    /* --- Byzantine icon: gold ground, no depth, enormous eyes ----------- */
    byzantine(B, rng, f) {
      M.goldGround(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, seed: rng.int(1, 999) });
      M.figureFrontal(B, rng, {
        x: (f.x0 + f.x1) / 2, y: f.y0 + (f.y1 - f.y0) * 0.42, s: (f.y1 - f.y0) * 0.52,
        ramp: rng.pick(["tyrian", "indigo", "lacquer"]), t: 0.30,
        skin: "umber", skinT: 0.52, halo: true, book: rng.chance(0.7),
        bookRamp: rng.pick(["vermil", "malach"]), seed: rng.int(1, 999),
      });
      /* inscription panels flanking the head */
      for (const side of [-1, 1])
        M.glyphBlock(B, rng, {
          x0: (f.x0 + f.x1) / 2 + side * 22 - 4, y0: f.y0 + 6,
          x1: (f.x0 + f.x1) / 2 + side * 22 + 4, y1: f.y0 + 18,
          style: "runic", cw: 3, ch: 4, ramp: "lacquer", t: 0.34, density: 0.7, seed: rng.int(1, 99),
        });
      M.craquelure(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "gold", density: 0.030, seed: rng.int(1, 999) });
      M.patina(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "gold", seed: rng.int(1, 99) });
    },

    /* --- Norse: painted and carved plank, interlace to the edges -------- */
    norse(B, rng, f) {
      rectFill(B, f.x0, f.y0, f.x1, f.y1, (x, y) =>
        tone("wood", clamp(0.34 + Math.sin(y * 0.9 + fbm(x * 0.2, 0, 3) * 4) * 0.14 +
          (fbm(x * 0.8, y * 0.2, 11) - 0.5) * 0.20, 0, 1)));
      const bands = rng.int(2, 4);
      for (let i = 0; i < bands; i++) {
        const y = f.y0 + 7 + i * ((f.y1 - f.y0 - 16) / Math.max(1, bands - 1));
        const kind = rng.int(0, 2);
        const ramp = rng.pick(["redochre", "ochre", "charcoal", "malach"]);
        if (kind === 0)
          M.interlace(B, rng, { x0: f.x0 + 2, x1: f.x1 - 2, y, amp: rng.int(3, 8),
            loops: rng.int(2, 7), w: 1, ramp, t: 0.30, seed: rng.int(1, 99) });
        else if (kind === 1)
          M.chevronBand(B, rng, { x0: f.x0 + 2, x1: f.x1 - 2, y, unit: rng.int(3, 5),
            ramp, t: 0.26, seed: rng.int(1, 99) });
        else
          for (let k = 0; k < rng.int(2, 5); k++)
            M.spiral(B, rng, { x: f.x0 + 8 + k * 11, y, s: rng.int(4, 7), turns: rng.int(2, 4),
              ccw: rng.chance(0.5), ramp, t: 0.28, seed: rng.int(1, 99) });
      }
      if (rng.chance(0.6))
        M.boat(B, rng, { x: (f.x0 + f.x1) / 2, y: f.y1 - 8, s: 14, ramp: "charcoal", t: 0.22,
          sail: true, sailRamp: "redochre", oars: 6, seed: rng.int(1, 99) });
      M.glyphBlock(B, rng, { x0: f.x0 + 2, y0: f.y1 - 6, x1: f.x1 - 2, y1: f.y1 - 1,
        style: "runic", cw: 3, ch: 5, ramp: "charcoal", t: 0.18, density: 0.8, seed: rng.int(1, 99) });
      R.weather(B, "wood", 0.5, rng.int(1, 99));
    },

    /* --- Song China: ink on silk, more paper than picture --------------- */
    song(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "sand", t: 0.72, grain: 0.10, seed: rng.int(1, 999) });
      /* far range, dissolved in mist */
      M.mountains(B, rng, { x0: f.x0, x1: f.x1, y1: f.y0 + 26, h: 20, peaks: rng.int(3, 5),
        ramp: "inkwash", t: 0.56, seed: rng.int(1, 99) });
      rectFill(B, f.x0, f.y0 + 20, f.x1, f.y0 + 30, (x, y) =>
        (fbm(x * 0.2, y * 0.4, 7) > 0.42 ? tone("sand", 0.76) : null));
      /* near range, dark */
      M.mountains(B, rng, { x0: f.x0, x1: f.x1, y1: f.y1 - 6, h: 16, peaks: rng.int(2, 4),
        ramp: "inkwash", t: 0.20, seed: rng.int(1, 99) });
      for (let i = 0; i < rng.int(2, 5); i++)
        M.tree(B, rng, { x: rng.int(f.x0 + 4, f.x1 - 4), y: f.y1 - rng.int(4, 12), s: rng.int(7, 12),
          ramp: "inkwash", t: 0.14, leaf: "inkwash", leafT: 0.30, seed: rng.int(1, 99) });
      if (rng.chance(0.5))
        M.boat(B, rng, { x: rng.int(f.x0 + 10, f.x1 - 10), y: f.y1 - 4, s: 5, ramp: "inkwash", t: 0.16, seed: 3 });
      /* seal, always red, always bottom right */
      rectFill(B, f.x1 - 9, f.y1 - 9, f.x1 - 3, f.y1 - 3, () => tone("cinnab", 0.46));
      M.glyphBlock(B, rng, { x0: f.x1 - 8, y0: f.y1 - 8, x1: f.x1 - 3, y1: f.y1 - 3,
        style: "kanji", cw: 2, ch: 2, ramp: "sand", t: 0.86, seed: rng.int(1, 99) });
    },

    /* --- Islamic tile panel: no figures, all mathematics ---------------- */
    islamic(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "ivory", t: 0.74, grain: 0.08, seed: rng.int(1, 999) });
      const cols = rng.int(2, 3), rows = rng.int(2, 3);
      const cw = (f.x1 - f.x0) / cols, ch = (f.y1 - f.y0) / rows;
      const ramps = rng.sample(["lapis", "teal", "malach", "tyrian", "cinnab"], 3);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const cx = f.x0 + cw * (c + 0.5), cy = f.y0 + ch * (r + 0.5);
          rectFill(B, f.x0 + cw * c + 1, f.y0 + ch * r + 1, f.x0 + cw * (c + 1) - 1, f.y0 + ch * (r + 1) - 1,
            (x, y) => tone(ramps[(r + c) % ramps.length], clamp(0.44 + (fbm(x * 0.4, y * 0.4, 5) - 0.5) * 0.14, 0, 1)));
          M.starTile(B, rng, { x: cx, y: cy, s: Math.min(cw, ch) * 0.42,
            points: rng.pick([8, 10, 12]), skip: rng.pick([3, 4, 5]),
            ramp: "ivory", t: 0.80, seed: rng.int(1, 99) });
        }
      /* calligraphic band across the top */
      rectFill(B, f.x0, f.y0, f.x1, f.y0 + 8, () => tone("lapis", 0.22));
      M.arabesque(B, rng, { x0: f.x0 + 1, x1: f.x1 - 1, y0: f.y0 + 1, y1: f.y0 + 7,
        stems: 7, amp: 3, ramp: "gold", t: 0.72, seed: rng.int(1, 99) });
      /* glaze crazing */
      M.craquelure(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "ivory", density: 0.022, seed: rng.int(1, 999) });
    },

    /* --- Maya codex page: bark paper, glyph blocks, one deity ----------- */
    maya(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "ivory", t: 0.66, grain: 0.22, seed: rng.int(1, 999) });
      rectFill(B, f.x0, f.y0, f.x1, f.y0 + 2, () => tone("cinnab", 0.40));
      rectFill(B, f.x0, f.y1 - 2, f.x1, f.y1, () => tone("cinnab", 0.40));
      M.glyphBlock(B, rng, { x0: f.x0 + 2, y0: f.y0 + 5, x1: f.x1 - 2, y1: f.y0 + 20,
        style: "maya", cw: 6, ch: 7, ramp: "charcoal", t: 0.20, density: 0.85, seed: rng.int(1, 999) });
      M.figureProfile(B, rng, {
        x: (f.x0 + f.x1) / 2 + rng.spread(6), y: f.y0 + 34, s: 22, dir: rng.chance(0.5) ? 1 : -1,
        ramp: rng.pick(["teal", "cinnab", "lapis"]), t: 0.36, skin: "redochre", skinT: 0.44,
        seed: rng.int(1, 999),
      });
      /* the Maya blue that nobody has fully explained */
      for (let i = 0; i < rng.int(4, 9); i++)
        ellipseFill(B, rng.int(f.x0 + 3, f.x1 - 3), rng.int(f.y1 - 14, f.y1 - 4), 2, 2,
          () => tone("teal", 0.56));
      M.flaking(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, amount: rng.range(0.08, 0.18), ground: "sand", seed: rng.int(1, 999) });
    },

    /* --- Roman fresco: red panel, black frame line, small floating scene  */
    roman(B, rng, f) {
      const field = rng.pick(["vermil", "cinnab", "charcoal", "ochre"]);
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: field, t: rng.range(0.34, 0.46), grain: 0.16, seed: rng.int(1, 999) });
      /* architectural framing lines */
      rectFill(B, f.x0 + 4, f.y0 + 4, f.x1 - 4, f.y1 - 4, (x, y) => {
        const d = Math.min(x - f.x0 - 4, y - f.y0 - 4, f.x1 - 4 - x, f.y1 - 4 - y);
        return d < 1 ? tone("charcoal", 0.22) : null;
      });
      M.column(B, rng, { x: f.x0 + 8, y0: f.y0 + 8, y1: f.y1 - 8, w: 3, ramp: "ivory", t: 0.72, seed: rng.int(1, 99) });
      M.column(B, rng, { x: f.x1 - 8, y0: f.y0 + 8, y1: f.y1 - 8, w: 3, ramp: "ivory", t: 0.72, seed: rng.int(1, 99) });
      /* the little garden scene in the middle */
      const cx = (f.x0 + f.x1) / 2;
      M.wash(B, rng, { x0: cx - 12, y0: f.y0 + 14, x1: cx + 12, y1: f.y1 - 14, ramp: "malach", t: 0.30, grain: 0.16, seed: rng.int(1, 99) });
      M.tree(B, rng, { x: cx - 5, y: f.y1 - 14, s: 12, ramp: "umber", t: 0.20, leaf: "malach", leafT: 0.44, seed: rng.int(1, 99) });
      if (rng.chance(0.6))
        ellipseFill(B, cx + 6, f.y1 - 20, 3, 4, (x, y) => tone("ivory", clamp(0.7 + fbm(x, y, 3) * 0.2, 0, 1)));
      M.flaking(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, amount: rng.range(0.10, 0.22), ground: "chalk", seed: rng.int(1, 999) });
    },

    /* --- Greek black-figure: orange clay, black slip, meander band ------ */
    greek(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "clay", t: 0.62, grain: 0.14, seed: rng.int(1, 999) });
      M.meander(B, rng, { x0: f.x0 + 2, x1: f.x1 - 2, y: f.y0 + 4, unit: 3, ramp: "charcoal", t: 0.12, seed: 1 });
      M.meander(B, rng, { x0: f.x0 + 2, x1: f.x1 - 2, y: f.y1 - 12, unit: 3, ramp: "charcoal", t: 0.12, seed: 1 });
      const scene = rng.int(0, 2);
      const cy = f.y0 + 30;
      if (scene === 0) {
        M.beast(B, rng, { kind: "horse", x: (f.x0 + f.x1) / 2, y: cy, s: 24,
          dir: rng.chance(0.5) ? 1 : -1, ramp: "charcoal", t: 0.10, seed: rng.int(1, 99) });
      } else if (scene === 1) {
        for (let i = 0; i < 2; i++)
          M.stickFigure(B, rng, { x: f.x0 + 16 + i * 20, y: cy, s: 26, spear: true,
            ramp: "charcoal", t: 0.10, seed: rng.int(1, 99) });
      } else {
        M.figureProfile(B, rng, { x: (f.x0 + f.x1) / 2, y: cy - 4, s: 24, dir: 1,
          ramp: "charcoal", t: 0.10, skin: "charcoal", skinT: 0.10, seed: rng.int(1, 99) });
      }
      /* incised detail lines scratched back through the slip */
      for (let i = 0; i < 40; i++) {
        const x = rng.int(f.x0, f.x1), y = rng.int(f.y0 + 8, f.y1 - 14);
        if (get(B, x, y) === tone("charcoal", 0.10)) put(B, x, y, tone("clay", 0.58));
      }
      R.weather(B, "clay", 0.4, rng.int(1, 99));
    },

    /* --- Egyptian tomb wall: registers, profile figures, glyph column --- */
    egyptian(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "sand", t: 0.70, grain: 0.14, seed: rng.int(1, 999) });
      const regs = rng.int(2, 3);
      const rh = (f.y1 - f.y0) / regs;
      for (let r = 0; r < regs; r++) {
        const base = f.y0 + rh * (r + 1) - 3;
        lineTo(B, f.x0, base + 1, f.x1, base + 1, 0, () => tone("charcoal", 0.20));
        const n = rng.int(2, 3);
        for (let i = 0; i < n; i++)
          M.figureProfile(B, rng, {
            x: f.x0 + 10 + i * ((f.x1 - f.x0 - 16) / Math.max(1, n - 1)),
            y: base - rh * 0.44, s: rh * 0.62, dir: 1,
            ramp: rng.pick(["ivory", "saffron"]), t: 0.74,
            skin: "redochre", skinT: rng.range(0.36, 0.50), seed: rng.int(1, 999),
          });
      }
      /* column of hieroglyphs down one side */
      const gx = rng.chance(0.5) ? f.x0 + 1 : f.x1 - 7;
      M.glyphBlock(B, rng, { x0: gx, y0: f.y0 + 2, x1: gx + 6, y1: f.y1 - 2,
        style: "hiero", cw: 5, ch: 6, ramp: "charcoal", t: 0.22, density: 0.9, seed: rng.int(1, 999) });
      if (rng.chance(0.5))
        M.sunDisc(B, rng, { x: (f.x0 + f.x1) / 2, y: f.y0 + 4, s: 3, ramp: "cinnab", t: 0.46, rays: 8, seed: 2 });
      M.flaking(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, amount: rng.range(0.06, 0.16), ground: "chalk", seed: rng.int(1, 999) });
    },

    /* --- Minoan: marine style, no ground line, everything swimming ------ */
    minoan(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "ivory", t: 0.78, grain: 0.10, seed: rng.int(1, 999) });
      /* rippling water bands */
      for (let y = f.y0; y <= f.y1; y += 6)
        for (let x = f.x0; x <= f.x1; x++)
          put(B, x, y + Math.sin(x * 0.35 + y * 0.2) * 2, tone("teal", 0.52));
      const subject = rng.int(0, 2);
      const cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2;
      if (subject === 0) {                        /* octopus */
        ellipseFill(B, cx, cy - 6, 9, 8, (x, y, dx, dy) =>
          tone("umber", clamp(0.34 + R.domeLight(dx, dy, 9) * 0.34, 0, 1)));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          curveTo(B, cx + Math.cos(a) * 7, cy - 6 + Math.sin(a) * 6,
                  cx + Math.cos(a) * 20, cy - 6 + Math.sin(a) * 16,
                  cx + Math.cos(a + 1.1) * 22, cy - 2 + Math.sin(a + 1.1) * 18, 0,
                  () => tone("umber", 0.30));
        }
        put(B, cx - 3, cy - 8, tone("charcoal", 0.10));
        put(B, cx + 3, cy - 8, tone("charcoal", 0.10));
      } else if (subject === 1) {                 /* dolphins */
        for (let i = 0; i < rng.int(2, 3); i++) {
          const dx = f.x0 + 12 + i * 16, dy = f.y0 + 14 + i * 12;
          ellipseFill(B, dx, dy, 11, 4, (x, y, ax, ay) =>
            tone("lapis", clamp(0.44 + (ay < 0 ? 0.14 : -0.16), 0, 1)));
          polyFill(B, [[dx + 10, dy], [dx + 16, dy - 4], [dx + 16, dy + 4]], () => tone("lapis", 0.44));
          polyFill(B, [[dx - 2, dy - 3], [dx + 3, dy - 9], [dx + 4, dy - 3]], () => tone("lapis", 0.36));
        }
      } else {                                    /* lilies and spirals */
        for (let i = 0; i < rng.int(3, 5); i++)
          M.spiral(B, rng, { x: rng.int(f.x0 + 8, f.x1 - 8), y: rng.int(f.y0 + 8, f.y1 - 8),
            s: rng.int(6, 11), turns: 3, ramp: rng.pick(["cinnab", "teal", "saffron"]),
            t: 0.42, seed: rng.int(1, 99) });
      }
      M.flaking(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, amount: 0.20, ground: "chalk", seed: rng.int(1, 999) });
    },

    /* --- Neolithic wall painting: plan view of a town, and a bull ------- */
    neolithic(B, rng, f) {
      M.rockGround(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "chalk", t: 0.56, seed: rng.int(1, 999) });
      /* the town, seen impossibly from above */
      for (let r = 0; r < rng.int(3, 5); r++)
        for (let c = 0; c < rng.int(4, 7); c++) {
          const x = f.x0 + 4 + c * 8 + rng.spread(2), y = f.y1 - 22 + r * 6 + rng.spread(1);
          rectFill(B, x, y, x + 6, y + 4, (px, py) => tone("redochre", clamp(0.36 + (hsh(px, py, 3) - 0.5) * 0.2, 0, 1)));
        }
      M.beast(B, rng, { kind: "aurochs", x: (f.x0 + f.x1) / 2, y: f.y0 + 16, s: 30,
        dir: rng.chance(0.5) ? 1 : -1, ramp: "charcoal", t: 0.14, seed: rng.int(1, 99) });
      /* small figures around the bull, running */
      for (let i = 0; i < rng.int(3, 6); i++)
        M.stickFigure(B, rng, { x: rng.int(f.x0 + 6, f.x1 - 6), y: f.y0 + rng.int(10, 28),
          s: 11, ramp: "redochre", t: 0.26, pose: rng.chance(0.4) ? "raised" : "", seed: rng.int(1, 99) });
      M.flaking(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, amount: 0.24, ground: "chalk", seed: rng.int(1, 999) });
    },

    /* --- Upper Palaeolithic cave: the rock is part of the animal -------- */
    palaeo(B, rng, f) {
      M.rockGround(B, rng, { x0: 0, y0: 0, x1: 63, y1: 63, ramp: "granite", t: 0.40, seed: rng.int(1, 999) });
      const beasts = rng.int(1, 3);
      const kinds = rng.shuffle(["bison", "horse", "deer", "mammoth", "aurochs"]);
      for (let i = 0; i < beasts; i++)
        M.beast(B, rng, {
          kind: kinds[i], x: rng.int(20, 44), y: rng.int(20, 44),
          s: rng.int(22, 34), dir: rng.chance(0.5) ? 1 : -1,
          ramp: rng.pick(["redochre", "charcoal", "ochre"]),
          t: rng.range(0.16, 0.30), grain: 0.24, broken: 0.74, seed: rng.int(1, 999),
        });
      if (rng.chance(0.55))
        M.handStencil(B, rng, { x: rng.int(10, 20), y: rng.int(30, 48), s: 11,
          ramp: "redochre", t: 0.32, grain: 0.28, seed: rng.int(1, 999) });
      /* tally dots — the part nobody can read */
      if (rng.chance(0.5)) {
        const n = rng.int(5, 13);
        for (let i = 0; i < n; i++)
          ellipseFill(B, 8 + (i % 7) * 4, 10 + Math.floor(i / 7) * 5, 1.4, 1.4,
            () => tone("charcoal", 0.20));
      }
      /* calcite veil grown over the paint since */
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++)
          if (fbm(x * 0.11, y * 0.11, rng.seed % 500) > 0.70) shift(B, x, y, "granite", 2);
    },

    /* --- Neanderthal: not pictures. Marks. ------------------------------ */
    neander(B, rng, f) {
      M.rockGround(B, rng, { x0: 0, y0: 0, x1: 63, y1: 63, ramp: "basalt", t: 0.38, seed: rng.int(1, 999) });
      const pig = rng.pick(["redochre", "ochre"]);
      const mode = rng.int(0, 2);
      if (mode === 0) {                            /* the ladder */
        const x0 = rng.int(10, 18), x1 = x0 + rng.int(26, 38);
        const yTop = rng.int(12, 18), yBot = yTop + rng.int(26, 36);
        for (const yy of [yTop, yBot])
          lineTo(B, x0, yy, x1, yy, 1, (x, y) =>
            tone(pig, clamp(0.42 + (fbm(x * 0.5, y * 0.5, 3) - 0.5) * 0.22, 0, 1)));
        const rungs = rng.int(4, 7);
        for (let i = 0; i <= rungs; i++) {
          const x = x0 + ((x1 - x0) / rungs) * i;
          lineTo(B, x, yTop, x + rng.spread(4), yBot, 1, (px, py) =>
            tone(pig, clamp(0.40 + (fbm(px * 0.5, py * 0.5, 7) - 0.5) * 0.24, 0, 1)));
        }
      } else if (mode === 1) {                     /* hand, positive, in ochre */
        M.handStencil(B, rng, { x: 32, y: 36, s: 17, negative: false,
          ramp: pig, t: 0.44, grain: 0.24, seed: rng.int(1, 999) });
      } else {                                     /* hatching, dozens of strokes */
        const cx = rng.int(24, 40), cy = rng.int(24, 40);
        for (let i = 0; i < rng.int(34, 60); i++) {
          const x = cx + rng.spread(22), y = cy + rng.spread(22);
          const a = rng.range(-0.6, 0.6) + (rng.chance(0.7) ? 1.2 : 0);
          lineTo(B, x, y, x + Math.cos(a) * rng.range(6, 13), y + Math.sin(a) * rng.range(6, 13), 1,
            (px, py) => tone(pig, clamp(0.40 + (fbm(px * 0.6, py * 0.6, 11) - 0.5) * 0.26, 0, 1)));
        }
      }
      /* shell beads pressed into the ochre — the only ornament they left */
      if (rng.chance(0.45))
        for (let i = 0; i < rng.int(3, 6); i++)
          ellipseFill(B, rng.int(8, 56), rng.int(8, 56), 2.6, 2,
            (x, y, dx, dy) => tone("ivory", clamp(0.62 + R.domeLight(dx, dy, 2.6) * 0.3, 0, 1)));
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++)
          if (fbm(x * 0.13, y * 0.13, rng.seed % 700) > 0.70) shift(B, x, y, "basalt", -1);
    },

    /* --- Unattributed: correct technique, no known tradition ------------ */
    unattributed(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "void", t: 0.42, grain: 0.20, seed: rng.int(1, 999) });
      /* the eight-turn spiral, counterclockwise, on almost everything */
      const cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2;
      M.spiral(B, rng, { x: cx, y: cy, s: rng.int(18, 24), turns: 8, ccw: true,
        ramp: "wrong", t: 0.62, seed: rng.int(1, 999) });
      const n = rng.int(1, 4);
      for (let i = 0; i < n; i++) {
        /* figures with the hands raised over the face */
        const fx = f.x0 + 8 + i * ((f.x1 - f.x0 - 12) / Math.max(1, n - 1));
        M.stickFigure(B, rng, { x: fx, y: cy + rng.spread(8), s: 18, pose: "raised",
          ramp: "wrong", t: 0.72, seed: rng.int(1, 99) });
        ellipseFill(B, fx, cy - 8, 3.4, 3.4, () => tone("void", 0.10));
      }
      M.glyphBlock(B, rng, { x0: f.x0 + 1, y0: f.y1 - 8, x1: f.x1 - 1, y1: f.y1 - 1,
        style: "unknown", cw: 4, ch: 5, ramp: "wrong", t: 0.50, density: 0.9, seed: rng.int(1, 999) });
      /* the pigment has not degraded at all, which is the problem */
      outline(B, "void", 1);
    },

    /* --- Anachronic: the subject is the site you are standing in -------- */
    anachronic(B, rng, f) {
      M.wash(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "umber", t: 0.24, grain: 0.14, seed: rng.int(1, 999) });
      /* a shaft, seen from above, in cross-section */
      const cx = (f.x0 + f.x1) / 2;
      rectFill(B, cx - 7, f.y0 + 2, cx + 7, f.y1 - 2, (x, y) =>
        tone("void", clamp(0.30 - (y - f.y0) / (f.y1 - f.y0) * 0.26, 0, 1)));
      for (let y = f.y0 + 4; y < f.y1 - 2; y += 5) {
        lineTo(B, cx - 7, y, cx + 7, y, 0, () => tone("timber", 0.36));
        lineTo(B, f.x0, y, cx - 8, y, 0, () => tone("ochre", clamp(0.24 + (y % 11) / 40, 0, 1)));
        lineTo(B, cx + 8, y, f.x1, y, 0, () => tone("ochre", clamp(0.24 + (y % 11) / 40, 0, 1)));
      }
      /* a figure at the top of the shaft, looking down. Looking at you. */
      M.stickFigure(B, rng, { x: cx, y: f.y0 + 8, s: 12, ramp: "charcoal", t: 0.10, seed: rng.int(1, 99) });
      M.spiral(B, rng, { x: cx, y: f.y1 - 8, s: 8, turns: 8, ccw: true, ramp: "wrong", t: 0.66, seed: 1 });
      M.craquelure(B, rng, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, ramp: "umber", seed: rng.int(1, 999) });
    },
  };

  /* ---------- entry point ------------------------------------------------ */

  /* spec: { painter, frame } — supplied by the culture table. */
  function paint(rng, spec) {
    const B = R.Buf();
    const frameFn = FRAMES[spec.frame] || FRAMES.wood;
    const f = frameFn(B, rng);
    (PAINTERS[spec.painter] || PAINTERS.modern)(B, rng, f);
    if (f.ragged) ragEdge(B, rng, f);
    if (!f.ragged && !f.blend) outline(B, "charcoal", 0);
    return B;
  }

  S7.paintings = { paint, PAINTERS, FRAMES };
})(window.S7 = window.S7 || {});
