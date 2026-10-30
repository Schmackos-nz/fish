// Desktop build only: runs before the game's scripts.
// Restores saves from the save file, mirrors every later change back to it, and adds a Quit button.
'use strict';
(() => {
  const D = window.desktop;
  if (!D) return;
  const PREFIX = 'reelwild.';
  document.documentElement.classList.add('desktop');

  // The file is the source of truth (Steam Cloud may have brought in a newer one): load it over localStorage.
  const saved = D.loadSaves();
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX) && !(k in saved)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(saved)) if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
  }

  const snapshot = () => {
    const o = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PREFIX)) o[k] = localStorage.getItem(k); }
    return o;
  };
  let timer = 0;
  const flush = () => { clearTimeout(timer); timer = 0; D.storeSaves(snapshot()); };
  const later = () => { if (!timer) timer = setTimeout(flush, 400); };
  const proto = Storage.prototype, set = proto.setItem, del = proto.removeItem, clear = proto.clear;
  proto.setItem = function (k, v) { set.call(this, k, v); if (this === localStorage && String(k).startsWith(PREFIX)) later(); };
  proto.removeItem = function (k) { del.call(this, k); if (this === localStorage && String(k).startsWith(PREFIX)) later(); };
  proto.clear = function () { clear.call(this); if (this === localStorage) later(); };
  addEventListener('pagehide', () => { if (timer) flush(); });

  // Quit to desktop, at the bottom of the title menu.
  addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('mainMenu');
    if (!menu) return;
    const b = document.createElement('button');
    b.id = 'desktopQuitBtn'; b.className = 'back';
    b.innerHTML = '<span>Quit to desktop</span>';
    b.onclick = () => { if (timer) flush(); D.quit(); };
    menu.appendChild(b);
  });
})();
