// The people who run the township: shopkeepers with names, homes, opening hours and days off.
// They walk to work to unlock in the morning and lock up at night. Let their building go to ruin
// and they quit town; fix it up and someone new moves in. Residents come and go with the town too.
'use strict';

const SHOP_HOURS = {
  shop: { open: 7, close: 19, role: 'Tackle', verb: 'tackle & bait' },
  store: { open: 6, close: 21, role: 'Store', verb: 'groceries' },
  ranger: { open: 8, close: 17, role: 'Ranger', verb: 'permits' },
  bikes: { open: 9, close: 18, role: 'Bikes', verb: 'bikes & fuel' },
  clinic: { open: 7, close: 22, role: 'Clinic', verb: 'treatment' },
};
const FIRST_STAFF = { shop: ['Hettie', KEEPER_PAL], store: ['Mo', CLERK_PAL], ranger: ['Dale', RANGER_PAL], bikes: ['Revs', REVS_PAL], clinic: ['Ngaio', NURSE_PAL] };
const NEW_NAMES = ['Bev', 'Stu', 'Rangi', 'Marge', 'Doug', 'Aroha', 'Phil', 'Tania', 'Gaz', 'Wendy', 'Hemi', 'Sheila', 'Trish', 'Wiremu', 'Barry', 'Lois'];
const LEISURE = ['fishing', 'hunting', 'sunbathing'];

const Staff = {
  list: [], news: [], newsT: 0, group: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    const saved = Game.staff || {};
    const taken = new Set();
    this.list = Object.keys(SHOP_HOURS).map((type, k) => {
      const b = World.buildings.find((x) => x.type === type); if (!b) return null;
      const s = saved[type] || { name: FIRST_STAFF[type][0], pal: FIRST_STAFF[type][1], offDay: (k * 2 + 1) % 7, cover: U.pick(Math.random, NEW_NAMES), quit: false, hireIn: 0 };
      const st = { type, b, bi: World.buildings.indexOf(b), ...s, state: 'home', x: 0, y: 0, face: 0 };
      st.homeB = this.pickHome(st, taken);
      this.makeMesh(st);
      return st;
    }).filter(Boolean);
    for (const n of Npcs.list) if ((Game.townAway || []).includes(n.name)) { n.away = true; n.state = 'home'; }
    const shop = this.by('shop'); if (shop && shop.name !== 'Hettie') shop.b.name = shop.name + '\'s Tackle';
    this.save();
  },

  // Somewhere to live: a house nobody (else) has claimed.
  pickHome(st, taken) {
    const owned = new Set(Npcs.list.map((n) => n.home));
    const cands = World.houses.filter((h) => !h.vacant && !taken.has(h) && !(Game.home && Game.home.id === h.id));
    const free = cands.filter((h) => !owned.has(h));
    const pool = free.length ? free : cands;
    const h = pool.sort((a, b) => U.dist(a.x, a.y, st.b.x, st.b.y) - U.dist(b.x, b.y, st.b.x, st.b.y))[(st.name.length * 3) % Math.max(1, Math.min(4, pool.length))] || World.houses[0];
    taken.add(h);
    return h;
  },

  makeMesh(st) {
    if (st.mesh) this.group.remove(st.mesh);
    st.mesh = Models.person({ ...st.pal, female: Models.isFemaleName(st.name) });
    this.group.add(st.mesh);
    if (!st.coverMesh) { st.coverMesh = Models.person({ hat: '#3A6AD2', hatStyle: 'cap', shirt: '#E8E2D0', vest: '#3A6AD2', pants: '#3A3A4A', skin: '#C8A07A', hair: '#3A2A1A' }); this.group.add(st.coverMesh); }
    if (!st.prop) { st.prop = new THREE.Group(); this.group.add(st.prop); }
  },

  save() { Game.staff = Object.fromEntries(this.list.map((s) => [s.type, { name: s.name, pal: s.pal, offDay: s.offDay, cover: s.cover, quit: s.quit, hireIn: s.hireIn }])); },

  by(type) { return this.list.find((s) => s.type === type); },
  weekday() { return (Game.env.day - 1) % 7; },
  offToday(st) { return this.weekday() === st.offDay; },
  // Who's behind the counter right now (null if shut).
  onShift(type) {
    const st = this.by(type); if (!st || st.ko) return null;
    if (st.state === 'cover') return st.cover; // someone's minding it while they're off
    if (st.state !== 'work') return null;
    return st.name;
  },
  isOpen(type) { return !!this.onShift(type); },
  hoursText(type) { const h = SHOP_HOURS[type]; return h.open + ':00–' + h.close + ':00'; },

  // Where the schedule says they should be at this hour.
  desired(st) {
    const H = SHOP_HOURS[st.type], h = Game.env.hour;
    if (st.quit) return 'gone';
    if (this.offToday(st)) return h >= H.open && h < H.close ? 'cover' : 'home';
    if (h >= H.open - 1 && h < H.open) return 'toWork';
    if (h >= H.open && h < H.close) return 'work';
    if (h >= H.close && h < H.close + 1) return 'toHome';
    return 'home';
  },

  update(dt) {
    this.newsT -= dt;
    // Knocked-out people come round eventually (and Dusty, who's had worse).
    for (const st of this.list) if (st.ko && (st.koT += dt) > 35) { st.ko = false; if (Interior.active && Interior.active.b === st.b) Hud.toast((Staff.onShift(st.type) || st.name) + ' staggers back up. "Get OUT of my shop!"', UI.bad, 2.4); }
    const dk = Weed.dustyKO; if (dk.ko && (dk.koT += dt) > 45) dk.ko = false;
    if (this.news.length && this.newsT <= 0) { Hud.toast(this.news.shift(), UI.accent, 3.2); this.newsT = 3.4; }
    for (const st of this.list) {
      const want = this.desired(st);
      const door = World.doorOf(st.b), home = World.doorOf(st.homeB);
      if (want === 'toWork' && st.state !== 'toWork' && st.state !== 'waiting' && st.state !== 'work') { st.state = 'toWork'; st.x = home.x; st.y = home.y; st.home = { x: door.x, y: door.y }; st.homeT = 0; }
      else if (want === 'work' && st.state !== 'work') {
        // Not there yet? They turn up late (or we skipped time and they're simply in).
        if (st.state === 'toWork' && U.dist(st.x, st.y, door.x, door.y) > 1.5 && U.dist(st.x, st.y, Player.x, Player.y) < 50) { /* keep walking */ }
        else this.unlock(st);
      } else if (want === 'toHome' && (st.state === 'work' || st.state === 'cover')) { this.lockUp(st); st.state = 'toHome'; st.x = door.x; st.y = door.y; st.home = { x: home.x, y: home.y }; st.homeT = 0; }
      else if (want === 'home' && !['home', 'toHome'].includes(st.state)) { if (st.state === 'work' || st.state === 'cover') this.lockUp(st); st.state = 'home'; }
      else if (want === 'cover' && st.state !== 'cover') { this.startLeisure(st); }
      else if (want === 'gone') st.state = 'gone';
      // Walking legs of the commute.
      if (st.state === 'toWork' || st.state === 'toHome') {
        if (walkHome(st, dt)) {
          if (st.state === 'toWork') { if (Game.env.hour >= SHOP_HOURS[st.type].open) this.unlock(st); else st.state = 'waiting'; }
          else st.state = 'home';
        }
        st.face = st.heading || 0;
      }
      if (st.state === 'waiting' && want === 'work') this.unlock(st);
    }
  },

  unlock(st) {
    const was = st.state; st.state = 'work';
    const door = World.doorOf(st.b);
    if (was !== 'work' && U.dist(door.x, door.y, Player.x, Player.y) < 25) Hud.toast(st.name + ' unlocks ' + st.b.name + '. Open ' + this.hoursText(st.type) + '.', UI.good, 2.2);
  },

  lockUp(st) {
    // Still browsing at closing time? Out you go.
    if (Interior.active && Interior.active.b === st.b) {
      if (Menus.open) Menus.close();
      Interior.exit();
      Hud.toast((this.onShift(st.type) || st.name) + ': "Sorry love, we\'re closing up. Back at ' + SHOP_HOURS[st.type].open + ':00!"', UI.accent, 2.6);
    } else if (U.dist(World.doorOf(st.b).x, World.doorOf(st.b).y, Player.x, Player.y) < 20) Hud.toast(st.name + ' locks up ' + st.b.name + ' for the night.', UI.muted, 2);
  },

  // Day off: out fishing, hunting or catching some sun.
  startLeisure(st) {
    st.state = 'cover';
    const kind = LEISURE[(Game.env.day + st.name.length) % LEISURE.length];
    st.leisure = kind;
    while (st.prop.children.length) st.prop.remove(st.prop.children[0]);
    const home = World.doorOf(st.homeB);
    if (kind === 'fishing') {
      const spot = Npcs.spots.slice().sort((a, b) => U.dist(a.x, a.y, home.x, home.y) - U.dist(b.x, b.y, home.x, home.y))[2] || Npcs.spots[0];
      st.x = spot.x; st.y = spot.y; st.face = spot.ang;
      const rod = Models.part(new THREE.CylinderGeometry(0.012, 0.02, 1.8, 6), '#A8834C', 0.1); rod.rotation.z = -1.0; rod.position.set(0.7, 1.1, 0); st.prop.add(rod);
    } else if (kind === 'hunting') {
      let x = home.x, y = home.y;
      for (let t = 0; t < 60; t++) { const a = Math.random() * 6.28, r = 12 + Math.random() * 30, px = home.x + Math.cos(a) * r, py = home.y + Math.sin(a) * r; if (World.inB(px, py) && World.tileAt(Math.floor(px), Math.floor(py)) === T.FOREST && !World.blocked(px, py)) { x = px; y = py; break; } }
      st.x = x; st.y = y; st.face = Math.random() * 6.28;
      const gun = Wanted.gunMesh(true); gun.position.set(0.25, 0.55, 0.25); st.prop.add(gun);
    } else {
      let x = home.x, y = home.y;
      for (let t = 0; t < 200; t++) { const a = Math.random() * 6.28, r = 5 + Math.random() * 60, px = home.x + Math.cos(a) * r, py = home.y + Math.sin(a) * r; if (World.inB(px, py) && World.tileAt(Math.floor(px), Math.floor(py)) === T.SAND && !World.blocked(px, py)) { x = px; y = py; break; } }
      st.x = x; st.y = y; st.face = 0;
      const towel = Models.part(new THREE.BoxGeometry(0.75, 0.02, 1.7), U.pick(Math.random, ['#E2584D', '#3A8AD2', '#F2C14E']), 0.04); towel.position.y = 0.01; st.prop.add(towel);
    }
  },

  // Daily: quitting a dump of a building, new people moving in, residents leaving or coming home.
  daily() {
    const lvl = Decay.level();
    for (const st of this.list) {
      const d = Decay.dmg(st.bi);
      if (!st.quit && d > 0.7) {
        st.quit = true; st.hireIn = 2; st.state = 'gone';
        this.news.push(st.name + ' has had enough of the state of ' + st.b.name + ' and left town. It\'s shut.');
      } else if (st.quit && d < 0.3 && --st.hireIn <= 0) {
        st.quit = false;
        st.name = NEW_NAMES.filter((n) => !this.list.some((o) => o.name === n))[(Math.random() * 10) | 0] || 'Pat';
        st.pal = { hat: U.pick(Math.random, ['#3A6AD2', '#E2584D', '#7DC383', '#F2C14E']), hatStyle: U.pick(Math.random, ['cap', 'beanie', 'none', 'bucket']), shirt: U.pick(Math.random, ['#E8E2D0', '#2A4A6A', '#8A4A3A', '#4A6A3A']), vest: st.type === 'clinic' ? null : U.pick(Math.random, ['#B83A32', '#3A3A4A', null]), pants: '#3A3A4A', skin: U.pick(Math.random, ['#F0C8A0', '#C08A60', '#8A5A3A', '#E2B08A']), hair: '#3A2A1A' };
        if (st.type === 'shop') st.b.name = st.name + '\'s Tackle';
        st.cover = U.pick(Math.random, NEW_NAMES);
        this.makeMesh(st); st.state = 'home';
        this.news.push('New in town: ' + st.name + ' has taken over ' + st.b.name + ' now it\'s fixed up.');
      }
    }
    // Replacements for the dead (wardens, hunters, bikers, Dusty) after a couple of days.
    for (const w of Wardens.list) if (w.state === 'dead' && Game.env.day - (w.deadDay || 0) >= 2) {
      w.state = 'patrol'; w.t = 0; w.name = 'Warden ' + U.pick(Math.random, ['Ngata', 'Price', 'Holm', 'Reyes', 'Kowalski', 'Ferris']); Wardens.relocate(w, 60);
      this.news.push(w.name + ' has been posted to the valley.');
    }
    for (const h of Hunters.list) if (h.dead && Math.random() < 0.5) {
      h.dead = false; h.ko = false; h.koT = 0; h.state = 'roam'; h.name = U.pick(Math.random, ['Big Trev', 'Shazza', 'Mick', 'Jono', 'Raewyn', 'Hoppo']) + ' Jr';
      this.news.push(h.name + ' has taken up hunting in the hills.');
    }
    for (const r of Bikes.riders) if (r.dead && Math.random() < 0.5) {
      r.dead = false; r.ko = 0; r.name = U.pick(Math.random, ['Jase', 'Kayla', 'Benny', 'Tui', 'Dee', 'Robbo']); r.owner = r.name; r.plate = newPlate();
      if (r.noBike) { r.bike = Bikes.modelFor(r.bikeId); Bikes.group.add(r.bike); r.noBike = false; }
      r.state = 'ride'; r.fuel = 100; r.target = Bikes.pickTarget(r);
    }
    const dk = Weed.dustyKO;
    if (dk.dead && Game.env.day - (dk.deadDay || 0) >= 3) { dk.dead = false; dk.ko = false; dk.koT = 0; this.news.push('Someone new has set up in Dusty\'s old spot in the woods. Calls himself "Dusty". Of course he does.'); }
    // Newcomers: when the town's shrinking but liveable, people move in to empty houses.
    const living = Npcs.list.filter((n) => !n.away).length;
    if (living < 8 && lvl < 0.5 && Math.random() < 0.5) {
      const slot = Npcs.list.find((n) => n.away && n.dead) || Npcs.list.find((n) => n.away);
      if (slot) this.newcomer(slot);
    }
    // Residents follow the state of the place.
    const away = Game.townAway = Game.townAway || [];
    if (lvl > 0.45 && Math.random() < (lvl - 0.45) * 1.6) {
      const n = Npcs.list.find((x) => !x.away && ['cast', 'wait', 'walk', 'home'].includes(x.state));
      if (n) { n.away = true; n.state = 'home'; n.lure = null; away.push(n.name); this.news.push(n.name + ' has packed up and moved out of the valley. "This place has gone to the dogs."'); }
    } else if (lvl < 0.3 && away.length && Math.random() < 0.6 - lvl) {
      const name = away.shift(), n = Npcs.list.find((x) => x.name === name);
      if (n) { n.away = false; n.homeT = 0; this.news.push(name + ' has moved back to town — word is the place is looking good again!'); }
    }
    while (this.news.length > 4) this.news.shift();
    this.save();
  },

  // A fresh face takes over an empty slot: new name, new look, same house.
  newcomer(n) {
    const used = new Set(Npcs.list.map((x) => x.name));
    const name = ['Kiri', 'Duncan', 'Ana', 'Nev', 'Josie', 'Pita', 'Glenda', 'Sione', 'Morris', 'Hine', 'Craig', 'Ruby'].find((x) => !used.has(x)) || 'New Bloke';
    const away = Game.townAway || []; const i = away.indexOf(n.name); if (i >= 0) away.splice(i, 1);
    for (const m of [n.mesh, n.shadow, n.rod, n.line, n.bob, n.fishMesh, n.heldMesh]) if (m) Npcs.group.remove(m);
    const base = NPC_PALETTES[(Math.random() * NPC_PALETTES.length) | 0];
    n.palette = { ...base, hat: U.pick(Math.random, ['#3A6AD2', '#E2584D', '#7DC383', '#F2C14E', '#B85AE2', '#E8E8D8']), skin: U.pick(Math.random, ['#F0C8A0', '#C08A60', '#8A5A3A', '#E2B08A', '#A8724A']) };
    const old = n.name;
    n.name = name; n.away = false; n.dead = false; n.mob = false; n.angry = 0;
    n.rec = { count: 0, best: 0, sp: null }; n.creel = [];
    if (n.home) { n.home.owner = name; n.home.name = name + '\'s house'; }
    Npcs.buildMeshes(n);
    n.state = 'home'; n.homeT = 0;
    this.news.push('New in the valley: ' + name + ' has moved into ' + (n.home ? old + '\'s old place' : 'town') + '. Say g\'day!');
  },

  // Who's where, for the E key outside.
  interactions(add) {
    for (const st of this.list) {
      if (st.state !== 'cover') continue;
      add(st.x, st.y, 2.2, 'Chat to ' + st.name + ' (day off)', () => {
        const what = { fishing: 'getting a line wet', hunting: 'after a stag', sunbathing: 'working on my tan' }[st.leisure];
        Hud.toast(st.name + ': "Day off! I\'m ' + what + '. ' + st.cover + '\'s minding ' + st.b.name + ' for me."', UI.ink, 3);
        Voice.babble('Day off! ' + what, st.x, st.y, st.name);
      });
    }
  },

  // Door prompt for a shop: enter if open, otherwise why not.
  doorLabel(b) {
    const st = this.list.find((s) => s.b === b); if (!st) return null;
    if (st.quit) return b.name + ' — shut (no one runs it)';
    if (this.isOpen(st.type)) return null;
    return b.name + ' — closed · opens ' + SHOP_HOURS[st.type].open + ':00';
  },

  render() {
    const v = this._v || (this._v = new THREE.Vector3());
    // The old fixed vendor models are retired; staff are drawn here.
    for (const m of [Actors.keeper, Wardens.ranger, Interior.clerk, Interior.revs, Interior.nurse]) if (m) m.visible = false;
    if (Weed.dusty) { Weed.dusty.userData.rig.lean.rotation.x = Weed.dustyKO.ko ? -Math.PI / 2 : 0; }
    const spots = { shop: World.shopkeeper, ranger: World.ranger, store: World.clerk, bikes: World.revs, clinic: World.nurse };
    for (const st of this.list) {
      const rig = st.mesh.userData.rig, crig = st.coverMesh.userData.rig;
      st.coverMesh.visible = false; st.prop.visible = false; st.mesh.visible = false;
      const spot = spots[st.type];
      if (st.state === 'work') {
        // Behind the counter (interior coordinates).
        const m = this.offToday(st) ? st.coverMesh : st.mesh, r = m.userData.rig;
        m.visible = !!Interior.active && Interior.active.b === st.b;
        m.position.set(spot.x, 0.04, spot.y); r.yaw.rotation.y = -Math.PI / 2;
        Models.pose(r, { t: st.ko ? 0 : Game.time }); r.lean.rotation.x = st.ko ? -Math.PI / 2 : 0; if (st.ko) m.position.y = 0.15;
      } else if (st.state === 'cover') {
        // Off-duty — and the cover worker is in the shop.
        st.coverMesh.visible = !!Interior.active && Interior.active.b === st.b;
        st.coverMesh.position.set(spot.x, 0.04, spot.y); crig.yaw.rotation.y = -Math.PI / 2; Models.pose(crig, { t: st.ko ? 0 : Game.time }); crig.lean.rotation.x = st.ko ? -Math.PI / 2 : 0;
        const vis = !Interior.active && U.dist(st.x, st.y, Player.x, Player.y) < 60;
        st.mesh.visible = st.prop.visible = vis;
        if (!vis) continue;
        const h = Scene3D.standH(st.x, st.y);
        st.mesh.position.set(st.x, h, st.y); rig.yaw.rotation.y = -st.face;
        if (st.leisure === 'sunbathing') {
          Models.pose(rig, { t: 0 }); rig.lean.rotation.x = -Math.PI / 2; st.mesh.position.y = h + 0.12;
        } else { rig.lean.rotation.x = 0; Models.pose(rig, { t: Game.time, pose: 'grip', crouch: st.leisure === 'hunting' }); }
        st.prop.position.set(st.x, h, st.y); st.prop.rotation.y = -st.face;
      } else if (st.state === 'toWork' || st.state === 'toHome' || st.state === 'waiting') {
        const vis = !Interior.active && U.dist(st.x, st.y, Player.x, Player.y) < 60;
        st.mesh.visible = vis; if (!vis) continue;
        rig.lean.rotation.x = 0;
        st.mesh.position.set(st.x, Scene3D.standH(st.x, st.y), st.y); rig.yaw.rotation.y = -st.face;
        Models.pose(rig, { moving: st.state !== 'waiting', phase: st.walkPhase || 0, t: Game.time });
      }
    }
  },

  drawLabels(hud) {
    for (const st of this.list) {
      if (!st.mesh.visible || Interior.active || U.dist(st.x, st.y, Player.x, Player.y) > 22) continue;
      const [sx, sy, ok] = Scene3D.project(st.x, st.y, Scene3D.standH(st.x, st.y) + 1.75);
      if (ok) hud.text(st.name, sx, sy, '#F3EAD6', 11, 'center', 700);
    }
  },
};
