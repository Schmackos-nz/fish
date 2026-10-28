// The little angler: walking, running, wading.
'use strict';

const Player = {
  x: 0, y: 0, face: Math.PI / 2, moving: false, running: false, walkT: 0, wading: false, stepAcc: 0,

  place(x, y) { this.x = x; this.y = y; },

  update(dt) {
    const F = Fishing.state;
    const locked = F === 'charging' || F === 'flying' || F === 'snagged';
    let ix = 0, iy = 0;
    // During a fight A/D/S/W steer the rod, so walking uses the arrow keys only.
    const fighting = F === 'fight';
    const k = Input.keys;
    if (!fighting && !locked) {
      if (k.has('KeyA') || k.has('ArrowLeft')) ix--;
      if (k.has('KeyD') || k.has('ArrowRight')) ix++;
      if (k.has('KeyW') || k.has('ArrowUp')) iy--;
      if (k.has('KeyS') || k.has('ArrowDown')) iy++;
    } else if (fighting) {
      if (k.has('ArrowLeft')) ix--; if (k.has('ArrowRight')) ix++;
      if (k.has('ArrowUp')) iy--; if (k.has('ArrowDown')) iy++;
    }
    if (Menus.open) ix = iy = 0;
    this.moving = !!(ix || iy);
    this.running = this.moving && k.has('ShiftLeft') && !fighting;
    this.wading = World.isWater(this.x, this.y);
    if (this.moving) {
      const len = Math.hypot(ix, iy);
      let sp = this.running ? 6.5 : 3.6;
      if (this.wading) sp *= 0.5;
      if (fighting || F === 'line') sp *= 0.55;
      const dx = ix / len * sp * dt, dy = iy / len * sp * dt;
      const r = 0.22;
      if (!this.hit(this.x + dx, this.y, r)) this.x += dx;
      if (!this.hit(this.x, this.y + dy, r)) this.y += dy;
      this.walkT += dt * (this.running ? 1.5 : 1);
      if (F === 'idle' || F === 'ready') this.face = Math.atan2(iy, ix);
      this.stepAcc += dt * (this.running ? 3 : 2);
      if (this.stepAcc > 1) { this.stepAcc = 0; if (this.wading) { Sfx.plop(); Hud.ripple(this.x, this.y, 0.5); } }
    }
    // Face the cast / the line.
    if (F !== 'idle' || !this.moving) {
      if (F === 'idle' || F === 'ready' || F === 'charging') { if (!this.moving) this.face = Math.atan2(Input.mouse.wy - this.y, Input.mouse.wx - this.x); }
      else this.face = Fishing.aim;
    }
  },

  hit(x, y, r) {
    return World.blocked(x - r, y - r) || World.blocked(x + r, y - r) || World.blocked(x - r, y + r) || World.blocked(x + r, y + r);
  },
};
