/* ============================================================================
   OBJECTS

   Everything that is neither a picture nor a statue: tools, coins, vessels,
   fittings, the things people actually lost. Each generator takes a seeded rng
   so material, proportion and damage vary between instances of the same type.
   ============================================================================ */
(function (S7) {
  "use strict";
  const R = S7.raster, M = S7.motifs;
  const { put, get, tone, shift, clamp, fbm, hsh, rectFill, ellipseFill, lineTo,
          curveTo, polyFill, roundRect, outline, domeLight, chipEdges } = R;

  const OBJECTS = {

    /* --- modern overburden ------------------------------------------------ */

    cap(B, rng) {
      const mat = rng.pick(["rust", "steel", "alum"]);
      const Rr = 27;
      const flutes = rng.int(19, 23);
      ellipseFill(B, 32, 32, Rr, Rr, (x, y, dx, dy, d) => {
        const ang = Math.atan2(dy, dx);
        let t;
        if (d > 0.70) t = 0.20 + (Math.sin(ang * flutes) * 0.5 + 0.5) * 0.44 + domeLight(dx, dy, Rr) * 0.18;
        else {
          t = 0.24 + domeLight(dx, dy, Rr * 1.9) * 0.62;
          if (Math.abs(d - 0.52) < 0.05) t += dy < 0 ? 0.20 : -0.22;
        }
        const rot = fbm(x * 0.22, y * 0.22, rng.seed % 97);
        if (rot > 0.60) t -= (rot - 0.60) * 1.6;
        return tone(mat, clamp(t, 0, 1));
      });
      for (let i = 0; i < 80; i++) {
        const a = rng.f() * 6.283, r = rng.f() * Rr;
        shift(B, 32 + Math.cos(a) * r, 32 + Math.sin(a) * r, mat, -2);
      }
      outline(B, mat, 0);
    },

    key(B, rng) {
      const mat = rng.pick(["brass", "steel", "iron"]);
      ellipseFill(B, 32, 17, 12, 12, (x, y, dx, dy, d) =>
        d < 0.46 ? null : tone(mat, clamp(0.26 + domeLight(dx, dy, 12) * 0.62 + fbm(x * 0.4, y * 0.4, 2) * 0.14, 0, 1)));
      rectFill(B, 29, 27, 35, 55, (x, y) =>
        tone(mat, clamp(0.30 + Math.sin((x - 29) / 6 * Math.PI) * 0.42 + fbm(x * 0.5, y * 0.25, 7) * 0.16, 0, 1)));
      const teeth = rng.int(3, 5);
      for (let i = 0; i < teeth; i++) {
        const y = 36 + i * rng.int(4, 6), w = rng.int(3, 7);
        rectFill(B, 35, y, 35 + w, y + 3, (x, py) => tone(mat, clamp(0.34 + fbm(x * 0.5, py * 0.5, 4) * 0.36, 0, 1)));
      }
      rectFill(B, 35, 56, 42, 58, (x, y) => tone(mat, clamp(0.30 + fbm(x * 0.5, y * 0.5, 4) * 0.34, 0, 1)));
      for (let y = 27; y <= 55; y++) shift(B, 31, y, mat, 2);
      for (let i = 0; i < 44; i++) {
        const a = rng.f() * 6.283, r = 8 + rng.f() * 4;
        shift(B, 32 + Math.cos(a) * r, 17 + Math.sin(a) * r, mat, -2);
      }
      outline(B, mat, 0);
    },

    tag(B, rng) {
      const mat = rng.pick(["alum", "brass", "steel"]);
      ellipseFill(B, 32, 12, 8, 8, (x, y, dx, dy, d) => {
        if (d < 0.55) return null;
        if (dy > 0.2 && Math.abs(dx) < 2) return null;
        return tone(mat, clamp(0.30 + domeLight(dx, dy, 8) * 0.60, 0, 1));
      });
      ellipseFill(B, 32, 38, 20, 20, (x, y, dx, dy, d) => {
        let t = 0.34 + domeLight(dx, dy, 44) * 0.40 + (hsh(y, 0, 4) - 0.5) * 0.16 + fbm(x * 0.3, y * 0.3, 11) * 0.16;
        if (d > 0.90) t -= 0.24;
        return tone(mat, clamp(t, 0, 1));
      });
      ellipseFill(B, 32, 24, 4, 4, (x, y, dx, dy, d) => (d < 0.75 ? null : tone(mat, 0.12)));
      for (const row of [33, 44])
        for (let i = 0; i < 13; i++) {
          if (!rng.chance(0.68)) continue;
          const x = 24 + i * 1.4;
          for (let d = 0; d < 5; d++) { put(B, x, row + d, tone(mat, 0.10)); shift(B, x + 1, row + d, mat, 2); }
        }
      outline(B, mat, 0);
    },

    console(B, rng) {
      roundRect(B, 9, 5, 55, 59, 6, (x, y) => {
        let t = 0.42 + ((59 - y) / 54) * 0.20 - ((x - 9) / 46) * 0.06 + fbm(x * 0.25, y * 0.25, 17) * 0.14;
        if (hsh(x, y, 21) > 0.985) t += 0.30;
        return tone("plastic", clamp(t, 0, 1));
      });
      roundRect(B, 14, 11, 50, 34, 2, () => tone("plastic", 0.20));
      const lit = rng.chance(0.5);
      rectFill(B, 16, 13, 48, 32, (x, y) => {
        let t = (lit ? 0.45 : 0.20) + fbm(x * 0.4, y * 0.4, 23) * 0.22;
        if (y % 2 === 0) t -= 0.14;
        if (lit && x > 40 && y < 20) t += 0.20;
        return tone("lcd", clamp(t, 0, 1));
      });
      rectFill(B, 17, 42, 29, 46, () => tone("plastic", 0.22));
      rectFill(B, 21, 38, 25, 50, () => tone("plastic", 0.22));
      rectFill(B, 18, 42, 28, 43, () => tone("plastic", 0.34));
      rectFill(B, 22, 39, 24, 49, () => tone("plastic", 0.34));
      ellipseFill(B, 42, 47, 4, 4, (x, y, dx, dy) => tone("plastic", clamp(0.30 + domeLight(dx, dy, 4) * 0.45, 0, 1)));
      ellipseFill(B, 50, 42, 4, 4, (x, y, dx, dy) => tone("plastic", clamp(0.30 + domeLight(dx, dy, 4) * 0.45, 0, 1)));
      for (let x = 20; x <= 44; x++)
        for (let y = 55; y <= 58; y++)
          if (fbm(x * 0.5, y * 0.5, 31) > 0.5) put(B, x, y, tone("rust", clamp(0.3 + fbm(x, y, 3) * 0.4, 0, 1)));
      outline(B, "plastic", 0);
    },

    /* --- coinage and metal ------------------------------------------------ */

    coin(B, rng) {
      const mat = rng.pick(["silver", "gold", "bronze", "brass"]);
      const Rr = rng.int(22, 27);
      ellipseFill(B, 32, 32, Rr, Rr, (x, y, dx, dy, d) => {
        let t = 0.40 + domeLight(dx, dy, Rr * 2.4) * 0.34;
        if (d > 0.84) { t = 0.30 + domeLight(dx, dy, Rr) * 0.58; if (d > 0.955) t -= 0.30; }
        return tone(mat, clamp(t + fbm(x * 0.35, y * 0.35, 41) * 0.14, 0, 1));
      });
      const device = rng.int(0, 2);
      if (device === 0) {
        M.spiral(B, rng, { x: 32, y: 32, s: Rr * 0.78, turns: 8, ccw: true, ramp: mat, t: 0.16, seed: 1 });
      } else if (device === 1) {
        M.figureProfile(B, rng, { x: 32, y: 30, s: Rr * 0.9, dir: 1, ramp: mat, t: 0.20, skin: mat, skinT: 0.44, seed: rng.int(1, 99) });
      } else {
        M.starTile(B, rng, { x: 32, y: 32, s: Rr * 0.6, points: rng.pick([6, 8, 12]), skip: 2, ramp: mat, t: 0.18, seed: 1 });
      }
      /* legend around the rim */
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * 6.283;
        put(B, 32 + Math.cos(a) * (Rr - 3), 32 + Math.sin(a) * (Rr - 3), tone(mat, 0.14));
      }
      for (let i = 0; i < 100; i++) {
        const a = rng.f() * 6.283, r = rng.f() * Rr * 0.8;
        shift(B, 32 + Math.cos(a) * r, 32 + Math.sin(a) * r, mat, 1);
      }
      if (rng.chance(0.3)) chipEdges(B, 0.44, 0.24, rng.int(1, 999));
      outline(B, mat, 0);
    },

    buckle(B, rng) {
      const mat = rng.pick(["bronze", "brass", "iron", "silver"]);
      ellipseFill(B, 32, 32, 24, 17, (x, y, dx, dy, d) => {
        if (d < 0.60) return null;
        let t = 0.30 + domeLight(dx, dy, 24) * 0.52 + fbm(x * 0.3, y * 0.3, 167) * 0.16;
        if (d > 0.95) t -= 0.22;
        return tone(mat, clamp(t, 0, 1));
      });
      rectFill(B, 30, 10, 34, 54, (x, y) => get(B, x, y) || tone(mat, clamp(0.30 + Math.sin((x - 30) / 4 * Math.PI) * 0.34, 0, 1)));
      lineTo(B, 32, 32, 54, 32, 1, (x) => tone(mat, clamp(0.34 + ((54 - x) / 22) * 0.24, 0, 1)));
      for (let i = 0; i < rng.int(6, 12); i++) {
        const a = (i / 9) * 6.283;
        ellipseFill(B, 32 + Math.cos(a) * 20, 32 + Math.sin(a) * 13.5, 2, 2,
          (x, y, dx, dy) => tone(mat, clamp(0.34 + domeLight(dx, dy, 2) * 0.4, 0, 1)));
      }
      if (mat === "bronze" || mat === "brass") R.crust(B, "verdi", rng.range(0.58, 0.70), rng.int(1, 999));
      outline(B, mat, 0);
    },

    torc(B, rng) {
      const mat = rng.pick(["gold", "bronze", "silver"]);
      const gap = rng.range(0.5, 1.1);
      for (let a = gap / 2; a < 6.283 - gap / 2; a += 0.01) {
        const x = 32 + Math.cos(a - Math.PI / 2) * 22, y = 34 + Math.sin(a - Math.PI / 2) * 22;
        ellipseFill(B, x, y, 3.4, 3.4, (px, py, dx, dy) =>
          tone(mat, clamp(0.30 + domeLight(dx, dy, 3.4) * 0.52, 0, 1)));
      }
      /* twisted rope section */
      for (let a = gap / 2; a < 6.283 - gap / 2; a += 0.04) {
        const x = 32 + Math.cos(a - Math.PI / 2) * 22, y = 34 + Math.sin(a - Math.PI / 2) * 22;
        if (Math.round(a * 14) % 2 === 0) shift(B, x, y, mat, -2);
      }
      for (const s of [-1, 1]) {
        const a = s * gap / 2 - Math.PI / 2 + (s > 0 ? 0 : 0);
        const x = 32 + Math.cos(-Math.PI / 2 + s * gap / 2) * 22;
        const y = 34 + Math.sin(-Math.PI / 2 + s * gap / 2) * 22;
        ellipseFill(B, x, y, 6, 6, (px, py, dx, dy, d) =>
          tone(mat, clamp(0.28 + domeLight(dx, dy, 6) * 0.54 - (d > 0.9 ? 0.2 : 0), 0, 1)));
      }
      R.weather(B, mat, 0.4, rng.int(1, 999));
      outline(B, mat, 0);
    },

    mirror(B, rng) {
      const mat = rng.pick(["bronze", "silver", "obsid"]);
      ellipseFill(B, 32, 26, 21, 21, (x, y, dx, dy, d) =>
        tone(mat, clamp(0.42 + domeLight(dx, dy, 40) * 0.30 - (d > 0.92 ? 0.24 : 0), 0, 1)));
      /* the back is the decorated face */
      M.starTile(B, rng, { x: 32, y: 26, s: 15, points: rng.pick([4, 8, 12]), skip: 3, ramp: mat, t: 0.20, seed: 1 });
      ellipseFill(B, 32, 26, 4, 4, (x, y, dx, dy) => tone(mat, clamp(0.24 + domeLight(dx, dy, 4) * 0.4, 0, 1)));
      rectFill(B, 28, 46, 36, 60, (x, y) => tone(rng.chance(0.5) ? mat : "wood",
        clamp(0.28 + Math.sin((x - 28) / 8 * Math.PI) * 0.34, 0, 1)));
      R.crust(B, "verdi", rng.range(0.55, 0.68), rng.int(1, 999));
      outline(B, mat, 0);
    },

    blade(B, rng) {
      const mat = rng.pick(["bronze", "iron", "steel", "obsid"]);
      const len = rng.int(42, 50);
      /* Point at the top, shoulders at the bottom, tang below that. The midrib
         is the bright line up the centre. */
      const width = (y) => 1.6 + Math.pow((y - 6) / (len - 6), 0.62) * 10;
      for (let y = 6; y < len; y++) {
        const w = width(y);
        for (let x = Math.round(32 - w); x <= 32 + w; x++) {
          const e = Math.abs(x - 32) / w;
          let t = 0.52 - e * 0.30 + fbm(x * 0.3, y * 0.2, 257) * 0.14;
          if (e < 0.16) t += 0.20;
          put(B, x, y, tone(mat, clamp(t, 0, 1)));
        }
      }
      const grip = rng.chance(0.45) ? "wood" : mat;
      rectFill(B, 27, len, 37, 58, (x, y) =>
        tone(grip, clamp(0.30 + Math.sin((x - 27) / 10 * Math.PI) * 0.34 + fbm(x * 0.4, y * 0.4, 263) * 0.14, 0, 1)));
      rectFill(B, 24, len - 1, 40, len + 1, (x) =>          /* guard */
        tone(mat, clamp(0.34 + Math.sin((x - 24) / 16 * Math.PI) * 0.30, 0, 1)));
      for (const h of [[32, len + 5], [29, len + 10], [35, len + 10]])
        ellipseFill(B, h[0], h[1], 1.6, 1.6, () => tone(mat, 0.06));
      /* edge damage — nicks along one edge only, as they always are */
      for (let y = 10; y < len - 2; y++)
        if (rng.chance(0.22)) {
          const w = width(y);
          put(B, Math.round(32 - w), y, null);
          put(B, Math.round(32 - w + 1), y, tone(mat, 0.14));
        }
      if (mat === "bronze") R.crust(B, "verdi", rng.range(0.62, 0.72), rng.int(1, 999));
      if (mat === "iron" || mat === "steel") R.crust(B, "rust", rng.range(0.48, 0.62), rng.int(1, 999));
      outline(B, mat, 0);
    },

    nail(B, rng) {
      rectFill(B, 24, 8, 42, 15, (x, y) =>
        tone("rust", clamp(0.28 + domeLight(x - 33, y - 12, 10) * 0.5 + fbm(x * 0.4, y * 0.4, 197) * 0.2, 0, 1)));
      for (let y = 15; y < 58; y++) {
        const w = Math.max(1, 6 - (y - 15) * 0.13);
        for (let x = Math.round(33 - w); x <= 33 + w; x++) {
          const e = (x - (33 - w)) / (2 * w + 0.001);
          put(B, x, y, tone("rust", clamp(0.24 + Math.sin(e * Math.PI) * 0.38 + fbm(x * 0.5, y * 0.3, 199) * 0.22, 0, 1)));
        }
      }
      R.weather(B, "rust", 0.7, rng.int(1, 999));
      outline(B, "rust", 0);
    },

    handaxe(B, rng) {
      const mat = rng.pick(["obsid", "granite", "basalt", "stone"]);
      polyFill(B, [[32, 4], [44, 22], [46, 40], [38, 56], [26, 56], [18, 40], [20, 22]],
        (x, y) => tone(mat, clamp(0.34 + (fbm(x * 0.18, y * 0.18, 3) - 0.5) * 0.26, 0, 1)));
      /* flake scars: overlapping shallow dishes, brightest at their upper edge */
      for (let i = 0; i < rng.int(20, 34); i++) {
        const cx = rng.int(20, 44), cy = rng.int(8, 52), r = rng.range(3.5, 8);
        ellipseFill(B, cx, cy, r, r * rng.range(0.6, 1.0), (x, y, dx, dy, d) => {
          if (!get(B, x, y)) return null;
          return tone(mat, clamp(0.28 + (1 - d) * 0.30 + domeLight(dx, dy, r) * 0.26, 0, 1));
        });
      }
      R.relight(B, mat, 2, -2);
      /* cortex left on one face — they never bothered to remove all of it */
      if (rng.chance(0.6))
        for (let y = 4; y < 60; y++)
          for (let x = 14; x < 50; x++)
            if (get(B, x, y) && fbm(x * 0.14, y * 0.14, rng.seed % 300) > 0.66)
              put(B, x, y, tone("chalk", clamp(0.44 + fbm(x, y, 3) * 0.2, 0, 1)));
      outline(B, mat, 0);
    },

    spearpoint(B, rng) {
      const mat = rng.pick(["obsid", "stone", "bone", "bronze"]);
      polyFill(B, [[32, 3], [41, 26], [39, 50], [32, 61], [25, 50], [23, 26]],
        (x, y) => tone(mat, clamp(0.36 + (fbm(x * 0.2, y * 0.2, 7) - 0.5) * 0.22, 0, 1)));
      /* pressure flaking: fine parallel scars from both edges */
      for (const s of [-1, 1])
        for (let i = 0; i < 22; i++) {
          const y = 6 + i * 2.4;
          lineTo(B, 32 + s * 9, y, 32 + s * 2, y + rng.spread(2), 0, (x, py) =>
            get(B, x, py) ? tone(mat, clamp(0.50 + fbm(x * 0.4, py * 0.4, 11) * 0.2, 0, 1)) : null);
        }
      /* notched base for hafting */
      if (rng.chance(0.6)) {
        ellipseFill(B, 25, 54, 3, 3, () => null);
        ellipseFill(B, 39, 54, 3, 3, () => null);
      }
      R.relight(B, mat, 2, -2);
      outline(B, mat, 0);
    },

    needle(B, rng) {
      const mat = rng.pick(["bone", "bronze", "iron"]);
      for (let i = 0; i < rng.int(2, 4); i++) {
        const x = 20 + i * 12 + rng.spread(3);
        lineTo(B, x, 8, x + rng.spread(4), 56, 1, (px, py) =>
          tone(mat, clamp(0.32 + Math.sin((px - x + 1) / 2 * Math.PI) * 0.36 + fbm(px * 0.4, py * 0.2, 5) * 0.14, 0, 1)));
        ellipseFill(B, x, 12, 2.4, 3, (px, py, dx, dy, d) => (d < 0.5 ? null : tone(mat, 0.42)));
      }
      R.weather(B, mat, 0.5, rng.int(1, 999));
      outline(B, mat, 0);
    },

    /* --- ceramics and glass ---------------------------------------------- */

    sherd(B, rng) {
      const mat = rng.pick(["clay", "sand", "stone"]);
      const seed = rng.int(1, 9999);
      const edge = (x, y) => {
        const nx = (x - 32) / 26, ny = (y - 32) / 24;
        return nx * nx + ny * ny < 1 - fbm(x * 0.16, y * 0.16, seed) * 0.55;
      };
      for (let y = 6; y < 58; y++)
        for (let x = 6; x < 58; x++) {
          if (!edge(x, y)) continue;
          let t = 0.42 + fbm(x * 0.22, y * 0.22, seed + 7) * 0.26 + ((58 - y) / 52) * 0.14;
          if (hsh(x, y, seed + 11) > 0.96) t -= 0.18;
          put(B, x, y, tone(mat, clamp(t, 0, 1)));
        }
      const dec = rng.int(0, 2);
      const pig = rng.pick(["charcoal", "redochre", "cinnab", "inkwash", "teal"]);
      if (dec === 0) {
        for (const by of rng.sample([16, 22, 26, 34, 40, 46], rng.int(2, 4)))
          for (let x = 6; x < 58; x++) {
            if (!get(B, x, by)) continue;
            for (let d = 0; d < rng.int(2, 3); d++)
              if (get(B, x, by + d)) put(B, x, by + d, tone(pig, 0.24));
          }
      } else if (dec === 1) {
        M.spiral(B, rng, { x: 32, y: 32, s: 16, turns: rng.int(3, 6), ramp: pig, t: 0.22, seed: 1 });
      } else {
        M.chevronBand(B, rng, { x0: 8, x1: 56, y: 26, unit: 4, ramp: pig, t: 0.22, seed: 1 });
        M.chevronBand(B, rng, { x0: 8, x1: 56, y: 40, unit: 4, ramp: pig, t: 0.22, seed: 1 });
      }
      R.relight(B, mat, 2, -2);
      outline(B, mat, 0);
    },

    vessel(B, rng) {
      const mat = rng.pick(["clay", "sand", "celadon", "stone"]);
      const neck = rng.int(8, 14), belly = rng.int(20, 25);
      const prof = (y) =>
        y < neck ? 7 :
        y < neck + 8 ? 7 + (y - neck) * ((belly - 7) / 8) :
        y < 46 ? belly - Math.pow((y - neck - 8) / (46 - neck - 8), 2) * (belly - 12) : 12;
      for (let y = 6; y < 58; y++) {
        const w = prof(y);
        for (let x = Math.round(32 - w); x <= 32 + w; x++) {
          const e = (x - (32 - w)) / (2 * w);
          let t = 0.28 + Math.sin(e * Math.PI) * 0.42 + fbm(x * 0.3, y * 0.2, 5) * 0.14;
          if (e < 0.24) t += 0.16;
          put(B, x, y, tone(mat, clamp(t, 0, 1)));
        }
      }
      /* rim and foot */
      rectFill(B, 24, 4, 40, 8, (x, y) => tone(mat, clamp(0.34 + Math.sin((x - 24) / 16 * Math.PI) * 0.36, 0, 1)));
      rectFill(B, 20, 56, 44, 60, (x, y) => tone(mat, clamp(0.30 + Math.sin((x - 20) / 24 * Math.PI) * 0.32, 0, 1)));
      /* handles */
      if (rng.chance(0.6))
        for (const s of [-1, 1])
          curveTo(B, 32 + s * (belly - 2), 22, 32 + s * (belly + 8), 30, 32 + s * (belly - 4), 40, 2,
            (x, y) => tone(mat, clamp(0.34 + fbm(x * 0.3, y * 0.3, 9) * 0.24, 0, 1)));
      /* painted decoration around the belly */
      const pig = rng.pick(["charcoal", "redochre", "inkwash", "cinnab"]);
      for (const by of [26, 38]) M.meander(B, rng, { x0: 14, x1: 50, y: by, unit: 3, ramp: pig, t: 0.20, seed: 1 });
      if (rng.chance(0.4)) chipEdges(B, 0.40, 0.20, rng.int(1, 999));
      R.weather(B, mat, 0.4, rng.int(1, 999));
      outline(B, mat, 0);
    },

    lamp(B, rng) {
      const mat = rng.pick(["clay", "bronze", "stone"]);
      ellipseFill(B, 13, 36, 9, 9, (x, y, dx, dy, d) =>
        d < 0.55 ? null : tone(mat, clamp(0.26 + domeLight(dx, dy, 9) * 0.50, 0, 1)));
      ellipseFill(B, 33, 38, 21, 15, (x, y, dx, dy) =>
        tone(mat, clamp(0.30 + domeLight(dx / 21 * 20, dy / 15 * 20, 26) * 0.50 + fbm(x * 0.25, y * 0.25, 107) * 0.18, 0, 1)));
      for (let x = 50; x <= 61; x++) {
        const h = Math.max(1.5, 7 - (x - 50) * 0.5);
        for (let y = Math.round(36 - h); y <= 36 + h; y++)
          put(B, x, y, tone(mat, clamp(0.28 + ((36 - y) / h) * 0.24 + fbm(x * 0.3, y * 0.3, 109) * 0.2, 0, 1)));
      }
      ellipseFill(B, 57, 36, 2.6, 2.4, () => tone(mat, 0.06));
      ellipseFill(B, 33, 34, 6, 4, (x, y, dx, dy, d) => (d > 0.8 ? tone(mat, 0.14) : tone(mat, 0.04)));
      /* stamped decoration on the discus */
      if (rng.chance(0.6))
        M.starTile(B, rng, { x: 33, y: 42, s: 7, points: rng.pick([6, 8]), skip: 2, ramp: mat, t: 0.14, seed: 1 });
      for (let a = 0; a < 6.283; a += 0.01) shift(B, 33 + Math.cos(a) * 15.5, 38 + Math.sin(a) * 10.5, mat, -2);
      R.weather(B, mat, 0.4, rng.int(1, 999));
      outline(B, mat, 0);
    },

    bottle(B, rng) {
      const prof = (y) => (y < 14 ? 5 : y < 20 ? 5 + (y - 14) * 1.5 : y < 26 ? 14 + (y - 20) * 0.7 : 18);
      for (let y = 6; y < 60; y++) {
        const w = prof(y);
        for (let x = Math.round(32 - w); x <= 32 + w; x++) {
          const e = (x - (32 - w)) / (2 * w);
          let t = 0.30 + Math.sin(e * Math.PI) * 0.42 + fbm(x * 0.3, y * 0.2, 181) * 0.14;
          if (e < 0.24) t += 0.22;
          put(B, x, y, tone("glass", clamp(t, 0, 1)));
        }
      }
      rectFill(B, 26, 6, 38, 10, (x, y) => tone("glass", clamp(0.34 + Math.sin((x - 26) / 12 * Math.PI) * 0.36, 0, 1)));
      for (let x = 26; x <= 38; x++) { shift(B, x, 8, "glass", -2); shift(B, x, 10, "glass", -2); }
      for (let y = 32; y <= 44; y++)
        for (let x = 18; x <= 46; x++) {
          if (!get(B, x, y)) continue;
          if (Math.abs(fbm(x * 0.3, y * 0.5, 191) - 0.5) < 0.05) shift(B, x, y, "glass", -2);
        }
      R.crust(B, rng.pick(["verdi", "tyrian", "teal"]), rng.range(0.62, 0.72), rng.int(1, 999));
      outline(B, "glass", 0);
    },

    /* --- organic ---------------------------------------------------------- */

    bonefrag(B, rng) {
      for (let y = 10; y < 56; y++) {
        const w = 8 + Math.sin((y - 10) / 46 * Math.PI) * -3.4 + (y < 18 || y > 48 ? 4 : 0);
        for (let x = Math.round(32 - w); x <= 32 + w; x++) {
          const e = (x - (32 - w)) / (2 * w);
          let t = 0.40 + Math.sin(e * Math.PI) * 0.34 + fbm(x * 0.3, y * 0.3, 223) * 0.16;
          if (hsh(x, y, 227) > 0.90) t -= 0.16;
          put(B, x, y, tone("bone", clamp(t, 0, 1)));
        }
      }
      const snapAt = rng.chance(0.5) ? 48 : 14;
      for (let y = snapAt; y < snapAt + 8; y++)
        for (let x = 18; x < 46; x++)
          if (fbm(x * 0.5, y * 0.6, rng.seed % 400) < 0.42) put(B, x, y, null);
      R.relight(B, "bone", 2, -3);
      for (let i = 0; i < 70; i++) shift(B, rng.int(20, 44), rng.int(14, 46), "bone", -2);
      /* cut marks, if this one was butchered */
      if (rng.chance(0.4))
        for (let i = 0; i < rng.int(3, 7); i++) {
          const y = rng.int(18, 46);
          lineTo(B, 24, y, 40, y + rng.spread(2), 0, (x, py) => (get(B, x, py) ? tone("bone", 0.14) : null));
        }
      outline(B, "bone", 0);
    },

    bead(B, rng) {
      const mat = rng.pick(["stone", "bone", "glass", "gold", "ice"]);
      const n = rng.int(5, 8);
      const beads = [];
      for (let i = 0; i < n; i++)
        beads.push([rng.int(14, 50), 12 + i * (44 / n) + rng.spread(4), rng.range(5, 9)]);
      for (let i = 0; i < beads.length - 1; i++)
        lineTo(B, beads[i][0], beads[i][1], beads[i + 1][0], beads[i + 1][1], 0, () => tone("leather", 0.30));
      beads.forEach((b, i) => {
        ellipseFill(B, b[0], b[1], b[2], b[2] * 0.92, (x, y, dx, dy, d) => {
          let t = 0.26 + domeLight(dx, dy, b[2]) * 0.56 + fbm(x * 0.4, y * 0.4, 277 + i * 7) * 0.16;
          if (d > 0.92) t -= 0.18;
          return tone(mat, clamp(t, 0, 1));
        });
        ellipseFill(B, b[0], b[1], 1.8, 1.8, () => tone(mat, 0.04));
      });
      outline(B, mat, 0);
    },

    figurine(B, rng) {
      const mat = rng.pick(["clay", "stone", "bone", "sand"]);
      ellipseFill(B, 32, 46, 15, 13, (x, y, dx, dy) =>
        tone(mat, clamp(0.28 + domeLight(dx, dy, 15) * 0.46 + fbm(x * 0.3, y * 0.3, 233) * 0.14, 0, 1)));
      ellipseFill(B, 32, 26, 11, 12, (x, y, dx, dy) =>
        tone(mat, clamp(0.30 + domeLight(dx, dy, 11) * 0.48 + fbm(x * 0.3, y * 0.3, 239) * 0.12, 0, 1)));
      lineTo(B, 20, 46, 24, 30, 3, (x, y) => tone(mat, clamp(0.30 + ((26 - x) / 8) * 0.2 + fbm(x * 0.4, y * 0.4, 241) * 0.18, 0, 1)));
      lineTo(B, 44, 46, 40, 30, 3, (x, y) => tone(mat, clamp(0.30 + ((x - 38) / 8) * 0.2 + fbm(x * 0.4, y * 0.4, 241) * 0.18, 0, 1)));
      ellipseFill(B, 26, 25, 6, 7, (x, y, dx, dy) => tone(mat, clamp(0.34 + domeLight(dx, dy, 6) * 0.44, 0, 1)));
      ellipseFill(B, 38, 25, 6, 7, (x, y, dx, dy) => tone(mat, clamp(0.34 + domeLight(dx, dy, 6) * 0.44, 0, 1)));
      for (let i = 0; i < 5; i++) {
        lineTo(B, 22 + i * 1.6, 20, 22 + i * 1.6, 28, 0, () => tone(mat, 0.14));
        lineTo(B, 34 + i * 1.6, 20, 34 + i * 1.6, 28, 0, () => tone(mat, 0.14));
      }
      R.relight(B, mat, 2, -3);
      R.weather(B, mat, 0.35, rng.int(1, 999));
      outline(B, mat, 0);
    },

    /* --- writing and stone ------------------------------------------------ */

    tablet(B, rng) {
      const mat = rng.pick(["clay", "stone", "sand"]);
      roundRect(B, 10, 8, 53, 56, 3, (x, y) =>
        tone(mat, clamp(0.40 + Math.sin((x - 10) / 43 * Math.PI) * 0.22 + Math.sin((y - 8) / 48 * Math.PI) * 0.12 +
          (fbm(x * 0.2, y * 0.2, 5) - 0.5) * 0.16, 0, 1)));
      const style = rng.pick(["cuneiform", "hiero", "maya", "unknown", "kanji"]);
      M.glyphBlock(B, rng, { x0: 14, y0: 13, x1: 50, y1: 52, style,
        cw: style === "cuneiform" ? 6 : 6, ch: 6, ramp: mat, t: 0.16, density: 0.92, seed: rng.int(1, 999) });
      R.relight(B, mat, 2, -2);
      if (rng.chance(0.45)) chipEdges(B, 0.40, 0.18, rng.int(1, 999));
      R.weather(B, mat, 0.4, rng.int(1, 999));
      outline(B, mat, 0);
    },

    seal(B, rng) {
      const mat = rng.pick(["stone", "bone", "obsid", "celadon"]);
      roundRect(B, 16, 14, 47, 50, 3, (x, y) =>
        tone(mat, clamp(0.42 + domeLight(x - 32, y - 32, 22) * 0.34 + (fbm(x * 0.3, y * 0.3, 3) - 0.5) * 0.14, 0, 1)));
      M.beast(B, rng, { kind: rng.pick(["aurochs", "deer", "horse"]), x: 32, y: 34, s: 22,
        dir: -1, ramp: mat, t: 0.14, seed: rng.int(1, 999) });
      M.glyphBlock(B, rng, { x0: 18, y0: 16, x1: 45, y1: 22, style: "unknown",
        cw: 5, ch: 5, ramp: mat, t: 0.12, density: 0.9, seed: rng.int(1, 999) });
      /* boss on the back, drilled for a cord */
      ellipseFill(B, 32, 56, 6, 5, (x, y, dx, dy) => tone(mat, clamp(0.34 + domeLight(dx, dy, 6) * 0.4, 0, 1)));
      ellipseFill(B, 32, 56, 1.6, 1.4, () => tone(mat, 0.06));
      R.relight(B, mat, 2, -2);
      outline(B, mat, 0);
    },

    blockStone(B, rng) {
      const mat = rng.pick(["stone", "granite", "chalk", "basalt"]);
      rectFill(B, 3, 12, 60, 53, (x, y) => {
        let t = 0.44 + fbm(x * 0.18, y * 0.22, 53) * 0.30 - ((y - 12) / 41) * 0.10;
        if (hsh(x, y, 57) > 0.93) t -= 0.12;
        return tone(mat, clamp(t, 0, 1));
      });
      for (let y = 13; y < 53; y += 3)
        for (let x = 4; x < 60; x++)
          if (hsh(x, y, 61) > 0.55) shift(B, x, y, mat, -1);
      for (let x = 3; x <= 60; x++) { shift(B, x, 12, mat, 2); shift(B, x, 53, mat, -2); }
      const style = rng.pick(["cuneiform", "hiero", "maya", "runic", "unknown"]);
      M.glyphBlock(B, rng, { x0: 8, y0: 18, x1: 55, y1: 48, style, cw: 6, ch: 7,
        ramp: mat, t: 0.10, density: 0.75, seed: rng.int(1, 999) });
      chipEdges(B, 0.42, 0.16, rng.int(1, 999));
      R.relight(B, mat, 2, -2);
      outline(B, mat, 0);
    },

    /* --- singular pieces, used by the keystone finds --------------------- */

    ledger(B, rng) {
      rectFill(B, 14, 8, 54, 57, (x, y) =>
        tone("paper", clamp(0.62 + ((x - 14) % 3 === 0 ? -0.16 : 0) + fbm(x * 0.4, y * 0.4, 83) * 0.16, 0, 1)));
      rectFill(B, 8, 6, 46, 59, (x, y) => {
        let t = 0.42 + fbm(x * 0.2, y * 0.2, 89) * 0.26 - ((x - 8) / 38) * 0.08;
        if (hsh(x, y, 91) > 0.96) t -= 0.14;
        return tone("leather", clamp(t, 0, 1));
      });
      rectFill(B, 8, 6, 13, 59, (x, y) =>
        tone("leather", clamp(0.28 + Math.sin((x - 8) / 5 * Math.PI) * 0.26 + fbm(x * 0.5, y * 0.3, 97) * 0.14, 0, 1)));
      for (const y of [14, 24, 34, 44, 54]) for (let x = 8; x <= 13; x++) shift(B, x, y, "leather", -2);
      for (let x = 18; x <= 42; x++) { shift(B, x, 12, "leather", -3); shift(B, x, 53, "leather", -3); }
      for (let y = 12; y <= 53; y++) { shift(B, 18, y, "leather", -3); shift(B, 42, y, "leather", -3); }
      for (let y = 12; y <= 54; y += 4)
        for (let x = 47; x <= 53; x++) if (hsh(x, y, 101) > 0.35) put(B, x, y, tone("paper", 0.22));
      /* water damage rising from the bottom edge */
      for (let y = 20; y <= 59; y++)
        for (let x = 8; x <= 54; x++) {
          const rise = (y - 20) / 39, n = fbm(x * 0.14, y * 0.10, 103);
          if (n < rise * 0.85 && get(B, x, y)) {
            const r = x <= 46 ? "leather" : "paper";
            shift(B, x, y, r, -2);
            if (n < rise * 0.45) shift(B, x, y, r, -2);
          }
        }
      outline(B, "leather", 0);
    },

    watch(B, rng) {
      for (const s of [[1, 20], [44, 63]]) {
        rectFill(B, 24, s[0], 40, s[1], (x, y) => {
          let t = 0.30 + fbm(x * 0.3, y * 0.3, 127) * 0.24;
          if (fbm(x * 0.9, y * 0.9, 131) > 0.62) t -= 0.20;
          return tone("leather", clamp(t, 0, 1));
        });
        for (const sx2 of [26, 38]) for (let y = s[0]; y <= s[1]; y += 3) put(B, sx2, y, tone("leather", 0.62));
      }
      ellipseFill(B, 32, 32, 21, 21, (x, y, dx, dy, d) => {
        if (d < 0.76) return null;
        let t = 0.32 + domeLight(dx, dy, 21) * 0.56;
        if (d > 0.96) t -= 0.26;
        return tone("steel", clamp(t + fbm(x * 0.4, y * 0.4, 137) * 0.10, 0, 1));
      });
      ellipseFill(B, 32, 32, 16, 16, (x, y, dx, dy, d) => {
        let t = 0.62 + fbm(x * 0.3, y * 0.3, 139) * 0.14 - d * 0.10;
        if (hsh(x, y, 149) > 0.97) t -= 0.30;
        return tone("glass", clamp(t, 0, 1));
      });
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        lineTo(B, 32 + Math.sin(a) * 13, 32 - Math.cos(a) * 13,
               32 + Math.sin(a) * 10.5, 32 - Math.cos(a) * 10.5, i % 3 === 0 ? 1 : 0, () => tone("glass", 0.10));
      }
      lineTo(B, 32, 32, 32 + Math.sin(2.1) * 8, 32 - Math.cos(2.1) * 8, 1, () => tone("glass", 0.06));
      lineTo(B, 32, 32, 32 + Math.sin(4.4) * 12, 32 - Math.cos(4.4) * 12, 0, () => tone("glass", 0.06));
      ellipseFill(B, 32, 32, 2, 2, () => tone("steel", 0.20));
      for (let a = 3.5; a < 5.0; a += 0.02)
        for (let r = 8; r < 15.5; r += 0.5) shift(B, 32 + Math.cos(a) * r, 32 + Math.sin(a) * r, "glass", 1);
      rectFill(B, 52, 29, 56, 35, (x, y) => tone("steel", clamp(0.34 + ((32 - y) / 4) * 0.2, 0, 1)));
      outline(B, "steel", 0);
    },

    bell(B, rng) {
      const mat = rng.pick(["bronze", "brass", "iron"]);
      /* crown loop */
      ellipseFill(B, 32, 10, 6, 6, (x, y, dx, dy, d) =>
        d < 0.5 ? null : tone(mat, clamp(0.30 + domeLight(dx, dy, 6) * 0.50, 0, 1)));
      /* the bell itself: a flared skirt */
      for (let y = 14; y < 50; y++) {
        const k = (y - 14) / 36;
        const w = 6 + Math.pow(k, 1.7) * 16;
        for (let x = Math.round(32 - w); x <= 32 + w; x++) {
          const e = (x - (32 - w)) / (2 * w);
          let t = 0.28 + Math.sin(e * Math.PI) * 0.46 + fbm(x * 0.3, y * 0.2, 5) * 0.12;
          if (e < 0.26) t += 0.16;
          put(B, x, y, tone(mat, clamp(t, 0, 1)));
        }
      }
      /* the lip, thickened */
      rectFill(B, 10, 50, 54, 54, (x, y) =>
        get(B, x, 49) || Math.abs(x - 32) < 22 ? tone(mat, clamp(0.26 + Math.sin((x - 10) / 44 * Math.PI) * 0.36, 0, 1)) : null);
      /* inscription band around the waist */
      M.glyphBlock(B, rng, { x0: 16, y0: 38, x1: 48, y1: 44,
        style: rng.pick(["runic", "kanji", "unknown"]), cw: 4, ch: 5,
        ramp: mat, t: 0.12, density: 0.8, seed: rng.int(1, 999) });
      ellipseFill(B, 32, 56, 4, 4, (x, y, dx, dy) =>
        tone(mat, clamp(0.28 + domeLight(dx, dy, 4) * 0.44, 0, 1)));   /* clapper */
      R.crust(B, "verdi", rng.range(0.60, 0.72), rng.int(1, 999));
      outline(B, mat, 0);
    },

    astrolabe(B, rng) {
      const mat = rng.pick(["brass", "bronze"]);
      ellipseFill(B, 32, 34, 26, 26, (x, y, dx, dy, d) => {
        let t = 0.40 + domeLight(dx, dy, 52) * 0.28;
        if (d > 0.88) t = 0.28 + domeLight(dx, dy, 26) * 0.52;
        if (d > 0.97) t -= 0.24;
        return tone(mat, clamp(t + fbm(x * 0.3, y * 0.3, 7) * 0.12, 0, 1));
      });
      /* the graduated limb */
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * 6.283;
        lineTo(B, 32 + Math.cos(a) * 23, 34 + Math.sin(a) * 23,
               32 + Math.cos(a) * (i % 6 === 0 ? 19 : 21), 34 + Math.sin(a) * (i % 6 === 0 ? 19 : 21),
               0, () => tone(mat, 0.14));
      }
      /* rete: the star pointers, cut away to nothing */
      for (let i = 0; i < 7; i++) {
        const a = rng.f() * 6.283, r = rng.range(6, 17);
        const px = 32 + Math.cos(a) * r, py = 34 + Math.sin(a) * r;
        curveTo(B, 32, 34, px + rng.spread(6), py + rng.spread(6), px, py, 0, () => tone(mat, 0.16));
        ellipseFill(B, px, py, 1.6, 1.6, () => tone(mat, 0.66));
      }
      M.starTile(B, rng, { x: 32, y: 34, s: 12, points: rng.pick([8, 12]), skip: 3, ramp: mat, t: 0.18, seed: 1 });
      /* suspension throne */
      ellipseFill(B, 32, 6, 5, 5, (x, y, dx, dy, d) => d < 0.5 ? null : tone(mat, 0.46));
      polyFill(B, [[28, 10], [36, 10], [34, 16], [30, 16]], () => tone(mat, 0.40));
      R.weather(B, mat, 0.4, rng.int(1, 999));
      outline(B, mat, 0);
    },

    /* A survey marker. There should not be one at this depth. */
    marker(B, rng) {
      rectFill(B, 28, 6, 36, 58, (x, y) =>
        tone("iron", clamp(0.30 + Math.sin((x - 28) / 8 * Math.PI) * 0.40 + fbm(x * 0.3, y * 0.2, 3) * 0.14, 0, 1)));
      ellipseFill(B, 32, 14, 15, 13, (x, y, dx, dy, d) => {
        if (d > 0.98) return null;
        let t = 0.44 + domeLight(dx, dy, 30) * 0.28;
        if (d > 0.86) t -= 0.24;
        return tone("brass", clamp(t, 0, 1));
      });
      M.glyphBlock(B, rng, { x0: 22, y0: 9, x1: 43, y1: 20, style: "unknown",
        cw: 4, ch: 5, ramp: "brass", t: 0.12, density: 0.85, seed: rng.int(1, 999) });
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        lineTo(B, 32, 14, 32 + Math.cos(a) * 12, 14 + Math.sin(a) * 10, 0, () => tone("brass", 0.10));
      }
      R.crust(B, "verdi", 0.66, rng.int(1, 999));
      outline(B, "iron", 0);
    },
  };

  function make(rng, spec) {
    const B = R.Buf();
    (OBJECTS[spec.object] || OBJECTS.sherd)(B, rng);
    return B;
  }

  S7.objects = { make, OBJECTS };
})(window.S7 = window.S7 || {});
