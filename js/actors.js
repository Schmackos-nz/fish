// Everything that moves in the 3D scene: angler, rod, line, lure, fish and ripples.
'use strict';

const SUB = 0.32; // metres of depth -> scene units below the surface (matches terrain)

const Actors = {
  group: null, player: null, frames: {}, rod: null, line: null, lures: {}, fishPool: [], ripples: [],
  jumpMesh: null, portraits: {}, keeper: null,

  init() {
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.buildPlayer();
    this.keeper = this.billboard(this.drawKeeper(), 1.0, 1.25);
    this.group.add(this.keeper);
    this.rod = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x3a2a1a }));
    this.line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.8 }));
    this.rod.frustumCulled = this.line.frustumCulled = false;
    this.group.add(this.rod, this.line);
    this.buildLures();
    const sil = this.fishSilhouette();
    for (let i = 0; i < 34; i++) {
      const geo = new THREE.PlaneGeometry(1, 0.38); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: sil, color: 0x0d2430, transparent: true, depthWrite: false }));
      m.renderOrder = 1; m.visible = false;
      this.group.add(m); this.fishPool.push(m);
    }
    const rg = new THREE.RingGeometry(0.85, 1, 28); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 24; i++) {
      const r = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      r.renderOrder = 4; r.visible = false; r.userData = { t: 1, size: 1 };
      this.group.add(r); this.ripples.push(r);
    }
    // Where the cast will land.
    const ag = new THREE.RingGeometry(0.32, 0.46, 28); ag.rotateX(-Math.PI / 2);
    this.aimRing = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, depthTest: false, depthWrite: false }));
    this.aimRing.renderOrder = 9;
    this.group.add(this.aimRing);
    this.jumpMesh = this.billboard(document.createElement('canvas'), 1, 0.5);
    this.jumpMesh.visible = false;
    this.group.add(this.jumpMesh);
  },

  billboard(canvas, w, h) {
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.rotation.x = -BILLBOARD_LEAN;
    return m;
  },

  // ---------- the little angler ----------
  buildPlayer() {
    for (const dir of ['down', 'up', 'side']) for (let f = 0; f < 4; f++) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 20;
      this.drawAngler(c.getContext('2d'), dir, f);
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      this.frames[dir + f] = tex;
    }
    this.player = this.billboard(document.createElement('canvas'), 1.0, 1.25);
    this.player.material.map = this.frames.down0;
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.28, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    this.playerShadow = sh;
    // Faint silhouette so the angler stays visible behind trees.
    this.ghost = new THREE.Mesh(this.player.geometry, new THREE.MeshBasicMaterial({ map: this.frames.down0, color: 0xfff2c8, transparent: true, opacity: 0.32, depthTest: false, depthWrite: false, alphaTest: 0.5 }));
    this.ghost.rotation.x = -BILLBOARD_LEAN; this.ghost.renderOrder = 10;
    this.group.add(this.player, sh, this.ghost);
  },

  drawAngler(g, dir, f) {
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const step = f === 1 ? 1 : f === 3 ? -1 : 0;
    // Legs (waders)
    r(5, 15, 2, 4 + (step > 0 ? -1 : 0), '#3d5a3a'); r(9, 15, 2, 4 + (step < 0 ? -1 : 0), '#3d5a3a');
    r(5, 18 + (step > 0 ? -1 : 0), 2, 1, '#2a2018'); r(9, 18 + (step < 0 ? -1 : 0), 2, 1, '#2a2018');
    // Body: fishing vest over a plaid shirt
    r(4, 9, 8, 7, '#b8433a'); r(4, 11, 8, 1, '#7a2a24'); r(4, 13, 8, 1, '#7a2a24');
    if (dir !== 'up') { r(4, 9, 3, 7, '#8a7a4a'); r(9, 9, 3, 7, '#8a7a4a'); r(5, 11, 1, 1, '#5a4a2a'); r(10, 11, 1, 1, '#5a4a2a'); }
    else r(4, 9, 8, 7, '#8a7a4a');
    // Arms
    r(3, 10 + (step < 0 ? 1 : 0), 1, 4, '#b8433a'); r(12, 10 + (step > 0 ? 1 : 0), 1, 4, '#b8433a');
    r(3, 14, 1, 1, '#e8b88a'); r(12, 14, 1, 1, '#e8b88a');
    // Head
    r(5, 4, 6, 5, '#e8b88a');
    if (dir === 'down') { r(6, 6, 1, 1, '#222'); r(9, 6, 1, 1, '#222'); r(7, 8, 2, 1, '#8a5a3a'); }
    else if (dir === 'side') { r(9, 6, 1, 1, '#222'); r(10, 7, 1, 1, '#d8a07a'); }
    else r(5, 6, 6, 3, '#6a4a2a');
    // Bucket hat with a fly stuck in the band
    r(3, 3, 10, 2, '#a89a6a'); r(5, 1, 6, 3, '#bfb07a'); r(5, 3, 6, 1, '#6a5a3a');
    r(10, 2, 1, 1, '#e84a3a');
  },

  drawKeeper() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 20;
    const g = c.getContext('2d');
    const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    r(5, 15, 2, 4, '#4a4058'); r(9, 15, 2, 4, '#4a4058');
    r(4, 9, 8, 7, '#5a7a9a'); r(5, 10, 6, 6, '#d8cfb0'); r(3, 10, 1, 4, '#5a7a9a'); r(12, 10, 1, 4, '#5a7a9a');
    r(5, 3, 6, 6, '#d8a07a'); r(6, 6, 1, 1, '#222'); r(9, 6, 1, 1, '#222'); r(7, 8, 2, 1, '#8a4a3a');
    r(4, 2, 8, 3, '#e8e8e8'); r(4, 4, 1, 4, '#e8e8e8'); r(11, 4, 1, 4, '#e8e8e8');
    r(6, 6, 4, 1, '#333'); // spectacles
    return c;
  },

  buildLures() {
    const mk = (geo, color) => new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    const sphere = new THREE.SphereGeometry(0.07, 10, 8);
    for (const L of LURES) {
      const g = new THREE.Group();
      if (L.id === 'worm') {
        const top = mk(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe83a3a);
        const bot = mk(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xf4f4f4);
        g.add(top, bot);
      } else {
        const body = mk(sphere, new THREE.Color(L.color).getHex());
        body.scale.set(L.id === 'crank' ? 1.8 : 1.4, 0.8, 0.8);
        g.add(body);
        const blade = mk(new THREE.PlaneGeometry(0.16, 0.08), new THREE.Color(L.accent).getHex());
        blade.material.side = THREE.DoubleSide;
        blade.position.x = 0.08;
        blade.name = 'blade';
        g.add(blade);
      }
      g.visible = false;
      this.group.add(g);
      this.lures[L.id] = g;
    }
  },

  fishSilhouette() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 24;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(36, 12, 22, 8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(16, 12); g.lineTo(2, 3); g.lineTo(6, 12); g.lineTo(2, 21); g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c);
    return t;
  },

  portrait(sp) {
    if (!this.portraits[sp.id]) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      Fish.drawPortrait(c.getContext('2d'), sp, 64, 32, 116);
      const tex = new THREE.CanvasTexture(c);
      this.portraits[sp.id] = tex;
    }
    return this.portraits[sp.id];
  },

  ripple(x, y, size = 1) {
    const r = this.ripples.find((q) => q.userData.t >= 1) || this.ripples[0];
    r.userData = { t: 0, size };
    r.position.set(x, 0.03, y);
    r.visible = true;
  },

  // Rod tip in scene space, accounting for loading the cast, lifting, and bend under load.
  rodPoints(p, base) {
    const F = Fishing, ang = F.aim;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const hand = new THREE.Vector3(p.x + dx * 0.25, base + 0.6, p.y + dz * 0.25 + 0.05);
    let tip;
    if (F.state === 'charging') {
      const k = F.power;
      tip = new THREE.Vector3(p.x - dx * 0.9 * k + dx * 0.6 * (1 - k), base + 1.6 + k * 0.6, p.y - dz * 0.9 * k + dz * 0.6 * (1 - k));
    } else {
      const lift = F.state === 'fight' ? Fight.rodLift : 0.5;
      tip = new THREE.Vector3(F.tip.x, base + 0.7 + lift * 1.3 + F.tipBob * 0.25 * Math.sin(Game.time * 40), F.tip.y);
    }
    // Under load the tip bows toward the line.
    const bend = Math.max(0, F.bend);
    if (F.lure && bend > 0) {
      const lp = this.lurePos();
      const to = lp.clone().sub(tip).normalize();
      tip.addScaledVector(to, bend * 0.45).y -= bend * 0.35;
    }
    const ctrl = hand.clone().lerp(F.state === 'charging' ? tip : new THREE.Vector3(F.tip.x, tip.y + bend * 0.3, F.tip.y), 0.6);
    ctrl.y += 0.25;
    return { hand, tip, ctrl };
  },

  lurePos() {
    const l = Fishing.lure;
    if (!l) return new THREE.Vector3();
    let y;
    if (l.h > 0) y = Scene3D.standH(l.x, l.y) + l.h;
    else if (l.inWater) y = l.id === 'worm' || l.id === 'popper' ? 0.02 - (l.dip || 0) * 0.08 : -l.z * SUB;
    else y = Scene3D.groundH(l.x, l.y) + 0.05;
    return new THREE.Vector3(l.x, y, l.y);
  },

  update(dt, env) {
    const p = Player, base = Scene3D.standH(p.x, p.y);
    // Player frame: direction from facing angle, walk cycle from distance.
    const a = p.face;
    const dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'side' : Math.sin(a) > 0 ? 'down' : 'up';
    const frame = p.moving ? (Math.floor(p.walkT * 8) % 4) : 0;
    this.player.material.map = this.frames[dir + frame];
    this.player.scale.x = dir === 'side' && Math.cos(a) < 0 ? -1 : 1;
    this.player.position.set(p.x, base + (p.moving ? Math.abs(Math.sin(p.walkT * 8 * Math.PI / 2)) * 0.04 : 0), p.y);
    this.ghost.material.map = this.player.material.map;
    this.ghost.position.copy(this.player.position); this.ghost.scale.copy(this.player.scale);
    // While wading the shadow becomes a foam ring at the waterline.
    this.playerShadow.position.set(p.x, p.wading ? 0.03 : Math.max(base, 0.01) + 0.015, p.y);
    this.playerShadow.material.color.set(p.wading ? 0xeaf6f4 : 0x000000);
    this.playerShadow.material.opacity = p.wading ? 0.55 : 0.28;
    this.playerShadow.scale.setScalar(p.wading ? 1.25 + Math.sin(Game.time * 3) * 0.06 : 1);
    this.keeper.position.set(World.shopkeeper.x, Scene3D.standH(World.shopkeeper.x, World.shopkeeper.y), World.shopkeeper.y);
    Scene3D.lantern.position.set(p.x, base + 1.4, p.y);

    // Rod
    const { hand, tip, ctrl } = this.rodPoints(p, base);
    this.rod.geometry.setFromPoints(new THREE.QuadraticBezierCurve3(hand, ctrl, tip).getPoints(12));
    this.rod.material.color.set(Game.gear.rod.color);
    this.rod.visible = !Gun.out; // rod goes on your back while the shotgun's out
    this.tipScene = tip;

    // Aim ring: red crosshair for the shotgun, gold landing marker for casts.
    const charging = Fishing.state === 'charging';
    const aiming = !Menus.open && (Gun.out || charging || (Fishing.state === 'idle' && World.isWater(Input.mouse.wx, Input.mouse.wy)));
    this.aimRing.visible = aiming;
    if (aiming) {
      let ax, ay;
      if (Gun.out) ({ x: ax, y: ay } = Gun.aimPoint());
      else {
        const ca = Math.atan2(Input.mouse.wy - p.y, Input.mouse.wx - p.x);
        const d = Fishing.castDistance(charging ? Fishing.power : 1);
        ax = Fishing.tip.x + Math.cos(ca) * d; ay = Fishing.tip.y + Math.sin(ca) * d;
      }
      this.aimRing.position.set(ax, Math.max(0, Scene3D.groundH(ax, ay)) + 0.04, ay);
      const s = Gun.out ? 1.6 : 1 + Math.sin(Game.time * 6) * 0.08;
      this.aimRing.scale.set(s, 1, s);
      this.aimRing.material.color.set(Gun.out ? 0xe2584d : charging && Fishing.power > 0.9 ? 0x8fd16a : 0xf2c14e);
      this.aimRing.material.opacity = Gun.out || charging ? 0.9 : 0.4;
    }

    // Line + lure
    const l = Fishing.lure;
    for (const id in this.lures) this.lures[id].visible = false;
    if (l) {
      const lp = this.lurePos();
      const d = U.dist(Fishing.tip.x, Fishing.tip.y, l.x, l.y);
      const slack = Math.max(0, Fishing.lineOut - d);
      const tension = Fishing.state === 'fight' ? Fight.tension / Game.gear.line.strength : 0;
      const sag = Fishing.state === 'flying' ? 0.15 : Math.min(1.8, slack * 0.35 + 0.08) * (1 - Math.min(1, tension));
      const mid = tip.clone().lerp(lp, 0.5); mid.y -= sag;
      if (lp.y < 0) mid.y = Math.max(mid.y, lp.y * 0.3);
      this.line.geometry.setFromPoints(new THREE.QuadraticBezierCurve3(tip, mid, lp).getPoints(24));
      this.line.material.color.set(Game.gear.line.id.startsWith('braid') ? 0x58c85a : 0xf0f0f0);
      this.line.visible = true;
      const g = this.lures[l.id];
      g.visible = true;
      g.position.copy(lp);
      g.rotation.y = -Math.atan2(l.vy, l.vx);
      const blade = g.getObjectByName('blade');
      if (blade) blade.rotation.x = l.id === 'spinner' && l.action > 0.4 ? Game.time * 30 : l.id === 'spoon' ? Math.sin(Game.time * 9) * l.action : 0;
    } else {
      // Lure dangles just under the tip.
      this.line.geometry.setFromPoints([tip, tip.clone().add(new THREE.Vector3(0, -0.3, 0))]);
      const g = this.lures[Fishing.lureId];
      g.visible = true; g.position.copy(tip).y -= 0.3;
    }

    if (Gun.out) { this.line.visible = false; for (const id in this.lures) this.lures[id].visible = false; }
    else this.line.visible = true;

    // Fish under the surface.
    let n = 0;
    this.jumpMesh.visible = false;
    for (const f of Fish.list) {
      if (f.airborne) {
        const jm = this.jumpMesh;
        if (jm.material.map !== this.portrait(f.sp)) { jm.material.map = this.portrait(f.sp); jm.material.needsUpdate = true; }
        const len = Math.max(0.35, f.cm / 100) * 1.3;
        jm.scale.set(len, len, 1);
        jm.position.set(f.x, f.airH, f.y);
        jm.rotation.set(-BILLBOARD_LEAN, 0, f.airSpin);
        jm.visible = true;
        continue;
      }
      const m = this.fishPool[n++];
      if (!m) break;
      const len = Math.max(0.25, f.cm / 100);
      const near = f.state === 'hooked';
      m.visible = true;
      m.position.set(f.x, -Math.min(f.z, 4) * SUB - 0.03, f.y);
      m.rotation.y = -f.heading;
      m.scale.set(len * (1 + Math.sin(f.wig) * 0.05), 1, len);
      m.material.color.set(f.prized ? (Math.sin(Game.time * 4 + f.wig) > 0.4 ? 0xd9b44a : 0x8a6a1e) : near ? f.sp.color : 0x0d2430);
      m.material.opacity = (near ? U.clamp(1 - f.z * 0.12, 0.55, 0.95) : U.clamp(0.75 - f.z * 0.1, 0.12, 0.75)) * env.visibility * Math.max(0, f.alpha);
    }
    for (; n < this.fishPool.length; n++) this.fishPool[n].visible = false;

    for (const r of this.ripples) {
      if (r.userData.t >= 1) { r.visible = false; continue; }
      r.userData.t += dt / (0.9 + r.userData.size * 0.4);
      const s = 0.1 + r.userData.t * r.userData.size * 0.9;
      r.scale.set(s, 1, s);
      r.material.opacity = (1 - r.userData.t) * 0.7;
    }
  },
};
