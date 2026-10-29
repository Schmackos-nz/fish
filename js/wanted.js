// GTA-style wanted levels: shoot people, draw police (then the army), lose them by hiding in the bushes.
// Hits knock people out cartoon-style; they get back up later. Armed anglers defend themselves.
'use strict';

const COP_PAL = { hat: '#1E2A4A', hatStyle: 'cap', shirt: '#3A5A9A', vest: '#1E2A4A', pants: '#1E2A4A', skin: '#E2B08A', badge: true, mitt: '#1E2A4A' };
const ARMY_PAL = { hat: '#4A5A2A', hatStyle: 'helmet', visor: '#2A3418', shirt: '#5A6A3A', vest: '#3E4A28', pants: '#4A5530', skin: '#C08A60', mitt: '#2A2A2A' };
const UNITS_FOR = [0, 2, 3, 4, 6, 8];
const SAY_W = {
  cop: ['POLICE! Drop it!', 'Suspect sighted!', 'Freeze!', 'Shots fired, shots fired!'],
  army: ['Contact!', 'Target acquired!', 'Move, move, move!'],
  draw: ['Back off, mate! I\'m armed!', 'You want some?!', 'Not today, pal!', 'Stay back!'],
  ko: ['OOF!', 'Ow…', '💫', 'Not the face!'],
};

const Wanted = {
  heat: 0, level: 0, health: 100, hidden: false, seen: false, lastSeen: 999, units: [], drops: [], group: null,
  spawnT: 0, hurtT: 0, tracers: [],

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.heat = 0; this.level = 0; this.health = 100; this.units = []; this.drops = [];
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xFFE27A, transparent: true }));
      t.frustumCulled = false; t.visible = false; t.userData.t = 1; this.group.add(t); this.tracers.push(t);
    }
    // Anglers carry a few fish of their own (dropped if they get knocked out).
    for (const n of Npcs.list) {
      n.creel = [];
      for (let k = Math.floor(Math.random() * 3); k > 0; k--) {
        const sp = SPECIES.filter((s) => !s.legendary)[Math.floor(Math.random() * 12)];
        const sz = Fish.rollSize(sp);
        n.creel.push({ id: sp.id, kg: sz.kg, cm: sz.cm, value: Menus.value(sp, sz.kg, false) });
      }
    }
  },

  // A small pistol or rifle model, positioned by hand each frame.
  gunMesh(long) {
    const g = new THREE.Group();
    const body = Models.part(new THREE.BoxGeometry(long ? 0.62 : 0.26, 0.06, 0.05), '#2A2A2E', 0.15); body.position.x = long ? 0.18 : 0.08; g.add(body);
    const grip = Models.part(new THREE.BoxGeometry(0.06, 0.13, 0.05), long ? '#5A3A1E' : '#2A2A2E', 0.15); grip.position.set(0, -0.07, 0); grip.rotation.z = 0.25; g.add(grip);
    return g;
  },

  // ---------- who can be shot ----------
  targets() {
    const out = [];
    for (const n of Npcs.list) if (!n.away && !['home', 'bush', 'ko', 'dead'].includes(n.state)) out.push({ x: n.x, y: n.y, kind: 'npc', o: n });
    for (const w of Wardens.list) if (w.state !== 'ko' && w.state !== 'dead') out.push({ x: w.x, y: w.y, kind: 'warden', o: w });
    for (const r of Bikes.riders) if (!(r.ko > 0) && !r.away) { const p = Bikes.riderPos(r); out.push({ x: p.x, y: p.y, kind: 'biker', o: r }); }
    for (const u of this.units) if (!u.ko) out.push({ x: u.x, y: u.y, kind: 'unit', o: u });
    for (const h of Hunters.list) if (!h.ko) out.push({ x: h.x, y: h.y, kind: 'hunter', o: h });
    if (World.dusty && !Weed.dustyKO.ko && !Interior.active) out.push({ x: World.dusty.x, y: World.dusty.y, kind: 'dusty', o: Weed.dustyKO });
    if (Interior.active && typeof Staff !== 'undefined') {
      const spots = { shop: World.shopkeeper, ranger: World.ranger, store: World.clerk, bikes: World.revs, clinic: World.nurse };
      for (const st of Staff.list) if (st.b === Interior.active.b && Staff.onShift(st.type) && !st.ko) { const sp = spots[st.type]; out.push({ x: sp.x, y: sp.y, kind: 'staff', o: st }); }
    }
    return out;
  },

  hitPerson(x, y, scoped) {
    let best = null, bd = scoped ? 0.6 : 0.85;
    for (const t of this.targets()) { const d = U.dist(t.x, t.y, x, y); if (d < bd) { bd = d; best = t; } }
    if (!best) return false;
    this.knockOut(best, 1, true); // bullets kill
    return true;
  },

  // A shooting: someone's dead. Self-defence (mobs, angry hunters) is manslaughter; anything else is murder.
  kill(t) {
    const o = t.o, self = o.angry > 0 || !!o.mob, cop = t.kind === 'unit' || t.kind === 'warden';
    const rap = this.rap || (this.rap = { ko: 0, cops: 0, booms: 0, thefts: 0 });
    if (self) rap.mansl = (rap.mansl || 0) + 1; else if (cop) rap.copKills = (rap.copKills || 0) + 1; else rap.kills = (rap.kills || 0) + 1;
    o.angry = 0; o.mob = false;
    Rep.add(self ? -6 : -20);
    Sfx.slap(1); Sfx.thunk(); Sfx.tone(70, 0.8, 0.3, 'sine', 40);
    const name = o.name || (t.kind === 'unit' ? 'An officer' : t.kind === 'dusty' ? 'Dusty' : 'Someone');
    if (t.kind === 'npc') {
      const fish = (o.creel || []).concat(o.held ? [{ id: o.held.sp.id, kg: o.held.kg, cm: o.held.cm, value: Menus.value(o.held.sp, o.held.kg, o.held.prized) }] : []);
      fish.forEach((f, i) => this.drop(o.x + Math.cos(i * 2.1) * 0.7, o.y + Math.sin(i * 2.1) * 0.7, f));
      o.creel = []; o.held = null; o.fish = null; o.lure = null; o.goingBush = false; o.goingHome = false;
      o.state = 'dead'; o.deadT = 60; o.bubbleT = 0;
    } else if (t.kind === 'warden') { o.state = 'dead'; o.deadDay = Game.env.day; }
    else if (t.kind === 'unit') { o.ko = true; o.koT = 0; }
    else if (t.kind === 'biker') { o.ko = 1e9; o.dead = true; o.chaseT = 0; }
    else if (t.kind === 'hunter') { o.ko = true; o.koT = -1e9; o.dead = true; }
    else if (t.kind === 'dusty') {
      o.ko = true; o.koT = -1e9; o.dead = true; o.deadDay = Game.env.day;
      const bags = 1 + ((Math.random() * 3) | 0); Game.weed = (Game.weed || 0) + bags;
    } else if (t.kind === 'staff') {
      o.ko = false; o.quit = true; o.hireIn = 3; o.state = 'gone'; o.dead = true;
      Staff.news.push(o.b.name + ' is shut — ' + o.name + ' was killed behind the counter. The town is in shock.');
    }
    if (!self) Thief.record('murder', name);
    this.crime(self ? 1 : cop ? 3 : 2.5);
    Hud.toast(self ? name + ' is dead. Self-defence… the judge might see it that way.' : name + ' is DEAD. That\'s murder.', UI.bad, 3);
    this.panic(t.x, t.y);
  },

  knockOut(t, crime = 1, lethal = false) {
    if (lethal) return this.kill(t);
    const o = t.o;
    if (!(o.angry > 0) && !o.mob) Rep.add(t.kind === 'unit' || t.kind === 'warden' ? -3 : -5); // decking innocent people goes down badly
    if (o.angry > 0) { crime *= 0.3; o.angry = 0; } // they were shooting at you
    const rap = this.rap || (this.rap = { ko: 0, cops: 0, booms: 0, thefts: 0 });
    if (t.kind === 'unit' || t.kind === 'warden') rap.cops++; else rap.ko++;
    Sfx.slap(1); Sfx.thunk();
    if (t.kind === 'npc') {
      // Their catch hits the dirt.
      const fish = (o.creel || []).concat(o.held ? [{ id: o.held.sp.id, kg: o.held.kg, cm: o.held.cm, value: Menus.value(o.held.sp, o.held.kg, o.held.prized) }] : []);
      fish.forEach((f, i) => this.drop(o.x + Math.cos(i * 2.1) * 0.7, o.y + Math.sin(i * 2.1) * 0.7, f));
      o.creel = []; o.held = null; o.fish = null; o.lure = null; o.goingBush = false;
      if (o.mob) crime *= 0.3; // self-defence, mostly
      o.mob = false; o.state = 'ko'; o.t = 35; Npcs.say(o, U.pick(Math.random, SAY_W.ko), 2);
      Hud.toast(o.name + ' is knocked out' + (fish.length ? ' — dropped ' + fish.length + ' fish' : '') + '!', UI.bad, 2);
      this.crime(1.3 * crime);
    } else if (t.kind === 'warden') { o.state = 'ko'; o.t = 0; this.crime(1.6 * crime); }
    else if (t.kind === 'biker') { o.ko = 25; this.crime(1.3 * crime); }
    else if (t.kind === 'dusty') {
      o.ko = true; o.koT = 0; this.crime(1.2 * crime);
      // He drops what he was carrying.
      const bags = 1 + ((Math.random() * 3) | 0); Game.weed = (Game.weed || 0) + bags;
      Hud.toast('Dusty goes down — and ' + bags + ' bag' + (bags > 1 ? 's' : '') + ' of weed fall out of his jacket. Into your pocket they go.', UI.bad, 2.6);
    } else if (t.kind === 'staff') {
      o.ko = true; o.koT = 0; this.crime(1.5 * crime);
      Hud.toast((Staff.onShift(o.type) || o.name) + ' is out cold behind the counter. The shop\'s shut till they come round.', UI.bad, 2.6);
    } else { o.ko = true; o.koT = 0; this.crime(0.8 * crime); }
    this.panic(t.x, t.y);
  },

  // Bystanders scatter or, now and then, pull a gun.
  panic(x, y) {
    for (const n of Npcs.list) {
      if (['ko', 'home', 'bush', 'armed'].includes(n.state) || U.dist(n.x, n.y, x, y) > 22) continue;
      if (Math.random() < 0.35) this.arm(n);
      else if (['wait', 'cast', 'chat', 'show'].includes(n.state)) { n.lure = null; n.casts = 0; n.state = 'cast'; n.t = 0; Npcs.say(n, U.pick(Math.random, ['AAAH!', 'He\'s got a gun!', 'RUN!']), 2); }
    }
  },

  arm(n) {
    n.state = 'armed'; n.armT = 18 + Math.random() * 10; n.shootCD = 1 + Math.random(); n.lure = null; n.fish = null;
    Npcs.say(n, U.pick(Math.random, SAY_W.draw), 2.6);
  },

  crime(amount) {
    const before = this.level;
    this.heat = Math.min(5.99, Math.max(this.heat + amount, 1));
    this.peak = Math.max(this.peak || 0, this.heat);
    this.level = Math.floor(this.heat);
    this.lastSeen = 0;
    if (this.level > before) { Sfx.tone(880, 0.12, 0.2, 'square'); setTimeout(() => Sfx.tone(660, 0.12, 0.2, 'square'), 140); }
  },

  onGunshot(x, y) {
    // Firing anywhere near people draws attention.
    const near = Npcs.list.some((n) => n.state !== 'home' && U.dist(n.x, n.y, x, y) < 20) || Wardens.list.some((w) => U.dist(w.x, w.y, Player.x, Player.y) < 25);
    if (near && this.level === 0) this.crime(0.6);
    // Pointing a gun at anglers can make them draw theirs.
    for (const n of Npcs.list) {
      if (n.state === 'armed' || n.state === 'ko' || n.state === 'home') continue;
      if (U.dist(n.x, n.y, x, y) < 6 && Math.random() < 0.4) this.arm(n);
    }
  },

  // ---------- fish on the ground ----------
  drop(x, y, f) {
    const geo = new THREE.PlaneGeometry(1, 0.5); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: Actors.portrait(SPECIES_BY_ID[f.id]), transparent: true, alphaTest: 0.1 }));
    const len = U.clamp(f.cm / 100 * 1.3, 0.4, 1.6);
    m.scale.set(len, 1, len); m.position.set(x, Scene3D.groundH(x, y) + 0.05, y); m.rotation.y = Math.random() * 6.28;
    this.group.add(m);
    this.drops.push({ x, y, f, m, t: 0 });
  },

  // ---------- the law closing in ----------
  isHidden() {
    if (Interior.active) return true;
    const px = Math.floor(Player.x), py = Math.floor(Player.y);
    for (let y = py - 1; y <= py + 1; y++) for (let x = px - 1; x <= px + 1; x++) {
      if (World.objAt(x, y) === O.BUSH && U.dist(Player.x, Player.y, x + 0.5, y + 0.5) < 1.05) return true;
    }
    return Player.crouch && World.tileAt(px, py) === T.FOREST;
  },

  spawnUnit() {
    const army = this.level >= 4;
    for (let t = 0; t < 30; t++) {
      const a = Math.random() * 6.28, d = 30 + Math.random() * 12;
      const x = Player.x + Math.cos(a) * d, y = Player.y + Math.sin(a) * d;
      if (World.blocked(x, y) || World.isWater(x, y)) continue;
      const mesh = Models.person(army ? ARMY_PAL : COP_PAL), gun = this.gunMesh(army);
      this.group.add(mesh, gun);
      this.units.push({ x, y, army, mesh, gun, face: a + Math.PI, walk: 0, cd: 2 + Math.random(), ko: false, koT: 0, bubble: null, bubbleT: 0, stuck: 0 });
      return;
    }
  },

  removeUnit(u) { this.group.remove(u.mesh, u.gun); this.units.splice(this.units.indexOf(u), 1); },

  update(dt) {
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.pendingArrest && !Menus.open && !this.blackingOut) {
      const p = this.pendingArrest; this.pendingArrest = null;
      for (const m of this.escort || []) this.group.remove(m);
      this.escort = null;
      this.rap = p.rap; this.peak = p.peak; this.heat = p.level; this.level = p.level;
      Hud.toast('"You\'re coming with us." The officers cuff you on the way out of the clinic.', UI.bad, 3);
      this.arrest();
      return;
    }
    this.hidden = this.isHidden();
    // Seen by any conscious unit (or a chasing warden) close enough, unless hidden.
    this.seen = this.level > 0 && this.units.some((u) => !u.ko && U.dist(u.x, u.y, Player.x, Player.y) < (this.hidden ? 2.2 : 18));
    this.lastSeen = this.seen ? 0 : this.lastSeen + dt;
    if (this.level > 0 && this.lastSeen > (this.hidden ? 4 : 10)) {
      this.heat = Math.max(0, this.heat - dt / (this.hidden ? 5 : 9));
      const lv = Math.floor(this.heat);
      if (lv < this.level) { this.level = lv; Hud.toast(lv ? 'Wanted level dropping…' : 'You lost them. Wanted level cleared.', lv ? UI.accent : UI.good, 2); }
      if (lv === 0) { this.rap = null; this.peak = 0; } // got away with it
    }
    if (this.level === 0 && Game.food > 0) this.health = Math.min(100, this.health + dt * 4);
    // Keep the right number of units on the hunt.
    this.spawnT -= dt;
    const want = UNITS_FOR[this.level], awake = this.units.filter((u) => !u.ko).length;
    if (this.spawnT <= 0 && awake < want) { this.spawnT = 2.5; this.spawnUnit(); }
    for (const u of this.units.slice()) {
      u.bubbleT = Math.max(0, u.bubbleT - dt);
      if (u.ko) { u.koT += dt; if (u.koT > 12) this.removeUnit(u); continue; }
      const d = U.dist(u.x, u.y, Player.x, Player.y);
      if (this.level === 0) { // stand down and walk off
        u.leaveT = (u.leaveT || 0) + dt;
        if (u.leaveT > 8 || d > 60) { this.removeUnit(u); continue; }
        this.step(u, u.x + Math.cos(u.face) * 5, u.y + Math.sin(u.face) * 5, 2.5, dt);
        continue;
      }
      const sees = d < (this.hidden ? 2.2 : 18);
      if (sees && !u.spotted) { u.spotted = true; u.bubble = U.pick(Math.random, u.army ? SAY_W.army : SAY_W.cop); u.bubbleT = 2; }
      // Close in to firing range, or search where the player was last seen.
      const keep = u.army ? 9 : 6;
      if (sees && d > keep) this.step(u, Player.x, Player.y, u.army ? 4.6 : 3.9, dt);
      else if (!sees) this.step(u, Player.x + Math.cos(u.face * 3) * 6, Player.y + Math.sin(u.face * 3) * 6, 2.6, dt);
      else u.face = Math.atan2(Player.y - u.y, Player.x - u.x);
      // Police tackle you if they reach you (not the army).
      if (!u.army && sees && d < 1.2 && !Player.rolling) { this.arrest(); return; }
      u.cd -= dt;
      if (sees && d < 18 && u.cd <= 0) { u.cd = u.army ? 0.9 + Math.random() * 0.6 : 1.6 + Math.random(); this.fireAt(u.x, u.y, u.army ? 0.5 : 0.32, u.army ? 18 : 11, u.army ? 'army gunfire' : 'police gunfire'); }
    }
    // Armed anglers.
    for (const n of Npcs.list) {
      if (n.state === 'dead') {
        n.deadT -= dt;
        if (n.deadT <= 0) { n.state = 'home'; n.away = true; n.dead = true; } // the body's taken away
        continue;
      }
      if (n.state === 'ko') {
        n.t -= dt;
        if (n.t <= 0) { n.state = 'cast'; n.casts = 0; n.t = 1; Npcs.say(n, 'Ugh… my head.', 2.5); }
        continue;
      }
      if (n.state !== 'armed') continue;
      n.armT -= dt; n.face = Math.atan2(Player.y - n.y, Player.x - n.x);
      const d = U.dist(n.x, n.y, Player.x, Player.y);
      const threat = Gun.out && d < 14 && !this.hidden;
      if (n.armT <= 0 && !threat) { n.state = 'cast'; n.casts = 0; n.t = 1; Npcs.say(n, 'That\'s what I thought.', 2.5); continue; }
      n.shootCD -= dt;
      if (threat && n.shootCD <= 0) { n.shootCD = 1.6 + Math.random() * 1.2; this.fireAt(n.x, n.y, 0.3, 10, n.name + '\'s pistol'); }
    }
    for (const w of Wardens.list) if (w.state === 'ko') { w.t += dt; if (w.t > 30) { w.state = 'patrol'; w.t = 0; } }
    // Pick up dropped fish by walking over them.
    for (const d of this.drops.slice()) {
      d.t += dt;
      if (d.t > 120) { this.group.remove(d.m); this.drops.splice(this.drops.indexOf(d), 1); continue; }
      if (U.dist(d.x, d.y, Player.x, Player.y) < 1 && !Bikes.riding) {
        if (Game.creel.length >= Game.creelMax) { if (!d.warned) { d.warned = true; Hud.toast('Your creel is full.', UI.muted, 1.4); } continue; }
        Game.creel.push(d.f); this.group.remove(d.m); this.drops.splice(this.drops.indexOf(d), 1);
        Sfx.coin(); Hud.toast('Picked up a ' + U.fmtKg(d.f.kg) + ' ' + SPECIES_BY_ID[d.f.id].name + ' (finders keepers…)', UI.good, 1.8);
      }
    }
  },

  step(u, tx, ty, speed, dt) {
    const base = Math.atan2(ty - u.y, tx - u.x);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 2]) {
      const a = base + off, nx = u.x + Math.cos(a) * speed * dt, ny = u.y + Math.sin(a) * speed * dt;
      if (!World.blocked(nx, ny)) { u.x = nx; u.y = ny; u.face = a; u.walk += dt; return; }
    }
  },

  fireAt(x, y, chance, dmg, src = 'a stray bullet') {
    const hit = Math.random() < chance * (Player.moving ? 0.7 : 1) * (Player.crouch ? 0.8 : 1) * (Bikes.riding ? 0.6 : 1);
    const tx = Player.x + (hit ? 0 : (Math.random() - 0.5) * 3), ty = Player.y + (hit ? 0 : (Math.random() - 0.5) * 3);
    const t = this.tracers.find((q) => q.userData.t >= 1) || this.tracers[0];
    t.geometry.setFromPoints([new THREE.Vector3(x, Scene3D.standH(x, y) + 0.75, y), new THREE.Vector3(tx, Scene3D.standH(tx, ty) + 0.6, ty)]);
    t.userData.t = 0; t.visible = true;
    const near = U.dist(x, y, Player.x, Player.y);
    Sfx.gunshot('enemy', U.clamp(1 - near / 45, 0.12, 1));
    if (hit) this.hurt(dmg, src); else Hud.ripple(tx, ty, 0.3);
  },

  hurt(dmg, src = 'mystery injuries') {
    this.health -= dmg; this.hurtT = 0.4; Bugs.shake = 1; Sfx.slap(1);
    this.logDamage(src, dmg);
    if (this.health <= 0) this.wasted();
  },

  // What's been hurting you since you were last patched up (for the nurse's report).
  logDamage(src, dmg) {
    const log = this.dmgLog || (this.dmgLog = {});
    log[src] = (log[src] || 0) + dmg;
    this.lastHit = src;
  },

  clear() {
    this.heat = 0; this.level = 0; this.rap = null; this.peak = 0; this.seen = false; this.lastSeen = 999;
    for (const r of Bikes.riders) r.chaseT = 0;
    for (const u of this.units.slice()) this.removeUnit(u);
    for (const n of Npcs.list) if (n.state === 'armed') { n.state = 'cast'; n.casts = 0; n.t = 1; }
  },

  // The bigger the rampage, the longer the stretch: days, weeks, months — or years.
  arrest() {
    const R = this.rap || {}, peak = Math.max(this.level, Math.floor(this.peak || 0));
    const ko = R.ko || 0, cops = R.cops || 0, booms = R.booms || 0, thefts = R.thefts || 0, kills = R.kills || 0, copKills = R.copKills || 0, mansl = R.mansl || 0;
    const reasons = [];
    if (copKills) reasons.push('Murder of a police officer ×' + copKills);
    if (kills) reasons.push('Murder ×' + kills);
    if (mansl) reasons.push('Manslaughter ×' + mansl);
    if (cops) reasons.push('Assaulting officers ×' + cops);
    if (ko) reasons.push('Assault ×' + ko);
    if (booms) reasons.push('Use of explosives ×' + booms);
    if (thefts) reasons.push('Vehicle theft ×' + thefts);
    if (peak > 0) reasons.push('Firearms offences (wanted level ' + peak + ')');
    let days = [1, 2, 5, 14, 75, 300][peak] + ko * 4 + cops * 25 + booms * 45 + thefts * 10;
    if (peak >= 5 && (cops >= 3 || booms >= 2)) days += 365 * (1 + Math.floor(cops / 3) + Math.floor(booms / 2));
    days += kills * 365 * 8 + copKills * 365 * 15 + mansl * 365 * 2;
    days = Math.min(365 * 60, Math.round(days));
    this.clear();
    Jail.sentence(reasons, null, days);
  },

  wasted() {
    if (this.blackingOut) return;
    this.blackingOut = true;
    const log = this.dmgLog || {}, last = this.lastHit || 'something nasty';
    this.dmgLog = {};
    const robbed = Thief.robOnBlackout();
    const bill = Math.min(Game.money, 40 + Math.round(Game.money * 0.15));
    Game.money -= bill;
    // Wanted when you went down? The cops will be waiting when you wake up.
    this.pendingArrest = this.level > 0 ? { rap: this.rap, peak: Math.max(this.peak || 0, this.heat), level: this.level } : null;
    this.clear(); this.health = 100; Game.poison = null;
    if (Bikes.riding) Bikes.dismount();
    Fishing.reelInFast();
    if (Menus.open) Menus.close();
    Sfx.fail();
    const fade = document.getElementById('sleepFade');
    fade.textContent = 'You blacked out…'; fade.classList.add('on');
    setTimeout(() => {
      Life.passHours(6, 0);
      if (Interior.active) Interior.exit();
      const clinic = World.buildings.find((x) => x.type === 'clinic');
      if (clinic) { Interior.enter(clinic); Player.place(World.nurse.x + 1.3, World.nurse.y + 1.4); }
      else Player.place(World.tim.x + 1, World.tim.y + 1.5);
      fade.classList.remove('on');
      this.blackingOut = false;
      this.clear(); // anything that went off while you were out doesn't count
      if (this.pendingArrest && clinic) {
        // Two officers waiting by the cot.
        this.escort = [standee(COP_PAL, World.nurse.x + 2.6, World.nurse.y + 1.2, Math.PI), standee(COP_PAL, World.nurse.x + 0.4, World.nurse.y + 2.4, 0)];
        this.escort.forEach((m) => this.group.add(m));
      }
      Clinic.wakeUp(log, last, bill, !!this.pendingArrest, robbed);
      Game.save();
    }, 1800);
  },

  // ---------- drawing ----------
  render(dt) {
    const v = new THREE.Vector3();
    const lie = (rig, down) => { rig.lean.rotation.x = down ? -1.5 : -0.38; };
    for (const n of Npcs.list) {
      if (!n.rig) continue;
      lie(n.rig, n.state === 'ko' || n.state === 'dead');
      if (n.state === 'ko' || n.state === 'dead' || n.state === 'armed') { n.rod.visible = n.line.visible = n.bob.visible = false; n.heldMesh.visible = false; }
      if (n.state === 'armed') { n.rig.yaw.rotation.y = -n.face; Models.pose(n.rig, { pose: 'grip', t: Game.time }); }
      if (!n.pistol) { n.pistol = this.gunMesh(false); this.group.add(n.pistol); }
      n.pistol.visible = n.state === 'armed' && n.mesh.visible;
      if (n.pistol.visible) { Models.handPos(n.rig, v); n.pistol.position.copy(v); n.pistol.rotation.set(0, -n.face, 0); }
    }
    for (const w of Wardens.list) lie(w.mesh.userData.rig, w.state === 'ko' || w.state === 'dead');
    for (const r of Bikes.riders) {
      const down = r.ko > 0;
      lie(r.mesh.userData.rig, down);
      if (down) { r.mesh.position.set(r.x + 0.7, Scene3D.standH(r.x, r.y) + 0.05, r.y + 0.5); Models.pose(r.mesh.userData.rig, { t: 0 }); }
    }
    for (const u of this.units) {
      const vis = U.dist(u.x, u.y, Player.x, Player.y) < 60 && !Interior.active;
      u.mesh.visible = vis; u.gun.visible = vis && !u.ko;
      if (!vis) continue;
      u.mesh.position.set(u.x, Scene3D.standH(u.x, u.y), u.y);
      const rig = u.mesh.userData.rig;
      lie(rig, u.ko);
      rig.yaw.rotation.y = -u.face;
      Models.pose(rig, { moving: !u.ko, phase: u.walk, t: Game.time, pose: 'grip' });
      if (!u.ko) { Models.handPos(rig, v); u.gun.position.copy(v); u.gun.rotation.set(0, -u.face, 0); }
    }
    for (const d of this.drops) d.m.rotation.z = Math.sin(Game.time * 12 + d.x) * (d.t < 6 ? 0.25 : 0.05); // flopping
    for (const t of this.tracers) {
      if (t.userData.t >= 1) { t.visible = false; continue; }
      t.userData.t += dt / 0.12; t.material.opacity = 1 - t.userData.t;
    }
  },

  drawHud(hud) {
    const g = hud.g, W = hud.W, H = hud.H;
    // Getting hit flashes the screen edges red.
    if (this.hurtT > 0 || this.health < 40) {
      const k = Math.max(this.hurtT * 2, (40 - this.health) / 80);
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      gr.addColorStop(0, 'rgba(200,20,20,0)'); gr.addColorStop(1, 'rgba(200,20,20,' + U.clamp(k, 0, 0.6).toFixed(2) + ')');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    // Wanted level: its own big star banner, top middle.
    if (this.level > 0) {
      const flash = this.seen && Math.sin(Game.time * 10) > 0, size = 46, gap = 50;
      const cx = W / 2, y = 58;
      g.save();
      g.font = '400 ' + size + 'px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = '#1a1410';
      for (let i = 0; i < 5; i++) {
        const x = cx + (i - 2) * gap, on = i < this.level;
        const pop = on && i === this.level - 1 ? 1 + Math.max(0, (this.popT || 0)) * 0.6 : 1;
        g.save(); g.translate(x, y); g.scale(pop, pop);
        g.strokeText('★', 0, 0);
        g.fillStyle = on ? (flash ? '#FFFFFF' : '#FFD447') : 'rgba(255,255,255,0.22)';
        g.fillText('★', 0, 0);
        g.restore();
      }
      g.restore();
      hud.pill(this.hidden ? '🌿 Hidden — stay put' : this.seen ? 'SPOTTED!' : 'Searching…', cx, y + 40, this.hidden ? UI.good : this.seen ? UI.bad : UI.accent, 12);
    }
    this.popT = Math.max(0, (this.popT || 0) - 1 / 60 * 2);
    if (this.level !== this.lastLevel) { if (this.level > (this.lastLevel || 0)) this.popT = 0.5; this.lastLevel = this.level; }
    document.body.classList.toggle('wanted', this.level > 0);
  },

  // Things pinned to the world (drawn before the HUD is scaled for phones).
  drawWorld(hud) {
    for (const n of Npcs.list) {
      if (n.state !== 'ko' || U.dist(n.x, n.y, Player.x, Player.y) > 25) continue;
      const [sx, sy, ok] = Scene3D.project(n.x, n.y, Scene3D.standH(n.x, n.y) + 0.6);
      if (ok) hud.text('💫', sx, sy, '#fff', 18, 'center');
    }
    for (const u of this.units) {
      if (u.bubbleT <= 0 || u.ko || U.dist(u.x, u.y, Player.x, Player.y) > 30) continue;
      const [sx, sy, ok] = Scene3D.project(u.x, u.y, Scene3D.standH(u.x, u.y) + 1.9);
      if (ok) hud.pill(u.bubble, sx, sy, UI.bad, 12);
    }
  },
};
