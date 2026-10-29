// Nature calls. Bladder and bowels fill up over time; find a bush, a loo, or dig a hole with the spade.
// Leave it too long and you'll have an accident (and smell like it).
'use strict';

const Needs = {
  group: null, spade: null, dirty: true, busy: false, smellT: 0,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    if (!this.spade) {
      const P = (geo, c, o = 0.1) => Models.part(geo, c, o);
      this.spade = new THREE.Group();
      const shaft = P(new THREE.CylinderGeometry(0.022, 0.022, 0.75, 8), '#8A5A30'); shaft.position.y = 0.3; this.spade.add(shaft);
      const grip = P(new THREE.BoxGeometry(0.16, 0.04, 0.04), '#5A3A1A'); grip.position.y = 0.68; this.spade.add(grip);
      const blade = P(new THREE.BoxGeometry(0.18, 0.22, 0.03), '#9AA3AA'); blade.position.y = -0.15; this.spade.add(blade);
      this.spade.scale.setScalar(1.2); this.spade.visible = false;
    }
    Scene3D.scene.add(this.spade);
    Game.holes = (Game.holes || []).filter((h) => Game.env.day - h.day < 2);
    Game.poos = (Game.poos || []).filter((h) => Game.env.day - h.day < 2);
    Game.smears = (Game.smears || []).filter((h) => Game.env.day - h.day < 2);
    this.dirty = true;
  },

  // ---------- filling up ----------
  update(dt) {
    if (this.busy) return;
    const full = 0.45 + (Game.food || 0) / 100; // the more you've got in you, the more wants out
    Game.bladder = Math.min(100, (Game.bladder || 0) + dt * 0.2 * full);
    Game.bowels = Math.min(100, (Game.bowels || 0) + dt * 0.09 * full);
    for (const [k, name] of [['bladder', 'wee'], ['bowels', 'poo']]) {
      const v = Game[k], warn = 'warn_' + k;
      if (v > 80 && !this[warn]) { this[warn] = true; Hud.toast(k === 'bladder' ? 'You really need a wee. Find a bush (E).' : 'You REALLY need to go. Dig a hole with the spade (6), or find a loo.', '#F2C14E', 2.6); }
      if (v < 70) this[warn] = false;
      if (v >= 100) this.accident(k);
    }
    // People who saw you don't let it go.
    this.mockT = (this.mockT || 6) - dt;
    if (this.mockT <= 0) {
      this.mockT = 10 + Math.random() * 12;
      const n = Npcs.list.find((x) => x.mocked > Game.time && !x.away && ['cast', 'wait', 'walk'].includes(x.state) && U.dist(x.x, x.y, Player.x, Player.y) < 12);
      if (n) Npcs.say(n, U.pick(Math.random, MOCKS), 2.6);
    }
    this.squelch(dt);
    // Stinky: locals notice, a wade in the water fixes it.
    if (this.smellT > 0) {
      this.smellT -= dt;
      if (Player.wading) { this.smellT = 0; Hud.toast('A good scrub in the water. You no longer smell like a disaster.', UI.good, 2.2); }
      if (Math.random() < dt * 0.15) {
        const n = Npcs.list.find((x) => !x.away && ['cast', 'wait', 'walk'].includes(x.state) && U.dist(x.x, x.y, Player.x, Player.y) < 6);
        if (n) Npcs.say(n, U.pick(Math.random, ['PHWOAR! What is that SMELL?', 'Mate… have a wash.', 'Did something die?']), 2);
      }
    }
  },

  urgent() { return Math.max(Game.bladder || 0, Game.bowels || 0) > 85; },
  passHours(h) { // sleeping, jail, montages: you wake up needing to go, but it doesn't happen in bed
    Game.bladder = Math.min(85, (Game.bladder || 0) + h * 10);
    Game.bowels = Math.min(85, (Game.bowels || 0) + h * 4.5);
  },
  afterMeal(food) { Game.bowels = Math.min(100, (Game.bowels || 0) + food * 0.25); },

  witnesses(r = 9) {
    return Npcs.list.filter((n) => !n.away && !['home', 'bush', 'ko'].includes(n.state) && U.dist(n.x, n.y, Player.x, Player.y) < r)
      .concat(Wardens.list.filter((w) => w.state !== 'ko' && U.dist(w.x, w.y, Player.x, Player.y) < r));
  },
  bushNear() {
    const px = Math.floor(Player.x), py = Math.floor(Player.y);
    for (let y = py - 1; y <= py + 1; y++) for (let x = px - 1; x <= px + 1; x++) {
      if (!World.inB(x, y)) continue;
      const o = World.obj[World.idx(x, y)];
      if (o === O.BUSH || o === O.PINE || o === O.OAK) return true;
    }
    return false;
  },
  holeNear() { return (Game.holes || []).find((h) => !h.used && U.dist(h.x, h.y, Player.x, Player.y) < 1.4); },

  // ---------- doing your business ----------
  act(kind, label, secs, done) {
    this.busy = true; Menus.open = 'busy';
    // Stand to wee, squat to poo (a loo is a seat either way).
    const was = Player.crouch; Player.crouch = kind === 'bowels' && !Interior.active;
    this.acting = { kind, t0: performance.now(), secs, loo: !!Interior.active };
    Hud.toast(label, UI.muted, secs);
    const snd = this.sounds(kind, secs);
    setTimeout(() => {
      snd.forEach(clearTimeout); clearInterval(snd.loop); Player.crouch = was; this.acting = null;
      this.busy = false; if (Menus.open === 'busy') Menus.open = null;
      done();
      Game.save();
    }, secs * 1000);
  },

  // Proper bathroom foley. Returns the timers so the action can stop them.
  sounds(kind, secs) {
    const T = [], at = (ms, fn) => T.push(setTimeout(fn, ms));
    const grunt = (f, d) => { if (!Sfx.ctx) return; const c = Sfx.ctx, t = c.currentTime, o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.85, t + d);
      bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 3; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(bp).connect(g).connect(Sfx.master); o.start(t); o.stop(t + d + 0.05); };
    if (kind === 'bladder') {
      at(0, () => Sfx.burst(0.18, 3000, 0.12, 'bandpass', 2, 6000)); // zip
      // A steady trickle: a stream of tiny filtered splashes, tapering off at the end.
      let n = 0; T.loop = setInterval(() => { n++; const k = Math.max(0.15, 1 - n * 0.07 / secs * 1.4); Sfx.burst(0.09, 2200 + Math.sin(n * 0.7) * 500 + Math.random() * 300, 0.07 * k, 'bandpass', 5); if (n % 3 === 0) Sfx.burst(0.05, 900, 0.03 * k, 'lowpass'); }, 60);
      at(secs * 1000 - 300, () => { clearInterval(T.loop); Sfx.burst(0.05, 2000, 0.04, 'bandpass', 4); });
      at(secs * 1000 - 120, () => Voice.babble('Ahhh', Player.x, Player.y, 'You'));
    } else {
      at(0, () => grunt(120, 0.45)); at(700, () => grunt(105, 0.6));
      at(1450, () => { Sfx.tone(140, 0.12, 0.25, 'sine', 60); Sfx.burst(0.12, 700, 0.18, 'lowpass', 0.8, 200); }); // plop
      at(1950, () => { Sfx.tone(120, 0.14, 0.22, 'sine', 50); Sfx.burst(0.14, 600, 0.16, 'lowpass', 0.8, 160); });
      at(2350, () => Sfx.burst(0.35, 400, 0.08, 'lowpass', 1, 120)); // …and a parp
      at(secs * 1000 - 300, () => Voice.babble('Phew!', Player.x, Player.y, 'You'));
    }
    return T;
  },

  wee() {
    const behind = this.bushNear(), seen = behind ? [] : this.witnesses(), water = World.isWater(Player.x + Math.cos(Player.face) * 1.2, Player.y + Math.sin(Player.face) * 1.2);
    this.act('bladder', behind ? 'Ahh… behind the bush.' : 'Ahhhh…', 2.4, () => {
      Game.bladder = 0;
      if (water) { Fish.spookNear(Player.x, Player.y, 8); Hud.toast('…in the lake. The fish will remember this.', UI.muted, 2); }
      if (seen.length) {
        const n = seen[0];
        if (n.name && Npcs.list.includes(n)) Npcs.say(n, U.pick(Math.random, ['OI! Put that away!', 'There are CHILDREN about!', 'Disgusting!']), 2.4);
        Rep.add(-3); Hud.toast((n.name || 'Someone') + ' saw that. Not a great look.', UI.bad, 2.2);
        this.shamed(seen, 'wee');
      }
    });
  },

  poo() {
    const hole = this.holeNear(), seen = this.bushNear() ? [] : this.witnesses();
    this.act('bowels', hole ? 'Squatting over your hole…' : 'Squatting… no hole, no shame.', 3.2, () => {
      Game.bowels = 0;
      if (hole) { hole.used = true; Hud.toast('Done, and buried. Leave no trace.', UI.good, 2); this.dirty = true; return; }
      (Game.poos = Game.poos || []).push({ x: Player.x - Math.cos(Player.face) * 0.3, y: Player.y - Math.sin(Player.face) * 0.3, day: Game.env.day });
      this.dirty = true;
      if (seen.length) {
        const n = seen[0];
        if (n.name && Npcs.list.includes(n)) Npcs.say(n, U.pick(Math.random, ['ARE YOU SERIOUS?!', 'Not on the GRASS!', 'I\'m calling the council!']), 2.6);
        Rep.add(-6); Hud.toast('In full view of ' + (n.name || 'the public') + '. The town will be talking about this.', UI.bad, 2.6);
        this.shamed(seen, 'poo');
      } else { Rep.add(-1); Hud.toast('You leave it there for someone to step in. (Dig a hole next time.)', UI.muted, 2.2); }
    });
  },

  useLoo(foreign) {
    const both = (Game.bladder || 0) > 15 || (Game.bowels || 0) > 15;
    if (!both) { Hud.toast('You don\'t need to go right now.', UI.muted, 1.4); return; }
    this.act((Game.bowels || 0) > (Game.bladder || 0) ? 'bowels' : 'bladder', foreign ? 'Using their loo. Bold.' : 'Ahh, a proper loo.', 2.6, () => {
      Game.bladder = 0; Game.bowels = 0;
      Sfx.burst(1.2, 700, 0.25, 'lowpass', 0.8, 200); // flush
      Hud.toast(foreign ? 'Flushed. You even put the seat down.' : 'Much better.', UI.good, 1.8);
    });
  },

  // Everyone who saw remembers, and won't let you forget it for a while.
  shamed(seen, what) {
    Game.shame = (Game.shame || 0) + (what === 'poo' ? 2 : 1);
    seen.filter((n) => Npcs.list.includes(n)).forEach((n, i) => {
      n.mocked = Game.time + 600;
      if (i > 0) setTimeout(() => { if (!n.away) Npcs.say(n, U.pick(Math.random, MOCKS), 2.4); }, 900 * i);
    });
    setTimeout(() => Sfx.burst(0.5, 1400, 0.08, 'bandpass', 3, 900), 400); // a ripple of laughter
  },

  accident(k) {
    Game[k] = 0;
    this.smellT = 300; Rep.add(-8);
    Sfx.fail();
    Hud.toast(k === 'bladder' ? 'Oh no. You couldn\'t hold it. Your trousers are… damp.' : 'Oh NO. That\'s… that\'s not good. You need a wash. Badly.', UI.bad, 3.2);
    for (const n of this.witnesses(8)) if (n.name && Npcs.list.includes(n)) { Npcs.say(n, 'Oh dear GOD.', 2.2); break; }
  },

  // A mosaic over the business end, with a yellow trickle (wee) or brown drops (poo) peeking out below.
  drawCensor(hud) {
    const A = this.acting; if (!A || A.loo) return;
    const g = hud.g, t = (performance.now() - A.t0) / 1000, k = U.clamp(t / A.secs, 0, 1);
    const wee = A.kind === 'bladder', h = Scene3D.standH(Player.x, Player.y) + (wee ? 0.42 : 0.2);
    const fx = Math.cos(Player.face), fy = Math.sin(Player.face);
    const [sx, sy, ok] = Scene3D.project(Player.x + fx * 0.15, Player.y + fy * 0.15, h); if (!ok) return;
    const [gx, gy] = Scene3D.project(Player.x + fx * (wee ? 0.75 : 0) - (wee ? 0 : fx * 0.1), Player.y + fy * (wee ? 0.75 : 0) - (wee ? 0 : fy * 0.1), Scene3D.groundH(Player.x, Player.y));
    const sc = U.clamp(16 / Scene3D.camDist, 0.6, 1.6);
    // The stream / drops, drawn first so the mosaic sits over its source.
    if (wee && k < 0.92) {
      const flow = Math.min(1, t * 3) * (1 - Math.max(0, k - 0.8) * 5);
      g.strokeStyle = 'rgba(240,215,60,' + (0.85 * flow).toFixed(2) + ')'; g.lineWidth = 3 * sc; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + gx) / 2, Math.min(sy, gy) - 18 * sc, gx, gy); g.stroke();
      // A spreading yellow puddle.
      g.fillStyle = 'rgba(232,212,74,0.55)'; g.beginPath(); g.ellipse(gx, gy, 14 * sc * k + 3, 6 * sc * k + 2, 0, 0, 7); g.fill();
      for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1; g.fillStyle = 'rgba(250,230,90,0.8)'; g.beginPath(); g.arc(gx + Math.cos(a) * 6 * sc, gy - Math.abs(Math.sin(a)) * 5 * sc, 1.6 * sc, 0, 7); g.fill(); }
    } else if (!wee) {
      const n = Math.floor(k * 3.2);
      for (let i = 0; i < n; i++) { g.fillStyle = '#5A3A1A'; g.beginPath(); g.ellipse(gx + (i - 1) * 3 * sc, gy - i * 3 * sc, (7 - i * 1.5) * sc, (4 - i) * sc, 0, 0, 7); g.fill(); }
      const drop = (t * 1.6) % 1;
      if (k < 0.85) { g.fillStyle = '#6A4422'; g.beginPath(); g.ellipse(sx, U.lerp(sy, gy - 6 * sc, drop), 3 * sc, 4 * sc, 0, 0, 7); g.fill(); }
    }
    // The mosaic block itself, tinted to match.
    const pal = wee ? ['#E8D44A', '#F2E27A', '#D9B830', '#E8C08A', '#F4E8B0', '#C9A830'] : ['#7A5230', '#5A3A1A', '#9A6A3A', '#E8C08A', '#6A4422', '#B08050'];
    if (!this.mos || performance.now() - this.mosT > 120) { this.mosT = performance.now(); this.mos = Array.from({ length: 24 }, () => pal[(Math.random() * pal.length) | 0]); }
    const cell = 6 * sc, cols = 6, rows = 4, x0 = sx - cols * cell / 2, y0 = sy - rows * cell / 2;
    this.mos.forEach((c, i) => { g.fillStyle = c; g.fillRect(x0 + (i % cols) * cell, y0 + Math.floor(i / cols) * cell, cell + 0.5, cell + 0.5); });
  },

  // ---------- stepping in it ----------
  walkers() {
    const out = [{ e: Player, who: 'you' }];
    for (const n of Npcs.list) if (!n.away && (n.state === 'walk' || n.state === 'mob')) out.push({ e: n, who: 'npc' });
    for (const st of Staff.list) if (st.state === 'toWork' || st.state === 'toHome') out.push({ e: st, who: 'staff' });
    return out;
  },

  squelch(dt) {
    const poos = Game.poos || [];
    for (const { e, who } of this.walkers()) {
      // Freshly stepped in: leave brown footprints for the next few metres.
      if (e._smear > 0) {
        const d = e._sx === undefined ? 1 : U.dist(e.x, e.y, e._sx, e._sy);
        if (d > 0.55) {
          e._sx = e.x; e._sy = e.y; e._smear--; e._foot = !e._foot;
          const a = (e === Player ? Player.face : e.face || e.heading || 0) + Math.PI / 2, off = e._foot ? 0.1 : -0.1;
          this.addSmear(e.x + Math.cos(a) * off, e.y + Math.sin(a) * off, e === Player ? Player.face : e.face || 0, 0.07);
        }
      }
      if (Interior.active && e === Player) continue;
      for (const p of poos) {
        if (U.dist(e.x, e.y, p.x, p.y) > 0.38 || p.hitBy === e) continue;
        p.hitBy = e; p.smeared = (p.smeared || 0) + 1; e._smear = 10; e._sx = e.x; e._sy = e.y;
        this.addSmear(p.x, p.y, Math.random() * 6, 0.26); // a big skid
        this.dirty = true;
        Sfx.burst(0.25, 500, 0.2, 'lowpass', 1.2, 150);
        if (who === 'you') {
          this.smellT = Math.max(this.smellT, 150);
          Hud.toast(U.pick(Math.random, ['SQUELCH. You stepped right in it.', 'Oh no. Oh no no no. It\'s on your boot.', 'You are now tracking it everywhere.']), UI.bad, 2.2);
        } else {
          // Whoever left it there is in for it — and everyone knows who that was.
          const near = U.dist(e.x, e.y, Player.x, Player.y) < 18;
          if (e.name && Npcs.list.includes(e)) { Npcs.say(e, U.pick(Math.random, ['WHO LEFT THIS HERE?!', 'ARGH! My good boots!', 'Some ANIMAL has been at it again!', 'I KNOW it was you!']), 3); e.mocked = Game.time + 600; }
          if (near) { Rep.add(-2); Hud.toast((e.name || 'Someone') + ' stepped in your mess and is FURIOUS.', UI.bad, 2.4); }
          Game.shame = (Game.shame || 0) + 1;
        }
      }
    }
  },

  addSmear(x, y, ang, r) {
    const s = { x, y, ang, r, day: Game.env.day };
    (Game.smears = Game.smears || []).push(s);
    if (Game.smears.length > 160) { const old = Game.smears.shift(); if (old.mesh) this.group.remove(old.mesh); }
    this.smearMesh(s);
  },

  smearMesh(s) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(s.r, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4A2E14, transparent: true, opacity: 0.75, depthWrite: false }));
    m.scale.set(1, 1, s.r < 0.1 ? 1.6 : 0.7); m.rotation.y = -s.ang;
    m.position.set(s.x, Scene3D.groundH(s.x, s.y) + 0.025, s.y);
    s.mesh = m; this.group.add(m);
  },

  // ---------- the spade ----------
  canDig() {
    if (Interior.active || Bikes.riding || this.busy) return null;
    const x = Player.x + Math.cos(Player.face) * 0.8, y = Player.y + Math.sin(Player.face) * 0.8;
    const t = World.tileAt(Math.floor(x), Math.floor(y));
    if (![T.GRASS, T.MEADOW, T.FOREST, T.SAND, T.MUD].includes(t) || World.blocked(x, y) || World.buildingAt(x, y)) return null;
    if ((Game.holes || []).some((h) => U.dist(h.x, h.y, x, y) < 0.8)) return null;
    return { x, y };
  },

  dig() {
    const at = this.canDig();
    if (!at) { Hud.toast('You can\'t dig there.', UI.muted, 1.2); return; }
    if (Game.energy < 6) { Hud.toast('Too tired to dig.', UI.muted, 1.4); return; }
    Game.energy -= 6;
    this.busy = true; Menus.open = 'busy'; this.digT = 0; this.digAt = at; this.digStart = performance.now();
    const thunk = setInterval(() => { Sfx.thunk(); Sfx.burst(0.15, 600, 0.15, 'lowpass', 0.7, 200); this.digT += 0.4; if (Gun.puffs) Gun.puff(at.x, at.y, false); }, 420);
    setTimeout(() => {
      clearInterval(thunk); this.digAt = null;
      this.busy = false; if (Menus.open === 'busy') Menus.open = null;
      (Game.holes = Game.holes || []).push({ x: at.x, y: at.y, day: Game.env.day });
      if (Game.holes.length > 40) Game.holes.shift();
      this.dirty = true;
      const r = Math.random();
      let msg = 'A nice hole. Good for… things.';
      if (r < 0.3) { Game.lures.worm = (Game.lures.worm || 0) + 3; msg = 'Dug up 3 fat worms. Bait!'; }
      else if (r < 0.45) { const c = 2 + ((Math.random() * 14) | 0); Game.money += c; msg = 'Found ' + U.fmtMoney(c) + ' in loose change.'; }
      else if (r < 0.5) { Game.money += 25; msg = 'An old glass bottle! A collector pays you $25 for it later.'; }
      else if (r < 0.515) { Game.money += 180; msg = '💰 A rusty tin full of old coins! $180!'; Sfx.coin(); }
      if (U.dist(at.x, at.y, World.town.x, World.town.y + 6) < 18) { Rep.add(-1); msg += ' (The locals don\'t love you digging up the main street.)'; }
      Hud.toast(msg, UI.accent, 2.2);
      Game.save();
    }, 1700);
  },

  // ---------- E key ----------
  interactions(add) {
    if (Interior.active || Bikes.riding) return;
    if ((Game.bladder || 0) >= 30) add(Player.x, Player.y, 1, 'Have a wee' + (this.bushNear() ? ' (behind the bush)' : this.witnesses().length ? ' (people are watching!)' : ''), () => this.wee());
    if ((Game.bowels || 0) >= 30) add(Player.x, Player.y, 1, this.holeNear() ? 'Do your business in the hole' : 'Do your business (no hole…)', () => this.poo());
  },

  // ---------- drawing ----------
  render() {
    const show = Tools.current === 'spade' && !Bikes.riding && !Interior.active;
    this.spade.visible = show;
    if (show) {
      const h = Actors.handWorld || new THREE.Vector3(Player.x, Scene3D.standH(Player.x, Player.y) + 0.3, Player.y);
      if (this.digAt) {
        // Dig cycle: lean in and plunge the blade, then lever the dirt up and over.
        const t = (performance.now() - this.digStart) / 420 * Math.PI * 2, plunge = Math.max(0, Math.sin(t)), lift = Math.max(0, -Math.sin(t));
        const rig = Actors.rig, a = Player.face, f = this.digAt;
        rig.lean.rotation.z = -(0.25 + plunge * 0.3);
        rig.armR.rotation.set(-0.2, 0, 0.9 + plunge * 0.6 - lift * 0.5); rig.armL.rotation.set(0.2, 0, 0.9 + plunge * 0.6 - lift * 0.5);
        const gx = U.lerp(Player.x, f.x, 0.8), gy = U.lerp(Player.y, f.y, 0.8), y0 = Scene3D.groundH(gx, gy);
        this.spade.position.set(gx, y0 + 0.25 - plunge * 0.18 + lift * 0.25, gy);
        this.spade.rotation.set(0, -a + Math.PI / 2, 0);
        this.spade.rotateX(-0.35 + lift * 0.9);
      } else {
        this.spade.position.set(h.x, h.y - 0.1, h.z);
        this.spade.rotation.set(0, -Player.face + Math.PI / 2, 0);
        this.spade.rotateX(0.35);
      }
    }
    this.group.visible = !Interior.active;
    if (!this.dirty) return;
    this.dirty = false;
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    const P = (geo, c, o = 0.03) => Models.part(geo, c, o);
    for (const h of Game.holes || []) {
      const g = new THREE.Group(), y0 = Scene3D.groundH(h.x, h.y);
      const pit = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: h.used ? 0x6A4A2A : 0x1E140C })); pit.position.y = 0.02; g.add(pit);
      const mound = P(new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#7A5A34'); mound.scale.set(1.2, 0.5, 0.9); mound.position.set(0.42, 0, 0.1); g.add(mound);
      g.position.set(h.x, y0, h.y); this.group.add(g);
    }
    for (const s of Game.smears || []) this.smearMesh(s);
    for (const p of Game.poos || []) {
      const g = new THREE.Group();
      [[0.12, 0.05], [0.09, 0.11], [0.06, 0.16]].forEach(([r, y]) => { const s = P(new THREE.SphereGeometry(r, 8, 6), '#5A3A1A'); s.scale.y = 0.7; s.position.y = y; g.add(s); });
      if (p.smeared) g.scale.set(1.5, 0.35, 1.3); // squashed flat
      g.position.set(p.x, Scene3D.groundH(p.x, p.y), p.y); this.group.add(g);
    }
  },
};
