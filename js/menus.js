// DOM panels: catch card, tackle shack, journal.
'use strict';

const Menus = {
  open: null,

  close() {
    for (const id of ['shop', 'journal', 'catch', 'share', 'permits', 'misc']) document.getElementById(id).classList.add('hidden');
    this.open = null;
  },

  value(sp, kg, prized) {
    let v = sp.price * kg * (sp.legendary ? 3 : sp.rare ? 1.6 : 1) * (prized && !sp.legendary ? 2.5 : 1);
    if (kg > sp.kg[1] * 2) v *= 1.3;
    return Math.max(1, Math.round(v));
  },

  showCatch(f) {
    const sp = f.sp, val = this.value(sp, f.kg, f.prized);
    const j = Game.journal[sp.id] || { count: 0, best: 0, cm: 0 };
    const first = j.count === 0, record = f.kg > j.best;
    j.count++; if (record) { j.best = f.kg; j.cm = f.cm; }
    if (f.prized) j.prized = (j.prized || 0) + 1;
    Game.journal[sp.id] = j;
    Game.stats.caught++;
    Npcs.onPlayerCatch(f);
    const el = document.getElementById('catch');
    const full = Game.creel.length >= Game.creelMax;
    el.innerHTML = `
      <div class="desc" style="color:#a99f8a">${World.waterName(f.x, f.y) || 'the water'}</div>
      <div class="big">${sp.name}</div>
      ${sp.legendary ? '<div class="prize">★ LEGENDARY ★</div>' : f.prized ? '<div class="prize">★ PRIZED FISH ★</div>' : sp.rare ? '<div class="rec">Rare catch!</div>' : ''}
      <canvas id="catchArt" width="300" height="130"></canvas>
      <div style="font-size:18px"><b>${U.fmtKg(f.kg)}</b> · ${f.cm} cm</div>
      ${sp.min === Infinity ? '<div class="legal bad">Protected species — release it</div>'
        : sp.min && f.cm < sp.min ? `<div class="legal bad">Undersized — legal minimum ${sp.min} cm</div>`
        : sp.min ? `<div class="legal ok">Legal size · minimum ${sp.min} cm</div>` : '<div class="legal ok">No size limit</div>'}
      ${first ? '<div class="rec">New species for the journal!</div>' : record ? '<div class="rec">New personal best!</div>' : `<div class="desc">Best: ${U.fmtKg(j.best)}</div>`}
      <div style="margin:8px 0;color:#8fd16a">Worth ${U.fmtMoney(val)} at Hettie's Tackle</div>
      <button id="keepBtn" ${full ? 'disabled' : ''} class="${f.cm < sp.min ? 'danger' : ''}">${f.cm < sp.min ? 'Keep anyway (illegal)' : 'Keep'} · creel ${Game.creel.length}/${Game.creelMax}</button>
      <button id="releaseBtn">Release (+${U.fmtMoney(val * 0.35)} bounty)</button>
      ${f.prized ? '<div style="margin-top:10px"><button id="shareBtn" class="gold">📸 Share a photo with a friend</button></div>' : ''}`;
    el.classList.remove('hidden');
    this.open = 'catch';
    const g = document.getElementById('catchArt').getContext('2d');
    Fish.drawPortrait(g, sp, 150, 65, Math.min(280, 140 + Math.log2(1 + f.kg) * 40));
    if (f.prized) {
      const e = Game.env;
      const info = { sp, kg: f.kg, cm: f.cm, prized: true, place: World.waterName(f.x, f.y) || 'the wild', kind: KIND_NAME[World.kindAt(f.x, f.y)], day: e.day, phase: e.phase };
      document.getElementById('shareBtn').onclick = () => Share.open(info);
    }
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
      <div class="desc">${known}/${SPECIES.length} species · ${Game.stats.caught} caught · ${Game.stats.released} released · ${Game.stats.shot || 0} shot (shame) · ${Game.stats.swatted || 0} bugs swatted · ${Game.stats.deer || 0} deer · ${Game.stats.boar || 0} boar</div>
      <h3>Valley anglers — biggest fish</h3>
      ${this.leaderboard()}
      <h3>Species</h3>
      <div class="grid" style="margin-top:10px">${SPECIES.map((s) => {
        const j = Game.journal[s.id];
        const hab = Object.entries(s.habitats).filter(([, v]) => v > 0).map(([k]) => k).join(', ');
        const best = Object.entries(s.lures).sort((a, b) => b[1] - a[1])[0][0];
        const times = s.time.map((v, i) => v >= 1.2 ? TIME_NAMES[i] : null).filter(Boolean).join('/') || 'any time';
        return j ? `<div class="card"><canvas data-sp="${s.id}" width="150" height="60"></canvas><br><b>${s.name}</b><br>
            ${j.prized ? '<span style="color:#f2c14e">★ ' + j.prized + ' prized</span><br>' : ''}Caught ${j.count} · best ${U.fmtKg(j.best)} (${j.cm} cm)<br><span class="desc">${s.min === Infinity ? 'Protected · release only' : s.min ? 'Keep ≥ ' + s.min + ' cm' : 'No size limit'} · ${hab} · ${times} · likes ${LURE_BY_ID[best].name}</span></div>`
          : `<div class="card unknown"><b>???</b><br><span class="desc">${s.legendary ? 'A legend of these waters.' : 'Found in: ' + hab}</span></div>`;
      }).join('')}</div>`;
    el.classList.remove('hidden');
    this.open = 'journal';
    el.querySelectorAll('canvas[data-sp]').forEach((c) => Fish.drawPortrait(c.getContext('2d'), SPECIES_BY_ID[c.dataset.sp], 75, 30, 130));
    document.getElementById('jClose').onclick = () => this.close();
  },

  leaderboard() {
    let mine = null;
    for (const [id, j] of Object.entries(Game.journal)) if (!mine || j.best > mine.best) mine = { best: j.best, sp: id };
    const rows = [{ name: 'You', count: Game.stats.caught, best: mine ? mine.best : 0, sp: mine && mine.sp, you: true }]
      .concat(Npcs.list.map((n) => ({ name: n.name, count: n.rec.count, best: n.rec.best, sp: n.rec.sp })))
      .sort((a, b) => b.best - a.best);
    return rows.map((r, i) => `<div class="row" ${r.you ? 'style="color:#f2c14e;font-weight:bold"' : ''}><div>${i + 1}. ${r.name}</div>
      <div class="desc">${r.best ? U.fmtKg(r.best) + ' ' + SPECIES_BY_ID[r.sp].name : 'nothing yet'} · ${r.count} caught</div></div>`).join('');
  },

  openPermits() {
    if (this.open) return;
    this.open = 'permits';
    this.renderPermits();
    document.getElementById('permits').classList.remove('hidden');
  },

  renderPermits() {
    const el = document.getElementById('permits');
    el.innerHTML = `<button class="close" id="pmClose">✕</button><h2>Ranger Station</h2>
      <div class="desc">"Wardens patrol every bank in the valley. Fish without the right permit — or keep an undersized fish — and you'll be cooling your heels in the lockup." — Ranger Dale</div>
      <h3>Fishing permits</h3>
      ${PERMITS.map((p) => `<div class="row"><div><b>${p.name}</b><div class="desc">${p.desc}</div></div>
        ${Game.permits[p.id] ? '<span class="owned">✓ Held</span>' : `<button class="primary" data-permit="${p.id}" ${Game.money < p.price ? 'disabled' : ''}>Buy ${U.fmtMoney(p.price)}</button>`}</div>`).join('')}
      <h3>Size limits — minimum length to keep</h3>
      <div class="grid">${SPECIES.filter((s) => !s.legendary || s.min).map((s) => `<div class="card"><b>${s.name}</b><br>
        <span class="desc">${s.min === Infinity ? 'Protected — release only' : s.min ? s.min + ' cm' : 'No limit'}</span></div>`).join('')}</div>
      <div class="desc" style="margin-top:14px">You have <b style="color:var(--accent)">${U.fmtMoney(Game.money)}</b>${Game.stats.jailed ? ' · Times jailed: ' + Game.stats.jailed : ''}</div>`;
    el.querySelector('#pmClose').onclick = () => this.close();
    el.querySelectorAll('[data-permit]').forEach((b) => b.onclick = () => {
      const p = PERMITS.find((q) => q.id === b.dataset.permit);
      Game.money -= p.price; Game.permits[p.id] = true; Sfx.coin();
      Hud.toast(p.name + ' permit — you\'re legal there now.', UI.good, 2.2);
      this.renderPermits(); Game.save();
    });
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
      ${LURES.map((L) => `<div class="row"><div><b>${L.name}</b> <span class="desc">(have ${Game.lures[L.id] || 0})</span><div class="desc">${L.tip}</div></div>
        <button data-lure="${L.id}" ${Game.money < L.price ? 'disabled' : ''}>${L.pack > 1 ? L.pack + ' for ' : ''}${U.fmtMoney(L.price)}</button></div>`).join('')}
      ${Arsenal.shopHtml('hettie')}
      <h3>Bug spray</h3><div class="row"><div><b>Can of repellent</b> <span class="desc">(have ${Game.spray || 0})</span><div class="desc">Drops every mozzie in sight and keeps them off for 90 seconds.</div></div>
        <button id="sprayBtn" ${Game.money < 8 ? 'disabled' : ''}>$8</button></div>
      <h3>Rods</h3>${gearRows(RODS, 'rod')}
      <h3>Reels</h3>${gearRows(REELS, 'reel')}
      <h3>Line</h3>${gearRows(LINES, 'line')}
      <h3>Creel</h3><div class="row"><div>Bigger creel (+5 fish)</div>
        <button id="creelBtn" ${Game.money < 150 * Game.creelMax / 5 ? 'disabled' : ''}>${U.fmtMoney(150 * Game.creelMax / 5)}</button></div>`;
    el.querySelector('#sClose').onclick = () => this.close();
    el.querySelector('#sellBtn').onclick = () => { Game.money += creelVal; Game.creel = []; Game.stats.sold = (Game.stats.sold || 0) + 1; Sfx.coin(); this.renderShop(); Game.save(); };
    el.querySelector('#sprayBtn').onclick = () => { Game.money -= 8; Game.spray = (Game.spray || 0) + 1; Sfx.coin(); this.renderShop(); Game.save(); };
    Arsenal.wireShop(el, () => this.renderShop());
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
