// Deer and wild boar roaming the valley. Deer bolt, boars charge, the shotgun settles it.
'use strict';

const Animals = {
  list: [], group: null, frames: {}, spawnT: 0,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.list = [];
    if (!this.frames.deer0) {
      for (let f = 0; f < 2; f++) {
        this.frames['deer' + f] = this.tex(this.paintDeer(f, false));
        this.frames['buck' + f] = this.tex(this.paintDeer(f, true));
        this.frames['boar' + f] = this.tex(this.paintBoar(f));
      }
    }
  },

  tex(c) {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return t;
  },

  // Side-on, facing right. 24x20.
  paintDeer(f, buck) {
    const c = document.createElement('canvas'); c.width = 24; c.height = 20;
    const g = c.getContext('2d');
    const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const leg = '#5a3a1e', step = f ? 1 : -1;
    r(6 + step, 13, 2, 7, leg); r(9 - step, 13, 2, 7, leg); r(15 + step, 13, 2, 7, leg); r(18 - step, 13, 2, 7, leg);
    r(5, 8, 15, 6, '#9a6a3a'); r(6, 12, 13, 2, '#d8b88a'); // body + pale belly
    r(4, 8, 2, 3, '#f4f0e6'); // white tail
    r(17, 4, 3, 6, '#9a6a3a'); // neck
    r(18, 2, 5, 4, '#9a6a3a'); r(22, 4, 2, 2, '#2a1a10'); r(20, 3, 1, 1, '#111'); // head, nose, eye
    r(18, 0, 2, 3, '#7a5a32'); // ear
    if (buck) { g.fillStyle = '#e0d0a8'; r(19, 0, 1, 2, '#e0d0a8'); r(21, 0, 1, 2, '#e0d0a8'); r(17, 0, 2, 1, '#e0d0a8'); r(21, 0, 3, 1, '#e0d0a8'); }
    return c;
  },

  // 18x13 bristly boar with tusks.
  paintBoar(f) {
    const c = document.createElement('canvas'); c.width = 18; c.height = 13;
    const g = c.getContext('2d');
    const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const step = f ? 1 : -1;
    r(3 + step, 9, 2, 4, '#2a1e14'); r(6 - step, 9, 2, 4, '#2a1e14'); r(10 + step, 9, 2, 4, '#2a1e14'); r(13 - step, 9, 2, 4, '#2a1e14');
    r(2, 4, 13, 6, '#4a3a2a'); r(3, 3, 10, 2, '#2a1e14'); // body, bristly ridge
    for (let x = 3; x < 13; x += 2) r(x, 2, 1, 1, '#2a1e14');
    r(13, 4, 3, 5, '#4a3a2a'); r(15, 6, 3, 3, '#a8786a'); // head, snout
    r(16, 8, 1, 2, '#f4f0e6'); // tusk
    r(14, 5, 1, 1, '#d23a2a'); // mean little eye
    r(13, 2, 2, 2, '#3a2a1a'); // ear
    r(1, 5, 1, 2, '#2a1e14'); // tail
    return c;
  },

  spawn() {
    for (let t = 0; t < 12; t++) {
      const a = Math.random() * 6.28, d = 16 + Math.random() * 26;
      const x = Player.x + Math.cos(a) * d, y = Player.y + Math.sin(a) * d;
      const tile = World.tileAt(x, y);
      if (World.blocked(x, y) || World.isWater(x, y) || ![T.GRASS, T.MEADOW, T.FOREST].includes(tile)) continue;
      if (U.dist(x, y, World.town.x, World.town.y) < 22) continue;
      const boar = Math.random() < (tile === T.FOREST ? 0.55 : 0.2);
      const an = { type: boar ? 'boar' : 'deer', buck: !boar && Math.random() < 0.35, x, y, face: 1, state: 'graze', t: Math.random() * 3,
        heading: Math.random() * 6.28, speed: 0, walk: 0, cool: 0, deadT: 0 };
      const w = boar ? 1.15 : 1.6, h = boar ? 0.83 : 1.33;
      an.mesh = Actors.billboard(document.createElement('canvas'), w, h);
      an.mesh.material.map = this.frames[(boar ? 'boar' : an.buck ? 'buck' : 'deer') + 0];
      an.shadow = new THREE.Mesh(new THREE.CircleGeometry(w * 0.4, 10), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.22, depthWrite: false }));
      an.shadow.rotation.x = -Math.PI / 2; an.shadow.scale.y = 0.5;
      this.group.add(an.mesh, an.shadow);
      this.list.push(an);
      return;
    }
  },

  remove(an) {
    this.group.remove(an.mesh, an.shadow);
    an.mesh.geometry.dispose(); an.shadow.geometry.dispose();
    this.list.splice(this.list.indexOf(an), 1);
  },

  update(dt) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 1.5; if (this.list.filter((a) => a.state !== 'dead').length < 9) this.spawn(); }
    for (const an of this.list.slice()) {
      const pd = U.dist(an.x, an.y, Player.x, Player.y);
      if (pd > 55) { this.remove(an); continue; }
      an.t += dt; an.cool = Math.max(0, an.cool - dt);
      if (an.state === 'dead') {
        an.deadT -= dt;
        if (pd < 1.6) this.collect(an);
        else if (an.deadT <= 0) this.remove(an);
        continue;
      }
      let want = 0;
      if (an.state === 'graze') {
        // Amble, stop, nibble, amble.
        if (an.t > 2 + Math.random() * 3) { an.t = 0; an.heading += (Math.random() - 0.5) * 2.5; an.amble = Math.random() < 0.5; }
        want = an.amble ? 0.7 : 0;
        const nervous = an.type === 'deer' ? (Player.moving ? (Player.running ? 12 : 8) : 5) + (Gun.out ? 3 : 0) : 0;
        if (an.type === 'deer' && pd < nervous) this.startle(an);
        if (an.type === 'boar' && pd < 5.5 && an.cool <= 0) { an.state = 'alert'; an.t = 0; Hud.toast('*SNORT* — a boar is squaring up to you!', '#e2584d', 1.4); Sfx.thunk(); }
      } else if (an.state === 'flee') {
        an.heading = Math.atan2(an.y - Player.y, an.x - Player.x) + Math.sin(an.t * 4) * 0.5;
        want = an.type === 'deer' ? 6.5 : 5;
        if (an.t > 4) { an.state = 'graze'; an.t = 0; }
      } else if (an.state === 'alert') {
        an.heading = Math.atan2(Player.y - an.y, Player.x - an.x);
        if (an.t > 0.9) { an.state = 'charge'; an.t = 0; }
      } else if (an.state === 'charge') {
        an.heading = an.heading + U.angDiff(an.heading, Math.atan2(Player.y - an.y, Player.x - an.x)) * Math.min(1, dt * 2);
        want = 7.5;
        if (pd < 0.8) this.trample(an);
        else if (an.t > 2.6) { an.state = 'flee'; an.t = 0; an.cool = 12; }
      }
      an.speed = U.lerp(an.speed, want, Math.min(1, dt * 4));
      const dx = Math.cos(an.heading) * an.speed * dt, dy = Math.sin(an.heading) * an.speed * dt;
      let moved = false;
      if (!World.blocked(an.x + dx, an.y) && !World.isWater(an.x + dx, an.y)) { an.x += dx; moved = true; }
      if (!World.blocked(an.x, an.y + dy) && !World.isWater(an.x, an.y + dy)) { an.y += dy; moved = true; }
      if (!moved && an.speed > 0.1) an.heading += Math.PI * (0.4 + Math.random() * 0.4);
      if (Math.abs(dx) > 0.0005) an.face = dx > 0 ? 1 : -1;
      an.walk += an.speed * dt * 3;
    }
  },

  startle(an) { if (an.state !== 'dead') { an.state = 'flee'; an.t = 0; } },

  trample(an) {
    // Bowled over: knocked back a few metres and your line goes slack.
    const a = Math.atan2(Player.y - an.y, Player.x - an.x);
    for (let k = 0; k < 10; k++) {
      const nx = Player.x + Math.cos(a) * 0.3, ny = Player.y + Math.sin(a) * 0.3;
      if (World.blocked(nx, ny)) break;
      Player.x = nx; Player.y = ny;
    }
    if (Fishing.state !== 'idle' && Fishing.state !== 'fight') Fishing.reelInFast();
    Bugs.shake = 1; Sfx.thunk(); Sfx.slap(1);
    Hud.toast('A boar bowled you clean over!', '#e2584d', 2);
    an.state = 'flee'; an.t = 0; an.cool = 15;
  },

  // Called by the shotgun. Returns true if something was hit.
  shotAt(x, y) {
    let best = null, bd = 1e9;
    for (const an of this.list) {
      if (an.state === 'dead') continue;
      const d = U.dist(an.x, an.y, x, y);
      if (d < (an.type === 'deer' ? 1.2 : 0.9) && d < bd) { bd = d; best = an; }
    }
    if (!best) return false;
    const range = U.dist(Player.x, Player.y, best.x, best.y);
    if (Math.random() > U.clamp(1.15 - range / 30, 0.4, 1)) {
      this.startle(best);
      Hud.toast('Missed! It bolts.', '#a99f8a', 1.2);
      return true;
    }
    best.state = 'dead'; best.deadT = 45; best.speed = 0;
    const name = best.type === 'boar' ? 'wild boar' : best.buck ? 'stag' : 'deer';
    Hud.toast('Bagged a ' + name + '! Walk over to collect it.', '#8fd16a', 2.4);
    return true;
  },

  onGunshot(x, y) {
    for (const an of this.list) if (an.state !== 'dead' && U.dist(an.x, an.y, x, y) < 35 && an.state !== 'charge') this.startle(an);
  },

  collect(an) {
    const val = an.type === 'boar' ? 35 + Math.round(Math.random() * 25) : 45 + Math.round(Math.random() * 35) + (an.buck ? 30 : 0);
    Game.money += val;
    const key = an.type === 'boar' ? 'boar' : 'deer';
    Game.stats[key] = (Game.stats[key] || 0) + 1;
    Sfx.coin();
    Hud.toast((an.type === 'boar' ? 'Wild boar' : an.buck ? 'Stag' : 'Venison') + ' sold to the butcher — +' + U.fmtMoney(val), '#8fd16a', 2);
    this.remove(an);
    Game.save();
  },

  render() {
    for (const an of this.list) {
      const base = Scene3D.groundH(an.x, an.y);
      const key = an.type === 'boar' ? 'boar' : an.buck ? 'buck' : 'deer';
      an.mesh.material.map = this.frames[key + (an.speed > 0.2 ? Math.floor(an.walk) % 2 : 0)];
      an.mesh.position.set(an.x, base + (an.state === 'dead' ? 0.05 : 0), an.y);
      an.mesh.scale.x = an.face;
      an.mesh.rotation.set(-BILLBOARD_LEAN, 0, an.state === 'dead' ? an.face * 1.45 : 0, 'XYZ');
      an.shadow.position.set(an.x, base + 0.02, an.y);
    }
  },

  // "Collect" labels over carcasses.
  drawLabels(hud) {
    for (const an of this.list) {
      if (an.state !== 'dead' || U.dist(an.x, an.y, Player.x, Player.y) > 25) continue;
      const [sx, sy, ok] = Scene3D.project(an.x, an.y, Scene3D.groundH(an.x, an.y) + 0.8);
      if (ok) hud.text('▼ walk over to collect', sx, sy, '#8fd16a', 12, 'center', true);
    }
  },
};
