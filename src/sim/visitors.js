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

  /* The entrance hall, which every museum has and which is where the money
     actually changes hands. */
  const FOYER_W = 250;
  /* People are drawn 27 logical pixels across, so "not touching" is about
     thirteen apart and a queue needs twenty between one pair of shoulders and
     the next. Both were tuned by looking at the entrance hall, not by maths. */
  const PERSONAL = 13;
  const QUEUE_GAP = 26;
  const QUEUE_MAX = 4;

  const DOOR_X = 34;             /* the middle of the street doors */
  const DESK_X = 168;            /* the middle of the admissions desk */
  const DESK_W = 54;

  /* ---------- layout -------------------------------------------------------- */

  /* Rooms are era bands by default, but an artifact can be hung anywhere the
     curator wants it: `a.room` overrides its era and `a.slot` its position.
     Slot widths come from the object's real size, so a colossal head gets a
     bay of wall to itself and a bead does not. */
  /* Amenity rooms bought with museum upgrades. They sit after the foyer so the
     building actually grows when you spend money on it, instead of only the
     numbers in the side panel moving. */
  function amenityRoom(id, name, period, width, x, extra) {
    const benches = [{
      x: x + width / 2, y: BENCH_Y,
      seats: [x + width / 2 - 13, x + width / 2, x + width / 2 + 13]
        .map((sxx) => ({ x: sxx, taken: null })),
    }];
    return Object.assign({
      era: { id, name, period },
      x, width, exhibits: [], items: [], benches, amenity: id,
    }, extra || {});
  }

  function pushGalleryRoom(rooms, xRef, meta, items, wingLvl) {
    items.sort((a, b) => (a.slot === undefined ? a.depth : a.slot) -
                         (b.slot === undefined ? b.depth : b.slot));
    const x = xRef.x;
    const exhibits = [];
    let cx = x + ROOM_PAD;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      const phys = S7.artifacts.physical(a);
      let mount = a.kind === "painting" ? "wall" : a.kind === "sculpture" ? "plinth" : "case";
      /* Minerals and many fossils sit better in cases; dino bones on plinths. */
      if (meta.theme === "mineral") mount = a.kind === "sculpture" ? "plinth" : "case";
      if (meta.theme === "dino" && a.kind === "object" &&
          (a.objectType === "dinoBone" || a.objectType === "trackSlab" || a.objectType === "eggFossil"))
        mount = "plinth";
      exhibits.push({ a, x: cx + phys.w / 2, w: phys.w, h: phys.h, mount, index: i, phys });
      cx += phys.w;
    }
    const wingPad = wingLvl > 0 ? 12 + Math.min(8, wingLvl) * 6 : 0;
    /* Themed halls get more breathing room so a full Egypt or dinosaur room
       feels like a destination, not a corridor. */
    const themePad = meta.theme ? 40 : 0;
    const width = Math.max(MIN_ROOM + wingPad + themePad, cx - x + ROOM_PAD + wingPad + themePad);
    const benches = [];
    const nBench = Math.max(1, Math.floor(width / 280));
    for (let b = 0; b < nBench; b++) {
      const bx = x + width * ((b + 0.5) / nBench) + (b % 2 ? 18 : -18);
      benches.push({
        x: bx, y: BENCH_Y,
        seats: [bx - 13, bx, bx + 13].map((sxx) => ({ x: sxx, taken: null })),
      });
    }
    const era = {
      id: meta.id,
      name: meta.name,
      period: meta.period,
      short: meta.short || meta.name,
    };
    rooms.push({
      era, x, width, exhibits, items, benches,
      theme: meta.theme || null,
      featured: !!meta.theme,
    });
    xRef.x = x + width + DOOR;
  }

  function layout(S) {
    const shown = S.collection.filter((a) => a.display !== false);
    const byRoom = new Map();
    for (const a of shown) {
      const id = S7.cultures.galleryIdFor(a);
      if (!byRoom.has(id)) byRoom.set(id, []);
      byRoom.get(id).push(a);
    }

    const up = S.up || {};
    const shopLvl = up.shop || 0;
    const cafeLvl = up.cafe || 0;
    const wingLvl = up.wing || 0;
    const deepLvl = up.deepgal || 0;

    const foyerW = FOYER_W + (shopLvl > 0 ? 70 + Math.min(4, shopLvl) * 8 : 0);
    const rooms = [];
    rooms.push({
      era: { id: "foyer", name: "Entrance hall", period: "admissions and cloakroom", short: "Entrance" },
      x: 0, width: foyerW, exhibits: [], items: [], benches: [
        { x: foyerW - 40, y: BENCH_Y,
          seats: [foyerW - 53, foyerW - 40, foyerW - 27].map((sxx) => ({ x: sxx, taken: null })) },
      ],
      foyer: true, doorX: DOOR_X, deskX: DESK_X, deskW: DESK_W,
      shop: shopLvl,
    });

    const xRef = { x: foyerW + DOOR };

    if (cafeLvl > 0) {
      const cw = 160 + Math.min(6, cafeLvl) * 10;
      rooms.push(amenityRoom("cafe", "Café", "tea and cake", cw, xRef.x, { cafe: cafeLvl }));
      xRef.x += cw + DOOR;
    }

    /* Themed halls first among the collection rooms (Egypt, dinosaurs, …)
       so the building reads as a real museum plan, not only a depth sort. */
    const placed = new Set();
    for (const g of S7.cultures.GALLERIES) {
      const items = byRoom.get(g.id);
      if (!items || !items.length) continue;
      pushGalleryRoom(rooms, xRef, g, items, wingLvl);
      placed.add(g.id);
    }

    /* Remaining finds by depth band, in order. */
    for (const era of S7.cultures.ERAS) {
      if (placed.has(era.id)) continue;
      const items = byRoom.get(era.id);
      if (!items || !items.length) continue;
      pushGalleryRoom(rooms, xRef, {
        id: era.id, name: era.name, period: era.period, short: era.name,
      }, items, wingLvl);
      placed.add(era.id);
    }

    /* Inject monumental mounted skeletons into the dinosaur hall (or a new
       hall if the theme room does not exist yet). */
    if (S7.skeletons) {
      const mounts = S7.skeletons.mountsFor(S);
      if (mounts.length) {
        let dinoRoom = rooms.find((r) => r.era && r.era.id === "dinosaurs");
        if (!dinoRoom) {
          pushGalleryRoom(rooms, xRef, S7.cultures.galleryById.dinosaurs || {
            id: "dinosaurs", name: "Hall of dinosaurs", period: "Mesozoic",
            short: "Dinosaurs", theme: "dino",
          }, mounts.slice(), wingLvl);
          dinoRoom = rooms[rooms.length - 1];
        } else {
          /* Append mounts as leading showpieces of the hall. */
          let cx = dinoRoom.x + ROOM_PAD;
          const extra = [];
          for (let i = 0; i < mounts.length; i++) {
            const a = mounts[i];
            const phys = S7.artifacts.physical(a);
            extra.push({
              a, x: cx + phys.w / 2, w: phys.w, h: phys.h,
              mount: "plinth", index: i, phys, skeletonMount: true,
            });
            cx += phys.w;
          }
          /* Shift existing exhibits right to make room for the mounts. */
          const shift = cx - (dinoRoom.x + ROOM_PAD);
          for (const e of dinoRoom.exhibits) e.x += shift;
          dinoRoom.exhibits = extra.concat(dinoRoom.exhibits);
          dinoRoom.width += shift;
          dinoRoom.items = mounts.concat(dinoRoom.items || []);
          /* Re-pack rooms to the right of the dinosaur hall. */
          let nx = dinoRoom.x + dinoRoom.width + DOOR;
          for (const r of rooms) {
            if (r.x <= dinoRoom.x) continue;
            const dx = nx - r.x;
            r.x += dx;
            for (const e of r.exhibits) e.x += dx;
            for (const b of r.benches) {
              b.x += dx;
              for (const s of b.seats) s.x += dx;
            }
            if (r.doorX !== undefined) r.doorX += dx;
            if (r.deskX !== undefined) r.deskX += dx;
            nx = r.x + r.width + DOOR;
          }
        }
      }
    }

    /* Any custom rehang rooms not already placed. */
    for (const [id, items] of byRoom) {
      if (placed.has(id) || id === "foyer" || id === "cafe") continue;
      if (String(id).indexOf("wing") === 0 || id === "deepgal") continue;
      pushGalleryRoom(rooms, xRef, {
        id, name: id, period: "rehung", short: id,
      }, items, wingLvl);
    }

    for (let w = 0; w < Math.min(4, wingLvl); w++) {
      const ww = 180 + w * 20;
      rooms.push(amenityRoom(
        "wing" + w,
        w === 0 ? "East wing" : w === 1 ? "West wing" : "New wing " + (w + 1),
        "recently opened",
        ww, xRef.x, { wing: true, wingIndex: w }));
      xRef.x += ww + DOOR;
    }

    if (deepLvl > 0) {
      const dw = 200 + Math.min(6, deepLvl) * 12;
      rooms.push(amenityRoom(
        "deepgal", "The deep gallery", "low light · thick glass",
        dw, xRef.x, { deepgal: deepLvl }));
    }

    if (!rooms.length) {
      return { rooms: [], exhibits: [], benches: [], total: VIEW_FALLBACK, H, FLOOR_Y };
    }
    const total = rooms[rooms.length - 1].x + rooms[rooms.length - 1].width;
    const exhibits = [], benches = [];
    for (const r of rooms) {
      for (const e of r.exhibits) { e.room = r; exhibits.push(e); }
      for (const b of r.benches) { b.room = r; benches.push(b); }
    }
    return { rooms, exhibits, benches, total, H, FLOOR_Y };
  }

  const VIEW_FALLBACK = 400;

  /* Reassigns an artifact to a room and a position, for drag-to-rearrange.
     Slots are renumbered from 0 so the ordering stays stable across saves. */
  function place(S, artifact, roomId, beforeIndex) {
    artifact.room = roomId;
    const peers = S.collection.filter(
      (a) => a !== artifact && a.display !== false && S7.cultures.galleryIdFor(a) === roomId);
    peers.sort((a, b) => (a.slot === undefined ? a.depth : a.slot) -
                         (b.slot === undefined ? b.depth : b.slot));
    peers.splice(Math.max(0, Math.min(peers.length, beforeIndex)), 0, artifact);
    peers.forEach((a, i) => { a.slot = i; a.room = roomId; });
    invalidate();
  }

  /* The layout is rebuilt only when the collection, what is on show, or the
     amenity upgrades that add rooms change. Both the crowd and the renderer
     read the same cached object, so an agent's target is always the exhibit
     the renderer will draw. */
  let cache = null, cacheKey = "";

  function getLayout(S) {
    let shown = 0;
    for (const a of S.collection) if (a.display !== false) shown++;
    const u = S.up || {};
    /* Skeleton completion changes the floor plan (mounted showpieces). */
    let sk = "";
    if (S7.skeletons)
      sk = S7.skeletons.progress(S).map((p) => p.kit.id + p.have + (p.complete ? "C" : "")).join(",");
    const key = S.collection.length + ":" + shown +
      ":s" + (u.shop || 0) +
      ":c" + (u.cafe || 0) +
      ":w" + (u.wing || 0) +
      ":d" + (u.deepgal || 0) +
      ":k" + sk;
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

  /* How many stops a person will make. Scales with the collection so a full
     museum gets a proper walk-through, not a glance at the first room and out. */
  function visitBudget(rng, L, def) {
    const n = L && L.exhibits ? L.exhibits.length : 0;
    if (n <= 0) return 0;
    const galleryRooms = L.rooms
      ? L.rooms.filter((r) => r.exhibits && r.exhibits.length).length
      : 1;
    /* Roughly a piece per gallery, plus a few extras — enough to cross the
       building. Scholars linger; tourists cover ground; elders do less. */
    let base = Math.min(n, Math.max(4, galleryRooms + 2 + Math.floor(n * 0.18)));
    if (def.dwell) base = Math.round(base * 1.55);
    if (def.camera) base = Math.round(base * 1.25);
    if (def.stick) base = Math.round(base * 0.8);
    if (def.group || def.small) base = Math.round(base * 0.9);
    if (def.staff) base = Math.round(base * 1.7);
    return Math.max(3, Math.min(n, base + rng.int(-1, 3)));
  }

  /* `where` is a strip x for someone already inside; leave it out and they
     come in through the street doors and pay like everybody else. */
  function spawn(rng, L, where) {
    const type = S7.people.pickType(rng);
    const def = S7.people.typeById[type];
    const sprite = S7.people.makePerson(rng.int(1, 1e9), type);
    const arriving = where === undefined;
    const x = arriving ? DOOR_X - 18 - rng.range(0, 8) : where;
    const visits = visitBudget(rng, L, def);
    return {
      id: nextId++,
      type, def, sprite,
      x,
      /* Arrivals share the front of the room, where the doors are. */
      z: arriving ? 0.74 + rng.range(0, 0.16) : rng.range(0, 1),
      dir: 1,
      speed: (9 + rng.range(-2, 3)) * def.speed,
      state: arriving ? "enter" : "walk",
      ticket: 0,
      paid: null,
      pose: 0,
      timer: 0,
      target: null,
      visits,
      tourTotal: visits,
      seen: new Set(),
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

  /* How many people are already queueing at the desk in front of this one.
     Ranked by the ticket taken on arrival, not by position: rank people by
     where they are standing and two who arrive in the same second both think
     they are first, walk into each other, and swap places forever. */
  function queueAhead(state, a) {
    let n = 0;
    for (const o of state.agents) {
      if (o === a) continue;
      if (o.state !== "enter" && o.state !== "pay") continue;
      if (o.ticket < a.ticket) n++;
    }
    return Math.min(n, QUEUE_MAX);
  }

  /* Nudge people out of each other. Without this a popular exhibit ends up
     with six visitors standing in exactly the same pixel. */
  function separate(state, dt) {
    const list = state.agents;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.state === "sit") continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.state === "sit") continue;
        const dz = Math.abs(a.z - b.z);
        if (dz > 0.16) continue;
        const dx = b.x - a.x;
        const gap = Math.abs(dx);
        const near = a.state === "sit" || b.state === "sit" ? 0 : PERSONAL;
        if (gap > near || gap < 0.001) continue;
        const push = (near - gap) * dt * 2.2;
        const s2 = dx < 0 ? -1 : 1;
        a.x -= s2 * push;
        b.x += s2 * push;
        /* and let them slide past each other in depth as well as along */
        const zPush = (0.16 - dz) * dt * 1.4;
        if (a.z < b.z) { a.z -= zPush; b.z += zPush; } else { a.z += zPush; b.z -= zPush; }
        a.z = Math.max(0, Math.min(1, a.z));
        b.z = Math.max(0, Math.min(1, b.z));
      }
    }
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

  /* Pick the next stop on someone's tour. They keep a list of what they have
     already looked at, push deeper into the building early on, and only
     settle for nearby pieces once they have covered some ground — otherwise
     everyone piles up in the first gallery and never reaches the rest. */
  function chooseTarget(rng, L, a) {
    if (!L.exhibits.length) return null;
    if (!a.seen) a.seen = new Set();
    const unseen = L.exhibits.filter((e) => !a.seen.has(e.a.no));
    /* Finished the collection: leave rather than re-doing the foyer loop. */
    if (!unseen.length) return null;

    let minX = Infinity, maxX = -Infinity;
    for (const e of L.exhibits) {
      if (e.x < minX) minX = e.x;
      if (e.x > maxX) maxX = e.x;
    }
    const span = Math.max(80, maxX - minX);
    const total = Math.max(1, a.tourTotal || a.visits || 1);
    const done = Math.max(0, total - a.visits) / total;   /* 0 at start → 1 at end */
    /* Ideal depth along the strip: start near the door, march inward, then
       free-range toward the end of the tour. */
    const ideal = minX + span * Math.min(1, 0.12 + done * 0.95 + rng.range(0, 0.12));

    let best = null, bestScore = -1e9;
    const samples = Math.min(unseen.length, 10);
    for (let i = 0; i < samples; i++) {
      const e = rng.pick(unseen);
      const dist = Math.abs(e.x - a.x);
      let score = rng.range(0, 35);
      /* Skip the piece they are already standing at. */
      if (dist < 36) score -= 120;
      else if (dist < 90) score -= 25;
      /* Pull toward the tour frontier so the walk covers the building. */
      score -= Math.abs(e.x - ideal) * 0.22;
      /* Early on, prefer further in (positive x). Late, either way is fine. */
      if (e.x > a.x) score += 28 * (1 - done * 0.55);
      else score -= 8 * (1 - done);
      /* Rare and painted pieces still draw a crowd. */
      if (e.a.rarity.mult > 2) score += 32;
      if (e.a.rarity.mult > 3.5) score += 18;
      if (e.a.kind === "painting") score += 10;
      if (e.a.kind === "sculpture") score += 6;
      /* Long walks are fine — a museum is supposed to be walked — but do not
         always teleport attention to the far end in one hop. */
      if (dist > span * 0.55 && done < 0.35) score -= 15;
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
    const open = S7.museum.isOpen(S);

    /* How many people are in the building right now: arrivals per minute times
       how long each one stays. A visitor who stays forty minutes and a door
       doing three a minute means a hundred and twenty people inside — more
       than the room can draw, so it is capped and the header says so. */
    const perMin = S7.museum.arrivalRate(S, sv);
    const dwellMinutes = 25 * S7.museum.softCap(S.mul.dwell * (1 + S.add.dwell), 1.5);
    const inside = open ? perMin * dwellMinutes : 0;
    const want = sv.count === 0 ? 0 : Math.min(MAX_AGENTS, Math.round(inside));
    state.crowd = want;
    state.inside = inside;
    state.overflow = Math.max(0, Math.round(inside) - want);

    /* On the first tick after opening the tab, fill the building rather than
       making the player watch forty people walk in from the car park. Spread
       them along the whole strip so the deep galleries are not empty. */
    if (!state.seeded && want > 0 && L.exhibits.length) {
      state.seeded = true;
      for (let i = 0; i < want; i++) {
        const qi = Math.min(L.exhibits.length - 1,
          Math.floor(((i + rng.range(0, 0.9)) / want) * L.exhibits.length));
        const e = L.exhibits[qi] || rng.pick(L.exhibits);
        const a = spawn(rng, L, e.x + rng.range(-90, 90));
        /* Already part-way through their tour, so they do not all leave at once. */
        const spent = rng.int(0, Math.max(0, a.tourTotal - 2));
        a.visits = Math.max(1, a.tourTotal - spent);
        if (rng.chance(0.5)) {
          a.state = "view";
          a.target = e;
          a.seen.add(e.a.no);
          a.x = e.x + a.groupOffset;
          a.timer = rng.range(1, 7) * (a.def.dwell || 1);
        }
        state.agents.push(a);
      }
    }

    /* Everyone who walks in has been admitted by the till, so the crowd is a
       picture of the real gate rather than a decoration with its own rules. */
    /* One through the door at a time, however many the till admitted this
       frame — a coachload arriving in the same tick is a queue, not a pile. */
    state.doorTimer -= dt;
    if (S.pendingArrivals > 0 && state.doorTimer <= 0 && state.agents.length < want + 10) {
      S.pendingArrivals--;
      state.doorTimer = rng.range(0.35, 0.9);
      const a = spawn(rng, L);
      a.ticket = state.ticket++;
      state.agents.push(a);
    }
    /* If the till is running far ahead of the door, stop the backlog growing
       without bound: those people came and went while the tab was elsewhere. */
    if (S.pendingArrivals > 4) S.pendingArrivals = 4;
    /* If the door is quiet but the building should hold more than it does —
       after a tab switch, say — top up with people already inside. */
    state.spawnTimer -= dt;
    if (open && state.agents.length < want * 0.6 && state.spawnTimer <= 0 && L.exhibits.length) {
      state.spawnTimer = rng.range(0.3, 1.1);
      state.agents.push(spawn(rng, L, rng.pick(L.exhibits).x + rng.range(-110, 110)));
    }
    /* At closing time everyone drifts out. */
    if (!open) for (const a of state.agents)
      if (a.state !== "leave" && rng.chance(dt * 0.8)) {
        if (a.seat) { a.seat.taken = null; a.seat = null; }
        a.state = "leave";
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
      if (a.paid) { a.paid.t -= dt; if (a.paid.t <= 0) a.paid = null; }
      if (a.flash > 0) a.flash -= dt;
      a.chatCooldown -= dt;

      if (a.state === "enter") {
        /* Queue at the desk. People stack up behind whoever is being served. */
        /* Nobody dawdles on the way to a till, so the walk in is brisker than
           the amble round the galleries that follows it. */
        const rank = queueAhead(state, a);
        const target = DESK_X - 26 - rank * QUEUE_GAP;
        const d = target - a.x;
        const v = a.speed * 1.7;
        a.dir = d < 0 ? -1 : 1;
        a.x += Math.sign(d) * Math.min(Math.abs(d), v * dt);
        a.phase += v * dt * 0.62;
        if (rank === 0 && Math.abs(d) < 1.5) { a.state = "pay"; a.timer = rng.range(0.7, 1.6); }
      } else if (a.state === "pay") {
        a.timer -= dt;
        a.dir = 1;
        if (a.timer <= 0) {
          a.paid = { t: 1.5, life: 1.5, amount: S.admission };
          a.state = "walk";
          a.target = null;
          if (rng.chance(0.10)) say(state, a, S7.remarks.ambient(rng, a.type), 3.2);
        }
      } else if (a.state === "walk") {
        if (!a.target) {
          if (a.visits <= 0) { a.state = "leave"; continue; }
          a.target = chooseTarget(rng, L, a);
          if (!a.target) { a.state = "leave"; continue; }
        }
        const tx = a.target.x + a.groupOffset;
        const d = tx - a.x;
        a.dir = d < 0 ? -1 : 1;
        /* Cross the building at a purposeful pace; amble only when close. */
        const v = a.speed * (Math.abs(d) > 160 ? 1.45 : Math.abs(d) > 80 ? 1.15 : 1);
        a.x += Math.sign(d) * Math.min(Math.abs(d), v * dt);
        a.phase += v * dt * 0.55;
        /* drift toward the front of the band as they approach, so viewers do
           not all stand in a single line */
        a.z += (0.35 + (a.id % 7) / 12 - a.z) * dt * 0.6;
        if (Math.abs(d) < 1.5) {
          a.state = "view";
          if (!a.seen) a.seen = new Set();
          a.seen.add(a.target.a.no);
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
        if (a.target && !a.bubble && rng.chance(dt * 0.22))
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
      } else {                                   /* leaving, by the way they came in */
        const d = DOOR_X - 30 - a.x;
        a.dir = d < 0 ? -1 : 1;
        a.x += Math.sign(d) * Math.min(Math.abs(d), a.speed * 1.3 * dt);
        a.phase += a.speed * dt * 0.7;
        a.z += (0.86 - a.z) * dt * 0.8;
        if (a.x <= DOOR_X - 28) {
          if (a.seat) a.seat.taken = null;
          state.agents.splice(i, 1);
        }
      }
    }

    separate(state, dt);

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
      ticket: 1,
      doorTimer: 0,
      crowd: 0,
      overflow: 0,
      seeded: false,
    };
  }

  S7.visitors = {
    create, step, layout, getLayout, invalidate, reseat, place, roomAt, feetY, scaleOf,
    H, FLOOR_Y, WALK_NEAR, WALK_FAR, ROOM_PAD, DOOR, BENCH_Y, MAX_AGENTS,
    FOYER_W, DOOR_X, DESK_X, DESK_W,
  };
})(window.S7 = window.S7 || {});
