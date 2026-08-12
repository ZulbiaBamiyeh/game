/* ============================================================================
   SCULPTURE

   Paintings are marks on a surface. Sculpture is a lit volume, so everything
   here is built from shaded masses rather than lines, with a single key light
   from the upper left, and then broken — because almost nothing survives whole.

   The damage is rolled per piece: a bust with its nose gone and a bust with
   its nose intact are the same generator on different seeds, and the museum
   pays differently for each.
   ============================================================================ */
(function (S7) {
  "use strict";
  const R = S7.raster, M = S7.motifs;
  const { put, get, tone, shift, clamp, fbm, hsh, rectFill, ellipseFill, lineTo,
          curveTo, polyFill, roundRect, outline, domeLight } = R;

  /* A lit ellipsoid. Nearly every form below is two or three of these. */
  function vol(B, cx, cy, rx, ry, ramp, o) {
    o = o || {};
    const base = o.t === undefined ? 0.34 : o.t;
    const gain = o.gain === undefined ? 0.50 : o.gain;
    const grain = o.grain === undefined ? 0.10 : o.grain;
    const seed = o.seed || 3;
    ellipseFill(B, cx, cy, rx, ry, (x, y, dx, dy, d) => {
      if (o.mask && !o.mask(x, y, dx, dy, d)) return null;
      let t = base + domeLight(dx / rx * 10, dy / ry * 10, 10) * gain
            + (fbm(x * 0.35, y * 0.35, seed) - 0.5) * grain;
      if (d > 0.93) t -= 0.10;
      return tone(ramp, clamp(t, 0, 1));
    });
  }

  /* A tapering column of revolution — torsos, legs, vessel bodies. */
  function shaft(B, cx, y0, y1, w0, w1, ramp, o) {
    o = o || {};
    const base = o.t === undefined ? 0.30 : o.t;
    const seed = o.seed || 5;
    for (let y = Math.round(y0); y <= y1; y++) {
      const k = (y - y0) / Math.max(1, y1 - y0);
      const w = w0 + (w1 - w0) * k + (o.bulge ? Math.sin(k * Math.PI) * o.bulge : 0);
      for (let x = Math.round(cx - w); x <= cx + w; x++) {
        const e = (x - (cx - w)) / (2 * w || 1);
        let t = base + Math.sin(e * Math.PI) * (o.gain === undefined ? 0.44 : o.gain);
        t += (e < 0.30 ? 0.14 : 0) + (fbm(x * 0.3, y * 0.3, seed) - 0.5) * 0.12;
        put(B, x, y, tone(ramp, clamp(t, 0, 1)));
      }
    }
  }

  /* The plinth. Museums love a plinth. */
  function plinth(B, rng, ramp, y) {
    rectFill(B, 14, y, 49, y + 4, (x, py) =>
      tone(ramp, clamp(0.26 + (py === y ? 0.24 : 0) - (py - y) * 0.03 +
        (fbm(x * 0.4, py * 0.4, 19) - 0.5) * 0.10, 0, 1)));
    rectFill(B, 17, y - 2, 46, y, (x, py) => tone(ramp, clamp(0.34 + (fbm(x * 0.5, py * 0.5, 23) - 0.5) * 0.10, 0, 1)));
  }

  /* Knock a chunk off. `where` is a rough centre in sprite space. */
  function fracture(B, rng, where, size) {
    const cx = where[0], cy = where[1], seed = rng.int(1, 9999);
    for (let y = cy - size; y <= cy + size; y++)
      for (let x = cx - size; x <= cx + size; x++) {
        const d = Math.hypot(x - cx, y - cy) / size;
        if (d > 1) continue;
        if (fbm(x * 0.22, y * 0.22, seed) > d * 0.9) put(B, x, y, null);
      }
    R.relight(B, "marble", 2, -2);
  }

  /* Soil staining and root etching, on the buried side. */
  function burial(B, rng, ramp) {
    const seed = rng.int(1, 9999);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        if (!get(B, x, y)) continue;
        const n = fbm(x * 0.18, y * 0.18, seed);
        if (n > 0.60) shift(B, x, y, ramp, -2);
        if (n > 0.78) put(B, x, y, tone("soil", clamp(0.30 + fbm(x, y, seed + 3) * 0.3, 0, 1)));
        if (hsh(x, y, seed + 9) > 0.988) shift(B, x, y, ramp, -3);
      }
  }

  /* ---------- the carvers ------------------------------------------------ */

  const CARVERS = {

    /* Greco-Roman portrait bust. Nose optional, as ever. */
    bust(B, rng, mat) {
      plinth(B, rng, mat, 54);
      shaft(B, 32, 40, 54, 13, 15, mat, { t: 0.26, seed: rng.int(1, 99) });   /* shoulders */
      vol(B, 32, 36, 8, 6, mat, { t: 0.30, seed: rng.int(1, 99) });           /* neck */
      vol(B, 32, 22, 12, 15, mat, { t: 0.34, seed: rng.int(1, 99) });         /* skull */
      vol(B, 32, 28, 9, 10, mat, { t: 0.36, seed: rng.int(1, 99) });          /* face mass */
      /* brow, nose, chin — carved as three ridges */
      lineTo(B, 25, 22, 39, 22, 1, () => tone(mat, 0.62));
      lineTo(B, 32, 22, 32, 31, 1, (x, y) => tone(mat, clamp(0.66 - (y - 22) * 0.01, 0, 1)));
      lineTo(B, 30, 32, 34, 32, 0, () => tone(mat, 0.20));
      for (const s of [-1, 1]) {
        ellipseFill(B, 32 + s * 5, 24, 2.4, 1.6, () => tone(mat, 0.22));
        put(B, 32 + s * 5, 24, tone(mat, 0.08));
      }
      /* hair, curls as a field of small volumes */
      for (let i = 0; i < 46; i++) {
        const a = rng.range(Math.PI * 0.95, Math.PI * 2.05);
        const r = rng.range(10, 14);
        ellipseFill(B, 32 + Math.cos(a) * r, 22 + Math.sin(a) * r * 0.95, 2.2, 2.0,
          (x, y, dx, dy) => tone(mat, clamp(0.26 + domeLight(dx, dy, 2.2) * 0.34, 0, 1)));
      }
      if (rng.chance(0.55)) fracture(B, rng, [33, 27], rng.int(3, 6));   /* the nose */
      if (rng.chance(0.30)) fracture(B, rng, [rng.chance(0.5) ? 18 : 46, 48], rng.int(5, 9));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Cycladic: a plank of marble that is unmistakably a person. */
    cycladic(B, rng, mat) {
      polyFill(B, [[32, 4], [37, 12], [36, 20], [28, 20], [27, 12]],
        (x, y) => tone(mat, clamp(0.52 + (x - 27) * 0.012 - (y - 4) * 0.004, 0, 1)));
      lineTo(B, 32, 8, 32, 17, 0, () => tone(mat, 0.74));                /* the only feature: a nose */
      shaft(B, 32, 20, 26, 3, 3, mat, { t: 0.40, seed: rng.int(1, 99) });
      polyFill(B, [[22, 26], [42, 26], [40, 48], [24, 48]],
        (x, y) => tone(mat, clamp(0.44 + Math.sin((x - 22) / 20 * Math.PI) * 0.26, 0, 1)));
      /* arms folded, always left over right */
      lineTo(B, 24, 33, 40, 31, 1, () => tone(mat, 0.30));
      lineTo(B, 24, 37, 40, 35, 1, () => tone(mat, 0.30));
      polyFill(B, [[24, 48], [40, 48], [38, 60], [26, 60]],
        (x, y) => tone(mat, clamp(0.42 + Math.sin((x - 24) / 16 * Math.PI) * 0.24, 0, 1)));
      lineTo(B, 32, 48, 32, 60, 0, () => tone(mat, 0.24));
      /* traces of the paint that was once on all of them */
      if (rng.chance(0.5))
        for (let i = 0; i < 30; i++) {
          const x = rng.int(26, 38), y = rng.int(8, 18);
          if (get(B, x, y) && rng.chance(0.5)) put(B, x, y, tone("cinnab", 0.32));
        }
      if (rng.chance(0.4)) fracture(B, rng, [rng.int(24, 40), rng.int(50, 60)], rng.int(4, 8));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Egyptian shabti — a mummiform servant for the next life. */
    shabti(B, rng, mat) {
      shaft(B, 32, 20, 58, 9, 12, mat, { t: 0.30, seed: rng.int(1, 99), bulge: 1.5 });
      vol(B, 32, 15, 9, 10, mat, { t: 0.34, seed: rng.int(1, 99) });
      /* nemes headdress, flaring to the shoulders */
      polyFill(B, [[23, 10], [41, 10], [45, 26], [40, 26], [38, 16], [26, 16], [24, 26], [19, 26]],
        (x, y) => tone(mat, clamp(0.40 + Math.sin((x - 19) / 26 * Math.PI) * 0.24, 0, 1)));
      for (let y = 12; y < 26; y += 2) lineTo(B, 19, y, 45, y, 0, () => tone("lapis", 0.34));
      for (const s of [-1, 1]) put(B, 32 + s * 3, 16, tone("charcoal", 0.10));
      /* arms crossed on the chest holding hoes */
      lineTo(B, 25, 30, 39, 27, 1, () => tone(mat, 0.44));
      lineTo(B, 25, 34, 39, 31, 1, () => tone(mat, 0.44));
      /* the column of text down the front — the whole point of the object */
      M.glyphBlock(B, rng, { x0: 29, y0: 38, x1: 36, y1: 57, style: "hiero",
        cw: 5, ch: 5, ramp: "charcoal", t: 0.22, density: 0.95, seed: rng.int(1, 999) });
      if (rng.chance(0.4))
        for (let y = 20; y < 58; y++) for (let x = 20; x < 44; x++)
          if (get(B, x, y) && fbm(x * 0.3, y * 0.3, rng.seed % 400) > 0.62)
            put(B, x, y, tone("celadon", clamp(0.40 + fbm(x, y, 3) * 0.3, 0, 1)));   /* faience glaze */
      if (rng.chance(0.35)) fracture(B, rng, [32, rng.int(52, 60)], rng.int(4, 8));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Colossal head. Basalt, helmet, and an expression of total patience. */
    colossal(B, rng, mat) {
      vol(B, 32, 34, 24, 25, mat, { t: 0.26, gain: 0.46, grain: 0.16, seed: rng.int(1, 99) });
      /* helmet band */
      ellipseFill(B, 32, 20, 24, 15, (x, y, dx, dy) => (dy > 2 ? null :
        tone(mat, clamp(0.20 + domeLight(dx, dy, 24) * 0.40, 0, 1))));
      for (let i = 0; i < 5; i++)
        ellipseFill(B, 14 + i * 9, 12 + Math.abs(i - 2) * 2, 3, 2.4,
          (x, y, dx, dy) => tone(mat, clamp(0.24 + domeLight(dx, dy, 3) * 0.36, 0, 1)));
      /* heavy brow, flat nose, thick lips */
      rectFill(B, 18, 30, 46, 32, () => tone(mat, 0.16));
      for (const s of [-1, 1]) {
        ellipseFill(B, 32 + s * 9, 35, 5, 3, () => tone(mat, 0.42));
        ellipseFill(B, 32 + s * 9, 35, 2, 1.6, () => tone(mat, 0.10));
      }
      polyFill(B, [[32, 34], [37, 45], [27, 45]], () => tone(mat, 0.44));
      rectFill(B, 26, 44, 38, 46, () => tone(mat, 0.14));
      ellipseFill(B, 32, 50, 8, 3.4, (x, y, dx, dy) => tone(mat, clamp(0.30 + domeLight(dx, dy, 8) * 0.3, 0, 1)));
      lineTo(B, 25, 50, 39, 50, 0, () => tone(mat, 0.10));
      /* pitted volcanic stone */
      for (let i = 0; i < 260; i++) {
        const x = rng.int(8, 56), y = rng.int(8, 60);
        if (get(B, x, y)) shift(B, x, y, mat, rng.chance(0.5) ? -2 : 1);
      }
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Cast head, lost-wax, with a high beaded collar. */
    castHead(B, rng, mat) {
      plinth(B, rng, mat, 56);
      /* collar: rings of beads stacked to the jaw */
      for (let i = 0; i < 6; i++) {
        const y = 56 - i * 3;
        for (let k = 0; k < 13; k++)
          ellipseFill(B, 15 + k * 2.7, y, 1.5, 1.4, (x, py, dx, dy) =>
            tone(mat, clamp(0.34 + domeLight(dx, dy, 1.5) * 0.42, 0, 1)));
      }
      vol(B, 32, 28, 13, 16, mat, { t: 0.30, gain: 0.52, seed: rng.int(1, 99) });
      vol(B, 32, 34, 10, 11, mat, { t: 0.34, gain: 0.48, seed: rng.int(1, 99) });
      /* headdress of netted coral */
      ellipseFill(B, 32, 16, 14, 11, (x, y, dx, dy) => (dy > 3 ? null :
        tone(mat, clamp(0.28 + domeLight(dx, dy, 14) * 0.44, 0, 1))));
      for (let y = 8; y < 24; y += 2)
        for (let x = 18; x < 46; x += 2)
          if (get(B, x, y)) shift(B, x, y, mat, (x + y) % 4 === 0 ? 2 : -1);
      /* scarification lines above the brows */
      for (const s of [-1, 1])
        for (let i = 0; i < 3; i++)
          lineTo(B, 32 + s * 4, 26 + i * 1.6, 32 + s * 10, 26 + i * 1.6, 0, () => tone(mat, 0.14));
      for (const s of [-1, 1]) {
        ellipseFill(B, 32 + s * 5, 31, 3, 2, () => tone(mat, 0.52));
        ellipseFill(B, 32 + s * 5, 31, 1.2, 1.0, () => tone(mat, 0.10));
      }
      polyFill(B, [[32, 30], [35, 38], [29, 38]], () => tone(mat, 0.46));
      lineTo(B, 28, 42, 36, 42, 0, () => tone(mat, 0.14));
      R.crust(B, "verdi", rng.range(0.60, 0.72), rng.int(1, 999));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* A torso in the Gandharan/Khmer manner: wet drapery, missing everything. */
    torso(B, rng, mat) {
      shaft(B, 32, 14, 48, 12, 10, mat, { t: 0.30, gain: 0.46, bulge: 2, seed: rng.int(1, 99) });
      shaft(B, 32, 48, 60, 10, 12, mat, { t: 0.28, gain: 0.44, seed: rng.int(1, 99) });
      /* pectorals and the line of the belly */
      for (const s of [-1, 1]) vol(B, 32 + s * 6, 22, 6, 4, mat, { t: 0.36, gain: 0.40, seed: rng.int(1, 99) });
      lineTo(B, 32, 20, 32, 40, 0, () => tone(mat, 0.22));
      ellipseFill(B, 32, 40, 2.2, 1.6, () => tone(mat, 0.18));
      /* drapery, clinging */
      for (let i = 0; i < rng.int(4, 8); i++) {
        const x0 = rng.int(21, 43);
        curveTo(B, x0, 44, x0 + rng.spread(6), 52, x0 + rng.spread(8), 60, 0,
          () => tone(mat, 0.20));
      }
      /* the arms and head are gone, as they always are */
      fracture(B, rng, [32, 12], rng.int(6, 9));
      fracture(B, rng, [20, 24], rng.int(5, 8));
      fracture(B, rng, [44, 24], rng.int(5, 8));
      if (rng.chance(0.4)) fracture(B, rng, [32, 60], rng.int(5, 9));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Terracotta soldier: armour scales, topknot, mass-produced face. */
    soldier(B, rng, mat) {
      plinth(B, rng, "granite", 58);
      shaft(B, 32, 30, 58, 11, 13, mat, { t: 0.28, seed: rng.int(1, 99) });
      /* lamellar armour */
      for (let y = 32; y < 50; y += 3)
        for (let x = 22; x < 43; x += 3)
          if (get(B, x, y)) roundRect(B, x, y, x + 2, y + 2, 1,
            (px, py) => tone(mat, clamp(0.34 + (py === y ? 0.16 : -0.08), 0, 1)));
      vol(B, 32, 20, 8, 9, mat, { t: 0.34, seed: rng.int(1, 99) });
      ellipseFill(B, 32, 13, 8, 6, (x, y, dx, dy) => (dy > 1 ? null :
        tone(mat, clamp(0.28 + domeLight(dx, dy, 8) * 0.4, 0, 1))));
      ellipseFill(B, 37, 9, 3.4, 3, (x, y, dx, dy) => tone(mat, clamp(0.30 + domeLight(dx, dy, 3.4) * 0.4, 0, 1)));
      for (const s of [-1, 1]) put(B, 32 + s * 3, 20, tone("charcoal", 0.14));
      lineTo(B, 30, 25, 34, 25, 0, () => tone(mat, 0.18));
      /* moustache, on every one of them, all different */
      for (const s of [-1, 1]) lineTo(B, 32, 23, 32 + s * 4, 24 + rng.int(0, 1), 0, () => tone(mat, 0.16));
      lineTo(B, 22, 34, 20, 52, 1, () => tone(mat, 0.30));
      lineTo(B, 42, 34, 44, 52, 1, () => tone(mat, 0.30));
      /* the paint is almost entirely gone — a few flecks survive */
      for (let i = 0; i < rng.int(6, 30); i++) {
        const x = rng.int(22, 43), y = rng.int(32, 56);
        if (get(B, x, y)) put(B, x, y, tone(rng.pick(["cinnab", "malach", "lapis"]), 0.42));
      }
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Dogū: a figure with enormous slitted eyes, deliberately broken. */
    dogu(B, rng, mat) {
      vol(B, 32, 18, 15, 12, mat, { t: 0.32, seed: rng.int(1, 99) });
      for (const s of [-1, 1]) {
        ellipseFill(B, 32 + s * 7, 17, 6, 5, (x, y, dx, dy) =>
          tone(mat, clamp(0.44 + domeLight(dx, dy, 6) * 0.36, 0, 1)));
        lineTo(B, 32 + s * 7 - 4, 17, 32 + s * 7 + 4, 16, 1, () => tone(mat, 0.08));
      }
      shaft(B, 32, 30, 46, 12, 9, mat, { t: 0.30, bulge: 2, seed: rng.int(1, 99) });
      /* cord-marked surface, the signature of the whole tradition */
      for (let y = 6; y < 60; y++)
        for (let x = 8; x < 56; x++) {
          if (!get(B, x, y)) continue;
          if ((x * 2 + y * 3 + Math.round(fbm(x * 0.4, y * 0.4, 9) * 6)) % 5 === 0) shift(B, x, y, mat, -2);
        }
      for (const s of [-1, 1]) {
        shaft(B, 32 + s * 15, 30, 42, 3.5, 2.5, mat, { t: 0.30, seed: rng.int(1, 99) });
        shaft(B, 32 + s * 6, 46, 60, 4.5, 3.5, mat, { t: 0.28, seed: rng.int(1, 99) });
      }
      /* almost every one ever found was snapped before burial */
      fracture(B, rng, [32 + (rng.chance(0.5) ? -15 : 15), rng.int(34, 42)], rng.int(5, 8));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Palaeolithic Venus: no face, no feet, thirty thousand years old. */
    venus(B, rng, mat) {
      vol(B, 32, 14, 8, 8, mat, { t: 0.30, seed: rng.int(1, 99) });
      /* the woven cap, in horizontal rows — there is never a face */
      for (let y = 7; y < 21; y += 2)
        for (let x = 24; x < 41; x++)
          if (get(B, x, y)) shift(B, x, y, mat, (x + y) % 3 === 0 ? -3 : 1);
      vol(B, 32, 32, 15, 14, mat, { t: 0.30, gain: 0.52, seed: rng.int(1, 99) });
      for (const s of [-1, 1]) vol(B, 32 + s * 7, 27, 7, 6, mat, { t: 0.32, gain: 0.50, seed: rng.int(1, 99) });
      vol(B, 32, 44, 14, 11, mat, { t: 0.28, gain: 0.50, seed: rng.int(1, 99) });
      for (const s of [-1, 1]) {
        lineTo(B, 32 + s * 12, 24, 32 + s * 9, 38, 1, () => tone(mat, 0.30));
        vol(B, 32 + s * 8, 55, 5, 6, mat, { t: 0.26, seed: rng.int(1, 99) });
      }
      if (rng.chance(0.5))                      /* red ochre still in the crevices */
        for (let y = 6; y < 62; y++)
          for (let x = 12; x < 52; x++)
            if (get(B, x, y) && fbm(x * 0.3, y * 0.3, rng.seed % 300) > 0.68)
              put(B, x, y, tone("redochre", clamp(0.26 + fbm(x, y, 5) * 0.24, 0, 1)));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Carved antler: a spear-thrower with an animal at the hook. */
    antler(B, rng, mat) {
      shaft(B, 29, 20, 60, 6, 4.5, mat, { t: 0.34, gain: 0.48, seed: rng.int(1, 99) });
      curveTo(B, 29, 22, 34, 13, 42, 11, 4.5, (x, y) =>
        tone(mat, clamp(0.36 + fbm(x * 0.3, y * 0.3, 7) * 0.24, 0, 1)));
      /* the beast carved at the end, in the round */
      M.beast(B, rng, { kind: rng.pick(["horse", "deer", "bison"]), x: 42, y: 16, s: 17,
        dir: 1, ramp: mat, t: 0.46, grain: 0.16, seed: rng.int(1, 999) });
      /* engraved tally along the shaft — the marks nobody has decoded */
      for (let y = 26; y < 56; y += 3)
        if (rng.chance(0.8)) lineTo(B, 27, y, 33, y - 1, 0, () => tone(mat, 0.16));
      R.relight(B, mat, 2, -2);
      if (rng.chance(0.45)) fracture(B, rng, [30, rng.int(50, 58)], rng.int(4, 7));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Neanderthal: worked, unquestionably, and for no purpose we can name. */
    neanderForm(B, rng, mat) {
      const mode = rng.int(0, 2);
      if (mode === 0) {                        /* a flint core, knapped to nothing useful */
        polyFill(B, [[18, 46], [26, 18], [40, 14], [48, 30], [44, 50], [28, 54]],
          (x, y) => tone("obsid", clamp(0.34 + (fbm(x * 0.2, y * 0.2, 3) - 0.5) * 0.34, 0, 1)));
        for (let i = 0; i < 26; i++) {         /* conchoidal flake scars */
          const cx = rng.int(20, 46), cy = rng.int(18, 50), r = rng.range(3, 7);
          ellipseFill(B, cx, cy, r, r * 0.8, (x, y, dx, dy, d) => {
            if (!get(B, x, y)) return null;
            return tone("obsid", clamp(0.30 + (1 - d) * 0.34 + domeLight(dx, dy, r) * 0.20, 0, 1));
          });
        }
        R.relight(B, "obsid", 2, -2);
      } else if (mode === 1) {                 /* eagle talons, strung */
        const n = rng.int(3, 4);
        for (let i = 0; i < n; i++) {
          const bx = 16 + i * (34 / Math.max(1, n - 1)), by = 22;
          curveTo(B, bx, by, bx + 8, by + 16, bx - 4, by + 28, 3,
            (x, y) => tone(mat, clamp(0.34 + domeLight(x - bx, y - by, 14) * 0.34 +
              fbm(x * 0.3, y * 0.3, 11) * 0.20, 0, 1)));
          for (let k = 0; k < 4; k++)
            lineTo(B, bx - 3, by + 3 + k * 3, bx + 4, by + 3 + k * 3, 0, () => tone(mat, 0.16));
        }
        lineTo(B, 8, 21, 56, 21, 1, () => tone("leather", 0.30));
        R.relight(B, mat, 2, -2);
      } else {                                 /* a lump of ochre, ground flat on one face */
        polyFill(B, [[16, 40], [22, 20], [42, 16], [50, 34], [42, 50], [24, 50]],
          (x, y) => tone("redochre", clamp(0.28 + (fbm(x * 0.16, y * 0.16, 5) - 0.5) * 0.36, 0, 1)));
        rectFill(B, 24, 30, 44, 44, (x, y) => (get(B, x, y) ?
          tone("redochre", clamp(0.46 + (fbm(x * 0.5, y * 0.5, 7) - 0.5) * 0.14, 0, 1)) : null));
        for (let i = 0; i < 18; i++)           /* the striations from grinding */
          lineTo(B, 24, 30 + i * 0.8, 44, 30 + i * 0.8 + rng.spread(1), 0, () => tone("redochre", 0.20));
      }
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Unattributed: the recurring form. Seated, hands raised over the face. */
    coveredFace(B, rng, mat) {
      vol(B, 32, 46, 16, 14, mat, { t: 0.28, gain: 0.46, seed: rng.int(1, 99) });
      vol(B, 32, 26, 11, 12, mat, { t: 0.30, gain: 0.46, seed: rng.int(1, 99) });
      lineTo(B, 20, 46, 24, 30, 3, (x, y) => tone(mat, clamp(0.30 + (26 - x) / 8 * 0.2 + fbm(x * 0.4, y * 0.4, 3) * 0.18, 0, 1)));
      lineTo(B, 44, 46, 40, 30, 3, (x, y) => tone(mat, clamp(0.30 + (x - 38) / 8 * 0.2 + fbm(x * 0.4, y * 0.4, 3) * 0.18, 0, 1)));
      /* the hands. There are no features modelled beneath them. */
      vol(B, 26, 25, 6, 7, mat, { t: 0.34, gain: 0.44, seed: rng.int(1, 99) });
      vol(B, 38, 25, 6, 7, mat, { t: 0.34, gain: 0.44, seed: rng.int(1, 99) });
      for (let i = 0; i < 5; i++) {
        lineTo(B, 22 + i * 1.6, 20, 22 + i * 1.6, 28, 0, () => tone(mat, 0.14));
        lineTo(B, 34 + i * 1.6, 20, 34 + i * 1.6, 28, 0, () => tone(mat, 0.14));
      }
      /* eight-turn spiral incised on the back of each hand */
      M.spiral(B, rng, { x: 26, y: 25, s: 5, turns: 8, ccw: true, ramp: mat, t: 0.12, seed: 1 });
      M.spiral(B, rng, { x: 38, y: 25, s: 5, turns: 8, ccw: true, ramp: mat, t: 0.12, seed: 1 });
      /* the surface is not weathered. It has been in the ground and it is not weathered. */
      outline(B, mat, 0);
    },

    /* A standing stone carved in low relief, subject unclear. */
    stele(B, rng, mat) {
      polyFill(B, [[20, 60], [20, 12], [26, 6], [38, 6], [44, 12], [44, 60]],
        (x, y) => tone(mat, clamp(0.34 + Math.sin((x - 20) / 24 * Math.PI) * 0.24 +
          (fbm(x * 0.2, y * 0.2, 5) - 0.5) * 0.18, 0, 1)));
      const style = rng.pick(["cuneiform", "hiero", "maya", "unknown", "runic"]);
      M.glyphBlock(B, rng, { x0: 21, y0: 30, x1: 44, y1: 58, style,
        cw: 6, ch: 7, ramp: mat, t: 0.04, density: 0.95, seed: rng.int(1, 999) });
      /* a carved line has a lit lower lip; that is what makes it read as cut */
      for (let y = 30; y < 58; y++)
        for (let x = 21; x < 44; x++)
          if (get(B, x, y) === tone(mat, 0.04) && get(B, x, y + 1) !== tone(mat, 0.04))
            shift(B, x, y + 1, mat, 2);
      /* a figure in relief at the top, receiving or giving something */
      M.figureProfile(B, rng, { x: 32, y: 20, s: 15, dir: 1, ramp: mat, t: 0.18,
        skin: mat, skinT: 0.44, seed: rng.int(1, 999) });
      R.relight(B, mat, 2, -2);
      if (rng.chance(0.5)) fracture(B, rng, [rng.int(20, 44), rng.chance(0.5) ? 8 : 58], rng.int(5, 10));
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* An animal in the round: guardian lion, ram, bird. Every culture made one. */
    beastStatue(B, rng, mat) {
      plinth(B, rng, mat, 56);
      shaft(B, 32, 30, 52, 14, 12, mat, { t: 0.22, gain: 0.54, seed: rng.int(1, 99) });
      vol(B, 32, 24, 11, 9, mat, { t: 0.30, gain: 0.56, seed: rng.int(1, 99) });
      /* haunches and chest, so the silhouette is not one smooth barrel */
      for (const sd of [-1, 1])
        vol(B, 32 + sd * 10, 40, 7, 8, mat, { t: 0.24, gain: 0.52, seed: rng.int(1, 99) });
      const kind = rng.int(0, 2);
      if (kind === 0) {                          /* mane, in carved locks */
        for (let i = 0; i < 30; i++) {
          const a = rng.f() * Math.PI * 2, r = rng.range(10, 15);
          ellipseFill(B, 32 + Math.cos(a) * r, 24 + Math.sin(a) * r * 0.9, 2.4, 2,
            (x, y, dx, dy) => tone(mat, clamp(0.24 + domeLight(dx, dy, 2.4) * 0.36, 0, 1)));
        }
      } else if (kind === 1) {                   /* horns, curled */
        for (const s of [-1, 1])
          M.spiral(B, rng, { x: 32 + s * 12, y: 22, s: 8, turns: 2, ccw: s < 0, ramp: mat, t: 0.22, w: 1, seed: 1 });
      } else {                                   /* a beak and a crest */
        polyFill(B, [[32, 24], [46, 28], [32, 32]], () => tone(mat, 0.44));
        for (let i = 0; i < 5; i++) lineTo(B, 30 - i, 16, 26 - i * 1.6, 8, 0, () => tone(mat, 0.30));
      }
      for (const s of [-1, 1]) {
        ellipseFill(B, 32 + s * 4, 23, 2.2, 1.8, () => tone(mat, 0.52));
        put(B, 32 + s * 4, 23, tone(mat, 0.08));
        shaft(B, 32 + s * 9, 44, 56, 3, 4, mat, { t: 0.26, seed: rng.int(1, 99) });
      }
      if (rng.chance(0.4)) fracture(B, rng, [rng.int(22, 42), rng.int(16, 30)], rng.int(4, 8));
      R.relight(B, mat, 2, -3);
      burial(B, rng, mat);
      outline(B, mat, 0);
    },

    /* Anachronic: correct in every particular, and wearing the wrong century. */
    anachronicBust(B, rng, mat) {
      CARVERS.bust(B, rng, mat);
      /* spectacles, cast in one piece with the marble */
      for (const s of [-1, 1])
        ellipseFill(B, 32 + s * 5, 24, 4, 3.4, (x, y, dx, dy, d) =>
          (d < 0.7 ? null : tone("steel", 0.62)));
      lineTo(B, 30, 24, 34, 24, 0, () => tone("steel", 0.62));
      lineTo(B, 23, 23, 20, 25, 0, () => tone("steel", 0.56));
      lineTo(B, 41, 23, 44, 25, 0, () => tone("steel", 0.56));
      /* an identifying number cut into the base by no hand we can account for */
      M.glyphBlock(B, rng, { x0: 18, y0: 56, x1: 44, y1: 61, style: "unknown",
        cw: 4, ch: 4, ramp: "wrong", t: 0.50, density: 0.7, seed: rng.int(1, 999) });
      outline(B, mat, 0);
    },
  };

  /* Material choice is per-piece and per-culture. */
  function carve(rng, spec) {
    const B = R.Buf();
    const mat = rng.pick(spec.materials || ["marble"]);
    (CARVERS[spec.carver] || CARVERS.bust)(B, rng, mat);
    return B;
  }

  S7.sculptures = { carve, CARVERS };
})(window.S7 = window.S7 || {});
