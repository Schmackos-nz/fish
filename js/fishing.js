// Casting, the reel, lure behaviour in the water, snags, knots and the hookset.
'use strict';

const LINE_PER_TURN = 0.16; // metres of line per handle turn per unit of gear ratio

const Fishing = {
  state: 'idle', bailOpen: false, power: 0, chargeT: 0, lineOut: 0,
  lure: null, engaged: null, strikeAt: 0, nibbleAt: -9, tip: { x: 0, y: 0 }, aim: 0,
  omega: 0, handle: 0, clickAcc: 0, twitchT: 0, bend: 0, tipBob: 0, knotHold: 0, snag: null, jiggleDir: 0,
  flight: null, lureId: 'spinner', ccwWarn: 0,

  reset() {
    this.state = 'idle'; this.bailOpen = false; this.lure = null; this.engaged = null; this.lineOut = 0;
    this.snag = null; this.flight = null; this.power = 0;
  },

  say(text, color = '#f3ead6', time = 2.2) { Hud.toast(text, color, time); },

  // Where the rod tip sits on the ground plane, and which way it points.
  updateTip() {
    const p = Player;
    let ang;
    if (this.state === 'idle' || this.state === 'ready' || this.state === 'charging') ang = Math.atan2(Input.mouse.wy - p.y, Input.mouse.wx - p.x);
    else if (this.lure) ang = Math.atan2(this.lure.y - p.y, this.lure.x - p.x);
    else ang = this.aim;
    if (this.state === 'fight') ang += Fight.rodSide * 0.9;
    this.aim = this.aim + U.angDiff(this.aim, ang) * 0.35;
    this.tip.x = p.x + Math.cos(this.aim) * 1.3;
    this.tip.y = p.y + Math.sin(this.aim) * 1.3;
  },

  canCastWith(id) { return (Game.lures[id] || 0) > 0; },

  selectLure(id) {
    if (this.state !== 'idle' && this.state !== 'ready') { this.say('Reel in before changing lures.', '#f2c14e'); return; }
    if (!this.canCastWith(id)) { this.say('No ' + LURE_BY_ID[id].name + ' left — buy more at the tackle shack.', '#e2584d'); return; }
    this.lureId = id;
    this.say('Tied on: ' + LURE_BY_ID[id].name, '#8fd16a', 1.4);
  },

  update(dt) {
    this.updateTip();
    // Crank input: clockwise mouse circles only (anti-reverse is on).
    const rad = Input.crank;
    const turns = Math.max(0, rad) / (Math.PI * 2);
    if (rad < 0) this.ccwWarn += -rad;
    if (this.ccwWarn > Math.PI * 6) { this.ccwWarn = 0; this.say('Crank CLOCKWISE — the anti-reverse is on.', '#f2c14e'); }
    this.handle += Math.max(0, rad);
    this.omega = U.lerp(this.omega, turns / Math.max(dt, 1e-3), Math.min(1, dt * 6));
    if (turns > 0 && this.state !== 'fight') {
      this.clickAcc += turns * 6;
      while (this.clickAcc >= 1) { this.clickAcc--; Sfx.click(); }
    }
    this.tipBob = Math.max(0, this.tipBob - dt * 3);
    this.twitchT = Math.max(0, this.twitchT - dt);
    const lineIn = turns * Game.gear.reel.gear * LINE_PER_TURN;

    switch (this.state) {
      case 'idle':
        this.bend = U.lerp(this.bend, 0, dt * 6);
        if (Input.pressed('Space')) {
          if (!this.canCastWith(this.lureId)) { this.say('Out of that lure — press 1-5 to pick another.', '#e2584d'); break; }
          this.bailOpen = true; this.state = 'ready'; Sfx.bail();
          this.say('Bail open — hold LMB to load the rod', '#f3ead6', 1.6);
        }
        break;
      case 'ready':
        if (Input.pressed('Space')) { this.bailOpen = false; this.state = 'idle'; Sfx.bail(); }
        else if (Input.mousePressed) { this.state = 'charging'; this.chargeT = 0; }
        break;
      case 'charging': {
        this.chargeT += dt;
        const ph = (this.chargeT / 1.3) % 2;
        this.power = ph < 1 ? ph : 2 - ph;
        this.bend = -this.power;
        if (!Input.mouse.down) this.release();
        break;
      }
      case 'flying': this.updateFlight(dt); break;
      case 'line': this.updateLine(dt, lineIn); break;
      case 'knot':
        this.updateDrift(dt, 0);
        if (Input.keys.has('KeyR')) {
          this.knotHold += dt;
          if (this.knotHold > 1.6) { this.state = 'line'; this.say('Knot picked out.', '#8fd16a', 1.4); }
        } else this.knotHold = Math.max(0, this.knotHold - dt * 0.5);
        break;
      case 'snagged': this.updateSnag(dt, turns); break;
      case 'fight': Fight.update(dt, turns); break;
    }
  },

  release() {
    const p = Player, rod = Game.gear.rod, L = LURE_BY_ID[this.lureId];
    const pw = this.power;
    const perfect = pw > 0.9;
    const dmul = { worm: 0.72, popper: 0.9, spoon: 1.12, crank: 0.95, spinner: 1 }[L.id];
    const dist = rod.cast * dmul * (0.12 + 0.88 * pw);
    const err = perfect ? 0 : (Math.random() - 0.5) * (1 - pw) * 0.5;
    const ang = Math.atan2(Input.mouse.wy - p.y, Input.mouse.wx - p.x) + err;
    const ft = 0.45 + dist * 0.055;
    let tx = this.tip.x + Math.cos(ang) * dist + Game.env.wind.x * ft * 1.2;
    let ty = this.tip.y + Math.sin(ang) * dist + Game.env.wind.y * ft * 1.2;
    this.flight = { sx: this.tip.x, sy: this.tip.y, tx, ty, t: 0, dur: ft, peak: 1.5 + dist * 0.12 };
    this.lure = { id: L.id, x: this.tip.x, y: this.tip.y, z: 0, h: 1.5, vx: 0, vy: 0, speed: 0, action: 0,
      inWater: false, baited: true, lastFast: -9, pops: [], bottom: false, onLand: false };
    this.lineOut = 0;
    this.state = 'flying';
    this.bend = 0.6;
    Sfx.whoosh(pw);
    if (perfect) this.say('Perfect cast!', '#8fd16a', 1.1);
  },

  updateFlight(dt) {
    const f = this.flight, l = this.lure;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    l.x = U.lerp(f.sx, f.tx, k); l.y = U.lerp(f.sy, f.ty, k);
    l.h = Math.sin(k * Math.PI) * f.peak + (1 - k) * 0.6;
    this.lineOut = Math.max(this.lineOut, U.dist(this.tip.x, this.tip.y, l.x, l.y) * 1.12);
    this.bend = U.lerp(this.bend, 0, dt * 4);
    // Feather: close the bail to stop the lure short.
    if (Input.pressed('Space') || (Input.mousePressed && f.t > 0.12)) {
      this.bailOpen = false; Sfx.bail();
      this.land();
      return;
    }
    if (k >= 1) this.land();
  },

  land() {
    const l = this.lure;
    l.h = 0;
    this.state = 'line';
    if (World.isWater(l.x, l.y)) {
      l.inWater = true;
      const dep = World.depthAt(l.x, l.y);
      l.z = l.id === 'worm' ? Math.min(1.4, dep * 0.8) : 0;
      const L = LURE_BY_ID[l.id];
      const heavy = l.id === 'spoon' ? 1 : l.id === 'worm' ? 0.4 : 0.7;
      Sfx.splash(heavy); Hud.ripple(l.x, l.y, heavy);
      Fish.spookNear(l.x, l.y, 0.6 + heavy * 0.9);
      if (L.id === 'worm') this.say('Close the bail (crank or Space) and wait…', '#f3ead6', 1.6);
    } else {
      l.onLand = true;
      const o = World.objAt(l.x, l.y);
      if (o === O.PINE || o === O.OAK || o === O.BUSH) { this.setSnag('tree'); return; }
      if (World.buildingAt(l.x, l.y)) { this.setSnag('roof'); return; }
      Sfx.plop();
    }
  },

  setSnag(where) {
    this.state = 'snagged'; this.snag = { where, tension: 0, jiggles: 0 };
    Sfx.knot();
    const txt = where === 'tree' ? 'Snagged in a tree!' : where === 'roof' ? 'Hooked the roof…' : 'Snagged on the bottom!';
    this.say(txt + '  A/D to jiggle, or crank hard to break off', '#f2c14e', 3);
  },

  // Current drift: rivers carry the lure; the line swings it across the flow.
  updateDrift(dt, bailClosedTaut) {
    const l = this.lure;
    if (!l.inWater) return;
    const [fx, fy] = World.flowAt(l.x, l.y);
    const k = World.kindAt(l.x, l.y);
    const sp = k === K.STREAM ? 0.9 : k === K.RIVER ? 0.6 : 0;
    l.x += fx * sp * dt; l.y += fy * sp * dt;
    // Wind nudges floating lures on still water.
    if (l.z < 0.1 && !sp) { l.x += Game.env.wind.x * dt * 0.06; l.y += Game.env.wind.y * dt * 0.06; }
    const d = U.dist(this.tip.x, this.tip.y, l.x, l.y);
    if (this.bailOpen) this.lineOut = Math.max(this.lineOut, d);
  },

  updateLine(dt, lineIn) {
    const l = this.lure, L = LURE_BY_ID[l.id];
    const px = l.x, py = l.y;
    this.updateDrift(dt);

    // First crank flips the bail shut, like a real spinning reel.
    if (this.bailOpen && (lineIn > 0 || Input.pressed('Space'))) {
      this.bailOpen = false; Sfx.bail();
      const slack = this.lineOut - U.dist(this.tip.x, this.tip.y, l.x, l.y);
      if (slack > 2.5 && this.omega > 1.2 && Math.random() < 0.35) {
        this.state = 'knot'; this.knotHold = 0; Sfx.knot();
        this.say('Wind knot! Too much slack — hold R to pick it out', '#e2584d', 3);
        return;
      }
      lineIn = 0;
    } else if (!this.bailOpen && Input.pressed('Space')) {
      this.hookset();
      if (this.state !== 'line') return;
    }

    if (!this.bailOpen) {
      this.lineOut = Math.max(0, this.lineOut - lineIn);
      if (Input.rPressed) this.twitch();
      const d = U.dist(this.tip.x, this.tip.y, l.x, l.y);
      if (d > this.lineOut && d > 0.01) {
        // Taut: lure is pulled toward the rod tip (and swings in current).
        const k = (d - this.lineOut) / d;
        l.x += (this.tip.x - l.x) * k; l.y += (this.tip.y - l.y) * k;
      }
    }

    // Measure the lure's real speed through the water.
    const vx = (l.x - px) / dt, vy = (l.y - py) / dt;
    l.vx = U.lerp(l.vx, vx, Math.min(1, dt * 8)); l.vy = U.lerp(l.vy, vy, Math.min(1, dt * 8));
    const [fx, fy] = World.flowAt(l.x, l.y);
    const flowSp = World.kindAt(l.x, l.y) === K.STREAM ? 0.9 : World.kindAt(l.x, l.y) === K.RIVER ? 0.6 : 0;
    // Speed relative to the water is what makes a blade spin.
    l.speed = Math.hypot(l.vx - fx * flowSp, l.vy - fy * flowSp);
    if (l.speed > 0.8) l.lastFast = Game.time;

    const wasWater = l.inWater;
    l.inWater = World.isWater(l.x, l.y);
    if (l.inWater && !wasWater) { Sfx.plop(); l.onLand = false; }
    if (!l.inWater) {
      l.onLand = true; l.z = 0; l.action = 0;
      const o = World.objAt(l.x, l.y);
      if ((o === O.BUSH || o === O.PINE || o === O.OAK || o === O.LOG) && Math.random() < dt * 4) { this.setSnag('tree'); return; }
    } else {
      this.updateDepth(dt, l, L);
      l.action = U.lerp(l.action, this.actionQuality(l), Math.min(1, dt * 3));
      if (this.bailOpen) l.action *= 0.98;
    }

    // Back at the rod tip: lure is out of the water.
    if (U.dist(this.tip.x, this.tip.y, l.x, l.y) < 1.1 && !this.bailOpen) {
      const follower = Fish.list.find((f) => f.state === 'follow');
      if (follower) this.say('A ' + follower.sp.name + ' followed it right in…', '#8ec7d6', 2);
      this.state = 'idle'; this.lure = null; this.lineOut = 0; this.engaged = null;
      if (!l.baited && l.id === 'worm') this.useLure('worm'); // re-bait costs a worm
    }
  },

  updateDepth(dt, l, L) {
    const dep = World.depthAt(l.x, l.y);
    const v = l.speed;
    if (l.id === 'popper') l.z = 0;
    else if (l.id === 'worm') l.z = U.lerp(l.z, Math.min(1.4, dep - 0.15), dt);
    else if (l.id === 'crank') {
      const dive = Math.min(3.2, v * 2.1);
      l.z += (v > 0.3 ? (dive - l.z) * 1.2 : L.sink) * dt;
    } else {
      const lift = l.id === 'spinner' ? 0.3 : 0.75;
      l.z += (L.sink - v * lift) * dt;
    }
    l.z = U.clamp(l.z, 0, Math.max(0, dep - 0.05));
    l.bottom = l.z >= dep - 0.06 && l.id !== 'popper' && l.id !== 'worm';
    if (l.bottom && v > 0.25 && Math.random() < dt * 0.12 * L.snag * (1 + v)) this.setSnag('bottom');
  },

  // 0..1: how alive the lure looks in the water.
  actionQuality(l) {
    const v = l.speed, now = Game.time;
    const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
    switch (l.id) {
      case 'spinner': return v < 0.4 ? 0.12 : bell(v, 1.2, 0.75);
      case 'spoon': {
        const flutter = v < 0.35 && now - l.lastFast < 1.6 && !l.bottom;
        return flutter ? 1 : 0.55 * bell(v, 1.3, 0.8);
      }
      case 'crank': return bell(v, 1.4, 0.8) * (l.z > 0.8 ? 1 : 0.6) + (l.bottom && v > 0.3 ? 0.2 : 0);
      case 'popper': {
        l.pops = l.pops.filter((t) => now - t < 5);
        if (v > 0.9) return 0.15; // dragged, not popped
        if (!l.pops.length) return 0.25;
        const since = now - l.pops[l.pops.length - 1];
        return since > 0.6 && since < 3.5 ? 1 : 0.55;
      }
      case 'worm': return !l.baited ? 0 : v < 0.15 ? 1 : v < 0.5 ? 0.45 : 0.1;
    }
    return 0;
  },

  twitch() {
    const l = this.lure;
    if (!l || this.twitchT > 0) return;
    this.twitchT = 0.25; this.tipBob = 1;
    const d = U.dist(this.tip.x, this.tip.y, l.x, l.y) || 1;
    const k = Math.min(0.55, d) / d;
    l.x += (this.tip.x - l.x) * k; l.y += (this.tip.y - l.y) * k;
    if (l.inWater && l.id === 'popper') { l.pops.push(Game.time); Sfx.pop(); Hud.ripple(l.x, l.y, 0.6); }
    else if (l.inWater) Sfx.plop();
    l.lastFast = Game.time;
  },

  onNibble(f) {
    this.nibbleAt = Game.time; this.tipBob = 0.5;
    if (this.lure) { this.lure.dip = 0.4; Hud.ripple(this.lure.x, this.lure.y, 0.3); }
    Sfx.nibble();
  },

  onStrike(f) {
    this.engaged = f; this.strikeAt = Game.time; this.tipBob = 1.5;
    if (this.lure) this.lure.dip = 1.2;
    Sfx.thunk();
    Hud.ripple(f.x, f.y, 0.8);
    this.say(this.lure && this.lure.id === 'worm' ? 'Bobber\'s DOWN!  [SPACE] set the hook!' : 'THUNK!  [SPACE] set the hook!', '#f2c14e', 0.9);
  },

  onMissed(f) {
    if (this.engaged === f) this.engaged = null;
    this.say('Too slow — it spat the lure.', '#e2584d', 1.6);
    Sfx.fail();
  },

  hookset() {
    const l = this.lure, f = this.engaged;
    this.tipBob = 1.4; this.bend = 0.9;
    const slack = this.lineOut - U.dist(this.tip.x, this.tip.y, l.x, l.y);
    if (!f || f.state !== 'strike') {
      // Struck at a nibble: the fish is gone.
      if (Game.time - this.nibbleAt < 0.6) {
        const nib = Fish.list.find((x) => x.state === 'nibble');
        if (nib) { Fish.spook(nib, Player.x, Player.y); nib.cool = 10; }
        this.say('Too early — that was just a nibble!', '#e2584d', 1.8);
        Sfx.fail();
      }
      this.twitch();
      return;
    }
    const window = l.id === 'worm' ? 1.2 : 0.9;
    const react = (Game.time - this.strikeAt) / window;
    const taut = slack < 1 ? 1 : slack < 3 ? 0.7 : 0.4;
    const q = Game.gear.rod.hookset * taut * (1.05 - react * 0.35) * (0.8 + Math.random() * 0.35);
    if (q > 0.5) {
      Fight.start(f, U.clamp(q, 0.5, 1.2));
    } else {
      Fish.spook(f, Player.x, Player.y); f.cool = 12; this.engaged = null;
      this.say(taut < 1 ? 'Missed — too much slack in the line!' : 'Missed the hookset!', '#e2584d', 1.8);
      Sfx.fail();
    }
  },

  updateSnag(dt, turns) {
    const s = this.snag;
    // Rapid A/D alternation jiggles the lure.
    const dir = Input.pressed('KeyA') ? -1 : Input.pressed('KeyD') ? 1 : 0;
    if (dir && dir !== this.jiggleDir) {
      this.jiggleDir = dir; s.jiggles++; this.tipBob = 0.8; Sfx.click();
      if (Math.random() < (s.where === 'bottom' ? 0.13 : 0.08)) {
        this.state = 'line'; this.snag = null;
        this.say('Popped it free!', '#8fd16a', 1.4);
        if (this.lure.onLand && s.where !== 'bottom') { this.lure.x += (this.tip.x - this.lure.x) * 0.15; this.lure.y += (this.tip.y - this.lure.y) * 0.15; this.lure.inWater = World.isWater(this.lure.x, this.lure.y); }
        return;
      }
    }
    s.tension = Math.max(0, s.tension + turns * 2.2 - dt * 0.6);
    this.bend = U.clamp(s.tension / Game.gear.line.strength, 0, 1.2);
    if (s.tension > Game.gear.line.strength) {
      Sfx.snap();
      this.loseLure('Line snapped — lure lost.');
    }
  },

  useLure(id) { Game.lures[id] = Math.max(0, (Game.lures[id] || 0) - 1); },

  loseLure(msg) {
    this.useLure(this.lure ? this.lure.id : this.lureId);
    this.say(msg, '#e2584d', 2.2);
    this.state = 'idle'; this.lure = null; this.lineOut = 0; this.engaged = null; this.snag = null; this.bailOpen = false;
    if (!this.canCastWith(this.lureId)) {
      const any = LURES.find((x) => this.canCastWith(x.id));
      if (any) this.lureId = any.id;
    }
    Game.save();
  },

};
