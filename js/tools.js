// The action bar: what's in your hands. Rod, shotgun, bug spray, binoculars — or nothing.
'use strict';

const TOOLS = [
  { id: 'rod', key: '1', name: 'Rod' },
  { id: 'gun', key: '2', name: 'Shotgun' },
  { id: 'spray', key: '3', name: 'Bug spray' },
  { id: 'binos', key: '4', name: 'Binoculars' },
];

const Tools = {
  current: 'rod', repelT: 0, looking: false, look: { x: 0, y: 0 }, mistT: 0,

  select(id) {
    if (Fishing.state !== 'idle') { Hud.toast('Reel in first (Space) before you swap tools.', '#f2c14e', 1.6); return; }
    const next = this.current === id ? 'hands' : id; // same key again puts it away
    this.current = next;
    Gun.out = next === 'gun';
    Sfx.bail();
    const msg = { rod: 'Rod in hand.', gun: 'Shotgun out. Hettie would not approve.', spray: 'Bug spray ready — click to spray.', binos: 'Binoculars — hold the mouse to scout.', hands: 'Hands free.' }[next];
    Hud.toast(msg, next === 'gun' ? '#e2584d' : '#c8bfae', 1.4);
  },

  count(id) { return id === 'gun' ? Game.ammo || 0 : id === 'spray' ? Game.spray || 0 : null; },

  update(dt) {
    this.repelT = Math.max(0, this.repelT - dt);
    this.mistT = Math.max(0, this.mistT - dt);
    if (this.current === 'spray' && Input.mousePressed && !Menus.open) this.spray();
    // Binoculars: hold to glass the valley; the view drifts toward wherever the mouse points.
    this.looking = this.current === 'binos' && Input.mouse.down && !Menus.open;
    if (this.looking) {
      if (!this.wasLooking) { this.look.x = Player.x; this.look.y = Player.y; }
      const m = Input.mouse;
      this.look.x = U.lerp(this.look.x, m.wx, Math.min(1, dt * 1.2));
      this.look.y = U.lerp(this.look.y, m.wy, Math.min(1, dt * 1.2));
      const d = U.dist(Player.x, Player.y, this.look.x, this.look.y);
      if (d > 40) { this.look.x = Player.x + (this.look.x - Player.x) * 40 / d; this.look.y = Player.y + (this.look.y - Player.y) * 40 / d; }
    }
    this.wasLooking = this.looking;
  },

  spray() {
    if ((Game.spray || 0) <= 0) { Sfx.click(); Hud.toast('Empty can. Hettie sells more.', '#f2c14e', 1.6); return; }
    Game.spray--;
    this.repelT = 90; this.mistT = 1.2;
    Sfx.burst(0.8, 4000, 0.35, 'highpass', 0.7);
    for (const b of Bugs.list) Bugs.splats.push({ x: b.x, y: b.y, t: 0.4, size: b.k.size });
    const n = Bugs.list.length;
    Bugs.list = [];
    Hud.toast(n ? 'Psssht! ' + n + ' bug' + (n > 1 ? 's' : '') + ' dropped. Bug-free for 90 s.' : 'Psssht! Bug-free for 90 s.', '#8fd16a', 1.8);
    Game.save();
  },

  // ---------- HUD ----------
  icon(g, id, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.lineCap = 'round';
    if (id === 'rod') {
      g.strokeStyle = '#c9a86a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-12, 12); g.lineTo(12, -12); g.stroke();
      g.strokeStyle = '#f3ead6'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, -12); g.quadraticCurveTo(16, 0, 10, 10); g.stroke();
      g.fillStyle = '#8a9a9c'; g.beginPath(); g.arc(-5, 5, 4, 0, 7); g.fill();
    } else if (id === 'gun') {
      g.fillStyle = '#7a4a24'; g.fillRect(-13, 0, 10, 5);
      g.fillStyle = '#3a3a40'; g.fillRect(-4, -2, 18, 4); g.fillRect(-4, 2, 6, 3);
    } else if (id === 'spray') {
      g.fillStyle = '#4aa04c'; g.fillRect(-6, -6, 12, 18);
      g.fillStyle = '#e8e8e8'; g.fillRect(-4, -11, 8, 5); g.fillRect(-2, -2, 4, 8);
      g.fillStyle = 'rgba(200,240,200,.7)'; for (let i = 0; i < 4; i++) g.fillRect(6 + i * 3, -12 + (i % 2) * 3, 2, 2);
    } else if (id === 'binos') {
      g.fillStyle = '#2b3638'; g.fillRect(-12, -6, 9, 14); g.fillRect(3, -6, 9, 14); g.fillRect(-3, -3, 6, 5);
      g.fillStyle = '#8ec7d6'; g.beginPath(); g.arc(-7.5, 6, 3.5, 0, 7); g.arc(7.5, 6, 3.5, 0, 7); g.fill();
    }
    g.restore();
  },

  drawBar(hud, x, y) {
    const g = hud.g;
    hud.toolSlots = [];
    TOOLS.forEach((t, i) => {
      const sx = x + i * 66, sel = this.current === t.id;
      hud.toolSlots.push({ x: sx, y, w: 60, h: 60, id: t.id });
      g.fillStyle = sel ? 'rgba(201,168,106,.4)' : 'rgba(18,26,30,.85)';
      g.strokeStyle = sel ? '#f2c14e' : '#667'; g.lineWidth = sel ? 2.5 : 1;
      g.beginPath(); g.roundRect(sx, y, 60, 60, 8); g.fill(); g.stroke();
      this.icon(g, t.id, sx + 30, y + 27, 1.1);
      hud.text(t.key, sx + 6, y + 14, '#a99f8a', 12, 'left', true);
      const c = this.count(t.id);
      if (c !== null) hud.text('×' + c, sx + 54, y + 14, c ? '#f3ead6' : '#e2584d', 11, 'right');
      hud.text(t.name, sx + 30, y + 54, sel ? '#ffffff' : '#c8bfae', 10, 'center', sel);
    });
    if (this.repelT > 0) {
      const sx = x + 2 * 66;
      g.fillStyle = 'rgba(20,40,20,.75)'; g.fillRect(sx + 8, y + 31, 44, 14);
      hud.text(Math.ceil(this.repelT) + 's', sx + 30, y + 42, '#8fd16a', 11, 'center', true);
    }
  },

  // Binocular vignette, plus fish and game spotted in view.
  drawOverlay(hud) {
    const g = hud.g, W = innerWidth, H = innerHeight;
    if (this.mistT > 0) {
      const [sx, sy] = Scene3D.project(Player.x, Player.y, 1);
      g.fillStyle = 'rgba(190,240,190,' + (this.mistT * 0.3).toFixed(2) + ')';
      g.beginPath(); g.arc(sx, sy, 140 * (1.4 - this.mistT * 0.4), 0, 7); g.fill();
    }
    if (!this.looking) return;
    const r = Math.min(W, H) * 0.3;
    // Darken everything, then punch out both lenses (union, so the overlap stays clear).
    g.save();
    g.fillStyle = 'rgba(5,8,10,.92)';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    for (const cx of [W / 2 - r * 0.62, W / 2 + r * 0.62]) { g.beginPath(); g.arc(cx, H / 2, r, 0, Math.PI * 2); g.fill(); }
    g.restore();
    const inLens = (sx, sy) => U.dist(sx, sy, W / 2 - r * 0.62, H / 2) < r - 10 || U.dist(sx, sy, W / 2 + r * 0.62, H / 2) < r - 10;
    for (const f of Fish.list) {
      if (U.dist(f.x, f.y, this.look.x, this.look.y) > 12) continue;
      const [sx, sy, ok] = Scene3D.project(f.x, f.y, 0);
      if (!ok || !inLens(sx, sy)) continue;
      const known = Game.journal[f.sp.id];
      hud.text((f.prized ? '★ ' : '') + (known ? f.sp.name : '???') + ' ~' + (known ? U.fmtKg(f.kg) : '?'), sx, sy - 8, f.prized ? '#ffd76a' : '#e6f6f8', 11, 'center', true);
    }
    for (const an of Animals.list) {
      if (an.state === 'dead' || U.dist(an.x, an.y, this.look.x, this.look.y) > 16) continue;
      const [sx, sy, ok] = Scene3D.project(an.x, an.y, 1.5);
      if (ok && inLens(sx, sy)) hud.text(an.type === 'boar' ? 'Wild boar' : an.buck ? 'Stag' : 'Deer', sx, sy, '#f2c14e', 12, 'center', true);
    }
    hud.text('Hold to scout · move the mouse to pan', W / 2, H / 2 + r + 26, '#a99f8a', 13, 'center');
  },
};
