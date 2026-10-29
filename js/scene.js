// 2.5D presentation: 3D terrain + water under a fixed-yaw tilted camera, pixel-art billboards on top.
'use strict';

const CAM_PITCH = 0.95;      // radians above the horizon
const BILLBOARD_LEAN = 0.55; // how far props lean back toward the camera

const Scene3D = {
  renderer: null, scene: null, camera: null, sun: null, hemi: null, lantern: null,
  waterMat: null, heights: null, camDist: 16, target: new THREE.Vector3(), ray: new THREE.Raycaster(),
  rain: null, windows: [], world: null,

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.7);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 0.9);
    this.sun.position.set(-30, 60, 40);
    this.lantern = new THREE.PointLight(0xffc977, 0, 10, 1.6);
    this.scene.add(this.hemi, this.sun, this.lantern);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },

  // Rebuild every mesh for the current World.
  build() {
    if (this.world) { this.scene.remove(this.world); this.disposeTree(this.world); }
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.windows = [];
    this.buildHeights();
    this.buildTerrain();
    this.buildWater();
    this.buildProps();
    this.buildPlanks();
    for (const b of World.buildings) this.buildBuilding(b);
    this.buildCampProps();
    this.buildRain();
    Toon.apply(this.world);
  },

  disposeTree(o) {
    o.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  },

  tileHeight(x, y) {
    if (!World.inB(x, y)) return 2;
    const i = World.idx(x, y), t = World.tile[i];
    if (t === T.WATER || (t === T.PLANK && World.depth[i] > 0)) return -Math.min(World.depth[i], 6) * 0.32 - 0.06;
    return 0.14 + Math.max(0, World.height[i] - 0.48) * 7 + (World.hill ? World.hill[i] : 0);
  },

  buildHeights() {
    const W = World.W, H = World.H;
    this.heights = new Float32Array((W + 1) * (H + 1));
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
      // Corners take the lowest water neighbour so banks slope into the water.
      const hs = [this.tileHeight(x - 1, y - 1), this.tileHeight(x, y - 1), this.tileHeight(x - 1, y), this.tileHeight(x, y)];
      const water = hs.filter((h) => h < 0);
      this.heights[y * (W + 1) + x] = water.length ? (water.length >= 2 ? Math.min(...water) : U.lerp(Math.min(...hs), Math.max(...hs), 0.35))
        : hs.reduce((a, b) => a + b) / 4;
    }
  },

  // Ground height at a world point (tiles), bilinear between corners.
  groundH(x, y) {
    if (x < -50) return 0.02; // interiors live off-map
    const W = World.W;
    x = U.clamp(x, 0, World.W - 0.001); y = U.clamp(y, 0, World.H - 0.001);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const h = (a, b) => this.heights[b * (W + 1) + a];
    return U.lerp(U.lerp(h(x0, y0), h(x0 + 1, y0), fx), U.lerp(h(x0, y0 + 1), h(x0 + 1, y0 + 1), fx), fy);
  },
  // Where feet stand: on ground, decking, or wading at the surface.
  standH(x, y) {
    if (x < -50) return 0.04;
    if (World.tileAt(x, y) === T.PLANK) return 0.28;
    return Math.max(this.groundH(x, y), -0.42);
  },

  buildTerrain() {
    const W = World.W, H = World.H;
    const geo = new THREE.PlaneGeometry(W, H, W, H);
    geo.rotateX(-Math.PI / 2);
    geo.translate(W / 2, 0, H / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.round(pos.getX(i)), z = Math.round(pos.getZ(i));
      pos.setY(i, this.heights[z * (W + 1) + x]);
    }
    geo.computeVertexNormals();
    // Hillshade: sunlit slopes brighten, slopes facing away darken, so the hills read from above.
    const nrm = geo.attributes.normal, cols = new Float32Array(pos.count * 3), sun = new THREE.Vector3(-0.55, 0.7, -0.45).normalize();
    for (let i = 0; i < pos.count; i++) {
      const lit = nrm.getX(i) * sun.x + nrm.getY(i) * sun.y + nrm.getZ(i) * sun.z, flat = sun.y;
      const k = U.clamp(1 + (lit - flat) * 3.6 + Math.max(0, pos.getY(i) - 1) * 0.015, 0.5, 1.3);
      cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const tex = new THREE.CanvasTexture(Art.buildGroundTexture());
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }));
    this.world.add(mesh);
  },

  buildWater() {
    const W = World.W, H = World.H;
    const data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const t = World.tile[i];
      const wet = t === T.WATER || (t === T.PLANK && World.depth[i] > 0);
      data[i * 4] = Math.round(World.flowX[i] * 127 + 128);
      data[i * 4 + 1] = Math.round(World.flowY[i] * 127 + 128);
      data[i * 4 + 2] = wet ? Math.round(U.clamp(World.depth[i] / 12, 0, 1) * 255) : 0;
      data[i * 4 + 3] = World.kind[i] === K.STREAM ? 255 : World.kind[i] === K.RIVER ? 170 : 0;
    }
    const dt = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    dt.magFilter = THREE.LinearFilter; dt.minFilter = THREE.LinearFilter;
    dt.needsUpdate = true;
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uData: { value: dt }, uTime: { value: 0 }, uLight: { value: 1 }, uSize: { value: new THREE.Vector2(W, H) } },
      vertexShader: `
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform sampler2D uData; uniform float uTime; uniform float uLight; uniform vec2 uSize;
        varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 p = vW.xz;
          vec4 d = texture2D(uData, p / uSize);
          float depth = d.b * 12.0;
          vec2 flow = d.rg * 2.0 - 1.0;
          float running = d.a;
          // Flat colour bands by depth, like a cartoon map.
          vec3 col = depth < 0.9 ? vec3(0.47, 0.84, 0.88) : depth < 3.2 ? vec3(0.22, 0.60, 0.84) : vec3(0.11, 0.33, 0.64);
          col = mix(col, vec3(0.33, 0.72, 0.88), running * 0.35);
          float a = depth < 0.9 ? 0.78 : 0.95;
          // White squiggles: drifting with the current in rivers, lazily on still water.
          float fl = length(flow);
          vec2 fd = fl > 0.01 ? flow / fl : vec2(1.0, 0.0);
          vec2 fq = fl > 0.01 ? vec2(dot(p, fd) * 0.8 - uTime * (0.9 + running), dot(p, vec2(-fd.y, fd.x)) * 3.4)
                              : vec2(p.x * 0.7 + uTime * 0.15, p.y * 2.2 + sin(p.x * 0.6 + uTime * 0.5));
          float w = n(fq + vec2(n(p * 0.5) * 2.0, 0.0));
          col = mix(col, vec3(0.96, 0.99, 1.0), step(0.84, w) * 0.9);
          // Shoreline: a crisp foam band with an ink line right at the edge.
          float foam = 1.0 - step(0.34, depth);
          col = mix(col, vec3(0.97, 0.99, 0.98), foam);
          a = max(a, foam);
          col = mix(col, vec3(0.08, 0.16, 0.24), 1.0 - step(0.13, depth));
          gl_FragColor = vec4(col * uLight, a);
        }`,
    });
    const geo = new THREE.PlaneGeometry(W, H, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(W / 2, 0, H / 2);
    const mesh = new THREE.Mesh(geo, this.waterMat);
    mesh.renderOrder = 2;
    this.world.add(mesh);
  },

  spriteMaterial(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  },

  // Every tree/bush/rock/reed is an instance of a leaning billboard quad, one draw call per sprite.
  buildProps() {
    const S = Art.sprites;
    const kinds = [
      { spr: S.reeds, test: (o) => o === O.REEDS, water: true },
    ];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const lean = new THREE.Euler(-BILLBOARD_LEAN, 0, 0);
    const shadows = this.buildFoliage3D();
    for (const k of kinds) {
      const cells = [];
      for (let y = 0; y < World.H; y++) for (let x = 0; x < World.W; x++) {
        if (k.test(World.obj[World.idx(x, y)], x, y)) cells.push([x, y]);
      }
      if (!cells.length) continue;
      const w = (k.spr.lw || k.spr.width) / TS, h = (k.spr.lh || k.spr.height) / TS;
      const geo = new THREE.PlaneGeometry(w, h);
      geo.translate(0, h / 2, 0);
      const mesh = new THREE.InstancedMesh(geo, this.spriteMaterial(k.spr), cells.length);
      cells.forEach(([x, y], i) => {
        const jx = (U.hash2(x, y, 11) - 0.5) * 0.35, jy = (U.hash2(x, y, 12) - 0.5) * 0.25;
        const s = 0.9 + U.hash2(x, y, 13) * 0.3;
        const px = x + 0.5 + jx, py = y + 0.6 + jy;
        p.set(px, k.water ? Math.max(this.groundH(px, py), -0.25) : this.groundH(px, py) - 0.03, py);
        q.setFromEuler(lean); sc.set(s, s, s);
        mesh.setMatrixAt(i, m.compose(p, q, sc));
        if (!k.water) shadows.push([px, py, w * s * 0.45]);
      });
      this.world.add(mesh);
    }
    // Lily pads float flat on the surface.
    const lilies = [];
    for (let i = 0; i < World.W * World.H; i++) if (World.obj[i] === O.LILY) lilies.push(i);
    if (lilies.length) {
      const geo = new THREE.PlaneGeometry(0.9, 0.9); geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.InstancedMesh(geo, this.spriteMaterial(S.lily), lilies.length);
      lilies.forEach((idx, i) => {
        const x = idx % World.W, y = (idx / World.W) | 0;
        q.setFromEuler(new THREE.Euler(0, U.hash2(x, y, 3) * 6.28, 0));
        mesh.setMatrixAt(i, m.compose(p.set(x + 0.5, 0.015, y + 0.5), q, sc.set(1, 1, 1)));
      });
      mesh.renderOrder = 3;
      this.world.add(mesh);
    }
    // Soft blob shadows grounding the billboards.
    const sg = new THREE.CircleGeometry(1, 12); sg.rotateX(-Math.PI / 2);
    const smat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
    const sm = new THREE.InstancedMesh(sg, smat, shadows.length);
    shadows.forEach(([x, y, r], i) => {
      sm.setMatrixAt(i, m.compose(p.set(x, this.groundH(x, y) + 0.02, y), q.identity(), sc.set(r, 1, r * 0.7)));
    });
    this.world.add(sm);
  },

  // Real 3D trees, bushes, rocks and logs: low-poly parts, cel-shaded, each with an ink outline hull.
  // One InstancedMesh per part, so a whole forest is a handful of draw calls.
  buildFoliage3D() {
    const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: Toon.gradient() });
    const ink = new THREE.MeshBasicMaterial({ color: 0x1a1410, side: THREE.BackSide });
    // Push every vertex out along its normal: the outline hull.
    const inflate = (geo, d) => {
      const g = geo.clone(), pos = g.attributes.position, nrm = g.attributes.normal;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * d, pos.getY(i) + nrm.getY(i) * d, pos.getZ(i) + nrm.getZ(i) * d);
      return g;
    };
    const part = (geo, color, x = 0, y = 0, z = 0, outline = 0.035) => { geo.translate(x, y, z); return { geo, color, outline }; };
    const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg);
    const ball = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
    const trunk = (r0, r1, h) => part(new THREE.CylinderGeometry(r0, r1, h, 7), 0x7A4E2A, 0, h / 2, 0, 0.025);
    const KINDS = {
      [O.PINE]: { r: 0.55, parts: [trunk(0.07, 0.11, 0.7),
        part(cone(0.66, 0.95), 0x2F8A4A, 0, 0.92), part(cone(0.52, 0.85), 0x3A9A52, 0, 1.42), part(cone(0.36, 0.72), 0x48AA5C, 0, 1.9)] },
      [O.OAK]: { r: 0.7, parts: [trunk(0.09, 0.14, 0.9),
        part(ball(0.6, 1), 0x4FA644, 0, 1.3), part(ball(0.42), 0x5AB34C, 0.42, 1.1, 0.1), part(ball(0.4), 0x48A040, -0.4, 1.12, -0.06),
        part(ball(0.38), 0x66BE52, 0.06, 1.72, 0.04)] },
      [O.BUSH]: { r: 0.45, parts: [part(ball(0.34, 1), 0x46993F, 0, 0.27), part(ball(0.25), 0x52A548, 0.27, 0.21, 0.1), part(ball(0.24), 0x40903A, -0.26, 0.2, -0.05),
        part(ball(0.06, 0), 0xD9363A, 0.12, 0.48, 0.24, 0.02), part(ball(0.06, 0), 0xD9363A, -0.2, 0.36, 0.22, 0.02), part(ball(0.06, 0), 0xD9363A, 0.32, 0.3, 0.28, 0.02)] },
      [O.BOULDER]: { r: 0.45, parts: [part(new THREE.DodecahedronGeometry(0.42, 0).scale(1, 0.62, 0.85), 0xA3A39C, 0, 0.2), part(new THREE.DodecahedronGeometry(0.22, 0), 0x95958E, 0.3, 0.1, 0.18)] },
      [O.LOG]: { r: 0.5, parts: [part(new THREE.CylinderGeometry(0.15, 0.15, 1.05, 9).rotateZ(Math.PI / 2), 0x8A5A30, 0, 0.15),
        part(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 9).rotateZ(Math.PI / 2), 0xD9B47A, 0.53, 0.15, 0, 0)] },
    };
    const cells = {};
    for (let y = 0; y < World.H; y++) for (let x = 0; x < World.W; x++) {
      const o = World.obj[World.idx(x, y)];
      if (KINDS[o]) (cells[o] = cells[o] || []).push([x, y]);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const shadows = [];
    this.fol = { groups: [], cx: -1e9, cy: -1e9 };
    for (const o in cells) {
      const K = KINDS[o], list = cells[o];
      const mats = list.map(([x, y]) => {
        const s = 0.85 + U.hash2(x, y, 13) * 0.35;
        const px = x + 0.5 + (U.hash2(x, y, 11) - 0.5) * 0.35, py = y + 0.55 + (U.hash2(x, y, 12) - 0.5) * 0.3;
        shadows.push([px, py, K.r * s]);
        p.set(px, this.groundH(px, py) - 0.03, py);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), U.hash2(x, y, 14) * Math.PI * 2);
        sc.set(s, s * (0.9 + U.hash2(x, y, 15) * 0.25), s);
        return m.compose(p, q, sc).clone();
      });
      const cap = Math.min(list.length, 5000), meshes = [];
      for (const pt of K.parts) {
        const mesh = new THREE.InstancedMesh(pt.geo, toon(pt.color), cap);
        // Sized up front: three sizes a lazily-made colour buffer by the current count, which starts at 0.
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
        const hull = pt.outline ? new THREE.InstancedMesh(inflate(pt.geo, pt.outline), ink, cap) : null;
        for (const mm of [mesh, hull]) if (mm) { mm.count = 0; mm.frustumCulled = false; mm.userData.toon = true; this.world.add(mm); }
        meshes.push({ mesh, hull });
      }
      this.fol.groups.push({ list, mats, cap, meshes });
    }
    return shadows;
  },

  // A tree was felled: forget it and re-upload the nearby foliage.
  removeTree(x, y) {
    for (const G of this.fol.groups) {
      const i = G.list.findIndex(([tx, ty]) => tx === x && ty === y);
      if (i >= 0) { G.list.splice(i, 1); G.mats.splice(i, 1); }
    }
    this.fol.cx = -1e9;
  },

  // Only foliage near the camera is uploaded; refreshed whenever the view drifts far enough.
  updateFoliage(cx, cy) {
    const F = this.fol, R = 48;
    if (!F || Math.abs(cx - F.cx) + Math.abs(cy - F.cy) < 14) return;
    F.cx = cx; F.cy = cy;
    const col = new THREE.Color();
    for (const G of F.groups) {
      let n = 0;
      for (let i = 0; i < G.list.length && n < G.cap; i++) {
        const [x, y] = G.list[i];
        if (Math.abs(x - cx) > R || Math.abs(y - cy) > R) continue;
        for (const { mesh, hull } of G.meshes) {
          mesh.setMatrixAt(n, G.mats[i]);
          mesh.setColorAt(n, col.setScalar(0.88 + U.hash2(x, y, 16) * 0.22)); // a little shade variety
          if (hull) hull.setMatrixAt(n, G.mats[i]);
        }
        n++;
      }
      for (const { mesh, hull } of G.meshes) {
        mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        if (hull) { hull.count = n; hull.instanceMatrix.needsUpdate = true; }
      }
    }
  },

  // Docks and footbridges.
  buildPlanks() {
    const cells = [];
    for (let i = 0; i < World.W * World.H; i++) if (World.tile[i] === T.PLANK) cells.push(i);
    if (!cells.length) return;
    const geo = new THREE.BoxGeometry(1.0, 0.1, 0.98);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a6338 });
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    const postG = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6);
    const posts = new THREE.InstancedMesh(postG, new THREE.MeshLambertMaterial({ color: 0x5a3d22 }), cells.length);
    const m = new THREE.Matrix4();
    let np = 0;
    cells.forEach((idx, i) => {
      const x = idx % World.W, y = (idx / World.W) | 0;
      m.makeTranslation(x + 0.5, 0.22, y + 0.5);
      mesh.setMatrixAt(i, m);
      if ((x + y) % 2 === 0) { m.makeTranslation(x + 0.1, -0.4, y + 0.5); posts.setMatrixAt(np++, m); }
    });
    posts.count = np;
    this.world.add(mesh, posts);
    // Hand rails on some bridges: a post every metre along both edges and a top rail.
    const wood = new THREE.MeshLambertMaterial({ color: 0x6a4526 });
    for (const b of World.bridges || []) {
      if (!b.rails) continue;
      const horiz = b.dx !== 0;
      const a0 = horiz ? Math.min(b.x0, b.x1) : Math.min(b.y0, b.y1), a1 = (horiz ? Math.max(b.x0, b.x1) : Math.max(b.y0, b.y1)) + 1;
      const mid = (horiz ? b.y0 : b.x0) + 0.5;
      for (const side of [-1.42, 1.42]) {
        const c = mid + side, len = a1 - a0;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.07, 0.07, horiz ? 0.07 : len), wood);
        rail.position.set(horiz ? a0 + len / 2 : c, 0.78, horiz ? c : a0 + len / 2);
        const mid2 = rail.clone(); mid2.position.y = 0.52;
        this.world.add(rail, mid2);
        for (let a = a0; a <= a1 + 0.01; a += 1) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.09), wood);
          post.position.set(horiz ? a : c, 0.52, horiz ? c : a);
          this.world.add(post);
        }
      }
    }
  },

  buildBuilding(b) {
    const STYLE = {
      shop: { wall: 0x8a5a34, roof: 0x3f6e7a, sign: ['TACKLE', '#e9d9a8', '#3a2614'] },
      ranger: { wall: 0x7a6a48, roof: 0x3f6a3a, sign: ['RANGER', '#2f5a2c', '#f2e6c0'] },
      store: { wall: 0xe0d6c0, roof: 0xb83a32, sign: ['STORE', '#b83a32', '#fff4e0'] },
      gas: { wall: 0xF4F0E6, roof: 0xD23A3A, sign: ['GAS', '#D23A3A', '#FFFFFF'] },
      bikes: { wall: 0x4a4a52, roof: 0x2a2a2e, sign: ['BIKES', '#1a1a1a', '#F2C14E'] },
      clinic: { wall: 0xF4F4F0, roof: 0x3A8AD2, sign: ['CLINIC', '#D23A3A', '#FFFFFF'] },
    };
    const HOUSE_WALLS = [0xe2d3ac, 0xa9c4d2, 0xd7b0a8, 0xbfd0a0, 0xe8dcc8, 0xc8b8d8];
    const HOUSE_ROOFS = [0x7a3a2a, 0x3f5a7a, 0x5a6a3a, 0x6a4a3a, 0x8a5a2a];
    const house = b.type === 'house';
    const st = STYLE[b.type] || { wall: HOUSE_WALLS[Math.floor(b.hue * HOUSE_WALLS.length)], roof: HOUSE_ROOFS[Math.floor(b.hue * 97) % HOUSE_ROOFS.length] };
    const g = new THREE.Group();
    const wallH = house ? 1.7 : 2.1;
    const base = Math.max(this.groundH(b.x + b.w / 2, b.y + b.h / 2), 0.1);
    const W = World.frontLen(b), D = World.depthOf(b);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, D - 0.4), new THREE.MeshLambertMaterial({ color: st.wall }));
    wall.position.set(W / 2, wallH / 2, D / 2 + 0.2);
    g.add(wall);
    // Gable roof as an extruded triangle.
    const shape = new THREE.Shape();
    shape.moveTo(-0.4, 0); shape.lineTo(W + 0.4, 0); shape.lineTo(W / 2, house ? 1.2 : 1.5); shape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: D + 0.2, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: st.roof }));
    roof.position.set(0, wallH, -0.1);
    g.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.3), new THREE.MeshLambertMaterial({ color: 0x3a2614 }));
    door.position.set(0.9, 0.65, D + 0.01);
    g.add(door);
    const winMat = new THREE.MeshLambertMaterial({ color: 0xf2d98a, emissive: 0xffb84a, emissiveIntensity: 0 });
    this.windows.push(winMat);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), winMat);
    win.position.set(W - 1.3, house ? 1.0 : 1.25, D + 0.01);
    g.add(win);
    const signText = st.sign || (b.vacant ? ['FOR RENT', '#f4efe2', '#b83a32'] : null);
    if (signText) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32;
      const cx = c.getContext('2d');
      cx.fillStyle = signText[1]; cx.fillRect(0, 0, 128, 32);
      cx.fillStyle = signText[2]; cx.font = 'bold 18px sans-serif'; cx.textAlign = 'center';
      cx.fillText(signText[0], b.type === 'shop' ? 56 : 64, 23);
      if (b.type === 'shop') {
        cx.fillStyle = '#d9a43a'; cx.beginPath(); cx.ellipse(110, 16, 11, 5, 0, 0, 7); cx.fill();
        cx.beginPath(); cx.moveTo(99, 16); cx.lineTo(93, 10); cx.lineTo(93, 22); cx.fill();
      }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(house ? 1.6 : 2.4, house ? 0.4 : 0.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
      if (house) {
        // A little board on a post by the path.
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), new THREE.MeshLambertMaterial({ color: 0x5a3d22 }));
        post.position.set(W - 0.5, 0.5, D + 0.9); g.add(post);
        sign.position.set(W - 0.5, 1.05, D + 0.95);
      } else sign.position.set(W / 2, wallH + 0.15, D + 0.12);
      g.add(sign);
    }
    // Rotate the local model so its front faces the street.
    const rot = { south: 0, east: Math.PI / 2, west: -Math.PI / 2, north: Math.PI }[b.face || 'south'];
    const o = World.localToWorld(b, 0, 0);
    g.rotation.y = rot;
    g.position.set(o.x, base, o.y);
    this.world.add(g);
  },

  // Public BBQ by the dock and Dusty's tent in the woods.
  buildCampProps() {
    // Gas pumps under a canopy.
    for (const p of World.pumps || []) {
      const g = new THREE.Group(), h = this.groundH(p.x, p.y);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.32), new THREE.MeshLambertMaterial({ color: 0xD23A3A })); body.position.y = 0.58; g.add(body);
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.02), new THREE.MeshLambertMaterial({ color: 0xF4F0E6 })); face.position.set(0, 0.85, 0.17); g.add(face);
      const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), new THREE.MeshLambertMaterial({ color: 0x2a2a2e })); nozzle.position.set(0.25, 0.65, 0.05); g.add(nozzle);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.6), new THREE.MeshLambertMaterial({ color: 0xA9A9A2 })); base.position.y = 0.05; g.add(base);
      g.position.set(p.x, h, p.y); this.world.add(g);
    }
    if (World.pumps && World.pumps.length) {
      const [a, b] = World.pumps, mx = a.x, my = (a.y + b.y) / 2, h = this.groundH(mx, my);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 4.6), new THREE.MeshLambertMaterial({ color: 0xF4F0E6, transparent: true })); roof.position.set(mx, h + 2.5, my); this.world.add(roof);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.12, 4.65), new THREE.MeshLambertMaterial({ color: 0xD23A3A, transparent: true })); trim.position.set(mx, h + 2.36, my); this.world.add(trim);
      this.canopy = { roof, trim, x: mx, y: my };
      for (const dz of [-2, 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.14), new THREE.MeshLambertMaterial({ color: 0xD9D6CC })); post.position.set(mx + 1.4, h + 1.2, my + dz); this.world.add(post); }
    }
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
    const q = World.bbq, bbq = new THREE.Group();
    const grill = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.28, 0.3, 14), dark); grill.position.y = 0.75; bbq.add(grill);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8a2a22 }));
    lid.position.set(0, 0.9, -0.2); lid.rotation.x = -1.1; bbq.add(lid);
    for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [0, 0.28]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), dark); leg.position.set(x, 0.32, z); bbq.add(leg);
    }
    bbq.position.set(q.x, this.groundH(q.x, q.y), q.y);
    this.world.add(bbq);
    const d = World.dusty;
    const tent = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.3, 4), new THREE.MeshLambertMaterial({ color: 0x6a7a3a }));
    tent.rotation.y = Math.PI / 4; tent.position.set(d.x + 1.4, this.groundH(d.x, d.y) + 0.65, d.y - 0.8);
    this.world.add(tent);
  },

  buildRain() {
    const n = 900;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaac4d8, transparent: true, opacity: 0.5 }));
    this.rain.frustumCulled = false;
    this.rain.userData.drops = Array.from({ length: n }, () => [Math.random() * 40 - 20, Math.random() * 14, Math.random() * 40 - 20]);
    this.world.add(this.rain);
  },

  // Sky, sun and lamps follow the clock and weather.
  updateEnv(env, dt) {
    const day = env.daylight, w = env.weather.light;
    const sky = new THREE.Color().setHSL(0.57, 0.45, 0.06 + 0.55 * day * w);
    if (env.phase === 0 || env.phase === 2) sky.lerp(new THREE.Color(0xe39a6a), 0.35 * day);
    this.scene.background = sky;
    this.hemi.intensity = 0.25 + 0.75 * day * w;
    this.sun.intensity = 0.05 + 0.95 * day * (env.weather.id === 'clear' ? 1 : 0.45);
    this.sun.color.set(env.phase === 0 || env.phase === 2 ? 0xffc48a : 0xfff2d8);
    this.lantern.intensity = (1 - day) * 1.6;
    this.waterMat.uniforms.uLight.value = 0.35 + 0.65 * day * w + (1 - day) * 0.1;
    for (const m of this.windows) m.emissiveIntensity = (1 - day) * 1.2;
    // Indoors: a warm lamp and no sky.
    const inside = typeof Interior !== 'undefined' && Interior.active;
    if (inside) { this.scene.background = new THREE.Color(0x15110e); Interior.lamp.position.set(inside.x0 + inside.w / 2, 2.4, inside.y0 + inside.h / 2); }
    if (typeof Interior !== 'undefined' && Interior.lamp) Interior.lamp.intensity = inside ? 1.4 : 0;
    // Rain follows the camera target.
    this.rain.visible = env.weather.id === 'rain' && !inside;
    if (this.rain.visible) {
      const a = this.rain.geometry.attributes.position.array;
      this.rain.userData.drops.forEach((d, i) => {
        d[1] -= dt * 16; d[0] += Game.env.wind.x * dt * 0.4;
        if (d[1] < 0) { d[1] = 12 + Math.random() * 2; d[0] = Math.random() * 40 - 20; d[2] = Math.random() * 40 - 20; }
        const x = this.target.x + d[0], z = this.target.z + d[2];
        a.set([x, d[1], z, x + Game.env.wind.x * 0.03, d[1] + 0.45, z], i * 6);
      });
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  },

  updateCamera(dt, focus) {
    const fy = this.standH(focus.x, focus.y);
    this.target.lerp(new THREE.Vector3(focus.x, fy, focus.y), Math.min(1, dt * 5));
    const d = this.camDist;
    this.camera.position.set(this.target.x, this.target.y + Math.sin(CAM_PITCH) * d, this.target.z + Math.cos(CAM_PITCH) * d);
    this.camera.lookAt(this.target);
    const ps = typeof Poison !== 'undefined' ? Poison.severity() : 0;
    if (ps > 0) this.camera.rotateZ(Math.sin(Game.time * 0.8) * 0.07 * ps);
    const sh = typeof Bugs !== 'undefined' ? Bugs.shake : 0;
    if (sh > 0.01) { this.camera.position.x += (Math.random() - 0.5) * sh * 0.25; this.camera.position.y += (Math.random() - 0.5) * sh * 0.25; this.camera.position.z += (Math.random() - 0.5) * sh * 0.25; }
  },

  // Screen pixel -> point on the water/ground plane, in world tiles.
  screenToWorld(sx, sy) {
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    // March the ray onto the terrain: hit a flat plane, read the ground there, re-hit at that height.
    const hit = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let h = Math.max(0, this.target.y * 0.5);
    for (let k = 0; k < 4; k++) {
      plane.constant = -h;
      if (!this.ray.ray.intersectPlane(plane, hit)) return { x: this.target.x, y: this.target.z };
      h = Math.max(0, this.groundH(hit.x, hit.z));
    }
    return { x: hit.x, y: hit.z };
  },

  // World point (tiles, height) -> screen pixels, for HUD labels.
  project(x, y, h) {
    const v = new THREE.Vector3(x, h, y).project(this.camera);
    return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, v.z < 1];
  },

  render(time) {
    this.updateFoliage(this.target.x, this.target.z);
    this.waterMat.uniforms.uTime.value = time;
    this.renderer.render(this.scene, this.camera);
  },
};
