// Brag shots: paints the angler holding a prized fish and hands it to the share sheet.
'use strict';

const Share = {
  blob: null, info: null,

  // info: { sp, kg, cm, place, kind, day, phase, prized }
  open(info) {
    this.info = info;
    const c = this.paint(info);
    const el = document.getElementById('share');
    el.innerHTML = `<button class="close" id="shClose">✕</button><h2>Share your catch</h2>
      <div class="desc">Send this to a friend — they won't believe the size of it.</div>
      <div id="shPreview"></div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap">
        <button id="shShare">📤 Share…</button><button id="shCopy">📋 Copy image</button><button id="shSave">💾 Download</button>
      </div><div id="shMsg" class="desc" style="text-align:center;margin-top:6px"></div>`;
    c.style.width = '100%'; c.style.borderRadius = '6px'; c.style.marginTop = '8px';
    el.querySelector('#shPreview').appendChild(c);
    el.classList.remove('hidden');
    const msg = (t) => { el.querySelector('#shMsg').textContent = t; };
    el.querySelector('#shClose').onclick = () => el.classList.add('hidden');
    this.blob = null;
    c.toBlob((b) => { this.blob = b; }, 'image/png');
    const withBlob = (fn) => (this.blob ? fn(this.blob) : c.toBlob((b) => { this.blob = b; fn(b); }, 'image/png'));
    el.querySelector('#shShare').onclick = () => withBlob(async (b) => {
      const file = new File([b], this.fileName(), { type: 'image/png' });
      const data = { files: [file], title: 'Trout for Clout', text: this.caption() };
      if (navigator.canShare && navigator.canShare(data)) {
        try { await navigator.share(data); msg('Shared!'); } catch (e) { if (e.name !== 'AbortError') msg('Sharing failed — try Copy or Download.'); }
      } else { this.download(b); msg('This browser can\'t share files directly, so the picture was downloaded instead.'); }
    });
    el.querySelector('#shCopy').onclick = () => withBlob(async (b) => {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); msg('Copied — paste it into a chat.'); }
      catch (e) { msg('Clipboard blocked — use Download instead.'); }
    });
    el.querySelector('#shSave').onclick = () => withBlob((b) => { this.download(b); msg('Saved ' + this.fileName()); });
  },

  caption() {
    const i = this.info;
    return `I just landed a ${i.prized ? 'prized ' : ''}${i.sp.name} — ${U.fmtKg(i.kg)}, ${i.cm} cm — at ${i.place} in Trout for Clout! 🎣`;
  },
  fileName() { return 'trout-for-clout-' + this.info.sp.id + '-' + Math.round(this.info.kg * 100) / 100 + 'kg.png'; },
  download(b) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = this.fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  paint(i) {
    const W = 960, H = 640;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rng = U.mulberry32(Math.round(i.kg * 1000) + i.cm);
    // Sky by time of day
    const skies = [['#f6b27a', '#f3d9a8'], ['#6fb6e6', '#cfe9f5'], ['#7a5a9a', '#f0956a'], ['#0e1a33', '#2a3a5c']];
    const [top, bot] = skies[i.phase];
    let gr = g.createLinearGradient(0, 0, 0, H * 0.55);
    gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (i.phase === 3) { g.fillStyle = '#fff'; for (let k = 0; k < 90; k++) g.fillRect(rng() * W, rng() * H * 0.45, 2, 2); }
    else { g.fillStyle = i.phase === 1 ? '#fff6c8' : '#ffd08a'; g.beginPath(); g.arc(W * 0.8, H * 0.18, 42, 0, 7); g.fill(); }
    // Hills
    for (const [y, col, amp] of [[0.42, '#4a6a5a', 40], [0.48, '#33533f', 28]]) {
      g.fillStyle = i.phase === 3 ? U.shade(col, -0.6) : col;
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, H * y - U.fbm(x / 140, y * 10, 5) * amp * 2);
      g.lineTo(W, H); g.fill();
    }
    // Water
    const wet = i.kind === 'stream' || i.kind === 'river' ? ['#4f9ea6', '#2c6a7a'] : ['#3d7f9e', '#1d4466'];
    gr = g.createLinearGradient(0, H * 0.52, 0, H);
    gr.addColorStop(0, wet[0]); gr.addColorStop(1, wet[1]);
    g.fillStyle = gr; g.fillRect(0, H * 0.52, W, H);
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = 0; k < 40; k++) g.fillRect(rng() * W, H * 0.53 + rng() * H * 0.3, 20 + rng() * 60, 2);
    // Bank the angler stands on
    g.fillStyle = '#5f9a45';
    g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.86);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.84 + Math.sin(x / 70) * 8);
    g.lineTo(W, H); g.fill();
    g.fillStyle = '#4a8a3c'; for (let x = 0; x < W; x += 7) g.fillRect(x, H * 0.83 + Math.sin(x / 70) * 8 + rng() * 6, 2, 6);
    // Reeds framing the shot
    for (const side of [0, 1]) for (let k = 0; k < 9; k++) {
      const x = side ? W - 30 - k * 13 : 20 + k * 13, h = 80 + rng() * 90;
      g.fillStyle = k % 2 ? '#7a9a3c' : '#5d7f2e'; g.fillRect(x, H * 0.86 - h, 5, h);
      g.fillStyle = '#6a4a2a'; g.fillRect(x - 1, H * 0.86 - h - 18, 7, 22);
    }
    if (i.prized) this.rays(g, W / 2, H * 0.52, rng);

    // The angler: 16x20 pixel sprite blown up, arms out holding the fish.
    const S = 14, ax = W / 2 - 8 * S, ay = H * 0.9 - 20 * S;
    this.angler(g, ax, ay, S);
    const len = U.clamp(140 + i.cm * 3.2, 200, 560);
    const fy = ay + 13.6 * S;
    this.grip(g, ax, ay, S, W / 2, fy, len, 'arms'); // arms reach behind the fish
    Fish.drawPortrait(g, i.sp, W / 2, fy, len);
    if (i.prized) this.sheen(g, W / 2, fy, len, rng);
    this.grip(g, ax, ay, S, W / 2, fy, len, 'hands'); // mittens grip the fish from the front

    // Captions
    g.textAlign = 'left';
    if (i.prized) {
      g.fillStyle = '#c9a86a'; g.fillRect(28, 26, 300, 44);
      g.fillStyle = '#3a2614'; g.font = '700 26px ' + UI.font; g.fillText('★ PRIZED CATCH ★', 42, 58);
    }
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 6;
    g.font = '700 48px ' + UI.display;
    g.strokeText(i.sp.name, 30, i.prized ? 120 : 70); g.fillText(i.sp.name, 30, i.prized ? 120 : 70);
    g.font = '700 28px ' + UI.font;
    const stat = U.fmtKg(i.kg) + '  ·  ' + i.cm + ' cm';
    g.strokeText(stat, 30, i.prized ? 162 : 112); g.fillStyle = '#f2c14e'; g.fillText(stat, 30, i.prized ? 162 : 112);
    g.font = '500 19px ' + UI.font; g.fillStyle = '#fff';
    const where = i.place + '  ·  Day ' + i.day + ', ' + TIME_NAMES[i.phase].toLowerCase();
    g.lineWidth = 4; g.strokeText(where, 30, H - 22); g.fillText(where, 30, H - 22);
    g.textAlign = 'right'; g.font = '700 26px ' + UI.display; g.fillStyle = '#f2c14e';
    g.strokeText('TROUT FOR CLOUT', W - 26, H - 22); g.fillText('TROUT FOR CLOUT', W - 26, H - 22);
    return c;
  },

  rays(g, cx, cy, rng) {
    g.save(); g.translate(cx, cy);
    for (let k = 0; k < 14; k++) {
      g.rotate(Math.PI * 2 / 14);
      g.fillStyle = 'rgba(255,215,110,' + (0.12 + rng() * 0.1).toFixed(2) + ')';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(700, -60); g.lineTo(700, 60); g.fill();
    }
    g.restore();
  },

  sheen(g, cx, cy, len, rng) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(cx - len / 2, cy - 30, cx + len / 2, cy + 30);
    gr.addColorStop(0, 'rgba(255,200,80,0)'); gr.addColorStop(0.5, 'rgba(255,210,90,.35)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(cx, cy, len * 0.44, len * 0.14, 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 16; k++) {
      const x = cx + (rng() - 0.5) * len * 1.1, y = cy + (rng() - 0.5) * len * 0.5, s = 4 + rng() * 6;
      g.fillStyle = '#fff6c8';
      g.fillRect(x - s / 2, y - 1, s, 2); g.fillRect(x - 1, y - s / 2, 2, s);
    }
    g.restore();
  },

  grip(g, x, y, S, cx, fy, len, part) {
    for (const side of [-1, 1]) {
      const sx = x + (side < 0 ? 4.5 : 11.5) * S, sy = y + 12.3 * S;
      const hx = cx + side * len * 0.3, hy = fy - S * 0.5;
      if (part === 'arms') {
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(20,14,10,0.85)'; g.lineWidth = S * 2.3;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
        g.strokeStyle = PLAYER_PAL.shirt; g.lineWidth = S * 1.6;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
        continue;
      }
      g.fillStyle = PLAYER_PAL.shirt; g.strokeStyle = 'rgba(20,14,10,0.85)'; g.lineWidth = S * 0.45;
      g.beginPath(); g.arc(hx, hy, S * 1.25, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  },

  // Same round angler as in-game (64x80 art scaled up); arms are added by grip().
  angler(g, x, y, S) {
    g.save(); g.translate(x, y); g.scale(S / 4, S / 4);
    Folk.draw(g, PLAYER_PAL, 'down', 0, 'grin');
    g.restore();
  },
};
