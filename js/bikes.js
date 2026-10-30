// Dirt bikes: the dealership, your own bike, and the local riders tearing up the trails.
'use strict';

const BIKES = [
  { id: 'trail', name: 'Trail 125', price: 300, top: 11, accel: 9, color: 0xD23A3A, desc: 'Light and forgiving. Perfect first bike.' },
  { id: 'enduro', name: 'Enduro 250', price: 650, top: 14, accel: 12, color: 0x3A8AD2, desc: 'Torquey all-rounder for the backcountry.' },
  { id: 'moto', name: 'Moto 450', price: 1200, top: 17, accel: 15, color: 0xF2C14E, desc: 'Absolutely unnecessary. Absolutely brilliant.' },
  { id: 'kart', name: 'Go-Kart 90', kind: 'kart', price: 420, top: 10, accel: 11, color: 0x3AB06A, desc: 'Low, loud and stupidly fun. Hates deep puddles.' },
  { id: 'racer', name: 'Racer Kart', kind: 'kart', price: 950, top: 13.5, accel: 14, color: 0xE2584D, desc: 'Sticks to the trails like it owes them money.' },
];
// Where the rider sits and where their hands go, in the vehicle's frame (+x forward).
const SEATING = {
  bike: { seatX: -0.18, seatY: 0.52, grip: { x: 0.34, y: 1.02, z: 0.27 }, wade: 0.45, jump: 1.3, pose: 'ride' },
  kart: { seatX: -0.22, seatY: 0.06, grip: { x: 0.2, y: 0.56, z: 0.13 }, wade: 0.22, jump: 0.6, pose: 'kart' },
};
const RIDER_NAMES = ['Dazza', 'Shazza', 'Kev', 'Bazza'];
const newPlate = () => String.fromCharCode(65 + ((Math.random() * 26) | 0), 65 + ((Math.random() * 26) | 0)) + '-' + (1000 + ((Math.random() * 9000) | 0));
const BIKE_BY_ID = Object.fromEntries(BIKES.map((b) => [b.id, b]));
const seatOf = (id) => SEATING[(BIKE_BY_ID[id] || BIKES[0]).kind || 'bike'];
const BIKER_PALS = [
  { hat: '#E2584D', hatStyle: 'helmet', visor: '#222', shirt: '#2A2A2E', vest: '#E2584D', pants: '#3A3A4A', skin: '#E2B08A', mitt: '#2A2A2E' },
  { hat: '#3A8AD2', hatStyle: 'helmet', visor: '#222', shirt: '#F4F0E6', vest: '#3A8AD2', pants: '#2A2A3A', skin: '#C08A60', mitt: '#2A2A2E' },
  { hat: '#7DC383', hatStyle: 'helmet', visor: '#222', shirt: '#2A3A2A', vest: '#7DC383', pants: '#3A3A3A', skin: '#F0C8A0', mitt: '#2A2A2E' },
  { hat: '#F2C14E', hatStyle: 'helmet', visor: '#222', shirt: '#E2584D', vest: '#F2C14E', pants: '#2A2A3A', skin: '#D9A07A', mitt: '#2A2A2E' },
];
const REVS_PAL = { hat: '#2A2A2E', hatStyle: 'cap', shirt: '#2A2A2E', vest: '#6A4A2A', pants: '#2A3A5A', skin: '#D9A07A', beard: '#3A2A1A', hair: '#3A2A1A' };
const BIKER_SAY = ['BRAAAP!', 'Wheelie time!', 'Outta the way!', 'Yeeehaw!'];

const Bikes = {
  group: null, riders: [], mine: null, riding: false, vel: { x: 0, y: 0 }, warnedFuel: false, crashT: 0,

  // The right model for a vehicle id.
  modelFor(id) { const v = BIKE_BY_ID[id]; return v.kind === 'kart' ? this.kart(v.color) : this.model(v.color); },

  // A go-kart pointing along +x: tube frame, fat tyres, bucket seat, wheel on a column.
  kart(color) {
    const g = new THREE.Group();
    const black = new THREE.MeshLambertMaterial({ color: 0x1A1A1C }), paint = new THREE.MeshLambertMaterial({ color }), steel = new THREE.MeshLambertMaterial({ color: 0x8A9096 });
    for (const [x, z, r] of [[0.48, 0.42, 0.15], [0.48, -0.42, 0.15], [-0.45, 0.45, 0.18], [-0.45, -0.45, 0.18]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 14), black); t.rotation.x = Math.PI / 2; t.position.set(x, r, z); g.add(t);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.19, 8), steel); h.rotation.x = Math.PI / 2; h.position.set(x, r, z); g.add(h);
    }
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.62), steel); tray.position.y = 0.14; g.add(tray);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.66), paint); nose.position.set(0.62, 0.18, 0); nose.rotation.z = -0.2; g.add(nose);
    for (const z of [-0.36, 0.36]) { const pod = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.12), paint); pod.position.set(0, 0.2, z); g.add(pod); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.36), black); seat.position.set(-0.22, 0.2, 0); g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.36), black); back.position.set(-0.4, 0.36, 0); back.rotation.z = 0.25; g.add(back);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), steel); col.position.set(0.3, 0.36, 0); col.rotation.z = 0.75; g.add(col);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 16), black); wheel.position.set(0.2, 0.54, 0); wheel.rotation.set(0, Math.PI / 2, 0); wheel.rotateX(-0.6); g.add(wheel);
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.2), steel); engine.position.set(-0.55, 0.26, -0.18); g.add(engine);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.22), new THREE.MeshLambertMaterial({ color: 0xF4F0E6 })); plate.position.set(-0.62, 0.3, 0.12); g.add(plate);
    Toon.apply(g);
    return g;
  },

  // World point of a rider's left (-1) or right (+1) hand on the bars/wheel.
  gripWorld(id, x, y, ang, h, side, out = new THREE.Vector3()) {
    const G = seatOf(id).grip, c = Math.cos(ang), s = Math.sin(ang), lz = G.z * side;
    return out.set(x + G.x * c - lz * s, h + G.y, y + G.x * s + lz * c);
  },
  // Both hands onto the controls.
  holdBars(rig, id, x, y, ang, h) {
    const v = this._gv || (this._gv = new THREE.Vector3());
    Models.reach(rig, rig.armL, this.gripWorld(id, x, y, ang, h, -1, v));
    Models.reach(rig, rig.armR, this.gripWorld(id, x, y, ang, h, 1, v));
  },

  // Every vehicle has a plate registered to whoever bought it. Riding needs a permit for that plate.
  ownsIt() { return !!Game.bike && Game.bike.owner === 'you'; },
  permitted() { return !!Game.bike && (Game.vpermits || []).includes(Game.bike.plate); },

  // A dirt bike model pointing along +x.
  model(color) {
    const g = new THREE.Group();
    const black = new THREE.MeshLambertMaterial({ color: 0x1A1A1C });
    const paint = new THREE.MeshLambertMaterial({ color });
    const steel = new THREE.MeshLambertMaterial({ color: 0x8A9096 });
    for (const x of [-0.55, 0.55]) {
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 18), black); tyre.position.set(x, 0.32, 0); g.add(tyre);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8), steel); hub.rotation.x = Math.PI / 2; hub.position.set(x, 0.32, 0); g.add(hub);
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.16), paint); fender.position.set(x + (x > 0 ? 0.05 : -0.05), 0.66, 0); g.add(fender);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), steel); frame.position.set(-0.05, 0.52, 0); frame.rotation.z = 0.12; g.add(frame);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.28), paint); tank.position.set(0.12, 0.74, 0); g.add(tank);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.24), black); seat.position.set(-0.28, 0.8, 0); g.add(seat);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), steel); fork.position.set(0.5, 0.64, 0); fork.rotation.z = 0.32; g.add(fork);
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), black); bars.rotation.x = Math.PI / 2; bars.position.set(0.36, 1.0, 0); g.add(bars);
    for (const z of [-0.27, 0.27]) { const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6), black); gr.rotation.x = Math.PI / 2; gr.position.set(0.36, 1.0, z); g.add(gr); }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0xF4F0E6 })); plate.position.set(0.58, 0.86, 0); g.add(plate);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8), steel); pipe.rotation.z = Math.PI / 2 - 0.25; pipe.position.set(-0.35, 0.5, 0.14); g.add(pipe);
    Toon.apply(g);
    return g;
  },

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.riding = false; this.vel = { x: 0, y: 0 };
    // Local riders start on the trails.
    const paths = [];
    for (let i = 0; i < World.W * World.H; i += 7) if (World.tile[i] === T.PATH) paths.push(i);
    this.paths = paths;
    this.riders = BIKER_PALS.map((pal, k) => {
      const i = paths.length ? paths[(Math.random() * paths.length) | 0] : World.idx(World.town.x, World.town.y + 10);
      const r = { state: 'ride', fuel: 40 + Math.random() * 60, px: 0, py: 0, walkT: 0, x: i % World.W + 0.5, y: ((i / World.W) | 0) + 0.5, ang: Math.random() * 6.28, speed: 8 + Math.random() * 3, target: null, wheelie: 0, bubbleT: 0, bubble: null, pal };
      r.bikeId = ['trail', 'enduro', 'moto', 'kart'][k % 4];
      r.name = RIDER_NAMES[k % RIDER_NAMES.length]; r.plate = newPlate(); r.owner = r.name;
      r.bike = this.modelFor(r.bikeId);
      r.mesh = Models.person(pal);
      this.group.add(r.bike, r.mesh);
      return r;
    });
    // Older saves: give your vehicle a plate and its permit.
    if (Game.bike && !Game.bike.plate) { Game.bike.plate = newPlate(); Game.bike.owner = 'you'; (Game.vpermits = Game.vpermits || []).push(Game.bike.plate); }
    this.syncMine();
    this.lawT = 0;
  },

  // (Re)build the mesh for the bike you own.
  syncMine() {
    if (this.mine) this.group.remove(this.mine);
    this.mine = Game.bike ? this.modelFor(Game.bike.id) : null;
    if (this.mine) this.group.add(this.mine);
  },

  nearPump(x, y, r = 2.4) { return (World.pumps || []).find((p) => U.dist(p.x, p.y, x, y) < r); },

  fillUp() {
    const need = 100 - Game.fuel, cost = Math.ceil(need * 0.2);
    if (need < 1) { Hud.toast('Tank\'s already full.', UI.muted, 1.2); return; }
    const afford = Math.min(cost, Game.money);
    if (afford <= 0) { Hud.toast('No money for fuel.', UI.bad, 1.4); return; }
    Game.money -= afford; Game.fuel = Math.min(100, Game.fuel + afford / 0.2);
    Sfx.burst(1.2, 900, 0.15, 'lowpass'); Sfx.coin();
    // The pump camera reads the plate. A vehicle that isn't registered to you gets reported.
    if (!this.ownsIt()) {
      Wanted.crime(2);
      Hud.toast('BEEP. Plate ' + Game.bike.plate + ' is registered to ' + Game.bike.owner + ' — reported STOLEN. Police are on the way!', UI.bad, 3.4);
      Game.save(); return;
    }
    Hud.toast('Filled up — ' + U.fmtMoney(afford) + (afford < cost ? ' (all you had)' : ''), UI.good, 1.8);
    Game.save();
  },

  // Where a rider is: on the bike, or on foot beside it while parked.
  onFoot(r) { return ['refuel', 'break', 'stranded'].includes(r.state); },
  riderPos(r) { return this.onFoot(r) ? { x: r.px, y: r.py } : { x: r.x, y: r.y }; },

  // Nick a parked bike. The owner takes yours (if you had one) or chases you on foot.
  steal(r, quiet = false) {
    const old = Game.bike ? { ...Game.bike } : null;
    Game.bike = { id: r.bikeId, x: r.x, y: r.y, ang: r.ang, plate: r.plate, owner: r.owner };
    Thief.record('bike', r.name);
    Game.fuel = Math.max(10, Math.min(100, r.fuel));
    this.syncMine();
    this.group.remove(r.bike);
    r.state = 'stranded'; r.stateT = old ? 60 : 45; r.chaseT = quiet ? 0 : 25; r.foot = null; r.armed = Math.random() < 0.55; r.hitCD = 1.5;
    if (old) { r.bikeId = old.id; r.plate = old.plate; r.owner = old.owner; r.bike = this.modelFor(old.id); this.group.add(r.bike); r.x = old.x; r.y = old.y; r.ang = old.ang || 0; r.noBike = false; }
    else { r.noBike = true; }
    if (quiet) { r.bubble = 'Hang on… where\'s my bike?!'; r.bubbleT = 3; }
    else { r.bubble = old ? 'OI! THAT\'S MY BIKE! …Fine, I\'ll take YOURS!' : 'OI! THAT\'S MY BIKE!'; r.bubbleT = 3; Wanted.crime(1); (Wanted.rap = Wanted.rap || { ko: 0, cops: 0, booms: 0, thefts: 0 }).thefts++; }
    Hud.toast((quiet ? 'Clean getaway! ' : 'They saw you! ') + 'You stole ' + r.name + '\'s ' + BIKE_BY_ID[Game.bike.id].name + ' (plate ' + r.plate + '). No permit for it — avoid the law, and don\'t fill it up!', quiet ? UI.accent : UI.bad, 3.2);
    this.mount();
    Game.save();
  },


  blocked(x, y, id) { return World.blocked(x, y) || World.depthAt(x, y) > (id ? seatOf(id).wade : 0.45); },

  // ---------- the law on wheels ----------
  playerOffence(reason) {
    const w = Wardens.list.find((x) => x.state === 'patrol' && U.dist(x.x, x.y, Player.x, Player.y) < 25);
    if (w) Wardens.startChase(w, reason);
  },

  // A rider behaving like an idiot within sight of a warden gets pulled over, arrested and impounded.
  offence(r, what) {
    r.strikes = (r.strikes || 0) + 1; r.lastOffence = what;
    if (r.pulledBy) return;
    const w = Wardens.list.filter((x) => x.state === 'patrol' && U.dist(x.x, x.y, r.x, r.y) < 35).sort((a, b) => U.dist(a.x, a.y, r.x, r.y) - U.dist(b.x, b.y, r.x, r.y))[0];
    if (!w) return;
    w.state = 'pullover'; w.t = 0; w.rider = r; r.pulledBy = w;
    Wardens.say(w, ['PULL OVER, ' + (r.name || 'MATE').toUpperCase() + '!', 'Oi! Stop right there!'], 2.6);
    if (U.dist(r.x, r.y, Player.x, Player.y) < 30) { Sfx.tone(1400, 0.15, 0.2, 'square'); setTimeout(() => Sfx.tone(1100, 0.15, 0.2, 'square'), 180); }
  },

  // Called by the warden when they reach the rider.
  arrestRider(r, w) {
    r.pulledBy = null; r.jailed = true; r.jailedDay = Game.env.day; r.strikes = 0;
    this.group.remove(r.bike); r.noBike = true; r.mesh.visible = false;
    Wardens.say(w, ['Licence and registration… you\'re nicked.', 'That ' + BIKE_BY_ID[r.bikeId].name + '\'s going in the impound.'], 3);
    if (U.dist(r.x, r.y, Player.x, Player.y) < 40) Hud.toast(w.name + ' arrested ' + (r.name || 'a rider') + ' for dangerous driving (' + (r.lastOffence || 'reckless riding') + '). The ' + BIKE_BY_ID[r.bikeId].name + ' has been impounded.', UI.accent, 3.4);
  },

  // ---------- your bike ----------
  near() { return Game.bike && !this.riding && !Interior.active && U.dist(Player.x, Player.y, Game.bike.x, Game.bike.y) < 2; },

  mount() {
    if (Fishing.state !== 'idle') return;
    this.riding = true; this.vel = { x: 0, y: 0 };
    this.prevTool = Tools.current; Tools.current = 'hands'; Gun.out = false;
    Player.place(Game.bike.x, Game.bike.y); Player.crouch = false;
    Sfx.tone(90, 0.4, 0.3, 'sawtooth', 140);
    Hud.toast(this.permitted() ? 'Vroom. WASD to ride, Space to jump, E to get off.' : 'No permit for plate ' + Game.bike.plate + '! Keep away from wardens and police.', this.permitted() ? UI.ink : UI.bad, 2.4);
  },

  dismount() {
    this.riding = false;
    Game.bike.x = Player.x; Game.bike.y = Player.y; Game.bike.ang = Math.atan2(this.vel.y, this.vel.x) || Game.bike.ang || 0;
    // Step off beside the bike.
    const a = (Game.bike.ang || 0) + Math.PI / 2;
    for (const s of [1, -1]) { const x = Player.x + Math.cos(a) * 0.9 * s, y = Player.y + Math.sin(a) * 0.9 * s; if (!World.blocked(x, y)) { Player.place(x, y); break; } }
    Tools.current = this.prevTool || 'rod';
    this.vel = { x: 0, y: 0 };
    Game.save();
  },

  // Called from Player.update while riding.
  ride(dt, ix, iy) {
    const b = BIKE_BY_ID[Game.bike.id];
    const fuel = Game.fuel > 0;
    if (!fuel && !this.warnedFuel) { this.warnedFuel = true; Hud.toast('Out of fuel! Push it to the gas station at the bottom of the main street.', UI.bad, 3); }
    if (fuel) this.warnedFuel = false;
    const len = Math.hypot(ix, iy) || 1;
    const top = b.top * (fuel ? 1 : 0.2) * (World.isWater(Player.x, Player.y) ? 0.45 : 1);
    const tx = ix ? ix / len * top : 0, ty = iy ? iy / len * top : 0;
    const k = Math.min(1, dt * (ix || iy ? b.accel / top : 3));
    this.vel.x = U.lerp(this.vel.x, tx, k); this.vel.y = U.lerp(this.vel.y, ty, k);
    const speed = Math.hypot(this.vel.x, this.vel.y);
    Game.fuel = Math.max(0, Game.fuel - speed * dt * 0.02);
    const nx = Player.x + this.vel.x * dt, ny = Player.y + this.vel.y * dt;
    if (!this.blocked(nx, Player.y, b.id)) Player.x = nx; else this.crash(speed);
    if (!this.blocked(Player.x, ny, b.id)) Player.y = ny; else this.crash(speed);
    if (speed > 0.3) Player.face = Math.atan2(this.vel.y, this.vel.x);
    Player.moving = speed > 0.3; Player.running = false; Player.walkT += dt * 0.2;
    Player.wading = World.isWater(Player.x, Player.y) && !Player.airborne;
    if (Player.wading && speed > 1 && Math.random() < dt * 6) Hud.ripple(Player.x, Player.y, 0.7);
    // Jumps go further on a bike.
    const J = seatOf(b.id).jump;
    if (Input.pressed('Space') && !Player.airborne) { Player.jumpT = JUMP_TIME * J; Sfx.whoosh(0.3); }
    if (Player.jumpT > 0) {
      Player.jumpT = Math.max(0, Player.jumpT - dt);
      Player.z = Math.sin((1 - Player.jumpT / (JUMP_TIME * J)) * Math.PI) * J * 0.77;
      if (Player.jumpT === 0) { Player.z = 0; Sfx.thunk(); }
    }
    Game.bike.x = Player.x; Game.bike.y = Player.y;
    this.crashT = Math.max(0, this.crashT - dt);
    // Riding into people.
    if (speed > 4) for (const n of Npcs.list) {
      if (n.away || ['home', 'bush', 'ko', 'dead'].includes(n.state) || U.dist(n.x, n.y, Player.x, Player.y) > 0.8 || (n.hitByBike && Game.time < n.hitByBike)) continue;
      n.hitByBike = Game.time + 6;
      const a = Math.atan2(n.y - Player.y, n.x - Player.x); if (footOK(n.x + Math.cos(a) * 1.2, n.y + Math.sin(a) * 1.2)) { n.x += Math.cos(a) * 1.2; n.y += Math.sin(a) * 1.2; }
      Npcs.say(n, U.pick(Math.random, ['OI! WATCH IT!', 'Are you MAD?!', 'Learn to RIDE!']), 2.4); Sfx.thunk(); Rep.add(-2);
      this.playerOffence('Dangerous driving (ran down ' + n.name + ')');
    }
    // Wardens and police check plates: riding without a permit is an offence.
    this.lawT = Math.max(0, (this.lawT || 0) - dt);
    if (!this.permitted() && this.lawT <= 0) {
      const eyes = [...Wardens.list, ...Wanted.units.filter((u) => !u.ko)];
      const cop = eyes.find((w) => U.dist(w.x, w.y, Player.x, Player.y) < 11);
      if (cop) {
        this.lawT = 25; Wanted.crime(1);
        Hud.toast('"Oi! Plate ' + Game.bike.plate + ' — that\'s not your ' + b.name + '!" Unlicensed rider spotted!', UI.bad, 2.8);
      }
    }
  },

  crash(speed) {
    if (speed > 6 && World.buildingAt(Player.x + this.vel.x * 0.1, Player.y + this.vel.y * 0.1)) this.playerOffence('Dangerous driving (crashed into a building)');
    if (speed > 6 && this.crashT <= 0) { this.crashT = 1; Sfx.thunk(); Bugs.shake = 1; Hud.toast('Thud!', UI.bad, 0.8); }
    this.vel.x *= -0.3; this.vel.y *= -0.3;
  },

  // ---------- local riders ----------
  update(dt) {
    const cap = Decay.riderCap();
    for (const r of this.riders) {
      // In a run-down town some riders just stop coming round.
      r.away = this.riders.indexOf(r) >= cap && !this.onFoot(r) && U.dist(r.x, r.y, Player.x, Player.y) > 30;
      if (r.away || r.jailed) continue;
      if (r.ko > 0) { r.ko -= dt; continue; } // knocked off their bike
      if (r.pulledBy) { // pulled over: sit tight and wait for the warden
        if (!Wardens.list.includes(r.pulledBy) || r.pulledBy.state !== 'pullover') { r.pulledBy = null; r.state = 'ride'; }
        continue;
      }
      r.bubbleT = Math.max(0, r.bubbleT - dt);
      if (this.parkedTick(r, dt)) continue;
      // Fuel: head for the pumps when low.
      r.fuel -= r.speed * dt * 0.02;
      const pump = (World.pumps || [])[0];
      if (r.state === 'ride' && r.fuel < 20 && pump) { r.state = 'toGas'; r.gasT = 0; }
      if (r.state === 'toGas') {
        r.gasT += dt;
        r.target = { x: pump.x + 1.3, y: pump.y + 0.6 };
        if (U.dist(r.x, r.y, r.target.x, r.target.y) < 2 || r.gasT > 60) { this.park(r, 'refuel', 10, ['Running on fumes!', 'Fill \'er up!']); continue; }
      }
      if (r.state !== 'toGas' && (!r.target || U.dist(r.x, r.y, r.target.x, r.target.y) < 2.5)) {
        // Arrived: usually stop for a bit, then pick the next place to go.
        if (r.target && r.target.stop && Math.random() < 0.6) {
          this.park(r, 'break', 10 + Math.random() * 15, ['Made it to ' + r.target.name + '!', 'Smoko!', 'Nice spot, this.']);
          r.target = null; continue;
        }
        r.target = this.pickTarget(r);
      }
      // Steer toward the destination, swinging round anything in the way.
      const want = Math.atan2(r.target.y - r.y, r.target.x - r.x);
      // Pick a heading: clear of anything solid, preferring tracks and open ground over trees.
      let head = null, best = 1e9;
      for (const off of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.25, -1.25, 1.7, -1.7, 2.3, -2.3]) {
        const a = want + off, c = Math.cos(a), s = Math.sin(a);
        if (this.blocked(r.x + c * 1.2, r.y + s * 1.2, r.bikeId) || this.blocked(r.x + c * 2.6, r.y + s * 2.6, r.bikeId)) continue;
        let cost = Math.abs(off) * 1.2;
        for (const d of [2, 4, 6, 8]) {
          const x = r.x + c * d, y = r.y + s * d, t = World.tileAt(Math.floor(x), Math.floor(y));
          if (this.blocked(x, y, r.bikeId)) cost += 3 / d * 2;
          if (t === T.PATH || t === T.PLANK) cost -= 0.35;
          else if (t === T.FOREST) cost += 0.7;
          else if (t === T.WATER) cost += 0.5;
          const o = World.objAt(x, y); if (o === O.PINE || o === O.OAK || o === O.BUSH || o === O.BOULDER) cost += 0.6;
        }
        if (cost < best) { best = cost; head = a; }
      }
      if (head === null) head = r.ang + Math.PI * 0.6;
      r.ang += U.clamp(U.angDiff(r.ang, head), -3 * dt, 3 * dt);
      const sharp = Math.abs(U.angDiff(r.ang, head)) > 0.7;
      const spd = r.speed * (sharp ? 0.45 : 1);
      const nx = r.x + Math.cos(r.ang) * spd * dt, ny = r.y + Math.sin(r.ang) * spd * dt;
      if (this.blocked(nx, ny, r.bikeId)) { r.ang += 0.8; if (World.buildingAt(nx, ny) && spd > 4) this.offence(r, 'crashed into ' + (World.buildingAt(nx, ny).name || 'a building')); } else { r.x = nx; r.y = ny; }
      // Not getting any closer? Give up on that place and go somewhere else.
      r.progT = (r.progT || 0) + dt;
      if (r.progT > 6) { const d = U.dist(r.x, r.y, r.target.x, r.target.y); if (r.lastD !== undefined && d > r.lastD - 4 && r.state !== 'toGas') r.target = this.pickTarget(r); r.lastD = d; r.progT = 0; }
      // Showing off.
      if (r.wheelie > 0) r.wheelie -= dt; else if (Math.random() < dt * 0.08) r.wheelie = 1.5;
      const pd = U.dist(r.x, r.y, Player.x, Player.y);
      if (pd < 25 && Math.random() < dt * 0.05) { r.bubble = U.pick(Math.random, BIKER_SAY); r.bubbleT = 1.8; }
      // Clipping the angler.
      if (pd < 1.1 && !this.riding && !Player.evasive && !Interior.active && !r.hitCool && !this.onFoot(r)) {
        r.hitCool = 3;
        const a = Math.atan2(Player.y - r.y, Player.x - r.x);
        for (let s = 0; s < 8; s++) { const x = Player.x + Math.cos(a) * 0.25, y = Player.y + Math.sin(a) * 0.25; if (World.blocked(x, y)) break; Player.x = x; Player.y = y; }
        if (Fishing.state !== 'idle' && Fishing.state !== 'fight') Fishing.reelInFast();
        Bugs.shake = 1; Sfx.thunk();
        Hud.toast((r.name || 'A biker') + ' clipped you! (Jump or slide to dodge them.)', UI.bad, 2.2);
        this.offence(r, 'ran into you');
      }
      r.hitCool = Math.max(0, (r.hitCool || 0) - dt);
      // Bowling over pedestrians.
      for (const n of Npcs.list) {
        if (n.away || ['home', 'bush', 'ko', 'dead'].includes(n.state) || U.dist(n.x, n.y, r.x, r.y) > 0.8 || (n.hitByBike && Game.time < n.hitByBike)) continue;
        n.hitByBike = Game.time + 6;
        const a = Math.atan2(n.y - r.y, n.x - r.x); if (footOK(n.x + Math.cos(a) * 1.2, n.y + Math.sin(a) * 1.2)) { n.x += Math.cos(a) * 1.2; n.y += Math.sin(a) * 1.2; }
        Npcs.say(n, U.pick(Math.random, ['OI! WATCH IT!', 'You nearly KILLED me!', 'Hooligan!']), 2.4);
        this.offence(r, 'knocked over ' + n.name);
      }
      // Anglers do not appreciate it.
      for (const n of Npcs.list) {
        if (n.state === 'home' || n.state === 'bush' || U.dist(n.x, n.y, r.x, r.y) > 4 || (n.bikeYell && Game.time < n.bikeYell)) continue;
        n.bikeYell = Game.time + 20; Npcs.say(n, U.pick(Math.random, ['SLOW DOWN!', 'You\'re scaring the fish!', 'Bloody bikers…']), 2.4);
      }
    }
  },

  park(r, state, time, lines) {
    r.state = state; r.stateT = time; r.filled = false; r.foot = null; r.wheelie = 0;
    r.px = r.x + Math.cos(r.ang + Math.PI / 2) * 0.9; r.py = r.y + Math.sin(r.ang + Math.PI / 2) * 0.9;
    if (World.blocked(r.px, r.py)) { r.px = r.x - Math.cos(r.ang + Math.PI / 2) * 0.9; r.py = r.y - Math.sin(r.ang + Math.PI / 2) * 0.9; }
    if (U.dist(r.x, r.y, Player.x, Player.y) < 30) { r.bubble = U.pick(Math.random, lines); r.bubbleT = 2.4; }
  },

  // Off the bike: mill about nearby, gas up if that's why we stopped, then ride on.
  parkedTick(r, dt) {
    if (!this.onFoot(r)) return false;
    if (r.state === 'stranded') {
      // Chase the thief for a bit, then make for their old bike (or wait for a lift).
      r.stateT -= dt; r.chaseT -= dt;
      // Chasing: come up beside you (arm's length, on whichever side they're approaching from), never into you.
      let goal = null;
      if (r.chaseT > 0) { const s = Math.atan2(r.py - Player.y, r.px - Player.x); goal = { x: Player.x + Math.cos(s) * 0.95, y: Player.y + Math.sin(s) * 0.95, close: true }; }
      else if (!r.noBike) goal = { x: r.x, y: r.y };
      if (goal) {
        const a = Math.atan2(goal.y - r.py, goal.x - r.px), sp = r.chaseT > 0 ? 3.2 : 2.2;
        const gd = U.dist(r.px, r.py, goal.x, goal.y), step = Math.min(sp * dt, goal.close ? Math.max(0, gd - 0.05) : sp * dt);
        const nx = r.px + Math.cos(a) * step, ny = r.py + Math.sin(a) * step;
        if (footOK(nx, ny)) { r.px = nx; r.py = ny; }
        // Squared up beside you: face you and stop shuffling.
        const holding = goal.close && gd < 0.2;
        r.walkFace = holding ? Math.atan2(Player.y - r.py, Player.x - r.px) : a;
        r.onFootMoving = !holding; if (!holding) { r.walkT += dt; unstick(r, dt, 'px', 'py'); }
        // Get stuck in: fists up close, and some of them are carrying.
        const pd = U.dist(r.px, r.py, Player.x, Player.y);
        r.hitCD = (r.hitCD || 0) - dt;
        if (r.chaseT > 0 && r.hitCD <= 0 && !Interior.active) {
          if (pd < 1.3) { r.hitCD = 1.2; Wanted.hurt(8, r.name + '\'s fists'); r.bubble = U.pick(Math.random, ['TAKE THAT!', 'GIMME MY BIKE!', 'THIEF!']); r.bubbleT = 1.2; }
          else if (r.armed && pd < 13) { r.hitCD = 1.3 + Math.random(); Wanted.fireAt(r.px, r.py, 0.3, 9, r.name + '\'s pistol'); }
        }
        if (r.chaseT > 0 && Math.random() < dt * 0.4 && pd < 30) { r.bubble = U.pick(Math.random, ['COME BACK HERE!', 'THIEF!', 'That\'s MY bike!']); r.bubbleT = 1.6; }
        if (!r.noBike && r.chaseT <= 0 && U.dist(r.px, r.py, r.x, r.y) < 0.8) { r.state = 'ride'; r.target = this.pickTarget(r); }
      } else r.onFootMoving = false;
      if (r.noBike && r.stateT <= 0) {
        // A mate dropped off a new bike.
        r.bikeId = BIKES[(Math.random() * BIKES.length) | 0].id; r.plate = newPlate(); r.owner = r.name;
        r.bike = this.modelFor(r.bikeId); this.group.add(r.bike);
        r.x = r.px; r.y = r.py; r.noBike = false; r.state = 'ride'; r.fuel = 100; r.target = this.pickTarget(r);
      }
      return true;
    }
    r.stateT -= dt;
    if (!r.foot || U.dist(r.px, r.py, r.foot.x, r.foot.y) < 0.3) {
      if (Math.random() < 0.5) r.foot = { x: r.px, y: r.py, wait: true };
      else for (let t = 0; t < 8; t++) { const a = Math.random() * 6.28, d = 0.8 + Math.random() * 2.2, x = r.x + Math.cos(a) * d, y = r.y + Math.sin(a) * d; if (!World.blocked(x, y)) { r.foot = { x, y }; break; } }
      r.footT = 1.5 + Math.random() * 2;
    }
    r.footT -= dt;
    if (r.foot && !r.foot.wait) {
      const a = Math.atan2(r.foot.y - r.py, r.foot.x - r.px);
      r.px += Math.cos(a) * 1.1 * dt; r.py += Math.sin(a) * 1.1 * dt; r.walkFace = a; r.walkT += dt; r.onFootMoving = true;
    } else { r.onFootMoving = false; if (r.footT <= 0) r.foot = null; }
    if (r.state === 'refuel' && r.stateT < 4 && !r.filled) { r.filled = true; r.fuel = 100; if (U.dist(r.x, r.y, Player.x, Player.y) < 30) { r.bubble = 'Ka-ching. Full tank.'; r.bubbleT = 2; } }
    if (r.stateT <= 0) { r.state = 'ride'; r.target = this.pickTarget(r); }
    return true;
  },

  // Places worth riding to: town, bridges, lake shores, cottages, Dusty's camp.
  destinations() {
    if (this.dests && this.dests.seed === World.seed) return this.dests;
    const d = [], add = (x, y, name) => { if (!this.blocked(x, y) && !World.isWater(x, y)) d.push({ x, y, name, stop: true }); };
    add(World.town.x + 0.5, World.town.y + 8, 'town');
    for (const b of World.bridges) { add(b.x0 + 0.5, b.y0 + 0.5, 'the bridge'); add(b.x1 + 0.5, b.y1 + 0.5, 'the bridge'); }
    for (const h of World.houses) { const dr = World.doorOf(h); add(dr.x + 1.5, dr.y + 1.5, 'the cottages'); }
    for (const l of World.lakes) for (let k = 0; k < 3; k++) {
      const a = k / 3 * 6.28 + l.x;
      for (let r = 0; r < 60; r++) { const x = l.x + Math.cos(a) * r, y = l.y + Math.sin(a) * r; if (!World.isWater(x, y)) { add(x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5, l.name || 'the lake'); break; } }
    }
    if (World.dusty) add(World.dusty.x + 2.5, World.dusty.y, 'Dusty\'s camp');
    d.seed = World.seed;
    return (this.dests = d);
  },

  pickTarget(r) {
    const ds = this.destinations().filter((t) => t !== r.dest && U.dist(t.x, t.y, r.x, r.y) > 20 && U.dist(t.x, t.y, r.x, r.y) < 150 && World.tileAt(Math.floor(t.x), Math.floor(t.y)) !== T.FOREST);
    const t = ds.length ? ds[(Math.random() * ds.length) | 0] : { x: World.town.x, y: World.town.y + 10, name: 'town', stop: true };
    r.dest = t; r.lastD = undefined; r.progT = 0;
    return t;
  },

  // ---------- shooting vehicles ----------
  vehicles() {
    const out = [];
    for (const r of this.riders) if (!r.noBike && !r.away && !r.jailed) out.push({ x: r.x, y: r.y, o: r });
    if (Game.bike && !this.riding) out.push({ x: Game.bike.x, y: Game.bike.y, o: 'mine' });
    return out;
  },
  hpOf(o) { const v = o === 'mine' ? Game.bike.hp : o.hp; return v === undefined ? 4 : v; },

  // A bullet landing at x,y: returns true if it hit a bike or kart.
  hitAt(x, y, dmg) {
    let best = null, bd = 1.0;
    for (const v of this.vehicles()) { const d = U.dist(v.x, v.y, x, y); if (d < bd) { bd = d; best = v; } }
    if (!best) return false;
    this.damage(best.o, dmg);
    return true;
  },

  damage(o, dmg) {
    const before = this.hpOf(o), hp = before - dmg;
    if (o === 'mine') Game.bike.hp = hp; else o.hp = hp;
    Sfx.tone(1100 + Math.random() * 400, 0.05, 0.18, 'square', 500);
    if (hp <= 0) { setTimeout(() => this.explode(o), 120); return; }
    if (before > 2.5 && hp <= 2.5) Hud.toast('It\'s smoking — a couple more and it\'ll blow!', '#F2C14E', 1.8);
    else if (before > 1.2 && hp <= 1.2) Hud.toast('It\'s on FIRE!', UI.bad, 1.4);
    if (o !== 'mine' && !this.onFoot(o) && Math.random() < 0.5) { o.bubble = U.pick(Math.random, ['HEY! MY BIKE!', 'ARE YOU SHOOTING AT ME?!', 'Not the paint job!']); o.bubbleT = 1.8; }
  },

  explode(o) {
    if (o === 'mine') {
      if (!Game.bike) return;
      const x = this.riding ? Player.x : Game.bike.x, y = this.riding ? Player.y : Game.bike.y, id = Game.bike.id;
      if (this.riding) this.dismount();
      this.wreck(this.mine, x, y); this.mine = null;
      Game.vpermits = (Game.vpermits || []).filter((p) => p !== Game.bike.plate);
      Game.bike = null;
      Hud.toast('KABOOM. Your ' + BIKE_BY_ID[id].name + ' is a smoking wreck.', UI.bad, 2.6);
      Arsenal.explode(x, y, 3);
      Game.save();
      return;
    }
    if (o.noBike) return;
    const x = o.x, y = o.y, riding = !this.onFoot(o);
    this.wreck(o.bike, x, y);
    o.bike = this.modelFor(o.bikeId); o.noBike = true; o.hp = 4;
    if (riding) { o.px = x + 1; o.py = y + 0.6; }
    o.state = 'stranded'; o.stateT = 50; o.chaseT = 0; o.foot = null;
    Arsenal.explode(x, y, 3);
  },

  // Rockets and other explosions set off any ride nearby (with a little delay for drama).
  blast(x, y, r) {
    for (const v of this.vehicles()) if (U.dist(v.x, v.y, x, y) < r) { if (v.o === 'mine') Game.bike.hp = 0; else v.o.hp = 0; setTimeout(() => this.explode(v.o), 180 + Math.random() * 200); }
  },

  wreck(mesh, x, y) {
    if (!mesh) return;
    const burnt = this.burntMat || (this.burntMat = new THREE.MeshToonMaterial({ color: 0x2A2522, gradientMap: Toon.gradient() }));
    mesh.traverse((m) => { if (m.isMesh && m.material && m.material.side !== THREE.BackSide) m.material = burnt; });
    mesh.position.set(x, Scene3D.standH(x, y), y); mesh.rotation.set(0.35, mesh.rotation.y, 0.5);
    if (!mesh.parent) this.group.add(mesh);
    (this.wrecks = this.wrecks || []).push({ mesh, x, y, t: 60 });
  },

  // Smoke (and flames) from damaged rides and fresh wrecks.
  smokeTick(dt) {
    if (!this.smoke) {
      // Cartoon puffs: little low-poly balls that swell and fade.
      const geo = new THREE.IcosahedronGeometry(0.32, 1);
      this.smoke = Array.from({ length: 70 }, () => { const s = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); s.visible = false; s.userData.t = 1; s.renderOrder = 5; Scene3D.scene.add(s); return s; });
    }
    const emit = (x, y, h, fire) => {
      const s = this.smoke.find((q) => q.userData.t >= 1); if (!s) return;
      s.userData = { t: 0, life: fire ? 0.6 : 1.8, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3, fire };
      s.position.set(x + (Math.random() - 0.5) * 0.4, h + (fire ? 0.6 : 0.9), y + (Math.random() - 0.5) * 0.4); s.visible = true;
      s.material.color.set(fire ? 0xFF8A2A : 0x3A3A3A);
    };
    const src = [];
    for (const r of this.riders) if (!r.noBike && (r.hp ?? 4) <= 2.5) src.push([r.x, r.y, r.hp]);
    if (Game.bike && (Game.bike.hp ?? 4) <= 2.5) src.push([this.riding ? Player.x : Game.bike.x, this.riding ? Player.y : Game.bike.y, Game.bike.hp]);
    for (const w of this.wrecks || []) { w.t -= dt; src.push([w.x, w.y, w.t > 45 ? 0.5 : 2]); }
    if (this.wrecks) this.wrecks = this.wrecks.filter((w) => { if (w.t > 0) return true; this.group.remove(w.mesh); return false; });
    for (const [x, y, hp] of src) {
      if (U.dist(x, y, Player.x, Player.y) > 60) continue;
      const h = Scene3D.standH(x, y);
      if (Math.random() < dt * (3 - hp) * 7) emit(x, y, h, false);
      if (hp <= 1.2 && Math.random() < dt * 10) emit(x, y, h, true);
    }
    for (const s of this.smoke) {
      const u = s.userData; if (u.t >= 1) continue;
      u.t += dt / u.life;
      if (u.t >= 1) { s.visible = false; continue; }
      s.position.x += u.vx * dt; s.position.z += u.vz * dt; s.position.y += dt * (u.fire ? 1.4 : 1.5);
      const k = u.fire ? 0.5 + u.t * 0.4 : 0.7 + u.t * 2.2;
      s.scale.set(k, k, k);
      s.material.opacity = (1 - u.t) * (u.fire ? 0.95 : 0.85);
    }
  },

  // ---------- drawing + engine noise ----------
  render(dt = 1 / 60) {
    this.smokeTick(dt);
    const base = (x, y) => Scene3D.standH(x, y);
    let loud = 0, rpm = 60;
    for (const r of this.riders) {
      const d = U.dist(r.x, r.y, Player.x, Player.y), vis = d < 70 && !Interior.active && !r.away && !r.jailed;
      r.mesh.visible = vis; r.bike.visible = vis && !r.noBike;
      if (r.pistol) r.pistol.visible = vis && r.armed && r.state === 'stranded' && r.chaseT > 0 && !(r.ko > 0);
      if (vis) {
        const h = base(r.x, r.y), pitch = r.wheelie > 0 ? Math.min(0.5, r.wheelie) : 0;
        r.bike.position.set(r.x, h, r.y); r.bike.rotation.set(0, -r.ang, pitch);
        const dir = Math.abs(Math.cos(r.ang)) > Math.abs(Math.sin(r.ang)) ? 'side' : Math.sin(r.ang) > 0 ? 'down' : 'up';
        if (this.onFoot(r)) {
          r.mesh.position.set(r.px, base(r.px, r.py), r.py);
          const aiming = r.armed && r.state === 'stranded' && r.chaseT > 0;
          if (aiming) r.walkFace = Math.atan2(Player.y - r.py, Player.x - r.px);
          if (r.walkFace !== undefined) r.mesh.userData.rig.yaw.rotation.y = -r.walkFace;
          Models.pose(r.mesh.userData.rig, { moving: r.onFootMoving, phase: r.walkT, t: Game.time, pose: aiming ? 'grip' : undefined });
          if (aiming) {
            if (!r.pistol) { r.pistol = Wanted.gunMesh(false); this.group.add(r.pistol); }
            Models.handPos(r.mesh.userData.rig, r.pistol.position); r.pistol.rotation.set(0, -r.walkFace, 0);
          }
        } else {
          const S = seatOf(r.bikeId), rig = r.mesh.userData.rig;
          r.mesh.position.set(r.x + Math.cos(r.ang) * S.seatX, h + S.seatY + pitch * 0.3, r.y + Math.sin(r.ang) * S.seatX);
          rig.yaw.rotation.y = -r.ang;
          Models.pose(rig, { pose: S.pose, t: Game.time });
          this.holdBars(rig, r.bikeId, r.x, r.y, r.ang, h + pitch * 0.45);
        }
      }
      const lv = (d < 28 ? (1 - d / 28) ** 2 : 0) * (Interior.active || this.onFoot(r) ? 0 : 0.7); // locals fade fast with distance
      if (lv > loud) { loud = lv; rpm = 70 + r.speed * 10 + (r.wheelie > 0 ? 30 : 0); }
    }
    // Your bike: parked where you left it, or under you.
    if (this.mine) {
      const mx = this.riding ? Player.x : Game.bike.x, my = this.riding ? Player.y : Game.bike.y;
      this.mine.visible = !Interior.active && U.dist(mx, my, Player.x, Player.y) < 70;
      const ang = this.riding ? Player.face : (Game.bike.ang || 0);
      this.mine.position.set(mx, base(mx, my) + (this.riding ? Player.z : 0), my);
      this.mine.rotation.set(0, -ang, this.riding && seatOf(Game.bike.id).pose === 'ride' ? -Math.hypot(this.vel.x, this.vel.y) * 0.004 : 0);
      if (this.riding) {
        const sp = Math.hypot(this.vel.x, this.vel.y);
        const lv = 0.55 + sp / 30;
        if (lv > loud) { loud = lv; rpm = 60 + sp * 12; }
      }
    }
    Sfx.setEngine(loud, rpm);
  },

  drawBubbles(hud) {
    for (const r of this.riders) {
      const rp = this.riderPos(r);
      if (r.bubbleT > 0 && r.bubble !== r.said) { r.said = r.bubble; Voice.babble(r.bubble, rp.x, rp.y, r.name); } else if (r.bubbleT <= 0) r.said = null;
      if (r.bubbleT <= 0 || U.dist(rp.x, rp.y, Player.x, Player.y) > 30) continue;
      const [sx, sy, ok] = Scene3D.project(rp.x, rp.y, Scene3D.standH(rp.x, rp.y) + 2);
      if (ok) hud.pill(r.bubble, sx, sy, UI.accent, 12);
    }
  },

  // ---------- the dealership ----------
  openShop() {
    const own = this.ownsIt() ? BIKE_BY_ID[Game.bike.id] : null, trade = own ? Math.round(own.price / 2) : 0;
    const row = (b) => {
      const net = b.price - trade, mine = own && own.id === b.id;
      return `<div class="row"><div><b>${b.name}</b> <span class="desc">· top speed ${b.top} m/s</span><div class="desc">${b.desc}</div></div>
        ${mine ? '<span class="owned">✓ Yours</span>' : `<button class="primary" data-bike="${b.id}" ${Game.money < net ? 'disabled' : ''}>${own ? 'Trade up ' + U.fmtMoney(net) : 'Buy ' + U.fmtMoney(b.price)}</button>`}</div>`;
    };
    const reg = Game.bike ? `<div class="row"><div><b>${BIKE_BY_ID[Game.bike.id].name} · plate ${Game.bike.plate}</b><div class="desc">Registered to ${this.ownsIt() ? 'you' : Game.bike.owner}${this.permitted() ? ' · rider permit ✓' : ' · <span style="color:var(--bad)">no permit — this one\'s hot</span>'}</div></div></div>` : '';
    Life.panel(`<h2>Dirt Cheap Bikes &amp; Karts</h2><div class="desc">"Mate. MATE. Every ride comes registered, plated and with a rider permit for that exact machine. Fish are slow. Be fast." — Revs · You have <b style="color:var(--accent)">${U.fmtMoney(Game.money)}</b></div>
      ${reg ? '<h3>Your ride</h3>' + reg : ''}
      <h3>Dirt bikes</h3>${BIKES.filter((b) => !b.kind).map(row).join('')}
      <h3>Go-karts</h3>${BIKES.filter((b) => b.kind === 'kart').map(row).join('')}
      ${Game.impound ? `<h3>Impound yard</h3><div class="row"><div><b>Your ${BIKE_BY_ID[Game.impound.id].name} · plate ${Game.impound.plate}</b><div class="desc">Seized for dangerous driving. Pay the release fee and it's yours again.</div></div><button class="primary" data-unimpound ${Game.money < 150 ? 'disabled' : ''}>Release — ${U.fmtMoney(150)}</button></div>` : ''}
      <h3>Boats</h3>${Object.entries(BOAT_TYPES).map(([k, t]) => `<div class="row"><div><b>${t.name}</b><div class="desc">${k === 'jetski' ? 'Fast, loud, very fun.' : 'Stand up and fish from it; take the tiller to motor about.'} Delivered to the town dock.</div></div>${Game.boat && Game.boat.type === k && Game.boat.owner === 'you' ? '<span class="owned">✓ Yours</span>' : `<button class="primary" data-boat="${k}" ${Game.money < t.price ? 'disabled' : ''}>Buy ${U.fmtMoney(t.price)}</button>`}</div>`).join('')}
      <h3>Fuel &amp; the law</h3><div class="desc">Tank ${Math.round(Game.fuel)}% — fill up at the gas station at the bottom of the main street. The pump camera reads plates: a ride that isn't registered to you gets reported, and wardens check permits on sight.</div>
      ${Game.bike && !this.ownsIt() ? '<div class="desc" style="margin-top:8px">No trade-ins on stolen goods — buying a new ride leaves that one where it is.</div>' : ''}`, (el) => {
      const ub = el.querySelector('[data-unimpound]');
      if (ub) ub.onclick = () => {
        Game.money -= 150; const shop = World.buildings.find((x) => x.type === 'bikes'), d = World.doorOf(shop);
        Game.bike = { ...Game.impound, x: d.x - 2.6, y: d.y + 1.6, ang: Math.PI / 2 }; Game.impound = null;
        this.syncMine(); Sfx.coin(); Hud.toast('Released from the impound. Ride nicely this time.', UI.good, 2.4); Game.save(); this.openShop();
      };
      el.querySelectorAll('[data-boat]').forEach((btn) => { btn.onclick = () => {
        const k = btn.dataset.boat, t = BOAT_TYPES[k]; Game.money -= t.price;
        for (const old of Boats.list.filter((b) => b.mine && b.owner === 'you')) { Boats.group.remove(old.mesh); Boats.list.splice(Boats.list.indexOf(old), 1); }
        const d = World.dockEnd; let spot = null;
        for (const [dx, dy] of [[1.9, 1], [-1.9, 1], [2.4, 3], [-2.4, 3], [0, -1.6]]) if (!spot && Boats.floats(d.x + dx, d.y + dy)) spot = { x: d.x + dx, y: d.y + dy };
        spot = spot || { x: d.x, y: d.y - 2 };
        const b = Boats.add({ type: k, x: spot.x, y: spot.y, ang: -Math.PI / 2, owner: 'you', mine: true });
        Game.boat = { type: k, x: b.x, y: b.y, ang: b.ang, owner: 'you' };
        Sfx.coin(); Hud.toast('Your ' + t.name.toLowerCase() + ' is moored at the end of the town dock.', UI.good, 2.6); Game.save(); this.openShop();
      }; });
      el.querySelectorAll('[data-bike]').forEach((btn) => { btn.onclick = () => {
        const b = BIKE_BY_ID[btn.dataset.bike];
        Game.money -= b.price - trade;
        const shop = World.buildings.find((x) => x.type === 'bikes'), d = World.doorOf(shop);
        if (own) Game.vpermits = (Game.vpermits || []).filter((p) => p !== Game.bike.plate); // traded in
        Game.bike = { id: b.id, x: d.x - 2.6, y: d.y + 1.6, ang: Math.PI / 2, plate: newPlate(), owner: 'you' };
        (Game.vpermits = Game.vpermits || []).push(Game.bike.plate);
        Game.fuel = Math.max(Game.fuel, 60);
        this.syncMine(); Sfx.coin();
        Hud.toast('The ' + b.name + ' (plate ' + Game.bike.plate + ') is parked out front, permit in your pocket. Ride safe!', UI.good, 3);
        Game.save(); this.openShop();
      }; });
    });
  },
};
