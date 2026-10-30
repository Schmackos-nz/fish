// Extra ways to play, all on the same simulation:
//  · Realism — the clock is the real clock; you tie your own lure on (thread the eye, wrap, tuck, pull tight),
//    open the bail yourself, cast, and fight fish by turning a reel handle on screen.
//  · Dialog — the text edition with buttons: every situation is a dialog box of choices.
//  · Roguelike — a fresh valley every run, a daily cash quota due by 8pm, a perk for every day survived,
//    and one life: get wasted or busted and the run is over. Never touches your main save.
'use strict';

// ======================= REALISM =======================
const Realism = {
  on: false, rigged: false, knot: 1, preBail: false, turning: false, ang: 0, last: 0, spin: 0,

  start() {
    this.on = true; this.rigged = false; this.preBail = false;
    document.body.classList.add('realism');
    document.getElementById('reelW').classList.remove('hidden');
    this.clock(Game.env, true);
    this.wire();
    Hud.toast('Realism: the valley runs on your real clock. Tie a lure on (T), open the bail (B), cast, then crank the reel handle.', UI.accent, 6);
  },
  stop() { this.on = false; document.body.classList.remove('realism'); document.getElementById('reelW').classList.add('hidden'); },

  // The valley's clock is your clock.
  clock(e, first) {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    if (!first && h < e.hour - 12) e.day++;
    e.hour = h;
  },

  // Strength the knot keeps (an untied line has none).
  k() { return this.on ? this.knot : 1; },

  // Called on a press to cast: are you rigged up and is the bail open?
  ready() {
    if (!this.on) return true;
    if (!this.rigged) { Rig.open(); return false; }
    if (!this.preBail) { Hud.toast('The bail\'s shut — flip it open first (click the bail arm on the reel, or B).', UI.bad, 2.4); return false; }
    this.preBail = false;
    return true;
  },

  bail() {
    if (Fishing.state === 'idle') { this.preBail = !this.preBail; Sfx.bail(); Hud.toast(this.preBail ? 'Bail open — finger on the line. Ready to cast.' : 'Bail closed.', UI.muted, 1.5); }
    else Fishing.toggleBail();
  },

  update() {
    const el = document.getElementById('reelW');
    const show = this.on && Game.mode === 'play' && Tools.current === 'rod' && !Interior.active && !Mud.on;
    el.classList.toggle('hidden', !show);
    if (!this.on || !show) return;
    if (Fishing.state === 'idle' && !Rig.isOpen) {
      if (Input.pressed('KeyB')) this.bail();
      if (Input.pressed('KeyT')) Rig.open();
    }
    this.spin *= 0.85;
    this.draw();
  },

  wire() {
    if (this.wired) return;
    this.wired = true;
    const cv = document.getElementById('reelCv');
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 220, y: (e.clientY - r.top) / r.height * 220 }; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const p = pos(e), hx = 110 + Math.cos(this.ang) * 62, hy = 110 + Math.sin(this.ang) * 62;
      if (U.dist(p.x, p.y, 40, 42) < 30) return this.bail();
      if (U.dist(p.x, p.y, hx, hy) < 34 || U.dist(p.x, p.y, 110, 110) > 30) {
        this.turning = true; this.last = Math.atan2(p.y - 110, p.x - 110); cv.setPointerCapture(e.pointerId);
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.turning) return;
      const p = pos(e), a = Math.atan2(p.y - 110, p.x - 110);
      let d = U.angDiff(this.last, a); this.last = a;
      if (d <= 0) return; // anti-reverse: the handle only turns forward
      d = Math.min(d, 1.2);
      this.ang += d; this.spin += d;
      Input.crankAcc += d;
      if (Fishing.state === 'idle' && this.preBail) { this.preBail = false; Sfx.bail(); }
    });
    const up = () => { this.turning = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    document.getElementById('rigBtn').onclick = (e) => { e.stopPropagation(); if (Fishing.state === 'idle') Rig.open(); else Hud.toast('Reel in before you re-tie.', UI.muted, 1.4); };
  },

  draw() {
    const g = document.getElementById('reelCv').getContext('2d');
    g.clearRect(0, 0, 220, 220);
    const bail = Fishing.state === 'idle' ? this.preBail : Fishing.bailOpen;
    const tension = Fishing.state === 'fight' && Fight.tension ? U.clamp(Fight.tension / (Game.gear.line.strength * this.k()), 0, 1) : 0;
    // Body and spool.
    g.save(); g.translate(110, 110);
    g.fillStyle = 'rgba(10,14,20,0.55)'; g.beginPath(); g.arc(0, 0, 100, 0, 7); g.fill();
    g.lineWidth = 4; g.strokeStyle = tension > 0.85 ? '#ff5050' : tension > 0.6 ? '#f2c14e' : 'rgba(255,255,255,0.18)';
    g.beginPath(); g.arc(0, 0, 98, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(tension, 0.001)); g.stroke();
    const sp = g.createRadialGradient(-8, -8, 4, 0, 0, 40); sp.addColorStop(0, '#d9dde3'); sp.addColorStop(1, '#6b737e');
    g.fillStyle = sp; g.beginPath(); g.arc(0, 0, 38, 0, 7); g.fill();
    g.strokeStyle = '#2a8cd8'; g.lineWidth = 1.2;
    for (let r = 14; r < 34; r += 3) { g.beginPath(); g.arc(0, 0, r, this.ang * 0.3, this.ang * 0.3 + 5.6); g.stroke(); }
    g.fillStyle = '#20252c'; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill();
    // The handle's path, always shown, with a pulsing hint on the knob until you take hold.
    g.strokeStyle = this.turning ? 'rgba(143,209,106,0.7)' : 'rgba(242,193,78,0.75)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.lineDashOffset = -this.ang * 20;
    g.beginPath(); g.arc(0, 0, 62, 0, 7); g.stroke(); g.setLineDash([]);
    if (!this.turning && Fishing.state !== 'idle') { g.strokeStyle = 'rgba(242,193,78,' + (0.5 + Math.sin(performance.now() / 160) * 0.4) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(Math.cos(this.ang) * 62, Math.sin(this.ang) * 62, 24, 0, 7); g.stroke(); }
    // Handle arm and knob.
    g.rotate(this.ang);
    g.strokeStyle = '#1b1f26'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(62, 0); g.stroke();
    g.fillStyle = this.turning ? '#f2c14e' : '#e8e2d2'; g.strokeStyle = '#111'; g.lineWidth = 2;
    g.beginPath(); g.arc(62, 0, 16, 0, 7); g.fill(); g.stroke();
    g.restore();
    // Bail arm (top left): gold across the spool when closed, flipped back when open.
    g.save(); g.translate(40, 42);
    g.strokeStyle = bail ? '#8fd16a' : '#e8b33a'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); bail ? g.arc(8, 8, 22, Math.PI * 0.9, Math.PI * 1.6) : g.arc(70, 70, 70, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
    g.fillStyle = '#fff'; g.font = '700 11px system-ui'; g.textAlign = 'center';
    g.fillText(bail ? 'BAIL OPEN' : 'BAIL', 0, -18);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '600 11px system-ui'; g.textAlign = 'center';
    if (!this.turning && Fishing.state !== 'idle') { g.fillStyle = '#F2C14E'; g.font = '800 12px system-ui'; g.fillText('GRAB THE KNOB · TURN ↻', 110, 196); }
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '600 11px system-ui';
    g.fillText('Drag ' + Game.drag.toFixed(1) + ' kg · ' + (this.rigged ? 'knot ' + Math.round(this.knot * 100) + '%' : 'NOT TIED ON'), 110, 214);
  },
};

// The rigging bench: thread the eye, wrap the tag end, tuck it, wet it and pull tight.
const Rig = {
  isOpen: false, step: 0, t: 0, m: { x: 0, y: 0, down: false }, tip: { x: 0, y: 0 }, inEye: 0, wraps: 0, wrapA: 0, lastA: null,
  pull: 0, burn: 0, wet: false, lastY: 0, msg: '', bumps: 0,
  EYE: { x: 360, y: 150 },

  open() {
    if (this.isOpen) return;
    if (Fishing.state !== 'idle') return;
    if (!Fishing.canCastWith(Fishing.lureId)) { Hud.toast('You\'re out of ' + LURE_BY_ID[Fishing.lureId].name + 's.', UI.bad, 2); return; }
    this.isOpen = true; this.step = 0; this.inEye = 0; this.wraps = 0; this.wrapA = 0; this.lastA = null; this.pull = 0; this.burn = 0; this.wet = false; this.bumps = 0;
    this.msg = 'Move the line tip through the eye of the ' + LURE_BY_ID[Fishing.lureId].name.toLowerCase() + ', left to right. Steady hands…';
    document.getElementById('rig').classList.remove('hidden');
    this.wire();
    const loop = () => { if (!this.isOpen) return; this.frame(1 / 60); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  close(done) {
    this.isOpen = false;
    document.getElementById('rig').classList.add('hidden');
    if (done) {
      const w = this.wraps, q = (w >= 5 && w <= 7 ? 1 : w === 4 || w === 8 ? 0.85 : w === 3 || w === 9 ? 0.65 : 0.45) * (this.wet ? 1 : 0.75) * (1 - this.burn * 0.3);
      Realism.knot = U.clamp(q, 0.3, 1); Realism.rigged = true;
      Hud.toast('Tied on. The knot keeps ' + Math.round(Realism.knot * 100) + '% of the line\'s strength' + (Realism.knot < 0.8 ? ' — it might let go on a big one.' : '. Lovely.'), Realism.knot < 0.8 ? UI.bad : UI.good, 3.5);
    }
  },

  wire() {
    if (this.wired) return;
    this.wired = true;
    const cv = document.getElementById('rigCv');
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 520, y: (e.clientY - r.top) / r.height * 340 }; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); Object.assign(this.m, pos(e)); this.m.down = true; this.m.pressed = true; this.lastY = this.m.y; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => Object.assign(this.m, pos(e)));
    cv.addEventListener('pointerup', () => { this.m.down = false; });
    document.getElementById('rigWet').onclick = () => { this.wet = true; this.msg = 'You lick the knot. Now pull it tight — slowly.'; };
    document.getElementById('rigTuck').onclick = () => { if (this.step === 1 && this.wraps >= 1) { this.step = 2; this.msg = 'Now tuck the tag end back through the little loop by the eye.'; } };
    document.getElementById('rigCancel').onclick = () => this.close(false);
  },

  frame(dt) {
    this.t += dt;
    const E = this.EYE, m = this.m;
    // Your hand shakes a bit; more when you're tired, hungry, itchy or poisoned.
    const shake = Math.min(7, 1.5 + (100 - (Game.energy || 100)) * 0.03 + Bugs.itch * 4);
    const prev = { x: this.tip.x, y: this.tip.y };
    this.tip.x = m.x + Math.sin(this.t * 7.3) * shake + Math.sin(this.t * 13.1) * shake * 0.5;
    this.tip.y = m.y + Math.cos(this.t * 6.1) * shake + Math.sin(this.t * 17.7) * shake * 0.4;
    if (this.step === 0) {
      // Sweep the line tip through the eye, left to right. Clip the metal and you'll have to come round again.
      const hole = 10;
      if (prev.x < E.x && this.tip.x >= E.x && this.tip.x - prev.x < 80) {
        const k = (E.x - prev.x) / (this.tip.x - prev.x || 1), y = prev.y + (this.tip.y - prev.y) * k, off = Math.abs(y - E.y);
        if (off < hole) { this.step = 1; this.msg = 'Through! Now wrap the tag end around the main line: hold the mouse and circle the dotted ring 5 to 7 times.'; Sfx.click(); }
        else if (off < hole + 10) { this.bumps++; this.msg = 'Clipped the eye. Come back round and go again, through the middle.'; Sfx.knot && Sfx.knot(); }
      }
    } else if (this.step === 1) {
      // Wrap around a point on the standing line.
      const cx = 230, cy = 150;
      if (m.down) {
        const a = Math.atan2(this.tip.y - cy, this.tip.x - cx);
        if (this.lastA !== null && U.dist(this.tip.x, this.tip.y, cx, cy) < 80) { this.wrapA += Math.abs(U.angDiff(this.lastA, a)); }
        this.lastA = a;
        const w = Math.floor(this.wrapA / (Math.PI * 2));
        if (w > this.wraps) { this.wraps = w; Sfx.click(); this.msg = this.wraps + ' wrap' + (this.wraps > 1 ? 's' : '') + (this.wraps >= 5 && this.wraps <= 7 ? ' — perfect. Hit TUCK.' : this.wraps > 7 ? ' — getting bulky…' : '…'); }
      } else this.lastA = null;
    } else if (this.step === 2) {
      if (m.pressed && U.dist(m.x, m.y, E.x - 30, E.y + 4) < 20) { this.step = 3; this.msg = 'Tucked. Wet it (or don\'t), then drag DOWN slowly to cinch it tight.'; Sfx.click(); }
      else if (m.pressed) this.msg = 'Missed the loop. It\'s the little gap just left of the eye.';
    } else if (this.step === 3) {
      if (m.down) {
        const dy = m.y - this.lastY; this.lastY = m.y;
        if (dy > 0) {
          const speed = dy / dt;
          this.pull += dy / 260;
          if (speed > (this.wet ? 900 : 420)) { this.burn += dt * 2.2; this.msg = 'Too fast — the line\'s heating up!'; }
          if (this.burn > 1) { this.step = 0; this.wraps = 0; this.wrapA = 0; this.pull = 0; this.burn = 0; this.wet = false; this.msg = 'Friction burned the line through. Snip it off and start again.'; Sfx.snap(); }
        }
        if (this.pull >= 1) return this.close(true);
      } else this.lastY = m.y;
    }
    m.pressed = false;
    this.draw();
  },

  draw() {
    const g = document.getElementById('rigCv').getContext('2d'), E = this.EYE;
    g.fillStyle = '#1b2a2a'; g.fillRect(0, 0, 520, 340);
    g.fillStyle = '#243838'; for (let i = 0; i < 520; i += 26) g.fillRect(i, 0, 1, 340);
    // The lure body hanging off the eye.
    g.fillStyle = LURE_BY_ID[Fishing.lureId].color; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(E.x + 70, E.y + 22, 58, 22, 0.25, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#9aa3ad'; g.lineWidth = 4; g.beginPath(); g.moveTo(E.x + 120, E.y + 40); g.quadraticCurveTo(E.x + 150, E.y + 95, E.x + 112, E.y + 92); g.stroke();
    g.lineWidth = 4; g.strokeStyle = '#c7ccd2'; g.beginPath(); g.arc(E.x, E.y, 12, 0, 7); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(E.x + 13, E.y + 2); g.lineTo(E.x + 22, E.y + 9); g.stroke();
    if (this.step === 0) { g.strokeStyle = 'rgba(242,193,78,0.6)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(E.x - 90, E.y); g.lineTo(E.x - 18, E.y); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(242,193,78,0.8)'; g.beginPath(); g.moveTo(E.x - 18, E.y - 6); g.lineTo(E.x - 8, E.y); g.lineTo(E.x - 18, E.y + 6); g.fill(); }
    // The main line coming down from the rod.
    g.strokeStyle = '#e8f4ff'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(40, 0); g.quadraticCurveTo(60, 120, this.step === 0 ? 120 : 230, 150);
    if (this.step > 0) g.lineTo(E.x, E.y);
    g.stroke();
    // Wraps.
    for (let i = 0; i < this.wraps; i++) { g.strokeStyle = '#e8f4ff'; g.beginPath(); g.ellipse(250 + i * 11, 150, 5, 10, 0.3, 0, 7); g.stroke(); }
    // The tag end in your fingers.
    const from = this.step === 0 ? { x: 120, y: 150 } : { x: E.x, y: E.y };
    if (this.step < 3) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(this.tip.x, this.tip.y); g.stroke();
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(this.tip.x, this.tip.y, 3, 0, 7); g.fill();
    }
    if (this.step === 1) { g.strokeStyle = 'rgba(242,193,78,0.35)'; g.setLineDash([4, 6]); g.beginPath(); g.arc(230, 150, 40, 0, 7); g.stroke(); g.setLineDash([]); }
    if (this.step === 2) { g.strokeStyle = '#f2c14e'; g.lineWidth = 1.5; g.beginPath(); g.arc(E.x - 30, E.y + 4, 11, 0, 7); g.stroke(); }
    if (this.step === 3) {
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(470, 40, 18, 240);
      g.fillStyle = this.burn > 0.4 ? '#ff6a4a' : '#8fd16a'; g.fillRect(470, 280 - 240 * U.clamp(this.pull, 0, 1), 18, 240 * U.clamp(this.pull, 0, 1));
      g.fillStyle = '#fff'; g.font = '600 11px system-ui'; g.textAlign = 'center'; g.fillText('TIGHT', 479, 32);
    }
    // Step header and hint.
    g.fillStyle = '#fff'; g.font = '800 16px system-ui'; g.textAlign = 'left';
    g.fillText(['1 · Thread the eye', '2 · Wrap the tag end', '3 · Tuck through the loop', '4 · Pull it tight'][this.step], 16, 26);
    g.font = '13px system-ui'; g.fillStyle = '#cfe3dd'; g.fillText(this.msg, 16, 322);
    document.getElementById('rigTuck').disabled = this.step !== 1 || this.wraps < 1;
    document.getElementById('rigWet').disabled = this.step !== 3 || this.wet;
  },
};

// ======================= DIALOG =======================
const Dlg = {
  on: false, log: [], menu: 'main', person: null, sig: '', t: 0,

  start() {
    this.on = true; this.log = []; this.menu = 'main';
    document.getElementById('dlg').classList.remove('hidden');
    Hud.g.setTransform(1, 0, 0, 1, 0, 0); Hud.g.clearRect(0, 0, Hud.cv.width, Hud.cv.height);
    this.render(true);
  },
  stop() { this.on = false; document.getElementById('dlg').classList.add('hidden'); },

  push(text, cls) {
    if (cls === 'you' && text.startsWith('> ')) return;
    if (cls === 'act') return; // the actions become buttons instead
    this.log.push({ text, cls });
    if (this.log.length > 60) this.log.shift();
    this.dirty = true;
  },

  run(cmd) { Mud.run(cmd); this.menu = 'main'; this.render(true); },

  choices() {
    const C = [], add = (label, fn, cls = '') => C.push({ label, fn, cls });
    const back = () => add('‹ Back', () => { this.menu = 'main'; }, 'back');
    if (Menus.open === 'catch') { add('Keep it', () => this.run('keep'), 'go'); add('Let it go', () => this.run('release')); return C; }
    if (Menus.open) { add('(Use the panel above — close it when you\'re done)', () => {}, 'dim'); return C; }
    const T = TFish.state;
    if (T === 'wait') { add('Keep waiting', () => this.run('wait')); add('Reel in', () => this.run('reel')); return C; }
    if (T === 'bite') { add('STRIKE!', () => this.run('strike'), 'big'); return C; }
    if (T === 'fight') { add(TFish.run > 0 ? 'Let it run' : 'Hold steady', () => this.run('wait')); add('Reel!', () => this.run('reel'), 'go'); return C; }
    if (Mud.goal || Mud.swimDir) { add('Stop', () => this.run('stop')); return C; }
    switch (this.menu) {
      case 'actions': {
        const a = Mud.listActions();
        a.forEach((x, i) => add(x.label, () => { this.menu = 'main'; Mud.doAction(i); }));
        if (!a.length) add('Nothing to do right here', () => {}, 'dim');
        back(); break;
      }
      case 'places': for (const p of Mud.places().slice(0, 14)) add(p.name + ' · ' + Math.round(U.dist(p.x, p.y, Player.x, Player.y)) + 'm', () => { this.menu = 'main'; Mud.walkTo(p.x, p.y, p.name); }); back(); break;
      case 'walk': for (const d of ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']) add(DIRS[d][2], () => this.run(d + ' 8')); back(); break;
      case 'people': {
        const ppl = Mud.people(30).slice(0, 10);
        for (const p of ppl) add(p.name + ' (' + p.doing + ')', () => { this.person = p; this.menu = 'person'; });
        if (!ppl.length) add('Nobody around', () => {}, 'dim');
        back(); break;
      }
      case 'person': {
        const p = this.person, n = p.name.split(' ')[0].toLowerCase();
        add('Talk to ' + p.name, () => this.run('talk ' + n));
        add('Walk over', () => { this.menu = 'main'; Mud.walkTo(p.x + 0.8, p.y + 0.8, p.name); });
        add('Punch ' + p.name, () => this.run('punch ' + n), 'bad');
        add('Shoot ' + p.name, () => this.run('shoot ' + n), 'bad');
        back(); break;
      }
      case 'hold': for (const t of ['rod', 'gun', 'axe', 'spade', 'spray', 'hands']) add(t[0].toUpperCase() + t.slice(1), () => this.run('hold ' + t)); back(); break;
      case 'more':
        add('Eat', () => this.run('eat')); add('Sleep', () => this.run('sleep')); add('Swim', () => this.run('swim'));
        add('Have a wee', () => this.run('pee')); add('Do a poo', () => this.run('poo'));
        add('Save', () => this.run('save')); add('Quit to menu', () => this.run('quit'), 'bad');
        back(); break;
      default: {
        add('Look around', () => this.run('look'));
        add('Cast a line', () => this.run('cast'), 'go');
        add('Things to do…', () => { this.menu = 'actions'; });
        add('Go somewhere…', () => { this.menu = 'places'; });
        add('Walk…', () => { this.menu = 'walk'; });
        add('People nearby…', () => { this.menu = 'people'; });
        add('Hold…', () => { this.menu = 'hold'; });
        add('Bag & stats', () => { Mud.inventory(); Mud.status(); });
        add('More…', () => { this.menu = 'more'; });
      }
    }
    return C;
  },

  render(force) {
    if (!this.on) return;
    const C = this.choices();
    const sig = this.menu + '|' + C.map((c) => c.label).join('|');
    if (force || this.dirty) {
      this.dirty = false;
      const box = document.getElementById('dlgText');
      box.innerHTML = '';
      this.log.slice(-24).forEach((l, i, a) => { const p = document.createElement('p'); p.className = (l.cls || '') + (i === a.length - 1 ? ' last' : ''); p.textContent = l.text; box.appendChild(p); });
      box.scrollTop = box.scrollHeight;
    }
    document.getElementById('dlg').classList.toggle('panel', !!Menus.open); // a shop or catch card is up: shrink out of its way
    if (!force && sig === this.sig) return;
    this.sig = sig;
    const wrap = document.getElementById('dlgChoices');
    while (wrap.children.length > C.length) wrap.lastChild.remove();
    while (wrap.children.length < C.length) wrap.appendChild(document.createElement('button'));
    C.forEach((c, i) => {
      const b = wrap.children[i], html = '<kbd>' + (i < 9 ? i + 1 : '') + '</kbd>' + c.label.replace(/</g, '&lt;');
      if (b.className !== c.cls) b.className = c.cls;
      if (b.innerHTML !== html) b.innerHTML = html;
      b.onclick = () => { c.fn(); this.render(true); };
    });
  },

  update(dt) {
    if (!this.on) return;
    this.t -= dt;
    document.getElementById('dlgHead').textContent = (Interior.active ? Interior.active.b.name : World.waterName(Player.x, Player.y) || 'The valley') + ' · Day ' + Game.env.day + ', ' + Mud.clock() + ' · ' + U.fmtMoney(Game.money) + ' · HP ' + Math.round(Wanted.health) + (Wanted.level ? ' · ' + '★'.repeat(Wanted.level) : '');
    if (this.t <= 0 || this.dirty) { this.t = 0.2; this.render(false); }
  },

  key(e) {
    if (!this.on || Game.mode !== 'play') return;
    const n = +e.key;
    if (n >= 1 && n <= 9) { const b = document.querySelectorAll('#dlgChoices button')[n - 1]; if (b) { b.click(); e.preventDefault(); e.stopPropagation(); } }
  },
};
addEventListener('keydown', (e) => Dlg.key(e), true);

// ======================= ROGUELIKE =======================
const ROGUE_PERKS = [
  { id: 'rod', name: 'Better rod', desc: 'Upgrade to the next rod: longer casts, firmer hooksets.', ok: () => RODS.indexOf(Game.gear.rod) < RODS.length - 1, take: () => { Game.gear.rod = RODS[RODS.indexOf(Game.gear.rod) + 1]; } },
  { id: 'reel', name: 'Better reel', desc: 'Upgrade to the next reel: more drag, more line per turn.', ok: () => REELS.indexOf(Game.gear.reel) < REELS.length - 1, take: () => { Game.gear.reel = REELS[REELS.indexOf(Game.gear.reel) + 1]; } },
  { id: 'line', name: 'Stronger line', desc: 'Spool up the next line weight.', ok: () => LINES.indexOf(Game.gear.line) < LINES.length - 1, take: () => { Game.gear.line = LINES[LINES.indexOf(Game.gear.line) + 1]; } },
  { id: 'creel', name: 'Bigger creel', desc: '+4 fish you can carry.', ok: () => true, take: () => { Game.creelMax += 4; } },
  { id: 'tackle', name: 'Tackle box', desc: '+3 of every lure, +10 worms.', ok: () => true, take: () => { for (const L of LURES) Game.lures[L.id] = (Game.lures[L.id] || 0) + (L.id === 'worm' ? 10 : 3); } },
  { id: 'permit', name: 'A free permit', desc: 'One fishing permit you don\'t have yet.', ok: () => PERMITS.some((p) => !Game.permits[p.id]), take: () => { const p = PERMITS.filter((q) => !Game.permits[q.id]); Game.permits[U.pick(Math.random, p).id] = true; } },
  { id: 'cash', name: 'Brown envelope', desc: '$120 cash. Don\'t ask.', ok: () => true, take: () => { Game.money += 120; Rogue.last = Game.money; } },
  { id: 'charm', name: 'Lucky charm', desc: 'Tomorrow\'s quota is 30% lower.', ok: () => true, take: () => { Rogue.charm = true; } },
  { id: 'iron', name: 'Iron gut', desc: 'Fully healed, fed and rested right now.', ok: () => true, take: () => { Wanted.health = 100; Game.food = 100; Game.energy = 100; } },
  { id: 'smooth', name: 'Smooth talker', desc: 'The whole town likes you a bit more.', ok: () => true, take: () => { Rep.add ? Rep.add(25, 'Smooth talker') : 0; } },
];

const Rogue = {
  on: false, day: 1, quota: 0, earned: 0, total: 0, last: 0, charm: false, startDay: 1,

  start() {
    this.on = true;
    const seed = (Math.random() * 1e9) | 0;
    Game.newGame(seed); buildWorld(seed, null);
    Game.money = 40; this.last = Game.money;
    this.day = 1; this.due = Game.env.day; this.quota = 60; this.earned = 0; this.total = 0; this.charm = false;
    document.body.classList.add('rogue');
    document.getElementById('rogueBar').classList.remove('hidden');
    enterPlay();
    Hud.toast('ROGUELIKE RUN · Fresh valley, one life. Earn ' + U.fmtMoney(this.quota) + ' by 8pm or it\'s over. Get wasted or busted and it\'s over.', UI.accent, 6);
  },

  update() {
    if (!this.on || Game.mode !== 'play') return;
    if (Game.money > this.last) { this.earned += Game.money - this.last; this.total += Game.money - this.last; }
    this.last = Game.money;
    const left = Math.max(0, 20 - Game.env.hour + (this.due - Game.env.day) * 24);
    document.getElementById('rogueBar').innerHTML = '<b>RUN · DAY ' + this.day + '</b><span>Quota <i class="' + (this.earned >= this.quota ? 'ok' : '') + '">' + U.fmtMoney(this.earned) + ' / ' + U.fmtMoney(this.quota) + '</i></span><span>Due 8pm' + (this.due > Game.env.day ? ' tomorrow' : '') + ' · ' + (left <= 0 ? 'now' : Math.floor(left) + 'h ' + Math.floor((left % 1) * 60) + 'm') + '</span>';
    // Due at 8pm on the due day (sleeping straight through it doesn't dodge it).
    if (Game.env.day > this.due || (Game.env.day === this.due && Game.env.hour >= 20)) {
      if (this.earned >= this.quota) this.perkPick();
      else this.end('Missed the quota', 'You made ' + U.fmtMoney(this.earned) + ' of the ' + U.fmtMoney(this.quota) + ' you owed. The valley chews you up.');
    }
  },

  perkPick() {
    Game.mode = 'rogue'; this.due = 1e9;
    Fishing.reelInFast(); Fight.end && Fight.end();
    const pool = ROGUE_PERKS.filter((p) => p.ok()).sort(() => Math.random() - 0.5).slice(0, 3);
    const el = document.getElementById('rogueCard');
    el.innerHTML = '<h2>Day ' + this.day + ' survived</h2><p>Quota met: ' + U.fmtMoney(this.earned) + ' / ' + U.fmtMoney(this.quota) + '. Pick a reward.</p><div class="perks"></div>';
    for (const p of pool) {
      const b = document.createElement('button');
      b.innerHTML = '<b>' + p.name + '</b><span>' + p.desc + '</span>';
      b.onclick = () => { p.take(); this.nextDay(); };
      el.querySelector('.perks').appendChild(b);
    }
    document.getElementById('rogue').classList.remove('hidden');
    if (Mud.on) Mud.print('Day ' + this.day + ' survived — pick a reward.', 'good');
  },

  nextDay() {
    document.getElementById('rogue').classList.add('hidden');
    this.day++; this.earned = 0;
    this.due = Game.env.hour >= 20 ? Game.env.day + 1 : Game.env.day;
    this.quota = Math.round((this.quota * 1.45 + 25) * (this.charm ? 0.7 : 1)); this.charm = false;
    Game.mode = 'play';
    Hud.toast('Day ' + this.day + ' quota: ' + U.fmtMoney(this.quota) + ' by 8pm tomorrow.', UI.accent, 4);
  },

  end(title, why) {
    if (Game.mode === 'rogue') return;
    Game.mode = 'rogue';
    Fishing.reelInFast(); Sfx.fail();
    let best = null; try { best = JSON.parse(localStorage.getItem('reelwild.rogueBest')); } catch (e) { /* none */ }
    const score = { days: this.day - 1, earned: Math.round(this.total), fish: Game.stats.caught };
    const isBest = !best || score.days > best.days || (score.days === best.days && score.earned > best.earned);
    if (isBest) try { localStorage.setItem('reelwild.rogueBest', JSON.stringify(score)); } catch (e) { /* ignore */ }
    const el = document.getElementById('rogueCard');
    el.innerHTML = '<h2 class="dead">' + title.toUpperCase() + '</h2><p>' + why + '</p>' +
      '<div class="score"><div><b>' + score.days + '</b>days survived</div><div><b>' + U.fmtMoney(score.earned) + '</b>earned</div><div><b>' + score.fish + '</b>fish</div></div>' +
      '<p class="best">' + (isBest ? '★ New best run!' : 'Best: ' + best.days + ' days · ' + U.fmtMoney(best.earned)) + '</p>' +
      '<div class="perks"><button id="rogueAgain"><b>New run</b><span>A fresh valley</span></button><button id="rogueQuit"><b>Main menu</b><span>Back to your normal save</span></button></div>';
    document.getElementById('rogue').classList.remove('hidden');
    document.getElementById('rogueAgain').onclick = () => { sessionStorage.setItem('reelwild.autoRogue', '1'); location.reload(); };
    document.getElementById('rogueQuit').onclick = () => location.reload();
    if (Mud.on) Mud.print(title.toUpperCase() + ' — ' + why, 'bad');
  },

  hook() {
    const wasted = Wanted.wasted.bind(Wanted);
    Wanted.wasted = function () { if (Rogue.on) return Rogue.end('Wasted', 'Taken out by ' + (Wanted.lastHit || 'the valley') + '. No clinic in this run.'); return wasted(); };
    const sentence = Jail.sentence.bind(Jail);
    Jail.sentence = function (reasons, w, forced) { if (Rogue.on) return Rogue.end('Busted', 'Arrested for ' + [].concat(reasons).slice(0, 2).join(' and ').toLowerCase() + '.'); return sentence(reasons, w, forced); };
  },
};
