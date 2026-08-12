/* ============================================================================
   THE SHAFT

   A cross-section of the hole, drawn a pixel at a time into a small buffer and
   blown up. The wall is generated from the era table, so the colour of the
   ground is the age of the ground, and the boundaries between bands are as
   sharp on screen as they are in the fiction.

   Artifacts already lifted stay visible in the wall at the depth they came
   from, which turns the shaft into a vertical index of the collection.
   ============================================================================ */
(function (S7) {
  "use strict";
  const R = S7.raster, C = S7.cultures;
  const { fbm, hsh, clamp } = R;

  const BW = 100, BH = 84, BS = 4;   /* buffer size and blow-up factor */
  const MPP = 1.5;                   /* metres per buffer row */
  const TL = 39, TR = 62;            /* tunnel walls, in buffer columns */

  let canvas, ctx, buf, bufCtx, bufImg, bufPix;
  const RGB = {};

  /* ---------- vertical pan --------------------------------------------------
     The view normally tracks the drill. Dragging or scrolling the shaft lets
     you look up toward the surface or down past the cutting face — mostly so
     four hundred metres of descent actually feels like four hundred metres —
     and it glides back to following the drill only when asked to. */
  let panRows = 0, panTarget = 0;
  let dragging = false, dragY = 0, dragPan = 0, dragMoved = 0;

  const isPanned = () => Math.abs(panTarget) > 1.5;
  const recenter = () => { panTarget = 0; };

  function init(el) {
    canvas = el;
    /* Size the element from the renderer's own numbers. Keeping these in the
       HTML meant a change to BW/BH silently clipped the drawing. */
    canvas.width = BW * BS;
    canvas.height = BH * BS;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    buf = document.createElement("canvas");
    buf.width = BW; buf.height = BH;
    bufCtx = buf.getContext("2d");
    bufImg = bufCtx.createImageData(BW, BH);
    bufPix = new Uint32Array(bufImg.data.buffer);
    for (const k in R.RAMP)
      RGB[k] = R.RAMP[k].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

    const localY = (e) => {
      const r = canvas.getBoundingClientRect();
      return (e.clientY - r.top) * (canvas.height / r.height);
    };
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true; dragMoved = 0;
      dragY = localY(e); dragPan = panTarget;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = (localY(e) - dragY) / BS;
      dragMoved = Math.max(dragMoved, Math.abs(dy));
      panRows = panTarget = dragPan - dy;
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* gone */ }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      panTarget -= e.deltaY * 0.05;
    }, { passive: false });
    canvas.style.cursor = "grab";
  }

  const px32 = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;

  function ramp32(name, i, l) {
    const arr = RGB[name] || RGB.soil;
    const c = arr[clamp(Math.round(i), 0, 7)];
    if (l === undefined || l === 1) return px32(c[0], c[1], c[2]);
    return px32(clamp(c[0] * l, 0, 255) | 0, clamp(c[1] * l, 0, 255) | 0, clamp(c[2] * l, 0, 255) | 0);
  }

  /* Rounded pebbles, for the gravel bands. */
  function clastDelta(x, wr) {
    const cs = 5, cx = Math.floor(x / cs), cy = Math.floor(wr / cs);
    for (let dy = -1; dy <= 1; dy++)
      for (let dc = -1; dc <= 1; dc++) {
        const gx = cx + dc, gy = cy + dy;
        const px = gx * cs + hsh(gx, gy, 11) * cs, py = gy * cs + hsh(gx, gy, 13) * cs;
        const r = 1.1 + hsh(gx, gy, 17) * 1.9, ax = x - px, ay = wr - py;
        if (ax * ax + ay * ay < r * r)
          return (hsh(gx, gy, 19) - 0.45) * 3.4 + ((ay < -r * 0.3 || ax < -r * 0.3) ? 0.8 : 0);
      }
    return 0;
  }

  const ERA_FEATURE = {
    overburden: "roots", industrial: "rubble", earlymod: "nodule", medieval: "nodule",
    classical: "clast", bronze: "nodule", neolithic: "fleck", palaeo: "peaty",
    longdark: "lens", unattr: "banded", floor: "none",
  };

  function groundTone(x, wr, eraSeed) {
    const m = wr * MPP + (fbm(x * 0.20, 0, 7) - 0.5) * 4.0;
    const era = C.eraAt(m);
    const feat = ERA_FEATURE[era.id];
    const seed = eraSeed + era.to;
    let t = 3.4 + (fbm(x * 0.30, wr * 0.30, seed) - 0.5) * 4.4
          + Math.sin(wr * 0.5 + fbm(x * 0.09, 0, 3) * 3) * 0.55;

    if (feat === "clast") t += clastDelta(x, wr);
    else if (feat === "roots") {
      if (Math.abs(fbm(x * 0.34, wr * 0.13, 23) - 0.5) < 0.035) t -= 2.6;
      if (hsh(x, wr, 31) > 0.988) t -= 1.6;
    } else if (feat === "nodule") { if (hsh(x, wr, 37) > 0.991) t += 2.6; }
    else if (feat === "rubble") { if (hsh(x, wr, 41) > 0.978) t += 2.2; if (hsh(x, wr, 43) > 0.992) t -= 2.4; }
    else if (feat === "fleck") { if (hsh(x, wr, 47) > 0.972) t += 3.0; }
    else if (feat === "peaty") { t -= 0.6; if (Math.abs(fbm(x * 0.2, wr * 0.5, 53) - 0.5) < 0.05) t += 1.4; }
    else if (feat === "lens") { if (Math.abs(fbm(x * 0.12, wr * 0.55, 59) - 0.5) < 0.07) t += 2.8; }
    else if (feat === "banded") { t = 3.4 + Math.sin(wr * 0.8) * 1.2 + (fbm(x * 0.3, wr * 0.3, seed) - 0.5) * 1.2; }
    else if (feat === "none") t = 3.5 + (fbm(x * 0.3, wr * 0.3, seed) - 0.5) * 0.7;

    return { era, t };
  }

  /* ---------- the frame --------------------------------------------------- */

  function draw(S, dt) {
    const drillRow = Math.floor(S.depth / MPP);
    const followRow = Math.max(0, drillRow - Math.floor(BH * 0.62));
    const maxOff = Math.max(0, Math.ceil(C.MAX_DEPTH / MPP) - BH + 8);
    const lo = -followRow, hi = maxOff - followRow;
    if (!dragging) panRows += (panTarget - panRows) * Math.min(1, (dt || 0.05) * 8);
    panRows = Math.max(lo, Math.min(hi, panRows));
    panTarget = Math.max(lo, Math.min(hi, panTarget));
    const rowOff = Math.round(followRow + panRows);
    /* Upgrade levels that change how the hole looks, not just the numbers. */
    const drillLvl = S.up.drill || 0;
    const winchLvl = S.up.winch || 0;
    const shoringLvl = S.up.shoring || 0;
    const sondeLvl = S.up.sonde || 0;
    const coreLvl = S.up.core || 0;
    const crewLvl = S.up.crew || 0;
    /* Higher drill rating → faster spin and more spoil. */
    const spinMs = Math.max(16, 72 - drillLvl * 3.2 - coreLvl * 1.5);
    const phase = Math.floor(performance.now() / spinMs);
    const eraSeed = 11;

    /* wall */
    for (let y = 0; y < BH; y++) {
      const wr = rowOff + y;
      for (let x = 0; x < BW; x++) {
        const g = groundTone(x, wr, eraSeed);
        let idx = g.t, light = 1;
        if (x >= TL && x <= TR) {
          if (wr < drillRow) {
            idx = g.t - 3.2; light = 0.60;
            if (x === TL || x === TR) { idx = g.t - 1.0; light = 0.48; }
            if ((x - TL) % 3 === 0) idx -= 0.5;
            if (wr % 7 === 0) idx += 0.7;
          }
        } else {
          if (x === TL - 1 || x === TR + 1) idx += 1.4;
          light = 1 - Math.abs(x - BW / 2) / BW * 0.22;
        }
        bufPix[y * BW + x] = ramp32(g.era.ramp, idx, light);
      }
    }

    /* horizon lines between eras — the boundaries are the point */
    for (let y = 0; y < BH; y++) {
      const wr = rowOff + y;
      const a = C.eraAt(wr * MPP), b = C.eraAt((wr + 1) * MPP);
      if (a.id === b.id) continue;
      for (let x = 0; x < BW; x++) {
        if (x >= TL && x <= TR && wr < drillRow) continue;
        bufPix[y * BW + x] = ramp32(a.ramp, 0.5, 0.7);
        if (y + 1 < BH) bufPix[(y + 1) * BW + x] = ramp32(b.ramp, 7, 0.9);
      }
    }

    /* timber shoring — denser as you buy deep-shaft shoring */
    const shoreGap = Math.max(5, 9 - Math.min(4, Math.floor(shoringLvl / 3)));
    for (let wr = rowOff; wr < rowOff + BH; wr++) {
      if (wr >= drillRow - 1 || wr % shoreGap !== 0 || wr < 2) continue;
      const y = wr - rowOff;
      for (let x = TL; x <= TR; x++) {
        bufPix[y * BW + x] = ramp32("timber", 4 + (x % 2 ? 0.6 : 0) + (shoringLvl > 4 ? 0.4 : 0));
        if (y + 1 < BH) bufPix[(y + 1) * BW + x] = ramp32("timber", 2);
      }
      bufPix[y * BW + TL + 1] = ramp32("iron", 5 + (shoringLvl > 2 ? 1 : 0));
      bufPix[y * BW + TR - 1] = ramp32("iron", 5 + (shoringLvl > 2 ? 1 : 0));
      if (shoringLvl >= 6) {
        /* steel straps on heavy shoring */
        if (y + 2 < BH) {
          bufPix[(y + 2) * BW + TL + 2] = ramp32("iron", 4);
          bufPix[(y + 2) * BW + TR - 2] = ramp32("iron", 4);
        }
      }
    }
    /* vertical props */
    for (let y = 0; y < BH; y++) {
      const wr = rowOff + y;
      if (wr >= drillRow - 1 || wr % shoreGap === 0) continue;
      bufPix[y * BW + TL + 1] = ramp32("timber", 3 + (wr % 3 === 0 ? 0.8 : 0));
      bufPix[y * BW + TR - 1] = ramp32("timber", 3 + (wr % 3 === 0 ? 0.8 : 0));
      if (shoringLvl >= 3 && wr % 2 === 0) {
        bufPix[y * BW + TL + 2] = ramp32("timber", 2.4);
        bufPix[y * BW + TR - 2] = ramp32("timber", 2.4);
      }
    }

    /* lamps — more of them as you buy them, and they actually light the wall */
    const lampGap = Math.max(6, 17 - (S.up.lamps || 0) * 1.4);
    for (let wr = rowOff - 20; wr < rowOff + BH; wr++) {
      if (wr >= drillRow - 2 || Math.round(wr % lampGap) !== 0 || wr < 3) continue;
      const y = wr - rowOff;
      if (y >= 0 && y < BH) {
        bufPix[y * BW + TR - 2] = ramp32("iron", 6);
        if (y + 1 < BH) bufPix[(y + 1) * BW + TR - 2] = ramp32("iron", 3);
      }
      for (let dy = -6; dy <= 6; dy++)
        for (let dx = -8; dx <= 3; dx++) {
          const yy = y + dy, xx = TR - 2 + dx;
          if (yy < 0 || yy >= BH || xx < TL || xx > TR) continue;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 7) continue;
          const c = bufPix[yy * BW + xx], k = 1 + (1 - d / 7) * 0.55;
          bufPix[yy * BW + xx] = px32(
            clamp((c & 255) * k * 1.03, 0, 255) | 0,
            clamp(((c >> 8) & 255) * k, 0, 255) | 0,
            clamp(((c >> 16) & 255) * k * 0.9, 0, 255) | 0);
        }
    }

    /* cables — a thin rope at first; powered winch adds a heavy pair */
    const cableN = winchLvl > 0 ? (winchLvl >= 6 ? 3 : 2) : 1;
    for (let y = 0; y < BH; y++) {
      const wr = rowOff + y;
      if (wr >= drillRow - 6) continue;
      const swing = Math.sin(wr * 0.09 + phase * 0.02) * (winchLvl > 0 ? 0.9 : 1.6);
      for (let c = 0; c < cableN; c++) {
        const cxCable = Math.round(TL + 4 + c * 3 + swing);
        if (cxCable > TL && cxCable < TR)
          bufPix[y * BW + cxCable] = ramp32("iron", winchLvl > 0 ? 4 : 2);
      }
    }

    /* the drill head — grows, spins faster, and throws more spoil as you
       service it. Core barrel thickens the stem; sonde hangs a probe below. */
    const dy0 = drillRow - rowOff;
    if (dy0 > -24 && dy0 < BH + 24) {
      const cx = Math.floor((TL + TR) / 2);
      const bodyHalf = 6 + Math.min(4, Math.floor(drillLvl / 3) + (coreLvl > 0 ? 1 : 0));
      const bitHalf = 8 + Math.min(5, Math.floor(drillLvl / 2.5) + (coreLvl > 0 ? 2 : 0));
      const bodyTop = dy0 - (9 + Math.min(4, Math.floor(drillLvl / 4)));

      /* stem / kelly bar */
      for (let y = 0; y < bodyTop; y++) {
        if (y < 0 || y >= BH) continue;
        const thick = coreLvl > 0 ? 2 : 1;
        for (let t = -thick; t <= thick; t++) {
          if (t === -thick || t === thick) bufPix[y * BW + cx + t] = ramp32("iron", 4 + (drillLvl > 5 ? 1 : 0));
        }
        if ((rowOff + y + phase) % Math.max(2, 5 - Math.floor(drillLvl / 5)) === 0)
          for (let x = cx - thick - 1; x <= cx + thick + 1; x++)
            if (x >= 0 && x < BW) bufPix[y * BW + x] = ramp32("iron", 5);
      }

      const box = (x0, y0, x1, y1, fn) => {
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            if (y < 0 || y >= BH || x < 0 || x >= BW) continue;
            bufPix[y * BW + x] = fn(x, y);
          }
      };

      /* main housing */
      box(cx - bodyHalf, bodyTop, cx + bodyHalf, dy0 - 2, (x, y) => {
        let i = 3.2 + Math.sin((x - (cx - bodyHalf)) / Math.max(1, bodyHalf * 2) * Math.PI) * 2.6;
        if (y === bodyTop) i += 1.4;
        if (y === dy0 - 2) i -= 1.6;
        if (drillLvl >= 8) i += 0.6;
        return ramp32("iron", i);
      });
      /* status stripe — ochre for a healthy serviced unit */
      box(cx - bodyHalf, dy0 - 5, cx + bodyHalf, dy0 - 4, (x) =>
        ((x + phase) % 4 < 2)
          ? px32(drillLvl >= 4 ? 220 : 199, drillLvl >= 4 ? 170 : 154, 66)
          : px32(42, 34, 15));

      /* cutting head */
      box(cx - bitHalf, dy0 - 2, cx + bitHalf, dy0 + 1, (x, y) =>
        ramp32("iron", 2.6 + Math.sin((x - (cx - bitHalf)) / Math.max(1, bitHalf * 2) * Math.PI) * 2.2
          + (y === dy0 - 2 ? 1.2 : 0) + (coreLvl > 0 ? 0.5 : 0)));

      /* teeth, animated — denser and longer with level */
      const cutting = !S.active && !S.pending;
      const toothStep = Math.max(2, 3 - Math.floor(drillLvl / 8));
      const toothReach = 2 + Math.min(3, Math.floor(drillLvl / 5));
      for (let x = cx - bitHalf; x <= cx + bitHalf; x++)
        if ((x + (cutting ? phase : 0)) % toothStep === 0) {
          for (let t = 2; t <= toothReach; t++)
            if (dy0 + t >= 0 && dy0 + t < BH)
              bufPix[(dy0 + t) * BW + x] = ramp32("iron", 6 + (t === toothReach ? 1 : 0));
        }

      /* spoil thrown up by the cut — more of it, thrown higher, when the bit is rated */
      if (cutting) {
        const nSpoil = 22 + drillLvl * 4 + coreLvl * 3;
        const rad = 7 + Math.min(8, drillLvl * 0.55);
        for (let i = 0; i < nSpoil; i++) {
          const a = hsh(i, phase, 3) * 6.283, r = 2 + hsh(i, phase, 5) * rad;
          const x = Math.round(cx + Math.cos(a) * r);
          const y = Math.round(dy0 + 1 + Math.sin(a) * r * (0.35 + drillLvl * 0.02));
          if (y < 0 || y >= BH || x < TL || x > TR) continue;
          bufPix[y * BW + x] = ramp32(C.eraAt(S.depth).ramp, 5.5 + (drillLvl > 6 ? 0.8 : 0));
        }
      }

      /* downhole sonde — a thin probe and a ping below the face */
      if (sondeLvl > 0) {
        const reach = 6 + Math.min(10, sondeLvl);
        for (let t = 3; t < reach; t++) {
          const y = dy0 + t;
          if (y < 0 || y >= BH) continue;
          bufPix[y * BW + cx] = ramp32("iron", 6);
          if (t === reach - 1) {
            bufPix[y * BW + cx - 1] = px32(80, 180, 120);
            bufPix[y * BW + cx + 1] = px32(80, 180, 120);
            if (y + 1 < BH) bufPix[(y + 1) * BW + cx] = px32(120, 220, 150);
          }
        }
      }

      /* work light at the face — brighter with lamps and a better drill */
      const lightR = 12 + Math.min(6, Math.floor(drillLvl / 3)) + Math.min(4, S.up.lamps || 0);
      for (let dy = -lightR; dy <= lightR; dy++)
        for (let dp = -lightR - 2; dp <= lightR + 2; dp++) {
          const yy = dy0 + dy, xx = cx + dp;
          if (yy < 0 || yy >= BH || xx < 0 || xx >= BW) continue;
          const d = Math.sqrt(dp * dp + dy * dy * 1.7);
          if (d > lightR) continue;
          const k = 1 + (1 - d / lightR) * (0.55 + drillLvl * 0.02);
          const c = bufPix[yy * BW + xx];
          bufPix[yy * BW + xx] = px32(
            clamp((c & 255) * k * 1.04, 0, 255) | 0,
            clamp(((c >> 8) & 255) * k, 0, 255) | 0,
            clamp(((c >> 16) & 255) * k * 0.92, 0, 255) | 0);
        }

      /* crew silhouettes at the top of the visible hole when you hire diggers */
      if (crewLvl > 0 && dy0 > 14) {
        const nCrew = Math.min(4, 1 + Math.floor(crewLvl / 4));
        for (let c = 0; c < nCrew; c++) {
          const px = TL + 3 + c * 4;
          const py = Math.max(1, Math.min(BH - 6, dy0 - 14 - (c % 2)));
          if (px >= TR - 2) break;
          bufPix[py * BW + px] = px32(60, 48, 32);
          if (py + 1 < BH) bufPix[(py + 1) * BW + px] = px32(90, 70, 45);
          if (py + 2 < BH) bufPix[(py + 2) * BW + px] = px32(40, 36, 28);
        }
      }
    }

    bufCtx.putImageData(bufImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, BW * BS, BH * BS);

    /* Finds pinned into the wall at the depth they came from, so the shaft
       doubles as a vertical index of the collection. Two finds a metre apart
       would overlap, so anything too close to the last one drawn is skipped. */
    const TH = 34;                       /* thumbnail size, in canvas pixels */
    let lastY = -1e9;
    for (let i = S.collection.length - 1; i >= 0 && i > S.collection.length - 120; i--) {
      const a = S.collection[i];
      const y = (a.depth / MPP - rowOff) * BS;
      if (y < -TH || y > BH * BS + TH) continue;
      if (Math.abs(y - lastY) < TH * 0.8) continue;
      lastY = y;
      ctx.drawImage(S7.artifacts.thumbFor(a, TH), 3 * BS, Math.round(y - TH / 2), TH, TH);
      ctx.fillStyle = "#8a6a2c";
      ctx.fillRect(3 * BS + TH, Math.round(y), (TL - 3) * BS - TH, 2);
    }

    /* depth ruler down the right edge */
    ctx.fillStyle = "#c79a42";
    ctx.font = "9px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    const markEvery = 25;
    const firstMark = Math.ceil(rowOff * MPP / markEvery) * markEvery;
    for (let m = firstMark; m < (rowOff + BH) * MPP; m += markEvery) {
      const y = Math.round((m / MPP - rowOff) * BS);
      ctx.globalAlpha = 0.55;
      ctx.fillRect((TR + 2) * BS, y, 4 * BS, 1);
      ctx.globalAlpha = 0.85;
      ctx.fillText(m + " m", (TR + 7) * BS, y);
    }
    ctx.globalAlpha = 1;

    /* vignette top and bottom, so the section reads as a window */
    const v = ctx.createLinearGradient(0, 0, 0, BH * BS);
    v.addColorStop(0, "#0b0905");
    v.addColorStop(0.10, "#0b090500");
    v.addColorStop(0.90, "#0b090500");
    v.addColorStop(1, "#0b0905");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, BW * BS, BH * BS);
  }

  S7.shaftView = { init, draw, BW, BH, BS, MPP, isPanned, recenter };
})(window.S7 = window.S7 || {});
