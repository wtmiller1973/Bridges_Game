// Boot, home screen and navigation between games.
import { el, svg, store, preloadSVGs, iconButton, pulseClass } from './util.js';
import { unlock, say, sfx, stopVoice, isMuted, setMuted } from './audio.js';
import { celebrate } from './celebrate.js';
import ghostPop from './games/ghostpop.js';
import pumpkin from './games/pumpkin.js';
import cats from './games/cats.js';
import dressUp from './games/dressup.js';

const GAMES = [ghostPop, pumpkin, cats, dressUp];

const SVGS = [
  'characters/goldie-wave', 'characters/goldie-cheer', 'characters/sniper', 'characters/sniper-head',
  'characters/milly', 'characters/milly-peek', 'characters/black-cat', 'characters/ghost',
  'characters/pumpkin', 'characters/bat', 'characters/candy', 'characters/star',
  'icons/home', 'icons/again', 'icons/sound-on', 'icons/sound-off', 'icons/tada', 'icons/hand',
  'icons/sparkle', 'icons/rotate',
  'scenes/tombstone', 'scenes/tombstone2', 'scenes/bush', 'scenes/fence', 'scenes/hay', 'scenes/pumpkin-plain',
  ...dressUp.costumeFiles,
];

const app = document.getElementById('app');
const holder = el('div', 'screen-holder', app);
let cleanup = null;
let closeParty = null;
let current = null;

// ---------------------------------------------------------------- guards
// No zoom, no scrolling, no long-press menus, no pull-to-refresh.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('selectstart', (e) => e.preventDefault());

// Parents: add ?reset to the link to clear the stickers.
if (new URLSearchParams(location.search).has('reset')) {
  store.clear();
  history.replaceState(null, '', location.pathname);
}

// ---------------------------------------------------------------- navigation
function clear() {
  if (cleanup) cleanup();
  cleanup = null;
  if (closeParty) closeParty();
  closeParty = null;
  stopVoice();
  holder.replaceChildren();
}

function goHome() {
  // Leaving a game pops the history entry we pushed, so the phone's back
  // button and our home button behave the same.
  if (history.state && history.state.game) history.back();
  else showHome();
}

window.addEventListener('popstate', () => showHome());

function startGame(game, push = true) {
  clear();
  current = game;
  if (push) history.pushState({ game: game.id }, '');
  const root = el('div', 'screen game-' + game.id, holder);
  iconButton(root, 'home', 'corner home-btn', () => { sfx('tap'); goHome(); }, 'Home');
  cleanup = game.start(root, {
    finish(opts = {}) {
      closeParty = celebrate({
        gameId: game.id,
        ...opts,
        onAgain: () => { closeParty = null; startGame(game, false); },
        onHome: () => { closeParty = null; goHome(); },
      });
    },
  });
}

function showHome() {
  clear();
  current = null;
  const root = el('div', 'screen home', holder);
  el('div', 'scene-bg', root).style.backgroundImage = 'url(assets/scenes/night.svg)';
  el('h1', 'title', root, "Goldie's<br><span>Halloween Adventure</span>");
  const grid = el('div', 'home-grid', root);
  const done = store.get('done', {});
  let busy = false;
  for (const game of GAMES) {
    const tile = el('button', 'tile', grid);
    tile.type = 'button';
    tile.setAttribute('aria-label', game.name);
    tile.appendChild(svg(game.icon, 'tile-art'));
    if (done[game.id]) {
      const s = el('div', 'sticker', tile);
      s.appendChild(svg('characters/star'));
    }
    tile.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      sfx('tap');
      pulseClass(tile, 'bounce');
      say(game.cue);
      setTimeout(() => startGame(game), 450);
    });
  }
  const g = el('div', 'home-goldie', root);
  g.appendChild(svg('characters/goldie-wave'));
  g.addEventListener('pointerdown', () => { sfx('boing'); pulseClass(g, 'hop'); });
}

// ---------------------------------------------------------------- boot
function setupMute() {
  const b = el('button', 'icon-btn corner mute-btn', app);
  b.type = 'button';
  b.setAttribute('aria-label', 'Sound on or off');
  const draw = () => b.replaceChildren(svg(isMuted() ? 'icons/sound-off' : 'icons/sound-on'));
  draw();
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    unlock();
    setMuted(!isMuted());
    draw();
  });
}

let greeted = false;
document.addEventListener('pointerdown', () => {
  unlock();
  if (!greeted) {
    greeted = true;
    if (!current) setTimeout(() => { if (!current) say('hello'); }, 50);
  }
}, true);

async function boot() {
  try { await window.screen.orientation?.lock?.('portrait'); } catch { /* only works installed/fullscreen */ }
  await preloadSVGs(SVGS);
  document.getElementById('loading')?.remove();
  setupMute();
  history.replaceState(null, '', location.pathname);
  showHome();
  const rot = document.getElementById('rotate');
  if (rot) rot.appendChild(svg('icons/rotate'));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
