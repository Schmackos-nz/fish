// Swimming: dive into deep water from the bank (E), or end up in it hopping off a boat mid-lake. Front crawl
// anywhere the water goes; it tires you out, and you climb out wherever it gets shallow (or onto a dock).
'use strict';

const Swim = {
  on: false, prevTool: null, tiredT: 0,

  deep(x, y) { return World.isWater(x, y) && World.depthAt(x, y) > 1.05; },

  start(x, y) {
    if (this.on) return;
    this.on = true; this.tiredT = 0;
    Fishing.reelInFast(); Gun.out = false;
    if (Tools.current !== 'hands') { this.prevTool = Tools.current; Tools.current = 'hands'; }
    Player.place(x, y); Player.crouch = false; Player.wading = false;
    Sfx.splash(0.8); Hud.ripple(x, y, 1.1); Fish.spookNear(x, y, 6);
    if (!this.told) { this.told = true; Hud.toast('Swimming! WASD to swim (Shift for a sprint). It wears you out — head for the shallows or a dock to climb out.', '#8ec7d6', 3.4); }
  },

  stop() {
    if (!this.on) return;
    this.on = false;
    if (this.prevTool) { Tools.current = this.prevTool; this.prevTool = null; }
  },

  // Called from Player.update instead of walking.
  move(dt, ix, iy) {
    const P = Player, k = Input.keys;
    P.running = false; P.wading = false; P.crouch = false;
    P.moving = !!(ix || iy);
    const sprint = P.moving && (k.has('ShiftLeft') || k.has('ShiftRight')) && Game.energy > 3;
    if (P.moving) {
      const len = Math.hypot(ix, iy), sp = (sprint ? 3.0 : 1.9) * dt;
      const nx = P.x + ix / len * sp, ny = P.y + iy / len * sp;
      // Water of any depth is open; land you can clamber onto; docks and buildings you can't swim through.
      const ok = (x, y) => World.isWater(x, y) || (!World.blocked(x, y) && World.tileAt(Math.floor(x), Math.floor(y)) !== T.PLANK);
      if (ok(nx, P.y)) P.x = nx;
      if (ok(P.x, ny)) P.y = ny;
      P.face = Math.atan2(iy, ix);
      P.walkT += dt * (sprint ? 1.5 : 1);
      if (Math.random() < dt * 3) Hud.ripple(P.x - Math.cos(P.face) * 0.4, P.y - Math.sin(P.face) * 0.4, 0.5);
      if (Math.random() < dt * 1.5) Sfx.plop();
      Fish.spookNear(P.x, P.y, 3);
    } else if (Math.random() < dt * 0.8) Hud.ripple(P.x, P.y, 0.45);
    // Swimming is hard work; run out of puff and you start going under.
    Game.energy = Math.max(0, Game.energy - dt * (sprint ? 0.9 : P.moving ? 0.3 : 0.12));
    if (Game.energy <= 0) {
      Wanted.health = Math.max(0, Wanted.health - dt * 3);
      this.tiredT -= dt;
      if (this.tiredT <= 0) { this.tiredT = 4; Hud.toast('You\'re exhausted and swallowing water — get to the shore!', UI.bad, 2.4); }
    }
    // Back in your depth: wade out.
    if (!this.deep(P.x, P.y)) this.stop();
  },

  interactions(add) {
    if (Interior.active || Bikes.riding || Boats.riding) return;
    const P = Player;
    if (this.on) {
      // Haul yourself up onto a dock.
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, x = P.x + Math.cos(a) * 1.0, y = P.y + Math.sin(a) * 1.0;
        if (World.tileAt(Math.floor(x), Math.floor(y)) === T.PLANK) { add(x, y, 1.6, 'Climb up onto the dock', () => { this.stop(); P.place(Math.floor(x) + 0.5, Math.floor(y) + 0.5); Sfx.splash(0.3); }); return; }
      }
      return;
    }
    if (World.isWater(P.x, P.y) && World.depthAt(P.x, P.y) > 0.9) return add(P.x, P.y, 1, 'Swim', () => this.start(P.x, P.y));
    for (let r = 0.8; r <= 1.6; r += 0.4) for (let k = 0; k < 12; k++) {
      const a = P.face + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6), x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
      if (this.deep(x, y)) return add(x, y, 1.8, 'Dive in for a swim', () => this.start(x, y));
    }
  },

  // Front crawl, low in the water.
  pose(rig) {
    const s = Player.walkT * 2.2;
    rig.upper.rotation.set(0, 0, -1.15);
    rig.armR.rotation.set(0, 0, Player.moving ? s * 2.4 : Math.sin(Game.time * 2) * 0.6 + 1.2);
    rig.armL.rotation.set(0, 0, Player.moving ? s * 2.4 + Math.PI : -Math.sin(Game.time * 2) * 0.6 + 1.2);
    rig.legL.rotation.set(0, 0, Math.sin(s * 9) * 0.3); rig.legR.rotation.set(0, 0, -Math.sin(s * 9) * 0.3);
    rig.yaw.position.y = 0; rig.yaw.scale.y = 1;
  },
};
