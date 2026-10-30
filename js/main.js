// Game state, input, clock/weather, save/load and the main loop.
'use strict';

const SAVE_KEY = 'reelwild.save.v1';
const CRANK_STATES = new Set(['line', 'fight', 'snagged']);

const Input = {
  keys: new Set(), down: new Set(), mouse: { sx: 0, sy: 0, wx: 0, wy: 0, down: false, rdown: false },
  mousePressed: false, rPressed: false, mPressed: false, wheel: 0, crank: 0, crankAcc: 0, reelGrab: false, reelAng: 0,
  pressed(code) { return this.down.has(code); },
  endFrame() { this.down.clear(); this.mousePressed = false; this.rPressed = false; this.mPressed = false; this.wheel = 0; },

  // The primary pointer (mouse button 0, or a finger on the world).
  ptrDown(x, y, touch) {
    this.mouse.sx = x; this.mouse.sy = y;
    if (!touch && Hud.click(x, y)) return; // HUD buttons eat the click (touch already asked)
    this.mouse.down = true; this.mousePressed = true;
  },
  ptrUp() { this.mouse.down = false; this.reelGrab = false; },
  ptrMove(x, y) { this.mouse.sx = x; this.mouse.sy = y; },


  init(target) {
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(e.code)) this.down.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.reelGrab = false; });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.ptrDown(e.clientX, e.clientY);
      if (e.button === 2) { this.mouse.rdown = true; this.rPressed = true; }
      if (e.button === 1) { this.mPressed = true; e.preventDefault(); } // middle-click: bail
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.ptrUp();
      if (e.button === 2) this.mouse.rdown = false;
    });
    addEventListener('mousemove', (e) => this.ptrMove(e.clientX, e.clientY));
    target.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
};

const Game = {
  time: 0, money: 0, lures: {}, owned: [], gear: null, drag: 2, creel: [], creelMax: 8, journal: {},
  stats: { caught: 0, released: 0 }, seed: 1, mode: 'title', npcRecords: {},
  env: { hour: 6, day: 1, phase: 0, daylight: 0.5, weather: WEATHERS[0], weatherT: 3, wind: { x: 0.5, y: 0.2 }, visibility: 1 },

  newGame(seed) {
    this.seed = seed;
    this.money = 40;
    this.lures = { spinner: 4, spoon: 1, crank: 0, popper: 0, worm: 15 };
    this.owned = ['willow', 'basic', 'mono3'];
    this.gear = { rod: RODS[0], reel: REELS[0], line: LINES[0] };
    this.drag = 1.75; this.creel = []; this.creelMax = 8; this.journal = {};
    this.stats = { caught: 0, released: 0 };
    this.npcRecords = {};
    this.ammo = 12; this.guns = ['rifle']; this.weapon = 'rifle'; this.ammoX = { light: 0, shells: 0, rockets: 0 };
    this.wood = 0; this.chopped = []; this.fires = [];
    this.energy = 100; this.food = 100; this.pantry = [{ name: 'Bread roll', energy: 15 }, { name: 'Bread roll', energy: 15 }];
    this.ingredients = { batter: 0, herbs: 0 }; this.storage = emptyStorage();
    this.bike = null; this.fuel = 0; this.vpermits = []; this.contest = null; this.trophies = []; this.poison = null; this.picked = {}; this.decay = { b: {}, rubbish: [] }; this.staff = null; this.townAway = []; this.thief = null; this.safes = {}; this.repute = 0; this.bladder = 10; this.bowels = 5; this.holes = []; this.poos = []; this.smears = []; this.hotbar = DEFAULT_HOTBAR.slice(); this.waypoint = null; this.impound = null; this.boat = null; this.inmates = {};
    this.home = null; this.rentDebt = 0; this.lastDay = 1; this.weed = 0; this.seeds = 0; this.plants = [];
    this.permits = { town: true }; // the town lake permit comes with the cabin
    this.spray = 3;
    Object.assign(this.env, { hour: 6, day: 1, weather: WEATHERS[0], weatherT: 3 });
  },

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        seed: this.seed, money: this.money, lures: this.lures, owned: this.owned, drag: this.drag,
        gear: { rod: this.gear.rod.id, reel: this.gear.reel.id, line: this.gear.line.id },
        creel: this.creel, creelMax: this.creelMax, journal: this.journal, stats: this.stats, npcRecords: this.npcRecords, ammo: this.ammo, spray: this.spray, permits: this.permits, guns: this.guns, weapon: this.weapon, ammoX: this.ammoX, wood: this.wood, chopped: this.chopped, fires: (Camp.group ? Camp.fires : this.fires).map((f) => ({ x: f.x, y: f.y, until: f.until })), energy: this.energy, food: this.food, pantry: this.pantry, ingredients: this.ingredients, storage: this.storage, home: this.home, rentDebt: this.rentDebt, lastDay: this.lastDay, weed: this.weed, seeds: this.seeds, plants: this.plants, bike: this.bike, fuel: this.fuel, vpermits: this.vpermits, contest: this.contest, trophies: this.trophies, poison: this.poison, picked: this.picked, staff: this.staff, townAway: this.townAway, thief: this.thief, safes: this.safes, repute: this.repute, bladder: this.bladder, bowels: this.bowels, holes: this.holes, hotbar: this.hotbar, waypoint: this.waypoint, impound: this.impound, boat: this.boat, inmates: Object.fromEntries(Npcs.list.filter((n) => n.state === 'jailed').map((n) => [n.name, [n.jailedUntil, n.jailReason]])), poos: (this.poos || []).map((p) => ({ x: p.x, y: p.y, day: p.day, smeared: p.smeared, float: p.float })), smears: (this.smears || []).map((s) => ({ x: s.x, y: s.y, ang: s.ang, r: s.r, day: s.day })), decay: this.decay && { b: this.decay.b, rubbish: this.decay.rubbish.map((r) => ({ x: r.x, y: r.y, kind: r.kind, r: r.r })) },
        px: Player.x, py: Player.y, hour: this.env.hour, day: this.env.day, weather: this.env.weather.id,
      }));
    } catch (e) { /* storage unavailable: play on without saving */ }
  },

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!s) return null;
      this.newGame(s.seed);
      this.npcRecords = s.npcRecords || {};
      this.ammo = s.ammo === undefined ? 12 : s.ammo;
      this.spray = s.spray === undefined ? 3 : s.spray;
      this.permits = s.permits || { town: true };
      this.food = s.food === undefined ? (s.energy === undefined ? 100 : s.energy) : s.food; // old saves: energy meant food
      for (const k of ['guns', 'weapon', 'ammoX', 'wood', 'chopped', 'fires']) if (s[k] !== undefined) this[k] = s[k];
      for (const k of ['energy', 'pantry', 'ingredients', 'storage', 'home', 'rentDebt', 'lastDay', 'weed', 'seeds', 'plants', 'bike', 'fuel', 'vpermits', 'contest', 'trophies', 'poison', 'picked', 'decay', 'staff', 'townAway', 'thief', 'safes', 'repute', 'bladder', 'bowels', 'holes', 'poos', 'smears', 'hotbar', 'waypoint', 'impound', 'boat', 'inmates']) if (s[k] !== undefined) this[k] = s[k];
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
  Camp.applyChopped();
  Art.buildSprites();
  Art.buildMinimap();
  Scene3D.build();
  Fish.reset(); Fishing.reset();
  Gun.out = false; Gun.floaters = []; Bugs.list = []; Tools.current = 'rod';
  Npcs.init();
  Wardens.init();
  Bikes.init();
  Interior.init();
  Markers.init();
  Swimmers.init();
  Couples.init();
  Tim.init(); Tim.greeted = false;
  Wanted.init();
  Weed.init();
  Travel.list = null;
  Floaters.init();
  Animals.init();
  Camp.init();
  Forage.init(); Snakes.init(); Ducks.init(); Hunters.init(); Decay.init(); Staff.init(); Needs.init(); Seats.init(); Crabs.init(); Farts.init(); Waypoint.init(); Boats.init(); Prison.init(); CoastGuard.init();
  for (const n of Npcs.list) if (n.home && n.state !== 'jailed' && Math.random() < 0.2) { n.state = 'home'; n.homeT = Math.random() * 90; }
  if (savedPos && !World.blocked(savedPos.x, savedPos.y)) Player.place(savedPos.x, savedPos.y);
  else Player.place(World.spawn.x, World.spawn.y);
  Scene3D.target.set(Player.x, 0, Player.y);
}

// ---------- settings ----------
const Settings = {
  volume: 70, zoom: 16, music: true,
  load() { try { Object.assign(this, JSON.parse(localStorage.getItem('reelwild.settings')) || {}); } catch (e) { /* defaults */ } },
  save() { try { localStorage.setItem('reelwild.settings', JSON.stringify({ volume: this.volume, zoom: this.zoom, music: this.music })); } catch (e) { /* ignore */ } },
  apply() { if (Sfx.master) Sfx.master.gain.value = (this.volume / 100) * 0.7; },
};

// ---------- screens ----------
const $ = (id) => document.getElementById(id);
const TITLE_ENV = { phase: 2, daylight: 0.78, hour: 18.4, weather: WEATHERS[0], wind: { x: 0.3, y: 0.1 } };
let titleT = 0, hasSave = false, newArmed = 0;

// The in-game guide (whoever's on duty this term), rendered in 3D for the front page, proudly holding up his catch.
function drawTitleTim() {
  const c = document.getElementById('titleTim');
  if (!c) return;
  const g = c.getContext('2d'), W = c.width, H = c.height, k = 2;
  g.clearRect(0, 0, W, H);
  let r;
  try { r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return; }
  r.setSize(W * k, H * k, false); r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a4a, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(-2, 4, 5); scene.add(sun);
  const guide = Tim.guide(), m = Models.person({ ...guide.pal, female: guide.she }), rig = m.userData.rig;
  rig.yaw.rotation.y = -Math.PI / 2 + 0.35; // three-quarters toward us
  Models.pose(rig, { pose: 'normal', t: 1.2 });
  rig.armL.rotation.set(0.25, 0, 1.15); rig.armR.rotation.set(-0.12, 0, -0.15); // rod in his left fist, out to the side
  for (const l of rig.lids) l.scale.y = 0.001;
  rig.head.rotation.set(0, 0.2, 0.05);
  scene.add(m);
  cam.position.set(0.38, 1.95, 4.5); cam.lookAt(0.38, 0.95, 0);
  m.updateMatrixWorld(true);
  // The rod: from his fist up and out to the right, bending under the fish.
  const hand = rig.armL.children[rig.armL.children.length - 1].getWorldPosition(new THREE.Vector3()), tip = hand.clone().add(new THREE.Vector3(0.6, 1.15, 0.1));
  const rod = Models.rod('#C9A86A');
  Models.setRod(rod, hand.clone().add(new THREE.Vector3(-0.08, -0.12, 0)), hand.clone().add(new THREE.Vector3(0.38, 0.9, 0.1)), tip, 0.026);
  scene.add(rod);
  r.render(scene, cam);
  g.drawImage(r.domElement, 0, 0, W, H);
  // The line and a big trout hanging off the tip, drawn on top.
  const toPx = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };
  const [tx, ty] = toPx(tip), [fx, fy] = toPx(tip.clone().add(new THREE.Vector3(-0.05, -0.75, 0)));
  g.lineCap = 'round'; g.strokeStyle = '#EEE7D7'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty); g.lineTo(fx, fy); g.stroke();
  Fish.drawPortrait(g, SPECIES_BY_ID.rainbow, fx, fy + 42, 115, false, Math.PI / 2 - 0.2);
  rod.geometry.dispose(); r.dispose(); r.forceContextLoss();
}

function refreshTitle() {
  try { hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) { hasSave = false; }
  $('startBtn').querySelector('span').textContent = hasSave ? 'Continue' : 'Start fishing';
  const info = $('saveInfo');
  if (hasSave) {
    const species = Object.keys(Game.journal).length;
    info.textContent = 'Day ' + Game.env.day + '  ·  ' + U.fmtMoney(Game.money) + '  ·  ' + species + ' species  ·  ' + Game.stats.caught + ' caught';
    info.classList.remove('hidden');
  } else info.classList.add('hidden');
  $('newBtn').querySelector('span').textContent = 'New Game';
  $('newBtn').classList.remove('danger');
  document.querySelectorAll('.gta-menu button').forEach((b, i) => b.classList.toggle('on', i === 0));
}

function showTitle() {
  drawTitleTim();
  if (Sfx.ctx && Settings.music) setTimeout(() => { if (Game.mode === 'title') Music.play(); }, 400);
  Game.mode = 'title';
  $('title').classList.remove('hidden');
  $('pause').classList.add('hidden');
  Menus.close(); Hud.bigMap = false;
  Actors.group.visible = false; Gun.mesh.visible = false; if (Markers.group) Markers.group.visible = false;
  Hud.g.setTransform(1, 0, 0, 1, 0, 0); Hud.g.clearRect(0, 0, Hud.cv.width, Hud.cv.height);
  $('toast').classList.remove('show');
  refreshTitle();
}

function enterPlay() {
  Mobile.goFull();
  Music.stop();
  Sfx.init(); Settings.apply();
  Game.mode = 'play';
  $('title').classList.add('hidden');
  Actors.group.visible = true; Markers.group.visible = true;
  Scene3D.camDist = Settings.zoom;
  Scene3D.target.set(Player.x, Scene3D.standH(Player.x, Player.y), Player.y);
  Game.save();
  if (!Game.stats.caught) Hud.toast('Say g\'day to ' + Tim.guide().name + ' by the dock — he\'ll show you the ropes', UI.ink, 4.5);
}

function newValley() {
  const b = $('newBtn');
  b.querySelector('span').textContent = 'Carving the valley…';
  b.disabled = true;
  // Let the label paint before the heavy generation.
  setTimeout(() => {
    Game.newGame((Math.random() * 1e9) | 0);
    buildWorld(Game.seed, null);
    b.disabled = false;
    enterPlay();
  }, 40);
}

function pause() {
  Game.mode = 'pause';
  $('pauseInfo').textContent = 'Day ' + Game.env.day + '  ·  ' + U.fmtMoney(Game.money) + '  ·  ' + Game.stats.caught + ' fish caught';
  $('pause').classList.remove('hidden');
  Sfx.setDrag(0); Sfx.setBuzz(0, 600); Sfx.setEngine(0, 60);
}
function resume() { $('pause').classList.add('hidden'); Game.mode = 'play'; }

function openModal(id) {
  if (id === 'settings') {
    $('setVolume').value = Settings.volume;
    $('setZoom').value = Settings.zoom;
    $('setMusic').classList.toggle('on', Settings.music);
    $('setReset').textContent = 'Reset';
  }
  $(id).classList.remove('hidden');
}
function closeModals() {
  let any = false;
  for (const id of ['help', 'settings', 'notes']) { if (!$(id).classList.contains('hidden')) any = true; $(id).classList.add('hidden'); }
  return any;
}

function wireScreens() {
  $('startBtn').onclick = () => enterPlay();
  $('newBtn').onclick = () => {
    if (!hasSave || Date.now() - newArmed < 4000) return newValley();
    newArmed = Date.now();
    $('newBtn').querySelector('span').textContent = 'Click again — overwrites your save';
    $('newBtn').classList.add('danger');
  };
  $('helpBtn').onclick = () => openModal('help');
  $('verBtn').querySelector('b').textContent = 'v' + PatchNotes.current().v;
  $('verBtn').onclick = () => { $('notesBody').innerHTML = PatchNotes.html(); openModal('notes'); };
  $('settingsBtn').onclick = () => openModal('settings');
  $('pHelpBtn').onclick = () => openModal('help');
  $('pSettingsBtn').onclick = () => openModal('settings');
  $('resumeBtn').onclick = resume;
  $('quitBtn').onclick = () => { Game.save(); showTitle(); };
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => $(b.dataset.close).classList.add('hidden'); });
  for (const id of ['help', 'settings', 'notes']) $(id).addEventListener('mousedown', (e) => { if (e.target.id === id) $(id).classList.add('hidden'); });
  $('setVolume').oninput = (e) => { Settings.volume = +e.target.value; Settings.apply(); Settings.save(); };
  $('setZoom').oninput = (e) => { Settings.zoom = +e.target.value; if (Game.mode !== 'title') Scene3D.camDist = Settings.zoom; Settings.save(); };
  $('setMusic').onclick = () => {
    Settings.music = !Settings.music; Settings.save(); $('setMusic').classList.toggle('on', Settings.music);
    if (!Settings.music) Music.stop(0.3); else if (Game.mode === 'title') { Sfx.init(); Settings.apply(); Music.play(); }
  };
  $('themeBtn').onclick = () => { Sfx.init(); Settings.apply(); Music.stop(0.1); setTimeout(() => Music.play(), 150); };
  // Browsers only allow sound after a click or key press: the first one on the menu starts the theme.
  const firstTouch = () => {
    removeEventListener('pointerdown', firstTouch); removeEventListener('keydown', firstTouch);
    Sfx.init(); Settings.apply();
    if (Game.mode === 'title' && Settings.music) Music.play();
  };
  addEventListener('pointerdown', firstTouch); addEventListener('keydown', firstTouch);
  $('setReset').onclick = (e) => {
    if (e.target.textContent !== 'Click again to confirm') { e.target.textContent = 'Click again to confirm'; return; }
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
    location.reload();
  };
}

function handleGlobalKeys() {
  if (Menus.open === 'montage') return;
  if (Needs.busy) { if (Input.pressed('Escape')) pause(); return; } // mid-business: no other actions
  if (Input.pressed('Escape')) {
    if (closeModals()) return;
    if (Menus.open || Hud.bigMap) { Menus.close(); Hud.bigMap = false; } else { pause(); return; }
  }
  if (Menus.open === 'catch') return;
  if (Input.pressed('KeyJ')) Menus.toggleJournal();
  if (Input.pressed('KeyI')) { if (Menus.open === 'misc') Menus.close(); else if (!Menus.open) Inventory.open(); }
  if (Input.pressed('KeyM')) Hud.bigMap = !Hud.bigMap;
  if (Input.pressed('KeyG') && !Menus.open) Tools.select('gun');
  Inventory.hotbar().forEach((id, i) => { if (id && Input.pressed('Digit' + (i + 1)) && !Menus.open) Tools.select(id); });
  if (Input.pressed('Tab') && !Menus.open && Tools.current === 'rod') {
    const have = LURES.filter((L) => (Game.lures[L.id] || 0) > 0);
    if (have.length) Fishing.selectLure(have[(have.findIndex((L) => L.id === Fishing.lureId) + 1) % have.length].id);
  }
  if (Menus.open) return;
  const k = World.shopkeeper;
  if (Input.pressed('KeyE') && Fishing.state !== 'fight') { const act = Interact.best(); if (act) act.run(); }
  if (Fishing.state === 'idle' && Input.wheel) { // with a line out, the wheel is your drag
    Scene3D.camDist = U.clamp(Scene3D.camDist + Input.wheel * 1.5, 8, 34);
    Settings.zoom = Scene3D.camDist; Settings.save();
  }
}

// The title screen floats the camera along the town lake at golden hour.
function titleFrame(dt) {
  titleT += dt;
  const modalOpen = !$('help').classList.contains('hidden') || !$('settings').classList.contains('hidden');
  const items = [...document.querySelectorAll('.gta-menu button')];
  if (!modalOpen && (Input.pressed('ArrowDown') || Input.pressed('ArrowUp') || Input.pressed('KeyS') || Input.pressed('KeyW'))) {
    const cur = items.findIndex((b) => b.classList.contains('on')), dir = Input.pressed('ArrowUp') || Input.pressed('KeyW') ? -1 : 1;
    items.forEach((b) => b.classList.remove('on'));
    items[(cur + dir + items.length) % items.length].classList.add('on'); Sfx.click();
  }
  if (Input.pressed('Enter') && !modalOpen) (items.find((b) => b.classList.contains('on')) || $('startBtn')).click();
  if (Input.pressed('Escape')) closeModals();
  const c = World.lakes[0];
  Scene3D.camDist = 34;
  Scene3D.updateCamera(dt, { x: c.x + Math.sin(titleT * 0.04) * c.r * 0.6, y: c.y + c.r * 0.38 + Math.cos(titleT * 0.03) * 4 });
  Scene3D.updateEnv(TITLE_ENV, dt);
  Npcs.update(dt); Floaters.update(dt);
  Npcs.render(); Floaters.render();
  Scene3D.render(titleT);
}

let last = performance.now(), saveT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
  if (Game.mode === 'title') titleFrame(dt);
  else if (Game.mode === 'jail') {
    Scene3D.render(Game.time);
  } else if (Game.mode === 'pause') {
    if (Input.pressed('Escape') && !closeModals()) resume();
    Scene3D.render(Game.time);
    Hud.draw();
  } else {
    const w = Scene3D.screenToWorld(Input.mouse.sx, Input.mouse.sy);
    Input.mouse.wx = w.x; Input.mouse.wy = w.y;
    // Only the handle turns the reel; the anti-reverse ignores counter-clockwise turns.
    LineDrag.update(dt);
    const crank = Input.reelGrab ? Math.max(0, Input.crankAcc) : 0;
    Input.crank = CRANK_STATES.has(Fishing.state) && !Menus.open ? crank : 0;
    Input.crankAcc = 0;
    handleGlobalKeys();
    Mobile.update(dt);
    if (Game.mode === 'play') Rep.update(dt); // also runs while a shop is open (till notes, savings)
    if (!Menus.open && Game.mode === 'play' && !Mobile.blocking()) {
      Game.time += dt;
      Game.updateEnv(dt);
      Player.update(dt);
      Fishing.update(dt);
      Fish.update(dt, Player, Fishing.lure, Game.env);
      Npcs.update(dt);
      Wardens.update(dt);
      Tools.update(dt);
      Gun.update(dt);
      Bugs.update(dt);
      Floaters.update(dt);
      Animals.update(dt);
      Interior.update(dt);
      Life.update(dt);
      Camp.update(dt);
      Contest.update(dt);
      Legends.update(dt);
      Staff.update(dt);
      Needs.update(dt);
      PooFloat.update(dt);
      Farts.update(dt);
      Crabs.update(dt);
      Waypoint.update(dt);
      Prison.update(dt);
      CoastGuard.update(dt);
      Bodies.update();
      Thief.update(dt);
      Forage.update(); Poison.update(dt); Snakes.update(dt); Ducks.update(dt); Hunters.update(dt);
      Swimmers.update(dt);
      Couples.update(dt);
      Tim.update(dt);
      Bikes.update(dt);
      Wanted.update(dt);
    }
    Hud.update(dt);
    // Frame the action: drift the camera toward the lure or the hooked fish.
    let fx = Player.x, fy = Player.y;
    const tgt = Fight.fish || Fishing.lure;
    if (tgt && Fishing.state !== 'flying') { fx = U.lerp(Player.x, tgt.x, 0.38); fy = U.lerp(Player.y, tgt.y, 0.38); }
    if (Tools.looking) { fx = Tools.look.x; fy = Tools.look.y; }
    else if (Fishing.state !== 'idle') fy += 3 * Scene3D.camDist / 16; // lift the angler above the fishing panels
    // Looking down the scope pushes the camera in on the point of aim.
    const baseDist = Scene3D.camDist;
    if (Gun.zoom > 0.01) {
      fx = U.lerp(fx, Gun.look.x, Gun.zoom); fy = U.lerp(fy, Gun.look.y, Gun.zoom);
      Scene3D.camDist = U.lerp(baseDist, 7, Gun.zoom);
    }
    Scene3D.updateCamera(dt, { x: fx, y: fy });
    Scene3D.camDist = baseDist;
    Scene3D.updateEnv(Game.env, dt);
    Actors.update(dt, Game.env);
    Npcs.render();
    Wardens.render();
    Gun.render(dt);
    Floaters.render();
    Animals.render();
    Weed.render();
    Markers.render();
    Swimmers.render();
    Couples.render(dt);
    Tim.render();
    Bikes.render(dt);
    Wanted.render(dt);
    Arsenal.render(dt);
    Camp.render(dt);
    Snakes.render(); Ducks.render(); Hunters.render(); Decay.render(); Staff.render(); Needs.render(); Crabs.render(); Waypoint.render(); Boats.render(dt);
    Scene3D.render(Game.time);
    Hud.draw();
    saveT += dt;
    if (saveT > 20) { saveT = 0; Game.save(); }
  }
  } catch (err) { console.error(err); } // keep the loop alive whatever happens
  Input.endFrame();
  requestAnimationFrame(frame);
}

window.addEventListener('load', () => {
  Settings.load();
  Scene3D.init(document.getElementById('game'));
  Actors.init();
  Gun.init();
  Hud.init();
  Input.init(document.getElementById('hud'));
  Mobile.init();
  wireScreens();
  // Build the valley straight away so the title screen can show it.
  const saved = Game.load();
  if (!saved) Game.newGame((Math.random() * 1e9) | 0);
  buildWorld(Game.seed, saved ? { x: saved.px, y: saved.py } : null);
  showTitle();
  requestAnimationFrame(frame);
});
