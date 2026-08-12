/* ============================================================================
   THE CROWD

   Lays the collection out as a row of rooms and walks people through it.

   The layout is pure geometry derived from the collection, so it is rebuilt
   whenever something is accessioned or moved to store. The agents are a small
   state machine — walk, view, photograph, chat, leave — with just enough
   variation that no two visits look the same.

   Coordinates are "logical pixels": one strip, x running left to right, with
   the floor at FLOOR_Y. The renderer scales the whole thing up.
   ============================================================================ */
(function (S7) {
  "use strict";

  /* ---------- layout constants -------------------------------------------- */

  /* Vertical scale is set by one rule: a person has to read as a person in the
     room. Ceiling to floor is 90 logical pixels and a visitor is 33 of them —
     a bit over a third, which is roughly a gallery with a high ceiling. */
  const H = 170;                 /* logical height of the view */
  const FLOOR_Y = 112;           /* where the back wall meets the floor */
  const WALK_FAR = 118;          /* back of the walkable band, nearest the wall */
  const WALK_NEAR = 152;         /* front of it */
  const ROOM_PAD = 30;
  const MIN_ROOM = 220;
  const DOOR = 58;               /* the arch between two rooms */
  const BENCH_Y = 146;           /* where a bench stands on the floor */
  const MAX_AGENTS = 42;

  /* ---------- layout -------------------------------------------------------- */

  /* Rooms are era bands by default, but an artifact can be hung anywhere the
     curator wants it: `a.room` overrides its era and `a.slot` its position.
     Slot widths come from the object's real size, so a colossal head gets a
     bay of wall to itself and a bead does not. */
  function layout(S) {
    const shown = S.collection.filter((a) => a.display !== false);
    const byEra = new Map();
    for (const a of shown) {
      const id = a.room || S7.cultures.eraAt(a.depth).id;
      if (!byEra.has(id)) byEra.set(id, []);
      byEra.get(id).push(a);
    }

    const eraById = {};
    for (const e of S7.cultures.ERAS) eraById[e.id] = e;

    const rooms = [];
    let x = 0;
    for (const era of S7.cultures.ERAS) {
      const items = byEra.get(era.id);
      if (!items) continue;
      items.sort((a, b) => (a.slot === undefined ? a.depth : a.slot) -
                           (b.slot === undefined ? b.depth : b.slot));

      const exhibits = [];
      let cx = x + ROOM_PAD;
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        const phys = S7.artifacts.physical(a);
        const mount = a.kind === "painting" ? "wall" : a.kind === "sculpture" ? "plinth" : "case";
        exhibits.push({ a, x: cx + phys.w / 2, w: phys.w, h: phys.h, mount, index: i, phys });
        cx += phys.w;
      }
      const width = Math.max(MIN_ROOM, cx - x + ROOM_PAD);

      /* One bench per stretch of room, dropped in the widest gap between
         exhibits so nobody has to sit inside a display case. */
      const benches = [];
      const nBench = Math.max(1, Math.floor(width / 300));
      for (let b = 0; b < nBench; b++) {
        const bx = x + width * ((b + 0.5) / nBench) + (b % 2 ? 18 : -18);
        benches.push({
          x: bx, y: BENCH_Y,
          seats: [bx - 13, bx, bx + 13].map((sxx) => ({ x: sxx, taken: null })),
        });
      }

      rooms.push({ era, x, width, exhibits, items, benches });
      x += width + DOOR;
    }

    if (!rooms.length)
      rooms.push({ era: { id: "empty", name: "The room in town", period: "not yet open" },
                   x: 0, width: 320, exhibits: [], items: [], benches: [] });

    const total = rooms[rooms.length - 1].x + rooms[rooms.length - 1].width;
    const exhibits = [], benches = [];
    for (const r of rooms) {
      for (const e of r.exhibits) { e.room = r; exhibits.push(e); }
      for (const b of r.benches) { b.room = r; benches.push(b); }
    }
    return { rooms, exhibits, benches, total, H, FLOOR_Y };
  }

  /* Reassigns an artifact to a room and a position, for drag-to-rearrange.
     Slots are renumbered from 0 so the ordering stays stable across saves. */
  function place(S, artifact, roomId, beforeIndex) {
    artifact.room = roomId;
    const peers = S.collection.filter(
      (a) => a !== artifact && a.display !== false && (a.room || S7.cultures.eraAt(a.depth).id) === roomId);
    peers.sort((a, b) => (a.slot === undefined ? a.depth : a.slot) -
                         (b.slot === undefined ? b.depth : b.slot));
    peers.splice(Math.max(0, Math.min(peers.length, beforeIndex)), 0, artifact);
    peers.forEach((a, i) => { a.slot = i; a.room = roomId; });
    invalidate();
  }

  /* The layout is rebuilt only when the collection or what is on show changes.
     Both the crowd and the renderer read the same cached object, so an agent's
     target is always the exhibit the renderer will draw. */
  let cache = null, cacheKey = "";

  function getLayout(S) {
    let shown = 0;
    for (const a of S.collection) if (a.display !== false) shown++;
    const key = S.collection.length + ":" + shown;
    if (key !== cacheKey) { cacheKey = key; cache = layout(S); }
    return cache;
  }

  const invalidate = () => { cacheKey = ""; };

  /* Called when the collection changes enough that standing arrangements are
     stale — everyone re-picks a target rather than walking to a gap. */
  const reseat = (state) => { for (const a of state.agents) { a.target = null; a.state = "walk"; } };

  /* Which room contains a given strip x. */
  function roomAt(L, x) {
    let best = L.rooms[0];
    for (const r of L.rooms) if (x >= r.x - DOOR / 2) best = r;
    return best;
  }

  /* ---------- agents --------------------------------------------------------- */

  let nextId = 1;

  /* `where` is a strip x, or undefined to come in off one of the ends. Most
     visitors are placed mid-building: you are panning around a museum that is
     already open, not watching one fill up from the door. */
  function spawn(rng, L, where) {
    const type = S7.people.pickType(rng);
    const def = S7.people.typeById[type];
    const sprite = S7.people.makePerson(rng.int(1, 1e9), type);
    const fromLeft = rng.chance(0.5);
    const x = where !== undefined ? where : (fromLeft ? -14 : L.total + 14);
    return {
      id: nextId++,
      type, def, sprite,
      x,
      z: rng.range(0, 1),
      dir: fromLeft ? 1 : -1,
      speed: (9 + rng.range(-2, 3)) * def.speed,
      state: "walk",
      timer: 0,
      target: null,
      visits: rng.int(2, 7),
      bubble: null,
      flash: 0,
      phase: rng.range(0, 4),
      chatCooldown: rng.range(2, 12),
      groupOffset: rng.range(-16, 16),
      seat: null,
      /* Elders sit given half a chance; everyone else needs to have been
         walking round for a while first. */
      restWish: def.stick ? rng.range(0.45, 0.75) : rng.range(0.05, 0.18),
    };
  }

  /* Somewhere to sit, if there is one within a sensible walk. */
  function freeSeat(L, a) {
    let best = null, bestD = 300;
    for (const b of L.benches)
      for (const seat of b.seats) {
        if (seat.taken !== null) continue;
        const d = Math.abs(seat.x - a.x);
        if (d < bestD) { bestD = d; best = seat; }
      }
    return best;
  }

  const feetY = (a) => (a.state === "sit" ? BENCH_Y : WALK_FAR + a.z * (WALK_NEAR - WALK_FAR));
  const scaleOf = (a) => (0.82 + a.z * 0.30) * a.def.scale;

  /* Pick something to walk to. Prefers exhibits near where they already are,
     because a crowd that teleports its attention across the building looks
     wrong even when you cannot say why. */
  function chooseTarget(rng, L, a) {
    if (!L.exhibits.length) return null;
    const near = L.exhibits.filter((e) => Math.abs(e.x - a.x) < 260);
    const pool = near.length ? near : L.exhibits;
    let best = null, bestScore = -1e9;
    for (let i = 0; i < 4; i++) {
      const e = rng.pick(pool);
      const score = -Math.abs(e.x - a.x) * 0.4 + rng.range(0, 90) +
                    (e.a.rarity.mult > 2 ? 40 : 0) +
                    (e.a.kind === "painting" ? 12 : 0);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  const MAX_BUBBLES = 4;

  /* A room where everyone is talking at once is unreadable, and the bubbles
     cover the art — which is the thing they are talking about. */
  function talking(state) {
    let n = 0;
    for (const a of state.agents) if (a.bubble) n++;
    return n;
  }

  function say(state, a, text, seconds) {
    if (!a.bubble && talking(state) >= MAX_BUBBLES) return;
    const t = seconds === undefined ? 4.2 : seconds;
    a.bubble = { text, t, life: t };
  }

  /* ---------- the step ------------------------------------------------------- */

  function step(state, S, dt, L) {
    const rng = state.rng;
    const sv = S7.museum.survey(S);
    const vpm = S7.museum.visitorsPerMin(S, sv);

    /* Population is a squashed function of the real visitor rate: the museum
       can legitimately be doing five thousand a minute late on, and forty-two
       people is as many as the room can read. */
    const want = sv.count === 0 ? 0 : Math.max(1, Math.min(MAX_AGENTS, Math.round(2 + Math.sqrt(vpm))));
    state.crowd = want;
    state.overflow = Math.max(0, Math.round(vpm) - want);

    /* On the first tick after opening the tab, fill the building rather than
       making the player watch forty people walk in from the car park. */
    if (!state.seeded && want > 0 && L.exhibits.length) {
      state.seeded = true;
      for (let i = 0; i < want; i++) {
        const e = rng.pick(L.exhibits);
        const a = spawn(rng, L, e.x + rng.range(-90, 90));
        if (rng.chance(0.45)) { a.state = "view"; a.target = e; a.x = e.x + a.groupOffset; a.timer = rng.range(1, 7); }
        state.agents.push(a);
      }
    }

    state.spawnTimer -= dt;
    if (state.agents.length < want && state.spawnTimer <= 0) {
      state.spawnTimer = rng.range(0.15, 0.9);
      const near = L.exhibits.length && rng.chance(0.65)
        ? rng.pick(L.exhibits).x + rng.range(-130, 130) : undefined;
      state.agents.push(spawn(rng, L, near));
    }
    while (state.agents.length > want + 6) {
      const gone = state.agents.pop();
      if (gone && gone.seat) gone.seat.taken = null;
    }

    for (let i = state.agents.length - 1; i >= 0; i--) {
      const a = state.agents[i];

      if (a.bubble) {
        a.bubble.t -= dt;
        if (a.bubble.t <= 0) a.bubble = null;
      }
      if (a.flash > 0) a.flash -= dt;
      a.chatCooldown -= dt;

      if (a.state === "walk") {
        if (!a.target) {
          a.target = chooseTarget(rng, L, a);
          if (!a.target) { a.state = "leave"; continue; }
        }
        const tx = a.target.x + a.groupOffset;
        const d = tx - a.x;
        a.dir = d < 0 ? -1 : 1;
        a.x += Math.sign(d) * Math.min(Math.abs(d), a.speed * dt);
        a.phase += a.speed * dt * 0.55;
        /* drift toward the front of the band as they approach, so viewers do
           not all stand in a single line */
        a.z += (0.35 + (a.id % 7) / 12 - a.z) * dt * 0.6;
        if (Math.abs(d) < 1.5) {
          a.state = "view";
          a.timer = rng.range(3, 8) * (a.def.dwell || 1);
          if (rng.chance(0.62))
            say(state, a, S7.remarks.forExhibit(rng, a.target.a, a.type), rng.range(3.4, 5.4));
          if ((a.def.camera || a.sprite.look.camera) && rng.chance(0.55)) {
            a.flash = 0.5;
            if (rng.chance(0.4)) say(state, a, S7.remarks.forExhibit(rng, a.target.a, "tourist"), 3.6);
          }
        }
      } else if (a.state === "view") {
        a.timer -= dt;
        if (!a.bubble && rng.chance(dt * 0.22))
          say(state, a, S7.remarks.forExhibit(rng, a.target.a, a.type), rng.range(3.2, 5));
        if (a.timer <= 0) {
          a.visits--;
          a.target = null;
          if (a.visits <= 0) a.state = "leave";
          else if (rng.chance(a.restWish)) {
            const seat = freeSeat(L, a);
            if (seat) { seat.taken = a.id; a.seat = seat; a.state = "toSeat"; }
            else a.state = "walk";
          } else a.state = "walk";
        }
      } else if (a.state === "toSeat") {
        const d = a.seat.x - a.x;
        a.dir = d < 0 ? -1 : 1;
        a.x += Math.sign(d) * Math.min(Math.abs(d), a.speed * dt);
        a.phase += a.speed * dt * 0.55;
        a.z += (0.92 - a.z) * dt * 1.2;          /* benches sit forward of the art */
        if (Math.abs(d) < 1.2) {
          a.state = "sit";
          a.timer = rng.range(9, 26) * (a.def.stick ? 1.5 : 1);
        }
      } else if (a.state === "sit") {
        a.timer -= dt;
        if (!a.bubble && rng.chance(dt * 0.10)) say(state, a, S7.remarks.ambient(rng, a.type), rng.range(3.2, 5));
        if (a.timer <= 0) {
          if (a.seat) { a.seat.taken = null; a.seat = null; }
          a.state = "walk";
          a.restWish *= 0.35;                    /* they have had their sit down */
        }
      } else {                                   /* leave */
        const exitLeft = a.x < L.total / 2;
        a.dir = exitLeft ? -1 : 1;
        a.x += a.dir * a.speed * 1.25 * dt;
        a.phase += a.speed * dt * 0.6;
        a.z += (0.85 - a.z) * dt * 0.8;
        if (a.x < -24 || a.x > L.total + 24) {
          if (a.seat) a.seat.taken = null;
          state.agents.splice(i, 1);
        }
      }
    }

    /* Conversations: two people looking at the same thing, close together. */
    state.chatTimer -= dt;
    if (state.chatTimer <= 0) {
      state.chatTimer = rng.range(1.6, 4.5);
      const viewing = state.agents.filter((a) => a.state === "view" && !a.bubble && a.chatCooldown <= 0);
      for (let i = 0; i < viewing.length; i++)
        for (let j = i + 1; j < viewing.length; j++) {
          const a = viewing[i], b = viewing[j];
          if (Math.abs(a.x - b.x) > 34) continue;
          const lines = a.target && a.target === b.target && rng.chance(0.45)
            ? S7.remarks.pair(rng)
            : [S7.remarks.ambient(rng, a.type), S7.remarks.ambient(rng, b.type)];
          say(state, a, lines[0], 3.6);
          b.pendingReply = { text: lines[1], delay: 1.5 };
          a.chatCooldown = rng.range(12, 30);
          b.chatCooldown = rng.range(12, 30);
          i = viewing.length;
          break;
        }
    }
    for (const a of state.agents) {
      if (!a.pendingReply) continue;
      a.pendingReply.delay -= dt;
      if (a.pendingReply.delay <= 0) { say(state, a, a.pendingReply.text, 3.4); a.pendingReply = null; }
    }
  }

  function create(seed) {
    return {
      rng: S7.rng(seed >>> 0 || 12345),
      agents: [],
      spawnTimer: 0,
      chatTimer: 1,
      crowd: 0,
      overflow: 0,
      seeded: false,
    };
  }

  S7.visitors = {
    create, step, layout, getLayout, invalidate, reseat, place, roomAt, feetY, scaleOf,
    H, FLOOR_Y, WALK_NEAR, WALK_FAR, ROOM_PAD, DOOR, BENCH_Y, MAX_AGENTS,
  };
})(window.S7 = window.S7 || {});
