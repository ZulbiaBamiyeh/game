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
    wallTop: "#463d29", wallHi: "#3b3423", wallLo: "#2a2417", wallShade: "#221d13",
    wallSeam: "#231e14", wallSeamLit: "#443b28",
    ceil: "#100d08", ceilShade: "#171208", cove: "#3a3225", coveLit: "#544a35",
    floorFar: "#282116",
    rail: "#4c412a", dado: "#453a26",
    floorHi: "#453a27", floorLo: "#33291b", floorLine: "#241e14",
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

  /* ---------- the room ------------------------------------------------------
     Three surfaces and a light source. Everything else is furniture. */

  /* Parquet: bands that compress toward the back wall, with plank ends
     staggered row to row so the eye reads a floor rather than a gradient. */
  function drawFloor(x0, w) {
    for (let y = FLOOR_Y; y < V.H; y++) {
      const t = (y - FLOOR_Y) / (V.H - FLOOR_Y);
      rect(x0, y, w, 1, t < 0.18 ? C.floorFar : t < 0.55 ? C.floorLo : C.floorHi);
    }
    /* board rows, squeezed together toward the back wall */
    const rows = [];
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) {
      const y = FLOOR_Y + 2 + i * i * 1.35;
      if (y > V.H) break;
      rows.push(y);
      rect(x0, y, w, 1, C.floorLine);
    }
    ctx.globalAlpha = 1;
    /* plank ends only on the two nearest boards, where you would actually
       pick them out */
    ctx.globalAlpha = 0.4;
    for (let i = Math.max(0, rows.length - 3); i < rows.length - 1; i++) {
      const y = rows[i], next = rows[i + 1];
      const pitch = 20 + i * 8;
      for (let px = Math.floor((x0 + (i % 2) * pitch / 2) / pitch) * pitch; px < x0 + w; px += pitch) {
        if (px < x0) continue;
        rect(px, y + 1, 1, Math.max(1, next - y - 1), C.floorLine);
      }
    }
    ctx.globalAlpha = 1;
    /* a soft sheen down the middle of the floor, as if from the lights */
    const g = ctx.createLinearGradient(0, sy(FLOOR_Y), 0, sy(V.H));
    g.addColorStop(0, "rgba(255,226,166,0.07)");
    g.addColorStop(1, "rgba(255,226,166,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx(x0), sy(FLOOR_Y), Math.round(w * SCALE), Math.round((V.H - FLOOR_Y) * SCALE));
  }

  /* Wall: a vertical wash, panel joins, and the picture rail. */
  function drawWall(x0, w) {
    for (let y = WALL_TOP; y < FLOOR_Y; y++) {
      const t = (y - WALL_TOP) / (FLOOR_Y - WALL_TOP);
      /* brightest just under the lights, falling away to the skirting */
      const shade = t < 0.16 ? C.wallTop : t < 0.46 ? C.wallHi : t < 0.82 ? C.wallLo : C.wallShade;
      rect(x0, y, w, 1, shade);
    }
    /* panel joins, kept faint — at full contrast the wall reads as bathroom
       tiling rather than a painted gallery */
    ctx.globalAlpha = 0.35;
    for (let px = Math.ceil(x0 / 58) * 58; px < x0 + w; px += 58)
      rect(px, WALL_TOP, 1, FLOOR_Y - WALL_TOP - 5, C.wallSeam);
    ctx.globalAlpha = 1;
    rect(x0, RAIL_Y, w, 1, C.rail);
    rect(x0, RAIL_Y + 1, w, 1, "#00000038");
    rect(x0, FLOOR_Y - 5, w, 5, C.skirt);
    rect(x0, FLOOR_Y - 5, w, 1, "#75643f");
    rect(x0, FLOOR_Y - 1, w, 1, "#2a2317");
  }

  /* Coved ceiling with recessed downlights. */
  function drawCeiling(x0, w) {
    rect(x0, 0, w, WALL_TOP - 8, C.ceil);
    rect(x0, WALL_TOP - 8, w, 4, C.cove);
    rect(x0, WALL_TOP - 8, w, 1, C.coveLit);
    rect(x0, WALL_TOP - 4, w, 4, C.ceilShade);
    for (let lx = Math.ceil(x0 / 46) * 46; lx < x0 + w; lx += 46) {
      rect(lx - 3, WALL_TOP - 4, 7, 3, "#3a332a");
      rect(lx - 2, WALL_TOP - 2, 5, 1, "#ffe6ad");
      /* the glow the fitting throws on the ceiling around it */
      const g = ctx.createRadialGradient(sx(lx), sy(WALL_TOP - 2), 1, sx(lx), sy(WALL_TOP - 2), 30);
      g.addColorStop(0, "rgba(255,226,166,0.16)");
      g.addColorStop(1, "rgba(255,226,166,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx(lx) - 32, sy(0), 64, sy(WALL_TOP + 10));
    }
  }

  /* A potted plant, because every gallery has one in the corner. */
  function drawPlant(px) {
    rect(px - 5, 118, 10, 12, "#5a4230");
    rect(px - 5, 118, 10, 2, "#6f5340");
    rect(px + 2, 120, 3, 10, "#3f2e21");
    for (let i = 0; i < 7; i++) {
      const a = -1.9 + i * 0.42;
      const len = 10 + (i % 3) * 4;
      const ex = px + Math.cos(a) * len, ey = 116 + Math.sin(a) * len;
      ctx.strokeStyle = i % 2 ? "#3d6b45" : "#4f7f52";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(px), sy(117));
      ctx.quadraticCurveTo(sx(px + Math.cos(a) * len * 0.5), sy(112 + Math.sin(a) * len * 0.4), sx(ex), sy(ey));
      ctx.stroke();
    }
  }

  function drawRoom(r) {
    const x0 = r.x, x1 = r.x + r.width;
    if (x1 < cam - 40 || x0 > cam + VIEW + 40) return;

    drawWall(x0, r.width);
    drawFloor(x0, r.width);
    drawCeiling(x0, r.width);

    if (r.foyer) { drawFoyer(r); return; }

    /* the block of wall text every gallery has, drawn as texture not words */
    const px0 = x0 + 12;
    if (r.exhibits.length) {
      rect(px0, 44, 26, 32, "#453c2a");
      rect(px0, 44, 26, 1, "#665941");
      rect(px0, 44, 1, 32, "#665941");
      rect(px0 + 3, 47, 20, 2, C.rail);
      for (let i = 0; i < 8; i++) rect(px0 + 3, 53 + i * 3, 14 + (i % 3) * 6, 1, "#5d5138");
    }
    if (r.width > 260) drawPlant(x1 - 22);
  }

  /* ---------- the entrance hall ---------------------------------------------
     Street doors, daylight on the floor, and the desk where the money is
     actually taken. */
  function drawFoyer(r) {
    const dx = r.doorX;

    /* the doors: glass, with the street outside */
    rect(dx - 17, 34, 34, FLOOR_Y - 34, "#8fa9b5");
    rect(dx - 17, 34, 34, 3, "#4a4234");
    rect(dx - 1, 36, 2, FLOOR_Y - 38, "#3e392c");
    rect(dx - 17, 34, 1, FLOOR_Y - 34, "#4a4234");
    rect(dx + 16, 34, 1, FLOOR_Y - 34, "#4a4234");
    for (const gx of [dx - 15, dx + 3]) {
      rect(gx, 38, 12, 30, "#a9c3cc");
      rect(gx, 70, 12, FLOOR_Y - 72, "#93aab4");
      rect(gx + 1, 39, 3, 28, "#c8dde3");        /* reflection */
    }
    /* daylight spilling in across the floor */
    const g = ctx.createLinearGradient(sx(dx), sy(FLOOR_Y), sx(dx + 52), sy(V.H));
    g.addColorStop(0, "rgba(200,225,235,0.22)");
    g.addColorStop(1, "rgba(200,225,235,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx(dx - 17), sy(FLOOR_Y));
    ctx.lineTo(sx(dx + 17), sy(FLOOR_Y));
    ctx.lineTo(sx(dx + 54), sy(V.H));
    ctx.lineTo(sx(dx - 46), sy(V.H));
    ctx.closePath();
    ctx.fill();

    /* the desk */
    const kx = r.deskX, kw = r.deskW;
    rect(kx - kw / 2, 96, kw, 6, "#6d5b3c");                 /* counter top */
    rect(kx - kw / 2, 96, kw, 2, "#87724a");
    rect(kx - kw / 2 + 2, 102, kw - 4, 26, "#4f4229");       /* front panel */
    rect(kx - kw / 2 + 2, 102, kw - 4, 1, "#2f2718");
    for (let i = 1; i < 4; i++) rect(kx - kw / 2 + 2 + i * (kw - 4) / 4, 104, 1, 22, "#3d3322");
    /* till and a card reader */
    rect(kx + 8, 89, 11, 7, "#2a2a33");
    rect(kx + 10, 91, 7, 3, "#4e9d4e");
    rect(kx - 15, 92, 5, 4, "#3a3a44");
    /* leaflets */
    for (let i = 0; i < 3; i++) rect(kx - 22 + i * 5, 92, 4, 4, i % 2 ? "#b5904a" : "#8f8a7a");

    /* signage over the desk */
    rect(kx - 30, 44, 60, 16, "#2a2418");
    rect(kx - 30, 44, 60, 1, "#4c412a");
    rect(kx - 25, 49, 34, 2, "#c79a42");
    rect(kx - 25, 53, 24, 2, "#7d7461");

    /* a rope line and a bin, because foyers are full of both */
    rect(kx - 40, 132, 1, 8, C.rope);
    rect(kx + 40, 132, 1, 8, C.rope);
    rect(kx - 40, 133, 80, 1, C.rope);
    drawPlant(r.width - 26);
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
    pool.addColorStop(0, "rgba(255,226,166,0.13)");
    pool.addColorStop(1, "rgba(255,222,150,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(sx(wx) - 46, sy(FLOOR_Y), 92, (V.H - FLOOR_Y) * SCALE);
    cone(wx, top, bottom);
  }

  function cone(wx, top, bottom) {
    const g = ctx.createLinearGradient(0, sy(WALL_TOP), 0, sy(bottom));
    g.addColorStop(0, "rgba(255,222,150,0.09)");
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

  /* Museum lighting: the thing in the light is brighter than the wall it hangs
     on. Without this everything sits at the same value and the room goes flat. */
  function lightArt(b, aw, ah) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = "#ffe0a8";
    ctx.fillRect(sx(b.x), sy(b.y), aw, ah);
    ctx.restore();
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
      lightArt(b, aw, ah);
      if (ring) outlineBox(b, ring);
      if (b.y > RAIL_Y + 2) rect(e.x - 1, RAIL_Y, 1, b.y - RAIL_Y, "#5a4e35");
    } else if (e.mount === "plinth") {
      spotlight(e.x, 30, b.plinthTop);
      const pw = Math.max(14, Math.round(b.w * 0.78));
      rect(e.x - pw / 2, b.plinthTop, pw, FLOOR_Y + 8 - b.plinthTop, C.plinth);
      rect(e.x - pw / 2, b.plinthTop, pw, 2, C.plinthTop);
      rect(e.x + pw / 2 - 5, b.plinthTop + 2, 5, FLOOR_Y + 6 - b.plinthTop, C.plinthShade);
      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      lightArt(b, aw, ah);
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
      lightArt(b, aw, ah);

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
    if (a.x < cam - 24 || a.x > cam + VIEW + 24) return;
    const s = a.sprite;
    const px = sx(a.x) - Math.round(s.w * PERSON / 2);
    const py = sy(y) - s.h * PERSON;
    const now = performance.now() / 1000;

    /* contact shadow */
    ctx.fillStyle = C.shadow;
    ctx.beginPath();
    ctx.ellipse(sx(a.x), sy(y), 13, 3.5, 0, 0, 6.283);
    ctx.fill();

    let frame, flip = false;
    if (a.state === "sit") {
      frame = s.sit;
    } else if (a.state === "pay") {
      frame = s.stand;
    } else if (a.state === "view") {
      if (a.flash > 0) frame = s.photo;
      else if (a.bubble) frame = Math.floor(now * 1.6 + a.id) % 2 ? s.point : s.back;
      else frame = Math.floor(now * 0.7 + a.id * 0.37) % 2 ? s.backLean : s.back;
    } else {
      /* six-frame walk, stepping at a rate that matches how fast they move */
      frame = s.walk[Math.floor(a.phase) % 6];
      flip = a.dir < 0;
    }

    /* People further back sit in less of the light. */
    ctx.globalAlpha = 0.80 + a.z * 0.20;
    if (flip) {
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
      ctx.globalAlpha = Math.max(0, a.flash * 1.4);
      ctx.fillStyle = "#fff8e0";
      ctx.fillRect(0, 0, CW, CH);
      ctx.globalAlpha = 1;
    }
  }

  /* The person behind the desk. Always there, never simulated. */
  let deskStaff = null;
  function drawDeskStaff(r) {
    if (!deskStaff) deskStaff = S7.people.makePerson(20240607, "staff");
    const x = r.deskX - 4;
    if (x < cam - 30 || x > cam + VIEW + 30) return;
    const s = deskStaff;
    /* stood behind the counter, so only the top half shows */
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx(x) - 40, 0, 80, sy(97));
    ctx.clip();
    ctx.drawImage(s.stand, sx(x) - Math.round(s.w * PERSON / 2), sy(112) - s.h * PERSON,
                  s.w * PERSON, s.h * PERSON);
    ctx.restore();
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

  /* The ticket price floating up off someone who has just paid. This is the
     only place the player sees money arrive, and it should be visible. */
  function drawPaidFloater(a) {
    const p = a.paid;
    const t = 1 - p.t / p.life;
    const x = sx(a.x), yTop = sy(V.feetY(a)) - a.sprite.h * PERSON - 6 - t * 26;
    if (x < -40 || x > CW + 40) return;
    ctx.globalAlpha = Math.max(0, Math.min(1, (1 - t) * 1.6));
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#0f0d08";
    ctx.fillText("+" + S7.views.fmt(p.amount), x + 1, yTop + 1);
    ctx.fillStyle = "#e8c66a";
    ctx.fillText("+" + S7.views.fmt(p.amount), x, yTop);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
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
      if (ctx.measureText(t).width > 128 && line) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);

    const wide = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bw = Math.min(CW - 16, Math.ceil(wide) + 16), bh = lines.length * 12 + 10;
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
    for (const r of L.rooms)
      if (r.foyer) items.push({ y: 96, fn: () => drawDeskStaff(r) });
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
    for (const a of crowd.agents) if (a.paid) drawPaidFloater(a);
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
