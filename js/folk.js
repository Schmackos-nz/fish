// Round, flat-coloured cut-out people: big round heads, wide oval eyes, mitten hands.
'use strict';

const PLAYER_PAL = { hat: '#C9B77E', hatStyle: 'bucket', shirt: '#B8433A', vest: '#8A7A4A', pants: '#3D5A3A', skin: '#F2C9A0', hair: '#6A4A2A', fly: '#E84A3A' };
const KEEPER_PAL = { hat: null, hatStyle: 'none', shirt: '#5A7A9A', vest: '#E6DCC0', pants: '#4A4058', skin: '#E2B08A', hair: '#EDEDED', glasses: true, apron: true };

const Folk = {
  W: 64, H: 80,

  // dir: 'down' | 'up' | 'side' (side faces right). frame: walk cycle 0-3. pose: 'normal' | 'brag' | 'hold' | 'none' (no arms).
  draw(g, pal, dir, frame, pose = 'normal') {
    // Leave headroom for tall hats inside the 64x80 frame.
    g.save(); g.translate(2.5, 6); g.scale(0.92, 0.92);
    const ink = 'rgba(20,14,10,0.85)';
    const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    const bob = frame % 2 ? -1 : 0;
    const side = dir === 'side';
    g.lineWidth = 2; g.strokeStyle = ink; g.lineJoin = 'round';
    const blob = (fill, path) => { g.fillStyle = fill; g.beginPath(); path(); g.fill(); g.stroke(); };
    const ell = (x, y, rx, ry, rot = 0) => () => g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);

    // Feet: two black ovals peeking out under the body.
    blob('#231B16', ell(24 + step * 3, 75, 8, 4));
    blob('#231B16', ell(40 - step * 3, 75, 8, 4));
    blob(pal.pants, () => g.roundRect(18, 62 + bob, 28, 12, 5));

    // Arms behind the body for the default pose.
    const mitt = pal.mitt || pal.shirt;
    const arm = (sx, sy, hx, hy) => {
      g.strokeStyle = ink; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = pal.shirt; g.lineWidth = 6;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
      g.lineWidth = 2; g.strokeStyle = ink; g.lineCap = 'butt';
      blob(mitt, ell(hx, hy, 4.5, 4.5));
    };
    if (pose === 'normal') {
      arm(16, 50 + bob, 11 - (side ? 0 : step), 60 + bob);
      arm(48, 50 + bob, 53 + (side ? 0 : step), 60 + bob);
    }

    // Body: a soft rounded bell.
    blob(pal.shirt, () => {
      g.moveTo(20, 42 + bob);
      g.bezierCurveTo(10, 46 + bob, 12, 68 + bob, 18, 68 + bob);
      g.lineTo(46, 68 + bob);
      g.bezierCurveTo(52, 68 + bob, 54, 46 + bob, 44, 42 + bob);
      g.closePath();
    });
    if (pal.vest && dir !== 'up') {
      g.fillStyle = pal.vest;
      g.beginPath(); g.moveTo(21, 44 + bob); g.quadraticCurveTo(14, 56 + bob, 18, 67 + bob); g.lineTo(28, 67 + bob); g.lineTo(28, 46 + bob); g.closePath(); g.fill(); g.stroke();
      if (!side) { g.beginPath(); g.moveTo(43, 44 + bob); g.quadraticCurveTo(50, 56 + bob, 46, 67 + bob); g.lineTo(36, 67 + bob); g.lineTo(36, 46 + bob); g.closePath(); g.fill(); g.stroke(); }
    }
    if (pal.apron && dir !== 'up') blob(pal.vest, () => g.roundRect(24, 48 + bob, 16, 19, 3));
    if (dir === 'down' && !pal.apron) { g.beginPath(); g.moveTo(32, 46 + bob); g.lineTo(32, 66 + bob); g.stroke(); }

    // Raised arms go in front.
    if (pose === 'brag') { arm(16, 50, 2, 44); arm(48, 50, 62, 44); }
    if (pose === 'hold') { arm(17, 50, 12, 34); arm(47, 50, 52, 34); }

    // Head: a big circle.
    const hx = side ? 35 : 32, hy = 26 + bob;
    blob(pal.skin, ell(hx, hy, 20, 18.5));
    if (pal.beard && dir !== 'up') blob(pal.beard, () => { g.moveTo(hx - 15, hy + 4); g.quadraticCurveTo(hx, hy + 26, hx + 15, hy + 4); g.quadraticCurveTo(hx, hy + 13, hx - 15, hy + 4); });

    if (dir === 'up') {
      blob(pal.hair || '#5A3A2A', ell(hx, hy + 2, 18, 15));
    } else {
      // Eyes: two big ovals touching in the middle, pupils glance toward travel.
      const look = side ? 3 : 0;
      const ex = side ? [hx + 3, hx + 13] : [hx - 6.5, hx + 6.5];
      for (const x of ex) blob('#FFFFFF', ell(x, hy - 1, 6.5, 7.5));
      g.fillStyle = '#111';
      for (const x of ex) { g.beginPath(); g.arc(x + look + (side ? 0 : (x < hx ? 1.5 : -1.5)), hy, 1.8, 0, Math.PI * 2); g.fill(); }
      if (pal.glasses) { g.strokeStyle = '#3a3a3a'; g.lineWidth = 1.5; for (const x of ex) { g.beginPath(); g.arc(x, hy - 1, 7.5, 0, Math.PI * 2); g.stroke(); } g.lineWidth = 2; g.strokeStyle = ink; }
      // Mouth
      const mx = side ? hx + 9 : hx;
      g.strokeStyle = ink; g.lineWidth = 1.8;
      if (pose === 'brag' || pose === 'hold' || pose === 'grin') {
        g.fillStyle = '#5A1E1E'; g.beginPath(); g.ellipse(mx, hy + 11, 5, 3.5, 0, 0, Math.PI); g.fill(); g.stroke();
      } else if (!pal.beard) { g.beginPath(); g.moveTo(mx - 4, hy + 10); g.quadraticCurveTo(mx, hy + 12, mx + 4, hy + 10); g.stroke(); }
      g.lineWidth = 2;
    }

    // Hair / hats
    if (pal.hatStyle === 'bucket') {
      blob(pal.hat, () => { g.moveTo(hx - 16, hy - 10); g.bezierCurveTo(hx - 15, hy - 31, hx + 15, hy - 31, hx + 16, hy - 10); g.closePath(); });
      blob(pal.hat, ell(hx, hy - 10, 23, 4.5));
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(hx - 15, hy - 16, 30, 4);
      if (pal.fly) { g.fillStyle = pal.fly; g.beginPath(); g.arc(hx + 9, hy - 17, 2.5, 0, 7); g.fill(); }
    } else if (pal.hatStyle === 'beanie') {
      blob(pal.hat, () => { g.moveTo(hx - 19, hy - 8); g.bezierCurveTo(hx - 18, hy - 32, hx + 18, hy - 32, hx + 19, hy - 8); g.closePath(); });
      blob(pal.hatBand || U.shade(pal.hat, -0.25), () => g.roundRect(hx - 20, hy - 12, 40, 6, 3));
      blob(pal.pom || '#F2E6C8', ell(hx, hy - 28, 5, 5));
    } else if (pal.hatStyle === 'cap') {
      blob(pal.hat, () => { g.moveTo(hx - 18, hy - 9); g.bezierCurveTo(hx - 17, hy - 31, hx + 17, hy - 31, hx + 18, hy - 9); g.closePath(); });
      if (dir !== 'up') blob(U.shade(pal.hat, -0.2), ell(side ? hx + 18 : hx, hy - 9, side ? 10 : 15, 3.5));
    } else if (pal.hatStyle === 'none') {
      // Fluffy hair puffs (Hettie).
      for (const [ox, oy] of [[-14, -10], [14, -10], [-6, -16], [6, -16], [0, -18]]) blob(pal.hair, ell(hx + ox, hy + oy, 7, 6));
    }
    g.restore();
  },

  texture(pal, dir, frame, pose) {
    const c = document.createElement('canvas'); c.width = this.W; c.height = this.H;
    this.draw(c.getContext('2d'), pal, dir, frame, pose);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  },
};
