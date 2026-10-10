// Ghost Pop: friendly ghosts rise from behind tombstones; tap them to poof
// them. Ten pops and the party starts. Missing is fine: they just sink away.
import { el, svg, pick, shuffle, nearestHit, sparkleBurst, centerOf, hintHand } from '../util.js';
import { makeSpot } from '../spots.js';
import { say, sfx } from '../audio.js';

const GOAL = 10;
const STAY_MS = 3200;   // how long a ghost waits to be tapped
const MAX_UP = 2;       // never more than two at once

const SPOTS = [
  { x: 18, y: 45, w: 29 }, { x: 50, y: 42, w: 29 }, { x: 82, y: 45, w: 29 },
  { x: 32, y: 65, w: 31 }, { x: 70, y: 64, w: 31 },
  { x: 17, y: 86, w: 32 }, { x: 50, y: 87, w: 32 }, { x: 83, y: 86, w: 32 },
];
const COVERS = ['tombstone', 'tombstone2', 'bush', 'tombstone', 'fence', 'tombstone2', 'bush', 'tombstone'];

export default {
  id: 'ghosts',
  name: 'Ghost Pop',
  icon: 'characters/ghost',
  cue: 'game-ghosts',

  start(root, { finish }) {
    el('div', 'scene-bg', root).style.backgroundImage = 'url(assets/scenes/graveyard.svg)';
    const stage = el('div', 'stage', root);
    const covers = shuffle(COVERS);
    const spots = SPOTS.map((s, i) => ({ ...makeSpot(stage, s, covers[i], 'characters/ghost', 'ghost-spot'), up: false, timer: 0 }));
    const progress = el('div', 'progress-row', root);
    const marks = Array.from({ length: GOAL }, () => {
      const m = el('div', 'mark', progress);
      m.appendChild(svg('characters/ghost'));
      return m;
    });
    const hand = hintHand(root);

    let popped = 0;
    let finished = false;
    let last = null;
    let firstShown = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

    const upSpots = () => spots.filter((s) => s.up);

    function rise() {
      if (finished || upSpots().length >= MAX_UP) return;
      const free = spots.filter((s) => !s.up && s !== last);
      const s = pick(free);
      last = s;
      s.up = true;
      s.actor.className = 'actor up';
      if (Math.random() < 0.6) sfx('boo', { volume: 0.45, rate: 0.9 + Math.random() * 0.3 });
      s.timer = later(() => sink(s), STAY_MS);
      if (!firstShown) {
        firstShown = true;
        later(() => { if (s.up) { const c = centerOf(s.actor); hand.showAt(c.x, c.y); } }, 500);
      }
    }

    function sink(s) {
      s.up = false;
      s.actor.className = 'actor';
    }

    function pop(s) {
      clearTimeout(s.timer);
      timers.delete(s.timer);
      s.up = false;
      hand.hide();
      const c = centerOf(s.actor);
      s.actor.className = 'actor up poof';
      sfx('pop');
      sfx('poof', { volume: 0.7 });
      sparkleBurst(c.x, c.y, 12, 120);
      later(() => { s.actor.className = 'actor reset'; }, 380);
      marks[popped].classList.add('on');
      popped++;
      if (popped >= GOAL) {
        finished = true;
        spots.forEach((o) => { if (o.up) sink(o); });
        later(() => finish(), 1000);
      }
    }

    stage.addEventListener('pointerdown', (e) => {
      if (finished) return;
      const hit = nearestHit(upSpots(), e.clientX, e.clientY, 0.35, (s) => s.actor);
      if (hit) pop(hit);
      else sparkleBurst(e.clientX, e.clientY, 4, 36, ['icons/sparkle']); // harmless miss
    });

    say('ghosts-intro');
    later(rise, 700);
    const loop = setInterval(() => {
      const n = upSpots().length;
      if (n === 0 || (n < MAX_UP && Math.random() < 0.45)) rise();
    }, 1000);

    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  },
};
