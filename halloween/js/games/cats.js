// Count the Cats: five black cats peek out around the yard. Each tap counts
// one out loud. Milly (the orange cat from next door) hides among them and
// gets her own special hello, but she doesn't count.
import { el, svg, shuffle, pick, nearestHit, sparkleBurst, centerOf, hintHand, pulseClass } from '../util.js';
import { makeSpot } from '../spots.js';
import { say, sfx } from '../audio.js';

const CATS = 5;
const SPOTS = [
  // top row stays below the corner buttons; bottom row above the counting row
  { x: 20, y: 45, w: 29 }, { x: 50, y: 42, w: 29 }, { x: 80, y: 45, w: 29 },
  { x: 32, y: 64, w: 31 }, { x: 69, y: 63, w: 31 },
  { x: 17, y: 84, w: 32 }, { x: 50, y: 85, w: 32 }, { x: 83, y: 84, w: 32 },
];
const COVERS = ['bush', 'fence', 'hay', 'pumpkin-plain'];

export default {
  id: 'cats',
  name: 'Count the Cats',
  icon: 'characters/black-cat',
  cue: 'game-cats',

  start(root, { finish }) {
    el('div', 'scene-bg', root).style.backgroundImage = 'url(assets/scenes/yard.svg)';
    const stage = el('div', 'stage', root);
    // random spots each play: 5 black cats + Milly
    const chosen = shuffle(SPOTS).slice(0, CATS + 1);
    const cats = chosen.map((s, i) => {
      const milly = i === CATS;
      const spot = makeSpot(stage, s, pick(COVERS), milly ? 'characters/milly-peek' : 'characters/black-cat', 'cat-spot');
      spot.actor.className = 'actor up';
      spot.actor.style.animationDelay = (-Math.random() * 3).toFixed(2) + 's';
      return { ...spot, milly, found: false };
    });

    const row = el('div', 'count-row', root);
    const slots = Array.from({ length: CATS }, (_, i) => {
      const s = el('div', 'slot', row);
      s.appendChild(svg('characters/black-cat'));
      el('span', 'slot-num', s, String(i + 1));
      return s;
    });
    const hand = hintHand(root);

    let count = 0;
    let millyFound = false;
    let finished = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

    let idle = 0;
    function resetHint() {
      hand.hide();
      clearTimeout(idle);
      idle = setTimeout(() => {
        const left = cats.filter((c) => !c.milly && !c.found);
        if (!left.length || finished) return;
        const c = centerOf(pick(left).actor);
        hand.showAt(c.x, c.y);
      }, 7000);
    }

    function bigNumber(n) {
      const b = el('div', 'big-number', root, String(n));
      b.addEventListener('animationend', () => b.remove());
    }

    function tapCat(c) {
      const center = centerOf(c.actor);
      pulseClass(c.actor, 'jump');
      if (c.milly) {
        sfx('meow');
        sfx('sparkle', { volume: 0.6 });
        sparkleBurst(center.x, center.y, 16, 140);
        say('milly');
        if (!millyFound) {
          millyFound = true;
          c.spot.classList.add('milly-found');
        }
        return;
      }
      if (c.found) { sfx('boing', { volume: 0.6 }); return; }
      c.found = true;
      count++;
      sfx('boing');
      sparkleBurst(center.x, center.y, 8, 90);
      bigNumber(count);
      say('count-' + count);
      const badge = el('div', 'found-badge', c.spot, String(count));
      badge.prepend(svg('characters/star'));
      slots[count - 1].classList.add('on');
      if (count >= CATS) {
        finished = true;
        hand.hide();
        later(() => finish({ bonus: millyFound }), 1700);
      }
    }

    stage.addEventListener('pointerdown', (e) => {
      if (finished) return;
      resetHint();
      const hit = nearestHit(cats, e.clientX, e.clientY, 0.25, (c) => c.actor);
      if (hit) tapCat(hit);
      else sparkleBurst(e.clientX, e.clientY, 4, 36, ['icons/sparkle']);
    });

    say('cats-intro');
    resetHint();

    return () => {
      clearTimeout(idle);
      timers.forEach(clearTimeout);
    };
  },
};
