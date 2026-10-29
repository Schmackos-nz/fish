// Tim: the valley's fishing guide. Lives out on the main street, rain or shine (umbrella for the rain).
'use strict';

const TIM_PAL = { hat: '#4E7A3E', hatStyle: 'bucket', fly: '#F2C14E', shirt: '#6A8A5A', vest: '#C9A86A', pants: '#4A4A3A', skin: '#E8B88A', beard: '#7A5A3A', hair: '#7A5A3A' };

// Guides come and go: a new one takes the job every two years, alternating women and men,
// each with their own look and favourite spot near the dock.
const GUIDES = [
  { name: 'Tim', she: false, pal: TIM_PAL },
  { name: 'Aroha', she: true, pal: { hat: '#C94A6A', hatStyle: 'bucket', fly: '#7FC4D4', shirt: '#E8B33A', vest: '#3A6A8A', pants: '#3A3A4A', skin: '#B87A52', hair: '#2A1A10' } },
  { name: 'Gareth', she: false, pal: { hat: '#2A4A6A', hatStyle: 'cap', shirt: '#8A3A2A', vest: '#C9B98A', pants: '#3A3A3A', skin: '#F0C8A0', beard: '#C96A2A', hair: '#C96A2A' } },
  { name: 'Mere', she: true, pal: { hat: '#7DC383', hatStyle: 'bucket', fly: '#E2584D', shirt: '#4A6A9A', vest: '#E8E2D0', pants: '#4A3A2A', skin: '#8A5A3A', hair: '#1A1008' } },
  { name: 'Bruce', she: false, pal: { hat: '#B8A070', hatStyle: 'bucket', fly: '#4A8A3A', shirt: '#3A5A3A', vest: '#7A5A3A', pants: '#4A4A3A', skin: '#E2B08A', beard: '#EDEDED', hair: '#EDEDED' } },
  { name: 'Leilani', she: true, pal: { hat: '#F2C14E', hatStyle: 'cap', shirt: '#E86A8A', vest: '#2A8A8A', pants: '#2A3A4A', skin: '#C08A60', hair: '#3A2010' } },
];
const GUIDE_TERM_DAYS = 730;

const Tim = {
  guide() { return GUIDES[Math.floor((Game.env.day - 1) / GUIDE_TERM_DAYS) % GUIDES.length]; },
  term() { return Math.floor((Game.env.day - 1) / GUIDE_TERM_DAYS); },
  // Each guide likes a slightly different patch of the dock end of the street.
  spot() {
    // Each guide sets up outside a different shop on the main street (always on dry, open ground).
    const k = this.term(), shops = ['shop', 'store', 'ranger', 'bikes', 'clinic', 'gas'];
    const ok = (x, y) => !World.blocked(x, y) && !World.isWater(x, y) && World.depthAt(x, y) <= 0 && !World.buildingAt(x, y) && World.tileAt(Math.floor(x), Math.floor(y)) !== T.PLANK;
    for (let j = 0; j < shops.length; j++) {
      const b = World.buildings.find((q) => q.type === shops[(k + j) % shops.length]); if (!b) continue;
      const d = World.doorOf(b);
      for (const [lx, lz] of [[2.2, 1.2], [-1.0, 1.4], [3.2, 1.6], [0.9, 2.4]]) {
        const p = World.localToWorld(b, 0.9 + lx, World.depthOf(b) + lz);
        if (ok(p.x, p.y) && U.dist(p.x, p.y, d.x, d.y) > 0.9) return p;
      }
    }
    return World.spawn;
  },
  // Called daily: a new guide (and spot) every two years.
  refresh(announce) {
    const k = this.term();
    if (this.termShown === k) return;
    const prev = this.termShown; this.termShown = k;
    const s = this.spot(); World.tim.x = s.x; World.tim.y = s.y;
    if (this.mesh) { this.group.remove(this.mesh); this.mesh = Models.person({ ...this.guide().pal, female: this.guide().she }); this.mesh.userData.rig.yaw.rotation.y = -Math.PI / 2; this.group.add(this.mesh); }
    if (Markers.refresh) Markers.refresh();
    if (announce && prev !== undefined) {
      const g = this.guide(), old = GUIDES[prev % GUIDES.length];
      Staff.news.push(old.name + ' has retired as the valley\'s fishing guide. Say hello to ' + g.name + ' — ' + (g.she ? 'she' : 'he') + '\'s set up by the dock.');
      this.greeted = false;
    }
  },

  group: null, mesh: null, umbrella: null, greeted: false, bubble: null, bubbleT: 0,

  // Goals Tim walks you through, in order.
  goals() {
    const G = Game, prized = Object.values(G.journal).some((j) => j.prized);
    return [
      { done: G.stats.caught > 0, text: 'Catch your first fish', tip: 'Walk onto the dock, hold the left mouse to cast, then grab the reel handle and wind it clockwise.' },
      { done: !!G.stats.sold, text: 'Sell a creel of fish at Hettie\'s', tip: 'Keep a few fish, then head into Hettie\'s Tackle on the main street and sell the lot.' },
      { done: !!G.stats.cooked, text: 'Cook a meal', tip: 'Getting hungry? Cook a fish on the BBQ by the dock, or buy food at the General Store.' },
      { done: !!(G.permits.river || G.permits.back), text: 'Buy a permit for new water', tip: 'Ranger Dale sells permits for the rivers and the backcountry lakes. The wardens do check.' },
      { done: !!G.home, text: 'Rent a cottage', tip: 'Cottages with a blue "For rent" sign give you a bed, a stove and a chest for your gear.' },
      { done: Object.keys(G.journal).length >= 5, text: 'Catch five different species', tip: 'Every water holds different fish. Streams for trout, the river for bass and salmon, lakes for pike.' },
      { done: prized, text: 'Land a prized fish', tip: 'Watch for golden shadows. Prized fish fight harder — loosen the drag and be patient.' },
    ];
  },

  weatherTip() {
    const e = Game.env;
    if (e.weather.id === 'rain') return 'Rain\'s the best fishing there is — the bites go right up. The swimmers have all gone home, too.';
    if (e.phase === 0 || e.phase === 2) return 'Dawn and dusk are prime time. Bass and trout come up to feed.';
    if (e.phase === 3) return 'Night fishing? Catfish and walleye love the dark. Mind the wardens.';
    return 'Bright sun pushes fish deep. Try a crankbait, or wait for evening.';
  },

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.termShown = undefined;
    this.mesh = Models.person({ ...this.guide().pal, female: this.guide().she });
    this.mesh.userData.rig.yaw.rotation.y = -Math.PI / 2;
    // Umbrella: striped canopy on a hooked handle, held over his head when it rains.
    const u = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.38, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0xD23A3A, side: THREE.DoubleSide }));
    canopy.position.y = 1.75;
    const stripes = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.38, 8, 1, true, 0, Math.PI / 4), new THREE.MeshLambertMaterial({ color: 0xF4F0E6, side: THREE.DoubleSide }));
    stripes.position.y = 1.75;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0x2A2A2E }));
    shaft.position.y = 1.2;
    u.add(canopy, stripes, shaft);
    u.position.set(0.25, 0, 0.05);
    Toon.apply(u, false);
    this.umbrella = u;
    this.group.add(this.mesh, u);
    this.refresh(false);
  },

  update(dt) {
    this.bubbleT = Math.max(0, this.bubbleT - dt);
    const t = World.tim, d = U.dist(t.x, t.y, Player.x, Player.y);
    if (!this.greeted && d < 7 && !Interior.active) {
      this.greeted = true;
      this.say(Game.stats.caught ? 'G\'day! I\'m ' + this.guide().name + ', the new guide. Press E for tips.' : 'G\'day! I\'m ' + this.guide().name + '. Press E and I\'ll show you the ropes.', 4);
    }
  },

  say(text, time = 3) { this.bubble = text; this.bubbleT = time; Voice.babble(text, World.tim.x, World.tim.y, this.guide().name + (this.guide().she ? 'F' : 'M')); },

  render() {
    const t = World.tim, base = Scene3D.standH(t.x, t.y);
    const vis = !Interior.active && U.dist(t.x, t.y, Player.x, Player.y) < 60;
    this.mesh.visible = vis;
    this.umbrella.visible = vis && Game.env.weather.id === 'rain';
    this.mesh.position.set(t.x, base, t.y);
    const rain = Game.env.weather.id === 'rain';
    Models.pose(this.mesh.userData.rig, { t: Game.time, pose: rain ? 'grip' : this.bubbleT > 0 ? 'brag' : 'normal' });
    this.umbrella.position.set(t.x + 0.25, base, t.y + 0.05);
    this.umbrella.rotation.z = Math.sin(Game.time * 1.2) * 0.05;
  },

  drawBubble(hud) {
    if (this.bubbleT <= 0 || Interior.active) return;
    const t = World.tim;
    if (U.dist(t.x, t.y, Player.x, Player.y) > 25) return;
    const [sx, sy, ok] = Scene3D.project(t.x, t.y, Scene3D.standH(t.x, t.y) + (Game.env.weather.id === 'rain' ? 2.3 : 1.9));
    if (ok) hud.pill(this.bubble, sx, sy - 22, UI.ink, 12);
  },

  open() {
    const goals = this.goals(), next = goals.find((g) => !g.done);
    Life.panel(`<h2>${this.guide().name}'s tips</h2>
      <div class="desc">"${next ? next.tip : 'You\'ve done the lot! The valley\'s yours, mate. Go chase Old Silverjaw.'}"</div>
      <h3>Your goals</h3>
      ${goals.map((g) => `<div class="row"><div>${g.done ? '<b style="color:var(--good)">✓</b>' : '<b style="color:var(--dim)">○</b>'} ${g.done ? '<span class="desc" style="text-decoration:line-through">' + g.text + '</span>' : '<b>' + g.text + '</b>'}</div></div>`).join('')}
      <h3>Today's conditions</h3><div class="desc">${this.weatherTip()}</div>${Contest.timHtml()}`, (el) => { const b = el.querySelector('[data-enter]'); if (b) b.onclick = () => { Contest.enter(); this.open(); }; });
    this.say(next ? 'Here\'s what I\'d do next…' : 'Legend!', 2.5);
  },
};
