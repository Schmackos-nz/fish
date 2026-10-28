// Sunbathers drifting on lilos. Naked as the day they were born (the HUD censors them), endlessly unbothered — until you hook one.
'use strict';

// Out of the water and off home on foot: head for one of the nearer cottages, or just wander off out of sight.
// Returns true once they've arrived (or are long gone).
function walkHome(e, dt) {
  if (!e.home) {
    const hs = World.houses.slice().sort((a, b) => U.dist(a.x, a.y, e.x, e.y) - U.dist(b.x, b.y, e.x, e.y)).slice(0, 4);
    const h = hs.length ? hs[(Math.random() * hs.length) | 0] : null, d = h ? World.doorOf(h) : null;
    e.home = d ? { x: d.x, y: d.y } : { x: e.x + (Math.random() - 0.5) * 120, y: e.y + (Math.random() - 0.5) * 120 };
    e.homeT = 0; e.walkPhase = 0;
  }
  e.homeT += dt;
  const want = Math.atan2(e.home.y - e.y, e.home.x - e.x), sp = 1.35 * dt;
  for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) {
    const a = want + off, nx = e.x + Math.cos(a) * sp, ny = e.y + Math.sin(a) * sp;
    if (World.blocked(nx, ny) || World.depthAt(nx, ny) > 0.3) continue;
    e.x = nx; e.y = ny; e.heading = a; break;
  }
  e.walkPhase += dt * 1.35;
  return U.dist(e.x, e.y, e.home.x, e.home.y) < 1 || e.homeT > 150 || (e.homeT > 6 && U.dist(e.x, e.y, Player.x, Player.y) > 65);
}

const LILO_COLORS = [['#e8408a', '#b02a66'], ['#f2c01a', '#b88a10'], ['#2a8ae8', '#1a5aa8'], ['#3ac24a', '#228a30'], ['#f2702a', '#b04a14']];
const SKINS = ['#f0c8a0', '#e0a878', '#c08a60', '#8a5a3a', '#f5d2b8'];
const FLOATER_SAY = {
  chat: ['Lovely day for it!', 'Ahh… vitamin D.', 'Don\'t mind us!', 'Mind your hooks, love.', 'Eyes on the water, angler.', 'Best spot on the lake, this.', 'Caught anything? …Don\'t answer that.'],
  hooked: ['OI! Watch it!', 'HEY! I\'m not a fish!', 'Did you just HOOK me?!', 'Unbelievable.'],
  reeled: ['Stop reeling me in!', 'HEY! HEY!', 'This is NOT consensual boating!', 'I will be writing to the council!'],
  freed: ['Next time, cast AWAY from me!', 'Here\'s your lure back. Honestly.', 'Some of us are trying to relax!'],
  kept: ['Free spinner! Cheers!', 'Finders keepers!'],
  gun: ['DON\'T SHOOT!!', 'Is that a GUN?!', 'PADDLE! PADDLE!', 'We\'re LEAVING!'],
};

const Floaters = {
  list: [], group: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.list = [];
    const rng = U.mulberry32(World.seed + 321);
    // A couple on the town lake, the rest scattered across the other lakes.
    const lakes = World.lakes.filter((l) => l.kind === K.LAKE);
    const startNice = this.nice();
    for (let i = 0; i < 10; i++) {
      const lake = i < 3 ? World.lakes[0] : lakes[(rng() * lakes.length) | 0];
      for (let t = 0; t < 40; t++) {
        const a = rng() * 6.28, r = rng() * lake.r * 0.8;
        const x = lake.x + Math.cos(a) * r, y = lake.y + Math.sin(a) * r;
        if (World.depthAt(x, y) < 1.2) continue;
        this.add(x, y, rng);
        if (!startNice) this.list[this.list.length - 1].state = 'gone';
        break;
      }
    }
  },

  add(x, y, rng) {
    const f = {
      x, y, vx: 0, vy: 0, ang: rng() * 6.28, spin: (rng() - 0.5) * 0.1,
      lilo: LILO_COLORS[(rng() * LILO_COLORS.length) | 0], skin: SKINS[(rng() * SKINS.length) | 0],
      state: 'float', shades: rng() < 0.6, flee: 0, talkT: 5 + rng() * 20, bubble: null, bubbleT: 0, hooked: false,
    };
    f.mesh = new THREE.Group();
    this.build3D(f);
    this.lieDown(f);
    this.group.add(f.mesh);
    this.list.push(f);
  },

  // A 3D inflatable lilo, and its sunbather (wearing nothing but shades, sometimes).
  build3D(f) {
    const g = new THREE.Group(), P = (geo, c, o) => Models.part(geo, c, o);
    const [main, rib] = f.lilo;
    const pad = P(new THREE.BoxGeometry(0.95, 0.16, 2.1), main, 0.03); pad.position.y = 0.08; g.add(pad);
    for (let k = 0; k < 6; k++) { const r = P(new THREE.CylinderGeometry(0.08, 0.08, 0.93, 8), rib, 0); r.rotation.z = Math.PI / 2; r.position.set(0, 0.15, -0.75 + k * 0.32); g.add(r); }
    const pillow = P(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 10), U.shade(main, 0.3), 0.05); pillow.rotation.z = Math.PI / 2; pillow.position.set(0, 0.2, -0.92); g.add(pillow);
    const p = Models.person({ hatStyle: 'hair', hair: '#5A3A1E', shirt: f.skin, pants: f.skin, skin: f.skin, mitt: f.skin });
    if (f.shades) for (const z of [-0.085, 0.085]) { const s = P(new THREE.BoxGeometry(0.04, 0.09, 0.13), '#151515', 0); s.position.set(0.3, 0.035, z); p.userData.rig.head.add(s); }
    // Carrying it home: tucked under the arm, long side forward.
    f.carry = new THREE.Group(); f.carry.rotation.z = Math.PI / 2; f.carry.position.set(0.02, 0.5, 0.46); f.carry.scale.setScalar(0.62);
    f.lilo3 = g; f.body = p;
  },

  // On the lilo: lying face-up, head on the pillow, arms flopped out.
  lieDown(f) {
    const rig = f.body.userData.rig;
    Models.pose(rig, { t: 0 });
    rig.yaw.rotation.y = -Math.PI / 2; rig.lean.rotation.x = -Math.PI / 2;
    rig.armR.rotation.set(-1.25, 0, 0); rig.armL.rotation.set(1.25, 0, 0);
    f.body.position.set(0, 0.42, 0.5);
    f.mesh.add(f.lilo3); f.lilo3.rotation.set(0, 0, 0); f.lilo3.position.set(0, 0, 0);
    f.lilo3.add(f.body);
  },

  // Out of the water: stand up, lilo under the arm, off home.
  standUp(f) {
    const rig = f.body.userData.rig;
    rig.lean.rotation.x = 0;
    f.mesh.add(f.body); f.body.position.set(0, 0, 0);
    rig.yaw.add(f.carry); f.carry.add(f.lilo3);
    f.lilo3.rotation.set(Math.PI / 2, 0, 0); f.lilo3.position.set(0, 0, 0);
    f.state = 'walk'; f.home = null; f.heading = 0;
  },

  nice() { const e = Game.env; return e.weather.id === 'clear' && e.hour >= 8 && e.hour < 19; },

  respawn(f) {
    const lakes = World.lakes.filter((l) => l.kind === K.LAKE);
    const lake = Math.random() < 0.4 ? World.lakes[0] : lakes[(Math.random() * lakes.length) | 0];
    for (let t = 0; t < 30; t++) {
      const a = Math.random() * 6.28, r = Math.random() * lake.r * 0.75;
      const x = lake.x + Math.cos(a) * r, y = lake.y + Math.sin(a) * r;
      if (World.depthAt(x, y) > 1.2) { f.x = x; f.y = y; f.vx = f.vy = 0; f.state = 'float'; this.lieDown(f); return; }
    }
  },

  near(x, y, r) {
    let best = null, bd = r;
    for (const f of this.list) {
      if (f.state === 'gone') continue; const d = U.dist(x, y, f.x, f.y); if (d < bd) { bd = d; best = f; } }
    return best;
  },

  say(f, text, time = 3) { f.bubble = text; f.bubbleT = time; Voice.babble(text, f.x, f.y, f.skin + f.lilo[0]); },

  update(dt) {
    const e = Game.env;
    for (const f of this.list) {
      f.bubbleT = Math.max(0, f.bubbleT - dt);
      f.flee = Math.max(0, f.flee - dt);
      if (f.hooked) continue; // being dragged by the line
      // Sun's out, lilos out. Rain or evening: paddle for shore and pack up.
      const nice = this.nice();
      if (f.state === 'gone') { if (nice && Math.random() < dt * 0.04) this.respawn(f); continue; }
      if (f.state === 'walk') { if (walkHome(f, dt)) f.state = 'gone'; continue; }
      if (!nice && f.state !== 'leaving') {
        f.state = 'leaving'; f.shore = World.nearestShore(f.x, f.y);
        if (U.dist(f.x, f.y, Player.x, Player.y) < 30) this.say(f, e.weather.id === 'rain' ? U.pick(Math.random, ['Ugh, RAIN!', 'My tan!', 'Everybody out!']) : 'Sun\'s going — I\'m off.', 2.6);
      }
      if (f.state === 'leaving') {
        if (nice) f.state = 'float';
        else {
          const a = Math.atan2(f.shore.y - f.y, f.shore.x - f.x);
          f.x += Math.cos(a) * 1.1 * dt; f.y += Math.sin(a) * 1.1 * dt;
          f.ang += U.angDiff(f.ang, a + Math.PI / 2) * Math.min(1, dt * 2);
          if (U.dist(f.x, f.y, f.shore.x, f.shore.y) < 0.8) this.standUp(f);
          continue;
        }
      }
      const [fx, fy] = World.flowAt(f.x, f.y);
      let ax = e.wind.x * 0.015 + fx * 0.25 + (Math.random() - 0.5) * 0.05;
      let ay = e.wind.y * 0.015 + fy * 0.25 + (Math.random() - 0.5) * 0.05;
      if (f.flee > 0) { const a = Math.atan2(f.y - Player.y, f.x - Player.x); ax += Math.cos(a) * 1.5; ay += Math.sin(a) * 1.5; }
      f.vx = (f.vx + ax * dt) * (1 - dt * 0.4); f.vy = (f.vy + ay * dt) * (1 - dt * 0.4);
      const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
      if (World.isWater(nx, ny) && World.depthAt(nx, ny) > 0.6) { f.x = nx; f.y = ny; } else { f.vx *= -0.5; f.vy *= -0.5; }
      f.ang += f.spin * dt;
      // Fish give the lilos a wide berth.
      if (Math.random() < dt) Fish.spookNear(f.x, f.y, 1.5);
      f.talkT -= dt;
      if (f.talkT <= 0) {
        f.talkT = 18 + Math.random() * 25;
        if (U.dist(f.x, f.y, Player.x, Player.y) < 16) this.say(f, U.pick(Math.random, FLOATER_SAY.chat));
      }
    }
  },

  onHooked(f) { f.hooked = true; this.say(f, U.pick(Math.random, FLOATER_SAY.hooked), 2.5); Hud.ripple(f.x, f.y, 1); },

  // Reeling drags the lilo toward the bank. Returns true once they're close enough to unhook themselves.
  drag(f, dx, dy, dist) {
    const nx = f.x + dx, ny = f.y + dy;
    if (World.isWater(nx, ny)) { f.x = nx; f.y = ny; }
    if (dist > 0.05 && Math.random() < 0.03) this.say(f, U.pick(Math.random, FLOATER_SAY.reeled), 2);
    return U.dist(f.x, f.y, Player.x, Player.y) < 3.5 || !World.isWater(nx, ny);
  },

  release(f, kept) {
    f.hooked = false; f.flee = 3;
    this.say(f, U.pick(Math.random, kept ? FLOATER_SAY.kept : FLOATER_SAY.freed), 3);
  },

  onGunshot() {
    for (const f of this.list) {
      if (U.dist(f.x, f.y, Player.x, Player.y) > 35) continue;
      f.flee = 6;
      this.say(f, U.pick(Math.random, FLOATER_SAY.gun), 2.5);
    }
  },

  render() {
    for (const f of this.list) {
      const vis = f.state !== 'gone' && !Interior.active && U.dist(f.x, f.y, Player.x, Player.y) < 50;
      f.mesh.visible = vis;
      if (!vis) continue;
      if (f.state === 'walk') {
        // Walking home, lilo under the arm (and the right arm clamped round it).
        const rig = f.body.userData.rig;
        f.mesh.position.set(f.x, Scene3D.standH(f.x, f.y), f.y);
        Models.pose(rig, { moving: true, phase: f.walkPhase, t: Game.time });
        rig.yaw.rotation.y = -f.heading;
        rig.armR.rotation.set(-0.55, 0, 0.15);
        continue;
      }
      f.mesh.position.set(f.x, -0.02 + Math.sin(Game.time * 1.6 + f.x) * 0.025, f.y);
      f.lilo3.rotation.y = -f.ang;
    }
  },

  // A jittering mosaic bar over each sunbather's body.
  drawCensors(hud) {
    if (Interior.active) return;
    const g = hud.g, pal = ['#E8B88A', '#D9A07A', '#C08A60', '#F0C8A0', '#B97A55', '#8FC4E8', '#F4E3C8'];
    if (!this.mosaic || Game.time - (this.mosaicT || 0) > 0.15) { this.mosaicT = Game.time; this.mosaic = Array.from({ length: 60 }, () => pal[(Math.random() * pal.length) | 0]); }
    for (const f of this.list) {
      if (!f.mesh.visible || f.state === 'gone' || U.dist(f.x, f.y, Player.x, Player.y) > 45) continue;
      const [sx, sy, ok] = Scene3D.project(f.x, f.y, f.state === 'walk' ? Scene3D.standH(f.x, f.y) + 0.45 : 0.35);
      if (!ok) continue;
      const scale = U.clamp(16 / Scene3D.camDist, 0.6, 1.6), cell = 7 * scale, cols = 6, rows = f.state === 'walk' ? 6 : 10;
      const x0 = sx - cols * cell / 2, y0 = sy - rows * cell / 2;
      for (let i = 0; i < cols * rows; i++) { g.fillStyle = this.mosaic[i]; g.fillRect(x0 + (i % cols) * cell, y0 + Math.floor(i / cols) * cell, cell + 0.5, cell + 0.5); }
      g.fillStyle = '#111'; g.fillRect(x0 - 6 * scale, sy - 7 * scale, cols * cell + 12 * scale, 14 * scale);
      hud.text('CENSORED', sx, sy + 3 * scale, '#FFFFFF', Math.round(8 * scale), 'center', 800);
    }
  },

  drawBubbles(hud) {
    const g = hud.g;
    for (const f of this.list) {
      if (f.state === 'gone' || f.bubbleT <= 0 || U.dist(f.x, f.y, Player.x, Player.y) > 30) continue;
      const [sx, sy, ok] = Scene3D.project(f.x, f.y, f.state === 'walk' ? Scene3D.standH(f.x, f.y) + 1.7 : 0.6);
      if (!ok) continue;
      g.font = '600 13px ' + UI.font;
      const w = Math.min(300, g.measureText(f.bubble).width + 20), h = 26;
      const bx = sx - w / 2, by = sy - h - 10;
      g.globalAlpha = Math.min(1, f.bubbleT * 2);
      g.fillStyle = '#fff0f6'; g.strokeStyle = '#7a2a4a'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(bx, by, w, h, 10); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(sx - 6, by + h - 1); g.lineTo(sx, by + h + 9); g.lineTo(sx + 6, by + h - 1); g.fill();
      g.fillStyle = '#3a1a2a'; g.textAlign = 'center';
      g.fillText(f.bubble, sx, by + 18, w - 12);
      g.globalAlpha = 1;
    }
  },
};
