// Dress Up Sniper: tap a costume piece to put it on, tap it again to take it
// off. One piece per slot (head, neck, body, back), mixed freely. The star
// tile says "Ta-da!" and shows him off.
//
// To add or swap a costume, drop an SVG drawn in Sniper's coordinate system
// (viewBox "0 -100 400 580") into assets/costumes/ and list it below.
import { el, svg, sparkleBurst, centerOf, hintHand, pulseClass } from '../util.js';
import { say, sfx } from '../audio.js';

const COSTUMES = [
  { id: 'witch-hat', slot: 'head' },
  { id: 'ghost-sheet', slot: 'body' },
  { id: 'pumpkin-suit', slot: 'body' },
  { id: 'bat-wings', slot: 'back' },
  { id: 'vampire-cape', slot: 'back' },
  { id: 'spider-headband', slot: 'head' },
  { id: 'bow-tie', slot: 'neck' },
  { id: 'cat-ears', slot: 'head' },
];
// stacking order around Sniper (who sits at 10)
const Z = { back: 5, body: 20, neck: 30, head: 40 };

export default {
  id: 'dressup',
  name: 'Dress Up Sniper',
  icon: 'characters/sniper-head',
  cue: 'game-dressup',
  costumeFiles: COSTUMES.map((c) => 'costumes/' + c.id),

  start(root, { finish }) {
    el('div', 'scene-bg', root).style.backgroundImage = 'url(assets/scenes/stage.svg)';
    const area = el('div', 'dog-area', root);
    const dog = el('div', 'dog', area);
    const base = svg('characters/sniper', 'layer');
    base.style.zIndex = '10';
    dog.appendChild(base);

    const worn = {}; // slot -> { costume, layer, tile }
    const tray = el('div', 'tray', root);
    const hand = hintHand(root);
    let finished = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

    function react() {
      pulseClass(dog, 'hop');
      dog.classList.add('excited');
      later(() => dog.classList.remove('excited'), 1400);
      sfx(Math.random() < 0.6 ? 'woof' : 'boing', { volume: 0.8 });
    }

    function takeOff(slot) {
      const w = worn[slot];
      if (!w) return;
      delete worn[slot];
      w.tile.classList.remove('worn');
      w.layer.classList.add('pop-out');
      later(() => w.layer.remove(), 300);
    }

    function toggle(c, tile) {
      if (finished) return;
      hand.hide();
      const current = worn[c.slot];
      if (current && current.costume === c) {
        takeOff(c.slot);
        sfx('whoosh');
        return;
      }
      takeOff(c.slot);
      const layer = svg('costumes/' + c.id, 'layer costume drop-' + c.slot);
      layer.style.zIndex = String(Z[c.slot]);
      dog.appendChild(layer);
      worn[c.slot] = { costume: c, layer, tile };
      tile.classList.add('worn');
      sfx('whoosh');
      later(react, 250);
      const p = centerOf(dog);
      later(() => sparkleBurst(p.x, p.y - 40, 8, 130), 250);
      tadaTile.classList.add('ready');
    }

    for (const c of COSTUMES) {
      const tile = el('button', 'tray-tile', tray);
      tile.type = 'button';
      tile.setAttribute('aria-label', c.id.replace('-', ' '));
      const thumb = svg('costumes/' + c.id, 'thumb');
      tile.appendChild(thumb);
      tile.addEventListener('pointerdown', (e) => { e.preventDefault(); pulseClass(tile, 'press'); toggle(c, tile); });
      // crop the thumbnail to the costume itself (it is drawn on Sniper's full canvas)
      requestAnimationFrame(() => {
        const b = thumb.querySelector('g').getBBox();
        const pad = 14;
        thumb.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`);
      });
    }

    const tadaTile = el('button', 'tray-tile tada', tray);
    tadaTile.type = 'button';
    tadaTile.setAttribute('aria-label', 'Ta-da!');
    tadaTile.appendChild(svg('icons/tada'));
    tadaTile.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (finished) return;
      finished = true;
      hand.hide();
      sfx('sparkle');
      say('tada');
      const c = centerOf(dog);
      sparkleBurst(c.x, c.y, 20, 180);
      later(() => {
        const show = dog.cloneNode(true);
        show.className = 'dog showing';
        finish({ showcase: show });
      }, 1500);
    });

    dog.addEventListener('pointerdown', () => { if (!finished) react(); });

    say('dressup-intro');
    later(() => {
      if (Object.keys(worn).length) return;
      const c = centerOf(tray.firstChild);
      hand.showAt(c.x, c.y);
    }, 1800);

    return () => timers.forEach(clearTimeout);
  },
};
