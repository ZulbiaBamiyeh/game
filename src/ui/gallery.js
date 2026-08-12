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
  let onOpen = null, onSelect = null;
  let hover = null, selected = null;
  let arrange = false;
  let dragEx = null;                /* an exhibit being carried to a new spot */
  let pointer = { x: 0, y: 0 };

  /* ---------- palette ------------------------------------------------------- */

  const C = {
    voidbg: "#0a0806",
    wallHi: "#3b3423", wallLo: "#2a2417", wallShade: "#221d13",
    rail: "#4c412a", dado: "#453a26",
    floorHi: "#3a3021", floorLo: "#2b2418", floorLine: "#241e14",
    skirt: "#4a3f29",
    plinth: "#5a4e35", plinthTop: "#6d5f42", plinthShade: "#3d3423",
    caseGlass: "#9dc0cd", caseFrame: "#2e2a22", caseEdge: "#4f4736",
    ped: "#4f452e", pedTop: "#63563a", pedShade: "#372f1f",
    door: "#120e08", arch: "#4c412a",
    light: "#ffd9884d",
    label: "#d8cfb6", labelBg: "#1a160d",
    rope: "#8a6a2c",
    shadow: "#0000004d",
  };

  /* ---------- setup ---------------------------------------------------------- */

  function init(el, handlers) {
    canvas = el;
    canvas.width = CW;
    canvas.height = CH;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    onOpen = handlers.onOpen;
    onSelect = handlers.onSelect;

    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (CW / r.width), y: (e.clientY - r.top) * (CH / r.height) };
    };

    canvas.addEventListener("pointerdown", (e) => {
      const p = local(e);
      pointer = p;
      const hit = pick(p.x, p.y);
      if (arrange && hit) {
        dragEx = { e: hit, from: hit.room };
        dragMoved = 0;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      dragging = true; dragMoved = 0;
      dragX = p.x; dragCam = cam;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
      const p = local(e);
      pointer = p;
      if (dragEx) {
        dragMoved += 1;
        /* Carrying something past the edge pans the building along with it. */
        if (p.x < 60) camTarget = cam = clampCam(cam - 3);
        else if (p.x > CW - 60) camTarget = cam = clampCam(cam + 3);
        return;
      }
      if (dragging) {
        const dx = (p.x - dragX) / SCALE;
        dragMoved = Math.max(dragMoved, Math.abs(dx));
        cam = camTarget = clampCam(dragCam - dx);
        return;
      }
      if (layoutCache) {
        hover = pick(p.x, p.y);
        canvas.style.cursor = hover ? (arrange ? "grab" : "pointer") : (arrange ? "default" : "grab");
      }
    });

    const release = (e) => {
      const p = local(e);
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* gone */ }

      if (dragEx) {
        const drop = dropTarget(p.x);
        if (drop && handlers.onMove) handlers.onMove(dragEx.e.a, drop.roomId, drop.index);
        dragEx = null;
        return;
      }
      if (!dragging) return;
      dragging = false;
      if (dragMoved < 4) {
        const hit = pick(p.x, p.y);
        selected = hit || null;
        if (onSelect) onSelect(hit ? hit.a : null);
      }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", () => { dragging = false; dragEx = null; });
    canvas.addEventListener("dblclick", (e) => {
      const p = local(e);
      const hit = pick(p.x, p.y);
      if (hit && onOpen) onOpen(hit.a);
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      camTarget = clampCam(camTarget + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.6);
    }, { passive: false });
    canvas.style.cursor = "grab";
  }

  /* Where a carried exhibit would land: which room, and how many of its
     exhibits sit to the left of the pointer. */
  function dropTarget(px) {
    if (!layoutCache) return null;
    const wx = px / SCALE + cam;
    const room = V.roomAt(layoutCache, wx);
    if (!room || !room.era) return null;
    let index = 0;
    for (const e of room.exhibits) if (e !== dragEx.e && e.x < wx) index++;
    return { roomId: room.era.id, index };
  }

  const setArrange = (on) => {
    arrange = !!on;
    if (!arrange) dragEx = null;
    canvas.style.cursor = arrange ? "default" : "grab";
  };
  const isArranging = () => arrange;
  const isDragging = () => !!dragEx;
  /* Test hook: what the hit-test sees at a canvas-space point. */
  const probe = (px, py) => { const e = pick(px, py); return { cam, arrange, hit: e ? e.a.no : null }; };
  const clearSelection = () => { selected = null; };

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

  /* Where an exhibit's artwork sits, in world pixels — driven by the object's
     own physical size, so a bead occupies a small case at eye level and a
     colossal head runs from the floor almost to the ceiling. */
  function exhibitBox(e) {
    const h = e.h, w = Math.round(h * 0.95);
    if (e.mount === "wall") {
      /* Ordinary panels hang above head height; monumental ones come down
         nearly to the floor, because that is the only way to fit them. */
      const bottom = h <= 50 ? 96 : FLOOR_Y - 4;
      const top = Math.max(18, bottom - h);
      return { x: e.x - w / 2, y: top, w, h: bottom - top };
    }
    if (e.mount === "plinth") {
      const plinthTop = Math.max(FLOOR_Y - 48, Math.min(FLOOR_Y - 4, Math.round(74 + h / 2)));
      return { x: e.x - w / 2, y: plinthTop - h, w, h, plinthTop };
    }
    const bottom = 92;                       /* case */
    return { x: e.x - w / 2, y: bottom - h, w, h, caseBottom: bottom };
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
    /* the far wall and floor of whatever is through there, dimly */
    rect(dx + 2, 46, dw - 4, 44, "#1b1710");
    rect(dx + 2, 90, dw - 4, FLOOR_Y - 90, "#231d14");
    rect(dx + 2, 62, dw - 4, 1, "#2b2418");
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

  /* A soft cone from the track, plus the pool it throws on the floor. */
  function spotlight(wx, top, bottom) {
    const pool = ctx.createRadialGradient(sx(wx), sy(FLOOR_Y + 14), 2, sx(wx), sy(FLOOR_Y + 14), 44);
    pool.addColorStop(0, "rgba(255,222,150,0.10)");
    pool.addColorStop(1, "rgba(255,222,150,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(sx(wx) - 46, sy(FLOOR_Y), 92, (V.H - FLOOR_Y) * SCALE);
    cone(wx, top, bottom);
  }

  function cone(wx, top, bottom) {
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

  function artAt(e, b) {
    const px = Math.round(b.h * SCALE);
    return S7.artifacts.scaledFor(e.a, px);
  }

  function outlineBox(b, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx(b.x) - 3, sy(b.y) - 3, Math.round(b.w * SCALE) + 6, Math.round(b.h * SCALE) + 6);
  }

  function drawExhibit(e, S) {
    if (dragEx && dragEx.e === e) return;          /* it is in the curator's hands */
    const b = exhibitBox(e);
    if (b.x + b.w < cam - 20 || b.x > cam + VIEW + 20) return;
    const art = artAt(e, b);
    const aw = Math.round(b.w * SCALE), ah = Math.round(b.h * SCALE);
    const ring = selected === e ? "#e8c66a" : hover === e ? "#c79a42" : null;

    if (e.mount === "wall") {
      spotlight(e.x, 30, b.y + b.h + 8);
      ctx.fillStyle = "#00000055";
      ctx.fillRect(sx(b.x) + 3, sy(b.y) + 4, aw, ah);
      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      if (ring) outlineBox(b, ring);
      if (b.y > RAIL_Y + 2) rect(e.x - 1, RAIL_Y, 1, b.y - RAIL_Y, "#5a4e35");
    } else if (e.mount === "plinth") {
      spotlight(e.x, 30, b.plinthTop);
      const pw = Math.max(14, Math.round(b.w * 0.78));
      rect(e.x - pw / 2, b.plinthTop, pw, FLOOR_Y + 8 - b.plinthTop, C.plinth);
      rect(e.x - pw / 2, b.plinthTop, pw, 2, C.plinthTop);
      rect(e.x + pw / 2 - 5, b.plinthTop + 2, 5, FLOOR_Y + 6 - b.plinthTop, C.plinthShade);
      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      if (ring) outlineBox(b, ring);
      const rw = Math.max(pw + 8, 26);
      rect(e.x - rw / 2, FLOOR_Y + 14, 1, 6, C.rope);
      rect(e.x + rw / 2, FLOOR_Y + 14, 1, 6, C.rope);
      rect(e.x - rw / 2, FLOOR_Y + 15, rw, 1, C.rope);
    } else {
      /* Two distinct parts: a warm timber pedestal and a dark vitrine on top.
         Drawn in one colour they read as a single filing cabinet. */
      const cw = Math.max(20, b.w + 10);
      const pw = cw + 4;
      const glassTop = b.y - 7;
      spotlight(e.x, 30, glassTop + 6);

      rect(e.x - pw / 2, b.caseBottom, pw, FLOOR_Y + 8 - b.caseBottom, C.ped);
      rect(e.x - pw / 2, b.caseBottom, pw, 2, C.pedTop);
      rect(e.x + pw / 2 - 4, b.caseBottom + 2, 4, FLOOR_Y + 6 - b.caseBottom, C.pedShade);
      rect(e.x - pw / 2, FLOOR_Y + 5, pw, 3, C.pedShade);

      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);

      ctx.globalAlpha = 0.14;
      rect(e.x - cw / 2, glassTop, cw, b.caseBottom - glassTop, C.caseGlass);
      ctx.globalAlpha = 0.30;                       /* the streak of reflected light */
      rect(e.x - cw / 2 + 4, glassTop + 2, 2, b.caseBottom - glassTop - 4, "#ffffff");
      ctx.globalAlpha = 1;
      rect(e.x - cw / 2, glassTop, 1, b.caseBottom - glassTop, C.caseEdge);
      rect(e.x + cw / 2, glassTop, 1, b.caseBottom - glassTop, C.caseEdge);
      rect(e.x - cw / 2, glassTop, cw, 2, C.caseFrame);
      rect(e.x - cw / 2, glassTop + 1, cw, 1, C.caseEdge);
      if (ring) outlineBox({ x: e.x - cw / 2, y: glassTop, w: cw, h: b.caseBottom - glassTop }, ring);
    }
  }

  /* Somewhere to sit. Slatted, because a solid block reads as a plinth. */
  function drawBench(bn) {
    if (bn.x < cam - 40 || bn.x > cam + VIEW + 40) return;
    const w = 34;
    rect(bn.x - w / 2, 140, w, 3, "#6b5a3a");
    rect(bn.x - w / 2, 140, w, 1, "#87724a");
    rect(bn.x - w / 2, 144, w, 2, "#5a4c30");
    rect(bn.x - w / 2 + 2, 146, 3, 6, "#4a3f28");
    rect(bn.x + w / 2 - 5, 146, 3, 6, "#4a3f28");
    ctx.fillStyle = C.shadow;
    ctx.fillRect(sx(bn.x - w / 2), sy(152), Math.round(w * SCALE), 3);
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
    if (a.state === "sit") frame = s.sit;
    else if (a.state === "view") frame = s.back;
    else frame = s.frames[1 + (Math.floor(a.phase) % 4)];

    /* People further back sit in less light. */
    ctx.globalAlpha = 0.82 + a.z * 0.18;
    if (a.dir < 0 && a.state !== "view" && a.state !== "sit") {
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
    const x = sx(e.x);
    const y = e.mount === "wall" ? sy(b.y + b.h) + 12 : sy(FLOOR_Y + 12);
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

  /* The card beside the piece, the way a real gallery names things. */
  function drawWallLabel(e) {
    const b = exhibitBox(e);
    const cu = S7.cultures.byId[e.a.cultureId];
    const lines = [
      e.a.name,
      (cu ? cu.name : "Unattributed") + " · " + (cu ? cu.period : "—"),
      S7.artifacts.materialLabel(e.a.material) + " · " + e.a.condition.n,
      "Item " + e.a.no + " · " + e.a.depth.toFixed(1) + " m",
    ];
    ctx.font = "10px ui-monospace, monospace";
    const w = Math.max(...lines.map((l, i) => ctx.measureText(l).width + (i === 0 ? 2 : 0))) + 16;
    const h = lines.length * 12 + 12;
    /* to the right of the piece unless that runs off the canvas */
    let x = sx(b.x + b.w) + 12;
    if (x + w > CW - 6) x = sx(b.x) - w - 12;
    x = Math.max(6, Math.min(CW - w - 6, x));
    const y = Math.max(6, Math.min(CH - h - 6, sy(b.y) + 4));

    ctx.fillStyle = "#12100aee";
    ctx.strokeStyle = "#8a6a2c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 2); else ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8a6a2c";
    ctx.fillRect(x, y, w, 2);

    lines.forEach((l, i) => {
      ctx.font = i === 0 ? "600 10px ui-monospace, monospace" : "10px ui-monospace, monospace";
      ctx.fillStyle = i === 0 ? "#e8e1d1" : i === 1 ? "#c79a42" : "#a99f88";
      ctx.fillText(l, x + 8, y + 17 + i * 12);
    });
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
      items.push({ y: e.mount === "wall" ? 0 : FLOOR_Y + 8, fn: () => drawExhibit(e, S) });
    for (const bn of L.benches)
      items.push({ y: V.BENCH_Y - 4, fn: () => drawBench(bn) });
    for (const a of crowd.agents)
      items.push({ y: V.feetY(a), fn: () => drawAgent(a) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.fn();

    /* the piece currently being carried, and where it would land */
    if (dragEx) {
      const drop = dropTarget(pointer.x);
      if (drop) {
        const room = L.rooms.find((r) => r.era.id === drop.roomId);
        if (room) {
          let gx = room.x + V.ROOM_PAD;
          let n = 0;
          for (const e of room.exhibits) { if (e === dragEx.e) continue; if (n++ >= drop.index) break; gx = e.x + e.w / 2; }
          ctx.fillStyle = "#c79a42";
          ctx.fillRect(sx(gx) - 1, sy(30), 2, (FLOOR_Y - 30) * SCALE);
        }
      }
      const b = exhibitBox(dragEx.e);
      const aw = Math.round(b.w * SCALE), ah = Math.round(b.h * SCALE);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(artAt(dragEx.e, b), Math.round(pointer.x - aw / 2), Math.round(pointer.y - ah / 2), aw, ah);
      ctx.globalAlpha = 1;
    }

    /* overlay */
    for (const r of L.rooms) drawRoomPlaque(r);
    for (const e of L.exhibits) drawLabel(e);
    if (selected && L.exhibits.indexOf(selected) >= 0) drawWallLabel(selected);
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
    setArrange, isArranging, isDragging, probe, clearSelection,
    CW, CH, SCALE, VIEW,
  };
})(window.S7 = window.S7 || {});
