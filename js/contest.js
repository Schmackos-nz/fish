// Weekend contests: alternating fishing and hunting. Enter with Tim, heaviest fish (or beast) from
// Saturday dawn to Monday dawn wins. Day 1 is a Monday.
'use strict';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CONTESTS = {
  fishing: { name: 'Weekend Fishing Classic', fee: 25, prize: 350, unit: 'kg', what: 'heaviest fish', icon: '🎣' },
  hunting: { name: 'Weekend Hunting Derby', fee: 40, prize: 450, unit: 'kg', what: 'heaviest deer or boar', icon: '🦌' },
};
const HUNTER_NAMES = ['Big Trev', 'Shazza', 'Dazza', 'Old Bert', 'Moose', 'Ingrid', 'Cliff'];

const Contest = {
  // Absolute game hours; a week is 168 h, the contest runs Sat 06:00 → Mon 06:00.
  nowH() { return (Game.env.day - 1) * 24 + Game.env.hour; },
  weekday(day = Game.env.day) { return WEEKDAYS[(day - 1) % 7]; },
  weekOf(h) { return Math.floor(h / 168); },
  typeOf(week) { return week % 2 === 0 ? 'fishing' : 'hunting'; },
  startH(week) { return week * 168 + 5 * 24 + 6; },
  endH(week) { return week * 168 + 7 * 24 + 6; },

  // The contest that's on (or open for entries from Friday) right now, if any.
  current() {
    const h = this.nowH();
    for (const w of [this.weekOf(h), this.weekOf(h) - 1]) {
      if (w < 0) continue;
      if (h >= this.startH(w) - 24 && h < this.endH(w)) return { week: w, type: this.typeOf(w), live: h >= this.startH(w) };
    }
    return null;
  },

  state(week) {
    let c = Game.contest;
    if (!c || c.week !== week) {
      c = Game.contest = { week, type: this.typeOf(week), entered: false, you: 0, youWhat: '', rivals: [], done: false, announced: false };
      const names = this.typeOf(week) === 'fishing' ? Npcs.list.map((n) => n.name) : HUNTER_NAMES;
      c.rivals = names.slice(0, 8).map((name) => ({ name, kg: 0, what: '' }));
    }
    return c;
  },

  enter() {
    const cur = this.current(); if (!cur) return;
    const c = this.state(cur.week), C = CONTESTS[c.type];
    if (c.entered) return;
    if (Game.money < C.fee) { Hud.toast('Entry is ' + U.fmtMoney(C.fee) + ' — you\'re short.', UI.bad, 1.8); return; }
    Game.money -= C.fee; c.entered = true; Sfx.coin(); Rep.add(2);
    Hud.toast('Entered the ' + C.name + '! ' + (cur.live ? 'It\'s on — go get \'em.' : 'Starts Saturday at dawn.'), UI.good, 2.6);
    Game.save();
  },

  // Results feed in from real catches/kills while the contest is live.
  onFish(name, kg, what) { this.record('fishing', name, kg, what); },
  onKill(name, kg, what) { this.record('hunting', name, kg, what); },
  record(type, name, kg, what) {
    const cur = this.current();
    if (!cur || !cur.live || cur.type !== type) return;
    const c = this.state(cur.week);
    if (name === 'You') {
      if (!c.entered) return;
      if (kg > c.you) {
        const lead = kg > Math.max(0, ...c.rivals.map((r) => r.kg));
        c.you = kg; c.youWhat = what;
        Hud.toast('Contest weigh-in: ' + what + ' ' + kg.toFixed(2) + ' kg — ' + (lead ? 'you\'re in the LEAD!' : 'new personal best.'), lead ? UI.good : UI.accent, 2.6);
      }
      return;
    }
    const r = c.rivals.find((x) => x.name === name);
    if (r && kg > r.kg) { r.kg = kg; r.what = what; }
  },

  standings(c) {
    const all = c.rivals.filter((r) => r.kg > 0).map((r) => ({ ...r }));
    if (c.entered) all.push({ name: 'You', kg: c.you, what: c.youWhat, you: true });
    return all.sort((a, b) => b.kg - a.kg);
  },

  update(dt) {
    const cur = this.current();
    // Settle a finished contest (even if we slept or were in jail through the end).
    const c = Game.contest;
    if (c && !c.done && this.nowH() >= this.endH(c.week)) this.finish(c);
    if (!cur) return;
    const st = this.state(cur.week), C = CONTESTS[st.type];
    if (cur.live && !st.announced) {
      st.announced = true;
      Hud.toast(C.icon + ' The ' + C.name + ' is ON until Monday dawn! ' + (st.entered ? 'Good luck!' : 'Enter with Tim — ' + U.fmtMoney(C.fee) + '.'), UI.accent, 4);
    }
    // Off-screen rivals: hunters out in the hills (and the odd angler luck the valley doesn't see).
    if (cur.live) {
      for (const r of st.rivals) {
        if (Math.random() > dt * (st.type === 'hunting' ? 0.006 : 0.002)) continue;
        if (st.type === 'hunting') { const boar = Math.random() < 0.45, kg = boar ? 45 + Math.random() * 70 : 40 + Math.random() * 75; if (kg > r.kg) { r.kg = kg; r.what = boar ? 'Wild boar' : 'Deer'; } }
        else { const kg = 0.4 + Math.random() ** 2 * 5; if (kg > r.kg) { r.kg = kg; r.what = 'Trout'; } }
      }
    }
  },

  finish(c) {
    c.done = true;
    const C = CONTESTS[c.type], table = this.standings(c), win = table[0];
    if (win && win.you) {
      Game.money += C.prize; Rep.add(8); (Game.trophies = Game.trophies || []).push({ type: c.type, kg: win.kg, day: Game.env.day });
      Sfx.coin();
    }
    const rows = table.slice(0, 6).map((r, i) => `<div class="row"><div><b>${i + 1}. ${r.you ? '<span style="color:var(--accent)">You</span>' : r.name}</b> <span class="desc">${r.what || ''}</span></div><b>${r.kg.toFixed(2)} kg</b></div>`).join('');
    Life.panel(`<h2>${C.icon} ${C.name} — results</h2>
      <div class="desc">${win ? (win.you ? 'YOU WIN! ' + U.fmtMoney(C.prize) + ' and a trophy for the mantelpiece.' : win.name + ' takes the ' + U.fmtMoney(C.prize) + ' prize with a ' + win.kg.toFixed(2) + ' kg ' + (win.what || '').toLowerCase() + '.') : 'Nobody weighed anything in. Tough weekend.'}</div>
      <h3>Final standings</h3>${rows || '<div class="desc">No entries.</div>'}
      ${c.entered && !(win && win.you) ? '<div class="desc" style="margin-top:10px">Better luck next weekend!</div>' : ''}`);
    Hud.toast(win ? (win.you ? '🏆 You won the ' + C.name + '!' : '🏆 ' + win.name + ' won the ' + C.name + '.') : 'The contest is over.', win && win.you ? UI.good : UI.accent, 3.5);
    Game.save();
  },

  // Tim's panel section.
  timHtml() {
    const cur = this.current();
    if (!cur) {
      const h = this.nowH(), w = this.weekOf(h), next = h < this.startH(w) - 24 ? w : w + 1;
      return `<h3>Weekend contest</h3><div class="desc">Next up: the ${CONTESTS[this.typeOf(next)].name}. Entries open Friday — come see me.</div>`;
    }
    const c = this.state(cur.week), C = CONTESTS[c.type], table = this.standings(c).slice(0, 5);
    return `<h3>${C.icon} ${C.name}</h3>
      <div class="desc">${C.what.charAt(0).toUpperCase() + C.what.slice(1)} from Saturday dawn to Monday dawn wins ${U.fmtMoney(C.prize)}. Entry ${U.fmtMoney(C.fee)}. ${cur.live ? 'It\'s on now!' : 'Starts Saturday at dawn.'}</div>
      ${c.entered ? '<div class="row"><b style="color:var(--good)">✓ You\'re entered</b><span class="desc">Your best: ' + (c.you ? c.you.toFixed(2) + ' kg' : 'nothing yet') + '</span></div>' : `<div class="row"><b>Enter the contest</b><button class="primary" data-enter ${Game.money < C.fee ? 'disabled' : ''}>Pay ${U.fmtMoney(C.fee)}</button></div>`}
      ${table.length ? table.map((r, i) => `<div class="row"><span>${i + 1}. ${r.you ? '<b style="color:var(--accent)">You</b>' : r.name}</span><span class="desc">${r.kg.toFixed(2)} kg ${r.what ? '· ' + r.what : ''}</span></div>`).join('') : ''}`;
  },

  // A small card under the minimap while a contest you entered is live.
  drawHud(hud, x, y) {
    const cur = this.current();
    if (!cur || !cur.live) return;
    const c = this.state(cur.week), C = CONTESTS[c.type];
    const table = this.standings(c), lead = table[0], place = table.findIndex((r) => r.you) + 1;
    const left = this.endH(cur.week) - this.nowH();
    const w = 200, h = 66;
    hud.card(x - w / 2, y, w, h, { r: 14 });
    hud.text(C.icon + ' ' + (c.type === 'fishing' ? 'Fishing contest' : 'Hunting derby'), x - w / 2 + 12, y + 20, UI.accent, 12, 'left', 700);
    hud.text(Math.ceil(left) + 'h left', x + w / 2 - 12, y + 20, UI.muted, 11, 'right', 600);
    hud.text(lead ? 'Leader: ' + (lead.you ? 'YOU' : lead.name) + ' ' + lead.kg.toFixed(1) + ' kg' : 'No weigh-ins yet', x - w / 2 + 12, y + 38, UI.ink, 11, 'left', 500);
    if (c.entered) hud.text('You: ' + (c.you ? c.you.toFixed(1) + ' kg · ' + ordinal(place) : 'nothing yet'), x - w / 2 + 12, y + 55, place === 1 ? UI.good : UI.muted, 11, 'left', 600);
    else hud.text('Not entered — see Tim (' + U.fmtMoney(C.fee) + ')', x - w / 2 + 12, y + 55, UI.dim, 11, 'left', 500);
  },
};

function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'); }

// Wind sock beside the minimap: points downwind, droops when calm, flaps when it's blowing.
function drawWindSock(hud, x, y) {
  const g = hud.g, wind = Game.env.wind, sp = Math.hypot(wind.x, wind.y);
  hud.card(x - 30, y - 30, 60, 76, { r: 14 });
  // Pole and ring.
  g.strokeStyle = '#C8BFAE'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y + 26); g.lineTo(x, y - 18); g.stroke();
  g.fillStyle = '#C8BFAE'; g.beginPath(); g.arc(x, y - 18, 2.5, 0, 7); g.fill();
  // Sock direction: screen space matches the north-up map. Calm air lets it hang down.
  const lift = U.clamp(sp / 2.5, 0.12, 1), a = Math.atan2(wind.y, wind.x);
  const dx = Math.cos(a) * lift, dy = Math.sin(a) * lift * 0.6 + (1 - lift) * 0.95;
  const len = 34, flap = Math.sin(Game.time * (4 + sp * 3)) * 2.5 * lift;
  const nx = -dy, ny = dx;
  g.save(); g.translate(x, y - 18);
  for (let s = 0; s < 4; s++) {
    const t0 = s / 4, t1 = (s + 1) / 4, w0 = 7 * (1 - t0 * 0.55), w1 = 7 * (1 - t1 * 0.55);
    const p0x = dx * len * t0, p0y = dy * len * t0 + flap * t0 * t0, p1x = dx * len * t1, p1y = dy * len * t1 + flap * t1 * t1;
    g.fillStyle = s % 2 ? '#F4F0E6' : '#E8602A';
    g.beginPath();
    g.moveTo(p0x + nx * w0, p0y + ny * w0); g.lineTo(p1x + nx * w1, p1y + ny * w1);
    g.lineTo(p1x - nx * w1, p1y - ny * w1); g.lineTo(p0x - nx * w0, p0y - ny * w0); g.closePath(); g.fill();
  }
  g.restore();
  hud.text(sp.toFixed(1) + ' m/s', x, y + 40, UI.muted, 10, 'center', 600);
}
