// Pixel art generated at runtime: prop sprites, the ground texture and the minimap.
'use strict';

const TS = 16;      // art pixels per tile for sprites
const GROUND_PX = 8; // texture pixels per tile on the terrain

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

  // The whole valley floor as one canvas (riverbeds included, the water shader tints over them).
  buildGroundTexture() {
    const P = GROUND_PX, W = World.W, H = World.H;
    const c = document.createElement('canvas');
    c.width = W * P; c.height = H * P;
    const g = c.getContext('2d');
    const img = g.createImageData(c.width, c.height);
    const px = img.data, seed = World.seed;
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const i = World.idx(tx, ty), t = World.tile[i];
      const base = t === T.WATER ? this.bedColor(World.depth[i]) : this.landColor(t);
      const tileN = (U.valueNoise(tx / 3, ty / 3, seed + 2) - 0.5) * 18;
      for (let py = 0; py < P; py++) for (let pxl = 0; pxl < P; pxl++) {
        const gx = tx * P + pxl, gy = ty * P + py;
        const n = U.hash2(gx, gy, seed);
        let r = base[0], gg = base[1], b = base[2];
        const v = (n - 0.5) * 14 + tileN;
        r += v; gg += v; b += v * 0.6;
        if (t === T.GRASS || t === T.MEADOW || t === T.FOREST) {
          if (n > 0.92) { r -= 24; gg -= 16; b -= 12; } else if (n < 0.03) { r += 30; gg += 28; b += 10; }
        } else if (t === T.PLANK) {
          if (py % 3 === 0) { r = 96; gg = 66; b = 36; }
        } else if (t === T.FLOOR) {
          if (py % 4 === 0 || pxl % 6 === 0) { r = 120; gg = 92; b = 58; }
        } else if (t === T.SAND || t === T.PATH || t === T.WATER) {
          if (n > 0.94) { r -= 28; gg -= 28; b -= 28; }
        }
        // Wet, darker banks right next to the water.
        if (t !== T.WATER && World.shore[i] === 1) {
          const e = this.edgeTo(tx, ty, pxl / P, py / P);
          r *= 1 - e * 0.35; gg *= 1 - e * 0.3; b *= 1 - e * 0.2;
        }
        const o = (gy * c.width + gx) * 4;
        px[o] = r; px[o + 1] = gg; px[o + 2] = b; px[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Flowers and stumps are flat enough to paint straight onto the ground.
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const o = World.obj[World.idx(tx, ty)];
      if (o === O.FLOWERS) for (let k = 0; k < 4; k++) {
        g.fillStyle = ['#f2e15a', '#e86a8a', '#ffffff', '#9a7ae8'][(k + tx) % 4];
        g.fillRect(tx * P + 1 + k * 2, ty * P + 2 + (k % 2) * 3, 1, 1);
      } else if (o === O.STUMP) { g.fillStyle = '#c9a46a'; g.fillRect(tx * P + 2, ty * P + 2, 4, 3); }
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

  makeSprite(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    fn(g, (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); });
    return c;
  },

  buildSprites() {
    const S = this.sprites;
    S.pine = [0, 1].map((v) => this.makeSprite(20, 34, (g, r) => {
      r(9, 26, 3, 8, '#5a3d22');
      const cols = v ? ['#24502e', '#2f6438', '#3d7a43'] : ['#1f4a33', '#2a5c3e', '#3a704a'];
      for (let i = 0; i < 4; i++) {
        const w = 18 - i * 4, y = 22 - i * 6;
        r(10 - w / 2, y, w, 6, cols[0]);
        r(10 - w / 2 + 1, y, w - 4, 4, cols[1]);
        r(10 - w / 2 + 2, y, 3, 2, cols[2]);
      }
      r(9, 0, 2, 3, cols[1]);
    }));
    S.oak = [0, 1].map((v) => this.makeSprite(26, 30, (g, r) => {
      r(11, 18, 4, 12, '#6a4526');
      const base = v ? '#4a8a3c' : '#3f7d3a', hi = v ? '#64a64c' : '#58984a', lo = '#2f6230';
      g.fillStyle = lo; g.beginPath(); g.arc(13, 12, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = base; g.beginPath(); g.arc(12, 11, 9.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = hi; g.beginPath(); g.arc(9, 8, 5, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 10; i++) r((U.hash2(i, v, 4) * 20 + 2) | 0, (U.hash2(v, i, 4) * 18 + 2) | 0, 2, 2, i % 2 ? lo : hi);
    }));
    S.bush = this.makeSprite(16, 12, (g, r) => {
      g.fillStyle = '#2f6230'; g.beginPath(); g.ellipse(8, 7, 7.5, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a8a3c'; g.beginPath(); g.ellipse(7, 6, 5.5, 3.5, 0, 0, Math.PI * 2); g.fill();
      r(4, 4, 2, 2, '#c94a4a'); r(10, 6, 2, 2, '#c94a4a');
    });
    S.boulder = this.makeSprite(16, 12, (g) => {
      g.fillStyle = '#5a5c58'; g.beginPath(); g.ellipse(8, 7, 7.5, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a8d86'; g.beginPath(); g.ellipse(7, 5.5, 5.5, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a6a9a1'; g.fillRect(5, 3, 3, 2);
    });
    S.log = this.makeSprite(18, 8, (g, r) => {
      r(1, 2, 16, 5, '#6a4526'); r(1, 2, 16, 1, '#8a5f36'); r(15, 2, 2, 5, '#c9a46a'); r(15, 4, 1, 1, '#8a5f36');
    });
    S.reeds = this.makeSprite(14, 18, (g, r) => {
      for (let i = 0; i < 6; i++) {
        const x = 1 + i * 2 + (i % 2), h = 10 + (i * 7) % 7;
        r(x, 18 - h, 1, h, i % 2 ? '#7a9a3c' : '#5d7f2e');
        if (i % 2 === 0) r(x, 18 - h - 1, 1, 3, '#6a4a2a');
      }
    });
    S.lily = this.makeSprite(16, 16, (g, r) => {
      g.fillStyle = '#3f8a3c'; g.beginPath(); g.arc(8, 8, 6.5, 0.4, Math.PI * 2); g.lineTo(8, 8); g.fill();
      g.fillStyle = '#58a24c'; g.beginPath(); g.arc(7, 7, 3, 0, Math.PI * 2); g.fill();
      r(9, 5, 3, 3, '#f2b8d0'); r(10, 6, 1, 1, '#f2e15a');
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
