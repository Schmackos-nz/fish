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
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
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

  // Top-down pixel art: lilo, pillow, person on their back, something covering the essentials.
  paint(f) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 32;
    const g = c.getContext('2d');
    const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const [main, rib] = f.lilo, edge = U.shade(f.skin, -0.45);
    r(0, 0, 16, 32, rib); r(1, 1, 14, 30, main);
    for (let y = 4; y < 31; y += 4) r(1, y, 14, 1, rib); // inflated ribs
    r(3, 1, 10, 6, U.shade(main, 0.35)); // pillow
    // Person outline first, then fill, so they pop against the lilo.
    const body = (col, o) => {
      r(5 - o, 2 - o, 6 + o * 2, 5 + o * 2, col);   // head
      r(4 - o, 7 - o, 8 + o * 2, 10 + o * 2, col);  // torso
      r(1 - o, 8 - o, 3 + o, 3 + o * 2, col); r(12, 8 - o, 3 + o, 3 + o * 2, col); // arms flopped out
      r(4 - o, 17, 3 + o * 2, 12 + o, col); r(9 - o, 17, 3 + o * 2, 12 + o, col);   // legs
    };
    body(edge, 1); body(f.skin, 0);
    r(5, 2, 6, 2, '#4a2a12'); // hair
    if (f.shades) { r(5, 4, 6, 1, '#111'); r(6, 4, 1, 1, '#4a6a9a'); r(9, 4, 1, 1, '#4a6a9a'); }
    r(7, 6, 2, 1, U.shade(f.skin, -0.3)); // contented smile
    // Strategic coverage, generously sized.
    if (f.cover === 'towel') { r(3, 10, 10, 10, '#f4f4f4'); r(3, 12, 10, 2, '#d23a3a'); r(3, 16, 10, 2, '#3a6ad2'); }
    else if (f.cover === 'paper') { r(2, 9, 12, 11, '#ece6d4'); r(3, 10, 10, 2, '#2a2a2a'); for (let y = 13; y < 19; y += 2) r(3, y, 10, 1, '#8a8478'); }
    else if (f.cover === 'duck') { r(3, 11, 10, 9, '#f2d01a'); r(8, 8, 5, 5, '#f2d01a'); r(12, 10, 3, 2, '#f2801a'); r(10, 9, 1, 1, '#111'); r(4, 12, 4, 3, '#e8b81a'); }
    else { r(2, 10, 12, 10, '#d9c27a'); r(5, 12, 6, 6, '#b8984a'); r(2, 14, 12, 2, '#c94a4a'); } // giant sun hat
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
