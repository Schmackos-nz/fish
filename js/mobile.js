// Phones and tablets: landscape-only, fullscreen, with a thumbstick on the left and buttons on the right.
// Touches on the world act like the mouse (tap to shoot, hold-and-release on water to cast, drag the reel).
'use strict';

const Mobile = {
  active: false, joy: null, ptr: null, held: {}, labelT: 0,

  detect() {
    const q = new URLSearchParams(location.search);
    return q.has('mobile') || (matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
  },

  // The HUD is drawn at a virtual size and scaled to fit small landscape screens.
  hudScale() {
    if (!this.active && innerHeight >= 700) return 1;
    return U.clamp(Math.min(innerHeight / 620, innerWidth / 1100), 0.5, 1);
  },

  // Notch / rounded-corner insets (landscape phones), read once per resize.
  insets() {
    if (!this.active) return { l: 0, r: 0 };
    if (!this._ins) {
      if (!this._probe) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)'; document.body.appendChild(d); this._probe = d; }
      const cs = getComputedStyle(this._probe);
      this._ins = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
    }
    return this._ins;
  },

  fsSupported() { return !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen); },
  isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  portrait() { return innerHeight > innerWidth; },

  // Fullscreen first (the orientation lock needs it), then pin the screen to landscape.
  goFull() {
    if (!this.active) return;
    const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
    const lock = () => { try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not supported */ } };
    if (req && !this.isFull()) {
      try { const p = req.call(el, { navigationUI: 'hide' }); if (p && p.then) p.then(lock, () => {}); else lock(); } catch (e) { lock(); }
    } else lock();
  },

  // Play only happens sideways and (where the browser allows it) fullscreen.
  blocking() {
    if (!this.active) return false;
    if (this.portrait()) return 'rotate';
    if (Game.mode !== 'title' && this.fsSupported() && !this.isFull()) return 'full';
    return false;
  },

  init() {
    this.active = this.detect();
    document.body.classList.toggle('touch', this.active);
    if (!this.active) return;
    Hud.showControls = false;
    const ui = document.createElement('div');
    ui.id = 'touchUI'; ui.className = 'hidden';
    ui.innerHTML = `
      <div class="tside"><button data-key="Escape" aria-label="Pause">❚❚</button><button data-key="KeyI" aria-label="Bag">🎒</button><button data-key="KeyM" aria-label="Map">🗺️</button><button data-key="KeyJ" aria-label="Journal">📖</button></div>
      <div id="tJoy"><div class="knob"></div></div>
      <div class="tpad">
        <button id="tUse" data-key="KeyE" class="use"><b>E</b><span></span></button>
        <button id="tScope" data-hold="scope">Scope</button>
        <button id="tCrouch" data-key="KeyC">Crouch</button>
        <button id="tJump" data-key="Space">Jump</button>
      </div>`;
    document.body.appendChild(ui);
    const gate = document.createElement('div');
    gate.id = 'gate'; gate.className = 'hidden';
    gate.innerHTML = '<div class="gate-card"><div class="gate-icon">📱↻</div><b></b><span></span></div>';
    document.body.appendChild(gate);
    gate.addEventListener('click', () => this.goFull());
    this.ui = ui; this.gate = gate; this.knob = ui.querySelector('.knob'); this.joyEl = ui.querySelector('#tJoy');

    // Buttons: press = key down this frame and held until release.
    ui.querySelectorAll('button').forEach((b) => {
      const down = (e) => {
        e.preventDefault(); e.stopPropagation();
        Sfx.init();
        if (b.dataset.hold === 'scope') { Input.mouse.rdown = true; Input.rPressed = true; }
        else { Input.down.add(b.dataset.key); Input.keys.add(b.dataset.key); }
        b.classList.add('on');
      };
      const up = (e) => {
        e.preventDefault();
        if (b.dataset.hold === 'scope') Input.mouse.rdown = false; else Input.keys.delete(b.dataset.key);
        b.classList.remove('on');
      };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
    });

    // The game surface: left side steers, everything else is the "mouse".
    const hud = document.getElementById('hud');
    hud.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const x = t.clientX, y = t.clientY;
        if (!this.ptr) {
          // Toolbar, lure bar, reel, bugs… HUD things always win.
          Input.mouse.sx = x; Input.mouse.sy = y;
          if (Hud.click(x, y)) { this.ptr = { id: t.identifier, hud: true }; continue; }
        }
        if (!this.joy && x < innerWidth * 0.42 && Game.mode === 'play') { this.joy = { id: t.identifier, x0: x, y0: y, dx: 0, dy: 0 }; this.showJoy(); continue; }
        if (!this.ptr) { this.ptr = { id: t.identifier }; Input.ptrDown(x, y, true); }
      }
    }, { passive: false });
    hud.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy.dx = t.clientX - this.joy.x0; this.joy.dy = t.clientY - this.joy.y0; this.showJoy(); }
        else if (this.ptr && t.identifier === this.ptr.id) Input.ptrMove(t.clientX, t.clientY);
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.showJoy(); }
        else if (this.ptr && t.identifier === this.ptr.id) { this.ptr = null; Input.ptrUp(); }
      }
    };
    hud.addEventListener('touchend', end); hud.addEventListener('touchcancel', end);
    // Keep the browser from scrolling, zooming or pulling-to-refresh mid-fight.
    document.addEventListener('touchmove', (e) => { if (!e.target.closest('.panel, .sheet, .modal')) e.preventDefault(); }, { passive: false });
    document.addEventListener('fullscreenchange', () => this.refreshGate());
    addEventListener('resize', () => { this._ins = null; this.refreshGate(); });
  },

  showJoy() {
    const j = this.joy, R = 56;
    this.joyEl.classList.toggle('live', !!j);
    if (!j) { this.knob.style.transform = ''; this.joyEl.style.left = this.joyEl.style.top = ''; return; }
    const d = Math.hypot(j.dx, j.dy), k = d > R ? R / d : 1;
    this.joyEl.style.left = (j.x0 - 70) + 'px'; this.joyEl.style.top = (j.y0 - 70) + 'px';
    this.knob.style.transform = `translate(${j.dx * k}px, ${j.dy * k}px)`;
  },

  refreshGate() {
    if (!this.active) return;
    const b = this.blocking();
    this.gate.classList.toggle('hidden', !b);
    if (b) {
      this.gate.querySelector('b').textContent = b === 'rotate' ? 'Turn your phone sideways' : 'Tap to play fullscreen';
      this.gate.querySelector('span').textContent = b === 'rotate' ? 'Grand Trout Auto VI only plays in landscape.' : 'The valley needs the whole screen.';
    }
  },

  // Thumbstick → WASD (+ Shift when pushed all the way), and context labels on the buttons.
  update(dt) {
    if (!this.active) return;
    const k = Input.keys;
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) if (this.held[c]) { k.delete(c); this.held[c] = false; }
    const j = this.joy;
    if (j) {
      const d = Math.hypot(j.dx, j.dy);
      if (d > 12) {
        const a = Math.atan2(j.dy, j.dx), set = (c) => { k.add(c); this.held[c] = true; };
        if (Math.cos(a) > 0.38) set('KeyD'); if (Math.cos(a) < -0.38) set('KeyA');
        if (Math.sin(a) > 0.38) set('KeyS'); if (Math.sin(a) < -0.38) set('KeyW');
        if (d > 50) set('ShiftLeft');
      }
    }
    this.refreshGate();
    this.labelT -= dt;
    if (this.labelT > 0) return;
    this.labelT = 0.2;
    const play = Game.mode === 'play' && !Menus.open && !Hud.bigMap;
    this.ui.classList.toggle('hidden', !play);
    if (!play) return;
    const act = Fishing.state !== 'fight' ? Interact.best() : null;
    const use = this.ui.querySelector('#tUse');
    use.classList.toggle('hidden', !act || Fishing.state !== 'idle');
    if (act) use.querySelector('span').textContent = act.label;
    this.ui.querySelector('#tJump').textContent = Fishing.state !== 'idle' ? 'Reel in' : 'Jump';
    this.ui.querySelector('#tCrouch').classList.toggle('hidden', Fishing.state !== 'idle');
    this.ui.querySelector('#tScope').classList.toggle('hidden', !(Gun.out && Arsenal.weapon().scope));
    // Clear the reel: the button stack moves left of it while it's on screen.
    const r = Hud.reel ? (172 + Hud.reel.r + 60) * Hud.k : 0;
    this.ui.querySelector('.tpad').style.right = (r ? r : 16) + this.insets().r + 'px';
    this.ui.querySelector('.tside').style.top = Math.round(292 * Hud.k + 10) + 'px';
  },
};
