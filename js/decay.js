// The township slowly goes to seed: graffiti, rubbish, boarded windows, smashed-up roofs — and fewer
// bikes about. It happens a little every day, and a lot while you're locked up for months or years.
// Fix buildings up (or bin the rubbish) and the council pays you for it.
'use strict';

const TAGS = ['TROUT GANG', 'DAZZA', 'BRAAAP', 'TIM 4EVA', 'NO FISH', 'LOL', 'GTA VI', 'ZORK', 'RIP SILVERJAW', 'BUNYIP IS REAL', 'KEV WOZ ERE', '>:)'];
const TAG_COLS = ['#E2584D', '#3AD2B0', '#F2C14E', '#B85AE2', '#4AA8F2', '#F4F0E6', '#7FE04A'];

const Decay = {
  group: null, dirty: true, tex: {},

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    this.dirty = true;
  },

  state() { return (Game.decay = Game.decay || { b: {}, rubbish: [] }); },
  dmg(i) { return this.state().b[i] || 0; },
  // 0..1 — how run-down the township is overall.
  level() {
    const bs = World.buildings; if (!bs.length) return 0;
    let s = 0; bs.forEach((b, i) => { s += this.dmg(i); }); return s / bs.length;
  },
  // Fewer people can be bothered riding round a dump.
  riderCap() { return Math.max(1, 4 - Math.round(this.level() * 3)); },

  // Let `days` pass. Time inside (served) hits the town much harder.
  age(days, served) {
    const st = this.state();
    World.buildings.forEach((b, i) => {
      const rate = (served ? 0.0028 : 0.0035) * (0.4 + Math.random() * 1.2) * (b.type === 'house' ? 1 : 0.85);
      st.b[i] = Math.min(1, (st.b[i] || 0) + rate * days);
    });
    const n = Math.min(70 - st.rubbish.length, Math.round(days * (served ? 0.12 : 0) + (Math.random() < Math.min(1, days * 0.8) ? 1 : 0)));
    for (let k = 0; k < n; k++) this.dropRubbish();
    this.dirty = true;
  },

  dropRubbish() {
    const st = this.state();
    for (let t = 0; t < 20; t++) {
      // Mostly around the main street, some by the cottages.
      let x, y;
      if (Math.random() < 0.65) { x = World.town.x + (Math.random() - 0.5) * 22; y = World.town.y - 4 + Math.random() * 26; }
      else { const h = World.houses[(Math.random() * World.houses.length) | 0]; if (!h) continue; const d = World.doorOf(h); x = d.x + (Math.random() - 0.5) * 6; y = d.y + Math.random() * 3; }
      if (World.blocked(x, y) || World.isWater(x, y) || World.buildingAt(x, y)) continue;
      st.rubbish.push({ x, y, kind: U.pick(Math.random, ['bag', 'bag', 'can', 'tyre', 'paper', 'can']), r: Math.random() * 6 });
      return;
    }
  },

  tagTex(text) {
    if (this.tex[text]) return this.tex[text];
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const g = c.getContext('2d'), col = U.pick(Math.random, TAG_COLS);
    g.font = 'italic 900 46px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = 'rgba(20,14,10,0.9)'; g.strokeText(text, 128, 50);
    g.fillStyle = col; g.fillText(text, 128, 48);
    g.fillStyle = col; for (let k = 0; k < 6; k++) g.fillRect(40 + Math.random() * 176, 62 + Math.random() * 8, 3, 8 + Math.random() * 18); // drips
    return (this.tex[text] = new THREE.CanvasTexture(c));
  },

  build() {
    this.dirty = false;
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    const P = (geo, c, o = 0.04) => Models.part(geo, c, o);
    World.buildings.forEach((b, i) => {
      const d = this.dmg(i); if (d < 0.15) return;
      const house = b.type === 'house', W = World.frontLen(b), D = World.depthOf(b), wallH = house ? 1.7 : 2.1;
      const g = new THREE.Group(), rnd = U.mulberry32(i * 7919 + 13);
      // Graffiti tags on the front wall.
      const tags = Math.min(4, Math.floor(d * 5));
      for (let k = 0; k < tags; k++) {
        const w = 0.9 + rnd() * 0.8;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), new THREE.MeshBasicMaterial({ map: this.tagTex(TAGS[(rnd() * TAGS.length) | 0]), transparent: true, depthWrite: false }));
        m.position.set(0.5 + rnd() * Math.max(0.1, W - 1), 0.4 + rnd() * (wallH - 0.9), D + 0.03 + k * 0.004);
        m.rotation.z = (rnd() - 0.5) * 0.25; g.add(m);
      }
      // Smashed window boarded over.
      if (d > 0.45) {
        const wx = W - 1.3, wy = house ? 1.0 : 1.25;
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.72), new THREE.MeshBasicMaterial({ color: 0x15130F })); glass.position.set(wx, wy, D + 0.02); g.add(glass);
        for (const a of [0.55, -0.55]) { const p = P(new THREE.BoxGeometry(1.15, 0.14, 0.04), '#9A7A4A'); p.position.set(wx, wy, D + 0.06); p.rotation.z = a; g.add(p); }
      }
      // Door boarded up.
      if (d > 0.62) for (const yy of [0.35, 0.75, 1.1]) { const p = P(new THREE.BoxGeometry(1.0, 0.13, 0.04), '#8A6A3A'); p.position.set(0.9, yy, D + 0.05); p.rotation.z = (rnd() - 0.5) * 0.3; g.add(p); }
      // Caved-in roof and rubble.
      if (d > 0.78) {
        const hole = P(new THREE.BoxGeometry(W * 0.35, 0.06, D * 0.4), '#1A1612', 0); hole.position.set(W * (0.25 + rnd() * 0.4), wallH + (house ? 0.75 : 0.9), D * 0.45); hole.rotation.z = 0.5; g.add(hole);
        for (let k = 0; k < 5; k++) { const r = P(new THREE.DodecahedronGeometry(0.12 + rnd() * 0.12, 0), U.pick(rnd, ['#8A8478', '#6A645A', '#9A7A4A'])); r.position.set(W + 0.2 + rnd() * 0.6, 0.08, D * rnd()); g.add(r); }
      }
      const rot = { south: 0, east: Math.PI / 2, west: -Math.PI / 2, north: Math.PI }[b.face || 'south'];
      const o = World.localToWorld(b, 0, 0);
      g.rotation.y = rot; g.position.set(o.x, Math.max(Scene3D.groundH(b.x + b.w / 2, b.y + b.h / 2), 0.1), o.y);
      this.group.add(g);
    });
    // Rubbish.
    for (const r of this.state().rubbish) {
      let m;
      if (r.kind === 'bag') { m = P(new THREE.SphereGeometry(0.22, 8, 6), '#1E1E22'); m.scale.set(1, 0.8, 1); m.position.y = 0.16; }
      else if (r.kind === 'can') { m = P(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), U.pick(Math.random, ['#D23A3A', '#3A8AD2', '#7FC483'])); m.rotation.z = Math.PI / 2; m.position.y = 0.05; }
      else if (r.kind === 'tyre') { m = P(new THREE.TorusGeometry(0.22, 0.08, 6, 14), '#1A1A1C'); m.rotation.x = Math.PI / 2; m.position.y = 0.08; }
      else { m = P(new THREE.BoxGeometry(0.3, 0.01, 0.22), '#ECE6D4', 0.1); m.position.y = 0.02; }
      const w = new THREE.Group(); w.add(m); w.rotation.y = r.r;
      w.position.set(r.x, Scene3D.groundH(r.x, r.y), r.y);
      r.mesh = w; this.group.add(w);
    }
  },

  render() {
    if (this.dirty) this.build();
    if (this.group) this.group.visible = !Interior.active;
  },

  reward(d) { return Math.round(30 + d * 140); },

  // E-key: fix up a run-down building, or bin a bit of rubbish.
  interactions(cands) {
    World.buildings.forEach((b, i) => {
      const d = this.dmg(i); if (d < 0.2) return;
      const p = World.localToWorld(b, World.frontLen(b) - 0.5, World.depthOf(b) + 0.9), dist = U.dist(p.x, p.y, Player.x, Player.y);
      if (dist < 1.8) cands.push({ d: dist + 0.4, x: p.x, y: p.y, label: 'Fix up ' + (b.name || 'the building') + ' — council pays ' + U.fmtMoney(this.reward(d)), run: () => this.repair(i) });
    });
    const st = this.state();
    let best = null, bd = 1.3;
    for (const r of st.rubbish) { const dd = U.dist(r.x, r.y, Player.x, Player.y); if (dd < bd) { bd = dd; best = r; } }
    if (best) cands.push({ d: bd, x: best.x, y: best.y, label: 'Bin the rubbish (+$3)', run: () => this.binIt(best) });
  },

  repair(i) {
    const d = this.dmg(i), pay = this.reward(d), b = World.buildings[i];
    const hours = 1 + d * 3;
    Life.passHours(hours, 2);
    this.state().b[i] = 0; this.dirty = true;
    Game.money += pay; Sfx.coin(); Sfx.thunk();
    Hud.toast('You spent ' + hours.toFixed(1) + 'h scrubbing tags, boarding up and patching ' + (b.name || 'the place') + '. The council pays ' + U.fmtMoney(pay) + '.', UI.good, 3.2);
    Game.save();
  },

  binIt(r) {
    const st = this.state();
    st.rubbish.splice(st.rubbish.indexOf(r), 1);
    Game.money += 3; Sfx.tone(300, 0.06, 0.15, 'triangle', 200);
    this.dirty = true; Game.save();
  },

  describe() {
    const l = this.level();
    return l < 0.15 ? 'spick and span' : l < 0.35 ? 'a bit tatty' : l < 0.6 ? 'run-down' : l < 0.8 ? 'a proper dump' : 'practically derelict';
  },
};
