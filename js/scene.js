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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    this.buildRain();
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
    return 0.14 + Math.max(0, World.height[i] - 0.48) * 7;
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
    const W = World.W;
    x = U.clamp(x, 0, World.W - 0.001); y = U.clamp(y, 0, World.H - 0.001);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const h = (a, b) => this.heights[b * (W + 1) + a];
    return U.lerp(U.lerp(h(x0, y0), h(x0 + 1, y0), fx), U.lerp(h(x0, y0 + 1), h(x0 + 1, y0 + 1), fx), fy);
  },
  // Where feet stand: on ground, decking, or wading at the surface.
  standH(x, y) {
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
    const tex = new THREE.CanvasTexture(Art.buildGroundTexture());
    tex.magFilter = THREE.NearestFilter;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
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
          vec3 shallow = mix(vec3(0.36,0.70,0.68), vec3(0.42,0.76,0.72), running);
          vec3 deep = mix(vec3(0.06,0.22,0.38), vec3(0.14,0.36,0.46), running);
          vec3 col = mix(shallow, deep, smoothstep(0.0, 7.0, depth));
          float a = mix(0.32, 0.9, smoothstep(0.0, 2.6, depth));
          // Streaks carried along the current.
          float fl = length(flow);
          vec2 fd = fl > 0.01 ? flow / fl : vec2(1.0, 0.0);
          vec2 fq = vec2(dot(p, fd) * 0.7 - uTime * (0.8 + running), dot(p, vec2(-fd.y, fd.x)) * 3.0);
          float st = n(fq + vec2(n(p * 0.8) * 1.5, 0.0));
          col += smoothstep(0.8, 0.97, st) * fl * 0.22;
          // Still-water glints.
          float s = n(p * 3.1 + vec2(uTime * 0.25, uTime * 0.17)) * n(p * 4.3 - uTime * 0.21);
          col += smoothstep(0.58, 0.8, s) * 0.12;
          // Foam line where the water meets the bank.
          float foam = smoothstep(0.45, 0.12, depth) * (0.55 + 0.45 * n(p * 5.0 + uTime * 0.6));
          col = mix(col, vec3(0.92, 0.98, 0.96), foam * 0.55);
          a = max(a, foam * 0.75);
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
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    return new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  },

  // Every tree/bush/rock/reed is an instance of a leaning billboard quad, one draw call per sprite.
  buildProps() {
    const S = Art.sprites;
    const kinds = [
      { spr: S.pine[0], test: (o, x, y) => o === O.PINE && U.hash2(x, y, 5) < 0.5 },
      { spr: S.pine[1], test: (o, x, y) => o === O.PINE && U.hash2(x, y, 5) >= 0.5 },
      { spr: S.oak[0], test: (o, x, y) => o === O.OAK && U.hash2(x, y, 5) < 0.5 },
      { spr: S.oak[1], test: (o, x, y) => o === O.OAK && U.hash2(x, y, 5) >= 0.5 },
      { spr: S.bush, test: (o) => o === O.BUSH },
      { spr: S.boulder, test: (o) => o === O.BOULDER },
      { spr: S.log, test: (o) => o === O.LOG },
      { spr: S.reeds, test: (o) => o === O.REEDS, water: true },
    ];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const lean = new THREE.Euler(-BILLBOARD_LEAN, 0, 0);
    const shadows = [];
    for (const k of kinds) {
      const cells = [];
      for (let y = 0; y < World.H; y++) for (let x = 0; x < World.W; x++) {
        if (k.test(World.obj[World.idx(x, y)], x, y)) cells.push([x, y]);
      }
      if (!cells.length) continue;
      const w = k.spr.width / TS, h = k.spr.height / TS;
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
  },

  buildBuilding(b) {
    const g = new THREE.Group();
    const wallH = 2.1, shop = b.type === 'shop';
    const base = Math.max(this.groundH(b.x + b.w / 2, b.y + b.h / 2), 0.1);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, wallH, b.h - 0.4),
      new THREE.MeshLambertMaterial({ color: shop ? 0x8a5a34 : 0x6e5136 }));
    wall.position.set(b.w / 2, wallH / 2, b.h / 2 + 0.2);
    g.add(wall);
    // Gable roof as an extruded triangle.
    const shape = new THREE.Shape();
    shape.moveTo(-0.4, 0); shape.lineTo(b.w + 0.4, 0); shape.lineTo(b.w / 2, 1.5); shape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: b.h + 0.2, bevelEnabled: false }),
      new THREE.MeshLambertMaterial({ color: shop ? 0x3f6e7a : 0x7a3a2a }));
    roof.position.set(0, wallH, -0.1);
    g.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.3), new THREE.MeshLambertMaterial({ color: 0x3a2614 }));
    door.position.set(0.9, 0.65, b.h + 0.01);
    g.add(door);
    const winMat = new THREE.MeshLambertMaterial({ color: 0xf2d98a, emissive: 0xffb84a, emissiveIntensity: 0 });
    this.windows.push(winMat);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), winMat);
    win.position.set(b.w - 1.3, 1.25, b.h + 0.01);
    g.add(win);
    if (shop) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32;
      const cx = c.getContext('2d');
      cx.fillStyle = '#e9d9a8'; cx.fillRect(0, 0, 128, 32);
      cx.fillStyle = '#3a2614'; cx.font = 'bold 20px Trebuchet MS'; cx.textAlign = 'center'; cx.fillText('TACKLE', 56, 23);
      cx.fillStyle = '#d9a43a'; cx.beginPath(); cx.ellipse(110, 16, 11, 5, 0, 0, 7); cx.fill();
      cx.beginPath(); cx.moveTo(99, 16); cx.lineTo(93, 10); cx.lineTo(93, 22); cx.fill();
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
      sign.position.set(b.w / 2, wallH + 0.15, b.h + 0.12);
      g.add(sign);
    }
    g.position.set(b.x, base, b.y);
    this.world.add(g);
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
    this.hemi.intensity = 0.18 + 0.62 * day * w;
    this.sun.intensity = 0.05 + 0.95 * day * (env.weather.id === 'clear' ? 1 : 0.45);
    this.sun.color.set(env.phase === 0 || env.phase === 2 ? 0xffc48a : 0xfff2d8);
    this.lantern.intensity = (1 - day) * 1.6;
    this.waterMat.uniforms.uLight.value = 0.35 + 0.65 * day * w + (1 - day) * 0.1;
    for (const m of this.windows) m.emissiveIntensity = (1 - day) * 1.2;
    // Rain follows the camera target.
    this.rain.visible = env.weather.id === 'rain';
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
  },

  // Screen pixel -> point on the water/ground plane, in world tiles.
  screenToWorld(sx, sy) {
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Math.max(0, this.target.y * 0.5));
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, hit)) return { x: this.target.x, y: this.target.z };
    return { x: hit.x, y: hit.z };
  },

  // World point (tiles, height) -> screen pixels, for HUD labels.
  project(x, y, h) {
    const v = new THREE.Vector3(x, h, y).project(this.camera);
    return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, v.z < 1];
  },

  render(time) {
    this.waterMat.uniforms.uTime.value = time;
    this.renderer.render(this.scene, this.camera);
  },
};
