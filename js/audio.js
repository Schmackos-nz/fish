// Synthesised sound effects. Nothing is loaded from disk.
'use strict';

const Sfx = {
  ctx: null, master: null, noiseBuf: null, dragNode: null, dragGain: null, ambGain: null, rainGain: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Looping beds: running water and rain.
    this.ambGain = this.loopNoise(600, 0.6, 'lowpass');
    this.rainGain = this.loopNoise(3000, 0.3, 'highpass');
    // Drag scream: a buzzing sawtooth gated by drag slip.
    this.dragGain = this.ctx.createGain();
    this.dragGain.gain.value = 0;
    this.dragNode = this.ctx.createOscillator();
    this.dragNode.type = 'sawtooth';
    this.dragNode.frequency.value = 900;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 38; lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(this.dragNode.frequency);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
    this.dragNode.connect(bp).connect(this.dragGain).connect(this.master);
    this.dragNode.start(); lfo.start();
    // Insect whine: a wobbling saw through a narrow band-pass.
    this.buzzGain = this.ctx.createGain(); this.buzzGain.gain.value = 0;
    this.buzzOsc = this.ctx.createOscillator(); this.buzzOsc.type = 'sawtooth'; this.buzzOsc.frequency.value = 650;
    const bl = this.ctx.createOscillator(), blg = this.ctx.createGain();
    bl.frequency.value = 9; blg.gain.value = 40;
    bl.connect(blg).connect(this.buzzOsc.frequency);
    const bbp = this.ctx.createBiquadFilter(); bbp.type = 'bandpass'; bbp.frequency.value = 900; bbp.Q.value = 3;
    this.buzzOsc.connect(bbp).connect(this.buzzGain).connect(this.master);
    this.buzzOsc.start(); bl.start();
    // Two-stroke engine: detuned saw + square through a growly low-pass.
    this.engGain = this.ctx.createGain(); this.engGain.gain.value = 0;
    this.engA = this.ctx.createOscillator(); this.engA.type = 'sawtooth'; this.engA.frequency.value = 60;
    this.engB = this.ctx.createOscillator(); this.engB.type = 'square'; this.engB.frequency.value = 61.5;
    const elp = this.ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 1100; elp.Q.value = 0.7;
    // Firing pulses: chop the tone at a fraction of the revs so it putters like a two-stroke.
    this.engPulse = this.ctx.createGain(); this.engPulse.gain.value = 0.5;
    this.engLfo = this.ctx.createOscillator(); this.engLfo.type = 'square'; this.engLfo.frequency.value = 15;
    const lfoAmt = this.ctx.createGain(); lfoAmt.gain.value = 0.5;
    this.engLfo.connect(lfoAmt).connect(this.engPulse.gain);
    this.engA.connect(elp); this.engB.connect(elp); elp.connect(this.engPulse).connect(this.engGain).connect(this.master);
    this.engA.start(); this.engB.start(); this.engLfo.start();
  },

  loopNoise(freq, q, type) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return g;
  },

  burst(dur, freq, vol, type = 'lowpass', q = 1, sweepTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },

  tone(freq, dur, vol, type = 'sine', slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },

  click() { this.burst(0.025, 4000, 0.12, 'highpass', 1); },
  bail() { this.tone(1800, 0.05, 0.15, 'square', 900); this.burst(0.04, 3000, 0.2, 'bandpass', 4); },
  whoosh(p) { this.burst(0.35 + p * 0.2, 500, 0.25 + p * 0.25, 'bandpass', 1.5, 2500); },
  splash(size = 1) { this.burst(0.25 + size * 0.25, 1600, 0.25 * size + 0.1, 'lowpass', 0.7, 300); },
  plop() { this.tone(500, 0.12, 0.2, 'sine', 180); this.burst(0.1, 900, 0.1); },
  pop() { this.tone(260, 0.1, 0.25, 'triangle', 120); this.burst(0.12, 1200, 0.2, 'bandpass', 2); },
  thunk() { this.tone(110, 0.18, 0.4, 'triangle', 60); this.burst(0.08, 600, 0.3); },
  nibble() { this.tone(300, 0.06, 0.12, 'sine', 220); },
  snap() { this.tone(2600, 0.2, 0.3, 'square', 300); this.burst(0.15, 5000, 0.3, 'highpass'); },
  knot() { this.tone(200, 0.3, 0.2, 'sawtooth', 120); },
  coin() { this.tone(988, 0.08, 0.15, 'square'); setTimeout(() => this.tone(1319, 0.2, 0.15, 'square'), 80); },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 0.18, 'triangle'), i * 110));
  },
  fail() { this.tone(330, 0.25, 0.2, 'triangle', 160); },

  shot() { this.burst(0.06, 7000, 0.9, 'highpass'); this.tone(150, 0.16, 0.5, 'square', 50); this.burst(0.5, 2400, 0.6, 'lowpass', 0.7, 140); },
  slap(v) { this.burst(0.07, 1800, 0.25 * v + 0.1, 'bandpass', 1.2); this.tone(180, 0.05, 0.15 * v, 'square', 90); },
  setEngine(level, rpm) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(U.clamp(level, 0, 1) * 0.035, t, 0.1);
    this.engA.frequency.setTargetAtTime(rpm * 1.4, t, 0.08); this.engB.frequency.setTargetAtTime(rpm * 1.43, t, 0.08);
    this.engLfo.frequency.setTargetAtTime(rpm / 4, t, 0.08);
  },
  setBuzz(level, pitch) {
    if (!this.ctx) return;
    this.buzzGain.gain.setTargetAtTime(level * level * 0.012, this.ctx.currentTime, 0.08);
    this.buzzOsc.frequency.setTargetAtTime(pitch, this.ctx.currentTime, 0.2);
  },

  setDrag(level) {
    if (!this.ctx) return;
    this.dragGain.gain.setTargetAtTime(level * 0.07, this.ctx.currentTime, 0.03);
    this.dragNode.frequency.setTargetAtTime(700 + level * 900, this.ctx.currentTime, 0.05);
  },
  setAmbient(water, rain) {
    if (!this.ctx) return;
    this.ambGain.gain.setTargetAtTime(water * 0.25, this.ctx.currentTime, 0.4);
    this.rainGain.gain.setTargetAtTime(rain * 0.12, this.ctx.currentTime, 0.6);
  },
};
