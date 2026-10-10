// Small shared helpers: storage, SVG loading, DOM, randomness, effects.

// ---------------------------------------------------------------- storage
const KEY = 'goldie-halloween-v1';

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export const store = {
  get(name, fallback) {
    const v = readAll()[name];
    return v === undefined ? fallback : v;
  },
  set(name, value) {
    try {
      const all = readAll();
      all[name] = value;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* private mode etc: just don't remember */ }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};

// ---------------------------------------------------------------- SVG assets
// Every SVG is fetched once at boot and then cloned inline, so parts of a
// character (Goldie's arm, Sniper's tail) can be animated with CSS.
const svgCache = new Map();
const ASSETS = new URL('../assets/', import.meta.url);

export async function preloadSVGs(names) {
  await Promise.all(names.map(async (name) => {
    if (svgCache.has(name)) return;
    const res = await fetch(new URL(name + '.svg', ASSETS));
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    svgCache.set(name, doc.documentElement);
  }));
}

/** A fresh inline copy of a preloaded SVG, e.g. svg('characters/ghost'). */
export function svg(name, cls = '') {
  const src = svgCache.get(name);
  if (!src) throw new Error('SVG not preloaded: ' + name);
  const node = document.importNode(src, true);
  node.setAttribute('class', ('art ' + cls).trim());
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function assetURL(path) {
  return new URL(path, ASSETS).href;
}

// ---------------------------------------------------------------- DOM
export function el(tag, cls, parent, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html) node.innerHTML = html;
  if (parent) parent.appendChild(node);
  return node;
}

/** A big round picture button. Fires on tap (pointer up), never on drag-offs. */
export function iconButton(parent, iconName, cls, onTap, label) {
  const b = el('button', 'icon-btn ' + (cls || ''), parent);
  b.type = 'button';
  b.setAttribute('aria-label', label || iconName);
  b.appendChild(svg('icons/' + iconName));
  b.addEventListener('click', (e) => { e.stopPropagation(); onTap(e); });
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  return b;
}

// ---------------------------------------------------------------- randomness
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- effects
/** Restart a one-shot CSS animation class on an element. */
export function pulseClass(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth; // reflow so the animation restarts
  node.classList.add(cls);
}

/** Sparkles flying out from a screen point (client coordinates). */
export function sparkleBurst(x, y, count = 10, spread = 110, kinds = ['icons/sparkle', 'characters/star']) {
  const layer = document.getElementById('fx');
  for (let i = 0; i < count; i++) {
    const p = el('div', 'fx-particle', layer);
    p.appendChild(svg(pick(kinds)));
    const size = rand(22, 42);
    p.style.width = p.style.height = size + 'px';
    p.style.left = x - size / 2 + 'px';
    p.style.top = y - size / 2 + 'px';
    const a = (Math.PI * 2 * i) / count + rand(-0.3, 0.3);
    const d = rand(spread * 0.5, spread);
    const anim = p.animate([
      { transform: 'translate(0,0) scale(0.3) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(1) rotate(${rand(-180, 180)}deg)`, opacity: 1, offset: 0.7 },
      { transform: `translate(${Math.cos(a) * d * 1.1}px,${Math.sin(a) * d * 1.1 + 20}px) scale(0.6)`, opacity: 0 },
    ], { duration: rand(600, 900), easing: 'cubic-bezier(.2,.8,.3,1)' });
    anim.onfinish = () => p.remove();
  }
}

/** Centre of an element in client coordinates. */
export function centerOf(node) {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Forgiving hit test: the target whose (padded) box contains the point,
 * nearest centre first. `pad` is a fraction of the box size added each side.
 */
export function nearestHit(targets, x, y, pad = 0.25, getNode = (t) => t.node) {
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    const r = getNode(t).getBoundingClientRect();
    const px = Math.max(r.width * pad, 24);
    const py = Math.max(r.height * pad, 24);
    if (x < r.left - px || x > r.right + px || y < r.top - py || y > r.bottom + py) continue;
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/** A pointing hand that hovers over a spot to show what to do. */
export function hintHand(parent) {
  const h = el('div', 'hint-hand', parent);
  h.appendChild(svg('icons/hand'));
  h.hidden = true;
  return {
    node: h,
    showAt(x, y) { // client coordinates; fingertip lands on the point
      const pr = parent.getBoundingClientRect();
      h.style.left = x - pr.left + 'px';
      h.style.top = y - pr.top + 'px';
      h.hidden = false;
    },
    hide() { h.hidden = true; },
  };
}
