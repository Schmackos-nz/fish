// 3D cartoon characters and animals: cel-shaded, ink-outlined, rigged for simple walk cycles and poses.
// Everything faces +x locally; set rig.yaw.rotation.y = -heading to turn it.
'use strict';

const Models = {
  mats: {}, ink: null, G: null,

  mat(c) {
    const k = typeof c === 'string' ? c : '#' + new THREE.Color(c).getHexString();
    return this.mats[k] || (this.mats[k] = new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: Toon.gradient() }));
  },

  // A part with an ink outline hull (scaled back-face copy).
  part(geo, color, outline = 0.06) {
    const m = new THREE.Mesh(geo, this.mat(color));
    if (outline) {
      if (!this.ink) this.ink = new THREE.MeshBasicMaterial({ color: 0x1a1410, side: THREE.BackSide });
      const h = new THREE.Mesh(geo, this.ink);
      h.scale.setScalar(1 + outline);
      m.add(h);
    }
    return m;
  },

  geos() {
    if (this.G) return this.G;
    const S = (r, w = 16, h = 12, ...a) => new THREE.SphereGeometry(r, w, h, ...a);
    const C = (r0, r1, h, s = 10) => new THREE.CylinderGeometry(r0, r1, h, s);
    this.G = {
      head: S(0.3, 20, 16), body: S(0.27, 18, 14),
      vest: S(0.285, 18, 14, Math.PI + 0.42, Math.PI * 2 - 0.84, 0.5, 2.0),
      apron: S(0.287, 12, 10, Math.PI - 0.62, 1.24, 1.0, 1.25),
      pants: C(0.235, 0.24, 0.12, 16), leg: C(0.075, 0.07, 0.24), foot: S(0.09, 10, 8),
      arm: C(0.06, 0.055, 0.25), mitt: S(0.075, 10, 8),
      eye: S(0.1, 12, 10), pupil: S(0.03, 8, 6), badge: C(0.045, 0.045, 0.01, 10),
      beard: S(0.24, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      hair: S(0.315, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      puff: S(0.11, 10, 8), cap: S(0.318, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
      brim: C(0.4, 0.4, 0.025, 20), bucketTop: C(0.22, 0.27, 0.17, 16), visor: new THREE.BoxGeometry(0.2, 0.025, 0.36),
      wide: C(0.47, 0.47, 0.02, 22), crown: C(0.13, 0.25, 0.22, 4), pom: S(0.07, 10, 8), band: C(0.32, 0.32, 0.07, 18),
      helmet: S(0.36, 18, 14), helmVisor: new THREE.BoxGeometry(0.06, 0.08, 0.42), ring: new THREE.TorusGeometry(0.1, 0.012, 6, 16),
    };
    return this.G;
  },

  // ---------- people ----------
  isFemaleName(n) { return /^(Mabel|Dolores|Pearl|Wanda|Ingrid|Tilly|Hettie|Ngaio|Bev|Marge|Aroha|Tania|Wendy|Sheila|Trish|Lois|Kiri|Ana|Josie|Glenda|Hine|Ruby|Shazza|Kayla|Tui|Dee|Raewyn|Mere|Leilani|Mabel)\b/.test(n || ''); },

  // One shared vertex-coloured toon material and ink for every baked person.
  bodyMat() {
    if (!this._bodyMat) {
      this._bodyMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: Toon.gradient() });
      this._inkMat = new THREE.MeshBasicMaterial({ color: 0x1a1410, side: THREE.BackSide });
    }
    return this._bodyMat;
  },

  // Bake a list of coloured parts into one indexed geometry (and one ink hull), so each bone is two draw calls
  // however detailed the person gets.
  bake(parts) {
    const m = new THREE.Matrix4(), mh = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), col = new THREE.Color();
    const build = (hull) => {
      const pos = [], nrm = [], cols = [], idx = [];
      for (const p of parts) {
        if (hull && !p.o) continue;
        const g = p.geo, P = g.attributes.position, N = g.attributes.normal, base = pos.length / 3;
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromEuler(e.set(p.r[0], p.r[1], p.r[2], p.ro || 'XYZ')), new THREE.Vector3(p.s[0], p.s[1], p.s[2]));
        if (hull) m.multiply(mh.makeScale(1 + p.o, 1 + p.o, 1 + p.o));
        const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
        col.set(p.c);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
          if (!hull) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nrm.push(v.x, v.y, v.z); cols.push(col.r, col.g, col.b); }
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
        else for (let i = 0; i < P.count; i++) idx.push(base + i);
      }
      if (!pos.length) return null;
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (!hull) { out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); }
      out.setIndex(idx);
      out.computeBoundingSphere();
      return out;
    };
    return { body: build(false), hull: build(true) };
  },

  // Higher-detail shared shapes for the baked people.
  pgeos() {
    if (this.PG) return this.PG;
    const S = (r, w, h, ...a) => new THREE.SphereGeometry(r, w, h, ...a), C = (r0, r1, h, s = 12, open = false) => new THREE.CylinderGeometry(r0, r1, h, s, 1, open);
    const prof = [[0.001, 0.05], [0.205, 0.05], [0.2, 0.12], [0.215, 0.2], [0.235, 0.27], [0.24, 0.32], [0.215, 0.37], [0.14, 0.41], [0.07, 0.425], [0.001, 0.43]];
    const lathe = (pts, ...a) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 18, ...a);
    const smile = new THREE.TorusGeometry(0.055, 0.011, 4, 10, Math.PI); smile.rotateZ(Math.PI); smile.rotateY(Math.PI / 2);
    this.PG = {
      prof,
      torso: lathe(prof),
      vest: lathe(prof.slice(1, 8).map(([r, y]) => [r * 1.06, y]), Math.PI / 2 + 0.42, Math.PI * 2 - 0.84),
      apron: lathe([[0.215, -0.05], [0.215, 0.05], [0.21, 0.12], [0.225, 0.2], [0.245, 0.27], [0.25, 0.33]], Math.PI / 2 - 0.75, 1.5),
      hips: C(0.215, 0.224, 0.15, 18), belt: C(0.219, 0.219, 0.035, 18, true), brief: C(0.222, 0.226, 0.09, 18, true),
      buckle: new THREE.BoxGeometry(0.02, 0.045, 0.065), pocket: new THREE.BoxGeometry(0.014, 0.065, 0.075), strap: new THREE.BoxGeometry(0.014, 0.34, 0.035),
      collar: new THREE.TorusGeometry(0.1, 0.024, 6, 16).rotateX(Math.PI / 2), neck: C(0.064, 0.072, 0.11, 10, true), button: S(0.012, 5, 3),
      thigh: C(0.09, 0.078, 0.17, 10, true), shin: C(0.074, 0.062, 0.12, 10, true), cuff: C(0.079, 0.079, 0.028, 10, true), knee: S(0.072, 8, 6),
      shoe: S(0.09, 12, 8), sole: new THREE.BoxGeometry(0.27, 0.035, 0.165), lace: new THREE.BoxGeometry(0.06, 0.012, 0.07),
      shoulder: S(0.08, 10, 8), sleeve: C(0.072, 0.064, 0.13, 10, true), forearm: C(0.054, 0.046, 0.13, 10, true), elbow: S(0.055, 8, 6),
      hand: S(0.06, 10, 8), thumb: S(0.026, 6, 4),
      skull: S(0.3, 24, 18), jaw: S(0.2, 14, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), ear: S(0.065, 8, 6), nose: S(0.046, 8, 6),
      eye: S(0.1, 12, 10), iris: S(0.046, 10, 6, Math.PI / 2, Math.PI), pupil: S(0.026, 8, 5, Math.PI / 2, Math.PI), glint: S(0.011, 5, 3), lid: S(0.104, 10, 8),
      brow: new THREE.BoxGeometry(0.026, 0.024, 0.095), lash: new THREE.BoxGeometry(0.014, 0.016, 0.04), blush: S(0.042, 6, 4), smile,
      tail: C(0.075, 0.025, 0.32, 8), spike: new THREE.ConeGeometry(0.06, 0.16, 5), longHair: S(0.3, 16, 10),
    };
    return this.PG;
  },

  person(pal) {
    const root = new THREE.Group();
    const lean = new THREE.Group(); lean.rotation.x = -0.38; root.add(lean); // tip back toward the camera, like the old cut-outs
    const yaw = new THREE.Group(); lean.add(yaw);
    const key = JSON.stringify(pal), cache = this.bodyCache || (this.bodyCache = new Map());
    let B = cache.get(key);
    if (!B) { B = this.buildBody(pal); cache.set(key, B); }
    const mat = this.bodyMat(), ink = this._inkMat;
    const dress = (g, k) => { const b = B[k]; if (b.body) g.add(new THREE.Mesh(b.body, mat)); if (b.hull) g.add(new THREE.Mesh(b.hull, ink)); };
    const pivot = (parent, x, y, z, k) => { const p = new THREE.Group(); p.position.set(x, y, z); dress(p, k); parent.add(p); return p; };
    const legL = pivot(yaw, 0, 0.3, -0.1, 'legL'), legR = pivot(yaw, 0, 0.3, 0.1, 'legR');
    const upper = pivot(yaw, 0, 0.3, 0, 'upper');
    const armL = pivot(upper, 0, 0.36, -0.285, 'armL'), armR = pivot(upper, 0, 0.36, 0.285, 'armR');
    for (const a of [armL, armR]) { const h = new THREE.Object3D(); h.position.y = -0.27; a.add(h); } // hand marker (last child)
    const head = new THREE.Group(); head.position.y = 0.69; head.scale.setScalar(0.93); dress(head, 'head'); upper.add(head);
    // Eyelids blink, so they stay their own little meshes.
    const lids = [];
    for (const z of [-0.085, 0.085]) { const l = new THREE.Mesh(this.pgeos().lid, this.mat(pal.skin || '#e8b88a')); l.position.set(0.255, 0.04, z); l.scale.set(0.56, 0.001, 0.98); head.add(l); lids.push(l); }
    root.userData.rig = { root, lean, yaw, upper, head, legL, legR, armL, armR, hand: armR.children[armR.children.length - 1], lids, seed: B.seed };
    return root;
  },

  buildBody(pal) {
    const G = this.pgeos(), OG = this.geos();
    let h = 0; for (const c of String(pal.skin) + pal.shirt + pal.hat + pal.hair + pal.pants) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = (k) => (((h ^ Math.imul(k + 1, 2654435761)) >>> 0) % 10007) / 10007;
    const skin = pal.skin || '#e8b88a', shirt = pal.shirt || '#3a6a9a', pants = pal.pants || '#3a3a4a', hair = pal.hair || '#5A3A2A';
    const bare = shirt === skin, sh = (c, k) => U.shade(c, k);
    const long = pal.longSleeve || !!pal.badge || pal.hatStyle === 'ranger' || pal.hatStyle === 'helmet';
    const shoes = pal.waders ? '#2A3320' : pal.shoes || ['#3A2A20', '#2A2A2E', '#6A4A2A', '#E8E4DA', '#8A2A2A'][Math.floor(rnd(1) * 5)];
    const kit = () => { const parts = []; const add = (geo, c, x = 0, y = 0, z = 0, s = [1, 1, 1], o = 0, r = [0, 0, 0]) => { parts.push({ geo, c, x, y, z, s: typeof s === 'number' ? [s, s, s] : s, o, r }); }; return { parts, add }; };
    const out = { seed: rnd(9) * 10 };
    // ---- legs ----
    for (const side of ['legL', 'legR']) {
      const { parts, add } = kit();
      if (bare) { add(G.brief, pants, 0, -0.01, 0, [0.95, 1, 0.55], 0.05); add(G.thigh, skin, 0, -0.085, 0, 1, 0.06); add(G.knee, skin, 0, -0.165, 0, [1, 0.8, 1]); add(G.shin, skin, 0, -0.205, 0, 1, 0.06); }
      else {
        add(G.thigh, pants, 0, -0.075, 0, 1, 0.06); add(G.knee, pants, 0.006, -0.165, 0, [1, 0.8, 1]); add(G.shin, pants, 0, -0.205, 0, 1, 0.06);
        add(G.cuff, sh(pants, -0.18), 0, -0.258, 0, 1, 0.05);
      }
      if (bare && !pal.waders) add(G.shoe, skin, 0.04, -0.27, 0, [1.25, 0.55, 0.85], 0.1);
      else { add(G.shoe, shoes, 0.045, -0.262, 0, [1.55, 0.72, 1.0], 0.09); add(G.sole, sh(shoes, 0.35), 0.05, -0.296, 0, 1, 0.08); add(G.lace, sh(shoes, -0.25), 0.07, -0.226, 0, 1); }
      out[side] = this.bake(parts);
    }
    // ---- torso ----
    {
      const { parts, add } = kit(), P = G.prof, rAt = (y) => { for (let i = 1; i < P.length; i++) if (P[i][1] >= y) { const [r0, y0] = P[i - 1], [r1, y1] = P[i]; return U.lerp(r0, r1, (y - y0) / (y1 - y0 || 1)); } return 0.1; };
      const fx = (y) => rAt(y) * 0.86;
      add(G.hips, pants, 0, 0.0, 0, [0.86, 1, 1], 0.05);
      add(G.torso, bare ? skin : shirt, 0, 0, 0, [0.86, 1, 1], 0.045);
      add(G.neck, skin, 0, 0.43, 0, 1, 0.05);
      if (!bare) {
        add(G.belt, pal.belt || '#3A2A1E', 0, 0.075, 0, [0.87, 1, 1.01]); add(G.buckle, '#D9B44A', 0.19, 0.075, 0, 1);
        add(G.collar, sh(shirt, -0.14), 0, 0.392, 0, [0.95, 1, 1.05], 0.08);
        if (!pal.vest && !pal.apron) for (const y of [0.16, 0.24, 0.32]) add(G.button, sh(shirt, -0.4), fx(y) + 0.004, y, 0);
        if (!pal.vest && !pal.apron) add(G.pocket, sh(shirt, -0.1), fx(0.28) - 0.004, 0.28, -0.1, 1);
      }
      if (pal.vest && !pal.apron) add(G.vest, pal.vest, 0, 0, 0, [0.86, 1, 1], 0.04);
      if (pal.apron) add(G.apron, pal.vest, 0, 0, 0, [0.86, 1, 1], 0.03);
      if (pal.waders) for (const z of [-0.085, 0.085]) add(G.strap, pants, fx(0.22) + 0.006, 0.22, z, 1);
      // Women: a modest bust, always covered — by their shirt, or a bikini top / bra if they're bare.
      if (pal.female) {
        const top = bare ? (pal.bra || '#E2584D') : (pal.vest && !pal.apron ? shirt : pal.apron ? pal.vest : shirt);
        let hh = 0; for (const c of String(pal.skin) + pal.shirt + pal.hat + pal.hair) hh = (hh * 31 + c.charCodeAt(0)) >>> 0;
        const k = pal.bust || 0.8 + (hh % 1000) / 1000 * 0.45; // 0.8–1.25
        for (const z of [-0.075, 0.075]) add(OG.mitt, top, 0.15 + 0.03 * k, 0.26, z * (0.95 + k * 0.05), [0.62 * k, 0.6 * (0.9 + k * 0.1), 0.6], 0.06);
        if (bare) add(OG.band, top, 0, 0.26, 0, [0.84, 0.35, 0.98]);
      }
      if (pal.badge) add(OG.badge, '#E8C04A', fx(0.27) + 0.005, 0.27, -0.1, 1, 0.3, [0, 0, Math.PI / 2]);
      out.upper = this.bake(parts);
    }
    // ---- arms ----
    for (const [side, zs] of [['armL', -1], ['armR', 1]]) {
      const { parts, add } = kit(), top = bare ? skin : shirt, hand = pal.mitt && pal.mitt !== shirt ? pal.mitt : skin;
      add(G.shoulder, top, 0, -0.005, 0, 1, 0.05);
      add(G.sleeve, top, 0, -0.07, 0, 1, 0.06);
      if (long) { add(G.forearm, shirt, 0, -0.185, 0, [1.12, 1, 1.12], 0.06); add(G.cuff, sh(shirt, -0.18), 0, -0.24, 0, [0.72, 1, 0.72]); }
      else { add(G.elbow, skin, 0, -0.13, 0); add(G.forearm, skin, 0, -0.19, 0, 1, 0.06); }
      add(G.hand, hand, 0, -0.272, 0, [0.95, 1.1, 0.8], 0.08);
      add(G.thumb, hand, 0.045, -0.252, -zs * 0.01, 1, 0.12);
      out[side] = this.bake(parts);
    }
    // ---- head ----
    {
      const { parts, add } = kit(), female = !!pal.female;
      add(G.skull, skin, 0, 0, 0, [1, 0.98, 0.97], 0.035);
      add(G.jaw, skin, 0.07, -0.13, 0, [1, 0.72, 1.18]);
      for (const z of [-1, 1]) add(G.ear, skin, -0.01, 0, z * 0.288, [0.55, 1, 0.45], 0.12);
      const iris = pal.eyes || ['#5A3A1E', '#3A6A9A', '#4A7A3A', '#7A5A2A', '#2A2A2A'][Math.floor(rnd(2) * 5)];
      for (const z of [-0.085, 0.085]) {
        add(G.eye, '#FFFFFF', 0.255, 0.035, z, [0.42, 1.15, 0.95], 0.08);
        add(G.iris, iris, 0.29, 0.03, z * 0.93, [0.42, 1, 1]);
        add(G.pupil, '#111111', 0.302, 0.03, z * 0.9, [0.4, 1, 1]);
        add(G.glint, '#FFFFFF', 0.31, 0.055, z * 0.82, 1);
        if (pal.glasses) add(OG.ring, '#3A3A3A', 0.29, 0.035, z, 1, 0, [0, Math.PI / 2, 0]);
        if (!['cap', 'beanie', 'helmet', 'swimcap', 'bucket', 'ranger'].includes(pal.hatStyle)) add(G.brow, sh(pal.beard || hair, -0.25), 0.283, 0.165 + rnd(3) * 0.02, z * 1.05, 1, 0, [z > 0 ? -0.15 : 0.15, 0, 0]);
        if (female) add(G.lash, '#1A1410', 0.272, 0.12, z * 1.6, 1, 0, [z > 0 ? 0.6 : -0.6, 0, 0]);
        if (female) add(G.blush, '#F2A0A0', 0.262, -0.06, z * 1.9, [0.25, 0.6, 1]);
      }
      add(G.nose, sh(skin, -0.05), 0.3, -0.045, 0, [0.9, 0.85, 0.75], 0.1);
      add(G.smile, '#6A2A26', 0.276, -0.135, 0, [1, 1, 1 + rnd(4) * 0.4]);
      if (pal.beard) add(OG.beard, pal.beard, 0.1, -0.03, 0, 1, 0.04, [0, 0, 0.35]);
      this.hat(add, pal, rnd, hair);
      out.head = this.bake(parts);
    }
    return out;
  },

  hat(add, pal, rnd, hair) {
    const G = this.geos(), PG = this.pgeos();
    const s = pal.hatStyle, female = !!pal.female;
    // Long hair hangs out under most hats.
    if (female && !['helmet', 'swimcap', 'none'].includes(s)) {
      const style = Math.floor(rnd(5) * 3);
      if (style === 0) add(PG.longHair, hair, -0.1, -0.1, 0, [0.8, 1.15, 1.05], 0.03);
      else if (style === 1) { add(G.puff, hair, -0.3, 0.08, 0, 1, 0.05); add(PG.tail, hair, -0.37, -0.1, 0, 1, 0.06, [0, 0, -0.35]); }
      else add(PG.longHair, hair, -0.05, -0.05, 0, [0.95, 0.78, 1.08], 0.03);
    }
    if (s === 'bucket') {
      add(G.brim, pal.hat, 0, 0.14, 0, 1, 0.03); add(G.bucketTop, pal.hat, 0, 0.24, 0, 1, 0.04);
      add(G.band, U.shade(pal.hat, -0.25), 0, 0.17, 0, [0.85, 0.5, 0.85]);
      if (pal.fly) add(G.pom, pal.fly, 0.16, 0.22, 0.14, 0.5, 0.1);
    } else if (s === 'beanie') {
      add(G.cap, pal.hat, 0, 0.04, 0, 1, 0.03); add(G.band, U.shade(pal.hat, -0.25), 0, 0.1, 0, 1, 0.03);
      add(G.pom, pal.pom || '#F2E6C8', 0, 0.37, 0, 1, 0.1);
    } else if (s === 'cap') {
      add(G.cap, pal.hat, 0, 0.04, 0, 1, 0.03); add(G.visor, U.shade(pal.hat, -0.2), 0.3, 0.13, 0, 1, 0.1);
      add(G.pom, U.shade(pal.hat, -0.2), 0, 0.33, 0, 0.35);
    } else if (s === 'ranger') {
      add(G.wide, pal.hat, 0, 0.15, 0, 1, 0.03); add(G.crown, pal.hat, 0, 0.27, 0, 1, 0.05, [0, Math.PI / 4, 0]);
      add(G.band, pal.hatBand || U.shade(pal.hat, -0.35), 0, 0.19, 0, [0.62, 0.5, 0.62]);
    } else if (s === 'helmet') {
      add(G.helmet, pal.hat, 0, 0.02, 0, 1, 0.03); add(G.helmVisor, pal.visor || '#222', 0.33, 0.04, 0, 1, 0.05);
      add(G.visor, U.shade(pal.hat, -0.2), 0.32, 0.2, 0, 1, 0.08);
    } else if (s === 'swimcap') {
      add(G.cap, pal.hat, 0, 0.04, 0, 1, 0.03);
      for (const z of [-0.085, 0.085]) add(G.ring, '#2A3A4A', 0.29, 0.035, z, 1.1, 0, [0, Math.PI / 2, 0]);
      add(G.band, '#2A3A4A', 0, 0.035, 0, [1, 0.25, 1]);
    } else if (s === 'none') {
      for (const [x, y, z] of [[-0.05, 0.25, -0.15], [-0.05, 0.25, 0.15], [-0.12, 0.3, 0], [0.04, 0.3, -0.06], [0.04, 0.3, 0.07], [-0.2, 0.12, -0.2], [-0.2, 0.12, 0.2], [0.1, 0.25, 0], [-0.25, 0.2, 0]]) add(G.puff, hair, x, y, z, 1, 0.06);
    } else {
      // Bare-headed: a proper haircut, different for everyone.
      const style = Math.floor(rnd(6) * 4);
      if (!female && style === 3) { for (const [x, z] of [[-0.08, -0.25], [-0.08, 0.25], [-0.26, 0]]) add(G.puff, hair, x, 0.02, z, [1.3, 1, 1.3], 0.05); }
      else {
        add(G.hair, hair, 0, 0, 0, 1, 0.03);
        if (!female && style === 1) add(G.puff, hair, 0.18, 0.25, 0.04, [1.3, 0.65, 1.6], 0.05);
        if (!female && style === 2) for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(PG.spike, hair, Math.cos(a) * 0.14 - 0.03, 0.27, Math.sin(a) * 0.14, 1, 0.05, [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]); }
        if (female && style >= 2) add(G.puff, hair, -0.1, 0.32, 0, 1.3, 0.05); // a bun
        if (female && style % 2 === 0) add(G.puff, hair, 0.2, 0.2, 0, [0.6, 0.55, 2.0], 0.04); // a fringe
      }
    }
  },

  // s: { moving, phase, pose: normal|grip|brag|hold|ride|slide, crouch, t }
  pose(rig, s) {
    rig.armL.scale.y = rig.armR.scale.y = 1;
    const ph = Math.sin(s.phase * 9), sw = s.moving ? ph * 0.65 : 0, t = s.t !== undefined ? s.t : performance.now() / 1000;
    rig.legL.rotation.set(0, 0, sw); rig.legR.rotation.set(0, 0, -sw);
    rig.armL.rotation.set(0.08, 0, -sw * 0.8); rig.armR.rotation.set(-0.08, 0, sw * 0.8);
    // Hips and shoulders counter-twist on the stride; the head bobs and looks about when idle.
    rig.upper.rotation.set(0, s.moving ? ph * 0.12 : 0, s.moving ? -0.06 : 0);
    if (rig.head) rig.head.rotation.set(0, s.moving ? -ph * 0.1 : Math.sin(t * 0.43 + (rig.seed || 0)) * 0.22, s.moving ? 0.03 : Math.sin(t * 0.7) * 0.04);
    rig.yaw.position.y = s.moving ? Math.abs(ph) * 0.035 : 0;
    rig.upper.scale.y = 1 + Math.sin(t * 2.2) * 0.012; // breathing
    rig.yaw.scale.y = s.crouch ? 0.78 : 1;
    if (rig.lids) { const shut = ((t + (rig.seed || 0)) % 3.9) < 0.13; for (const l of rig.lids) l.scale.y = shut ? 1.2 : 0.001; }
    const p = s.pose || 'normal';
    if (p === 'grip') rig.armR.rotation.set(-0.15, 0, 1.25);
    else if (p === 'brag') { rig.armR.rotation.set(-2.3, 0, 0); rig.armL.rotation.set(2.3, 0, 0); }
    else if (p === 'hold') { rig.armR.rotation.set(-0.35, 0, 2.4); rig.armL.rotation.set(0.35, 0, 2.4); }
    else if (p === 'ride') {
      rig.legL.rotation.set(0.25, 0, 1.35); rig.legR.rotation.set(-0.25, 0, 1.35);
      rig.armR.rotation.set(-0.35, 0, 1.15); rig.armL.rotation.set(0.35, 0, 1.15);
      rig.upper.rotation.set(0, 0, -0.3); rig.yaw.position.y = 0;
    } else if (p === 'kart') {
      // Sat low with legs out in front.
      rig.legL.rotation.set(0.12, 0, 1.5); rig.legR.rotation.set(-0.12, 0, 1.5);
      rig.upper.rotation.set(0, 0, 0.12); rig.yaw.position.y = 0;
    } else if (p === 'slide') {
      rig.legL.rotation.set(0, 0, 1.1); rig.legR.rotation.set(0, 0, 0.9);
      rig.upper.rotation.set(0, 0, 0.45); rig.armL.rotation.set(1.2, 0, 0); rig.armR.rotation.set(-1.2, 0, 0);
    }
  },

  // Point the holding arm at a world target (e.g. along the fishing rod), keeping a slight bend downward.
  aimArm(rig, target, droop = 0.3) {
    const v = this._v || (this._v = new THREE.Vector3()), q = this._q || (this._q = new THREE.Quaternion());
    const down = this._down || (this._down = new THREE.Vector3(0, -1, 0));
    rig.root.updateMatrixWorld(true);
    rig.armR.getWorldPosition(v);
    const dir = target.clone().sub(v).normalize();
    dir.y -= droop; dir.normalize();
    rig.armR.parent.getWorldQuaternion(q).invert();
    dir.applyQuaternion(q);
    rig.armR.quaternion.setFromUnitVectors(down, dir);
  },

  // Put an arm's hand on a world point: point the arm at it and stretch (cartoonishly) to reach.
  reach(rig, arm, target) {
    const v = this._v || (this._v = new THREE.Vector3()), q = this._q || (this._q = new THREE.Quaternion()), h = this._h || (this._h = new THREE.Vector3());
    const down = this._down || (this._down = new THREE.Vector3(0, -1, 0));
    arm.scale.y = 1; arm.quaternion.identity();
    rig.root.updateMatrixWorld(true);
    arm.getWorldPosition(v);
    arm.children[arm.children.length - 1].getWorldPosition(h); // the hand marker
    const len = v.distanceTo(h) || 0.3, d = v.distanceTo(target);
    const dir = target.clone().sub(v).normalize();
    arm.parent.getWorldQuaternion(q).invert();
    dir.applyQuaternion(q);
    arm.quaternion.setFromUnitVectors(down, dir);
    arm.scale.y = U.clamp(d / len, 0.6, 1.6);
  },

  // A fishing rod as a real tapered-looking tube along a curve (rebuilt each frame; it's tiny).
  rod(color) { return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshToonMaterial({ color, gradientMap: Toon.gradient() })); },
  setRod(mesh, a, ctrl, b, r = 0.024) {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, ctrl, b), 10, r, 6, false);
  },

  // World position of the right (holding) hand.
  handPos(rig, out = new THREE.Vector3()) {
    rig.root.updateMatrixWorld(true);
    return rig.hand.getWorldPosition(out);
  },

  // ---------- animals ----------
  quad(spec) {
    const G = this.geos(), P = (g, c, o) => this.part(g, c, o);
    const root = new THREE.Group(), yaw = new THREE.Group(); root.add(yaw);
    yaw.rotation.order = 'YXZ';
    const legs = [];
    for (const [x, z] of [[spec.legX, spec.legZ], [spec.legX, -spec.legZ], [-spec.legX, spec.legZ], [-spec.legX, -spec.legZ]]) {
      const p = new THREE.Group(); p.position.set(x, spec.hip, z);
      const l = P(new THREE.CylinderGeometry(spec.legR, spec.legR * 0.8, spec.hip, 7), spec.leg || spec.color, 0.15); l.position.y = -spec.hip / 2; p.add(l);
      const h = P(G.pupil, '#231B16', 0); h.scale.set(1.8, 1, 1.6); h.position.y = -spec.hip; p.add(h);
      yaw.add(p); legs.push(p);
    }
    const body = P(new THREE.SphereGeometry(0.35, 16, 12), spec.color, 0.04); body.scale.set(...spec.body); body.position.y = spec.bodyY; yaw.add(body);
    root.userData.rig = { root, yaw, legs, body };
    return { root, yaw, P, G };
  },

  deer(buck) {
    const { root, yaw, P, G } = this.quad({ color: '#A8723E', legX: 0.3, legZ: 0.13, hip: 0.6, legR: 0.05, body: [1.45, 0.78, 0.72], bodyY: 0.78 });
    const belly = P(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), '#E8CFA0', 0); belly.scale.set(1.5, 0.7, 0.8); belly.position.y = 0.8; yaw.add(belly);
    const neck = P(new THREE.CylinderGeometry(0.08, 0.11, 0.42, 8), '#A8723E', 0.1); neck.position.set(0.46, 1.02, 0); neck.rotation.z = -0.55; yaw.add(neck);
    const head = new THREE.Group(); head.position.set(0.62, 1.22, 0); yaw.add(head);
    const hd = P(new THREE.SphereGeometry(0.15, 14, 10), '#A8723E', 0.06); hd.scale.set(1.45, 0.92, 0.85); head.add(hd);
    const nose = P(G.pupil, '#1A1410', 0); nose.scale.setScalar(1.6); nose.position.set(0.21, -0.02, 0); head.add(nose);
    for (const z of [-0.08, 0.08]) {
      const e = P(G.eye, '#FFFFFF', 0.1); e.scale.set(0.35, 0.5, 0.45); e.position.set(0.07, 0.05, z); head.add(e);
      const pu = P(G.pupil, '#111', 0); pu.scale.setScalar(0.7); pu.position.set(0.1, 0.05, z * 1.15); head.add(pu);
      const ear = P(new THREE.ConeGeometry(0.05, 0.16, 6), '#8A5A2E', 0.1); ear.position.set(-0.06, 0.12, z * 1.6); ear.rotation.x = z > 0 ? 0.7 : -0.7; head.add(ear);
      if (buck) for (const [dx, dy, rz] of [[0, 0.24, 0.2], [0.07, 0.34, -0.5], [-0.04, 0.4, 0.5]]) {
        const ant = P(new THREE.CylinderGeometry(0.014, 0.02, 0.22, 5), '#E0D0A8', 0.15); ant.position.set(-0.02 + dx, 0.08 + dy * 0.55, z * 1.1); ant.rotation.set(z > 0 ? 0.35 : -0.35, 0, rz); head.add(ant);
      }
    }
    const tail = P(G.pom, '#F4F0E6', 0.1); tail.position.set(-0.52, 0.86, 0); yaw.add(tail);
    return root;
  },

  boar() {
    const { root, yaw, P, G } = this.quad({ color: '#5A4632', leg: '#3A2E22', legX: 0.26, legZ: 0.14, hip: 0.32, legR: 0.055, body: [1.35, 0.9, 0.82], bodyY: 0.48 });
    const head = new THREE.Group(); head.position.set(0.44, 0.46, 0); yaw.add(head);
    const hd = P(new THREE.SphereGeometry(0.2, 14, 10), '#5A4632', 0.05); hd.scale.set(1.1, 0.95, 0.9); head.add(hd);
    const snout = P(new THREE.CylinderGeometry(0.08, 0.1, 0.14, 10), '#C98A7A', 0.12); snout.rotation.z = Math.PI / 2; snout.position.set(0.24, -0.04, 0); head.add(snout);
    for (const z of [-0.07, 0.07]) {
      const tusk = P(new THREE.ConeGeometry(0.02, 0.1, 5), '#F4F0E6', 0.15); tusk.position.set(0.24, 0.03, z * 1.1); tusk.rotation.z = -0.4; head.add(tusk);
      const e = P(G.pupil, '#D23A2A', 0.3); e.position.set(0.15, 0.08, z * 1.3); head.add(e);
      const ear = P(new THREE.ConeGeometry(0.06, 0.14, 5), '#3A2E22', 0.1); ear.position.set(-0.02, 0.2, z * 1.8); ear.rotation.x = z > 0 ? 0.5 : -0.5; head.add(ear);
    }
    for (let i = 0; i < 5; i++) { const br = P(new THREE.ConeGeometry(0.05, 0.13, 4), '#2A1E14', 0.1); br.position.set(0.25 - i * 0.12, 0.78, 0); yaw.add(br); }
    const tail = P(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 4), '#2A1E14', 0.2); tail.position.set(-0.5, 0.5, 0); tail.rotation.z = 0.8; yaw.add(tail);
    return root;
  },

  animateQuad(rig, moving, phase) {
    rig.legs.forEach((l, i) => { l.rotation.z = moving ? Math.sin(phase * 7 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 : 0; });
  },
};

// A standing 3D shopkeeper/guide: build once, place, and it idles in place.
function standee(pal, x, y, face = Math.PI / 2) {
  const m = Models.person(pal);
  m.position.set(x, Scene3D.standH(x, y), y);
  m.userData.rig.yaw.rotation.y = -face;
  Models.pose(m.userData.rig, { pose: 'normal', t: Math.random() * 6 });
  return m;
}
