// Sandflies and mosquitoes: they buzz your head, bite, and get swatted with a click.
'use strict';

const BUG_KINDS = {
  mozzie: { name: 'mosquito', size: 1, speed: 120, pitch: 620, bite: 0.18, landAfter: [3, 5] },
  sandfly: { name: 'sandfly', size: 0.65, speed: 190, pitch: 900, bite: 0.12, landAfter: [1.8, 3.2] },
};

const Bugs = {
  list: [], splats: [], spawnT: 4, itch: 0, swatted: 0, bites: 0, shake: 0,

  head() {
    const [x, y] = Scene3D.project(Player.x, Player.y, Scene3D.standH(Player.x, Player.y) + 1.05);
    return { x, y };
  },

  // More bugs at dawn and dusk, by water, in still air; fewer in rain and wind.
  rate() {
    const e = Game.env;
    let r = [1 / 7, 1 / 20, 1 / 7, 1 / 12][e.phase];
    if (World.depthAt(Player.x, Player.y) > 0 || World.shore[World.idx(Player.x | 0, Player.y | 0)] <= 3) r *= 1.6;
    if (e.weather.id === 'rain') r *= 0.4;
    r *= U.clamp(1.4 - Math.hypot(e.wind.x, e.wind.y) * 0.3, 0.4, 1.4);
    return r;
  },

  spawn() {
    const W = innerWidth, H = innerHeight;
    const kind = Math.random() < 0.55 ? 'sandfly' : 'mozzie';
    const side = (Math.random() * 4) | 0;
    const x = side === 0 ? -20 : side === 1 ? W + 20 : Math.random() * W;
    const y = side === 2 ? -20 : side === 3 ? H + 20 : Math.random() * H;
    const k = BUG_KINDS[kind];
    this.list.push({ kind, k, x, y, vx: 0, vy: 0, state: 'approach', t: 0, orbit: Math.random() * 6.28,
      r: 34 + Math.random() * 40, landAt: U.lerp(k.landAfter[0], k.landAfter[1], Math.random()), wing: 0 });
  },

  update(dt) {
    this.itch = Math.max(0, this.itch - dt * 0.03);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.spawnT -= dt * this.rate() * 4 * (Tools.repelT > 0 || Interior.active ? 0 : 1);
    if (Interior.active) this.list = [];
    if (this.spawnT <= 0) { this.spawnT = 4; if (this.list.length < 4) this.spawn(); }
    const h = this.head();
    let near = 1e9, pitch = 700;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.t += dt; b.wing += dt * 60;
      let tx, ty;
      if (b.state === 'approach') {
        tx = h.x; ty = h.y;
        if (U.dist(b.x, b.y, h.x, h.y) < b.r + 10) { b.state = 'circle'; b.t = 0; }
      } else if (b.state === 'circle') {
        b.orbit += dt * (b.kind === 'sandfly' ? 5 : 3);
        tx = h.x + Math.cos(b.orbit) * b.r + Math.sin(b.t * 7) * 12;
        ty = h.y + Math.sin(b.orbit * 1.3) * b.r * 0.6 + Math.cos(b.t * 5) * 10;
        if (b.t > b.landAt) { b.state = 'land'; b.t = 0; b.lx = (Math.random() - 0.5) * 16; b.ly = (Math.random() - 0.3) * 14; }
      } else if (b.state === 'land') {
        tx = h.x + b.lx; ty = h.y + b.ly;
        if (b.t > 0.9) this.bite(b);
      } else {
        tx = b.x + b.vx; ty = b.y - 200; // flying off, full of you
        if (b.y < -40 || b.t > 4) { this.list.splice(i, 1); continue; }
      }
      // Jittery insect steering.
      const ax = (tx - b.x) * 4 + (Math.random() - 0.5) * 900, ay = (ty - b.y) * 4 + (Math.random() - 0.5) * 900;
      b.vx = U.clamp(b.vx + ax * dt, -b.k.speed * 2, b.k.speed * 2) * (b.state === 'land' ? 0.6 : 0.96);
      b.vy = U.clamp(b.vy + ay * dt, -b.k.speed * 2, b.k.speed * 2) * (b.state === 'land' ? 0.6 : 0.96);
      b.x += b.vx * dt; b.y += b.vy * dt;
      const d = U.dist(b.x, b.y, h.x, h.y);
      if (d < near) { near = d; pitch = b.k.pitch; }
    }
    // The whine gets louder as they close in.
    Sfx.setBuzz(this.list.length ? U.clamp(1 - near / 500, 0, 1) : 0, pitch);
    for (let i = this.splats.length - 1; i >= 0; i--) { this.splats[i].t += dt; if (this.splats[i].t > 1.2) this.splats.splice(i, 1); }
  },

  bite(b) {
    b.state = 'leave'; b.t = 0; b.vx = (Math.random() - 0.5) * 200;
    this.itch = Math.min(1, this.itch + b.k.bite);
    this.bites++; this.shake = 1;
    Sfx.slap(0.3);
    Hud.toast(['Ow! Got bitten.', 'Ugh, a ' + b.k.name + ' got you.', 'Itchy… so itchy.', 'They\'re eating you alive!'][(Math.random() * 4) | 0], '#e2584d', 1.4);
  },

  // Returns true when the click landed on a bug.
  swat(x, y) {
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      if (b.state === 'leave') continue;
      if (U.dist(x, y, b.x, b.y) < 26 * b.k.size + 6) {
        this.list.splice(i, 1);
        this.splats.push({ x: b.x, y: b.y, t: 0, size: b.k.size });
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
      const s = b.k.size;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(Math.atan2(b.vy, b.vx));
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
      g.globalAlpha = U.clamp(1.2 - sp.t, 0, 1);
      g.fillStyle = '#5a1a14';
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + sp.size, r = (6 + (k % 3) * 5) * sp.size;
        g.beginPath(); g.arc(sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r, 2.2, 0, Math.PI * 2); g.fill();
      }
      g.beginPath(); g.arc(sp.x, sp.y, 5 * sp.size, 0, Math.PI * 2); g.fill();
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
