// Sunbathers drifting on lilos. Strategically covered, endlessly unbothered — until you hook one.
'use strict';

const LILO_COLORS = [['#e8408a', '#b02a66'], ['#f2c01a', '#b88a10'], ['#2a8ae8', '#1a5aa8'], ['#3ac24a', '#228a30'], ['#f2702a', '#b04a14']];
const SKINS = ['#f0c8a0', '#e0a878', '#c08a60', '#8a5a3a', '#f5d2b8'];
const COVERS = ['towel', 'paper', 'duck', 'towel', 'hat'];
const FLOATER_SAY = {
  chat: ['Lovely day for it!', 'Ahh… vitamin D.', 'Don\'t mind us!', 'Mind your hooks, love.', 'Eyes on the water, angler.', 'Best spot on the lake, this.', 'Caught anything? …Don\'t answer that.'],
  hooked: ['OI! Watch it!', 'HEY! I\'m not a fish!', 'Did you just HOOK me?!', 'Unbelievable.'],
  reeled: ['Stop reeling me in!', 'HEY! HEY!', 'This is NOT consensual boating!', 'I will be writing to the council!'],
  freed: ['Next time, cast AWAY from me!', 'Here\'s your lure back. Honestly.', 'Some of us are trying to relax!'],
  kept: ['Free spinner! Cheers!', 'Finders keepers!'],
  gun: ['DON\'T SHOOT!!', 'Is that a GUN?!', 'PADDLE! PADDLE!', 'We\'re LEAVING!'],
};

const Floaters = {
  list: [], group: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.list = [];
    const rng = U.mulberry32(World.seed + 321);
    // A couple on the town lake, the rest scattered across the other lakes.
    const lakes = World.lakes.filter((l) => l.kind === K.LAKE);
    for (let i = 0; i < 10; i++) {
      const lake = i < 3 ? World.lakes[0] : lakes[(rng() * lakes.length) | 0];
      for (let t = 0; t < 40; t++) {
        const a = rng() * 6.28, r = rng() * lake.r * 0.8;
        const x = lake.x + Math.cos(a) * r, y = lake.y + Math.sin(a) * r;
        if (World.depthAt(x, y) < 1.2) continue;
        this.add(x, y, rng);
        break;
      }
    }
  },

  add(x, y, rng) {
    const f = {
      x, y, vx: 0, vy: 0, ang: rng() * 6.28, spin: (rng() - 0.5) * 0.1,
      lilo: LILO_COLORS[(rng() * LILO_COLORS.length) | 0], skin: SKINS[(rng() * SKINS.length) | 0],
      cover: COVERS[(rng() * COVERS.length) | 0], shades: rng() < 0.6, flee: 0, talkT: 5 + rng() * 20, bubble: null, bubbleT: 0, hooked: false,
    };
    const geo = new THREE.PlaneGeometry(1.15, 2.3); geo.rotateX(-Math.PI / 2);
    const tex = new THREE.CanvasTexture(this.paint(f));
    tex.anisotropy = 4;
    const lilo = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.3 }));
    lilo.renderOrder = 3;
    // Tilted a little toward the camera so the sunbather reads from the angled view.
    f.mesh = new THREE.Group();
    f.mesh.rotation.x = 0.28;
    f.mesh.add(lilo);
    f.lilo3 = lilo;
    this.group.add(f.mesh);
    this.list.push(f);
  },

  // Top-down cut-out style (same look as the other characters): lilo, pillow, a round sunbather on
  // their back, and something generously covering the essentials.
  paint(f) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    const ink = 'rgba(20,14,10,0.85)';
    g.lineJoin = 'round'; g.lineCap = 'round';
    const blob = (fill, path) => { g.fillStyle = fill; g.beginPath(); path(); g.fill(); g.strokeStyle = ink; g.lineWidth = 2; g.stroke(); };
    const ell = (x, y, rx, ry, rot = 0) => () => g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    const limb = (x1, y1, x2, y2, w) => {
      for (const [col, lw] of [[ink, w + 3], [f.skin, w]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    };
    const [main, rib] = f.lilo;
    // Lilo with inflated ribs and a pillow.
    blob(main, () => g.roundRect(4, 3, 56, 122, 18));
    g.strokeStyle = rib; g.lineWidth = 2;
    for (let y = 36; y < 118; y += 11) { g.beginPath(); g.moveTo(10, y); g.lineTo(54, y); g.stroke(); }
    blob(U.shade(main, 0.35), () => g.roundRect(12, 8, 40, 22, 10));
    // Arms flopped out, legs straight.
    limb(21, 48, 9, 66, 7); limb(43, 48, 55, 66, 7);
    blob(f.skin, ell(8, 68, 4.5, 4.5)); blob(f.skin, ell(56, 68, 4.5, 4.5));
    limb(27, 86, 25, 113, 9); limb(37, 86, 39, 113, 9);
    blob(f.skin, ell(24, 116, 4.5, 5.5)); blob(f.skin, ell(40, 116, 4.5, 5.5));
    // Round body and big round head.
    blob(f.skin, ell(32, 66, 15, 23));
    blob(f.skin, ell(32, 29, 15, 14));
    blob('#5A3A1E', () => { g.moveTo(17.5, 26); g.bezierCurveTo(18, 12, 46, 12, 46.5, 26); g.quadraticCurveTo(32, 19, 17.5, 26); });
    // Face: shades or contented closed eyes, and a smile.
    if (f.shades) { blob('#151515', ell(26, 30, 5.5, 4)); blob('#151515', ell(38, 30, 5.5, 4)); g.strokeStyle = '#151515'; g.lineWidth = 2; g.beginPath(); g.moveTo(31, 30); g.lineTo(33, 30); g.stroke(); }
    else { g.strokeStyle = ink; g.lineWidth = 1.8; for (const x of [26, 38]) { g.beginPath(); g.arc(x, 29, 3.5, 0.2, Math.PI - 0.2); g.stroke(); } }
    g.strokeStyle = ink; g.lineWidth = 1.8; g.beginPath(); g.arc(32, 35, 4.5, 0.25, Math.PI - 0.25); g.stroke();
    // Strategic coverage, generously sized.
    if (f.cover === 'towel') {
      blob('#F4F4F4', () => g.roundRect(14, 58, 36, 34, 6));
      g.fillStyle = '#D23A3A'; g.fillRect(15, 66, 34, 4); g.fillStyle = '#3A6AD2'; g.fillRect(15, 78, 34, 4);
    } else if (f.cover === 'paper') {
      blob('#ECE6D4', () => g.roundRect(12, 56, 40, 36, 3));
      g.fillStyle = '#2A2A2A'; g.fillRect(16, 60, 32, 5);
      g.fillStyle = '#8A8478'; for (let y = 69; y < 88; y += 4) g.fillRect(16, y, 32, 2);
    } else if (f.cover === 'duck') {
      blob('#F2D01A', ell(32, 76, 18, 16));
      blob('#F2D01A', ell(40, 58, 9, 9));
      blob('#F2801A', ell(49, 58, 5, 3));
      g.fillStyle = '#111'; g.beginPath(); g.arc(42, 56, 1.8, 0, 7); g.fill();
    } else {
      blob('#D9C27A', ell(32, 74, 22, 20));
      blob('#C9A85A', ell(32, 74, 11, 10));
      g.strokeStyle = '#C94A4A'; g.lineWidth = 3; g.beginPath(); g.ellipse(32, 74, 13, 12, 0, 0, Math.PI * 2); g.stroke();
    }
    return c;
  },

  near(x, y, r) {
    let best = null, bd = r;
    for (const f of this.list) { const d = U.dist(x, y, f.x, f.y); if (d < bd) { bd = d; best = f; } }
    return best;
  },

  say(f, text, time = 3) { f.bubble = text; f.bubbleT = time; },

  update(dt) {
    const e = Game.env;
    for (const f of this.list) {
      f.bubbleT = Math.max(0, f.bubbleT - dt);
      f.flee = Math.max(0, f.flee - dt);
      if (f.hooked) continue; // being dragged by the line
      const [fx, fy] = World.flowAt(f.x, f.y);
      let ax = e.wind.x * 0.015 + fx * 0.25 + (Math.random() - 0.5) * 0.05;
      let ay = e.wind.y * 0.015 + fy * 0.25 + (Math.random() - 0.5) * 0.05;
      if (f.flee > 0) { const a = Math.atan2(f.y - Player.y, f.x - Player.x); ax += Math.cos(a) * 1.5; ay += Math.sin(a) * 1.5; }
      f.vx = (f.vx + ax * dt) * (1 - dt * 0.4); f.vy = (f.vy + ay * dt) * (1 - dt * 0.4);
      const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
      if (World.isWater(nx, ny) && World.depthAt(nx, ny) > 0.6) { f.x = nx; f.y = ny; } else { f.vx *= -0.5; f.vy *= -0.5; }
      f.ang += f.spin * dt;
      // Fish give the lilos a wide berth.
      if (Math.random() < dt) Fish.spookNear(f.x, f.y, 1.5);
      f.talkT -= dt;
      if (f.talkT <= 0) {
        f.talkT = 18 + Math.random() * 25;
        if (U.dist(f.x, f.y, Player.x, Player.y) < 16) this.say(f, U.pick(Math.random, FLOATER_SAY.chat));
      }
    }
  },

  onHooked(f) { f.hooked = true; this.say(f, U.pick(Math.random, FLOATER_SAY.hooked), 2.5); Hud.ripple(f.x, f.y, 1); },

  // Reeling drags the lilo toward the bank. Returns true once they're close enough to unhook themselves.
  drag(f, dx, dy, dist) {
    const nx = f.x + dx, ny = f.y + dy;
    if (World.isWater(nx, ny)) { f.x = nx; f.y = ny; }
    if (dist > 0.05 && Math.random() < 0.03) this.say(f, U.pick(Math.random, FLOATER_SAY.reeled), 2);
    return U.dist(f.x, f.y, Player.x, Player.y) < 3.5 || !World.isWater(nx, ny);
  },

  release(f, kept) {
    f.hooked = false; f.flee = 3;
    this.say(f, U.pick(Math.random, kept ? FLOATER_SAY.kept : FLOATER_SAY.freed), 3);
  },

  onGunshot() {
    for (const f of this.list) {
      if (U.dist(f.x, f.y, Player.x, Player.y) > 35) continue;
      f.flee = 6;
      this.say(f, U.pick(Math.random, FLOATER_SAY.gun), 2.5);
    }
  },

  render() {
    for (const f of this.list) {
      const vis = U.dist(f.x, f.y, Player.x, Player.y) < 50;
      f.mesh.visible = vis;
      if (!vis) continue;
      f.mesh.position.set(f.x, 0.1 + Math.sin(Game.time * 1.6 + f.x) * 0.025, f.y);
      f.lilo3.rotation.y = -f.ang;
    }
  },

  drawBubbles(hud) {
    const g = hud.g;
    for (const f of this.list) {
      if (f.bubbleT <= 0 || U.dist(f.x, f.y, Player.x, Player.y) > 30) continue;
      const [sx, sy, ok] = Scene3D.project(f.x, f.y, 0.6);
      if (!ok) continue;
      g.font = '600 13px ' + UI.font;
      const w = Math.min(300, g.measureText(f.bubble).width + 20), h = 26;
      const bx = sx - w / 2, by = sy - h - 10;
      g.globalAlpha = Math.min(1, f.bubbleT * 2);
      g.fillStyle = '#fff0f6'; g.strokeStyle = '#7a2a4a'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(bx, by, w, h, 10); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(sx - 6, by + h - 1); g.lineTo(sx, by + h + 9); g.lineTo(sx + 6, by + h - 1); g.fill();
      g.fillStyle = '#3a1a2a'; g.textAlign = 'center';
      g.fillText(f.bubble, sx, by + 18, w - 12);
      g.globalAlpha = 1;
    }
  },
};
