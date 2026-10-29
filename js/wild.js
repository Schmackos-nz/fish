// The wilder side of the valley: mushrooms to forage (some deadly), snakes in the forest, ducks on the
// water, hi-vis hunters stalking deer, poison, and the clinic that patches you up.
'use strict';

// ---------- mushrooms ----------
const SHROOMS = [
  { id: 'button', look: 'White mushroom', name: 'Field mushroom', cap: '#F4EEE4', stem: '#EDE6D8', food: 10, w: 0.3 },
  { id: 'chanterelle', look: 'Golden mushroom', name: 'Chanterelle', cap: '#E8A93A', stem: '#E0A040', food: 16, w: 0.2, funnel: true },
  { id: 'porcini', look: 'Brown mushroom', name: 'Porcini', cap: '#8A5A30', stem: '#E8DCC0', food: 20, w: 0.15, fat: true },
  { id: 'deathcap', look: 'White mushroom', name: 'Death cap', cap: '#E2E8D2', stem: '#F2F2EA', food: 4, w: 0.2, poison: 1 },
  { id: 'flyagaric', look: 'Red spotted mushroom', name: 'Fly agaric', cap: '#D8302A', stem: '#F2EEE4', food: 4, w: 0.15, poison: 0.5, dots: true },
];
const SHROOM_BY_ID = Object.fromEntries(SHROOMS.map((s) => [s.id, s]));

const Forage = {
  shown: new Map(), cx: -1e9, cy: -1e9, group: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    this.shown.clear(); this.cx = this.cy = -1e9;
  },

  // Which mushroom (if any) grows on this tile today. Deterministic, so they don't flicker in and out.
  at(x, y) {
    const i = World.idx(x, y), t = World.tile[i];
    if ((t !== T.FOREST && t !== T.MEADOW) || World.obj[i] !== O.NONE) return null;
    if (U.hash2(x, y, World.seed + Game.env.day * 31) > (t === T.FOREST ? 0.02 : 0.006)) return null;
    if ((Game.picked || {})[i] === Game.env.day) return null;
    const r = U.hash2(x, y, World.seed + Game.env.day * 17 + 5);
    let acc = 0;
    for (const s of SHROOMS) { acc += s.w; if (r < acc) return s; }
    return SHROOMS[0];
  },

  mesh(s) {
    const g = new THREE.Group(), P = (geo, c, o = 0.06) => Models.part(geo, c, o);
    const stem = P(new THREE.CylinderGeometry(s.fat ? 0.07 : 0.04, s.fat ? 0.09 : 0.05, 0.16, 8), s.stem); stem.position.y = 0.08; g.add(stem);
    const cap = s.funnel ? P(new THREE.ConeGeometry(0.13, 0.1, 10, 1, true).rotateX(Math.PI), s.cap) : P(new THREE.SphereGeometry(s.fat ? 0.15 : 0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), s.cap);
    cap.position.y = 0.15; g.add(cap);
    if (s.dots) for (let k = 0; k < 5; k++) { const d = P(new THREE.SphereGeometry(0.02, 6, 4), '#FFFFFF', 0); const a = k * 1.3; d.position.set(Math.cos(a) * 0.08, 0.24, Math.sin(a) * 0.08); g.add(d); }
    g.scale.setScalar(1.3);
    return g;
  },

  update() {
    if (Interior.active) { this.group.visible = false; return; }
    this.group.visible = true;
    const px = Math.floor(Player.x), py = Math.floor(Player.y);
    if (Math.abs(px - this.cx) + Math.abs(py - this.cy) < 5 && this.day === Game.env.day) return;
    this.cx = px; this.cy = py; this.day = Game.env.day;
    const R = 26, keep = new Set();
    for (let y = py - R; y <= py + R; y++) for (let x = px - R; x <= px + R; x++) {
      if (!World.inB(x, y)) continue;
      const s = this.at(x, y); if (!s) continue;
      const i = World.idx(x, y); keep.add(i);
      if (this.shown.has(i)) continue;
      const m = this.mesh(s), mx = x + 0.3 + U.hash2(x, y, 3) * 0.4, my = y + 0.3 + U.hash2(x, y, 4) * 0.4;
      m.position.set(mx, Scene3D.groundH(mx, my), my); m.rotation.y = U.hash2(x, y, 9) * 6;
      this.group.add(m);
      this.shown.set(i, { m, s, x: mx, y: my, i });
    }
    for (const [i, e] of this.shown) if (!keep.has(i)) { this.group.remove(e.m); this.shown.delete(i); }
  },

  nearest(r = 1.3) {
    let best = null, bd = r;
    for (const e of this.shown.values()) { const d = U.dist(e.x, e.y, Player.x, Player.y); if (d < bd) { bd = d; best = e; } }
    return best;
  },

  pick(e) {
    (Game.picked = Game.picked || {})[e.i] = Game.env.day;
    this.group.remove(e.m); this.shown.delete(e.i);
    Game.pantry.push({ name: e.s.look, energy: e.s.food, shroom: e.s.id });
    Sfx.tone(520, 0.06, 0.1, 'triangle', 700);
    Hud.toast('Picked a ' + e.s.look.toLowerCase() + '. Eat it from your bag (I)… if you\'re feeling lucky.', UI.accent, 2.2);
    Game.save();
  },

  // Called when a foraged item is eaten.
  eaten(item) {
    const s = SHROOM_BY_ID[item.shroom]; if (!s) return;
    if (s.poison) { Poison.give(s.id); Hud.toast(s.id === 'deathcap' ? 'Hmm, a bit bitter. That was a Death cap… you have maybe a minute before it hits. Get to the Clinic!' : 'That was a ' + s.name + '. Things are about to get weird.', UI.bad, 3.6); }
    else Hud.toast('Delicious — that was a ' + s.name + '.', UI.good, 2);
  },
};

// ---------- poison ----------
const PHANTOM_WHISPERS = ['you shouldn\'t have eaten that', 'over here…', 'the fish are watching', 'tim knows', 'come closer', 'it was THIS big', 'don\'t trust the ducks'];
// How each poison behaves: onset = seconds to reach full strength; rate = health/s at full strength.
const POISONS = {
  deathcap: { src: 'Death cap', onset: 60, rate: 0.95, dur: 220, blur: 1, halluc: 0.7, early: 'Your stomach gurgles. Probably nothing.' },
  flyagaric: { src: 'Fly agaric', onset: 35, rate: 0.3, dur: 130, blur: 0.8, halluc: 1.7, early: 'The colours seem… brighter?' },
  snake: { src: 'snakebite', onset: 8, rate: 0.7, dur: 120, blur: 1.2, halluc: 0.5, early: 'The bite burns. Your vision swims.' },
};

const Poison = {
  phantoms: [], spawnT: 3, group: null,

  kind() { const p = Game.poison; return (p && POISONS[p.type]) || POISONS.deathcap; },

  // A second dose of something worse takes over; the same again just extends it.
  give(type) {
    const P = POISONS[type] || POISONS.deathcap, p = Game.poison;
    if (p && (POISONS[p.type] || POISONS.deathcap).rate > P.rate) { p.left = Math.max(p.left, P.dur * 0.6); return; }
    Game.poison = { type, src: P.src, left: Math.max(p ? p.left : 0, P.dur), age: p ? Math.min(p.age || 0, P.onset * 0.5) : 0, rate: P.rate, warned: false };
    Sfx.tone(180, 0.5, 0.18, 'sawtooth', 90);
  },

  // 0..1 build-up: eases in over the onset, eases off in the last 15 seconds.
  ramp() {
    const p = Game.poison; if (!p) return 0;
    return U.smooth(U.clamp((p.age || 0) / this.kind().onset, 0, 1)) * U.clamp(p.left / 15, 0, 1);
  },
  // How strongly it's messing with you right now (blur/stagger/camera).
  severity() { return this.ramp() * this.kind().blur * U.clamp(this.kind().rate / 0.8, 0.5, 1); },

  update(dt) {
    const p = Game.poison;
    this.effects(dt);
    if (!p) return;
    p.left -= dt; p.age = (p.age || 0) + dt;
    const ramp = this.ramp(), K = this.kind();
    if (!p.warned && p.age > K.onset * 0.15) { p.warned = true; Hud.toast(K.early, '#A8E05A', 2.4); }
    // Damage over time, building up with the poison.
    const dmg = (p.rate || K.rate) * ramp * dt;
    Wanted.health -= dmg;
    Wanted.logDamage(p.src === 'snakebite' ? 'snake venom' : p.src + ' poisoning', dmg);
    // Staggering: a drunken sideways drift while you walk.
    const s = this.severity();
    if (Player.moving && !Bikes.riding && !Interior.active) {
      const a = Player.face + Math.PI / 2, k = Math.sin(Game.time * 1.7) * 0.9 * s * dt;
      const nx = Player.x + Math.cos(a) * k, ny = Player.y + Math.sin(a) * k;
      if (!World.blocked(nx, ny)) { Player.x = nx; Player.y = ny; }
    }
    // Your stomach turns now and then.
    if (Math.random() < dt * 0.06 * s) { Bugs.shake = Math.max(Bugs.shake, 0.5); Game.energy = Math.max(0, Game.energy - 4); Hud.toast(U.pick(Math.random, ['*hurk* You double over.', 'Your legs go to jelly.', 'The ground lurches.']), '#A8E05A', 1.6); }
    if (ramp > 0.4 && Math.random() < dt * 0.1) Hud.toast(U.pick(Math.random, ['You feel sick…', 'Everything\'s spinning.', 'Did that tree just wave at you?', 'The Clinic is on the main street.', 'Your hands look… wrong.']), '#A8E05A', 1.6);
    if (Wanted.health <= 0) { Game.poison = null; Wanted.wasted(); return; }
    if (p.left <= 0) { Game.poison = null; Hud.toast('The poison has worn off. Phew.', UI.good, 2); }
  },

  // Blurred, colour-shifting vision and things that aren't really there.
  effects(dt) {
    const s = Game.mode === 'play' ? this.severity() : 0, cv = document.getElementById('game');
    if (s > 0) {
      const t = Game.time, blur = (2.8 + Math.sin(t * 1.3) * 0.8) * s, hue = Math.sin(t * 0.6) * 45 * s, sat = 1 + 0.6 * s;
      cv.style.filter = `blur(${blur.toFixed(2)}px) hue-rotate(${hue.toFixed(0)}deg) saturate(${sat.toFixed(2)})`;
      this.blurred = true;
    } else if (this.blurred) { cv.style.filter = ''; this.blurred = false; }
    if (!this.group) { this.group = new THREE.Group(); Scene3D.scene.add(this.group); }
    // Hallucinations: they turn up just out of reach and vanish when you get close.
    this.spawnT -= dt;
    const hal = Game.poison ? this.ramp() * this.kind().halluc : 0;
    if (hal > 0.25 && !Interior.active && this.spawnT <= 0 && this.phantoms.length < Math.round(2 + hal * 3)) {
      this.spawnT = (3 + Math.random() * 5) / hal;
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * 6.28, r = 6 + Math.random() * 8, x = Player.x + Math.cos(a) * r, y = Player.y + Math.sin(a) * r;
        if (World.blocked(x, y) || World.isWater(x, y)) continue;
        this.phantoms.push(this.makePhantom(x, y)); break;
      }
    }
    for (let i = this.phantoms.length - 1; i >= 0; i--) {
      const ph = this.phantoms[i];
      ph.t += dt;
      const d = U.dist(ph.x, ph.y, Player.x, Player.y);
      if (s <= 0 || ph.t > 9 || d < 2.4 || Interior.active) {
        if (d < 2.4 && s > 0) { Sfx.burst(0.4, 3000, 0.12, 'bandpass', 2, 400); Hud.toast('…it was never there.', '#A8E05A', 1.2); }
        this.group.remove(ph.mesh); this.phantoms.splice(i, 1); continue;
      }
      ph.mesh.visible = Math.sin(ph.t * 9 + ph.seed) > -0.6; // flickers
      const bob = ph.kind === 'shroom' ? 0 : Math.sin(ph.t * 2 + ph.seed) * 0.15;
      ph.mesh.position.set(ph.x, Scene3D.groundH(ph.x, ph.y) + bob + (ph.kind === 'fish' ? 1.6 : 0), ph.y);
      ph.mesh.rotation.y = ph.kind === 'fish' ? ph.t * 0.8 : -Math.atan2(Player.y - ph.y, Player.x - ph.x);
      if (ph.kind === 'person') { ph.x += Math.cos(ph.drift) * 0.3 * dt; ph.y += Math.sin(ph.drift) * 0.3 * dt; }
      if (!ph.spoke && ph.t > 1.5 && d < 14) { ph.spoke = true; Voice.babble(U.pick(Math.random, PHANTOM_WHISPERS), ph.x, ph.y, 'phantom' + ph.seed); }
    }
  },

  makePhantom(x, y) {
    const kind = U.pick(Math.random, ['person', 'person', 'shroom', 'fish', 'snake']);
    let mesh;
    if (kind === 'person') mesh = Models.person({ hat: '#7A3AD2', hatStyle: 'bucket', shirt: '#3AD2B0', pants: '#D23A9A', skin: '#B8F0A0', mitt: '#B8F0A0' });
    else if (kind === 'shroom') { mesh = Forage.mesh(U.pick(Math.random, SHROOMS)); mesh.scale.setScalar(7); }
    else if (kind === 'snake') { mesh = Snakes.mesh(); mesh.scale.setScalar(4); mesh.userData.segs.forEach((sg, k) => sg.position.set(-k * 0.11, 0.06, Math.sin(k) * 0.05)); }
    else {
      mesh = new THREE.Group();
      const body = Models.part(new THREE.SphereGeometry(0.5, 12, 8), '#E3A945', 0.05); body.scale.set(2.2, 0.8, 0.6); mesh.add(body);
      const tail = Models.part(new THREE.ConeGeometry(0.4, 0.7, 4), '#C08A2A', 0.05); tail.rotation.z = Math.PI / 2; tail.position.x = -1.3; mesh.add(tail);
    }
    this.group.add(mesh);
    return { kind, x, y, t: 0, mesh, seed: Math.random() * 10, drift: Math.random() * 6.28, spoke: false };
  },

  // Green, woozy screen edges while poisoned.
  draw(hud) {
    if (!Game.poison || Game.mode !== 'play') return;
    const g = hud.g, W = innerWidth, H = innerHeight, k = 0.25 + Math.sin(Game.time * 2.2) * 0.08;
    const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(120,200,40,0)'); gr.addColorStop(1, 'rgba(120,200,40,' + k.toFixed(2) + ')');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },
};

// ---------- the clinic ----------
const Clinic = {
  price() { return Math.round((100 - Wanted.health) * 0.8 + (Game.poison ? 30 : 0)); },
  open() {
    const cost = this.price(), need = cost > 0;
    Life.panel(`<h2>Valley Clinic</h2><div class="desc">"Snakebite? Bad mushroom? Shot by a man on a lilo? Sit down, love." — Nurse Ngaio · You have <b style="color:var(--accent)">${U.fmtMoney(Game.money)}</b></div>
      <h3>Your condition</h3>
      <div class="row"><div><b>Health ${Math.round(Wanted.health)} / 100</b><div class="desc">${Game.poison ? '<span style="color:var(--bad)">Poisoned (' + Game.poison.src + ')</span>' : 'No poison in your system.'}</div></div></div>
      <div class="row"><div><b>Full treatment</b><div class="desc">Patch up every scrape${Game.poison ? ' and flush out the poison' : ''}.</div></div>
        <button class="primary" id="healBtn" ${!need || Game.money < Math.max(1, cost) ? 'disabled' : ''}>${need ? 'Treat me — ' + U.fmtMoney(cost) : 'You\'re fine'}</button></div>`, (el) => {
      const b = el.querySelector('#healBtn');
      if (b) b.onclick = () => {
        Game.money -= cost; Wanted.health = 100; Game.poison = null; Wanted.dmgLog = {};
        Sfx.coin(); Hud.toast('All better. Try not to lick anything in the forest.', UI.good, 2.4);
        Game.save(); this.open();
      };
    });
  },
};

const NURSE_TIPS = [
  [/police|army/, 'Maybe… stop shooting at people? Just a thought.'],
  [/venom|snakebite/, 'Crouch-walk past snakes, and watch where you put your feet in the forest.'],
  [/poisoning/, 'Stick to the golden and brown mushrooms. The white ones are a coin toss.'],
  [/explosion/, 'Rockets are not a fishing technique.'],
  [/fists|pistol/, 'If you nick someone\'s ride, they tend to take it personally.'],
];
Clinic.wakeUp = function (log, last, bill) {
  const rows = Object.entries(log).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = rows.reduce((a, r) => a + r[1], 0) || 1;
  const top = rows[0] ? rows[0][0] : last;
  const tip = (NURSE_TIPS.find(([re]) => re.test(top)) || [null, 'Whatever you were doing — do less of it.'])[1];
  Life.panel(`<h2>You're lucky to be alive.</h2>
    <div class="desc">You come to on a cot in the Valley Clinic. Nurse Ngaio is by your bed: "Mate, you came in here in a right state. Six hours you've been out. Here's what did the most damage:"</div>
    <h3>What messed you up</h3>
    ${rows.length ? rows.map(([src, d]) => { const pct = Math.round(d / total * 100); return `<div class="row" style="display:block"><div style="display:flex;justify-content:space-between"><b>${src.charAt(0).toUpperCase() + src.slice(1)}</b><span class="desc">${Math.round(d)} damage · ${pct}%</span></div>
      <div style="height:8px;border-radius:6px;background:rgba(255,255,255,0.08);margin-top:6px"><div style="height:8px;border-radius:6px;width:${pct}%;background:${pct > 50 ? 'var(--bad)' : 'var(--accent)'}"></div></div></div>`; }).join('') : '<div class="desc">Honestly, we\'re not sure. You just keeled over.</div>'}
    <div class="row"><div><b>The final blow</b><div class="desc">${last.charAt(0).toUpperCase() + last.slice(1)}</div></div></div>
    <div class="row"><div><b>Hospital bill</b><div class="desc">Taken straight out of your wallet while you were out.</div></div><b style="color:var(--bad)">−${U.fmtMoney(bill)}</b></div>
    <div class="desc" style="margin-top:12px">"${tip}"</div>`);
  Hud.toast('You wake up in the clinic. Fully patched up — and a bit poorer.', UI.good, 3);
};

// ---------- snakes ----------
const Snakes = {
  list: [], group: null, spawnT: 0,
  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    this.list = [];
  },
  mesh() {
    const g = new THREE.Group(), segs = [];
    const col = Math.random() < 0.5 ? '#5A6A2A' : '#7A5A2A';
    for (let k = 0; k < 9; k++) { const r = 0.07 * (k === 0 ? 1.25 : 1 - k * 0.07); const s = Models.part(new THREE.SphereGeometry(r, 8, 6), k % 2 ? col : U.shade(col, -0.25), 0.08); g.add(s); segs.push(s); }
    const tongue = Models.part(new THREE.BoxGeometry(0.1, 0.01, 0.015), '#D23A3A', 0); segs[0].add(tongue); tongue.position.x = 0.1;
    g.userData.segs = segs;
    return g;
  },
  update(dt) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 3;
      for (let i = this.list.length - 1; i >= 0; i--) if (U.dist(this.list[i].x, this.list[i].y, Player.x, Player.y) > 45) { this.group.remove(this.list[i].mesh); this.list.splice(i, 1); }
      if (this.list.length < 4 && !Interior.active) for (let t = 0; t < 8; t++) {
        const a = Math.random() * 6.28, r = 10 + Math.random() * 22, x = Player.x + Math.cos(a) * r, y = Player.y + Math.sin(a) * r;
        const tl = World.tileAt(Math.floor(x), Math.floor(y));
        if ((tl === T.FOREST || (tl === T.MEADOW && Math.random() < 0.3)) && !World.blocked(x, y)) {
          const s = { x, y, ang: Math.random() * 6.28, t: 0, cool: 0, dead: false };
          s.mesh = this.mesh(); this.group.add(s.mesh); this.list.push(s); break;
        }
      }
    }
    for (const s of this.list) {
      if (s.dead) { s.deadT -= dt; continue; }
      s.t += dt; s.cool = Math.max(0, s.cool - dt);
      const pd = U.dist(s.x, s.y, Player.x, Player.y);
      // Slithers about; gets curious (and cranky) when you come close.
      let want = s.ang + Math.sin(s.t * 0.7) * 0.6;
      if (pd < 4 && !Bikes.riding) want = Math.atan2(Player.y - s.y, Player.x - s.x);
      s.ang += U.clamp(U.angDiff(s.ang, want), -2 * dt, 2 * dt);
      const sp = (pd < 4 ? 1.3 : 0.5) * dt, nx = s.x + Math.cos(s.ang) * sp, ny = s.y + Math.sin(s.ang) * sp;
      if (!World.blocked(nx, ny) && !World.isWater(nx, ny)) { s.x = nx; s.y = ny; } else s.ang += 1.5;
      if (pd < 1.1 && s.cool <= 0 && !Bikes.riding && !Interior.active && !Player.airborne) {
        s.cool = 4;
        if (Math.random() < (Player.crouch ? 0.35 : 0.65)) {
          Wanted.hurt(6, 'a snakebite'); Poison.give('snake');
          Hud.toast('🐍 A snake bit you! You\'re poisoned — get to the Clinic on the main street!', UI.bad, 3);
        } else Hud.toast('🐍 A snake lunges — and misses! Back off!', '#F2C14E', 1.8);
      }
    }
    this.list = this.list.filter((s) => { if (s.dead && s.deadT <= 0) { this.group.remove(s.mesh); return false; } return true; });
  },
  shotAt(x, y) {
    const s = this.list.find((q) => !q.dead && U.dist(q.x, q.y, x, y) < 0.7);
    if (!s) return false;
    s.dead = true; s.deadT = 20; Hud.toast('Snake down.', UI.muted, 1.2);
    return true;
  },
  render() {
    for (const s of this.list) {
      const segs = s.mesh.userData.segs, h = Scene3D.groundH(s.x, s.y) + 0.06;
      s.mesh.visible = !Interior.active && U.dist(s.x, s.y, Player.x, Player.y) < 40;
      for (let k = 0; k < segs.length; k++) {
        const back = k * 0.11, wig = s.dead ? 0 : Math.sin(s.t * 8 - k * 0.9) * 0.08 * (k / segs.length + 0.3);
        const px = s.x - Math.cos(s.ang) * back - Math.sin(s.ang) * wig, py = s.y - Math.sin(s.ang) * back + Math.cos(s.ang) * wig;
        segs[k].position.set(px, h + (k === 0 && !s.dead ? 0.04 : 0), py);
      }
      segs[0].rotation.y = -s.ang;
      if (s.dead) s.mesh.rotation.set(0, 0, 0);
    }
  },
};

// ---------- ducks ----------
const Ducks = {
  flocks: [], group: null, spawnT: 0, quackT: 3,
  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    this.flocks = [];
  },
  mesh(drake) {
    const g = new THREE.Group(), P = (geo, c, o = 0.06) => Models.part(geo, c, o);
    const body = P(new THREE.SphereGeometry(0.17, 10, 8), drake ? '#9A8A78' : '#8A6A4A'); body.scale.set(1.35, 0.8, 0.9); body.position.y = 0.06; g.add(body);
    const tail = P(new THREE.ConeGeometry(0.06, 0.14, 6), drake ? '#3A3A3A' : '#6A4A2A'); tail.rotation.z = Math.PI / 2 + 0.5; tail.position.set(-0.24, 0.12, 0); g.add(tail);
    const head = P(new THREE.SphereGeometry(0.09, 10, 8), drake ? '#1F6A3A' : '#7A5A3A'); head.position.set(0.17, 0.24, 0); g.add(head);
    const bill = P(new THREE.BoxGeometry(0.1, 0.03, 0.06), '#E8A82A', 0.1); bill.position.set(0.27, 0.22, 0); g.add(bill);
    for (const z of [-0.05, 0.05]) { const e = P(new THREE.SphereGeometry(0.015, 6, 4), '#111', 0); e.position.set(0.24, 0.27, z); g.add(e); }
    if (drake) { const ring = P(new THREE.TorusGeometry(0.075, 0.012, 4, 12), '#F4F4F4', 0); ring.rotation.y = Math.PI / 2; ring.position.set(0.13, 0.17, 0); g.add(ring); }
    return g;
  },
  update(dt) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 4;
      this.flocks = this.flocks.filter((f) => { const keep = U.dist(f.x, f.y, Player.x, Player.y) < 70 && !(f.flying && f.flyT > 7); if (!keep) f.ducks.forEach((d) => this.group.remove(d.mesh)); return keep; });
      if (this.flocks.length < 3 && !Interior.active) for (let t = 0; t < 10; t++) {
        const a = Math.random() * 6.28, r = 12 + Math.random() * 30, x = Player.x + Math.cos(a) * r, y = Player.y + Math.sin(a) * r;
        if (!World.isWater(x, y) || World.depthAt(x, y) < 0.4) continue;
        const n = 3 + ((Math.random() * 4) | 0), f = { x, y, ang: Math.random() * 6.28, flying: false, flyT: 0, ducks: [] };
        for (let k = 0; k < n; k++) { const d = { ox: (Math.random() - 0.5) * 2.4, oy: (Math.random() - 0.5) * 2.4, ph: Math.random() * 6, dead: false }; d.mesh = this.mesh(k === 0 || Math.random() < 0.4); this.group.add(d.mesh); f.ducks.push(d); }
        this.flocks.push(f); break;
      }
    }
    for (const f of this.flocks) {
      const pd = U.dist(f.x, f.y, Player.x, Player.y);
      if (!f.flying && pd < 5 && !Player.crouch) this.scare(f);
      if (f.flying) { f.flyT += dt; f.x += Math.cos(f.ang) * 7 * dt; f.y += Math.sin(f.ang) * 7 * dt; continue; }
      // Paddle about, staying on the water.
      f.ang += (Math.random() - 0.5) * dt * 0.8;
      const nx = f.x + Math.cos(f.ang) * 0.35 * dt, ny = f.y + Math.sin(f.ang) * 0.35 * dt;
      if (World.isWater(nx, ny) && World.depthAt(nx, ny) > 0.35) { f.x = nx; f.y = ny; } else f.ang += 2;
    }
    this.quackT -= dt;
    if (this.quackT <= 0) {
      this.quackT = 2 + Math.random() * 6;
      const f = this.flocks.find((q) => U.dist(q.x, q.y, Player.x, Player.y) < 22);
      if (f) { const v = U.clamp(0.22 - U.dist(f.x, f.y, Player.x, Player.y) / 120, 0.04, 0.22); Sfx.tone(560, 0.07, v, 'sawtooth', 380); setTimeout(() => Sfx.tone(520, 0.08, v, 'sawtooth', 340), 110); }
    }
  },
  scare(f) {
    if (f.flying) return;
    f.flying = true; f.flyT = 0; f.ang = Math.atan2(f.y - Player.y, f.x - Player.x) + (Math.random() - 0.5);
    Sfx.burst(0.5, 1800, 0.15, 'bandpass', 2, 600);
  },
  onGunshot(x, y) { for (const f of this.flocks) if (U.dist(f.x, f.y, x, y) < 40) this.scare(f); },
  shotAt(x, y) {
    for (const f of this.flocks) for (const d of f.ducks) {
      if (d.dead) continue;
      const dx = f.x + d.ox, dy = f.y + d.oy;
      if (U.dist(dx, dy, x, y) < 0.55) {
        d.dead = true; this.scare(f);
        Game.pantry.push({ name: 'Wild duck', energy: 28 });
        Hud.toast('Duck down! A wild duck goes in your bag.', UI.good, 1.8);
        return true;
      }
    }
    return false;
  },
  render() {
    for (const f of this.flocks) for (const d of f.ducks) {
      const x = f.x + d.ox, y = f.y + d.oy;
      d.mesh.visible = !Interior.active && U.dist(x, y, Player.x, Player.y) < 55;
      if (d.dead) { d.mesh.position.set(x, -0.02, y); d.mesh.rotation.set(Math.PI / 2, 0, 0); continue; }
      const up = f.flying ? Math.min(4, f.flyT * 2.2) : 0;
      d.mesh.position.set(x, -0.03 + up + Math.sin(Game.time * 2 + d.ph) * 0.02, y);
      d.mesh.rotation.set(0, -f.ang + (f.flying ? 0 : Math.sin(Game.time * 0.5 + d.ph) * 0.4), f.flying ? Math.sin(Game.time * 18 + d.ph) * 0.25 : 0);
    }
  },
};

// ---------- hunters (in hi-vis, obviously) ----------
const HUNTER_PAL = { hat: '#FF6A10', hatStyle: 'cap', shirt: '#4A5A3A', vest: '#D8FF1A', pants: '#3A3A2A', skin: '#E2B08A', mitt: '#3A2A1A', beard: '#5A3A1A' };
const Hunters = {
  list: [], group: null,
  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    const names = ['Big Trev', 'Moose', 'Ingrid'];
    this.list = names.map((name, k) => {
      let x = World.town.x, y = World.town.y;
      for (let t = 0; t < 200; t++) { const a = Math.random() * 6.28, r = 30 + Math.random() * 90, px = World.town.x + Math.cos(a) * r, py = World.town.y + Math.sin(a) * r; if (World.inB(px, py) && World.tileAt(Math.floor(px), Math.floor(py)) === T.FOREST && !World.blocked(px, py)) { x = px; y = py; break; } }
      const pal = { ...HUNTER_PAL, skin: ['#E2B08A', '#C08A60', '#F0C8A0'][k], beard: k === 2 ? null : HUNTER_PAL.beard, hair: '#5A3A1A' };
      const h = { name, x, y, face: 0, state: 'roam', t: 0, goal: null, prey: null, aimT: 0, ko: false, koT: 0, walkT: 0, bubble: null, bubbleT: 0 };
      h.mesh = Models.person(pal);
      // Reflective stripes round the vest.
      for (const yy of [0.13, 0.27]) { const s = Models.part(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 16, 1, true), '#EDEDED', 0); s.position.y = yy; h.mesh.userData.rig.upper.add(s); }
      h.rifle = Wanted.gunMesh(true);
      this.group.add(h.mesh, h.rifle);
      return h;
    });
  },
  say(h, t, s = 2) { h.bubble = t; h.bubbleT = s; Voice.babble(t, h.x, h.y, h.name); },
  update(dt) {
    for (const h of this.list) {
      h.bubbleT = Math.max(0, h.bubbleT - dt);
      if (h.ko) { h.koT += dt; if (h.koT > 25) { h.ko = false; this.say(h, 'Ugh… who turned the lights off?'); } continue; }
      h.t -= dt;
      if (h.state === 'roam') {
        // Look for something worth shooting.
        const prey = Animals.list.filter((a) => a.state !== 'dead' && U.dist(a.x, a.y, h.x, h.y) < 45).sort((a, b) => U.dist(a.x, a.y, h.x, h.y) - U.dist(b.x, b.y, h.x, h.y))[0];
        if (prey) { h.prey = prey; h.state = 'stalk'; }
        else if (!h.goal || U.dist(h.x, h.y, h.goal.x, h.goal.y) < 1 || h.t <= 0) {
          h.t = 30;
          for (let t = 0; t < 20; t++) { const a = Math.random() * 6.28, r = 10 + Math.random() * 30, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r; if (World.inB(x, y) && !World.blocked(x, y) && !World.isWater(x, y)) { h.goal = { x, y }; break; } }
        }
        if (h.goal) this.step(h, h.goal, 1.3, dt);
      } else if (h.state === 'stalk') {
        const p = h.prey;
        if (!p || p.state === 'dead' || !Animals.list.includes(p) || U.dist(p.x, p.y, h.x, h.y) > 60) { h.state = 'roam'; h.prey = null; continue; }
        const d = U.dist(p.x, p.y, h.x, h.y);
        if (d > 16) this.step(h, p, 1.1, dt); // creeping up
        else { h.state = 'aim'; h.aimT = 1.5 + Math.random() * 1.5; }
      } else if (h.state === 'aim') {
        const p = h.prey;
        if (!p || p.state === 'dead' || !Animals.list.includes(p)) { h.state = 'roam'; continue; }
        h.face = Math.atan2(p.y - h.y, p.x - h.x);
        h.aimT -= dt;
        if (h.aimT <= 0) this.fire(h, p);
      } else if (h.state === 'collect') {
        const p = h.prey;
        if (!p || !Animals.list.includes(p)) { h.state = 'roam'; continue; }
        if (U.dist(p.x, p.y, h.x, h.y) > 1) this.step(h, p, 1.4, dt);
        else {
          Contest.onKill(h.name, p.kg || 60, p.type === 'boar' ? 'Wild boar' : p.buck ? 'Stag' : 'Deer');
          if (U.dist(h.x, h.y, Player.x, Player.y) < 25) this.say(h, 'Get in! That\'s dinner sorted.', 2.4);
          Animals.remove(p); h.prey = null; h.state = 'roam';
        }
      }
      // Don't point that thing at me — keep clear of the player.
      if (U.dist(h.x, h.y, Player.x, Player.y) < 6 && Math.random() < dt * 0.1) this.say(h, U.pick(Math.random, ['Wear something bright, mate!', 'Careful — I nearly mistook you for a stag.', 'Seen any deer about?']), 2.6);
    }
  },
  step(h, goal, sp, dt) {
    const want = Math.atan2(goal.y - h.y, goal.x - h.x);
    for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
      const a = want + off, nx = h.x + Math.cos(a) * sp * dt, ny = h.y + Math.sin(a) * sp * dt;
      if (World.blocked(nx, ny) || World.depthAt(nx, ny) > 0.3) continue;
      h.x = nx; h.y = ny; h.face = a; h.walkT += dt; h.moving = true; return;
    }
    h.moving = false; h.goal = null;
  },
  fire(h, p) {
    const near = U.dist(h.x, h.y, Player.x, Player.y);
    Sfx.burst(0.08, 5000, U.clamp(0.5 - near / 70, 0.03, 0.5), 'highpass'); Sfx.tone(140, 0.2, U.clamp(0.35 - near / 80, 0.03, 0.35), 'square', 50);
    Fish.spookNear(h.x, h.y, 25); Ducks.onGunshot(h.x, h.y);
    if (Math.random() < 0.6) {
      p.state = 'dead'; p.deadT = 45; p.speed = 0;
      p.kg = p.type === 'boar' ? 45 + Math.random() * 75 : p.buck ? 65 + Math.random() * 55 : 35 + Math.random() * 35;
      h.state = 'collect';
    } else { Animals.startle(p); h.state = 'roam'; h.prey = null; if (near < 30) this.say(h, 'Bugger. Missed.'); }
  },
  render() {
    const v = this._v || (this._v = new THREE.Vector3());
    for (const h of this.list) {
      const vis = !Interior.active && U.dist(h.x, h.y, Player.x, Player.y) < 60;
      h.mesh.visible = h.rifle.visible = vis;
      if (!vis) continue;
      const rig = h.mesh.userData.rig;
      h.mesh.position.set(h.x, Scene3D.standH(h.x, h.y), h.y);
      rig.yaw.rotation.y = -h.face;
      if (h.ko) { Models.pose(rig, { t: 0 }); rig.lean.rotation.x = -Math.PI / 2; h.rifle.visible = false; continue; }
      rig.lean.rotation.x = 0;
      Models.pose(rig, { moving: h.moving && h.state !== 'aim', phase: h.walkT, t: Game.time, pose: 'grip', crouch: h.state === 'stalk' || h.state === 'aim' });
      Models.handPos(rig, v); h.rifle.position.copy(v); h.rifle.rotation.set(0, -h.face, 0);
    }
  },
  drawBubbles(hud) {
    for (const h of this.list) {
      if (h.bubbleT <= 0 || U.dist(h.x, h.y, Player.x, Player.y) > 30) continue;
      const [sx, sy, ok] = Scene3D.project(h.x, h.y, Scene3D.standH(h.x, h.y) + 1.9);
      if (ok) hud.pill(h.bubble, sx, sy, '#D8FF1A', 12);
    }
  },
};
