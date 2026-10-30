// Text mode: the whole game played as an old-school MUD. The same simulation runs underneath (valley, locals,
// wardens, shops, wanted level, jail); this swaps the 3D view for a scrolling console and a typed command line.
// Everything nearby you could press E on becomes a numbered action; the game's toasts and everyone's chatter
// within earshot are printed as they happen.
'use strict';

const DIRS = { n: [0, -1, 'north'], s: [0, 1, 'south'], e: [1, 0, 'east'], w: [-1, 0, 'west'], ne: [1, -1, 'north-east'], nw: [-1, -1, 'north-west'], se: [1, 1, 'south-east'], sw: [-1, 1, 'south-west'] };
const DIR_WORDS = { north: 'n', south: 's', east: 'e', west: 'w', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw', 'north-east': 'ne', 'north-west': 'nw', 'south-east': 'se', 'south-west': 'sw', up: 'n', down: 's' };
const TILE_NAMES = ['grass', 'a wildflower meadow', 'forest floor', 'sand', 'rock', 'water', 'a dirt path', 'wooden planks', 'mud', 'a wooden floor'];

const Mud = {
  on: false, hooked: false, goal: null, goalName: '', lastPos: null, stuckT: 0, statusT: 0, lastToast: '', lastToastT: 0,
  history: [], hIdx: 0, lastWanted: 0, lastPhase: -1, lastWeather: '', actions: [],

  // ---------- turning it on and off ----------
  start(style) {
    this.on = true; this.style = style || 'text';
    document.body.classList.add(this.style === 'dialog' ? 'dlgmode' : 'mud');
    if (this.style === 'dialog') Dlg.start(); else document.getElementById('mud').classList.remove('hidden');
    this.hook();
    const out = document.getElementById('mudOut'); out.innerHTML = '';
    this.print('TROUT FOR CLOUT', 'title');
    this.print('— the text edition. Type HELP for commands. —', 'sys');
    this.lastWanted = Wanted.level; this.lastPhase = Game.env.phase; this.lastWeather = Game.env.weather.id;
    this.look();
    if (this.style !== 'dialog') setTimeout(() => document.getElementById('mudIn').focus(), 50);
  },
  stop() {
    this.on = false; this.goal = null; TFish.reset();
    document.body.classList.remove('mud', 'dlgmode'); Dlg.stop();
    document.getElementById('mud').classList.add('hidden');
  },

  hook() {
    if (this.hooked) return;
    this.hooked = true;
    const self = this;
    // Every on-screen notice becomes a line of text.
    const toast = Hud.toast.bind(Hud);
    Hud.toast = function (msg, color, time) {
      toast(msg, color, time);
      if (!self.on || !msg) return;
      const now = performance.now();
      if (msg === self.lastToast && now - self.lastToastT < 1500) return;
      self.lastToast = msg; self.lastToastT = now;
      self.print(String(msg), color === UI.bad ? 'bad' : color === UI.good ? 'good' : 'event');
    };
    // Anyone speaking within earshot.
    const ear = (obj, nameOf, posOf) => {
      if (!obj || typeof obj.say !== 'function') return;
      const orig = obj.say.bind(obj);
      obj.say = function (...a) {
        const r = orig(...a);
        if (self.on) {
          const who = posOf(a), text = nameOf(a);
          if (who && text && U.dist(who.x, who.y, Player.x, Player.y) < 20) self.print(who.name + ': “' + text + '”', 'say');
        }
        return r;
      };
    };
    ear(Npcs, (a) => a[0] && a[0].bubble, (a) => a[0]);
    ear(Wardens, (a) => a[0] && a[0].bubble, (a) => a[0] && { x: a[0].x, y: a[0].y, name: a[0].name || 'The warden' });
    ear(Swimmers, (a) => a[0] && a[0].bubble, (a) => a[0] && { x: a[0].x, y: a[0].y, name: 'A swimmer' });
    ear(Floaters, (a) => a[1], (a) => a[0] && { x: a[0].x, y: a[0].y, name: 'Someone on a lilo' });
    ear(Hunters, (a) => a[1], (a) => a[0] && { x: a[0].x, y: a[0].y, name: a[0].name || 'A hunter' });
    ear(Tim, (a) => a[0], () => ({ x: World.tim.x, y: World.tim.y, name: Tim.guide().name }));
  },

  // ---------- output ----------
  print(text, cls = '') {
    if (this.style === 'dialog') Dlg.push(text, cls);
    const out = document.getElementById('mudOut');
    const p = document.createElement('div');
    p.className = 'ml ' + cls; p.textContent = text;
    out.appendChild(p);
    while (out.children.length > 400) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
  },
  html(h, cls = '') {
    const out = document.getElementById('mudOut');
    const p = document.createElement('div'); p.className = 'ml ' + cls; p.innerHTML = h;
    out.appendChild(p); out.scrollTop = out.scrollHeight;
  },

  // ---------- helpers ----------
  compass(dx, dy) {
    const a = Math.atan2(dy, dx), i = Math.round(a / (Math.PI / 4));
    return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east'][(i + 8) % 8];
  },
  where(x, y) {
    const d = U.dist(Player.x, Player.y, x, y);
    return d < 1.5 ? 'right here' : Math.round(d) + ' m ' + this.compass(x - Player.x, y - Player.y);
  },
  clock() {
    const h = Game.env.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return (hh % 12 || 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? 'am' : 'pm');
  },
  people(r = 22) {
    const out = [];
    const busy = { cast: 'fishing', wait: 'fishing', fight: 'fighting a fish', show: 'showing off a catch', walk: 'walking', chat: 'chatting', brawl: 'BRAWLING', ko: 'out cold', dead: 'dead', armed: 'armed and furious', mob: 'coming for you', jailed: 'doing time' };
    for (const n of Npcs.list) if (!n.away && !['home', 'bush'].includes(n.state) && U.dist(n.x, n.y, Player.x, Player.y) < r) out.push({ name: n.name, x: n.x, y: n.y, doing: busy[n.state] || 'about', ref: n });
    for (const w of Wardens.list) if (U.dist(w.x, w.y, Player.x, Player.y) < r) out.push({ name: w.name || 'A warden', x: w.x, y: w.y, doing: w.state === 'chase' ? 'CHASING YOU' : w.state === 'ko' ? 'out cold' : 'on patrol', ref: w, warden: true });
    for (const u of Wanted.units || []) if (U.dist(u.x, u.y, Player.x, Player.y) < r) out.push({ name: u.army ? 'A soldier' : 'A police officer', x: u.x, y: u.y, doing: 'hunting you', ref: u });
    for (const st of Staff.list) if (st.mesh && st.mesh.visible && ['work', 'cover', 'toWork', 'toHome'].includes(st.state) && U.dist(st.x || 0, st.y || 0, Player.x, Player.y) < r) out.push({ name: st.name, x: st.x, y: st.y, doing: st.state === 'work' ? 'at work' : 'walking', ref: st });
    if (U.dist(World.tim.x, World.tim.y, Player.x, Player.y) < r) out.push({ name: Tim.guide().name + ' the guide', x: World.tim.x, y: World.tim.y, doing: 'waiting to help' });
    for (const s of Swimmers.list) if (s.state === 'swim' && U.dist(s.x, s.y, Player.x, Player.y) < r) out.push({ name: 'A swimmer', x: s.x, y: s.y, doing: 'swimming' });
    for (const h of Hunters.list || []) if (h.mesh && U.dist(h.x, h.y, Player.x, Player.y) < r) out.push({ name: h.name || 'A hunter', x: h.x, y: h.y, doing: 'hunting' });
    return out.sort((a, b) => U.dist(a.x, a.y, Player.x, Player.y) - U.dist(b.x, b.y, Player.x, Player.y));
  },
  findPerson(q) {
    q = q.toLowerCase();
    return this.people(80).find((p) => p.name.toLowerCase().includes(q));
  },
  places() {
    const out = [];
    for (const b of World.buildings) {
      if (b.type === 'house' && !(Game.home && World.buildings.indexOf(b) === Game.home.id) && b.id !== (Game.home && Game.home.id)) continue;
      const d = World.doorOf(b);
      out.push({ name: b.type === 'house' ? 'home (' + b.name + ')' : b.name, x: d.x, y: d.y + 0.8, b });
    }
    if (World.dockEnd) out.push({ name: 'the town dock', x: World.dockEnd.x, y: World.dockEnd.y + 1 });
    out.push({ name: 'the guide (' + Tim.guide().name + ')', x: World.tim.x, y: World.tim.y + 1 });
    for (const L of World.lakes || []) if (L.name) { const s = World.nearestShore ? World.nearestShore(L.x, L.y + L.r) : null; if (s) out.push({ name: L.name, x: s.x, y: s.y }); }
    return out;
  },

  // ---------- describing the world ----------
  look() {
    const P = Player;
    if (Interior.active) {
      this.print(Interior.active.b.name + ' (inside)', 'room');
      this.print('Four walls, a floor that creaks, and the smell of ' + (Interior.active.b.type === 'shop' ? 'bait and old coffee' : Interior.active.b.type === 'clinic' ? 'disinfectant' : 'someone else\'s cooking') + '.', '');
    } else {
      const name = World.waterName(P.x, P.y) || 'The valley';
      this.print(name, 'room');
      const t = World.tileAt(Math.floor(P.x), Math.floor(P.y));
      const env = Game.env, phase = ['Dawn light', 'Daylight', 'Dusk', 'Night'][env.phase];
      let s = Swim.on ? 'You are swimming in deep water.' : Boats.riding ? 'You are aboard ' + (Boats.riding.mine && !Boats.riding.stolen ? 'your ' : Boats.riding.owner + '\'s ') + BOAT_TYPES[Boats.riding.type].name.toLowerCase() + '.'
        : Bikes.riding ? 'You are on a bike.' : P.wading ? 'You are wading in the shallows.' : 'You stand on ' + (TILE_NAMES[t] || 'the ground') + '.';
      s += ' ' + phase + ', ' + env.weather.id + ', ' + this.clock() + '.';
      this.print(s, '');
      // Water, buildings, boats and wildlife nearby.
      let wd = 1e9, wx = 0, wy = 0;
      for (let r = 1; r <= 12 && wd > 1e8; r++) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r; if (World.isWater(x, y) && !World.isWater(P.x, P.y)) { wd = r; wx = x; wy = y; break; } }
      if (wd < 1e8) this.print('Water: ' + (World.waterName(wx, wy) || 'water') + ', ' + this.where(wx, wy) + '.', 'dim');
      const bs = World.buildings.map((b) => ({ b, d: World.doorOf(b) })).filter((o) => U.dist(o.d.x, o.d.y, P.x, P.y) < 26).sort((a, b) => U.dist(a.d.x, a.d.y, P.x, P.y) - U.dist(b.d.x, b.d.y, P.x, P.y)).slice(0, 5);
      for (const { b, d } of bs) this.print('• ' + (b.type === 'house' ? (b.vacant ? 'A house for rent' : 'A house') : b.name) + ' — door ' + this.where(d.x, d.y) + (b.type !== 'house' && Staff.doorLabel ? ' (' + (Staff.doorLabel(b) || 'open').toString().replace(/^\W+/, '') + ')' : ''), 'dim');
      for (const bt of Boats.list) if (bt !== Boats.riding && U.dist(bt.x, bt.y, P.x, P.y) < 12) this.print('• ' + (bt.mine && !bt.stolen ? 'Your ' : bt.owner + '\'s ') + BOAT_TYPES[bt.type].name.toLowerCase() + ', ' + this.where(bt.x, bt.y), 'dim');
      for (const an of Animals.list || []) if (an.state !== 'dead' && U.dist(an.x, an.y, P.x, P.y) < 18) this.print('• A ' + (an.type === 'boar' ? 'wild boar' : an.buck ? 'stag' : 'deer') + ', ' + this.where(an.x, an.y), 'dim');
      if (CoastGuard.boat) this.print('• The Coast Guard boat, ' + this.where(CoastGuard.boat.x, CoastGuard.boat.y) + '!', 'bad');
    }
    const ppl = this.people();
    if (ppl.length) this.print('People: ' + ppl.slice(0, 7).map((p) => p.name + ' (' + p.doing + ', ' + this.where(p.x, p.y) + ')').join('; ') + '.', 'say');
    const acts = this.listActions();
    if (acts.length) this.print('You could: ' + acts.map((a, i) => '[' + (i + 1) + '] ' + a.label).join('  '), 'act');
  },

  // A little ASCII map around you.
  map(r = 14) {
    const P = Player, rows = [], cx = Math.floor(P.x), cy = Math.floor(P.y), rx = r * 2;
    if (Interior.active) return this.print('No map indoors.', 'sys');
    const marks = new Map();
    const mark = (x, y, ch, cls) => marks.set(Math.floor(x) + ',' + Math.floor(y), [ch, cls]);
    for (const n of Npcs.list) if (!n.away && !['home', 'bush'].includes(n.state)) mark(n.x, n.y, n.name[0], 'm-npc');
    for (const w of Wardens.list) mark(w.x, w.y, 'W', 'm-law');
    for (const u of Wanted.units || []) mark(u.x, u.y, 'P', 'm-law');
    for (const b of Boats.list) mark(b.x, b.y, 'b', 'm-boat');
    mark(World.tim.x, World.tim.y, 'G', 'm-npc');
    mark(P.x, P.y, '@', 'm-you');
    const ch = { [T.GRASS]: ['.', 'm-grass'], [T.MEADOW]: [',', 'm-grass'], [T.FOREST]: ['"', 'm-forest'], [T.SAND]: ['_', 'm-sand'], [T.ROCK]: ['^', 'm-rock'], [T.PATH]: [':', 'm-path'], [T.PLANK]: ['=', 'm-plank'], [T.MUD]: ['%', 'm-sand'], [T.FLOOR]: ['#', 'm-bld'] };
    for (let y = cy - r; y <= cy + r; y++) {
      let line = '';
      for (let x = cx - rx; x <= cx + rx; x++) {
        let c = [' ', ''];
        if (World.inB(x, y)) {
          const i = World.idx(x, y), t = World.tile[i], o = World.obj[i];
          if (marks.has(x + ',' + y)) c = marks.get(x + ',' + y);
          else if (World.buildingAt(x + 0.5, y + 0.5)) c = ['#', 'm-bld'];
          else if (t === T.WATER) c = World.depth[i] > 1.05 ? ['≈', 'm-deep'] : ['~', 'm-water'];
          else if (o === O.PINE || o === O.OAK) c = ['T', 'm-forest'];
          else if (o === O.BUSH) c = ['*', 'm-forest'];
          else if (o === O.BOULDER) c = ['o', 'm-rock'];
          else c = ch[t] || ['.', ''];
        }
        line += '<span class="' + c[1] + '">' + (c[0] === '<' ? '&lt;' : c[0]) + '</span>';
      }
      rows.push(line);
    }
    this.html('<pre class="mud-map">' + rows.join('\n') + '</pre>');
    this.print('@ you · W warden · P police · G guide · b boat · letters are locals · # building · ~ water (≈ deep) · = planks · T trees', 'dim');
  },

  status() {
    const g = Game;
    this.print('— ' + (Wanted.level ? '★'.repeat(Wanted.level) + ' WANTED  ' : '') + 'Day ' + g.env.day + ', ' + this.clock() + ' —', 'room');
    this.print('Health ' + Math.round(Wanted.health) + ' · Food ' + Math.round(g.food) + ' · Energy ' + Math.round(g.energy) + ' · Bladder ' + Math.round(g.bladder || 0) + ' · Bowels ' + Math.round(g.bowels || 0), '');
    this.print('Money ' + U.fmtMoney(g.money) + ' · Reputation: ' + Rep.tier().name + ' · Permits: ' + (Object.keys(g.permits || {}).filter((k) => g.permits[k]).map((k) => Permits.name(k)).join(', ') || 'none'), '');
    this.print('Fish caught ' + g.stats.caught + ' · Species ' + Object.keys(g.journal).length + ' · Holding: ' + (Tools.current === 'gun' ? Arsenal.weapon().name : Tools.current), '');
  },

  inventory() {
    const g = Game;
    this.print('You are carrying:', 'room');
    this.print('Creel (' + g.creel.length + '/' + g.creelMax + '): ' + (g.creel.map((c) => SPECIES_BY_ID[c.id].name + ' ' + c.cm + 'cm').join(', ') || 'empty'), '');
    const lures = LURES.filter((L) => (g.lures[L.id] || 0) > 0).map((L) => L.name + ' ×' + g.lures[L.id]);
    this.print('Lures: ' + (lures.join(', ') || 'none') + ' · Guns: ' + ((g.guns || []).join(', ') || 'none') + ' · Rifle rounds ' + (g.ammo || 0), '');
    this.print('Food: ' + ((g.pantry || []).map((f) => f.name).join(', ') || 'none') + ' · Wood ' + (g.wood || 0) + ' · Bug spray ' + (g.spray || 0) + (g.weed ? ' · Weed ×' + g.weed : ''), '');
  },

  // Everything you could press E on nearby (walking over to it first if needed).
  listActions() {
    Interact.reach = 3.5;
    let list = [];
    try { list = Interact.all(); } finally { Interact.reach = 1; }
    const seen = new Set();
    this.actions = list.filter((a) => a && a.label && !seen.has(a.label) && seen.add(a.label)).slice(0, 9);
    return this.actions;
  },
  doAction(i) {
    const a = this.actions[i];
    if (!a) return this.print('No such action. Type ACTIONS to see what you can do here.', 'sys');
    // Walk up to it if it's a few steps away.
    const d = U.dist(Player.x, Player.y, a.x, a.y);
    if (d > 1.2 && !Interior.active && !Boats.riding && !Swim.on) {
      const ang = Math.atan2(Player.y - a.y, Player.x - a.x);
      for (const off of [0.8, 1.1, 0.5]) { const x = a.x + Math.cos(ang) * off, y = a.y + Math.sin(ang) * off; if (!World.blocked(x, y)) { Player.place(x, y); break; } }
    } else if (d > 1.2 && Interior.active) Player.place(U.lerp(Player.x, a.x, 0.7), U.lerp(Player.y, a.y, 0.7));
    Player.face = Math.atan2(a.y - Player.y, a.x - Player.x);
    this.print('> ' + a.label, 'you');
    a.run();
    setTimeout(() => { if (this.on && !Menus.open) this.lookShort(); }, 120);
  },
  lookShort() {
    const acts = this.listActions();
    if (acts.length) this.print('You could: ' + acts.map((a, i) => '[' + (i + 1) + '] ' + a.label).join('  '), 'act');
  },

  // ---------- moving ----------
  walkTo(x, y, name) {
    this.goal = { x, y }; this.goalName = name; this.stuckT = 0; Player.path = null;
    this.print('You set off toward ' + name + ' (' + Math.round(U.dist(Player.x, Player.y, x, y)) + ' m).', 'sys');
  },
  step(dir, metres = 6) {
    const D = DIRS[dir];
    const len = Math.hypot(D[0], D[1]);
    if (Swim.on) { this.swimDir = { x: D[0] / len, y: D[1] / len, left: metres / 1.9 }; this.print('You swim ' + D[2] + '.', 'sys'); return; }
    this.walkTo(Player.x + D[0] / len * metres, Player.y + D[1] / len * metres, D[2]);
  },

  update(dt) {
    if (!this.on) return;
    TFish.update(dt);
    Dlg.update(dt);
    // Swimming strokes.
    if (this.swimDir) {
      Swim.move(dt, this.swimDir.x, this.swimDir.y);
      this.swimDir.left -= dt;
      if (this.swimDir.left <= 0 || !Swim.on) { this.swimDir = null; this.look(); }
    } else if (this.goal) {
      if (Fishing.state !== 'idle' || TFish.state !== 'idle') { this.goal = null; this.print('You stop — reel in first.', 'sys'); }
      else if (Interior.active) {
        const g = this.goal, a = Math.atan2(g.y - Player.y, g.x - Player.x), sp = 3.2 * dt;
        const nx = Player.x + Math.cos(a) * sp, ny = Player.y + Math.sin(a) * sp;
        if (!Interior.blocked(nx, ny)) { Player.x = nx; Player.y = ny; }
        if (U.dist(Player.x, Player.y, g.x, g.y) < 0.6) { this.goal = null; this.look(); }
      } else {
        const g = this.goal, ox = Player.x, oy = Player.y;
        const done = Path.follow(Player, g, Player.wading ? 2 : 3.6, dt) || U.dist(Player.x, Player.y, g.x, g.y) < 0.8;
        Player.moving = true; Player.walkT += dt;
        this.stuckT = U.dist(ox, oy, Player.x, Player.y) < 0.02 ? this.stuckT + dt : 0;
        if (done) {
          this.goal = null; this.print('You arrive at ' + this.goalName + '.', 'sys');
          const then = this.then; this.then = null;
          if (then) then(); else this.look();
        }
        else if (this.stuckT > 2.5) { this.goal = null; this.then = null; this.print('You can\'t find a way any further.', 'sys'); this.look(); }
      }
    }
    // Things worth announcing.
    if (Wanted.level !== this.lastWanted) { this.print(Wanted.level ? 'WANTED LEVEL: ' + '★'.repeat(Wanted.level) : 'The heat is off. You\'re no longer wanted.', Wanted.level ? 'bad' : 'good'); this.lastWanted = Wanted.level; }
    if (Game.env.phase !== this.lastPhase) { this.lastPhase = Game.env.phase; this.print(['The sun is coming up.', 'It\'s full daylight now.', 'The sun is going down.', 'Night falls over the valley.'][Game.env.phase], 'dim'); }
    if (Game.env.weather.id !== this.lastWeather) { this.lastWeather = Game.env.weather.id; this.print('The weather turns: ' + Game.env.weather.id + '.', 'dim'); }
    this.statusT -= dt;
    if (this.statusT <= 0) {
      this.statusT = 0.5;
      document.getElementById('mudStatus').textContent = 'Day ' + Game.env.day + ' ' + this.clock() + ' · ' + Game.env.weather.id + ' · ' + U.fmtMoney(Game.money) + ' · HP ' + Math.round(Wanted.health) + ' · Food ' + Math.round(Game.food) + ' · Energy ' + Math.round(Game.energy) + ' · Creel ' + Game.creel.length + '/' + Game.creelMax + (Wanted.level ? ' · ' + '★'.repeat(Wanted.level) : '') + ' · ' + (Interior.active ? Interior.active.b.name : World.waterName(Player.x, Player.y) || 'The valley');
    }
  },

  // ---------- the command line ----------
  run(raw) {
    const line = raw.trim(); if (!line) return;
    this.print('> ' + line, 'you');
    this.history.push(line); this.hIdx = this.history.length;
    const [cmd0, ...rest] = line.toLowerCase().split(/\s+/), arg = rest.join(' ');
    let cmd = DIR_WORDS[cmd0] || cmd0;
    if (Menus.open === 'catch' && (cmd === 'keep' || cmd === 'release')) { const b = document.getElementById(cmd === 'keep' ? 'keepBtn' : 'releaseBtn'); if (b && !b.disabled) b.click(); else this.print('You can\'t keep it — your creel is full.', 'bad'); return; }
    if (/^\d+$/.test(cmd)) return this.doAction(+cmd - 1);
    if (DIRS[cmd]) return this.step(cmd, +arg || 6);
    switch (cmd) {
      case 'help': case '?': return this.help();
      case 'look': case 'l': return this.look();
      case 'map': case 'm': return this.map(+arg || 12);
      case 'go': case 'goto': case 'walk': case 'travel': return this.go(arg.replace(/^to\s+/, ''));
      case 'places': case 'where': return this.listPlaces();
      case 'stop': this.goal = null; this.then = null; this.swimDir = null; return this.print('You stop.', 'sys');
      case 'who': case 'people': { const p = this.people(30); return this.print(p.length ? p.map((x) => x.name + ' — ' + x.doing + ', ' + this.where(x.x, x.y)).join('\n') : 'Nobody around.', p.length ? 'say' : 'sys'); }
      case 'actions': case 'a': { const a = this.listActions(); return this.print(a.length ? a.map((x, i) => '[' + (i + 1) + '] ' + x.label).join('\n') : 'Nothing to do right here. Try LOOK, or GO somewhere.', a.length ? 'act' : 'sys'); }
      case 'do': case 'use': case 'e': return this.doAction((+arg || 1) - 1);
      case 'inv': case 'i': case 'inventory': return this.inventory();
      case 'stats': case 'status': case 'score': case 'me': return this.status();
      case 'time': case 'weather': return this.print('It\'s ' + this.clock() + ' on day ' + Game.env.day + '. ' + Game.env.weather.id + ', wind ' + Math.hypot(Game.env.wind.x, Game.env.wind.y).toFixed(1) + ' m/s.', '');
      case 'hold': case 'wield': case 'equip': case 'draw': return this.equip(arg);
      case 'cast': case 'fish': return TFish.cast(arg);
      case 'strike': case 'hook': return TFish.strike();
      case 'reel': case 'r': return TFish.reel();
      case 'wait': case 'z': case 'let': return TFish.wait();
      case 'punch': case 'hit': case 'attack': return this.punch(arg);
      case 'shoot': case 'fire': return this.shoot(arg);
      case 'talk': case 'chat': return this.talk(arg);
      case 'say': return this.say(rest.join(' '));
      case 'swim': return this.actionMatching(/swim|dive/i, 'There\'s no deep water right next to you.');
      case 'enter': case 'in': return this.actionMatching(/enter|go in|inside/i, 'No door right here.');
      case 'exit': case 'out': case 'leave': return this.actionMatching(/leave|exit|out|outside|get off|get out/i, 'You\'re not inside anything.');
      case 'eat': return this.actionMatching(/eat|cook/i, 'No food or cooking here. (Try your pantry at home, or the BBQ by the dock.)');
      case 'sleep': return this.actionMatching(/sleep|bed|nap/i, 'Nowhere to sleep here — get home first.');
      case 'pee': case 'wee': return Needs.wee ? Needs.wee() : null;
      case 'poo': case 'poop': return Needs.poo();
      case 'clear': case 'cls': document.getElementById('mudOut').innerHTML = ''; return;
      case 'save': Game.save(); return this.print('Game saved.', 'good');
      case 'quit': case 'menu': if (Rogue.on) return location.reload(); Game.save(); this.stop(); showTitle(); return;
      default: return this.print('Huh? "' + cmd0 + '" isn\'t something you know how to do. Type HELP.', 'sys');
    }
  },

  help() {
    const H = [
      ['LOOK (L)', 'describe where you are, who\'s about and what you could do'],
      ['N / S / E / W / NE / NW / SE / SW [metres]', 'walk that way (default 6 m)'],
      ['GO <place or person>', 'walk somewhere — PLACES lists them'],
      ['MAP [size]', 'an ASCII map around you'],
      ['ACTIONS (A), then a number', 'everything you could press E on nearby (shops, doors, boats, chats…)'],
      ['WHO', 'people nearby and what they\'re up to'],
      ['INV (I), STATS', 'your gear, creel, money and vitals'],
      ['CAST [direction]', 'fish the nearest water; then STRIKE when it bites, REEL to bring it in, WAIT while it runs'],
      ['KEEP / RELEASE', 'after you land one'],
      ['HOLD <rod|gun|axe|spade|spray|hands>', 'switch what\'s in your hands'],
      ['TALK <name> · SAY <words>', 'chat to the locals'],
      ['PUNCH <name> · SHOOT <name or animal>', 'if you must'],
      ['SWIM · ENTER · EXIT · EAT · SLEEP · PEE · POO', 'shortcuts for the obvious'],
      ['STOP · SAVE · QUIT', 'stop walking · save · back to the main menu'],
    ];
    this.print('Commands:', 'room');
    for (const [a, b] of H) this.html('<b>' + a + '</b> — ' + b, 'dim');
  },

  listPlaces() {
    this.print('Places you can GO to:', 'room');
    for (const p of this.places()) this.print('• ' + p.name + ' — ' + this.where(p.x, p.y), 'dim');
    this.print('(You can also GO to a person by name.)', 'dim');
  },

  go(q) {
    if (!q) return this.listPlaces();
    if (Interior.active) return this.print('You\'re indoors — EXIT first.', 'sys');
    const p = this.places().find((x) => x.name.toLowerCase().includes(q)) || (q === 'home' && this.places().find((x) => x.name.startsWith('home')));
    if (p) return this.walkTo(p.x, p.y, p.name);
    const who = this.findPerson(q);
    if (who) return this.walkTo(who.x + 0.8, who.y + 0.8, who.name);
    this.print('You don\'t know where "' + q + '" is. Type PLACES.', 'sys');
  },

  equip(what) {
    const id = { rod: 'rod', gun: 'gun', rifle: 'gun', axe: 'axe', spade: 'spade', shovel: 'spade', spray: 'spray', hands: 'hands', fists: 'hands', nothing: 'hands' }[what];
    if (!id) return this.print('Hold what? rod, gun, axe, spade, spray or hands.', 'sys');
    if (id === 'hands') { Tools.current = 'hands'; Gun.out = false; } else Tools.select(id);
    this.print('You\'re holding: ' + (Tools.current === 'gun' ? Arsenal.weapon().name : Tools.current) + '.', 'sys');
  },

  actionMatching(re, none) {
    const a = this.listActions(), i = a.findIndex((x) => re.test(x.label));
    if (i < 0) return this.print(none, 'sys');
    this.doAction(i);
  },

  talk(q) {
    const who = q ? this.findPerson(q) : this.people(4)[0];
    if (!who) return this.print('Talk to whom?', 'sys');
    if (U.dist(who.x, who.y, Player.x, Player.y) > 3) { Player.place(who.x + 0.9, who.y + 0.4); this.print('You wander over to ' + who.name + '.', 'sys'); }
    const a = this.listActions(), i = a.findIndex((x) => /chat|talk/i.test(x.label) && x.label.toLowerCase().includes(who.name.split(' ')[0].toLowerCase()));
    if (i >= 0) return this.doAction(i);
    if (who.ref && who.ref.name && Npcs.list.includes(who.ref)) return Npcs.say(who.ref, U.pick(Math.random, ['Oh, g\'day.', 'Biting today?', 'Can\'t talk, the fish are on.', 'You again.']), 3);
    this.print(who.name + ' doesn\'t seem keen to chat.', 'sys');
  },

  say(words) {
    if (!words) return this.print('Say what?', 'sys');
    this.print('You say: “' + words + '”', 'you');
    const n = Npcs.list.filter((x) => !x.away && !['home', 'bush', 'ko', 'dead', 'jailed'].includes(x.state) && U.dist(x.x, x.y, Player.x, Player.y) < 6)[0];
    if (n) setTimeout(() => Npcs.say(n, U.pick(Math.random, ['Righto.', 'Hah! Good one.', 'If you say so, mate.', 'Mm. Anyway, the fish…', 'Are you alright?', 'Couldn\'t agree more.']), 3), 600);
    else this.print('Nobody\'s close enough to hear.', 'dim');
  },

  punch(q) {
    const who = this.findPerson(q || '') || this.people(3)[0];
    if (!who) return this.print('Punch whom?', 'sys');
    if (U.dist(who.x, who.y, Player.x, Player.y) > 1.3) Player.place(who.x - Math.cos(0.5) * 0.9, who.y - Math.sin(0.5) * 0.9);
    Player.face = Math.atan2(who.y - Player.y, who.x - Player.x);
    Tools.current = 'hands'; Gun.out = false; Tools.punchT = 0;
    this.print('You swing at ' + who.name + '!', 'bad');
    Tools.punch();
  },

  shoot(q) {
    let t = null;
    const an = (Animals.list || []).filter((a) => a.state !== 'dead').sort((a, b) => U.dist(a.x, a.y, Player.x, Player.y) - U.dist(b.x, b.y, Player.x, Player.y));
    if (/deer|boar|stag|animal/.test(q || '')) t = an[0] && { x: an[0].x, y: an[0].y, name: 'the ' + an[0].type };
    else if (DIRS[DIR_WORDS[q] || q]) { const D = DIRS[DIR_WORDS[q] || q]; t = { x: Player.x + D[0] * 8, y: Player.y + D[1] * 8, name: D[2] }; }
    else { const p = this.findPerson(q || ''); if (p) t = p; else if (an[0]) t = { x: an[0].x, y: an[0].y, name: 'the ' + an[0].type }; }
    if (!t) return this.print('Shoot at what?', 'sys');
    if (Tools.current !== 'gun') Tools.select('gun');
    if (Tools.current !== 'gun') return;
    Input.mouse.wx = t.x; Input.mouse.wy = t.y;
    Player.face = Math.atan2(t.y - Player.y, t.x - Player.x);
    this.print('You take aim at ' + t.name + '… BANG!', 'bad');
    Gun.cooldown = 0; Gun.shoot();
  },
};

// ---------- text fishing ----------
// Cast, wait for the bite, strike in time, then reel in between its runs (reeling while it runs can snap you off).
const TFish = {
  state: 'idle', t: 0, spot: null, sp: null, fish: null, dist: 0, run: 0, tension: 0, warned: false,
  reset() { this.state = 'idle'; this.fish = null; this.spot = null; },

  cast(dirArg) {
    if (this.state !== 'idle') return Mud.print(this.state === 'fight' ? 'You\'re already into a fish!' : 'Your line\'s already out. REEL to bring it in.', 'sys');
    if (Interior.active) return Mud.print('Not indoors.', 'sys');
    if (Bikes.riding || (Boats.riding && Boats.driving)) return Mud.print('Hands on the controls — let go first.', 'sys');
    if (Swim.on) return Mud.print('You can\'t fish while you\'re swimming.', 'sys');
    if (Tools.current !== 'rod') Tools.select('rod');
    if (Tools.current !== 'rod') return;
    // Find water to cast at: the way you asked, or the nearest good spot.
    const P = Player, want = DIRS[DIR_WORDS[dirArg] || dirArg];
    let best = null;
    for (let r = 3; r <= 12 && !best; r += 1) for (let k = 0; k < 24; k++) {
      const a = want ? Math.atan2(want[1], want[0]) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.12 : k / 24 * Math.PI * 2;
      if (want && k > 6) break;
      const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
      if (World.isWater(x, y) && World.depthAt(x, y) > 0.3) { best = { x, y }; break; }
    }
    if (!best) {
      if (want) return Mud.print('There\'s no water within casting range that way.', 'sys');
      // Nothing in range: walk to the nearest bit of bank, then cast.
      const bank = this.nearestBank();
      if (!bank) return Mud.print('There\'s no water anywhere near here.', 'sys');
      Mud.walkTo(bank.x, bank.y, 'the water\'s edge');
      Mud.then = () => this.cast();
      return;
    }
    this.spot = best; P.face = Math.atan2(best.y - P.y, best.x - P.x);
    this.sp = Fish.pickSpecies(best.x, best.y, Game.env);
    this.state = 'wait'; this.t = 5 + Math.random() * 14 * (this.sp ? 1 / Math.max(0.4, Fish.timeMult(this.sp, Game.env)) : 3);
    Sfx.whoosh && Sfx.whoosh(0.2);
    Mud.print('You cast ' + Math.round(U.dist(P.x, P.y, best.x, best.y)) + ' m out into ' + (World.waterName(best.x, best.y) || 'the water') + '. Plop. Now you wait… (WAIT, or REEL to bring it in)', '');
    // Fishing water you've no permit for, with a warden watching?
    const zone = Permits.zoneAt(best.x, best.y);
    if (zone && !Permits.has(zone)) {
      Mud.print('(You don\'t have a ' + Permits.name(zone) + '.)', 'bad');
      const w = Wardens.list.find((x) => x.state === 'patrol' && U.dist(x.x, x.y, P.x, P.y) < 22);
      if (w) Wardens.startChase(w, 'Fishing without a permit');
      else if (Boats.riding) CoastGuard.launch('Fishing without a ' + Permits.name(zone));
    }
  },

  // The closest dry spot right beside fishable water.
  nearestBank() {
    const P = Player;
    for (let r = 2; r <= 90; r += 2) for (let k = 0; k < 32; k++) {
      const a = k / 32 * Math.PI * 2, x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
      if (!World.inB(Math.floor(x), Math.floor(y)) || !World.isWater(x, y) || World.depthAt(x, y) < 0.3) continue;
      // Step back toward you until you're on dry land.
      for (let s = 0.5; s < r; s += 0.5) {
        const bx = x - Math.cos(a) * s, by = y - Math.sin(a) * s;
        if (!World.isWater(bx, by) && !World.blocked(bx, by)) return { x: bx, y: by };
      }
    }
    return null;
  },

  wait() {
    if (this.state === 'fight') { this.waiting = true; return Mud.print(this.run > 0 ? 'You hold the rod high and let it run.' : 'You keep the line tight and wait.', 'dim'); }
    if (this.state === 'wait') return Mud.print('You watch the line…', 'dim');
    Mud.print('Time passes.', 'dim');
  },

  strike() {
    if (this.state !== 'bite') { if (this.state === 'wait') { Mud.print('You strike at nothing. The lure skips back toward you.', 'dim'); this.t += 4; } else Mud.print('Strike what?', 'sys'); return; }
    const sz = Fish.rollSize(this.sp);
    this.fish = { sp: this.sp, kg: sz.kg, cm: sz.cm, prized: Math.random() < 0.04, x: this.spot.x, y: this.spot.y };
    this.state = 'fight'; this.dist = 6 + Math.min(30, this.fish.kg * 2.5); this.stamina = 3 + this.fish.kg * 1.5; this.run = 0; this.tension = 0;
    Sfx.splash && Sfx.splash(0.5);
    Mud.print('FISH ON! ' + (this.fish.kg > 3 ? 'It\'s a heavy one — the rod bends double.' : 'It thrashes at the surface.') + ' REEL it in, but WAIT when it runs.', 'good');
  },

  reel() {
    if (this.state === 'wait' || this.state === 'bite') { this.state = 'idle'; return Mud.print('You reel in your line.', 'dim'); }
    if (this.state !== 'fight') return Mud.print('Nothing on the line.', 'sys');
    if (this.run > 0) {
      this.tension += 0.45 + Math.random() * 0.3;
      if (this.tension > 1) { this.state = 'idle'; Sfx.fail && Sfx.fail(); return Mud.print('SNAP! You cranked against the run and it broke you off. Gone.', 'bad'); }
      return Mud.print('The reel shrieks — the line\'s near breaking point! (WAIT while it runs)', 'bad');
    }
    const gain = 2.5 + Math.random() * 2.5 - Math.min(2, this.fish.kg * 0.1);
    this.dist -= Math.max(0.8, gain); this.stamina -= 1; this.tension = Math.max(0, this.tension - 0.2);
    if (this.dist <= 0) return this.land();
    Mud.print(['You crank it closer…', 'Gaining line…', 'It\'s tiring…', 'Closer now…'][Math.floor(Math.random() * 4)] + ' (' + Math.max(1, Math.round(this.dist)) + ' m out)', 'dim');
  },

  land() {
    const f = this.fish; this.state = 'idle'; this.fish = null;
    Mud.print('You land it: ' + (f.prized ? '★ a PRIZED ' : f.sp.legendary ? '★ LEGENDARY ' : '') + f.sp.name + ', ' + U.fmtKg(f.kg) + ', ' + f.cm + ' cm. Type KEEP or RELEASE.', 'good');
    if (f.sp.min === Infinity) Mud.print('(It\'s a protected species — keeping it is illegal.)', 'bad');
    else if (f.sp.min && f.cm < f.sp.min) Mud.print('(Undersized — the legal minimum is ' + f.sp.min + ' cm.)', 'bad');
    Menus.showCatch(f);
  },

  update(dt) {
    if (this.state === 'idle') return;
    this.t -= dt;
    if (this.state === 'wait' && this.t <= 0) {
      if (!this.sp) { this.state = 'idle'; return Mud.print('Nothing\'s biting here. Maybe try somewhere else.', 'dim'); }
      this.state = 'bite'; this.t = 3.5;
      Sfx.plop && Sfx.plop();
      Mud.print('The rod tip twitches… something\'s taken it! STRIKE!', 'good');
    } else if (this.state === 'bite' && this.t <= 0) {
      this.state = 'wait'; this.t = 6 + Math.random() * 12;
      Mud.print('Too slow — it spat the lure. Your line\'s still out…', 'dim');
    } else if (this.state === 'fight') {
      // The fish runs now and then, taking line back.
      if (this.run > 0) {
        this.run -= dt; this.dist += dt * (1.5 + this.fish.kg * 0.3);
        if (this.run <= 0) { this.tension = Math.max(0, this.tension - 0.3); Mud.print('The run eases off. REEL!', ''); }
      } else if (this.stamina > 0 && Math.random() < dt * 0.35) {
        this.run = 1.5 + Math.random() * 2; Mud.print('It\'s RUNNING — line peeling off the reel! (WAIT)', 'bad');
      }
      if (this.dist > 45) { this.state = 'idle'; Mud.print('It ran you clean out of line. Gone.', 'bad'); }
    }
  },
};
