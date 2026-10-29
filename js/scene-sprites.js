// Cartoon art generated at runtime: cut-out prop sprites, the ground texture and the minimap.
'use strict';

const TS = 16;      // art pixels per tile for sprites
const GROUND_PX = 13; // texture pixels per tile on the terrain (high enough for crisp cartoon outlines)

const Art = {
  sprites: {}, minimap: null,

  waterColor(dep, kind) {
    const t = U.clamp(dep / (kind === K.STREAM ? 1.6 : kind === K.RIVER ? 5 : 12), 0, 1);
    const sh = kind === K.STREAM || kind === K.RIVER ? [104, 190, 186] : [96, 176, 170];
    const dp = kind === K.RIVER ? [38, 96, 120] : [22, 64, 104];
    return [U.lerp(sh[0], dp[0], t), U.lerp(sh[1], dp[1], t), U.lerp(sh[2], dp[2], t)];
  },

  landColor(t) {
    return ({
      [T.GRASS]: [95, 154, 69], [T.MEADOW]: [134, 172, 78], [T.FOREST]: [63, 110, 53], [T.SAND]: [217, 197, 139],
      [T.ROCK]: [125, 127, 120], [T.PATH]: [179, 147, 100], [T.PLANK]: [138, 99, 56], [T.MUD]: [122, 100, 67],
      [T.FLOOR]: [156, 122, 79], [T.WATER]: [150, 132, 90],
    })[t] || [255, 0, 255];
  },

  // Cut-paper ground: flat colour regions with rounded edges and a dark outline where they meet.
  // Each terrain type is painted as a union of fat circles (outline pass, then fill pass).
  buildGroundTexture() {
    const P = GROUND_PX, W = World.W, H = World.H;
    const c = document.createElement('canvas');
    c.width = W * P; c.height = H * P;
    const g = c.getContext('2d');
    g.fillStyle = '#6DBB4A'; g.fillRect(0, 0, c.width, c.height);
    // A few big soft blotches so the grass isn't one flat sheet.
    const rng = U.mulberry32(World.seed + 41);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rng() < 0.5 ? 'rgba(255,255,200,0.05)' : 'rgba(0,40,0,0.05)';
      g.beginPath(); g.arc(rng() * c.width, rng() * c.height, 20 + rng() * 70, 0, Math.PI * 2); g.fill();
    }
    const isWet = (i) => World.tile[i] === T.WATER || (World.tile[i] === T.PLANK && World.depth[i] > 0);
    const layers = [
      { test: (t) => t === T.MEADOW, fill: '#97CF5C', line: '#4E8A32' },
      { test: (t) => t === T.FOREST, fill: '#4E9B45', line: '#244A20' },
      { test: (t) => t === T.MUD, fill: '#9C7C52', line: '#4E3A22' },
      { test: (t) => t === T.SAND, fill: '#F3DC98', line: '#9A7A40' },
      { test: (t) => t === T.ROCK, fill: '#A9A9A2', line: '#4A4A46' },
      { test: (t, i) => isWet(i), fill: '#6FB0BE', line: '#1E3448' },
      { test: (t) => t === T.PATH, fill: '#D8B477', line: '#6E4E28' },
      { test: (t) => t === T.FLOOR, fill: '#9C7A4F', line: '#3E2A18' },
    ];
    for (const L of layers) {
      const pts = [];
      for (let i = 0; i < W * H; i++) if (L.test(World.tile[i], i)) pts.push(i);
      if (!pts.length) continue;
      for (const [col, r] of [[L.line, P * 0.86], [L.fill, P * 0.66]]) {
        g.fillStyle = col; g.beginPath();
        for (const i of pts) {
          const x = (i % W + 0.5) * P, y = (((i / W) | 0) + 0.5) * P;
          g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2);
        }
        g.fill();
      }
    }
    // Texture: grass tufts, pebbles on paths and sand, cracks in mud, strata on rock, and a fine speckle.
    const r2 = U.mulberry32(World.seed + 77);
    for (let i = 0; i < W * H; i++) {
      const t = World.tile[i]; if (isWet(i) || t === T.FLOOR || t === T.PLANK) continue;
      const tx = (i % W) * P, ty = ((i / W) | 0) * P;
      for (let k = 0; k < 5; k++) { g.fillStyle = r2() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,230,0.07)'; g.fillRect(tx + r2() * P, ty + r2() * P, 1.5, 1.5); }
      if (t === T.GRASS || t === T.MEADOW || t === T.FOREST) {
        if (r2() < 0.55) {
          g.strokeStyle = t === T.FOREST ? 'rgba(20,50,18,0.55)' : 'rgba(40,90,30,0.5)'; g.lineWidth = 1;
          const x = tx + 2 + r2() * (P - 4), y = ty + 4 + r2() * (P - 5);
          g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x - 3, y - 4); g.moveTo(x, y); g.lineTo(x, y - 5); g.moveTo(x + 2, y); g.lineTo(x + 3, y - 4); g.stroke();
        }
      } else if (t === T.PATH || t === T.SAND) {
        for (let k = 0; k < 2; k++) if (r2() < 0.5) { g.fillStyle = t === T.PATH ? 'rgba(110,78,40,0.5)' : 'rgba(150,120,60,0.45)'; g.beginPath(); g.ellipse(tx + r2() * P, ty + r2() * P, 1.4 + r2() * 1.2, 1 + r2(), r2() * 3, 0, 7); g.fill(); }
      } else if (t === T.MUD) {
        if (r2() < 0.4) { g.strokeStyle = 'rgba(60,40,20,0.5)'; g.lineWidth = 1; const x = tx + r2() * P, y = ty + r2() * P; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 - r2() * 6, y + 3); g.lineTo(x + 5 - r2() * 6, y + 6); g.stroke(); }
      } else if (t === T.ROCK) {
        g.strokeStyle = 'rgba(60,60,56,0.35)'; g.lineWidth = 1; const y = ty + 3 + r2() * (P - 6);
        g.beginPath(); g.moveTo(tx, y); g.lineTo(tx + P * 0.5, y + 1.5 - r2() * 3); g.lineTo(tx + P, y); g.stroke();
      }
    }
    // Flowers and stumps: little outlined dots.
    for (let i = 0; i < W * H; i++) {
      const o = World.obj[i];
      if (o !== O.FLOWERS && o !== O.STUMP) continue;
      const tx = i % W, ty = (i / W) | 0;
      g.lineWidth = 1; g.strokeStyle = '#1E2A14';
      if (o === O.STUMP) { g.fillStyle = '#C9A46A'; g.beginPath(); g.arc((tx + 0.5) * P, (ty + 0.5) * P, P * 0.3, 0, 7); g.fill(); g.stroke(); continue; }
      for (let k = 0; k < 3; k++) {
        g.fillStyle = ['#F2E15A', '#E86A8A', '#FFFFFF', '#9A7AE8'][(k + tx) % 4];
        g.beginPath(); g.arc(tx * P + 2 + k * 2, ty * P + 2 + (k % 2) * 3, 1.3, 0, 7); g.fill(); g.stroke();
      }
    }
    return c;
  },

  bedColor(dep) {
    const t = U.clamp(dep / 4, 0, 1);
    return [U.lerp(170, 60, t), U.lerp(150, 70, t), U.lerp(100, 60, t)];
  },

  edgeTo(tx, ty, fx, fy) {
    const w = (x, y) => World.tileAt(x, y) === T.WATER;
    let e = 0;
    if (w(tx - 1, ty)) e = Math.max(e, 1 - fx * 2);
    if (w(tx + 1, ty)) e = Math.max(e, fx * 2 - 1);
    if (w(tx, ty - 1)) e = Math.max(e, 1 - fy * 2);
    if (w(tx, ty + 1)) e = Math.max(e, fy * 2 - 1);
    return U.clamp(e, 0, 1);
  },

  // Sprites are drawn at 4x resolution in logical units; lw/lh keep their in-world size.
  makeSprite(w, h, fn) {
    const SS = 4, c = document.createElement('canvas');
    c.width = w * SS; c.height = h * SS; c.lw = w; c.lh = h;
    const g = c.getContext('2d');
    g.scale(SS, SS); g.lineJoin = 'round'; g.lineCap = 'round';
    fn(g, (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); });
    return c;
  },

  // Outlined union of circles: stroke them all thick, then fill them all, so only the outer edge shows.
  blobs(g, circles, fill, line, lw = 1.6) {
    g.strokeStyle = line; g.lineWidth = lw;
    for (const [x, y, r] of circles) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = fill;
    for (const [x, y, r] of circles) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  },

  buildSprites() {
    const S = this.sprites, ink = '#1A1410';
    const trunk = (g, x, y, w, h) => { g.fillStyle = '#7A4E2A'; g.strokeStyle = ink; g.lineWidth = 1; g.beginPath(); g.roundRect(x, y, w, h, 1); g.fill(); g.stroke(); };
    S.pine = [0, 1].map((v) => this.makeSprite(20, 34, (g) => {
      trunk(g, 8.5, 25, 3, 8.5);
      const fill = v ? '#3F8F4E' : '#357F48', hi = v ? '#5AAE62' : '#4E9E5A';
      for (let i = 0; i < 3; i++) {
        const w = 17 - i * 4.5, y = 26 - i * 7.5, top = y - 11;
        g.fillStyle = fill; g.strokeStyle = ink; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(10 - w / 2, y); g.quadraticCurveTo(10, y + 2, 10 + w / 2, y); g.lineTo(10, top); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = hi; g.beginPath(); g.moveTo(10 - w / 4, y - 2); g.lineTo(10, top + 3); g.lineTo(10 - w / 8, y - 2); g.closePath(); g.fill();
      }
    }));
    S.oak = [0, 1].map((v) => this.makeSprite(26, 30, (g) => {
      trunk(g, 11, 17, 4, 12);
      const fill = v ? '#62B44E' : '#56A847';
      this.blobs(g, [[13, 12, 8.5], [7, 14, 6], [19, 14, 6], [9, 7, 5.5], [17, 7, 5.5]], fill, ink, 2);
      g.fillStyle = 'rgba(255,255,220,0.35)'; g.beginPath(); g.arc(9, 7, 3, 0, 7); g.fill();
    }));
    S.bush = this.makeSprite(16, 12, (g) => {
      this.blobs(g, [[8, 7, 4.8], [4.5, 8, 3.2], [11.5, 8, 3.2]], '#4E9E45', ink, 1.4);
      for (const [x, y] of [[5, 6], [10, 7], [8, 9]]) { g.fillStyle = '#D9363A'; g.strokeStyle = ink; g.lineWidth = 0.5; g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); g.stroke(); }
    });
    S.boulder = this.makeSprite(16, 12, (g) => {
      this.blobs(g, [[8, 7.5, 5.5], [5, 8.5, 3.5], [11, 8.5, 3.5]], '#A3A39C', ink, 1.4);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(6.5, 5.5, 2.2, 1.2, -0.4, 0, 7); g.fill();
    });
    S.log = this.makeSprite(18, 8, (g) => {
      g.fillStyle = '#8A5A30'; g.strokeStyle = ink; g.lineWidth = 1;
      g.beginPath(); g.roundRect(1.5, 2, 14, 5, 2.5); g.fill(); g.stroke();
      g.fillStyle = '#D9B47A'; g.beginPath(); g.ellipse(15.5, 4.5, 1.8, 2.5, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#8A5A30'; g.lineWidth = 0.5; g.beginPath(); g.ellipse(15.5, 4.5, 0.8, 1.2, 0, 0, 7); g.stroke();
    });
    S.reeds = this.makeSprite(14, 18, (g) => {
      for (let i = 0; i < 5; i++) {
        const x = 2 + i * 2.5, top = 6 + (i * 5) % 6;
        g.strokeStyle = ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 18); g.lineTo(x + (i - 2) * 0.4, top); g.stroke();
        g.strokeStyle = i % 2 ? '#7AAA3C' : '#5D8F2E'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, 18); g.lineTo(x + (i - 2) * 0.4, top); g.stroke();
        if (i % 2 === 0) { g.fillStyle = '#6A4428'; g.strokeStyle = ink; g.lineWidth = 0.5; g.beginPath(); g.ellipse(x + (i - 2) * 0.4, top, 0.9, 2, 0, 0, 7); g.fill(); g.stroke(); }
      }
    });
    S.lily = this.makeSprite(16, 16, (g) => {
      g.fillStyle = '#4FA048'; g.strokeStyle = ink; g.lineWidth = 1;
      g.beginPath(); g.arc(8, 8, 6.2, 0.45, Math.PI * 2); g.lineTo(8, 8); g.closePath(); g.fill(); g.stroke();
      this.blobs(g, [[10, 6, 1.6], [11.5, 6.5, 1.3], [10.5, 4.6, 1.3]], '#F5B8D2', ink, 0.6);
      g.fillStyle = '#F2D44A'; g.beginPath(); g.arc(10.6, 5.8, 0.7, 0, 7); g.fill();
    });
  },

  buildMinimap() {
    const c = document.createElement('canvas');
    c.width = World.W; c.height = World.H;
    const g = c.getContext('2d');
    const img = g.createImageData(World.W, World.H);
    for (let i = 0; i < World.W * World.H; i++) {
      const t = World.tile[i];
      let col = t === T.WATER ? this.waterColor(World.depth[i], World.kind[i]) : this.landColor(t);
      const o = World.obj[i];
      if (o === O.PINE || o === O.OAK) col = [40, 80, 42];
      img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (const b of World.buildings) { g.fillStyle = '#c94a2a'; g.fillRect(b.x, b.y, b.w, b.h); }
    this.minimap = c;
  },
};
