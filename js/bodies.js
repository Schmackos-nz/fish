// Bodies bump: the player and everyone walking about can't pass through each other.
// A cheap separation pass each frame, pushing overlapping people apart (never into walls or water).
'use strict';

const Bodies = {
  R: 0.32, // body radius, metres

  // Everyone standing on their own two feet right now: [object, x key, y key].
  list() {
    const out = [];
    if (!Bikes.riding && !Seats.sitting && !Boats.riding) out.push([Player, 'x', 'y', true]);
    for (const n of Npcs.list) if (!n.away && !['home', 'bush', 'ko', 'dead'].includes(n.state)) out.push([n, 'x', 'y']);
    for (const w of Wardens.list) if (w.state !== 'ko' && w.state !== 'dead') out.push([w, 'x', 'y']);
    for (const h of Hunters.list) if (!h.ko) out.push([h, 'x', 'y']);
    for (const st of Staff.list) if (st.mesh && st.mesh.visible && !Interior.active) out.push([st, 'x', 'y']);
    for (const u of Wanted.units) if (!u.ko) out.push([u, 'x', 'y']);
    for (const r of Bikes.riders) if (Bikes.onFoot(r) && !r.away) out.push([r, 'px', 'py']);
    for (const f of Floaters.list) if (f.state === 'walk') out.push([f, 'x', 'y']);
    for (const s of Swimmers.list) if (s.state === 'walk') out.push([s, 'x', 'y']);
    return out;
  },

  update() {
    if (Interior.active) return;
    const L = this.list(), D = this.R * 2;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const [a, ax, ay, ap] = L[i], [b, bx, by, bp] = L[j];
      let dx = b[bx] - a[ax], dy = b[by] - a[ay];
      const d = Math.hypot(dx, dy);
      if (d >= D || (!ap && !bp && U.dist(a[ax], a[ay], Player.x, Player.y) > 40)) continue;
      if (d < 1e-4) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
      const push = (D - d);
      // The player gives way a little less than people walking into them.
      const ka = ap ? 0.35 : bp ? 0.65 : 0.5, kb = 1 - ka;
      const nax = a[ax] - dx * push * ka, nay = a[ay] - dy * push * ka, nbx = b[bx] + dx * push * kb, nby = b[by] + dy * push * kb;
      if (footOK(nax, nay)) { a[ax] = nax; a[ay] = nay; }
      if (footOK(nbx, nby)) { b[bx] = nbx; b[by] = nby; }
    }
  },
};
