// Walk-in interiors. Each room is built off-map (x < -50) and the angler is moved into it.
'use strict';

const CLERK_PAL = { hat: '#B83A32', hatStyle: 'cap', shirt: '#E8E2D0', vest: '#B83A32', pants: '#3A3A4A', skin: '#C08A60', apron: true, hair: '#2A1A10' };

const Interior = {
  active: null, rooms: new Map(), group: null, lamp: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.rooms.clear();
    this.active = null;
    if (!this.lamp) { this.lamp = new THREE.PointLight(0xffd9a0, 0, 14, 1.4); Scene3D.scene.add(this.lamp); }
    // Vendors stand inside their shops, so their positions are interior coordinates.
    for (const b of World.buildings) {
      if (b.type === 'shop') World.shopkeeper = this.layout(b).vendor;
      if (b.type === 'ranger') World.ranger = this.layout(b).vendor;
      if (b.type === 'store') World.clerk = this.layout(b).vendor;
      if (b.type === 'bikes') World.revs = this.layout(b).vendor;
    }
    this.clerk = standee(CLERK_PAL, World.clerk.x, World.clerk.y);
    this.revs = standee(REVS_PAL, World.revs.x, World.revs.y);
    this.group.add(this.clerk, this.revs);
  },

  // Room geometry for a building: size, furniture rectangles and where people stand.
  layout(b) {
    const idx = World.buildings.indexOf(b);
    const x0 = -200 - idx * 16, y0 = -200;
    const R = (x, y, w, h, kind, color, label) => ({ x: x0 + x, y: y0 + y, w, h, kind, color, label });
    let w, h, furn, vendor = null;
    if (b.type === 'shop') {
      w = 9; h = 6;
      furn = [R(0.4, 0.1, 8.2, 0.6, 'shelf', 0x6a4526), R(1, 2.2, 5.5, 0.8, 'counter', 0x8a5a34)];
      vendor = { x: x0 + 3.5, y: y0 + 1.5 };
    } else if (b.type === 'ranger') {
      w = 8; h = 6;
      furn = [R(0.4, 0.1, 3, 0.5, 'board', 0x3f6a3a), R(1.5, 2.2, 4, 0.8, 'counter', 0x7a6a48), R(6.2, 0.2, 1.4, 1.2, 'shelf', 0x5a4a32)];
      vendor = { x: x0 + 3.5, y: y0 + 1.5 };
    } else if (b.type === 'bikes') {
      w = 9; h = 6;
      furn = [R(0.6, 1.6, 3, 0.8, 'counter', 0x2a2a2e), R(4.6, 0.4, 1.8, 1, 'bikepad', 0x555a60), R(4.6, 2.8, 1.8, 1, 'bikepad', 0x555a60), R(7.2, 0.2, 1.4, 0.6, 'shelf', 0x3a3a40)];
      vendor = { x: x0 + 2, y: y0 + 0.9 };
    } else if (b.type === 'store') {
      w = 9; h = 6;
      furn = [R(0.8, 3.2, 3, 0.7, 'grocer', 0xb8b0a0), R(5.2, 3.2, 3, 0.7, 'grocer', 0xb8b0a0), R(0.6, 1.6, 3, 0.8, 'counter', 0xb83a32), R(7.2, 0.2, 1.4, 1, 'fridge', 0xdfe6ea)];
      vendor = { x: x0 + 2, y: y0 + 0.9 };
    } else {
      w = 7; h = 5;
      furn = [R(0.4, 0.3, 2, 1.6, 'bed', 0x8a4a3a, 'Sleep'), R(5.2, 0.2, 1.4, 0.8, 'stove', 0x2a2a2e, 'Cook'),
        R(5.3, 2.9, 1.2, 0.8, 'chest', 0x7a4a24, 'Storage'), R(2.9, 2, 1.3, 1, 'table', 0x9a6a3a)];
    }
    return { b, x0, y0, w, h, furn, vendor, exit: { x: x0 + w / 2, y: y0 + h }, spawn: { x: x0 + w / 2, y: y0 + h - 0.8 } };
  },

  room(b) {
    if (!this.rooms.has(b)) { const r = this.layout(b); r.mesh = this.build(r); this.rooms.set(b, r); }
    return this.rooms.get(b);
  },

  // Floorboards, three walls (front is cut away so the camera can see in), furniture blocks.
  build(r) {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const cx = c.getContext('2d');
    cx.fillStyle = '#8a6338'; cx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) { cx.fillStyle = y % 32 ? '#7d5830' : '#93693c'; cx.fillRect(0, y, 128, 15); cx.fillStyle = '#5e4224'; cx.fillRect(0, y + 15, 128, 1); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(r.w / 2, r.h / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), new THREE.MeshLambertMaterial({ map: tex }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(r.x0 + r.w / 2, 0, r.y0 + r.h / 2);
    g.add(floor);
    const wallMat = new THREE.MeshLambertMaterial({ color: r.b.type === 'store' ? 0xe8e0cc : r.b.type === 'house' ? 0xd8c8a8 : 0xa88a62 });
    const wall = (x, y, w, d, hgt) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wallMat); m.position.set(x, hgt / 2, y); g.add(m); };
    wall(r.x0 + r.w / 2, r.y0 - 0.1, r.w + 0.4, 0.2, 2.2);
    wall(r.x0 - 0.1, r.y0 + r.h / 2, 0.2, r.h, 1.4);
    wall(r.x0 + r.w + 0.1, r.y0 + r.h / 2, 0.2, r.h, 1.4);
    // Low front kerb with a gap for the door.
    const gap = 1.4;
    wall(r.x0 + (r.w / 2 - gap / 2) / 2, r.y0 + r.h + 0.05, r.w / 2 - gap / 2, 0.1, 0.25);
    wall(r.x0 + r.w - (r.w / 2 - gap / 2) / 2, r.y0 + r.h + 0.05, r.w / 2 - gap / 2, 0.1, 0.25);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshLambertMaterial({ color: 0x8a2a22 }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(r.exit.x, 0.01, r.exit.y - 0.4); g.add(mat);
    // Window on the back wall.
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ color: 0x9fd4ee }));
    win.position.set(r.x0 + r.w - 2, 1.4, r.y0 + 0.01); g.add(win);
    for (const f of r.furn) {
      const hgt = { shelf: 1.7, board: 1.2, counter: 0.9, grocer: 1.3, fridge: 1.8, bed: 0.5, stove: 0.9, chest: 0.6, table: 0.75, bikepad: 0.15 }[f.kind];
      const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, hgt, f.h), new THREE.MeshLambertMaterial({ color: f.color }));
      m.position.set(f.x + f.w / 2, hgt / 2, f.y + f.h / 2); g.add(m);
      if (f.kind === 'shelf' || f.kind === 'grocer') {
        // Rows of colourful stock.
        const cols = [0xe8b33a, 0xd23a3a, 0x3a8ad2, 0x6fbf4a, 0xf2f0e8, 0xc95f6f];
        for (let i = 0; i < Math.floor(f.w / 0.35); i++) for (const yy of [0.5, 1.0]) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.2), new THREE.MeshLambertMaterial({ color: cols[(i + yy * 4) % cols.length] }));
          box.position.set(f.x + 0.2 + i * 0.35, yy * hgt * 0.75, f.y + f.h + 0.02); g.add(box);
        }
      }
      if (f.kind === 'bikepad') { const bk = Bikes.model(BIKES[(f.y > r.y0 + 2 ? 2 : 1)].color); bk.position.set(f.x + f.w / 2, 0.15, f.y + f.h / 2); bk.rotation.y = 0.5; g.add(bk); }
      if (f.kind === 'bed') { const p = new THREE.Mesh(new THREE.BoxGeometry(f.w * 0.8, 0.15, 0.4), new THREE.MeshLambertMaterial({ color: 0xf4f0e6 })); p.position.set(f.x + f.w / 2, 0.58, f.y + 0.3); g.add(p); }
      if (f.kind === 'stove') for (const ox of [0.35, 1.05]) { const bn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), new THREE.MeshBasicMaterial({ color: 0x8a2a1a })); bn.position.set(f.x + ox, 0.92, f.y + 0.4); g.add(bn); }
      if (f.kind === 'board') { const map = new THREE.Mesh(new THREE.PlaneGeometry(f.w * 0.9, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(Art.minimap) })); map.position.set(f.x + f.w / 2, 1.4, r.y0 + 0.02); g.add(map); }
    }
    Toon.apply(g);
    g.visible = false;
    this.group.add(g);
    return g;
  },

  enter(b) {
    const r = this.room(b);
    this.active = r;
    this.returnTo = World.doorOf(b);
    r.mesh.visible = true;
    Player.place(r.spawn.x, r.spawn.y);
    Player.face = -Math.PI / 2;
    Scene3D.target.set(Player.x, 0, Player.y);
    Sfx.tone(520, 0.12, 0.15, 'triangle'); // door bell
    Hud.toast(b.type === 'house' ? 'Home sweet home.' : 'Welcome to ' + b.name + '.', UI.ink, 1.4);
  },

  exit() {
    const r = this.active;
    if (!r) return;
    r.mesh.visible = false;
    this.active = null;
    const b = r.b, out = Math.atan2(this.returnTo.y - (b.y + b.h / 2), this.returnTo.x - (b.x + b.w / 2));
    Player.place(this.returnTo.x + Math.cos(out) * 0.3, this.returnTo.y + Math.sin(out) * 0.3);
    Player.face = out;
    Scene3D.target.set(Player.x, Scene3D.standH(Player.x, Player.y), Player.y);
    Sfx.tone(420, 0.1, 0.12, 'triangle');
  },

  blocked(x, y) {
    const r = this.active;
    if (!r) return true;
    const inDoor = Math.abs(x - r.exit.x) < 0.8;
    if (x < r.x0 + 0.2 || x > r.x0 + r.w - 0.2 || y < r.y0 + 0.25 || y > r.y0 + r.h + (inDoor ? 0.6 : -0.05)) return true;
    for (const f of r.furn) if (x > f.x - 0.05 && x < f.x + f.w + 0.05 && y > f.y - 0.05 && y < f.y + f.h + 0.05) return true;
    return false;
  },

  update() {
    const r = this.active;
    if (!r) return;
    // Walking out through the door gap takes you back outside.
    if (Player.y > r.y0 + r.h + 0.15 && Math.abs(Player.x - r.exit.x) < 0.8) this.exit();
  },

  // The interactable furniture nearest the angler.
  near(maxD = 1.6) {
    const r = this.active;
    if (!r) return null;
    let best = null, bd = maxD;
    for (const f of r.furn) {
      if (!f.label) continue;
      const fx = U.clamp(Player.x, f.x, f.x + f.w), fy = U.clamp(Player.y, f.y, f.y + f.h);
      const d = U.dist(Player.x, Player.y, fx, fy);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  },
};
