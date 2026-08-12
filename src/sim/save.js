/* ============================================================================
   SAVE / LOAD

   The save is small on purpose. Artifacts go to disk as {seed, depth, kind,
   culture, condition id, rarity id, boon, display} and are rehydrated by
   re-running the same generators — art, name and field notes all come back
   byte-identical because they were never anything but functions of the seed.
   ============================================================================ */
(function (S7) {
  "use strict";

  const KEY = "site7.save.v3";

  function packArtifact(a) {
    return {
      s: a.seed, d: a.depth, c: a.cultureId, k: a.kind, o: a.objectType,
      m: a.material, cd: a.condition.id, r: a.rarity.id, n: a.no,
      b: a.boon, disp: a.display !== false, ks: !!a.keystone,
      rm: a.room, sl: a.slot,
      nm: a.keystone ? a.name : undefined, nt: a.keystone ? a.notes : undefined,
    };
  }

  function unpackArtifact(p) {
    const a = S7.artifacts.makeArtifact(p.s, p.d, {
      culture: p.c, kind: p.k, objectType: p.o,
      condition: p.cd, rarity: p.r,
      name: p.nm, notes: p.nt, keystone: p.ks,
    });
    a.no = p.n;
    a.display = p.disp !== false;
    if (p.rm) a.room = p.rm;
    if (p.sl !== undefined) a.slot = p.sl;
    /* The boon was rolled once and is authoritative — never re-roll on load,
       or a save would silently change the player's build. */
    if (p.b) a.boon = p.b;
    if (p.m) a.material = p.m;
    return a;
  }

  function serialise(S) {
    return {
      v: S7.state.VERSION,
      seed: S.seed, started: S.started, intro: S.intro,
      depth: S.depth, funds: S.funds, understanding: S.understanding, sites: S.sites,
      day: S.day, minute: S.minute, admission: S.admission,
      today: S.today, yesterday: S.yesterday, history: S.history,
      up: S.up, research: S.research,
      stamina: S.stamina, stamTimer: S.stamTimer,
      collection: S.collection.map(packArtifact),
      nextFindAt: S.nextFindAt, accession: S.accession, keyIdx: S.keyIdx,
      stats: S.stats, milestones: S.milestones,
      log: S.log.slice(0, 40),
      lastSeen: Date.now(),
      tab: S.tab,
    };
  }

  function deserialise(raw) {
    const S = S7.state.fresh(raw.seed || 1);
    S.started = !!raw.started;
    S.intro = raw.intro || 0;
    S.depth = raw.depth || 0;
    S.funds = raw.funds || 0;
    S.understanding = raw.understanding || 0;
    S.sites = raw.sites || 1;
    S.day = raw.day || 1;
    S.minute = raw.minute === undefined ? 9 * 60 - 12 : raw.minute;
    S.admission = raw.admission === undefined ? 4 : raw.admission;
    if (raw.today) S.today = raw.today;
    S.yesterday = raw.yesterday || null;
    S.history = raw.history || [];
    Object.assign(S.up, raw.up || {});
    S.research = raw.research || {};
    S.collection = (raw.collection || []).map(unpackArtifact);
    S.nextFindAt = raw.nextFindAt || 4;
    S.accession = raw.accession || S.collection.length;
    S.keyIdx = raw.keyIdx || 0;
    Object.assign(S.stats, raw.stats || {});
    S.milestones = raw.milestones || {};
    S.log = raw.log || [];
    S.lastSeen = raw.lastSeen || Date.now();
    S.tab = raw.tab || "site";
    S7.state.recompute(S);
    S.stamina = Math.min(S.maxStam, raw.stamina === undefined ? S.maxStam : raw.stamina);
    S.stamTimer = raw.stamTimer || 0;
    return S;
  }

  function save(S) {
    try {
      localStorage.setItem(KEY, JSON.stringify(serialise(S)));
      return true;
    } catch (e) {
      return false;                 /* private browsing, quota, file:// — carry on */
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== S7.state.VERSION) return null;
      return { state: deserialise(data), away: (Date.now() - (data.lastSeen || Date.now())) / 1000 };
    } catch (e) {
      return null;
    }
  }

  function wipe() {
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
  }

  function exportText(S) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(serialise(S)))));
  }

  function importText(text) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
      if (!data || data.v !== S7.state.VERSION) return null;
      return deserialise(data);
    } catch (e) {
      return null;
    }
  }

  S7.save = { KEY, save, load, wipe, serialise, deserialise, exportText, importText };
})(window.S7 = window.S7 || {});
