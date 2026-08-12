/* ============================================================================
   SKELETON KITS

   Dinosaurs are not single finds. They come out of the deposit bone by bone.
   Collect every part of a kit and the museum can mount a complete skeleton —
   the showpiece that makes the Hall of Dinosaurs worth the dig.

   Parts are ordinary accessioned artifacts with `skeletonId` + `skeletonPart`.
   Completion is derived from the collection; a virtual mounted exhibit is
   injected into the gallery layout when a kit is finished.
   ============================================================================ */
(function (S7) {
  "use strict";

  const PARTS = {
    skull:    { id: "skull",    label: "Skull",            kind: "sculpture", carver: "dinoSkull",   size: 48, sig: 95 },
    jaw:      { id: "jaw",      label: "Lower jaw",        kind: "object", objectType: "dinoJaw",     size: 28, sig: 40 },
    cervical: { id: "cervical", label: "Neck vertebrae",   kind: "object", objectType: "dinoVert",    size: 22, sig: 32 },
    dorsal:   { id: "dorsal",   label: "Back vertebrae",   kind: "object", objectType: "dinoVert",    size: 24, sig: 34 },
    ribs:     { id: "ribs",     label: "Rib cage",         kind: "object", objectType: "dinoRib",     size: 34, sig: 38 },
    pelvis:   { id: "pelvis",   label: "Pelvis",           kind: "object", objectType: "dinoPelvis",  size: 36, sig: 48 },
    femur:    { id: "femur",    label: "Femur",            kind: "object", objectType: "dinoFemur",   size: 40, sig: 46 },
    tibia:    { id: "tibia",    label: "Tibia",            kind: "object", objectType: "dinoTibia",   size: 34, sig: 38 },
    humerus:  { id: "humerus",  label: "Humerus",          kind: "object", objectType: "dinoHumerus", size: 30, sig: 36 },
    claw:     { id: "claw",     label: "Pedal claw",       kind: "object", objectType: "dinoClaw",    size: 20, sig: 28 },
    tail:     { id: "tail",     label: "Tail series",      kind: "object", objectType: "dinoTail",    size: 38, sig: 40 },
    scythe:   { id: "scythe",   label: "Sickle claw",      kind: "object", objectType: "dinoClaw",    size: 22, sig: 42 },
  };

  const KITS = [
    {
      id: "tyrant",
      name: "Tyrant theropod",
      short: "Tyrant",
      mountName: "Mounted tyrant skeleton",
      period: "Late Cretaceous",
      cultures: ["cretaceous"],
      w: 40,
      parts: ["skull", "jaw", "cervical", "dorsal", "ribs", "pelvis", "femur", "tibia", "humerus", "claw", "tail"],
      mountSig: 520,
      mountH: 94,
    },
    {
      id: "longneck",
      name: "Long-neck sauropod",
      short: "Sauropod",
      mountName: "Mounted sauropod skeleton",
      period: "Late Jurassic",
      cultures: ["jurassic", "cretaceous"],
      w: 32,
      parts: ["skull", "cervical", "dorsal", "ribs", "pelvis", "femur", "tibia", "humerus", "tail"],
      mountSig: 480,
      mountH: 96,
    },
    {
      id: "raptor",
      name: "Sickle-claw raptor",
      short: "Raptor",
      mountName: "Mounted raptor skeleton",
      period: "Cretaceous",
      cultures: ["cretaceous", "jurassic"],
      w: 28,
      parts: ["skull", "jaw", "cervical", "dorsal", "ribs", "pelvis", "femur", "tibia", "scythe", "tail"],
      mountSig: 400,
      mountH: 72,
    },
    {
      id: "plateback",
      name: "Plate-backed herbivore",
      short: "Plateback",
      mountName: "Mounted plated herbivore",
      period: "Late Jurassic",
      cultures: ["jurassic", "triassic"],
      w: 22,
      parts: ["skull", "dorsal", "ribs", "pelvis", "femur", "tibia", "tail", "humerus"],
      mountSig: 360,
      mountH: 78,
    },
  ];

  const byId = {};
  for (const k of KITS) byId[k.id] = k;

  function partDef(id) { return PARTS[id]; }

  function kitsForCulture(cultureId) {
    return KITS.filter((k) => k.cultures.indexOf(cultureId) >= 0);
  }

  /* Which parts of each kit the player already holds. */
  function heldMap(S) {
    const map = {};
    for (const a of S.collection) {
      if (!a.skeletonId || !a.skeletonPart) continue;
      if (!map[a.skeletonId]) map[a.skeletonId] = new Set();
      map[a.skeletonId].add(a.skeletonPart);
    }
    return map;
  }

  function progress(S) {
    const held = heldMap(S);
    return KITS.map((kit) => {
      const have = held[kit.id] || new Set();
      const parts = kit.parts.map((pid) => {
        const p = PARTS[pid];
        return { id: pid, label: p.label, have: have.has(pid) };
      });
      const n = parts.filter((p) => p.have).length;
      return {
        kit, parts, have: n, want: kit.parts.length,
        complete: n >= kit.parts.length,
      };
    });
  }

  /* Rating bonus: each complete skeleton is a destination exhibit.
     Parts still on display add a little; the full mount is the jackpot. */
  function ratingBonus(S) {
    const held = heldMap(S);
    const shown = new Set();
    for (const a of S.collection) {
      if (a.display === false) continue;
      if (a.skeletonId && a.skeletonPart) shown.add(a.skeletonId + ":" + a.skeletonPart);
    }
    let bonus = 0;
    const complete = [];
    for (const kit of KITS) {
      const have = held[kit.id] || new Set();
      if (have.size < kit.parts.length) {
        /* Partial credit so collecting bones still feels good. */
        bonus += have.size * 8;
        continue;
      }
      let onShow = 0;
      for (const pid of kit.parts)
        if (shown.has(kit.id + ":" + pid)) onShow++;
      /* Full set accessioned: big bonus. All parts on the floor: even bigger. */
      const mounted = onShow >= kit.parts.length;
      bonus += kit.mountSig * (mounted ? 1 : 0.72);
      complete.push({ kit, mounted });
    }
    return { bonus, complete };
  }

  /* Pseudo-artifacts for the gallery: one monumental mount per finished kit. */
  function mountsFor(S) {
    const held = heldMap(S);
    const out = [];
    for (const kit of KITS) {
      const have = held[kit.id] || new Set();
      if (have.size < kit.parts.length) continue;
      /* Prefer to show the mount if any part of the kit is on display (or all stored still show mount in hall). */
      let anyShown = false, allShown = true;
      for (const pid of kit.parts) {
        const piece = S.collection.find((a) => a.skeletonId === kit.id && a.skeletonPart === pid);
        if (!piece || piece.display === false) allShown = false;
        else anyShown = true;
      }
      if (!anyShown && !allShown) {
        /* If everything is in store, still allow mount if complete — museum owns it. */
      }
      const a = {
        seed: S7.hashString("mount:" + kit.id + ":" + (S.seed || 0)),
        depth: 520,
        cultureId: kit.cultures[0],
        kind: "sculpture",
        objectType: null,
        material: "bone",
        condition: S7.artifacts.CONDITIONS.find((c) => c.id === "excep"),
        rarity: S7.artifacts.RARITIES.find((r) => r.id === "unique"),
        name: kit.mountName,
        notes: "Assembled from " + kit.parts.length + " separately recovered elements of the " +
               kit.name + ". Mounted for display — the Hall of Dinosaurs' reason for existing.",
        significance: kit.mountSig,
        no: "SK-" + kit.id.toUpperCase(),
        skeletonMount: kit.id,
        skeletonId: kit.id,
        display: true,
        readings: [{ t: "A complete mounted skeleton", ok: true }],
        boon: null,
        _phys: { h: kit.mountH, w: Math.round(kit.mountH * 1.35) + 30, monumental: true },
      };
      out.push(a);
    }
    return out;
  }

  /* Roll a skeleton part for a dinosaur-culture find. Prefers parts the player
     does not yet hold, so progress is visible rather than a stream of femurs. */
  function rollPart(rng, cultureId, heldMapIn) {
    const kits = kitsForCulture(cultureId);
    if (!kits.length) return null;
    const kit = rng.weighted(kits, (k) => k.w);
    const held = (heldMapIn && heldMapIn[kit.id]) || new Set();
    const missing = kit.parts.filter((p) => !held.has(p));
    const pool = missing.length && rng.chance(0.78) ? missing : kit.parts;
    const partId = rng.pick(pool);
    const part = PARTS[partId];
    return { kit, part, partId };
  }

  S7.skeletons = {
    KITS, PARTS, byId, partDef, kitsForCulture, heldMap, progress,
    ratingBonus, mountsFor, rollPart,
  };
})(window.S7 = window.S7 || {});
