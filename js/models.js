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
  person(pal) {
    const G = this.geos(), P = (g, c, o) => this.part(g, c, o);
    const root = new THREE.Group();
    const lean = new THREE.Group(); lean.rotation.x = -0.38; root.add(lean); // tip back toward the camera, like the old cut-outs
    const yaw = new THREE.Group(); lean.add(yaw);
    // Legs pivot at the hip.
    const leg = (z) => {
      const p = new THREE.Group(); p.position.set(0, 0.3, z);
      const l = P(G.leg, pal.pants, 0.2); l.position.y = -0.13; p.add(l);
      const f = P(G.foot, '#231B16', 0.12); f.scale.set(1.35, 0.6, 0.95); f.position.set(0.05, -0.27, 0); p.add(f);
      yaw.add(p); return p;
    };
    const legL = leg(-0.1), legR = leg(0.1);
    const upper = new THREE.Group(); upper.position.y = 0.3; yaw.add(upper);
    const pants = P(G.pants, pal.pants, 0.06); pants.position.y = 0.02; upper.add(pants);
    const body = P(G.body, pal.shirt, 0.05); body.position.y = 0.19; body.scale.set(1, 1.1, 1); upper.add(body);
    if (pal.vest && !pal.apron) { const v = P(G.vest, pal.vest, 0); v.position.copy(body.position); v.scale.copy(body.scale); upper.add(v); }
    if (pal.apron) { const v = P(G.apron, pal.vest, 0); v.position.copy(body.position); v.scale.copy(body.scale); upper.add(v); }
    if (pal.badge) { const b = P(G.badge, '#E8C04A', 0.3); b.rotation.z = Math.PI / 2; b.position.set(0.27, 0.27, -0.1); upper.add(b); }
    // Arms pivot at the shoulder; the right hand carries rods and rifles.
    const arm = (z, isRight) => {
      const p = new THREE.Group(); p.position.set(0, 0.33, z);
      const a = P(G.arm, pal.shirt, 0.2); a.position.y = -0.12; p.add(a);
      const m = P(G.mitt, pal.mitt || pal.shirt, 0.1); m.position.y = -0.27; p.add(m);
      const hand = new THREE.Object3D(); hand.position.y = -0.27; p.add(hand);
      upper.add(p); return { p, hand };
    };
    const aL = arm(-0.29), aR = arm(0.29, true);
    // Head: the big round South Park ball.
    const head = new THREE.Group(); head.position.y = 0.62; upper.add(head);
    head.add(P(G.head, pal.skin, 0.04));
    for (const z of [-0.085, 0.085]) {
      const e = P(G.eye, '#FFFFFF', 0.08); e.scale.set(0.42, 1.15, 0.95); e.position.set(0.255, 0.035, z); head.add(e);
      const pu = P(G.pupil, '#111111', 0); pu.position.set(0.3, 0.03, z * 0.75); head.add(pu);
      if (pal.glasses) { const r = P(G.ring, '#3A3A3A', 0); r.rotation.y = Math.PI / 2; r.position.set(0.29, 0.035, z); head.add(r); }
    }
    if (pal.beard) { const b = P(G.beard, pal.beard, 0.04); b.position.set(0.1, -0.03, 0); b.rotation.z = 0.35; head.add(b); }
    this.hat(head, pal);
    root.userData.rig = { root, lean, yaw, upper, head, legL, legR, armL: aL.p, armR: aR.p, hand: aR.hand };
    return root;
  },

  hat(head, pal) {
    const G = this.geos(), P = (g, c, o) => this.part(g, c, o);
    const s = pal.hatStyle;
    if (s === 'bucket') {
      const b = P(G.brim, pal.hat, 0.03); b.position.y = 0.14; head.add(b);
      const t = P(G.bucketTop, pal.hat, 0.04); t.position.y = 0.24; head.add(t);
      if (pal.fly) { const f = P(G.pom, pal.fly, 0.1); f.scale.setScalar(0.5); f.position.set(0.16, 0.22, 0.14); head.add(f); }
    } else if (s === 'beanie') {
      const c = P(G.cap, pal.hat, 0.03); c.position.y = 0.04; head.add(c);
      const band = P(G.band, U.shade(pal.hat, -0.25), 0.03); band.position.y = 0.1; head.add(band);
      const pom = P(G.pom, pal.pom || '#F2E6C8', 0.1); pom.position.y = 0.37; head.add(pom);
    } else if (s === 'cap') {
      const c = P(G.cap, pal.hat, 0.03); c.position.y = 0.04; head.add(c);
      const v = P(G.visor, U.shade(pal.hat, -0.2), 0.1); v.position.set(0.3, 0.13, 0); head.add(v);
    } else if (s === 'ranger') {
      const w = P(G.wide, pal.hat, 0.03); w.position.y = 0.15; head.add(w);
      const c = P(G.crown, pal.hat, 0.05); c.position.y = 0.27; c.rotation.y = Math.PI / 4; head.add(c);
    } else if (s === 'helmet') {
      const h = P(G.helmet, pal.hat, 0.03); h.position.y = 0.02; head.add(h);
      const v = P(G.helmVisor, pal.visor || '#222', 0.05); v.position.set(0.33, 0.04, 0); head.add(v);
      const pk = P(G.visor, U.shade(pal.hat, -0.2), 0.08); pk.position.set(0.32, 0.2, 0); head.add(pk);
    } else if (s === 'none') {
      for (const [x, y, z] of [[-0.05, 0.25, -0.15], [-0.05, 0.25, 0.15], [-0.12, 0.3, 0], [0.04, 0.3, -0.06], [0.04, 0.3, 0.07], [-0.2, 0.12, -0.2], [-0.2, 0.12, 0.2]]) {
        const p = P(G.puff, pal.hair, 0.06); p.position.set(x, y, z); head.add(p);
      }
    } else {
      const h = P(G.hair, pal.hair || '#5A3A2A', 0.03); head.add(h);
    }
  },

  // s: { moving, phase, pose: normal|grip|brag|hold|ride|slide, crouch, t }
  pose(rig, s) {
    const sw = s.moving ? Math.sin(s.phase * 9) * 0.65 : 0;
    rig.legL.rotation.set(0, 0, sw); rig.legR.rotation.set(0, 0, -sw);
    rig.armL.rotation.set(0, 0, -sw * 0.8); rig.armR.rotation.set(0, 0, sw * 0.8);
    rig.upper.rotation.set(0, 0, 0);
    rig.yaw.position.y = s.moving ? Math.abs(Math.sin(s.phase * 9)) * 0.035 : 0;
    rig.upper.scale.y = 1 + Math.sin((s.t || 0) * 2.2) * 0.012; // breathing
    rig.yaw.scale.y = s.crouch ? 0.78 : 1;
    const p = s.pose || 'normal';
    if (p === 'grip') rig.armR.rotation.set(-0.15, 0, 1.25);
    else if (p === 'brag') { rig.armR.rotation.set(-2.3, 0, 0); rig.armL.rotation.set(2.3, 0, 0); }
    else if (p === 'hold') { rig.armR.rotation.set(-0.35, 0, 2.4); rig.armL.rotation.set(0.35, 0, 2.4); }
    else if (p === 'ride') {
      rig.legL.rotation.set(0.25, 0, 1.35); rig.legR.rotation.set(-0.25, 0, 1.35);
      rig.armR.rotation.set(-0.35, 0, 1.15); rig.armL.rotation.set(0.35, 0, 1.15);
      rig.upper.rotation.z = -0.3; rig.yaw.position.y = 0;
    } else if (p === 'slide') {
      rig.legL.rotation.set(0, 0, 1.1); rig.legR.rotation.set(0, 0, 0.9);
      rig.upper.rotation.z = 0.45; rig.armL.rotation.set(1.2, 0, 0); rig.armR.rotation.set(-1.2, 0, 0);
    }
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
