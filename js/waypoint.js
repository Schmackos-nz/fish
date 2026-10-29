// Waypoints: click anywhere on the big map to set one (click it again to clear). A beam marks the spot,
// an arrow by your feet points the way with the distance, and the minimap traces a walking route.
'use strict';

const Waypoint = {
  at: null, route: null, routeT: 0, routeFrom: null, beam: null,

  init() {
    if (!this.beam) {
      const g = new THREE.Group();
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xB85AE2, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
      col.position.y = 20; g.add(col);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xD88AFF, transparent: true, opacity: 0.8, depthWrite: false }));
      ring.position.y = 0.06; g.add(ring);
      this.beam = g; this.beamRing = ring;
    }
    Scene3D.scene.add(this.beam);
    this.at = Game.waypoint || null; this.route = null;
  },

  set(x, y) {
    if (this.at && U.dist(this.at.x, this.at.y, x, y) < 6) { this.clear(); Hud.toast('Waypoint cleared.', UI.muted, 1.2); return; }
    this.at = Game.waypoint = { x, y }; this.route = null; this.routeT = 0;
    Sfx.tone(880, 0.08, 0.15, 'triangle', 1320);
    Hud.toast('Waypoint set — follow the purple arrow.', '#D88AFF', 1.8);
  },
  clear() { this.at = Game.waypoint = null; this.route = null; },

  update(dt) {
    if (!this.at) return;
    const d = U.dist(Player.x, Player.y, this.at.x, this.at.y);
    if (d < 4) { this.clear(); Sfx.coin(); Hud.toast('You\'ve arrived.', UI.good, 1.6); return; }
    // Refresh the walking route now and then (or once you've wandered off it).
    this.routeT -= dt;
    if (this.routeT <= 0 && !Bikes.riding && (!this.routeFrom || U.dist(Player.x, Player.y, this.routeFrom.x, this.routeFrom.y) > 4 || !this.route)) {
      this.routeT = 2.5; this.routeFrom = { x: Player.x, y: Player.y };
      this.route = d < 260 ? Path.find(Player.x, Player.y, this.at.x, this.at.y, 60000, 60) : null;
    }
  },

  // Which way to go right now: along the route if we have one, else straight there.
  heading() {
    let t = this.at;
    if (this.route && this.route.length && !Bikes.riding) { t = this.route.find((p) => U.dist(p.x, p.y, Player.x, Player.y) > 2.5) || this.at; }
    return Math.atan2(t.y - Player.y, t.x - Player.x);
  },

  render() {
    const on = !!this.at && !Interior.active && Game.mode === 'play';
    this.beam.visible = on;
    if (!on) return;
    this.beam.position.set(this.at.x, Scene3D.groundH(this.at.x, this.at.y), this.at.y);
    const s = 1 + Math.sin(Game.time * 3) * 0.12; this.beamRing.scale.set(s, 1, s);
  },

  // HUD: an arrow orbiting your feet, the distance, and an edge-of-screen marker when the spot is off-screen.
  draw(hud) {
    if (!this.at || Interior.active || Game.mode !== 'play') return;
    const g = hud.g, a = this.heading(), d = U.dist(Player.x, Player.y, this.at.x, this.at.y);
    const [px, py] = Scene3D.project(Player.x, Player.y, Scene3D.standH(Player.x, Player.y) + 0.05);
    const [ax, ay] = Scene3D.project(Player.x + Math.cos(a) * 1.6, Player.y + Math.sin(a) * 1.6, Scene3D.standH(Player.x, Player.y) + 0.05);
    const sa = Math.atan2(ay - py, ax - px);
    g.save(); g.translate(ax, ay); g.rotate(sa);
    g.fillStyle = '#D88AFF'; g.strokeStyle = '#2A1040'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(16, 0); g.lineTo(-8, -11); g.lineTo(-3, 0); g.lineTo(-8, 11); g.closePath(); g.stroke(); g.fill();
    g.restore();
    hud.pill(Math.round(d) + ' m', ax, ay + 24, '#D88AFF', 11);
    // Off-screen marker.
    const [wx, wy, ok] = Scene3D.project(this.at.x, this.at.y, Scene3D.groundH(this.at.x, this.at.y) + 2);
    const W = innerWidth, H = innerHeight, m = 40;
    if (!ok || wx < m || wx > W - m || wy < m || wy > H - m) {
      const cx = W / 2, cy = H / 2, ang = Math.atan2(wy - cy, wx - cx);
      const r = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-3), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-3));
      const ex = cx + Math.cos(ang) * r, ey = cy + Math.sin(ang) * r;
      g.fillStyle = '#D88AFF'; g.beginPath(); g.arc(ex, ey, 9, 0, 7); g.fill();
      g.strokeStyle = '#2A1040'; g.lineWidth = 2; g.stroke();
    }
  },

  // Minimap: the route as dots and the target as a diamond (called inside the minimap's clip).
  drawMini(hud, cx, cy, s, R) {
    if (!this.at) return;
    const g = hud.g;
    if (this.route) {
      g.fillStyle = '#D88AFF';
      let lx = Player.x, ly = Player.y;
      for (const p of this.route) {
        const n = Math.ceil(U.dist(lx, ly, p.x, p.y) / 2);
        for (let i = 1; i <= n; i++) { const x = lx + (p.x - lx) * i / n, y = ly + (p.y - ly) * i / n; const mx = cx + (x - Player.x) * s, my = cy + (y - Player.y) * s; if (U.dist(mx, my, cx, cy) < R) { g.beginPath(); g.arc(mx, my, 1.8, 0, 7); g.fill(); } }
        lx = p.x; ly = p.y;
      }
    }
    let mx = cx + (this.at.x - Player.x) * s, my = cy + (this.at.y - Player.y) * s;
    const dd = U.dist(mx, my, cx, cy);
    if (dd > R - 6) { mx = cx + (mx - cx) / dd * (R - 6); my = cy + (my - cy) / dd * (R - 6); }
    g.fillStyle = '#D88AFF'; g.strokeStyle = '#2A1040'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(mx, my - 6); g.lineTo(mx + 5, my); g.lineTo(mx, my + 6); g.lineTo(mx - 5, my); g.closePath(); g.fill(); g.stroke();
  },
};
