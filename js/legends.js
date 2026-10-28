// Urban legends: monster fish the locals swear exist. Now and then one cruises past — a huge dark
// silhouette under the surface. Without diamond line and the Leviathan rod, hooking one ends in a snap.
'use strict';

const MYTHS = [
  { id: 'bunyip', name: 'The Bunyip', color: '#2E3A30', belly: '#5A6A50', fin: '#1E2A20', spots: '#4A5A40', whiskers: true,
    habitats: {}, water: ['lake', 'pond'], kg: [90, 140, 220], power: 3.2, speed: 1.6, jumpy: 0.1, depth: [1, 30], wary: 0.6,
    price: 40, legendary: true, myth: true, time: [1, 1, 1, 1], lures: { spoon: 0.7, crank: 0.7, worm: 0.4, spinner: 0.4, popper: 0.3 } },
  { id: 'taniwha', name: 'Taniwha Eel', color: '#3A3424', belly: '#8A7A50', fin: '#2A2418',
    habitats: {}, water: ['river', 'stream'], kg: [60, 100, 160], power: 3.0, speed: 1.9, jumpy: 0.05, depth: [0.5, 30], wary: 0.6,
    price: 45, legendary: true, myth: true, time: [1, 1, 1, 1], lures: { worm: 0.8, crank: 0.6, spoon: 0.5, spinner: 0.4, popper: 0.1 } },
  { id: 'damcarp', name: 'Dam Monster Carp', color: '#7A6A3A', belly: '#D8C080', fin: '#5A4A2A', scutes: true,
    habitats: {}, water: ['lake', 'pond'], kg: [70, 110, 180], power: 2.9, speed: 1.3, jumpy: 0.2, depth: [1, 30], wary: 0.5,
    price: 38, legendary: true, myth: true, time: [1, 1, 1, 1], lures: { worm: 0.9, crank: 0.5, spoon: 0.4, spinner: 0.3, popper: 0.2 } },
];
for (const m of MYTHS) { SPECIES.push(m); SPECIES_BY_ID[m.id] = m; m.min = 0; }

// The only gear that stands a chance.
RODS.push({ id: 'leviathan', name: 'Leviathan Heavy 3.0m', price: 2400, cast: 26, cushion: 1.15, hookset: 1.4, color: '#5A2A6A', myth: true });
LINES.push({ id: 'diamond', name: '60 kg Diamond Braid', price: 1500, strength: 60, vis: 1.1, stretch: 0.4, myth: true });

const Legends = {
  nextT: 60, current: null,

  geared() { return Game.gear.rod.id === 'leviathan' && Game.gear.line.id === 'diamond'; },

  update(dt) {
    const f = this.current;
    if (f) {
      f.mythLife -= dt;
      if (f.state !== 'hooked') f.z = Math.min(f.z, 0.8); // cruising just under the surface, so you see the shadow
      const gone = !Fish.list.includes(f);
      if (gone || (f.mythLife <= 0 && f.state !== 'hooked')) {
        if (!gone) Fish.list.splice(Fish.list.indexOf(f), 1);
        this.current = null;
      }
      return;
    }
    if (Interior.active || Bikes.riding) return;
    this.nextT -= dt;
    if (this.nextT > 0) return;
    this.nextT = 120 + Math.random() * 180;
    // Somewhere deep-ish, close enough to see, in the right kind of water.
    for (let t = 0; t < 30; t++) {
      const a = Math.random() * 6.28, r = 7 + Math.random() * 14;
      const x = Player.x + Math.cos(a) * r, y = Player.y + Math.sin(a) * r;
      if (!World.isWater(x, y) || World.depthAt(x, y) < 2) continue;
      const kn = KIND_NAME[World.kindAt(x, y)];
      const pool = MYTHS.filter((m) => m.water.includes(kn));
      if (!pool.length) continue;
      this.spawn(pool[(Math.random() * pool.length) | 0], x, y);
      return;
    }
  },

  spawn(sp, x, y) {
    const { kg, cm } = Fish.rollSize(sp);
    const f = {
      sp, kg, cm, prized: true, x, y, z: 1.1, heading: Math.atan2(Player.y - y, Player.x - x) + (Math.random() < 0.5 ? 1.2 : -1.2),
      speed: 0.6, state: 'wander', t: 0, cool: 0, interest: 0, nibbles: 0, wig: 0, alpha: 0, mythLife: 45,
    };
    Fish.list.push(f);
    this.current = f;
    Sfx.tone(42, 1.6, 0.35, 'sine', 30);
    Hud.toast(U.pick(Math.random, ['Something ENORMOUS just cruised past…', 'Was that a LOG? …It just turned around.', 'A shadow the size of a canoe slides under the surface…']) + ' (' + sp.name + '?!)', '#B8C8FF', 3.2);
  },
};
