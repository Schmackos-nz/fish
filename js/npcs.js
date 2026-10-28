// Other anglers: they roam the banks, cast, hook real fish, brag, and heckle you.
'use strict';

const NPC_NAMES = ['Old Bert', 'Mabel', 'Gus', 'Dolores', 'Rusty', 'Pearl', 'Hank', 'Wanda', 'Cliff', 'Ingrid', 'Moose', 'Tilly'];
const NPC_PALETTES = [
  { hat: '#4a5a8a', shirt: '#3a6a9a', vest: '#6a6a5a', pants: '#3a3a4a', skin: '#e8b88a', beard: '#e8e8e8' },
  { hat: '#c94a6a', shirt: '#e8d36a', vest: '#4a7a5a', pants: '#5a4a3a', skin: '#d8a07a' },
  { hat: '#3a3a3a', shirt: '#6a8a3a', vest: '#8a5a2a', pants: '#2a3a2a', skin: '#c08a60', beard: '#5a3a1a' },
  { hat: '#e8e8d8', shirt: '#9a5aaa', vest: '#5a5a7a', pants: '#3a3a5a', skin: '#f0c8a0' },
  { hat: '#c96a2a', shirt: '#c9c9b8', vest: '#a84a2a', pants: '#4a4a3a', skin: '#e0b090', beard: '#c96a2a' },
  { hat: '#5aa0a0', shirt: '#e88a8a', vest: '#7a8a9a', pants: '#3a4a5a', skin: '#a8724a' },
];

const SAY = {
  land: ['Fish on… and it\'s MINE!', 'Get the camera!', 'Look at the shoulders on this {sp}!', 'That\'s a keeper!', 'Wooo! {kg} of {sp}!', 'Still got it!'],
  prized: ['IS THAT GOLD?! Somebody pinch me!', 'Forty years I\'ve waited for a golden one!'],
  lost: ['NOOO! It threw the hook!', 'Snapped me off — that was a MONSTER!', 'Aw, nuts. The one that got away…'],
  lostBig: 'IT WAS THIS BIG, I swear!',
  idle: ['Same lot on those lilos every summer.', 'Don\'t cast near the lilo crowd. Trust me.', 'Nothing biting…', 'Come on, little fishy…', 'Wind\'s from the east. Bad sign.', '*yawn*', 'Should\'ve brought more worms.', 'Shh — you\'ll spook \'em.'],
  tips: ['{sp} love a {lure} around {time}.', 'Hear the drag scream? LET IT RUN.', 'Drop your rod when they jump, kid.', 'Keep your line tight or they\'ll shake loose.', 'Rain\'s the best time to be out here.', 'Deep water holds the big ones.'],
  tall: ['You should\'ve been here yesterday — they were jumping onto the bank!', 'I once caught a {sp} so big the photo weighed two kilos.', 'The one that got away? Twice the size of THAT.', 'Been fishing these waters forty years. Fish know my name.'],
  playerBig: ['Hah! Beginner\'s luck!', 'Now THAT\'s a fish!', 'Where\'d you hook that?!', 'Alright, alright… nice one.'],
  playerSmall: ['Throw that minnow back!', 'Cute. I use those for bait.', 'Hey, a fish is a fish!', 'It\'ll grow… in about five years.'],
  playerPrized: ['IS THAT GOLD?! Where\'d you hook that?!', 'No way. NO WAY. A prized one!'],
  gun: ['WHAT are you DOING?!', 'That is NOT how fishing works!', 'Is that even legal?!', 'Somebody call the warden!', 'CHEATER!', 'You\'ve scared off every fish in the lake!', 'My ears! MY EARS!'],
  brawl: ['POW!', 'WHACK!', 'OOF!', 'MY SPOT!', 'Take that!', 'Ow, my hat!'],
  claim: ['Oi! This is MY spot!', 'I was here first!', 'Find your own bank!'],
  lose: ['Fine! Keep your stupid spot!', 'This isn\'t over!', 'My lawyer will hear about this.'],
  win: ['And STAY out!', 'Ha! Mine.', 'Nobody steals my spot.'],
  crowd: ['Bit close, aren\'t you?', 'You\'re crowding my line.', 'Find your own spot, mate!'],
  shove: ['GET YOUR OWN SPOT!', 'OUT of my water!'],
  playerLoss: ['Ooh, tough break!', 'Should\'ve loosened your drag!', 'Happens to the best of us… mostly you, though.'],
};

const Npcs = {
  list: [], spots: [], group: null, sil: null,

  fill(t, n, sp) {
    const L = sp ? LURE_BY_ID[Object.entries(sp.lures).sort((a, b) => b[1] - a[1])[0][0]].name : 'spinner';
    const best = sp ? sp.time.indexOf(Math.max(...sp.time)) : 1;
    return t.replace(/\{sp\}/g, sp ? sp.name : 'fish').replace(/\{kg\}/g, n && n.kg ? U.fmtKg(n.kg) : 'a beast')
      .replace(/\{lure\}/g, L).replace(/\{time\}/g, TIME_NAMES[best].toLowerCase());
  },

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    if (!this.sil) this.sil = Actors.fishSilhouette();
    this.findSpots();
    const rng = U.mulberry32(World.seed + 99);
    this.list = [];
    const names = NPC_NAMES.slice().sort(() => rng() - 0.5).slice(0, 10);
    names.forEach((name, i) => {
      // The first two start near town so you meet someone right away.
      const spot = i < 2 ? this.nearestSpot(World.town.x + (i ? 12 : -12), World.town.y - 6) : this.spots[(rng() * this.spots.length) | 0];
      const n = {
        name, palette: NPC_PALETTES[i % NPC_PALETTES.length], x: spot.x, y: spot.y, face: spot.ang, spot,
        state: 'cast', t: 0.5 + rng() * 2, casts: 3 + ((rng() * 4) | 0), lure: null, fish: null, held: null,
        bubble: null, bubbleT: 0, pose: 'normal', walkT: 0, idleT: 10 + rng() * 20,
        rec: (Game.npcRecords && Game.npcRecords[name]) || { count: 0, best: 0, sp: null },
        home: (World.houses || []).filter((h) => !h.vacant)[i] || null,
      };
      if (n.home) { n.home.owner = name; n.home.name = name + '\'s house'; }
      this.buildMeshes(n);
      this.list.push(n);
    });
  },

  // Bank tiles with deep-enough water within casting reach.
  findSpots() {
    this.spots = [];
    const rng = U.mulberry32(World.seed + 5);
    for (let tries = 0; tries < 40000 && this.spots.length < 600; tries++) {
      const x = Math.floor(rng() * World.W), y = Math.floor(rng() * World.H);
      if (World.isWater(x, y) || World.blocked(x + 0.5, y + 0.5)) continue;
      let best = null;
      for (let a = 0; a < 16; a++) {
        const ang = a / 16 * Math.PI * 2;
        for (const d of [2, 4]) {
          const wx = x + 0.5 + Math.cos(ang) * d, wy = y + 0.5 + Math.sin(ang) * d;
          if (World.depthAt(wx, wy) > 0.8 && (!best || d < best.d)) best = { ang, d };
        }
      }
      if (best && World.shore[World.idx(x, y)] <= 2) this.spots.push({ x: x + 0.5, y: y + 0.5, ang: best.ang });
    }
  },

  nearestSpot(x, y, exclude) {
    let best = this.spots[0], bd = 1e9;
    for (const s of this.spots) {
      if (s === exclude || this.list.some((n) => n.spot === s)) continue;
      const d = U.dist(x, y, s.x, s.y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  },

  near(x, y, r) {
    let best = null, bd = r;
    for (const n of this.list) { const d = U.dist(x, y, n.x, n.y); if (d < bd) { bd = d; best = n; } }
    return best;
  },

  say(n, text, time = 3.5, pose) {
    n.bubble = text; n.bubbleT = time;
    if (pose) { n.pose = pose; n.poseT = Math.min(time, 2.5); }
  },

  // ---------- simulation ----------
  update(dt) {
    for (const n of this.list) {
      if (n.state === 'ko' || n.state === 'armed') continue; // handled by Wanted
      n.t -= dt;
      n.bubbleT = Math.max(0, n.bubbleT - dt);
      if (n.poseT !== undefined) { n.poseT -= dt; if (n.poseT <= 0) { n.pose = 'normal'; n.poseT = undefined; } }
      const close = U.dist(n.x, n.y, Player.x, Player.y) < 18;
      // Evenings they head home to bed; mornings they're back out.
      const night = Game.mode !== 'title' && (Game.env.hour >= 21 || Game.env.hour < 5);
      if (night && n.home && !n.goingHome && !n.goingBush && ['wait', 'cast', 'walk', 'chat'].includes(n.state)) {
        n.goingHome = true; n.lure = null; n.fish = null;
        const d = World.doorOf(n.home);
        n.spot = { x: d.x, y: d.y, ang: Math.PI / 2 }; n.state = 'walk'; n.walkT = 0;
      }
      if (n.state === 'bush') continue; // Couples handles them
      if (n.state === 'home') { n.homeT = (n.homeT || 0) - dt; if (!night && n.homeT <= 0) this.leaveHome(n); continue; }
      switch (n.state) {
        case 'brawl': this.brawlTick(n, dt, close); break;
        case 'walk': this.walk(n, dt); break;
        case 'cast': if (n.t <= 0) this.cast(n); break;
        case 'wait': this.waitBite(n, dt, close); break;
        case 'fight': this.fight(n, dt, close); break;
        case 'show':
          if (n.t <= 0) {
            n.held = null;
            if (close) Hud.ripple(n.lure ? n.lure.x : n.x, n.lure ? n.lure.y : n.y, 0.5);
            n.state = 'cast'; n.t = 1.2;
          }
          break;
        case 'chat': if (n.t <= 0) { n.state = n.lure ? 'wait' : 'cast'; n.t = 1; } break;
      }
    }
  },

  walk(n, dt) {
    const s = n.spot;
    const d = U.dist(n.x, n.y, s.x, s.y);
    if (d < 0.3) {
      if (n.goingHome) { n.state = 'home'; n.homeT = n.dayVisit ? 40 + Math.random() * 80 : 0; return; }
      if (n.goingBush) { n.state = 'bush'; return; }
      n.state = 'cast'; n.t = 1 + Math.random(); n.face = s.ang; n.casts = 3 + ((Math.random() * 4) | 0);
      // Someone's already fishing here? Just like real life, it's on.
      const rival = this.list.find((o) => o !== n && ['wait', 'cast', 'fight'].includes(o.state) && U.dist(o.x, o.y, n.x, n.y) < 3);
      if (rival) this.brawl(n, rival);
      return;
    }
    const ang = Math.atan2(s.y - n.y, s.x - n.x);
    const sp = 2.2 * dt;
    const nx = n.x + Math.cos(ang) * sp, ny = n.y + Math.sin(ang) * sp;
    let moved = false;
    if (!World.blocked(nx, n.y)) { n.x = nx; moved = true; }
    if (!World.blocked(n.x, ny)) { n.y = ny; moved = true; }
    n.face = ang; n.walkT += dt;
    n.stuck = moved ? 0 : (n.stuck || 0) + dt;
    // Wandering anglers don't pathfind; if they wedge against trees, they pick somewhere else.
    if ((n.stuck > 1.5 || n.walkT > 40) && n.goingBush) { n.x = s.x; n.y = s.y; n.state = 'bush'; return; }
    if ((n.stuck > 1.5 || n.walkT > 40) && n.goingHome) { n.x = s.x; n.y = s.y; n.state = 'home'; n.homeT = n.dayVisit ? 40 + Math.random() * 80 : 0; return; }
    if (n.stuck > 1.5 || n.walkT > 40) { n.spot = this.nearestSpot(n.x, n.y, n.spot); n.walkT = 0; n.stuck = 0; if (U.dist(n.x, n.y, n.spot.x, n.spot.y) > 30) { n.x = n.spot.x; n.y = n.spot.y; } }
  },

  // Out the front door and off to a fishing spot.
  leaveHome(n) {
    const d = World.doorOf(n.home);
    n.x = d.x; n.y = d.y; n.goingHome = false; n.dayVisit = false; n.lure = null;
    const cands = this.spots.filter((s) => U.dist(n.x, n.y, s.x, s.y) < 70 && !this.list.some((o) => o !== n && o.spot === s));
    n.spot = cands.length ? cands[(Math.random() * cands.length) | 0] : n.spot;
    n.state = 'walk'; n.walkT = 0; n.stuck = 0; n.casts = 3 + ((Math.random() * 4) | 0);
  },

  cast(n) {
    if (n.casts-- <= 0) {
      // Sometimes it's back home for a cuppa before heading out again.
      if (n.home && Math.random() < 0.18) {
        const d = World.doorOf(n.home);
        n.goingHome = true; n.dayVisit = true; n.lure = null;
        n.spot = { x: d.x, y: d.y, ang: Math.PI / 2 }; n.state = 'walk'; n.walkT = 0;
        return;
      }
      // Time to move on: another bank within reach.
      const cands = this.spots.filter((s) => { const d = U.dist(n.x, n.y, s.x, s.y); return d > 6 && d < 45 && !this.list.some((o) => o.spot === s); });
      // Now and then someone fancies a spot that's already taken.
      const taken = this.list.filter((o) => o !== n && o.state === 'wait' && U.dist(o.x, o.y, n.x, n.y) < 45);
      if (taken.length && Math.random() < 0.25) { const o = taken[(Math.random() * taken.length) | 0]; n.spot = { x: o.x + 0.2, y: o.y + 0.2, ang: o.face }; }
      else n.spot = cands.length ? cands[(Math.random() * cands.length) | 0] : n.spot;
      n.state = 'walk'; n.walkT = 0; n.lure = null;
      return;
    }
    for (let i = 0; i < 12; i++) {
      const a = n.spot.ang + (Math.random() - 0.5) * 1.1, d = 4 + Math.random() * 8;
      const lx = n.x + Math.cos(a) * d, ly = n.y + Math.sin(a) * d;
      if (World.isWater(lx, ly) && World.depthAt(lx, ly) > 0.4) {
        n.lure = { x: lx, y: ly }; n.face = a; n.state = 'wait'; n.t = 0;
        if (U.dist(lx, ly, Player.x, Player.y) < 30) { Hud.ripple(lx, ly, 0.6); }
        return;
      }
    }
    n.casts = 0; n.t = 0.5;
  },

  waitBite(n, dt, close) {
    const l = n.lure;
    if (!l) { n.state = 'cast'; n.t = 0.5; return; }
    // Slow retrieve back toward the bank.
    const d = U.dist(n.x, n.y, l.x, l.y);
    const k = Math.min(1, 0.35 * dt / Math.max(d, 0.01));
    const nx = l.x + (n.x - l.x) * k, ny = l.y + (n.y - l.y) * k;
    if (World.isWater(nx, ny)) { l.x = nx; l.y = ny; }
    if (d < 2 || !World.isWater(nx, ny)) { n.state = 'cast'; n.t = 0.8 + Math.random(); return; }
    // The player fishing right on top of them gets an earful, then a shove.
    if (Fishing.state !== 'idle' && U.dist(n.x, n.y, Player.x, Player.y) < 3.2) {
      const before = n.crowdT || 0;
      n.crowdT = before + dt;
      if ((before < 2 && n.crowdT >= 2) || (before < 6 && n.crowdT >= 6)) this.say(n, U.pick(Math.random, SAY.crowd), 2.6);
      if (n.crowdT >= 10) { n.crowdT = 0; this.shove(n); }
    } else n.crowdT = 0;
    n.idleT -= dt;
    if (n.idleT <= 0) { n.idleT = 25 + Math.random() * 40; if (close) this.say(n, U.pick(Math.random, SAY.idle)); }
    const e = Game.env;
    if (Math.random() > dt * 0.045 * e.weather.bite * (0.6 + e.daylight * 0.2 + (e.phase === 0 || e.phase === 2 ? 0.5 : 0))) return;
    // Bite! Prefer a real fish swimming nearby, so they genuinely compete with you.
    const real = Fish.list.find((f) => f.state === 'wander' && U.dist(f.x, f.y, l.x, l.y) < 6);
    let fish;
    if (real) {
      Fish.list.splice(Fish.list.indexOf(real), 1);
      fish = { sp: real.sp, kg: real.kg, cm: real.cm, prized: real.prized };
    } else {
      const sp = Fish.pickSpecies(l.x, l.y, e);
      if (!sp) return;
      const sz = Fish.rollSize(sp);
      fish = { sp, kg: sz.kg, cm: sz.cm, prized: !!sp.legendary || Math.random() < 0.03 };
    }
    fish.x = l.x; fish.y = l.y; fish.ang = Math.random() * 6.28;
    n.fish = fish; n.state = 'fight';
    n.t = 3 + Math.sqrt(fish.kg) * 3.2;
    n.loseAt = Math.random() < 0.18 ? n.t * (0.2 + Math.random() * 0.6) : -1;
    if (close) { this.say(n, U.pick(Math.random, ['Fish on!', 'Got one!', 'Whoa, whoa, WHOA!']), 2); Hud.ripple(l.x, l.y, 1); Sfx.splash(0.4); }
  },

  fight(n, dt, close) {
    const f = n.fish;
    // The fish circles and works its way in toward the angler.
    f.ang += dt * (1.5 + Math.random());
    const pull = Math.min(1, dt * 0.25);
    const tx = U.lerp(f.x, n.x, pull) + Math.cos(f.ang) * dt * 1.2, ty = U.lerp(f.y, n.y, pull) + Math.sin(f.ang) * dt * 1.2;
    if (World.isWater(tx, ty)) { f.x = tx; f.y = ty; }
    if (close && Math.random() < dt * 0.8) Hud.ripple(f.x, f.y, 0.5 + Math.min(1, f.kg / 5));
    if (n.loseAt > 0 && n.t <= n.loseAt) {
      n.fish = null; n.state = 'cast'; n.t = 2.5;
      if (close) {
        if (f.kg > 2) this.say(n, SAY.lostBig, 3.5, 'brag');
        else this.say(n, U.pick(Math.random, SAY.lost), 3);
      }
      return;
    }
    if (n.t <= 0) this.landFish(n, close);
  },

  landFish(n, close) {
    const f = n.fish;
    n.fish = null; n.held = f; n.state = 'show'; n.t = 3;
    n.creel = n.creel || [];
    if (n.creel.length < 6) n.creel.push({ id: f.sp.id, kg: f.kg, cm: f.cm, value: Menus.value(f.sp, f.kg, f.prized) });
    n.rec.count++;
    if (f.kg > n.rec.best) { n.rec.best = f.kg; n.rec.sp = f.sp.id; }
    Contest.onFish(n.name, f.kg, f.sp.name);
    Game.npcRecords[n.name] = n.rec;
    const dist = U.dist(n.x, n.y, Player.x, Player.y);
    if (close) {
      this.say(n, this.fill(U.pick(Math.random, f.prized ? SAY.prized : SAY.land), f, f.sp), 3, 'hold');
      Sfx.splash(0.5);
    }
    if (dist < 45) Hud.toast(n.name + ' landed a ' + (f.prized ? '★ prized ' : '') + U.fmtKg(f.kg) + ' ' + f.sp.name, '#8ec7d6', 2.2);
  },

  // ---------- talking to the player ----------
  talk(n) {
    n.state = 'chat'; n.t = 4; n.face = Math.atan2(Player.y - n.y, Player.x - n.x);
    const r = Math.random();
    if (n.rec.best > 0 && r < 0.4) {
      // Their best fish grows a little every time they tell it.
      const sp = SPECIES_BY_ID[n.rec.sp];
      const claimed = n.rec.best * (2 + Math.random() * 2);
      this.say(n, 'Caught a ' + sp.name + ' this morning — ' + U.fmtKg(claimed) + '. IT WAS THIS BIG!', 4.5, 'brag');
    } else if (r < 0.65) {
      const sp = Fish.pickSpecies(n.lure ? n.lure.x : n.x + Math.cos(n.face) * 3, n.lure ? n.lure.y : n.y + Math.sin(n.face) * 3, Game.env);
      this.say(n, this.fill(U.pick(Math.random, SAY.tips), null, sp), 4.5);
    } else if (r < 0.85) {
      this.say(n, this.fill(U.pick(Math.random, SAY.tall), null, U.pick(Math.random, SPECIES)), 4.5, Math.random() < 0.5 ? 'brag' : undefined);
    } else {
      this.say(n, n.rec.count ? n.rec.count + ' fish today. You?' : 'Haven\'t had a sniff all day.', 3.5);
    }
  },

  onPlayerCatch(f) {
    const n = this.near(Player.x, Player.y, 16);
    if (!n || n.state === 'fight') return;
    const lines = f.prized ? SAY.playerPrized : f.kg >= Math.max(1.5, n.rec.best) ? SAY.playerBig : f.kg < 0.4 ? SAY.playerSmall : null;
    if (lines) this.say(n, U.pick(Math.random, lines), 3.5);
  },

  onGunshot(x, y) {
    for (const n of this.list) {
      if (U.dist(n.x, n.y, x, y) > 28) continue;
      if (n.state !== 'fight') { n.face = Math.atan2(y - n.y, x - n.x); this.say(n, U.pick(Math.random, SAY.gun), 3, Math.random() < 0.3 ? 'brag' : undefined); }
      if (n.fish) { n.fish = null; n.state = 'cast'; n.t = 3; } // the shot spooked their fish off the line
    }
  },

  brawl(a, b) {
    for (const [n, o] of [[a, b], [b, a]]) {
      n.state = 'brawl'; n.t = 4; n.foe = o; n.lure = null; n.fish = null; n.bx = n.x; n.by = n.y;
      n.face = Math.atan2(o.y - n.y, o.x - n.x);
    }
    a.brawlLead = true; b.brawlLead = false;
    this.say(a, U.pick(Math.random, SAY.claim), 2); this.say(b, 'Says WHO?!', 2);
    if (U.dist(a.x, a.y, Player.x, Player.y) < 40) Hud.toast(a.name + ' and ' + b.name + ' are brawling over a fishing spot!', UI.accent, 2.6);
  },

  brawlTick(n, dt, close) {
    n.pose = Math.floor(Game.time * 7 + (n.brawlLead ? 0 : 1)) % 2 ? 'brag' : 'hold'; n.poseT = 0.2;
    n.x = n.bx + Math.sin(Game.time * 31 + (n.brawlLead ? 0 : 2)) * 0.12;
    n.y = n.by + Math.cos(Game.time * 27) * 0.06;
    if (Math.random() < dt * 1.4) { this.say(n, U.pick(Math.random, SAY.brawl), 0.6); if (close) Sfx.slap(0.8); }
    if (n.t > 0 || !n.brawlLead) return;
    // Settle it: the loser storms off to find somewhere else.
    const o = n.foe, [winner, loser] = Math.random() < 0.5 ? [n, o] : [o, n];
    for (const m of [n, o]) { m.x = m.bx; m.y = m.by; m.pose = 'normal'; m.poseT = undefined; m.foe = null; m.brawlLead = false; }
    winner.state = 'cast'; winner.t = 1.5; winner.casts = 3;
    loser.state = 'cast'; loser.t = 0.3; loser.casts = 0;
    this.say(winner, U.pick(Math.random, SAY.win), 2.6); this.say(loser, U.pick(Math.random, SAY.lose), 3);
  },

  shove(n) {
    const a = Math.atan2(Player.y - n.y, Player.x - n.x);
    for (let k = 0; k < 8; k++) {
      const nx = Player.x + Math.cos(a) * 0.25, ny = Player.y + Math.sin(a) * 0.25;
      if (World.blocked(nx, ny)) break;
      Player.x = nx; Player.y = ny;
    }
    if (Fishing.state !== 'fight') Fishing.reelInFast();
    Bugs.shake = 1; Sfx.slap(1);
    this.say(n, U.pick(Math.random, SAY.shove), 2.6, 'brag');
    Hud.toast(n.name + ' shoved you off their spot!', UI.bad, 2);
  },

  onPlayerLoss() {
    const n = this.near(Player.x, Player.y, 16);
    if (n && Math.random() < 0.7) this.say(n, U.pick(Math.random, SAY.playerLoss), 3);
  },

  // ---------- rendering ----------
  drawSprite(pal, dir, f, pose) {
    if (!pal.hatStyle) {
      const i = NPC_PALETTES.indexOf(pal);
      pal.hatStyle = ['beanie', 'cap', 'bucket'][i % 3];
      pal.pom = ['#F2E6C8', '#E84A3A', '#FFD54A'][i % 3];
      pal.hair = pal.beard || '#5A3A2A';
    }
    return Folk.texture(pal, dir, f, pose);
  },

  buildMeshes(n) {
    this.drawSprite(n.palette, 'down', 0, 'normal'); // fills in hat style etc. on the palette
    n.mesh = Models.person(n.palette);
    n.rig = n.mesh.userData.rig;
    n.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
    n.shadow.rotation.x = -Math.PI / 2;
    n.rod = Models.rod(0x4a3a2a);
    n.line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.7 }));
    n.rod.frustumCulled = n.line.frustumCulled = false;
    n.bob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe83a3a }));
    const fg = new THREE.PlaneGeometry(1, 0.38); fg.rotateX(-Math.PI / 2);
    n.fishMesh = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: this.sil, color: 0x0d2430, transparent: true, opacity: 0.6, depthWrite: false }));
    n.fishMesh.renderOrder = 1;
    n.heldMesh = Actors.billboard(document.createElement('canvas'), 1, 0.5);
    n.heldMesh.material.alphaTest = 0.1;
    this.group.add(n.mesh, n.shadow, n.rod, n.line, n.bob, n.fishMesh, n.heldMesh);
  },

  render() {
    for (const n of this.list) {
      const vis = n.state !== 'home' && n.state !== 'bush' && U.dist(n.x, n.y, Player.x, Player.y) < 45;
      for (const m of [n.mesh, n.shadow, n.rod, n.line, n.bob, n.fishMesh, n.heldMesh]) m.visible = vis;
      if (!vis) continue;
      const base = Scene3D.standH(n.x, n.y);
      const a = n.face;
      const dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'side' : Math.sin(a) > 0 ? 'down' : 'up';
      const walking = n.state === 'walk';
      n.mesh.position.set(n.x, base, n.y);
      n.rig.yaw.rotation.y = n.pose === 'normal' ? -a : Math.PI * -0.5; // face the camera to show off
      Models.pose(n.rig, { moving: walking, phase: n.walkT, t: Game.time + n.x, pose: n.pose !== 'normal' ? n.pose : walking ? 'normal' : 'grip' });
      n.shadow.position.set(n.x, Math.max(base, 0.01) + 0.015, n.y);

      // Rod: up and bent during a fight, laid back mid-cast, hidden while walking or posing.
      const showRod = !walking && n.pose === 'normal' && !['brawl', 'ko', 'armed'].includes(n.state);
      n.rod.visible = n.line.visible = showRod;
      const hand = Models.handPos(n.rig);
      const fighting = n.state === 'fight';
      const back = n.state === 'cast' && n.t < 0.4 ? -0.6 : 1;
      const tip = new THREE.Vector3(n.x + Math.cos(a) * 1.3 * back, base + (fighting ? 1.9 : 1.3), n.y + Math.sin(a) * 1.3 * back);
      if (fighting) { tip.x += Math.sin(Game.time * 9) * 0.12; tip.y -= 0.3 + Math.sin(Game.time * 13) * 0.1; }
      if (showRod) { Models.aimArm(n.rig, tip, n.state === 'cast' && n.t < 0.4 ? 0.05 : 0.35); Models.handPos(n.rig, hand); }
      const ctrl = hand.clone().lerp(tip, 0.6); ctrl.y += 0.2;
      if (showRod) Models.setRod(n.rod, hand, ctrl, tip, 0.02);
      const end = n.fish ? new THREE.Vector3(n.fish.x, -0.1, n.fish.y) : n.lure ? new THREE.Vector3(n.lure.x, 0.03, n.lure.y) : tip.clone().add(new THREE.Vector3(0, -0.3, 0));
      const mid = tip.clone().lerp(end, 0.5); mid.y -= fighting ? 0.05 : 0.4;
      n.line.geometry.setFromPoints(new THREE.QuadraticBezierCurve3(tip, mid, end).getPoints(12));
      n.bob.visible = showRod && !!n.lure && !n.fish;
      if (n.lure) n.bob.position.set(n.lure.x, 0.03 + Math.sin(Game.time * 3 + n.x) * 0.02, n.lure.y);
      n.fishMesh.visible = !!n.fish;
      if (n.fish) {
        const len = Math.max(0.3, n.fish.cm / 100);
        n.fishMesh.position.set(n.fish.x, -0.15, n.fish.y);
        n.fishMesh.rotation.y = -n.fish.ang;
        n.fishMesh.scale.set(len, 1, len);
        n.fishMesh.material.color.set(n.fish.prized ? 0xd9b44a : 0x0d2430);
      }
      // Holding the catch up for everyone to see.
      n.heldMesh.visible = !!n.held;
      if (n.held) {
        const map = Actors.portrait(n.held.sp);
        if (n.heldMesh.material.map !== map) { n.heldMesh.material.map = map; n.heldMesh.material.needsUpdate = true; }
        const len = U.clamp(n.held.cm / 100 * 1.4, 0.5, 2.2);
        n.heldMesh.scale.set(len, len, 1);
        n.heldMesh.position.set(n.x, base + 1.15, n.y + 0.25); // held up over their head
      }
    }
  },

  // Speech bubbles drawn on the HUD canvas.
  drawBubbles(hud) {
    const g = hud.g;
    for (const n of this.list) {
      if (n.bubbleT <= 0 || !n.bubble) continue;
      if (U.dist(n.x, n.y, Player.x, Player.y) > 26) continue;
      const [sx, sy, ok] = Scene3D.project(n.x, n.y, Scene3D.standH(n.x, n.y) + 1.6);
      if (!ok) continue;
      const shout = n.pose === 'brag' || /!$/.test(n.bubble) && n.bubble === n.bubble.toUpperCase();
      g.font = (shout ? '700 15px ' : '500 13px ') + UI.font;
      const w = Math.min(320, g.measureText(n.bubble).width + 20), h = 28;
      const bx = sx - w / 2, by = sy - h - 10;
      g.globalAlpha = Math.min(1, n.bubbleT * 2);
      g.fillStyle = shout ? '#fff3c4' : '#f8f4ea'; g.strokeStyle = '#3a2614'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(bx, by, w, h, 10); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(sx - 6, by + h - 1); g.lineTo(sx, by + h + 9); g.lineTo(sx + 6, by + h - 1); g.fill();
      g.fillStyle = '#2a1a0a'; g.textAlign = 'center';
      g.fillText(n.bubble, sx, by + 19, w - 12);
      g.font = '600 10px ' + UI.font; g.fillStyle = UI.accent;
      g.fillText(n.name, sx, by - 4);
      g.globalAlpha = 1;
    }
  },
};
