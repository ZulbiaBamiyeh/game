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
  let hover = null, selected = null;   /* exhibit, or { board:true, room } */
  let arrange = false;
  let dragEx = null;                /* an exhibit being carried to a new spot */
  let pointer = { x: 0, y: 0 };
  /* Museum facility levels, snapshotted at the start of each frame so every
     draw helper can see what the player has bought without threading S through
     twenty function signatures. */
  let fac = null;
  let guideSprites = [];

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

  /* Snapshot of the museum shop. Levels drive furniture, light, and glass —
     the point is that spending money on the museum makes the room look
     different, not just the numbers on the side. */
  function facilities(S) {
    const u = S.up || {};
    return {
      lighting: u.lighting || 0,
      cases: u.cases || 0,
      labels: u.labels || 0,
      tickets: u.tickets || 0,
      leaflet: u.leaflet || 0,
      plinths: u.plinths || 0,
      shop: u.shop || 0,
      guides: u.guides || 0,
      cafe: u.cafe || 0,
      climate: u.climate || 0,
      wing: u.wing || 0,
      press: u.press || 0,
      touring: u.touring || 0,
      research: u.research || 0,
      deepgal: u.deepgal || 0,
      climateOn: !!(S.flags && S.flags.climate),
    };
  }

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
      if (arrange && hit && hit.a) {
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
        const over = !!hover;
        canvas.style.cursor = over ? (arrange && hover.a ? "grab" : "pointer")
                                   : (arrange ? "default" : "grab");
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
        if (onSelect) {
          if (!hit) onSelect(null);
          else if (hit.board) onSelect({ board: true, room: hit.room });
          else onSelect(hit.a);
        }
      }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", () => { dragging = false; dragEx = null; });
    canvas.addEventListener("dblclick", (e) => {
      const p = local(e);
      const hit = pick(p.x, p.y);
      if (hit && hit.a && onOpen) onOpen(hit.a);
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
    /* Foyer, café and wing rooms are not hang space — dropping there would
       park the piece in a room id the layout never reads exhibits from. */
    if (!room || !room.era || room.foyer || room.amenity) return null;
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
  const probe = (px, py) => {
    const e = pick(px, py);
    return {
      cam, arrange,
      hit: e && e.a ? e.a.no : null,
      board: !!(e && e.board),
    };
  };
  const clearSelection = () => { selected = null; };

  const clampCam = (x) =>
    Math.max(0, Math.min(Math.max(0, (layoutCache ? layoutCache.total : VIEW) - VIEW), x));

  /* World-space box of the room intro board, just inside the left wall. */
  function boardBox(r) {
    return { x: r.x + 11, y: 40, w: 32, h: 42 };
  }

  /* Exhibit first, then room boards — so a piece hanging near the plaque still
     wins the click. Boards return { board:true, room }. */
  function pick(px, py) {
    if (!layoutCache) return null;
    const wx = px / SCALE + cam, wy = py / SCALE;
    for (const e of layoutCache.exhibits) {
      const b = exhibitBox(e);
      if (wx >= b.x - 4 && wx <= b.x + b.w + 4 && wy >= b.y - 4 && wy <= b.y + b.h + 8) return e;
    }
    for (const r of layoutCache.rooms) {
      if (!roomHasBoard(r)) continue;
      const b = boardBox(r);
      if (wx >= b.x - 2 && wx <= b.x + b.w + 2 && wy >= b.y - 2 && wy <= b.y + b.h + 2)
        return { board: true, room: r };
    }
    return null;
  }

  function roomHasBoard(r) {
    return !!(r && r.era && !r.foyer && !r.amenity && r.exhibits && r.exhibits.length);
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

  /* Coved ceiling with recessed downlights. Spacing tightens as lighting is
     upgraded; bare fittings start as dim and warm up with each purchase. */
  function drawCeiling(x0, w, dim) {
    const light = fac ? fac.lighting : 0;
    const pitch = Math.max(28, 52 - light * 2);
    const glow = (0.08 + Math.min(0.22, light * 0.018)) * (dim ? 0.45 : 1);
    const bulb = dim ? "#a89870" : light >= 4 ? "#fff1c4" : light >= 1 ? "#ffe6ad" : "#c4a86a";
    rect(x0, 0, w, WALL_TOP - 8, dim ? "#0c0a07" : C.ceil);
    rect(x0, WALL_TOP - 8, w, 4, C.cove);
    rect(x0, WALL_TOP - 8, w, 1, light >= 2 ? "#6a5c42" : C.coveLit);
    rect(x0, WALL_TOP - 4, w, 4, C.ceilShade);
    for (let lx = Math.ceil(x0 / pitch) * pitch; lx < x0 + w; lx += pitch) {
      rect(lx - 3, WALL_TOP - 4, 7, 3, "#3a332a");
      rect(lx - 2, WALL_TOP - 2, 5, 1, bulb);
      const g = ctx.createRadialGradient(sx(lx), sy(WALL_TOP - 2), 1, sx(lx), sy(WALL_TOP - 2), 30 + light);
      g.addColorStop(0, "rgba(255,226,166," + glow.toFixed(3) + ")");
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

    const dim = !!r.deepgal;
    drawWall(x0, r.width);
    drawFloor(x0, r.width);
    drawCeiling(x0, r.width, dim);

    if (r.foyer) { drawFoyer(r); return; }
    if (r.cafe) { drawCafe(r); return; }
    if (r.deepgal) { drawDeepGallery(r); return; }
    if (r.wing) { drawWingRoom(r); return; }

    if (roomHasBoard(r)) drawInfoBoard(r);
    if (r.width > 260) drawPlant(x1 - 22);

    /* Climate control: a wall unit and the soft blue of a cooled room.
       Kept clear of the intro board on the left. */
    if (fac && (fac.climate > 0 || fac.climateOn)) {
      drawClimateUnit(x0 + 52);
      if (fac.climate >= 3 || fac.climateOn) {
        ctx.globalAlpha = 0.04;
        rect(x0, WALL_TOP, r.width, FLOOR_Y - WALL_TOP, "#8ec4d8");
        ctx.globalAlpha = 1;
      }
    }

    /* Volunteer guides stand by the best wall in each room once trained. */
    if (fac && fac.guides > 0 && r.exhibits.length) drawGuide(r);

    /* Press: a framed cutting by the door. */
    if (fac && fac.press > 0) {
      const nx = x1 - 28;
      rect(nx, 48, 18, 22, "#2a2418");
      rect(nx, 48, 18, 1, "#8a6a2c");
      for (let i = 0; i < 5; i++) rect(nx + 2, 52 + i * 3, 14, 1, i === 0 ? "#c79a42" : "#5d5138");
    }

    /* Touring show: a travel crate parked against the skirting. */
    if (fac && fac.touring > 0 && r.exhibits.length) {
      const cx = x0 + 40;
      rect(cx, FLOOR_Y - 18, 28, 18, "#6b5a3a");
      rect(cx, FLOOR_Y - 18, 28, 2, "#87724a");
      rect(cx + 2, FLOOR_Y - 14, 24, 2, "#4a3f28");
      rect(cx + 10, FLOOR_Y - 10, 8, 6, "#3a3322");
    }

    /* Endowed research post: a reading table at the far end of busy rooms. */
    if (fac && fac.research > 0 && r.exhibits.length && r.width > 240) {
      const rx = x1 - 48;
      rect(rx - 16, 120, 32, 4, "#5a4a30");
      rect(rx - 14, 124, 3, 12, "#4a3f28");
      rect(rx + 11, 124, 3, 12, "#4a3f28");
      rect(rx - 6, 114, 10, 6, "#e8e1d1");
      rect(rx - 5, 115, 8, 1, "#2a2418");
      rect(rx + 6, 116, 4, 5, "#3a4a5a");
    }
  }

  /* Intro board beside the door of each gallery: a small wall plaque you can
     click for the era and where the finds on these walls actually come from. */
  function drawInfoBoard(r) {
    const b = boardBox(r);
    const lit = (selected && selected.board && selected.room === r) ||
                (hover && hover.board && hover.room === r);

    /* Mount plate and frame */
    rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, lit ? "#8a6a2c" : "#2a2418");
    rect(b.x, b.y, b.w, b.h, "#1a160d");
    rect(b.x, b.y, b.w, 1, lit ? "#e8c66a" : "#c79a42");
    rect(b.x, b.y + 1, b.w, 1, "#4a3f28");
    /* Header bar */
    rect(b.x + 2, b.y + 4, b.w - 4, 6, "#2f2818");
    rect(b.x + 3, b.y + 5, b.w - 6, 2, lit ? "#e8c66a" : "#8a6a2c");
    /* Body lines — texture for the wall, real words drawn in the overlay */
    for (let i = 0; i < 5; i++) {
      const w = 10 + (i % 3) * 5;
      rect(b.x + 4, b.y + 14 + i * 4, w, 1, i === 0 ? "#6b5a3a" : "#3d3423");
    }
    /* Small corner dots like screw heads */
    rect(b.x + 2, b.y + 2, 1, 1, "#5a4e35");
    rect(b.x + b.w - 3, b.y + 2, 1, 1, "#5a4e35");
    rect(b.x + 2, b.y + b.h - 3, 1, 1, "#5a4e35");
    rect(b.x + b.w - 3, b.y + b.h - 3, 1, 1, "#5a4e35");

    if (lit) {
      ctx.strokeStyle = "#e8c66a";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx(b.x) - 2, sy(b.y) - 2, Math.round(b.w * SCALE) + 4, Math.round(b.h * SCALE) + 4);
    }
  }

  function drawClimateUnit(px) {
    rect(px, 52, 14, 10, "#3a4248");
    rect(px, 52, 14, 1, "#6a7a84");
    rect(px + 2, 55, 10, 2, "#1a2228");
    rect(px + 2, 58, 4, 2, fac && fac.climateOn ? "#4e9d4e" : "#6a7a84");
    rect(px + 8, 58, 4, 2, "#4e9d4e");
  }

  function drawGuide(r) {
    if (!guideSprites.length) {
      for (let i = 0; i < 4; i++) guideSprites.push(S7.people.makePerson(9000 + i * 17, "staff"));
    }
    const s = guideSprites[Math.abs(Math.floor(r.x / 40)) % guideSprites.length];
    const gx = r.x + 58;   /* clear of the intro board */
    if (gx < cam - 30 || gx > cam + VIEW + 30) return;
    const py = sy(FLOOR_Y + 18) - s.h * PERSON;
    ctx.drawImage(s.stand, sx(gx) - Math.round(s.w * PERSON / 2), py, s.w * PERSON, s.h * PERSON);
    /* lanyard badge */
    rect(gx - 1, FLOOR_Y - 4, 3, 4, "#c79a42");
  }

  function drawCafe(r) {
    const x0 = r.x, x1 = r.x + r.width;
    /* counter */
    const kx = x0 + 48;
    rect(kx - 30, 96, 60, 6, "#6d5b3c");
    rect(kx - 30, 96, 60, 2, "#87724a");
    rect(kx - 28, 102, 56, 26, "#4f4229");
    /* coffee machine and cups */
    rect(kx - 18, 86, 12, 10, "#2a2a33");
    rect(kx - 16, 88, 8, 4, "#4e9d4e");
    for (let i = 0; i < 3; i++) rect(kx + 4 + i * 6, 90, 4, 5, i % 2 ? "#e8e1d1" : "#c79a42");
    /* tables */
    const nTables = 1 + Math.min(3, (fac ? fac.cafe : 1));
    for (let i = 0; i < nTables; i++) {
      const tx = x0 + 100 + i * 36;
      if (tx > x1 - 20) break;
      rect(tx - 10, 128, 20, 3, "#6b5a3a");
      rect(tx - 1, 131, 2, 12, "#4a3f28");
      rect(tx - 8, 140, 3, 4, "#4a3f28");
      rect(tx + 5, 140, 3, 4, "#4a3f28");
    }
    /* chalkboard menu */
    rect(x0 + 12, 44, 28, 36, "#1a2218");
    rect(x0 + 12, 44, 28, 1, "#4a6b45");
    for (let i = 0; i < 6; i++) rect(x0 + 15, 50 + i * 4, 18 + (i % 2) * 4, 1, "#6a8b65");
    drawPlant(x1 - 22);
    if (fac && fac.climate > 0) drawClimateUnit(x0 + 48);
  }

  function drawDeepGallery(r) {
    const x0 = r.x, x1 = r.x + r.width;
    /* low light, thick glass cases waiting for the deep material */
    ctx.globalAlpha = 0.35;
    rect(x0, WALL_TOP, r.width, FLOOR_Y - WALL_TOP, "#0a1018");
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const cx = x0 + 50 + i * 55;
      if (cx > x1 - 30) break;
      rect(cx - 14, 70, 28, 42, "#1a1e24");
      rect(cx - 14, 70, 28, 2, "#3a4a5a");
      ctx.globalAlpha = 0.2;
      rect(cx - 12, 74, 24, 34, "#6a90a8");
      ctx.globalAlpha = 1;
      rect(cx - 10, 80, 20, 18, "#12161c");
    }
    rect(x0 + r.width / 2 - 40, 44, 80, 14, "#12161c");
    rect(x0 + r.width / 2 - 40, 44, 80, 1, "#4a6a8a");
    if (fac && fac.climate > 0) drawClimateUnit(x0 + 16);
  }

  function drawWingRoom(r) {
    const x0 = r.x, x1 = r.x + r.width;
    /* freshly opened: bare wall, a plant, a temporary sign */
    rect(x0 + 20, 48, 36, 28, "#3a3426");
    rect(x0 + 20, 48, 36, 1, "#665941");
    for (let i = 0; i < 5; i++) rect(x0 + 24, 54 + i * 4, 22 + (i % 2) * 6, 1, "#5d5138");
    drawPlant(x1 - 22);
    if (r.wingIndex === 0) drawPlant(x0 + 50);
    if (fac && fac.climate > 0) drawClimateUnit(x0 + 14);
  }

  /* ---------- the entrance hall ---------------------------------------------
     Street doors, daylight on the floor, and the desk where the money is
     actually taken. Tickets, leaflets and the gift shop all land here so a
     player who has just spent money can see the difference without leaving
     the room. */
  function drawFoyer(r) {
    const dx = r.doorX;
    const tickets = fac ? fac.tickets : 0;
    const leaflets = fac ? fac.leaflet : 0;
    const shopLvl = fac ? fac.shop : 0;

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
    const kx = r.deskX, kw = r.deskW + (tickets >= 3 ? 8 : 0);
    rect(kx - kw / 2, 96, kw, 6, "#6d5b3c");                 /* counter top */
    rect(kx - kw / 2, 96, kw, 2, "#87724a");
    rect(kx - kw / 2 + 2, 102, kw - 4, 26, "#4f4229");       /* front panel */
    rect(kx - kw / 2 + 2, 102, kw - 4, 1, "#2f2718");
    for (let i = 1; i < 4; i++) rect(kx - kw / 2 + 2 + i * (kw - 4) / 4, 104, 1, 22, "#3d3322");
    /* till and a card reader — more kit once tickets are printed */
    rect(kx + 8, 89, 11, 7, "#2a2a33");
    rect(kx + 10, 91, 7, 3, tickets > 0 ? "#4e9d4e" : "#3a3a44");
    rect(kx - 15, 92, 5, 4, "#3a3a44");
    if (tickets >= 1) {
      rect(kx - 6, 88, 9, 8, "#3a3426");
      rect(kx - 5, 90, 7, 2, "#c79a42");
      for (let i = 0; i < Math.min(4, tickets); i++)
        rect(kx - 4 + i, 93 + i, 5, 1, "#e8e1d1");
    }
    if (tickets >= 4) {
      rect(kx + 20, 86, 8, 10, "#2a2a33");
      rect(kx + 22, 88, 4, 3, "#6ab0d8");
    }
    /* leaflets — a bare rack at first, a full stand after leafleting */
    const nLeaf = leaflets > 0 ? 3 + Math.min(5, leaflets) : 2;
    for (let i = 0; i < nLeaf; i++)
      rect(kx - 22 + i * 5, 92 - (leaflets > 0 ? 0 : 0), 4, 4, i % 2 ? "#b5904a" : "#8f8a7a");
    if (leaflets >= 2) {
      rect(kx - 40, 100, 12, 28, "#3a3426");
      for (let i = 0; i < 4; i++) rect(kx - 38, 104 + i * 5, 8, 3, i % 2 ? "#c79a42" : "#8f8a7a");
    }

    /* signage over the desk */
    rect(kx - 30, 44, 60, 16, "#2a2418");
    rect(kx - 30, 44, 60, 1, tickets >= 2 ? "#c79a42" : "#4c412a");
    rect(kx - 25, 49, 34, 2, "#c79a42");
    rect(kx - 25, 53, 24, 2, "#7d7461");

    /* gift shop bay at the far end of a lengthened foyer */
    if (shopLvl > 0) {
      const sx0 = r.width - 64;
      rect(sx0, 44, 50, 14, "#2a2418");
      rect(sx0, 44, 50, 1, "#c79a42");
      rect(sx0 + 6, 49, 30, 2, "#8a6a2c");
      /* shelves of postcards and books */
      for (let row = 0; row < 3; row++) {
        rect(sx0 + 4, 70 + row * 12, 42, 2, "#4a3f28");
        for (let i = 0; i < 5 + Math.min(3, shopLvl); i++)
          rect(sx0 + 6 + i * 7, 62 + row * 12, 5, 8, i % 3 === 0 ? "#b5904a" : i % 3 === 1 ? "#6b5a8a" : "#4a6b45");
      }
      rect(sx0 + 8, 108, 34, 4, "#6d5b3c");
      rect(sx0 + 8, 112, 34, 16, "#4f4229");
    }

    /* a rope line and a bin, because foyers are full of both */
    rect(kx - 40, 132, 1, 8, C.rope);
    rect(kx + 40, 132, 1, 8, C.rope);
    rect(kx - 40, 133, 80, 1, C.rope);
    drawPlant(r.width - 26);
    if (fac && fac.climate > 0) drawClimateUnit(r.deskX + 50);
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

  /* A soft cone from the track, plus the pool it throws on the floor.
     Lighting upgrades raise the pool and the cone together — the first few
     purchases are the difference between a shed and a museum. */
  function spotlight(wx, top, bottom) {
    const light = fac ? fac.lighting : 0;
    const poolA = 0.05 + Math.min(0.22, light * 0.018);
    const poolR = 36 + light * 2;
    const pool = ctx.createRadialGradient(sx(wx), sy(FLOOR_Y + 14), 2, sx(wx), sy(FLOOR_Y + 14), poolR);
    pool.addColorStop(0, "rgba(255,226,166," + poolA.toFixed(3) + ")");
    pool.addColorStop(1, "rgba(255,222,150,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(sx(wx) - 46, sy(FLOOR_Y), 92, (V.H - FLOOR_Y) * SCALE);
    cone(wx, top, bottom);
  }

  function cone(wx, top, bottom) {
    const light = fac ? fac.lighting : 0;
    const a = 0.04 + Math.min(0.16, light * 0.014);
    const g = ctx.createLinearGradient(0, sy(WALL_TOP), 0, sy(bottom));
    g.addColorStop(0, "rgba(255,222,150," + a.toFixed(3) + ")");
    g.addColorStop(1, "rgba(255,222,150,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx(wx - 3), sy(WALL_TOP));
    ctx.lineTo(sx(wx + 3), sy(WALL_TOP));
    ctx.lineTo(sx(wx + 22 + light), sy(bottom));
    ctx.lineTo(sx(wx - 22 - light), sy(bottom));
    ctx.closePath();
    ctx.fill();
  }

  function artAt(e, b) {
    const px = Math.round(b.h * SCALE);
    return S7.artifacts.scaledFor(e.a, px);
  }

  /* Museum lighting: the thing in the light is brighter than the wall it hangs
     on. Without this everything sits at the same value and the room goes flat.
     Upgraded fittings push more of that warmth onto the work itself. */
  function lightArt(b, aw, ah) {
    const light = fac ? fac.lighting : 0;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.06 + Math.min(0.22, light * 0.016);
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
    const ring = (selected && !selected.board && selected === e) ? "#e8c66a"
               : (hover && !hover.board && hover === e) ? "#c79a42" : null;
    const cases = fac ? fac.cases : 0;
    const plinths = fac ? fac.plinths : 0;

    if (e.mount === "wall") {
      spotlight(e.x, 30, b.y + b.h + 8);
      /* Better lighting also buys a proper frame around wall pieces. */
      if ((fac ? fac.lighting : 0) >= 2 || cases >= 2) {
        rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, cases >= 4 ? "#2a2418" : "#1a160d");
        rect(b.x - 2, b.y - 2, b.w + 4, 1, "#8a6a2c");
      }
      ctx.fillStyle = "#00000055";
      ctx.fillRect(sx(b.x) + 3, sy(b.y) + 4, aw, ah);
      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      lightArt(b, aw, ah);
      if (ring) outlineBox(b, ring);
      if (b.y > RAIL_Y + 2) rect(e.x - 1, RAIL_Y, 1, b.y - RAIL_Y, "#5a4e35");
    } else if (e.mount === "plinth") {
      spotlight(e.x, 30, b.plinthTop);
      const pw = Math.max(14, Math.round(b.w * 0.78));
      /* No plinths bought yet: a packing crate. Commissioned ones look like
         stone, and higher levels add a marble cap and proper rope. */
      if (plinths <= 0) {
        rect(e.x - pw / 2, b.plinthTop, pw, FLOOR_Y + 8 - b.plinthTop, "#5a4a30");
        rect(e.x - pw / 2, b.plinthTop, pw, 2, "#6b5a3a");
        for (let y = b.plinthTop + 4; y < FLOOR_Y + 4; y += 5)
          rect(e.x - pw / 2 + 1, y, pw - 2, 1, "#4a3f28");
      } else {
        const body = plinths >= 4 ? "#6a6258" : C.plinth;
        const top = plinths >= 4 ? "#8a8274" : C.plinthTop;
        const shade = plinths >= 4 ? "#4a443c" : C.plinthShade;
        rect(e.x - pw / 2, b.plinthTop, pw, FLOOR_Y + 8 - b.plinthTop, body);
        rect(e.x - pw / 2, b.plinthTop, pw, 2, top);
        rect(e.x + pw / 2 - 5, b.plinthTop + 2, 5, FLOOR_Y + 6 - b.plinthTop, shade);
        if (plinths >= 6) {
          rect(e.x - pw / 2 - 1, b.plinthTop - 1, pw + 2, 1, "#a09a8a");
          rect(e.x - pw / 2, b.plinthTop + 3, pw, 1, "#00000022");
        }
      }
      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      lightArt(b, aw, ah);
      if (ring) outlineBox(b, ring);
      if (plinths >= 1) {
        const rw = Math.max(pw + 8, 26);
        const ropeCol = plinths >= 5 ? "#c79a42" : C.rope;
        rect(e.x - rw / 2, FLOOR_Y + 14, 1, 6, ropeCol);
        rect(e.x + rw / 2, FLOOR_Y + 14, 1, 6, ropeCol);
        rect(e.x - rw / 2, FLOOR_Y + 15, rw, 1, ropeCol);
      }
    } else {
      /* Objects: open shelf until cases are bought, then a real vitrine that
         gets thicker glass and a darker frame as more cases arrive. */
      const cw = Math.max(20, b.w + 10 + Math.min(6, cases));
      const pw = cw + 4;
      const glassTop = b.y - 7;
      spotlight(e.x, 30, glassTop + 6);

      rect(e.x - pw / 2, b.caseBottom, pw, FLOOR_Y + 8 - b.caseBottom, C.ped);
      rect(e.x - pw / 2, b.caseBottom, pw, 2, C.pedTop);
      rect(e.x + pw / 2 - 4, b.caseBottom + 2, 4, FLOOR_Y + 6 - b.caseBottom, C.pedShade);
      rect(e.x - pw / 2, FLOOR_Y + 5, pw, 3, C.pedShade);

      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      lightArt(b, aw, ah);

      if (cases > 0) {
        const glassA = 0.10 + Math.min(0.16, cases * 0.008);
        const streakA = 0.22 + Math.min(0.25, cases * 0.015);
        ctx.globalAlpha = glassA;
        rect(e.x - cw / 2, glassTop, cw, b.caseBottom - glassTop, C.caseGlass);
        ctx.globalAlpha = streakA;
        rect(e.x - cw / 2 + 4, glassTop + 2, 2, b.caseBottom - glassTop - 4, "#ffffff");
        ctx.globalAlpha = 1;
        const frame = cases >= 6 ? "#1a160d" : C.caseFrame;
        const edge = cases >= 6 ? "#6a5c42" : C.caseEdge;
        rect(e.x - cw / 2, glassTop, 1, b.caseBottom - glassTop, edge);
        rect(e.x + cw / 2, glassTop, 1, b.caseBottom - glassTop, edge);
        rect(e.x - cw / 2, glassTop, cw, cases >= 3 ? 3 : 2, frame);
        rect(e.x - cw / 2, glassTop + 1, cw, 1, edge);
        if (cases >= 8) {
          rect(e.x - cw / 2, b.caseBottom - 2, cw, 2, frame);
          rect(e.x - 2, glassTop - 3, 4, 2, "#ffe6ad"); /* lock light */
        }
        if (ring) outlineBox({ x: e.x - cw / 2, y: glassTop, w: cw, h: b.caseBottom - glassTop }, ring);
      } else if (ring) {
        outlineBox(b, ring);
      }
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

  /* ---------- labels & HUD text (crisp, unscaled) -------------------------------
     Accession plates live with the exhibit in the depth sort, not in the final
     overlay — otherwise a visitor walking past a plinth gets the item number
     stamped across their chest. Speech bubbles and the selected wall card stay
     in the overlay because those are UI, not furniture. */

  function drawLabel(e) {
    const b = exhibitBox(e);
    const x = sx(e.x);
    /* Wall plates hang just under the frame; floor pieces get a plate on the
       skirting in front of the mount — both still behind the walk band. */
    const y = e.mount === "wall" ? sy(b.y + b.h) + 12 : sy(FLOOR_Y + 6);
    if (x < -80 || x > CW + 80) return;
    const labels = fac ? fac.labels : 0;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "center";
    if (labels <= 0) {
      /* Handwritten scrap until proper labels are written. */
      ctx.fillStyle = "#00000055";
      ctx.fillRect(x - 11, y - 7, 22, 9);
      ctx.fillStyle = "#7d7461";
      ctx.fillText(e.a.no, x, y);
    } else if (labels < 3) {
      ctx.fillStyle = "#00000066";
      ctx.fillRect(x - 13, y - 8, 26, 11);
      ctx.fillStyle = "#a99f88";
      ctx.fillText(e.a.no, x, y);
    } else {
      /* Proper printed label: accession plus a short title. */
      const title = e.a.name.length > 18 ? e.a.name.slice(0, 16) + "…" : e.a.name;
      ctx.font = "9px ui-monospace, monospace";
      const tw = Math.max(ctx.measureText(title).width, ctx.measureText(e.a.no).width) + 10;
      ctx.fillStyle = "#12100add";
      ctx.fillRect(x - tw / 2, y - 8, tw, labels >= 6 ? 22 : 11);
      ctx.fillStyle = "#8a6a2c";
      ctx.fillRect(x - tw / 2, y - 8, tw, 1);
      ctx.fillStyle = labels >= 6 ? "#e8e1d1" : "#a99f88";
      if (labels >= 6) {
        ctx.fillText(title, x, y);
        ctx.fillStyle = "#a99f88";
        ctx.fillText(e.a.no, x, y + 11);
      } else {
        ctx.fillText(e.a.no, x, y);
      }
    }
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

  /* Short label on the intro board itself, crisp over the pixel art. */
  function drawBoardLabel(r) {
    if (!roomHasBoard(r)) return;
    const b = boardBox(r);
    const cx = sx(b.x + b.w / 2);
    if (cx < -40 || cx > CW + 40) return;
    let name = (r.era.name || "").toUpperCase()
      .replace(/ HORIZON$/, "")
      .replace(/ FILL$/, "")
      .replace(/ DEPOSIT$/, "")
      .replace(/^THE /, "");
    if (name.length > 11) name = name.slice(0, 10) + "…";
    ctx.textAlign = "center";
    ctx.font = "600 8px ui-monospace, monospace";
    ctx.fillStyle = "#c79a42";
    ctx.fillText(name, cx, sy(b.y + 14));
    ctx.font = "7px ui-monospace, monospace";
    ctx.fillStyle = "#7d7461";
    const n = r.exhibits.length;
    ctx.fillText(n + (n === 1 ? " find" : " finds"), cx, sy(b.y + 22));
    ctx.textAlign = "left";
  }

  /* The card beside the piece — short, plain, the way a real gallery writes. */
  function drawWallLabel(e) {
    const b = exhibitBox(e);
    const a = e.a;
    const cu = S7.cultures.byId[a.cultureId];
    const from = cu ? cu.name : "Unknown source";
    const period = cu && cu.period && cu.period !== "—" ? cu.period : "";
    const lines = [
      a.name,
      period ? from + " · " + period : from,
      S7.artifacts.materialLabel(a.material) + " · " + a.condition.n,
      "Item " + a.no + " · found at " + a.depth.toFixed(1) + " m",
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
    fac = facilities(S);
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
       visitor can walk behind a plinth and in front of the next one. Accession
       labels are drawn with their piece so they stay behind the walk band. */
    const items = [];
    for (const e of L.exhibits) {
      const ey = e.mount === "wall" ? 0 : FLOOR_Y + 8;
      items.push({ y: ey, fn: () => { drawExhibit(e, S); drawLabel(e); } });
    }
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

    /* overlay — room plaques (high on the wall), board titles, money floaters,
       the selected wall card, and speech. Not accession plates: those are furniture. */
    for (const r of L.rooms) {
      drawRoomPlaque(r);
      drawBoardLabel(r);
    }
    for (const a of crowd.agents) if (a.paid) drawPaidFloater(a);
    if (selected && !selected.board && L.exhibits.indexOf(selected) >= 0) drawWallLabel(selected);
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
