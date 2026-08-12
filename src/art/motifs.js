/* ============================================================================
   MOTIF LIBRARY

   Shared marks that the culture painters compose from. A bison is a bison
   whether it is on a cave wall or a Greek vase — what changes is the pigment,
   the ground, and the rules about where it may be placed. Keeping the marks
   here and the rules in cultures.js is what lets ~18 painting traditions share
   one renderer without any of them looking like each other.

   Every motif takes (B, rng, o) where o carries absolute pixel coordinates.
   ============================================================================ */
(function (S7) {
  "use strict";
  const R = S7.raster;
  const { put, get, tone, shift, clamp, fbm, hsh, lineTo, curveTo, ellipseFill,
          rectFill, polyFill } = R;

  /* Every motif paints through this so a culture can globally desaturate,
     fade, or roughen its marks without each motif knowing about it. */
  function ink(o) {
    const ramp = o.ramp, base = o.t === undefined ? 0.32 : o.t;
    const grain = o.grain === undefined ? 0.10 : o.grain;
    const seed = o.seed || 1;
    return (x, y) => {
      if (o.broken && fbm(x * 0.5, y * 0.5, seed + 40) > o.broken) return null;
      return tone(ramp, clamp(base + (fbm(x * 0.4, y * 0.4, seed) - 0.5) * grain * 2, 0, 1));
    };
  }

  /* ---------- grounds ---------------------------------------------------- */

  /* Flat-ish wash with tooth. Every painting starts with one of these. */
  function wash(B, rng, o) {
    const seed = o.seed || rng.int(1, 9999);
    for (let y = o.y0; y <= o.y1; y++)
      for (let x = o.x0; x <= o.x1; x++) {
        let t = o.t + (fbm(x * (o.scale || 0.18), y * (o.scale || 0.18), seed) - 0.5) * (o.grain || 0.22);
        if (o.vignette) t -= (Math.abs(x - (o.x0 + o.x1) / 2) / (o.x1 - o.x0) +
                              Math.abs(y - (o.y0 + o.y1) / 2) / (o.y1 - o.y0)) * o.vignette;
        put(B, x, y, tone(o.ramp, clamp(t, 0, 1)));
      }
  }

  /* Uneven rock, for cave and fresco work: the ground has relief of its own. */
  function rockGround(B, rng, o) {
    const seed = o.seed || rng.int(1, 9999);
    for (let y = o.y0; y <= o.y1; y++)
      for (let x = o.x0; x <= o.x1; x++) {
        const n = fbm(x * 0.13, y * 0.13, seed);
        const m = fbm(x * 0.45, y * 0.45, seed + 11);
        let t = o.t + (n - 0.5) * 0.42 + (m - 0.5) * 0.16;
        if (n > 0.62) t += 0.10;            /* catch light on the swell */
        if (n < 0.34) t -= 0.12;            /* shadow in the hollow */
        put(B, x, y, tone(o.ramp, clamp(t, 0, 1)));
      }
  }

  /* Beaten gold leaf: mostly flat, punched with a tool, scratched through. */
  function goldGround(B, rng, o) {
    const seed = o.seed || rng.int(1, 9999);
    for (let y = o.y0; y <= o.y1; y++)
      for (let x = o.x0; x <= o.x1; x++) {
        let t = 0.66 + (hsh(x, y, seed) - 0.5) * 0.10 + Math.sin(x * 0.7 + y * 0.3) * 0.03;
        if ((x + y) % 7 === 0 && hsh(x, y, seed + 3) > 0.6) t += 0.14;
        if (fbm(x * 0.3, y * 0.3, seed + 9) > 0.72) t -= 0.30;   /* leaf loss */
        put(B, x, y, tone("gold", clamp(t, 0, 1)));
      }
  }

  /* ---------- animals ---------------------------------------------------- */

  /* One body plan, four silhouettes. The proportions carry the species; the
     cultures that paint animals mostly painted these four. */
  const BEASTS = {
    bison:   { body: 1.00, hump: 0.42, head: 0.30, neck: -0.10, leg: 0.52, horn: 1, tail: 0.4, mane: 1 },
    horse:   { body: 0.96, hump: 0.14, head: 0.26, neck: 0.16,  leg: 0.74, horn: 0, tail: 0.6, mane: 1 },
    deer:    { body: 0.82, hump: 0.10, head: 0.22, neck: 0.30,  leg: 0.78, horn: 2, tail: 0.2, mane: 0 },
    mammoth: { body: 1.10, hump: 0.50, head: 0.36, neck: -0.04, leg: 0.56, horn: 3, tail: 0.3, mane: 2 },
    aurochs: { body: 1.04, hump: 0.26, head: 0.32, neck: 0.02,  leg: 0.60, horn: 1, tail: 0.4, mane: 0 },
  };

  function beast(B, rng, o) {
    const k = BEASTS[o.kind] || BEASTS.bison;
    const s = o.s, x = o.x, y = o.y, dir = o.dir || 1;
    const f = ink(o);
    const bw = s * k.body, bh = s * 0.52;

    /* barrel */
    ellipseFill(B, x, y, bw * 0.5, bh * 0.5, (px, py, dx, dy) => {
      const lift = dx * dir < 0 ? k.hump * s * 0.5 : 0;
      return dy < -bh * 0.5 + lift ? null : f(px, py);
    });
    /* shoulder hump */
    if (k.hump > 0.16)
      ellipseFill(B, x - dir * bw * 0.22, y - bh * 0.34, bw * 0.30, k.hump * s * 0.62, f);
    /* neck and head */
    const hx = x - dir * bw * 0.54, hy = y - bh * 0.10 - k.neck * s * 0.5;
    lineTo(B, x - dir * bw * 0.30, y - bh * 0.24, hx, hy, Math.max(1, s * 0.10), f);
    ellipseFill(B, hx - dir * s * 0.10, hy, k.head * s * 0.42, k.head * s * 0.30, f);
    /* muzzle */
    lineTo(B, hx - dir * s * 0.08, hy + s * 0.02, hx - dir * s * 0.26, hy + s * 0.06,
           Math.max(0, s * 0.055), f);
    /* headgear */
    if (k.horn === 1) {                         /* bovid crescent */
      curveTo(B, hx - dir * s * 0.10, hy - s * 0.12, hx - dir * s * 0.30, hy - s * 0.30,
              hx - dir * s * 0.34, hy - s * 0.06, 0, f);
      curveTo(B, hx + dir * s * 0.02, hy - s * 0.12, hx + dir * s * 0.10, hy - s * 0.30,
              hx - dir * s * 0.02, hy - s * 0.28, 0, f);
    } else if (k.horn === 2) {                  /* antler rack */
      for (let i = 0; i < 2; i++) {
        const rx = hx + (i ? dir * s * 0.06 : -dir * s * 0.06);
        curveTo(B, rx, hy - s * 0.10, rx - dir * s * 0.10, hy - s * 0.40, rx - dir * s * 0.26, hy - s * 0.46, 0, f);
        for (let t = 0; t < 3; t++) {
          const tt = 0.30 + t * 0.24;
          lineTo(B, rx - dir * s * 0.10 * tt, hy - s * 0.10 - s * 0.34 * tt,
                 rx - dir * s * (0.10 * tt + 0.14), hy - s * 0.10 - s * (0.34 * tt + 0.12), 0, f);
        }
      }
    } else if (k.horn === 3) {                  /* tusks and trunk */
      curveTo(B, hx - dir * s * 0.16, hy + s * 0.06, hx - dir * s * 0.44, hy + s * 0.30,
              hx - dir * s * 0.30, hy + s * 0.50, Math.max(0, s * 0.05), f);
      curveTo(B, hx - dir * s * 0.18, hy + s * 0.04, hx - dir * s * 0.46, hy + s * 0.16,
              hx - dir * s * 0.52, hy - s * 0.04, 0, f);
    }
    /* legs — foreground pair drawn heavier so the animal reads as solid */
    const legY = y + bh * 0.42, legLen = k.leg * s * 0.7;
    for (let i = 0; i < 4; i++) {
      const lx = x + (i % 2 ? -1 : 1) * dir * bw * (i < 2 ? 0.30 : 0.12);
      const sway = (i < 2 ? 1 : -1) * s * 0.05 * (i % 2 ? 1 : -1);
      lineTo(B, lx, legY, lx + sway, legY + legLen, i < 2 ? Math.max(0, s * 0.05) : 0, f);
    }
    /* tail */
    if (k.tail > 0.1)
      lineTo(B, x + dir * bw * 0.48, y - bh * 0.10,
             x + dir * bw * (0.48 + k.tail * 0.22), y + bh * (0.10 + k.tail * 0.5), 0, f);
    /* mane / shaggy coat, drawn as broken hatching along the top line */
    if (k.mane) {
      for (let i = 0; i < Math.round(s * 0.7); i++) {
        const t = i / Math.round(s * 0.7);
        const mx = x - dir * bw * (0.5 - t * 0.9);
        const my = y - bh * 0.5 - (t < 0.4 ? k.hump * s * 0.4 * (1 - t / 0.4) : 0);
        if (rng.chance(0.55)) lineTo(B, mx, my, mx + rng.spread(s * 0.10), my - s * 0.10, 0, f);
      }
    }
  }

  /* ---------- people ----------------------------------------------------- */

  /* Schematic stick hunter — Levantine rock art, Neolithic wall painting. */
  function stickFigure(B, rng, o) {
    const s = o.s, x = o.x, y = o.y, f = ink(o);
    ellipseFill(B, x, y - s * 0.44, s * 0.11, s * 0.13, f);
    lineTo(B, x, y - s * 0.32, x, y + s * 0.06, Math.max(0, s * 0.05), f);
    const armY = y - s * 0.24;
    lineTo(B, x, armY, x - s * 0.26, armY + (o.pose === "raised" ? -s * 0.20 : s * 0.14), 0, f);
    lineTo(B, x, armY, x + s * 0.26, armY + (o.pose === "raised" ? -s * 0.20 : s * 0.14), 0, f);
    lineTo(B, x, y + s * 0.06, x - s * 0.18, y + s * 0.46, 0, f);
    lineTo(B, x, y + s * 0.06, x + s * 0.18, y + s * 0.46, 0, f);
    if (o.spear)
      lineTo(B, x + s * 0.30, y - s * 0.52, x + s * 0.16, y + s * 0.34, 0, f);
    if (o.bow)
      curveTo(B, x + s * 0.24, y - s * 0.50, x + s * 0.46, y - s * 0.16,
              x + s * 0.24, y + s * 0.18, 0, f);
  }

  /* Egyptian / Assyrian convention: head in profile, shoulders square on. */
  function figureProfile(B, rng, o) {
    const s = o.s, x = o.x, y = o.y, dir = o.dir || 1, f = ink(o);
    const skin = ink({ ramp: o.skin || o.ramp, t: o.skinT === undefined ? 0.42 : o.skinT, seed: (o.seed || 1) + 5 });
    /* kilt / skirt */
    polyFill(B, [[x - s * 0.20, y], [x + s * 0.20, y],
                 [x + s * 0.26, y + s * 0.46], [x - s * 0.26, y + s * 0.46]], f);
    /* torso, squared to the viewer */
    polyFill(B, [[x - s * 0.24, y - s * 0.42], [x + s * 0.24, y - s * 0.42],
                 [x + s * 0.17, y + s * 0.02], [x - s * 0.17, y + s * 0.02]], skin);
    /* head in profile */
    ellipseFill(B, x + dir * s * 0.04, y - s * 0.56, s * 0.14, s * 0.16, skin);
    polyFill(B, [[x + dir * s * 0.16, y - s * 0.60], [x + dir * s * 0.26, y - s * 0.54],
                 [x + dir * s * 0.16, y - s * 0.48]], skin);   /* nose and chin */
    /* wig */
    ellipseFill(B, x - dir * s * 0.04, y - s * 0.60, s * 0.17, s * 0.17,
      (px, py, dx, dy) => (dy > 0 && dx * dir > 0 ? null : f(px, py)));
    lineTo(B, x - dir * s * 0.14, y - s * 0.56, x - dir * s * 0.14, y - s * 0.28, Math.max(0, s * 0.05), f);
    /* forward arm, held out with the palm down */
    lineTo(B, x + dir * s * 0.10, y - s * 0.34, x + dir * s * 0.40, y - s * 0.20, Math.max(0, s * 0.05), skin);
    /* stride */
    lineTo(B, x - s * 0.10, y + s * 0.44, x - dir * s * 0.24, y + s * 0.86, Math.max(0, s * 0.055), skin);
    lineTo(B, x + s * 0.10, y + s * 0.44, x + dir * s * 0.30, y + s * 0.86, Math.max(0, s * 0.055), skin);
  }

  /* Frontal, symmetrical, weightless — icon and votive convention. */
  function figureFrontal(B, rng, o) {
    const s = o.s, x = o.x, y = o.y, f = ink(o);
    const skin = ink({ ramp: o.skin || "ivory", t: o.skinT === undefined ? 0.52 : o.skinT, seed: (o.seed || 1) + 5 });
    if (o.halo) {
      const hf = ink({ ramp: o.haloRamp || "gold", t: 0.72, seed: (o.seed || 1) + 8 });
      ellipseFill(B, x, y - s * 0.58, s * 0.30, s * 0.30, (px, py, dx, dy, d) => d < 0.78 ? null : hf(px, py));
    }
    /* robe, a bell */
    polyFill(B, [[x - s * 0.18, y - s * 0.40], [x + s * 0.18, y - s * 0.40],
                 [x + s * 0.42, y + s * 0.72], [x - s * 0.42, y + s * 0.72]], f);
    /* drapery folds */
    for (let i = -2; i <= 2; i++)
      if (i !== 0)
        lineTo(B, x + i * s * 0.09, y - s * 0.30, x + i * s * 0.16, y + s * 0.70, 0,
               ink({ ramp: o.ramp, t: (o.t || 0.32) - 0.14, seed: (o.seed || 1) + 2 }));
    ellipseFill(B, x, y - s * 0.56, s * 0.15, s * 0.18, skin);
    /* hair / veil */
    ellipseFill(B, x, y - s * 0.62, s * 0.18, s * 0.16,
      (px, py, dx, dy) => (dy > s * 0.02 ? null : f(px, py)));
    /* eyes, always too large — that is the convention, not a bug */
    put(B, x - s * 0.06, y - s * 0.57, tone(o.eye || "charcoal", 0.12));
    put(B, x + s * 0.06, y - s * 0.57, tone(o.eye || "charcoal", 0.12));
    /* one hand raised in blessing, one holding a book */
    lineTo(B, x - s * 0.12, y - s * 0.30, x - s * 0.22, y - s * 0.02, Math.max(0, s * 0.05), skin);
    lineTo(B, x + s * 0.12, y - s * 0.30, x + s * 0.20, y - s * 0.10, Math.max(0, s * 0.05), skin);
    if (o.book)
      rectFill(B, x + s * 0.12, y - s * 0.14, x + s * 0.34, y + s * 0.12,
               ink({ ramp: o.bookRamp || "vermil", t: 0.44, seed: (o.seed || 1) + 12 }));
  }

  /* Oil-portrait head and shoulders: a lit mass, not a diagram. */
  function portraitBust(B, rng, o) {
    const s = o.s, x = o.x, y = o.y;
    const skinRamp = o.skin || "sand", hairRamp = o.hair || "umber";
    const key = o.key === undefined ? -0.4 : o.key;
    /* shoulders / garment */
    ellipseFill(B, x, y + s * 0.86, s * 0.62, s * 0.44,
      (px, py, dx, dy) => tone(o.ramp, clamp((o.t || 0.24) + R.domeLight(dx, dy, s) * 0.30 +
        (fbm(px * 0.3, py * 0.3, o.seed || 3) - 0.5) * 0.14, 0, 1)));
    /* neck */
    rectFill(B, x - s * 0.13, y + s * 0.22, x + s * 0.13, y + s * 0.60,
      (px, py) => tone(skinRamp, clamp(0.34 + (px - x) / s * key * 0.4, 0, 1)));
    /* skull */
    ellipseFill(B, x, y, s * 0.34, s * 0.42, (px, py, dx, dy) =>
      tone(skinRamp, clamp(0.40 + R.domeLight(dx + key * s * 0.2, dy, s * 0.8) * 0.44 +
        (fbm(px * 0.4, py * 0.4, (o.seed || 3) + 2) - 0.5) * 0.10, 0, 1)));
    /* jaw */
    ellipseFill(B, x, y + s * 0.16, s * 0.26, s * 0.28, (px, py, dx, dy) =>
      tone(skinRamp, clamp(0.38 + R.domeLight(dx + key * s * 0.2, dy, s * 0.7) * 0.40, 0, 1)));
    /* hair mass */
    ellipseFill(B, x, y - s * 0.14, s * 0.40, s * 0.38, (px, py, dx, dy) => {
      if (dy > 0 && Math.abs(dx) < s * 0.28) return null;
      return tone(hairRamp, clamp(0.22 + R.domeLight(dx, dy, s) * 0.34 +
        (fbm(px * 0.6, py * 0.6, (o.seed || 3) + 4) - 0.5) * 0.20, 0, 1));
    });
    /* features, four pixels of them, which is all that reads at this size */
    put(B, x - s * 0.14, y + s * 0.02, tone(hairRamp, 0.10));
    put(B, x + s * 0.14, y + s * 0.02, tone(hairRamp, 0.10));
    put(B, x - s * 0.15, y + s * 0.01, tone("ivory", 0.72));
    put(B, x + s * 0.15, y + s * 0.01, tone("ivory", 0.72));
    lineTo(B, x, y + s * 0.06, x + s * 0.02, y + s * 0.18, 0,
      () => tone(skinRamp, clamp(0.28, 0, 1)));
    lineTo(B, x - s * 0.09, y + s * 0.30, x + s * 0.09, y + s * 0.30, 0,
      () => tone(o.mouth || "vermil", 0.36));
  }

  /* ---------- hands, the oldest mark there is ---------------------------- */

  function handStencil(B, rng, o) {
    const s = o.s, x = o.x, y = o.y, neg = o.negative !== false;
    const f = ink(o);
    const mark = [];
    const push = (px, py) => mark.push([px | 0, py | 0]);
    /* palm */
    for (let py = -s * 0.30; py <= s * 0.34; py++)
      for (let px = -s * 0.28; px <= s * 0.28; px++)
        if ((px / (s * 0.28)) ** 2 + (py / (s * 0.32)) ** 2 <= 1) push(x + px, y + py);
    /* four fingers and a thumb, splayed */
    const fingers = [[-0.62, -0.86, 0.30], [-0.22, -1.02, 0.34], [0.18, -1.00, 0.34],
                     [0.52, -0.80, 0.30], [-0.86, -0.10, 0.28]];
    for (const fg of fingers) {
      const ex = x + fg[0] * s * 0.62, ey = y + fg[1] * s * 0.52;
      const n = Math.round(s * 0.9);
      for (let i = 0; i <= n; i++) {
        const t = i / n, cx = x + (ex - x) * t, cy = y + (ey - y) * t;
        const w = s * fg[2] * 0.34 * (1 - t * 0.35);
        for (let py = -w; py <= w; py++)
          for (let px = -w; px <= w; px++)
            if (px * px + py * py <= w * w) push(cx + px, cy + py);
      }
    }
    if (neg) {
      /* Blown pigment: a halo of spray around a hand-shaped void. */
      const inside = new Set(mark.map((m) => m[0] + "," + m[1]));
      for (let py = y - s * 1.3; py <= y + s * 0.9; py++)
        for (let px = x - s * 1.2; px <= x + s * 1.2; px++) {
          if (inside.has((px | 0) + "," + (py | 0))) continue;
          let near = false;
          for (let r = 1; r <= 6 && !near; r++)
            for (let a = 0; a < 8; a++)
              if (inside.has(((px + Math.cos(a) * r) | 0) + "," + ((py + Math.sin(a) * r) | 0))) { near = true; break; }
          if (!near) continue;
          if (hsh(px, py, (o.seed || 1) + 17) > 0.36) put(B, px, py, f(px, py));
        }
    } else {
      for (const m of mark) put(B, m[0], m[1], f(m[0], m[1]));
    }
  }

  /* ---------- geometry --------------------------------------------------- */

  function spiral(B, rng, o) {
    const f = ink(o), turns = o.turns || 8, dir = o.ccw ? -1 : 1;
    let px = null, py = null;
    for (let th = 0; th < turns * Math.PI * 2; th += 0.04) {
      const r = (o.s / (turns * Math.PI * 2)) * th;
      const x = o.x + Math.cos(th * dir) * r, y = o.y + Math.sin(th * dir) * r;
      if (px !== null) lineTo(B, px, py, x, y, o.w || 0, f);
      px = x; py = y;
    }
  }

  function meander(B, rng, o) {
    const f = ink(o), u = o.unit || 3;
    for (let x = o.x0; x < o.x1 - u * 4; x += u * 5) {
      const y = o.y;
      lineTo(B, x, y, x + u * 4, y, 0, f);
      lineTo(B, x + u * 4, y, x + u * 4, y + u * 3, 0, f);
      lineTo(B, x + u * 4, y + u * 3, x + u, y + u * 3, 0, f);
      lineTo(B, x + u, y + u * 3, x + u, y + u, 0, f);
      lineTo(B, x + u, y + u, x + u * 3, y + u, 0, f);
    }
  }

  function chevronBand(B, rng, o) {
    const f = ink(o), u = o.unit || 3;
    for (let x = o.x0; x < o.x1; x += u * 2) {
      lineTo(B, x, o.y + u, x + u, o.y - u, 0, f);
      lineTo(B, x + u, o.y - u, x + u * 2, o.y + u, 0, f);
    }
  }

  /* Norse / Insular knotwork: two sine bands crossing on a period. */
  function interlace(B, rng, o) {
    const f = ink(o);
    for (let phase = 0; phase < 2; phase++)
      for (let x = o.x0; x <= o.x1; x += 0.5) {
        const t = (x - o.x0) / (o.x1 - o.x0);
        const y = o.y + Math.sin(t * Math.PI * (o.loops || 6) * 2 + phase * Math.PI) * o.amp;
        for (let w = -(o.w || 1); w <= (o.w || 1); w++) put(B, x, y + w, f(x, y));
      }
  }

  /* Girih-style star, built from a rosette of lines rather than tiles. */
  function starTile(B, rng, o) {
    const f = ink(o), n = o.points || 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + (o.skip || 3)) / n) * Math.PI * 2;
      lineTo(B, o.x + Math.cos(a0) * o.s, o.y + Math.sin(a0) * o.s,
             o.x + Math.cos(a1) * o.s, o.y + Math.sin(a1) * o.s, 0, f);
    }
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      lineTo(B, o.x + Math.cos(a0) * o.s * 0.42, o.y + Math.sin(a0) * o.s * 0.42,
             o.x + Math.cos(a1) * o.s * 0.42, o.y + Math.sin(a1) * o.s * 0.42, 0, f);
    }
  }

  function arabesque(B, rng, o) {
    const f = ink(o);
    for (let i = 0; i < (o.stems || 5); i++) {
      const t = i / (o.stems || 5);
      const x0 = o.x0 + (o.x1 - o.x0) * t;
      curveTo(B, x0, o.y1, x0 + rng.spread(o.amp || 8), (o.y0 + o.y1) / 2,
              x0 + rng.spread(o.amp || 8), o.y0, 0, f);
      for (let k = 0; k < 3; k++) {
        const ky = o.y0 + (o.y1 - o.y0) * (0.2 + k * 0.28);
        ellipseFill(B, x0 + rng.spread(4), ky, 2.4, 1.4, f);
      }
    }
  }

  /* ---------- landscape -------------------------------------------------- */

  function mountains(B, rng, o) {
    const f = ink(o);
    const peaks = o.peaks || 4;
    const pts = [[o.x0, o.y1]];
    for (let i = 0; i <= peaks; i++) {
      const t = i / peaks;
      pts.push([o.x0 + (o.x1 - o.x0) * t,
                o.y1 - (o.h || 20) * (0.35 + 0.65 * Math.abs(Math.sin(t * 9.1 + (o.seed || 1))))]);
    }
    pts.push([o.x1, o.y1]);
    polyFill(B, pts, f);
    if (o.snow)
      for (let i = 1; i < pts.length - 1; i++)
        ellipseFill(B, pts[i][0], pts[i][1] + 2, 3, 2,
          ink({ ramp: o.snowRamp || "ivory", t: 0.82, seed: (o.seed || 1) + 3 }));
  }

  /* Hokusai-adjacent: a crest with claw-like foam fingers. */
  function waveCrest(B, rng, o) {
    const f = ink(o);
    const foam = ink({ ramp: o.foam || "ivory", t: 0.84, seed: (o.seed || 1) + 6 });
    curveTo(B, o.x0, o.y, (o.x0 + o.x1) / 2, o.y - o.amp * 1.6, o.x1, o.y + o.amp * 0.4,
            o.w || 2, f);
    for (let i = 0; i < 5; i++) {
      const t = 0.25 + i * 0.12;
      const cx = o.x0 + (o.x1 - o.x0) * t;
      const cy = o.y - o.amp * (1.0 + Math.sin(t * Math.PI) * 0.5);
      curveTo(B, cx, cy, cx + 4, cy - 6, cx - 2, cy - 10, 0, foam);
    }
    for (let i = 0; i < 26; i++)
      put(B, o.x0 + rng.f() * (o.x1 - o.x0), o.y - o.amp * rng.f() * 1.4, foam(0, 0));
  }

  function tree(B, rng, o) {
    const f = ink(o);
    const leaf = ink({ ramp: o.leaf || "malach", t: o.leafT || 0.40, seed: (o.seed || 1) + 4 });
    lineTo(B, o.x, o.y, o.x + rng.spread(2), o.y - o.s * 0.6, Math.max(0, o.s * 0.05), f);
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.5;
      lineTo(B, o.x, o.y - o.s * 0.4, o.x + Math.cos(a) * o.s * 0.4, o.y - o.s * 0.4 + Math.sin(a) * o.s * 0.4, 0, f);
    }
    ellipseFill(B, o.x, o.y - o.s * 0.78, o.s * 0.42, o.s * 0.34,
      (px, py, dx, dy) => (fbm(px * 0.5, py * 0.5, (o.seed || 1) + 9) < 0.36 ? null : leaf(px, py)));
  }

  function sunDisc(B, rng, o) {
    const f = ink(o);
    ellipseFill(B, o.x, o.y, o.s, o.s, f);
    if (o.rays)
      for (let i = 0; i < (o.rays || 12); i++) {
        const a = (i / o.rays) * Math.PI * 2;
        lineTo(B, o.x + Math.cos(a) * o.s * 1.2, o.y + Math.sin(a) * o.s * 1.2,
               o.x + Math.cos(a) * o.s * 1.7, o.y + Math.sin(a) * o.s * 1.7, 0, f);
      }
  }

  function boat(B, rng, o) {
    const f = ink(o);
    polyFill(B, [[o.x - o.s, o.y], [o.x + o.s, o.y],
                 [o.x + o.s * 0.7, o.y + o.s * 0.28], [o.x - o.s * 0.7, o.y + o.s * 0.28]], f);
    lineTo(B, o.x, o.y, o.x, o.y - o.s * 0.9, 0, f);
    if (o.sail)
      polyFill(B, [[o.x, o.y - o.s * 0.86], [o.x + o.s * 0.7, o.y - o.s * 0.30], [o.x, o.y - o.s * 0.10]],
               ink({ ramp: o.sailRamp || "ivory", t: 0.68, seed: (o.seed || 1) + 5 }));
    for (let i = 0; i < (o.oars || 0); i++)
      lineTo(B, o.x - o.s * 0.7 + i * (o.s * 1.4 / o.oars), o.y + o.s * 0.1,
             o.x - o.s * 0.9 + i * (o.s * 1.4 / o.oars), o.y + o.s * 0.5, 0, f);
  }

  /* ---------- architecture ----------------------------------------------- */

  function column(B, rng, o) {
    const f = ink(o);
    rectFill(B, o.x - o.w / 2, o.y0, o.x + o.w / 2, o.y1, f);
    rectFill(B, o.x - o.w, o.y0 - 2, o.x + o.w, o.y0, f);
    rectFill(B, o.x - o.w, o.y1, o.x + o.w, o.y1 + 2, f);
    for (let i = -1; i <= 1; i++)
      lineTo(B, o.x + i * o.w * 0.32, o.y0 + 1, o.x + i * o.w * 0.32, o.y1 - 1, 0,
             ink({ ramp: o.ramp, t: (o.t || 0.4) - 0.16, seed: (o.seed || 1) + 2 }));
  }

  function ziggurat(B, rng, o) {
    const f = ink(o), tiers = o.tiers || 4;
    for (let i = 0; i < tiers; i++) {
      const w = o.w * (1 - i / (tiers + 0.6));
      rectFill(B, o.x - w / 2, o.y - (i + 1) * o.tier, o.x + w / 2, o.y - i * o.tier, f);
    }
  }

  /* ---------- writing ---------------------------------------------------- */

  /* Text as texture. Never legible, always in the right rhythm for its script. */
  function glyphBlock(B, rng, o) {
    const f = ink(o), style = o.style || "cuneiform";
    const cw = o.cw || 5, ch = o.ch || 6;
    for (let gy = o.y0; gy + ch <= o.y1; gy += ch + 1)
      for (let gx = o.x0; gx + cw <= o.x1; gx += cw + 1) {
        if (o.density !== undefined && !rng.chance(o.density)) continue;
        if (style === "cuneiform") {
          for (let i = 0; i < rng.int(2, 5); i++) {
            const wx = gx + rng.int(0, cw - 2), wy = gy + rng.int(0, ch - 2);
            lineTo(B, wx, wy, wx + 2, wy, 0, f);
            put(B, wx + 2, wy + 1, f(wx, wy));
          }
        } else if (style === "hiero") {
          const k = rng.int(0, 3);
          if (k === 0) ellipseFill(B, gx + cw / 2, gy + ch / 2, cw * 0.36, ch * 0.30, f);
          else if (k === 1) rectFill(B, gx + 1, gy + 1, gx + cw - 1, gy + 2, f);
          else if (k === 2) { lineTo(B, gx + 1, gy + ch - 1, gx + cw - 1, gy + 1, 0, f); lineTo(B, gx + 1, gy + 1, gx + cw - 1, gy + 1, 0, f); }
          else polyFill(B, [[gx + cw / 2, gy], [gx + cw - 1, gy + ch - 1], [gx + 1, gy + ch - 1]], f);
        } else if (style === "maya") {
          R.roundRect(B, gx, gy, gx + cw, gy + ch, 1.5, f);
          for (let i = 0; i < 3; i++)
            put(B, gx + rng.int(1, cw - 1), gy + rng.int(1, ch - 1),
                tone(o.ramp, clamp((o.t || 0.3) + 0.32, 0, 1)));
        } else if (style === "runic") {
          const x = gx + cw / 2;
          lineTo(B, x, gy, x, gy + ch, 0, f);
          for (let i = 0; i < rng.int(1, 3); i++) {
            const yy = gy + rng.int(0, ch - 2), s = rng.chance(0.5) ? 1 : -1;
            lineTo(B, x, yy, x + s * (cw / 2), yy + 2, 0, f);
          }
        } else if (style === "kanji") {
          for (let i = 0; i < rng.int(2, 4); i++) {
            if (rng.chance(0.5)) lineTo(B, gx, gy + rng.int(0, ch), gx + cw, gy + rng.int(0, ch), 0, f);
            else lineTo(B, gx + rng.int(0, cw), gy, gx + rng.int(0, cw), gy + ch, 0, f);
          }
        } else {                                   /* "unknown" — no repeats */
          for (let i = 0; i < rng.int(3, 6); i++) {
            const a = rng.f() * 6.283;
            const x = gx + cw / 2, y = gy + ch / 2;
            lineTo(B, x, y, x + Math.cos(a) * cw * 0.5, y + Math.sin(a) * ch * 0.5, 0, f);
          }
        }
      }
  }

  /* ---------- surface damage --------------------------------------------- */

  /* Craquelure. Old paint splits into a net of polygons; this fakes the net. */
  function craquelure(B, rng, o) {
    const seed = o.seed || 1;
    for (let y = o.y0; y <= o.y1; y++)
      for (let x = o.x0; x <= o.x1; x++) {
        if (!get(B, x, y)) continue;
        const a = fbm(x * 0.34, y * 0.30, seed);
        const b = fbm(x * 0.31, y * 0.36, seed + 21);
        if (Math.abs(a - b) < (o.density || 0.018)) shift(B, x, y, o.ramp, -3);
      }
  }

  /* Loss: paint gone, ground showing through. */
  function flaking(B, rng, o) {
    for (let y = o.y0; y <= o.y1; y++)
      for (let x = o.x0; x <= o.x1; x++) {
        if (fbm(x * 0.18, y * 0.18, o.seed || 1) > 1 - (o.amount || 0.12))
          put(B, x, y, tone(o.ground || "chalk", clamp(0.52 + (hsh(x, y, 3) - 0.5) * 0.3, 0, 1)));
      }
  }

  /* Smoke, damp, and a century of varnish. */
  function patina(B, rng, o) {
    for (let y = o.y0; y <= o.y1; y++)
      for (let x = o.x0; x <= o.x1; x++) {
        if (!get(B, x, y)) continue;
        const n = fbm(x * 0.09, y * 0.09, o.seed || 5);
        if (n > 0.56) shift(B, x, y, o.ramp, -1);
        if (n > 0.74) shift(B, x, y, o.ramp, -1);
      }
  }

  S7.motifs = {
    ink, wash, rockGround, goldGround,
    beast, BEASTS, stickFigure, figureProfile, figureFrontal, portraitBust, handStencil,
    spiral, meander, chevronBand, interlace, starTile, arabesque,
    mountains, waveCrest, tree, sunDisc, boat, column, ziggurat,
    glyphBlock, craquelure, flaking, patina,
  };
})(window.S7 = window.S7 || {});
