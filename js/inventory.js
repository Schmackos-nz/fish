// Slot inventory, Minecraft-style: a grid of everything you're carrying plus a 5-slot hotbar of tools.
// Drag a tool between the bag and the hotbar to rearrange; click an item for what you can do with it.
'use strict';

const HOTBAR_SIZE = 5;
const DEFAULT_HOTBAR = ['rod', 'gun', 'axe', 'spade', 'spray'];
const TOOL_IDS = ['rod', 'gun', 'spray', 'binos', 'axe', 'spade'];
const FOOD_ICONS = { 'Bread roll': '🍞', 'Can of beans': '🥫', 'Meat pie': '🥧', 'Energy drink': '🥤', 'Wild duck': '🦆' };

const Inventory = {
  iconCache: {},

  hotbar() {
    let h = Game.hotbar;
    if (!Array.isArray(h) || h.length !== HOTBAR_SIZE) h = Game.hotbar = DEFAULT_HOTBAR.slice();
    return h;
  },
  hotKey(id) { const i = this.hotbar().indexOf(id); return i >= 0 ? String(i + 1) : null; },

  toolIcon(id) {
    if (this.iconCache[id]) return this.iconCache[id];
    const c = document.createElement('canvas'); c.width = c.height = 56;
    Tools.icon(c.getContext('2d'), id, 28, 28, 1.5);
    return (this.iconCache[id] = c.toDataURL());
  },
  toolName(id) { return id === 'gun' ? Arsenal.weapon().name : (TOOLS.find((t) => t.id === id) || {}).name || id; },

  // Everything you're carrying, as stacks.
  items() {
    const out = [];
    for (const id of TOOL_IDS) if (!this.hotbar().includes(id)) out.push({ kind: 'tool', id, name: this.toolName(id), img: this.toolIcon(id), count: Tools.count(id) });
    for (const L of LURES) if (Game.lures[L.id] > 0) out.push({ kind: 'lure', id: L.id, name: L.name, icon: L.id === 'worm' ? '🪱' : '🪝', tint: L.color, count: Game.lures[L.id] });
    if (Game.ammo > 0) out.push({ kind: 'ammo', id: 'rifle', name: 'Rifle rounds', icon: '🔸', count: Game.ammo });
    for (const [k, a] of Object.entries(AMMO)) if (k !== 'rifle' && (Game.ammoX[k] || 0) > 0) out.push({ kind: 'ammo', id: k, name: a.name, icon: k === 'rockets' ? '🚀' : k === 'shells' ? '🔴' : '🔹', count: Game.ammoX[k] });
    // Food stacks by name.
    const food = {};
    Game.pantry.forEach((f, i) => { const key = f.name + (f.shroom || ''); (food[key] = food[key] || { kind: 'food', name: f.name, energy: f.energy, idx: [], icon: f.shroom ? '🍄' : FOOD_ICONS[f.name] || '🍽️' }).idx.push(i); });
    for (const f of Object.values(food)) out.push({ ...f, count: f.idx.length });
    for (const [k, n] of [['batter', 'Batter mix'], ['herbs', 'Butter & herbs']]) if ((Game.ingredients[k] || 0) > 0) out.push({ kind: 'ingredient', name: n, icon: k === 'batter' ? '🥣' : '🧈', count: Game.ingredients[k] });
    Game.creel.forEach((c, i) => out.push({ kind: 'fish', name: SPECIES_BY_ID[c.id].name, idx: i, icon: '🐟', count: 1, sub: U.fmtKg(c.kg) + ' · ' + c.cm + ' cm' }));
    if ((Game.wood || 0) > 0) out.push({ kind: 'wood', name: 'Firewood', icon: '🪵', count: Game.wood });
    if ((Game.weed || 0) > 0) out.push({ kind: 'weed', name: 'Bags of weed', icon: '🌿', count: Game.weed });
    if ((Game.seeds || 0) > 0) out.push({ kind: 'seeds', name: 'Weed seeds', icon: '🌱', count: Game.seeds });
    out.push({ kind: 'tool', id: 'stetho', name: 'Stethoscope', icon: '🩺', fixed: true, count: null });
    return out;
  },

  slotHtml(it, attrs) {
    if (!it) return `<div class="inv-slot empty" ${attrs}></div>`;
    const pic = it.img ? `<img src="${it.img}" alt="">` : `<span class="inv-emo">${it.icon}</span>`;
    return `<div class="inv-slot${it.kind === 'tool' && !it.fixed ? ' draggable' : ''}" ${attrs} title="${it.name}">${pic}${it.count !== null && it.count !== undefined && it.count !== 1 ? `<b class="inv-n">${it.count}</b>` : ''}</div>`;
  },

  open(sel) {
    const items = this.items(), COLS = 9, ROWS = Math.max(3, Math.ceil(items.length / COLS));
    const grid = [];
    for (let i = 0; i < COLS * ROWS; i++) grid.push(this.slotHtml(items[i], `data-inv="${i}"`));
    const hb = this.hotbar().map((id, i) => this.slotHtml(id ? { kind: 'tool', id, name: this.toolName(id), img: this.toolIcon(id), count: Tools.count(id) } : null, `data-hot="${i}"`) .replace('class="inv-slot', `class="inv-slot hot${Tools.current === id ? ' sel' : ''}`) + `<i class="inv-key">${i + 1}</i>`).map((h) => `<div class="inv-hotwrap">${h}</div>`).join('');
    const it = sel !== undefined ? items[sel] : null;
    const home = Game.home ? World.houses[Game.home.id] : null;
    Life.panel(`<h2>Inventory</h2>
      <div class="desc">Health ${Math.round(Wanted.health)} · Food ${Math.round(Game.food)} · Energy ${Math.round(Game.energy)} · ${U.fmtMoney(Game.money)} · ${home ? 'Home: ' + home.name + (Game.rentDebt ? ' (owing ' + U.fmtMoney(Game.rentDebt) + ')' : '') : 'No home'}</div>
      <div class="inv-grid" style="grid-template-columns:repeat(${COLS}, 52px)">${grid.join('')}</div>
      <h3>Hotbar <span class="desc" style="text-transform:none;letter-spacing:0">· drag tools here (keys 1–${HOTBAR_SIZE})</span></h3>
      <div class="inv-hotbar">${hb}</div>
      <div class="inv-info">${it ? this.infoHtml(it) : '<span class="desc">Click an item to see what you can do with it. Drag tools between your bag and the hotbar.</span>'}</div>`, (el) => this.wire(el, items, sel));
  },

  infoHtml(it) {
    const btn = (act, label, primary) => `<button ${primary ? 'class="primary"' : ''} data-act="${act}">${label}</button>`;
    let desc = '', acts = '';
    if (it.kind === 'tool' && it.id === 'stetho') desc = 'For listening to safes. As you do.';
    else if (it.kind === 'tool') { desc = 'A tool. Put it on your hotbar, or use it straight from the bag.'; acts = btn('use', 'Use now', true); }
    else if (it.kind === 'food') { desc = '+' + it.energy + ' food each.'; acts = btn('eat', 'Eat one', true); }
    else if (it.kind === 'lure') { desc = 'Bait and lures. Pick one from the lure bar when the rod is out.'; acts = btn('tie', 'Tie it on'); }
    else if (it.kind === 'fish') desc = it.sub + ' — sell it at the tackle shop, or cook it.';
    else if (it.kind === 'ammo') desc = 'Ammunition.';
    else if (it.kind === 'ingredient') desc = 'Cooking ingredient (for the BBQ or a stove).';
    else if (it.kind === 'wood') desc = 'For campfires: 3 wood builds one (E with the axe or empty hands).';
    else if (it.kind === 'weed' || it.kind === 'seeds') desc = 'Wardens will jail you for these.';
    return `<div class="inv-info-row"><b>${it.name}${it.count > 1 ? ' ×' + it.count : ''}</b><span class="desc">${desc}</span><span>${acts}</span></div>`;
  },

  wire(el, items, sel) {
    el.querySelectorAll('[data-inv]').forEach((s) => { s.onclick = () => { const i = +s.dataset.inv; if (items[i]) this.open(i); }; });
    el.querySelectorAll('[data-hot]').forEach((s) => { s.onclick = () => { const id = this.hotbar()[+s.dataset.hot]; if (id) { Menus.close(); Tools.select(id); } }; });
    const it = sel !== undefined ? items[sel] : null;
    el.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'use') { Menus.close(); Tools.current = null; Tools.select(it.id); }
      else if (a === 'eat') { Life.eat(it.idx[0]); this.open(); }
      else if (a === 'tie') { Menus.close(); Tools.current !== 'rod' && Tools.select('rod'); Fishing.selectLure(it.id); }
    }; });
    // Drag and drop tools between bag and hotbar (mouse or touch).
    let drag = null;
    const slotAt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest('[data-hot],[data-inv]'); };
    el.querySelectorAll('.inv-slot.draggable').forEach((s) => {
      s.addEventListener('pointerdown', (e) => {
        const from = s.dataset.hot !== undefined ? { hot: +s.dataset.hot } : { inv: +s.dataset.inv };
        const id = from.hot !== undefined ? this.hotbar()[from.hot] : items[from.inv].id;
        const ghost = s.cloneNode(true); ghost.classList.add('inv-ghost'); document.body.appendChild(ghost);
        drag = { from, id, ghost, x0: e.clientX, y0: e.clientY, moved: false };
        ghost.style.left = e.clientX - 26 + 'px'; ghost.style.top = e.clientY - 26 + 'px';
        s.setPointerCapture(e.pointerId);
      });
      s.addEventListener('pointermove', (e) => { if (!drag) return; if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true; drag.ghost.style.left = e.clientX - 26 + 'px'; drag.ghost.style.top = e.clientY - 26 + 'px'; });
      s.addEventListener('pointerup', (e) => {
        if (!drag) return;
        const d = drag; drag = null; d.ghost.remove();
        if (!d.moved) return; // a plain click: handled by onclick
        const to = slotAt(e.clientX, e.clientY); if (!to) return;
        const hb = this.hotbar();
        if (to.dataset.hot !== undefined) {
          const ti = +to.dataset.hot;
          if (d.from.hot !== undefined) [hb[d.from.hot], hb[ti]] = [hb[ti], hb[d.from.hot]]; // swap within hotbar
          else hb[ti] = d.id; // bag → hotbar (whatever was there goes back in the bag)
        } else if (d.from.hot !== undefined) hb[d.from.hot] = null; // hotbar → bag
        if (!hb.includes(Tools.current) && Tools.current !== 'hands' && TOOL_IDS.includes(Tools.current) && Tools.current !== 'binos') Tools.current = 'hands';
        Sfx.click(); Game.save(); this.open();
      });
    });
  },
};
