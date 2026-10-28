// 2D overlay: reel widget, cast meter, lure action, fight gauges, minimap, prompts.
'use strict';

const Hud = {
  cv: null, g: null, toastT: 0, bigMap: false, showControls: true,

  init() {
    this.cv = document.getElementById('hud');
    this.g = this.cv.getContext('2d');
    const fit = () => { this.cv.width = window.innerWidth; this.cv.height = window.innerHeight; };
    fit(); window.addEventListener('resize', fit);
    try { this.showControls = localStorage.getItem('reelwild.controls') !== 'off'; } catch (e) { /* default on */ }
  },

  toggleControls() {
    this.showControls = !this.showControls;
    try { localStorage.setItem('reelwild.controls', this.showControls ? 'on' : 'off'); } catch (e) { /* ignore */ }
  },

  toast(text, color = '#f3ead6', time = 2) {
    const el = document.getElementById('toast');
    el.textContent = text; el.style.color = color; el.style.opacity = 1;
    this.toastT = time;
  },
  ripple(x, y, s) { Actors.ripple(x, y, s); },

  update(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) document.getElementById('toast').style.opacity = 0; }
  },

  panel(x, y, w, h) {
    const g = this.g;
    g.fillStyle = 'rgba(18,26,30,.82)'; g.strokeStyle = '#c9a86a'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill(); g.stroke();
  },
  text(t, x, y, col = '#f3ead6', size = 13, align = 'left', bold = false) {
    const g = this.g;
    g.fillStyle = col; g.font = (bold ? 'bold ' : '') + size + 'px Trebuchet MS'; g.textAlign = align;
    g.fillText(t, x, y);
  },
  bar(x, y, w, h, frac, col, bg = 'rgba(255,255,255,.12)') {
    const g = this.g;
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = col; g.fillRect(x, y, w * U.clamp(frac, 0, 1), h);
  },

  draw() {
    const g = this.g, W = this.cv.width, H = this.cv.height;
    g.clearRect(0, 0, W, H);
    this.drawStatus(16, 16);
    this.drawControls(16, 140);
    this.drawLureBar(16, H - 74);
    this.drawMinimap(W - 176, 16);
    this.drawReel(W - 120, H - 120);
    this.drawStatePanel(W / 2, H - 24);
    this.drawWorldLabels();
    Npcs.drawBubbles(this);
    this.drawCursorInfo();
    if (this.bigMap) this.drawBigMap(W, H);
  },

  drawStatus(x, y) {
    const e = Game.env, L = LURE_BY_ID[Fishing.lureId];
    this.panel(x, y, 250, 112);
    const hh = Math.floor(e.hour), mm = Math.floor((e.hour % 1) * 60);
    this.text('Day ' + e.day + '  ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  ' + TIME_NAMES[e.phase], x + 12, y + 22, '#f2c14e', 14, 'left', true);
    this.text(e.weather.name + '  ·  wind ' + Math.hypot(e.wind.x, e.wind.y).toFixed(1) + ' m/s', x + 12, y + 40, '#a99f8a');
    this.text(U.fmtMoney(Game.money) + '   creel ' + Game.creel.length + '/' + Game.creelMax, x + 12, y + 60, '#8fd16a', 14, 'left', true);
    this.text('Lure: ' + L.name + ' ×' + (Game.lures[L.id] || 0), x + 12, y + 80);
    this.text(Game.gear.line.name + ' · drag ' + Game.drag.toFixed(2) + ' kg', x + 12, y + 98, '#a99f8a', 12);
    const where = World.waterName(Fishing.lure ? Fishing.lure.x : Player.x, Fishing.lure ? Fishing.lure.y : Player.y);
    if (where) this.text(where, x + 238, y + 22, '#8ec7d6', 12, 'right');
  },

  // Live controls: only what you can do right now; urgent ones flash.
  controlRows() {
    const F = Fishing, st = F.state, rows = [];
    const r = (keys, label, opt = {}) => rows.push({ keys, label, ...opt });
    const flash = Math.sin(Game.time * 14) > 0;
    const k = World.shopkeeper;
    switch (st) {
      case 'idle':
        r(['WASD'], 'Walk  (Shift to run)');
        r(['Hold L'], 'Cast — let go at the peak', { hot: World.isWater(Input.mouse.wx, Input.mouse.wy) });
        if (U.dist(Player.x, Player.y, k.x, k.y) < 3) r(['E'], 'Tackle shack', { hot: true });
        else if (Npcs.near(Player.x, Player.y, 2.5)) r(['E'], 'Chat', { hot: true });
        r(['J'], 'Journal   ·   M  Map');
        break;
      case 'charging':
        r(['Let go'], 'at the peak!', { hot: true, flash: F.power > 0.9 && flash });
        break;
      case 'flying': r(['…'], 'Here it goes'); break;
      case 'line':
        if (F.engaged && F.engaged.state === 'strike') r(['Click'], 'SET THE HOOK!', { hot: true, flash });
        r(['Hold L'], 'Reel in — spin the mouse to go faster', { held: Input.mouse.down });
        r(['Right'], 'Twitch the lure', { held: Input.mouse.rdown });
        r(['Space'], 'Reel all the way in');
        break;
      case 'snagged':
        r(['Click'], 'Tug it free', { hot: true });
        r(['Space'], 'Cut the line');
        break;
      case 'fight': {
        const jump = Fight.mode === 'jump' || (Fight.fish && Fight.fish.airborne);
        if (jump) r(['Let go'], 'IT\'S JUMPING!', { hot: true, flash });
        else r(['Hold L'], 'Reel  (rod up)', { held: Input.mouse.down });
        r(['Mouse'], 'Point away from its run');
        r(['Wheel'], 'Drag — loosen if it screams', { hot: Fight.tension > Game.gear.line.strength * 0.8, flash: Fight.tension > Game.gear.line.strength * 0.9 && flash });
        break;
      }
    }
    return rows;
  },

  drawControls(x, y) {
    const g = this.g;
    if (!this.showControls) { this.text('[H] show controls', x + 4, y + 14, '#a99f8a', 12); return; }
    const rows = this.controlRows();
    const h = 30 + rows.length * 26;
    this.panel(x, y, 270, h);
    this.text('HOW TO', x + 12, y + 19, '#c9a86a', 11, 'left', true);
    this.text('H hide', x + 258, y + 19, '#a99f8a', 11, 'right');
    rows.forEach((row, i) => {
      const ry = y + 30 + i * 26;
      g.font = 'bold 12px Trebuchet MS';
      const key = row.keys[0];
      const w = Math.max(28, g.measureText(key).width + 14);
      g.fillStyle = row.flash ? '#f2c14e' : row.held ? '#8fd16a' : row.hot ? '#5a4a22' : '#2b3638';
      g.strokeStyle = row.hot || row.held ? '#f2c14e' : '#667'; g.lineWidth = 1;
      g.beginPath(); g.roundRect(x + 10, ry, w, 21, 5); g.fill(); g.stroke();
      g.fillStyle = row.flash || row.held ? '#1a1a1a' : '#f3ead6';
      g.textAlign = 'center'; g.fillText(key, x + 10 + w / 2, ry + 15);
      this.text(row.label, x + 18 + w, ry + 15, row.flash ? '#f2c14e' : row.hot ? '#f3ead6' : '#c8bfae', 13, 'left', row.hot);
    });
  },

  // Clickable lure bar along the bottom-left.
  drawLureBar(x, y) {
    const g = this.g;
    this.slots = [];
    LURES.forEach((L, i) => {
      const sx = x + i * 62, n = Game.lures[L.id] || 0, sel = Fishing.lureId === L.id;
      this.slots.push({ x: sx, y, w: 56, h: 58, id: L.id });
      g.fillStyle = sel ? 'rgba(201,168,106,.35)' : 'rgba(18,26,30,.82)';
      g.strokeStyle = sel ? '#f2c14e' : '#556'; g.lineWidth = sel ? 2 : 1;
      g.beginPath(); g.roundRect(sx, y, 56, 58, 7); g.fill(); g.stroke();
      g.globalAlpha = n ? 1 : 0.35;
      g.fillStyle = L.color; g.beginPath(); g.ellipse(sx + 28, y + 24, 13, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = L.accent; g.fillRect(sx + 24, y + 20, 8, 8);
      g.globalAlpha = 1;
      this.text(L.key, sx + 6, y + 13, '#a99f8a', 11);
      this.text('×' + n, sx + 50, y + 13, n ? '#f3ead6' : '#e2584d', 11, 'right');
      this.text(L.name.split(' ').pop(), sx + 28, y + 51, sel ? '#ffffff' : '#c8bfae', 11, 'center', sel);
    });
  },

  click(x, y) {
    for (const s of this.slots || []) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) { Fishing.selectLure(s.id); return true; }
    }
    return false;
  },

  drawMinimap(x, y) {
    const g = this.g, R = 80, s = 2;
    this.panel(x, y, 160, 160);
    g.save();
    g.beginPath(); g.rect(x + 4, y + 4, 152, 152); g.clip();
    g.imageSmoothingEnabled = false;
    g.drawImage(Art.minimap, Player.x - R / s, Player.y - R / s, R * 2 / s, R * 2 / s, x, y, 160, 160);
    for (const n of Npcs.list) {
      const nx = x + 80 + (n.x - Player.x) * s, ny = y + 80 + (n.y - Player.y) * s;
      g.fillStyle = n.palette.shirt; g.fillRect(nx - 2, ny - 2, 4, 4);
    }
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x + 80, y + 80, 3.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x + 80, y + 80);
    g.lineTo(x + 80 + Math.cos(Player.face) * 9, y + 80 + Math.sin(Player.face) * 9); g.stroke();
    g.restore();
    this.text('M: map', x + 152, y + 154, '#a99f8a', 11, 'right');
  },

  drawBigMap(W, H) {
    const g = this.g, size = Math.min(W, H) - 120;
    const x = (W - size) / 2, y = (H - size) / 2, k = size / World.W;
    this.panel(x - 10, y - 30, size + 20, size + 40);
    g.imageSmoothingEnabled = false;
    g.drawImage(Art.minimap, x, y, size, size);
    for (const l of World.lakes) if (l.kind === K.LAKE) this.text(l.name, x + l.x * k, y + (l.y - l.r - 2) * k, '#f3ead6', 12, 'center', true);
    this.text('Tackle shack', x + World.town.x * k, y + (World.town.y + 9) * k, '#f2c14e', 12, 'center', true);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + Player.x * k, y + Player.y * k, 5, 0, Math.PI * 2); g.fill();
    this.text('The valley — M to close', x, y - 10, '#f2c14e', 14, 'left', true);
  },

  // The spinning reel: drag the mouse in circles to turn the handle.
  drawReel(cx, cy) {
    const g = this.g, F = Fishing;
    this.panel(cx - 104, cy - 104, 208, 208);
    const spin = F.omega;
    // Spool
    g.fillStyle = '#2b3638'; g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2); g.fill();
    g.fillStyle = Game.gear.line.id.startsWith('braid') ? '#4aa04c' : '#d8d8d0';
    const fill = U.clamp(1 - F.lineOut / 60, 0.25, 1);
    g.beginPath(); g.arc(cx, cy, 30 + 22 * fill, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a6668'; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.fill();
    // Bail arm
    g.strokeStyle = F.bailOpen ? '#e2584d' : '#c9c9c9'; g.lineWidth = 5;
    g.beginPath(); g.arc(cx, cy, 64, F.bailOpen ? -2.6 : -0.6, F.bailOpen ? -1.9 : 2.6); g.stroke();
    // Handle
    const a = F.handle;
    const hx = cx + Math.cos(a) * 50, hy = cy + Math.sin(a) * 50;
    g.strokeStyle = '#c9a86a'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#e9d9a8'; g.beginPath(); g.arc(hx, hy, 9, 0, Math.PI * 2); g.fill();
    // Speed arc: green when a spinner would be thumping.
    const sweet = spin >= 1.0 && spin <= 2.8;
    g.strokeStyle = spin < 0.1 ? 'rgba(255,255,255,.15)' : sweet ? '#8fd16a' : spin > 2.8 ? '#e2584d' : '#f2c14e';
    g.lineWidth = 6;
    g.beginPath(); g.arc(cx, cy, 82, -Math.PI / 2, -Math.PI / 2 + U.clamp(spin / 4, 0, 1) * Math.PI * 2); g.stroke();
    this.text(spin.toFixed(1) + ' turns/s', cx, cy - 86 + 192, '#f3ead6', 12, 'center');
    this.text(F.bailOpen ? 'BAIL OPEN' : 'bail shut', cx, cy + 78, F.bailOpen ? '#e2584d' : '#a99f8a', 11, 'center', true);
    this.text(F.lineOut.toFixed(1) + ' m out', cx, cy - 88, '#a99f8a', 11, 'center');
  },

  drawStatePanel(cx, by) {
    const F = Fishing, L = LURE_BY_ID[F.lureId];
    const tips = {
    };
    if (F.state === 'fight') return this.drawFight(cx, by);
    if (F.state === 'charging') {
      const w = 320, x = cx - w / 2, y = by - 46;
      this.panel(x - 10, y - 26, w + 20, 62);
      this.bar(x, y, w, 18, F.power, F.power > 0.9 ? '#8fd16a' : '#f2c14e');
      this.g.fillStyle = 'rgba(143,209,106,.35)'; this.g.fillRect(x + w * 0.9, y, w * 0.1, 18);
      this.text('Release on the peak!  ' + Math.round(F.castDistance(F.power)) + ' m', cx, y - 8, '#f3ead6', 13, 'center', true);
      return;
    }
    if (F.state === 'line' && F.lure) {
      const l = F.lure, w = 360, x = cx - w / 2, y = by - 70;
      this.panel(x - 10, y - 24, w + 20, 86);
      const striking = F.engaged && F.engaged.state === 'strike';
      if (striking) { this.text('CLICK!  Set the hook!', cx, y - 4, Math.sin(Game.time * 30) > 0 ? '#f2c14e' : '#e2584d', 20, 'center', true); }
      else this.text(L.tip, cx, y - 4, '#f3ead6', 12, 'center');
      this.text('Lure action', x, y + 18, '#a99f8a', 12);
      this.bar(x + 80, y + 8, w - 80, 12, l.action, l.action > 0.7 ? '#8fd16a' : l.action > 0.35 ? '#f2c14e' : '#e2584d');
      const dep = World.depthAt(l.x, l.y);
      this.text(l.inWater ? 'Lure ' + l.z.toFixed(1) + ' m  /  bottom ' + dep.toFixed(1) + ' m' + (l.bottom ? '  · ticking bottom' : '') : 'Lure on land', x, y + 40, '#8ec7d6', 12);

      return;
    }
    if (F.state === 'snagged') {
      const w = 320, x = cx - w / 2, y = by - 40;
      this.panel(x - 10, y - 26, w + 20, 56);
      this.text('Snagged!  Click to tug it free  ·  Space to cut the line', cx, y - 6, '#f2c14e', 13, 'center', true);
      this.bar(x, y + 4, w, 10, F.snag.tension / Game.gear.line.strength, '#e2584d');
      return;
    }
    const t = tips[F.state];
    if (t) {
      const g = this.g;
      g.font = '14px Trebuchet MS';
      const w = g.measureText(t).width + 30;
      this.panel(cx - w / 2, by - 36, w, 32);
      this.text(t, cx, by - 15, '#f3ead6', 14, 'center');
    }
  },

  drawFight(cx, by) {
    const Fi = Fight, f = Fi.fish, line = Game.gear.line;
    if (!f) return;
    const w = 420, x = cx - w / 2, y = by - 120;
    this.panel(x - 12, y - 30, w + 24, 136);
    const g = this.g;
    this.text('Fish on!  ' + (f.airborne ? 'JUMPING!' : { run: 'Running hard', side: 'Bolting sideways', sulk: 'Sulking deep', jump: 'Coming up…', tire: 'Tiring' }[Fi.mode]),
      x, y - 10, f.airborne || Fi.mode === 'jump' ? '#f2c14e' : '#f3ead6', 15, 'left', true);
    // Tension gauge scaled to 120% of line strength with drag and break markers.
    const max = line.strength * 1.2, tf = Fi.tension / max;
    const danger = Fi.tension / line.strength;
    this.text('Tension', x, y + 14, '#a99f8a', 12);
    this.bar(x + 64, y + 4, w - 64, 14, tf, danger > 0.85 ? '#e2584d' : danger > 0.6 ? '#f2c14e' : '#8fd16a');
    const mark = (v, col) => { const mx = x + 64 + (w - 64) * U.clamp(v / max, 0, 1); g.fillStyle = col; g.fillRect(mx - 1, y, 3, 22); };
    mark(Game.drag, '#8ec7d6'); mark(line.strength, '#e2584d');
    this.text(Fi.tension.toFixed(1) + ' kg' + (Fi.slip > 0.5 ? '  — drag screaming' : ''), x + 64, y + 32, '#f3ead6', 11);
    this.text('drag ' + Game.drag.toFixed(2) + ' kg (wheel)', x + w, y + 32, '#8ec7d6', 11, 'right');
    this.text('Fish', x, y + 52, '#a99f8a', 12);
    this.bar(x + 64, y + 42, w - 64, 12, f.stamina, f.stamina < 0.32 ? '#8fd16a' : '#c9a86a');
    // Rod position widget: side strain and height.
    const rx = x + 34, ry = y + 82;
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2;
    g.strokeRect(rx - 30, ry - 14, 60, 28);
    g.fillStyle = Fi.rodLift < 0.25 ? '#f2c14e' : '#e9d9a8';
    g.beginPath(); g.arc(rx + Fi.rodSide * 24, ry + 10 - Fi.rodLift * 20, 5, 0, Math.PI * 2); g.fill();
    this.text('Hold to reel · point the mouse away from runs · let go on jumps', x + 74, y + 80, '#a99f8a', 12);
    if (Fi.slackT > 0.6) this.text('SLACK — crank!', x + 74, y + 98, '#e2584d', 14, 'left', true);
  },

  drawWorldLabels() {
    const k = World.shopkeeper;
    if (U.dist(Player.x, Player.y, k.x, k.y) < 3) {
      const [sx, sy] = Scene3D.project(k.x, k.y, 1.7);
      this.text('[E] Hettie\'s Tackle', sx, sy, '#f2c14e', 14, 'center', true);
    }
    const npc = Npcs.near(Player.x, Player.y, 2.5);
    if (npc && !npc.bubbleT && Fishing.state !== 'fight') {
      const [sx, sy] = Scene3D.project(npc.x, npc.y, 1.7);
      this.text('[E] chat to ' + npc.name, sx, sy, '#f2c14e', 13, 'center', true);
    }
    const f = Fight.fish;
    if (Fishing.state === 'fight' && f) {
      const [sx, sy, ok] = Scene3D.project(f.x, f.y, 0.4 + (f.airH || 0));
      if (ok && f.airborne) this.text(f.sp.name + '!', sx, sy - 10, '#f3ead6', 13, 'center', true);
    }
  },

  // Reading the water: depth and kind under the cursor.
  drawCursorInfo() {
    const m = Input.mouse;
    if (Menus.open || !World.isWater(m.wx, m.wy) || Fishing.state === 'fight') return;
    const d = World.depthAt(m.wx, m.wy), k = KIND_NAME[World.kindAt(m.wx, m.wy)];
    const dist = U.dist(Player.x, Player.y, m.wx, m.wy);
    this.text(d.toFixed(1) + ' m ' + k + ' · ' + dist.toFixed(0) + ' m away', m.sx + 16, m.sy + 26, 'rgba(230,248,250,.8)', 11);
  },
};
