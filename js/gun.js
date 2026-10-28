// The scoped rifle: a deeply unsporting way to "fish", and the way to hunt.
'use strict';

const HIP_RANGE = 25, SCOPE_RANGE = 60;

const Gun = {
  out: false, cooldown: 0, kick: 0, flashT: 0, mesh: null, flash: null, tracers: [], floaters: [], floatPool: [],
  scoped: false, wasScoped: false, look: { x: 0, y: 0 }, zoom: 0,

  init() {
    this.mesh = this.buildRifle();
    setTimeout(() => Arsenal.build(), 0); // after Models is ready
    this.mesh.visible = false;
    Scene3D.scene.add(this.mesh);
    for (let i = 0; i < 8; i++) {
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

  // A bolt-action hunting rifle along +x: walnut stock, blued receiver and barrel, scope on rings.
  buildRifle() {
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x6B3E1F });
    const woodDark = new THREE.MeshLambertMaterial({ color: 0x4A2A14 });
    const steel = new THREE.MeshLambertMaterial({ color: 0x23262B });
    const glass = new THREE.MeshBasicMaterial({ color: 0x7FC4D4 });
    // Stock silhouette (side profile, metres): butt, wrist, fore-end.
    const s = new THREE.Shape();
    s.moveTo(-0.62, -0.02); s.lineTo(-0.62, 0.075); s.lineTo(-0.36, 0.055); s.quadraticCurveTo(-0.24, 0.05, -0.2, 0.03);
    s.lineTo(0.38, 0.03); s.lineTo(0.4, 0.0); s.lineTo(-0.12, -0.02); s.quadraticCurveTo(-0.2, -0.07, -0.3, -0.06); s.closePath();
    const stock = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.045, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }), wood);
    stock.position.z = -0.0225;
    g.add(stock);
    const butt = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.05), woodDark); // recoil pad
    butt.position.set(-0.63, 0.027, 0); g.add(butt);
    const recv = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.042), steel); // receiver
    recv.position.set(-0.04, 0.05, 0); g.add(recv);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.62, 10), steel);
    barrel.rotation.z = Math.PI / 2; barrel.position.set(0.39, 0.055, 0); g.add(barrel);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10), steel);
    crown.rotation.z = Math.PI / 2; crown.position.set(0.7, 0.055, 0); g.add(crown);
    // Bolt handle with its knob, sticking out to the side.
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), steel);
    bolt.rotation.x = Math.PI / 2; bolt.position.set(-0.1, 0.05, 0.045); g.add(bolt);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), steel);
    knob.position.set(-0.1, 0.045, 0.08); g.add(knob);
    // Trigger guard + trigger
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 6, 12, Math.PI), steel);
    guard.rotation.z = Math.PI; guard.position.set(-0.1, 0.0, 0); g.add(guard);
    const trig = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.006), steel);
    trig.position.set(-0.1, 0.0, 0); g.add(trig);
    // Scope: tube, flared objective and eyepiece, turret, two rings.
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 12), steel);
    tube.rotation.z = Math.PI / 2; tube.position.set(-0.02, 0.125, 0); g.add(tube);
    const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.019, 0.08, 14), steel);
    obj.rotation.z = -Math.PI / 2; obj.position.set(0.16, 0.125, 0); g.add(obj);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.019, 0.06, 14), steel);
    eye.rotation.z = Math.PI / 2; eye.position.set(-0.2, 0.125, 0); g.add(eye);
    const lensF = new THREE.Mesh(new THREE.CircleGeometry(0.026, 14), glass);
    lensF.rotation.y = Math.PI / 2; lensF.position.set(0.201, 0.125, 0); g.add(lensF);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 8), steel);
    turret.position.set(-0.02, 0.15, 0); g.add(turret);
    for (const x of [-0.12, 0.08]) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.03), steel);
      ring.position.set(x, 0.095, 0); g.add(ring);
    }
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true }));
    this.flash.position.x = 0.76;
    g.add(this.flash);
    g.scale.setScalar(1.25);
    Toon.apply(g);
    return g;
  },

  // Where a shot will land. Scoped: wherever the crosshair sits (with breathing sway); hip: the cursor.
  aimPoint() {
    const p = Player;
    if (this.scoped) {
      const s = this.sway();
      const x = this.look.x + s.x, y = this.look.y + s.y;
      return { x, y, ang: Math.atan2(y - p.y, x - p.x), scoped: true };
    }
    const m = Input.mouse;
    const ang = Math.atan2(m.wy - p.y, m.wx - p.x);
    const d = Math.min(HIP_RANGE, U.dist(p.x, p.y, m.wx, m.wy));
    return { x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, ang, scoped: false };
  },

  // Breathing sway in metres; crouching steadies it, recoil throws it.
  sway() {
    const t = Game.time, k = (Player.crouch ? 0.45 : 1) * (1 + this.kick * 3);
    return { x: (Math.sin(t * 1.3) * 0.22 + Math.sin(t * 2.9) * 0.08) * k, y: (Math.cos(t * 1.1) * 0.16 + Math.sin(t * 3.7) * 0.06) * k };
  },

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.kick = Math.max(0, this.kick - dt * 4);
    this.flashT = Math.max(0, this.flashT - dt);
    // Right mouse: look down the scope. The view glides toward wherever you point.
    this.scoped = this.out && Arsenal.weapon().scope && Input.mouse.rdown && !Menus.open && Fishing.state === 'idle';
    if (this.scoped) {
      if (!this.wasScoped) { this.look.x = Player.x + Math.cos(Player.face) * 8; this.look.y = Player.y + Math.sin(Player.face) * 8; Sfx.click(); }
      const m = Input.mouse;
      this.look.x = U.lerp(this.look.x, m.wx, Math.min(1, dt * 1.4));
      this.look.y = U.lerp(this.look.y, m.wy, Math.min(1, dt * 1.4));
      const d = U.dist(Player.x, Player.y, this.look.x, this.look.y);
      if (d > SCOPE_RANGE) { this.look.x = Player.x + (this.look.x - Player.x) * SCOPE_RANGE / d; this.look.y = Player.y + (this.look.y - Player.y) * SCOPE_RANGE / d; }
    }
    this.wasScoped = this.scoped;
    this.zoom = U.lerp(this.zoom, this.scoped ? 1 : 0, Math.min(1, dt * 8));
    if (this.out && !Menus.open && (Input.mousePressed || (Arsenal.weapon().auto && Input.mouse.down))) this.shoot();
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
    if (Interior.active) { Hud.toast('Not indoors!', UI.bad, 1.2); return; }
    // Never at people. Not even the ones on lilos.
    let a = this.aimPoint();
    const lilo = Floaters.near(a.x, a.y, 1.6);
    if (lilo || U.dist(a.x, a.y, World.tim.x, World.tim.y) < 2.5 || Swimmers.near(a.x, a.y, 1.6) || U.dist(a.x, a.y, World.shopkeeper.x, World.shopkeeper.y) < 2.5
      || U.dist(a.x, a.y, World.ranger.x, World.ranger.y) < 2.5) {
      Hud.toast('Whoa — there are people there. Not doing that.', '#f2c14e', 1.8);
      if (lilo) Floaters.say(lilo, 'DON\'T SHOOT!!', 2);
      return;
    }
    const W = Arsenal.weapon();
    if (Arsenal.ammo(W.ammo) <= 0) { Sfx.click(); Hud.toast('*click* Out of ' + AMMO[W.ammo].name.toLowerCase() + '.', '#f2c14e', 2); this.cooldown = 0.4; return; }
    Arsenal.useAmmo(W.ammo);
    this.cooldown = W.cd; this.flashT = 0.06; this.kick = W.id === 'smg' ? 0.35 : W.id === 'pistol' ? 0.6 : 1;
    // Hip range depends on the gun; the scope (rifle) lets you reach further.
    if (!a.scoped && U.dist(Player.x, Player.y, a.x, a.y) > W.range) a = { ...a, x: Player.x + Math.cos(a.ang) * W.range, y: Player.y + Math.sin(a.ang) * W.range };
    if (W.id === 'launcher') { Sfx.whoosh(1); } else { Sfx.shot(); setTimeout(() => Sfx.burst(0.9, 900, 0.12, 'lowpass', 0.5, 300), 260); }
    if (W.id === 'rifle') setTimeout(() => Sfx.click(), 650); // bolt
    if (W.id === 'shotgun') setTimeout(() => { Sfx.click(); Sfx.click(); }, 450); // pump
    const base = Scene3D.standH(Player.x, Player.y) + 0.62;
    for (let k = 0; k < W.pellets; k++) {
      let p = a;
      if (!a.scoped) {
        const d = U.dist(Player.x, Player.y, a.x, a.y), spread = W.spread * (W.pellets > 1 ? 0.35 + d * 0.09 : 0.4 + d * 0.06);
        p = { ...a, x: a.x + (Math.random() - 0.5) * spread * 2, y: a.y + (Math.random() - 0.5) * spread * 2 };
      }
      const t = this.tracers.find((x) => x.userData.t >= 1) || this.tracers[k % this.tracers.length];
      t.geometry.setFromPoints([new THREE.Vector3(Player.x + Math.cos(a.ang) * 1.1, base, Player.y + Math.sin(a.ang) * 1.1),
        new THREE.Vector3(p.x, Math.max(0, Scene3D.groundH(p.x, p.y)) + 0.05, p.y)]);
      t.userData.t = 0; t.visible = true;
      if (W.blast) { setTimeout(() => Arsenal.explode(p.x, p.y, W.blast), 220); continue; }
      this.impact(p, a.scoped, W.pellets > 1);
    }
    // Every fish in earshot bolts, and everyone else has opinions.
    Fish.spookNear(a.x, a.y, 16);
    Fish.list.forEach((f) => { if (U.dist(f.x, f.y, a.x, a.y) < 16) f.cool = 20; });
    Npcs.onGunshot(Player.x, Player.y);
    Wardens.onGunshot();
    Floaters.onGunshot();
    Animals.onGunshot(a.x, a.y);
    Wanted.onGunshot(a.x, a.y);
    Game.save();
  },

  // One bullet (or pellet) landing.
  impact(a, scoped, pellet) {
    if (Wanted.hitPerson(a.x, a.y, scoped)) {
      Hud.ripple(a.x, a.y, 0.3);
    } else if (Animals.shotAt(a.x, a.y, scoped)) {
      Sfx.thunk();
    } else if (World.isWater(a.x, a.y)) {
      Hud.ripple(a.x, a.y, pellet ? 0.5 : 1.1); if (!pellet) Sfx.splash(0.6);
      // It has to actually hit the fish. Deep fish are mostly safe.
      let hit = null, best = 1e9;
      for (const f of Fish.list) {
        if (f.state === 'hooked') continue;
        const d = U.dist(f.x, f.y, a.x, a.y);
        if (d < 0.35 + f.cm / 200 && d < best && Math.random() < U.clamp(1.2 - f.z * 0.4, 0.05, 1)) { best = d; hit = f; }
      }
      if (hit) this.kill(hit);
      else if (!pellet) Hud.toast(['Missed!', 'Just water.', 'The fish are laughing at you.'][(Math.random() * 3) | 0], '#a99f8a', 1.2);
    } else { if (!pellet) Sfx.plop(); Hud.ripple(a.x, a.y, 0.3); }
  },

  kill(f) {
    Fish.list.splice(Fish.list.indexOf(f), 1);
    if (Fishing.engaged === f) Fishing.engaged = null;
    this.floaters.push({ sp: f.sp, cm: f.cm, x: f.x, y: f.y, t: 0, ang: Math.random() * 6.28 });
    // Shot fish sell cheap and don't count for the journal.
    const val = Math.max(1, Math.round(Menus.value(f.sp, f.kg, f.prized) * 0.3));
    Game.money += val;
    Game.stats.shot = (Game.stats.shot || 0) + 1;
    Hud.toast('Shot a ' + U.fmtKg(f.kg) + ' ' + f.sp.name + (f.prized ? ' (a PRIZED one… monster)' : '') + ' — +' + U.fmtMoney(val), '#e2584d', 2.6);
  },

  render(dt) {
    const p = Player;
    for (const id in Arsenal.models) Arsenal.models[id].visible = false;
    const cur = Arsenal.models[Arsenal.weapon().id] || this.mesh;
    cur.visible = this.out;
    if (this.out) {
      const a = this.aimPoint().ang;
      const base = Scene3D.standH(p.x, p.y);
      // Held at the hip, shouldered (raised) while scoped; kicks back on each shot.
      const back = this.kick * 0.18;
      const h = Actors.handWorld || new THREE.Vector3(p.x, base + 0.3, p.y);
      // Trigger sits in the hand (grip is 0.125 behind the receiver origin).
      cur.position.set(h.x + Math.cos(a) * (0.125 - back), h.y + this.zoom * 0.15 + this.kick * 0.04, h.z + Math.sin(a) * (0.125 - back));
      cur.rotation.set(0, -a, this.kick * 0.25);
      this.flash.visible = this.flashT > 0;
    }
    for (const t of this.tracers) {
      if (t.userData.t >= 1) { t.visible = false; continue; }
      t.userData.t += dt / 0.12;
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

  // Scope picture: black surround, glass edge, crosshair with range marks, sway-drifting reticle.
  drawScope(hud) {
    if (this.zoom < 0.05) return;
    const g = hud.g, W = innerWidth, H = innerHeight;
    const r = Math.min(W, H) * 0.36 * (0.85 + this.zoom * 0.15);
    const s = this.sway();
    const [px, py] = Scene3D.project(this.look.x + s.x, this.look.y + s.y, 0);
    const cx = W / 2, cy = H / 2;
    g.save();
    g.globalAlpha = this.zoom;
    g.fillStyle = '#050708'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    // Lens edge shading
    const edge = g.createRadialGradient(cx, cy, r * 0.82, cx, cy, r);
    edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.65)');
    g.fillStyle = edge; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    // Reticle follows the swaying point of aim, drawn only inside the lens.
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    const rx = U.clamp(px, cx - r * 0.5, cx + r * 0.5), ry = U.clamp(py, cy - r * 0.5, cy + r * 0.5);
    g.strokeStyle = 'rgba(10,10,10,0.9)';
    g.lineWidth = 4;
    for (const [x1, y1, x2, y2] of [[rx - r * 1.2, ry, rx - r * 0.18, ry], [rx + r * 0.18, ry, rx + r * 1.2, ry], [rx, ry + r * 0.18, rx, ry + r * 1.2]]) {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(rx - r * 0.18, ry); g.lineTo(rx + r * 0.18, ry); g.moveTo(rx, ry - r * 1.2); g.lineTo(rx, ry + r * 0.18); g.stroke();
    g.fillStyle = 'rgba(10,10,10,0.9)';
    for (let i = 1; i <= 4; i++) {
      const o = i * r * 0.04;
      g.beginPath(); g.arc(rx + o, ry, 1.6, 0, 7); g.arc(rx - o, ry, 1.6, 0, 7); g.fill();
      g.beginPath(); g.arc(rx, ry + o, 1.6, 0, 7); g.fill();
    }
    g.fillStyle = '#E2584D'; g.beginPath(); g.arc(rx, ry, 2.4, 0, 7); g.fill();
    g.restore();
    // Range readout
    const dist = U.dist(Player.x, Player.y, this.look.x, this.look.y);
    hud.text(dist.toFixed(0) + ' m', cx + r * 0.62, cy + r * 0.62, 'rgba(230,240,240,0.85)', 12, 'center', 600);
    g.restore();
    hud.text('Click to fire · C to crouch and steady · release right-click to lower', cx, cy + r + 28, UI.muted, 12, 'center');
  },
};
