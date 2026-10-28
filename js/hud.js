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
    this.drawWorldLabels();
    Npcs.drawBubbles(this);
    Floaters.drawCensors(this);
    Floaters.drawBubbles(this);
    Swimmers.drawBubbles(this);
    Couples.drawCensor(this);
    Tim.drawBubble(this);
    Bikes.drawBubbles(this);
    Hunters.drawBubbles(this);
    Poison.draw(this);
    Animals.drawLabels(this);
    Wardens.drawLabels(this);
    if (!Mobile.active) this.drawCursorInfo();
    Bugs.draw(g);
    Tools.drawOverlay(this);
    Gun.drawScope(this);
    Wanted.drawWorld(this);
    this.drawGunCursor();
    // Panels are laid out on a virtual screen, scaled down to fit phones.
    const k = this.k = Mobile.hudScale();
    g.setTransform(d * k, 0, 0, d * k, 0, 0);
    const W = this.W = innerWidth / k, H = this.H = innerHeight / k;
    const sh = this.drawStatus(20, 20);
    if (Mobile.active) this.drawVitals(20, 20 + sh + 12 + 100);
    this.drawMinimap(W - 20 - 82, 20 + 82);
    drawWindSock(this, W - 20 - 164 - 44, 52);
    Contest.drawHud(this, W - 20 - 82, 222);
    // Bottom stack: tools, then lures (rod only), then the context panel.
    const barY = H - 20 - 64;
    Tools.drawBar(this, W / 2, barY);
    if (!Mobile.active) this.drawVitals(20, H - 20);
    let top = barY - 12;
    // Lures can only change with the line in, so the picker steps aside while you fish.
    if (Tools.current === 'rod' && Fishing.state === 'idle') { this.drawLureBar(W / 2, top - 50); top -= 62; } else this.slots = [];
    this.drawStatePanel(W / 2, top);
    if ((Tools.current === 'rod' && !Mobile.active) || Fishing.state !== 'idle') this.drawReel(W - 146, H - 176); else this.reel = null;
    Wanted.drawHud(this);
    if (this.bigMap) this.drawBigMap(W, H);
  },

  // Rounds left (and the reload) right by the mouse while a gun is out.
  drawGunCursor() {
    if (!Gun.out || Mobile.active || Menus.open || Game.mode !== 'play' || Gun.scoped) return;
    const g = this.g, W = Arsenal.weapon(), n = Arsenal.ammo(W.ammo), m = Input.mouse;
    const x = m.sx + 18, y = m.sy + 16;
    // Reload ring round the cursor.
    if (Gun.cooldown > 0) {
      g.strokeStyle = 'rgba(243,234,214,0.85)'; g.lineWidth = 3;
      g.beginPath(); g.arc(m.sx, m.sy, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - Gun.cooldown / W.cd)); g.stroke();
    }
    const shown = Math.min(n, 10), bw = 4, gap = 2, w = Math.max(48, shown * (bw + gap) + 30);
    g.fillStyle = 'rgba(20,16,12,0.78)'; g.beginPath(); g.roundRect(x, y, w, 22, 8); g.fill();
    for (let i = 0; i < shown; i++) {
      const bx = x + 6 + i * (bw + gap);
      g.fillStyle = '#E3B04A'; g.beginPath(); g.roundRect(bx, y + 6, bw, 11, [2, 2, 1, 1]); g.fill();
      g.fillStyle = '#B07A2A'; g.fillRect(bx, y + 14, bw, 3);
    }
    this.text(String(n), x + w - 8, y + 15, n ? UI.ink : UI.bad, 12, 'right', 700);
  },

  drawStatus(x, y) {
    const e = Game.env, w = 248, h = 118;
    this.card(x, y, w, h);
    const hh = Math.floor(e.hour), mm = Math.floor((e.hour % 1) * 60);
    this.icon(e.daylight > 0.3 ? 'sun' : 'moon', x + 26, y + 28);
    this.text(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), x + 46, y + 34, UI.ink, 20, 700);
    this.text(WEEKDAYS[(e.day - 1) % 7] + ' · Day ' + e.day + ' · ' + TIME_NAMES[e.phase], x + w - 16, y + 27, UI.muted, 12, 'right', 500);
    this.text(e.weather.name + ' · ' + Math.hypot(e.wind.x, e.wind.y).toFixed(1) + ' m/s wind', x + w - 16, y + 42, UI.dim, 11, 'right');
    this.g.fillStyle = UI.line; this.g.fillRect(x + 16, y + 54, w - 32, 1);
    this.icon('coin', x + 26, y + 76);
    this.text(U.fmtMoney(Game.money), x + 42, y + 82, UI.accent, 18, 700);
    this.text(Game.creel.length + ' / ' + Game.creelMax, x + w - 16, y + 81, UI.ink, 13, 'right', 600);
    this.icon('creel', x + w - 64, y + 76);
    const where = Interior.active ? Interior.active.b.name : World.waterName(Fishing.lure ? Fishing.lure.x : Player.x, Fishing.lure ? Fishing.lure.y : Player.y) || 'The valley';
    this.icon('pin', x + 26, y + 102, 0.9);
    this.text(where, x + 38, y + 106, UI.water, 12, 500);
    // Permit status for the water you're fishing (or looking at).
    const px = Fishing.lure ? Fishing.lure.x : Input.mouse.wx, py = Fishing.lure ? Fishing.lure.y : Input.mouse.wy;
    const zone = Permits.zoneAt(px, py) || Permits.zoneAt(Player.x, Player.y);
    if (zone && !Interior.active) {
      const ok = Permits.has(zone);
      this.text(ok ? '✓ Permit' : '✗ No permit', x + w - 16, y + 106, ok ? UI.good : UI.bad, 11, 'right', 600);
    }
    return h;
  },

  // Vitals: health, food and energy, bottom-left.
  drawVitals(x, by) {
    const g = this.g, w = 232, rows = [
      ['❤', 'Health', Wanted.health, '#E2584D'],
      ['🍗', 'Food', Game.food, '#E3A945'],
      ['⚡', 'Energy', Game.energy, '#7FC4D4'],
    ];
    const h = 22 + rows.length * 26, y = by - h;
    this.card(x, y, w, h);
    if (Game.poison) this.pill('☠ Poisoned — get to the Clinic', x + w / 2, y - 16, '#A8E05A', 12);
    rows.forEach(([icon, name, v, col], i) => {
      const ry = y + 16 + i * 26, low = v < 20, blink = low && Math.sin(Game.time * 8) > 0;
      this.text(icon, x + 14, ry + 10, '#fff', 14);
      this.label(name, x + 36, ry + 9);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(x + 96, ry, w - 146, 12, 6); g.fill();
      const fw = (w - 146) * U.clamp(v / 100, 0, 1);
      if (fw > 1) { g.fillStyle = blink ? '#FFFFFF' : low ? UI.bad : col; g.beginPath(); g.roundRect(x + 96, ry, Math.max(fw, 12), 12, 6); g.fill(); }
      this.text(String(Math.round(v)), x + w - 14, ry + 10, low ? UI.bad : UI.ink, 12, 'right', 600);
    });
  },

  // Live controls: only what you can do right now; urgent ones flash.
  controlRows() {
    const F = Fishing, st = F.state, rows = [];
    const r = (keys, label, opt = {}) => rows.push({ keys, label, ...opt });
    const flash = Math.sin(Game.time * 14) > 0;
    const k = World.shopkeeper;
    if (Wanted.level > 0) r(['★'.repeat(Wanted.level)], Wanted.hidden ? 'Hidden — stay put till it cools' : 'Wanted! Hide in a bush, or crouch in a forest', { hot: true, flash: Wanted.seen && flash });
    if (Wardens.anyChasing()) r(['Shift'], 'Warden on your tail — run! (Q to roll)', { hot: true, flash });
    else if (Permits.fishingIllegally()) r(['!'], 'No permit for this water — wardens patrol', { hot: true });
    if (Bugs.list.some((b) => Bugs.swattable(b))) r(['Click'], 'Swat the bug on you', { hot: true, flash: Bugs.list.some((b) => b.state === 'land') && flash });
    if (Bikes.riding) {
      r(['WASD'], 'Ride');
      r(['Space'], 'Jump');
      r(['E'], 'Get off and park', { hot: true });
      return rows;
    }
    if (st === 'idle') {
      r(['WASD'], 'Move · Shift run · C crouch' + (Player.crouch ? ' (on)' : ''), { held: Player.crouch });
      r(['Space'], 'Jump    Shift+C  Slide');
      const tool = Tools.current;
      if (tool === 'rod') { r(['Hold'], 'Cast — release at the peak', { hot: World.isWater(Input.mouse.wx, Input.mouse.wy) }); r(['Tab'], 'Next lure'); }
      else if (tool === 'axe') { r(['Click'], 'Chop the tree in front · ' + (Game.wood || 0) + ' wood', { hot: !!Camp.treeInFront() }); if ((Game.wood || 0) >= FIRE_COST) r(['E'], 'Build a campfire (' + FIRE_COST + ' wood)'); }
      else if (tool === 'gun') {
        const W = Arsenal.weapon();
        if (W.scope) r(['Right'], 'Hold to look down the scope', { held: Gun.scoped, hot: !Gun.scoped });
        r([W.auto ? 'Hold' : 'Click'], 'Fire ' + W.short.toLowerCase() + ' · ' + Arsenal.ammo(W.ammo) + ' left', { hot: true });
        if (Game.guns.length > 1) r(['2'], 'Next gun');
      }
      else if (tool === 'spray') r(['Click'], 'Spray · ' + (Game.spray || 0) + ' cans', { hot: Bugs.list.length > 0 });
      else if (tool === 'binos') r(['Hold'], 'Scout for fish & game', { held: Tools.looking });
      else if (tool === 'hands') r(['Click'], 'Punch');
      r(['1–4'], tool === 'hands' ? 'Equip a tool' : 'Switch tool');
      if (this.act) r(['E'], this.act.label, { hot: true });
      r(['I'], 'Bag · eat food');
      return rows;
    }
    switch (st) {
      case 'charging': r(['Release'], 'At the peak', { hot: true, flash: F.power > 0.9 && flash }); break;
      case 'flying': r(['…'], 'Line out'); break;
      case 'line':
        if (F.engaged && F.engaged.state === 'strike') r(['Click'], 'Set the hook!', { hot: true, flash });
        r(['Reel'], 'Grab the handle, drag it round ↻', { held: Input.reelGrab, hot: !Input.reelGrab });
        r(['Right'], 'Twitch the lure', { held: Input.mouse.rdown });
        r(['Bail'], 'Click the lever to let line run free');
        r(['Space'], 'Reel all the way in');
        break;
      case 'snagged':
        if (F.snag && F.snag.where === 'floater') { r(['Reel'], 'Crank the sunbather in'); r(['Space'], 'Cut the line'); break; }
        r(['Click'], 'Tug it free', { hot: true });
        r(['Reel'], 'Crank hard to break it off');
        r(['Space'], 'Cut the line');
        break;
      case 'fight': {
        const jump = Fight.mode === 'jump' || (Fight.fish && Fight.fish.airborne);
        if (jump) r(['Let go'], 'Release the reel — it\'s jumping!', { hot: true, flash });
        else r(['Reel'], 'Crank the handle — rod comes up', { held: Input.reelGrab });
        r(['A / D'], 'Lean the rod against its run', { held: Input.keys.has('KeyA') || Input.keys.has('KeyD') });
        r(['Wheel'], 'Drag − / + (or the reel buttons)', { hot: Fight.tension > Game.gear.line.strength * 0.8, flash: Fight.tension > Game.gear.line.strength * 0.9 && flash });
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
    if (this.bigMap) {
      x /= this.k || 1; y /= this.k || 1;
      for (const t of this.travelRects || []) if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) { Travel.go(t.d); return true; }
      return true;
    }
    if (Bugs.swat(x, y)) return true;
    const k = this.k || 1; x /= k; y /= k; // into the scaled HUD's coordinates
    const hit = (s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
    if (this.reel) {
      if (this.bailBtn && hit(this.bailBtn)) { Fishing.toggleBail(); return true; }
      for (const b of this.dragBtns || []) if (hit(b)) { Fight.setDrag(Game.drag + b.d); return true; }
      if (U.dist(x, y, this.reel.cx, this.reel.cy) < this.reel.r) {
        // Grab the reel: any point on its face starts the turn from where you clicked.
        if (CRANK_STATES.has(Fishing.state)) { Input.reelGrab = true; Input.reelAng = Math.atan2(y - this.reel.cy, x - this.reel.cx); Input.mouse.down = true; }
        return true;
      }
    }
    for (const s of this.toolSlots) if (hit(s)) { Tools.select(s.id); return true; }
    for (const s of this.slots) if (hit(s)) { Fishing.selectLure(s.id); return true; }
    return false;
  },

  // Round minimap with a compass ring.
  drawMinimap(cx, cy) {
    if (Interior.active) { this.card(cx - 82, cy - 30, 164, 60, { r: 30 }); this.text('Indoors', cx, cy + 5, UI.muted, 13, 'center', 600); return; }
    const g = this.g, R = 76, s = 1.6;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    g.fillStyle = UI.card; g.beginPath(); g.arc(cx, cy, R + 6, 0, 7); g.fill();
    g.restore();
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    g.imageSmoothingEnabled = false;
    g.drawImage(Art.minimap, Player.x - R / s, Player.y - R / s, R * 2 / s, R * 2 / s, cx - R, cy - R, R * 2, R * 2);
    for (const u of Wanted.units) {
      if (u.ko) continue;
      const nx = cx + (u.x - Player.x) * s, ny = cy + (u.y - Player.y) * s;
      g.fillStyle = u.army ? '#7A8A3A' : (Math.sin(Game.time * 12) > 0 ? '#E2584D' : '#3A6AD2');
      g.beginPath(); g.arc(nx, ny, 3.5, 0, 7); g.fill();
    }
    for (const wd of Wardens.list) {
      if (U.dist(wd.x, wd.y, Player.x, Player.y) > 48) continue;
      const nx = cx + (wd.x - Player.x) * s, ny = cy + (wd.y - Player.y) * s;
      g.fillStyle = wd.state === 'chase' ? UI.bad : '#C9B98A'; g.strokeStyle = '#141a1c'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(nx, ny - 5); g.lineTo(nx + 4.5, ny + 3.5); g.lineTo(nx - 4.5, ny + 3.5); g.closePath(); g.fill(); g.stroke();
    }
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
    this.text('Click a place to travel there (costs time) · M to close', x + size, y - 22, UI.dim, 12, 'right');
    g.save(); g.beginPath(); g.roundRect(x, y, size, size, 10); g.clip();
    g.imageSmoothingEnabled = false;
    g.drawImage(Art.minimap, x, y, size, size);
    g.restore();
    // Quick-travel stops: click one to go there (costs in-game time).
    this.travelRects = [];
    for (const d of Travel.dests()) {
      const px = x + d.x * k, py = y + d.y * k, h = Travel.cost(d), lbl = d.name + ' · ' + (h < 1 ? Math.round(h * 60) + 'm' : h.toFixed(1) + 'h');
      const g2 = this.g; g2.font = '600 11px ' + UI.font;
      const tw = g2.measureText(lbl).width + 18;
      const hover = Math.abs(Input.mouse.sx - px) < tw / 2 && Math.abs(Input.mouse.sy - py) < 12;
      this.pill(lbl, px, py, d.home ? UI.good : hover ? UI.accent : UI.ink, 11);
      this.travelRects.push({ x: px - tw / 2, y: py - 12, w: tw, h: 24, d });
    }
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.arc(x + Player.x * k, y + Player.y * k, 6, 0, 7); g.stroke(); g.fill();
  },

  // The reel: grab the handle and drag it round. Flanked by line tension (left) and drag (right).
  drawReel(cx, cy) {
    const g = this.g, F = Fishing, spin = F.omega, R = 96;
    const active = CRANK_STATES.has(F.state);
    this.reel = { cx, cy, r: R };
    // Body
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 22; g.shadowOffsetY = 8;
    g.fillStyle = UI.card; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = Input.reelGrab ? UI.accent : UI.line; g.lineWidth = Input.reelGrab ? 2 : 1;
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    // Speed ring (green band = a spinner's sweet spot)
    const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
    g.lineCap = 'round'; g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.arc(cx, cy, R - 10, a0, a0 + span); g.stroke();
    g.strokeStyle = 'rgba(125,195,131,0.3)'; g.beginPath(); g.arc(cx, cy, R - 10, a0 + span * 0.25, a0 + span * 0.7); g.stroke();
    if (spin > 0.1) {
      g.strokeStyle = spin >= 1 && spin <= 2.8 ? UI.good : spin > 2.8 ? UI.bad : UI.accent;
      g.beginPath(); g.arc(cx, cy, R - 10, a0, a0 + span * U.clamp(spin / 4, 0, 1)); g.stroke();
    }
    g.lineCap = 'butt';
    // Spool and rotor
    g.fillStyle = '#1d2629'; g.beginPath(); g.arc(cx, cy, 52, 0, 7); g.fill();
    const fill = U.clamp(1 - F.lineOut / 60, 0.25, 1);
    g.fillStyle = Game.gear.line.id.startsWith('braid') ? '#58A85C' : '#D9D6CC';
    g.beginPath(); g.arc(cx, cy, 24 + 24 * fill, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
    for (let r = 28; r < 24 + 24 * fill; r += 4) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
    g.fillStyle = '#3A4548'; g.beginPath(); g.arc(cx, cy, 18, 0, 7); g.fill();
    // Bail arm drawn on the reel face
    g.strokeStyle = F.bailOpen ? UI.bad : 'rgba(255,255,255,0.6)'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, 58, F.bailOpen ? -2.7 : -0.5, F.bailOpen ? -1.8 : 2.6); g.stroke();
    // Handle: arm + big knob you grab
    const ha = Input.reelGrab ? Input.reelAng : F.handle;
    const hx = cx + Math.cos(ha) * 66, hy = cy + Math.sin(ha) * 66;
    g.strokeStyle = '#C9A86A'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(hx, hy); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = '#5A4A32'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill();
    g.save();
    if (Input.reelGrab) { g.shadowColor = UI.accent; g.shadowBlur = 16; }
    g.fillStyle = Input.reelGrab ? UI.accent : '#F2E3B8'; g.beginPath(); g.arc(hx, hy, 14, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, 14, 0, 7); g.stroke();
    // Prompt: a circling arrow until you grab it
    if (active && !Input.reelGrab) {
      const t = Game.time * 2;
      g.strokeStyle = 'rgba(227,169,69,0.55)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.lineDashOffset = -t * 8;
      g.beginPath(); g.arc(cx, cy, 66, 0, 7); g.stroke(); g.setLineDash([]);
      this.pill('Drag the handle ↻', cx, cy - R - 26, UI.accent, 11);
    } else {
      this.text(spin.toFixed(1) + ' turns/s', cx, cy + R - 20, UI.muted, 10, 'center', 600);
    }
    this.pill(F.lineOut.toFixed(1) + ' m out', cx, cy - R - 2, UI.muted, 10);

    // ---- Line tension (left) ----
    const tx = cx - R - 30, ty = cy - R + 6, th = R * 2 - 12, tw = 14, strength = Game.gear.line.strength;
    let tension = 0, slack = false;
    if (F.state === 'fight') tension = Fight.tension;
    else if (F.state === 'snagged' && F.snag) tension = F.snag.tension;
    else if (F.state === 'line' && F.lure && !F.bailOpen) {
      const d = U.dist(F.tip.x, F.tip.y, F.lure.x, F.lure.y);
      slack = F.lineOut - d > 0.6;
      tension = slack ? 0 : 0.15 + F.lure.speed * 0.35;
    }
    const max = strength * 1.2;
    const grd = g.createLinearGradient(0, ty + th, 0, ty);
    grd.addColorStop(0, 'rgba(125,195,131,0.22)'); grd.addColorStop(0.6, 'rgba(227,169,69,0.25)'); grd.addColorStop(0.85, 'rgba(226,103,90,0.4)');
    g.fillStyle = grd; g.beginPath(); g.roundRect(tx, ty, tw, th, 7); g.fill();
    g.strokeStyle = UI.line; g.beginPath(); g.roundRect(tx + 0.5, ty + 0.5, tw - 1, th - 1, 7); g.stroke();
    const tf = U.clamp(tension / max, 0, 1), danger = tension / strength;
    if (tf > 0.01) {
      g.fillStyle = danger > 0.85 ? UI.bad : danger > 0.6 ? UI.accent : UI.good;
      g.beginPath(); g.roundRect(tx, ty + th * (1 - tf), tw, Math.max(th * tf, 8), 7); g.fill();
    }
    const markY = (v) => ty + th * (1 - U.clamp(v / max, 0, 1));
    g.fillStyle = UI.water; g.fillRect(tx - 4, markY(Game.drag) - 1, tw + 8, 2);
    g.fillStyle = UI.bad; g.fillRect(tx - 4, markY(strength) - 1, tw + 8, 2);
    this.label('Tension', tx + tw / 2, ty + th + 18, 'center');
    this.text(F.bailOpen ? 'free' : slack ? 'slack' : tension.toFixed(1) + 'kg', tx + tw / 2, ty - 8, F.bailOpen || slack ? UI.accent : danger > 0.85 ? UI.bad : UI.ink, 10, 'center', 600);

    // ---- Drag (right) with -/+ ----
    const dx = cx + R + 16, dw = 14, dy = cy - R + 30, dh = R * 2 - 60;
    this.dragBtns = [{ x: dx - 4, y: cy - R + 2, w: 22, h: 22, d: 0.25 }, { x: dx - 4, y: cy + R - 24, w: 22, h: 22, d: -0.25 }];
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.roundRect(dx, dy, dw, dh, 7); g.fill();
    const df = U.clamp(Game.drag / Game.gear.reel.maxDrag, 0, 1);
    g.fillStyle = UI.water; g.beginPath(); g.roundRect(dx, dy + dh * (1 - df), dw, Math.max(dh * df, 8), 7); g.fill();
    for (const b of this.dragBtns) {
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 6); g.fill();
      g.strokeStyle = UI.line; g.beginPath(); g.roundRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 6); g.stroke();
      this.text(b.d > 0 ? '+' : '−', b.x + b.w / 2, b.y + 16, UI.ink, 15, 'center', 700);
    }
    this.label('Drag', dx + dw / 2, ty + th + 18, 'center');
    this.text(Game.drag.toFixed(2) + 'kg', dx + dw / 2, cy - R - 6, UI.water, 10, 'center', 600);

    // ---- Bail lever ----
    const bw = 116, bh = 26, bx = cx - bw / 2, by = cy + R + 16;
    this.bailBtn = { x: bx, y: by, w: bw, h: bh };
    g.fillStyle = F.bailOpen ? 'rgba(226,103,90,0.18)' : 'rgba(255,255,255,0.07)';
    g.beginPath(); g.roundRect(bx, by, bw, bh, 13); g.fill();
    g.strokeStyle = F.bailOpen ? 'rgba(226,103,90,0.6)' : UI.line; g.beginPath(); g.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 13); g.stroke();
    // little toggle knob
    const kx = F.bailOpen ? bx + bw - 15 : bx + 15;
    g.fillStyle = F.bailOpen ? UI.bad : UI.muted; g.beginPath(); g.arc(kx, by + bh / 2, 7, 0, 7); g.fill();
    this.text(F.bailOpen ? 'Bail open' : 'Bail closed', F.bailOpen ? bx + 46 : bx + bw / 2 + 10, by + 17, F.bailOpen ? UI.bad : UI.ink, 11, 'center', 600);
  },

  // Context panel above the hotbars.
  drawStatePanel(cx, bottom) {
    const F = Fishing, L = LURE_BY_ID[F.lureId], g = this.g;
    if (Bikes.riding) {
      const sp = Math.hypot(Bikes.vel.x, Bikes.vel.y);
      this.pill(BIKE_BY_ID[Game.bike.id].name + '  ·  ' + Game.bike.plate + (Bikes.permitted() ? '' : ' (NO PERMIT)') + '  ·  ' + Math.round(sp * 3.6) + ' km/h  ·  fuel ' + Math.round(Game.fuel) + '%', cx, bottom - 14, Game.fuel < 15 || !Bikes.permitted() ? UI.bad : UI.ink, 13);
      return;
    }
    if (Gun.out) {
      const W = Arsenal.weapon();
      this.pill(W.name + ' · ' + Arsenal.ammo(W.ammo) + ' ' + AMMO[W.ammo].name.toLowerCase() + (W.scope && !Gun.scoped ? ' · right-click to scope' : '') + (Game.guns.length > 1 ? ' · 2 to switch' : ''), cx, bottom - 14, UI.bad, 13);
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
    const Fi = Fight, f = Fi.fish, g = this.g;
    if (!f) return;
    const w = 400, h = 104, x = cx - w / 2, y = bottom - h;
    const jumping = f.airborne || Fi.mode === 'jump';
    this.card(x, y, w, h, jumping ? { stroke: UI.accent } : {});
    this.text('Fish on', x + 18, y + 28, UI.ink, 17, 700);
    const mode = f.airborne ? 'Jumping — let go!' : { run: 'Running hard', side: 'Bolting sideways', sulk: 'Sulking deep', jump: 'Coming up…', tire: 'Tiring' }[Fi.mode];
    g.font = '600 11px ' + UI.font;
    const mw = g.measureText(mode).width + 18;
    g.fillStyle = jumping ? UI.accent : UI.accentSoft; g.beginPath(); g.roundRect(x + 96, y + 14, mw, 20, 10); g.fill();
    this.text(mode, x + 96 + mw / 2, y + 28, jumping ? '#141a1c' : UI.accent, 11, 'center', 600);
    if (Fi.slip > 0.5) this.text('Drag screaming!', x + w - 18, y + 28, UI.bad, 12, 'right', 700);
    this.label('Fish strength', x + 18, y + 58);
    this.bar(x + 122, y + 50, w - 140, 10, f.stamina, f.stamina < 0.32 ? UI.good : UI.accent);
    // Rod position
    const rx = x + 48, ry = y + h - 22;
    g.strokeStyle = UI.line; g.lineWidth = 1; g.beginPath(); g.roundRect(rx - 30, ry - 12, 60, 24, 6); g.stroke();
    g.fillStyle = Fi.rodLift < 0.25 ? UI.accent : UI.ink;
    g.beginPath(); g.arc(rx + Fi.rodSide * 24, ry + 8 - Fi.rodLift * 16, 4.5, 0, 7); g.fill();
    if (Fi.slackT > 0.6) this.text('Slack line — crank!', x + 96, ry + 5, UI.bad, 13, 'left', 700);
    else this.text('Rod · A/D lean · crank lifts, let go drops', x + 96, ry + 5, UI.dim, 11);
  },

  drawWorldLabels() {
    // One prompt for whatever E will do right now.
    const act = Fishing.state === 'idle' && !Menus.open ? Interact.best() : null;
    this.act = act;
    if (act) {
      const [sx, sy, ok] = Scene3D.project(act.x, act.y, Scene3D.standH(act.x, act.y) + 1.9);
      if (ok) this.pill('E  ·  ' + act.label, sx, sy, UI.accent, 12);
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
