// Growing weed in the bushes and selling it to anglers. Wardens take a very dim view.
'use strict';

const DUSTY_PAL = { hat: '#6A3A8A', hatStyle: 'beanie', pom: '#7DC383', shirt: '#4AA06A', vest: '#8A4AB8', pants: '#4A6A8A', skin: '#E2B08A', beard: '#8A6A3A', hair: '#8A6A3A' };
const GROW_HOURS = 30;
const WEED_SAY = {
  buy: ['Sweet… don\'t tell the warden.', 'Ooh, the good stuff.', 'Pleasure doing business.', 'Makes the fish bite better, I swear.'],
  no: ['Nah, I\'m good.', 'Not my thing, mate.', 'Are you a cop?', 'Get that away from me!'],
  again: ['Already sorted, thanks.', 'Still got the last one.'],
};

const Weed = {
  group: null, plantMeshes: [], tex: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    if (!this.tex) this.tex = this.paintPlant();
    this.dusty = standee(DUSTY_PAL, World.dusty.x, World.dusty.y);
    this.group.add(this.dusty);
    this.sync();
  },

  // A leafy little plant: stem and a crown of seven-fingered leaves.
  paintPlant() {
    const c = document.createElement('canvas'); c.width = 48; c.height = 64;
    const g = c.getContext('2d');
    g.strokeStyle = '#3E6B2A'; g.lineWidth = 3; g.beginPath(); g.moveTo(24, 64); g.lineTo(24, 20); g.stroke();
    const leaf = (x, y, s, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.32, len = 13 - Math.abs(i) * 2.6;
        g.save(); g.rotate(a);
        g.fillStyle = Math.abs(i) % 2 ? '#4E9A3A' : '#5DB044'; g.strokeStyle = 'rgba(20,40,10,0.7)'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(0, -len / 2, 1.8, len / 2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.restore();
      }
      g.restore();
    };
    leaf(24, 22, 1.2, 0); leaf(15, 34, 1, -0.7); leaf(33, 34, 1, 0.7); leaf(14, 48, 0.9, -1); leaf(34, 48, 0.9, 1);
    const t = new THREE.CanvasTexture(c);
    return t;
  },

  stage(p) {
    const age = Life.hoursTotal() - p.t;
    return age >= GROW_HOURS ? 2 : age >= GROW_HOURS / 2 ? 1 : 0;
  },

  sync() {
    for (const m of this.plantMeshes) this.group.remove(m);
    this.plantMeshes = (Game.plants || []).map((p) => {
      const geo = new THREE.PlaneGeometry(0.75, 1); geo.translate(0, 0.5, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.tex, alphaTest: 0.4, side: THREE.DoubleSide }));
      m.rotation.x = -BILLBOARD_LEAN;
      m.userData.p = p;
      this.group.add(m);
      return m;
    });
  },

  render() {
    for (const m of this.plantMeshes) {
      const p = m.userData.p, s = [0.35, 0.65, 1][this.stage(p)];
      m.visible = U.dist(p.x, p.y, Player.x, Player.y) < 60;
      m.scale.set(s, s, s);
      m.position.set(p.x, Scene3D.groundH(p.x, p.y), p.y);
    }
  },

  bushNear() {
    const px = Math.floor(Player.x), py = Math.floor(Player.y);
    let best = null, bd = 1.6;
    for (let y = py - 2; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) {
      if (World.objAt(x, y) !== O.BUSH) continue;
      const d = U.dist(Player.x, Player.y, x + 0.5, y + 0.5);
      if (d < bd && !(Game.plants || []).some((p) => U.dist(p.x, p.y, x + 0.5, y + 0.9) < 1)) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
    }
    return best;
  },

  interactions(add) {
    for (const p of Game.plants || []) {
      if (this.stage(p) === 2) add(p.x, p.y, 1.7, 'Harvest your plant', () => this.harvest(p));
      else add(p.x, p.y, 1.7, 'Growing — ' + Math.ceil(GROW_HOURS - (Life.hoursTotal() - p.t)) + 'h to go', () => Hud.toast('Not ready yet. Give it time.', UI.muted, 1.4));
    }
    if (Game.seeds > 0) {
      const b = this.bushNear();
      if (b) add(b.x, b.y, 1.7, 'Plant a seed in this bush', () => this.plant(b));
    }
  },

  plant(b) {
    Game.seeds--;
    Game.plants.push({ x: b.x - 0.2, y: b.y + 0.45, t: Life.hoursTotal() });
    this.sync();
    Hud.toast('Planted. Ready in about ' + GROW_HOURS + ' hours — and keep it quiet.', UI.good, 2.4);
    this.risk('Cultivating marijuana');
    Game.save();
  },

  harvest(p) {
    const n = 3 + Math.floor(Math.random() * 3);
    Game.weed = (Game.weed || 0) + n;
    Game.plants.splice(Game.plants.indexOf(p), 1);
    this.sync();
    Hud.toast('Harvested ' + n + ' bags. Anglers might be interested…', UI.good, 2.4);
    this.risk('Cultivating marijuana');
    Game.save();
  },

  deal(n) {
    if (n.dealCool && Game.time < n.dealCool) { Npcs.say(n, U.pick(Math.random, WEED_SAY.again), 2.4); return; }
    n.dealCool = Game.time + 150;
    if (Math.random() < 0.3) { Npcs.say(n, U.pick(Math.random, WEED_SAY.no), 2.6); return; }
    const price = 25 + Math.floor(Math.random() * 21);
    Game.weed--; Game.money += price;
    Npcs.say(n, U.pick(Math.random, WEED_SAY.buy), 3);
    Sfx.coin();
    Hud.toast('Sold a bag to ' + n.name + ' for ' + U.fmtMoney(price) + '.', UI.good, 2);
    this.risk('Supplying marijuana');
    Game.save();
  },

  // Any warden close enough to see gives chase.
  risk(reason) {
    const sight = Player.crouch ? 9 : 16;
    for (const w of Wardens.list) if (U.dist(w.x, w.y, Player.x, Player.y) < sight) { Wardens.startChase(w, reason); return true; }
    return false;
  },

  // Patrolling wardens pull up any grow they walk past.
  wardenSweep(w) {
    const plants = Game.plants || [];
    for (let i = plants.length - 1; i >= 0; i--) {
      if (U.dist(plants[i].x, plants[i].y, w.x, w.y) > 3.5) continue;
      plants.splice(i, 1); this.sync();
      Wardens.say(w, 'Well, well. What do we have here?', 3);
      if (U.dist(w.x, w.y, Player.x, Player.y) < 80) Hud.toast(w.name + ' found and destroyed one of your plants!', UI.bad, 3);
      Game.save();
    }
  },

  openSeeds() {
    Life.panel(`<h2>Dusty's</h2><div class="desc">"Psst. Hey, angler. Plant these next to a bush, give 'em a day and a half, and the fishermen'll pay good money. Just… keep it away from the wardens, yeah?"</div>
      <div class="row" style="margin-top:14px"><div><b>Seeds</b> <span class="desc">(have ${Game.seeds || 0})</span><div class="desc">Each grows into 3–5 bags. Anglers pay $25–45 a bag.</div></div>
      <div><button data-seed="1" ${Game.money < 5 ? 'disabled' : ''}>1 for $5</button> <button class="primary" data-seed="3" ${Game.money < 12 ? 'disabled' : ''}>3 for $12</button></div></div>
      <div class="desc" style="margin-top:12px">Get caught planting, harvesting, dealing — or carrying it during a creel check — and it's jail and confiscation.</div>`, (el) => {
      el.querySelectorAll('[data-seed]').forEach((b) => { b.onclick = () => {
        const n = +b.dataset.seed, cost = n === 3 ? 12 : 5;
        Game.money -= cost; Game.seeds = (Game.seeds || 0) + n; Sfx.coin(); Game.save(); this.openSeeds();
      }; });
    });
  },
};
