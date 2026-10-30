// Chess Mode: every fish you hook (and every animal you shoot, ride you hot-wire, lock you pick and safe you crack)
// challenges you to a game, with an Elo from ~150 (tiddlers) to 3000 (monsters). Checkmate wins it; lose, draw or resign and it's gone. Full rules: castling,
// en passant, promotion (to a queen), check, checkmate and stalemate.
'use strict';

const CH_VAL = { p: 100, n: 310, b: 330, r: 500, q: 900, k: 0 };
const CH_GLYPH = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

const ChessEng = {
  start(noQueen) {
    const back = 'rnbqkbnr';
    const b = new Array(64).fill(null);
    for (let i = 0; i < 8; i++) { b[i] = back[i]; b[8 + i] = 'p'; b[48 + i] = 'P'; b[56 + i] = back[i].toUpperCase(); }
    if (noQueen) b[3] = null;
    return { b, turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: -1 };
  },
  white: (p) => p && p === p.toUpperCase(),
  colorOf(p) { return p ? (this.white(p) ? 'w' : 'b') : null; },

  attacked(s, sq, by) {
    const b = s.b, r = sq >> 3, c = sq & 7, W = by === 'w';
    const at = (rr, cc) => (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : undefined);
    const is = (p, t) => p && this.colorOf(p) === by && p.toLowerCase() === t;
    // Pawns.
    const pr = W ? r + 1 : r - 1;
    if (is(at(pr, c - 1), 'p') || is(at(pr, c + 1), 'p')) return true;
    for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) if (is(at(r + dr, c + dc), 'n')) return true;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && is(at(r + dr, c + dc), 'k')) return true;
    for (const [dr, dc, a, z] of [[1, 0, 'r', 'q'], [-1, 0, 'r', 'q'], [0, 1, 'r', 'q'], [0, -1, 'r', 'q'], [1, 1, 'b', 'q'], [1, -1, 'b', 'q'], [-1, 1, 'b', 'q'], [-1, -1, 'b', 'q']]) {
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const p = b[rr * 8 + cc];
        if (p) { if (is(p, a) || is(p, z)) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  },

  kingSq(s, col) { const k = col === 'w' ? 'K' : 'k'; return s.b.indexOf(k); },
  inCheck(s, col) { return this.attacked(s, this.kingSq(s, col), col === 'w' ? 'b' : 'w'); },

  pseudo(s) {
    const out = [], b = s.b, col = s.turn, W = col === 'w';
    const add = (f, t, extra) => out.push(Object.assign({ f, t }, extra));
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (!p || this.colorOf(p) !== col) continue;
      const r = sq >> 3, c = sq & 7, t = p.toLowerCase();
      const tryTo = (rr, cc) => { if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return false; const q = b[rr * 8 + cc]; if (!q) { add(sq, rr * 8 + cc); return true; } if (this.colorOf(q) !== col) add(sq, rr * 8 + cc); return false; };
      if (t === 'p') {
        const dir = W ? -1 : 1, start = W ? 6 : 1, last = W ? 0 : 7, one = (r + dir) * 8 + c;
        if (r + dir >= 0 && r + dir < 8 && !b[one]) {
          add(sq, one, r + dir === last ? { promo: true } : null);
          if (r === start && !b[(r + 2 * dir) * 8 + c]) add(sq, (r + 2 * dir) * 8 + c, { dbl: true });
        }
        for (const dc of [-1, 1]) {
          const cc = c + dc, rr = r + dir; if (cc < 0 || cc > 7 || rr < 0 || rr > 7) continue;
          const to = rr * 8 + cc, q = b[to];
          if (q && this.colorOf(q) !== col) add(sq, to, rr === last ? { promo: true } : null);
          else if (to === s.ep) add(sq, to, { epCap: true });
        }
      } else if (t === 'n') for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) tryTo(r + dr, c + dc);
      else if (t === 'k') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) tryTo(r + dr, c + dc);
        // Castling.
        const home = W ? 60 : 4, opp = W ? 'b' : 'w';
        if (sq === home && !this.attacked(s, home, opp)) {
          const K = W ? 'K' : 'k', Q = W ? 'Q' : 'q';
          if (s.castle[K] && !b[home + 1] && !b[home + 2] && b[home + 3] && b[home + 3].toLowerCase() === 'r' && !this.attacked(s, home + 1, opp) && !this.attacked(s, home + 2, opp)) add(sq, home + 2, { castle: 'k' });
          if (s.castle[Q] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] && b[home - 4].toLowerCase() === 'r' && !this.attacked(s, home - 1, opp) && !this.attacked(s, home - 2, opp)) add(sq, home - 2, { castle: 'q' });
        }
      } else {
        const dirs = t === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : t === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (tryTo(rr, cc)) { rr += dr; cc += dc; } }
      }
    }
    return out;
  },

  make(s, m) {
    const b = s.b.slice(), p = b[m.f], W = this.white(p), n = { b, turn: W ? 'b' : 'w', castle: Object.assign({}, s.castle), ep: -1 };
    n.cap = b[m.t];
    b[m.t] = m.promo ? (W ? 'Q' : 'q') : p; b[m.f] = null;
    if (m.epCap) { const cs = m.t + (W ? 8 : -8); n.cap = b[cs]; b[cs] = null; }
    if (m.dbl) n.ep = (m.f + m.t) >> 1;
    if (m.castle === 'k') { b[m.t - 1] = b[m.t + 1]; b[m.t + 1] = null; }
    if (m.castle === 'q') { b[m.t + 1] = b[m.t - 2]; b[m.t - 2] = null; }
    if (p === 'K') { n.castle.K = n.castle.Q = false; } if (p === 'k') { n.castle.k = n.castle.q = false; }
    for (const [sq, key] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.f === sq || m.t === sq) n.castle[key] = false;
    return n;
  },

  legal(s) { return this.pseudo(s).filter((m) => !this.inCheck(this.make(s, m), s.turn)); },

  // Material plus a nudge toward the centre and for pushing pawns, from the side to move's point of view.
  evaluate(s) {
    let v = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = s.b[sq]; if (!p) continue;
      const t = p.toLowerCase(), W = this.white(p), r = sq >> 3, c = sq & 7;
      let x = CH_VAL[t];
      const centre = 3.5 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c));
      if (t === 'n' || t === 'b') x += centre * 8;
      if (t === 'p') x += (W ? 6 - r : r - 1) * 6 + (c > 1 && c < 6 ? centre * 3 : 0);
      if (t === 'q') x += centre * 2;
      v += W ? x : -x;
    }
    return s.turn === 'w' ? v : -v;
  },

  // Captures only, until the dust settles, so it doesn't stop counting halfway through a trade.
  quiesce(s, alpha, beta, ctx, qd) {
    if (++ctx.n % 512 === 0 && performance.now() > ctx.deadline) throw ctx;
    const stand = this.evaluate(s);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qd <= 0) return alpha;
    const caps = this.legal(s).filter((m) => s.b[m.t] || m.epCap);
    caps.sort((a, b) => (s.b[b.t] ? CH_VAL[s.b[b.t].toLowerCase()] : 100) - (s.b[a.t] ? CH_VAL[s.b[a.t].toLowerCase()] : 100));
    for (const m of caps) {
      const v = -this.quiesce(this.make(s, m), -beta, -alpha, ctx, qd - 1);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  },

  search(s, depth, alpha, beta, ctx) {
    if (++ctx.n % 512 === 0 && performance.now() > ctx.deadline) throw ctx;
    const ms = this.legal(s);
    if (!ms.length) return this.inCheck(s, s.turn) ? -100000 - depth : 0;
    if (depth <= 0) return ctx.q ? this.quiesce(s, alpha, beta, ctx, 4) : this.evaluate(s);
    ms.sort((a, b) => (s.b[b.t] ? CH_VAL[s.b[b.t].toLowerCase()] : 0) - (s.b[a.t] ? CH_VAL[s.b[a.t].toLowerCase()] : 0));
    for (const m of ms) {
      const v = -this.search(this.make(s, m), depth - 1, -beta, -alpha, ctx);
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return alpha;
  },

  // How a rating plays: how often it just shoves something, how far it looks, and how fuzzy its judgement is.
  style(elo) {
    return {
      rnd: elo < 400 ? 0.7 : elo < 800 ? 0.4 : elo < 1200 ? 0.18 : elo < 1600 ? 0.07 : elo < 2000 ? 0.025 : 0,
      depth: elo < 700 ? 1 : elo < 1300 ? 2 : elo < 1900 ? 3 : elo < 2500 ? 4 : 6,
      q: elo >= 1100,
      fuzz: Math.max(0, (1700 - elo) / 4),
      ms: elo >= 2500 ? 2200 : elo >= 1900 ? 1500 : 900,
    };
  },

  best(s, elo) {
    const ms = this.legal(s);
    if (!ms.length) return null;
    const st = this.style(elo);
    if (Math.random() < st.rnd) return ms[(Math.random() * ms.length) | 0]; // a fish is still a fish
    const ctx = { n: 0, deadline: performance.now() + st.ms, q: st.q };
    const fuzz = new Map(ms.map((m) => [m, (Math.random() - 0.5) * st.fuzz]));
    let order = ms.sort(() => Math.random() - 0.5), best = order[0];
    // Iterative deepening: keep the best move from the deepest search that finished in time.
    for (let d = 1; d <= st.depth; d++) {
      try {
        const scored = [];
        let alpha = -1e9;
        for (const m of order) {
          const v = -this.search(this.make(s, m), d - 1, -1e9, -alpha + 400, ctx) + fuzz.get(m);
          scored.push([v, m]);
          if (v > alpha) alpha = v;
        }
        scored.sort((a, b) => b[0] - a[0]);
        order = scored.map((x) => x[1]); best = order[0];
        if (scored[0][0] > 90000) break; // found a mate
      } catch (e) { if (e !== ctx) throw e; break; }
    }
    return best;
  },
};

// Elo for a fish: tiddlers barely know how the horse moves; monsters play like grandmasters.
function fishElo(f) {
  const kg = f.kg || 0.3, frac = U.clamp(Math.log(kg / 0.05) / Math.log(400), 0, 1);
  return Math.min(3000, Math.round(150 + 2850 * Math.pow(frac, 1.6) + (f.prized || f.sp.legendary ? 300 : 0)));
}
const eloTier = (e) => (e < 500 ? 'barely knows the rules' : e < 1000 ? 'a casual player' : e < 1500 ? 'club player' : e < 2000 ? 'a strong club player' : e < 2400 ? 'a master' : 'a grandmaster');

const Chess = {
  on: false, open: false, s: null, sel: -1, duel: null, elo: 800, thinking: false, moves: 0, pendingWin: false,

  start() { this.on = true; document.body.classList.add('chessmode'); enterPlay(); Hud.toast('Chess Mode: hook a fish, shoot game, hot-wire a ride, pick a lock or crack a safe — you have to beat it at chess first.', UI.accent, 6); },

  hook() {
    if (this.hooked) return;
    this.hooked = true;
    const self = this;
    // Fish: checkmate to land it.
    const start = Fight.start.bind(Fight);
    Fight.start = function (f, q) {
      start(f, q);
      if (!self.on) return;
      self.challenge({ title: 'CHECKMATE TO LAND IT', who: (f.prized ? '★ PRIZED ' : '') + f.sp.name + ' · ' + U.fmtKg(f.kg), elo: fishElo(f), fish: true,
        win: () => { if (Fight.fish) Fight.land(); },
        lose: (msg) => { if (Fight.fish) Fight.thrown(msg); } });
    };
    // Game: hit it, then beat it, or it bolts.
    const shotAt = Animals.shotAt.bind(Animals);
    Animals.shotAt = function (x, y, scoped) {
      if (!self.on) return shotAt(x, y, scoped);
      const an = Animals.list.filter((a) => a.state !== 'dead' && U.dist(a.x, a.y, x, y) < (a.type === 'deer' ? 1.2 : 0.9) * (scoped ? 0.7 : 1))
        .sort((a, b) => U.dist(a.x, a.y, x, y) - U.dist(b.x, b.y, x, y))[0];
      if (!an) return false;
      const name = an.type === 'boar' ? 'wild boar' : an.buck ? 'stag' : 'deer';
      const keep = { speed: an.speed, state: an.state }; an.speed = 0;
      self.challenge({ title: 'CHECKMATE TO BAG IT', who: 'A ' + name, elo: an.type === 'boar' ? 2100 : an.buck ? 1800 : 1300,
        win: () => {
          an.state = 'dead'; an.deadT = 45; an.speed = 0;
          an.kg = an.type === 'boar' ? 45 + Math.random() * 75 : an.buck ? 65 + Math.random() * 55 : 35 + Math.random() * 35;
          Hud.toast('Bagged a ' + name + '! Walk over to collect it.', UI.good, 2.4);
        },
        lose: () => { an.speed = keep.speed; Animals.startle(an); Hud.toast('The ' + name + ' outplays you and bolts.', UI.bad, 2); } });
      return true;
    };
    // Hot-wiring and break-ins: the lock plays you.
    const via = (setup, desc, elo) => {
      LockPick.alert = 0; LockPick.done = false; setup();
      self.challenge({ title: 'CHECKMATE TO GET IN', who: desc, elo, win: () => LockPick.success(), lose: () => LockPick.fail() });
    };
    for (const [fn, mk] of [
      ['openBoat', (b) => [() => { LockPick.r = null; LockPick.house = null; LockPick.boat = b; }, b.owner + '\'s jetski ignition', 1500]],
      ['open', (r) => [() => { LockPick.r = r; LockPick.house = null; LockPick.boat = null; }, r.name + '\'s ' + BIKE_BY_ID[r.bikeId].name, Math.round(U.clamp(700 + BIKE_BY_ID[r.bikeId].price * 0.9, 700, 2600))]],
      ['openHouse', (b) => [() => { LockPick.r = null; LockPick.house = b; LockPick.boat = null; }, b.name.replace(/ house$/, '') + ' front door', b.big ? 2000 : 1100]],
    ]) {
      const orig = LockPick[fn].bind(LockPick);
      LockPick[fn] = function (x) { if (!self.on) return orig(x); const [setup, desc, elo] = mk(x); via(setup, desc, elo); };
    }
    // Safes.
    const crack = Thief.crack.bind(Thief);
    Thief.crack = function (b) {
      if (!self.on || !Thief.safeReady(b)) return crack(b);
      Thief.safe = { b, owner: Npcs.list.find((n) => n.home === b), done: false };
      self.challenge({ title: 'CHECKMATE TO CRACK IT', who: b.name + '\'s safe', elo: b.big ? 2600 : 1700, win: () => Thief.safeEnd('ok'), lose: () => Thief.safeEnd('fail') });
    };
  },

  challenge(d) {
    this.duel = d; this.elo = d.elo;
    this.s = ChessEng.start(false);
    this.sel = -1; this.thinking = false; this.moves = 0; this.last = null; this.pendingWin = false;
    this.open = true; this.prevMode = Game.mode === 'chess' ? 'play' : Game.mode; Game.mode = 'chess';
    Sfx.setDrag && Sfx.setDrag(0);
    document.querySelector('#chess .chess-head b').textContent = d.title;
    document.getElementById('chessWho').innerHTML = d.who.replace(/</g, '&lt;') + ' — <span class="elo">ELO ' + d.elo + '</span> · ' + eloTier(d.elo);
    document.getElementById('chessResign').textContent = d.fish ? 'Resign (let it go)' : 'Resign (walk away)';
    document.getElementById('chess').classList.remove('hidden');
    this.status((d.fish ? 'FISH ON! ' : '') + 'It challenges you. You\'re white — your move.');
    this.draw();
  },

  status(t, cls = '') { const el = document.getElementById('chessStatus'); el.textContent = t; el.className = cls; },

  click(sq) {
    if (this.thinking || !this.open || this.s.turn !== 'w') return;
    const p = this.s.b[sq];
    if (this.sel >= 0) {
      const m = ChessEng.legal(this.s).find((x) => x.f === this.sel && x.t === sq);
      if (m) { this.play(m); return; }
    }
    this.sel = p && ChessEng.white(p) ? sq : -1;
    this.draw();
  },

  play(m) {
    const cap = this.s.b[m.t] || (m.epCap ? 'p' : null);
    this.s = ChessEng.make(this.s, m); this.sel = -1; this.moves++; this.last = m;
    Sfx.click(); if (cap) Sfx.slap && Sfx.slap(0.5);
    this.draw();
    if (this.checkEnd()) return;
    if (this.s.turn === 'b') {
      this.thinking = true; this.status('Thinking…' + (this.elo >= 1900 ? ' (it\'s good at this)' : ''), 'dim');
      setTimeout(() => {
        if (!this.open) return;
        const r = ChessEng.best(this.s, this.elo);
        this.thinking = false;
        if (r) this.play(r);
      }, 300);
    } else this.status(ChessEng.inCheck(this.s, 'w') ? 'CHECK! Your move.' : 'Your move.', ChessEng.inCheck(this.s, 'w') ? 'bad' : '');
  },

  checkEnd() {
    const ms = ChessEng.legal(this.s), side = this.s.turn;
    const onlyKings = this.s.b.filter((p) => p).length === 2;
    if (ms.length && !onlyKings && this.moves < 300) {
      if (side === 'b' && ChessEng.inCheck(this.s, 'b')) this.status('Check!', 'good');
      return false;
    }
    const mate = !ms.length && ChessEng.inCheck(this.s, side);
    if (mate && side === 'b') this.finish(true, 'CHECKMATE! You win.');
    else if (mate) this.finish(false, this.duel.fish ? 'Checkmated by a fish. It spits the hook and swims off, smug.' : 'Checkmated. You lose.');
    else this.finish(false, this.duel.fish ? 'Stalemate. It slips the hook while you argue about it.' : 'Stalemate — that counts as a loss here.');
    return true;
  },

  finish(won, msg) {
    if (!this.open) return;
    this.status(msg, won ? 'good' : 'bad');
    this.open = false; this.pendingWin = won;
    const d = this.duel;
    setTimeout(() => {
      document.getElementById('chess').classList.add('hidden');
      Game.mode = this.prevMode || 'play';
      this.pendingWin = false;
      if (won) d.win(); else d.lose(msg);
    }, 1300);
  },

  resign() { if (!this.open) return; this.finish(false, this.duel.fish ? 'You resign. It swims off with your dignity.' : 'You resign and walk away.'); },

  draw() {
    const el = document.getElementById('chessBoard'), legal = this.sel >= 0 ? ChessEng.legal(this.s).filter((m) => m.f === this.sel).map((m) => m.t) : [];
    if (!el.children.length) for (let i = 0; i < 64; i++) { const d = document.createElement('div'); d.onclick = () => this.click(i); el.appendChild(d); }
    const chk = ChessEng.inCheck(this.s, this.s.turn) ? ChessEng.kingSq(this.s, this.s.turn) : -1;
    for (let i = 0; i < 64; i++) {
      const d = el.children[i], p = this.s.b[i], dark = ((i >> 3) + (i & 7)) % 2 === 1;
      d.className = 'sq ' + (dark ? 'dk' : 'lt') + (i === this.sel ? ' sel' : '') + (legal.includes(i) ? (p ? ' cap' : ' mv') : '') + (this.last && (this.last.f === i || this.last.t === i) ? ' last' : '') + (i === chk ? ' chk' : '');
      d.textContent = p ? CH_GLYPH[p] : '';
      d.classList.toggle('wp', !!p && ChessEng.white(p));
    }
  },
};
