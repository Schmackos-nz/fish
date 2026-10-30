// Zombie Mode: the valley's fallen. The locals are gone, the law's gone, and the dead come in waves.
// Chop wood, board up a house (or any building) with B, and keep yourself fed by fishing and hunting.
// Hide inside and they'll beat on the boards; let them break through and they get you. Never touches your save.
'use strict';

const ZPALS = [
  { hat: '#3A3A2A', hatStyle: 'none', shirt: '#5A6A4A', pants: '#3A3A44', skin: '#8FAE6A', mitt: '#8FAE6A' },
  { hat: '#3A3A2A', hatStyle: 'none', shirt: '#7A4A3A', pants: '#2E3A4A', skin: '#9BB57A', mitt: '#9BB57A', vest: '#4A3A2A' },
  { hat: '#5A4A3A', hatStyle: 'cap', shirt: '#B8B0A0', pants: '#4A4030', skin: '#86A262', mitt: '#86A262' },
];
const BOARD_HP = 40, MAX_BOARDS = 5, BOARD_WOOD = 2;

const Zombie = {
  on: false, list: [], wave: 0, state: 'prep', t: 0, toSpawn: 0, spawnT: 0, kills: 0, boards: {}, group: null, hurtCd: 0, moanT: 0,

  start() {
    this.on = true;
    const seed = (Math.random() * 1e9) | 0;
    Game.newGame(seed); buildWorld(seed, null);
    // Everyone's gone. Shops are still stocked, if the shopkeepers are brave enough to open.
    for (const M of [Npcs, Wardens, Swimmers, Floaters, Hunters]) { if (M.list) M.list.length = 0; if (M.group) M.group.visible = false; }
    for (const r of Bikes.riders) for (const v of Object.values(r)) if (v && v.isObject3D) v.visible = false;
    Bikes.riders.length = 0;
    if (Couples.group) Couples.group.visible = false;
    Game.money = 60; Game.ammo = 30; Game.wood = 6; Game.food = 80;
    Game.env.hour = 9;
    this.list = []; this.wave = 0; this.state = 'prep'; this.t = 75; this.kills = 0; this.boards = {};
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group(); Scene3D.scene.add(this.group);
    document.body.classList.add('zombie');
    document.getElementById('rogueBar').classList.remove('hidden');
    this.hook();
    enterPlay();
    Hud.toast('ZOMBIE MODE · The dead rise in 75 seconds. Chop wood (axe), then press B at a door to board it up. Fish and hunt to eat.', UI.bad, 7);
  },

  hook() {
    if (this.hooked) return;
    this.hooked = true;
    const self = this;
    const wasted = Wanted.wasted.bind(Wanted);
    Wanted.wasted = function () { if (self.on) return self.over(); return wasted(); };
    const crime = Wanted.crime.bind(Wanted);
    Wanted.crime = function (...a) { if (self.on) return; return crime(...a); }; // no law left
    const sentence = Jail.sentence.bind(Jail);
    Jail.sentence = function (...a) { if (self.on) return; return sentence(...a); };
    // Bullets hit the dead first.
    const hit = Wanted.hitPerson.bind(Wanted);
    Wanted.hitPerson = function (x, y, scoped) {
      if (self.on) { const z = self.near(x, y, scoped ? 0.7 : 0.95); if (z) { self.damage(z, 3, x, y); return true; } }
      return hit(x, y, scoped);
    };
    // Fists and the axe work on them too.
    const tu = Tools.update.bind(Tools);
    Tools.update = function (dt) {
      if (self.on && Input.mousePressed && !Menus.open && (Tools.current === 'hands' || Tools.current === 'axe') && !Interior.active) {
        const reach = Tools.current === 'axe' ? 1.9 : 1.5, f = Player.face;
        const z = self.list.filter((q) => q.hp > 0 && U.dist(q.x, q.y, Player.x, Player.y) < reach && Math.abs(U.angDiff(f, Math.atan2(q.y - Player.y, q.x - Player.x))) < 1.2)
          .sort((a, b) => U.dist(a.x, a.y, Player.x, Player.y) - U.dist(b.x, b.y, Player.x, Player.y))[0];
        if (z) { self.damage(z, Tools.current === 'axe' ? 2 : 1, Player.x, Player.y); Sfx.whoosh(0.15); Input.mousePressed = false; }
      }
      return tu(dt);
    };
  },

  near(x, y, r) { let best = null, bd = r; for (const z of this.list) if (z.hp > 0) { const d = U.dist(z.x, z.y, x, y); if (d < bd) { bd = d; best = z; } } return best; },

  damage(z, n, fx, fy) {
    z.hp -= n; z.flash = 0.2;
    const a = Math.atan2(z.y - fy, z.x - fx);
    for (const k of [0.6, 0.3]) { const nx = z.x + Math.cos(a) * k, ny = z.y + Math.sin(a) * k; if (footOK(nx, ny, false)) { z.x = nx; z.y = ny; break; } }
    Sfx.slap && Sfx.slap(0.9);
    if (z.hp <= 0) { z.deadT = 0; this.kills++; Sfx.thunk && Sfx.thunk(); }
  },

  // ---------- boards ----------
  bIndex(b) { return World.buildings.indexOf(b); },
  boardOf(b) { const i = this.bIndex(b); return this.boards[i] || (this.boards[i] = { n: 0, hp: BOARD_HP, mesh: null }); },

  doorNear() {
    if (Interior.active) return Interior.active.b;
    let best = null, bd = 2.6;
    for (const b of World.buildings) { const d = World.doorOf(b), dd = U.dist(d.x, d.y, Player.x, Player.y); if (dd < bd) { bd = dd; best = b; } }
    return best;
  },

  boardUp() {
    const b = this.doorNear();
    if (!b) return Hud.toast('Stand by a door (or inside) to board it up.', UI.muted, 1.6);
    const B = this.boardOf(b);
    if (B.n >= MAX_BOARDS) return Hud.toast('That door\'s boarded as tight as it gets.', UI.muted, 1.6);
    if ((Game.wood || 0) < BOARD_WOOD) return Hud.toast('Need ' + BOARD_WOOD + ' wood per board — chop a tree with the axe.', UI.bad, 2);
    Game.wood -= BOARD_WOOD; B.n++; B.hp = BOARD_HP;
    Sfx.knot && Sfx.knot(); Sfx.slap && Sfx.slap(0.5);
    Hud.toast('Hammered a board across ' + (b.type === 'house' ? 'the house' : b.name) + ' (' + B.n + '/' + MAX_BOARDS + ')', UI.good, 1.8);
    this.drawBoards(b);
  },

  drawBoards(b) {
    const B = this.boardOf(b);
    if (B.mesh) this.group.remove(B.mesh);
    if (!B.n) { B.mesh = null; return; }
    const g = new THREE.Group(), d = World.doorOf(b);
    const l = World.localToWorld(b, 0.25, World.depthOf(b) + 0.08), r = World.localToWorld(b, 1.55, World.depthOf(b) + 0.08);
    const ang = Math.atan2(r.y - l.y, r.x - l.x), h = Scene3D.standH(d.x, d.y);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8A6236 });
    for (let i = 0; i < B.n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.07), mat);
      m.position.set((l.x + r.x) / 2, h + 0.35 + i * 0.32, (l.y + r.y) / 2);
      m.rotation.y = -ang; m.rotation.z = (i % 2 ? 0.25 : -0.25);
      g.add(m);
    }
    B.mesh = g; this.group.add(g);
  },

  // ---------- the dead ----------
  spawn() {
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 18;
      const cx = Interior.active ? World.doorOf(Interior.active.b) : Player;
      const x = cx.x + Math.cos(a) * r, y = cx.y + Math.sin(a) * r;
      if (!World.inB(Math.floor(x), Math.floor(y)) || !footOK(x, y, false)) continue;
      const mesh = Models.person(ZPALS[(Math.random() * ZPALS.length) | 0]);
      this.group.add(mesh);
      this.list.push({ x, y, mesh, hp: 3 + Math.floor(this.wave / 3), speed: 1.2 + Math.random() * 0.6 + this.wave * 0.06, walk: Math.random() * 5, face: 0, cd: 0, stuck: 0, flash: 0 });
      return;
    }
  },

  relocate(z, goal) {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 8, x = goal.x + Math.cos(a) * r, y = goal.y + Math.sin(a) * r;
      if (World.inB(Math.floor(x), Math.floor(y)) && footOK(x, y, false)) { z.x = x; z.y = y; return; }
    }
  },

  // The stragglers: on the minimap (pulsing when there are only a few left), and an arrow round you to the nearest.
  remaining() { return this.list.filter((z) => z.hp > 0); },
  drawMini(hud, cx, cy, s, R) {
    if (!this.on) return;
    const g = hud.g, left = this.remaining(), few = left.length <= 3, pulse = 0.5 + 0.5 * Math.sin(Game.time * 6);
    for (const z of left) {
      let nx = (z.x - Player.x) * s, ny = (z.y - Player.y) * s;
      const d = Math.hypot(nx, ny);
      if (d > R - 6) { if (!few) continue; nx *= (R - 6) / d; ny *= (R - 6) / d; } // pinned to the rim
      g.fillStyle = '#E23A2E'; g.beginPath(); g.arc(cx + nx, cy + ny, few ? 4 : 2.6, 0, 7); g.fill();
      if (few) { g.strokeStyle = 'rgba(255,70,50,' + (1 - pulse) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(cx + nx, cy + ny, 4 + pulse * 9, 0, 7); g.stroke(); }
    }
  },
  drawArrow(hud) {
    if (!this.on || Interior.active || this.state !== 'wave') return;
    const left = this.remaining();
    if (!left.length || left.length > 3) return;
    const z = left.sort((a, b) => U.dist(a.x, a.y, Player.x, Player.y) - U.dist(b.x, b.y, Player.x, Player.y))[0];
    const dist = U.dist(z.x, z.y, Player.x, Player.y);
    if (dist < 7) return;
    const [px, py, ok1] = Scene3D.project(Player.x, Player.y, Scene3D.standH(Player.x, Player.y) + 1);
    const [zx, zy] = Scene3D.project(z.x, z.y, Scene3D.standH(z.x, z.y) + 1);
    if (!ok1) return;
    let a = Math.atan2(zy - py, zx - px);
    if (Scene3D.tps) a = -Math.PI / 2 + U.angDiff(Scene3D.tpsYaw, Math.atan2(z.y - Player.y, z.x - Player.x)); // ahead = up
    const g = hud.g, r = 78 + Math.sin(Game.time * 5) * 6, ax = px + Math.cos(a) * r, ay = py + Math.sin(a) * r;
    g.save(); g.translate(ax, ay); g.rotate(a);
    g.fillStyle = '#E23A2E'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(24, 0); g.lineTo(-12, -16); g.lineTo(-4, 0); g.lineTo(-12, 16); g.closePath(); g.fill(); g.stroke();
    g.restore();
    const lx = ax + Math.cos(a) * 46, ly = ay + Math.sin(a) * 40;
    g.fillStyle = 'rgba(20,6,6,0.85)'; g.beginPath(); g.roundRect(lx - 48, ly - 11, 96, 22, 11); g.fill();
    hud.text('ZOMBIE ' + Math.round(dist) + ' m', lx, ly + 4, '#FF6A5A', 12, 'center', 800);
  },

  update(dt) {
    if (!this.on || Game.mode !== 'play') return;
    this.t -= dt; this.hurtCd -= dt;
    if (Input.pressed('KeyB') && Fishing.state === 'idle') this.boardUp();
    // Waves.
    if (this.state === 'prep') {
      if (this.t <= 0) { this.wave++; this.state = 'wave'; this.toSpawn = 3 + this.wave * 3; this.spawnT = 0; Hud.toast('WAVE ' + this.wave + ' — they\'re coming.', UI.bad, 3); Sfx.fail && Sfx.fail(); }
    } else {
      this.spawnT -= dt;
      if (this.toSpawn > 0 && this.spawnT <= 0) { this.spawn(); this.toSpawn--; this.spawnT = 18 / (3 + this.wave * 3); }
      if (!this.toSpawn && !this.list.some((z) => z.hp > 0)) { this.state = 'prep'; this.t = 50; Game.money += 25 * this.wave; Hud.toast('Wave ' + this.wave + ' cleared! 50 seconds to patch up, eat and stock up. (+' + U.fmtMoney(25 * this.wave) + ' scavenged)', UI.good, 4); }
    }
    // Where they're headed: you, or the door you're hiding behind.
    const inside = Interior.active ? Interior.active.b : null, door = inside ? World.doorOf(inside) : null;
    const goal = door || Player;
    for (const z of this.list) {
      if (z.hp <= 0) { z.deadT += dt; continue; }
      z.flash = Math.max(0, z.flash - dt); z.cd -= dt;
      const d = U.dist(z.x, z.y, goal.x, goal.y);
      if (d > (door ? 1.1 : 0.85)) {
        const base = Math.atan2(goal.y - z.y, goal.x - z.x);
        let moved = false;
        for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
          const a = base + off, nx = z.x + Math.cos(a) * z.speed * dt, ny = z.y + Math.sin(a) * z.speed * dt;
          if (footOK(nx, ny, false) && !this.list.some((o) => o !== z && o.hp > 0 && U.dist(o.x, o.y, nx, ny) < 0.45 && U.dist(o.x, o.y, goal.x, goal.y) < d)) { z.x = nx; z.y = ny; z.face = a; moved = true; break; }
        }
        z.walk += dt * z.speed * 0.5;
        z.stuck = moved ? 0 : z.stuck + dt;
        if (z.stuck > 3) { unstick(z, 99); z.stuck = 0; }
        // Hung up somewhere miles away (across a river, up a hill): bring it back into the fight.
        z.farT = d > 40 ? (z.farT || 0) + dt : 0;
        if (z.farT > 15) { z.farT = 0; this.relocate(z, goal); }
      } else if (door) {
        // Beating on the boards.
        const B = this.boardOf(inside);
        z.face = Math.atan2(door.y - z.y, door.x - z.x);
        if (B.n > 0) {
          B.hp -= dt * 5;
          if (z.cd <= 0) { z.cd = 1; Sfx.slap && Sfx.slap(0.4); }
          if (B.hp <= 0) { B.n--; B.hp = BOARD_HP; this.drawBoards(inside); Sfx.snap && Sfx.snap(); Hud.toast(B.n ? 'CRACK! A board gives way. (' + B.n + ' left — press B to nail another)' : 'The last board splinters! They\'re getting in!', UI.bad, 2.5); }
        } else if (this.hurtCd <= 0) { this.hurtCd = 0.9; Wanted.hurt(9, 'zombies'); Hud.toast('They\'re through the door!', UI.bad, 1); }
      } else if (this.hurtCd <= 0 && !Boats.riding && !Swim.on) {
        // A bite.
        this.hurtCd = 0.8; Wanted.hurt(8, 'zombies'); Sfx.slap && Sfx.slap(1);
      }
    }
    // Clear the bodies away after a while.
    for (let i = this.list.length - 1; i >= 0; i--) { const z = this.list[i]; if (z.hp <= 0 && z.deadT > 6) { this.group.remove(z.mesh); this.list.splice(i, 1); } }
    // Moans.
    this.moanT -= dt;
    const close = this.list.find((z) => z.hp > 0 && U.dist(z.x, z.y, Player.x, Player.y) < 14);
    if (close && this.moanT <= 0) { this.moanT = 2.5 + Math.random() * 3; Voice.babble && Voice.babble('braaaains uuurgh', close.x, close.y, 'zombie' + ((Math.random() * 9) | 0)); }
    this.hud();
  },

  hud() {
    const alive = this.list.filter((z) => z.hp > 0).length + this.toSpawn;
    const b = this.doorNear(), B = b && this.boardOf(b);
    document.getElementById('rogueBar').innerHTML = '<b>' + (this.state === 'prep' ? 'WAVE ' + (this.wave + 1) + ' IN ' + Math.ceil(this.t) + 's' : 'WAVE ' + this.wave + ' · ' + alive + ' LEFT') + '</b><span>Kills ' + this.kills + '</span><span>Wood ' + (Game.wood || 0) + ' · Ammo ' + (Game.ammo || 0) + '</span>' +
      (b ? '<span>B: board up ' + (b.type === 'house' ? 'house' : b.name) + ' (' + B.n + '/' + MAX_BOARDS + ')</span>' : '');
    Orbs.set(Wanted.health, Game.food, 'FOOD');
  },

  render() {
    if (!this.on || !this.group) return;
    this.group.visible = !Interior.active;
    for (const z of this.list) {
      const m = z.mesh, rig = m.userData.rig;
      m.position.set(z.x, Scene3D.standH(z.x, z.y), z.y);
      rig.yaw.rotation.y = -z.face;
      if (z.hp <= 0) { m.rotation.x = Math.min(Math.PI / 2, z.deadT * 5); m.position.y -= Math.min(0.3, z.deadT); continue; }
      Models.pose(rig, { moving: true, phase: z.walk, t: Game.time, pose: 'normal' });
      // Arms out in front, the classic shamble.
      rig.armL.rotation.z = 1.35; rig.armR.rotation.z = 1.35;
      rig.upper.rotation.x = Math.sin(z.walk * 3) * 0.08;
      m.scale.setScalar(z.flash > 0 ? 1.12 : 1);
    }
  },

  over() {
    if (Game.mode === 'rogue') return;
    Game.mode = 'rogue';
    Sfx.fail();
    let best = null; try { best = JSON.parse(localStorage.getItem('reelwild.zombieBest')); } catch (e) { /* none */ }
    const sc = { waves: Math.max(0, this.wave - (this.state === 'wave' ? 1 : 0)), kills: this.kills };
    const isBest = !best || sc.waves > best.waves || (sc.waves === best.waves && sc.kills > best.kills);
    if (isBest) try { localStorage.setItem('reelwild.zombieBest', JSON.stringify(sc)); } catch (e) { /* ignore */ }
    const el = document.getElementById('rogueCard');
    el.innerHTML = '<h2 class="dead">EATEN</h2><p>The valley claims another one.</p>' +
      '<div class="score"><div><b>' + sc.waves + '</b>waves survived</div><div><b>' + sc.kills + '</b>zombies dropped</div></div>' +
      '<p class="best">' + (isBest ? '★ Best survival yet!' : 'Best: ' + best.waves + ' waves · ' + best.kills + ' kills') + '</p>' +
      '<div class="perks"><button id="zAgain"><b>Try again</b><span>A fresh outbreak</span></button><button id="zQuit"><b>Main menu</b><span>Back to your normal save</span></button></div>';
    document.getElementById('rogue').classList.remove('hidden');
    document.getElementById('zAgain').onclick = () => { sessionStorage.setItem('reelwild.autoZombie', '1'); location.reload(); };
    document.getElementById('zQuit').onclick = () => location.reload();
  },
};
