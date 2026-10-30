// Playing a hooked fish: tension vs drag vs line strength, side strain, jumps, slack and the net.
'use strict';

const Fight = {
  fish: null, tension: 0, spike: 0, rodSide: 0, rodLift: 0.6, hookHold: 1, slackT: 0, mode: 'run', modeT: 0,
  swim: 0, slip: 0, landReady: false, jumpWarn: 0, lastSlackWarn: 0, time: 0,

  start(f, q) {
    this.fish = f; f.state = 'hooked'; f.stamina = 1; f.airborne = false;
    this.hookHold = q; this.tension = 0; this.baseT = 0; this.spike = 0; this.rodSide = 0; this.rodLift = 0.6;
    this.slackT = 0; this.time = 0; this.landReady = false; this.jumpWarn = 0;
    Game.drag = U.clamp(Game.drag, 0.25, Game.gear.reel.maxDrag);
    this.pickMode(true);
    // Urban legends: without diamond line and the Leviathan rod, you've got seconds before it's gone.
    this.mythDoom = f.sp.myth && !Legends.geared() && Math.random() > 0.03 ? 1.5 + Math.random() * 2.5 : 0;
    Fishing.state = 'fight'; Fishing.engaged = f;
    Sfx.thunk(); Sfx.splash(0.8); Hud.ripple(f.x, f.y, 1.2);
    Fishing.say(f.prized ? "FISH ON — it's a PRIZED one! Don't lose it!" : q > 0.9 ? 'FISH ON! Solid hookset!' : 'Fish on — hook is light, keep it tight!', f.prized ? '#f2c14e' : '#8fd16a', 2);
    Fish.list.forEach((o) => { if (o !== f && o.state !== 'wander') Fish.loseInterest(o); });
  },

  pickMode(first) {
    const f = this.fish, st = f.stamina, sp = f.sp;
    const opts = [
      ['run', first ? 3 : 1.2 * st + 0.1],
      ['side', 0.8 * st + 0.1],
      ['sulk', sp.jumpy < 0.2 ? 0.9 : 0.4],
      ['jump', first ? 0 : sp.jumpy * st * 0.9],
      ['tire', (1 - st) * 1.5],
    ];
    this.mode = U.weighted(Math.random, opts, (o) => o[1])[0];
    this.modeT = 1.2 + Math.random() * 2.8;
    const away = Math.atan2(f.y - Player.y, f.x - Player.x);
    if (this.mode === 'run') this.swim = away + (Math.random() - 0.5) * 0.8;
    else if (this.mode === 'side') this.swim = away + (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 0.4);
    else if (this.mode === 'sulk') this.swim = away + (Math.random() - 0.5) * 2.5;
    else if (this.mode === 'tire') this.swim = away + Math.PI + (Math.random() - 0.5);
    else if (this.mode === 'jump') { this.jumpWarn = 0.8; this.modeT = 2.2; Fishing.say('It\'s coming up — LET GO of the reel!', '#f2c14e', 1.2); }
  },

  effort() { return { run: 1, side: 0.85, sulk: 0.55, jump: 0.7, tire: 0.2 }[this.mode]; },

  update(dt, turns) {
    const f = this.fish, sp = f.sp, gear = Game.gear, l = Fishing.lure;
    this.time += dt;
    if (this.mythDoom > 0) {
      this.mythDoom -= dt;
      Bugs.shake = Math.max(Bugs.shake, 0.4);
      if (this.mythDoom <= 0) { Fishing.say('It\'s like trying to stop a freight train… You\'ll need diamond line and a Leviathan rod.', '#B8C8FF', 3.5); return this.snap(); }
    }
    // ----- angler input -----
    // A/D lean the rod against the fish's run; cranking keeps the rod up, letting go of the reel drops it.
    const side = (Input.keys.has('KeyD') || Input.keys.has('ArrowRight') ? 1 : 0) - (Input.keys.has('KeyA') || Input.keys.has('ArrowLeft') ? 1 : 0);
    this.rodSide = U.lerp(this.rodSide, side, Math.min(1, dt * 4));
    const lift = Input.reelGrab ? 0.85 : 0.1;
    this.rodLift = U.lerp(this.rodLift, lift, Math.min(1, dt * 6));
    if (Input.pressed('KeyQ') || Input.wheel > 0) this.setDrag(Game.drag - 0.25);
    if (Input.pressed('KeyE') || Input.wheel < 0) this.setDrag(Game.drag + 0.25);

    // ----- fish behaviour -----
    this.modeT -= dt;
    if (this.modeT <= 0 && !f.airborne) this.pickMode(false);
    const tx = Fishing.tip.x, ty = Fishing.tip.y;
    let d = U.dist(tx, ty, f.x, f.y);
    const ux = (f.x - tx) / (d || 1), uy = (f.y - ty) / (d || 1); // line direction, rod -> fish
    // Side strain: rod held opposite the fish's sideways run turns its head.
    const lateral = Math.cos(this.swim) * -uy + Math.sin(this.swim) * ux;
    const strain = -this.rodSide * Math.sign(lateral) * Math.min(1, Math.abs(lateral) * 2);
    if (strain > 0.2 && this.mode !== 'jump') this.swim += Math.sign(lateral) * -1 * strain * dt * 1.2;

    const effort = this.effort();
    const thrust = Math.max(0.12, f.kg * sp.power * (f.prized ? 1.15 : 1) * effort * (0.2 + 0.8 * f.stamina)) * 0.75;
    const speed = sp.speed * (0.5 + 0.9 * f.stamina) * effort + 0.15;
    let vx = Math.cos(this.swim) * speed, vy = Math.sin(this.swim) * speed;
    // Head to deeper water when sulking; rise before a jump.
    f.z = U.lerp(f.z, this.mode === 'sulk' ? Math.min(World.depthAt(f.x, f.y) - 0.1, 4) : this.mode === 'jump' || this.mode === 'tire' ? 0.2 : 1.2, dt * 0.8);

    // ----- jump -----
    this.spike = Math.max(0, this.spike - dt * 6);
    if (this.mode === 'jump') {
      this.jumpWarn -= dt;
      if (this.jumpWarn <= 0 && !f.airborne) { f.airborne = true; f.airT = 0; f.airSpin = 0; Sfx.splash(1.2); Hud.ripple(f.x, f.y, 1.4); this.headShake(1.6); }
    }
    if (f.airborne) {
      f.airT += dt;
      const dur = 0.9;
      f.airH = Math.sin(Math.min(1, f.airT / dur) * Math.PI) * (0.5 + sp.jumpy * 0.9 + Math.min(0.6, f.kg * 0.05));
      f.airSpin = Math.sin(f.airT * 14) * 0.6;
      if (f.airT >= dur) { f.airborne = false; Sfx.splash(1.3); Hud.ripple(f.x, f.y, 1.6); this.headShake(0.8); this.pickMode(false); }
    } else if (Math.random() < dt * 0.35 * f.stamina) this.headShake(0.6);

    // ----- line mechanics -----
    const lineIn = turns * gear.reel.gear * LINE_PER_TURN;
    // Bail open mid-fight: the fish takes line freely until you crank it shut.
    if (Fishing.bailOpen) {
      if (lineIn > 0) { Fishing.bailOpen = false; Sfx.bail(); }
      else Fishing.lineOut = Math.max(Fishing.lineOut, d + 0.05);
    }
    const outward = Math.max(0, vx * ux + vy * uy);
    const taut = d >= Fishing.lineOut - 0.05;
    let T = 0;
    if (taut) {
      T = thrust * (outward / Math.max(speed, 0.01)) + (lineIn / dt) * (0.3 * f.kg + 0.25) * (0.4 + f.stamina);
      T = Math.max(T, thrust * 0.25); // holding the fish against the rod still costs something
    }
    let slipping = false;
    if (T > Game.drag) {
      // Drag gives line: the fish keeps swimming out, cranking just twists line.
      slipping = true;
      Fishing.lineOut += Math.max(outward, 0.25) * dt;
      T = Game.drag;
    } else if (taut) {
      Fishing.lineOut = Math.max(0.5, Fishing.lineOut - lineIn);
      // Can't swim out past the line; reeling hauls the fish in.
      vx -= ux * outward; vy -= uy * outward;
    } else {
      Fishing.lineOut = Math.max(d, Fishing.lineOut - lineIn);
    }
    this.slip = U.lerp(this.slip, slipping ? 1 : 0, Math.min(1, dt * 10));
    Sfx.setDrag(this.slip * U.clamp(outward + 0.4, 0.4, 1.4));

    // Move the fish, keeping it in the water.
    let nx = f.x + vx * dt, ny = f.y + vy * dt;
    if (!World.isWater(nx, ny)) {
      this.swim += Math.PI * 0.5 * (Math.random() < 0.5 ? 1 : -1);
      nx = f.x; ny = f.y;
    }
    f.x = nx; f.y = ny; f.heading = Math.atan2(vy, vx) || f.heading;
    d = U.dist(tx, ty, f.x, f.y);
    if (d > Fishing.lineOut && !slipping) {
      const k = Fishing.lineOut / d;
      const px = tx + (f.x - tx) * k, py = ty + (f.y - ty) * k;
      if (World.isWater(px, py)) { f.x = px; f.y = py; }
    }
    l.x = f.x; l.y = f.y; l.z = f.z; l.inWater = true;

    // Headshakes/jumps bypass the drag; a high rod cushions headshakes but not jumps.
    const cushion = gear.rod.cushion * (0.3 + this.rodLift * 0.7);
    const spike = f.airborne || this.mode === 'jump' ? this.spike * (0.15 + this.rodLift * 1.4) : this.spike * (1.3 - cushion);
    this.baseT = U.lerp(this.baseT, T, Math.min(1, dt * 12));
    this.tension = this.baseT + spike * Math.sqrt(f.kg) * 0.38;
    Fishing.bend = U.clamp(this.tension / gear.line.strength, 0, 1.3);

    // ----- outcomes -----
    if (this.tension > gear.line.strength * Realism.k() * (0.95 + gear.line.stretch * 0.15)) return this.snap();
    // Slack lets the hook fall out.
    if (this.tension < 0.08 && !f.airborne) {
      this.slackT += dt;
      if (this.slackT > 0.8 && this.time - this.lastSlackWarn > 2) { this.lastSlackWarn = this.time; Fishing.say('Slack line! Crank!', '#f2c14e', 0.9); }
      if (this.slackT > 1.2 && Math.random() < dt * 0.6 * (1.25 - this.hookHold)) return this.thrown('Slack line — the hook fell out.');
    } else this.slackT = 0;
    if (f.airborne && f.airT < dt * 1.5 && this.rodLift > 0.45 && Math.random() < 0.55 * this.rodLift * (1.3 - this.hookHold)) {
      return this.thrown('It threw the hook mid-jump! (Let go of the reel when it jumps.)');
    }

    // Tiring: hard pressure, side strain and drag work all count.
    const work = T / Math.max(0.2, f.kg * sp.power);
    f.stamina = U.clamp(f.stamina - dt * (0.02 + work * 0.13 * (1 + Math.max(0, strain) * 0.9) + this.slip * 0.03) / Math.pow(Math.max(0.3, f.kg), 0.3)
      + (T < 0.1 ? dt * 0.02 : 0), 0, 1);

    // Landing
    const pd = U.dist(Player.x, Player.y, f.x, f.y);
    const small = f.kg < 0.6;
    this.landReady = (pd < 2.6 && f.stamina < 0.32) || (small && pd < 1.8);
    if (this.landReady) return this.land();
  },

  headShake(power) { this.spike = Math.max(this.spike, power); },

  setDrag(v) {
    Game.drag = U.clamp(Math.round(v * 4) / 4, 0.25, Game.gear.reel.maxDrag);
    Sfx.click();
    Hud.toast('Drag ' + Game.drag.toFixed(2) + ' kg', '#c9a86a', 0.7);
  },

  end() {
    Sfx.setDrag(0);
    this.fish = null; Fishing.engaged = null; Fishing.bend = 0;
  },

  snap() {
    const f = this.fish;
    Sfx.snap();
    f.state = 'spooked'; f.airborne = false; f.t = 0; f.cool = 30;
    this.end();
    Npcs.onPlayerLoss();
    Fishing.loseLure('SNAP! Line broke at ' + this.tension.toFixed(1) + ' kg — scroll down to ease the drag, and stop reeling when it screams.');
  },

  thrown(msg) {
    const f = this.fish;
    f.state = 'spooked'; f.airborne = false; f.t = 0; f.cool = 30;
    this.end();
    Fishing.state = 'line'; Fishing.bailOpen = false;
    Fishing.lure.action = 0;
    Sfx.fail();
    Npcs.onPlayerLoss();
    Fishing.say(msg, '#e2584d', 2.6);
  },

  land() {
    const f = this.fish;
    Sfx.splash(0.6); Sfx.fanfare();
    Fish.list.splice(Fish.list.indexOf(f), 1);
    this.end();
    Fishing.state = 'idle'; Fishing.lure = null; Fishing.lineOut = 0; Fishing.bailOpen = false;
    Menus.showCatch(f);
  },
};
