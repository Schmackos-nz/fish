// Grid pathfinding for anyone on foot: A* over tiles you can stand on (no trees, rocks, walls or deep
// water), then pulled tight into a few straight legs. Searches stay inside a box around start and goal.
'use strict';

const Path = {
  wade: false,
  okTile(x, y) {
    if (!World.inB(x, y)) return false;
    return footOK(x + 0.5, y + 0.5, this.wade);
  },

  // Line of sight between two points, stepping along it.
  clear(ax, ay, bx, by) {
    const d = U.dist(ax, ay, bx, by), n = Math.ceil(d / 0.3);
    for (let i = 1; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; if (!footOK(x, y, this.wade)) return false; }
    return true;
  },

  find(sx, sy, gx, gy, maxNodes = 12000, pad = 25) {
    if (this.clear(sx, sy, gx, gy)) return [{ x: gx, y: gy }];
    const W = World.W, x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.floor(gx), y1 = Math.floor(gy);
    const bx0 = Math.max(0, Math.min(x0, x1) - pad), by0 = Math.max(0, Math.min(y0, y1) - pad), bx1 = Math.min(W - 1, Math.max(x0, x1) + pad), by1 = Math.min(World.H - 1, Math.max(y0, y1) + pad);
    const key = (x, y) => y * W + x, g = new Map(), from = new Map(), open = [], closed = new Set();
    const h = (x, y) => { const dx = Math.abs(x - x1), dy = Math.abs(y - y1); return dx + dy - 0.59 * Math.min(dx, dy); };
    const push = (f, k) => { open.push([f, k]); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
    const k0 = key(x0, y0), kg = key(x1, y1);
    g.set(k0, 0); push(h(x0, y0), k0);
    let n = 0, found = false;
    while (open.length && n++ < maxNodes) {
      const [, k] = pop();
      if (k === kg) { found = true; break; }
      if (closed.has(k)) continue;
      closed.add(k);
      const cx = k % W, cy = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1) continue;
        const nk = key(nx, ny);
        if (closed.has(nk) || (nk !== kg && !this.okTile(nx, ny))) continue;
        if (dx && dy && (!this.okTile(cx + dx, cy) || !this.okTile(cx, cy + dy))) continue; // no squeezing past corners
        const ng = g.get(k) + (dx && dy ? 1.41 : 1);
        if (ng < (g.has(nk) ? g.get(nk) : 1e9)) { g.set(nk, ng); from.set(nk, k); push(ng + h(nx, ny), nk); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let k = kg; k !== k0 && k !== undefined; k = from.get(k)) pts.push({ x: (k % W) + 0.5, y: ((k / W) | 0) + 0.5 });
    pts.reverse(); pts[pts.length - 1] = { x: gx, y: gy };
    // Pull the string: keep only the corners you actually have to walk round.
    const out = []; let ax = sx, ay = sy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.clear(ax, ay, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; i = j + 1;
    }
    return out;
  },

  // Move e toward goal along a cached path. Returns true when there.
  follow(e, goal, speed, dt) {
    // Try a tight search first; rivers often mean a long way round to a bridge, so widen if needed.
    this.wade = !!e.waders;
    if (!e.path || e.pathGoal !== goal) { e.path = this.find(e.x, e.y, goal.x, goal.y) || this.find(e.x, e.y, goal.x, goal.y, 60000, 90) || [{ x: goal.x, y: goal.y }]; e.pathGoal = goal; }
    let wp = e.path[0];
    while (wp && U.dist(e.x, e.y, wp.x, wp.y) < 0.25 && e.path.length > 1) { e.path.shift(); wp = e.path[0]; }
    if (!wp) return true;
    const d = U.dist(e.x, e.y, wp.x, wp.y), a = Math.atan2(wp.y - e.y, wp.x - e.x), step = Math.min(speed * dt, d);
    const nx = e.x + Math.cos(a) * step, ny = e.y + Math.sin(a) * step;
    if (footOK(nx, ny, e.waders)) { e.x = nx; e.y = ny; } else e.path = null; // something changed — replan
    this.wade = false;
    e.heading = e.face = a;
    if (unstick(e, dt)) e.path = null;
    return e.path && e.path.length <= 1 && U.dist(e.x, e.y, goal.x, goal.y) < 0.3;
  },
};
