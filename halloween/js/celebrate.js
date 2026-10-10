// The shared end-of-game party: a burst of pumpkins, bats, stars and candy,
// Goldie cheering, a spoken cheer and a jingle, then Play again / Home.
import { el, svg, rand, pick, iconButton, sparkleBurst, store } from './util.js';
import { say, sfx } from './audio.js';

const CONFETTI = ['characters/pumpkin', 'characters/bat', 'characters/star', 'characters/candy', 'characters/ghost'];

export function awardSticker(gameId) {
  const done = store.get('done', {});
  done[gameId] = true;
  store.set('done', done);
}

/**
 * @param {object} o
 * @param {string} o.gameId         which home icon gets the sticker
 * @param {Element} [o.showcase]    something to show off in the middle (dressed-up Sniper)
 * @param {boolean} [o.bonus]       extra sparkle + Milly (found her in the cat game)
 * @param {Function} o.onAgain
 * @param {Function} o.onHome
 */
export function celebrate({ gameId, showcase, bonus, onAgain, onHome }) {
  awardSticker(gameId);
  const ov = el('div', 'celebration', document.getElementById('app'));
  const burst = el('div', 'confetti', ov);
  if (showcase) {
    const stage = el('div', 'showcase', ov);
    stage.appendChild(showcase);
  }
  if (bonus) {
    const m = el('div', 'bonus-milly', ov);
    m.appendChild(svg('characters/milly'));
  }
  const g = el('div', 'cheer-goldie' + (showcase ? ' side' : ''), ov);
  g.appendChild(svg('characters/goldie-cheer'));

  sfx('jingle');
  setTimeout(() => say(pick(['cheer-yay', 'cheer-great', 'cheer-did-it'])), 250);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const launch = (count, delay) => {
    for (let i = 0; i < count; i++) {
      const p = el('div', 'confetti-bit', burst);
      p.appendChild(svg(pick(CONFETTI)));
      const size = rand(44, 84);
      p.style.width = p.style.height = size + 'px';
      const x0 = rand(0.1, 0.9) * W;
      const x1 = x0 + rand(-0.35, 0.35) * W;
      const peak = rand(0.08, 0.45) * H;
      p.style.left = x0 - size / 2 + 'px';
      p.style.top = H + 'px';
      p.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(.6)' },
        { transform: `translate(${(x1 - x0) * 0.6}px,${peak - H}px) rotate(${rand(-200, 200)}deg) scale(1)`, offset: 0.45 },
        { transform: `translate(${x1 - x0}px,${size}px) rotate(${rand(-400, 400)}deg) scale(1)` },
      ], { duration: rand(2400, 3400), delay: delay + rand(0, 700), easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'both' });
    }
  };
  launch(18, 0);
  launch(12, 1200);
  if (bonus) {
    setTimeout(() => {
      sfx('sparkle');
      sparkleBurst(W * 0.8, H * 0.32, 18, 160);
    }, 900);
  }

  const btns = el('div', 'celebration-buttons', ov);
  btns.hidden = true;
  setTimeout(() => {
    btns.hidden = false;
    iconButton(btns, 'again', 'big', () => { sfx('tap'); ov.remove(); onAgain(); }, 'Play again');
    iconButton(btns, 'home', 'big', () => { sfx('tap'); ov.remove(); onHome(); }, 'Home');
  }, 3600);

  return () => ov.remove();
}
