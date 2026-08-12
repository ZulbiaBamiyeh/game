/* ============================================================================
   THE EXCAVATION VIEW

   A one-metre square of trench, seen from above. The crew clear it on their
   own at whatever rate the site can manage; brushing clears a patch right now,
   where you choose, which is how you decide what you have seen before you
   commit to an interpretation.
   ============================================================================ */
(function (S7) {
  "use strict";
  const R = S7.raster, G = S7.game;
  const { fbm, hsh, clamp } = R;

  let canvas, ctx, geom = null;
  const dust = [];        /* pooled: the per-frame path allocates nothing */
  for (let i = 0; i < 90; i++) dust.push({ life: 0, x: 0, y: 0, vx: 0, vy: 0, c: "#000" });

  function init(el, onBrush) {
    canvas = el;
    /* Match the shaft exactly so swapping between them does not reflow the page. */
    canvas.width = S7.shaftView.BW * S7.shaftView.BS;
    canvas.height = S7.shaftView.BH * S7.shaftView.BS;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const toCell = (e) => {
      if (!geom) return null;
      const r = canvas.getBoundingClientRect();
      const cx = (e.clientX - r.left) * (canvas.width / r.width);
      const cy = (e.clientY - r.top) * (canvas.height / r.height);
      const cs = G.CELL * geom.scale;
      return { gx: Math.floor((cx - geom.ox) / cs), gy: Math.floor((cy - geom.oy) / cs), px: cx, py: cy };
    };
    let down = false;
    canvas.addEventListener("pointerdown", (e) => {
      down = true;
      canvas.setPointerCapture(e.pointerId);
      const c = toCell(e);
      if (c) onBrush(c);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!down) return;
      const c = toCell(e);
      if (c) onBrush(c);
    });
    const up = (e) => { down = false; try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* already gone */ } };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  }

  /* Called when a stroke actually removed matrix, so the dust reads as effort. */
  function puff(px, py, ramp) {
    let made = 0;
    for (const d of dust) {
      if (d.life > 0) continue;
      const a = Math.random() * 6.283, s = 0.4 + Math.random() * 1.6;
      d.life = 0.5 + Math.random() * 0.5;
      d.x = px; d.y = py;
      d.vx = Math.cos(a) * s * 26; d.vy = Math.sin(a) * s * 26 - 12;
      d.c = R.RAMP[ramp][4 + ((Math.random() * 3) | 0)];
      if (++made >= 9) break;
    }
  }

  function stepDust(dt) {
    for (const d of dust) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vy += 90 * dt;
    }
  }

  function draw(S, dt) {
    const A = S.active;
    if (!A || !A.artifact) return;
    stepDust(dt || 0);

    const W = canvas.width, H = canvas.height;
    const a = A.artifact;
    const era = S7.cultures.eraAt(a.depth);

    ctx.fillStyle = "#0b0905";
    ctx.fillRect(0, 0, W, H);

    const SZ = R.SZ;
    const scale = Math.max(2, Math.floor(Math.min(W * 0.86 / SZ, H * 0.86 / SZ)));
    const ox = Math.floor((W - SZ * scale) / 2);
    const oy = Math.floor((H - SZ * scale) / 2);
    geom = { ox, oy, scale };

    /* the trench floor around the square */
    ctx.fillStyle = R.RAMP[era.ramp][2];
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      const x = (hsh(i, 1, 3) * W) | 0, y = (hsh(i, 2, 7) * H) | 0;
      ctx.fillStyle = R.RAMP[era.ramp][1 + ((hsh(i, 3, 11) * 4) | 0)];
      ctx.fillRect(x, y, 2, 2);
    }
    /* string lines marking the square */
    ctx.strokeStyle = "#c79a4255";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - scale * 3 + 0.5, oy - scale * 3 + 0.5, SZ * scale + scale * 6 - 1, SZ * scale + scale * 6 - 1);

    /* the object itself, then the matrix still covering it */
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(S7.artifacts.spriteFor(a), ox, oy, SZ * scale, SZ * scale);

    const cs = G.CELL * scale;
    for (let gy = 0; gy < G.GRID; gy++)
      for (let gx = 0; gx < G.GRID; gx++) {
        if (A.grid[gy * G.GRID + gx]) continue;
        const px = ox + gx * cs, py = oy + gy * cs;
        ctx.fillStyle = R.RAMP[era.ramp][fbm(gx * 0.6, gy * 0.6, a.depth) < 0.48 ? 3 : 4];
        ctx.fillRect(px, py, cs, cs);
        ctx.fillStyle = "#00000038";
        for (let i = 0; i < 5; i++)
          ctx.fillRect(px + hsh(gx * 7 + i, gy * 3, 2) * cs, py + hsh(gx * 3, gy * 7 + i, 5) * cs, scale, scale);
        ctx.fillStyle = "#ffffff0d"; ctx.fillRect(px, py, cs, 1);
        ctx.fillStyle = "#00000033"; ctx.fillRect(px, py + cs - 1, cs, 1);
      }

    /* soft shadow where cleared meets uncleared */
    ctx.fillStyle = "#00000045";
    for (let gy = 0; gy < G.GRID; gy++)
      for (let gx = 0; gx < G.GRID; gx++) {
        if (!A.grid[gy * G.GRID + gx]) continue;
        if (gy > 0 && !A.grid[(gy - 1) * G.GRID + gx]) ctx.fillRect(ox + gx * cs, oy + gy * cs, cs, scale);
        if (gx > 0 && !A.grid[gy * G.GRID + gx - 1]) ctx.fillRect(ox + gx * cs, oy + gy * cs, scale, cs);
      }

    for (const d of dust) {
      if (d.life <= 0) continue;
      ctx.globalAlpha = Math.min(1, d.life * 2);
      ctx.fillStyle = d.c;
      ctx.fillRect(d.x | 0, d.y | 0, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  const geometry = () => geom;

  S7.digView = { init, draw, puff, geometry };
})(window.S7 = window.S7 || {});
