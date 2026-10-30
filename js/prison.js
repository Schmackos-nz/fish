// The Valley Prison, out past the edge of town. Everyone who gets locked up does their time here — you, and
// any local a warden catches brawling or getting busy in the bushes. They're out in the yard till release.
'use strict';

const Prison = {
  group: null,

  b() { return World.buildings.find((x) => x.type === 'prison'); },
  // The exercise yard in front of the building.
  yard() {
    const b = this.b(); if (!b) return null;
    const a = World.localToWorld(b, 0.3, World.depthOf(b) + 0.8), c = World.localToWorld(b, World.frontLen(b) - 0.3, World.depthOf(b) + 5);
    return { x0: Math.min(a.x, c.x), y0: Math.min(a.y, c.y), x1: Math.max(a.x, c.x), y1: Math.max(a.y, c.y) };
  },
  gate() { const y = this.yard(); return y ? { x: (y.x0 + y.x1) / 2, y: y.y1 + 1.4 } : World.spawn; },

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    const y = this.yard(); if (!y) return;
    // Chain-link fence round the yard (gap for the gate), 
    const P = (geo, c, o = 0.04) => Models.part(geo, c, o), post = (x, z) => { const p = P(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), '#8A9096'); p.position.set(x, Scene3D.groundH(x, z) + 1.0, z); this.group.add(p); };
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.8), new THREE.MeshBasicMaterial({ color: 0xB8C0C8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set((x0 + x1) / 2, Scene3D.groundH((x0 + x1) / 2, (z0 + z1) / 2) + 1.0, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); this.group.add(m);
      const top = P(new THREE.CylinderGeometry(0.03, 0.03, len, 6).rotateZ(Math.PI / 2), '#8A9096'); top.position.copy(m.position); top.position.y += 0.9; top.rotation.y = m.rotation.y; this.group.add(top);
    };
    const gx = (y.x0 + y.x1) / 2;
    // Anyone still doing time from the save goes back in the yard.
    for (const n of Npcs.list) { const r = (Game.inmates || {})[n.name]; if (r && r[0] > Game.env.day) { this.lock(n, 0, r[1], true); n.jailedUntil = r[0]; } }
    for (const [a, b] of [[[y.x0, y.y0], [y.x0, y.y1]], [[y.x1, y.y0], [y.x1, y.y1]], [[y.x0, y.y1], [gx - 0.8, y.y1]], [[gx + 0.8, y.y1], [y.x1, y.y1]]]) { rail(a[0], a[1], b[0], b[1]); post(a[0], a[1]); post(b[0], b[1]); }
  },

  term(days) { return Jail.term(days); },

  // Put a local away for `days` (what the player would get for the same thing).
  lock(n, days, reason, quiet) {
    const y = this.yard(); if (!y) { n.away = true; n.state = 'home'; return; }
    n.state = 'jailed'; n.jailedUntil = Game.env.day + Math.max(1, days); n.jailReason = reason;
    n.lure = null; n.fish = null; n.held = null; n.goingBush = false; n.goingHome = false; n.foe = null; n.mob = false;
    n.x = U.lerp(y.x0 + 0.6, y.x1 - 0.6, Math.random()); n.y = U.lerp(y.y0 + 0.6, y.y1 - 0.6, Math.random());
    n.yardT = 0;
    if (!quiet) Staff.news.push(n.name + ' got ' + Jail.term(days) + ' in the Valley Prison for ' + reason + '.');
  },

  // Daily: let out anyone who's served their time.
  daily() {
    for (const n of Npcs.list) if (n.state === 'jailed' && Game.env.day >= n.jailedUntil) {
      const g = this.gate(); n.x = g.x; n.y = g.y; n.state = 'cast'; n.casts = 0; n.t = 1; n.jailedUntil = 0;
      Staff.news.push(n.name + ' has been released from the Valley Prison.');
    }
  },

  // Inmates mill about the yard.
  update(dt) {
    const y = this.yard(); if (!y) return;
    for (const n of Npcs.list) {
      if (n.state !== 'jailed') continue;
      n.yardT = (n.yardT || 0) - dt;
      if (!n.yardGoal || n.yardT <= 0 || U.dist(n.x, n.y, n.yardGoal.x, n.yardGoal.y) < 0.3) { n.yardGoal = { x: U.lerp(y.x0 + 0.5, y.x1 - 0.5, Math.random()), y: U.lerp(y.y0 + 0.5, y.y1 - 0.5, Math.random()) }; n.yardT = 4 + Math.random() * 6; }
      const a = Math.atan2(n.yardGoal.y - n.y, n.yardGoal.x - n.x), sp = 0.8 * dt;
      if (U.dist(n.x, n.y, n.yardGoal.x, n.yardGoal.y) > 0.3) { n.x += Math.cos(a) * sp; n.y += Math.sin(a) * sp; n.face = a; n.walkT += dt; }
    }
  },

  // Wardens on patrol keep an eye out for misbehaving locals.
  spot(w) {
    if (w.collar || w.state !== 'patrol') return false;
    for (const n of Npcs.list) {
      if (U.dist(n.x, n.y, w.x, w.y) > 18) continue;
      if (n.state === 'brawl' && n.foe) { w.state = 'collar'; w.collar = [n, n.foe]; w.collarWhy = 'brawling'; w.t = 0; Wardens.say(w, ['OI! Break it up, you two!', 'That\'s ENOUGH!'], 2.4); return true; }
    }
    const c = Couples.active;
    if (c && c.a.state === 'bush' && c.b.state === 'bush' && U.dist(c.bush.x, c.bush.y, w.x, w.y) < 18) { w.state = 'collar'; w.collar = [c.a, c.b]; w.collarWhy = 'public indecency'; w.collarBush = true; w.collarAt = c.bush.door; w.t = 0; Wardens.say(w, ['What\'s going on in that bush?!', 'Oi! Out of there, NOW!'], 2.4); return true; }
    return false;
  },

  // The warden reached them: both go away for what you'd get.
  collar(w) {
    const [a, b] = w.collar, why = w.collarWhy;
    if (w.collarBush && Couples.active) Couples.finish(false);
    const days = why === 'brawling' ? 1 + 1 + 4 : 1 + 1; // what you'd get: a brawl is assault, a bush is a misdemeanour
    for (const n of [a, b]) { n.pose = 'normal'; n.poseT = undefined; this.lock(n, days, why); }
    Wardens.say(w, why === 'brawling' ? 'You\'re both nicked for affray.' : 'Indecent exposure. You\'re both coming with me.', 3);
    if (U.dist(w.x, w.y, Player.x, Player.y) < 40) Hud.toast(w.name + ' arrested ' + a.name + ' and ' + b.name + ' for ' + why + ' — ' + Jail.term(days) + ' each in the Valley Prison.', UI.accent, 3.4);
    w.collar = null; w.collarBush = false; w.state = 'patrol'; w.t = 0; w.checkCool = 20;
  },

  interactions(add) {
    const b = this.b(); if (!b) return;
    const d = World.doorOf(b);
    add(d.x, d.y, 1.8, 'Valley Prison — visiting hours are over', () => Hud.toast('A guard waves you away. "Come back when you\'re on the list. Or in cuffs."', UI.muted, 2.2));
  },
};
