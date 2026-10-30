// The law: area permits, Ranger Dale who sells them, patrolling wardens, size checks and the lockup.
'use strict';

const WARDEN_PAL = { hat: '#6B5A36', hatStyle: 'ranger', shirt: '#A8925E', vest: null, pants: '#3E5034', skin: '#E6B58C', badge: true, hair: '#4A3420' };
const RANGER_PAL = { hat: '#5E6B3A', hatStyle: 'ranger', shirt: '#8A9A5A', vest: null, pants: '#4A4030', skin: '#D9A07A', badge: true, beard: '#8A6A4A', hair: '#8A6A4A' };
const WARDEN_NAMES = ['Warden Briggs', 'Warden Okafor', 'Warden Lund'];
const WARDEN_SAY = {
  spot: ['HEY! Fish & Game! Stop right there!', 'You got a permit for this water?!', 'Freeze! Fisheries officer!'],
  check: ['Afternoon. Creel check — let\'s see your catch.', 'Routine inspection, angler. Open the creel.', 'Mind if I measure those fish?'],
  clean: ['All legal. Tight lines.', 'Looks good. Carry on.', 'Nice and legal. Enjoy your day.'],
  flee: ['Running from a check, eh?!', 'Get back here!'],
  lost: ['…Lost them. Next time.', 'Slippery one.'],
  gun: ['Was that a GUNSHOT?!', 'Put the weapon DOWN!'],
};

const Permits = {
  // Which permit covers the water at a point (null on land).
  zoneAt(x, y) {
    if (!World.isWater(x, y)) return null;
    const k = World.kindAt(x, y);
    if (k === K.RIVER || k === K.STREAM) return 'river';
    const t = World.lakes[0];
    return U.dist(x, y, t.x, t.y) < t.r * 1.5 ? 'town' : 'back';
  },
  has(zone) { return !zone || !!Game.permits[zone]; },
  name(zone) { const p = PERMITS.find((q) => q.id === zone); return p ? p.name : ''; },
  // The current fishing is illegal if the line is in unpermitted water.
  fishingIllegally() {
    const F = Fishing, l = F.lure;
    if (!l || !(F.state === 'line' || F.state === 'fight' || F.state === 'snagged') || !l.inWater) return null;
    const z = this.zoneAt(l.x, l.y);
    return this.has(z) ? null : z;
  },
  undersized() { return Game.creel.filter((c) => c.cm < SPECIES_BY_ID[c.id].min); },
};

const Wardens = {
  list: [], group: null, ranger: null, frames: null,

  init() {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.ranger = Models.person(RANGER_PAL);
    this.ranger.userData.rig.yaw.rotation.y = -Math.PI / 2;
    this.group.add(this.ranger);
    this.list = WARDEN_NAMES.slice(0, 2).map((name, i) => {
      const w = { name, x: 0, y: 0, face: 0, state: 'patrol', t: 0, target: null, walk: 0, checkCool: 60 + i * 90, bubble: null, bubbleT: 0, lost: 0, reason: null };
      w.mesh = Models.person(WARDEN_PAL);
      w.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
      w.shadow.rotation.x = -Math.PI / 2;
      this.group.add(w.mesh, w.shadow);
      this.relocate(w, 55 + i * 15);
      return w;
    });
  },

  // Put a warden on a bank somewhere out of sight, at roughly this distance from the angler.
  relocate(w, dist) {
    const spots = Npcs.spots.filter((s) => { const d = U.dist(s.x, s.y, Player.x, Player.y); return d > dist - 15 && d < dist + 15; });
    const s = spots.length ? spots[(Math.random() * spots.length) | 0] : Npcs.spots[(Math.random() * Npcs.spots.length) | 0];
    w.x = s.x; w.y = s.y; w.state = 'patrol'; w.target = null; w.t = 0;
  },

  say(w, list, time = 3) { w.bubble = Array.isArray(list) ? U.pick(Math.random, list) : list; w.bubbleT = time; Voice.babble(w.bubble, w.x, w.y, w.name); },

  update(dt) {
    for (const w of this.list) {
      if (w.state === 'ko' || w.state === 'dead') continue; // handled by Wanted
      w.t += dt;
      w.bubbleT = Math.max(0, w.bubbleT - dt);
      w.checkCool = Math.max(0, w.checkCool - dt);
      const pd = U.dist(w.x, w.y, Player.x, Player.y);
      const sight = Player.crouch ? 8 : 15;
      let speed = 0, tx = w.x, ty = w.y;

      if (w.state === 'patrol') {
        if (pd > 95) { this.relocate(w, 60); continue; }
        if (Prison.spot(w)) continue;
        // Amble from bank to bank, pausing to look over the water.
        if (!w.target || U.dist(w.x, w.y, w.target.x, w.target.y) < 0.5) {
          if (w.t > 3 + Math.random() * 4 || !w.target) {
            const near = Npcs.spots.filter((s) => U.dist(s.x, s.y, w.x, w.y) < 30 && U.dist(s.x, s.y, w.x, w.y) > 6);
            // Patrols drift toward wherever the angler is.
            const pull = near.filter((s) => U.dist(s.x, s.y, Player.x, Player.y) < pd);
            const pool = pull.length && Math.random() < 0.6 ? pull : near;
            w.target = pool.length ? pool[(Math.random() * pool.length) | 0] : null;
            w.t = 0;
          }
        } else { tx = w.target.x; ty = w.target.y; speed = 2.2; }
        // What can they see?
        Weed.wardenSweep(w);
        if (pd < sight) {
          const zone = Permits.fishingIllegally();
          if (zone) this.startChase(w, 'Fishing ' + Permits.name(zone) + ' without a permit');
          else if (w.checkCool <= 0 && (Game.creel.length || Game.weed > 0) && Fishing.state !== 'fight') { w.state = 'inspect'; w.t = 0; this.say(w, WARDEN_SAY.check); Hud.toast(w.name + ' wants to inspect your creel.', UI.accent, 2.4); }
          else if (w.checkCool <= 0) w.checkCool = 40; // nothing to check; look again later
        }
      } else if (w.state === 'inspect') {
        tx = Player.x; ty = Player.y; speed = 3;
        if (pd > 11 && w.t > 1) { this.startChase(w, 'Fleeing a fisheries inspection'); this.say(w, WARDEN_SAY.flee); }
        else if (pd < 1.6) this.inspect(w);
      } else if (w.state === 'chase') {
        tx = Player.x; ty = Player.y; speed = 5.6;
        w.lost = pd > 20 ? w.lost + dt : 0;
        if (pd < 1.2 && !Player.rolling) return Jail.sentence([w.reason], w);
        if (w.lost > 2.5 || w.t > 25) { this.say(w, WARDEN_SAY.lost); w.state = 'patrol'; w.t = 0; w.checkCool = 90; Hud.toast('You gave ' + w.name + ' the slip.', UI.good, 2); }
      } else if (w.state === 'collar') {
        const [a, b] = w.collar || [];
        if (!a || ![a.state, b.state].every((st) => ['brawl', 'bush', 'walk', 'cast', 'wait', 'chat'].includes(st))) { w.collar = null; w.state = 'patrol'; w.t = 0; }
        else { const g = w.collarBush && w.collarAt ? w.collarAt : a; tx = g.x; ty = g.y; speed = 4; if (U.dist(w.x, w.y, g.x, g.y) < (w.collarBush ? 1.6 : 2.8)) { Prison.collar(w); } else if (w.t > 40) { w.collar = null; w.state = 'patrol'; } }
      } else if (w.state === 'pullover') {
        // Walking up to a rider they've pulled over.
        const r = w.rider;
        if (!r || r.jailed || r.ko > 0 || !Bikes.riders.includes(r)) { w.state = 'patrol'; w.t = 0; w.rider = null; }
        else { tx = r.x; ty = r.y; speed = 3.6; if (U.dist(w.x, w.y, r.x, r.y) < 1.3) { Bikes.arrestRider(r, w); w.state = 'patrol'; w.t = 0; w.rider = null; w.checkCool = 30; } else if (w.t > 40) { w.state = 'patrol'; r.pulledBy = null; w.rider = null; } }
      } else if (w.state === 'chat') {
        if (w.t > 2.5) { w.state = 'patrol'; w.t = 0; }
      }

      if (speed) {
        // Steer around trees and deep water: try straight, then widening sidesteps.
        const base = Math.atan2(ty - w.y, tx - w.x);
        let moved = false;
        for (const off of [0, 0.5, 1.0, 1.6, 2.2]) {
          for (const sgn of off ? [w.side || 1, -(w.side || 1)] : [1]) {
            const a = base + off * sgn, dx = Math.cos(a) * speed * dt, dy = Math.sin(a) * speed * dt;
            // Only a chase sends a warden splashing into the shallows after you.
            const wet = World.isWater(w.x + dx, w.y + dy) && !(w.state === 'chase' || w.state === 'inspect') && !World.isWater(w.x, w.y);
            if (!World.blocked(w.x + dx, w.y + dy) && !wet) { w.x += dx; w.y += dy; w.face = a; moved = true; if (off) w.side = sgn; break; }
          }
          if (moved) break;
        }
        w.stuck = moved ? 0 : (w.stuck || 0) + dt;
        if (w.stuck > 1.5 && w.state === 'patrol') w.target = null;
        if (w.stuck > 3 && w.state !== 'patrol') { this.say(w, WARDEN_SAY.lost); w.state = 'patrol'; w.t = 0; w.checkCool = 90; w.stuck = 0; }
        w.walk += dt * speed * 0.6;
      }
    }
  },

  startChase(w, reason) {
    if (w.state === 'chase') return;
    w.state = 'chase'; w.t = 0; w.lost = 0; w.reason = reason;
    this.say(w, WARDEN_SAY.spot, 3);
    Sfx.tone(1400, 0.15, 0.2, 'square'); setTimeout(() => Sfx.tone(1400, 0.15, 0.2, 'square'), 180);
    Hud.toast('A warden is after you — ' + reason.toLowerCase() + '! Run!', UI.bad, 3);
  },

  inspect(w) {
    if (Game.weed > 0) return Jail.sentence(['Possession of marijuana (' + Game.weed + ' bag' + (Game.weed > 1 ? 's' : '') + ')'], w);
    const bad = Permits.undersized();
    if (bad.length) {
      const f = bad[0], sp = SPECIES_BY_ID[f.id];
      const why = sp.min === Infinity ? 'Keeping a protected ' + sp.name : 'Undersized ' + sp.name + ' (' + f.cm + ' cm, legal ' + sp.min + ' cm)';
      return Jail.sentence([why + (bad.length > 1 ? ' and ' + (bad.length - 1) + ' more' : '')], w);
    }
    this.say(w, WARDEN_SAY.clean);
    w.state = 'chat'; w.t = 0; w.checkCool = 150;
  },

  onGunshot() {
    for (const w of this.list) if (U.dist(w.x, w.y, Player.x, Player.y) < 30) { this.startChase(w, 'Discharging a firearm at wildlife'); this.say(w, WARDEN_SAY.gun); }
  },

  anyChasing() { return this.list.some((w) => w.state === 'chase'); },

  render() {
    const r = World.ranger;
    this.ranger.position.set(r.x, Scene3D.standH(r.x, r.y), r.y);
    Models.pose(this.ranger.userData.rig, { t: Game.time });
    for (const w of this.list) {
      const vis = U.dist(w.x, w.y, Player.x, Player.y) < 50;
      w.mesh.visible = w.shadow.visible = vis;
      if (!vis) continue;
      const a = w.face, moving = w.state === 'chase' || w.state === 'inspect' || (w.state === 'patrol' && w.target);
      const dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'side' : Math.sin(a) > 0 ? 'down' : 'up';
      w.mesh.userData.rig.yaw.rotation.y = -a;
      Models.pose(w.mesh.userData.rig, { moving: !!moving, phase: w.walk * 0.5, t: Game.time, pose: w.state === 'chase' && w.t < 1 ? 'brag' : 'normal' });
      const base = Scene3D.standH(w.x, w.y);
      w.mesh.position.set(w.x, base, w.y);
      w.shadow.position.set(w.x, Math.max(base, 0.01) + 0.015, w.y);
    }
  },

  drawLabels(hud) {
    for (const w of this.list) {
      if (U.dist(w.x, w.y, Player.x, Player.y) > 30) continue;
      const [sx, sy, ok] = Scene3D.project(w.x, w.y, Scene3D.standH(w.x, w.y) + 1.75);
      if (!ok) continue;
      if (w.bubbleT > 0) hud.pill(w.bubble, sx, sy - 6, w.state === 'chase' ? UI.bad : UI.ink, 12);
      else hud.pill(w.state === 'chase' ? '! ' + w.name : w.name, sx, sy - 6, w.state === 'chase' ? UI.bad : '#C9B98A', 10);
    }
  },
};

const Jail = {
  // Days → "3 days", "2 weeks", "4 months", "2 years, 3 months".
  term(days) {
    if (days >= 365) { const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30); return y + ' year' + (y > 1 ? 's' : '') + (m ? ', ' + m + ' month' + (m > 1 ? 's' : '') : ''); }
    if (days >= 60) return Math.round(days / 30) + ' months';
    if (days >= 14) return Math.round(days / 7) + ' weeks';
    return days + ' day' + (days > 1 ? 's' : '');
  },

  sentence(reasons, w, forced) {
    let days = forced || 1 + reasons.length + (reasons.some((r) => /firearm|Fleeing/.test(r)) ? 1 : 0) + (reasons.some((r) => /marijuana/.test(r)) ? 2 : 0) + Permits.undersized().length;
    Wanted.clear(); // whatever got you here, you're not wanted any more once you're inside
    // The judge knows the town's opinion of you.
    const t = Rep.tier(), sway = { Friendly: 0.6, Liked: 0.8, Neutral: 1, Disliked: 1.3, Hated: 1.6 }[t.name] || 1;
    if (sway !== 1) { days = Math.max(1, Math.round(days * sway)); reasons = reasons.concat([sway < 1 ? 'Good character (' + t.name + '): −' + Math.round((1 - sway) * 100) + '%' : 'Town opinion (' + t.name + '): +' + Math.round((sway - 1) * 100) + '%']); }
    const fine = Math.min(Game.money, 30 * Math.min(days, 90));
    const seized = Game.creel.length, bags = Game.weed || 0;
    // The gun in your hand goes in an evidence bag (your hunting rifle comes back empty).
    let gunTaken = null;
    if (Tools.current === 'gun') {
      const wpn = Arsenal.weapon();
      if (wpn.id !== 'rifle') { Game.guns = Game.guns.filter((g) => g !== wpn.id); Game.weapon = 'rifle'; gunTaken = wpn.name; }
      else if (Game.ammo) { gunTaken = Game.ammo + ' rifle rounds'; Game.ammo = 0; }
    }
    Fishing.reelInFast(); Fight.end(); Sfx.setDrag(0);
    if (Bikes.riding) Bikes.dismount();
    // A stolen ride gets impounded and handed back to its owner.
    this.impounded = Game.bike && !Bikes.ownsIt() ? BIKE_BY_ID[Game.bike.id].name : null;
    if (Game.bike && Bikes.ownsIt() && reasons.some((x) => /Dangerous driving/.test(x))) {
      Game.impound = { ...Game.bike }; Game.bike = null; Bikes.syncMine();
      reasons = reasons.concat(['Vehicle impounded (collect it from Revs)']);
    }
    if (this.impounded) {
      const stolen = Game.bike, owner = Bikes.riders.find((r) => r.name === stolen.owner);
      Game.bike = null; Bikes.syncMine();
      if (owner) {
        if (!owner.noBike) Bikes.group.remove(owner.bike);
        owner.bikeId = stolen.id; owner.plate = stolen.plate; owner.owner = owner.name; owner.hp = 4;
        owner.bike = Bikes.modelFor(stolen.id); Bikes.group.add(owner.bike);
        owner.x = owner.px; owner.y = owner.py; owner.noBike = false; owner.state = 'ride'; owner.chaseT = 0; owner.target = Bikes.pickTarget(owner);
      }
    }
    for (const r of Bikes.riders) r.chaseT = 0; // the cops sorted it; nobody's chasing you now
    if (w) { w.state = 'patrol'; w.t = 0; w.checkCool = 200; }
    Game.mode = 'jail';
    const el = document.getElementById('jail');
    el.querySelector('#jailWhy').textContent = reasons.join(' · ');
    el.querySelector('#jailTerms').innerHTML =
      `<div><span>Sentence</span><b>${this.term(days)}</b></div>` +
      `<div><span>Fine</span><b>${U.fmtMoney(fine)}</b></div>` +
      `<div><span>Confiscated</span><b>${seized} fish${bags ? ' · ' + bags + ' bags of weed' : ''}${Game.seeds ? ' · ' + Game.seeds + ' seeds' : ''}${gunTaken ? ' · ' + gunTaken : ''}</b></div>` +
      `<div><span>Untouched</span><b>Everything in your storage at home</b></div>`;
    const btn = el.querySelector('#jailBtn'), bar = el.querySelector('#jailBar');
    bar.style.width = '0%'; btn.disabled = false; btn.textContent = 'Serve your time';
    el.classList.remove('hidden');
    Sfx.fail(); setTimeout(() => Sfx.tone(90, 0.5, 0.4, 'square', 60), 150); // cell door
    btn.onclick = () => {
      btn.disabled = true; btn.textContent = days >= 365 ? 'The years crawl by…' : days >= 60 ? 'The months crawl by…' : 'Doing time…';
      let p = 0;
      const iv = setInterval(() => {
        p += 4; bar.style.width = p + '%';
        if (p >= 100) { clearInterval(iv); this.release(days, fine); }
      }, 80);
    };
  },

  release(days, fine) {
    Game.money -= fine;
    Game.creel = []; Game.weed = 0; Game.seeds = 0;
    if (Interior.active) Interior.exit();
    Game.env.day += days; Game.env.hour = 8;
    Wanted.clear();
    Decay.age(days, true); // the town goes to seed while you're away
    Game.stats.jailed = (Game.stats.jailed || 0) + 1;
    // Out through the prison gate.
    const d = Prison.gate();
    Player.place(d.x, d.y);
    Scene3D.target.set(Player.x, Scene3D.standH(Player.x, Player.y), Player.y);
    Tools.current = 'rod'; Gun.out = false;
    for (const w of Wardens.list) Wardens.relocate(w, 60);
    document.getElementById('jail').classList.add('hidden');
    Game.mode = 'play';
    Game.save();
    Hud.toast('Released from the Valley Prison. Ranger Dale sells permits — keep it legal.' + (this.impounded ? ' The stolen ' + this.impounded + ' went back to its owner.' : ''), UI.accent, 3.5);
    if (days >= 30) {
      const pct = Math.round(Decay.level() * 100), rub = Decay.state().rubbish.length;
      Life.panel(`<h2>While you were inside…</h2>
        <div class="desc">${this.term(days)} later, you walk out into Day ${Game.env.day}. The valley didn't wait for you.</div>
        <h3>The township</h3>
        <div class="row"><div><b>${Decay.describe().charAt(0).toUpperCase() + Decay.describe().slice(1)}</b><div class="desc">Graffiti, boarded-up windows, rubbish everywhere${Decay.riderCap() < 4 ? ', and hardly anyone rides through any more' : ''}.</div></div><b>${pct}% run down</b></div>
        <div class="row"><div><b>Rubbish lying about</b><div class="desc">Bin it for a few bucks each.</div></div><b>${rub} pieces</b></div>
        <div class="desc" style="margin-top:12px">The council will pay you to fix buildings up. Look for "Fix up" by any tagged or boarded-up building.</div>
        ${Game.home ? '<div class="desc" style="margin-top:8px;color:var(--bad)">Nobody paid your rent while you were away…</div>' : ''}`);
    }
    this.impounded = null;
  },
};
