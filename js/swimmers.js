// Swimmers doing laps in the lakes: heads, goggles and splashing arms. Cast near them at your peril.
'use strict';

const CAP_COLORS = ['#E2584D', '#3A8AD2', '#F2D01A', '#7DC383', '#E85AA8', '#FFFFFF'];
const SWIM_SAY = {
  chat: ['Water\'s lovely!', 'Come on in!', 'Something just touched my leg!!', 'Hope there\'s no pike in here…', 'Ten more laps!'],
  hooked: ['HEY! Watch the hooks!', 'You nearly got my ear!', 'I\'M NOT BAIT!', 'Oi! People swimming here!'],
};

const Swimmers = {
  list: [], group: null, frames: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    if (!this.frames) this.frames = CAP_COLORS.map((cap, i) => [0, 1].map((f) => this.paint(cap, SKINS[i % SKINS.length], f)));
    const rng = U.mulberry32(World.seed + 777);
    const lakes = World.lakes.filter((l) => l.kind === K.LAKE);
    this.list = [];
    for (let i = 0; i < 7; i++) {
      const lake = i < 3 ? World.lakes[0] : lakes[(rng() * lakes.length) | 0];
      for (let t = 0; t < 40; t++) {
        const a = rng() * 6.28, r = rng() * lake.r * 0.75;
        const x = lake.x + Math.cos(a) * r, y = lake.y + Math.sin(a) * r;
        if (World.depthAt(x, y) < 1.2) continue;
        const look = (i * 2) % CAP_COLORS.length;
        const nice0 = Swimmers.nice();
        const s = { state: nice0 ? 'swim' : 'gone', x, y, lake, look, face: 1, tx: x, ty: y, speed: 0.7 + rng() * 0.4, flee: 0, stroke: rng() * 6, talkT: 8 + rng() * 25, bubble: null, bubbleT: 0 };
        const skin = SKINS[i % SKINS.length];
        s.mesh = Models.person({ hat: CAP_COLORS[look], hatStyle: 'swimcap', shirt: skin, pants: '#2A4A8A', skin, mitt: skin });
        s.heading = 0;
        this.group.add(s.mesh);
        this.list.push(s);
        break;
      }
    }
  },

  // Head and shoulders above the water: swim cap, goggles, one arm mid-stroke.
  paint(cap, skin, f) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 48;
    const g = c.getContext('2d');
    const ink = 'rgba(20,14,10,0.85)';
    g.lineWidth = 2; g.strokeStyle = ink; g.lineJoin = 'round'; g.lineCap = 'round';
    const blob = (fill, path) => { g.fillStyle = fill; g.beginPath(); path(); g.fill(); g.stroke(); };
    // Arm over the top (alternates sides between frames).
    const ax = f ? 50 : 14;
    g.strokeStyle = ink; g.lineWidth = 9; g.beginPath(); g.moveTo(f ? 40 : 24, 40); g.quadraticCurveTo(ax, 18, f ? 58 : 6, 26); g.stroke();
    g.strokeStyle = skin; g.lineWidth = 6; g.beginPath(); g.moveTo(f ? 40 : 24, 40); g.quadraticCurveTo(ax, 18, f ? 58 : 6, 26); g.stroke();
    g.lineWidth = 2; g.strokeStyle = ink;
    blob(skin, () => g.ellipse(32, 30, 17, 15, 0, 0, Math.PI * 2));
    blob(cap, () => { g.moveTo(15, 28); g.bezierCurveTo(16, 8, 48, 8, 49, 28); g.quadraticCurveTo(32, 22, 15, 28); });
    // Goggles
    blob('#2A3A4A', () => g.ellipse(26, 31, 5.5, 4.5, 0, 0, Math.PI * 2));
    blob('#2A3A4A', () => g.ellipse(38, 31, 5.5, 4.5, 0, 0, Math.PI * 2));
    g.fillStyle = 'rgba(160,220,240,0.7)'; g.beginPath(); g.arc(25, 30, 2, 0, 7); g.arc(37, 30, 2, 0, 7); g.fill();
    g.beginPath(); g.moveTo(31, 31); g.lineTo(33, 31); g.stroke();
    // Waterline: the bottom is hidden by the water itself.
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  },

  nice() { const e = Game.env; return e.weather.id === 'clear' && e.hour >= 8 && e.hour < 19; },

  near(x, y, r) {
    let best = null, bd = r;
    for (const s of this.list) { if (s.state === 'gone') continue; const d = U.dist(x, y, s.x, s.y); if (d < bd) { bd = d; best = s; } }
    return best;
  },

  say(s, list, time = 3) { s.bubble = U.pick(Math.random, list); s.bubbleT = time; },

  onLureLanded(x, y) {
    const s = this.near(x, y, 1.6);
    if (!s) return;
    this.say(s, SWIM_SAY.hooked, 2.6);
    s.flee = 4;
    Hud.ripple(s.x, s.y, 1);
  },

  update(dt) {
    const nice = this.nice(), rain = Game.env.weather.id === 'rain';
    for (const s of this.list) {
      s.bubbleT = Math.max(0, s.bubbleT - dt);
      s.flee = Math.max(0, s.flee - dt);
      // Only out when it's sunny; otherwise they swim for the nearest bank and call it a day.
      if (s.state === 'gone') {
        s.hidden = true;
        if (nice && Math.random() < dt * 0.05) {
          for (let t = 0; t < 20; t++) {
            const a = Math.random() * 6.28, r = Math.random() * s.lake.r * 0.7;
            const x = s.lake.x + Math.cos(a) * r, y = s.lake.y + Math.sin(a) * r;
            if (World.depthAt(x, y) > 1.2) { s.x = s.tx = x; s.y = s.ty = y; s.state = 'swim'; break; }
          }
        }
        continue;
      }
      s.hidden = false;
      if (!nice && s.state !== 'leaving') {
        s.state = 'leaving'; s.shore = World.nearestShore(s.x, s.y);
        if (U.dist(s.x, s.y, Player.x, Player.y) < 30) this.say(s, rain ? ['Ugh, RAIN!', 'Everybody out!', 'I\'m getting wet! …wait.'] : ['Getting chilly — I\'m out.', 'That\'s enough for today.'], 2.6);
      }
      if (s.state === 'leaving') {
        if (nice) s.state = 'swim';
        else { s.tx = s.shore.x; s.ty = s.shore.y; if (U.dist(s.x, s.y, s.shore.x, s.shore.y) < 0.9) { s.state = 'gone'; continue; } }
      }
      // Pick a new spot in the same lake every so often.
      if (s.state === 'swim' && (U.dist(s.x, s.y, s.tx, s.ty) < 0.6 || Math.random() < dt * 0.04)) {
        for (let t = 0; t < 10; t++) {
          const a = Math.random() * 6.28, r = Math.random() * s.lake.r * 0.8;
          const tx = s.lake.x + Math.cos(a) * r, ty = s.lake.y + Math.sin(a) * r;
          if (World.depthAt(tx, ty) > 1) { s.tx = tx; s.ty = ty; break; }
        }
      }
      let a = Math.atan2(s.ty - s.y, s.tx - s.x);
      s.heading = a;
      if (s.flee > 0) { a = Math.atan2(s.y - Player.y, s.x - Player.x); s.heading = a; }
      const sp = s.speed * (s.flee > 0 ? 2.2 : s.state === 'leaving' ? 1.8 : 1) * dt;
      const nx = s.x + Math.cos(a) * sp, ny = s.y + Math.sin(a) * sp;
      if (World.depthAt(nx, ny) > (s.state === 'leaving' ? 0.05 : 0.8)) { s.x = nx; s.y = ny; } else if (s.state === 'leaving') s.state = 'gone'; else { s.tx = s.x; s.ty = s.y; }
      if (Math.abs(Math.cos(a)) > 0.2) s.face = Math.cos(a) > 0 ? 1 : -1;
      s.stroke += dt * (s.flee > 0 ? 7 : 3.5);
      if (Math.random() < dt * 0.8 && U.dist(s.x, s.y, Player.x, Player.y) < 40) Hud.ripple(s.x - Math.cos(a) * 0.4, s.y - Math.sin(a) * 0.4, 0.5);
      if (Math.random() < dt) Fish.spookNear(s.x, s.y, 2.5);
      s.talkT -= dt;
      if (s.talkT <= 0) { s.talkT = 20 + Math.random() * 30; if (U.dist(s.x, s.y, Player.x, Player.y) < 18) this.say(s, SWIM_SAY.chat); }
    }
  },

  render() {
    for (const s of this.list) {
      s.mesh.visible = !s.hidden && !Interior.active && U.dist(s.x, s.y, Player.x, Player.y) < 55;
      if (!s.mesh.visible) continue;
      // Front crawl: lying forward in the water, head up, arms windmilling.
      const rig = s.mesh.userData.rig;
      Models.pose(rig, { t: Game.time });
      rig.yaw.rotation.y = -s.heading;
      rig.upper.rotation.z = -1.15;
      rig.armR.rotation.set(0, 0, s.stroke * 2.4); rig.armL.rotation.set(0, 0, s.stroke * 2.4 + Math.PI);
      rig.legL.rotation.z = Math.sin(s.stroke * 9) * 0.3; rig.legR.rotation.z = -rig.legL.rotation.z;
      s.mesh.position.set(s.x, -0.62 + Math.sin(s.stroke * 1.3) * 0.04, s.y);
    }
  },

  drawBubbles(hud) {
    for (const s of this.list) {
      if (s.hidden || s.bubbleT <= 0 || U.dist(s.x, s.y, Player.x, Player.y) > 30) continue;
      const [sx, sy, ok] = Scene3D.project(s.x, s.y, 0.9);
      if (ok) hud.pill(s.bubble, sx, sy, UI.ink, 12);
    }
  },
};
