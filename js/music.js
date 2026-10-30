// Trout for Clout theme: an original, upbeat country jingle for the main menu.
// Boom-chuck guitar, banjo rolls, brushed drums and a whistled melody, all synthesised.
'use strict';

const Music = {
  out: null, playing: false, endsAt: 0,

  freq(n) {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0) + (+m[3] + 1) * 12;
    return 440 * Math.pow(2, (semis - 69) / 12);
  },

  play() {
    const ctx = Sfx.ctx;
    if (!ctx || this.playing) return;
    if (ctx.state === 'suspended') ctx.resume();
    this.playing = true;
    const out = ctx.createGain(); out.gain.value = 0.85;
    // A little room reverb so it sounds like a TV intro, not a ringtone.
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 1.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.18;
    out.connect(Sfx.master); out.connect(verb).connect(wet).connect(Sfx.master);
    this.out = out;

    const BPM = 132, B = 60 / BPM, t0 = ctx.currentTime + 0.15, F = (n) => this.freq(n);
    const at = (beat) => t0 + beat * B;
    const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const osc = (type, f, t, dur, peak, a, filt) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      let node = o;
      if (filt) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(filt[0], t); lp.frequency.exponentialRampToValueAtTime(filt[1], t + 0.25); node.connect(lp); node = lp; }
      node.connect(g).connect(out); env(g, t, peak, a, dur);
      o.start(t); o.stop(t + a + dur + 0.05);
      return o;
    };
    const noise = (t, dur, peak, type, f) => {
      const s = ctx.createBufferSource(); s.buffer = Sfx.noiseBuf;
      const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f;
      const g = ctx.createGain(); s.connect(flt).connect(g).connect(out); env(g, t, peak, 0.003, dur);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
    };
    const pluck = (n, t, dur, vol) => osc('sawtooth', F(n), t, dur, vol, 0.003, [F(n) * 7, F(n) * 1.6]);
    const whistle = (n, t, dur) => {
      const o = osc('sine', F(n), t, dur, 0.16, 0.035);
      o.frequency.setValueAtTime(F(n) * 0.97, t); o.frequency.exponentialRampToValueAtTime(F(n), t + 0.05);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.6; lg.gain.value = F(n) * 0.007; lfo.connect(lg).connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.1);
      osc('triangle', F(n) * 2, t, dur * 0.8, 0.02, 0.04);
    };

    // Chords, one per bar: root/fifth for the bass, triad for strums and banjo.
    const bars = [
      ['G2', 'D3', ['G3', 'B3', 'D4', 'G4']], ['C3', 'G2', ['C4', 'E4', 'G4', 'C5']],
      ['G2', 'D3', ['G3', 'B3', 'D4', 'G4']], ['D3', 'A2', ['D4', 'F#4', 'A4', 'D5']],
      ['G2', 'D3', ['G3', 'B3', 'D4', 'G4']], ['C3', 'G2', ['C4', 'E4', 'G4', 'C5']],
      ['D3', 'A2', ['D4', 'F#4', 'A4', 'D5']], ['G2', 'D3', ['G3', 'B3', 'D4', 'G4']],
    ];
    bars.forEach(([root, fifth, triad], i) => {
      const b = i * 4, last = i === bars.length - 1;
      // Boom-chuck: bass on 1 and 3, strum on 2 and 4.
      osc('triangle', F(root), at(b), B * 0.9, 0.3, 0.005);
      if (!last) osc('triangle', F(fifth), at(b + 2), B * 0.9, 0.26, 0.005);
      for (const beat of last ? [] : [1, 3]) triad.forEach((n, k) => pluck(n, at(b + beat) + k * 0.012, B * 0.45, 0.05));
      // Banjo forward roll in eighths (skipped on the final bar, which rings out).
      if (!last) for (let e = 0; e < 8; e++) pluck(triad[[0, 2, 3, 1, 2, 3, 0, 2][e]].replace(/\d/, (d) => +d + 1), at(b + e * 0.5), B * 0.35, 0.028);
      // Drums: kick, brushed snare, shaker.
      if (!last) for (let q = 0; q < 4; q++) {
        if (q % 2 === 0) { const k = osc('sine', 140, at(b + q), 0.14, 0.45, 0.002); k.frequency.exponentialRampToValueAtTime(45, at(b + q) + 0.12); }
        else noise(at(b + q), 0.14, 0.12, 'bandpass', 2600);
        noise(at(b + q), 0.04, 0.035, 'highpass', 7000); noise(at(b + q + 0.5), 0.04, 0.025, 'highpass', 7000);
      }
    });

    // The whistled tune: [note, beat, length in beats].
    const tune = [
      ['G4', 0, 0.5], ['B4', 0.5, 0.5], ['D5', 1, 1], ['G5', 2, 1.5],
      ['E5', 4, 0.5], ['G5', 4.5, 0.5], ['E5', 5, 0.5], ['C5', 5.5, 0.5], ['E5', 6, 1.5],
      ['D5', 8, 0.5], ['B4', 8.5, 0.5], ['G4', 9, 0.5], ['B4', 9.5, 0.5], ['D5', 10, 1], ['B4', 11, 1],
      ['A4', 12, 1], ['B4', 13, 0.5], ['C5', 13.5, 0.5], ['D5', 14, 1], ['F#5', 15, 1],
      ['G5', 16, 0.5], ['F#5', 16.5, 0.5], ['G5', 17, 0.5], ['A5', 17.5, 0.5], ['B5', 18, 1.5], ['G5', 19.5, 0.5],
      ['E5', 20, 0.5], ['G5', 20.5, 0.5], ['C6', 21, 1], ['B5', 22, 0.5], ['A5', 22.5, 0.5], ['G5', 23, 1],
      ['F#5', 24, 0.5], ['G5', 24.5, 0.5], ['A5', 25, 1], ['D5', 26, 0.5], ['E5', 26.5, 0.5], ['F#5', 27, 1],
      ['G5', 28, 3.5],
    ];
    for (const [n, b, l] of tune) whistle(n, at(b), l * B);
    // Big finish: strummed G chord and a cymbal-ish wash.
    ['G2', 'D3', 'G3', 'B3', 'D4', 'G4', 'B4'].forEach((n, k) => pluck(n, at(28) + k * 0.025, B * 3.5, 0.06));
    noise(at(28), 1.6, 0.07, 'highpass', 5000);

    this.endsAt = at(32) + 0.5;
    setTimeout(() => { if (this.out === out) { this.playing = false; this.out = null; } }, (this.endsAt - ctx.currentTime) * 1000);
  },

  stop(fade = 0.8) {
    const ctx = Sfx.ctx, out = this.out;
    if (!ctx || !out) return;
    out.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
    setTimeout(() => out.disconnect(), fade * 1000 + 200);
    this.out = null; this.playing = false;
  },
};
