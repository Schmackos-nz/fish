// NPC "voices": a burst of gibberish syllables whenever someone says something. Each character
// gets their own pitch; shouting is faster and higher. Quieter with distance.
'use strict';

const Voice = {
  busy: 0,

  pitchOf(who) {
    let h = 0; for (const c of String(who)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return 120 + (h % 97) * 2.6; // 120–370 Hz
  },

  babble(text, x, y, who) {
    if (!Sfx.ctx || Game.mode !== 'play' || !text) return;
    const d = U.dist(x, y, Player.x, Player.y);
    if (d > 26 || this.busy >= 3) return;
    const vol = 0.2 * Math.pow(1 - d / 26, 1.4);
    if (vol < 0.012) return;
    const shout = /!|[A-Z]{4,}/.test(text), base = this.pitchOf(who) * (shout ? 1.25 : 1);
    const n = U.clamp(Math.round(text.length / 4), 2, 12), gap = shout ? 0.065 : 0.085;
    const ctx = Sfx.ctx, t0 = ctx.currentTime + 0.02;
    this.busy++; setTimeout(() => { this.busy--; }, n * gap * 1000 + 200);
    for (let k = 0; k < n; k++) {
      const t = t0 + k * gap + Math.random() * 0.015, dur = gap * (0.7 + Math.random() * 0.5);
      const f = base * (0.85 + Math.random() * 0.4) * (k === n - 1 && /\?/.test(text) ? 1.3 : 1);
      // A buzzy source through a "vowel" filter that wobbles per syllable.
      const o = ctx.createOscillator(); o.type = k % 3 === 0 ? 'square' : 'sawtooth';
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (0.8 + Math.random() * 0.4), t + dur);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
      bp.frequency.setValueAtTime(500 + Math.random() * 900, t); bp.frequency.linearRampToValueAtTime(700 + Math.random() * 1200, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(bp).connect(g).connect(Sfx.master);
      o.start(t); o.stop(t + dur + 0.03);
    }
  },
};
