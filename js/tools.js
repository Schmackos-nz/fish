// The action bar: what's in your hands. Rod, rifle, bug spray, binoculars — or nothing.
'use strict';

const TOOLS = [
  { id: 'rod', key: '1', name: 'Rod' },
  { id: 'gun', key: '2', name: 'Rifle' },
  { id: 'spray', key: '3', name: 'Bug spray' },
  { id: 'binos', key: '4', name: 'Binoculars' },
  { id: 'axe', key: '5', name: 'Axe' },
];

const Tools = {
  current: 'rod', repelT: 0, looking: false, look: { x: 0, y: 0 }, mistT: 0,

  select(id) {
    if (Bikes.riding) { Hud.toast('Hands on the bars! Get off first (E).', UI.muted, 1.4); return; }
    if (Fishing.state !== 'idle') { Hud.toast('Reel in first (Space) before you swap tools.', '#f2c14e', 1.6); return; }
    // Pressing 2 again cycles through your guns; past the last one it goes away.
    if (id === 'gun' && this.current === 'gun' && Arsenal.cycle()) { Sfx.bail(); Hud.toast(Arsenal.weapon().name + ' · ' + Arsenal.ammo(Arsenal.weapon().ammo) + ' ' + AMMO[Arsenal.weapon().ammo].name.toLowerCase(), UI.ink, 1.4); return; }
    const next = this.current === id ? 'hands' : id; // same key again puts it away
    this.current = next;
    Gun.out = next === 'gun';
    Sfx.bail();
    const msg = { rod: 'Rod in hand.', gun: Arsenal.weapon().name + ' out' + (Arsenal.weapon().scope ? ' — right-click to scope.' : '. Press 2 again to switch guns.'), spray: 'Bug spray ready — click to spray.', binos: 'Binoculars — hold the mouse to scout.', axe: 'Axe out — click a tree in front of you to chop it.', hands: 'Hands free.' }[next];
    Hud.toast(msg, next === 'gun' ? '#e2584d' : '#c8bfae', 1.4);
  },

  count(id) { return id === 'gun' ? Arsenal.ammo(Arsenal.weapon().ammo) : id === 'spray' ? Game.spray || 0 : id === 'axe' ? Game.wood || 0 : null; },

  // Bare hands: a jab at whoever (or whatever) is right in front of you.
  punch() {
    if (this.punchT > 0 || Bikes.riding || Fishing.state !== 'idle') return;
    if (Game.energy < 5) { Hud.toast('Too tired to throw a punch.', UI.muted, 1.2); return; }
    Game.energy -= 6; this.punchT = 0.4;
    Sfx.whoosh(0.12);
    const face = Player.face;
    let best = null, bd = 1.5;
    for (const t of Wanted.targets()) {
      const d = U.dist(Player.x, Player.y, t.x, t.y);
      if (d < bd && Math.abs(U.angDiff(face, Math.atan2(t.y - Player.y, t.x - Player.x))) < 1.1) { bd = d; best = t; }
    }
    if (best) { Wanted.knockOut(best, 0.6); Hud.toast('POW!', UI.accent, 0.7); return; }
    for (const an of Animals.list) {
      if (an.state === 'dead' || U.dist(Player.x, Player.y, an.x, an.y) > 1.8) continue;
      Animals.startle(an); Sfx.slap(0.8); Hud.toast(an.type === 'boar' ? 'You punched a boar. Bold.' : 'The deer is deeply offended.', UI.accent, 1.4);
      return;
    }
  },

  update(dt) {
    this.punchT = Math.max(0, (this.punchT || 0) - dt);
    if (this.current === 'hands' && Input.mousePressed && !Menus.open) this.punch();
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
    for (const b of Bugs.list) Bugs.splats.push({ wx: b.wx, wy: b.wy, wz: b.wz, t: 0.4, size: b.k.size });
    const n = Bugs.list.length;
    Bugs.list = [];
    Hud.toast(n ? 'Psssht! ' + n + ' bug' + (n > 1 ? 's' : '') + ' dropped. Bug-free for 90 s.' : 'Psssht! Bug-free for 90 s.', '#8fd16a', 1.8);
    Game.save();
  },

  // ---------- HUD ----------
  icon(g, id, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.lineCap = 'round';
    if (id === 'axe') {
      g.strokeStyle = '#a0703c'; g.lineWidth = 3; g.beginPath(); g.moveTo(-9, 12); g.lineTo(7, -10); g.stroke();
      g.fillStyle = '#c9d0d4'; g.beginPath(); g.moveTo(2, -14); g.quadraticCurveTo(15, -12, 14, -1); g.lineTo(5, -6); g.closePath(); g.fill();
      g.restore(); return;
    }
    if (id === 'rod') {
      g.strokeStyle = '#c9a86a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-12, 12); g.lineTo(12, -12); g.stroke();
      g.strokeStyle = '#f3ead6'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, -12); g.quadraticCurveTo(16, 0, 10, 10); g.stroke();
      g.fillStyle = '#8a9a9c'; g.beginPath(); g.arc(-5, 5, 4, 0, 7); g.fill();
    } else if (id === 'gun') {
      // Rifle in profile: stock, receiver, long barrel, scope on top.
      g.fillStyle = '#8A5A30';
      g.beginPath(); g.moveTo(-17, 1); g.lineTo(-17, 6); g.lineTo(-8, 4); g.lineTo(-5, 3); g.lineTo(6, 3); g.lineTo(6, 1); g.closePath(); g.fill();
      g.fillStyle = '#C9CDD2'; g.fillRect(-6, -1, 9, 3); g.fillRect(3, -0.5, 15, 1.6);
      g.fillRect(-8, -6, 12, 3); g.fillRect(2, -7, 3, 5); g.fillRect(-9, -6.5, 2, 4);
      g.fillRect(-4, -3, 1.5, 2); g.fillRect(1, -3, 1.5, 2);
      g.fillStyle = '#8A5A30'; g.fillRect(-4, 3, 1.5, 3);
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

  drawBar(hud, cx, y) {
    const g = hud.g, sw = 74, gap = 8;
    const x0 = cx - (TOOLS.length * sw + (TOOLS.length - 1) * gap) / 2;
    hud.toolSlots = [];
    TOOLS.forEach((t, i) => {
      const sx = x0 + i * (sw + gap), sel = this.current === t.id;
      hud.toolSlots.push({ x: sx, y, w: sw, h: 64, id: t.id });
      hud.slot(sx, y, sw, 64, sel);
      this.icon(g, t.id, sx + sw / 2, y + 26, 1.05);
      if (!Mobile.active) hud.text(t.key, sx + 9, y + 16, sel ? UI.accent : UI.dim, 11, 'left', 700);
      const c = this.count(t.id);
      if (c !== null) hud.text(String(c), sx + sw - 9, y + 16, c ? UI.muted : UI.bad, 11, 'right', 600);
      hud.text(t.id === 'gun' ? Arsenal.weapon().short : t.name, sx + sw / 2, y + 56, sel ? UI.ink : UI.muted, 10, 'center', sel ? 600 : 400);
      if (t.id === 'spray' && this.repelT > 0) {
        g.fillStyle = 'rgba(125,195,131,0.18)'; g.beginPath(); g.roundRect(sx + 4, y + 4, (sw - 8) * this.repelT / 90, 4, 2); g.fill();
        hud.text(Math.ceil(this.repelT) + 's', sx + sw - 9, y + 42, UI.good, 10, 'right', 600);
      }
    });
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
