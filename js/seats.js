// Somewhere to sit: armchairs and sofas indoors, benches by the water outside. Sitting rests you
// (and you can still fish from a bench). Any movement key stands you up.
'use strict';

const Seats = {
  sitting: null, group: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    this.sitting = null;
    const P = (geo, c, o = 0.04) => Models.part(geo, c, o);
    for (const b of World.benches || []) {
      const g = new THREE.Group();
      const seat = P(new THREE.BoxGeometry(1.4, 0.07, 0.4), '#9A6A3A'); seat.position.y = 0.42; g.add(seat);
      const back = P(new THREE.BoxGeometry(1.4, 0.3, 0.06), '#8A5A30'); back.position.set(0, 0.72, -0.2); back.rotation.x = -0.15; g.add(back);
      for (const x of [-0.6, 0.6]) for (const z of [-0.15, 0.15]) { const l = P(new THREE.BoxGeometry(0.07, 0.42, 0.07), '#3A3A3E'); l.position.set(x, 0.21, z); g.add(l); }
      for (const x of [-0.66, 0.66]) { const a = P(new THREE.BoxGeometry(0.06, 0.06, 0.42), '#3A3A3E'); a.position.set(x, 0.6, 0); g.add(a); }
      // Faces the water: the seat's front (+z) points along b.face.
      g.rotation.y = -b.face + Math.PI / 2;
      g.position.set(b.x, Scene3D.groundH(b.x, b.y), b.y);
      this.group.add(g);
    }
  },

  // Sit at (x, y) facing `face`, seat height h above the floor.
  sit(x, y, face, h, what) {
    if (Bikes.riding) return;
    Player.place(x, y); Player.face = face; Player.crouch = false;
    this.sitting = { x, y, face, h };
    Hud.toast('You sit ' + what + '. Ahh. (Move to get up)', UI.muted, 1.8);
  },

  // Called first thing in Player.update. Returns true while you're sat down.
  update(dt) {
    const s = this.sitting; if (!s) return false;
    const k = Input.keys;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((c) => k.has(c)) || Input.pressed('Space') || Bikes.riding) {
      this.sitting = null; return false;
    }
    Player.x = s.x; Player.y = s.y; Player.moving = false; Player.running = false;
    if (Fishing.state === 'idle') Player.face = s.face;
    Game.energy = Math.min(100, Game.energy + dt * 4); // a proper sit-down
    return true;
  },

  interactions(add) {
    if (Interior.active || this.sitting) return;
    for (const b of World.benches || []) {
      const d = U.dist(b.x, b.y, Player.x, Player.y);
      if (d < 1.6) add(b.x, b.y, 1.6, 'Sit on the bench', () => this.sit(b.x, b.y, b.face, 0.42, 'on the bench'));
    }
  },
};
