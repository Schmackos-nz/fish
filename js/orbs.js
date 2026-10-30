// Diablo-style globes: health on the left, a second resource on the right, filled with sloshing liquid.
'use strict';

const Orbs = {
  show(on) { document.getElementById('orbs').classList.toggle('hidden', !on); },
  set(hp, other, label) {
    const el = document.getElementById('orbs');
    if (el.classList.contains('hidden')) el.classList.remove('hidden');
    const put = (id, v, txt) => {
      const o = document.getElementById(id), p = U.clamp(v, 0, 100);
      o.querySelector('.liq').style.height = p + '%';
      o.querySelector('b').textContent = Math.round(p);
      if (txt) o.querySelector('span').textContent = txt;
      o.classList.toggle('low', p < 25);
    };
    put('orbHp', hp); put('orbOther', other, label);
  },
};
