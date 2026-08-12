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
  /* Internal buffer grows to fill the on-screen frame (see resizeCanvas). */
  let CW = 1100, CH = 560;
  let VIEW_W = CW / SCALE;
  let VIEW_H = CH / SCALE;
  let VIEW = VIEW_W;

  const WALL_TOP = 14;
  const PLAQUE_Y = 26;
  const RAIL_Y = 38;               /* picture rail */
  const FLOOR_Y = V.FLOOR_Y;       /* 112 */
  const FLOOR_PITCH = V.FLOOR_PITCH || 178;
  const PERSON = 3;                /* people are drawn at 3:1 — 33 logical tall */

  let canvas, ctx;
  let camX = 0, camY = 0, camTX = 0, camTY = 0;
  let dragging = false, dragMoved = 0, dragPX = 0, dragPY = 0, dragCamX = 0, dragCamY = 0;
  let layoutCache = null;
  let onOpen = null, onSelect = null;
  let hover = null, selected = null;   /* exhibit, or { board:true, room } */
  let arrange = false;
  let dragEx = null;
  let pointer = { x: 0, y: 0 };
  let activeFloor = 0;             /* storey while painting a room */
  /* Museum facility levels, snapshotted at the start of each frame so every
     draw helper can see what the player has bought without threading S through
     twenty function signatures. */
  let fac = null;
  let guideSprites = [];
  let staffSprites = [];

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
      labels: 0,                         /* under-piece plates retired — click for caption */
      shop: u.shop || 0,
      staff: u.staff || u.guides || 0,
      guides: u.staff || u.guides || 0,
      cafe: u.cafe || 0,
      upper: u.upper || (u.wing ? 1 : 0),
      wing: u.upper || u.wing || 0,
      research: u.research || 0,
      deepgal: u.deepgal || 0,
      /* retired upgrades — keep zero so old draw branches stay quiet */
      climate: 0, climateOn: false,
      tickets: 0, leaflet: 0, plinths: 0, press: 0, touring: 0,
    };
  }

  /* ---------- setup ---------------------------------------------------------- */

  /* Match the canvas buffer to the laid-out CSS box so the museum fills the
     window instead of sitting in a fixed postcard. Always even so SCALE stays
     an integer mapping of world pixels. */
  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement || canvas;
    const cssW = Math.max(640, Math.floor(parent.clientWidth || 1100));
    const cssH = Math.max(360, Math.floor(parent.clientHeight || 560));
    /* Backing store at device pixels would blur pixel art; keep 1 CSS px = 1
       buffer px and draw at SCALE inside that. */
    let nextW = Math.floor(cssW / 2) * 2;
    let nextH = Math.floor(cssH / 2) * 2;
    nextW = Math.max(640, Math.min(1920, nextW));
    nextH = Math.max(360, Math.min(1100, nextH));
    if (nextW === CW && nextH === CH && canvas.width === CW) return;
    CW = nextW;
    CH = nextH;
    VIEW_W = VIEW = CW / SCALE;
    VIEW_H = CH / SCALE;
    canvas.width = CW;
    canvas.height = CH;
    if (ctx) ctx.imageSmoothingEnabled = false;
    camX = clampCamX(camX);
    camY = clampCamY(camY);
    camTX = clampCamX(camTX);
    camTY = clampCamY(camTY);
  }

  function init(el, handlers) {
    canvas = el;
    onOpen = handlers.onOpen;
    onSelect = handlers.onSelect;
    ctx = canvas.getContext("2d");
    resizeCanvas();
    ctx.imageSmoothingEnabled = false;
    window.addEventListener("resize", () => { resizeCanvas(); });

    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (CW / Math.max(1, r.width)),
        y: (e.clientY - r.top) * (CH / Math.max(1, r.height)),
      };
    };

    canvas.addEventListener("pointerdown", (e) => {
      const p = local(e);
      pointer = p;
      dragging = true; dragMoved = 0;
      dragPX = p.x; dragPY = p.y;
      dragCamX = camX; dragCamY = camY;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
      const p = local(e);
      pointer = p;
      if (dragging) {
        const dx = (p.x - dragPX) / SCALE;
        const dy = (p.y - dragPY) / SCALE;
        dragMoved = Math.max(dragMoved, Math.abs(dx) + Math.abs(dy));
        camX = camTX = clampCamX(dragCamX - dx);
        camY = camTY = clampCamY(dragCamY - dy);
        return;
      }
      if (layoutCache) {
        hover = pick(p.x, p.y);
        canvas.style.cursor = hover ? "pointer" : "grab";
      }
    });

    const release = (e) => {
      const p = local(e);
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* gone */ }
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
    canvas.addEventListener("pointercancel", () => { dragging = false; });
    canvas.addEventListener("dblclick", (e) => {
      const p = local(e);
      const hit = pick(p.x, p.y);
      if (hit && hit.a && onOpen) onOpen(hit.a);
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      camTX = clampCamX(camTX + e.deltaX * 0.55);
      camTY = clampCamY(camTY + e.deltaY * 0.55);
    }, { passive: false });
    canvas.style.cursor = "grab";
  }

  const setArrange = () => { /* rehang removed */ };
  const isArranging = () => false;
  const isDragging = () => false;
  const probe = (px, py) => {
    const e = pick(px, py);
    return {
      cam: camX, arrange: false,
      hit: e && e.a ? e.a.no : null,
      board: !!(e && e.board),
    };
  };
  const clearSelection = () => { selected = null; };

  const clampCamX = (x) => {
    const total = layoutCache ? layoutCache.total : VIEW_W;
    return Math.max(0, Math.min(Math.max(0, total - VIEW_W), x));
  };
  const clampCamY = (y) => {
    const yMin = layoutCache ? (layoutCache.yMin !== undefined ? layoutCache.yMin : 0) : 0;
    const yMax = layoutCache
      ? (layoutCache.yMax !== undefined ? layoutCache.yMax : (layoutCache.totalH || V.H))
      : VIEW_H;
    /* Tall canvases used to pin the camera so the basement could never sit in
       the upper half of the view. Allow enough travel that any storey's wall
       mid-height can land near the focus band (≈36% down the frame). */
    const focusBand = VIEW_H * 0.36;
    const lo = yMin + FLOOR_Y * 0.2 - focusBand;
    const hi = Math.max(lo, yMax - FLOOR_Y * 0.35 - focusBand);
    return Math.max(lo, Math.min(hi, y));
  };

  /* Floor-local box of the room intro board (world y = floorBase + y). */
  function boardBox(r) {
    return { x: r.x + 10, y: 38, w: 38, h: 48, floor: r.floor || 0 };
  }

  /* Exhibit first, then room boards. */
  function pick(px, py) {
    if (!layoutCache) return null;
    const wx = px / SCALE + camX, wy = py / SCALE + camY;
    for (const e of layoutCache.exhibits) {
      const b = exhibitBox(e);
      if (wx >= b.x - 4 && wx <= b.x + b.w + 4 && wy >= b.y - 4 && wy <= b.y + b.h + 8) return e;
    }
    for (const r of layoutCache.rooms) {
      if (!roomHasBoard(r)) continue;
      const b = boardBox(r);
      const base = V.floorBase(r.floor || 0);
      if (wx >= b.x - 2 && wx <= b.x + b.w + 2 &&
          wy >= base + b.y - 2 && wy <= base + b.y + b.h + 2)
        return { board: true, room: r };
    }
    return null;
  }

  function roomHasBoard(r) {
    return !!(r && r.era && !r.foyer && !r.amenity && r.exhibits && r.exhibits.length);
  }

  /* Theme tint for special halls so Egypt / dinosaurs / minerals read as
     destinations, not just another beige corridor. */
  function themeWall(r) {
    if (!r.theme) return null;
    if (r.theme === "egypt") return { hi: "#3a3220", lo: "#2a2214", accent: "#c79a42" };
    if (r.theme === "dino") return { hi: "#2a3028", lo: "#1c221a", accent: "#8a9a6a" };
    if (r.theme === "fossil") return { hi: "#2e2a24", lo: "#201c18", accent: "#a09070" };
    if (r.theme === "mineral") return { hi: "#242838", lo: "#181c28", accent: "#6a8ab0" };
    return null;
  }

  /* Where an exhibit's artwork sits, in world pixels — driven by the object's
     own physical size, so a bead occupies a small case at eye level and a
     colossal head runs from the floor almost to the ceiling.
     Art is always clamped under the ceiling moulding: without that, tall
     case glass starts above WALL_TOP and reads as "hanging from the roof",
     especially on the basement where the void above is visible. */
  function exhibitBox(e) {
    const h = e.h, w = Math.round(h * 0.95);
    const fl = e.floor !== undefined ? e.floor : ((e.room && e.room.floor) || 0);
    const base = V.floorBase(fl);
    /* Lowest local Y the glass top / art may reach (below picture rail). */
    const ceil = WALL_TOP + 8;
    if (e.mount === "wall") {
      const bottom = h <= 50 ? 96 : FLOOR_Y - 4;
      const top = Math.max(ceil, bottom - h);
      return { x: e.x - w / 2, y: base + top, w, h: bottom - top, base };
    }
    if (e.mount === "plinth") {
      /* Plinth cap sits in the lower half of the wall; tall pieces sit on a
         lower cap so the head never punches through the ceiling. */
      let plinthTop = Math.max(FLOOR_Y - 48, Math.min(FLOOR_Y - 4, Math.round(74 + h / 2)));
      if (plinthTop - h < ceil) plinthTop = Math.min(FLOOR_Y - 4, ceil + h);
      const artTop = Math.max(ceil, plinthTop - h);
      return {
        x: e.x - w / 2, y: base + artTop, w, h: plinthTop - artTop,
        plinthTop: base + plinthTop, base,
      };
    }
    /* Case: shelf line fixed near eye level; art + glass clamped under ceil. */
    const bottom = 92;
    const artTop = Math.max(ceil, bottom - h);
    return {
      x: e.x - w / 2, y: base + artTop, w, h: bottom - artTop,
      caseBottom: base + bottom, base,
    };
  }

  /* ---------- world drawing --------------------------------------------------- */

  const sx = (wx) => Math.round((wx - camX) * SCALE);
  /* World y (includes floor pitch for multi-storey). */
  const sy = (wy) => Math.round((wy - camY) * SCALE);
  const ly = (localY) => V.floorBase(activeFloor) + localY;
  const syl = (localY) => sy(ly(localY));
  /* While painting a room, rect() treats y as floor-local. */
  let roomLocal = false;
  function rect(wx, wy, w, h, col) {
    const yy = roomLocal ? ly(wy) : wy;
    ctx.fillStyle = col;
    ctx.fillRect(sx(wx), sy(yy), Math.round(w * SCALE), Math.round(h * SCALE));
  }
  const syR = (y) => (roomLocal ? syl(y) : sy(y));

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
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 8; i++) {
      const y = FLOOR_Y + 2 + i * i * 1.35;
      if (y > V.H) break;
      rows.push(y);
      rect(x0, y, w, 1, C.floorLine);
    }
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.35;
    for (let i = Math.max(0, rows.length - 3); i < rows.length - 1; i++) {
      const y = rows[i], next = rows[i + 1];
      const pitch = 22 + i * 8;
      for (let px = Math.floor((x0 + (i % 2) * pitch / 2) / pitch) * pitch; px < x0 + w; px += pitch) {
        if (px < x0) continue;
        rect(px, y + 1, 1, Math.max(1, next - y - 1), C.floorLine);
      }
    }
    ctx.globalAlpha = 1;
    /* Warm sheen from the lights */
    const g = ctx.createLinearGradient(0, syR(FLOOR_Y), 0, syR(V.H));
    g.addColorStop(0, "rgba(255,226,166,0.09)");
    g.addColorStop(1, "rgba(255,226,166,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx(x0), syR(FLOOR_Y), Math.round(w * SCALE), Math.round((V.H - FLOOR_Y) * SCALE));
  }

  /* Wall: wash, panel joins, picture rail, and a proper dado for height. */
  function drawWall(x0, w, theme) {
    const top = theme ? theme.hi : C.wallTop;
    const hi = theme ? theme.hi : C.wallHi;
    const lo = theme ? theme.lo : C.wallLo;
    const shadeLo = theme ? theme.lo : C.wallShade;
    for (let y = WALL_TOP; y < FLOOR_Y; y++) {
      const t = (y - WALL_TOP) / (FLOOR_Y - WALL_TOP);
      const shade = t < 0.16 ? top : t < 0.46 ? hi : t < 0.82 ? lo : shadeLo;
      rect(x0, y, w, 1, shade);
    }
    /* Soft vertical panels */
    ctx.globalAlpha = 0.22;
    for (let px = Math.ceil((x0 + 24) / 72) * 72; px < x0 + w - 20; px += 72)
      rect(px, WALL_TOP + 10, 1, FLOOR_Y - WALL_TOP - 28, C.wallSeam);
    ctx.globalAlpha = 1;
    /* Cornice under the cove */
    rect(x0, WALL_TOP + 2, w, 2, "#00000022");
    rect(x0, WALL_TOP + 4, w, 1, theme && theme.accent ? theme.accent + "55" : "#8a6a2c33");
    /* Picture rail */
    rect(x0, RAIL_Y, w, 2, theme && theme.accent ? theme.accent : C.rail);
    rect(x0, RAIL_Y + 2, w, 1, "#00000040");
    /* Dado / chair rail — gives the wall a classical middle */
    const dado = 78;
    rect(x0, dado, w, 3, "#4a3f28");
    rect(x0, dado, w, 1, "#6b5a3a");
    rect(x0, dado + 3, w, 1, "#00000030");
    /* Lower wall slightly darker (wainscot) */
    ctx.globalAlpha = 0.12;
    rect(x0, dado + 4, w, FLOOR_Y - dado - 9, "#000000");
    ctx.globalAlpha = 1;
    /* Skirting */
    rect(x0, FLOOR_Y - 6, w, 6, C.skirt);
    rect(x0, FLOOR_Y - 6, w, 1, "#8a7350");
    rect(x0, FLOOR_Y - 1, w, 1, "#2a2317");
  }

  /* Runner carpet down the centre of a gallery. */
  function drawCarpet(x0, w) {
    if (w < 200) return;
    const cx = x0 + w / 2;
    const cw = Math.min(48, w * 0.22);
    rect(cx - cw / 2, FLOOR_Y + 4, cw, V.H - FLOOR_Y - 10, "#3a2820");
    rect(cx - cw / 2, FLOOR_Y + 4, cw, 1, "#5a4030");
    ctx.globalAlpha = 0.35;
    for (let y = FLOOR_Y + 10; y < V.H - 12; y += 8)
      rect(cx - cw / 2 + 3, y, cw - 6, 1, "#6a4a30");
    ctx.globalAlpha = 1;
    rect(cx - cw / 2, FLOOR_Y + 4, 2, V.H - FLOOR_Y - 10, "#8a6a2c55");
    rect(cx + cw / 2 - 2, FLOOR_Y + 4, 2, V.H - FLOOR_Y - 10, "#8a6a2c55");
  }

  /* Non-accession décor: columns, urns, niches — architecture, not inventory. */
  function drawDecor(d, room) {
    const x = d.x;
    if (x < camX - 30 || x > camX + VIEW_W + 30) return;
    if (d.kind === "column") {
      rect(x - 5, WALL_TOP + 6, 10, FLOOR_Y - WALL_TOP - 10, "#4a4234");
      rect(x - 6, WALL_TOP + 4, 12, 4, "#6b5a3a");
      rect(x - 7, FLOOR_Y - 8, 14, 6, "#5a4e35");
      rect(x - 4, WALL_TOP + 10, 2, FLOOR_Y - WALL_TOP - 20, "#6a5c42");
      rect(x + 2, WALL_TOP + 10, 1, FLOOR_Y - WALL_TOP - 20, "#2a2418");
    } else if (d.kind === "urn") {
      rect(x - 6, 100, 12, 4, "#5a4e35");
      rect(x - 5, 88, 10, 14, "#6b5a8a");
      rect(x - 4, 86, 8, 3, "#8a7aaa");
      rect(x - 3, 92, 6, 6, "#4a3a6a");
      rect(x - 7, 104, 14, 3, "#4a3f28");
      rect(x - 2, 108, 4, 6, "#3a3426");
    } else if (d.kind === "niche") {
      rect(x - 14, 44, 28, 36, "#1a160d");
      rect(x - 14, 44, 28, 1, "#6b5a3a");
      rect(x - 12, 46, 24, 32, "#2a2418");
      rect(x - 5, 58, 10, 16, "#5a4e35");
      rect(x - 4, 56, 8, 3, "#c79a42");
    } else if (d.kind === "bustPed") {
      rect(x - 8, 100, 16, 14, "#5a5048");
      rect(x - 9, 98, 18, 3, "#7a7268");
      rect(x - 5, 78, 10, 20, "#8a8278");
      rect(x - 4, 74, 8, 6, "#a09a90");
      rect(x - 3, 72, 6, 3, "#6a6458");
    } else if (d.kind === "console") {
      rect(x - 18, 108, 36, 4, "#5a4a30");
      rect(x - 16, 112, 3, 10, "#4a3f28");
      rect(x + 13, 112, 3, 10, "#4a3f28");
      rect(x - 10, 100, 8, 8, "#6b5a8a");
      rect(x + 2, 102, 6, 6, "#c79a42");
      rect(x + 4, 98, 4, 4, "#e8e1d1");
    } else if (d.kind === "plant") {
      drawPlant(x);
    }
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
      const g = ctx.createRadialGradient(sx(lx), syR(WALL_TOP - 2), 1, sx(lx), syR(WALL_TOP - 2), 30 + light);
      g.addColorStop(0, "rgba(255,226,166," + glow.toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,226,166,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx(lx) - 32, syR(0), 64, Math.round((WALL_TOP + 10) * SCALE));
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
      ctx.moveTo(sx(px), syR(117));
      ctx.quadraticCurveTo(sx(px + Math.cos(a) * len * 0.5), syR(112 + Math.sin(a) * len * 0.4), sx(ex), syR(ey));
      ctx.stroke();
    }
  }

  function drawStaffAt(wx, localY, kind) {
    if (!staffSprites.length) {
      for (let i = 0; i < 4; i++) staffSprites.push(S7.people.makePerson(7000 + i * 19, "staff"));
    }
    const s = staffSprites[Math.abs(Math.floor(wx / 30)) % staffSprites.length];
    const py = syR(localY || FLOOR_Y + 18) - s.h * PERSON;
    ctx.drawImage(s.stand, sx(wx) - Math.round(s.w * PERSON / 2), py, s.w * PERSON, s.h * PERSON);
    /* apron / badge */
    rect(wx - 2, (localY || FLOOR_Y + 18) - 14, 4, 5, kind === "cafe" ? "#e8e1d1" : "#c79a42");
  }

  function drawRoom(r) {
    const x0 = r.x, x1 = r.x + r.width;
    activeFloor = r.floor || 0;
    const base = V.floorBase(activeFloor);
    /* Cull rooms outside the 2D viewport. */
    if (x1 < camX - 40 || x0 > camX + VIEW_W + 40) return;
    if (base + V.H < camY - 20 || base > camY + VIEW_H + 20) return;

    roomLocal = true;
    const dim = !!r.deepgal;
    drawWall(x0, r.width, themeWall(r));
    drawFloor(x0, r.width);
    drawCeiling(x0, r.width, dim);

    if (r.foyer) { drawFoyer(r); roomLocal = false; return; }
    if (r.stairs) { drawStairs(r); roomLocal = false; return; }
    if (r.shop) { drawGiftShop(r); roomLocal = false; return; }
    if (r.cafe) { drawCafe(r); roomLocal = false; return; }
    if (r.researchRoom) { drawResearchRoom(r); roomLocal = false; return; }
    if (r.wing) { drawWingRoom(r); roomLocal = false; return; }
    /* Empty deep gallery only — rooms with finds fall through to normal hang. */
    if (r.deepgal && (!r.exhibits || !r.exhibits.length)) {
      drawDeepGallery(r); roomLocal = false; return;
    }

    /* Gallery rooms: carpet, architecture, then wall board. */
    drawCarpet(x0, r.width);
    if (r.deepgal) {
      ctx.globalAlpha = 0.22;
      rect(x0, WALL_TOP, r.width, FLOOR_Y - WALL_TOP, "#0a1018");
      ctx.globalAlpha = 1;
    }
    if (r.decor) for (const d of r.decor) drawDecor(d, r);
    if (roomHasBoard(r)) drawInfoBoard(r);

    if (fac && fac.staff > 0 && r.exhibits.length) drawGuide(r);
    roomLocal = false;
  }

  function drawStairs(r) {
    const x0 = r.x, w = r.width;
    const goingUp = (r.stairsTo || 0) > (r.floor || 0);
    /* Stone stair hall */
    ctx.globalAlpha = 0.14;
    rect(x0, WALL_TOP, w, FLOOR_Y - WALL_TOP, goingUp ? "#3a4a5a" : "#3a3830");
    ctx.globalAlpha = 1;
    /* Steps */
    for (let i = 0; i < 8; i++) {
      const y = FLOOR_Y - 8 - i * 8;
      const inset = goingUp ? i * 4 : (7 - i) * 4;
      rect(x0 + 18 + inset, y, w - 36 - inset * 1.2, 7, i % 2 ? "#5a5040" : "#4a4030");
      rect(x0 + 18 + inset, y, w - 36 - inset * 1.2, 1, "#7a6a50");
    }
    /* Banisters + gold handrail */
    rect(x0 + 14, 40, 3, FLOOR_Y - 40, "#3a3426");
    rect(x0 + w - 17, 40, 3, FLOOR_Y - 40, "#3a3426");
    rect(x0 + 12, 38, w - 24, 3, "#c79a42");
    rect(x0 + 12, 38, w - 24, 1, "#e8c66a");
    /* Direction plate */
    const label = goingUp ? "UP" : "DOWN";
    rect(x0 + w / 2 - 18, 42, 36, 14, "#1a160d");
    rect(x0 + w / 2 - 18, 42, 36, 2, "#c79a42");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 10px " + FONT_UI;
    fillTextShadow(label, sx(x0 + w / 2), syR(50), "#e8c66a", "#00000088");
    /* Arrow chevron */
    const ax = x0 + w / 2, ay = goingUp ? 62 : 100;
    rect(ax - 1, goingUp ? 58 : 70, 2, 18, "#c79a42");
    if (goingUp) {
      rect(ax - 4, 60, 3, 3, "#c79a42");
      rect(ax + 1, 60, 3, 3, "#c79a42");
      rect(ax - 2, 58, 5, 2, "#e8c66a");
    } else {
      rect(ax - 4, 84, 3, 3, "#c79a42");
      rect(ax + 1, 84, 3, 3, "#c79a42");
      rect(ax - 2, 86, 5, 2, "#e8c66a");
    }
    drawPlant(x0 + w - 20);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /* Intro board beside the door of each gallery: a small wall plaque you can
     click for the era and where the finds on these walls actually come from.
     Body text is drawn crisp in the overlay (drawBoardLabel) — keep the plate
     clear so the words are not fighting fake "line" texture. */
  function drawInfoBoard(r) {
    const b = boardBox(r);
    const lit = (selected && selected.board && selected.room === r) ||
                (hover && hover.board && hover.room === r);

    /* Outer mount + frame */
    rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, lit ? "#6a5428" : "#1a160d");
    rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, lit ? "#c79a42" : "#5a4e35");
    rect(b.x, b.y, b.w, b.h, "#141008");
    /* Gold header strip */
    rect(b.x, b.y, b.w, 1, lit ? "#e8c66a" : "#c79a42");
    rect(b.x + 2, b.y + 3, b.w - 4, 1, lit ? "#e8c66a" : "#8a6a2c");
    /* Soft inner field for text */
    rect(b.x + 2, b.y + 8, b.w - 4, b.h - 12, "#1c160c");
    /* Screw heads */
    rect(b.x + 2, b.y + 2, 1, 1, "#8a6a2c");
    rect(b.x + b.w - 3, b.y + 2, 1, 1, "#8a6a2c");
    rect(b.x + 2, b.y + b.h - 3, 1, 1, "#8a6a2c");
    rect(b.x + b.w - 3, b.y + b.h - 3, 1, 1, "#8a6a2c");

    if (lit) {
      ctx.strokeStyle = "#e8c66a";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx(b.x) - 3, sy(b.y) - 3, Math.round(b.w * SCALE) + 6, Math.round(b.h * SCALE) + 6);
    }
  }

  function drawGuide(r) {
    if (!guideSprites.length) {
      for (let i = 0; i < 4; i++) guideSprites.push(S7.people.makePerson(9000 + i * 17, "staff"));
    }
    const s = guideSprites[Math.abs(Math.floor(r.x / 40)) % guideSprites.length];
    const gx = r.x + 58;   /* clear of the intro board */
    if (gx < camX - 30 || gx > camX + VIEW_W + 30) return;
    const py = syR(FLOOR_Y + 18) - s.h * PERSON;
    ctx.drawImage(s.stand, sx(gx) - Math.round(s.w * PERSON / 2), py, s.w * PERSON, s.h * PERSON);
    /* lanyard badge */
    rect(gx - 1, FLOOR_Y - 4, 3, 4, "#c79a42");
  }

  /* Full gift shop room — a proper museum retail bay, not three brown shelves. */
  function drawGiftShop(r) {
    const x0 = r.x, x1 = r.x + r.width, w = r.width;
    const lvl = r.shop || 1;
    const kx = r.serviceX || (x0 + w * 0.55);

    /* Cream retail paint over the gallery beige */
    ctx.globalAlpha = 0.16;
    rect(x0, WALL_TOP, w, FLOOR_Y - WALL_TOP, "#7a5a38");
    ctx.globalAlpha = 0.08;
    rect(x0, WALL_TOP, w, 28, "#c4a86a");
    ctx.globalAlpha = 1;

    /* Runner carpet down the aisle */
    const runW = Math.min(56, w - 40);
    rect(x0 + (w - runW) / 2, FLOOR_Y + 2, runW, V.H - FLOOR_Y - 8, "#5a2830");
    rect(x0 + (w - runW) / 2, FLOOR_Y + 2, runW, 1, "#7a3a42");
    for (let y = FLOOR_Y + 10; y < V.H - 10; y += 6)
      rect(x0 + (w - runW) / 2 + 2, y, runW - 4, 1, "#4a2028");

    /* Hanging shop sign */
    const sx0 = x0 + w / 2 - 36;
    rect(sx0 + 8, 28, 2, 10, "#3a3426");
    rect(sx0 + 62, 28, 2, 10, "#3a3426");
    rect(sx0, 36, 72, 18, "#1a120c");
    rect(sx0, 36, 72, 2, "#c79a42");
    rect(sx0, 52, 72, 1, "#5a4a30");
    rect(sx0 + 2, 38, 68, 12, "#2a1c12");
    /* Gold rule lines — room plaque carries the name, so no second title here */
    rect(sx0 + 10, 42, 52, 2, "#c79a42");
    rect(sx0 + 16, 46, 40, 1, "#8a6a2c");

    /* Pendant lamps with warm pools */
    for (const lx of [x0 + 40, x0 + w / 2, x1 - 48]) {
      if (lx < x0 + 20 || lx > x1 - 16) continue;
      rect(lx - 1, 30, 2, 8, "#3a3426");
      rect(lx - 5, 38, 10, 4, "#4a3f28");
      rect(lx - 4, 41, 8, 2, "#ffe6ad");
      const g = ctx.createRadialGradient(sx(lx), syR(70), 2, sx(lx), syR(70), 36);
      g.addColorStop(0, "rgba(255,220,150,0.14)");
      g.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx(lx) - 40, syR(50), 80, 60);
    }

    /* Framed poster prints on the back wall */
    const posters = [
      { c: "#4a6b8a", a: "#c4d0e0" },
      { c: "#6b4a3a", a: "#d4b896" },
      { c: "#3a5a3a", a: "#a8c4a0" },
    ];
    for (let i = 0; i < Math.min(3, 1 + lvl); i++) {
      const px = x0 + 20 + i * 28;
      if (px > kx - 50) break;
      const p = posters[i % posters.length];
      rect(px, 48, 22, 28, "#2a2418");
      rect(px + 1, 49, 20, 26, p.c);
      rect(px + 3, 52, 14, 10, p.a);
      rect(px + 4, 64, 12, 2, "#e8e1d188");
      rect(px + 5, 68, 10, 2, "#e8e1d166");
    }

    /* Tall bookcase on the left — spines + boxes */
    const shelfX = x0 + 12;
    const shelfW = 38;
    rect(shelfX, 56, shelfW, FLOOR_Y - 56, "#3a3020");
    rect(shelfX, 56, shelfW, 2, "#5a4a30");
    rect(shelfX + shelfW - 2, 58, 2, FLOOR_Y - 58, "#2a2418");
    const spineCols = ["#6b3a2a", "#2a4a6b", "#4a6b3a", "#6b5a2a", "#4a3a5a", "#8a4a3a", "#3a5a5a"];
    for (let row = 0; row < 4; row++) {
      const y = 68 + row * 11;
      rect(shelfX + 2, y, shelfW - 4, 2, "#4a3f28");
      let bx = shelfX + 3;
      for (let i = 0; i < 7; i++) {
        const bw = 3 + (i + row + lvl) % 3;
        if (bx + bw > shelfX + shelfW - 3) break;
        rect(bx, y - 8, bw, 8, spineCols[(i + row * 3) % spineCols.length]);
        if (i % 3 === 0) rect(bx, y - 7, bw, 1, "#e8e1d144");
        bx += bw + 1;
      }
    }
    /* Mug shelf under the books */
    rect(shelfX + 4, FLOOR_Y - 14, 8, 8, "#e8e1d1");
    rect(shelfX + 5, FLOOR_Y - 16, 6, 3, "#e8e1d1");
    rect(shelfX + 14, FLOOR_Y - 14, 8, 8, "#c79a42");
    rect(shelfX + 15, FLOOR_Y - 16, 6, 3, "#c79a42");
    if (lvl >= 2) {
      rect(shelfX + 24, FLOOR_Y - 12, 10, 6, "#6b5a8a");
      rect(shelfX + 25, FLOOR_Y - 11, 8, 2, "#e8e1d1");
    }

    /* Right-hand display cabinet with glass doors */
    const cabX = x1 - 44;
    rect(cabX, 52, 32, FLOOR_Y - 52, "#3a3020");
    rect(cabX, 52, 32, 2, "#5a4a30");
    ctx.globalAlpha = 0.18;
    rect(cabX + 2, 56, 28, FLOOR_Y - 60, "#9dc0cd");
    ctx.globalAlpha = 1;
    rect(cabX + 15, 56, 1, FLOOR_Y - 60, "#5a4e35");
    rect(cabX + 2, 56, 1, FLOOR_Y - 60, "#6a5c42");
    rect(cabX + 29, 56, 1, FLOOR_Y - 60, "#6a5c42");
    /* Stock inside the glass */
    for (let row = 0; row < 3; row++) {
      const y = 66 + row * 14;
      rect(cabX + 4, y, 10, 8, row % 2 ? "#b5904a" : "#6b5a8a");
      rect(cabX + 16, y, 10, 8, row % 2 ? "#4a6b45" : "#c79a42");
      rect(cabX + 5, y + 1, 3, 2, "#e8e1d1");
      rect(cabX + 17, y + 1, 3, 2, "#e8e1d1");
    }

    /* Postcard spinner — proper carousel, not a brown block */
    const spinX = x0 + 58;
    rect(spinX + 6, 100, 3, 28, "#3a3426");
    rect(spinX + 4, 126, 7, 3, "#2a2418");
    for (let a = 0; a < 6; a++) {
      const ox = ((a % 3) - 1) * 5;
      const oy = Math.floor(a / 3) * 10;
      rect(spinX + 2 + ox, 102 + oy, 10, 8, a % 2 ? "#d4c4a0" : "#e8e1d1");
      rect(spinX + 3 + ox, 103 + oy, 8, 5, a % 3 === 0 ? "#6b8aaa" : a % 3 === 1 ? "#8a6a4a" : "#5a7a5a");
    }
    rect(spinX + 5, 98, 5, 3, "#c79a42");

    /* Soft-toy / kids bin once stocked */
    if (lvl >= 2) {
      const bx = spinX + 22;
      rect(bx, 118, 20, 14, "#4a3f28");
      rect(bx, 118, 20, 2, "#6b5a3a");
      rect(bx + 2, 112, 7, 8, "#c79a42");
      rect(bx + 3, 111, 2, 2, "#2a2418");
      rect(bx + 6, 111, 2, 2, "#2a2418");
      rect(bx + 10, 114, 6, 6, "#6b5a8a");
      rect(bx + 11, 113, 2, 2, "#2a2418");
      if (lvl >= 4) rect(bx + 14, 116, 5, 5, "#4a6b45");
    }

    /* Centre island table — folded scarves / guidebooks */
    if (w > 160) {
      const ix = x0 + w * 0.38;
      rect(ix - 18, 118, 36, 4, "#6d5b3c");
      rect(ix - 18, 118, 36, 1, "#87724a");
      rect(ix - 16, 122, 4, 10, "#4a3f28");
      rect(ix + 12, 122, 4, 10, "#4a3f28");
      rect(ix - 14, 112, 12, 6, "#6b3a4a");
      rect(ix - 12, 110, 10, 3, "#8a4a5a");
      rect(ix + 2, 114, 10, 4, "#3a5a6b");
      rect(ix + 4, 112, 8, 3, "#4a6a7b");
      if (lvl >= 3) {
        rect(ix - 6, 108, 8, 10, "#e8e1d1");
        rect(ix - 5, 109, 6, 4, "#6b4a3a");
      }
    }

    /* Sales counter with glass top case of jewellery / pins */
    rect(kx - 32, 98, 64, 5, "#6d5b3c");
    rect(kx - 32, 98, 64, 2, "#87724a");
    rect(kx - 30, 103, 60, 24, "#4f4229");
    rect(kx - 30, 103, 60, 1, "#2f2718");
    /* glass jewellery case on the counter */
    rect(kx - 28, 88, 30, 10, "#2a2418");
    ctx.globalAlpha = 0.22;
    rect(kx - 27, 89, 28, 8, "#9dc0cd");
    ctx.globalAlpha = 1;
    rect(kx - 25, 91, 4, 3, "#c79a42");
    rect(kx - 18, 92, 3, 2, "#e8e1d1");
    rect(kx - 12, 91, 4, 3, "#8a6a2c");
    rect(kx - 26, 88, 26, 1, "#6a5c42");
    /* till */
    rect(kx + 8, 90, 14, 8, "#2a2a33");
    rect(kx + 10, 92, 10, 3, "#4e9d4e");
    rect(kx + 11, 91, 3, 1, "#6ece6e");
    /* guidebooks by the till */
    for (let i = 0; i < 3; i++)
      rect(kx + 4 + i * 3, 94, 2, 5, i % 2 ? "#6b3a2a" : "#2a4a6b");
    /* paper bags */
    rect(kx - 30, 120, 9, 11, "#c4a86a");
    rect(kx - 28, 122, 5, 7, "#a8884a");
    rect(kx - 20, 122, 8, 10, "#c4a86a");
    if (lvl >= 3) rect(kx - 12, 124, 7, 8, "#d4b87a");

    /* Cashier */
    drawStaffAt(kx + 4, FLOOR_Y + 16, "shop");
    drawPlant(x1 - 18);
    if (lvl >= 3) drawPlant(x0 + 48);
  }

  function drawCafe(r) {
    const x0 = r.x, x1 = r.x + r.width, w = r.width;
    const lvl = r.cafe || 1;
    const kx = r.serviceX || (x0 + 48);
    /* Soft sage wash + pale dado */
    ctx.globalAlpha = 0.12;
    rect(x0, WALL_TOP, w, FLOOR_Y - WALL_TOP, "#4a6b45");
    ctx.globalAlpha = 0.06;
    rect(x0, 78, w, FLOOR_Y - 78, "#2a3a28");
    ctx.globalAlpha = 1;
    /* Runner */
    rect(x0 + 8, FLOOR_Y + 4, w - 16, 3, "#3a4a32");

    /* Pendant over the counter */
    rect(kx - 1, 30, 2, 12, "#3a3426");
    rect(kx - 6, 42, 12, 4, "#4a3f28");
    rect(kx - 5, 45, 10, 2, "#ffe6ad");
    const lg = ctx.createRadialGradient(sx(kx), syR(70), 2, sx(kx), syR(70), 40);
    lg.addColorStop(0, "rgba(255,230,173,0.16)");
    lg.addColorStop(1, "rgba(255,230,173,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(sx(kx) - 44, syR(48), 88, 56);

    /* Counter */
    rect(kx - 32, 96, 64, 6, "#6d5b3c");
    rect(kx - 32, 96, 64, 2, "#87724a");
    rect(kx - 30, 102, 60, 26, "#4f4229");
    rect(kx - 30, 102, 60, 1, "#2f2718");
    /* Coffee machine + cups + cake */
    rect(kx - 20, 84, 14, 12, "#2a2a33");
    rect(kx - 18, 86, 10, 5, "#4e9d4e");
    rect(kx - 16, 82, 6, 3, "#3a3a44");
    for (let i = 0; i < 4; i++)
      rect(kx + 2 + i * 6, 90, 4, 5, i % 2 ? "#e8e1d1" : "#c79a42");
    rect(kx - 6, 86, 10, 8, "#e8e1d1");
    rect(kx - 4, 84, 6, 2, "#c79a42");
    rect(kx - 3, 88, 4, 3, "#6b3a2a");
    /* Steam */
    ctx.globalAlpha = 0.28;
    rect(kx - 15, 78, 2, 5, "#e8e1d1");
    rect(kx - 11, 76, 2, 6, "#e8e1d1");
    ctx.globalAlpha = 1;

    /* Tables with place settings — match visitor seat layout */
    const nTables = 1 + Math.min(4, lvl);
    for (let i = 0; i < nTables; i++) {
      const tx = x0 + 100 + i * 36;
      if (tx > x1 - 20) break;
      rect(tx - 12, 126, 24, 3, "#6b5a3a");
      rect(tx - 12, 126, 24, 1, "#87724a");
      rect(tx - 1, 129, 2, 14, "#4a3f28");
      rect(tx - 10, 142, 3, 4, "#4a3f28");
      rect(tx + 7, 142, 3, 4, "#4a3f28");
      rect(tx - 4, 124, 3, 2, "#e8e1d1");
      rect(tx + 2, 124, 3, 2, "#c79a42");
      rect(tx - 14, 132, 3, 10, "#4a3f28");
      rect(tx + 11, 132, 3, 10, "#4a3f28");
    }

    /* Chalkboard menu with title rule */
    rect(x0 + 12, 42, 34, 44, "#1a2218");
    rect(x0 + 12, 42, 34, 2, "#4a6b45");
    rect(x0 + 16, 48, 20, 2, "#6a8b65");
    for (let i = 0; i < 6; i++) rect(x0 + 15, 54 + i * 4, 14 + (i % 3) * 5, 1, "#5a7a55");
    /* Pastry case once the café is established */
    if (lvl >= 2) {
      rect(kx + 18, 100, 22, 16, "#3a3426");
      ctx.globalAlpha = 0.2;
      rect(kx + 19, 101, 20, 10, "#9dc0cd");
      ctx.globalAlpha = 1;
      rect(kx + 21, 104, 5, 4, "#c79a42");
      rect(kx + 28, 105, 5, 3, "#e8e1d1");
      rect(kx + 22, 110, 6, 3, "#6b3a2a");
    }
    if (lvl >= 3) {
      rect(kx - 8, 40, 16, 5, "#2a2418");
      rect(kx - 6, 42, 12, 2, "#4e9d4e");
    }
    drawStaffAt(kx, FLOOR_Y + 16, "cafe");
    drawPlant(x1 - 22);
    if (lvl >= 2) drawPlant(x0 + 52);
  }

  function drawResearchRoom(r) {
    const x0 = r.x, x1 = r.x + r.width, w = r.width;
    /* Cool study wash */
    ctx.globalAlpha = 0.16;
    rect(x0, WALL_TOP, w, FLOOR_Y - WALL_TOP, "#2a3a4a");
    ctx.globalAlpha = 0.06;
    rect(x0, WALL_TOP, w, 20, "#4a6a8a");
    ctx.globalAlpha = 1;
    /* Long reading table */
    rect(x0 + 28, 118, w - 56, 5, "#5a4a30");
    rect(x0 + 28, 118, w - 56, 1, "#87724a");
    rect(x0 + 32, 123, 4, 14, "#4a3f28");
    rect(x1 - 48, 123, 4, 14, "#4a3f28");
    /* Open books + papers */
    for (let i = 0; i < 5; i++)
      rect(x0 + 48 + i * 14, 110, 10, 7, i % 2 ? "#6b5a8a" : "#c4b896");
    rect(x0 + 56, 108, 8, 2, "#e8e1d1");
    /* Desk lamp */
    const lx = x0 + w / 2;
    rect(lx - 4, 100, 8, 18, "#3a3a44");
    rect(lx - 6, 98, 12, 3, "#ffe6ad");
    rect(lx - 1, 92, 2, 6, "#4a3f28");
    const g = ctx.createRadialGradient(sx(lx), syR(98), 2, sx(lx), syR(98), 32);
    g.addColorStop(0, "rgba(255,230,173,0.2)");
    g.addColorStop(1, "rgba(255,230,173,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx(lx) - 36, syR(70), 72, 50);
    /* Tall bookcase */
    rect(x0 + 12, 44, 36, FLOOR_Y - 50, "#3a3020");
    rect(x0 + 12, 44, 36, 2, "#5a4a30");
    for (let row = 0; row < 5; row++) {
      const y = 56 + row * 11;
      rect(x0 + 14, y, 32, 2, "#4a3f28");
      for (let i = 0; i < 6; i++)
        rect(x0 + 15 + i * 5, y - 8, 4, 8, i % 3 === 0 ? "#4a6b45" : i % 3 === 1 ? "#6b5a8a" : "#8a6a2c");
    }
    /* Map pinned to the wall */
    rect(x1 - 50, 46, 30, 24, "#c4b896");
    rect(x1 - 48, 48, 26, 20, "#8a9a6a");
    rect(x1 - 44, 52, 10, 8, "#6a7a4a");
    rect(x1 - 32, 58, 8, 5, "#5a6a4a");
    /* Card catalogue */
    rect(x0 + 54, 100, 24, 16, "#5a4a30");
    for (let i = 0; i < 3; i++) {
      rect(x0 + 56, 102 + i * 4, 20, 3, "#4a3f28");
      rect(x0 + 64, 103 + i * 4, 2, 1, "#c79a42");
    }
    /* Reading chair */
    rect(x1 - 40, 128, 14, 3, "#4a3f28");
    rect(x1 - 38, 131, 3, 10, "#3a3426");
    rect(x1 - 30, 131, 3, 10, "#3a3426");
    rect(x1 - 40, 120, 3, 10, "#4a3f28");
    drawPlant(x1 - 18);
  }

  function drawDeepGallery(r) {
    const x0 = r.x, x1 = r.x + r.width;
    /* Low light wash — real exhibits are drawn later in the furniture pass. */
    ctx.globalAlpha = 0.28;
    rect(x0, WALL_TOP, r.width, FLOOR_Y - WALL_TOP, "#0a1018");
    ctx.globalAlpha = 1;
    drawCarpet(x0, r.width);
    /* Empty hall: short floor cases with pedestals (not roof-to-floor slabs). */
    if (!r.exhibits || !r.exhibits.length) {
      for (let i = 0; i < 3; i++) {
        const cx = x0 + 50 + i * 55;
        if (cx > x1 - 30) break;
        const cBot = 92, cTop = 58, pedH = FLOOR_Y + 6 - cBot;
        rect(cx - 12, cBot, 24, pedH, C.ped);
        rect(cx - 12, cBot, 24, 2, C.pedTop);
        rect(cx - 14, cTop, 28, cBot - cTop, "#1a1e24");
        rect(cx - 14, cTop, 28, 2, "#3a4a5a");
        ctx.globalAlpha = 0.18;
        rect(cx - 12, cTop + 3, 24, cBot - cTop - 6, "#6a90a8");
        ctx.globalAlpha = 1;
        rect(cx - 10, cTop + 8, 20, 14, "#12161c");
      }
    }
    rect(x0 + r.width / 2 - 40, 44, 80, 14, "#12161c");
    rect(x0 + r.width / 2 - 40, 44, 80, 1, "#4a6a8a");
  }

  function drawWingRoom(r) {
    const x0 = r.x, x1 = r.x + r.width;
    /* freshly opened: bare wall, a plant, a temporary sign */
    rect(x0 + 20, 48, 36, 28, "#3a3426");
    rect(x0 + 20, 48, 36, 1, "#665941");
    for (let i = 0; i < 5; i++) rect(x0 + 24, 54 + i * 4, 22 + (i % 2) * 6, 1, "#5d5138");
    drawPlant(x1 - 22);
    if (r.wingIndex === 0) drawPlant(x0 + 50);

  }

  /* Building mass for upper/basement so the cutaway is never a black hole.
     When `locked`, add construction clutter and a "not open" plate. When open,
     just the structure shows behind rooms that don't span the full width. */
  function drawStoreyShell(floor, totalW, kind, locked) {
    const x0 = Math.min(0, camX - 20);
    const w = Math.max(totalW + 40, camX + VIEW_W + 40) - x0;
    activeFloor = floor;
    roomLocal = true;

    if (kind === "basement") {
      for (let y = WALL_TOP; y < FLOOR_Y; y++) {
        const t = (y - WALL_TOP) / (FLOOR_Y - WALL_TOP);
        rect(x0, y, w, 1, t < 0.35 ? "#2a241c" : t < 0.7 ? "#221c16" : "#1a1610");
      }
      for (let y = WALL_TOP + 10; y < FLOOR_Y - 6; y += 7) {
        rect(x0, y, w, 1, "#14100c");
        const off = (Math.floor(y / 7) % 2) * 8;
        for (let px = x0 + off; px < x0 + w; px += 16)
          rect(px, y - 6, 1, 6, "#14100c");
      }
      for (let y = FLOOR_Y; y < V.H; y++)
        rect(x0, y, w, 1, (y + Math.floor(x0)) % 3 ? "#1c1812" : "#16120c");
      rect(x0, FLOOR_Y - 4, w, 4, "#2a2218");
      rect(x0, FLOOR_Y - 4, w, 1, "#3a3020");
      /* Building bones under the museum */
      for (let i = 0; i < 8; i++) {
        const cx = x0 + 50 + i * 70;
        if (cx > x0 + w - 30) break;
        rect(cx - 7, WALL_TOP + 8, 14, FLOOR_Y - WALL_TOP - 12, "#3a3228");
        rect(cx - 9, WALL_TOP + 6, 18, 5, "#4a4034");
        rect(cx - 8, FLOOR_Y - 8, 16, 6, "#2a2418");
      }
      rect(x0 + 20, WALL_TOP + 10, w - 40, 3, "#3a3426");
      rect(x0 + 20, WALL_TOP + 10, w - 40, 1, "#5a4e35");

      if (locked) {
        for (let i = 0; i < 8; i++) {
          const cx = x0 + 50 + i * 70;
          if (cx > x0 + w - 30) break;
          rect(cx + 14, FLOOR_Y - 18, 16, 14, "#4a3f28");
          rect(cx + 14, FLOOR_Y - 18, 16, 2, "#6b5a3a");
          rect(cx + 16, FLOOR_Y - 26, 12, 10, "#5a4a30");
          rect(cx + 17, FLOOR_Y - 24, 4, 2, "#3a3426");
          if (i % 2 === 0) {
            rect(cx - 28, FLOOR_Y - 14, 14, 10, "#3a3426");
            rect(cx - 26, FLOOR_Y - 12, 4, 3, "#c79a4233");
          }
        }
        const dx = x0 + Math.min(w * 0.45, 180);
        rect(dx - 16, 48, 32, FLOOR_Y - 48, "#12100c");
        rect(dx - 16, 48, 32, 2, "#4a4030");
        rect(dx - 14, 52, 28, FLOOR_Y - 56, "#1a160e");
        for (let y = 58; y < FLOOR_Y - 12; y += 8) rect(dx - 12, y, 24, 1, "#2a2418");
        rect(dx + 6, 82, 4, 5, "#8a6a2c");
        rect(dx + 7, 83, 2, 2, "#c79a42");
        for (let px = x0 + 40; px < x0 + w - 30; px += 48)
          rect(px, WALL_TOP + 12, 3, 10, "#3a3426");
        const tx = x0 + w / 2;
        rect(tx - 56, 32, 112, 18, "#0c0a06");
        rect(tx - 56, 32, 112, 2, "#8a6a2c");
        rect(tx - 56, 48, 112, 1, "#3a3020");
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "700 11px " + FONT_UI;
        fillTextShadow("BASEMENT — SEALED", sx(tx), syR(41), "#c4b896", "#000000aa");
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    } else if (kind === "upper") {
      for (let y = WALL_TOP; y < FLOOR_Y; y++) {
        const t = (y - WALL_TOP) / (FLOOR_Y - WALL_TOP);
        rect(x0, y, w, 1, t < 0.4 ? "#3a3428" : t < 0.75 ? "#322c22" : "#2a241c");
      }
      for (let y = FLOOR_Y; y < V.H; y++)
        rect(x0, y, w, 1, y % 2 ? "#2a2218" : "#241e14");
      ctx.globalAlpha = 0.35;
      for (let y = FLOOR_Y + 4; y < V.H; y += 5) rect(x0, y, w, 1, "#1a160e");
      ctx.globalAlpha = 1;
      rect(x0, FLOOR_Y - 5, w, 5, "#3a3226");

      if (locked) {
        for (let i = 0; i < 6; i++) {
          const wx = x0 + 40 + i * 85;
          if (wx > x0 + w - 50) break;
          rect(wx, 42, 36, 40, "#1a160d");
          rect(wx, 42, 36, 1, "#5a4e35");
          rect(wx + 2, 44, 32, 36, "#2a2418");
          rect(wx + 4, 48, 28, 3, "#4a3f28");
          rect(wx + 4, 60, 28, 3, "#4a3f28");
          rect(wx + 4, 72, 28, 3, "#4a3f28");
          rect(wx + 16, 46, 3, 32, "#4a3f28");
          rect(wx - 10, WALL_TOP + 4, 3, FLOOR_Y - WALL_TOP - 8, "#5a4e35");
          rect(wx + 40, WALL_TOP + 4, 3, FLOOR_Y - WALL_TOP - 8, "#5a4e35");
          rect(wx - 12, 70, 56, 2, "#6b5a3a");
        }
        for (let i = 0; i < 5; i++) {
          const px = x0 + 70 + i * 95;
          if (px > x0 + w - 40) break;
          rect(px - 12, 92, 28, 22, "#5a5448");
          rect(px - 14, 90, 32, 4, "#7a7468");
          rect(px - 10, 96, 24, 2, "#3a3426");
          ctx.globalAlpha = 0.25;
          rect(px - 12, 94, 1, 18, "#2a2418");
          rect(px + 14, 94, 1, 18, "#2a2418");
          ctx.globalAlpha = 1;
        }
        rect(x0 + 24, FLOOR_Y - 12, 8, 8, "#4a6b45");
        rect(x0 + 34, FLOOR_Y - 10, 7, 6, "#6b5a8a");
        rect(x0 + 22, FLOOR_Y - 14, 10, 2, "#3a3426");
        for (let s = 0; s < 6; s++) {
          rect(x0 + w - 50, 50 + s * 10, 14, 2, "#5a4e35");
          rect(x0 + w - 50, 50 + s * 10, 2, 10, "#4a3f28");
          rect(x0 + w - 38, 50 + s * 10, 2, 10, "#4a3f28");
        }
        const tx = x0 + w / 2;
        rect(tx - 62, 28, 124, 18, "#0c0a06");
        rect(tx - 62, 28, 124, 2, "#c79a42");
        rect(tx - 62, 44, 124, 1, "#3a3020");
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "700 11px " + FONT_UI;
        fillTextShadow("UPPER FLOOR — NOT OPEN", sx(tx), syR(37), "#e8c66a", "#000000aa");
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    } else {
      /* Ground mass: gallery walls so basement halls never sit under black void. */
      for (let y = WALL_TOP; y < FLOOR_Y; y++) {
        const t = (y - WALL_TOP) / (FLOOR_Y - WALL_TOP);
        rect(x0, y, w, 1, t < 0.16 ? C.wallTop : t < 0.46 ? C.wallHi : t < 0.82 ? C.wallLo : C.wallShade);
      }
      rect(x0, RAIL_Y, w, 2, C.rail);
      rect(x0, 78, w, 3, "#4a3f28");
      rect(x0, FLOOR_Y - 6, w, 6, C.skirt);
      for (let y = FLOOR_Y; y < V.H; y++) {
        const t = (y - FLOOR_Y) / (V.H - FLOOR_Y);
        rect(x0, y, w, 1, t < 0.18 ? C.floorFar : t < 0.55 ? C.floorLo : C.floorHi);
      }
      rect(x0, 0, w, WALL_TOP - 8, C.ceil);
      rect(x0, WALL_TOP - 8, w, 4, C.cove);
    }

    roomLocal = false;
  }

  /* Structural slab between storeys — the cutaway edge of the floor above. */
  function drawStoreySlab(floor) {
    const base = V.floorBase(floor);
    const y = base + V.H - 4;
    const x0 = Math.min(0, camX - 20);
    const w = Math.max((layoutCache ? layoutCache.total : VIEW_W) + 40, camX + VIEW_W + 40) - x0;
    ctx.fillStyle = "#1a160e";
    ctx.fillRect(sx(x0), sy(y), Math.round(w * SCALE), Math.round(10 * SCALE));
    ctx.fillStyle = "#2a2418";
    ctx.fillRect(sx(x0), sy(y), Math.round(w * SCALE), Math.round(2 * SCALE));
    ctx.fillStyle = "#0c0a06";
    ctx.fillRect(sx(x0), sy(y + 8), Math.round(w * SCALE), Math.round(2 * SCALE));
    /* joist tips */
    ctx.fillStyle = "#3a3226";
    for (let px = Math.ceil(x0 / 18) * 18; px < x0 + w; px += 18)
      ctx.fillRect(sx(px), sy(y + 2), Math.round(3 * SCALE), Math.round(5 * SCALE));
  }

  /* ---------- the entrance hall ---------------------------------------------
     Street doors, daylight, admissions desk. The gift shop is its own room. */
  function drawFoyer(r) {
    const dx = r.doorX;
    const tickets = fac ? fac.tickets : 0;
    const leaflets = fac ? fac.leaflet : 0;

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

    /* a rope line and a bin, because foyers are full of both */
    rect(kx - 40, 132, 1, 8, C.rope);
    rect(kx + 40, 132, 1, 8, C.rope);
    rect(kx - 40, 133, 80, 1, C.rope);
    drawPlant(r.width - 26);

  }

  function drawDoorway(x0) {
    /* a dark arch, with the next room implied beyond it */
    const DW = V.DOOR || 58;
    rect(x0, WALL_TOP - 6, DW, 6, "#191409");
    rect(x0, WALL_TOP, DW, FLOOR_Y - WALL_TOP, C.wallShade);
    const dx = x0 + 10, dw = DW - 20;
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
      rect(x0, y, DW, 1, t < 0.35 ? "#221c12" : "#2e2617");
    }
    rect(dx, FLOOR_Y - 4, dw, 4, "#241e14");
  }

  /* A soft cone from the track, plus the pool it throws on the floor.
     Lighting upgrades raise the pool and the cone together — the first few
     purchases are the difference between a shed and a museum. */
  /* Spotlight/cone take world Y. Pass floor base so basement lights sit on the
     right floor, not at ground-level coordinates. */
  function spotlight(wx, top, bottom, floorBase) {
    const base = floorBase || 0;
    const light = fac ? fac.lighting : 0;
    const poolA = 0.05 + Math.min(0.22, light * 0.018);
    const poolR = 36 + light * 2;
    const fy = base + FLOOR_Y;
    const pool = ctx.createRadialGradient(sx(wx), sy(fy + 14), 2, sx(wx), sy(fy + 14), poolR);
    pool.addColorStop(0, "rgba(255,226,166," + poolA.toFixed(3) + ")");
    pool.addColorStop(1, "rgba(255,222,150,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(sx(wx) - 46, sy(fy), 92, (V.H - FLOOR_Y) * SCALE);
    cone(wx, top, bottom, base);
  }

  function cone(wx, top, bottom, floorBase) {
    const base = floorBase || 0;
    const light = fac ? fac.lighting : 0;
    const a = 0.04 + Math.min(0.16, light * 0.014);
    const g = ctx.createLinearGradient(0, sy(base + WALL_TOP), 0, sy(bottom));
    g.addColorStop(0, "rgba(255,222,150," + a.toFixed(3) + ")");
    g.addColorStop(1, "rgba(255,222,150,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx(wx - 3), sy(base + WALL_TOP));
    ctx.lineTo(sx(wx + 3), sy(base + WALL_TOP));
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
    if (b.x + b.w < camX - 20 || b.x > camX + VIEW_W + 20) return;
    const art = artAt(e, b);
    const aw = Math.round(b.w * SCALE), ah = Math.round(b.h * SCALE);
    const ring = (selected && !selected.board && selected === e) ? "#e8c66a"
               : (hover && !hover.board && hover === e) ? "#c79a42" : null;
    const cases = fac ? fac.cases : 0;
    const plinths = fac ? fac.plinths : 0;
    /* exhibitBox returns world Y (with floor base). Pedestals must use the
       same world floor line — not bare FLOOR_Y — or basement cases stretch
       upward into the ceiling. */
    const base = b.base || 0;
    const floorW = base + FLOOR_Y;
    const railW = base + RAIL_Y;

    if (e.mount === "wall") {
      spotlight(e.x, base + 30, b.y + b.h + 8, base);
      if ((fac ? fac.lighting : 0) >= 2 || cases >= 2) {
        rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, cases >= 4 ? "#2a2418" : "#1a160d");
        rect(b.x - 2, b.y - 2, b.w + 4, 1, "#8a6a2c");
      }
      ctx.fillStyle = "#00000055";
      ctx.fillRect(sx(b.x) + 3, sy(b.y) + 4, aw, ah);
      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      lightArt(b, aw, ah);
      if (ring) outlineBox(b, ring);
      if (b.y > railW + 2) rect(e.x - 1, railW, 1, b.y - railW, "#5a4e35");
    } else if (e.mount === "plinth") {
      const pTop = b.plinthTop;
      const pH = Math.max(4, floorW + 8 - pTop);
      spotlight(e.x, base + 30, pTop, base);
      const pw = Math.max(14, Math.round(b.w * 0.78));
      if (plinths <= 0) {
        rect(e.x - pw / 2, pTop, pw, pH, "#5a4a30");
        rect(e.x - pw / 2, pTop, pw, 2, "#6b5a3a");
        for (let y = pTop + 4; y < floorW + 4; y += 5)
          rect(e.x - pw / 2 + 1, y, pw - 2, 1, "#4a3f28");
      } else {
        const body = plinths >= 4 ? "#6a6258" : C.plinth;
        const top = plinths >= 4 ? "#8a8274" : C.plinthTop;
        const shade = plinths >= 4 ? "#4a443c" : C.plinthShade;
        rect(e.x - pw / 2, pTop, pw, pH, body);
        rect(e.x - pw / 2, pTop, pw, 2, top);
        rect(e.x + pw / 2 - 5, pTop + 2, 5, Math.max(2, pH - 2), shade);
        if (plinths >= 6) {
          rect(e.x - pw / 2 - 1, pTop - 1, pw + 2, 1, "#a09a8a");
          rect(e.x - pw / 2, pTop + 3, pw, 1, "#00000022");
        }
      }
      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      lightArt(b, aw, ah);
      if (ring) outlineBox(b, ring);
      if (plinths >= 1) {
        const rw = Math.max(pw + 8, 26);
        const ropeCol = plinths >= 5 ? "#c79a42" : C.rope;
        rect(e.x - rw / 2, floorW + 14, 1, 6, ropeCol);
        rect(e.x + rw / 2, floorW + 14, 1, 6, ropeCol);
        rect(e.x - rw / 2, floorW + 15, rw, 1, ropeCol);
      }
    } else {
      /* Objects: open shelf until cases are bought, then a real vitrine. */
      const cw = Math.max(20, b.w + 10 + Math.min(6, cases));
      const pw = cw + 4;
      const glassTop = b.y - 7;
      const cBot = b.caseBottom;
      const pedH = Math.max(4, floorW + 8 - cBot);
      spotlight(e.x, base + 30, glassTop + 6, base);

      rect(e.x - pw / 2, cBot, pw, pedH, C.ped);
      rect(e.x - pw / 2, cBot, pw, 2, C.pedTop);
      rect(e.x + pw / 2 - 4, cBot + 2, 4, Math.max(2, pedH - 2), C.pedShade);
      rect(e.x - pw / 2, floorW + 5, pw, 3, C.pedShade);

      ctx.drawImage(art, sx(b.x), sy(b.y), aw, ah);
      lightArt(b, aw, ah);

      if (cases > 0) {
        const glassA = 0.10 + Math.min(0.16, cases * 0.008);
        const streakA = 0.22 + Math.min(0.25, cases * 0.015);
        const glassH = Math.max(4, cBot - glassTop);
        ctx.globalAlpha = glassA;
        rect(e.x - cw / 2, glassTop, cw, glassH, C.caseGlass);
        ctx.globalAlpha = streakA;
        rect(e.x - cw / 2 + 4, glassTop + 2, 2, Math.max(2, glassH - 4), "#ffffff");
        ctx.globalAlpha = 1;
        const frame = cases >= 6 ? "#1a160d" : C.caseFrame;
        const edge = cases >= 6 ? "#6a5c42" : C.caseEdge;
        rect(e.x - cw / 2, glassTop, 1, glassH, edge);
        rect(e.x + cw / 2, glassTop, 1, glassH, edge);
        rect(e.x - cw / 2, glassTop, cw, cases >= 3 ? 3 : 2, frame);
        rect(e.x - cw / 2, glassTop + 1, cw, 1, edge);
        if (cases >= 8) {
          rect(e.x - cw / 2, cBot - 2, cw, 2, frame);
          rect(e.x - 2, glassTop - 3, 4, 2, "#ffe6ad");
        }
        if (ring) outlineBox({ x: e.x - cw / 2, y: glassTop, w: cw, h: glassH }, ring);
      } else if (ring) {
        outlineBox(b, ring);
      }
    }
  }

  /* Somewhere to sit. Slatted, because a solid block reads as a plinth. */
  function drawBench(bn) {
    if (bn.x < camX - 40 || bn.x > camX + VIEW_W + 40) return;
    const w = 34;
    rect(bn.x - w / 2, 140, w, 3, "#6b5a3a");
    rect(bn.x - w / 2, 140, w, 1, "#87724a");
    rect(bn.x - w / 2, 144, w, 2, "#5a4c30");
    rect(bn.x - w / 2 + 2, 146, 3, 6, "#4a3f28");
    rect(bn.x + w / 2 - 5, 146, 3, 6, "#4a3f28");
    ctx.fillStyle = C.shadow;
    ctx.fillRect(sx(bn.x - w / 2), syR(152), Math.round(w * SCALE), 3);
  }

  function drawAgent(a) {
    const y = V.feetY(a);
    if (a.x < camX - 24 || a.x > camX + VIEW_W + 24) return;
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
    if (x < camX - 30 || x > camX + VIEW_W + 30) return;
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
     No under-piece title plates — they clutter the floor. Click a work for the
     caption card. Room plaques and boards still use crisp text over pixel art. */

  const FONT_UI = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

  function fillTextShadow(text, x, y, fill, shadow) {
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.fillText(text, x + 1, y + 1);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  /* Room name over the doorway — a real wall plaque, not floating type. */
  function drawRoomPlaque(r) {
    /* Stairs carry their own UP/DOWN plate. */
    if (r.stairs) return;
    const name = (r.era && r.era.name) ? r.era.name : "";
    const period = (r.era && r.era.period) ? r.era.period : "";
    if (!name) return;
    const x = sx(r.x + r.width / 2);
    if (x < -200 || x > CW + 200) return;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 12px " + FONT_UI;
    const nameW = ctx.measureText(name.toUpperCase()).width;
    ctx.font = "11px " + FONT_UI;
    const perW = period ? ctx.measureText(period).width : 0;
    const tw = Math.ceil(Math.max(nameW, perW) + 28);
    const th = period ? 34 : 22;
    const y = syR(PLAQUE_Y) + 2;
    const px = Math.round(x - tw / 2);
    const py = Math.round(y - th / 2);

    /* Plaque body */
    ctx.fillStyle = "#0c0a06f0";
    ctx.fillRect(px - 1, py - 1, tw + 2, th + 2);
    ctx.fillStyle = "#1a160d";
    ctx.fillRect(px, py, tw, th);
    ctx.fillStyle = "#c79a42";
    ctx.fillRect(px, py, tw, 2);
    ctx.fillStyle = "#3a3120";
    ctx.fillRect(px, py + th - 1, tw, 1);
    /* corner nicks */
    ctx.fillStyle = "#5a4e35";
    ctx.fillRect(px + 2, py + 4, 2, 2);
    ctx.fillRect(px + tw - 4, py + 4, 2, 2);

    ctx.font = "600 12px " + FONT_UI;
    fillTextShadow(name.toUpperCase(), x, period ? y - 6 : y + 1, "#e8c66a", "#00000066");
    if (period) {
      ctx.font = "11px " + FONT_UI;
      fillTextShadow(period, x, y + 9, "#c4b896", null);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /* Short label on the intro board itself, crisp over the pixel art. */
  function drawBoardLabel(r) {
    if (!roomHasBoard(r)) return;
    const b = boardBox(r);
    const cx = sx(b.x + b.w / 2);
    const top = syR(b.y);
    const bot = syR(b.y + b.h);
    if (cx < -40 || cx > CW + 40) return;

    let name = (r.era.name || "")
      .replace(/ horizon$/i, "")
      .replace(/ fill$/i, "")
      .replace(/ deposit$/i, "")
      .replace(/^the /i, "");
    /* Prefer title case on the board — all-caps at this size turns to noise. */
    if (name.length > 14) name = name.slice(0, 13) + "…";

    const n = r.exhibits.length;
    const sub = n + (n === 1 ? " find" : " finds");
    const period = (r.era.period || "").replace(/\s*·.*$/, "");
    const shortPer = period.length > 16 ? period.slice(0, 14) + "…" : period;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    /* Title */
    ctx.font = "600 11px " + FONT_UI;
    fillTextShadow(name, cx, top + 22, "#e8c66a", "#000000aa");
    /* Period line */
    if (shortPer) {
      ctx.font = "10px " + FONT_UI;
      fillTextShadow(shortPer, cx, top + 38, "#c4b896", null);
    }
    /* Count */
    ctx.font = "10px " + FONT_UI;
    fillTextShadow(sub, cx, bot - 14, "#d8cfb6", null);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /* The card beside the piece — short, plain, the way a real gallery writes. */
  function drawWallLabel(e) {
    const b = exhibitBox(e);
    const a = e.a;
    const cu = S7.cultures.byId[a.cultureId];
    const from = cu ? cu.name : "Unknown source";
    const period = cu && cu.period && cu.period !== "—" ? cu.period : "";
    const lines = [
      { text: a.name, font: "600 13px " + FONT_UI, color: "#f2ebe0" },
      { text: period ? from + " · " + period : from, font: "12px " + FONT_UI, color: "#e0b85a" },
      { text: S7.artifacts.materialLabel(a.material) + " · " + a.condition.n,
        font: "12px " + FONT_UI, color: "#cfc6b0" },
      { text: "Item " + a.no + " · found at " + a.depth.toFixed(1) + " m",
        font: "11px " + FONT_MONO, color: "#a99f88" },
    ];
    let maxW = 0;
    for (const l of lines) {
      ctx.font = l.font;
      maxW = Math.max(maxW, ctx.measureText(l.text).width);
    }
    const padX = 12, padY = 10, lineH = 16;
    const w = Math.ceil(maxW) + padX * 2;
    const h = lines.length * lineH + padY * 2 - 2;
    /* to the right of the piece unless that runs off the canvas */
    let x = sx(b.x + b.w) + 12;
    if (x + w > CW - 6) x = sx(b.x) - w - 12;
    x = Math.max(6, Math.min(CW - w - 6, x));
    const y = Math.max(6, Math.min(CH - h - 6, sy(b.y) + 4));

    ctx.fillStyle = "#0c0a08f5";
    ctx.strokeStyle = "#c79a42";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 4); else ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
    /* Gold top rule */
    ctx.fillStyle = "#e8c66a";
    ctx.fillRect(x + 1, y + 1, w - 2, 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    lines.forEach((l, i) => {
      ctx.font = l.font;
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, x + padX, y + padY + 12 + i * lineH);
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
    ctx.font = "600 13px " + FONT_UI;
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

    ctx.font = "12px " + FONT_UI;
    /* wrap to a sensible width */
    const words = b.text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > 148 && line) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);

    const wide = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bw = Math.min(CW - 16, Math.ceil(wide) + 18), bh = lines.length * 15 + 12;
    const bx = Math.max(4, Math.min(CW - bw - 4, cx - bw / 2));
    const by = placeBubble(bx, Math.max(4, cy - bh), bw, bh);

    const fade = Math.min(1, b.t / 0.6) * Math.min(1, (b.life - b.t) / 0.18 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));

    ctx.fillStyle = "#0c0a08f5";
    ctx.strokeStyle = "#6a5a38";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 5);
    else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.stroke();
    /* tail, only when the bubble is still directly over its speaker */
    if (Math.abs(cx - (bx + bw / 2)) < bw / 2 - 6) {
      ctx.beginPath();
      ctx.moveTo(cx - 5, by + bh - 1);
      ctx.lineTo(cx + 5, by + bh - 1);
      ctx.lineTo(cx, by + bh + 7);
      ctx.closePath();
      ctx.fillStyle = "#0c0a08f5";
      ctx.fill();
    }

    ctx.fillStyle = "#f0e8d4";
    ctx.textBaseline = "alphabetic";
    lines.forEach((l, i) => ctx.fillText(l, bx + 9, by + 16 + i * 15));
    ctx.globalAlpha = 1;
  }

  /* ---------- the frame -------------------------------------------------------- */

  function draw(S, crowd, dt) {
    resizeCanvas();
    fac = facilities(S);
    const L = layoutCache = V.getLayout(S);
    camX = clampCamX(camX);
    camY = clampCamY(camY);
    camTX = clampCamX(camTX);
    camTY = clampCamY(camTY);

    if (!dragging) {
      camX += (camTX - camX) * Math.min(1, dt * 8);
      camY += (camTY - camY) * Math.min(1, dt * 8);
    }

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C.voidbg;
    ctx.fillRect(0, 0, CW, CH);

    /* Building envelope: always upper + ground + basement so the cutaway
       never leaves a black hole under (or over) the open floors. */
    const minF = L.minFloor !== undefined ? L.minFloor : 0;
    const maxF = L.maxFloor !== undefined ? L.maxFloor : 0;
    const shellMin = L.shellMin !== undefined ? L.shellMin : Math.min(minF, -1);
    const shellMax = L.shellMax !== undefined ? L.shellMax : Math.max(maxF, 1);
    const totalW = L.total || VIEW_W;

    for (let f = shellMax; f >= shellMin; f--) {
      const by = V.floorBase(f);
      ctx.fillStyle = f === 0 ? "#0c0a07" : f > 0 ? "#0e0c08" : "#0a0806";
      ctx.fillRect(0, sy(by), CW, Math.round(FLOOR_PITCH * SCALE));
    }

    /* Storey shells first (behind open rooms). Every storey gets structure so
       gaps (e.g. above a basement hall that sits past the ground run) aren't
       black void. Locked floors get construction clutter. */
    drawStoreyShell(1, totalW, "upper", !!(L.lockedUpper || maxF < 1));
    drawStoreyShell(0, totalW, "ground", false);
    drawStoreyShell(-1, totalW, "basement", !!(L.lockedBasement || minF > -1));

    /* Structural slabs between every storey of the envelope. */
    for (let f = shellMax; f > shellMin; f--)
      drawStoreySlab(f);

    /* Rooms grouped by floor so doorways only join same-floor neighbours. */
    const byFloor = {};
    for (const r of L.rooms) {
      const f = r.floor != null ? r.floor : 0;
      (byFloor[f] = byFloor[f] || []).push(r);
    }
    for (const f of Object.keys(byFloor)) {
      const list = byFloor[f].slice().sort((a, b) => a.x - b.x);
      for (let i = 0; i < list.length; i++) {
        drawRoom(list[i]);
        if (i < list.length - 1) {
          const a = list[i], b = list[i + 1];
          if (Math.abs((a.x + a.width) - b.x) < (V.DOOR || 58) + 8) {
            activeFloor = a.floor != null ? a.floor : 0;
            roomLocal = true;
            drawDoorway(a.x + a.width);
            roomLocal = false;
          }
        }
      }
    }

    /* Floor furniture + people, depth-sorted in world Y. */
    roomLocal = false;
    const items = [];
    for (const e of L.exhibits) {
      const base = V.floorBase(e.floor || 0);
      const ey = base + (e.mount === "wall" ? 40 : FLOOR_Y + 8);
      items.push({ y: ey, fn: () => { drawExhibit(e, S); } });
    }
    for (const bn of L.benches) {
      const base = V.floorBase(bn.floor || (bn.room && bn.room.floor) || 0);
      items.push({ y: base + V.BENCH_Y - 4, fn: () => {
        activeFloor = bn.floor || (bn.room && bn.room.floor) || 0;
        roomLocal = true;
        drawBench(bn);
        roomLocal = false;
      } });
    }
    for (const r of L.rooms) {
      if (r.foyer) {
        items.push({ y: V.floorBase(0) + 96, fn: () => {
          activeFloor = 0; roomLocal = true; drawDeskStaff(r); roomLocal = false;
        } });
      }
    }
    for (const a of crowd.agents)
      items.push({ y: V.feetY(a), fn: () => drawAgent(a) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.fn();

    for (const r of L.rooms) {
      activeFloor = r.floor || 0;
      roomLocal = true;
      drawRoomPlaque(r);
      drawBoardLabel(r);
      roomLocal = false;
    }
    for (const a of crowd.agents) if (a.paid) drawPaidFloater(a);
    if (selected && !selected.board && L.exhibits.indexOf(selected) >= 0) drawWallLabel(selected);
    bubbleRects = [];
    for (const a of crowd.agents) drawBubble(a);

    /* Soft vignette on all edges */
    const gx = ctx.createLinearGradient(0, 0, CW, 0);
    gx.addColorStop(0, "#0a0806");
    gx.addColorStop(0.05, "#0a080600");
    gx.addColorStop(0.95, "#0a080600");
    gx.addColorStop(1, "#0a0806");
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, CW, CH);
    const gy = ctx.createLinearGradient(0, 0, 0, CH);
    gy.addColorStop(0, "#0a0806aa");
    gy.addColorStop(0.08, "#0a080600");
    gy.addColorStop(0.92, "#0a080600");
    gy.addColorStop(1, "#0a0806aa");
    ctx.fillStyle = gy;
    ctx.fillRect(0, 0, CW, CH);

    /* Floor label in corner — which storey is under the camera focus. */
    if (shellMax > shellMin) {
      const fl = floorAtCamera();
      const open = L.rooms.some((r) => (r.floor != null ? r.floor : 0) === fl);
      let label = V.floorLabel ? V.floorLabel(fl) : ("Floor " + fl);
      if (!open) label += " · sealed";
      ctx.font = "600 11px " + FONT_UI;
      const tw = Math.ceil(ctx.measureText(label).width) + 16;
      ctx.fillStyle = "#0c0a08cc";
      ctx.fillRect(10, CH - 28, tw, 18);
      ctx.fillStyle = open ? "#c79a42" : "#8a7a5a";
      ctx.fillText(label, 18, CH - 15);
    }

    if (!L.exhibits.length) {
      ctx.textAlign = "center";
      ctx.font = "600 14px " + FONT_UI;
      ctx.fillStyle = "#c4bba6";
      ctx.fillText("Nothing on display. The doors are not open.", CW / 2, CH / 2);
      ctx.font = "13px " + FONT_UI;
      ctx.fillStyle = "#9a907c";
      ctx.fillText("Lift something and put it on show.", CW / 2, CH / 2 + 20);
      ctx.textAlign = "left";
    }
  }

  /* ---------- camera controls --------------------------------------------------- */

  function rooms() { return layoutCache ? layoutCache.rooms : []; }

  /* Put a storey's wall mid-height in the upper half of the view so the floor
     below doesn't steal "current floor" detection on a tall canvas. */
  function focusFloorY(f) {
    const base = V.floorBase(f);
    const focus = base + FLOOR_Y * 0.42;
    return clampCamY(focus - VIEW_H * 0.36);
  }

  function floorAtCamera() {
    if (!layoutCache) return 0;
    const midY = camY + VIEW_H * 0.36;
    const shellMin = layoutCache.shellMin !== undefined ? layoutCache.shellMin
      : (layoutCache.minFloor !== undefined ? layoutCache.minFloor : 0);
    const shellMax = layoutCache.shellMax !== undefined ? layoutCache.shellMax
      : (layoutCache.maxFloor !== undefined ? layoutCache.maxFloor : 0);
    let fl = 0, best = 1e9;
    for (let f = shellMin; f <= shellMax; f++) {
      const d = Math.abs(midY - (V.floorBase(f) + FLOOR_Y * 0.45));
      if (d < best) { best = d; fl = f; }
    }
    return fl;
  }

  function currentRoom() {
    if (!layoutCache) return null;
    return V.roomAt(layoutCache, camX + VIEW_W / 2, floorAtCamera());
  }

  function goToRoom(i) {
    const rs = rooms();
    if (!rs.length) return;
    const r = rs[Math.max(0, Math.min(rs.length - 1, i))];
    camTX = clampCamX(r.x + r.width / 2 - VIEW_W / 2);
    camTY = focusFloorY(r.floor != null ? r.floor : 0);
  }

  function goToFloor(f) {
    camTY = focusFloorY(f);
    /* Pan to the first real room on this storey — otherwise you land over the
       empty foundation under the foyer and think the floor is blank. */
    const rs = rooms().filter((r) => (r.floor != null ? r.floor : 0) === f);
    const prefer = rs.find((r) => r.exhibits && r.exhibits.length) ||
                   rs.find((r) => !r.stairs && !r.foyer) ||
                   rs.find((r) => !r.stairs) ||
                   rs[0];
    if (prefer) camTX = clampCamX(prefer.x + prefer.width / 2 - VIEW_W / 2);
  }

  function nudge(dir) {
    /* Horizontal nudge on the current storey. */
    camTX = clampCamX(camTX + dir * 120);
  }

  const invalidate = () => V.invalidate();

  S7.galleryView = {
    init, draw, rooms, currentRoom, goToRoom, goToFloor, nudge, invalidate,
    setArrange, isArranging, isDragging, probe, clearSelection, resizeCanvas,
    get CW() { return CW; },
    get CH() { return CH; },
    get VIEW_W() { return VIEW_W; },
    get VIEW_H() { return VIEW_H; },
    SCALE, get VIEW() { return VIEW_W; },
  };
})(window.S7 = window.S7 || {});
