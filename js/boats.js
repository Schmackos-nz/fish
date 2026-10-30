// Boats: zippy jetskis and tin fishing dinghies. Jetskis you ride; in a dinghy you stand, fish, and grab the
// outboard's tiller (E) to motor about. A few are moored by the town dock — and they can be "borrowed".
'use strict';

const BOAT_TYPES = {
  jetski: { name: 'Jetski', top: 10, accel: 9, price: 900, color: 0x2A8AE8 },
  dinghy: { name: 'Fishing dinghy', top: 3.6, accel: 2.4, price: 380, color: 0x9AA3AA },
};

const Boats = {
  list: [], group: null, riding: null, driving: false, vel: { x: 0, y: 0 },

  // Water a boat can float in: deep enough, and not the dock itself.
  floats(x, y) {
    if (!World.isWater(x, y) || World.depthAt(x, y) < 0.3) return false;
    const d = World.dockEnd; if (d && x >= d.x - 1 && x < d.x + 1 && y >= d.y && y < d.y + 8) return false;
    return true;
  },

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    this.list = []; this.riding = null; this.driving = false;
    // Moored either side of the town dock, owned by locals.
    const d = World.dockEnd, owners = Npcs.list.map((n) => n.name), rng = U.mulberry32(World.seed + 515);
    if (d) {
      const spots = [[-1.9, 2], [1.9, 2.6], [-1.9, 4.8], [1.9, 5.4], [-2.2, 7]];
      spots.forEach(([dx, dy], i) => {
        const x = d.x + dx, y = d.y + dy;
        if (!this.floats(x, y)) return;
        this.add({ type: i % 2 ? 'dinghy' : 'jetski', x, y, ang: -Math.PI / 2, owner: owners[(rng() * owners.length) | 0] || 'the marina' });
      });
    }
    if (Game.boat && this.floats(Game.boat.x, Game.boat.y)) this.add({ ...Game.boat, mine: true });
    else Game.boat = null;
  },

  add(b) {
    b.mesh = b.type === 'jetski' ? this.jetski(BOAT_TYPES.jetski.color) : this.dinghy();
    this.group.add(b.mesh); this.list.push(b);
    return b;
  },

  jetski(color) {
    const g = new THREE.Group(), P = (geo, c, o = 0.05) => Models.part(geo, c, o);
    const hull = P(new THREE.BoxGeometry(1.5, 0.28, 0.62), color); hull.position.y = 0.06; g.add(hull);
    const nose = P(new THREE.ConeGeometry(0.31, 0.5, 4), color); nose.rotation.z = -Math.PI / 2; nose.rotation.x = Math.PI / 4; nose.scale.set(1, 1, 0.7); nose.position.set(0.95, 0.06, 0); g.add(nose);
    const deck = P(new THREE.BoxGeometry(1.2, 0.06, 0.56), '#F4F0E6', 0.03); deck.position.y = 0.22; g.add(deck);
    const seat = P(new THREE.BoxGeometry(0.7, 0.16, 0.32), '#1A1A1C'); seat.position.set(-0.15, 0.32, 0); g.add(seat);
    const col = P(new THREE.BoxGeometry(0.12, 0.34, 0.12), color); col.position.set(0.38, 0.4, 0); col.rotation.z = -0.4; g.add(col);
    const bars = P(new THREE.CylinderGeometry(0.025, 0.025, 0.56, 6), '#1A1A1C'); bars.rotation.x = Math.PI / 2; bars.position.set(0.32, 0.6, 0); g.add(bars);
    return g;
  },

  dinghy() {
    const g = new THREE.Group(), P = (geo, c, o = 0.05) => Models.part(geo, c, o), tin = '#9AA3AA';
    const floor = P(new THREE.BoxGeometry(2.0, 0.08, 0.9), '#7A8288'); floor.position.y = 0.02; g.add(floor);
    for (const z of [-0.45, 0.45]) { const side = P(new THREE.BoxGeometry(2.0, 0.34, 0.06), tin); side.position.set(0, 0.17, z); g.add(side); }
    const bow = P(new THREE.BoxGeometry(0.06, 0.34, 0.9), tin); bow.position.set(1.0, 0.17, 0); bow.rotation.z = -0.5; g.add(bow);
    const stern = P(new THREE.BoxGeometry(0.06, 0.34, 0.9), tin); stern.position.set(-1.0, 0.17, 0); g.add(stern);
    for (const x of [-0.3, 0.45]) { const seat = P(new THREE.BoxGeometry(0.22, 0.05, 0.86), '#8A5A30'); seat.position.set(x, 0.26, 0); g.add(seat); }
    // The outboard: cowling, leg and a tiller arm.
    const cowl = P(new THREE.BoxGeometry(0.3, 0.28, 0.24), '#2A2A2E'); cowl.position.set(-1.18, 0.42, 0); g.add(cowl);
    const leg = P(new THREE.BoxGeometry(0.08, 0.5, 0.08), '#3A3A3E'); leg.position.set(-1.2, 0.1, 0); g.add(leg);
    const tiller = P(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), '#1A1A1C'); tiller.rotation.z = Math.PI / 2 - 0.25; tiller.position.set(-0.92, 0.52, 0); g.add(tiller);
    return g;
  },

  // ---------- getting on and off ----------
  near(r = 2.2) {
    let best = null, bd = r;
    for (const b of this.list) { const d = U.dist(b.x, b.y, Player.x, Player.y); if (d < bd) { bd = d; best = b; } }
    return best;
  },

  board(b) {
    if (Bikes.riding || Fishing.state !== 'idle') return;
    this.riding = b; this.driving = b.type === 'jetski'; this.vel = { x: 0, y: 0 };
    Player.place(b.x, b.y); Player.crouch = false; Player.face = b.ang;
    if (b.type === 'jetski') { this.prevTool = Tools.current; Tools.current = 'hands'; Gun.out = false; }
    Sfx.splash(0.4);
    Hud.toast(b.type === 'jetski' ? 'WASD to ride · Space to jump the wake · E to get off at the shore' : 'You\'re standing in the dinghy. Fish from here, or press E at the motor to drive it.', UI.ink, 3);
  },

  // Step off onto the nearest dry ground or dock planks.
  disembark() {
    const b = this.riding; if (!b) return;
    for (let r = 0.8; r < 4; r += 0.3) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
      if (World.tileAt(Math.floor(x), Math.floor(y)) === T.PLANK || footOK(x, y, true)) {
        this.riding = null; this.driving = false; Player.place(x, y); Player.wading = World.isWater(x, y);
        if (this.prevTool) { Tools.current = this.prevTool; this.prevTool = null; }
        if (b.mine) Game.boat = { type: b.type, x: b.x, y: b.y, ang: b.ang, owner: b.owner };
        Game.save(); return;
      }
    }
    Hud.toast('Too far from shore to hop off — get closer to land or the dock.', UI.muted, 1.8);
  },

  canDisembark() {
    const b = this.riding; if (!b) return false;
    for (let r = 0.8; r < 4; r += 0.6) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r; if (World.tileAt(Math.floor(x), Math.floor(y)) === T.PLANK || footOK(x, y, true)) return true; }
    return false;
  },

  // ---------- borrowing someone else's ----------
  steal(b, quiet) {
    b.mine = true; b.stolen = true;
    Thief.record('boat', b.owner);
    if (!quiet) { Wanted.crime(1); (Wanted.rap = Wanted.rap || { ko: 0, cops: 0, booms: 0, thefts: 0 }).thefts++; }
    const own = Npcs.list.find((n) => n.name === b.owner);
    if (own && !quiet && U.dist(own.x, own.y, Player.x, Player.y) < 30) Npcs.say(own, 'OI! THAT\'S MY ' + BOAT_TYPES[b.type].name.toUpperCase() + '!', 3);
    Hud.toast((quiet ? 'Nobody saw. ' : 'Spotted! ') + 'You\'ve taken ' + b.owner + '\'s ' + BOAT_TYPES[b.type].name.toLowerCase() + '.', quiet ? UI.accent : UI.bad, 2.6);
    this.board(b);
  },

  untieDinghy(b) {
    const eyes = Npcs.list.filter((n) => !n.away && !['home', 'bush', 'ko', 'dead'].includes(n.state) && U.dist(n.x, n.y, Player.x, Player.y) < 14).length
      + Wardens.list.filter((w) => w.state !== 'ko' && w.state !== 'dead' && U.dist(w.x, w.y, Player.x, Player.y) < 18).length;
    this.steal(b, eyes === 0);
  },

  // ---------- E key ----------
  interactions(add, cands) {
    if (this.riding) {
      const b = this.riding;
      if (b.type === 'dinghy') cands.push({ d: 0, x: b.x, y: b.y, label: this.driving ? 'Let go of the motor' : 'Take the motor', run: () => { this.driving = !this.driving; if (this.driving) { Fishing.reelInFast(); Sfx.tone(70, 0.5, 0.25, 'sawtooth', 110); } this.vel = { x: 0, y: 0 }; } });
      if (this.canDisembark() && !(b.type === 'dinghy' && this.driving)) cands.push({ d: 0.5, x: b.x, y: b.y, label: 'Get out of the ' + BOAT_TYPES[b.type].name.toLowerCase(), run: () => this.disembark() });
      return true;
    }
    if (Interior.active || Bikes.riding) return false;
    const b = this.near(); if (!b) return false;
    if (b.mine) add(b.x, b.y, 2.2, (b.type === 'jetski' ? 'Ride your ' : 'Climb into your ') + BOAT_TYPES[b.type].name.toLowerCase(), () => this.board(b));
    else if (b.type === 'jetski') add(b.x, b.y, 2.2, 'Hot-wire ' + b.owner + '\'s jetski', () => LockPick.openBoat(b));
    else add(b.x, b.y, 2.2, 'Untie ' + b.owner + '\'s dinghy (theft!)', () => this.untieDinghy(b));
    return false;
  },

  // ---------- on the water ----------
  // Called from Player.update while aboard. Returns true (Player.update stops there).
  ride(dt, ix, iy) {
    const b = this.riding, T2 = BOAT_TYPES[b.type];
    Player.moving = false; Player.running = false; Player.wading = false;
    if (this.driving) {
      const len = Math.hypot(ix, iy) || 1, top = T2.top;
      const tx = ix ? ix / len * top : 0, ty = iy ? iy / len * top : 0;
      const k = Math.min(1, dt * (ix || iy ? T2.accel / top : 0.8));
      this.vel.x = U.lerp(this.vel.x, tx, k); this.vel.y = U.lerp(this.vel.y, ty, k);
      const sp = Math.hypot(this.vel.x, this.vel.y);
      const nx = b.x + this.vel.x * dt, ny = b.y + this.vel.y * dt;
      if (this.floats(nx, b.y)) b.x = nx; else { this.vel.x *= -0.3; if (sp > 5) { Sfx.thunk(); Bugs.shake = 0.6; } }
      if (this.floats(b.x, ny)) b.y = ny; else { this.vel.y *= -0.3; if (sp > 5) { Sfx.thunk(); Bugs.shake = 0.6; } }
      if (sp > 0.3) b.ang = Math.atan2(this.vel.y, this.vel.x);
      if (sp > 2 && Math.random() < dt * (b.type === 'jetski' ? 14 : 5)) Hud.ripple(b.x - Math.cos(b.ang) * 0.8, b.y - Math.sin(b.ang) * 0.8, 0.5 + sp * 0.06);
      if (sp > 1) Fish.spookNear(b.x, b.y, 4 + sp);
      // Jetski: hop the wake.
      if (b.type === 'jetski' && Input.pressed('Space') && !Player.airborne) { Player.jumpT = JUMP_TIME; Sfx.whoosh(0.3); Sfx.splash(0.5); }
      Player.face = b.ang;
    } else {
      // Motor off: drift with the current and the wind.
      const [fx, fy] = World.flowAt(b.x, b.y);
      const nx = b.x + (fx * 0.4 + Game.env.wind.x * 0.03) * dt, ny = b.y + (fy * 0.4 + Game.env.wind.y * 0.03) * dt;
      if (this.floats(nx, ny)) { b.x = nx; b.y = ny; }
    }
    if (Player.jumpT > 0) {
      Player.jumpT = Math.max(0, Player.jumpT - dt);
      Player.z = Math.sin((1 - Player.jumpT / JUMP_TIME) * Math.PI) * 0.5;
      if (!Player.jumpT) { Player.z = 0; Sfx.splash(0.6); }
    }
    Player.x = b.x; Player.y = b.y;
    if (b.mine) Game.boat = { type: b.type, x: b.x, y: b.y, ang: b.ang, owner: b.owner };
    return true;
  },

  // How high your feet are while aboard.
  deckY() { const b = this.riding; return b ? (b.type === 'jetski' ? 0.28 : 0.08) + Math.sin(Game.time * 1.6) * 0.03 : 0; },

  render(dt) {
    let loud = 0, rpm = 60;
    for (const b of this.list) {
      const vis = !Interior.active && U.dist(b.x, b.y, Player.x, Player.y) < 70;
      b.mesh.visible = vis; if (!vis) continue;
      const bob = Math.sin(Game.time * 1.6 + b.x) * 0.03, moving = this.riding === b && this.driving ? Math.hypot(this.vel.x, this.vel.y) : 0;
      b.mesh.position.set(b.x, -0.08 + bob + (this === b ? 0 : 0) + (this.riding === b ? Player.z * 0.6 : 0), b.y);
      b.mesh.rotation.set(0, -b.ang, -moving * 0.012);
      if (this.riding === b && this.driving) { loud = Math.max(loud, 0.45 + moving / 25); rpm = 60 + moving * 10; }
    }
    if (loud) Sfx.setEngine(loud, rpm);
  },

  // Rider pose: seated with hands on the bars (jetski) or standing with a hand on the tiller (dinghy).
  posePlayer(rig) {
    const b = this.riding; if (!b) return;
    const c = Math.cos(b.ang), s = Math.sin(b.ang), h = this.deckY();
    if (b.type === 'jetski') {
      Models.pose(rig, { pose: 'ride', t: Game.time });
      const v = this._v || (this._v = new THREE.Vector3());
      for (const side of [-1, 1]) Models.reach(rig, side < 0 ? rig.armL : rig.armR, v.set(b.x + 0.32 * c - 0.26 * side * s, h + 0.62, b.y + 0.32 * s + 0.26 * side * c));
    } else if (this.driving) {
      const v = this._v || (this._v = new THREE.Vector3());
      Models.reach(rig, rig.armR, v.set(b.x - 0.7 * c, h + 0.55, b.y - 0.7 * s));
    }
  },
};
