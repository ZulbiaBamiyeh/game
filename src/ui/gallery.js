/* ============================================================================
   THE GALLERY

   A side-on cutaway of the museum, one long scrollable strip: rooms in depth
   order, exhibits hung and plinthed along them, and the crowd walking through.

   Two resolutions on one canvas, deliberately. The world is drawn at an
   integer 2× so the pixel art stays crisp — artifacts land 1:1, people 2:1,
   and nothing is ever sampled at a fraction. Labels and speech bubbles are
   drawn afterwards at the canvas's own resolution, because 6-pixel text
   scaled up is unreadable and real text over pixel art looks intentional.
   ============================================================================ */
(function (S7) {
  "use strict";
  const V = S7.visitors;

  const SCALE = 2;                 /* world pixels -> canvas pixels */
  const CW = 800, CH = 340;        /* canvas, in canvas pixels */
  const VIEW = CW / SCALE;         /* logical width of the visible strip */

  const WALL_TOP = 14;
  const PLAQUE_Y = 26;
  const RAIL_Y = 38;               /* picture rail */
  const FLOOR_Y = V.FLOOR_Y;       /* 112 */
  const PERSON = 3;                /* people are drawn at 3:1 — 33 logical tall */

  let canvas, ctx;
  let cam = 0, camTarget = 0;
  let dragging = false, dragMoved = 0, dragX = 0, dragCam = 0;
  let layoutCache = null;
  let onExhibit = null;
  let hover = null;

  /* ---------- palette ------------------------------------------------------- */

  const C = {
    voidbg: "#0a0806",
    wallHi: "#3b3423", wallLo: "#2a2417", wallShade: "#221d13",
    rail: "#4c412a", dado: "#453a26",
    floorHi: "#3a3021", floorLo: "#2b2418", floorLine: "#241e14",
    skirt: "#4a3f29",
    plinth: "#5a4e35", plinthTop: "#6d5f42", plinthShade: "#3d3423",
    caseGlass: "#8fb0bd", caseFrame: "#4a4234",
    door: "#120e08", arch: "#4c412a",
    light: "#ffd9884d",
    label: "#d8cfb6", labelBg: "#1a160d",
    rope: "#8a6a2c",
    shadow: "#0000004d",
  };

  /* ---------- setup ---------------------------------------------------------- */

  function init(el, exhibitClick) {
    canvas = el;
    canvas.width = CW;
    canvas.height = CH;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    onExhibit = exhibitClick;

    const localX = (e) => {
      const r = canvas.getBoundingClientRect();
      return (e.clientX - r.left) * (CW / r.width);
    };
    const localY = (e) => {
      const r = canvas.getBoundingClientRect();
      return (e.clientY - r.top) * (CH / r.height);
    };

    canvas.addEventListener("pointerdown", (e) => {
      dragging = true; dragMoved = 0;
      dragX = localX(e); dragCam = cam;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      const lx = localX(e);
      if (dragging) {
        const dx = (lx - dragX) / SCALE;
        dragMoved = Math.max(dragMoved, Math.abs(dx));
        cam = camTarget = clampCam(dragCam - dx);
      } else if (layoutCache) {
        hover = pick(lx, localY(e));
        canvas.style.cursor = hover ? "pointer" : "grab";
      }
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* gone */ }
      if (dragMoved < 4) {
        const hit = pick(localX(e), localY(e));
        if (hit && onExhibit) onExhibit(hit.a);
      }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", () => { dragging = false; });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      camTarget = clampCam(camTarget + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.6);
    }, { passive: false });
    canvas.style.cursor = "grab";
  }

  const clampCam = (x) =>
    Math.max(0, Math.min(Math.max(0, (layoutCache ? layoutCache.total : VIEW) - VIEW), x));

  /* Which exhibit, if any, is under a canvas-space point. */
  function pick(px, py) {
    if (!layoutCache) return null;
    const wx = px / SCALE + cam, wy = py / SCALE;
    for (const e of layoutCache.exhibits) {
      const b = exhibitBox(e);
      if (wx >= b.x - 4 && wx <= b.x + b.w + 4 && wy >= b.y - 4 && wy <= b.y + b.h + 8) return e;
    }
    return null;
  }

  /* Where an exhibit's artwork sits, in world pixels. 32 logical = 64 canvas
     pixels = the sprite at 1:1. */
  function exhibitBox(e) {
    if (e.mount === "wall") return { x: e.x - 16, y: 44, w: 32, h: 32 };
    if (e.mount === "plinth") return { x: e.x - 16, y: 64, w: 32, h: 32 };
    return { x: e.x - 16, y: 78, w: 32, h: 32 };      /* case */
  }

  /* ---------- world drawing --------------------------------------------------- */

  const sx = (wx) => Math.round((wx - cam) * SCALE);
  const sy = (wy) => Math.round(wy * SCALE);
  const rect = (wx, wy, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(sx(wx), sy(wy), Math.round(w * SCALE), Math.round(h * SCALE));
  };

  function drawRoom(r) {
    const x0 = r.x, x1 = r.x + r.width;
    if (x1 < cam - 40 || x0 > cam + VIEW + 40) return;

    /* wall, lit from the ceiling track downward */
    for (let y = WALL_TOP; y < FLOOR_Y; y++) {
      const t = (y - WALL_TOP) / (FLOOR_Y - WALL_TOP);
      const shade = t < 0.5 ? C.wallHi : t < 0.85 ? C.wallLo : C.wallShade;
      rect(x0, y, r.width, 1, shade);
    }
    /* the picture rail is the one horizontal that makes it read as a room */
    rect(x0, RAIL_Y, r.width, 1, C.rail);
    rect(x0, RAIL_Y + 1, r.width, 1, "#00000033");
    /* skirting */
    rect(x0, FLOOR_Y - 4, r.width, 4, C.skirt);
    rect(x0, FLOOR_Y - 4, r.width, 1, "#6b5c3d");

    /* floor: receding bands, darker toward the back */
    for (let y = FLOOR_Y; y < V.H; y++) {
      const t = (y - FLOOR_Y) / (V.H - FLOOR_Y);
      rect(x0, y, r.width, 1, t < 0.35 ? C.floorLo : C.floorHi);
    }
    /* board joins, spaced so they read as perspective without any maths */
    for (let i = 0; i < 6; i++) {
      const y = FLOOR_Y + 4 + i * i * 2.1;
      if (y > V.H) break;
      rect(x0, y, r.width, 1, C.floorLine);
    }

    /* interpretation panel: the block of wall text every gallery has, drawn
       as texture rather than words */
    const px0 = x0 + 14;
    if (r.exhibits.length) {
      rect(px0, 44, 24, 30, "#3f3726");
      rect(px0, 44, 24, 1, "#5d5238");
      rect(px0 + 2, 47, 20, 2, C.rail);
      for (let i = 0; i < 7; i++) rect(px0 + 2, 52 + i * 3, 16 + (i % 3) * 4, 1, "#574c34");
    }

    /* ceiling lighting track */
    rect(x0, WALL_TOP - 6, r.width, 6, "#191409");
    rect(x0, WALL_TOP - 1, r.width, 1, "#0d0a06");
    for (let lx = x0 + 24; lx < x1 - 8; lx += 48) {
      rect(lx - 2, WALL_TOP - 5, 4, 4, "#4a4234");
      rect(lx - 1, WALL_TOP - 1, 2, 1, "#ffd98a");
    }
  }

  function drawDoorway(x0) {
    /* a dark arch, with the next room implied beyond it */
    rect(x0, WALL_TOP - 6, V.DOOR, 6, "#191409");
    rect(x0, WALL_TOP, V.DOOR, FLOOR_Y - WALL_TOP, C.wallShade);
    const dx = x0 + 10, dw = V.DOOR - 20;
    rect(dx, 34, dw, FLOOR_Y - 34, C.door);
    rect(dx - 2, 32, dw + 4, 3, C.arch);
    rect(dx - 2, 32, 2, FLOOR_Y - 32, C.arch);
    rect(dx + dw, 32, 2, FLOOR_Y - 32, C.arch);
    /* light spilling through onto the floor */
    for (let y = FLOOR_Y; y < V.H; y++) {
      const t = (y - FLOOR_Y) / (V.H - FLOOR_Y);
      rect(x0, y, V.DOOR, 1, t < 0.35 ? "#221c12" : "#2e2617");
    }
    rect(dx, FLOOR_Y - 4, dw, 4, "#241e14");
  }

  /* A soft cone of light from the track down onto a wall exhibit. */
  function spotlight(wx, top, bottom) {
    const g = ctx.createLinearGradient(0, sy(WALL_TOP), 0, sy(bottom));
    g.addColorStop(0, "rgba(255,222,150,0.16)");
    g.addColorStop(1, "rgba(255,222,150,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx(wx - 3), sy(WALL_TOP));
    ctx.lineTo(sx(wx + 3), sy(WALL_TOP));
    ctx.lineTo(sx(wx + 22), sy(bottom));
    ctx.lineTo(sx(wx - 22), sy(bottom));
    ctx.closePath();
    ctx.fill();
  }

  function drawExhibit(e, S) {
    const b = exhibitBox(e);
    if (b.x + b.w < cam - 20 || b.x > cam + VIEW + 20) return;
    const sprite = S7.artifacts.spriteFor(e.a);
    const isHover = hover === e;

    if (e.mount === "wall") {
      spotlight(e.x, 30, 84);
      /* frame shadow, then the piece itself at 1:1 */
      ctx.fillStyle = "#00000055";
      ctx.fillRect(sx(b.x) + 3, sy(b.y) + 4, b.w * SCALE, b.h * SCALE);
      ctx.drawImage(sprite, sx(b.x), sy(b.y), b.w * SCALE, b.h * SCALE);
      if (isHover) {
        ctx.strokeStyle = "#c79a42";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx(b.x) - 2, sy(b.y) - 2, b.w * SCALE + 4, b.h * SCALE + 4);
      }
      /* hanging wire up to the rail */
      rect(e.x - 1, RAIL_Y, 1, b.y - RAIL_Y, "#5a4e35");
    } else if (e.mount === "plinth") {
      spotlight(e.x, 30, 100);
      rect(e.x - 11, 96, 22, 28, C.plinth);
      rect(e.x - 11, 96, 22, 2, C.plinthTop);
      rect(e.x + 6, 98, 5, 26, C.plinthShade);
      ctx.drawImage(sprite, sx(b.x), sy(b.y), b.w * SCALE, b.h * SCALE);
      if (isHover) {
        ctx.strokeStyle = "#c79a42";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx(b.x) - 2, sy(b.y) - 2, b.w * SCALE + 4, b.h * SCALE + 4);
      }
      /* rope barrier in front */
      rect(e.x - 15, 128, 1, 6, C.rope);
      rect(e.x + 14, 128, 1, 6, C.rope);
      rect(e.x - 15, 129, 30, 1, C.rope);
    } else {
      /* low case: base, glass, and a reflection streak */
      spotlight(e.x, 30, 96);
      rect(e.x - 13, 110, 26, 16, C.caseFrame);
      rect(e.x - 13, 110, 26, 1, "#6b5f47");
      ctx.drawImage(sprite, sx(b.x), sy(b.y), b.w * SCALE, b.h * SCALE);
      ctx.globalAlpha = 0.16;
      rect(e.x - 15, 74, 30, 38, C.caseGlass);
      ctx.globalAlpha = 0.28;
      rect(e.x - 9, 76, 2, 34, "#ffffff");
      ctx.globalAlpha = 1;
      rect(e.x - 15, 74, 1, 38, C.caseFrame);
      rect(e.x + 14, 74, 1, 38, C.caseFrame);
      rect(e.x - 15, 74, 30, 1, C.caseFrame);
      if (isHover) {
        ctx.strokeStyle = "#c79a42";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx(e.x - 15) - 2, sy(74) - 2, 30 * SCALE + 4, 38 * SCALE + 4);
      }
    }
  }

  function drawAgent(a) {
    const y = V.feetY(a);
    if (a.x < cam - 20 || a.x > cam + VIEW + 20) return;
    const s = a.sprite;
    const px = sx(a.x) - Math.round(s.w * PERSON / 2);
    const py = sy(y) - s.h * PERSON;

    /* contact shadow */
    ctx.fillStyle = C.shadow;
    ctx.beginPath();
    ctx.ellipse(sx(a.x), sy(y), 13, 3.5, 0, 0, 6.283);
    ctx.fill();

    let frame;
    if (a.state === "view") frame = s.back;
    else frame = s.frames[1 + (Math.floor(a.phase) % 4)];

    /* People further back sit in less light. */
    ctx.globalAlpha = 0.82 + a.z * 0.18;
    if (a.dir < 0 && a.state !== "view") {
      ctx.save();
      ctx.translate(px + s.w * PERSON, py);
      ctx.scale(-1, 1);
      ctx.drawImage(frame, 0, 0, s.w * PERSON, s.h * PERSON);
      ctx.restore();
    } else {
      ctx.drawImage(frame, px, py, s.w * PERSON, s.h * PERSON);
    }
    ctx.globalAlpha = 1;

    if (a.flash > 0) {
      ctx.globalAlpha = Math.max(0, a.flash * 1.6);
      ctx.fillStyle = "#fff8e0";
      ctx.fillRect(0, 0, CW, CH);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- overlay (crisp, unscaled) ---------------------------------------- */

  function drawLabel(e) {
    const b = exhibitBox(e);
    const x = sx(e.x), y = sy(e.mount === "wall" ? 82 : e.mount === "plinth" ? 130 : 132);
    if (x < -80 || x > CW + 80) return;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#00000066";
    ctx.fillRect(x - 13, y - 8, 26, 11);
    ctx.fillStyle = "#a99f88";
    ctx.fillText(e.a.no, x, y);
    ctx.textAlign = "left";
  }

  function drawRoomPlaque(r) {
    const x = sx(r.x + r.width / 2);
    if (x < -160 || x > CW + 160) return;
    ctx.textAlign = "center";
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillStyle = "#8a6a2c";
    ctx.fillText(r.era.name.toUpperCase(), x, sy(PLAQUE_Y));
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillStyle = "#6b6152";
    ctx.fillText(r.era.period, x, sy(PLAQUE_Y) + 12);
    ctx.textAlign = "left";
  }

  /* Bubbles claim space for the frame; later ones are pushed upward until they
     clear, so a pair in conversation stacks instead of overlapping the art. */
  let bubbleRects = [];

  function placeBubble(bx, by, bw, bh) {
    for (let tries = 0; tries < 4; tries++) {
      let clash = null;
      for (const r of bubbleRects)
        if (bx < r.x + r.w + 4 && bx + bw + 4 > r.x && by < r.y + r.h + 3 && by + bh + 3 > r.y) { clash = r; break; }
      if (!clash) break;
      by = clash.y - bh - 5;
    }
    by = Math.max(3, by);
    bubbleRects.push({ x: bx, y: by, w: bw, h: bh });
    return by;
  }

  /* Speech bubble, drawn crisp over the pixel art. */
  function drawBubble(a) {
    const b = a.bubble;
    if (!b) return;
    const s = a.sprite;
    const cx = sx(a.x);
    const cy = sy(V.feetY(a)) - s.h * PERSON - 10;
    if (cx < -160 || cx > CW + 160) return;

    ctx.font = "10px ui-monospace, monospace";
    /* wrap to a sensible width */
    const words = b.text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > 150 && line) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);

    const wide = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bw = wide + 14, bh = lines.length * 12 + 10;
    const bx = Math.max(4, Math.min(CW - bw - 4, cx - bw / 2));
    const by = placeBubble(bx, Math.max(4, cy - bh), bw, bh);

    const fade = Math.min(1, b.t / 0.6) * Math.min(1, (b.life - b.t) / 0.18 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));

    ctx.fillStyle = "#0f0d08ee";
    ctx.strokeStyle = "#4a3f28";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 3);
    else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.stroke();
    /* tail, only when the bubble is still directly over its speaker */
    if (Math.abs(cx - (bx + bw / 2)) < bw / 2 - 6) {
      ctx.beginPath();
      ctx.moveTo(cx - 4, by + bh - 1);
      ctx.lineTo(cx + 4, by + bh - 1);
      ctx.lineTo(cx, by + bh + 6);
      ctx.closePath();
      ctx.fillStyle = "#0f0d08ee";
      ctx.fill();
    }

    ctx.fillStyle = "#e8e1d1";
    lines.forEach((l, i) => ctx.fillText(l, bx + 7, by + 15 + i * 12));
    ctx.globalAlpha = 1;
  }

  /* ---------- the frame -------------------------------------------------------- */

  function draw(S, crowd, dt) {
    const L = layoutCache = V.getLayout(S);
    cam = clampCam(cam);

    if (!dragging) cam += (camTarget - cam) * Math.min(1, dt * 8);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C.voidbg;
    ctx.fillRect(0, 0, CW, CH);

    for (let i = 0; i < L.rooms.length; i++) {
      drawRoom(L.rooms[i]);
      if (i < L.rooms.length - 1) drawDoorway(L.rooms[i].x + L.rooms[i].width);
    }

    /* Everything that stands on the floor is depth-sorted together, so a
       visitor can walk behind a plinth and in front of the next one. */
    const items = [];
    for (const e of L.exhibits)
      items.push({ y: e.mount === "wall" ? 0 : e.mount === "plinth" ? 124 : 126, fn: () => drawExhibit(e, S) });
    for (const a of crowd.agents)
      items.push({ y: V.feetY(a), fn: () => drawAgent(a) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.fn();

    /* overlay */
    for (const r of L.rooms) drawRoomPlaque(r);
    for (const e of L.exhibits) drawLabel(e);
    bubbleRects = [];
    for (const a of crowd.agents) drawBubble(a);

    /* edge shading, so the strip reads as continuing past the frame */
    const g = ctx.createLinearGradient(0, 0, CW, 0);
    g.addColorStop(0, "#0a0806");
    g.addColorStop(0.06, "#0a080600");
    g.addColorStop(0.94, "#0a080600");
    g.addColorStop(1, "#0a0806");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);

    if (!L.exhibits.length) {
      ctx.textAlign = "center";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillStyle = "#7d7461";
      ctx.fillText("Nothing on display. The doors are not open.", CW / 2, CH / 2);
      ctx.fillText("Lift something and put it on show.", CW / 2, CH / 2 + 18);
      ctx.textAlign = "left";
    }
  }

  /* ---------- camera controls --------------------------------------------------- */

  function rooms() { return layoutCache ? layoutCache.rooms : []; }

  function currentRoom() {
    if (!layoutCache) return null;
    return V.roomAt(layoutCache, cam + VIEW / 2);
  }

  function goToRoom(i) {
    const rs = rooms();
    if (!rs.length) return;
    const r = rs[Math.max(0, Math.min(rs.length - 1, i))];
    camTarget = clampCam(r.x + r.width / 2 - VIEW / 2);
  }

  function nudge(dir) {
    const rs = rooms();
    const here = currentRoom();
    const i = rs.indexOf(here);
    goToRoom(i + dir);
  }

  const invalidate = () => V.invalidate();

  S7.galleryView = {
    init, draw, rooms, currentRoom, goToRoom, nudge, invalidate,
    CW, CH, SCALE, VIEW,
  };
})(window.S7 = window.S7 || {});
