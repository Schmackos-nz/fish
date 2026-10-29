// Hot-wiring someone's ride: three lock puzzles against a rising alert meter. Hit 100% and the owner
// (and the law) are onto you.
'use strict';

const LOCK_STAGES = ['pins', 'latches', 'dial'];

const LockPick = {
  r: null, alert: 0, stage: 0, stages: [], raf: 0, last: 0, msg: '', msgT: 0,

  open(r) {
    this.r = r; this.alert = 0; this.stage = 0; this.done = false;
    const hard = BIKE_BY_ID[r.bikeId].price > 800;
    this.hard = hard;
    this.stages = LOCK_STAGES.slice().sort(() => Math.random() - 0.5);
    Life.panel(`<h2>Pick the lock</h2>
      <div class="desc">${r.name}'s ${BIKE_BY_ID[r.bikeId].name} · plate ${r.plate}. Three locks between you and the ignition — every slip makes noise.</div>
      <div class="lock-alert"><span>Alert</span><div class="lock-bar"><div id="lockFill"></div></div><b id="lockPct">0%</b></div>
      <canvas id="lockCv" width="560" height="300" class="lock-cv"></canvas>
      <div class="lock-foot"><span id="lockStage"></span><button id="lockQuit">Walk away</button></div>`, (el) => {
      this.cv = el.querySelector('#lockCv'); this.g = this.cv.getContext('2d');
      this.cv.onclick = (e) => { const b = this.cv.getBoundingClientRect(); this.click((e.clientX - b.left) * this.cv.width / b.width, (e.clientY - b.top) * this.cv.height / b.height); };
      el.querySelector('#lockQuit').onclick = () => this.quit();
    });
    this.initStage();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((t) => this.tick(t));
  },

  initStage() {
    const kind = this.stages[this.stage], n = this.hard ? 5 : 4;
    if (kind === 'pins') this.pins = Array.from({ length: n }, (_, i) => ({ set: false, ph: Math.random() * 6, sp: 2.2 + Math.random() * 1.6 + i * 0.25, lo: 0.55 + Math.random() * 0.15 }));
    if (kind === 'latches') {
      this.latches = Array(n + 1).fill(false); // false = open
      do { for (let k = 0; k < 3 + n; k++) this.flip((Math.random() * this.latches.length) | 0); } while (this.latches.every((v) => !v));
    }
    if (kind === 'dial') { this.dial = { a: 0, sp: this.hard ? 3.4 : 2.6, dir: 1, hits: 0, need: 3, target: Math.random() * Math.PI * 2 }; }
    const label = { pins: 'Set the pins: click each one as it rises into the green band', latches: 'Open every latch. Each click flips its neighbours too', dial: 'Click when the needle is inside the notch (3 times)' }[kind];
    const st = document.getElementById('lockStage'); if (st) st.textContent = 'Lock ' + (this.stage + 1) + ' of 3 · ' + (Mobile.active ? label.replace(/[Cc]lick/g, (m) => (m[0] === 'C' ? 'Tap' : 'tap')) : label);
  },

  flip(i) { for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < this.latches.length) this.latches[j] = !this.latches[j]; },

  noise(amount, text) {
    this.alert += amount; this.msg = text; this.msgT = 1.2;
    Sfx.tone(220, 0.12, 0.25, 'square', 140);
  },

  // Alert creeps up on its own — faster with the owner or the law close by.
  rate() {
    const r = this.r, p = Bikes.riderPos(r), owner = U.dist(p.x, p.y, Player.x, Player.y);
    const law = [...Wardens.list, ...Wanted.units].some((w) => U.dist(w.x, w.y, Player.x, Player.y) < 15);
    return (this.hard ? 4.5 : 3.5) * (owner < 8 ? 2 : owner < 16 ? 1.4 : 1) * (law ? 1.8 : 1) * (Player.crouch ? 0.8 : 1);
  },

  tick(t) {
    if (this.done) return;
    // Closed some other way (Esc, the ✕): treat it as walking away.
    if (Menus.open !== 'misc' || !document.getElementById('lockCv')) { this.quit(true); return; }
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    this.alert += this.rate() * dt;
    this.msgT -= dt;
    const kind = this.stages[this.stage];
    if (kind === 'pins') for (const p of this.pins) if (!p.set) p.ph += p.sp * dt;
    if (kind === 'dial') this.dial.a += this.dial.sp * this.dial.dir * dt;
    if (this.alert >= 100) { this.fail(); return; }
    this.draw();
    const f = document.getElementById('lockFill'), pc = document.getElementById('lockPct');
    if (f) { f.style.width = Math.min(100, this.alert) + '%'; f.style.background = this.alert > 70 ? 'var(--bad)' : this.alert > 40 ? 'var(--accent)' : 'var(--good)'; }
    if (pc) pc.textContent = Math.floor(this.alert) + '%';
    this.raf = requestAnimationFrame((tt) => this.tick(tt));
  },

  click(x, y) {
    const kind = this.stages[this.stage], W = this.cv.width;
    if (kind === 'pins') {
      const n = this.pins.length, gap = W / (n + 1);
      const i = Math.round(x / gap) - 1, p = this.pins[i];
      if (!p || p.set || Math.abs(x - gap * (i + 1)) > 30) return;
      const h = this.pinH(p);
      if (h > p.lo && h < p.lo + 0.2) { p.set = true; Sfx.tone(880, 0.05, 0.15, 'triangle', 1200); }
      else { this.noise(9, 'Clunk! The pin slipped.'); for (const q of this.pins) if (Math.random() < 0.35) q.set = false; }
      if (this.pins.every((q) => q.set)) this.next();
    } else if (kind === 'latches') {
      const n = this.latches.length, gap = W / (n + 1), i = Math.round(x / gap) - 1;
      if (i < 0 || i >= n || Math.abs(x - gap * (i + 1)) > 32) return;
      this.flip(i); this.alert += 1.5; Sfx.tone(300, 0.04, 0.12, 'square', 260);
      if (this.latches.every((v) => !v)) this.next();
    } else if (kind === 'dial') {
      const d = this.dial, diff = Math.abs(U.angDiff(d.a, d.target));
      if (diff < (this.hard ? 0.2 : 0.26)) {
        d.hits++; d.dir *= -1; d.target = Math.random() * Math.PI * 2; d.sp *= 1.15; Sfx.tone(940, 0.05, 0.15, 'triangle', 1300);
        if (d.hits >= d.need) this.next();
      } else this.noise(8, 'Scrape! Wrong spot.');
    }
  },

  next() {
    this.stage++;
    Sfx.tone(660, 0.08, 0.2, 'triangle', 990);
    if (this.stage >= this.stages.length) { this.success(); return; }
    this.initStage();
  },

  pinH(p) { return 0.5 + Math.sin(p.ph) * 0.45; }, // 0.05..0.95, fraction of the travel

  draw() {
    const g = this.g, W = this.cv.width, H = this.cv.height, kind = this.stages[this.stage];
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#1A1612'; g.beginPath(); g.roundRect(0, 0, W, H, 14); g.fill();
    if (kind === 'pins') {
      const n = this.pins.length, gap = W / (n + 1), top = 40, bot = H - 50, span = bot - top;
      g.fillStyle = '#6A6A70'; g.fillRect(gap * 0.4, bot, W - gap * 0.8, 18); // lock body
      this.pins.forEach((p, i) => {
        const x = gap * (i + 1), h = p.set ? p.lo + 0.1 : this.pinH(p);
        g.fillStyle = 'rgba(127,196,131,0.45)'; g.fillRect(x - 22, bot - (p.lo + 0.2) * span, 44, 0.2 * span); // sweet spot
        g.strokeStyle = '#7FC483'; g.lineWidth = 2; g.strokeRect(x - 22, bot - (p.lo + 0.2) * span, 44, 0.2 * span);
        g.strokeStyle = '#3A3A40'; g.lineWidth = 2; g.strokeRect(x - 18, top, 36, span);
        const py = bot - h * span;
        g.fillStyle = p.set ? '#7FC483' : '#E3B04A'; g.beginPath(); g.roundRect(x - 14, py - 10, 28, bot - py + 10, 6); g.fill();
        g.fillStyle = '#C8BFAE'; g.font = '600 12px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(p.set ? 'SET' : 'PIN ' + (i + 1), x, H - 12);
      });
    } else if (kind === 'latches') {
      const n = this.latches.length, gap = W / (n + 1), y = H / 2;
      g.strokeStyle = '#3A3A40'; g.lineWidth = 6; g.beginPath(); g.moveTo(gap * 0.6, y); g.lineTo(W - gap * 0.6, y); g.stroke();
      this.latches.forEach((closed, i) => {
        const x = gap * (i + 1);
        g.save(); g.translate(x, y); g.rotate(closed ? 0 : -Math.PI / 2.4);
        g.fillStyle = closed ? '#E2584D' : '#7FC483'; g.beginPath(); g.roundRect(-10, -60, 20, 70, 8); g.fill();
        g.restore();
        g.fillStyle = '#2A2A30'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill();
        g.fillStyle = '#C8BFAE'; g.font = '600 12px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(closed ? 'LOCKED' : 'OPEN', x, y + 50);
      });
    } else if (kind === 'dial') {
      const d = this.dial, cx = W / 2, cy = H / 2 + 6, R = 110, notch = this.hard ? 0.2 : 0.26;
      g.fillStyle = '#2A2A30'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
      g.strokeStyle = 'rgba(127,196,131,0.9)'; g.lineWidth = 16; g.beginPath(); g.arc(cx, cy, R - 14, d.target - notch, d.target + notch); g.stroke();
      g.strokeStyle = '#F3EAD6'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(d.a) * (R - 6), cy + Math.sin(d.a) * (R - 6)); g.stroke();
      g.fillStyle = '#E3B04A'; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.fill();
      g.fillStyle = '#C8BFAE'; g.font = '600 13px Inter, sans-serif'; g.textAlign = 'left'; g.fillText(d.hits + ' / ' + d.need, 16, 26);
    }
    if (this.msgT > 0) { g.fillStyle = '#E2584D'; g.font = '700 14px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(this.msg, W / 2, 24); }
  },

  close() { this.done = true; cancelAnimationFrame(this.raf); if (Menus.open === 'misc') Menus.close(); },

  success() {
    const loud = this.alert > 70;
    this.close();
    Bikes.steal(this.r, !loud);
  },

  fail() {
    const r = this.r;
    this.close();
    Sfx.fail();
    Hud.toast('ALARM! ' + r.name + ' caught you trying to nick their ' + BIKE_BY_ID[r.bikeId].name + '!', UI.bad, 3);
    Wanted.crime(1.5);
    (Wanted.rap = Wanted.rap || { ko: 0, cops: 0, booms: 0, thefts: 0 }).thefts++;
    // The owner comes after you; their bike stays put.
    if (Bikes.onFoot(r)) { r.state = 'stranded'; r.noBike = false; r.stateT = 30; r.chaseT = 20; r.armed = Math.random() < 0.55; r.hitCD = 1; r.bubble = 'OI! GET AWAY FROM MY BIKE!'; r.bubbleT = 2.5; }
  },

  quit(silent) {
    if (this.done) return;
    const a = this.alert;
    this.close();
    if (!silent) Hud.toast(a > 50 ? 'You back off — ' + this.r.name + ' is eyeing you suspiciously.' : 'You leave the bike alone.', UI.muted, 2);
  },
};
