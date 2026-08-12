/* ============================================================================
   AMBIENCE

   Everything else in this game is generated rather than shipped, so the
   music is too: soft generative loops built from oscillators and a
   synthesised reverb impulse, no audio files anywhere. Each tab has its own
   character — the shaft is low and a little tense, the museum is warm and
   spacious, research is brighter and more studious — and switching tabs
   glides between them rather than cutting.
   ============================================================================ */
(function (S7) {
  "use strict";

  const MUTE_KEY = "s7-audio-muted";

  /* Each zone: a root note (MIDI), a scale (semitone offsets), a filter
     cutoff for its mood, and rough timing for how often the pad and the
     chime speak. Kept sparse throughout so nothing ever lands on a wrong
     note no matter which two zones a crossfade catches mid-chord. */
  const ZONES = {
    site: {
      root: 33, scale: [0, 2, 3, 5, 7, 8, 10], filterHz: 850,
      pad: [4500, 8000], chime: [12000, 19000], chimeChance: 0.35,
    },
    museum: {
      root: 38, scale: [0, 2, 3, 7, 9, 12, 14], filterHz: 1500,
      pad: [3500, 7000], chime: [9000, 21000], chimeChance: 0.7,
    },
    research: {
      root: 43, scale: [0, 2, 4, 7, 9, 11, 12], filterHz: 2000,
      pad: [3000, 6000], chime: [7000, 15000], chimeChance: 0.55,
    },
  };

  let ctx = null, master = null, filter = null, reverb = null;
  let droneGain = null, droneOsc = [];
  let started = false, enabled = true, zone = null;
  let padTimer = null, chimeTimer = null;

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const zoneCfg = () => ZONES[zone];

  /* A cheap algorithmic reverb: exponentially decaying noise, no IR file. */
  function makeReverb(seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    const node = ctx.createConvolver();
    node.buffer = buf;
    return node;
  }

  function voiceOut(node) {
    node.connect(filter);
    node.connect(reverb);
  }

  function startDrone() {
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.06;
    voiceOut(droneGain);
    const cfg = zoneCfg() || ZONES.site;
    droneOsc = [cfg.root, cfg.root + 7].map((note, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = midiToFreq(note);
      o.detune.value = (i - 0.5) * 6;
      o.connect(droneGain);
      o.start();
      return o;
    });
  }

  /* Glides the drone and the filter to the new zone's register and mood
     instead of cutting, so moving between tabs feels like walking from one
     room into another rather than switching a track. */
  function glideTo(cfg) {
    const now = ctx.currentTime;
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setTargetAtTime(cfg.filterHz, now, 1.4);
    const notes = [cfg.root, cfg.root + 7];
    droneOsc.forEach((o, i) => {
      o.frequency.cancelScheduledValues(now);
      o.frequency.setTargetAtTime(midiToFreq(notes[i]), now, 1.8);
    });
  }

  function playPad() {
    if (!ctx || !zone) return;
    const cfg = zoneCfg();
    const freq = midiToFreq(cfg.root + 12 + pick(cfg.scale));
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = Math.random() < 0.5 ? "triangle" : "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 2.2);
    g.gain.linearRampToValueAtTime(0, now + 7);
    o.connect(g);
    voiceOut(g);
    o.start(now);
    o.stop(now + 7.2);
  }

  function schedulePad() {
    if (enabled && zone) playPad();
    const cfg = zoneCfg() || ZONES.museum;
    padTimer = setTimeout(schedulePad, cfg.pad[0] + Math.random() * (cfg.pad[1] - cfg.pad[0]));
  }

  function playChime() {
    if (!ctx || !zone) return;
    const cfg = zoneCfg();
    const freq = midiToFreq(cfg.root + 24 + pick(cfg.scale));
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    o.connect(g);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() * 2 - 1) * 0.6;
      g.connect(pan);
      pan.connect(filter);
      pan.connect(reverb);
    } else {
      voiceOut(g);
    }
    o.start(now);
    o.stop(now + 3.4);
  }

  function scheduleChime() {
    const cfg = zoneCfg();
    if (enabled && zone && cfg && Math.random() < cfg.chimeChance) playChime();
    const c = cfg || ZONES.museum;
    chimeTimer = setTimeout(scheduleChime, c.chime[0] + Math.random() * (c.chime[1] - c.chime[0]));
  }

  function ensureCtx() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = (zoneCfg() || ZONES.site).filterHz;
    filter.connect(master);

    reverb = makeReverb(3.2, 2.6);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.55;
    reverb.connect(reverbGain);
    reverbGain.connect(master);

    startDrone();
    schedulePad();
    scheduleChime();
  }

  function updateMasterGain() {
    if (!ctx) return;
    const target = enabled && zone ? 0.55 : 0;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(target, ctx.currentTime, 1.2);
  }

  function unlock() {
    if (started) return;
    started = true;
    ensureCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
    updateMasterGain();
  }

  /* `z` is "site" | "museum" | "research" | null (the log tab, which stays quiet). */
  function setZone(z) {
    const cfg = ZONES[z] || null;
    zone = cfg ? z : null;
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      if (cfg) glideTo(cfg);
      updateMasterGain();
    }
  }

  function setEnabled(on) {
    enabled = on;
    try { window.localStorage.setItem(MUTE_KEY, on ? "0" : "1"); } catch (e) { /* private mode */ }
    updateMasterGain();
  }

  const isEnabled = () => enabled;

  function init() {
    try { enabled = window.localStorage.getItem(MUTE_KEY) !== "1"; } catch (e) { enabled = true; }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && started && ctx && ctx.state === "suspended") ctx.resume();
    });
  }

  S7.audio = {
    init, setZone, setEnabled, isEnabled,
    debug: () => ({ started, hasCtx: !!ctx, state: ctx && ctx.state,
                     gain: master && master.gain.value, zone, enabled }),
  };
})(window.S7 = window.S7 || {});
