// Live fish around the player: spawning by habitat, wandering, chasing and striking lures.
'use strict';

const LEN_K = { bluegill: 36, carp: 39, catfish: 42, pike: 56, muskie: 56, sturgeon: 52, silverjaw: 55, walleye: 47 };

const Fish = {
  list: [], spawnT: 0,

  reset() { this.list = []; },

  timeMult(sp, env) { return sp.time[env.phase]; },

  pickSpecies(x, y, env, rng = Math.random) {
    const kind = World.kindAt(x, y), dep = World.depthAt(x, y);
    const kn = KIND_NAME[kind];
    return U.weighted(rng, SPECIES, (sp) => {
      let w = sp.habitats[kn] || 0;
      if (!w) return 0;
      w *= this.timeMult(sp, env);
      if (dep < sp.depth[0] * 0.6) w *= 0.15;
      if (sp.rare) w *= 0.35;
      if (sp.legendary) {
        w *= 0.25;
        if (dep < sp.depth[0]) return 0;
        if (sp.id === 'silverjaw' && U.dist(x, y, World.lakes[0].x, World.lakes[0].y) > World.lakes[0].r * 1.3) return 0;
      }
      return w;
    });
  },

  rollSize(sp, rng = Math.random) {
    let kg = sp.kg[1] * Math.exp(U.gauss(rng) * 0.9);
    if (rng() < 0.03) kg = U.lerp(sp.kg[1], sp.kg[2], 0.6 + rng() * 0.4); // trophy
    kg = U.clamp(kg, sp.kg[0], sp.kg[2]);
    const cm = Math.round((LEN_K[sp.id] || 45) * Math.cbrt(kg) * (0.95 + rng() * 0.1));
    return { kg: Math.round(kg * 1000) / 1000, cm };
  },

  spawn(x, y, env) {
    const sp = this.pickSpecies(x, y, env);
    if (!sp) return null;
    const { kg, cm } = this.rollSize(sp);
    const dep = World.depthAt(x, y);
    const f = {
      sp, kg, cm, x, y, z: U.clamp(U.lerp(sp.depth[0], sp.depth[1], Math.random()), 0.2, dep * 0.9),
      heading: Math.random() * Math.PI * 2, speed: 0.3, state: 'wander', t: 0, cool: 0,
      interest: 0, nibbles: 0, wig: Math.random() * 10, alpha: 0,
    };
    this.list.push(f);
    return f;
  },

  update(dt, player, lure, env) {
    // Keep a population around the player in whatever water is nearby.
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.25;
      if (this.list.length < 30) {
        for (let tries = 0; tries < 10; tries++) {
          // Half the new arrivals turn up around a lure that's in the water.
          const nearLure = lure && lure.inWater && Math.random() < 0.5;
          const a = Math.random() * Math.PI * 2, r = nearLure ? 3 + Math.random() * 7 : 6 + Math.random() * 22;
          const cx = nearLure ? lure.x : player.x, cy = nearLure ? lure.y : player.y;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (!World.isWater(x, y) || World.depthAt(x, y) < 0.3) continue;
          this.spawn(x, y, env);
          break;
        }
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.state !== 'hooked' && U.dist(f.x, f.y, player.x, player.y) > 34) { this.list.splice(i, 1); continue; }
      if (f.state === 'gone') { f.alpha -= dt; if (f.alpha <= 0) this.list.splice(i, 1); continue; }
      f.alpha = Math.min(1, f.alpha + dt);
      f.wig += dt * (4 + f.speed * 8);
      if (f.state !== 'hooked') this.think(f, dt, player, lure, env);
    }
  },

  think(f, dt, player, lure, env) {
    f.t += dt;
    f.cool = Math.max(0, f.cool - dt);
    let target = null, want = 0.35;
    // Startle if the angler stomps right up to shallow fish.
    const pd = U.dist(f.x, f.y, player.x, player.y);
    if (f.state !== 'spooked' && pd < 2.2 && f.z < 1.5 && player.moving && player.running) this.spook(f, player.x, player.y);

    if (f.state === 'spooked') {
      want = f.sp.speed * 2.2;
      if (f.t > 2.5) { f.state = 'wander'; f.cool = 6; }
    } else if (f.state === 'wander') {
      f.heading += (Math.random() - 0.5) * dt * 2;
      want = 0.25 + Math.sin(f.wig * 0.1) * 0.15;
      if (lure && lure.inWater && f.cool <= 0 && !Fishing.engaged) this.considerLure(f, dt, lure, env);
    } else if (f.state === 'follow') {
      if (!lure || !lure.inWater) { this.loseInterest(f); }
      else {
        const behind = 0.5 + f.cm / 100;
        const la = Math.atan2(lure.vy, lure.vx);
        target = lure.speed > 0.1 ? [lure.x - Math.cos(la) * behind, lure.y - Math.sin(la) * behind] : [lure.x, lure.y];
        want = Math.min(f.sp.speed * 1.8, lure.speed + 0.6);
        f.z = U.lerp(f.z, lure.z, dt * 0.8);
        const appeal = this.appeal(f, lure, env);
        f.interest += (appeal - 0.35) * dt * 0.9;
        const d = U.dist(f.x, f.y, lure.x, lure.y);
        if (f.interest < 0 || f.t > 14) this.loseInterest(f);
        else if (lure.id === 'worm') {
          if (d < 0.8) { f.state = 'nibble'; f.t = 0; f.nibbles = 1 + ((Math.random() * 4) | 0); f.nextNib = 0.6 + Math.random(); }
        } else if (d < 0.6 + f.cm / 200 && Math.random() < appeal * dt * 1.6) {
          this.strike(f, lure);
        }
        if (Fishing.engaged && Fishing.engaged !== f) this.loseInterest(f);
      }
    } else if (f.state === 'nibble') {
      target = [lure.x, lure.y]; want = 0.4;
      f.nextNib -= dt;
      if (!lure.inWater) this.loseInterest(f);
      else if (f.nextNib <= 0) {
        if (f.nibbles-- > 0) {
          f.nextNib = 0.5 + Math.random() * 1.4;
          Fishing.onNibble(f);
          if (Math.random() < 0.1) { lure.baited = false; this.loseInterest(f); Fishing.say('Bait stolen! Reel in and re-bait.', '#f2c14e'); }
        } else this.strike(f, lure);
      }
    } else if (f.state === 'strike') {
      target = [lure.x, lure.y]; want = 0.6;
      f.t2 -= dt;
      if (f.t2 <= 0) { // window passed: it spits the lure
        f.state = 'spooked'; f.t = 0; f.cool = 12;
        Fishing.onMissed(f);
      }
    }

    if (target) f.heading = f.heading + U.angDiff(f.heading, Math.atan2(target[1] - f.y, target[0] - f.x)) * Math.min(1, dt * 5);
    f.speed = U.lerp(f.speed, want, dt * 2);
    this.move(f, dt);
  },

  move(f, dt) {
    const nx = f.x + Math.cos(f.heading) * f.speed * dt, ny = f.y + Math.sin(f.heading) * f.speed * dt;
    const d = World.depthAt(nx, ny);
    if (!World.isWater(nx, ny) || d < 0.2 || (f.state === 'wander' && d < f.sp.depth[0] * 0.5)) {
      f.heading += Math.PI * (0.5 + Math.random() * 0.5);
      return false;
    }
    f.x = nx; f.y = ny;
    f.z = Math.min(f.z, d - 0.05);
    return true;
  },

  // How attractive the presentation is to this fish right now (0..~1.5).
  appeal(f, lure, env) {
    const sp = f.sp;
    if (lure.id === 'worm' && !lure.baited) return 0.03;
    let a = (sp.lures[lure.id] || 0) * (0.25 + lure.action * 0.95);
    a *= this.timeMult(sp, env) * env.weather.bite;
    a /= Math.pow(Game.gear.line.vis, sp.wary);
    const dz = Math.abs(lure.z - f.z);
    a *= lure.id === 'popper' ? (f.z < 2.5 ? 1 : 0.4) : U.clamp(1.2 - dz * 0.2, 0.4, 1.2);
    if (sp.legendary) a *= 0.5;
    return a;
  },

  considerLure(f, dt, lure, env) {
    const d = U.dist(f.x, f.y, lure.x, lure.y);
    const sight = LURE_BY_ID[lure.id].sight * (0.5 + env.visibility * 0.6) * (0.8 + lure.action * 0.6);
    if (d > sight) return;
    const a = this.appeal(f, lure, env);
    if (Math.random() < a * dt * 1.4) { f.state = 'follow'; f.t = 0; f.interest = 0.4; }
  },

  strike(f, lure) {
    f.state = 'strike'; f.t = 0;
    f.t2 = lure.id === 'worm' ? 1.2 : 0.75 + Game.gear.rod.hookset * 0.15;
    Fishing.onStrike(f);
  },

  loseInterest(f) {
    if (f.state === 'hooked') return;
    f.state = 'wander'; f.t = 0; f.cool = 5 + Math.random() * 6;
    f.heading += Math.PI * (Math.random() - 0.5);
  },

  spook(f, sx, sy) {
    if (f.state === 'hooked') return;
    f.state = 'spooked'; f.t = 0;
    f.heading = Math.atan2(f.y - sy, f.x - sx) + (Math.random() - 0.5);
  },

  spookNear(x, y, r) { for (const f of this.list) if (U.dist(f.x, f.y, x, y) < r && f.state !== 'hooked') this.spook(f, x, y); },

  // Side-on portrait used for jumps and the catch card.
  drawPortrait(g, sp, cx, cy, len, flip = false, angle = 0) {
    const h = len * (sp.id === 'bluegill' ? 0.5 : sp.id === 'pike' || sp.id === 'muskie' || sp.id === 'sturgeon' ? 0.2 : sp.id === 'carp' ? 0.36 : 0.28);
    g.save();
    g.translate(cx, cy); g.rotate(angle); if (flip) g.scale(-1, 1);
    // Tail
    g.fillStyle = sp.fin;
    g.beginPath(); g.moveTo(-len * 0.4, 0); g.lineTo(-len * 0.56, -h * 0.55); g.lineTo(-len * 0.5, 0); g.lineTo(-len * 0.56, h * 0.55); g.closePath(); g.fill();
    // Dorsal + belly fins
    g.beginPath(); g.moveTo(-len * 0.15, -h * 0.4); g.quadraticCurveTo(len * 0.02, -h * 0.85, len * 0.12, -h * 0.4); g.fill();
    g.beginPath(); g.moveTo(-len * 0.05, h * 0.38); g.lineTo(len * 0.02, h * 0.62); g.lineTo(len * 0.08, h * 0.38); g.fill();
    // Body with belly gradient
    const grd = g.createLinearGradient(0, -h / 2, 0, h / 2);
    grd.addColorStop(0, U.shade(sp.color, -0.25)); grd.addColorStop(0.45, sp.color); grd.addColorStop(1, sp.belly);
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(0, 0, len * 0.44, h / 2, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.ellipse(0, 0, len * 0.44, h / 2, 0, 0, Math.PI * 2); g.clip();
    if (sp.band) { g.fillStyle = sp.band; g.globalAlpha = 0.55; g.fillRect(-len * 0.4, -h * 0.05, len * 0.8, h * 0.18); g.globalAlpha = 1; }
    if (sp.stripes) { g.fillStyle = sp.stripes; g.globalAlpha = 0.5; for (let i = 0; i < 6; i++) g.fillRect(-len * 0.28 + i * len * 0.1, -h / 2, len * 0.035, h * 0.6); g.globalAlpha = 1; }
    if (sp.spots) { g.fillStyle = sp.spots; for (let i = 0; i < 22; i++) { const px = (U.hash2(i, 1, sp.id.length) - 0.5) * len * 0.75, py = (U.hash2(i, 2, sp.id.length) - 0.7) * h * 0.7; g.fillRect(px, py, len * 0.018 + 1, len * 0.018 + 1); } }
    if (sp.scales) { g.strokeStyle = 'rgba(60,40,10,.35)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(-len * 0.3 + i * len * 0.07, -h * 0.3 + j * h * 0.2, len * 0.03, -1.2, 1.2); g.stroke(); } }
    if (sp.scutes) { g.fillStyle = '#c9c6b5'; for (let i = 0; i < 9; i++) g.fillRect(-len * 0.32 + i * len * 0.075, -h * 0.4, len * 0.03, h * 0.12); }
    g.restore();
    // Head, eye, gill
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1, len * 0.012);
    g.beginPath(); g.arc(len * 0.24, 0, h * 0.42, -1, 1); g.stroke();
    g.fillStyle = '#f4eecc'; g.beginPath(); g.arc(len * 0.33, -h * 0.1, Math.max(1.5, h * 0.11), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(len * 0.335, -h * 0.1, Math.max(1, h * 0.06), 0, Math.PI * 2); g.fill();
    if (sp.whiskers) {
      g.strokeStyle = '#333'; g.beginPath();
      g.moveTo(len * 0.4, h * 0.05); g.lineTo(len * 0.52, h * 0.3);
      g.moveTo(len * 0.38, h * 0.1); g.lineTo(len * 0.46, h * 0.42); g.stroke();
    }
    g.restore();
  },
};
