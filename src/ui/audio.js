/* ============================================================================
   MUSEUM AMBIENCE

   Everything else in this game is generated rather than shipped, so the
   music is too: a soft generative drone-and-pad loop built from oscillators
   and a synthesised reverb impulse, no audio files anywhere. It plays while
   the Museum tab is open and fades out everywhere else, on the theory that
   the shaft should be quiet and the galleries should not.
   ============================================================================ */
(function (S7) {
  "use strict";

  const MUTE_KEY = "s7-audio-muted";

  /* D dorian-ish, kept sparse so nothing ever sounds like a wrong note. */
  const SCALE = [0, 2, 3, 7, 9, 12, 14];
  const ROOT = 38; /* D2 */

  let ctx = null, master = null, filter = null, reverb = null;
  let started = false, enabled = true, inMuseum = false;
  let padTimer = null, chimeTimer = null;

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

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
    const g = ctx.createGain();
    g.gain.value = 0.05;
    voiceOut(g);
    [ROOT, ROOT + 7].forEach((note, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = midiToFreq(note);
      o.detune.value = (i - 0.5) * 6;
      o.connect(g);
      o.start();
    });
  }

  function playPad() {
    if (!ctx) return;
    const freq = midiToFreq(ROOT + 12 + pick(SCALE));
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = Math.random() < 0.5 ? "triangle" : "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.055, now + 2.2);
    g.gain.linearRampToValueAtTime(0, now + 7);
    o.connect(g);
    voiceOut(g);
    o.start(now);
    o.stop(now + 7.2);
  }

  function schedulePad() {
    if (enabled && inMuseum) playPad();
    padTimer = setTimeout(schedulePad, 3500 + Math.random() * 3500);
  }

  function playChime() {
    if (!ctx) return;
    const freq = midiToFreq(ROOT + 24 + pick(SCALE));
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.045, now);
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
    if (enabled && inMuseum && Math.random() < 0.7) playChime();
    chimeTimer = setTimeout(scheduleChime, 9000 + Math.random() * 12000);
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
    filter.frequency.value = 1500;
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
    const target = enabled && inMuseum ? 0.5 : 0;
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

  function enterMuseum() {
    inMuseum = true;
    if (ctx && ctx.state === "suspended") ctx.resume();
    updateMasterGain();
  }

  function leaveMuseum() {
    inMuseum = false;
    updateMasterGain();
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

  S7.audio = { init, enterMuseum, leaveMuseum, setEnabled, isEnabled };
})(window.S7 = window.S7 || {});
