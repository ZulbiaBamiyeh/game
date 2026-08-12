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
     a bit over a third, which is roughly a gallery with a high ceiling.
     Multiple storeys stack: each floor is FLOOR_PITCH tall in world space. */
  const H = 170;                 /* logical height of one floor band */
  const FLOOR_PITCH = 178;       /* world-y step between storeys */
  const FLOOR_Y = 112;           /* where the back wall meets the floor (local) */
  const WALK_FAR = 118;          /* back of the walkable band, nearest the wall */
  const WALK_NEAR = 152;         /* front of it */
  const ROOM_PAD = 30;
  const MIN_ROOM = 220;
  const DOOR = 58;               /* the arch between two rooms */
  const BENCH_Y = 146;           /* where a bench stands on the floor (local) */
  const MAX_AGENTS = 56;
  const STAIRS_W = 88;

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
  function amenityRoom(id, name, period, width, x, floor, extra) {
    const benches = [{
      x: x + width / 2, y: BENCH_Y,
      seats: [x + width / 2 - 13, x + width / 2, x + width / 2 + 13]
        .map((sxx) => ({ x: sxx, taken: null })),
    }];
    const room = Object.assign({
      era: { id, name, period, short: name },
      x, width, floor: floor || 0, exhibits: [], items: [], benches, amenity: id,
    }, extra || {});
    /* Service points visitors walk to: shop till, café counter, tables. */
    if (id === "shop" || room.shop) {
      room.serviceX = x + width * 0.55;
      room.browseX = x + width * 0.32;
      room.staffX = x + width * 0.55;
    }
    if (id === "cafe" || room.cafe) {
      room.serviceX = x + 48;
      room.staffX = x + 48;
      const nTables = 1 + Math.min(4, (room.cafe || 1));
      room.tables = [];
      for (let i = 0; i < nTables; i++) {
        const tx = x + 100 + i * 36;
        if (tx > x + width - 24) break;
        room.tables.push({
          x: tx, y: BENCH_Y,
          seats: [tx - 10, tx + 10].map((sxx) => ({ x: sxx, taken: null })),
        });
        benches.push(room.tables[room.tables.length - 1]);
      }
    }
    return room;
  }

  function pushGalleryRoom(rooms, xRef, meta, items, floor, roomPad) {
    items.sort((a, b) => (a.slot === undefined ? a.depth : a.slot) -
                         (b.slot === undefined ? b.depth : b.slot));
    const x = xRef.x;
    const exhibits = [];
    let cx = x + ROOM_PAD;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      const phys = S7.artifacts.physical(a);
      let mount = a.kind === "painting" ? "wall" : a.kind === "sculpture" ? "plinth" : "case";
      if (meta.theme === "mineral") mount = a.kind === "sculpture" ? "plinth" : "case";
      if (meta.theme === "dino" && a.kind === "object" &&
          (a.objectType === "dinoBone" || a.objectType === "trackSlab" || a.objectType === "eggFossil"))
        mount = "plinth";
      exhibits.push({ a, x: cx + phys.w / 2, w: phys.w, h: phys.h, mount, index: i, phys });
      cx += phys.w;
    }
    const pad = roomPad || 0;
    const themePad = meta.theme ? 40 : 0;
    const width = Math.max(MIN_ROOM + pad + themePad, cx - x + ROOM_PAD + pad + themePad);
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
      era, x, width, floor: floor || 0, exhibits, items, benches,
      theme: meta.theme || null,
      featured: !!meta.theme,
    });
    xRef.x = x + width + DOOR;
  }

  function makeStairs(x, floor, toFloor) {
    return {
      era: {
        id: "stairs-" + floor + "-" + toFloor,
        name: floor === 0 ? "Grand stair" : "Landing",
        period: toFloor > floor ? "to the upper floor" : "to the ground floor",
        short: "Stairs",
      },
      x, width: STAIRS_W, floor, exhibits: [], items: [], benches: [],
      stairs: true, stairsTo: toFloor, amenity: "stairs",
      serviceX: x + STAIRS_W / 2,
    };
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
    /* upper floor: new id, but old saves with wing count as having a floor */
    const upperLvl = Math.max(up.upper || 0, up.wing ? 1 : 0);
    const hasUpper = upperLvl > 0;
    const deepLvl = up.deepgal || 0;
    const researchLvl = up.research || 0;
    const staffLvl = up.staff || up.guides || 0;
    const roomPad = upperLvl > 1 ? 12 + upperLvl * 8 : 0;

    const rooms = [];
    rooms.push({
      era: { id: "foyer", name: "Entrance hall", period: "admissions and cloakroom", short: "Entrance" },
      x: 0, width: FOYER_W, floor: 0, exhibits: [], items: [], benches: [
        { x: FOYER_W - 40, y: BENCH_Y,
          seats: [FOYER_W - 53, FOYER_W - 40, FOYER_W - 27].map((sxx) => ({ x: sxx, taken: null })) },
      ],
      foyer: true, doorX: DOOR_X, deskX: DESK_X, deskW: DESK_W,
      staffX: DESK_X,
    });

    const ground = { x: FOYER_W + DOOR };

    if (shopLvl > 0) {
      const sw = 180 + Math.min(6, shopLvl) * 14;
      rooms.push(amenityRoom("shop", "Gift shop", "postcards and pencils", sw, ground.x, 0, {
        shop: shopLvl, staff: staffLvl,
      }));
      ground.x += sw + DOOR;
    }

    if (cafeLvl > 0) {
      const cw = 190 + Math.min(6, cafeLvl) * 14;
      rooms.push(amenityRoom("cafe", "Café", "tea and cake", cw, ground.x, 0, {
        cafe: cafeLvl, staff: staffLvl,
      }));
      ground.x += cw + DOOR;
    }

    /* Collect gallery buckets in museum order. */
    const galleryBuckets = [];
    const placed = new Set();
    for (const g of S7.cultures.GALLERIES) {
      const items = byRoom.get(g.id);
      if (!items || !items.length) continue;
      galleryBuckets.push({ meta: g, items });
      placed.add(g.id);
    }
    for (const era of S7.cultures.ERAS) {
      if (placed.has(era.id)) continue;
      const items = byRoom.get(era.id);
      if (!items || !items.length) continue;
      galleryBuckets.push({
        meta: { id: era.id, name: era.name, period: era.period, short: era.name },
        items,
      });
      placed.add(era.id);
    }
    for (const [id, items] of byRoom) {
      if (placed.has(id) || id === "foyer" || id === "cafe") continue;
      if (String(id).indexOf("wing") === 0 || id === "deepgal") continue;
      galleryBuckets.push({ meta: { id, name: id, period: "", short: id }, items });
    }

    /* Skeleton mounts fold into the dinosaur bucket. */
    if (S7.skeletons) {
      const mounts = S7.skeletons.mountsFor(S);
      if (mounts.length) {
        let dino = galleryBuckets.find((b) => b.meta.id === "dinosaurs");
        if (!dino) {
          dino = {
            meta: S7.cultures.galleryById.dinosaurs || {
              id: "dinosaurs", name: "Hall of dinosaurs", period: "Mesozoic",
              short: "Dinosaurs", theme: "dino",
            },
            items: [],
          };
          galleryBuckets.unshift(dino);
        }
        dino.items = mounts.concat(dino.items);
      }
    }

    /* Split galleries across floors when the upper storey exists. */
    const split = hasUpper ? Math.ceil(galleryBuckets.length * 0.55) : galleryBuckets.length;
    const groundGals = galleryBuckets.slice(0, split);
    const upperGals = galleryBuckets.slice(split);

    for (const b of groundGals)
      pushGalleryRoom(rooms, ground, b.meta, b.items, 0, roomPad);

    /* Stairs at the end of the ground run when there is an upper floor. */
    let stairsX = ground.x;
    if (hasUpper) {
      rooms.push(makeStairs(ground.x, 0, 1));
      stairsX = ground.x;
      ground.x += STAIRS_W + DOOR;
    }

    /* Upper floor: landing, remaining halls, research, deep gallery. */
    if (hasUpper) {
      const upper = { x: stairsX };
      rooms.push(makeStairs(upper.x, 1, 0));
      upper.x += STAIRS_W + DOOR;

      for (const b of upperGals)
        pushGalleryRoom(rooms, upper, b.meta, b.items, 1, roomPad);

      if (researchLvl > 0) {
        const rw = 160 + Math.min(4, researchLvl) * 10;
        rooms.push(amenityRoom("research", "Research library", "desk and quiet", rw, upper.x, 1, {
          researchRoom: researchLvl, staff: staffLvl,
        }));
        upper.x += rw + DOOR;
      }

      if (deepLvl > 0) {
        const dw = 210 + Math.min(6, deepLvl) * 14;
        rooms.push(amenityRoom("deepgal", "The deep gallery", "low light · thick glass", dw, upper.x, 1, {
          deepgal: deepLvl,
        }));
        upper.x += dw + DOOR;
      }

      /* Empty upper landing if nothing upstairs yet except stairs. */
      if (upperGals.length === 0 && researchLvl <= 0 && deepLvl <= 0) {
        rooms.push(amenityRoom("landing", "Upper landing", "awaiting hang", 200, upper.x, 1, {
          wing: true, wingIndex: 0,
        }));
      }
    }

    if (!rooms.length) {
      return {
        rooms: [], exhibits: [], benches: [], stairs: [],
        total: VIEW_FALLBACK, totalH: H, floors: 1, H, FLOOR_Y, FLOOR_PITCH,
      };
    }

    let maxX = 0, maxFloor = 0;
    const exhibits = [], benches = [], stairs = [];
    for (const r of rooms) {
      maxX = Math.max(maxX, r.x + r.width);
      maxFloor = Math.max(maxFloor, r.floor || 0);
      if (r.stairs) stairs.push(r);
      for (const e of r.exhibits) { e.room = r; e.floor = r.floor || 0; exhibits.push(e); }
      for (const b of r.benches) { b.room = r; b.floor = r.floor || 0; benches.push(b); }
    }
    return {
      rooms, exhibits, benches, stairs,
      total: maxX,
      totalH: (maxFloor + 1) * FLOOR_PITCH,
      floors: maxFloor + 1,
      H, FLOOR_Y, FLOOR_PITCH,
    };
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
      ":r" + (u.research || 0) +
      ":u" + (u.upper || 0) +
      ":w" + (u.wing || 0) +
      ":d" + (u.deepgal || 0) +
      ":f" + (u.staff || u.guides || 0) +
      ":k" + sk;
    if (key !== cacheKey) { cacheKey = key; cache = layout(S); }
    return cache;
  }

  const invalidate = () => { cacheKey = ""; };

  /* Called when the collection changes enough that standing arrangements are
     stale — everyone re-picks a target rather than walking to a gap. Free seats
     and amenities so nobody is left walking at a vanished plinth forever. */
  function reseat(state) {
    for (const a of state.agents) {
      if (a.seat) { a.seat.taken = null; a.seat = null; }
      a.target = null;
      a.amenity = null;
      a.stuck = 0;
      a.stateAge = 0;
      /* Keep the queue intact — booting everyone mid-ticket jams the door. */
      if (a.state === "enter" || a.state === "pay") continue;
      if (a.state === "leave") continue;
      a.state = "walk";
      a.timer = 0;
    }
  }

  /* Soft reset when the floor plan itself is rebuilt (new wing, shop, rehang
     of many pieces). Refresh amenity goals onto the new room objects. */
  function onLayoutChanged(state, L) {
    for (const a of state.agents) {
      if (a.seat) { a.seat.taken = null; a.seat = null; }
      a.target = null;
      a.stuck = 0;
      if (a.amenity && a.amenity.kind) {
        const room = findAmenity(L, a.amenity.kind);
        if (!room) {
          a.amenity = null;
          if (a.state === "toAmenity" || a.state === "shop" || a.state === "cafe" ||
              a.state === "research") {
            a.state = a.visits <= 0 ? "leave" : "walk";
          }
        } else {
          a.amenity.room = room;
          if (a.amenity.kind === "shop")
            a.amenity.x = room.browseX || (room.x + room.width * 0.4);
          else if (a.amenity.kind === "cafe")
            a.amenity.x = room.serviceX || (room.x + 48);
          else
            a.amenity.x = room.x + room.width * 0.5;
        }
      }
      if (a.state === "toSeat" || a.state === "sit") {
        a.state = a.visits <= 0 ? "leave" : "walk";
        a.timer = 0;
      } else if (a.state === "walk" || a.state === "view") {
        a.state = "walk";
        a.timer = 0;
      }
    }
  }

  /* Which room contains a given strip x on a floor (default: any / floor 0). */
  function roomAt(L, x, floor) {
    const fl = floor === undefined ? null : floor;
    let best = null;
    for (const r of L.rooms) {
      if (fl !== null && (r.floor || 0) !== fl) continue;
      if (x >= r.x - DOOR / 2 && x <= r.x + r.width + DOOR / 2) best = r;
    }
    if (best) return best;
    /* Fallback: nearest room on that floor, or any. */
    let nearest = L.rooms[0], bestD = 1e9;
    for (const r of L.rooms) {
      if (fl !== null && (r.floor || 0) !== fl) continue;
      const cx = r.x + r.width / 2;
      const d = Math.abs(cx - x);
      if (d < bestD) { bestD = d; nearest = r; }
    }
    return nearest;
  }

  const floorBase = (floor) => (floor || 0) * FLOOR_PITCH;
  const worldY = (floor, localY) => floorBase(floor) + localY;

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
    /* Longer tours — a proper museum visit, not a glance at two plinths. */
    let base = Math.min(n, Math.max(6, galleryRooms + 3 + Math.floor(n * 0.28)));
    if (def.dwell) base = Math.round(base * 1.7);
    if (def.camera) base = Math.round(base * 1.3);
    if (def.stick) base = Math.round(base * 0.85);
    if (def.group || def.small) base = Math.round(base * 0.95);
    if (def.staff) base = Math.round(base * 1.8);
    return Math.max(4, Math.min(n, base + rng.int(-1, 4)));
  }

  /* `where` is a strip x for someone already inside; leave it out and they
     come in through the street doors and pay like everybody else. */
  function spawn(rng, L, where, ticket) {
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
      floor: 0,
      dir: 1,
      speed: (9 + rng.range(-2, 3)) * def.speed,
      state: arriving ? "enter" : "walk",
      /* Unique tickets for everyone — seeded crowd used to share ticket 0 and
         deadlock the admissions queue. */
      ticket: ticket === undefined ? nextId : ticket,
      paid: null,
      pose: 0,
      timer: 0,
      stuck: 0,
      stateAge: 0,
      target: null,
      climb: null,
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
      /* Amenity use — gift shop and café are real rooms with real tills. */
      didShop: false,
      didCafe: false,
      didResearch: false,
      amenity: null,   /* { room, kind: 'shop'|'cafe'|'research', x } */
    };
  }

  function softCapDwell(S) {
    return S7.museum.softCap(S.mul.dwell * (1 + S.add.dwell), 1.5);
  }

  function findAmenity(L, kind) {
    if (!L || !L.rooms) return null;
    for (const r of L.rooms) {
      if (kind === "shop" && r.shop) return r;
      if (kind === "cafe" && r.cafe) return r;
      if (kind === "research" && r.researchRoom) return r;
    }
    return null;
  }

  /* After looking at art, maybe go spend money — or before leaving.
     opts.shopOnly: last stop on the way out is the gift shop, not the café. */
  function maybeAmenity(rng, L, a, S, force, opts) {
    if (a.amenity) return false;
    opts = opts || {};
    const shop = findAmenity(L, "shop");
    const cafe = opts.shopOnly ? null : findAmenity(L, "cafe");
    const research = opts.shopOnly ? null : findAmenity(L, "research");
    const rates = S7.museum.amenityRates(S);
    /* Tourists shop more; elders café more; children want the shop.
       Scholars drift into the research room when it exists. */
    let shopP = rates.shop * (a.type === "tourist" ? 1.35 : a.type === "child" ? 1.25 : 1);
    let cafeP = rates.cafe * (a.type === "elder" ? 1.4 : a.type === "scholar" ? 0.85 : 1);
    let researchP = research
      ? (a.type === "scholar" ? 0.55 : a.type === "tourist" ? 0.08 : 0.12)
      : 0;
    if (force) { shopP *= 1.5; cafeP *= 1.5; researchP *= 1.3; }
    if (!a.didShop && shop && rng.chance(shopP)) {
      const bx = shop.browseX || (shop.x + shop.width * 0.4);
      /* Spread along the shelves so the whole crowd does not stack on one pixel. */
      a.amenity = { room: shop, kind: "shop", x: bx + rng.range(-28, 36) };
      a.state = "toAmenity";
      a.stateAge = 0;
      return true;
    }
    if (!a.didCafe && cafe && rng.chance(cafeP)) {
      const cx = cafe.serviceX || (cafe.x + 48);
      a.amenity = { room: cafe, kind: "cafe", x: cx + rng.range(-8, 20) };
      a.state = "toAmenity";
      a.stateAge = 0;
      return true;
    }
    if (!a.didResearch && research && rng.chance(researchP)) {
      a.amenity = {
        room: research, kind: "research",
        x: research.x + research.width * 0.35 + rng.range(0, research.width * 0.3),
      };
      a.state = "toAmenity";
      a.stateAge = 0;
      return true;
    }
    return false;
  }

  /* How many people are already queueing at the desk in front of this one.
     Ticket first, then id as a tie-break — equal tickets (seeded crowd all
     start at 0) used to all think they were first and jam the till forever. */
  function queueAhead(state, a) {
    let n = 0;
    for (const o of state.agents) {
      if (o === a) continue;
      if (o.state !== "enter" && o.state !== "pay") continue;
      if (o.ticket < a.ticket || (o.ticket === a.ticket && o.id < a.id)) n++;
    }
    return Math.min(n, QUEUE_MAX);
  }

  /* States where people must be allowed to stand on their mark — separation
     here is what freezes the admissions queue and packs at popular plinths. */
  function isAnchored(a) {
    return a.state === "sit" || a.state === "pay" || a.state === "view" ||
      a.state === "shop" || a.state === "cafe" || a.state === "research";
  }

  /* Nudge people out of each other. Without this a popular exhibit ends up
     with six visitors standing in exactly the same pixel. Anchored agents
     (viewing, paying, sitting) hold their ground so the queue and plinths
     do not deadlock. */
  function separate(state, dt) {
    const list = state.agents;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (isAnchored(a) || a.state === "climb") continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (isAnchored(b) || b.state === "climb") continue;
        if ((a.floor || 0) !== (b.floor || 0)) continue;
        /* Queueing visitors hold lane — only mild push along the line. */
        const queueing = (a.state === "enter" || b.state === "enter");
        const dz = Math.abs(a.z - b.z);
        if (dz > 0.16) continue;
        const dx = b.x - a.x;
        const gap = Math.abs(dx);
        const near = queueing ? PERSONAL * 0.7 : PERSONAL;
        if (gap > near || gap < 0.001) continue;
        const push = (near - gap) * dt * (queueing ? 1.1 : 2.2);
        const s2 = dx < 0 ? -1 : 1;
        a.x -= s2 * push;
        b.x += s2 * push;
        const zPush = (0.16 - dz) * dt * 1.4;
        if (a.z < b.z) { a.z -= zPush; b.z += zPush; } else { a.z += zPush; b.z -= zPush; }
        a.z = Math.max(0, Math.min(1, a.z));
        b.z = Math.max(0, Math.min(1, b.z));
      }
    }
  }

  /* Move toward a strip x. Widens the arrival radius if the agent has been
     fighting traffic, and snaps them forward if they make no progress — this
     is what stops permanent freezes at the desk, shop, and plinths.
     Progress is measured by closing distance to the goal (not raw |dx|),
     because separation can cancel a step without the agent ever "arriving". */
  function approach(a, goalX, dt, speedMul, baseArrive) {
    if (!isFinite(goalX)) return true;
    const d0 = goalX - a.x;
    const dist0 = Math.abs(d0);
    const arrive = (baseArrive || 1.5) + Math.min(22, (a.stuck || 0) * 3);
    if (dist0 <= arrive) {
      a.x = goalX;
      a.stuck = 0;
      return true;
    }
    const v = a.speed * (speedMul || 1);
    /* Long hauls across a big museum: pick up the pace so deep galleries
       are not a five-minute walk that looks like a freeze. */
    const hurry = dist0 > 400 ? 2.4 : dist0 > 200 ? 1.7 : dist0 > 100 ? 1.3 : 1;
    const step = Math.sign(d0) * Math.min(dist0, v * hurry * dt);
    a.x += step;
    a.dir = d0 < 0 ? -1 : 1;
    a.phase += v * dt * 0.55;
    const dist1 = Math.abs(goalX - a.x);
    if (dist1 < dist0 - 0.05) a.stuck = Math.max(0, (a.stuck || 0) - dt * 0.8);
    else a.stuck = (a.stuck || 0) + dt;
    /* Completely jammed: leap toward the goal rather than freeze forever. */
    if ((a.stuck || 0) > 3.5) {
      const leap = Math.min(dist1, 55 + a.stuck * 12);
      a.x += Math.sign(goalX - a.x) * leap;
      a.stuck = 1.5;
      if (Math.abs(goalX - a.x) <= arrive + 10) {
        a.x = goalX;
        a.stuck = 0;
        return true;
      }
    }
    return Math.abs(goalX - a.x) <= arrive;
  }

  /* Somewhere to sit, if there is one within a sensible walk on this floor. */
  function freeSeat(L, a) {
    let best = null, bestD = 300;
    const fl = a.floor || 0;
    for (const b of L.benches) {
      if ((b.floor || (b.room && b.room.floor) || 0) !== fl) continue;
      for (const seat of b.seats) {
        if (seat.taken !== null) continue;
        const d = Math.abs(seat.x - a.x);
        if (d < bestD) { bestD = d; best = seat; }
      }
    }
    return best;
  }

  const localFeetY = (a) => (a.state === "sit" || a.state === "climb"
    ? BENCH_Y : WALK_FAR + a.z * (WALK_NEAR - WALK_FAR));
  const feetY = (a) => worldY(a.floor || 0, localFeetY(a));
  const scaleOf = (a) => (0.82 + a.z * 0.30) * a.def.scale;

  function stairsOnFloor(L, floor) {
    if (!L || !L.stairs) return null;
    for (const s of L.stairs) if ((s.floor || 0) === (floor || 0)) return s;
    return null;
  }

  /* Pick the next stop on someone's tour. They keep a list of what they have
     already looked at, push deeper into the building early on, and only
     settle for nearby pieces once they have covered some ground — otherwise
     everyone piles up in the first gallery and never reaches the rest. */
  function chooseTarget(rng, L, a) {
    if (!L.exhibits.length) return null;
    if (!a.seen) a.seen = new Set();
    const unseen = L.exhibits.filter((e) => !a.seen.has(e.a.no));
    if (!unseen.length) return null;

    const myFloor = a.floor || 0;
    let minX = Infinity, maxX = -Infinity;
    for (const e of L.exhibits) {
      if (e.x < minX) minX = e.x;
      if (e.x > maxX) maxX = e.x;
    }
    const span = Math.max(80, maxX - minX);
    const total = Math.max(1, a.tourTotal || a.visits || 1);
    const done = Math.max(0, total - a.visits) / total;
    const ideal = minX + span * Math.min(1, 0.12 + done * 0.95 + rng.range(0, 0.12));

    let best = null, bestScore = -1e9;
    const samples = Math.min(unseen.length, 14);
    for (let i = 0; i < samples; i++) {
      const e = rng.pick(unseen);
      const eFloor = e.floor !== undefined ? e.floor : (e.room && e.room.floor) || 0;
      const dist = Math.abs(e.x - a.x) + (eFloor !== myFloor ? 220 : 0);
      let score = rng.range(0, 35);
      if (dist < 36 && eFloor === myFloor) score -= 120;
      else if (dist < 90) score -= 25;
      score -= Math.abs(e.x - ideal) * 0.18;
      if (e.x > a.x) score += 24 * (1 - done * 0.55);
      else score -= 6 * (1 - done);
      /* Prefer same floor early; later, send people upstairs. */
      if (eFloor === myFloor) score += 18;
      else if (done > 0.25) score += 22;
      else score -= 12;
      if (e.a.rarity.mult > 2) score += 32;
      if (e.a.rarity.mult > 3.5) score += 18;
      if (e.a.kind === "painting") score += 10;
      if (e.a.kind === "sculpture") score += 6;
      if (e.room && e.room.featured) score += 14;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  /* If the target is on another floor, route via the stairs first. */
  function routeToTarget(a, L, target) {
    if (!target) return false;
    const eFloor = target.floor !== undefined ? target.floor
      : (target.room && target.room.floor) || 0;
    if (eFloor === (a.floor || 0)) {
      a.target = target;
      return true;
    }
    const stairs = stairsOnFloor(L, a.floor || 0);
    if (!stairs) {
      a.target = target;
      return true;
    }
    a.climb = { toFloor: eFloor, after: target, stairs };
    a.state = "toStairs";
    a.target = null;
    a.stateAge = 0;
    return true;
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

  function releaseAgent(a) {
    if (a.seat) { a.seat.taken = null; a.seat = null; }
    a.amenity = null;
    a.target = null;
  }

  function step(state, S, dt, L) {
    const rng = state.rng;
    const sv = S7.museum.survey(S);
    const open = S7.museum.isOpen(S);

    /* Floor plan rebuilt (new find on show, shop bought, …) — refresh goals. */
    if (state.layoutRef !== L) {
      if (state.layoutRef) onLayoutChanged(state, L);
      state.layoutRef = L;
    }

    /* How many people are in the building right now: arrivals per minute times
       how long each one stays. A visitor who stays forty minutes and a door
       doing three a minute means a hundred and twenty people inside — more
       than the room can draw, so it is capped and the header says so. */
    const perMin = S7.museum.arrivalRate(S, sv);
    /* Longer dwell → fuller rooms. Soft-cap so late game still has a ceiling. */
    const dwellMinutes = 38 * S7.museum.softCap(S.mul.dwell * (1 + S.add.dwell), 1.7);
    const inside = open ? perMin * dwellMinutes : 0;
    const want = sv.count === 0 ? 0 : Math.min(MAX_AGENTS, Math.round(inside * 1.15));
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
        const a = spawn(rng, L, e.x + rng.range(-90, 90), state.ticket++);
        a.floor = e.floor !== undefined ? e.floor : ((e.room && e.room.floor) || 0);
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
      const a = spawn(rng, L, undefined, state.ticket++);
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
      state.agents.push(spawn(rng, L, rng.pick(L.exhibits).x + rng.range(-110, 110), state.ticket++));
    }
    /* At closing time everyone drifts out. */
    if (!open) for (const a of state.agents)
      if (a.state !== "leave" && rng.chance(dt * 0.8)) {
        releaseAgent(a);
        a.state = "leave";
      }
    while (state.agents.length > want + 6) {
      const gone = state.agents.pop();
      if (gone) releaseAgent(gone);
    }

    /* Separation first, then decisions — so approach gets the last word and
       can break traffic jams instead of being undone at the end of the frame. */
    separate(state, dt);

    for (let i = state.agents.length - 1; i >= 0; i--) {
      const a = state.agents[i];

      if (a.bubble) {
        a.bubble.t -= dt;
        if (a.bubble.t <= 0) a.bubble = null;
      }
      if (a.paid) { a.paid.t -= dt; if (a.paid.t <= 0) a.paid = null; }
      if (a.flash > 0) a.flash -= dt;
      a.chatCooldown -= dt;
      a.stateAge = (a.stateAge || 0) + dt;

      /* Safety: timed states must always have a finite timer. */
      if ((a.state === "pay" || a.state === "view" || a.state === "shop" ||
           a.state === "cafe" || a.state === "research" || a.state === "sit") &&
          !(a.timer > 0) && a.timer !== 0) {
        a.timer = 1;
      }

      if (a.state === "enter") {
        /* Queue at the desk. Ranked tickets, firm approach so traffic cannot
           freeze the till forever. */
        const rank = queueAhead(state, a);
        const target = DESK_X - 26 - rank * QUEUE_GAP;
        a.z += (0.78 - a.z) * dt * 0.8;
        if ((approach(a, target, dt, 1.7, 2.0) && rank === 0) ||
            (rank === 0 && (a.stateAge || 0) > 14)) {
          a.x = rank === 0 ? target : a.x;
          a.state = "pay";
          a.timer = rng.range(0.7, 1.6);
          a.stuck = 0;
          a.stateAge = 0;
        }
      } else if (a.state === "pay") {
        a.timer -= dt;
        a.dir = 1;
        if (a.timer <= 0) {
          a.paid = { t: 1.5, life: 1.5, amount: S.admission };
          a.state = "walk";
          a.target = null;
          a.stuck = 0;
          a.stateAge = 0;
          if (rng.chance(0.10)) say(state, a, S7.remarks.ambient(rng, a.type), 3.2);
        }
      } else if (a.state === "toStairs") {
        const st = a.climb && a.climb.stairs;
        if (!st) { a.climb = null; a.state = "walk"; continue; }
        const gx = st.serviceX || (st.x + st.width / 2);
        a.z += (0.5 - a.z) * dt * 0.8;
        if (approach(a, gx, dt, 1.3, 3) || (a.stateAge || 0) > 16) {
          a.x = gx;
          a.state = "climb";
          a.timer = rng.range(1.4, 2.4);
          a.stateAge = 0;
          a.stuck = 0;
        }
      } else if (a.state === "climb") {
        a.timer -= dt;
        a.phase += dt * 3;
        /* Bob on the stairs */
        a.z = 0.45 + Math.sin(a.phase * 4) * 0.08;
        if (a.timer <= 0) {
          const to = a.climb ? a.climb.toFloor : 0;
          const after = a.climb ? a.climb.after : null;
          a.floor = to;
          const land = stairsOnFloor(L, to);
          if (land) a.x = land.serviceX || (land.x + land.width / 2);
          a.climb = null;
          a.stuck = 0;
          a.stateAge = 0;
          if (after) {
            a.target = after;
            a.state = "walk";
          } else {
            a.state = a.visits <= 0 ? "leave" : "walk";
          }
        }
      } else if (a.state === "walk") {
        if (!a.target || !a.target.a || !isFinite(a.target.x)) {
          a.target = null;
          if (a.visits <= 0) {
            if ((a.floor || 0) > 0) {
              /* Go down before leaving. */
              const st = stairsOnFloor(L, a.floor);
              if (st) {
                a.climb = { toFloor: 0, after: null, stairs: st };
                a.state = "toStairs";
                a.stateAge = 0;
                continue;
              }
            }
            if (maybeAmenity(rng, L, a, S, true)) continue;
            a.state = "leave"; a.stateAge = 0; continue;
          }
          /* Mid-tour: sometimes peel off to the shop or café (ground floor). */
          if (a.visits <= Math.max(2, (a.tourTotal || 4) * 0.35) &&
              (a.floor || 0) === 0 &&
              maybeAmenity(rng, L, a, S, false)) continue;
          const next = chooseTarget(rng, L, a);
          if (!next) {
            if (maybeAmenity(rng, L, a, S, true)) continue;
            a.state = "leave"; a.stateAge = 0; continue;
          }
          routeToTarget(a, L, next);
          if (a.state === "toStairs") continue;
          a.stuck = 0;
          a.stateAge = 0;
        }
        /* Target on another floor mid-walk (layout change) — re-route. */
        if (a.target) {
          const tf = a.target.floor !== undefined ? a.target.floor
            : (a.target.room && a.target.room.floor) || 0;
          if (tf !== (a.floor || 0)) {
            routeToTarget(a, L, a.target);
            if (a.state === "toStairs") continue;
          }
        }
        const tx = a.target.x + a.groupOffset;
        a.z += (0.35 + (a.id % 7) / 12 - a.z) * dt * 0.6;
        if (approach(a, tx, dt, 1.15, 2.0) || (a.stateAge || 0) > 25) {
          /* Arrive — or give up after a long trek and pretend we saw it. */
          if ((a.stateAge || 0) > 25 && Math.abs(tx - a.x) > 30) a.x = tx;
          a.state = "view";
          a.stuck = 0;
          a.stateAge = 0;
          if (!a.seen) a.seen = new Set();
          a.seen.add(a.target.a.no);
          a.timer = rng.range(3, 8) * (a.def.dwell || 1);
          if (rng.chance(0.62))
            say(state, a, S7.remarks.forExhibit(rng, a.target.a, a.type), rng.range(3.4, 5.4));
          if ((a.def.camera || a.sprite.look.camera) && rng.chance(0.55)) {
            a.flash = 0.5;
            if (rng.chance(0.4)) say(state, a, S7.remarks.forExhibit(rng, a.target.a, "tourist"), 3.6);
          }
        } else if ((a.stuck || 0) > 6) {
          /* Give up on this piece and pick another rather than freeze. */
          if (a.target && a.target.a) a.seen.add(a.target.a.no);
          a.target = null;
          a.stuck = 0;
          a.stateAge = 0;
          a.visits = Math.max(0, a.visits - 1);
        }
      } else if (a.state === "view") {
        a.timer -= dt;
        if (a.target && !a.bubble && rng.chance(dt * 0.22))
          say(state, a, S7.remarks.forExhibit(rng, a.target.a, a.type), rng.range(3.2, 5));
        if (a.timer <= 0) {
          a.visits--;
          a.target = null;
          a.stuck = 0;
          a.stateAge = 0;
          if (a.visits <= 0) {
            if (!maybeAmenity(rng, L, a, S, true)) a.state = "leave";
          } else if (rng.chance(a.restWish)) {
            const seat = freeSeat(L, a);
            if (seat) { seat.taken = a.id; a.seat = seat; a.state = "toSeat"; a.stateAge = 0; }
            else if (!maybeAmenity(rng, L, a, S, false)) a.state = "walk";
          } else if (!maybeAmenity(rng, L, a, S, false)) a.state = "walk";
        }
      } else if (a.state === "toAmenity") {
        if (!a.amenity || !isFinite(a.amenity.x)) {
          a.amenity = null;
          a.state = a.visits <= 0 ? "leave" : "walk";
          a.stateAge = 0;
          continue;
        }
        a.z += (0.55 - a.z) * dt * 0.8;
        const arrived = approach(a, a.amenity.x, dt, 1.35, 2.5) || (a.stateAge || 0) > 18;
        if (arrived) {
          if ((a.stateAge || 0) > 18) a.x = a.amenity.x;
          a.stuck = 0;
          a.stateAge = 0;
          if (a.amenity.kind === "shop") {
            a.state = "shop";
            a.timer = rng.range(2.5, 5.5);
            if (rng.chance(0.55))
              say(state, a, rng.pick([
                "I need a postcard.", "Is there a book on the dinosaurs?",
                "Pencils. Always pencils.", "This magnet is going on the fridge.",
                "How much for the guide?", "I'm getting one for my sister.",
              ]), 3.2);
          } else if (a.amenity.kind === "cafe") {
            const room = a.amenity.room;
            let seat = null;
            if (room && room.tables) {
              for (const t of room.tables) {
                for (const s of t.seats) if (s.taken === null) { seat = s; break; }
                if (seat) break;
              }
            }
            if (seat) {
              seat.taken = a.id; a.seat = seat;
              a.state = "toSeat";
              a.amenity.phase = "cafeSit";
            } else {
              a.state = "cafe";
              a.timer = rng.range(4, 9) * softCapDwell(S);
              if (rng.chance(0.5))
                say(state, a, rng.pick([
                  "Tea, please.", "Is the cake homemade?", "One coffee — black.",
                  "Can we sit by the window?", "I'm starving after all those rooms.",
                ]), 3.0);
            }
          } else if (a.amenity.kind === "research") {
            a.state = "research";
            a.timer = rng.range(6, 14) * (a.def.dwell || 1);
            if (rng.chance(0.6))
              say(state, a, rng.pick([
                "May I see the notes on this culture?",
                "Quiet. Perfect.",
                "The accession book is better than the labels.",
                "I'll only be a minute.",
              ]), 3.4);
          } else {
            a.state = a.visits <= 0 ? "leave" : "walk";
            a.amenity = null;
          }
        } else if ((a.stuck || 0) > 7) {
          /* Amenity unreachable — skip it and resume the tour. */
          if (a.amenity.kind === "shop") a.didShop = true;
          if (a.amenity.kind === "cafe") a.didCafe = true;
          if (a.amenity.kind === "research") a.didResearch = true;
          a.amenity = null;
          a.stuck = 0;
          a.stateAge = 0;
          a.state = a.visits <= 0 ? "leave" : "walk";
        }
      } else if (a.state === "shop") {
        a.timer -= dt;
        if (a.amenity && a.amenity.room && isFinite(a.amenity.room.serviceX))
          approach(a, a.amenity.room.serviceX, dt, 0.55, 3);
        if (a.timer <= 0 || (a.stateAge || 0) > 12) {
          const amount = S7.museum.shopSpend(S, sv) * rng.range(0.7, 1.35);
          S7.game.amenitySale(S, amount, "shop");
          a.paid = { t: 1.6, life: 1.6, amount };
          a.didShop = true;
          a.amenity = null;
          a.stuck = 0;
          a.stateAge = 0;
          if (rng.chance(0.4))
            say(state, a, rng.pick([
              "Receipt in the bag.", "Worth it.", "Don't tell my other half.",
            ]), 2.8);
          a.state = a.visits <= 0 ? "leave" : "walk";
        }
      } else if (a.state === "cafe") {
        a.timer -= dt;
        if (!a.bubble && rng.chance(dt * 0.12))
          say(state, a, rng.pick([
            "This tea is decent.", "I needed to sit down.",
            "The scone is the real exhibition.", "Shall we do one more gallery?",
          ]), 3.2);
        if (a.timer <= 0 || (a.stateAge || 0) > 20) {
          const amount = S7.museum.cafeSpend(S, sv) * rng.range(0.75, 1.3);
          S7.game.amenitySale(S, amount, "cafe");
          a.paid = { t: 1.6, life: 1.6, amount };
          a.didCafe = true;
          a.amenity = null;
          a.stuck = 0;
          a.stateAge = 0;
          a.state = a.visits <= 0 ? "leave" : "walk";
        }
      } else if (a.state === "research") {
        a.timer -= dt;
        if (!a.bubble && rng.chance(dt * 0.08))
          say(state, a, rng.pick([
            "Hmm.", "Page forty-seven…", "That stratigraphy still bothers me.",
          ]), 2.6);
        if (a.timer <= 0 || (a.stateAge || 0) > 22) {
          a.didResearch = true;
          a.amenity = null;
          a.stuck = 0;
          a.stateAge = 0;
          a.state = a.visits <= 0 ? "leave" : "walk";
        }
      } else if (a.state === "toSeat") {
        if (!a.seat || !isFinite(a.seat.x)) {
          if (a.seat) a.seat.taken = null;
          a.seat = null;
          a.state = a.visits <= 0 ? "leave" : "walk";
          a.stateAge = 0;
          continue;
        }
        a.z += (0.92 - a.z) * dt * 1.2;
        if (approach(a, a.seat.x, dt, 1.1, 1.8) || (a.stateAge || 0) > 12) {
          a.x = a.seat.x;
          a.state = "sit";
          a.stuck = 0;
          a.stateAge = 0;
          const cafeSit = a.amenity && a.amenity.phase === "cafeSit";
          a.timer = cafeSit
            ? rng.range(8, 20) * softCapDwell(S) * (a.def.stick ? 1.4 : 1)
            : rng.range(9, 26) * (a.def.stick ? 1.5 : 1);
        } else if ((a.stuck || 0) > 5) {
          if (a.seat) a.seat.taken = null;
          a.seat = null;
          a.stuck = 0;
          a.stateAge = 0;
          if (a.amenity && a.amenity.phase === "cafeSit") {
            a.state = "cafe";
            a.timer = rng.range(4, 8) * softCapDwell(S);
          } else {
            a.state = a.visits <= 0 ? "leave" : "walk";
          }
        }
      } else if (a.state === "sit") {
        a.timer -= dt;
        if (!a.bubble && rng.chance(dt * 0.10)) say(state, a, S7.remarks.ambient(rng, a.type), rng.range(3.2, 5));
        if (a.timer <= 0 || (a.stateAge || 0) > 40) {
          const wasCafe = a.amenity && a.amenity.phase === "cafeSit";
          if (a.seat) { a.seat.taken = null; a.seat = null; }
          if (wasCafe) {
            const amount = S7.museum.cafeSpend(S, sv) * rng.range(0.8, 1.35);
            S7.game.amenitySale(S, amount, "cafe");
            a.paid = { t: 1.6, life: 1.6, amount };
            a.didCafe = true;
            a.amenity = null;
            if (rng.chance(0.45))
              say(state, a, rng.pick([
                "That hit the spot.", "Right — back to the art.", "Bill paid.",
              ]), 2.8);
          }
          a.restWish *= 0.35;
          a.stuck = 0;
          a.stateAge = 0;
          a.state = a.visits <= 0 ? "leave" : "walk";
        }
      } else {                                   /* leaving */
        if ((a.floor || 0) > 0) {
          const st = stairsOnFloor(L, a.floor);
          if (st) {
            a.climb = { toFloor: 0, after: null, stairs: st };
            a.state = "toStairs";
            a.stateAge = 0;
            continue;
          }
          a.floor = 0;
        }
        /* Last chance at the gift shop on the way out — shop only, not café. */
        if (!a.didShop && !a.leavingShopTried) {
          a.leavingShopTried = true;
          if (maybeAmenity(rng, L, a, S, true, { shopOnly: true })) continue;
          a.amenity = null;
          a.state = "leave";
          a.stateAge = 0;
        }
        a.z += (0.86 - a.z) * dt * 0.8;
        if (approach(a, DOOR_X - 30, dt, 1.45, 3.0) || a.x <= DOOR_X - 28 ||
            (a.stateAge || 0) > 30) {
          releaseAgent(a);
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
          const samePiece = a.target && a.target === b.target;
          const lines = samePiece && rng.chance(0.62)
            ? S7.remarks.pair(rng, a.target.a)
            : samePiece && rng.chance(0.5)
              ? [S7.remarks.forExhibit(rng, a.target.a, a.type),
                 S7.remarks.forExhibit(rng, b.target.a, b.type)]
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
      layoutRef: null,
    };
  }

  S7.visitors = {
    create, step, layout, getLayout, invalidate, reseat, place, roomAt, feetY, scaleOf,
    floorBase, worldY, stairsOnFloor, localFeetY,
    H, FLOOR_Y, FLOOR_PITCH, WALK_NEAR, WALK_FAR, ROOM_PAD, DOOR, BENCH_Y, MAX_AGENTS,
    FOYER_W, DOOR_X, DESK_X, DESK_W, STAIRS_W,
  };
})(window.S7 = window.S7 || {});
