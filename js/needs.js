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
    this.dirty = true;
  },

  // ---------- filling up ----------
  update(dt) {
    if (this.busy) return;
    Game.bladder = Math.min(100, (Game.bladder || 0) + dt * 0.2);
    Game.bowels = Math.min(100, (Game.bowels || 0) + dt * 0.09);
    for (const [k, name] of [['bladder', 'wee'], ['bowels', 'poo']]) {
      const v = Game[k], warn = 'warn_' + k;
      if (v > 80 && !this[warn]) { this[warn] = true; Hud.toast(k === 'bladder' ? 'You really need a wee. Find a bush (E).' : 'You REALLY need to go. Dig a hole with the spade (6), or find a loo.', '#F2C14E', 2.6); }
      if (v < 70) this[warn] = false;
      if (v >= 100) this.accident(k);
    }
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
    const was = Player.crouch; Player.crouch = true;
    Hud.toast(label, UI.muted, secs);
    const snd = setInterval(() => (kind === 'bladder' ? Sfx.burst(0.25, 1800 + Math.random() * 600, 0.07, 'bandpass', 3, 1200) : Sfx.tone(90 + Math.random() * 30, 0.15, 0.12, 'sine', 50)), kind === 'bladder' ? 220 : 650);
    setTimeout(() => {
      clearInterval(snd); Player.crouch = was;
      this.busy = false; if (Menus.open === 'busy') Menus.open = null;
      done();
      Game.save();
    }, secs * 1000);
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

  accident(k) {
    Game[k] = 0;
    this.smellT = 300; Rep.add(-8);
    Sfx.fail();
    Hud.toast(k === 'bladder' ? 'Oh no. You couldn\'t hold it. Your trousers are… damp.' : 'Oh NO. That\'s… that\'s not good. You need a wash. Badly.', UI.bad, 3.2);
    for (const n of this.witnesses(8)) if (n.name && Npcs.list.includes(n)) { Npcs.say(n, 'Oh dear GOD.', 2.2); break; }
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
    this.busy = true; Menus.open = 'busy'; this.digT = 0;
    const thunk = setInterval(() => { Sfx.thunk(); Sfx.burst(0.15, 600, 0.15, 'lowpass', 0.7, 200); this.digT += 0.4; }, 420);
    setTimeout(() => {
      clearInterval(thunk);
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
      const dig = this.busy && this.digT !== undefined ? Math.sin(Game.time * 9) * 0.6 : 0;
      this.spade.position.set(h.x, h.y - 0.1, h.z);
      this.spade.rotation.set(0, -Player.face + Math.PI / 2, 0);
      this.spade.rotateX(0.35 + dig);
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
    for (const p of Game.poos || []) {
      const g = new THREE.Group();
      [[0.12, 0.05], [0.09, 0.11], [0.06, 0.16]].forEach(([r, y]) => { const s = P(new THREE.SphereGeometry(r, 8, 6), '#5A3A1A'); s.scale.y = 0.7; s.position.y = y; g.add(s); });
      g.position.set(p.x, Scene3D.groundH(p.x, p.y), p.y); this.group.add(g);
    }
  },
};
