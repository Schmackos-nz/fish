// The little angler: walking, running, crouching, jumping, dodge-rolling, wading.
'use strict';

const JUMP_TIME = 0.55;
const ROLL_TIME = 0.42;

const Player = {
  x: 0, y: 0, z: 0, face: Math.PI / 2, moving: false, running: false, walkT: 0, wading: false, stepAcc: 0,
  crouch: false, jumpT: 0, rollT: 0, rollDir: 0, rollCool: 0,

  place(x, y) { this.x = x; this.y = y; this.z = 0; this.jumpT = 0; this.rollT = 0; },

  get airborne() { return this.jumpT > 0; },
  get rolling() { return this.rollT > 0; },
  // Rolling or mid-jump: a charging boar goes right past you.
  get evasive() { return this.rollT > 0 || this.z > 0.25; },

  update(dt) {
    const F = Fishing.state;
    const k = Input.keys;
    let ix = 0, iy = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) ix--;
    if (k.has('KeyD') || k.has('ArrowRight')) ix++;
    if (k.has('KeyW') || k.has('ArrowUp')) iy--;
    if (k.has('KeyS') || k.has('ArrowDown')) iy++;
    // You only walk with the rod in hand; once the line is out you're planted.
    if ((ix || iy) && F !== 'idle' && !Menus.open) {
      this.nagT = (this.nagT || 0) - dt;
      if (this.nagT <= 0) { this.nagT = 3; Hud.toast('Reel in first to walk — press Space', '#f2c14e', 1.6); }
    }
    const free = F === 'idle' && !Menus.open;
    if (!free) ix = iy = 0;

    // Moves: Space jump, Q dodge roll, C crouch toggle.
    this.rollCool = Math.max(0, this.rollCool - dt);
    if (free && Input.pressed('KeyC')) { this.crouch = !this.crouch; Hud.toast(this.crouch ? 'Crouching — sneaky.' : 'Standing up.', '#c8bfae', 0.9); }
    if (free && Input.pressed('Space') && !this.airborne && !this.rolling) {
      this.jumpT = JUMP_TIME; this.crouch = false;
      Sfx.whoosh(0.2);
    }
    if (free && Input.pressed('KeyQ') && !this.rolling && this.rollCool <= 0 && !this.airborne) {
      this.rollT = ROLL_TIME; this.rollCool = 0.8; this.crouch = false;
      this.rollDir = ix || iy ? Math.atan2(iy, ix) : this.face;
      Sfx.burst(0.25, 500, 0.3, 'lowpass');
    }

    if (this.jumpT > 0) {
      this.jumpT = Math.max(0, this.jumpT - dt);
      this.z = Math.sin((1 - this.jumpT / JUMP_TIME) * Math.PI) * 0.7;
      if (this.jumpT === 0) { this.z = 0; if (World.isWater(this.x, this.y)) { Sfx.splash(0.5); Hud.ripple(this.x, this.y, 0.9); } else Sfx.plop(); }
    }

    this.moving = !!(ix || iy) || this.rolling;
    this.running = !!(ix || iy) && !this.crouch && (k.has('ShiftLeft') || k.has('ShiftRight'));
    const wasWading = this.wading;
    this.wading = World.isWater(this.x, this.y) && !this.airborne;
    if (this.wading && !wasWading && !this.wadeTold) { this.wadeTold = true; Hud.toast('Wading in — slow going, and the fish can feel you coming.', '#8ec7d6', 2.5); }
    if (this.wading && !this.moving && Math.random() < dt * 0.6) Hud.ripple(this.x, this.y, 0.4);

    let dx = 0, dy = 0;
    if (this.rolling) {
      this.rollT = Math.max(0, this.rollT - dt);
      const sp = 9 * (this.wading ? 0.5 : 1);
      dx = Math.cos(this.rollDir) * sp * dt; dy = Math.sin(this.rollDir) * sp * dt;
    } else if (ix || iy) {
      const len = Math.hypot(ix, iy);
      let sp = (this.running ? 6.5 : this.crouch ? 1.8 : 3.6) * Life.speedMul();
      // Wading: the deeper it gets, the harder the going.
      if (this.wading) sp *= U.clamp(0.85 - World.depthAt(this.x, this.y) * 0.5, 0.3, 0.8);
      dx = ix / len * sp * dt; dy = iy / len * sp * dt;
      this.face = Math.atan2(iy, ix);
    }
    if (dx || dy) {
      const r = 0.22;
      if (!this.hit(this.x + dx, this.y, r)) this.x += dx;
      if (!this.hit(this.x, this.y + dy, r)) this.y += dy;
      this.walkT += dt * (this.running ? 1.5 : this.crouch ? 0.6 : 1);
      this.stepAcc += dt * (this.running ? 3 : 2);
      if (this.stepAcc > 1) {
        this.stepAcc = 0;
        if (this.wading) { Sfx.plop(); Hud.ripple(this.x, this.y, 0.6); Fish.spookNear(this.x, this.y, this.crouch ? 1.2 : 2.5); }
      }
    } else if (!this.rolling && (F === 'idle' || F === 'charging')) {
      this.face = Math.atan2(Input.mouse.wy - this.y, Input.mouse.wx - this.x);
    } else if (!this.rolling && F !== 'idle') this.face = Fishing.aim;
  },

  // Mid-jump you clear bushes and logs. If you land inside one, you can still walk out.
  blockedAt(x, y) {
    if (Interior.active) return Interior.blocked(x, y);
    if (this.z > 0.3) return World.blockedLow(x, y);
    return World.blocked(x, y) && !World.blocked(this.x, this.y) ? true : World.blocked(x, y) && World.blockedLow(x, y);
  },

  hit(x, y, r) {
    return this.blockedAt(x - r, y - r) || this.blockedAt(x + r, y - r) || this.blockedAt(x - r, y + r) || this.blockedAt(x + r, y + r);
  },
};
