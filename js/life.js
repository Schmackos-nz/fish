// Daily life: food (hunger), energy (stamina), cooking, renting a cottage, storage, quick travel, and the E key.
'use strict';

const FOODS = [
  { id: 'bread', name: 'Bread roll', price: 4, energy: 15 },
  { id: 'beans', name: 'Can of beans', price: 6, energy: 25 },
  { id: 'pie', name: 'Meat pie', price: 10, energy: 40 },
  { id: 'drink', name: 'Energy drink', price: 5, energy: 20 },
  { id: 'batter', name: 'Batter mix', price: 4, ingredient: true, desc: 'Turns any fish into fish & chips.' },
  { id: 'herbs', name: 'Butter & herbs', price: 3, ingredient: true, desc: 'For a herb-butter fillet.' },
];
const RECIPES = [
  { id: 'grill', label: 'Grill', needs: null, mult: 1, name: (sp) => 'Grilled ' + sp.name },
  { id: 'chips', label: 'Fish & chips', needs: 'batter', mult: 1.5, name: (sp) => sp.name + ' & chips' },
  { id: 'herb', label: 'Herb-butter', needs: 'herbs', mult: 1.8, name: (sp) => 'Herb-butter ' + sp.name },
];
const emptyStorage = () => ({ creel: [], pantry: [], lures: {}, ammo: 0, spray: 0, weed: 0 });

const Life = {
  warnedLow: false,

  hoursTotal() { return Game.env.day * 24 + Game.env.hour; },

  update(dt) {
    const gh = dt * 24 / 1200; // game hours this frame
    // Food: hunger ticks down with the clock, faster when you're running about.
    Game.food = U.clamp(Game.food - gh * (Player.running ? 6 : 3.5), 0, 100);
    if (Game.food < 20 && !this.warnedLow) { this.warnedLow = true; Hud.toast('You\'re getting hungry — eat something (I opens your bag).', UI.accent, 3); }
    if (Game.food > 30) this.warnedLow = false;
    // Energy: stamina. Running burns it, resting gets it back (but not on an empty stomach).
    const resting = !Player.moving || Bikes.riding;
    Game.energy = U.clamp(Game.energy + dt * (Player.running ? -9 : resting ? (Game.food > 0 ? 6 : 0) : Game.food > 0 ? 1.5 : -0.5), 0, 100);
    if (Game.energy < 8 && !this.warnedTired) { this.warnedTired = true; Hud.toast('Exhausted — stop and catch your breath.', UI.accent, 2.4); }
    if (Game.energy > 30) this.warnedTired = false;
    // Starving slowly hurts.
    if (Game.food <= 0) Wanted.health = Math.max(1, Wanted.health - dt * 0.4);
    this.processDays();
  },

  // Hunger slows you down; exhaustion weakens your cast.
  speedMul() { return (Game.food < 10 ? 0.7 : Game.food < 25 ? 0.88 : 1) * (Game.poison ? 0.75 : 1); },
  maxPower() { return Game.energy < 12 ? 0.6 : 1; },

  passHours(h, drain = 3) {
    const e = Game.env;
    e.hour += h;
    while (e.hour >= 24) { e.hour -= 24; e.day++; }
    Game.food = U.clamp(Game.food - h * drain, 0, 100);
    this.processDays();
  },

  // Rent is charged once per new day.
  processDays() {
    if (Game.lastDay === undefined) Game.lastDay = Game.env.day;
    while (Game.lastDay < Game.env.day) { Game.lastDay++; this.payRent(); Decay.age(1, false); Staff.daily(); Thief.daily(); }
  },

  payRent() {
    const h = Game.home;
    if (!h) return;
    const b = World.houses[h.id];
    const due = b.rent + (Game.rentDebt || 0);
    if (Game.money >= due) {
      Game.money -= due; Game.rentDebt = 0;
      Hud.toast('Rent paid: ' + U.fmtMoney(due), UI.muted, 2);
    } else {
      Game.rentDebt = due;
      if (Game.rentDebt >= b.rent * 3) return this.evict();
      Hud.toast('Rent overdue — you owe ' + U.fmtMoney(Game.rentDebt) + '. Pay up or you\'re out!', UI.bad, 3.5);
    }
  },

  evict() {
    const inside = Interior.active && Interior.active.b.type === 'house';
    Game.home = null; Game.rentDebt = 0; Game.storage = emptyStorage();
    if (inside) Interior.exit();
    Markers.refresh();
    Sfx.fail();
    Hud.toast('Evicted! The landlord threw out everything you had stored.', UI.bad, 4);
    Game.save();
  },

  rent(b) {
    if (Game.money < b.rent) { Hud.toast('You need ' + U.fmtMoney(b.rent) + ' for the first day.', UI.bad, 2); return; }
    Game.money -= b.rent;
    Game.home = { id: b.id }; Game.rentDebt = 0; Game.lastDay = Game.env.day;
    Sfx.coin();
    Hud.toast('It\'s yours! ' + U.fmtMoney(b.rent) + ' a day, charged each morning.', UI.good, 3);
    Menus.close(); Markers.refresh(); Game.save();
  },

  eat(i) {
    const f = Game.pantry[i];
    if (!f) return;
    Game.pantry.splice(i, 1);
    Game.food = Math.min(100, Game.food + f.energy);
    Sfx.tone(380, 0.08, 0.12, 'triangle', 300);
    Hud.toast('Ate ' + f.name + ' (+' + f.energy + ' food)', UI.good, 1.6);
    if (f.shroom) Forage.eaten(f);
    Game.save();
  },

  sleep() {
    if (Wanted.level > 0) { Hud.toast('Can\'t sleep with the cops after you! Lose them first.', UI.bad, 2); return; }
    if (this.sleeping) return;
    this.sleeping = true;
    const fade = document.getElementById('sleepFade');
    fade.textContent = 'Zzz…'; fade.classList.add('on');
    setTimeout(() => {
      const h = Game.env.hour;
      const hours = h < 6 ? 6 - h : 30 - h;
      this.passHours(hours, 0);
      Game.energy = 100; Wanted.health = 100; Game.food = Math.max(0, Game.food - 10); Wanted.dmgLog = {};
      Game.save();
      fade.textContent = WEEKDAYS[(Game.env.day - 1) % 7] + ' · Day ' + Game.env.day + ' · 6:00';
      setTimeout(() => {
        fade.classList.remove('on'); this.sleeping = false;
        Hud.toast('Good morning! You slept through to 6:00 — fully rested.', UI.good, 2.6);
      }, 1100);
    }, 900);
  },

  cook(i, recipe) {
    const c = Game.creel[i];
    if (!c) return;
    if (recipe.needs && !(Game.ingredients[recipe.needs] > 0)) return;
    const sp = SPECIES_BY_ID[c.id];
    if (recipe.needs) Game.ingredients[recipe.needs]--;
    Game.creel.splice(i, 1);
    const energy = Math.round(U.clamp(18 + c.kg * 14, 18, 70) * recipe.mult);
    Game.pantry.push({ name: recipe.name(sp), energy });
    Game.stats.cooked = (Game.stats.cooked || 0) + 1;
    Sfx.burst(0.6, 1800, 0.2, 'highpass'); // sizzle
    Hud.toast('Cooked ' + recipe.name(sp) + ' (+' + energy + ' food when eaten)', UI.good, 2);
    Game.save();
  },

  // Furniture in someone else's house does different things.
  foreignHouse() { const r = Interior.active; return r && r.b.type === 'house' && !(Game.home && Game.home.id === r.b.id) ? r.b : null; },
  furnLabel(f) {
    if (!this.foreignHouse()) return this.ownLabel(f);
    return { bed: 'Their bed', stove: 'Cook on their stove', chest: 'Rummage through their chest', safe: Thief.safeReady(this.foreignHouse()) ? 'Crack the safe (stethoscope)' : 'Safe (empty)' }[f.kind] || f.label;
  },
  ownLabel(f) {
    return f.kind === 'bed' ? 'Sleep until morning' : f.label;
  },

  enterHouse(b) {
    Interior.enter(b);
    const owner = Npcs.list.find((n) => n.home === b);
    if (owner && owner.state === 'home') {
      Hud.toast(owner.name + ': "OI! What are you doing in my house?!"', UI.bad, 2.6);
      Sfx.fail(); Wanted.crime(1);
      setTimeout(() => { if (Interior.active && Interior.active.b === b) Interior.exit(); }, 1400);
    } else Hud.toast('Nobody\'s home…', UI.muted, 1.6);
  },

  rummage(b) {
    if (b.robbedDay === Game.env.day) { Hud.toast('Already cleaned out. Nothing left but socks.', UI.muted, 1.8); return; }
    b.robbedDay = Game.env.day;
    // Big houses: several finds, and the cash is serious.
    const finds = [], rolls = b.big ? 3 + ((Math.random() * 2) | 0) : 1;
    for (let k = 0; k < rolls; k++) {
      const r = Math.random();
      if (r < 0.45) { const c = b.big ? 60 + Math.floor(Math.random() * 240) : 8 + Math.floor(Math.random() * 33); Game.money += c; finds.push(U.fmtMoney(c) + (b.big ? ' in an envelope' : ' in a sock')); }
      else if (r < 0.65) { const f = U.pick(Math.random, FOODS.filter((x) => !x.ingredient)); Game.pantry.push({ name: f.name, energy: f.energy }); finds.push((/^[aeiou]/i.test(f.name) ? 'an ' : 'a ') + f.name.toLowerCase()); }
      else if (r < 0.85) { const L2 = U.pick(Math.random, LURES), q = b.big ? 3 : 1; Game.lures[L2.id] = (Game.lures[L2.id] || 0) + q; finds.push((q > 1 ? q + ' × ' : /^[aeiou]/i.test(L2.name) ? 'an ' : 'a ') + L2.name); }
      else { const q = b.big ? 15 : 5; Game.ammo = (Game.ammo || 0) + q; finds.push(q + ' rifle rounds'); }
    }
    const owner = Npcs.list.find((n) => n.home === b);
    Thief.record('burglary', owner ? owner.name : null);
    Sfx.coin(); Hud.toast('Found ' + finds.join(', ') + '. (This is stealing, you know.)', UI.accent, 3);
    Game.save();
  },

  useFurniture(kind) {
    const fb = this.foreignHouse();
    if (fb) {
      if (kind === 'bed') Hud.toast('Better not — this isn\'t your bed.', UI.muted, 1.6);
      else if (kind === 'stove') this.openCook('their stove');
      else if (kind === 'chest') this.rummage(fb);
      else if (kind === 'safe') Thief.crack(fb);
      return;
    }
    if (kind === 'bed') this.sleep();
    else if (kind === 'stove') this.openCook('your stove');
    else if (kind === 'chest') this.openStorage();
  },

  // ---------- panels (one shared DOM panel) ----------
  panel(html, wire) {
    Menus.open = 'misc';
    const el = document.getElementById('misc');
    el.innerHTML = '<button class="close" id="mClose">✕</button>' + html;
    el.classList.remove('hidden');
    el.querySelector('#mClose').onclick = () => Menus.close();
    if (wire) wire(el);
  },

  openStore() {
    this.panel(`<h2>General Store</h2><div class="desc">"Food's for eating, not for bait. Mostly." · You have <b style="color:var(--accent)">${U.fmtMoney(Game.money)}</b> · Food ${Math.round(Game.food)}</div>
      <h3>Food</h3>${FOODS.filter((f) => !f.ingredient).map((f) => `<div class="row"><div><b>${f.name}</b><div class="desc">+${f.energy} food</div></div>
        <button class="primary" data-food="${f.id}" ${Game.money < f.price ? 'disabled' : ''}>Buy ${U.fmtMoney(f.price)}</button></div>`).join('')}
      <h3>Cooking ingredients</h3>${FOODS.filter((f) => f.ingredient).map((f) => `<div class="row"><div><b>${f.name}</b> <span class="desc">(have ${Game.ingredients[f.id] || 0})</span><div class="desc">${f.desc}</div></div>
        <button data-food="${f.id}" ${Game.money < f.price ? 'disabled' : ''}>Buy ${U.fmtMoney(f.price)}</button></div>`).join('')}`, (el) => {
      el.querySelectorAll('[data-food]').forEach((b) => { b.onclick = () => {
        const f = FOODS.find((x) => x.id === b.dataset.food);
        Game.money -= f.price;
        if (f.ingredient) Game.ingredients[f.id] = (Game.ingredients[f.id] || 0) + 1;
        else Game.pantry.push({ name: f.name, energy: f.energy });
        Sfx.coin(); Game.save(); this.openStore();
      }; });
    });
  },

  openCook(where, extra) {
    const rows = Game.creel.map((c, i) => {
      const sp = SPECIES_BY_ID[c.id];
      const base = Math.round(U.clamp(18 + c.kg * 14, 18, 70));
      return `<div class="row"><div><b>${sp.name}</b> <span class="desc">${U.fmtKg(c.kg)} · ${c.cm} cm</span></div><div>${RECIPES.map((r) =>
        `<button data-cook="${i}:${r.id}" ${r.needs && !(Game.ingredients[r.needs] > 0) ? 'disabled' : ''}>${r.label} +${Math.round(base * r.mult)}</button>`).join(' ')}</div></div>`;
    }).join('');
    this.panel(`<h2>Cook at ${where}</h2>${extra ? extra.html : ''}<div class="desc">Turn your catch into meals. Batter mix ×${Game.ingredients.batter || 0} · Butter &amp; herbs ×${Game.ingredients.herbs || 0} (from the General Store).</div>
      <h3>Your creel</h3>${rows || '<div class="desc">No fish to cook — go catch some!</div>'}`, (el) => {
      el.querySelectorAll('[data-cook]').forEach((b) => { b.onclick = () => {
        const [i, rid] = b.dataset.cook.split(':');
        this.cook(+i, RECIPES.find((r) => r.id === rid));
        this.openCook(where, extra);
      }; });
      if (extra) extra.wire(el, () => this.openCook(where, extra));
    });
  },

  openBag() {
    const home = Game.home ? World.houses[Game.home.id] : null;
    this.panel(`<h2>Your bag</h2>
      <div class="row"><div><b>Health · Food · Energy</b><div class="desc">Eat to stay fed; rest or sleep to recover energy.</div></div><b>${Math.round(Wanted.health)} · ${Math.round(Game.food)} · ${Math.round(Game.energy)}</b></div>
      <h3>Food</h3>${Game.pantry.length ? Game.pantry.map((f, i) => `<div class="row"><div><b>${f.name}</b> <span class="desc">+${f.energy} food</span></div><button class="primary" data-eat="${i}">Eat</button></div>`).join('') : '<div class="desc">Nothing to eat. Buy food at the General Store, or cook fish at the BBQ by the dock.</div>'}
      <h3>Ingredients</h3><div class="desc">Batter mix ×${Game.ingredients.batter || 0} · Butter &amp; herbs ×${Game.ingredients.herbs || 0}</div>
      <h3>Creel</h3><div class="desc">${Game.creel.length ? Game.creel.map((c) => SPECIES_BY_ID[c.id].name + ' ' + U.fmtKg(c.kg)).join(', ') : 'Empty.'}</div>
      ${Game.weed || Game.seeds ? `<h3>Under the counter</h3><div class="desc">${Game.weed || 0} bags · ${Game.seeds || 0} seeds — wardens will jail you for these.</div>` : ''}
      <h3>Home</h3><div class="desc">${home ? 'Renting a cottage for ' + U.fmtMoney(home.rent) + '/day' + (Game.rentDebt ? ' · <b style="color:var(--bad)">owing ' + U.fmtMoney(Game.rentDebt) + '</b>' : '') : 'No home. Cottages with a FOR RENT sign can be rented.'}</div>`, (el) => {
      el.querySelectorAll('[data-eat]').forEach((b) => { b.onclick = () => { this.eat(+b.dataset.eat); this.openBag(); }; });
    });
  },

  openRent(b) {
    const moving = !!Game.home;
    this.panel(`<h2>${b.big ? 'Big house' : 'Cottage'} for rent</h2><div class="desc">${b.big ? 'A roomy family place: two beds, a couch, a stove and a storage chest.' : 'A snug little place with a bed, a stove and a storage chest.'} Rent is charged every morning — fall more than two days behind and you're evicted, and anything stored inside is lost.</div>
      <div class="row" style="margin-top:14px"><div><b>${U.fmtMoney(b.rent)} per day</b><div class="desc">First day paid now${moving ? ' · you\'ll move out of your current cottage (stored items come with you)' : ''}.</div></div>
      <button class="primary" id="rentBtn" ${Game.money < b.rent ? 'disabled' : ''}>${moving ? 'Move here' : 'Rent it'}</button></div>`, (el) => {
      el.querySelector('#rentBtn').onclick = () => this.rent(b);
    });
  },

  openStorage() {
    const S = Game.storage;
    const fishRows = Game.creel.map((c, i) => `<div class="row"><div>${SPECIES_BY_ID[c.id].name} <span class="desc">${U.fmtKg(c.kg)}</span></div><button data-mv="creel:${i}:in">Store →</button></div>`).join('')
      + S.creel.map((c, i) => `<div class="row"><div>${SPECIES_BY_ID[c.id].name} <span class="desc">${U.fmtKg(c.kg)} · stored</span></div><button data-mv="creel:${i}:out" ${Game.creel.length >= Game.creelMax ? 'disabled' : ''}>← Take</button></div>`).join('');
    const foodRows = Game.pantry.map((f, i) => `<div class="row"><div>${f.name}</div><button data-mv="pantry:${i}:in">Store →</button></div>`).join('')
      + S.pantry.map((f, i) => `<div class="row"><div>${f.name} <span class="desc">stored</span></div><button data-mv="pantry:${i}:out">← Take</button></div>`).join('');
    const countRow = (key, label, carried, stored) => `<div class="row"><div><b>${label}</b> <span class="desc">carrying ${carried} · stored ${stored}</span></div><div>
      <button data-cnt="${key}:in" ${carried ? '' : 'disabled'}>Store all →</button> <button data-cnt="${key}:out" ${stored ? '' : 'disabled'}>← Take all</button></div></div>`;
    const lureRows = LURES.map((L) => countRow('lure-' + L.id, L.name, Game.lures[L.id] || 0, S.lures[L.id] || 0)).join('');
    this.panel(`<h2>Storage chest</h2><div class="desc">Safe while you pay the rent. Get evicted and it's all gone.</div>
      <h3>Fish</h3>${fishRows || '<div class="desc">No fish.</div>'}
      <h3>Food</h3>${foodRows || '<div class="desc">No food.</div>'}
      <h3>Gear</h3>${lureRows}${countRow('ammo', 'Rifle rounds', Game.ammo || 0, S.ammo)}${countRow('spray', 'Bug spray', Game.spray || 0, S.spray)}${countRow('weed', 'Bags of weed', Game.weed || 0, S.weed)}`, (el) => {
      el.querySelectorAll('[data-mv]').forEach((b) => { b.onclick = () => {
        const [list, i, dir] = b.dataset.mv.split(':');
        const from = dir === 'in' ? Game[list] : S[list], to = dir === 'in' ? S[list] : Game[list];
        to.push(from.splice(+i, 1)[0]);
        Game.save(); this.openStorage();
      }; });
      el.querySelectorAll('[data-cnt]').forEach((b) => { b.onclick = () => {
        const [key, dir] = b.dataset.cnt.split(':');
        if (key.startsWith('lure-')) {
          const id = key.slice(5);
          if (dir === 'in') { S.lures[id] = (S.lures[id] || 0) + (Game.lures[id] || 0); Game.lures[id] = 0; }
          else { Game.lures[id] = (Game.lures[id] || 0) + (S.lures[id] || 0); S.lures[id] = 0; }
        } else if (dir === 'in') { S[key] += Game[key] || 0; Game[key] = 0; }
        else { Game[key] = (Game[key] || 0) + S[key]; S[key] = 0; }
        Game.save(); this.openStorage();
      }; });
    });
  },
};

// ---------- quick travel ----------
const Travel = {
  list: null,

  dests() {
    if (!this.list) {
      const L = [{ name: 'Town', x: World.spawn.x, y: World.spawn.y }];
      for (const l of World.lakes) {
        if (l.kind !== K.LAKE || l === World.lakes[0]) continue;
        let best = null, bd = 1e9;
        for (const s of Npcs.spots) { const d = U.dist(s.x, s.y, l.x, l.y); if (d < bd) { bd = d; best = s; } }
        if (best) L.push({ name: l.name, x: best.x, y: best.y });
      }
      // One stop per footbridge.
      const seen = [];
      for (let i = 0; i < World.W * World.H; i++) {
        if (World.tile[i] !== T.PLANK || World.depth[i] <= 0 || World.kind[i] === K.LAKE) continue;
        const x = i % World.W + 0.5, y = ((i / World.W) | 0) + 0.5;
        if (seen.some((p) => U.dist(p.x, p.y, x, y) < 35) || U.dist(x, y, World.town.x, World.town.y) < 30) continue;
        seen.push({ x, y });
        L.push({ name: World.kind[i] === K.STREAM ? 'Stream crossing' : 'River crossing', x, y });
      }
      this.list = L;
    }
    const out = this.list.slice();
    if (Game.home) { const d = World.doorOf(World.houses[Game.home.id]); out.push({ name: 'Your cottage', x: d.x, y: d.y, home: true }); }
    return out;
  },

  cost(d) { return Math.max(0.25, U.dist(Player.x, Player.y, d.x, d.y) / 45); },

  go(d) {
    if (Interior.active) return Hud.toast('Step outside first.', UI.muted, 1.4);
    if (Fishing.state !== 'idle') return Hud.toast('Reel in before you travel.', UI.muted, 1.4);
    if (Wardens.anyChasing()) return Hud.toast('Not with a warden on your tail!', UI.bad, 1.6);
    const h = this.cost(d);
    Life.passHours(h, 2);
    Player.place(d.x, d.y);
    if (Bikes.riding) { Game.bike.x = d.x; Game.bike.y = d.y; }
    Scene3D.target.set(d.x, Scene3D.standH(d.x, d.y), d.y);
    Fish.reset();
    const fade = document.getElementById('fade');
    fade.classList.add('show'); setTimeout(() => fade.classList.remove('show'), 350);
    Hud.bigMap = false;
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    Hud.toast('Travelled to ' + d.name + ' — ' + (hh ? hh + 'h ' : '') + mm + 'm passed.', UI.ink, 2.5);
    Game.save();
  },
};

// ---------- the E key ----------
const Interact = {
  best() {
    const P = Player, cands = [];
    const add = (x, y, r, label, run) => { const d = U.dist(P.x, P.y, x, y); if (d < r) cands.push({ d, x, y, label, run }); };
    if (Bikes.riding) {
      const pump = Bikes.nearPump(P.x, P.y);
      if (pump && Game.fuel < 99) return { d: 0, x: pump.x, y: pump.y, label: 'Fill up — ' + U.fmtMoney(Math.ceil((100 - Game.fuel) * 0.2)), run: () => Bikes.fillUp() };
      return { d: 0, x: P.x, y: P.y, label: 'Get off the bike', run: () => Bikes.dismount() };
    }
    if (Interior.active) {
      const b = Interior.active.b;
      // Only if someone's behind the counter.
      const who = Staff.onShift(b.type), lbl = (t) => who + ' — ' + SHOP_HOURS[b.type].verb;
      if (who && b.type === 'shop') add(World.shopkeeper.x, World.shopkeeper.y, 2.8, lbl(), () => Menus.openShop());
      if (who && b.type === 'ranger') add(World.ranger.x, World.ranger.y, 2.8, lbl(), () => Menus.openPermits());
      if (who && b.type === 'store') add(World.clerk.x, World.clerk.y, 2.8, lbl(), () => Life.openStore());
      if (who && b.type === 'bikes') add(World.revs.x, World.revs.y, 2.8, lbl(), () => Bikes.openShop());
      if (who && b.type === 'clinic') add(World.nurse.x, World.nurse.y, 2.8, lbl(), () => Clinic.open());
      const f = Interior.near();
      if (f) cands.push({ d: 0.5, x: f.x + f.w / 2, y: f.y + f.h / 2, label: Life.furnLabel(f), run: () => Life.useFurniture(f.kind) });
    } else {
      for (const b of World.buildings) {
        const dr = World.doorOf(b);
        if (b.type === 'gas') add(dr.x, dr.y, 1.6, 'Gas Station — pay at the pump', () => Hud.toast('Pay at the pump across the forecourt.', UI.muted, 1.6));
        else if (b.type !== 'house') { const shut = Staff.doorLabel(b); add(dr.x, dr.y, 1.6, shut || 'Enter ' + b.name + ' (' + Staff.hoursText(b.type) + ')', () => (shut ? Hud.toast(shut + '. The door\'s locked.', UI.muted, 1.8) : Interior.enter(b))); }
        else if (Game.home && Game.home.id === b.id) add(dr.x, dr.y, 1.6, 'Enter your cottage', () => Interior.enter(b));
        else if (b.unlocked) add(dr.x, dr.y, 1.6, 'Enter ' + b.name + ' (unlocked)', () => Life.enterHouse(b));
        else if (b.vacant) add(dr.x, dr.y, 1.6, 'Cottage for rent — ' + U.fmtMoney(b.rent) + '/day', () => Life.openRent(b));
        else if (b.forcedDay === Game.env.day) add(dr.x, dr.y, 1.6, 'Enter ' + b.name + ' (lock busted)', () => Life.enterHouse(b));
        else add(dr.x, dr.y, 1.6, 'Break into ' + b.name + ' (pick the lock)', () => LockPick.openHouse(b));
      }
      for (const r of Bikes.riders) {
        if ((r.state === 'refuel' || r.state === 'break') && !(r.ko > 0) && !r.away) add(r.x, r.y, 1.8, 'Attempt to steal ' + r.name + '\'s ' + BIKE_BY_ID[r.bikeId].name, () => LockPick.open(r));
      }
      if (Bikes.near()) add(Game.bike.x, Game.bike.y, 2, (Bikes.ownsIt() ? 'Ride your ' : 'Ride the stolen ') + BIKE_BY_ID[Game.bike.id].name, () => Bikes.mount());
      add(World.bbq.x, World.bbq.y, 2, 'BBQ — cook your catch', () => Life.openCook('the BBQ'));
      for (const p of World.pumps || []) {
        // At the pump with your bike, filling up beats every other prompt.
        if (Game.bike && U.dist(Game.bike.x, Game.bike.y, p.x, p.y) < 4.5 && U.dist(P.x, P.y, p.x, p.y) < 2.2 && Game.fuel < 99) cands.push({ d: -1, x: p.x, y: p.y, label: 'Fill up your bike — ' + U.fmtMoney(Math.ceil((100 - Game.fuel) * 0.2)), run: () => Bikes.fillUp() });
        else add(p.x, p.y, 2.2, 'Gas pump', () => Hud.toast(Game.bike ? 'Bring your bike over to the pump.' : 'You\'ll need a bike first — Dirt Cheap Bikes is up the street.', UI.muted, 2));
      }
      add(World.tim.x, World.tim.y, 2.6, 'Talk to Tim — tips & goals', () => Tim.open());
      if (!Weed.dustyKO.ko) add(World.dusty.x, World.dusty.y, 2.4, 'Dusty — "psst…"', () => Weed.openSeeds());
      Weed.interactions(add);
      Staff.interactions(add);
      Camp.interactions(cands);
      Decay.interactions(cands);
      const sh = Forage.nearest();
      if (sh) add(sh.x, sh.y, 1.4, 'Forage the ' + sh.s.look.toLowerCase(), () => Forage.pick(sh));
      const n = Npcs.near(P.x, P.y, 2.5);
      if (n && !['fight', 'show', 'brawl', 'home', 'bush', 'ko', 'armed'].includes(n.state)) {
        add(n.x, n.y, 2.5, Game.weed > 0 ? 'Offer ' + n.name + ' a bag' : 'Chat to ' + n.name, () => (Game.weed > 0 ? Weed.deal(n) : Npcs.talk(n)));
      }
    }
    cands.sort((a, b) => a.d - b.d);
    return cands[0] || null;
  },
};
