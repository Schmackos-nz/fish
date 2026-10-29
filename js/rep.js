// Your standing with the locals, from Hated (-100) to Friendly (+100). Good deeds and bad ones move it;
// it drifts back toward Neutral over time. Friendly folk give you discounts; hated ones charge you extra.
'use strict';

const REP_TIERS = [
  { min: 60, name: 'Friendly', color: '#7FC483', mult: 0.8, note: '20% off at every till' },
  { min: 20, name: 'Liked', color: '#B8D86A', mult: 0.9, note: '10% off at every till' },
  { min: -20, name: 'Neutral', color: '#C8BFAE', mult: 1, note: '' },
  { min: -60, name: 'Disliked', color: '#E3A945', mult: 1.1, note: '10% "tourist tax" at every till' },
  { min: -101, name: 'Hated', color: '#E2584D', mult: 1.25, note: '25% surcharge — nobody wants your business' },
];

const Rep = {
  saved: 0, greetT: 10, talked: {},

  val() { return Game.repute || 0; },
  tier(v = this.val()) { return REP_TIERS.find((t) => v >= t.min); },
  mult() { return this.tier().mult; },

  add(d, why) {
    const before = this.tier();
    Game.repute = U.clamp(this.val() + d, -100, 100);
    const after = this.tier();
    if (after !== before) Hud.toast((d > 0 ? '📈 ' : '📉 ') + 'The locals now see you as ' + after.name.toUpperCase() + (after.note ? ' — ' + after.note : '') + '.', after.color, 3.2);
  },

  daily() { Game.repute = this.val() * 0.97; this.talked = {}; },

  // Spending money at a counter? (Shops, permits, clinic, rent, Dusty, the dealership…)
  shopping() {
    if (Game.mode !== 'play') return false;
    if (Menus.open === 'shop' || Menus.open === 'permits') return true;
    return Menus.open === 'misc' && !(LockPick && !LockPick.done && LockPick.cv && document.getElementById('lockCv')) && !(Thief && Thief.safe);
  },

  update(dt) {
    // Show the discount (or surcharge) while you're at a till.
    const note = document.getElementById('repNote'), t = this.tier();
    const show = this.shopping() && t.mult !== 1;
    note.classList.toggle('hidden', !show);
    if (show) { note.textContent = (t.mult < 1 ? '🤝 ' : '😠 ') + t.name + ': ' + t.note; note.style.color = t.color; }
    if (this.saved) {
      Hud.toast(this.saved > 0 ? 'Friendly discount: you saved ' + U.fmtMoney(this.saved) + '.' : 'Surcharge for being ' + t.name.toLowerCase() + ': ' + U.fmtMoney(-this.saved) + ' extra.', this.saved > 0 ? UI.good : UI.bad, 1.8);
      this.saved = 0;
    }
    // Locals react to you in passing.
    if (Menus.open) return;
    this.greetT -= dt;
    if (this.greetT <= 0) {
      this.greetT = 18 + Math.random() * 20;
      const v = this.val();
      if (Math.abs(v) < 40 || Interior.active) return;
      const n = Npcs.list.find((x) => !x.away && !x.mob && ['cast', 'wait', 'walk'].includes(x.state) && U.dist(x.x, x.y, Player.x, Player.y) < 9);
      if (n) Npcs.say(n, U.pick(Math.random, v > 0 ? ['G\'day! Good to see ya.', 'Oh hey, it\'s you! Legend.', 'Thanks for fixing the town up, mate.', 'Fish are biting over yonder, by the way.'] : ['Ugh. You again.', 'Keep walking, thief.', 'Don\'t come near my tackle.', 'Nobody wants you here.']), 3);
    }
  },
};

// Every purchase passes through the till: discounts or surcharges by reputation.
(() => {
  let m = Game.money || 0;
  Object.defineProperty(Game, 'money', {
    configurable: true, enumerable: true,
    get() { return m; },
    set(v) {
      if (v < m && typeof Rep !== 'undefined' && Rep.shopping()) {
        const spend = m - v, adj = Math.round(spend * Rep.mult());
        Rep.saved += spend - adj;
        v = Math.max(0, m - adj);
      }
      m = v;
    },
  });
})();
