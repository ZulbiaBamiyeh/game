/* ============================================================================
   AMBIENCE

   Everything else in this game is generated rather than shipped, so the music
   is too: soft generative loops from oscillators and a synthesised reverb, no
   audio files. Each tab has its own character — the shaft is low and sparse,
   the museum is warm and open, research is clearer and a little more awake —
   and switching tabs glides between them rather than cutting.

   The old version stacked random scale tones into a wash. This one works from
   slow chord progressions, keeps the voice count low, and leaves space between
   notes so the rooms can breathe.
   ============================================================================ */
(function (S7) {
  "use strict";

  const MUTE_KEY = "s7-audio-muted";

  /* ---------- zones ---------------------------------------------------------
     Roots and chords are MIDI numbers. Progressions are short loops of
     triads/add9s that already voice-lead, so a random pick among chord tones
     never lands on a fight. Timing is in milliseconds between events. */

  const ZONES = {
    site: {
      /* Dark, low, sparse — earth and cable and spoil. */
      bass: 31,                              /* G1 */
      filterHz: 720,
      reverb: 0.28,
      master: 0.42,
      padGain: 0.028,
      chimeGain: 0.022,
      bassGain: 0.055,
      padEvery: [5200, 9000],
      chimeEvery: [14000, 24000],
      chimeChance: 0.4,
      air: 0.008,
      /* i – bVI – bVII – i  (G minor colour) */
      chords: [
        [31, 34, 38, 43],                    /* G  Bb D  G */
        [27, 31, 34, 39],                    /* Eb G  Bb Eb */
        [29, 33, 36, 41],                    /* F  A  C  F */
        [31, 34, 38, 46],                    /* G  Bb D  Bb */
      ],
      chordMs: 14000,
      chimeOct: 24,
    },
    museum: {
      /* Warm, open, unhurried — light on stone and a long room. */
      bass: 38,                              /* D2 */
      filterHz: 1400,
      reverb: 0.38,
      master: 0.48,
      padGain: 0.034,
      chimeGain: 0.028,
      bassGain: 0.048,
      padEvery: [3800, 6800],
      chimeEvery: [9000, 16000],
      chimeChance: 0.72,
      air: 0.012,
      /* i – bVII – bVI – bVII  (D dorian-ish, soft) */
      chords: [
        [38, 41, 45, 50],                    /* D  F  A  D */
        [36, 40, 43, 48],                    /* C  E  G  C */
        [34, 38, 41, 46],                    /* Bb D  F  Bb */
        [36, 40, 43, 52],                    /* C  E  G  E */
      ],
      chordMs: 12000,
      chimeOct: 24,
    },
    research: {
      /* Brighter, a touch more awake — desk lamp, not a nave. */
      bass: 40,                              /* E2 */
      filterHz: 1800,
      reverb: 0.30,
      master: 0.45,
      padGain: 0.030,
      chimeGain: 0.026,
      bassGain: 0.044,
      padEvery: [3200, 5600],
      chimeEvery: [7000, 13000],
      chimeChance: 0.6,
      air: 0.010,
      /* I – vi – IV – V  (E major, gentle) */
      chords: [
        [40, 44, 47, 52],                    /* E  G# B  E */
        [37, 40, 44, 49],                    /* C# E  G# C# */
        [33, 37, 40, 45],                    /* A  C# E  A */
        [35, 39, 42, 47],                    /* B  D# F# B */
      ],
      chordMs: 10000,
      chimeOct: 19,
    },
  };

  let ctx = null;
  let master = null, compressor = null, filter = null;
  let dryGain = null, reverb = null, reverbGain = null, reverbHP = null;
  let bassGain = null, bassOsc = [], airGain = null, airSrc = null;
  let started = false, enabled = true, zone = null;
  let padTimer = null, chimeTimer = null, chordTimer = null;
  let chordIndex = 0, liveVoices = 0;
  const MAX_VOICES = 6;

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const cfgOf = (z) => ZONES[z] || null;
  const nowCfg = () => cfgOf(zone);

  /* ---------- graph --------------------------------------------------------- */

  /* Cheap algorithmic reverb: decaying noise, no IR file. Kept short and
     bright-cut so pads do not dissolve into a swamp. */
  function makeReverb(seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        /* Soften the noise so the tail is silky rather than fizzy. */
        data[i] = (Math.random() * 2 - 1) * env * (0.55 + 0.45 * Math.sin(i * 0.013 + ch));
      }
    }
    const node = ctx.createConvolver();
    node.buffer = buf;
    return node;
  }

  function voiceOut(node) {
    node.connect(dryGain);
    node.connect(reverb);
  }

  function softEnv(g, peak, attack, hold, release, t0) {
    /* Always start from a tiny non-zero so exponential ramps stay happy. */
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.72), t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  }

  /* ---------- bass drone ---------------------------------------------------- */

  function startBass() {
    bassGain = ctx.createGain();
    bassGain.gain.value = 0.0001;
    voiceOut(bassGain);

    /* Three close sines: root, root−octave detuned, fifth soft. Beats between
       the detuned pair give the drone a slow breath without needing LFO code. */
    const base = (nowCfg() || ZONES.site).bass;
    const parts = [
      { note: base,      type: "sine", detune: -4,  level: 1.0 },
      { note: base,      type: "sine", detune: 5,   level: 0.7 },
      { note: base + 7,  type: "sine", detune: -2,  level: 0.28 },
      { note: base - 12, type: "sine", detune: 0,   level: 0.45 },
    ];
    bassOsc = parts.map((p) => {
      const o = ctx.createOscillator();
      o.type = p.type;
      o.frequency.value = midiToFreq(p.note);
      o.detune.value = p.detune;
      const g = ctx.createGain();
      g.gain.value = p.level;
      o.connect(g);
      g.connect(bassGain);
      o.start();
      return { osc: o, gain: g, part: p };
    });
  }

  function currentChord() {
    const cfg = nowCfg();
    if (!cfg) return null;
    return cfg.chords[chordIndex % cfg.chords.length];
  }

  function glideBassToChord() {
    if (!ctx || !bassOsc.length) return;
    const cfg = nowCfg();
    if (!cfg) return;
    const chord = currentChord();
    const root = chord[0];
    const fifth = chord[2] || root + 7;
    const now = ctx.currentTime;
    const targets = [root, root, fifth, root - 12];
    bassOsc.forEach((v, i) => {
      const f = midiToFreq(targets[i] || root);
      v.osc.frequency.cancelScheduledValues(now);
      v.osc.frequency.setTargetAtTime(f, now, 2.4);
    });
    bassGain.gain.cancelScheduledValues(now);
    bassGain.gain.setTargetAtTime(cfg.bassGain, now, 1.6);
  }

  function advanceChord() {
    if (!zone) return;
    const cfg = nowCfg();
    if (!cfg) return;
    chordIndex = (chordIndex + 1) % cfg.chords.length;
    glideBassToChord();
    /* Drop one pad tone on the change so the new harmony is announced. */
    if (enabled && Math.random() < 0.85) playPad(true);
  }

  function scheduleChord() {
    clearTimeout(chordTimer);
    const cfg = nowCfg();
    if (!cfg || !zone) return;
    chordTimer = setTimeout(() => {
      advanceChord();
      scheduleChord();
    }, cfg.chordMs * (0.9 + Math.random() * 0.25));
  }

  /* ---------- air (very quiet filtered noise) -------------------------------- */

  function startAir() {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    airSrc = ctx.createBufferSource();
    airSrc.buffer = buf;
    airSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    airGain = ctx.createGain();
    airGain.gain.value = 0.0001;
    airSrc.connect(bp);
    bp.connect(airGain);
    voiceOut(airGain);
    airSrc.start();
  }

  /* ---------- voices -------------------------------------------------------- */

  function playPad(onChordChange) {
    if (!ctx || !zone || liveVoices >= MAX_VOICES) return;
    const cfg = nowCfg();
    const chord = currentChord();
    if (!cfg || !chord) return;

    /* Chord tones only. Occasional octave up for air; never a random scale
       pitch that fights the bass. */
    let note = pick(chord);
    if (Math.random() < 0.45) note += 12;
    if (onChordChange && Math.random() < 0.5) note = chord[0] + 12;

    const t0 = ctx.currentTime;
    const peak = cfg.padGain * (0.7 + Math.random() * 0.5);
    const attack = 1.6 + Math.random() * 1.2;
    const hold = 2.0 + Math.random() * 2.0;
    const release = 3.5 + Math.random() * 2.0;
    const life = attack + hold + release;

    const g = ctx.createGain();
    softEnv(g, peak, attack, hold, release, t0);

    /* Two detuned sines, not a triangle — warmer, and nothing spits through
       the reverb when several pads stack. */
    const lf = ctx.createBiquadFilter();
    lf.type = "lowpass";
    lf.frequency.value = 900 + Math.random() * 700;
    lf.Q.value = 0.4;

    const det = 4 + Math.random() * 5;
    for (const d of [-det, det]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = midiToFreq(note);
      o.detune.value = d;
      o.connect(lf);
      o.start(t0);
      o.stop(t0 + life + 0.05);
    }
    lf.connect(g);

    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() * 2 - 1) * 0.45;
      g.connect(pan);
      voiceOut(pan);
    } else {
      voiceOut(g);
    }

    liveVoices++;
    /* Count the voice against the envelope end, not either oscillator. */
    setTimeout(() => { liveVoices = Math.max(0, liveVoices - 1); }, (life + 0.1) * 1000);
  }

  function playChime() {
    if (!ctx || !zone || liveVoices >= MAX_VOICES) return;
    const cfg = nowCfg();
    const chord = currentChord();
    if (!cfg || !chord) return;

    /* High chord tone, short and distant — a glass case catching light, not
       a notification. Pure sine with a quiet octave shimmer. */
    const note = pick(chord) + cfg.chimeOct;
    const t0 = ctx.currentTime;
    const life = 3.2 + Math.random() * 1.4;

    const g = ctx.createGain();
    softEnv(g, cfg.chimeGain, 0.012, 0.06, life - 0.2, t0);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 700;

    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = midiToFreq(note);
    o.connect(hp);

    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = midiToFreq(note + 12);
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    o2.connect(g2);
    g2.connect(hp);

    hp.connect(g);

    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() * 2 - 1) * 0.7;
      g.connect(pan);
      voiceOut(pan);
    } else {
      voiceOut(g);
    }

    liveVoices++;
    o.start(t0); o.stop(t0 + life + 0.05);
    o2.start(t0); o2.stop(t0 + life + 0.05);
    setTimeout(() => { liveVoices = Math.max(0, liveVoices - 1); }, (life + 0.1) * 1000);
  }

  function schedulePad() {
    clearTimeout(padTimer);
    const cfg = nowCfg();
    if (enabled && zone && cfg) {
      /* Usually one note; rarely a soft dyad of two chord tones. */
      playPad(false);
      if (Math.random() < 0.22) setTimeout(() => playPad(false), 180 + Math.random() * 400);
      const wait = cfg.padEvery[0] + Math.random() * (cfg.padEvery[1] - cfg.padEvery[0]);
      padTimer = setTimeout(schedulePad, wait);
    } else {
      padTimer = setTimeout(schedulePad, 2000);
    }
  }

  function scheduleChime() {
    clearTimeout(chimeTimer);
    const cfg = nowCfg();
    if (enabled && zone && cfg && Math.random() < cfg.chimeChance) playChime();
    const c = cfg || ZONES.museum;
    const wait = c.chimeEvery[0] + Math.random() * (c.chimeEvery[1] - c.chimeEvery[0]);
    chimeTimer = setTimeout(scheduleChime, wait);
  }

  /* ---------- zone / master ------------------------------------------------- */

  function applyZoneTone(cfg, immediate) {
    if (!ctx || !cfg) return;
    const t = ctx.currentTime;
    const tau = immediate ? 0.05 : 1.8;
    filter.frequency.cancelScheduledValues(t);
    filter.frequency.setTargetAtTime(cfg.filterHz, t, tau);
    reverbGain.gain.cancelScheduledValues(t);
    reverbGain.gain.setTargetAtTime(cfg.reverb, t, tau);
    if (airGain) {
      airGain.gain.cancelScheduledValues(t);
      airGain.gain.setTargetAtTime(cfg.air, t, tau);
    }
    if (bassGain) {
      bassGain.gain.cancelScheduledValues(t);
      bassGain.gain.setTargetAtTime(cfg.bassGain, t, tau);
    }
  }

  function updateMasterGain() {
    if (!ctx || !master) return;
    const cfg = nowCfg();
    const target = enabled && zone && cfg ? cfg.master : 0;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    /* Slightly snappier mute so the mute button feels responsive; still soft
       enough that a zone change does not click. */
    master.gain.setTargetAtTime(target, t, enabled && zone ? 1.0 : 0.45);
  }

  function ensureCtx() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    /* master → compressor → destination. The compressor keeps stacked pads
       from spiking without squashing the quiet bits flat. */
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 2.4;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.35;
    compressor.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(compressor);

    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = (nowCfg() || ZONES.site).filterHz;
    filter.Q.value = 0.5;
    filter.connect(master);

    dryGain = ctx.createGain();
    dryGain.gain.value = 0.78;
    dryGain.connect(filter);

    reverb = makeReverb(2.6, 2.8);
    reverbHP = ctx.createBiquadFilter();
    reverbHP.type = "highpass";
    reverbHP.frequency.value = 220;          /* cut mud from the tail */
    reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.32;
    reverb.connect(reverbHP);
    reverbHP.connect(reverbGain);
    reverbGain.connect(filter);

    startBass();
    startAir();
    schedulePad();
    scheduleChime();
  }

  function unlock() {
    if (started) return;
    started = true;
    ensureCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
    if (zone) {
      chordIndex = 0;
      glideBassToChord();
      applyZoneTone(nowCfg(), true);
      scheduleChord();
      /* A soft opening pad so the room is not silent for five seconds. */
      setTimeout(() => { if (enabled && zone) playPad(true); }, 400);
      setTimeout(() => { if (enabled && zone) playPad(false); }, 1200);
    }
    updateMasterGain();
  }

  /* `z` is "site" | "museum" | "research" | null (log stays quiet). */
  function setZone(z) {
    const cfg = cfgOf(z);
    const prev = zone;
    zone = cfg ? z : null;
    if (!ctx) {
      updateMasterGain();
      return;
    }
    if (ctx.state === "suspended") ctx.resume();

    if (cfg) {
      if (prev !== zone) {
        chordIndex = 0;
        glideBassToChord();
        /* One pad in the new key so the crossfade has something to land on. */
        if (enabled) setTimeout(() => playPad(true), 300);
      }
      applyZoneTone(cfg, false);
      scheduleChord();
    } else {
      clearTimeout(chordTimer);
      if (bassGain) {
        bassGain.gain.cancelScheduledValues(ctx.currentTime);
        bassGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.8);
      }
      if (airGain) {
        airGain.gain.cancelScheduledValues(ctx.currentTime);
        airGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.8);
      }
    }
    updateMasterGain();
  }

  function setEnabled(on) {
    enabled = !!on;
    try { window.localStorage.setItem(MUTE_KEY, on ? "0" : "1"); } catch (e) { /* private mode */ }
    updateMasterGain();
    if (enabled && zone && ctx) {
      /* Kick a pad so unmuting is not five seconds of bass alone. */
      setTimeout(() => playPad(true), 200);
    }
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
    debug: () => ({
      started, hasCtx: !!ctx, state: ctx && ctx.state,
      gain: master && master.gain.value, zone, enabled,
      chord: chordIndex, voices: liveVoices,
    }),
  };
})(window.S7 = window.S7 || {});
