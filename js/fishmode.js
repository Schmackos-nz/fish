// Fish Mode: you're the fish. Swim the lake, snap up bugs and smaller fish, and steal the locals' bait —
// nibble it and spit it out before they strike. Too greedy and you're hooked: swim away and thrash to snap
// the line before they reel you in. Get kept, or starve, and it's over. Never touches your save.
'use strict';

const FishMode = {
  on: false, x: 0, y: 0, ang: 0, vel: 0, sp: null, kg: 0.4, food: 80, hp: 100, t: 0, dashT: 0, dashCool: 0,
  bugs: [], bugT: 0, nibble: null, hooked: null, mesh: null, score: null, feed: [], tipT: 0, jumpT: 0, z: 0, depth: 0, biteCool: 0, stompCool: 0,

  start() {
    this.on = true;
    const pool = SPECIES.filter((s) => !s.legendary && !s.rare && (s.habitats.lake || 0) > 0);
    this.sp = U.pick(Math.random, pool);
    this.kg = U.clamp(this.sp.kg[0] * 0.25, 0.02, 0.07); // a tiddler: work your way up
    this.food = 80; this.hp = 100; this.t = 0; this.bugs = []; this.nibble = null; this.hooked = null; this.feed = [];
    this.score = { baits: 0, snapped: 0, released: 0, bugs: 0, fish: 0, bites: 0 };
    this.jumpT = 0; this.z = 0; this.depth = 0;
    Game.env.hour = 7.5; // the anglers are out
    Tools.current = 'hands'; Gun.out = false; Fishing.reset();
    Bugs.rate = () => 0;
    // Out in the town lake, off the dock where the locals fish.
    const d = World.dockEnd || World.lakes[0], L = World.lakes[0];
    let best = null;
    for (let r = 2; r < 30 && !best; r++) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = d.x + Math.cos(a) * r, y = d.y + Math.sin(a) * r;
      if (World.isWater(x, y) && World.depthAt(x, y) > 1 && U.dist(x, y, L.x, L.y) < L.r * 1.4) { best = { x, y }; break; }
    }
    best = best || { x: L.x, y: L.y };
    this.x = best.x; this.y = best.y; Player.place(best.x, best.y);
    this.build();
    document.body.classList.add('fishmode');
    document.getElementById('fishHud').classList.remove('hidden');
    this.hookSay();
    enterPlay();
    Scene3D.camDist = 13;
    this.log('You are a tiny ' + this.sp.name + '. WASD swim · CLICK bite · SPACE jump · hold CTRL dive · SHIFT dart. Eat bugs, grow, steal bait, bite ankles.', 'good');
  },

  // Overheard on the bank: the locals' chatter goes in your feed.
  hookSay() {
    if (this.saidHooked) return;
    this.saidHooked = true;
    const orig = Npcs.say.bind(Npcs), self = this;
    Npcs.say = function (n, text, ...rest) {
      if (self.on && n && text && U.dist(n.x, n.y, self.x, self.y) < 18) self.log(n.name + ': “' + text + '”', 'say');
      return orig(n, text, ...rest);
    };
  },

  log(text, cls = '') {
    this.feed.push({ text, cls, t: performance.now() });
    if (this.feed.length > 6) this.feed.shift();
    const el = document.getElementById('fishFeed');
    el.innerHTML = this.feed.map((f) => '<p class="' + f.cls + '">' + f.text.replace(/</g, '&lt;') + '</p>').join('');
  },

  build() {
    const col = new THREE.Color(this.sp.color), belly = new THREE.Color(this.sp.belly || '#e8e0c8'), fin = new THREE.Color(this.sp.fin || this.sp.color);
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), mat(col)); body.scale.set(1, 0.42, 0.3);
    const bel = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 10), mat(belly)); bel.scale.set(0.92, 0.32, 0.27); bel.position.y = -0.06;
    const tri = (w, h) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-w, h); s.lineTo(-w * 0.75, 0); s.lineTo(-w, -h); s.lineTo(0, 0); return new THREE.ShapeGeometry(s); };
    const finMat = new THREE.MeshLambertMaterial({ color: fin, side: THREE.DoubleSide });
    const tail = new THREE.Mesh(tri(0.42, 0.26), finMat); tail.position.x = -0.42;
    const ds = new THREE.Shape(); ds.moveTo(0.15, 0); ds.lineTo(-0.05, 0.2); ds.lineTo(-0.22, 0); const dorsal = new THREE.Mesh(new THREE.ShapeGeometry(ds), finMat); dorsal.position.y = 0.18;
    const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff }), eyeB = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const z of [-0.13, 0.13]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeW); e.position.set(0.3, 0.06, z);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeB); p.position.set(0.34, 0.06, z * 1.12);
      g.add(e, p);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 28), new THREE.MeshBasicMaterial({ color: 0xF2C14E, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12;
    g.add(body, bel, tail, dorsal);
    const root = new THREE.Group(); root.add(g, ring);
    root.traverse((m) => { m.renderOrder = 3; });
    this.mesh = root; this.body = g; this.tail = tail; this.ring = ring;
    Scene3D.scene.add(root);
    this.bugGroup = new THREE.Group(); Scene3D.scene.add(this.bugGroup);
  },

  // ---------- every frame, instead of the angler's walking ----------
  move(dt) {
    const k = Input.keys;
    let ix = 0, iy = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) ix--;
    if (k.has('KeyD') || k.has('ArrowRight')) ix++;
    if (k.has('KeyW') || k.has('ArrowUp')) iy--;
    if (k.has('KeyS') || k.has('ArrowDown')) iy++;
    if (Mobile.active && Mobile.stick) { ix += Mobile.stick.x || 0; iy += Mobile.stick.y || 0; }
    this.t += dt;
    this.dashCool -= dt; this.dashT -= dt;
    if ((Input.pressed('ShiftLeft') || Input.pressed('ShiftRight')) && this.dashCool <= 0 && !this.nibble) { this.dashT = 0.45; this.dashCool = 1.6; Sfx.splash && Sfx.splash(0.15); }
    this.biteCool -= dt; this.stompCool -= dt;
    // Dive: hold Ctrl (or C) to drop deep, out of sight and out of reach of the bank.
    const diving = (k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC')) && !this.hooked && !this.nibble && this.jumpT <= 0 && World.depthAt(this.x, this.y) > 0.7;
    this.depth = U.lerp(this.depth, diving ? 1 : 0, Math.min(1, dt * 4));
    // Jump: Space leaps clear of the water (and lets you bite further, at anything on the bank).
    if (Input.pressed('Space') && this.jumpT <= 0 && !this.nibble && this.depth < 0.5) {
      this.jumpT = 0.75; this.vel = Math.max(this.vel, 3.4); Sfx.splash && Sfx.splash(0.3); Hud.ripple(this.x, this.y, 0.7);
      if (this.hooked) this.hooked.tension += 0.14 + this.kg * 0.03; // a leap on the line is the best way to throw a hook
    }
    if (this.jumpT > 0) {
      this.jumpT -= dt;
      this.z = Math.sin(Math.max(0, this.jumpT) / 0.75 * Math.PI) * (0.9 + Math.cbrt(this.kg) * 0.5);
      if (this.jumpT <= 0) { this.z = 0; Sfx.splash && Sfx.splash(0.4); Hud.ripple(this.x, this.y, 1); this.eatBugsAt(this.x, this.y, 1.4); }
    }
    const click = Input.mousePressed && !Menus.open;
    const size = Math.cbrt(this.kg / 0.4);
    if (this.nibble) return this.updateNibble(dt, click);
    const len = Math.hypot(ix, iy);
    const top = (this.dashT > 0 ? 6.5 : 2.8) * (this.hooked ? 0.65 : 1) * (0.8 + 0.2 * size);
    if (len > 0.1) {
      const want = Math.atan2(iy, ix);
      this.ang += U.clamp(U.angDiff(this.ang, want), -dt * 7, dt * 7);
      this.vel = U.lerp(this.vel, top, Math.min(1, dt * 4));
    } else {
      this.vel = U.lerp(this.vel, 0, Math.min(1, dt * 2.5));
      if (!this.hooked) { const want = Math.atan2(Input.mouse.wy - this.y, Input.mouse.wx - this.x); this.ang += U.clamp(U.angDiff(this.ang, want), -dt * 5, dt * 5); }
    }
    let dx = Math.cos(this.ang) * this.vel * dt, dy = Math.sin(this.ang) * this.vel * dt;
    if (this.hooked) {
      const H = this.hooked, n = H.n, tx = n.x - this.x, ty = n.y - this.y, d = Math.hypot(tx, ty) || 1;
      // The angler reels you in; swimming away (and thrashing) loads the line.
      const reel = (H.give > 0 ? -0.6 : 1.05) / (0.8 + this.kg * 0.25);
      dx += tx / d * reel * dt; dy += ty / d * reel * dt;
      const away = -(Math.cos(this.ang) * tx + Math.sin(this.ang) * ty) / d * this.vel / 2.8;
      H.tension += Math.max(0, away) * dt * (0.22 + this.kg * 0.06) - dt * 0.12;
      if (click) { H.tension += 0.06 + this.kg * 0.025 + Math.random() * 0.04; this.ang += (Math.random() - 0.5) * 1.6; Hud.ripple(this.x, this.y, 0.8); Sfx.splash && Sfx.splash(0.25); }
      H.give -= dt;
      if (H.tension > 0.78 && H.give <= 0 && Math.random() < dt * 2) H.give = 0.6; // they ease off the drag
      H.tension = U.clamp(H.tension, 0, 2);
      n.t = 99; n.loseAt = -1;
      if (n.fish !== H.f || n.state !== 'fight') { this.free('Something spooked them — the line goes slack and you slip the hook.'); }
      else if (H.tension >= 1) this.snap();
      else if (d < 1.4 || !World.isWater(this.x + tx / d * 0.8, this.y + ty / d * 0.8) && d < 2.2) return this.landed();
    }
    // Stay in the water: slide along the bank.
    const nx = this.x + dx, ny = this.y + dy;
    if (World.isWater(nx, ny)) { this.x = nx; this.y = ny; }
    else if (World.isWater(nx, this.y)) this.x = nx;
    else if (World.isWater(this.x, ny)) this.y = ny;
    else this.vel *= 0.3;
    if (this.hooked) { this.hooked.f.x = this.x; this.hooked.f.y = this.y; this.hooked.f.ang = this.ang; }
    Player.x = this.x; Player.y = this.y; Player.face = this.ang; Player.moving = false;
    if (click && !this.hooked && this.biteCool <= 0) this.bite();
    this.angry(dt);
    this.vitals(dt);
    this.spawnBugs(dt);
  },

  vitals(dt) {
    this.food -= dt * (0.5 + this.kg * 0.05) * (this.dashT > 0 ? 3 : 1);
    if (this.food <= 0) { this.food = 0; this.hp -= dt * 4; if (this.hp <= 0) return this.over('Starved', 'You wasted away in ' + (World.waterName(this.x, this.y) || 'the lake') + '.'); }
    else this.hp = Math.min(100, this.hp + dt * 1.5);
    // The angler's body doesn't need anything while you're a fish.
    Game.bladder = 0; Game.bowels = 0; Game.energy = 100; Game.food = 100;
  },

  eat(amount, what) {
    this.food = Math.min(100, this.food + amount);
    this.kg += amount * 0.004 * Math.max(0.3, this.kg) + 0.002;
    Sfx.plop && Sfx.plop();
    Hud.ripple(this.x, this.y, 0.5);
    if (what) this.log(what, 'good');
  },

  mouth() { const s = 0.45 * Math.cbrt(this.kg / 0.4); return { x: this.x + Math.cos(this.ang) * s, y: this.y + Math.sin(this.ang) * s }; },

  bite() {
    this.biteCool = 0.35;
    const m = this.mouth(), reach = 1.1 + Math.cbrt(this.kg) * 0.3 + (this.jumpT > 0 ? 1.2 : 0);
    Sfx.whoosh && Sfx.whoosh(0.1);
    if (this.depth > 0.5) return this.log('Too deep to reach anything — let go of CTRL to surface.', 'dim');
    // Someone on the bank or wading in? Go for the ankles.
    const vic = Wanted.targets().filter((t) => U.dist(t.x, t.y, m.x, m.y) < reach + 0.5).sort((a, b) => U.dist(a.x, a.y, m.x, m.y) - U.dist(b.x, b.y, m.x, m.y))[0];
    if (vic) return this.bitePerson(vic);
    // A local's bait?
    const n = Npcs.list.find((q) => q.state === 'wait' && q.lure && U.dist(q.lure.x, q.lure.y, m.x, m.y) < reach);
    if (n) {
      this.nibble = { n, t: 0, strikeAt: 0.45 + Math.random() * 1.1 * (n.casts > 2 ? 1.3 : 1) };
      this.log('You mouth ' + n.name + '\'s bait… tasty. CLICK to spit it before they strike!', 'warn');
      n.lure.dip = 1;
      return;
    }
    // A bug on the surface?
    const b = this.bugs.findIndex((q) => U.dist(q.x, q.y, m.x, m.y) < reach);
    if (b >= 0) { const bug = this.bugs.splice(b, 1)[0]; this.bugGroup.remove(bug.mesh); this.score.bugs++; return this.eat(9, Math.random() < 0.3 ? U.pick(Math.random, ['Crunchy.', 'A mayfly. Lovely.', 'Gulp.']) : null); }
    // A smaller fish?
    const f = Fish.list.find((q) => q.kg < this.kg * 0.6 && U.dist(q.x, q.y, m.x, m.y) < reach + 0.4);
    if (f) { Fish.list.splice(Fish.list.indexOf(f), 1); this.score.fish++; return this.eat(28, 'You swallow a ' + f.sp.name + ' whole.'); }
    const big = Fish.list.find((q) => U.dist(q.x, q.y, m.x, m.y) < reach + 0.4);
    this.log(big ? 'That ' + big.sp.name + ' is too big to eat.' : 'You snap at nothing.', 'dim');
  },

  bitePerson(t) {
    const o = t.o;
    o.fishBites = (o.fishBites || 0) + 1; o.fishMad = 30;
    this.score.bites++;
    Sfx.slap && Sfx.slap(0.7); Hud.ripple(t.x, t.y, 0.8);
    const name = o.name || (t.kind === 'warden' ? 'The warden' : 'Someone');
    const lines = ['ARGH! A FISH BIT ME!', 'MY ANKLE!', 'Get it OFF me!', 'It\'s got TEETH!', 'Something in the water bit me!'];
    if (t.kind === 'npc') Npcs.say(o, U.pick(Math.random, lines), 2.5); else if (t.kind === 'warden') Wardens.say(o, lines, 2.5);
    this.eat(10 + this.kg * 4, null);
    // Big fish (or enough nips) put them on the ground.
    const need = Math.max(1, Math.round(4 - this.kg * 1.5));
    if (o.fishBites >= need) { Wanted.knockOut(t, 0); o.fishBites = 0; this.log(name + ' goes down, clutching their leg. (+' + Math.round(10 + this.kg * 4) + ' food)', 'good'); }
    else this.log('You bite ' + name + '! (' + o.fishBites + '/' + need + ')', 'warn');
  },

  // People you've bitten stamp at you if you surface by their feet.
  angry(dt) {
    if (this.depth > 0.5 || this.jumpT > 0 || this.stompCool > 0) return;
    for (const t of Wanted.targets()) {
      const o = t.o;
      if (!(o.fishMad > 0)) continue;
      o.fishMad -= dt * 4;
      if (U.dist(t.x, t.y, this.x, this.y) < 1.5) {
        this.stompCool = 1.4; this.hp -= 10; Hud.ripple(this.x, this.y, 1); Sfx.slap && Sfx.slap(1);
        this.log((o.name || 'Someone') + ' stamps at you! (dive with CTRL)', 'bad');
        if (this.hp <= 0) this.over('Stomped', 'You picked on the wrong ankles.');
        return;
      }
    }
  },

  eatBugsAt(x, y, r) {
    for (let i = this.bugs.length - 1; i >= 0; i--) if (U.dist(this.bugs[i].x, this.bugs[i].y, x, y) < r) { this.bugGroup.remove(this.bugs[i].mesh); this.bugs.splice(i, 1); this.score.bugs++; this.eat(9, 'Snatched a bug out of the air!'); }
  },

  updateNibble(dt, click) {
    const N = this.nibble, n = N.n;
    if (n.state !== 'wait' || !n.lure) { this.nibble = null; return this.log('The bait\'s gone — someone else got it.', 'dim'); }
    N.t += dt;
    this.x = U.lerp(this.x, n.lure.x - Math.cos(this.ang) * 0.4, Math.min(1, dt * 6));
    this.y = U.lerp(this.y, n.lure.y - Math.sin(this.ang) * 0.4, Math.min(1, dt * 6));
    Player.x = this.x; Player.y = this.y;
    if (Math.random() < dt * 5) { n.lure.dip = 0.5; Hud.ripple(n.lure.x, n.lure.y, 0.3); }
    this.vitals(dt);
    if (click || Input.keys.has('ShiftLeft')) {
      // Spit it and run: the longer you held on, the more you got.
      const got = 8 + Math.min(30, N.t * 26);
      this.nibble = null; this.score.baits++;
      this.kg *= 1.12 + Math.min(0.06, N.t * 0.04); // every bait makes you a little bigger
      n.state = 'cast'; n.t = 2 + Math.random(); n.lure = null;
      this.eat(got, 'Bait stolen! (+' + Math.round(got) + ' food) You\'re growing: ' + U.fmtKg(this.kg) + '.');
      Npcs.say(n, U.pick(Math.random, ['Bloody bait thief!', 'Cleaned me out AGAIN.', 'There\'s a smart one down there…', 'Felt that! Missed it.', 'Oi! That was my last worm.']), 3);
      return;
    }
    if (N.t >= N.strikeAt) {
      // They strike.
      this.nibble = null;
      const sz = { kg: Math.round(this.kg * 1000) / 1000, cm: Math.round((LEN_K[this.sp.id] || 45) * Math.cbrt(this.kg)) };
      const f = { sp: this.sp, kg: sz.kg, cm: sz.cm, prized: false, x: this.x, y: this.y, ang: this.ang, you: true };
      n.fish = f; n.state = 'fight'; n.t = 99; n.loseAt = -1; n.lure = null;
      this.hooked = { n, f, tension: 0, give: 0 };
      Npcs.say(n, U.pick(Math.random, ['FISH ON!', 'Got ya, ya little thief!', 'Ohh this one\'s got some fight!']), 2.5);
      Sfx.thunk && Sfx.thunk();
      this.log('HOOKED! Swim AWAY from ' + n.name + ', mash CLICK to thrash and SPACE to leap. Snap the line!', 'bad');
    }
  },

  snap() {
    const H = this.hooked; this.hooked = null;
    this.score.snapped++;
    H.n.fish = null; H.n.state = 'cast'; H.n.t = 2.5;
    Sfx.snap();
    this.hp -= 12;
    Npcs.say(H.n, U.pick(Math.random, ['NOOO! Snapped me off!', 'That was a monster, I swear.', 'Gone. Lure and all.']), 3.5, 'brag');
    this.log('SNAP! You\'re free — with a lure stuck in your lip. (' + this.score.snapped + ' line' + (this.score.snapped > 1 ? 's' : '') + ' broken)', 'good');
  },

  free(msg) { this.hooked = null; this.log(msg, 'good'); },

  landed() {
    const H = this.hooked, n = H.n; this.hooked = null;
    n.fish = null; n.state = 'cast'; n.t = 3;
    const min = SIZE_LIMITS[this.sp.id] || 0, cm = H.f.cm;
    const keep = min !== Infinity && cm >= min && Math.random() < 0.55 + Math.min(0.35, this.kg * 0.1);
    if (keep) {
      Npcs.say(n, 'Into the bucket you go. Dinner!', 4, 'brag');
      return this.over('Kept', n.name + ' landed you — ' + U.fmtKg(this.kg) + ', ' + cm + ' cm — and took you home for tea.');
    }
    // Thrown back.
    this.score.released++;
    this.hp -= 25;
    Npcs.say(n, cm < min ? 'Too small. Off you go, tiddler.' : 'Not today. Go on, grow a bit.', 3);
    const a = Math.atan2(this.y - n.y, this.x - n.x);
    for (let r = 4; r < 12; r++) { const x = n.x + Math.cos(a) * r, y = n.y + Math.sin(a) * r; if (World.isWater(x, y) && World.depthAt(x, y) > 0.8) { this.x = x; this.y = y; break; } }
    this.ang = a; this.vel = 2;
    Hud.ripple(this.x, this.y, 1.2); Sfx.splash && Sfx.splash(0.5);
    this.log('Landed… and thrown back! (' + (cm < min ? 'undersized' : 'lucky') + ') You\'re sore, but alive.', 'warn');
    if (this.hp <= 0) this.over('Done for', 'One hook too many.');
  },

  spawnBugs(dt) {
    this.bugT -= dt;
    if (this.bugT <= 0 && this.bugs.length < 7) {
      this.bugT = 2 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 9, x = this.x + Math.cos(a) * r, y = this.y + Math.sin(a) * r;
      if (World.isWater(x, y)) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0x2a2018 }));
        m.position.set(x, 0.04, y); this.bugGroup.add(m);
        this.bugs.push({ x, y, mesh: m, t: 0 });
      }
    }
    for (const b of this.bugs) { b.t += dt; b.mesh.position.y = 0.04 + Math.abs(Math.sin(b.t * 9)) * 0.03; if (Math.random() < dt * 0.6) Hud.ripple(b.x, b.y, 0.15); }
    // Far ones fly off.
    for (let i = this.bugs.length - 1; i >= 0; i--) if (U.dist(this.bugs[i].x, this.bugs[i].y, this.x, this.y) > 26) { this.bugGroup.remove(this.bugs[i].mesh); this.bugs.splice(i, 1); }
  },

  // ---------- drawing ----------
  render(dt) {
    if (!this.on || !this.mesh) return;
    const s = Math.cbrt(this.kg / 0.4) * 0.9;
    this.mesh.position.set(this.x, -0.1 + this.z - this.depth * 0.75, this.y);
    this.ring.visible = this.z < 0.2; this.ring.position.y = 0.12 + this.depth * 0.75 - this.z;
    this.body.rotation.z = this.jumpT > 0 ? (this.jumpT / 0.75 - 0.5) * 1.4 : 0;
    this.body.scale.setScalar(s);
    this.body.rotation.y = -this.ang;
    this.body.rotation.x = this.hooked ? Math.sin(this.t * 22) * 0.35 : 0;
    this.tail.rotation.y = Math.sin(this.t * (6 + this.vel * 4)) * (0.3 + this.vel * 0.12);
    this.ring.scale.setScalar(s);
    this.ring.material.color.set(this.hooked ? 0xff4a4a : this.nibble ? 0xffa030 : 0xF2C14E);
    if (Actors.player) Actors.player.visible = false;
    if (Actors.playerShadow) Actors.playerShadow.visible = false;
    if (Math.random() < dt * (this.vel > 3 ? 6 : 1.2)) Hud.ripple(this.x, this.y, 0.25);
    // HUD.
    const H = this.hooked;
    document.getElementById('fishStats').innerHTML = '<b>' + this.sp.name + '</b> · ' + U.fmtKg(this.kg) + (this.depth > 0.5 ? ' · <i>deep</i>' : '') +
      '<small>Baits ' + this.score.baits + ' · Lines snapped ' + this.score.snapped + ' · Ankles ' + this.score.bites + ' · Bugs ' + this.score.bugs + ' · Fish eaten ' + this.score.fish + ' · ' + Math.floor(this.t / 60) + ':' + String(Math.floor(this.t % 60)).padStart(2, '0') + '</small>';
    Orbs.set(this.hp, this.food, 'FOOD');
    const tip = document.getElementById('fishTip');
    if (H) tip.innerHTML = 'HOOKED by ' + H.n.name + ' — swim away, CLICK to thrash, SPACE to leap<div class="tens"><i style="width:' + Math.min(100, H.tension * 100) + '%"></i></div>';
    else if (this.nibble) tip.textContent = 'Nibbling ' + this.nibble.n.name + '\'s bait… CLICK to spit it before they strike!';
    else {
      const m = this.mouth(), near = Npcs.list.find((q) => q.state === 'wait' && q.lure && U.dist(q.lure.x, q.lure.y, m.x, m.y) < 4);
      const legs = Wanted.targets().find((t) => U.dist(t.x, t.y, m.x, m.y) < 2.6);
      tip.textContent = near ? 'A bobber up ahead: ' + near.name + '\'s bait. CLICK to bite it… if you dare.' : legs ? 'Ankles! CLICK to bite (SPACE to leap at them)' : 'WASD swim · CLICK bite · SPACE jump · hold CTRL dive · SHIFT dart';
    }
    tip.className = H ? 'bad' : this.nibble ? 'warn' : '';
  },

  over(title, why) {
    if (Game.mode === 'rogue') return;
    Game.mode = 'rogue';
    let best = null; try { best = JSON.parse(localStorage.getItem('reelwild.fishBest')); } catch (e) { /* none */ }
    const sc = { kg: Math.round(this.kg * 100) / 100, baits: this.score.baits, snapped: this.score.snapped, secs: Math.round(this.t) };
    const isBest = !best || sc.baits + sc.snapped * 2 > best.baits + best.snapped * 2;
    if (isBest) try { localStorage.setItem('reelwild.fishBest', JSON.stringify(sc)); } catch (e) { /* ignore */ }
    const el = document.getElementById('rogueCard');
    el.innerHTML = '<h2 class="dead">' + title.toUpperCase() + '</h2><p>' + why + '</p>' +
      '<div class="score"><div><b>' + sc.baits + '</b>baits stolen</div><div><b>' + sc.snapped + '</b>lines snapped</div><div><b>' + U.fmtKg(sc.kg) + '</b>final weight</div><div><b>' + Math.floor(sc.secs / 60) + 'm</b>survived</div></div>' +
      '<p class="best">' + (isBest ? '★ Best fish ever!' : 'Best: ' + best.baits + ' baits · ' + best.snapped + ' lines') + '</p>' +
      '<div class="perks"><button id="fishAgain"><b>Swim again</b><span>A new fish</span></button><button id="fishQuit"><b>Main menu</b><span>Back to being a person</span></button></div>';
    document.getElementById('rogue').classList.remove('hidden');
    document.getElementById('fishAgain').onclick = () => { sessionStorage.setItem('reelwild.autoFish', '1'); location.reload(); };
    document.getElementById('fishQuit').onclick = () => location.reload();
    Sfx.fail();
  },
};
