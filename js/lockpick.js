// Hot-wiring someone's ride: three lock puzzles against a rising alert meter. Hit 100% and the owner
// (and the law) are onto you.
'use strict';

const LOCK_STAGES = ['pins', 'latches', 'dial'];

const LockPick = {
  r: null, alert: 0, stage: 0, stages: [], raf: 0, last: 0, msg: '', msgT: 0,

  open(r) {
    this.r = r; this.house = null;
    this.start(BIKE_BY_ID[r.bikeId].price > 800, 1, `${r.name}'s ${BIKE_BY_ID[r.bikeId].name} · plate ${r.plate}. One lock between you and the ignition — every slip makes noise.`);
  },

  openHouse(b) {
    this.r = null; this.house = b;
    const owner = Npcs.list.find((n) => n.home === b);
    const n = b.big ? 3 : U.hash2(b.x, b.y, 7) < 0.45 ? 2 : 1; // big houses: 3; some cottages have a deadbolt
    this.start(!!b.big, n, `${b.name}'s front door. ${['One lock', 'Two locks', 'Three locks'][n - 1]} between you and whatever's inside${owner && owner.state === 'home' ? ' — and someone\'s HOME' : ''}. Every slip makes noise.`);
  },

  start(hard, count, desc) {
    this.alert = 0; this.stage = 0; this.done = false;
    this.hard = hard;
    this.stages = LOCK_STAGES.slice().sort(() => Math.random() - 0.5).slice(0, count);
    Life.panel(`<h2>Pick the lock</h2>
      <div class="desc">${desc}</div>
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
      // 3×3 grid, centre empty; true = locked. Scrambled from solved, so it's always solvable.
      this.latches = Array(9).fill(false);
      do { for (let k = 0; k < 4 + (this.hard ? 2 : 0); k++) { let c; do c = (Math.random() * 9) | 0; while (c === 4); this.flip(c); } } while (this.latches.every((v) => !v));
    }
    if (kind === 'dial') { this.dial = { a: 0, sp: this.hard ? 3.4 : 2.6, dir: 1, hits: 0, need: 3, target: Math.random() * Math.PI * 2 }; }
    const label = { pins: 'Set the pins: click each one as it rises into the green band', latches: 'Open every latch. Each click flips its neighbours too', dial: 'Click when the needle is inside the notch (3 times)' }[kind];
    const st = document.getElementById('lockStage'); if (st) st.textContent = (this.stages.length > 1 ? 'Lock ' + (this.stage + 1) + ' of ' + this.stages.length + ' · ' : '') + (Mobile.active ? label.replace(/[Cc]lick/g, (m) => (m[0] === 'C' ? 'Tap' : 'tap')) : label);
  },

  // Flip a latch and the ones directly above/below/left/right of it (the empty centre is skipped).
  flip(i) {
    const r = (i / 3) | 0, c = i % 3;
    for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc, j = rr * 3 + cc;
      if (rr < 0 || rr > 2 || cc < 0 || cc > 2 || j === 4) continue;
      this.latches[j] = !this.latches[j];
    }
  },
  latchCell() { const W = this.cv.width, H = this.cv.height, sz = 74; return { sz, x0: W / 2 - sz * 1.5, y0: H / 2 - sz * 1.5 }; },

  noise(amount, text) {
    this.alert += amount; this.msg = text; this.msgT = 1.2;
    Sfx.tone(220, 0.12, 0.25, 'square', 140);
  },

  // Alert creeps up on its own — faster with the owner or the law close by.
  rate() {
    let owner = 99;
    if (this.r) { const p = Bikes.riderPos(this.r); owner = U.dist(p.x, p.y, Player.x, Player.y); }
    else { const o = Npcs.list.find((n) => n.home === this.house); if (o) owner = o.state === 'home' ? 6 : U.dist(o.x, o.y, Player.x, Player.y); }
    const law = [...Wardens.list, ...Wanted.units].some((w) => U.dist(w.x, w.y, Player.x, Player.y) < 15);
    const night = Game.env.hour < 5 || Game.env.hour >= 22;
    return (this.hard ? 3.0 : 2.35) * (owner < 8 ? 2 : owner < 16 ? 1.4 : 1) * (law ? 1.8 : 1) * (Player.crouch ? 0.8 : 1) * (this.house && night ? 0.8 : 1);
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
      const L = this.latchCell(), c = Math.floor((x - L.x0) / L.sz), r = Math.floor((y - L.y0) / L.sz), i = r * 3 + c;
      if (c < 0 || c > 2 || r < 0 || r > 2 || i === 4) return;
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
      const L = this.latchCell();
      for (let i = 0; i < 9; i++) {
        if (i === 4) continue;
        const x = L.x0 + (i % 3) * L.sz + L.sz / 2, y = L.y0 + ((i / 3) | 0) * L.sz + L.sz / 2, closed = this.latches[i];
        g.fillStyle = '#2A2A30'; g.beginPath(); g.roundRect(x - 31, y - 31, 62, 62, 10); g.fill();
        g.save(); g.translate(x, y); g.rotate(closed ? 0 : -Math.PI / 2);
        g.fillStyle = closed ? '#E2584D' : '#7FC483'; g.beginPath(); g.roundRect(-7, -24, 14, 34, 6); g.fill();
        g.restore();
        g.fillStyle = '#15151A'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill();
      }
      g.fillStyle = '#C8BFAE'; g.font = '600 12px Inter, sans-serif'; g.textAlign = 'center';
      g.fillText(this.latches.filter(Boolean).length + ' locked', W / 2, H / 2 + 5);
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
    if (this.house) {
      const b = this.house;
      b.forcedDay = Game.env.day; // the lock's busted for the rest of the day
      { const o = Npcs.list.find((n) => n.home === b); Thief.record('break-in', o ? o.name : null); }
      if (loud) { Wanted.crime(1); Hud.toast('The lock gives — but the neighbours heard you. Breaking and entering!', UI.bad, 2.6); }
      else Hud.toast('Click. You\'re in.', UI.accent, 1.6);
      Life.enterHouse(b);
      return;
    }
    Bikes.steal(this.r, !loud);
  },

  fail() {
    const r = this.r;
    this.close();
    Sfx.fail();
    if (this.house) {
      const b = this.house, o = Npcs.list.find((n) => n.home === b);
      Hud.toast('A neighbour spots you jimmying ' + b.name + '\'s door. Breaking and entering!', UI.bad, 3);
      Wanted.crime(1.5);
      if (o && o.state !== 'home') Npcs.say(o, 'OI! THAT\'S MY HOUSE!', 3);
      return;
    }
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
    if (!silent) Hud.toast(this.house ? (a > 50 ? 'You back off from the door. Curtains are twitching next door.' : 'You leave the door alone.') : a > 50 ? 'You back off — ' + this.r.name + ' is eyeing you suspiciously.' : 'You leave the bike alone.', UI.muted, 2);
  },
};
