// Life as the town thief: cracking safes by ear, the gossip that follows you around, and the locals
// who decide to settle things themselves — and go through your pockets once you're down.
'use strict';

const RUMOURS = [
  'Lock your doors, love. There\'s a thief about.',
  'Heard someone got done over last night…',
  'Keep an eye on your tackle box. Light-fingered so-and-so in town.',
  'If I catch whoever\'s been nicking stuff…',
  'Bit of a crime wave lately, eh?',
];

const Thief = {
  rumourT: 8, mob: [], mobT: 0, hitCD: 0,

  st() { return (Game.thief = Game.thief || { rep: 0, last: -999, victim: null, what: null, ambushH: -999 }); },
  nowH() { return (Game.env.day - 1) * 24 + Game.env.hour; },

  // Something got nicked. The town notices.
  record(what, victim) {
    const s = this.st();
    s.rep = Math.min(10, s.rep + (what === 'safe' ? 2 : 1));
    s.last = this.nowH(); s.what = what; s.victim = victim || null;
    Rep.add(what === 'safe' ? -10 : -6);
  },
  daily() { const s = this.st(); s.rep = Math.max(0, s.rep * 0.8 - 0.1); },
  recent() { const s = this.st(); return s.rep > 0.3 && this.nowH() - s.last < 72; },

  rumour(speaker) {
    const s = this.st(), v = s.victim;
    if (v && speaker === v) return U.pick(Math.random, ['Some mongrel cleaned me out! If I find who did it…', 'They robbed ME. Can you believe it?']);
    const specific = v ? {
      bike: 'Someone nicked ' + v + '\'s bike, you hear?',
      burglary: 'Someone went through ' + v + '\'s place. Took the lot!',
      'break-in': 'Somebody jimmied ' + v + '\'s front door. In broad daylight!',
      safe: v + '\'s safe got cracked. Cleaned right out!',
    }[s.what] : null;
    return specific && Math.random() < 0.5 ? specific : U.pick(Math.random, RUMOURS);
  },

  update(dt) {
    const s = this.st();
    // Gossip.
    this.rumourT -= dt;
    if (this.rumourT <= 0) {
      this.rumourT = 14 + Math.random() * 16;
      if (this.recent() && !Interior.active) {
        const n = Npcs.list.filter((x) => !x.away && !x.mob && ['cast', 'wait', 'walk', 'chat'].includes(x.state) && U.dist(x.x, x.y, Player.x, Player.y) < 22)[0];
        if (n) Npcs.say(n, s.rep >= 4 && U.dist(n.x, n.y, Player.x, Player.y) < 6 ? 'Hang on… it\'s YOU, isn\'t it?' : this.rumour(n.name), 3.5);
      }
    }
    // The locals band together.
    if (this.mob.length) return this.mobTick(dt);
    const night = Game.env.hour >= 20 || Game.env.hour < 5;
    if (s.rep >= 2 && this.recent() && this.nowH() - s.ambushH > 24 && !Interior.active && !Bikes.riding && Wanted.level === 0
      && Rep.val() < 20 && Math.random() < dt * 0.008 * (Rep.val() < -60 ? 2 : 1) * (night ? 2 : 1) * Math.min(3, s.rep / 2)) this.startMob();
  },

  startMob() {
    const pool = Npcs.list.filter((n) => !n.away && !['home', 'bush', 'ko', 'armed', 'brawl'].includes(n.state) && U.dist(n.x, n.y, Player.x, Player.y) < 45)
      .sort((a, b) => U.dist(a.x, a.y, Player.x, Player.y) - U.dist(b.x, b.y, Player.x, Player.y)).slice(0, 3);
    if (pool.length < 2) return;
    this.st().ambushH = this.nowH();
    this.mob = pool; this.mobT = 60; this.hitCD = 1.5;
    pool.forEach((n, i) => { n.state = 'mob'; n.mob = true; n.mobAng = i * 2.1; n.lure = null; n.fish = null; n.held = null; Npcs.say(n, U.pick(Math.random, ['THERE\'S the thief!', 'Get \'im!', 'You\'ll pay for what you nicked!', 'Teach this one a lesson!']), 2.5); });
    Hud.toast(pool.slice(0, -1).map((n) => n.name).join(', ') + ' and ' + pool[pool.length - 1].name + ' have had enough of the thief. They\'re coming for you!', UI.bad, 3.2);
  },

  mobTick(dt) {
    this.mobT -= dt; this.hitCD -= dt;
    this.mob = this.mob.filter((n) => n.mob && n.state === 'mob');
    if (!this.mob.length || this.mobT <= 0 || Interior.active) return this.endMob(this.mobT <= 0 ? 'The mob gives up and wanders off, muttering.' : null);
    for (const n of this.mob) {
      // Surround you rather than pile into the same spot.
      const gx = Player.x + Math.cos(n.mobAng) * 0.95, gy = Player.y + Math.sin(n.mobAng) * 0.95;
      const d = U.dist(n.x, n.y, gx, gy), a = Math.atan2(gy - n.y, gx - n.x), step = Math.min(3.1 * dt, d);
      const nx = n.x + Math.cos(a) * step, ny = n.y + Math.sin(a) * step;
      if (!World.blocked(nx, ny)) { n.x = nx; n.y = ny; }
      n.face = Math.atan2(Player.y - n.y, Player.x - n.x); n.walkT = (n.walkT || 0) + dt;
      n.mobAng += dt * 0.4;
    }
    const close = this.mob.filter((n) => U.dist(n.x, n.y, Player.x, Player.y) < 1.4);
    if (close.length && this.hitCD <= 0 && !Bikes.riding) {
      this.hitCD = 1.2 / close.length;
      const n = close[(Math.random() * close.length) | 0];
      Wanted.hurt(8, 'a mob of locals');
      if (Math.random() < 0.4) Npcs.say(n, U.pick(Math.random, ['TAKE THAT!', 'THIEF!', 'Give it back!', 'Not so tough now!']), 1.2);
    }
  },

  endMob(msg) {
    for (const n of this.mob) if (n.state === 'mob') { n.state = 'cast'; n.t = 1; n.casts = 0; }
    for (const n of Npcs.list) n.mob = false;
    this.mob = [];
    if (msg) Hud.toast(msg, UI.muted, 2.4);
  },

  // Called as you black out: if the mob got you, they help themselves.
  robOnBlackout() {
    if (!this.mob.length) return null;
    const names = this.mob.map((n) => n.name);
    const cash = Math.round(Game.money * 0.6);
    Game.money -= cash;
    const taken = [];
    if (Game.creel.length) { taken.push(Game.creel.length + ' fish'); Game.creel = []; }
    if (Game.weed) { taken.push(Game.weed + ' bags of weed'); Game.weed = 0; }
    const food = Math.floor(Game.pantry.length / 2); if (food) { Game.pantry.splice(0, food); taken.push(food + ' food'); }
    if ((Game.wood || 0) > 0) { taken.push(Game.wood + ' firewood'); Game.wood = 0; }
    this.endMob(null);
    const s = this.st(); s.rep = Math.max(0, s.rep - 3); // they reckon justice is done
    return { names, cash, taken };
  },

  // ---------- safes ----------
  hasSafe(b) { return b.type === 'house' && U.hash2(b.x, b.y, 31) < (b.big ? 0.6 : 0.25); },
  safeReady(b) { const d = (Game.safes || {})[b.id]; return d === undefined || Game.env.day - d >= 7; },

  crack(b) {
    if (!this.safeReady(b)) { Hud.toast('The safe hangs open. Empty — someone beat you to it (it was you).', UI.muted, 2); return; }
    const owner = Npcs.list.find((n) => n.home === b);
    const n = b.big ? 3 : 2;
    this.safe = { b, owner, combo: Array.from({ length: n }, () => (Math.random() * 100) | 0), k: 0, dial: Math.random() * 100, alert: 0, last: performance.now(), lastNum: -1, done: false, msg: '', msgT: 0 };
    Life.panel(`<h2>Crack the safe</h2>
      <div class="desc">You fish your trusty stethoscope out of your pocket (as you do). Turn the dial slowly and listen — the tumbler <b>clunks</b> when you're on the number. ${n} numbers.${owner && owner.state === 'home' ? ' <b style="color:var(--bad)">Someone\'s home — be quick.</b>' : ''}</div>
      <div class="lock-alert"><span>Alert</span><div class="lock-bar"><div id="lockFill"></div></div><b id="lockPct">0%</b></div>
      <canvas id="safeCv" width="560" height="300" class="lock-cv"></canvas>
      <div class="safe-ctl"><button id="sL">◀ Turn</button><button class="primary" id="sTry">Try this number</button><button id="sR">Turn ▶</button></div>
      <div class="lock-foot"><span id="safeStage"></span><button id="sQuit">Walk away</button></div>`, (el) => {
      const hold = (id, dir) => { const b2 = el.querySelector(id); const on = (e) => { e.preventDefault(); this.safe.turn = dir; }, off = () => { if (this.safe) this.safe.turn = 0; };
        b2.addEventListener('pointerdown', on); b2.addEventListener('pointerup', off); b2.addEventListener('pointerleave', off); };
      hold('#sL', -1); hold('#sR', 1);
      el.querySelector('#sTry').onclick = () => this.tryNum();
      el.querySelector('#sQuit').onclick = () => this.safeEnd('quit');
      const cv = el.querySelector('#safeCv'); let drag = null;
      cv.addEventListener('pointerdown', (e) => { drag = e.clientX; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => { if (drag === null) return; this.safe.dial = (this.safe.dial + (e.clientX - drag) * 0.12 + 100) % 100; drag = e.clientX; });
      cv.addEventListener('pointerup', () => { drag = null; });
    });
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((t) => this.safeTick(t));
  },

  dist(a, b) { const d = Math.abs(a - b) % 100; return Math.min(d, 100 - d); },

  safeTick(t) {
    const S = this.safe; if (!S || S.done) return;
    if (Menus.open !== 'misc' || !document.getElementById('safeCv')) return this.safeEnd('quit', true);
    const dt = Math.min(0.05, (t - S.last) / 1000); S.last = t;
    const k = Input.keys, kb = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const turn = S.turn || kb;
    if (turn) S.dial = (S.dial + turn * 14 * dt + 100) % 100;
    // Every number the dial passes makes a tiny tick; on the right one, a heavy clunk.
    const num = Math.round(S.dial) % 100;
    if (num !== S.lastNum) {
      S.lastNum = num;
      const d = this.dist(num, S.combo[S.k]);
      if (d === 0) { Sfx.tone(95, 0.12, 0.35, 'square', 60); S.hit = 1; }
      else Sfx.tone(2400 + Math.random() * 300, 0.015, 0.02 + Math.max(0, 0.06 - d * 0.012), 'triangle');
    }
    S.hit = Math.max(0, (S.hit || 0) - dt * 2.5);
    const owner = S.owner && S.owner.state === 'home' ? 2 : 1;
    S.alert += (S.b.big ? 1.35 : 1.6) * owner * (Player.crouch ? 0.85 : 1) * dt;
    S.msgT -= dt;
    if (S.alert >= 100) return this.safeEnd('fail');
    this.safeDraw();
    const f = document.getElementById('lockFill'), pc = document.getElementById('lockPct'), st = document.getElementById('safeStage');
    if (f) { f.style.width = Math.min(100, S.alert) + '%'; f.style.background = S.alert > 70 ? 'var(--bad)' : S.alert > 40 ? 'var(--accent)' : 'var(--good)'; }
    if (pc) pc.textContent = Math.floor(S.alert) + '%';
    if (st) st.textContent = 'Number ' + (S.k + 1) + ' of ' + S.combo.length + (Mobile.active ? ' · hold ◀ ▶ or drag the dial' : ' · hold ◀ ▶, A/D, or drag the dial');
    this.raf = requestAnimationFrame((tt) => this.safeTick(tt));
  },

  safeDraw() {
    const S = this.safe, cv = document.getElementById('safeCv'); if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2 - 70, cy = H / 2, R = 110;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#1A1612'; g.beginPath(); g.roundRect(0, 0, W, H, 14); g.fill();
    // Safe door and dial.
    g.fillStyle = '#4A4E52'; g.beginPath(); g.roundRect(cx - 140, 14, 280, H - 28, 12); g.fill();
    g.fillStyle = '#2A2C30'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.save(); g.translate(cx, cy); g.rotate(-S.dial / 100 * Math.PI * 2);
    g.strokeStyle = '#C8BFAE'; g.fillStyle = '#C8BFAE'; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'center';
    for (let n = 0; n < 100; n++) {
      const a = n / 100 * Math.PI * 2 - Math.PI / 2, long = n % 5 === 0;
      g.lineWidth = long ? 2 : 1; g.beginPath(); g.moveTo(Math.cos(a) * (R - 4), Math.sin(a) * (R - 4)); g.lineTo(Math.cos(a) * (R - (long ? 16 : 10)), Math.sin(a) * (R - (long ? 16 : 10))); g.stroke();
      if (n % 10 === 0) g.fillText(String(n), Math.cos(a) * (R - 28), Math.sin(a) * (R - 28) + 4);
    }
    g.restore();
    g.fillStyle = '#B8BCC0'; g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.fill();
    g.fillStyle = '#E3B04A'; g.beginPath(); g.moveTo(cx, cy - R - 4); g.lineTo(cx - 8, cy - R - 18); g.lineTo(cx + 8, cy - R - 18); g.closePath(); g.fill();
    // Stethoscope readout: a wiggle that spikes on each clunk.
    const px = W - 150, top = 40;
    g.fillStyle = '#C8BFAE'; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'left'; g.fillText('🩺 LISTENING', px, top - 10);
    g.strokeStyle = S.hit > 0.2 ? '#7FC483' : '#5A6A70'; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= 130; x += 2) {
      const amp = 3 + S.hit * 40, y = top + 40 + Math.sin(x * 0.35 + performance.now() * 0.02) * amp * Math.exp(-Math.abs(x - 65) / 30);
      x ? g.lineTo(px + x, y) : g.moveTo(px + x, y);
    }
    g.stroke();
    g.fillStyle = '#F3EAD6'; g.font = '400 30px "Lilita One", sans-serif'; g.textAlign = 'center';
    g.fillText(String(Math.round(S.dial) % 100).padStart(2, '0'), px + 65, top + 120);
    g.font = '600 11px Inter, sans-serif'; g.fillStyle = '#C8BFAE';
    S.combo.forEach((_, i) => { g.fillStyle = i < S.k ? '#7FC483' : i === S.k ? '#E3B04A' : '#5A5A60'; g.beginPath(); g.arc(px + 45 + i * 20, top + 150, 6, 0, 7); g.fill(); });
    if (S.msgT > 0) { g.fillStyle = '#E2584D'; g.font = '700 14px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(S.msg, W / 2, H - 10); }
  },

  tryNum() {
    const S = this.safe; if (!S || S.done) return;
    if (this.dist(Math.round(S.dial) % 100, S.combo[S.k]) <= 0) {
      S.k++; Sfx.tone(660, 0.08, 0.2, 'triangle', 990);
      if (S.k >= S.combo.length) this.safeEnd('ok');
    } else { S.alert += 8; S.msg = 'The handle won\'t budge. Clank!'; S.msgT = 1.2; Sfx.tone(160, 0.15, 0.25, 'square', 90); }
  },

  safeEnd(how, silent) {
    const S = this.safe; if (!S || S.done) return;
    S.done = true; cancelAnimationFrame(this.raf);
    if (Menus.open === 'misc') Menus.close();
    const b = S.b, who = S.owner ? S.owner.name : 'someone';
    if (how === 'ok') {
      (Game.safes = Game.safes || {})[b.id] = Game.env.day;
      const cash = Math.round(b.big ? 250 + Math.random() * 550 : 60 + Math.random() * 160);
      Game.money += cash; Sfx.coin(); setTimeout(() => Sfx.coin(), 150);
      let extra = '';
      if (Math.random() < 0.35) { Game.ammo = (Game.ammo || 0) + 10; extra = ' and a box of rifle rounds'; }
      this.record('safe', who);
      Hud.toast('The door swings open: ' + U.fmtMoney(cash) + ' in cash' + extra + '!', UI.good, 3);
      Game.save();
    } else if (how === 'fail') {
      Sfx.fail(); Wanted.crime(1.5);
      Hud.toast('Too slow — the neighbours heard the safe rattling. Breaking and entering!', UI.bad, 3);
      if (Interior.active) Interior.exit();
    } else if (!silent) Hud.toast('You leave the safe alone.', UI.muted, 1.6);
    this.safe = null;
  },
};
