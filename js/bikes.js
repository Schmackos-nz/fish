// Dirt bikes: the dealership, your own bike, and the local riders tearing up the trails.
'use strict';

const BIKES = [
  { id: 'trail', name: 'Trail 125', price: 300, top: 11, accel: 9, color: 0xD23A3A, desc: 'Light and forgiving. Perfect first bike.' },
  { id: 'enduro', name: 'Enduro 250', price: 650, top: 14, accel: 12, color: 0x3A8AD2, desc: 'Torquey all-rounder for the backcountry.' },
  { id: 'moto', name: 'Moto 450', price: 1200, top: 17, accel: 15, color: 0xF2C14E, desc: 'Absolutely unnecessary. Absolutely brilliant.' },
];
const BIKE_BY_ID = Object.fromEntries(BIKES.map((b) => [b.id, b]));
const BIKER_PALS = [
  { hat: '#E2584D', hatStyle: 'helmet', visor: '#222', shirt: '#2A2A2E', vest: '#E2584D', pants: '#3A3A4A', skin: '#E2B08A', mitt: '#2A2A2E' },
  { hat: '#3A8AD2', hatStyle: 'helmet', visor: '#222', shirt: '#F4F0E6', vest: '#3A8AD2', pants: '#2A2A3A', skin: '#C08A60', mitt: '#2A2A2E' },
  { hat: '#7DC383', hatStyle: 'helmet', visor: '#222', shirt: '#2A3A2A', vest: '#7DC383', pants: '#3A3A3A', skin: '#F0C8A0', mitt: '#2A2A2E' },
];
const REVS_PAL = { hat: '#2A2A2E', hatStyle: 'cap', shirt: '#2A2A2E', vest: '#6A4A2A', pants: '#2A3A5A', skin: '#D9A07A', beard: '#3A2A1A', hair: '#3A2A1A' };
const BIKER_SAY = ['BRAAAP!', 'Wheelie time!', 'Outta the way!', 'Yeeehaw!'];

const Bikes = {
  group: null, riders: [], mine: null, riding: false, vel: { x: 0, y: 0 }, warnedFuel: false, crashT: 0,

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
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), black); bars.rotation.x = Math.PI / 2; bars.position.set(0.4, 1.0, 0); g.add(bars);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0xF4F0E6 })); plate.position.set(0.58, 0.86, 0); g.add(plate);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8), steel); pipe.rotation.z = Math.PI / 2 - 0.25; pipe.position.set(-0.35, 0.5, 0.14); g.add(pipe);
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
      const r = { x: i % World.W + 0.5, y: ((i / World.W) | 0) + 0.5, ang: Math.random() * 6.28, speed: 8 + Math.random() * 3, target: null, wheelie: 0, bubbleT: 0, bubble: null, pal };
      r.bike = this.model(BIKES[k % BIKES.length].color);
      r.frames = { side: Folk.texture(pal, 'side', 0, 'grip'), down: Folk.texture(pal, 'down', 0, 'grip'), up: Folk.texture(pal, 'up', 0, 'grip') };
      r.mesh = Actors.billboard(document.createElement('canvas'), 1, 1.25);
      r.mesh.material.map = r.frames.side;
      this.group.add(r.bike, r.mesh);
      return r;
    });
    this.syncMine();
  },

  // (Re)build the mesh for the bike you own.
  syncMine() {
    if (this.mine) this.group.remove(this.mine);
    this.mine = Game.bike ? this.model(BIKE_BY_ID[Game.bike.id].color) : null;
    if (this.mine) this.group.add(this.mine);
  },

  blocked(x, y) { return World.blocked(x, y) || World.depthAt(x, y) > 0.45; },

  // ---------- your bike ----------
  near() { return Game.bike && !this.riding && !Interior.active && U.dist(Player.x, Player.y, Game.bike.x, Game.bike.y) < 2; },

  mount() {
    if (Fishing.state !== 'idle') return;
    this.riding = true; this.vel = { x: 0, y: 0 };
    this.prevTool = Tools.current; Tools.current = 'hands'; Gun.out = false;
    Player.place(Game.bike.x, Game.bike.y); Player.crouch = false;
    Sfx.tone(90, 0.4, 0.3, 'sawtooth', 140);
    Hud.toast('Vroom. WASD to ride, Space to jump, E to get off.', UI.ink, 2.4);
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
    if (!fuel && !this.warnedFuel) { this.warnedFuel = true; Hud.toast('Out of fuel! Revs at Dirt Cheap Bikes sells more.', UI.bad, 3); }
    if (fuel) this.warnedFuel = false;
    const len = Math.hypot(ix, iy) || 1;
    const top = b.top * (fuel ? 1 : 0.2) * (World.isWater(Player.x, Player.y) ? 0.45 : 1);
    const tx = ix ? ix / len * top : 0, ty = iy ? iy / len * top : 0;
    const k = Math.min(1, dt * (ix || iy ? b.accel / top : 3));
    this.vel.x = U.lerp(this.vel.x, tx, k); this.vel.y = U.lerp(this.vel.y, ty, k);
    const speed = Math.hypot(this.vel.x, this.vel.y);
    Game.fuel = Math.max(0, Game.fuel - speed * dt * 0.02);
    const nx = Player.x + this.vel.x * dt, ny = Player.y + this.vel.y * dt;
    if (!this.blocked(nx, Player.y)) Player.x = nx; else this.crash(speed);
    if (!this.blocked(Player.x, ny)) Player.y = ny; else this.crash(speed);
    if (speed > 0.3) Player.face = Math.atan2(this.vel.y, this.vel.x);
    Player.moving = speed > 0.3; Player.running = false; Player.walkT += dt * 0.2;
    Player.wading = World.isWater(Player.x, Player.y) && !Player.airborne;
    if (Player.wading && speed > 1 && Math.random() < dt * 6) Hud.ripple(Player.x, Player.y, 0.7);
    // Jumps go further on a bike.
    if (Input.pressed('Space') && !Player.airborne) { Player.jumpT = JUMP_TIME * 1.3; Sfx.whoosh(0.3); }
    if (Player.jumpT > 0) {
      Player.jumpT = Math.max(0, Player.jumpT - dt);
      Player.z = Math.sin((1 - Player.jumpT / (JUMP_TIME * 1.3)) * Math.PI) * 1.0;
      if (Player.jumpT === 0) { Player.z = 0; Sfx.thunk(); }
    }
    Game.bike.x = Player.x; Game.bike.y = Player.y;
    this.crashT = Math.max(0, this.crashT - dt);
  },

  crash(speed) {
    if (speed > 6 && this.crashT <= 0) { this.crashT = 1; Sfx.thunk(); Bugs.shake = 1; Hud.toast('Thud!', UI.bad, 0.8); }
    this.vel.x *= -0.3; this.vel.y *= -0.3;
  },

  // ---------- local riders ----------
  update(dt) {
    for (const r of this.riders) {
      r.bubbleT = Math.max(0, r.bubbleT - dt);
      if (!r.target || U.dist(r.x, r.y, r.target.x, r.target.y) < 2) r.target = this.pickTarget(r);
      const want = Math.atan2(r.target.y - r.y, r.target.x - r.x);
      r.ang += U.clamp(U.angDiff(r.ang, want), -2.5 * dt, 2.5 * dt);
      const nx = r.x + Math.cos(r.ang) * r.speed * dt, ny = r.y + Math.sin(r.ang) * r.speed * dt;
      if (this.blocked(nx, ny)) { r.ang += Math.PI * (0.5 + Math.random() * 0.4); r.target = this.pickTarget(r); }
      else { r.x = nx; r.y = ny; }
      // Showing off.
      if (r.wheelie > 0) r.wheelie -= dt; else if (Math.random() < dt * 0.08) r.wheelie = 1.5;
      const pd = U.dist(r.x, r.y, Player.x, Player.y);
      if (pd < 25 && Math.random() < dt * 0.05) { r.bubble = U.pick(Math.random, BIKER_SAY); r.bubbleT = 1.8; }
      // Clipping the angler.
      if (pd < 1.1 && !this.riding && !Player.evasive && !Interior.active && !r.hitCool) {
        r.hitCool = 3;
        const a = Math.atan2(Player.y - r.y, Player.x - r.x);
        for (let s = 0; s < 8; s++) { const x = Player.x + Math.cos(a) * 0.25, y = Player.y + Math.sin(a) * 0.25; if (World.blocked(x, y)) break; Player.x = x; Player.y = y; }
        if (Fishing.state !== 'idle' && Fishing.state !== 'fight') Fishing.reelInFast();
        Bugs.shake = 1; Sfx.thunk();
        Hud.toast('A dirt biker clipped you! (Jump or slide to dodge them.)', UI.bad, 2.2);
      }
      r.hitCool = Math.max(0, (r.hitCool || 0) - dt);
      // Anglers do not appreciate it.
      for (const n of Npcs.list) {
        if (n.state === 'home' || n.state === 'bush' || U.dist(n.x, n.y, r.x, r.y) > 4 || (n.bikeYell && Game.time < n.bikeYell)) continue;
        n.bikeYell = Game.time + 20; Npcs.say(n, U.pick(Math.random, ['SLOW DOWN!', 'You\'re scaring the fish!', 'Bloody bikers…']), 2.4);
      }
    }
  },

  pickTarget(r) {
    // Mostly trails; now and then cut across open country.
    for (let t = 0; t < 20; t++) {
      const a = Math.random() * 6.28, d = 15 + Math.random() * 50;
      const x = r.x + Math.cos(a) * d, y = r.y + Math.sin(a) * d;
      if (this.blocked(x, y)) continue;
      if (World.tileAt(x, y) === T.PATH || Math.random() < 0.25) return { x, y };
    }
    return { x: World.town.x, y: World.town.y + 10 };
  },

  // ---------- drawing + engine noise ----------
  render() {
    const base = (x, y) => Scene3D.standH(x, y);
    let loud = 0, rpm = 60;
    for (const r of this.riders) {
      const d = U.dist(r.x, r.y, Player.x, Player.y), vis = d < 70 && !Interior.active;
      r.bike.visible = r.mesh.visible = vis;
      if (vis) {
        const h = base(r.x, r.y), pitch = r.wheelie > 0 ? Math.min(0.5, r.wheelie) : 0;
        r.bike.position.set(r.x, h, r.y); r.bike.rotation.set(0, -r.ang, pitch);
        const dir = Math.abs(Math.cos(r.ang)) > Math.abs(Math.sin(r.ang)) ? 'side' : Math.sin(r.ang) > 0 ? 'down' : 'up';
        r.mesh.material.map = r.frames[dir];
        r.mesh.scale.x = dir === 'side' && Math.cos(r.ang) < 0 ? -1 : 1;
        r.mesh.position.set(r.x, h + 0.38 + pitch * 0.3, r.y);
      }
      const lv = (d < 28 ? (1 - d / 28) ** 2 : 0) * (Interior.active ? 0 : 0.7); // locals fade fast with distance
      if (lv > loud) { loud = lv; rpm = 70 + r.speed * 10 + (r.wheelie > 0 ? 30 : 0); }
    }
    // Your bike: parked where you left it, or under you.
    if (this.mine) {
      const mx = this.riding ? Player.x : Game.bike.x, my = this.riding ? Player.y : Game.bike.y;
      this.mine.visible = !Interior.active && U.dist(mx, my, Player.x, Player.y) < 70;
      const ang = this.riding ? Player.face : (Game.bike.ang || 0);
      this.mine.position.set(mx, base(mx, my) + (this.riding ? Player.z : 0), my);
      this.mine.rotation.set(0, -ang, this.riding ? -Math.hypot(this.vel.x, this.vel.y) * 0.004 : 0);
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
      if (r.bubbleT <= 0 || U.dist(r.x, r.y, Player.x, Player.y) > 30) continue;
      const [sx, sy, ok] = Scene3D.project(r.x, r.y, Scene3D.standH(r.x, r.y) + 2);
      if (ok) hud.pill(r.bubble, sx, sy, UI.accent, 12);
    }
  },

  // ---------- the dealership ----------
  openShop() {
    const own = Game.bike ? BIKE_BY_ID[Game.bike.id] : null, trade = own ? Math.round(own.price / 2) : 0;
    const fillCost = Math.ceil((100 - Game.fuel) * 0.15);
    Life.panel(`<h2>Dirt Cheap Bikes</h2><div class="desc">"Mate. MATE. Have you seen the Moto 450? Fish are slow. Be fast." — Revs · You have <b style="color:var(--accent)">${U.fmtMoney(Game.money)}</b></div>
      <h3>Bikes</h3>${BIKES.map((b) => {
        const net = b.price - trade, mine = own && own.id === b.id;
        return `<div class="row"><div><b>${b.name}</b> <span class="desc">· top speed ${b.top} m/s</span><div class="desc">${b.desc}</div></div>
          ${mine ? '<span class="owned">✓ Yours</span>' : `<button class="primary" data-bike="${b.id}" ${Game.money < net ? 'disabled' : ''}>${own ? 'Trade up ' + U.fmtMoney(net) : 'Buy ' + U.fmtMoney(b.price)}</button>`}</div>`;
      }).join('')}
      <h3>Fuel</h3><div class="row"><div><b>Tank ${Math.round(Game.fuel)}%</b><div class="desc">Riding burns fuel; run dry and you'll be pushing.</div></div>
        <button data-fuel ${Game.fuel >= 99.5 || Game.money < fillCost ? 'disabled' : ''}>Fill up ${U.fmtMoney(fillCost)}</button></div>
      ${own ? '' : '<div class="desc" style="margin-top:12px">Your bike gets parked out front. Press E beside it to ride.</div>'}`, (el) => {
      el.querySelectorAll('[data-bike]').forEach((btn) => { btn.onclick = () => {
        const b = BIKE_BY_ID[btn.dataset.bike];
        Game.money -= b.price - trade;
        const shop = World.buildings.find((x) => x.type === 'bikes'), d = World.doorOf(shop);
        Game.bike = { id: b.id, x: d.x - 2.6, y: d.y + 1.6, ang: Math.PI / 2 };
        Game.fuel = Math.max(Game.fuel, 60);
        this.syncMine(); Sfx.coin();
        Hud.toast('The ' + b.name + ' is parked out front. Ride safe!', UI.good, 2.6);
        Game.save(); this.openShop();
      }; });
      const f = el.querySelector('[data-fuel]');
      if (f) f.onclick = () => { Game.money -= fillCost; Game.fuel = 100; Sfx.coin(); Game.save(); this.openShop(); };
    });
  },
};
