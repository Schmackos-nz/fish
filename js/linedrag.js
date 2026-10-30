// Hands-on line control. Once the line's out, the mouse becomes a reel:
//  · grab the lure/bobber (or the fish) and drag it toward yourself to reel — drag speed = crank speed
//  · drag it away to let a little line off · double-tap it to strike
//  · mouse wheel sets the drag (tension) · middle-click flips the bail
'use strict';

const LineDrag = {
  grabbing: false, last: null, lastTap: -9, doubleTap: false, turns: 0, hover: false, told: false,

  active() { return CRANK_STATES.has(Fishing.state) && Fishing.lure && !Menus.open && Tools.current === 'rod'; },

  // What you grab: the lure, or whatever's on the end of it.
  target() {
    const l = Fishing.lure; if (!l) return null;
    const f = Fishing.state === 'fight' && Fight.fish ? Fight.fish : null;
    return f || l;
  },

  // Close enough to grab? Generous on screen, so small lures far away are still easy to catch hold of.
  near(t) {
    const m = Input.mouse, h = Fishing.state === 'fight' ? -0.2 : 0;
    const [sx, sy, ok] = Scene3D.project(t.x, t.y, h);
    return ok && U.dist(m.sx, m.sy, sx, sy) < 56;
  },

  update(dt) {
    this.doubleTap = false;
    if (!this.active()) { this.grabbing = false; Input.reelGrab = false; return; }
    const t = this.target(), m = Input.mouse;
    this.hover = this.near(t);
    if (!this.told) { this.told = true; Hud.toast(Mobile.active ? 'Drag the lure toward you to reel · double-tap it to strike · Bail and Drag ± buttons on the right' : 'Grab the lure and drag it toward you to reel · double-tap it to strike · wheel = drag · middle-click = bail', UI.accent, 4.5); }
    // Middle-click: bail. Wheel: drag/tension (the fight handles its own wheel).
    if (Input.mPressed || Input.pressed('KeyB')) Fishing.toggleBail();
    if (Input.pressed('KeyZ')) Fight.setDrag(Game.drag - 0.25);
    if (Input.pressed('KeyX')) Fight.setDrag(Game.drag + 0.25);
    if (Input.wheel && Fishing.state !== 'fight') Fight.setDrag(Game.drag - Math.sign(Input.wheel) * 0.25);
    // Realism: no dragging the lure in; only the reel handle on screen turns the reel.
    if (Realism.on) { this.grabbing = false; Input.reelGrab = Realism.turning; if (Input.pressed('Space')) this.doubleTap = true; return; }
    // Press on the lure: grab it (and two quick presses = strike).
    if (Input.mousePressed && this.hover) {
      const now = performance.now();
      if (now - this.lastTap < 380) { this.doubleTap = true; this.lastTap = -9; }
      else this.lastTap = now;
      this.grabbing = true; this.last = { x: m.wx, y: m.wy };
    }
    if (!m.down) this.grabbing = false;
    Input.reelGrab = this.grabbing;
    if (!this.grabbing) { this.turns = U.lerp(this.turns, 0, Math.min(1, dt * 6)); return; }
    // How far the mouse moved toward the angler (reels in) or away (lets line off).
    const dx = m.wx - this.last.x, dy = m.wy - this.last.y;
    this.last = { x: m.wx, y: m.wy };
    const ux = Player.x - t.x, uy = Player.y - t.y, ul = Math.hypot(ux, uy) || 1;
    const toward = (dx * ux + dy * uy) / ul;
    const perTurn = Game.gear.reel.gear * LINE_PER_TURN;
    if (toward > 0) {
      // A fast hand reels fast — up to what the reel can physically do.
      const maxM = 3.6 * perTurn * dt, metres = Math.min(toward, maxM);
      Input.crankAcc += metres / perTurn * Math.PI * 2;
      this.turns = U.lerp(this.turns, metres / perTurn / Math.max(dt, 1e-3), 0.4);
    } else if (toward < 0 && !Fishing.bailOpen && Fishing.state !== 'fight') {
      Fishing.lineOut += -toward * 0.5; // a little slack
      this.turns = U.lerp(this.turns, 0, 0.3);
    }
  },

  tensionRatio() {
    if (Fishing.state === 'fight') return Fight.tension / Game.gear.line.strength;
    if (Fishing.state === 'snagged') return 0.95;
    const l = Fishing.lure; if (!l || Fishing.bailOpen) return 0;
    return U.dist(Fishing.tip.x, Fishing.tip.y, l.x, l.y) >= Fishing.lineOut - 0.05 ? (this.grabbing ? 0.45 : 0.3) : 0.1;
  },
  tensionColor() {
    const t = this.tensionRatio();
    if (t > 0.88) return Math.sin(Game.time * 18) > 0 ? '#FF3B2E' : '#FFFFFF'; // about to snap — it flashes
    if (t > 0.7) return '#E3A945';
    if (t > 0.22) return '#7FD16A';
    return '#9A968C';
  },

  // Where to grab is always marked: a ring on the lure (or the fish), brighter when you're over it, green while
  // you hold it, with arrows pointing back toward you, the way to drag.
  drawGrab(hud, sx, sy) {
    const g = hud.g, hot = this.hover || this.grabbing, r = 22 + Math.sin(Game.time * 5) * 2.5;
    g.strokeStyle = this.grabbing ? '#8FD16A' : hot ? '#FFFFFF' : 'rgba(242,193,78,0.85)'; g.lineWidth = hot ? 3 : 2.5; g.setLineDash([6, 4]);
    g.beginPath(); g.arc(sx, sy, r, 0, 7); g.stroke(); g.setLineDash([]);
    if (!this.grabbing) {
      this.drawPull(g, sx, sy);
      hud.text(Fishing.state === 'fight' ? 'GRAB THE FISH' : 'GRAB & DRAG', sx, sy - r - 8, hot ? UI.ink : '#F2C14E', 11, 'center', 800);
    }
  },
  drawPull(g, sx, sy) {
    const [px, py, ok] = Scene3D.project(Player.x, Player.y, 0); if (!ok) return;
    const a = Math.atan2(py - sy, px - sx), ph = (Game.time * 1.6) % 1;
    g.fillStyle = 'rgba(242,193,78,0.9)';
    for (let i = 0; i < 3; i++) {
      const d = 34 + (i + ph) * 14, x = sx + Math.cos(a) * d, y = sy + Math.sin(a) * d;
      g.globalAlpha = 0.85 * (1 - (i + ph) / 3);
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -9); g.lineTo(-2, 0); g.lineTo(-6, 9); g.closePath(); g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  },

  // The cursor is a little reel while the line's out; the lure gets a ring when you can grab it.
  draw(hud) {
    const cv = hud.cv, on = this.active();
    if (on !== this.cursorOff) { cv.style.cursor = on ? 'none' : ''; this.cursorOff = on; }
    if (!on) return;
    if (Mobile.active) {
      // No cursor on a touchscreen: put the tension ring round the lure instead.
      const t = this.target(); if (!t) return;
      const [sx, sy, ok] = Scene3D.project(t.x, t.y, Fishing.state === 'fight' ? -0.2 : 0);
      if (!ok) return;
      const g = hud.g; g.strokeStyle = this.tensionColor(); g.lineWidth = 4;
      g.beginPath(); g.arc(sx, sy, 22, 0, 7); g.stroke();
      if (!this.grabbing) this.drawPull(g, sx, sy);
      hud.text('drag ' + Game.drag.toFixed(2) + ' kg' + (Fishing.bailOpen ? ' · bail OPEN' : ''), sx, sy + 38, Fishing.bailOpen ? UI.bad : UI.ink, 11, 'center', 600);
      return;
    }
    const g = hud.g, m = Input.mouse, t = this.target();
    if (t) {
      const [sx, sy, ok] = Scene3D.project(t.x, t.y, Fishing.state === 'fight' ? -0.2 : 0);
      if (ok) this.drawGrab(hud, sx, sy);
    }
    // Reel glyph: spool, handle spinning with your cranking, bail arm open or shut.
    this.spin = (this.spin || 0) + this.turns * 0.1;
    g.save(); g.translate(m.sx, m.sy);
    // Outline = line tension: grey slack, green just right, amber getting tight, red about to snap.
    const tc = this.tensionColor();
    g.fillStyle = '#2A2C30'; g.strokeStyle = tc; g.lineWidth = 3.5;
    g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#C8BFAE'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill();
    g.save(); g.rotate(this.spin); g.strokeStyle = '#E3B04A'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(15, 0); g.stroke();
    g.fillStyle = '#E3B04A'; g.beginPath(); g.arc(15, 0, 3.5, 0, 7); g.fill(); g.restore();
    g.restore();
    hud.text('drag ' + Game.drag.toFixed(2) + ' kg' + (Fishing.bailOpen ? ' · bail OPEN' : ''), m.sx + 20, m.sy + 26, Fishing.bailOpen ? UI.bad : UI.muted, 11, 'left', 600);
  },
};
