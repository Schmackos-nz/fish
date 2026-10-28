// Game state, input, clock/weather, save/load and the main loop.
'use strict';

const SAVE_KEY = 'reelwild.save.v1';
const CRANK_STATES = new Set(['line', 'fight', 'snagged', 'knot']);

const Input = {
  keys: new Set(), down: new Set(), mouse: { sx: 0, sy: 0, wx: 0, wy: 0, down: false, rdown: false },
  mousePressed: false, rPressed: false, wheel: 0, crank: 0, crankAcc: 0, lastHeading: null, segX: 0, segY: 0,
  pressed(code) { return this.down.has(code); },
  endFrame() { this.down.clear(); this.mousePressed = false; this.rPressed = false; this.wheel = 0; },

  init(target) {
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(e.code)) this.down.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mousePressed = true; this.lastHeading = null; this.segX = this.segY = 0; }
      if (e.button === 2) { this.mouse.rdown = true; this.rPressed = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouse.down = false; this.lastHeading = null; }
      if (e.button === 2) this.mouse.rdown = false;
    });
    addEventListener('mousemove', (e) => {
      this.mouse.sx = e.clientX; this.mouse.sy = e.clientY;
      if (!this.mouse.down) return;
      // Circling the mouse turns the reel: track how the movement heading rotates.
      this.segX += e.movementX; this.segY += e.movementY;
      if (Math.hypot(this.segX, this.segY) < 7) return;
      const h = Math.atan2(this.segY, this.segX);
      if (this.lastHeading !== null) {
        const d = U.angDiff(this.lastHeading, h);
        if (Math.abs(d) < 1.3) this.crankAcc += d;
      }
      this.lastHeading = h; this.segX = this.segY = 0;
    });
    target.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
};

const Game = {
  time: 0, money: 0, lures: {}, owned: [], gear: null, drag: 2, creel: [], creelMax: 8, journal: {},
  stats: { caught: 0, released: 0 }, seed: 1, running: false,
  env: { hour: 6, day: 1, phase: 0, daylight: 0.5, weather: WEATHERS[0], weatherT: 3, wind: { x: 0.5, y: 0.2 }, visibility: 1 },

  newGame(seed) {
    this.seed = seed;
    this.money = 40;
    this.lures = { spinner: 4, spoon: 1, crank: 0, popper: 0, worm: 15 };
    this.owned = ['willow', 'basic', 'mono3'];
    this.gear = { rod: RODS[0], reel: REELS[0], line: LINES[0] };
    this.drag = 1.75; this.creel = []; this.creelMax = 8; this.journal = {};
    this.stats = { caught: 0, released: 0 };
    Object.assign(this.env, { hour: 6, day: 1, weather: WEATHERS[0], weatherT: 3 });
  },

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        seed: this.seed, money: this.money, lures: this.lures, owned: this.owned, drag: this.drag,
        gear: { rod: this.gear.rod.id, reel: this.gear.reel.id, line: this.gear.line.id },
        creel: this.creel, creelMax: this.creelMax, journal: this.journal, stats: this.stats,
        px: Player.x, py: Player.y, hour: this.env.hour, day: this.env.day, weather: this.env.weather.id,
      }));
    } catch (e) { /* storage unavailable: play on without saving */ }
  },

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!s) return null;
      this.newGame(s.seed);
      Object.assign(this, { money: s.money, lures: s.lures, owned: s.owned, drag: s.drag, creel: s.creel, creelMax: s.creelMax, journal: s.journal, stats: s.stats });
      this.gear = {
        rod: RODS.find((r) => r.id === s.gear.rod) || RODS[0],
        reel: REELS.find((r) => r.id === s.gear.reel) || REELS[0],
        line: LINES.find((r) => r.id === s.gear.line) || LINES[0],
      };
      Object.assign(this.env, { hour: s.hour, day: s.day, weather: WEATHERS.find((w) => w.id === s.weather) || WEATHERS[0] });
      return s;
    } catch (e) { return null; }
  },

  updateEnv(dt) {
    const e = this.env;
    e.hour += dt * 24 / 1200; // a day lasts 20 minutes
    if (e.hour >= 24) { e.hour -= 24; e.day++; }
    const h = e.hour;
    e.phase = h >= 5 && h < 8 ? 0 : h >= 8 && h < 17 ? 1 : h >= 17 && h < 20 ? 2 : 3;
    e.daylight = h < 5 || h >= 21 ? 0 : h < 8 ? U.smooth((h - 5) / 3) : h < 18 ? 1 : U.smooth(1 - (h - 18) / 3);
    e.weatherT -= dt * 24 / 1200;
    if (e.weatherT <= 0) {
      e.weatherT = 2 + Math.random() * 4;
      const next = U.weighted(Math.random, WEATHERS, (w) => (w.id === 'clear' ? 5 : w.id === 'cloudy' ? 3 : 2));
      if (next !== e.weather) { e.weather = next; Hud.toast('The weather turns: ' + next.name, '#8ec7d6', 2.5); }
    }
    e.wind.x = U.clamp(e.wind.x + (Math.random() - 0.5) * dt * 0.4, -3, 3);
    e.wind.y = U.clamp(e.wind.y + (Math.random() - 0.5) * dt * 0.4, -3, 3);
    e.visibility = (0.45 + 0.55 * e.daylight) * (e.weather.id === 'rain' ? 0.8 : 1);
    Sfx.setAmbient(this.nearRunningWater(), e.weather.id === 'rain' ? 1 : 0);
  },

  nearRunningWater() {
    let best = 0;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      for (const r of [1, 3, 6]) {
        const k = World.kindAt(Player.x + Math.cos(a) * r, Player.y + Math.sin(a) * r);
        if (k === K.STREAM || k === K.RIVER) best = Math.max(best, 1 - r / 8);
      }
    }
    return best;
  },
};

function buildWorld(seed, savedPos) {
  World.generate(seed);
  Art.buildSprites();
  Art.buildMinimap();
  Scene3D.build();
  Fish.reset(); Fishing.reset();
  if (savedPos && !World.blocked(savedPos.x, savedPos.y)) Player.place(savedPos.x, savedPos.y);
  else Player.place(World.spawn.x, World.spawn.y);
  Scene3D.target.set(Player.x, 0, Player.y);
}

function start(fresh) {
  Sfx.init();
  const title = document.getElementById('title');
  title.querySelector('p').textContent = 'Carving the valley…';
  // Let the message paint before the heavy generation.
  setTimeout(() => {
    let saved = fresh ? null : Game.load();
    if (!saved) { Game.newGame((Math.random() * 1e9) | 0); }
    buildWorld(Game.seed, saved ? { x: saved.px, y: saved.py } : null);
    title.classList.add('hidden');
    Game.running = true;
    Game.save();
    Hud.toast('Walk to the water, press SPACE to open the bail', '#f3ead6', 4);
  }, 30);
}

function handleGlobalKeys() {
  if (Input.pressed('Escape')) { Menus.close(); Hud.bigMap = false; }
  if (Menus.open === 'catch') return;
  if (Input.pressed('KeyJ')) Menus.toggleJournal();
  if (Input.pressed('KeyM')) Hud.bigMap = !Hud.bigMap;
  if (Menus.open) return;
  for (const L of LURES) if (Input.pressed('Digit' + L.key)) Fishing.selectLure(L.id);
  const k = World.shopkeeper;
  if (Input.pressed('KeyE') && Fishing.state !== 'fight' && U.dist(Player.x, Player.y, k.x, k.y) < 3) Menus.openShop();
  if (Fishing.state !== 'fight' && Input.wheel) Scene3D.camDist = U.clamp(Scene3D.camDist + Input.wheel * 1.5, 8, 34);
}

let last = performance.now(), saveT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (Game.running) {
    const w = Scene3D.screenToWorld(Input.mouse.sx, Input.mouse.sy);
    Input.mouse.wx = w.x; Input.mouse.wy = w.y;
    Input.crank = CRANK_STATES.has(Fishing.state) && !Menus.open ? Input.crankAcc : 0;
    Input.crankAcc = 0;
    handleGlobalKeys();
    if (!Menus.open) {
      Game.time += dt;
      Game.updateEnv(dt);
      Player.update(dt);
      Fishing.update(dt);
      Fish.update(dt, Player, Fishing.lure, Game.env);
    }
    Hud.update(dt);
    // Frame the action: drift the camera toward the lure or the hooked fish.
    let fx = Player.x, fy = Player.y;
    const tgt = Fight.fish || Fishing.lure;
    if (tgt && Fishing.state !== 'flying') { fx = U.lerp(Player.x, tgt.x, 0.38); fy = U.lerp(Player.y, tgt.y, 0.38); }
    Scene3D.updateCamera(dt, { x: fx, y: fy });
    Scene3D.updateEnv(Game.env, dt);
    Actors.update(dt, Game.env);
    Scene3D.render(Game.time);
    Hud.draw();
    saveT += dt;
    if (saveT > 20) { saveT = 0; Game.save(); }
  }
  Input.endFrame();
  requestAnimationFrame(frame);
}

window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  Scene3D.init(canvas);
  Actors.init();
  Hud.init();
  Input.init(document.getElementById('hud'));
  let hasSave = false;
  try { hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) { /* no storage */ }
  document.getElementById('startBtn').textContent = hasSave ? 'Continue' : 'Go fishing';
  document.getElementById('startBtn').onclick = () => start(false);
  document.getElementById('newBtn').onclick = () => start(true);
  requestAnimationFrame(frame);
});
