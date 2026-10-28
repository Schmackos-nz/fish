// DOM panels: catch card, tackle shack, journal.
'use strict';

const Menus = {
  open: null,

  close() {
    for (const id of ['shop', 'journal', 'catch']) document.getElementById(id).classList.add('hidden');
    this.open = null;
  },

  value(sp, kg) {
    let v = sp.price * kg * (sp.legendary ? 3 : sp.rare ? 1.6 : 1);
    if (kg > sp.kg[1] * 2) v *= 1.3;
    return Math.max(1, Math.round(v));
  },

  showCatch(f) {
    const sp = f.sp, val = this.value(sp, f.kg);
    const j = Game.journal[sp.id] || { count: 0, best: 0, cm: 0 };
    const first = j.count === 0, record = f.kg > j.best;
    j.count++; if (record) { j.best = f.kg; j.cm = f.cm; }
    Game.journal[sp.id] = j;
    Game.stats.caught++;
    const el = document.getElementById('catch');
    const full = Game.creel.length >= Game.creelMax;
    el.innerHTML = `
      <div class="desc" style="color:#a99f8a">${World.waterName(f.x, f.y) || 'the water'}</div>
      <div class="big">${sp.name}</div>
      ${sp.legendary ? '<div class="rec">★ LEGENDARY ★</div>' : sp.rare ? '<div class="rec">Rare catch!</div>' : ''}
      <canvas id="catchArt" width="300" height="130"></canvas>
      <div style="font-size:18px"><b>${U.fmtKg(f.kg)}</b> · ${f.cm} cm</div>
      ${first ? '<div class="rec">New species for the journal!</div>' : record ? '<div class="rec">New personal best!</div>' : `<div class="desc">Best: ${U.fmtKg(j.best)}</div>`}
      <div style="margin:8px 0;color:#8fd16a">Worth ${U.fmtMoney(val)} at the shack</div>
      <button id="keepBtn" ${full ? 'disabled' : ''}>Keep (creel ${Game.creel.length}/${Game.creelMax})</button>
      <button id="releaseBtn">Release (+${U.fmtMoney(val * 0.35)} bounty)</button>`;
    el.classList.remove('hidden');
    this.open = 'catch';
    const g = document.getElementById('catchArt').getContext('2d');
    Fish.drawPortrait(g, sp, 150, 65, Math.min(280, 140 + Math.log2(1 + f.kg) * 40));
    document.getElementById('keepBtn').onclick = () => {
      Game.creel.push({ id: sp.id, kg: f.kg, cm: f.cm, value: val });
      this.close(); Game.save();
    };
    document.getElementById('releaseBtn').onclick = () => {
      Game.money += Math.round(val * 0.35); Game.stats.released++;
      Sfx.splash(0.5); Hud.toast('Back you go, ' + sp.name + '.', '#8ec7d6', 1.5);
      this.close(); Game.save();
    };
  },

  toggleJournal() {
    if (this.open === 'journal') return this.close();
    if (this.open) return;
    const el = document.getElementById('journal');
    const known = SPECIES.filter((s) => Game.journal[s.id]).length;
    el.innerHTML = `<button class="close" id="jClose">✕</button><h2>Angler's Journal</h2>
      <div class="desc">${known}/${SPECIES.length} species · ${Game.stats.caught} caught · ${Game.stats.released} released</div>
      <div class="grid" style="margin-top:10px">${SPECIES.map((s) => {
        const j = Game.journal[s.id];
        const hab = Object.entries(s.habitats).filter(([, v]) => v > 0).map(([k]) => k).join(', ');
        const best = Object.entries(s.lures).sort((a, b) => b[1] - a[1])[0][0];
        const times = s.time.map((v, i) => v >= 1.2 ? TIME_NAMES[i] : null).filter(Boolean).join('/') || 'any time';
        return j ? `<div class="card"><canvas data-sp="${s.id}" width="150" height="60"></canvas><br><b>${s.name}</b><br>
            Caught ${j.count} · best ${U.fmtKg(j.best)} (${j.cm} cm)<br><span class="desc">${hab} · ${times} · likes ${LURE_BY_ID[best].name}</span></div>`
          : `<div class="card unknown"><b>???</b><br><span class="desc">${s.legendary ? 'A legend of these waters.' : 'Found in: ' + hab}</span></div>`;
      }).join('')}</div>`;
    el.classList.remove('hidden');
    this.open = 'journal';
    el.querySelectorAll('canvas[data-sp]').forEach((c) => Fish.drawPortrait(c.getContext('2d'), SPECIES_BY_ID[c.dataset.sp], 75, 30, 130));
    document.getElementById('jClose').onclick = () => this.close();
  },

  openShop() {
    if (this.open) return;
    this.open = 'shop';
    this.renderShop();
    document.getElementById('shop').classList.remove('hidden');
  },

  renderShop() {
    const el = document.getElementById('shop');
    const creelVal = Game.creel.reduce((a, c) => a + c.value, 0);
    const gearRows = (list, slot) => list.map((it) => {
      const owned = Game.owned.includes(it.id), eq = Game.gear[slot].id === it.id;
      const stat = slot === 'rod' ? `cast ${it.cast} m · cushion ${it.cushion}` : slot === 'reel' ? `${(it.gear * LINE_PER_TURN).toFixed(2)} m/turn · max drag ${it.maxDrag} kg`
        : `${it.strength} kg · visibility ${it.vis}`;
      const btn = eq ? '<button disabled>Equipped</button>' : owned ? `<button data-eq="${slot}:${it.id}">Equip</button>`
        : `<button data-buy="${slot}:${it.id}" ${Game.money < it.price ? 'disabled' : ''}>Buy ${U.fmtMoney(it.price)}</button>`;
      return `<div class="row"><div><b>${it.name}</b><div class="desc">${stat}</div></div>${btn}</div>`;
    }).join('');
    el.innerHTML = `<button class="close" id="sClose">✕</button><h2>Hettie's Tackle</h2>
      <div class="desc">"Fish don't care how you look — they care how your lure looks." · You have <b style="color:#8fd16a">${U.fmtMoney(Game.money)}</b></div>
      <h3>Sell your creel</h3>
      <div class="row"><div>${Game.creel.length ? Game.creel.map((c) => SPECIES_BY_ID[c.id].name + ' ' + U.fmtKg(c.kg)).join(', ') : '<span class="desc">Empty.</span>'}</div>
        <button id="sellBtn" ${Game.creel.length ? '' : 'disabled'}>Sell all ${U.fmtMoney(creelVal)}</button></div>
      <h3>Lures</h3>
      ${LURES.map((L) => `<div class="row"><div><b>${L.key}. ${L.name}</b> <span class="desc">(have ${Game.lures[L.id] || 0})</span><div class="desc">${L.tip}</div></div>
        <button data-lure="${L.id}" ${Game.money < L.price ? 'disabled' : ''}>${L.pack > 1 ? L.pack + ' for ' : ''}${U.fmtMoney(L.price)}</button></div>`).join('')}
      <h3>Rods</h3>${gearRows(RODS, 'rod')}
      <h3>Reels</h3>${gearRows(REELS, 'reel')}
      <h3>Line</h3>${gearRows(LINES, 'line')}
      <h3>Creel</h3><div class="row"><div>Bigger creel (+5 fish)</div>
        <button id="creelBtn" ${Game.money < 150 * Game.creelMax / 5 ? 'disabled' : ''}>${U.fmtMoney(150 * Game.creelMax / 5)}</button></div>`;
    el.querySelector('#sClose').onclick = () => this.close();
    el.querySelector('#sellBtn').onclick = () => { Game.money += creelVal; Game.creel = []; Sfx.coin(); this.renderShop(); Game.save(); };
    el.querySelector('#creelBtn').onclick = () => { Game.money -= 150 * Game.creelMax / 5; Game.creelMax += 5; Sfx.coin(); this.renderShop(); Game.save(); };
    el.querySelectorAll('[data-lure]').forEach((b) => b.onclick = () => {
      const L = LURE_BY_ID[b.dataset.lure];
      Game.money -= L.price; Game.lures[L.id] = (Game.lures[L.id] || 0) + L.pack; Sfx.coin(); this.renderShop(); Game.save();
    });
    const lists = { rod: RODS, reel: REELS, line: LINES };
    el.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
      const [slot, id] = b.dataset.buy.split(':');
      const it = lists[slot].find((x) => x.id === id);
      Game.money -= it.price; Game.owned.push(id); Game.gear[slot] = it; Sfx.coin();
      if (slot === 'reel') Game.drag = Math.min(Game.drag, it.maxDrag);
      this.renderShop(); Game.save();
    });
    el.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => {
      const [slot, id] = b.dataset.eq.split(':');
      Game.gear[slot] = lists[slot].find((x) => x.id === id);
      if (slot === 'reel') Game.drag = Math.min(Game.drag, Game.gear.reel.maxDrag);
      this.renderShop(); Game.save();
    });
  },
};
