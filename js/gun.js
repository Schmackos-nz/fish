// The shotgun: a deeply unsporting way to "fish".
'use strict';

const GUN_RANGE = 20;

const Gun = {
  out: false, cooldown: 0, kick: 0, flashT: 0, mesh: null, flash: null, tracers: [], floaters: [], floatPool: [],

  init() {
    const g = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
    const wood = new THREE.MeshLambertMaterial({ color: 0x7a4a24 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), dark);
    barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.38;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.07), wood);
    stock.position.x = 0.02;
    g.add(barrel, stock);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true }));
    this.flash.position.x = 0.75;
    g.add(this.flash);
    g.scale.setScalar(1.6);
    g.visible = false;
    this.mesh = g;
    Scene3D.scene.add(g);
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfff2c8, transparent: true }));
      t.frustumCulled = false; t.visible = false; t.userData.t = 1;
      Scene3D.scene.add(t); this.tracers.push(t);
    }
    // Belly-up fish lying on the surface.
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.PlaneGeometry(1, 0.5); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1, depthWrite: false }));
      m.visible = false; m.renderOrder = 5;
      Scene3D.scene.add(m); this.floatPool.push(m);
    }
  },

  // Where the shot will land: the cursor, clamped to range.
  aimPoint() {
    const p = Player, m = Input.mouse;
    const ang = Math.atan2(m.wy - p.y, m.wx - p.x);
    const d = Math.min(GUN_RANGE, U.dist(p.x, p.y, m.wx, m.wy));
    return { x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, ang };
  },

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.kick = Math.max(0, this.kick - dt * 6);
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.out && Input.mousePressed && !Menus.open) this.shoot();
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      const [fx, fy] = World.flowAt(f.x, f.y);
      f.x += fx * dt * 0.5; f.y += fy * dt * 0.5;
      if (f.t > 6) this.floaters.splice(i, 1);
    }
  },

  shoot() {
    if (this.cooldown > 0) return;
    // Never at people. Not even the ones on lilos.
    const aim = this.aimPoint();
    const lilo = Floaters.near(aim.x, aim.y, 3.5);
    if (lilo || Npcs.near(aim.x, aim.y, 2.5) || U.dist(aim.x, aim.y, World.shopkeeper.x, World.shopkeeper.y) < 2.5) {
      Hud.toast('Whoa — there are people there. Not doing that.', '#f2c14e', 1.8);
      if (lilo) Floaters.say(lilo, 'DON\'T SHOOT!!', 2);
      return;
    }
    if ((Game.ammo || 0) <= 0) { Sfx.click(); Hud.toast('*click* Out of shells — Hettie sells them, reluctantly.', '#f2c14e', 2); return; }
    Game.ammo--;
    this.cooldown = 0.6; this.kick = 1; this.flashT = 0.07;
    Sfx.shot();
    const a = this.aimPoint();
    const t = this.tracers.find((x) => x.userData.t >= 1) || this.tracers[0];
    const base = Scene3D.standH(Player.x, Player.y) + 0.62;
    t.geometry.setFromPoints([new THREE.Vector3(Player.x + Math.cos(a.ang) * 0.9, base, Player.y + Math.sin(a.ang) * 0.9),
      new THREE.Vector3(a.x, Math.max(0, Scene3D.groundH(a.x, a.y)) + 0.05, a.y)]);
    t.userData.t = 0; t.visible = true;

    if (Animals.shotAt(a.x, a.y)) {
      Sfx.thunk();
    } else if (World.isWater(a.x, a.y)) {
      Hud.ripple(a.x, a.y, 1.6); Hud.ripple(a.x + 0.3, a.y - 0.2, 0.9); Sfx.splash(0.9);
      // Buckshot spreads; shallow fish are easy, deep ones are mostly safe.
      let hit = null, best = 1e9;
      for (const f of Fish.list) {
        if (f.state === 'hooked') continue;
        const d = U.dist(f.x, f.y, a.x, a.y);
        if (d < 0.9 + f.cm / 200 && d < best && Math.random() < U.clamp(1.3 - f.z * 0.35, 0.1, 1)) { best = d; hit = f; }
      }
      if (hit) this.kill(hit);
      else Hud.toast(['Missed!', 'Just water. Very dead water.', 'The fish are laughing at you.'][(Math.random() * 3) | 0], '#a99f8a', 1.2);
    } else Sfx.plop();
    // Every fish in earshot bolts, and the anglers are NOT happy.
    Fish.spookNear(a.x, a.y, 16);
    Fish.list.forEach((f) => { if (U.dist(f.x, f.y, a.x, a.y) < 16) f.cool = 20; });
    Npcs.onGunshot(Player.x, Player.y);
    Floaters.onGunshot();
    Animals.onGunshot(a.x, a.y);
    Game.save();
  },

  kill(f) {
    Fish.list.splice(Fish.list.indexOf(f), 1);
    if (Fishing.engaged === f) Fishing.engaged = null;
    this.floaters.push({ sp: f.sp, cm: f.cm, x: f.x, y: f.y, t: 0, ang: Math.random() * 6.28 });
    // Lead-filled fish sell cheap and don't count for the journal.
    const val = Math.max(1, Math.round(Menus.value(f.sp, f.kg, f.prized) * 0.3));
    Game.money += val;
    Game.stats.shot = (Game.stats.shot || 0) + 1;
    Hud.toast('Blasted a ' + U.fmtKg(f.kg) + ' ' + f.sp.name + (f.prized ? ' (a PRIZED one… monster)' : '') + ' — +' + U.fmtMoney(val) + ', it\'s mostly lead now', '#e2584d', 2.6);
  },

  render(dt) {
    const p = Player;
    this.mesh.visible = this.out;
    if (this.out) {
      const a = this.aimPoint().ang;
      const base = Scene3D.standH(p.x, p.y);
      this.mesh.position.set(p.x + Math.cos(a) * (0.2 - this.kick * 0.15), base + 0.62 + this.kick * 0.05, p.y + Math.sin(a) * (0.2 - this.kick * 0.15) + 0.05);
      this.mesh.rotation.set(0, -a, this.kick * 0.4);
      this.flash.visible = this.flashT > 0;
    }
    for (const t of this.tracers) {
      if (t.userData.t >= 1) { t.visible = false; continue; }
      t.userData.t += dt / 0.15;
      t.material.opacity = 1 - t.userData.t;
    }
    this.floatPool.forEach((m, i) => {
      const f = this.floaters[i];
      m.visible = !!f;
      if (!f) return;
      const map = Actors.portrait(f.sp);
      if (m.material.map !== map) { m.material.map = map; m.material.needsUpdate = true; }
      const len = Math.max(0.4, f.cm / 100) * 1.3;
      m.position.set(f.x, 0.04 + Math.sin(f.t * 3) * 0.02, f.y);
      m.rotation.y = f.ang;
      m.scale.set(len, 1, -len); // flipped: belly up
      m.material.opacity = U.clamp(6 - f.t, 0, 1);
    });
  },
};
