/* ============================================================================
   RASTER TOOLKIT

   Every sprite in the game is drawn here, pixel by pixel, into a flat array of
   hex strings and then baked once into a canvas. No image files ship with the
   game — an artifact is a seed plus a generator function.

   Colour discipline: nothing writes an arbitrary colour. Everything picks a
   step from a named 8-entry ramp, which is what stops 200 procedural sprites
   from looking like 200 unrelated sprites.
   ============================================================================ */
(function (S7) {
  "use strict";

  const SZ = 64;               /* every artifact sprite is 64x64 */

  /* ---------- colour ---------------------------------------------------- */

  const hex2 = (n) => {
    const s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return s.length < 2 ? "0" + s : s;
  };

  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return "#" + hex2((r + m) * 255) + hex2((g + m) * 255) + hex2((b + m) * 255);
  }

  /* Builds an 8-step ramp. Hue drifts cool-to-warm across the ramp and
     saturation falls off at the light end, which is what makes a flat hue read
     as a lit material rather than a tint. */
  function mkRamp(hue, sat, lo, hi, hueShift) {
    hueShift = hueShift === undefined ? -14 : hueShift;
    const out = [];
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const l = lo + (hi - lo) * Math.pow(t, 0.86);
      const s = sat * (1 - t * 0.34) * (0.72 + 0.28 * Math.sin(t * Math.PI));
      out.push(hsl(hue + hueShift * (1 - t), s, l));
    }
    return out;
  }

  /* Materials — hand-tuned, because these carry most of the sprites. */
  const RAMP = {
    rust:    ["#1d1207","#311c0c","#4b2b12","#6b3f1a","#8c5825","#a97137","#c48f52","#dcae74"],
    brass:   ["#1d1506","#33240b","#4e3711","#6d4d19","#8d6725","#ac8336","#c9a252","#e2c17c"],
    steel:   ["#101215","#1e2226","#2f353b","#454d54","#5f676f","#7b838c","#99a1aa","#b8c0c8"],
    alum:    ["#15161a","#242830","#373d46","#4e555f","#69707b","#868d97","#a4abb4","#c2c8cf"],
    clay:    ["#1e120b","#301c12","#472a1a","#603a24","#78492e","#8f5b3a","#a4714c","#bb8c63"],
    stone:   ["#16150f","#252319","#373324","#4b4532","#5f5842","#736b53","#877e66","#9c937b"],
    silver:  ["#15171a","#252a2e","#3a4046","#535a61","#6f777e","#8d959c","#abb3ba","#c9d0d6"],
    paper:   ["#1d1710","#31281a","#4a3c26","#665434","#856f47","#a38c5f","#bfa87c","#d7c39d"],
    leather: ["#170f08","#27180d","#3b2513","#52341b","#684325","#7d5430","#93673f","#a87c52"],
    plastic: ["#0f0f11","#1c1d20","#2b2d31","#3d4045","#52565c","#6a6e75","#84888f","#9ea2a9"],
    lcd:     ["#08120b","#0e2012","#153019","#1d4322","#27582b","#326e35","#3f8541","#4e9d4e"],
    glass:   ["#1a1d20","#2a3034","#3d4550","#525c6a","#6c7684","#8a939f","#a9b1bb","#cbd1d8"],
    bone:    ["#191510","#282219","#3a3225","#4d4433","#615743","#756a55","#8a7e68","#a0937c"],
    bronze:  ["#161409","#252012","#37301b","#4b4126","#5f5433","#736643","#8a7c55","#9f9169"],
    verdi:   ["#0d1512","#15241f","#1e342c","#28453a","#345849","#416b59","#4f7f6a","#5f947d"],
    marble:  ["#1a1a1c","#2b2c2f","#3f4045","#55575d","#6d6f76","#8a8c93","#a9abb1","#cbccd0"],
    basalt:  ["#0d0e10","#17191c","#232629","#313539","#41464b","#53585e","#666c73","#7b8189"],
    granite: ["#171512","#26231e","#37332c","#49443b","#5c564b","#70695c","#847d6f","#9a9284"],
    obsid:   ["#08080c","#0f1016","#181a23","#242733","#333748","#454a5f","#5a6077","#727990"],
    wood:    ["#100a05","#1e130a","#2d1d0f","#3d2915","#4d361c","#5e4424","#70532e","#83643a"],
    lacquer: ["#120607","#20090b","#300d10","#421116","#54171d","#672025","#7b2d31","#90403f"],
    gold:    ["#241804","#3d2907","#5a3d0b","#7a5511","#9c7019","#bd8d28","#d9ab42","#f0c96c"],
    iron:    ["#0c0d0f","#171a1d","#24282c","#33383e","#454b52","#585f67","#6c747d","#828b95"],
    ash:     ["#0e0e0d","#1a1a18","#282826","#383836","#4a4a47","#5d5d59","#71716c","#868680"],
    ice:     ["#0d1418","#16222a","#20323e","#2d4554","#3d5b6d","#517389","#688da4","#84a9bd"],
    /* Pigments — for paintings. Named after what was actually ground up. */
    ochre:   mkRamp(32, 0.62, 0.09, 0.74),
    redochre:mkRamp(14, 0.58, 0.08, 0.62),
    charcoal:mkRamp(28, 0.10, 0.05, 0.55),
    lapis:   mkRamp(224, 0.60, 0.09, 0.68),
    indigo:  mkRamp(238, 0.40, 0.07, 0.58),
    vermil:  mkRamp(6, 0.70, 0.10, 0.66),
    malach:  mkRamp(148, 0.46, 0.07, 0.62),
    tyrian:  mkRamp(316, 0.44, 0.08, 0.58),
    saffron: mkRamp(44, 0.72, 0.12, 0.80),
    ivory:   mkRamp(42, 0.20, 0.16, 0.90),
    umber:   mkRamp(26, 0.40, 0.05, 0.56),
    celadon: mkRamp(160, 0.24, 0.12, 0.76),
    inkwash: mkRamp(210, 0.12, 0.08, 0.82),
    cinnab:  mkRamp(2, 0.64, 0.11, 0.62),
    teal:    mkRamp(186, 0.44, 0.07, 0.66),
    plum:    mkRamp(288, 0.36, 0.06, 0.54),
    sand:    mkRamp(38, 0.32, 0.14, 0.84),
    /* Wrong colours. Used only below the unattributed horizon. */
    wrong:   mkRamp(276, 0.34, 0.04, 0.62, 60),
    void:    ["#050508","#08080e","#0c0c16","#111120","#17172c","#1f1f3a","#2a2a4b","#38385f"],
    /* Ground strata. */
    soil:    ["#150e07","#221609","#2f1e0c","#3e2810","#4d3315","#5d3f1c","#6d4c25","#7e5a30"],
    clayb:   ["#171009","#241a0e","#332614","#42321b","#523f23","#624d2c","#725c37","#836c44"],
    gravel:  ["#131312","#20201d","#2f2f2a","#3f3f38","#505046","#616154","#727263","#848473"],
    chalk:   ["#1b1b19","#2b2b28","#3d3d39","#50504b","#64645e","#797972","#8e8e86","#a4a49b"],
    peat:    ["#0c0906","#15100a","#1f180e","#2a2013","#352918","#41331e","#4d3d25","#5a482d"],
    loess:   ["#191209","#28190d","#382312","#492e18","#5b3a1f","#6d4726","#7f552f","#926438"],
    permaf:  ["#101416","#1a2124","#262f34","#333f46","#424f58","#52616c","#647481","#778897"],
    sterile: ["#2b2b28","#2e2e2b","#31312e","#343431","#373734","#3a3a37","#3d3d3a","#40403d"],
    timber:  ["#0f0a05","#1c130a","#2a1d0f","#382715","#46311b","#553c22","#63472a","#725334"],
  };

  const RAMP_NAMES = Object.keys(RAMP);

  /* ---------- noise ------------------------------------------------------ */

  function hsh(x, y, s) {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hsh(xi, yi, s), b = hsh(xi + 1, yi, s);
    const c = hsh(xi, yi + 1, s), d = hsh(xi + 1, yi + 1, s);
    const t = a + (b - a) * u, w = c + (d - c) * u;
    return t + (w - t) * v;
  }
  function fbm(x, y, s) {
    let a = 0, amp = 0.5, f = 1;
    for (let i = 0; i < 4; i++) { a += amp * vnoise(x * f, y * f, s + i * 13); amp *= 0.5; f *= 2; }
    return a;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- buffer ----------------------------------------------------- */

  function Buf() { return { d: new Array(SZ * SZ).fill(null) }; }

  function put(B, x, y, c) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= SZ || y >= SZ || !c) return;
    B.d[y * SZ + x] = c;
  }
  function get(B, x, y) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= SZ || y >= SZ) return null;
    return B.d[y * SZ + x];
  }
  function tone(r, t) {
    const a = RAMP[r] || RAMP.stone;
    return a[clamp(Math.round(t * (a.length - 1)), 0, a.length - 1)];
  }
  /* Nudge an existing pixel up or down its own ramp. Cheap shading. */
  function shift(B, x, y, r, d) {
    const c = get(B, x, y);
    if (!c) return;
    const a = RAMP[r], i = a.indexOf(c);
    if (i < 0) return;
    put(B, x, y, a[clamp(i + d, 0, a.length - 1)]);
  }

  /* Fake directional light over a sphere, key from the upper left. */
  function domeLight(dx, dy, r) {
    const nx = dx / r, ny = dy / r;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return clamp(nx * -0.5 + ny * -0.62 + nz * 0.6, 0, 1);
  }

  /* ---------- shapes ----------------------------------------------------- */

  function ellipseFill(B, cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const ax = (x - cx) / rx, ay = (y - cy) / ry, d = ax * ax + ay * ay;
        if (d <= 1) put(B, x, y, fn(x, y, x - cx, y - cy, Math.sqrt(d)));
      }
  }
  function rectFill(B, x0, y0, x1, y1, fn) {
    for (let y = Math.round(y0); y <= y1; y++)
      for (let x = Math.round(x0); x <= x1; x++) put(B, x, y, fn(x, y));
  }
  function roundRect(B, x0, y0, x1, y1, r, fn) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = Math.max(x0 + r - x, x - (x1 - r), 0);
        const qy = Math.max(y0 + r - y, y - (y1 - r), 0);
        if (qx * qx + qy * qy <= r * r) put(B, x, y, fn(x, y));
      }
  }
  function lineTo(B, x0, y0, x1, y1, w, fn) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (let oy = -w; oy <= w; oy++)
        for (let ox = -w; ox <= w; ox++)
          if (ox * ox + oy * oy <= w * w + 0.2) put(B, x + ox, y + oy, fn(x, y, t));
    }
  }
  /* Quadratic bezier — the only curve primitive the art needs. */
  function curveTo(B, x0, y0, cx, cy, x1, y1, w, fn) {
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const t = i / n, it = 1 - t;
      const x = it * it * x0 + 2 * it * t * cx + t * t * x1;
      const y = it * it * y0 + 2 * it * t * cy + t * t * y1;
      for (let oy = -w; oy <= w; oy++)
        for (let ox = -w; ox <= w; ox++)
          if (ox * ox + oy * oy <= w * w + 0.2) put(B, x + ox, y + oy, fn(x, y, t));
    }
  }
  function polyFill(B, pts, fn) {
    let minY = 1e9, maxY = -1e9;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
          xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.ceil(xs[i]); x <= xs[i + 1]; x++) put(B, x, y, fn(x, y));
    }
  }

  /* One-pixel dark keyline around everything drawn so far. */
  function outline(B, r, step) {
    const c = B.d.slice();
    const col = RAMP[r][step === undefined ? 0 : step];
    for (let y = 0; y < SZ; y++)
      for (let x = 0; x < SZ; x++) {
        if (c[y * SZ + x]) continue;
        if ((y > 0 && c[(y - 1) * SZ + x]) || (y < SZ - 1 && c[(y + 1) * SZ + x]) ||
            (x > 0 && c[y * SZ + x - 1]) || (x < SZ - 1 && c[y * SZ + x + 1]))
          put(B, x, y, col);
      }
  }

  /* Erode the silhouette with noise. This is what makes a fragment a fragment. */
  function chipEdges(B, amount, scale, seed) {
    const c = B.d.slice();
    for (let y = 0; y < SZ; y++)
      for (let x = 0; x < SZ; x++) {
        if (!c[y * SZ + x]) continue;
        const open =
          !c[(y - 1) * SZ + x] || !c[(y + 1) * SZ + x] ||
          !c[y * SZ + x - 1] || !c[y * SZ + x + 1] ||
          x === 0 || y === 0 || x === SZ - 1 || y === SZ - 1;
        if (!open) continue;
        if (fbm(x * scale, y * scale, seed) < amount) B.d[y * SZ + x] = null;
      }
  }

  /* Age everything on screen: patches of loss, staining, grime in the crevices. */
  function weather(B, ramp, strength, seed) {
    for (let y = 0; y < SZ; y++)
      for (let x = 0; x < SZ; x++) {
        if (!get(B, x, y)) continue;
        const n = fbm(x * 0.24, y * 0.24, seed);
        if (n > 1 - strength * 0.55) shift(B, x, y, ramp, -2);
        else if (n < strength * 0.30) shift(B, x, y, ramp, 1);
        if (hsh(x, y, seed + 7) > 0.985) shift(B, x, y, ramp, -3);
      }
  }

  /* Encrust with a second material — verdigris on bronze, salt on glass. */
  function crust(B, ramp, threshold, seed) {
    for (let y = 0; y < SZ; y++)
      for (let x = 0; x < SZ; x++) {
        if (!get(B, x, y)) continue;
        if (fbm(x * 0.32, y * 0.32, seed) > threshold)
          put(B, x, y, tone(ramp, clamp(0.34 + fbm(x, y, seed + 3) * 0.36, 0, 1)));
      }
  }

  /* Bevel: lighten top edges, darken bottom edges, wherever the form breaks. */
  function relight(B, ramp, up, down) {
    const c = B.d.slice();
    for (let y = 0; y < SZ; y++)
      for (let x = 0; x < SZ; x++) {
        if (!c[y * SZ + x]) continue;
        if (y > 0 && !c[(y - 1) * SZ + x]) shift(B, x, y, ramp, up);
        if (y < SZ - 1 && !c[(y + 1) * SZ + x]) shift(B, x, y, ramp, down);
      }
  }

  /* ---------- baking ----------------------------------------------------- */

  function bake(B) {
    const c = document.createElement("canvas");
    c.width = SZ; c.height = SZ;
    const g = c.getContext("2d");
    const img = g.createImageData(SZ, SZ);
    for (let i = 0; i < SZ * SZ; i++) {
      const h = B.d[i];
      if (!h) continue;
      img.data[i * 4] = parseInt(h.slice(1, 3), 16);
      img.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
      img.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function thumb(src, size) {
    const t = document.createElement("canvas");
    t.width = size; t.height = size;
    const g = t.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, size, size);
    return t;
  }

  S7.raster = {
    SZ, RAMP, RAMP_NAMES, mkRamp, hsl,
    hsh, vnoise, fbm, clamp,
    Buf, put, get, tone, shift, domeLight,
    ellipseFill, rectFill, roundRect, lineTo, curveTo, polyFill,
    outline, chipEdges, weather, crust, relight,
    bake, thumb,
  };
})(window.S7 = window.S7 || {});
