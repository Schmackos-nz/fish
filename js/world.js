// Procedural valley: lakes, ponds, rivers, streams, forests, a town with a tackle shack.
'use strict';

const T = { GRASS: 0, MEADOW: 1, FOREST: 2, SAND: 3, ROCK: 4, WATER: 5, PATH: 6, PLANK: 7, MUD: 8, FLOOR: 9 };
const O = { NONE: 0, PINE: 1, OAK: 2, BUSH: 3, BOULDER: 4, REEDS: 5, LILY: 6, FLOWERS: 7, STUMP: 8, LOG: 9 };
const K = { NONE: 0, POND: 1, LAKE: 2, STREAM: 3, RIVER: 4 };
const KIND_NAME = ['', 'pond', 'lake', 'stream', 'river'];
const BLOCKING_OBJ = new Set([O.PINE, O.OAK, O.BUSH, O.BOULDER, O.LOG]);

const World = {
  W: 300, H: 300, seed: 1,
  tile: null, obj: null, kind: null, depth: null, flowX: null, flowY: null, height: null,
  lakes: [], buildings: [], spawn: { x: 0, y: 0 }, shopkeeper: { x: 0, y: 0 }, names: [],

  idx(x, y) { return y * this.W + x; },
  inB(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; },
  tileAt(x, y) { x |= 0; y |= 0; return this.inB(x, y) ? this.tile[this.idx(x, y)] : T.ROCK; },
  isWater(x, y) { return this.tileAt(Math.floor(x), Math.floor(y)) === T.WATER; },
  kindAt(x, y) { x = Math.floor(x); y = Math.floor(y); return this.inB(x, y) ? this.kind[this.idx(x, y)] : 0; },
  depthAt(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return this.inB(x, y) && this.tile[this.idx(x, y)] === T.WATER ? this.depth[this.idx(x, y)] : 0;
  },
  flowAt(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inB(x, y)) return [0, 0];
    const i = this.idx(x, y);
    return [this.flowX[i], this.flowY[i]];
  },
  objAt(x, y) { x = Math.floor(x); y = Math.floor(y); return this.inB(x, y) ? this.obj[this.idx(x, y)] : 0; },
  buildingAt(x, y) {
    for (const b of this.buildings) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
    return null;
  },
  // Player collision. Water up to about waist deep can be waded.
  blocked(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!this.inB(tx, ty)) return true;
    const i = this.idx(tx, ty);
    if (BLOCKING_OBJ.has(this.obj[i])) return true;
    if (this.tile[i] === T.WATER && this.depth[i] > 1.05) return true;
    return !!this.buildingAt(x, y);
  },

  // Collision while airborne: bushes and logs can be hopped.
  blockedLow(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!this.inB(tx, ty)) return true;
    const i = this.idx(tx, ty), o = this.obj[i];
    if (BLOCKING_OBJ.has(o) && o !== O.BUSH && o !== O.LOG) return true;
    if (this.tile[i] === T.WATER && this.depth[i] > 1.05) return true;
    return !!this.buildingAt(x, y);
  },

  generate(seed) {
    this.seed = seed;
    const W = this.W, H = this.H, N = W * H;
    const rng = U.mulberry32(seed);
    this.tile = new Uint8Array(N); this.obj = new Uint8Array(N); this.kind = new Uint8Array(N);
    this.depth = new Float32Array(N); this.flowX = new Float32Array(N); this.flowY = new Float32Array(N);
    this.height = new Float32Array(N);
    this.lakes = []; this.buildings = [];
    const moist = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, y);
      this.height[i] = U.fbm(x / 70, y / 70, seed, 5);
      moist[i] = U.fbm(x / 38, y / 38, seed + 7, 4);
    }

    // Lakes and ponds. The first lake is the town lake near the middle.
    const placeBlob = (r, kind, tries = 60) => {
      for (let t = 0; t < tries; t++) {
        const cx = 20 + rng() * (W - 40), cy = 20 + rng() * (H - 40);
        if (this.lakes.some((l) => U.dist(cx, cy, l.x, l.y) < l.r + r + 14)) continue;
        return this.carveBlob(cx, cy, r, kind);
      }
      return null;
    };
    this.carveBlob(W / 2 + (rng() - 0.5) * 20, H / 2 + (rng() - 0.5) * 20, 24, K.LAKE);
    for (let i = 0; i < 5; i++) placeBlob(10 + rng() * 11, K.LAKE);
    for (let i = 0; i < 12; i++) placeBlob(2.5 + rng() * 3, K.POND);

    // Rivers: one runs through the town lake, one crosses the valley.
    const big = this.lakes[0];
    const edgePoint = (side) => [
      [rng() * W, -2], [W + 2, rng() * H], [rng() * W, H + 2], [-2, rng() * H],
    ][side];
    const s1 = Math.floor(rng() * 4);
    let a = edgePoint(s1), b = edgePoint((s1 + 2) % 4);
    this.carveRiver(a[0], a[1], big.x, big.y, 2.2 + rng(), K.RIVER, rng, false);
    this.carveRiver(big.x, big.y, b[0], b[1], 2.6 + rng(), K.RIVER, rng, false);
    const s2 = (s1 + 1) % 4;
    a = edgePoint(s2); b = edgePoint((s2 + 2) % 4);
    this.carveRiver(a[0], a[1], b[0], b[1], 2 + rng() * 1.2, K.RIVER, rng, false);

    // Streams trickle from high ground down to the nearest lake.
    for (let s = 0, made = 0; s < 200 && made < 10; s++) {
      const x = Math.floor(10 + rng() * (W - 20)), y = Math.floor(10 + rng() * (H - 20));
      const i = this.idx(x, y);
      if (this.tile[i] === T.WATER || this.height[i] < 0.55) continue;
      let best = null, bd = 1e9;
      for (const l of this.lakes) {
        const d = U.dist(x, y, l.x, l.y);
        if (d < bd && d < 130) { bd = d; best = l; }
      }
      if (!best) continue;
      this.carveRiver(x, y, best.x, best.y, 0.6 + rng() * 0.7, K.STREAM, rng, true);
      made++;
    }

    this.computeDepth(rng);
    this.paintLand(rng, moist);
    this.buildTown(rng);
    this.nameWaters(rng);
  },

  carveBlob(cx, cy, r, kind) {
    const pad = Math.ceil(r * 1.5);
    for (let y = Math.floor(cy - pad); y <= cy + pad; y++) for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      if (!this.inB(x, y)) continue;
      const d = U.dist(x, y, cx, cy) / r + (U.fbm(x / 9, y / 9, this.seed + 11, 3) - 0.5) * 0.7;
      if (d < 1) {
        const i = this.idx(x, y);
        this.tile[i] = T.WATER; this.kind[i] = kind;
      }
    }
    const lake = { x: cx, y: cy, r, kind };
    this.lakes.push(lake);
    return lake;
  },

  // Meandering walk from (x0,y0) toward (x1,y1). Streams stop on reaching other water.
  carveRiver(x0, y0, x1, y1, radius, kind, rng, stopAtWater) {
    let x = x0, y = y0, phase = rng() * 10, steps = 0;
    const own = new Set();
    while (steps++ < 3000) {
      const toT = Math.atan2(y1 - y, x1 - x);
      const meander = Math.sin(phase + steps * 0.045) * 0.9 + (U.valueNoise(steps * 0.05, 0, this.seed + kind) - 0.5) * 1.2;
      const h = toT + meander * 0.6;
      const dx = Math.cos(h), dy = Math.sin(h);
      x += dx * 0.5; y += dy * 0.5;
      if (U.dist(x, y, x1, y1) < 2) break;
      if (x < -4 || y < -4 || x > this.W + 4 || y > this.H + 4) { if (steps > 20) break; }
      const r = radius * (0.85 + 0.3 * U.valueNoise(steps * 0.03, 5, this.seed));
      let hitOther = false;
      for (let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy++) for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
        if (!this.inB(xx, yy) || U.dist(xx + 0.5, yy + 0.5, x, y) > r) continue;
        const i = this.idx(xx, yy);
        if (this.tile[i] === T.WATER && !own.has(i)) {
          if (this.kind[i] === K.LAKE || this.kind[i] === K.POND) { hitOther = true; continue; }
          if (stopAtWater) { hitOther = true; continue; }
        }
        this.tile[i] = T.WATER; this.kind[i] = kind;
        this.flowX[i] = dx; this.flowY[i] = dy;
        own.add(i);
      }
      if (hitOther && stopAtWater && steps > 6) break;
    }
  },

  // Depth grows with distance from the bank.
  computeDepth(rng) {
    const W = this.W, H = this.H, N = W * H;
    const dist = new Float32Array(N).fill(1e9);
    const q = [];
    for (let i = 0; i < N; i++) if (this.tile[i] !== T.WATER) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (!this.inB(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
      }
    }
    for (let i = 0; i < N; i++) {
      if (this.tile[i] !== T.WATER) continue;
      const d = dist[i], x = i % W, y = (i / W) | 0;
      const n = U.fbm(x / 12, y / 12, this.seed + 21, 3);
      let dep;
      switch (this.kind[i]) {
        case K.POND: dep = Math.min(0.3 + d * 0.55, 4); break;
        case K.LAKE: dep = Math.min(0.3 + d * 0.62 + d * d * 0.012, 22); break;
        case K.RIVER: dep = Math.min(0.35 + d * 0.6, 4.5); break;
        default: dep = Math.min(0.2 + d * 0.3, 1.3);
      }
      this.depth[i] = Math.max(0.15, dep * (0.8 + n * 0.4));
    }
    this.waterDist = dist;
  },

  paintLand(rng, moist) {
    const W = this.W, H = this.H, N = W * H;
    // Distance from water on land, for beaches and banks.
    const shore = new Uint8Array(N).fill(255);
    const q = [];
    for (let i = 0; i < N; i++) if (this.tile[i] === T.WATER) { shore[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (shore[i] >= 4) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (!this.inB(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (shore[j] > shore[i] + 1) { shore[j] = shore[i] + 1; q.push(j); }
      }
    }
    this.shore = shore;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, y);
      const r = U.hash2(x, y, this.seed + 3);
      if (this.tile[i] === T.WATER) {
        const k = this.kind[i], dep = this.depth[i];
        const clump = U.valueNoise(x / 4, y / 4, this.seed + 31);
        if ((k === K.LAKE || k === K.POND) && dep < 0.9 && clump > 0.55 && r < 0.55) this.obj[i] = O.REEDS;
        else if (k === K.STREAM && dep < 0.5 && clump > 0.7 && r < 0.3) this.obj[i] = O.REEDS;
        else if ((k === K.POND || k === K.LAKE) && dep > 0.6 && dep < 3 && clump > 0.6 && r < 0.18) this.obj[i] = O.LILY;
        continue;
      }
      const h = this.height[i], m = moist[i], sd = shore[i];
      const nearStill = sd <= 2 && this.nearKind(x, y, 2, [K.LAKE, K.POND]);
      if (h > 0.7) {
        this.tile[i] = T.ROCK;
        if (r < 0.14 + (h - 0.7) * 1.5) this.obj[i] = O.BOULDER;
        else if (r < 0.2) this.obj[i] = O.PINE;
      } else if (sd <= 1 + (U.valueNoise(x / 6, y / 6, this.seed + 5) > 0.5 ? 1 : 0) && nearStill) {
        this.tile[i] = U.valueNoise(x / 7, y / 7, this.seed + 9) > 0.62 ? T.MUD : T.SAND;
      } else if (sd === 1) {
        this.tile[i] = r < 0.5 ? T.MUD : T.GRASS;
      } else if (m > 0.54) {
        this.tile[i] = T.FOREST;
        const dens = 0.12 + (m - 0.54) * 1.8;
        if (r < dens) this.obj[i] = h > 0.52 ? O.PINE : (r < dens * 0.5 ? O.OAK : O.PINE);
        else if (r < dens + 0.04) this.obj[i] = O.BUSH;
        else if (r < dens + 0.05) this.obj[i] = O.LOG;
        else if (r < dens + 0.06) this.obj[i] = O.STUMP;
      } else {
        this.tile[i] = m < 0.42 ? T.MEADOW : T.GRASS;
        if (r < 0.018) this.obj[i] = O.OAK;
        else if (r < 0.03) this.obj[i] = O.BUSH;
        else if (r < 0.075 && m < 0.46) this.obj[i] = O.FLOWERS;
        else if (r < 0.08) this.obj[i] = O.BOULDER;
      }
      if (sd <= 1 && BLOCKING_OBJ.has(this.obj[i]) && r < 0.8) this.obj[i] = O.NONE; // keep banks fishable
    }
  },

  nearKind(x, y, r, kinds) {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (this.inB(xx, yy) && kinds.includes(this.kind[this.idx(xx, yy)]) && this.tile[this.idx(xx, yy)] === T.WATER) return true;
    }
    return false;
  },

  buildTown(rng) {
    const lake = this.lakes[0];
    // Walk south from the lake centre to find the shore.
    let sx = Math.round(lake.x), sy = Math.round(lake.y);
    while (this.inB(sx, sy) && this.tile[this.idx(sx, sy)] === T.WATER) sy++;
    const cx = sx, cy = sy + 7;
    // Township clearing: a main street running south from the dock, shops either side.
    for (let y = cy - 7; y <= cy + 13; y++) for (let x = cx - 10; x <= cx + 10; x++) {
      if (!this.inB(x, y)) continue;
      const i = this.idx(x, y);
      if (this.tile[i] === T.WATER) continue;
      this.obj[i] = Math.abs(x - cx) > 8 && U.hash2(x, y, 9) < 0.3 ? O.FLOWERS : O.NONE;
      this.tile[i] = T.GRASS;
    }
    for (let y = sy - 1; y <= cy + 13; y++) for (let x = cx - 1; x <= cx; x++) {
      if (!this.inB(x, y)) continue;
      const i = this.idx(x, y);
      if (this.tile[i] !== T.WATER) { this.tile[i] = T.PATH; this.obj[i] = O.NONE; }
    }
    // Dock out over the lake.
    for (let y = sy - 8; y < sy; y++) for (let x = cx - 1; x <= cx; x++) {
      if (!this.inB(x, y)) continue;
      const i = this.idx(x, y);
      this.tile[i] = T.PLANK; this.obj[i] = O.NONE;
    }
    this.dockEnd = { x: cx, y: sy - 8 };
    // Buildings front onto the street. w/h are the footprint along x/y; face says which side the door is on.
    const shop = { x: cx + 2, y: cy - 4, w: 4, h: 6, face: 'west', type: 'shop', name: "Hettie's Tackle" };
    const ranger = { x: cx - 7, y: cy - 4, w: 4, h: 5, face: 'east', type: 'ranger', name: 'Ranger Station' };
    const store = { x: cx - 7, y: cy + 4, w: 4, h: 7, face: 'east', type: 'store', name: 'General Store' };
    for (const b of [shop, ranger, store]) {
      this.buildings.push(b);
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { this.tile[this.idx(x, y)] = T.FLOOR; this.obj[this.idx(x, y)] = O.NONE; }
    }
    this.shopkeeper = this.doorOf(shop);
    this.ranger = this.doorOf(ranger);
    this.spawn = { x: cx + 0.5, y: cy + 3.5 };
    this.town = { x: cx, y: cy };
    this.bbq = { x: cx + 2.5, y: sy + 1.5 };
    this.tim = { x: cx - 2.3, y: sy + 2.2 }; // the guide's patch, where the street meets the dock
    this.placeDusty(rng, cx, cy);
    this.placeHouses(rng);

    // Footpaths from town to each lake and out to the rivers.
    for (const l of this.lakes) if (l !== lake && l.kind === K.LAKE) this.carvePath(cx, cy + 13, l.x, l.y);
    for (let i = 0; i < 3; i++) {
      const ang = rng() * Math.PI * 2;
      this.carvePath(cx, cy + 13, cx + Math.cos(ang) * 110, cy + Math.sin(ang) * 110);
    }
  },

  // Every tile in the rectangle is dry, buildable land.
  areaFree(x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!this.inB(xx, yy)) return false;
      const t = this.tile[this.idx(xx, yy)];
      if (t === T.WATER || t === T.ROCK || t === T.PLANK || t === T.FLOOR || t === T.PATH) return false;
    }
    return true;
  },

  // Little cottages around the valley: most belong to the anglers, a few are for rent.
  placeHouses(rng) {
    this.houses = [];
    for (let tries = 0; tries < 5000 && this.houses.length < 14; tries++) {
      const a = rng() * Math.PI * 2, d = 18 + rng() * 85;
      const x = Math.round(this.town.x + Math.cos(a) * d), y = Math.round(this.town.y + Math.sin(a) * d);
      if (!this.areaFree(x - 1, y - 1, 6, 6)) continue;
      if (this.buildings.some((b) => U.dist(b.x + b.w / 2, b.y + b.h / 2, x + 2, y + 1.5) < 10)) continue;
      for (let yy = y - 1; yy <= y + 4; yy++) for (let xx = x - 1; xx <= x + 4; xx++) {
        const i = this.idx(xx, yy);
        this.obj[i] = O.NONE;
        if (this.tile[i] === T.FOREST || this.tile[i] === T.MEADOW || this.tile[i] === T.MUD) this.tile[i] = T.GRASS;
      }
      const b = { x, y, w: 4, h: 3, type: 'house', name: 'Cottage', id: this.houses.length, rent: 25 + Math.floor(rng() * 5) * 5, hue: rng() };
      this.buildings.push(b); this.houses.push(b);
    }
    const vacant = Math.min(4, this.houses.length);
    this.houses.forEach((b, i) => { b.vacant = i >= this.houses.length - vacant; if (b.vacant) b.name = 'Cottage for rent'; });
  },

  // A shady character's camp in the woods, not too far from town.
  placeDusty(rng, cx, cy) {
    for (let tries = 0; tries < 4000; tries++) {
      const a = rng() * Math.PI * 2, d = 22 + rng() * 22;
      const x = Math.floor(cx + Math.cos(a) * d), y = Math.floor(cy + Math.sin(a) * d);
      if (!this.areaFree(x - 1, y - 1, 4, 4)) continue;
      for (let yy = y - 1; yy <= y + 2; yy++) for (let xx = x - 1; xx <= x + 2; xx++) this.obj[this.idx(xx, yy)] = O.NONE;
      this.dusty = { x: x + 0.5, y: y + 0.8 };
      return;
    }
    this.dusty = { x: cx - 12, y: cy + 10 };
  },

  // A building's local frame: x runs along the front, z runs from the back wall (0) to the front (depth).
  frontLen(b) { return b.face === 'east' || b.face === 'west' ? b.h : b.w; },
  depthOf(b) { return b.face === 'east' || b.face === 'west' ? b.w : b.h; },
  localToWorld(b, lx, lz) {
    const W = this.frontLen(b), D = this.depthOf(b);
    switch (b.face) {
      case 'east': return { x: b.x + lz, y: b.y + W - lx };
      case 'west': return { x: b.x + b.w - lz, y: b.y + lx };
      case 'north': return { x: b.x + b.w - lx, y: b.y + b.h - lz };
      default: return { x: b.x + lx, y: b.y + lz };
    }
  },
  // Nearest point of shallow water next to land, for anyone heading out of the lake.
  nearestShore(x, y) {
    let best = { x, y }, bd = 1e9;
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2;
      for (let r = 1; r < 60; r += 0.5) {
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (!this.isWater(px, py) || this.depthAt(px, py) < 0.35) {
          if (r < bd) { bd = r; best = { x: x + Math.cos(a) * (r - 0.6), y: y + Math.sin(a) * (r - 0.6) }; }
          break;
        }
      }
    }
    return best;
  },

  // Door step just outside the front, near the left corner.
  doorOf(b) { return this.localToWorld(b, 0.9, this.depthOf(b) + 0.55); },

  carvePath(x0, y0, x1, y1) {
    let x = x0, y = y0, steps = 0;
    while (steps++ < 1500) {
      const ang = Math.atan2(y1 - y, x1 - x) + (U.valueNoise(steps * 0.04, 3, this.seed + 77) - 0.5) * 1.4;
      x += Math.cos(ang) * 0.5; y += Math.sin(ang) * 0.5;
      const tx = Math.floor(x), ty = Math.floor(y);
      if (!this.inB(tx, ty) || U.dist(x, y, x1, y1) < 1) break;
      const i = this.idx(tx, ty);
      if (this.tile[i] === T.WATER) {
        const k = this.kind[i];
        if (k === K.LAKE || k === K.POND) break;
        // Footbridge three planks wide, so diagonal crossings don't leave corner-to-corner gaps.
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (!this.inB(tx + ox, ty + oy)) continue;
          const j = this.idx(tx + ox, ty + oy);
          if (this.tile[j] === T.WATER && (this.kind[j] === K.RIVER || this.kind[j] === K.STREAM)) { this.tile[j] = T.PLANK; this.obj[j] = O.NONE; }
        }
        continue;
      }
      if (this.tile[i] === T.FLOOR || this.tile[i] === T.PLANK) continue;
      this.tile[i] = T.PATH;
      this.obj[i] = O.NONE;
    }
  },

  nameWaters(rng) {
    const a = ['Willow', 'Heron', 'Mirror', 'Blackwater', 'Cedar', 'Stony', 'Fern', 'Otter', 'Misty', 'Kingfisher', 'Hollow', 'Moss', 'Amber', 'Loon', 'Bramble', 'Silver'];
    const used = new Set();
    for (const l of this.lakes) {
      let n;
      do n = U.pick(rng, a); while (used.has(n) && used.size < a.length);
      used.add(n);
      l.name = n + (l.kind === K.LAKE ? ' Lake' : ' Pond');
    }
    this.lakes[0].name = 'Silverjaw Lake';
  },

  // Human description of the water at a point.
  waterName(x, y) {
    const k = this.kindAt(x, y);
    if (k === K.LAKE || k === K.POND) {
      let best = null, bd = 1e9;
      for (const l of this.lakes) { const d = U.dist(x, y, l.x, l.y) - l.r; if (d < bd) { bd = d; best = l; } }
      return best ? best.name : KIND_NAME[k];
    }
    return k === K.RIVER ? 'the river' : k === K.STREAM ? 'a stream' : '';
  },
};
