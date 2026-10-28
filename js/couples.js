// Every so often two anglers slip off into a bush together. The game is far too polite to show it.
'use strict';

const BUSH_SAY = {
  go: ['Fancy a… walk?', 'Back in a bit!', 'Watch my rod, would you?'],
  busy: ['OCCUPIED!', 'Do you MIND?!', 'Nothing to see here!', 'Go away!'],
  out: ['We were… looking for worms.', 'Lovely bush, that.', 'What? Nothing happened.', '*adjusts hat*'],
};

const Couples = {
  group: null, active: null, cool: 60, bushMesh: null, hearts: [], mosaicT: 0, mosaic: [],

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.active = null; this.cool = 60 + Math.random() * 60;
    this.bushMesh = new THREE.Group();
    for (const [r, x, y, z, c] of [[0.42, 0, 0.33, 0, 0x46993F], [0.3, 0.33, 0.25, 0.12, 0x52A548], [0.3, -0.32, 0.25, -0.06, 0x40903A]]) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshLambertMaterial({ color: c }));
      b.position.set(x, y, z); this.bushMesh.add(b);
    }
    Toon.apply(this.bushMesh);
    this.bushMesh.visible = false;
    this.group.add(this.bushMesh);
    const hc = document.createElement('canvas'); hc.width = 32; hc.height = 32;
    const hg = hc.getContext('2d');
    hg.fillStyle = '#F25A8A'; hg.beginPath(); hg.moveTo(16, 28); hg.bezierCurveTo(2, 18, 2, 6, 10, 6); hg.bezierCurveTo(14, 6, 16, 10, 16, 12);
    hg.bezierCurveTo(16, 10, 18, 6, 22, 6); hg.bezierCurveTo(30, 6, 30, 18, 16, 28); hg.fill();
    const tex = new THREE.CanvasTexture(hc);
    this.hearts = Array.from({ length: 5 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.scale.set(0.35, 0.35, 1); s.visible = false; s.userData.t = Math.random();
      this.group.add(s);
      return s;
    });
  },

  // A bush tile with open ground next to it, near both lovebirds.
  findBush(x, y) {
    for (let r = 2; r < 25; r++) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, bx = Math.floor(x + Math.cos(a) * r), by = Math.floor(y + Math.sin(a) * r);
      if (World.objAt(bx, by) !== O.BUSH || World.blocked(bx + 0.5, by + 1.4)) continue;
      if ((Game.plants || []).some((p) => U.dist(p.x, p.y, bx + 0.5, by + 0.9) < 1.5)) continue;
      return { x: bx + 0.5, y: by + 0.6, door: { x: bx + 0.5, y: by + 1.4 } };
    }
    return null;
  },

  update(dt) {
    const e = Game.env;
    if (!this.active) {
      this.cool -= dt;
      if (this.cool > 0 || e.hour < 9 || e.hour > 20) return;
      this.cool = 90 + Math.random() * 120;
      const free = Npcs.list.filter((n) => n.state === 'wait' || n.state === 'cast');
      for (const a of free) {
        const b = free.find((o) => o !== a && U.dist(o.x, o.y, a.x, a.y) < 40);
        if (!b) continue;
        const bush = this.findBush((a.x + b.x) / 2, (a.y + b.y) / 2);
        if (!bush) continue;
        this.active = { a, b, bush, t: 0, inside: 0 };
        for (const n of [a, b]) { n.goingBush = true; n.lure = null; n.fish = null; n.spot = { x: bush.door.x, y: bush.door.y, ang: -Math.PI / 2 }; n.state = 'walk'; n.walkT = 0; }
        Npcs.say(a, U.pick(Math.random, BUSH_SAY.go), 2.6);
        return;
      }
      return;
    }
    const c = this.active;
    c.t += dt;
    const both = c.a.state === 'bush' && c.b.state === 'bush';
    // If either wanders off (night, a fight…) the date's off.
    if (!both && c.t > 45) return this.finish(false);
    if ((c.a.state !== 'walk' && c.a.state !== 'bush') || (c.b.state !== 'walk' && c.b.state !== 'bush')) return this.finish(false);
    if (both) {
      if (!c.inside) { c.inside = c.t; if (U.dist(c.bush.x, c.bush.y, Player.x, Player.y) < 45) Hud.toast('The bushes over there are… rustling.', UI.accent, 2.6); }
      if (U.dist(c.bush.x, c.bush.y, Player.x, Player.y) < 3 && Math.random() < dt * 0.7) { c.busy = U.pick(Math.random, BUSH_SAY.busy); c.busyT = 2; }
      if (c.t - c.inside > 25) this.finish(true);
    }
    if (c.busyT) c.busyT = Math.max(0, c.busyT - dt);
  },

  finish(happened) {
    const c = this.active;
    this.active = null;
    for (const n of [c.a, c.b]) {
      n.goingBush = false;
      if (n.state === 'bush' || n.state === 'walk') { n.x = c.bush.door.x + (n === c.a ? -0.4 : 0.4); n.y = c.bush.door.y; n.state = 'cast'; n.casts = 0; n.t = 1 + Math.random(); }
    }
    if (happened) { Npcs.say(c.a, U.pick(Math.random, BUSH_SAY.out), 3.5); Npcs.say(c.b, '*giggles*', 3); }
  },

  render(dt) {
    const c = this.active, showing = c && c.a.state === 'bush' && c.b.state === 'bush' && !Interior.active;
    this.bushMesh.visible = !!showing;
    for (const h of this.hearts) h.visible = !!showing;
    if (!showing) return;
    const b = c.bush, base = Scene3D.groundH(b.x, b.y);
    // A very busy bush.
    this.bushMesh.position.set(b.x + Math.sin(Game.time * 18) * 0.06, base, b.y + 0.05);
    this.bushMesh.rotation.z = Math.sin(Game.time * 14) * 0.08;
    for (const h of this.hearts) {
      h.userData.t = (h.userData.t + dt * 0.35) % 1;
      const t = h.userData.t;
      h.position.set(b.x + Math.sin(t * 9 + h.id) * 0.4, base + 0.6 + t * 1.6, b.y);
      h.material.opacity = Math.sin(t * Math.PI);
    }
  },

  // The censor: a jittering mosaic over the bush, with a label.
  drawCensor(hud) {
    const c = this.active;
    if (!c || c.a.state !== 'bush' || c.b.state !== 'bush' || Interior.active) return;
    const [sx, sy, ok] = Scene3D.project(c.bush.x, c.bush.y, Scene3D.groundH(c.bush.x, c.bush.y) + 0.45);
    if (!ok) return;
    const g = hud.g, cell = 9, cols = 8, rows = 6;
    if (Game.time - this.mosaicT > 0.15) {
      this.mosaicT = Game.time;
      const pal = ['#4A8A3C', '#3F7D3A', '#58984A', '#E8B88A', '#D9A07A', '#2F6230', '#C94A4A', '#6A9A4A'];
      this.mosaic = Array.from({ length: cols * rows }, () => pal[(Math.random() * pal.length) | 0]);
    }
    const x0 = sx - cols * cell / 2, y0 = sy - rows * cell / 2;
    this.mosaic.forEach((col, i) => { g.fillStyle = col; g.fillRect(x0 + (i % cols) * cell, y0 + Math.floor(i / cols) * cell, cell, cell); });
    g.fillStyle = '#111'; g.fillRect(x0 - 4, y0 + rows * cell / 2 - 9, cols * cell + 8, 18);
    hud.text('CENSORED', sx, y0 + rows * cell / 2 + 4, '#FFFFFF', 11, 'center', 800);
    if (c.busyT > 0) hud.pill(c.busy, sx, y0 - 16, UI.bad, 12);
  },
};
