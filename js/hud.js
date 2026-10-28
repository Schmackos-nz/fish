// 2D overlay: status, controls, action bar, reel, fishing and fight gauges, minimap, prompts.
'use strict';

// One palette and type scale for every piece of UI (canvas and DOM share these values).
const UI = {
  font: '"Inter", "Segoe UI", system-ui, sans-serif',
  display: '"Fraunces", Georgia, serif',
  card: 'rgba(11,16,19,0.78)', cardHi: 'rgba(20,28,32,0.9)', line: 'rgba(255,255,255,0.09)',
  ink: '#EEE7D7', muted: '#98A2A4', dim: '#626C6E',
  accent: '#E3A945', accentSoft: 'rgba(227,169,69,0.16)', good: '#7DC383', bad: '#E2675A', water: '#7FC4D4',
};

const Hud = {
  cv: null, g: null, toastT: 0, bigMap: false, showControls: true, slots: [], toolSlots: [],

  init() {
    this.cv = document.getElementById('hud');
    this.g = this.cv.getContext('2d');
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cv.width = innerWidth * dpr; this.cv.height = innerHeight * dpr;
      this.dpr = dpr;
    };
    fit(); window.addEventListener('resize', fit);
    try { this.showControls = localStorage.getItem('reelwild.controls') !== 'off'; } catch (e) { /* default on */ }
  },

  toggleControls() {
    this.showControls = !this.showControls;
    try { localStorage.setItem('reelwild.controls', this.showControls ? 'on' : 'off'); } catch (e) { /* ignore */ }
  },

  toast(text, color = UI.ink, time = 2) {
    if (Game.mode === 'title') return;
    const el = document.getElementById('toast');
    el.textContent = text; el.style.color = color; el.classList.add('show');
    this.toastT = time;
  },
  ripple(x, y, s) { Actors.ripple(x, y, s); },

  update(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) document.getElementById('toast').classList.remove('show'); }
  },

  // ---------- primitives ----------
  card(x, y, w, h, opt = {}) {
    const g = this.g;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    g.fillStyle = opt.fill || UI.card;
    g.beginPath(); g.roundRect(x, y, w, h, opt.r || 14); g.fill();
    g.restore();
    g.strokeStyle = opt.stroke || UI.line; g.lineWidth = 1;
    g.beginPath(); g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, opt.r || 14); g.stroke();
  },
  panel(x, y, w, h) { this.card(x, y, w, h); },
  text(t, x, y, col = UI.ink, size = 13, align = 'left', bold = false) {
    const g = this.g;
    if (typeof align === 'number') { bold = align; align = 'left'; } // text(..., size, weight) shorthand
    g.fillStyle = col; g.textAlign = align;
    g.font = (bold === true ? '600 ' : bold ? bold + ' ' : '400 ') + size + 'px ' + UI.font;
    g.fillText(t, x, y);
  },
  label(t, x, y, align = 'left') { // small caps-style section label
    const g = this.g;
    g.save();
    g.font = '600 10px ' + UI.font; g.fillStyle = UI.muted; g.textAlign = align;
    if ('letterSpacing' in g) g.letterSpacing = '1.5px';
    g.fillText(t.toUpperCase(), x, y);
    g.restore();
  },
  bar(x, y, w, h, frac, col, bg = 'rgba(255,255,255,0.08)') {
    const g = this.g;
    g.fillStyle = bg; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
    const fw = Math.max(0, w * U.clamp(frac, 0, 1));
    if (fw > 0.5) { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, Math.max(fw, h), h, h / 2); g.fill(); }
  },
  keycap(x, y, label, state = {}) {
    const g = this.g;
    g.font = '600 11px ' + UI.font;
    const w = Math.max(24, g.measureText(label).width + 14), h = 22;
    const bg = state.flash ? UI.accent : state.held ? UI.good : state.hot ? 'rgba(227,169,69,0.22)' : 'rgba(255,255,255,0.07)';
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.roundRect(x, y + 2, w, h, 6); g.fill();
    g.fillStyle = bg; g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill();
    g.strokeStyle = state.hot || state.flash ? 'rgba(227,169,69,0.7)' : 'rgba(255,255,255,0.14)'; g.lineWidth = 1;
    g.beginPath(); g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 6); g.stroke();
    g.fillStyle = state.flash || state.held ? '#141a1c' : UI.ink; g.textAlign = 'center';
    g.fillText(label, x + w / 2, y + 15);
    return w;
  },
  pill(t, cx, cy, col = UI.ink, size = 12) {
    const g = this.g;
    g.font = '600 ' + size + 'px ' + UI.font;
    const w = g.measureText(t).width + 18, h = size + 12;
    g.fillStyle = 'rgba(11,16,19,0.82)'; g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); g.fill();
    g.strokeStyle = UI.line; g.beginPath(); g.roundRect(cx - w / 2 + 0.5, cy - h / 2 + 0.5, w - 1, h - 1, h / 2); g.stroke();
    g.fillStyle = col; g.textAlign = 'center'; g.fillText(t, cx, cy + size * 0.36);
  },
  icon(kind, x, y, s = 1) {
    const g = this.g;
    g.save(); g.translate(x, y); g.scale(s, s);
    if (kind === 'sun') {
      g.fillStyle = UI.accent; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
      g.strokeStyle = UI.accent; g.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); g.stroke(); }
    } else if (kind === 'moon') {
      g.fillStyle = '#C9D6F2'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
      g.fillStyle = UI.cardHi; g.beginPath(); g.arc(3.5, -2.5, 6, 0, 7); g.fill();
    } else if (kind === 'coin') {
      g.fillStyle = UI.accent; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
      g.fillStyle = '#8a5f1c'; g.font = '700 9px ' + UI.font; g.textAlign = 'center'; g.fillText('$', 0, 3.5);
    } else if (kind === 'creel') {
      g.strokeStyle = UI.muted; g.lineWidth = 1.6;
      g.beginPath(); g.roundRect(-7, -4, 14, 10, 2); g.stroke(); g.beginPath(); g.moveTo(-4, -4); g.quadraticCurveTo(0, -10, 4, -4); g.stroke();
    } else if (kind === 'pin') {
      g.fillStyle = UI.water; g.beginPath(); g.arc(0, -2, 4.5, Math.PI, 0); g.lineTo(0, 7); g.closePath(); g.fill();
      g.fillStyle = UI.cardHi; g.beginPath(); g.arc(0, -2, 1.8, 0, 7); g.fill();
    }
    g.restore();
  },

  // ---------- frame ----------
  draw() {
    const g = this.g, d = this.dpr || 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(d, 0, 0, d, 0, 0);
    const W = innerWidth, H = innerHeight;
    this.drawWorldLabels();
    Npcs.drawBubbles(this);
    Floaters.drawBubbles(this);
    Animals.drawLabels(this);
    this.drawCursorInfo();
    const sh = this.drawStatus(20, 20);
    this.drawControls(20, 20 + sh + 12);
    this.drawMinimap(W - 20 - 82, 20 + 82);
    // Bottom stack: tools, then lures (rod only), then the context panel.
    const barY = H - 20 - 64;
    Tools.drawBar(this, W / 2, barY);
    let top = barY - 12;
    // Lures can only change with the line in, so the picker steps aside while you fish.
    if (Tools.current === 'rod' && Fishing.state === 'idle') { this.drawLureBar(W / 2, top - 50); top -= 62; } else this.slots = [];
    this.drawStatePanel(W / 2, top);
    if (Tools.current === 'rod' || Fishing.state !== 'idle') this.drawReel(W - 20 - 84, H - 20 - 84);
    Bugs.draw(g);
    Tools.drawOverlay(this);
    if (this.bigMap) this.drawBigMap(W, H);
  },

  drawStatus(x, y) {
    const e = Game.env, w = 248, h = 118;
    this.card(x, y, w, h);
    const hh = Math.floor(e.hour), mm = Math.floor((e.hour % 1) * 60);
    this.icon(e.daylight > 0.3 ? 'sun' : 'moon', x + 26, y + 28);
    this.text(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), x + 46, y + 34, UI.ink, 20, 700);
    this.text('Day ' + e.day + ' · ' + TIME_NAMES[e.phase], x + w - 16, y + 27, UI.muted, 12, 'right', 500);
    this.text(e.weather.name + ' · ' + Math.hypot(e.wind.x, e.wind.y).toFixed(1) + ' m/s wind', x + w - 16, y + 42, UI.dim, 11, 'right');
    this.g.fillStyle = UI.line; this.g.fillRect(x + 16, y + 54, w - 32, 1);
    this.icon('coin', x + 26, y + 76);
    this.text(U.fmtMoney(Game.money), x + 42, y + 82, UI.accent, 18, 700);
    this.text(Game.creel.length + ' / ' + Game.creelMax, x + w - 16, y + 81, UI.ink, 13, 'right', 600);
    this.icon('creel', x + w - 64, y + 76);
    const where = World.waterName(Fishing.lure ? Fishing.lure.x : Player.x, Fishing.lure ? Fishing.lure.y : Player.y) || 'The valley';
    this.icon('pin', x + 26, y + 102, 0.9);
    this.text(where, x + 38, y + 106, UI.water, 12, 500);
    return h;
  },

  // Live controls: only what you can do right now; urgent ones flash.
  controlRows() {
    const F = Fishing, st = F.state, rows = [];
    const r = (keys, label, opt = {}) => rows.push({ keys, label, ...opt });
    const flash = Math.sin(Game.time * 14) > 0;
    const k = World.shopkeeper;
    if (Bugs.list.some((b) => b.state !== 'leave')) r(['Click'], 'Swat the bugs', { hot: true, flash: Bugs.list.some((b) => b.state === 'land') && flash });
    if (st === 'idle') {
      r(['WASD'], 'Move · Shift run · C crouch' + (Player.crouch ? ' (on)' : ''), { held: Player.crouch });
      r(['Space'], 'Jump    Q  Dodge roll');
      const tool = Tools.current;
      if (tool === 'rod') { r(['Hold'], 'Cast — release at the peak', { hot: World.isWater(Input.mouse.wx, Input.mouse.wy) }); r(['Tab'], 'Next lure'); }
      else if (tool === 'gun') r(['Click'], 'Shoot · ' + (Game.ammo || 0) + ' shells', { hot: true });
      else if (tool === 'spray') r(['Click'], 'Spray · ' + (Game.spray || 0) + ' cans', { hot: Bugs.list.length > 0 });
      else if (tool === 'binos') r(['Hold'], 'Scout for fish & game', { held: Tools.looking });
      r(['1–4'], tool === 'hands' ? 'Equip a tool' : 'Switch tool');
      if (U.dist(Player.x, Player.y, k.x, k.y) < 3) r(['E'], 'Tackle shack', { hot: true });
      else if (Npcs.near(Player.x, Player.y, 2.5)) r(['E'], 'Chat', { hot: true });
      return rows;
    }
    switch (st) {
      case 'charging': r(['Release'], 'At the peak', { hot: true, flash: F.power > 0.9 && flash }); break;
      case 'flying': r(['…'], 'Line out'); break;
      case 'line':
        if (F.engaged && F.engaged.state === 'strike') r(['Click'], 'Set the hook!', { hot: true, flash });
        r(['Hold'], 'Reel · spin the mouse for speed', { held: Input.mouse.down });
        r(['Right'], 'Twitch the lure', { held: Input.mouse.rdown });
        r(['Space'], 'Reel all the way in');
        break;
      case 'snagged':
        if (F.snag && F.snag.where === 'floater') { r(['Hold'], 'Reel the sunbather in'); r(['Space'], 'Cut the line'); break; }
        r(['Click'], 'Tug it free', { hot: true });
        r(['Space'], 'Cut the line');
        break;
      case 'fight': {
        const jump = Fight.mode === 'jump' || (Fight.fish && Fight.fish.airborne);
        if (jump) r(['Release'], 'It\'s jumping!', { hot: true, flash });
        else r(['Hold'], 'Reel with the rod up', { held: Input.mouse.down });
        r(['Mouse'], 'Aim the rod away from runs');
        r(['Wheel'], 'Drag — ease off if it screams', { hot: Fight.tension > Game.gear.line.strength * 0.8, flash: Fight.tension > Game.gear.line.strength * 0.9 && flash });
        break;
      }
    }
    return rows;
  },

  drawControls(x, y) {
    if (!this.showControls) { this.keycap(x, y, 'H'); this.text('Show controls', x + 32, y + 15, UI.dim, 12); return; }
    const rows = this.controlRows();
    const w = 268, h = 40 + rows.length * 28;
    this.card(x, y, w, h);
    this.label('Controls', x + 16, y + 22);
    this.text('H to hide', x + w - 14, y + 22, UI.dim, 10, 'right');
    rows.forEach((row, i) => {
      const ry = y + 34 + i * 28;
      const kw = this.keycap(x + 14, ry, row.keys[0], row);
      this.text(row.label, x + 22 + Math.max(kw, 52), ry + 15, row.flash ? UI.accent : row.hot ? UI.ink : '#C9C4B8', 12, row.hot ? 600 : 400);
    });
  },

  // Hotbar slot shared by tools and lures.
  slot(x, y, w, h, sel, dim) {
    const g = this.g;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.fillStyle = sel ? 'rgba(227,169,69,0.18)' : UI.card;
    g.beginPath(); g.roundRect(x, y, w, h, 12); g.fill();
    g.restore();
    g.strokeStyle = sel ? UI.accent : UI.line; g.lineWidth = sel ? 1.5 : 1;
    g.beginPath(); g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12); g.stroke();
    if (dim) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.roundRect(x, y, w, h, 12); g.fill(); }
  },

  // Lure picker, centred above the tool bar while the rod is out.
  drawLureBar(cx, y) {
    const g = this.g, sw = 64, gap = 6, n = LURES.length;
    const x0 = cx - (n * sw + (n - 1) * gap) / 2;
    this.slots = [];
    LURES.forEach((L, i) => {
      const sx = x0 + i * (sw + gap), cnt = Game.lures[L.id] || 0, sel = Fishing.lureId === L.id;
      this.slots.push({ x: sx, y, w: sw, h: 44, id: L.id });
      this.slot(sx, y, sw, 44, sel, !cnt);
      g.fillStyle = L.color; g.beginPath(); g.ellipse(sx + 18, y + 17, 9, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = L.accent; g.fillRect(sx + 16, y + 15, 5, 5);
      this.text('×' + cnt, sx + sw - 8, y + 21, cnt ? UI.ink : UI.bad, 11, 'right', 600);
      this.text(L.name.split(' ').pop(), sx + sw / 2, y + 37, sel ? UI.ink : UI.muted, 10, 'center', sel ? 600 : 400);
    });
  },

  click(x, y) {
    if (Bugs.swat(x, y)) return true;
    const hit = (s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
    for (const s of this.toolSlots) if (hit(s)) { Tools.select(s.id); return true; }
    for (const s of this.slots) if (hit(s)) { Fishing.selectLure(s.id); return true; }
    return false;
  },

  // Round minimap with a compass ring.
  drawMinimap(cx, cy) {
    const g = this.g, R = 76, s = 1.6;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    g.fillStyle = UI.card; g.beginPath(); g.arc(cx, cy, R + 6, 0, 7); g.fill();
    g.restore();
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    g.imageSmoothingEnabled = false;
    g.drawImage(Art.minimap, Player.x - R / s, Player.y - R / s, R * 2 / s, R * 2 / s, cx - R, cy - R, R * 2, R * 2);
    for (const n of Npcs.list) {
      const nx = cx + (n.x - Player.x) * s, ny = cy + (n.y - Player.y) * s;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(nx, ny, 3, 0, 7); g.fill();
      g.fillStyle = n.palette.shirt; g.beginPath(); g.arc(nx, ny, 2, 0, 7); g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    // Player arrow
    g.save(); g.translate(cx, cy); g.rotate(Player.face);
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -5); g.lineTo(-2, 0); g.lineTo(-5, 5); g.closePath(); g.stroke(); g.fill();
    g.restore();
    // North marker
    g.fillStyle = UI.accent; g.beginPath(); g.arc(cx, cy - R - 1, 9, 0, 7); g.fill();
    this.text('N', cx, cy - R + 3, '#141a1c', 10, 'center', 700);
    this.keycap(cx - 12 - 30, cy + R + 12, 'M');
    this.text('Map', cx - 10, cy + R + 27, UI.muted, 11);
  },

  drawBigMap(W, H) {
    const g = this.g, size = Math.min(W, H) - 140;
    const x = (W - size) / 2, y = (H - size) / 2 + 10, k = size / World.W;
    g.fillStyle = 'rgba(4,7,9,0.6)'; g.fillRect(0, 0, W, H);
    this.card(x - 16, y - 52, size + 32, size + 68, { fill: UI.cardHi, r: 18 });
    this.text('The Valley', x, y - 22, UI.ink, 20, 700);
    this.text('M or Esc to close', x + size, y - 22, UI.dim, 12, 'right');
    g.save(); g.beginPath(); g.roundRect(x, y, size, size, 10); g.clip();
    g.imageSmoothingEnabled = false;
    g.drawImage(Art.minimap, x, y, size, size);
    g.restore();
    for (const l of World.lakes) if (l.kind === K.LAKE) this.pill(l.name, x + l.x * k, y + (l.y - l.r - 2) * k, UI.ink, 11);
    this.pill('Tackle shack', x + World.town.x * k, y + (World.town.y + 9) * k, UI.accent, 11);
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.arc(x + Player.x * k, y + Player.y * k, 6, 0, 7); g.stroke(); g.fill();
  },

  // The spinning reel: hold to crank, spin the mouse for speed.
  drawReel(cx, cy) {
    const g = this.g, F = Fishing, spin = F.omega;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    g.fillStyle = UI.card; g.beginPath(); g.arc(cx, cy, 84, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = UI.line; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 84, 0, 7); g.stroke();
    // Speed gauge ring
    const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
    g.lineCap = 'round'; g.lineWidth = 6;
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(cx, cy, 72, a0, a0 + span); g.stroke();
    g.strokeStyle = 'rgba(125,195,131,0.35)'; g.beginPath(); g.arc(cx, cy, 72, a0 + span * 0.25, a0 + span * 0.7); g.stroke();
    const sweet = spin >= 1.0 && spin <= 2.8;
    g.strokeStyle = spin < 0.1 ? 'transparent' : sweet ? UI.good : spin > 2.8 ? UI.bad : UI.accent;
    g.beginPath(); g.arc(cx, cy, 72, a0, a0 + span * U.clamp(spin / 4, 0, 1)); g.stroke();
    g.lineCap = 'butt';
    // Spool
    g.fillStyle = '#1d2629'; g.beginPath(); g.arc(cx, cy, 50, 0, 7); g.fill();
    const fill = U.clamp(1 - F.lineOut / 60, 0.25, 1);
    g.fillStyle = Game.gear.line.id.startsWith('braid') ? '#58A85C' : '#D9D6CC';
    g.beginPath(); g.arc(cx, cy, 24 + 22 * fill, 0, 7); g.fill();
    g.fillStyle = '#3A4548'; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill();
    // Bail
    g.strokeStyle = F.bailOpen ? UI.bad : 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, 57, F.bailOpen ? -2.6 : -0.6, F.bailOpen ? -1.9 : 2.6); g.stroke();
    // Handle
    const a = F.handle, hx = cx + Math.cos(a) * 40, hy = cy + Math.sin(a) * 40;
    g.strokeStyle = UI.accent; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(hx, hy); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = '#F2E3B8'; g.beginPath(); g.arc(hx, hy, 7, 0, 7); g.fill();
    this.text(spin.toFixed(1), cx, cy + 66, UI.ink, 15, 'center', 700);
    this.text('turns / s', cx, cy + 79, UI.dim, 9, 'center');
    this.pill(F.lineOut.toFixed(1) + ' m out', cx, cy - 98, UI.muted, 10);
  },

  // Context panel above the hotbars.
  drawStatePanel(cx, bottom) {
    const F = Fishing, L = LURE_BY_ID[F.lureId], g = this.g;
    if (Gun.out) {
      this.pill('Shotgun · ' + (Game.ammo || 0) + ' shells', cx, bottom - 14, UI.bad, 13);
      return;
    }
    if (F.state === 'fight') return this.drawFight(cx, bottom);
    if (F.state === 'charging') {
      const w = 340, h = 64, x = cx - w / 2, y = bottom - h;
      this.card(x, y, w, h);
      this.label('Cast power', x + 18, y + 22);
      this.text(Math.round(F.castDistance(F.power)) + ' m', x + w - 18, y + 22, UI.ink, 12, 'right', 600);
      this.bar(x + 18, y + 34, w - 36, 12, F.power, F.power > 0.9 ? UI.good : UI.accent);
      g.fillStyle = 'rgba(125,195,131,0.4)'; g.fillRect(x + 18 + (w - 36) * 0.9, y + 31, 2, 18);
      return;
    }
    if (F.state === 'line' && F.lure) {
      const l = F.lure, w = 380, h = 92, x = cx - w / 2, y = bottom - h;
      const striking = F.engaged && F.engaged.state === 'strike';
      this.card(x, y, w, h, striking ? { stroke: UI.accent } : {});
      if (striking) this.text('Click — set the hook!', cx, y + 26, Math.sin(Game.time * 30) > 0 ? UI.accent : UI.ink, 17, 'center', 700);
      else this.text(L.tip, cx, y + 24, '#C9C4B8', 12, 'center');
      this.label('Lure action', x + 18, y + 52);
      this.bar(x + 110, y + 44, w - 128, 10, l.action, l.action > 0.7 ? UI.good : l.action > 0.35 ? UI.accent : UI.bad);
      const dep = World.depthAt(l.x, l.y);
      this.label('Depth', x + 18, y + 76);
      this.text(l.inWater ? l.z.toFixed(1) + ' m of ' + dep.toFixed(1) + ' m' + (l.bottom ? ' · ticking bottom' : '') : 'On land', x + 110, y + 76, UI.water, 12, 500);
      return;
    }
    if (F.state === 'snagged') {
      const w = 380, h = 64, x = cx - w / 2, y = bottom - h;
      this.card(x, y, w, h, { stroke: 'rgba(227,169,69,0.5)' });
      this.text(F.snag.where === 'floater' ? 'You hooked a lilo — reel them in, or Space to cut' : 'Snagged — click to tug it free, or Space to cut', cx, y + 26, UI.accent, 13, 'center', 600);
      this.bar(x + 18, y + 40, w - 36, 8, F.snag.tension / Game.gear.line.strength, UI.bad);
    }
  },

  drawFight(cx, bottom) {
    const Fi = Fight, f = Fi.fish, line = Game.gear.line, g = this.g;
    if (!f) return;
    const w = 440, h = 132, x = cx - w / 2, y = bottom - h;
    const jumping = f.airborne || Fi.mode === 'jump';
    this.card(x, y, w, h, jumping ? { stroke: UI.accent } : {});
    this.text('Fish on', x + 18, y + 28, UI.ink, 17, 700);
    const mode = f.airborne ? 'Jumping!' : { run: 'Running hard', side: 'Bolting sideways', sulk: 'Sulking deep', jump: 'Coming up…', tire: 'Tiring' }[Fi.mode];
    g.font = '600 11px ' + UI.font;
    const mw = g.measureText(mode).width + 18;
    g.fillStyle = jumping ? UI.accent : UI.accentSoft; g.beginPath(); g.roundRect(x + 96, y + 14, mw, 20, 10); g.fill();
    this.text(mode, x + 96 + mw / 2, y + 28, jumping ? '#141a1c' : UI.accent, 11, 'center', 600);
    this.text('Drag ' + Game.drag.toFixed(2) + ' kg', x + w - 18, y + 28, UI.water, 12, 'right', 600);
    // Tension gauge: zones, live fill, drag and breaking-strain markers.
    const gx = x + 18, gw = w - 36, gy = y + 52, max = line.strength * 1.2;
    this.label('Line tension', gx, gy - 8);
    this.text(Fi.tension.toFixed(1) + ' / ' + line.strength + ' kg', gx + gw, gy - 8, Fi.slip > 0.5 ? UI.bad : UI.muted, 11, 'right', 600);
    const grd = g.createLinearGradient(gx, 0, gx + gw, 0);
    grd.addColorStop(0, 'rgba(125,195,131,0.25)'); grd.addColorStop(0.6, 'rgba(227,169,69,0.25)'); grd.addColorStop(0.83, 'rgba(226,103,90,0.35)');
    g.fillStyle = grd; g.beginPath(); g.roundRect(gx, gy, gw, 14, 7); g.fill();
    const danger = Fi.tension / line.strength;
    const tw = gw * U.clamp(Fi.tension / max, 0, 1);
    if (tw > 1) { g.fillStyle = danger > 0.85 ? UI.bad : danger > 0.6 ? UI.accent : UI.good; g.beginPath(); g.roundRect(gx, gy, Math.max(tw, 14), 14, 7); g.fill(); }
    const mark = (v, col) => { const mx = gx + gw * U.clamp(v / max, 0, 1); g.fillStyle = col; g.fillRect(mx - 1, gy - 4, 2, 22); };
    mark(Game.drag, UI.water); mark(line.strength, UI.bad);
    // Fish stamina
    this.label('Fish strength', gx, gy + 36);
    this.bar(gx + 104, gy + 28, gw - 104, 10, f.stamina, f.stamina < 0.32 ? UI.good : UI.accent);
    // Rod position
    const rx = gx + 30, ry = y + h - 22;
    g.strokeStyle = UI.line; g.lineWidth = 1; g.beginPath(); g.roundRect(rx - 30, ry - 14, 60, 28, 6); g.stroke();
    g.fillStyle = Fi.rodLift < 0.25 ? UI.accent : UI.ink;
    g.beginPath(); g.arc(rx + Fi.rodSide * 24, ry + 10 - Fi.rodLift * 20, 4.5, 0, 7); g.fill();
    if (Fi.slackT > 0.6) this.text('Slack line — reel!', gx + 76, ry + 5, UI.bad, 13, 'left', 700);
    else this.text('Rod position · hold to raise, release to drop', gx + 76, ry + 5, UI.dim, 11);
  },

  drawWorldLabels() {
    const k = World.shopkeeper;
    if (U.dist(Player.x, Player.y, k.x, k.y) < 3) {
      const [sx, sy] = Scene3D.project(k.x, k.y, 1.9);
      this.pill('E  ·  Hettie\'s Tackle', sx, sy, UI.accent, 12);
    }
    const npc = Npcs.near(Player.x, Player.y, 2.5);
    if (npc && !npc.bubbleT && Fishing.state !== 'fight') {
      const [sx, sy] = Scene3D.project(npc.x, npc.y, 1.9);
      this.pill('E  ·  Chat to ' + npc.name, sx, sy, UI.accent, 12);
    }
    const f = Fight.fish;
    if (Fishing.state === 'fight' && f && f.airborne) {
      const [sx, sy, ok] = Scene3D.project(f.x, f.y, 0.4 + (f.airH || 0));
      if (ok) this.pill(f.sp.name, sx, sy - 16, UI.ink, 12);
    }
  },

  // Reading the water: depth and kind under the cursor.
  drawCursorInfo() {
    const m = Input.mouse;
    if (Menus.open || Tools.looking || !World.isWater(m.wx, m.wy) || Fishing.state === 'fight') return;
    const d = World.depthAt(m.wx, m.wy), k = KIND_NAME[World.kindAt(m.wx, m.wy)];
    const dist = U.dist(Player.x, Player.y, m.wx, m.wy);
    this.text(d.toFixed(1) + ' m ' + k + ' · ' + dist.toFixed(0) + ' m', m.sx + 16, m.sy + 28, 'rgba(230,248,250,0.85)', 11, 500);
  },
};
