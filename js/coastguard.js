// The Coast Guard: a fast orange patrol boat that launches when you're out on the water in a stolen boat that's
// been reported, wanted, or fishing without a permit from a boat. Get caught alongside and you're nicked;
// outrun it (a jetski can) or get ashore — though running from them on land just hands you to the wardens.
'use strict';

const CG_PAL = { hat: '#E8742A', hatStyle: 'cap', shirt: '#1E2E4A', pants: '#1E2E4A', skin: '#C8946A', hair: '#2A1E14', badge: true, shoes: '#1A1A1C' };

const CoastGuard = {
  boat: null, group: null, illegalT: 0, sirenT: 0,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    this.boat = null; this.illegalT = 0;
  },

  model() {
    const g = new THREE.Group(), P = (geo, c, o = 0.05) => Models.part(geo, c, o);
    const hull = P(new THREE.BoxGeometry(2.4, 0.3, 1.0), '#E8742A'); hull.position.y = 0.12; g.add(hull);
    const nose = P(new THREE.ConeGeometry(0.5, 0.6, 4), '#E8742A'); nose.rotation.z = -Math.PI / 2; nose.rotation.x = Math.PI / 4; nose.scale.set(1, 1, 0.75); nose.position.set(1.48, 0.12, 0); g.add(nose);
    for (const z of [-0.55, 0.55]) { const tube = P(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 10), '#3A3E44'); tube.rotation.z = Math.PI / 2; tube.position.set(0, 0.2, z); g.add(tube); }
    const deck = P(new THREE.BoxGeometry(2.2, 0.04, 0.9), '#D8D4CC', 0.02); deck.position.y = 0.29; g.add(deck);
    const consoleB = P(new THREE.BoxGeometry(0.4, 0.5, 0.5), '#F4F0E6'); consoleB.position.set(0.2, 0.55, 0); g.add(consoleB);
    const screen = P(new THREE.BoxGeometry(0.05, 0.25, 0.42), '#2A3A4A', 0.02); screen.position.set(0.42, 0.85, 0); screen.rotation.z = -0.3; g.add(screen);
    const mast = P(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), '#D8D4CC'); mast.position.set(-0.3, 0.75, 0); g.add(mast);
    this.lights = [];
    for (const [z, c] of [[-0.14, 0x3A6AFF], [0.14, 0xFF3A3A]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.14), new THREE.MeshBasicMaterial({ color: c })); m.position.set(-0.3, 1.22, z); g.add(m); this.lights.push(m);
    }
    const stripe = P(new THREE.BoxGeometry(1.4, 0.08, 1.02), '#F4F0E6', 0); stripe.position.set(-0.2, 0.2, 0); g.add(stripe);
    const officer = Models.person(CG_PAL); officer.position.set(-0.1, 0.3, 0); g.add(officer);
    return { g, officer };
  },

  // Somewhere on the same water about 25-40 m away by boat, so they have to come and get you.
  launchSpot() {
    const sx = Math.floor(Player.x), sy = Math.floor(Player.y), seen = new Uint8Array(World.W * World.H), q = [[sx, sy, 0]];
    seen[World.idx(sx, sy)] = 1;
    let best = null;
    for (let h = 0; h < q.length && h < 40000; h++) {
      const [x, y, d] = q[h];
      if (d >= 25 && Boats.floats(x + 0.5, y + 0.5)) { best = { x: x + 0.5, y: y + 0.5 }; if (d >= 32 || Math.random() < 0.05) break; }
      if (d > 45) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!World.inB(nx, ny) || seen[World.idx(nx, ny)] || !World.isWater(nx + 0.5, ny + 0.5)) continue;
        seen[World.idx(nx, ny)] = 1; q.push([nx, ny, d + 1]);
      }
    }
    return best;
  },

  launch(reason) {
    if (this.boat) { if (!this.boat.reasons.includes(reason)) this.boat.reasons.push(reason); return; }
    const s = this.launchSpot(); if (!s) return;
    const { g, officer } = this.model();
    this.group.add(g);
    this.boat = { x: s.x, y: s.y, ang: Math.atan2(Player.y - s.y, Player.x - s.x), g, officer, reasons: [reason], t: 0, lost: 0, ashore: 0, vel: 0 };
    Hud.toast('🚨 The Coast Guard is coming for you — ' + reason.toLowerCase() + '!', UI.bad, 3.2);
    Sfx.tone(1200, 0.2, 0.2, 'square'); setTimeout(() => Sfx.tone(900, 0.2, 0.2, 'square'), 220);
  },

  stand(msg, color) {
    if (!this.boat) return;
    this.group.remove(this.boat.g); this.boat = null;
    if (msg) Hud.toast(msg, color || UI.good, 2.6);
  },

  update(dt) {
    const B = Boats.riding;
    // ---- what brings them out ----
    if (B) {
      if (B.stolen && B.reportAt !== undefined && Game.time >= B.reportAt) this.launch('Boat theft (' + B.owner + '\'s ' + BOAT_TYPES[B.type].name.toLowerCase() + ')');
      if (Wanted.level > 0 && !this.boat) this.launch('Wanted on the water');
      const zone = Permits.fishingIllegally();
      if (zone) {
        this.illegalT += dt;
        if (this.illegalT > 6 && Math.random() < dt * 0.25) this.launch('Fishing without a ' + Permits.name(zone));
      } else this.illegalT = Math.max(0, this.illegalT - dt * 0.5);
    }
    const c = this.boat; if (!c) return;
    c.t += dt;
    const d = U.dist(c.x, c.y, Player.x, Player.y);
    // ---- the chase ----
    if (B) {
      c.ashore = 0;
      if (d < 1.9 && !Player.airborne) {
        const why = c.reasons.slice();
        this.stand(null);
        Hud.toast('The Coast Guard pulls alongside and cuffs you.', UI.bad, 2.4);
        return Jail.sentence(why);
      }
      c.lost = d > 55 ? c.lost + dt : 0;
      if (c.lost > 12 || c.t > 180) return this.stand('You lost the Coast Guard.', UI.good);
    } else {
      // You made it ashore: they radio it in and idle off the shore before heading home.
      if (c.ashore === 0) { Wanted.crime(1); Hud.toast('The Coast Guard radios the wardens — you\'re wanted ashore.', UI.bad, 2.6); }
      c.ashore += dt;
      if (c.ashore > 15) return this.stand(null);
    }
    // Steer straight at you, sidestepping around land.
    const top = B ? 8.2 : 2;
    c.vel = U.lerp(c.vel, d > 2.5 || !B ? top : 1.5, Math.min(1, dt * 1.2));
    const base = Math.atan2(Player.y - c.y, Player.x - c.x);
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4]) {
      const a = base + off, nx = c.x + Math.cos(a) * c.vel * dt, ny = c.y + Math.sin(a) * c.vel * dt;
      if (Boats.floats(nx, ny) && (d > 3 || !B || U.dist(nx, ny, Player.x, Player.y) > 0.5)) { c.x = nx; c.y = ny; c.ang = U.lerp(c.ang, a, Math.min(1, dt * 6)); break; }
    }
    if (c.vel > 3 && Math.random() < dt * 10) Hud.ripple(c.x - Math.cos(c.ang) * 1.2, c.y - Math.sin(c.ang) * 1.2, 0.6);
    if (c.vel > 2) Fish.spookNear(c.x, c.y, 8);
    // Siren and lights.
    c.g.visible = !Interior.active;
    c.g.position.set(c.x, 0.02 + Math.sin(Game.time * 1.7 + c.x) * 0.03, c.y);
    c.g.rotation.set(0, -c.ang, -c.vel * 0.01);
    const flip = Math.floor(Game.time * 4) % 2;
    this.lights[0].visible = !!flip; this.lights[1].visible = !flip;
    Models.pose(c.officer.userData.rig, { pose: 'normal', t: Game.time });
    this.sirenT -= dt;
    if (this.sirenT <= 0 && d < 45 && B) { this.sirenT = 0.9; Sfx.tone(flip ? 760 : 980, 0.35, 0.12 * U.clamp(1 - d / 45, 0.2, 1), 'sine'); }
  },
};
