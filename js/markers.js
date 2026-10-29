// GTA-style door markers: a glowing ring and light column outside each usable door, with a floating sign.
'use strict';

const Markers = {
  group: null, list: [],

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.refresh();
  },

  // Which doors get a marker, and how they're labelled.
  targets() {
    const out = [];
    for (const b of World.buildings) {
      const d = World.doorOf(b);
      if (b.type === 'shop') out.push({ x: d.x, y: d.y, label: 'Tackle Shop', icon: '🎣', color: '#E3A945' });
      else if (b.type === 'ranger') out.push({ x: d.x, y: d.y, label: 'Ranger · Permits', icon: '🪪', color: '#E3A945' });
      else if (b.type === 'store') out.push({ x: d.x, y: d.y, label: 'General Store', icon: '🛒', color: '#E3A945' });
      else if (b.type === 'bikes') out.push({ x: d.x, y: d.y, label: 'Dirt Bikes', icon: '🏍️', color: '#E3A945' });
      else if (b.type === 'clinic') out.push({ x: d.x, y: d.y, label: 'Clinic', icon: '🏥', color: '#E2584D' });
      else if (b.type === 'gas') { const p = World.pumps[0]; out.push({ x: p.x + 1.1, y: p.y + 1.2, label: 'Gas', icon: '⛽', color: '#E3A945' }); }
      else if (b.type === 'house' && Game.home && Game.home.id === b.id) out.push({ x: d.x, y: d.y, label: 'Home', icon: '🏠', color: '#7DC383' });
      else if (b.type === 'house' && b.vacant) out.push({ x: d.x, y: d.y, label: 'For rent · ' + U.fmtMoney(b.rent) + '/day', icon: '🔑', color: '#7FC4D4' });
    }
    out.push({ x: World.bbq.x, y: World.bbq.y + 0.9, label: 'BBQ', icon: '🔥', color: '#F2802A' });
    out.push({ x: World.tim.x, y: World.tim.y + 0.9, label: Tim.guide().name + ' · Guide', icon: '🧢', color: '#7DC383' });
    return out;
  },

  sign(t) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 120;
    const g = c.getContext('2d');
    g.font = '600 34px Inter, "Segoe UI", sans-serif';
    const tw = g.measureText(t.label).width, w = Math.min(310, tw + 92), x = (320 - w) / 2;
    g.fillStyle = 'rgba(11,16,19,0.88)'; g.beginPath(); g.roundRect(x, 6, w, 64, 32); g.fill();
    g.strokeStyle = t.color; g.lineWidth = 4; g.beginPath(); g.roundRect(x + 2, 8, w - 4, 60, 30); g.stroke();
    g.font = '30px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; g.textAlign = 'left'; g.fillText(t.icon, x + 18, 49);
    g.fillStyle = '#EEE7D7'; g.font = '600 30px Inter, "Segoe UI", sans-serif'; g.fillText(t.label, x + 62, 48, w - 78);
    // Pointer down at the door.
    g.fillStyle = t.color; g.beginPath(); g.moveTo(160 - 16, 74); g.lineTo(160 + 16, 74); g.lineTo(160, 104); g.closePath(); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  },

  refresh() {
    if (!this.group) return;
    for (const m of this.list) { this.group.remove(m.root); m.sprite.material.map.dispose(); }
    this.list = this.targets().map((t) => {
      const col = new THREE.Color(t.color);
      const root = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 28, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 0.65;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sign(t), transparent: true, depthTest: false }));
      sprite.scale.set(2.6, 0.98, 1); sprite.position.y = 2.7; sprite.renderOrder = 20;
      root.add(ring, disc, beam, sprite);
      root.position.set(t.x, Scene3D.groundH(t.x, t.y), t.y);
      root.renderOrder = 6;
      this.group.add(root);
      return { root, ring, disc, beam, sprite, t };
    });
  },

  render() {
    const cp = Scene3D.canopy;
    if (cp) { const near = U.dist(cp.x, cp.y, Player.x, Player.y) < 4.5, op = near ? 0.18 : 1; for (const m of [cp.roof, cp.trim]) { m.material.opacity = U.lerp(m.material.opacity, op, 0.15); m.material.depthWrite = !near; for (const c of m.children) c.visible = !near; } }
    const time = Game.time, inside = !!Interior.active;
    for (const m of this.list) {
      const d = U.dist(m.t.x, m.t.y, Player.x, Player.y);
      m.root.visible = !inside && d < 70;
      if (!m.root.visible) continue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + m.t.x);
      const here = d < 1.2; // standing in the circle
      m.ring.material.opacity = here ? 1 : 0.55 + pulse * 0.4;
      m.ring.scale.setScalar(1 + pulse * 0.08 + (here ? 0.12 : 0));
      m.beam.material.opacity = here ? 0.22 : 0.08 + pulse * 0.06;
      m.sprite.position.y = 2.7 + Math.sin(time * 2 + m.t.y) * 0.08;
      // At the door the E prompt takes over; far signs shrink so the street isn't cluttered.
      m.sprite.visible = d > 2.6;
      const s = U.clamp(1.1 - d / 120, 0.7, 1);
      m.sprite.scale.set(2.6 * s, 0.98 * s, 1);
    }
  },
};
