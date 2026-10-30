// Chess Mode: every fish you hook challenges you to a game. Checkmate it to land it; lose, draw or resign and it
// swims off. Bigger fish think further ahead; tiddlers play without their queen. Full rules: castling,
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

  search(s, depth, alpha, beta) {
    const ms = this.legal(s);
    if (!ms.length) return this.inCheck(s, s.turn) ? -100000 - depth : 0;
    if (depth === 0) return this.evaluate(s);
    ms.sort((a, b) => (s.b[b.t] ? CH_VAL[s.b[b.t].toLowerCase()] : 0) - (s.b[a.t] ? CH_VAL[s.b[a.t].toLowerCase()] : 0));
    for (const m of ms) {
      const v = -this.search(this.make(s, m), depth - 1, -beta, -alpha);
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return alpha;
  },

  best(s, depth, blunder) {
    const ms = this.legal(s);
    if (!ms.length) return null;
    if (Math.random() < blunder) return ms[(Math.random() * ms.length) | 0]; // a fish is still a fish
    let best = null, bv = -1e9;
    for (const m of ms.sort(() => Math.random() - 0.5)) {
      const v = -this.search(this.make(s, m), depth - 1, -1e9, -bv);
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  },
};

const Chess = {
  on: false, open: false, s: null, sel: -1, fish: null, depth: 1, blunder: 0, thinking: false, moves: 0, history: [],

  start() { this.on = true; document.body.classList.add('chessmode'); enterPlay(); Hud.toast('Chess Mode: hook a fish, then beat it at chess to land it.', UI.accent, 5); },

  hook() {
    if (this.hooked) return;
    this.hooked = true;
    const start = Fight.start.bind(Fight);
    Fight.start = function (f, q) { start(f, q); if (Chess.on) Chess.challenge(f); };
  },

  challenge(f) {
    this.fish = f;
    const kg = f.kg || 0.3, big = kg >= 4 || f.prized || f.sp.legendary;
    this.depth = big ? 3 : kg >= 1.2 ? 2 : 1;
    this.blunder = big ? 0.02 : kg >= 1.2 ? 0.08 : 0.2;
    this.s = ChessEng.start(kg < 0.4 && !f.prized);
    this.sel = -1; this.thinking = false; this.moves = 0; this.history = [];
    this.open = true; Game.mode = 'chess';
    Sfx.setDrag && Sfx.setDrag(0);
    document.getElementById('chessWho').textContent = (f.prized ? '★ PRIZED ' : '') + f.sp.name + ' · ' + U.fmtKg(kg) + ' — ' + (big ? 'a grandmaster of the deep' : kg >= 1.2 ? 'a cunning one' : kg < 0.4 ? 'a tiddler (plays without its queen)' : 'a casual player');
    document.getElementById('chess').classList.remove('hidden');
    this.status('FISH ON! It challenges you. You\'re white — your move.');
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
      this.thinking = true; this.status('The ' + this.fish.sp.name + ' is thinking…', 'dim');
      setTimeout(() => {
        const r = ChessEng.best(this.s, this.depth, this.blunder);
        this.thinking = false;
        if (r) this.play(r);
      }, 350);
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
    if (mate && side === 'b') this.finish(true, 'CHECKMATE! The ' + this.fish.sp.name + ' surrenders. Into the net it goes.');
    else if (mate) this.finish(false, 'Checkmated by a fish. It spits the hook and swims off, smug.');
    else this.finish(false, 'Stalemate. The ' + this.fish.sp.name + ' slips away while you argue about it.');
    return true;
  },

  finish(won, msg) {
    this.status(msg, won ? 'good' : 'bad');
    this.open = false;
    setTimeout(() => {
      document.getElementById('chess').classList.add('hidden');
      Game.mode = 'play';
      if (!Fight.fish) return;
      if (won) Fight.land(); else Fight.thrown(msg);
    }, 1400);
  },

  resign() { if (!this.open) return; this.finish(false, 'You resign. The ' + this.fish.sp.name + ' swims off with your dignity.'); },

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
