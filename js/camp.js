// Woodcutting and campfires: fell a tree with the axe for firewood, build a fire anywhere, cook on it.
'use strict';

const FIRE_COST = 3;      // wood to build a fire
const FIRE_HOURS = 4;     // in-game hours one fire burns
const REGROW_DAYS = 7;    // chopped trees grow back after this long (applied on load)

const Camp = {
  hits: {}, chopT: 0, axe: null, fires: [], falling: [], crackleT: 0,

  // Called right after World.generate: trees felled earlier stay felled (until they regrow).
  applyChopped() {
    Game.chopped = (Game.chopped || []).filter((c) => Game.env.day - c.day < REGROW_DAYS);
    for (const c of Game.chopped) if (World.obj[c.i] === O.PINE || World.obj[c.i] === O.OAK) World.obj[c.i] = O.STUMP;
  },

  init() {
    this.hits = {}; this.falling = [];
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    if (!this.axe) {
      const P = (geo, c, o = 0.1) => Models.part(geo, c, o);
      this.axe = new THREE.Group();
      const haft = P(new THREE.CylinderGeometry(0.022, 0.026, 0.62, 8), '#8A5A30'); haft.position.y = 0.24; this.axe.add(haft);
      const head = P(new THREE.BoxGeometry(0.05, 0.1, 0.2), '#9AA3AA'); head.position.set(0, 0.5, 0.07); this.axe.add(head);
      const edge = P(new THREE.BoxGeometry(0.052, 0.13, 0.04), '#D8DEE2', 0.05); edge.position.set(0, 0.5, 0.18); this.axe.add(edge);
      this.axe.scale.setScalar(1.2); this.axe.visible = false;
      Scene3D.scene.add(this.axe);
    } else Scene3D.scene.add(this.axe);
    this.fires = [];
    for (const f of Game.fires || []) this.spawnFire(f);
  },

  nowH() { return Game.env.day * 24 + Game.env.hour; },

  // ---------- chopping ----------
  treeInFront() {
    let best = null, bd = 1.9;
    const px = Math.floor(Player.x), py = Math.floor(Player.y);
    for (let y = py - 2; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) {
      if (!World.inB(x, y)) continue;
      const o = World.obj[World.idx(x, y)];
      if (o !== O.PINE && o !== O.OAK) continue;
      const d = U.dist(Player.x, Player.y, x + 0.5, y + 0.55);
      const off = Math.abs(U.angDiff(Player.face, Math.atan2(y + 0.55 - Player.y, x + 0.5 - Player.x)));
      if (d < bd && (off < 1.3 || d < 0.9)) { bd = d; best = { x, y, o }; }
    }
    return best;
  },

  swing() {
    if (this.chopT > 0 || Fishing.state !== 'idle' || Bikes.riding || Interior.active) return;
    if (Game.energy < 4) { Hud.toast('Too tired to swing an axe. Eat, or have a sit by a fire.', UI.muted, 1.6); return; }
    this.chopT = 0.5; Game.energy -= 3;
    Sfx.whoosh(0.15);
    const t = this.treeInFront();
    if (!t) {
      // Axes and people don't mix — but a fishing guide's world is forgiving: it's just a shove.
      for (const tg of Wanted.targets()) if (U.dist(tg.x, tg.y, Player.x, Player.y) < 1.4) { Wanted.knockOut(tg, 0.9); Hud.toast('WHACK! (flat of the axe)', UI.bad, 1); return; }
      return;
    }
    const key = World.idx(t.x, t.y), need = t.o === O.OAK ? 5 : 4;
    this.hits[key] = (this.hits[key] || 0) + 1;
    setTimeout(() => { Sfx.thunk(); Sfx.tone(180 + Math.random() * 40, 0.08, 0.25, 'square', 90); }, 140);
    Bugs.shake = 0.25;
    if (this.hits[key] < need) { Hud.toast(['Thock!', 'Chop!', 'Thwack!'][this.hits[key] % 3] + ' (' + this.hits[key] + '/' + need + ')', UI.accent, 0.6); return; }
    delete this.hits[key];
    setTimeout(() => this.fell(t), 160);
  },

  fell(t) {
    const i = World.idx(t.x, t.y);
    World.obj[i] = O.STUMP;
    Scene3D.removeTree(t.x, t.y);
    (Game.chopped = Game.chopped || []).push({ i, day: Game.env.day });
    const got = t.o === O.OAK ? 4 : 3;
    Game.wood = (Game.wood || 0) + got;
    Sfx.burst(0.9, 600, 0.5, 'lowpass', 0.8, 120);
    setTimeout(() => { Sfx.thunk(); Bugs.shake = 0.6; }, 650);
    Hud.toast('TIMBER! +' + got + ' wood (' + Game.wood + ')' + (Game.wood >= FIRE_COST ? ' — press E to build a campfire.' : ''), UI.good, 2.2);
    // A trunk that topples away from you, plus the stump left behind.
    const fall = this.treeMesh(t.o);
    const gx = t.x + 0.5, gy = t.y + 0.55;
    fall.position.set(gx, Scene3D.groundH(gx, gy), gy);
    fall.rotation.y = -Math.atan2(gy - Player.y, gx - Player.x);
    this.group.add(fall);
    this.falling.push({ m: fall, t: 0 });
    this.addStump(gx, gy);
    if (U.dist(gx, gy, World.town.x, World.town.y) < 16) { Hud.toast('Chopping trees on the main street… the locals are NOT impressed.', UI.bad, 2); Wanted.crime(0.5); }
    Game.save();
  },

  treeMesh(o) {
    const P = (geo, c, ol = 0.04) => Models.part(geo, c, ol);
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    const trunk = P(new THREE.CylinderGeometry(0.07, 0.11, 0.8, 7), '#7A4E2A'); trunk.position.y = 0.4; inner.add(trunk);
    if (o === O.OAK) { const c = P(new THREE.IcosahedronGeometry(0.6, 1), '#4FA644'); c.position.y = 1.3; inner.add(c); }
    else for (const [r, h, y] of [[0.66, 0.95, 0.92], [0.52, 0.85, 1.42], [0.36, 0.72, 1.9]]) { const c = P(new THREE.ConeGeometry(r, h, 7), '#3A9A52'); c.position.y = y; inner.add(c); }
    g.userData.inner = inner;
    return g;
  },

  addStump(x, y) {
    const s = Models.part(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 8), '#7A4E2A', 0.03);
    const top = Models.part(new THREE.CylinderGeometry(0.105, 0.105, 0.01, 8), '#D9B47A', 0);
    top.position.y = 0.085; s.add(top);
    s.position.set(x, Scene3D.groundH(x, y) + 0.06, y);
    this.group.add(s);
  },

  // ---------- campfires ----------
  canBuildHere() {
    if (Interior.active || Bikes.riding || (Game.wood || 0) < FIRE_COST) return false;
    const x = Player.x + Math.cos(Player.face) * 0.9, y = Player.y + Math.sin(Player.face) * 0.9;
    if (World.blocked(x, y) || World.isWater(x, y) || World.tileAt(Math.floor(x), Math.floor(y)) === T.PLANK) return false;
    if (World.buildings.some((b) => x > b.x - 1.5 && x < b.x + b.w + 1.5 && y > b.y - 1.5 && y < b.y + b.h + 1.5)) return false;
    if (this.fires.some((f) => U.dist(f.x, f.y, x, y) < 3)) return false;
    return { x, y };
  },

  build() {
    const at = this.canBuildHere();
    if (!at) return;
    Game.wood -= FIRE_COST;
    const f = { x: at.x, y: at.y, until: this.nowH() + FIRE_HOURS };
    (Game.fires = Game.fires || []).push(f);
    this.spawnFire(f);
    Sfx.burst(0.6, 1200, 0.4, 'bandpass', 1, 3000);
    Hud.toast(Game.env.weather.id === 'rain' ? 'Campfire lit — it\'s spitting, so it won\'t last long.' : 'Campfire lit! E to cook on it, or sit by it to rest.', UI.good, 2.2);
    Game.save();
  },

  spawnFire(f) {
    const P = (geo, c, o = 0.03) => Models.part(geo, c, o);
    const g = new THREE.Group();
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, st = P(new THREE.DodecahedronGeometry(0.09, 0), k % 2 ? '#9A9A92' : '#86867E');
      st.position.set(Math.cos(a) * 0.38, 0.05, Math.sin(a) * 0.38); st.scale.y = 0.7; g.add(st);
    }
    const logs = new THREE.Group(); g.add(logs);
    for (let k = 0; k < 4; k++) {
      const l = P(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), '#6B4423');
      const pivot = new THREE.Group(); pivot.rotation.y = k * Math.PI / 2 + 0.3; l.rotation.set(0, 0, 0.6); l.position.set(0.12, 0.16, 0); pivot.add(l); logs.add(pivot);
    }
    const flame = new THREE.Group(); g.add(flame);
    const fm = (c, r, h, y) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92 })); m.position.y = y; flame.add(m); return m; };
    f.cones = [fm(0xE8501F, 0.2, 0.55, 0.38), fm(0xF59A23, 0.14, 0.42, 0.36), fm(0xFFE07A, 0.07, 0.26, 0.3)];
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFF9A3C, transparent: true, opacity: 0.18, depthWrite: false }));
    glow.position.y = 0.03; g.add(glow);
    g.position.set(f.x, Scene3D.groundH(f.x, f.y), f.y);
    f.mesh = g; f.flame = flame; f.glow = glow; f.logs = logs;
    this.group.add(g);
    this.fires.push(f);
  },

  burning(f) { return f.until > this.nowH(); },
  nearFire(r = 2) { return this.fires.find((f) => this.burning(f) && U.dist(f.x, f.y, Player.x, Player.y) < r); },

  addLog(f) {
    if ((Game.wood || 0) < 1) return;
    Game.wood--; f.until = Math.max(f.until, this.nowH()) + 2;
    Sfx.burst(0.4, 900, 0.3, 'bandpass', 1, 2400);
    Hud.toast('Log on the fire — burns another 2 hours.', UI.good, 1.4);
    Game.save();
  },

  openFire(f) {
    const left = Math.max(0, f.until - this.nowH());
    Life.openCook('the campfire', {
      html: `<div class="row"><div><b>Campfire</b><div class="desc">${left > 0 ? 'Burns for about ' + left.toFixed(1) + ' more hours' : 'Burnt out'} · wood ×${Game.wood || 0}</div></div>
        <button data-log ${(Game.wood || 0) < 1 ? 'disabled' : ''}>${left > 0 ? 'Add a log (+2h)' : 'Relight (1 wood)'}</button></div>`,
      wire: (el, again) => { const b = el.querySelector('[data-log]'); if (b) b.onclick = () => { this.addLog(f); again(); }; },
    });
  },

  // E-key candidates.
  interactions(cands) {
    for (const f of this.fires) {
      const d = U.dist(f.x, f.y, Player.x, Player.y);
      if (d > 1.9) continue;
      if (this.burning(f)) cands.push({ d, x: f.x, y: f.y, label: 'Campfire — cook & add logs', run: () => this.openFire(f) });
      else if ((Game.wood || 0) > 0) cands.push({ d, x: f.x, y: f.y, label: 'Relight the fire (1 wood)', run: () => this.addLog(f) });
    }
    // Lowest priority: anything else nearby wins the E key.
    if ((Tools.current === 'axe' || Tools.current === 'hands') && this.canBuildHere()) cands.push({ d: 50, x: Player.x, y: Player.y, label: 'Build a campfire (' + FIRE_COST + ' wood)', run: () => this.build() });
  },

  update(dt) {
    this.chopT = Math.max(0, this.chopT - dt);
    if (Tools.current === 'axe' && Input.mousePressed && !Menus.open) this.swing();
    const now = this.nowH(), rain = Game.env.weather.id === 'rain';
    for (const f of this.fires) {
      // Rain eats a fire three times as fast.
      if (rain && f.until > now) f.until -= dt * 24 / 1200 * 2;
      if (f.until > now && f.wasOut) f.wasOut = false;
      if (f.until <= now && !f.wasOut) { f.wasOut = true; if (U.dist(f.x, f.y, Player.x, Player.y) < 12) Hud.toast(rain ? 'The rain put your campfire out.' : 'Your campfire has burnt out.', UI.muted, 1.8); }
    }
    // Ash heaps are cleared away half a day after going out.
    const keep = this.fires.filter((f) => f.until > now - 12);
    if (keep.length !== this.fires.length) {
      for (const f of this.fires) if (!keep.includes(f)) this.group.remove(f.mesh);
      this.fires = keep; Game.fires = keep.map((f) => ({ x: f.x, y: f.y, until: f.until }));
    }
    // Sitting by a fire: warm, rested, quietly crackling.
    const near = this.nearFire(2.4);
    if (near) {
      if (Game.energy < 100 && !Player.moving) Game.energy = Math.min(100, Game.energy + dt * 2.5);
      this.crackleT -= dt;
      if (this.crackleT <= 0) { this.crackleT = 0.15 + Math.random() * 0.5; Sfx.burst(0.03 + Math.random() * 0.04, 2500 + Math.random() * 3000, 0.08 + Math.random() * 0.1, 'highpass'); }
    }
  },

  render(dt) {
    // The axe in hand, swinging down on each chop.
    const show = Tools.current === 'axe' && !Bikes.riding && !Interior.active;
    this.axe.visible = show;
    if (show) {
      const h = Actors.handWorld || new THREE.Vector3(Player.x, Scene3D.standH(Player.x, Player.y) + 0.3, Player.y);
      const a = Player.face, k = this.chopT > 0 ? Math.sin((1 - this.chopT / 0.5) * Math.PI) : 0;
      this.axe.position.set(h.x, h.y - 0.1, h.z);
      this.axe.rotation.set(0, -a + Math.PI / 2, 0);
      this.axe.rotateX(0.5 + k * 1.4 - (this.chopT > 0.35 ? 0.9 : 0));
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.t += dt;
      f.m.userData.inner.rotation.z = -Math.min(Math.PI / 2, f.t * f.t * 3.2); // accelerate as it goes over
      if (f.t > 1.4) f.m.position.y -= dt * 0.9; // settles into the undergrowth
      if (f.t > 2.2) { this.group.remove(f.m); this.falling.splice(i, 1); }
    }
    const now = this.nowH();
    for (const f of this.fires) {
      const on = f.until > now;
      f.flame.visible = on; f.glow.visible = on;
      if (f.lit !== on) { f.lit = on; f.logs.children.forEach((p) => { p.children[0].material = Models.mat(on ? '#6B4423' : '#2E2620'); }); }
      if (!on) continue;
      const t = Game.time * 9 + f.x;
      f.cones.forEach((c, j) => { c.scale.set(1 + Math.sin(t * 1.3 + j) * 0.12, 1 + Math.sin(t + j * 2) * 0.22, 1 + Math.cos(t * 1.1 + j) * 0.12); c.rotation.y = t * 0.2 * (j + 1); });
      f.glow.material.opacity = (0.14 + Math.sin(t * 1.7) * 0.04) * (1.4 - Game.env.daylight * 0.8);
    }
  },
};
