// Cel shading and ink outlines for every solid 3D object, so the world matches the cut-out characters.
'use strict';

const Toon = {
  grad: null,
  outlineMat: null,

  gradient() {
    if (!this.grad) {
      // Three flat bands of light: shadow, mid, lit.
      this.grad = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.LuminanceFormat);
      this.grad.minFilter = this.grad.magFilter = THREE.NearestFilter;
      this.grad.needsUpdate = true;
    }
    return this.grad;
  },

  // Swap Lambert materials for toon ones and give solid shapes an inverted-hull outline.
  apply(root, outline = true) {
    if (!this.outlineMat) this.outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1410, side: THREE.BackSide });
    const targets = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.toon || !o.material || !o.material.isMeshLambertMaterial || o.material.alphaTest) return;
      targets.push(o);
    });
    for (const m of targets) {
      const old = m.material;
      const mat = new THREE.MeshToonMaterial({
        color: old.color, map: old.map || null, gradientMap: this.gradient(), side: old.side,
        emissive: old.emissive, emissiveIntensity: old.emissiveIntensity, transparent: old.transparent, opacity: old.opacity,
      });
      const wi = Scene3D.windows.indexOf(old);
      if (wi >= 0) Scene3D.windows[wi] = mat; // keep night-time window glow working
      m.material = mat; m.userData.toon = true;
      const flat = ['PlaneGeometry', 'CircleGeometry', 'RingGeometry'].includes(m.geometry.type);
      if (outline && !m.isInstancedMesh && !flat) {
        const hull = new THREE.Mesh(m.geometry, this.outlineMat);
        hull.scale.setScalar(1.05); hull.userData.toon = true;
        m.add(hull);
      }
    }
  },
};
