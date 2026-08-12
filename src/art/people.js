/* ============================================================================
   VISITORS

   Pixel people, generated from a seed like everything else and baked once into
   a set of named poses, so the gallery renderer only ever does drawImage.

   24 pixels tall on a 18-wide frame. Proportions carry the read at this size,
   not detail: shoulders are 8 wide and the head is 5, because a head as wide
   as the body is a column, not a person. The walk is six frames — contact,
   down, pass, contact, down, pass — which is the shortest cycle that still
   looks like weight moving rather than legs scissoring.
   ============================================================================ */
(function (S7) {
  "use strict";

  const W = 18, H = 24;
  const GROUND = H - 1;

  /* Palettes, not arbitrary RGB, so a room full of strangers still looks like
     it was designed by one person. */
  const SKIN = ["#f2cda8", "#e3b085", "#cb9063", "#ab6e47", "#834f33", "#5f3a25", "#f8e0c4"];
  const SKIN_SHADE = { "#f2cda8": "#d8ab84", "#e3b085": "#c48f66", "#cb9063": "#a97148",
                       "#ab6e47": "#8a5334", "#834f33": "#653a24", "#5f3a25": "#472a1a",
                       "#f8e0c4": "#dcbf9e" };
  const HAIR = ["#2b1d13", "#4a2f1c", "#7a4a22", "#b07a35", "#d8c08a", "#8a8a8a", "#d6d6d6",
                "#1a1a1a", "#5c3a5c", "#7a2f2f", "#2f4a6b", "#3f2a1c"];
  const TOP = ["#8f3d35", "#3d5a7a", "#4a6b45", "#6b5a3a", "#7a4a6b", "#2f3a4a", "#ad7439",
               "#5a5a6b", "#8d8d98", "#3a6b6b", "#bb954c", "#6b3a3a", "#a84f4f", "#46628a"];
  const BOTTOM = ["#2f3440", "#3a3a3a", "#4a4235", "#25303d", "#5a4a3a", "#3d3d4a", "#6b6355"];
  const SHOE = ["#191919", "#2a1f16", "#33333a"];
  const BAG = ["#8a5a2a", "#3a4a5a", "#6b2f2f", "#4a4a3a", "#2f3f2f"];

  const TYPES = [
    { id: "adult",   w: 100, speed: 1.00 },
    { id: "child",   w: 26,  speed: 1.30, small: true },
    { id: "tourist", w: 34,  speed: 0.85, camera: true },
    { id: "scholar", w: 18,  speed: 0.72, notebook: true, dwell: 2.2 },
    { id: "school",  w: 22,  speed: 1.22, small: true, group: true },
    { id: "elder",   w: 20,  speed: 0.60, stick: true, dwell: 1.6 },
    { id: "staff",   w: 10,  speed: 0.90, staff: true, dwell: 0.6 },
  ];
  const typeById = {};
  for (const t of TYPES) typeById[t.id] = t;

  /* ---------- drawing helpers --------------------------------------------- */

  function frameCanvas() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    return c;
  }

  /* Six-frame walk. `lift` raises the whole body, `fore`/`rear` are the two
     legs' horizontal offsets at the ankle, `arm` swings opposite the legs. */
  const GAIT = [
    { lift: 0, fore: 2, rear: -2, arm: -1 },   /* contact */
    { lift: 0, fore: 1, rear: -1, arm: -1 },   /* down */
    { lift: 1, fore: 0, rear: 0,  arm: 0 },    /* pass */
    { lift: 0, fore: -2, rear: 2, arm: 1 },    /* contact, other foot */
    { lift: 0, fore: -1, rear: 1, arm: 1 },    /* down */
    { lift: 1, fore: 0, rear: 0,  arm: 0 },    /* pass */
  ];

  function body(ctx, p, o) {
    const box = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
    const put = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };

    const cx = 9;
    const top = (p.small ? 4 : 0) - (o.lift || 0);
    const hairY = top, headY = top + 1, neckY = top + 7, torsoY = top + 8;
    const hipY = top + 16, legEnd = GROUND;
    const shade = SKIN_SHADE[p.skin] || p.skin;

    /* --- legs ------------------------------------------------------------- */
    if (o.sitting) {
      /* thighs forward, shins dropping to the floor */
      box(cx - 4, hipY - 1, 8, 3, p.bottom);
      box(cx + 1, hipY - 1, 6, 3, p.bottom);
      for (const lx of [cx + 3, cx + 6]) {
        box(lx, hipY + 2, 2, legEnd - hipY - 2, p.bottom);
        box(lx - 1, legEnd, 3, 1, p.shoe);
      }
    } else {
      const legs = [{ dx: o.fore || 0, x: cx - 4 }, { dx: o.rear || 0, x: cx + 1 }];
      /* the trailing leg goes down first so the leading one overlaps it */
      legs.sort((a, b) => a.dx - b.dx);
      for (const L of legs) {
        const lean = L.dx;
        box(L.x, hipY, 3, legEnd - hipY - 1, p.bottom);
        if (lean) box(L.x + (lean > 0 ? 1 : -1), legEnd - 3, 3, 3, p.bottom);
        box(L.x + Math.sign(lean) * Math.min(2, Math.abs(lean)), legEnd, 3, 1, p.shoe);
      }
    }

    /* --- torso ------------------------------------------------------------ */
    const torsoBottom = o.sitting ? hipY : hipY + 1;
    box(cx - 4, torsoY, 8, torsoBottom - torsoY, p.top);
    /* a lit edge on the key side and a shadow on the far side: two columns of
       pixels that do most of the work of making a flat block look solid */
    ctx.globalAlpha = 0.22;
    box(cx + 2, torsoY, 2, torsoBottom - torsoY, "#000");
    ctx.globalAlpha = 0.16;
    box(cx - 4, torsoY, 1, torsoBottom - torsoY, "#fff");
    ctx.globalAlpha = 1;
    if (p.collar) box(cx - 3, torsoY, 6, 1, p.collarColour);

    /* --- arms ------------------------------------------------------------- */
    const swing = o.arm || 0;
    const armT = torsoY + 1;
    if (o.photo) {
      /* both elbows up, holding something in front of the face */
      box(cx - 6, armT + 1, 2, 3, p.top);
      box(cx + 4, armT + 1, 2, 3, p.top);
      box(cx - 5, armT, 1, 2, shade);
      box(cx + 5, armT, 1, 2, shade);
    } else if (o.pointing) {
      box(cx + 4, armT, 2, 2, p.top);
      box(cx + 6, armT - 1, 3, 1, shade);
      box(cx - 5, armT + 1, 1, 5, p.top);
      put(cx - 5, armT + 6, shade);
    } else {
      box(cx - 5, armT + Math.max(0, swing), 1, 5, p.top);
      box(cx + 4, armT + Math.max(0, -swing), 1, 5, p.top);
      put(cx - 5, armT + 5 + Math.max(0, swing), shade);
      put(cx + 4, armT + 5 + Math.max(0, -swing), shade);
    }

    /* --- head ------------------------------------------------------------- */
    const hx = cx + (o.turn || 0);
    box(cx - 1, neckY, 2, 1, shade);
    box(hx - 2, headY, 5, 6, p.skin);
    ctx.globalAlpha = 0.20;
    box(hx + 2, headY, 1, 6, "#000");                  /* cheek shadow */
    ctx.globalAlpha = 1;
    box(hx - 2, hairY, 5, 2, p.hair);
    if (p.longHair) { box(hx - 3, headY, 1, 5, p.hair); box(hx + 3, headY, 1, 5, p.hair); }
    if (p.beard) box(hx - 1, headY + 4, 4, 2, p.hair);
    if (p.hat) { box(hx - 4, hairY - 1, 9, 2, p.hatColour); box(hx - 2, hairY - 2, 5, 1, p.hatColour); }

    if (!o.back) {
      const eye = o.eyesUp ? headY + 2 : headY + 3;
      put(hx - 1, eye, "#20160f");
      put(hx + 1, eye, "#20160f");
      ctx.globalAlpha = 0.42;
      put(hx, headY + 5, "#20160f");
      ctx.globalAlpha = 1;
    }

    /* --- carried things --------------------------------------------------- */
    if (p.bag && !o.sitting) {
      box(cx + 4, torsoY + 4, 3, 4, p.bagColour);
      box(cx - 3, torsoY, 7, 1, p.bagColour);
    } else if (p.bag) {
      box(cx - 8, hipY - 1, 3, 4, p.bagColour);
    }
    if (p.camera && o.photo) {
      box(cx - 4, armT - 1, 7, 4, "#1e1e22");
      box(cx - 1, armT, 2, 2, "#8fb8d0");
      box(cx + 2, armT - 2, 2, 1, "#3a3a42");
    } else if (p.camera && !o.back) {
      box(cx - 3, torsoY + 4, 5, 3, "#1e1e22");
      put(cx - 1, torsoY + 5, "#8fb8d0");
    } else if (p.camera) {
      box(cx - 1, torsoY + 4, 3, 2, "#1e1e22");
    }
    if (p.notebook) {
      box(cx - 8, torsoY + 4, 3, 5, "#d8cfb6");
      box(cx - 8, torsoY + 4, 3, 1, "#a99f88");
    }
    if (p.stick) box(cx + 7, torsoY + 2, 1, legEnd - torsoY - 1, "#5a4632");
    if (p.staff) {
      box(cx - 4, torsoY, 8, 2, "#242430");
      put(cx, torsoY + 2, "#c79a42");
    }
  }

  /* ---------- baking ------------------------------------------------------- */

  const cache = new Map();

  function bakePose(p, o) {
    const c = frameCanvas();
    body(c.getContext("2d"), p, o);
    return c;
  }

  function makePerson(seed, typeId) {
    const key = seed + ":" + typeId;
    if (cache.has(key)) return cache.get(key);

    const rng = S7.rng(seed);
    const type = typeById[typeId] || TYPES[0];
    const p = {
      skin: rng.pick(SKIN),
      hair: rng.pick(HAIR),
      top: rng.pick(TOP),
      bottom: rng.pick(BOTTOM),
      shoe: rng.pick(SHOE),
      small: !!type.small,
      longHair: rng.chance(0.42),
      beard: !type.small && rng.chance(0.18),
      hat: rng.chance(type.id === "tourist" ? 0.45 : 0.12),
      hatColour: rng.pick(TOP),
      collar: rng.chance(0.3),
      collarColour: rng.pick(["#d8cfb6", "#2a2a33", "#8a8a95"]),
      bag: rng.chance(0.36),
      bagColour: rng.pick(BAG),
      camera: !!type.camera || rng.chance(0.10),
      notebook: !!type.notebook,
      stick: !!type.stick,
      staff: !!type.staff,
    };

    const walk = GAIT.map((g) => bakePose(p, g));
    const out = {
      walk,
      stand: bakePose(p, { fore: 0, rear: 0, arm: 0 }),
      /* Looking at something: back turned, head tipped up a little. */
      back: bakePose(p, { back: true, eyesUp: true }),
      backLean: bakePose(p, { back: true, eyesUp: true, lift: 1 }),
      photo: bakePose(p, { back: true, photo: true }),
      point: bakePose(p, { back: true, pointing: true }),
      sit: bakePose(p, { sitting: true, lift: -3 }),
      /* Facing the viewer, mid-conversation. */
      talk: bakePose(p, { turn: 0, arm: 0 }),
      talkAlt: bakePose(p, { turn: 1, arm: 1 }),
      w: W, h: H, type, look: p,
    };
    if (cache.size > 300) cache.clear();
    cache.set(key, out);
    return out;
  }

  const pickType = (rng) => rng.weighted(TYPES, (t) => t.w).id;

  S7.people = { makePerson, pickType, TYPES, typeById, W, H, GAIT };
})(window.S7 = window.S7 || {});
