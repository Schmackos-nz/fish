// Sandflies and mosquitoes: they buzz your head, bite, and get swatted with a click.
// They fly in the world around you (metres) and are only projected to the screen to draw and swat —
// so panning the camera doesn't drag them around, and you can outrun them.
'use strict';

const BUG_KINDS = {
  mozzie: { name: 'mosquito', size: 1, speed: 2.2, pitch: 620, bite: 0.18, landAfter: [3, 5] },
  sandfly: { name: 'sandfly', size: 0.65, speed: 3.4, pitch: 900, bite: 0.12, landAfter: [1.8, 3.2] },
};

const Bugs = {
  list: [], splats: [], spawnT: 4, itch: 0, swatted: 0, bites: 0, shake: 0, wave: 0, waveDone: false, breakT: 8,

  // The angler's head, in world space and on screen.
  headW() { return { x: Player.x, y: Player.y, z: Scene3D.standH(Player.x, Player.y) + 1.05 }; },
  head() { const w = this.headW(), [x, y] = Scene3D.project(w.x, w.y, w.z); return { x, y }; },

  // More bugs at dawn and dusk, by water, in still air; fewer in rain and wind.
  rate() {
    const e = Game.env;
    let r = [1 / 7, 1 / 20, 1 / 7, 1 / 12][e.phase];
    if (World.depthAt(Player.x, Player.y) > 0 || World.shore[World.idx(Player.x | 0, Player.y | 0)] <= 3) r *= 1.6;
    if (e.weather.id === 'rain') return 0; // they shelter from the rain
    r *= U.clamp(1.4 - Math.hypot(e.wind.x, e.wind.y) * 0.3, 0.4, 1.4);
    return r;
  },

  spawn() {
    const kind = Math.random() < 0.55 ? 'sandfly' : 'mozzie', k = BUG_KINDS[kind], h = this.headW();
    const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 3;
    this.list.push({ kind, k, wx: h.x + Math.cos(a) * d, wy: h.y + Math.sin(a) * d, wz: h.z + Math.random() * 1.5, vx: 0, vy: 0, vz: 0,
      x: -100, y: -100, sdx: 1, sdy: 0, state: 'approach', t: 0, orbit: Math.random() * 6.28,
      r: 0.5 + Math.random() * 0.6, landAt: U.lerp(k.landAfter[0], k.landAfter[1], Math.random()), wing: 0 });
  },

  update(dt) {
    this.itch = Math.max(0, this.itch - dt * 0.03);
    this.shake = Math.max(0, this.shake - dt * 3);
    if (Game.env.weather.id === 'rain') for (const b of this.list) if (b.state !== 'leave') { b.state = 'leave'; b.t = 0; }
    this.spawnT -= dt * this.rate() * 4 * (Tools.repelT > 0 || Interior.active || Bikes.riding ? 0 : 1);
    if (Interior.active) this.list = [];
    if (this.breakT > 0) this.breakT -= dt;
    else if (this.waveDone) { if (!this.list.length) { this.waveDone = false; this.breakT = 20 + Math.random() * 10; } }
    else if (this.wave <= 0) this.wave = 1 + Math.floor(Math.random() * 5);
    if (this.spawnT <= 0) {
      this.spawnT = 4;
      if (this.breakT <= 0 && !this.waveDone && this.wave > 0 && this.list.length < 5) { this.spawn(); if (--this.wave <= 0) this.waveDone = true; }
    }
    const h = this.headW();
    let near = 1e9, pitch = 700;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.t += dt; b.wing += dt * 60;
      const dh = Math.hypot(b.wx - h.x, b.wy - h.y, b.wz - h.z);
      // Leave them far enough behind and they lose interest.
      if (dh > 12 && b.state !== 'leave') { b.state = 'leave'; b.t = 0; }
      let tx, ty, tz;
      if (b.state === 'approach') {
        tx = h.x; ty = h.y; tz = h.z;
        if (dh < b.r + 0.2) { b.state = 'circle'; b.t = 0; }
      } else if (b.state === 'circle') {
        b.orbit += dt * (b.kind === 'sandfly' ? 5 : 3);
        tx = h.x + Math.cos(b.orbit) * b.r + Math.sin(b.t * 7) * 0.15;
        ty = h.y + Math.sin(b.orbit * 1.3) * b.r * 0.7;
        tz = h.z + Math.cos(b.t * 5) * 0.18;
        if (dh > b.r + 2.5) b.state = 'approach'; // you walked off — catch up
        else if (b.t > b.landAt) { b.state = 'land'; b.t = 0; b.lx = (Math.random() - 0.5) * 0.3; b.ly = (Math.random() - 0.5) * 0.3; b.lz = (Math.random() - 0.6) * 0.25; }
      } else if (b.state === 'land') {
        tx = h.x + b.lx; ty = h.y + b.ly; tz = h.z + b.lz;
        if (dh > 1.2) { b.state = 'approach'; b.t = 0; } // shaken off
        else if (b.t > 0.9) this.bite(b);
      } else {
        tx = b.wx + b.vx; ty = b.wy + b.vy; tz = b.wz + 5; // flying off, full of you
        if (b.t > 3) { this.list.splice(i, 1); continue; }
      }
      // Jittery insect steering, with a real top speed.
      const J = 14, damp = b.state === 'land' ? 0.6 : 0.96, vmax = b.k.speed * 1.5;
      b.vx = U.clamp(b.vx + ((tx - b.wx) * 4 + (Math.random() - 0.5) * J) * dt, -vmax, vmax) * damp;
      b.vy = U.clamp(b.vy + ((ty - b.wy) * 4 + (Math.random() - 0.5) * J) * dt, -vmax, vmax) * damp;
      b.vz = U.clamp(b.vz + ((tz - b.wz) * 4 + (Math.random() - 0.5) * J * 0.6) * dt, -vmax, vmax) * damp;
      b.wx += b.vx * dt; b.wy += b.vy * dt; b.wz += b.vz * dt;
      // Where that is on screen right now.
      const [sx, sy, ok] = Scene3D.project(b.wx, b.wy, b.wz);
      if (ok) { if (b.x > -50) { b.sdx = U.lerp(b.sdx, sx - b.x, 0.3); b.sdy = U.lerp(b.sdy, sy - b.y, 0.3); } b.x = sx; b.y = sy; } else { b.x = b.y = -100; }
      if (dh < near) { near = dh; pitch = b.k.pitch; }
    }
    // The whine gets louder as they close in.
    Sfx.setBuzz(this.list.length ? U.clamp(1 - near / 8, 0, 1) : 0, pitch);
    for (let i = this.splats.length - 1; i >= 0; i--) { this.splats[i].t += dt; if (this.splats[i].t > 1.2) this.splats.splice(i, 1); }
  },

  bite(b) {
    b.state = 'leave'; b.t = 0; b.vx = (Math.random() - 0.5) * 3; b.vy = (Math.random() - 0.5) * 3;
    this.itch = Math.min(1, this.itch + b.k.bite);
    this.bites++; this.shake = 1;
    Sfx.slap(0.3);
    Hud.toast(['Ow! Got bitten.', 'Ugh, a ' + b.k.name + ' got you.', 'Itchy… so itchy.', 'They\'re eating you alive!'][(Math.random() * 4) | 0], '#e2584d', 1.4);
  },

  // Only bugs right round your head can be swatted.
  swattable(b) { const h = this.headW(); return b.state !== 'leave' && Math.hypot(b.wx - h.x, b.wy - h.y, b.wz - h.z) < 1.6; },

  // Returns true when the click landed on a bug.
  swat(x, y) {
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      if (b.state === 'leave' || b.x < -50) continue;
      if (U.dist(x, y, b.x, b.y) < 26 * b.k.size + 6) {
        if (!this.swattable(b)) { Hud.toast('Too far away — wait till it comes for you.', UI.muted, 1.2); return true; }
        this.list.splice(i, 1);
        this.splats.push({ wx: b.wx, wy: b.wy, wz: b.wz, t: 0, size: b.k.size });
        this.swatted++; Game.stats.swatted = (Game.stats.swatted || 0) + 1;
        Sfx.slap(1);
        if (Math.random() < 0.4) Hud.toast(['SPLAT!', 'Got the little sucker!', 'One less ' + b.k.name + '.', 'Take THAT!'][(Math.random() * 4) | 0], '#8fd16a', 1);
        return true;
      }
    }
    return false;
  },

  draw(g) {
    for (const b of this.list) {
      if (b.x < -50) continue;
      const s = b.k.size;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(Math.atan2(b.sdy, b.sdx));
      // Wing blur
      g.fillStyle = 'rgba(220,230,240,' + (0.35 + 0.25 * Math.sin(b.wing)).toFixed(2) + ')';
      g.beginPath(); g.ellipse(-2 * s, -6 * s, 7 * s, 3.5 * s, -0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(-2 * s, 6 * s, 7 * s, 3.5 * s, 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1612';
      if (b.kind === 'mozzie') {
        g.strokeStyle = '#1a1612'; g.lineWidth = 1;
        for (const yy of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-k * 3, 0); g.lineTo(-k * 3 - 6, yy * 10); g.stroke(); }
        g.beginPath(); g.ellipse(-4, 0, 8, 2.4, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(5, 0, 2.6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(7, 0); g.lineTo(14, 0); g.stroke(); // proboscis
        if (b.state === 'leave') { g.fillStyle = '#b8202a'; g.beginPath(); g.ellipse(-6, 0, 5, 3, 0, 0, Math.PI * 2); g.fill(); }
      } else {
        g.beginPath(); g.ellipse(0, 0, 4.5 * s * 1.4, 3 * s * 1.4, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    for (const sp of this.splats) {
      const [x, y, ok] = Scene3D.project(sp.wx, sp.wy, sp.wz); if (!ok) continue;
      g.globalAlpha = U.clamp(1.2 - sp.t, 0, 1);
      g.fillStyle = '#5a1a14';
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + sp.size, r = (6 + (k % 3) * 5) * sp.size;
        g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 2.2, 0, Math.PI * 2); g.fill();
      }
      g.beginPath(); g.arc(x, y, 5 * sp.size, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // Itchy screen edges when you've been bitten a lot.
    if (this.itch > 0.15) {
      const W = innerWidth, H = innerHeight;
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      gr.addColorStop(0, 'rgba(200,40,40,0)'); gr.addColorStop(1, 'rgba(200,40,40,' + (this.itch * 0.35).toFixed(2) + ')');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
  },
};
