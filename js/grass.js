// Stylised animated grass: thousands of instanced blades around the camera, swaying in the wind in a vertex
// shader and parting round the player's feet. Rebuilt for the area in view whenever the camera drifts.
'use strict';

const Grass = {
  mesh: null, cx: -1e9, cy: -1e9, cap: 0,

  build() {
    if (this.mesh) { Scene3D.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    const touch = matchMedia('(pointer: coarse)').matches;
    this.R = touch ? 18 : 26; this.dens = touch ? 6 : 12;
    this.cap = (this.R * 2 + 1) ** 2 * this.dens;
    // One blade: a tapered strip, three rows high so it can curve.
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.38, 0.45, 0, 0.38, 0.45, 0, -0.18, 0.78, 0, 0.18, 0.78, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
    this.iData = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4);
    this.iCol = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
    for (const a of [this.iPos, this.iData, this.iCol]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos); g.setAttribute('iData', this.iData); g.setAttribute('iCol', this.iCol);
    g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.5, 0.2) }, uPush: { value: new THREE.Vector3(-999, 0, -999) }, uLight: { value: new THREE.Color(1, 1, 1) }, uLamp: { value: new THREE.Vector4(0, 0, 0, 0) } },
      vertexShader: `
        attribute vec3 iPos; attribute vec4 iData; attribute vec3 iCol;
        uniform float uTime; uniform vec2 uWind; uniform vec3 uPush;
        varying float vH; varying vec3 vCol; varying float vShade; varying vec3 vWP;
        void main() {
          float a = iData.x, hgt = iData.y, wid = iData.z;
          vec3 p = vec3(position.x * wid * cos(a), position.y * hgt, position.x * wid * sin(a));
          vec3 wp = iPos + p;
          float k = position.y * position.y;
          float gust = sin(uTime * 1.6 + iPos.x * 0.31 + iPos.z * 0.23) * 0.6 + sin(uTime * 3.3 + iPos.x * 1.7 - iPos.z * 1.1) * 0.25;
          vec2 w = uWind * 0.35 + vec2(0.06, 0.03);
          vec2 bend = (w * (0.8 + gust * 0.7) + vec2(cos(a), sin(a)) * 0.08) * k * hgt * 1.4;
          vec2 d = wp.xz - uPush.xz; float dl = length(d) + 1e-4;
          float push = smoothstep(0.85, 0.05, dl) * k;
          bend += d / dl * push * hgt * 0.9;
          wp.xz += bend;
          wp.y -= (length(bend) * 0.45 + push * 0.4 * hgt) * position.y;
          vH = position.y; vCol = iCol; vShade = iData.w; vWP = wp;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uLight; uniform vec4 uLamp;
        varying float vH; varying vec3 vCol; varying float vShade; varying vec3 vWP;
        void main() {
          vec3 tip = vCol * 1.38 + vec3(0.05, 0.07, 0.0);
          vec3 c = mix(vCol * 0.9, tip, vH);
          c *= mix(0.78, 1.0, smoothstep(0.18, 0.38, vH)) * (0.88 + vShade * 0.24); // cel band near the roots
          float lf = pow(max(0.0, 1.0 - distance(vWP, uLamp.xyz) / 10.0), 1.6) * uLamp.w;
          gl_FragColor = vec4(c * (uLight + vec3(1.0, 0.79, 0.47) * lf), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    Scene3D.scene.add(this.mesh);
    this.cx = this.cy = -1e9; this.occ = null;
  },

  // Ground colour per tile type (matches the painted ground under it).
  COLS: { [T.GRASS]: [0.43, 0.73, 0.29], [T.MEADOW]: [0.56, 0.79, 0.36], [T.FOREST]: [0.31, 0.6, 0.27] },

  // Tiles whose blades can never be seen: under buildings and the strip behind them (the camera looks north),
  // and under tree canopies, bushes, boulders and logs.
  buildOcclusion() {
    const occ = this.occ = new Uint8Array(World.W * World.H), mark = (x, y) => { if (World.inB(x, y)) occ[World.idx(x, y)] = 1; };
    for (const b of World.buildings) for (let y = b.y - 3; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) mark(x, y);
    for (let i = 0; i < occ.length; i++) { const o = World.obj[i]; if (o === O.PINE || o === O.OAK || o === O.BUSH || o === O.BOULDER || o === O.LOG) occ[i] = 1; }
  },

  refill(cx, cy) {
    const R = this.R, D = this.dens, P = this.iPos.array, Dt = this.iData.array, C = this.iCol.array;
    if (!this.occ) this.buildOcclusion();
    let n = 0;
    // Only what's on screen: the ground footprint of the view, padded a little for the next few steps.
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [sx, sy] of [[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]]) {
      const w = Scene3D.screenToWorld(sx, sy); x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y);
    }
    if (Scene3D.tps) { x0 = cx - R; x1 = cx + R; y0 = cy - R; y1 = cy + R; } // the horizon's in view: fill all round
    x0 = Math.max(0, Math.floor(Math.max(x0, cx - R) - 3)); x1 = Math.min(World.W - 1, Math.ceil(Math.min(x1, cx + R) + 3));
    y0 = Math.max(0, Math.floor(Math.max(y0, cy - R) - 3)); y1 = Math.min(World.H - 1, Math.ceil(Math.min(y1, cy + R) + 3));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = World.idx(x, y), t = World.tile[i], col = this.COLS[t];
      if (!col || this.occ[i]) continue;
      // Thinner further from the middle of the view, where blades are tiny anyway.
      const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), f = dd < 9 ? 1 : dd < 16 ? 0.55 : 0.3;
      const tall = t === T.MEADOW ? 1.35 : t === T.FOREST ? 0.8 : 1, cnt = Math.max(1, Math.round(D * f));
      for (let j = 0; j < cnt && n < this.cap; j++) {
        const px = x + U.hash2(x * 16 + j, y, 21), py = y + U.hash2(x * 16 + j, y, 22);
        const gy = Scene3D.groundH(px, py);
        if (gy < 0.02) continue; // not on banks that dip under water
        P[n * 3] = px; P[n * 3 + 1] = gy - 0.02; P[n * 3 + 2] = py;
        Dt[n * 4] = U.hash2(x * 16 + j, y, 23) * Math.PI * 2;
        Dt[n * 4 + 1] = (0.2 + U.hash2(x * 16 + j, y, 24) * 0.2) * tall * (f < 1 ? 1.15 : 1);
        Dt[n * 4 + 2] = (0.07 + U.hash2(x * 16 + j, y, 25) * 0.05) * (f < 1 ? 1.3 : 1);
        Dt[n * 4 + 3] = U.hash2(x * 16 + j, y, 26);
        const v = 0.92 + U.hash2(x * 16 + j, y, 27) * 0.16;
        C[n * 3] = col[0] * v; C[n * 3 + 1] = col[1] * v; C[n * 3 + 2] = col[2] * v;
        n++;
      }
    }
    this.mesh.geometry.instanceCount = n;
    for (const a of [this.iPos, this.iData, this.iCol]) { a.updateRange.offset = 0; a.updateRange.count = n * a.itemSize; a.needsUpdate = true; }
  },

  update(cx, cy, time) {
    if (!this.mesh) return;
    const inside = typeof Interior !== 'undefined' && Interior.active;
    this.mesh.visible = !inside && cx > -10 && (Game.mode !== 'title' || Cine.active);
    if (!this.mesh.visible) return;
    if (Math.abs(cx - this.cx) + Math.abs(cy - this.cy) > 4 || Math.abs(Scene3D.camDist - this.cd) > 1.5) { this.cx = cx; this.cy = cy; this.cd = Scene3D.camDist; this.refill(cx, cy); }
    const u = this.mesh.material.uniforms, S = Scene3D;
    u.uTime.value = time;
    if (typeof Game !== 'undefined' && Game.env && Game.env.wind) u.uWind.value.set(Game.env.wind.x, Game.env.wind.y || 0);
    if (typeof Player !== 'undefined' && Game.mode !== 'title') u.uPush.value.set(Player.x, 0, Player.y);
    const l = S.hemi.intensity * 0.9 + S.sun.intensity * 0.72;
    u.uLamp.value.set(S.lantern.position.x, S.lantern.position.y, S.lantern.position.z, S.lantern.intensity);
    u.uLight.value.setRGB(l * (0.85 + S.sun.color.r * 0.15), l * (0.85 + S.sun.color.g * 0.15), l * (0.85 + S.sun.color.b * 0.15));
  },
};
