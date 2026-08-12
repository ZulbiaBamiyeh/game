/* ============================================================================
   VISITORS

   Small pixel people, generated from a seed like everything else. Each one is
   baked once into a strip of frames — stand, four-frame walk, and a back view
   for when they are facing an exhibit — so the gallery renderer only ever does
   drawImage.

   22 pixels tall: head 6, torso 8, legs 8. Small enough that a crowded room
   still reads, big enough that a red coat and a camera are legible.
   ============================================================================ */
(function (S7) {
  "use strict";

  const W = 16, H = 22;              /* one frame */
  const GROUND = H - 1;

  /* Palettes are drawn from these rather than random RGB, so a room full of
     strangers still looks like it was designed by one person. */
  const SKIN = ["#f0c9a4", "#e0ad82", "#c98d61", "#a86b45", "#7d4b30", "#5c3722", "#f7ddc0"];
  const HAIR = ["#2b1d13", "#4a2f1c", "#7a4a22", "#b07a35", "#d8c08a", "#8a8a8a", "#d6d6d6",
                "#1a1a1a", "#5c3a5c", "#7a2f2f", "#2f4a6b"];
  const TOP = ["#8a3b34", "#3d5a7a", "#4a6b45", "#6b5a3a", "#7a4a6b", "#2f3a4a", "#a8703a",
               "#5a5a6b", "#8a8a95", "#3a6b6b", "#b5904a", "#6b3a3a"];
  const BOTTOM = ["#2f3440", "#3a3a3a", "#4a4235", "#25303d", "#5a4a3a", "#3d3d4a", "#6b6355"];
  const SHOE = ["#1a1a1a", "#2a1f16", "#33333a"];
  const BAG = ["#8a5a2a", "#3a4a5a", "#6b2f2f", "#4a4a3a"];

  /* Visitor archetypes. `w` is how often they turn up; the rest changes both
     how they look and which remarks they draw from. */
  const TYPES = [
    { id: "adult",   w: 100, scale: 1.00, speed: 1.00 },
    { id: "child",   w: 26,  scale: 0.72, speed: 1.35, small: true },
    { id: "tourist", w: 34,  scale: 1.00, speed: 0.85, camera: true },
    { id: "scholar", w: 18,  scale: 1.00, speed: 0.70, notebook: true, dwell: 2.2 },
    { id: "school",  w: 22,  scale: 0.74, speed: 1.25, small: true, group: true },
    { id: "elder",   w: 20,  scale: 0.95, speed: 0.62, stick: true, dwell: 1.6 },
    { id: "staff",   w: 10,  scale: 1.00, speed: 0.90, staff: true, dwell: 0.6 },
  ];
  const typeById = {};
  for (const t of TYPES) typeById[t.id] = t;

  /* ---------- drawing ----------------------------------------------------- */

  function frameCanvas() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    return c;
  }

  /* phase: 0 stand, 1..4 walk cycle. back: seen from behind.

     Proportions matter more than detail at this size. Shoulders are 8 wide and
     the head is 5, because a head as wide as the body reads as a column rather
     than a person. */
  function drawPerson(ctx, p, phase, back) {
    const put = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    const box = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

    const cx = 8;
    /* Bob on the two mid-stride frames so the walk has weight. */
    const bob = phase === 2 || phase === 4 ? 1 : 0;
    const top = (p.small ? 4 : 0) + bob;

    const hairY = top;
    const headY = top + 1;
    const neckY = top + 7;
    const torsoY = top + 8;
    const legY = top + 15;
    const legEnd = GROUND;

    /* legs — the swing opposes on frames 2 and 4 */
    const swing = phase === 2 ? 1 : phase === 4 ? -1 : 0;
    for (const side of [-1, 1]) {
      const lx = side < 0 ? cx - 4 : cx + 1;
      const off = swing * side;
      box(lx, legY, 3, legEnd - legY, p.bottom);
      if (off !== 0) box(lx + (off > 0 ? 1 : -1), legEnd - 3, 3, 3, p.bottom);
      box(lx + (off > 0 ? 1 : off < 0 ? -1 : 0), legEnd, 3, 1, p.shoe);
    }

    /* torso */
    box(cx - 4, torsoY, 8, legY - torsoY + 1, p.top);
    ctx.globalAlpha = 0.22;                     /* shading away from the key light */
    box(cx + 1, torsoY, 3, legY - torsoY + 1, "#000");
    ctx.globalAlpha = 1;

    /* arms, outside the shoulder line so the silhouette reads */
    const armSwing = phase === 2 ? -1 : phase === 4 ? 1 : 0;
    const armT = torsoY + 1;
    box(cx - 5, armT + Math.max(0, armSwing), 1, 5, p.top);
    box(cx + 4, armT + Math.max(0, -armSwing), 1, 5, p.top);
    put(cx - 5, armT + 5 + Math.max(0, armSwing), p.skin);
    put(cx + 4, armT + 5 + Math.max(0, -armSwing), p.skin);

    /* neck */
    box(cx - 1, neckY, 2, 1, p.skin);

    /* head */
    box(cx - 2, headY, 5, 6, p.skin);
    box(cx - 2, hairY, 5, 2, p.hair);
    if (p.longHair) { box(cx - 3, headY, 1, 5, p.hair); box(cx + 3, headY, 1, 5, p.hair); }
    if (p.hat) { box(cx - 4, hairY - 1, 9, 2, p.hatColour); box(cx - 2, hairY - 2, 5, 1, p.hatColour); }

    if (!back) {
      put(cx - 1, headY + 3, "#20160f");
      put(cx + 1, headY + 3, "#20160f");
      ctx.globalAlpha = 0.45;
      put(cx, headY + 5, "#20160f");
      ctx.globalAlpha = 1;
    }

    /* accessories */
    if (p.bag) {
      box(cx + 4, torsoY + 3, 3, 4, p.bagColour);
      box(cx - 3, torsoY, 7, 1, p.bagColour);
    }
    if (p.camera && !back) {
      box(cx - 3, torsoY + 3, 5, 3, "#1e1e22");
      put(cx - 1, torsoY + 4, "#8fb8d0");
    }
    if (p.camera && back) box(cx - 1, torsoY + 3, 3, 2, "#1e1e22");
    if (p.notebook) box(cx - 7, torsoY + 4, 3, 4, "#d8cfb6");
    if (p.stick) box(cx + 6, torsoY + 2, 1, GROUND - torsoY - 1, "#5a4632");
    if (p.staff) {
      box(cx - 4, torsoY, 8, 2, "#2a2a33");        /* lanyard and badge */
      put(cx, torsoY + 2, "#c79a42");
    }
  }

  /* Seated on a bench: hips at seat height, shins dropping to the floor, and
     the whole figure four pixels shorter than standing. */
  function drawSitting(ctx, p) {
    const put = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    const box = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
    const cx = 8;
    const top = (p.small ? 3 : 0) + 4;
    const hairY = top, headY = top + 1, torsoY = top + 8, hipY = top + 15;

    /* thighs forward, shins down */
    box(cx - 4, hipY, 8, 3, p.bottom);
    box(cx + 1, hipY, 5, 3, p.bottom);
    for (const lx of [cx + 2, cx + 5]) {
      box(lx, hipY + 3, 2, GROUND - hipY - 3, p.bottom);
      box(lx, GROUND, 2, 1, p.shoe);
    }

    box(cx - 4, torsoY, 8, hipY - torsoY + 1, p.top);
    ctx.globalAlpha = 0.22;
    box(cx + 1, torsoY, 3, hipY - torsoY + 1, "#000");
    ctx.globalAlpha = 1;
    /* forearms resting on the knees */
    box(cx + 3, torsoY + 2, 1, 4, p.top);
    box(cx - 5, torsoY + 2, 1, 4, p.top);
    put(cx + 3, torsoY + 6, p.skin);
    put(cx - 5, torsoY + 6, p.skin);

    box(cx - 1, torsoY - 1, 2, 1, p.skin);
    box(cx - 2, headY, 5, 6, p.skin);
    box(cx - 2, hairY, 5, 2, p.hair);
    if (p.longHair) { box(cx - 3, headY, 1, 5, p.hair); box(cx + 3, headY, 1, 5, p.hair); }
    if (p.hat) { box(cx - 4, hairY - 1, 9, 2, p.hatColour); box(cx - 2, hairY - 2, 5, 1, p.hatColour); }
    put(cx - 1, headY + 3, "#20160f");
    put(cx + 1, headY + 3, "#20160f");
    if (p.stick) box(cx - 6, torsoY + 1, 1, GROUND - torsoY - 1, "#5a4632");
    if (p.bag) box(cx - 7, hipY, 3, 4, p.bagColour);
  }

  /* ---------- baking ------------------------------------------------------- */

  const cache = new Map();

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
      hat: rng.chance(type.id === "tourist" ? 0.5 : 0.14),
      hatColour: rng.pick(TOP),
      bag: rng.chance(0.38),
      bagColour: rng.pick(BAG),
      camera: !!type.camera || rng.chance(0.12),
      notebook: !!type.notebook,
      stick: !!type.stick,
      staff: !!type.staff,
    };

    const frames = [];
    for (let i = 0; i < 5; i++) {
      const c = frameCanvas();
      drawPerson(c.getContext("2d"), p, i, false);
      frames.push(c);
    }
    const back = frameCanvas();
    drawPerson(back.getContext("2d"), p, 0, true);
    const sit = frameCanvas();
    drawSitting(sit.getContext("2d"), p);

    const out = { frames, back, sit, w: W, h: H, type, look: p };
    if (cache.size > 300) cache.clear();
    cache.set(key, out);
    return out;
  }

  function pickType(rng) {
    return rng.weighted(TYPES, (t) => t.w).id;
  }

  S7.people = { makePerson, pickType, TYPES, typeById, W, H };
})(window.S7 = window.S7 || {});
