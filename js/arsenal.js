// The arsenal: every gun the angler can own, their models, ammo and how they fire.
'use strict';

const WEAPONS = [
  { id: 'rifle', name: 'Hunting rifle', short: 'Rifle', ammo: 'rifle', cd: 1.1, scope: true, spread: 0.4, pellets: 1, range: 25, price: 0, seller: 'start' },
  { id: 'pistol', name: 'Pistol', short: 'Pistol', ammo: 'light', cd: 0.32, spread: 0.55, pellets: 1, range: 18, price: 150, seller: 'hettie' },
  { id: 'shotgun', name: 'Pump shotgun', short: 'Shotgun', ammo: 'shells', cd: 0.95, spread: 1.4, pellets: 7, range: 13, price: 280, seller: 'hettie' },
  { id: 'smg', name: 'SMG', short: 'SMG', ammo: 'light', cd: 0.085, spread: 0.9, pellets: 1, range: 20, auto: true, price: 650, seller: 'dusty' },
  { id: 'launcher', name: 'Rocket launcher', short: 'Launcher', ammo: 'rockets', cd: 2.2, spread: 0.3, pellets: 1, range: 35, blast: 3.2, price: 1600, seller: 'dusty' },
];
const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
const AMMO = {
  rifle: { name: 'Rifle rounds', pack: 10, price: 12, seller: 'hettie' },
  light: { name: 'Light rounds', pack: 30, price: 15, seller: 'hettie' },
  shells: { name: 'Shotgun shells', pack: 12, price: 14, seller: 'hettie' },
  rockets: { name: 'Rockets', pack: 2, price: 120, seller: 'dusty' },
};

const Arsenal = {
  models: {},

  weapon() { return WEAPON_BY_ID[Game.weapon] || WEAPONS[0]; },
  ammo(type) { return type === 'rifle' ? Game.ammo || 0 : (Game.ammoX || {})[type] || 0; },
  useAmmo(type) { if (type === 'rifle') Game.ammo--; else Game.ammoX[type]--; },
  addAmmo(type, n) { if (type === 'rifle') Game.ammo = (Game.ammo || 0) + n; else Game.ammoX[type] = (Game.ammoX[type] || 0) + n; },

  // Cycle to the next owned gun. Returns false when we've gone past the last one (put it away).
  cycle() {
    const owned = WEAPONS.filter((w) => Game.guns.includes(w.id));
    const i = owned.findIndex((w) => w.id === Game.weapon);
    if (i < 0 || i >= owned.length - 1) { Game.weapon = owned[0].id; return false; }
    Game.weapon = owned[i + 1].id;
    return true;
  },

  // ---------- models (all point along +x, grip at the origin) ----------
  build() {
    const P = (geo, c, o = 0.12) => Models.part(geo, c, o), B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    const C = (r, l, s = 10) => new THREE.CylinderGeometry(r, r, l, s).rotateZ(Math.PI / 2);
    const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
    const steel = '#23262B', wood = '#6B3E1F', black = '#1A1A1C';
    const pistol = new THREE.Group();
    pistol.add(at(P(B(0.24, 0.07, 0.05), steel), 0.08, 0.05, 0));
    const pg = P(B(0.07, 0.14, 0.05), black); pg.position.set(-0.01, -0.03, 0); pg.rotation.z = 0.25; pistol.add(pg);
    const shotgun = new THREE.Group();
    for (const z of [-0.022, 0.022]) { const b = P(C(0.02, 0.7), steel); b.position.set(0.38, 0.06, z); shotgun.add(b); }
    shotgun.add(at(P(B(0.4, 0.09, 0.07), wood), -0.12, 0.03, 0));
    shotgun.add(at(P(B(0.18, 0.06, 0.07), wood), 0.28, 0.02, 0)); // pump
    const smg = new THREE.Group();
    smg.add(at(P(B(0.36, 0.1, 0.07), black), 0.1, 0.05, 0));
    smg.add(at(P(C(0.018, 0.2), steel), 0.36, 0.06, 0));
    const mag = P(B(0.05, 0.18, 0.04), steel); mag.position.set(0.12, -0.08, 0); smg.add(mag);
    smg.add(at(P(B(0.06, 0.12, 0.05), black), -0.02, -0.04, 0));
    const launcher = new THREE.Group();
    launcher.add(at(P(C(0.07, 1.0, 14), '#4A5A2A', 0.06), 0.2, 0.13, 0));
    const muzzle = P(C(0.085, 0.12, 14), '#2A2A2A', 0.06); muzzle.position.set(0.72, 0.13, 0); launcher.add(muzzle);
    launcher.add(at(P(B(0.07, 0.14, 0.05), black), 0, 0.02, 0));
    const sight = P(B(0.08, 0.06, 0.03), '#2A2A2A'); sight.position.set(0.1, 0.24, 0.05); launcher.add(sight);
    this.models = { rifle: Gun.mesh, pistol, shotgun, smg, launcher };
    for (const id of ['pistol', 'shotgun', 'smg', 'launcher']) { const m = this.models[id]; m.scale.setScalar(1.25); m.visible = false; Scene3D.scene.add(m); }
    // A pool of explosion fireballs.
    this.booms = Array.from({ length: 3 }, () => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFB13B, transparent: true, depthWrite: false }));
      s.visible = false; s.userData.t = 1; Scene3D.scene.add(s); return s;
    });
  },

  explode(x, y, r) {
    const b = this.booms.find((q) => q.userData.t >= 1) || this.booms[0];
    b.position.set(x, Scene3D.standH(x, y) + 0.4, y); b.userData = { t: 0, r }; b.visible = true;
    Sfx.tone(55, 0.9, 0.7, 'triangle', 25); Sfx.burst(1.4, 1800, 0.9, 'lowpass', 0.6, 80);
    Bugs.shake = 1;
    if (World.isWater(x, y)) { Hud.ripple(x, y, 3); Sfx.splash(1.5); }
    // Knock out everyone in the blast; game and fish too.
    for (const t of Wanted.targets()) if (U.dist(t.x, t.y, x, y) < r) Wanted.knockOut(t, 1.3, true);
    Bikes.blast(x, y, r * 0.9);
    (Wanted.rap = Wanted.rap || { ko: 0, cops: 0, booms: 0, thefts: 0 }).booms++;
    for (const an of Animals.list.slice()) if (an.state !== 'dead' && U.dist(an.x, an.y, x, y) < r) Animals.shotAt(an.x, an.y, true);
    for (const f of Fish.list.slice()) if (f.state !== 'hooked' && !f.sp.myth && U.dist(f.x, f.y, x, y) < r && f.z < 2.5) Gun.kill(f);
    if (U.dist(x, y, Player.x, Player.y) < r * 0.8) Wanted.hurt(35, 'an explosion');
    Wanted.crime(1);
  },

  render(dt) {
    for (const b of this.booms) {
      if (b.userData.t >= 1) { b.visible = false; continue; }
      b.userData.t += dt / 0.6;
      const k = b.userData.t;
      b.scale.setScalar(b.userData.r * (0.3 + k * 0.8));
      b.material.opacity = 1 - k;
      b.material.color.setHSL(0.09 - k * 0.07, 1, 0.6 - k * 0.3);
    }
  },

  // Armoury section shared by Hettie (legal) and Dusty (under the counter).
  shopHtml(seller) {
    const guns = WEAPONS.filter((w) => w.seller === seller).map((w) => {
      const own = Game.guns.includes(w.id);
      return `<div class="row"><div><b>${w.name}</b><div class="desc">${this.blurb(w)} · uses ${AMMO[w.ammo].name.toLowerCase()}</div></div>
        ${own ? '<span class="owned">✓ Owned</span>' : `<button class="primary" data-gun="${w.id}" ${Game.money < w.price ? 'disabled' : ''}>Buy ${U.fmtMoney(w.price)}</button>`}</div>`;
    }).join('');
    const ammo = Object.entries(AMMO).filter(([, a]) => a.seller === seller).map(([k, a]) =>
      `<div class="row"><div><b>${a.name} ×${a.pack}</b> <span class="desc">(have ${this.ammo(k)})</span></div>
        <button data-ammo="${k}" ${Game.money < a.price ? 'disabled' : ''}>${U.fmtMoney(a.price)}</button></div>`).join('');
    return `<h3>${seller === 'dusty' ? 'Under the counter' : 'Firearms'}</h3>${guns}<h3>Ammunition</h3>${ammo}`;
  },

  blurb(w) {
    return { rifle: 'Scoped and precise', pistol: 'Quick and handy', shotgun: '7-pellet spread, close range', smg: 'Hold to spray', launcher: 'Big boom. Big trouble.' }[w.id];
  },

  wireShop(el, rerender) {
    el.querySelectorAll('[data-gun]').forEach((b) => { b.onclick = () => {
      const w = WEAPON_BY_ID[b.dataset.gun];
      Game.money -= w.price; Game.guns.push(w.id); Game.weapon = w.id;
      if (!this.ammo(w.ammo)) this.addAmmo(w.ammo, AMMO[w.ammo].pack);
      Sfx.coin(); Hud.toast(w.name + ' is yours (with a starter box of ammo). Press 2 to cycle guns.', UI.good, 2.6);
      Game.save(); rerender();
    }; });
    el.querySelectorAll('[data-ammo]').forEach((b) => { b.onclick = () => {
      const a = AMMO[b.dataset.ammo];
      Game.money -= a.price; this.addAmmo(b.dataset.ammo, a.pack); Sfx.coin(); Game.save(); rerender();
    }; });
  },
};
