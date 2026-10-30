// The intro cinematic: a GTA-style flythrough of the valley cut to the theme's eight bars, with letterbox bars
// and big credit captions, ending in a flash on the main menu. Click or press anything to skip.
'use strict';

const Cine = {
  active: false, t: 0, shots: null, shot: -1,

  BAR: 4 * 60 / 132, // one bar of the theme

  build() {
    const L = World.lakes[0], tn = World.town || { x: L.x, y: L.y + L.r }, d = World.dockEnd || tn;
    const tim = Tim.spot();
    const w = Wardens.list.find((x) => x.state !== 'dead') || null, pg = typeof Prison !== 'undefined' ? Prison.gate() : tn;
    const B = this.BAR, s = [];
    // [from, to, dist from→to, pitch, caption, sub, bars]
    s.push({ a: { x: L.x - L.r * 0.5, y: L.y + L.r * 0.2 }, b: { x: L.x + L.r * 0.4, y: L.y }, d: [46, 38], p: 1.0, cap: 'Schmackos', sub: 'presents', bars: 2 });
    s.push({ a: { x: tn.x, y: tn.y + 14 }, b: { x: tn.x, y: tn.y + 2 }, d: [24, 16], p: 0.72, cap: 'a valley', sub: 'with a fishing problem', bars: 1 });
    s.push({ a: { x: tim.x - 1.5, y: tim.y }, b: { x: tim.x + 0.6, y: tim.y }, d: [8, 6], p: 0.62, cap: Tim.guide().name.toUpperCase(), sub: 'The Guide', card: true, bars: 1 });
    s.push({ a: { x: d.x - 4, y: d.y + 2 }, b: { x: d.x + 3, y: d.y }, d: [14, 10], p: 0.55, cap: 'BOATS', sub: 'allegedly yours', card: true, bars: 1 });
    if (w) s.push({ a: { x: w.x + 1.2, y: w.y }, b: { x: w.x - 0.4, y: w.y }, d: [8, 6], p: 0.62, cap: w.name.toUpperCase(), sub: 'has some questions about your permit', card: true, bars: 1 });
    s.push({ a: { x: pg.x - 5, y: pg.y + 2 }, b: { x: pg.x + 2, y: pg.y - 2 }, d: [18, 13], p: 0.8, cap: 'THE VALLEY PRISON', sub: 'visiting hours are over', card: true, bars: 1 });
    let t = 0; for (const x of s) { x.t0 = t; t += x.bars * B; x.t1 = t; }
    this.length = t;
    return s;
  },

  start() {
    if (Game.mode !== 'title') return;
    Sfx.init(); Settings.apply();
    this.shots = this.build(); this.t = -0.15; this.shot = -1; this.active = true;
    // Tim only takes his spot once play starts; stand him there (waving) for his close-up.
    if (Tim.mesh) {
      const p = Tim.spot(); Tim.mesh.position.set(p.x, Scene3D.standH(p.x, p.y), p.y); Tim.mesh.visible = true;
      if (Tim.group) Tim.group.visible = true;
      Tim.mesh.userData.rig.yaw.rotation.y = -Math.PI / 2;
      Models.pose(Tim.mesh.userData.rig, { pose: 'brag', t: 0 });
    }
    if (Settings.music) { Music.stop(0.05); setTimeout(() => Music.play(), 60); }
    const el = document.getElementById('cine');
    el.classList.remove('hidden'); el.querySelector('.cap').className = 'cap';
    document.getElementById('title').classList.add('cine-on');
    // Anything after this click skips.
    setTimeout(() => { this.skipper = (e) => { if (this.active) { e.preventDefault(); e.stopPropagation(); this.end(); } }; addEventListener('pointerdown', this.skipper, true); addEventListener('keydown', this.skipper, true); }, 250);
  },

  end() {
    if (!this.active) return;
    this.active = false;
    if (this.skipper) { removeEventListener('pointerdown', this.skipper, true); removeEventListener('keydown', this.skipper, true); this.skipper = null; }
    this.flash();
    document.getElementById('cine').classList.add('hidden');
    document.getElementById('title').classList.remove('cine-on');
  },

  update(dt) {
    this.t += dt;
    const S = this.shots, t = Math.max(0, this.t);
    let i = S.findIndex((s) => t < s.t1); if (i < 0) return this.end();
    const s = S[i], u = U.clamp((t - s.t0) / (s.t1 - s.t0), 0, 1), e = u * u * (3 - 2 * u);
    if (i !== this.shot) {
      this.shot = i;
      const cap = document.querySelector('#cine .cap');
      cap.className = 'cap'; void cap.offsetWidth;
      cap.querySelector('b').textContent = s.cap; cap.querySelector('i').textContent = s.sub; cap.className = 'cap show' + (s.card ? ' card' : '') + (i % 2 ? ' right' : '');
    }
    // Place the camera directly: a slow dolly from a to b, pulling in or out.
    const x = U.lerp(s.a.x, s.b.x, e), y = U.lerp(s.a.y, s.b.y, e), dd = U.lerp(s.d[0], s.d[1], e), C = Scene3D;
    const gy = C.standH(x, y);
    C.target.set(x, gy + (s.p < 0.7 ? 0.6 : 0), y); C.camDist = dd;
    C.camera.position.set(x, C.target.y + Math.sin(s.p) * dd, y + Math.cos(s.p) * dd);
    C.camera.lookAt(C.target);
  },

  flash() {
    const f = document.getElementById('cineFlash');
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    Sfx.burst && Sfx.burst(0.35, 900, 0.5, 'lowpass', 0.6, 120);
  },
};
