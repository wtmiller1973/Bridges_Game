// Pumpkin Carving: pick a jack-o-lantern face, then trace each dotted shape
// with a finger. Tracing is forgiving: anywhere near the line counts, the
// glow "snaps" onto the line, and lifting the finger keeps progress. When
// every shape is cut out, a candle lights the pumpkin from inside.
import { el, sparkleBurst, hintHand, pulseClass } from '../util.js';
import { say, sfx } from '../audio.js';

const NS = 'http://www.w3.org/2000/svg';
const TOLERANCE = 46;   // how close (in pumpkin units, pumpkin is 600 wide) counts as "on the line"
const SNAP = 2;         // neighbouring sample points filled in on each touch
const DONE_AT = 0.82;   // fraction of a shape that must be traced

// Faces on a 600x600 pumpkin. Each shape is one closed path.
const PATTERNS = {
  happy: [
    'M160,305 L215,215 L270,305 Z',
    'M330,305 L385,215 L440,305 Z',
    'M268,372 L300,326 L332,372 Z',
    'M150,398 Q300,530 450,398 Q300,452 150,398 Z',
  ],
  surprised: [
    'M160,262 a50,50 0 1,0 100,0 a50,50 0 1,0 -100,0 Z',
    'M340,262 a50,50 0 1,0 100,0 a50,50 0 1,0 -100,0 Z',
    'M276,360 L300,330 L324,360 Z',
    'M248,440 a52,58 0 1,0 104,0 a52,58 0 1,0 -104,0 Z',
  ],
  silly: [
    'M150,270 a58,58 0 1,0 116,0 a58,58 0 1,0 -116,0 Z',
    'M350,262 L440,262 Q420,312 395,312 Q370,312 350,262 Z',
    'M274,356 L300,322 L326,356 Z',
    'M160,400 Q300,470 440,384 Q430,470 330,488 Q300,520 270,490 Q190,474 160,400 Z',
  ],
  toothy: [
    'M158,290 L214,236 L270,290 L214,318 Z',
    'M330,290 L386,236 L442,290 L386,318 Z',
    'M278,360 L300,334 L322,360 Z',
    'M140,392 L195,412 L222,386 L254,414 L284,388 L316,414 L346,388 L378,414 L405,386 L460,392 ' +
      'Q420,506 300,510 Q180,506 140,392 Z',
  ],
};

function pumpkinBody(group) {
  group.innerHTML =
    '<path d="M300,96 C296,70 306,48 326,36" fill="none" stroke="#2b1b17" stroke-width="30" stroke-linecap="round"/>' +
    '<path d="M300,96 C296,70 306,48 326,36" fill="none" stroke="#3E8E41" stroke-width="18" stroke-linecap="round"/>' +
    '<g stroke="#2b1b17" stroke-width="8">' +
    '<ellipse cx="180" cy="330" rx="150" ry="220" fill="#F57C10"/>' +
    '<ellipse cx="420" cy="330" rx="150" ry="220" fill="#F57C10"/>' +
    '<ellipse cx="300" cy="330" rx="170" ry="236" fill="#FF8C1A"/></g>' +
    '<path d="M340,70 C372,44 410,56 420,72 C396,68 372,78 356,90" fill="#4CAF50" stroke="#2b1b17" stroke-width="7"/>' +
    '<path d="M230,140 Q210,330 236,520 M370,140 Q390,330 364,520" fill="none" stroke="#E06A00" stroke-width="7"/>';
}

function makeSVG(cls) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 20 600 570');
  s.setAttribute('class', cls);
  return s;
}

function shape(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

export default {
  id: 'pumpkin',
  name: 'Pumpkin Carving',
  icon: 'characters/pumpkin',
  cue: 'game-pumpkin',

  start(root, { finish }) {
    el('div', 'scene-bg', root).style.backgroundImage = 'url(assets/scenes/patch.svg)';
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
    let stopTrace = () => {};

    // ---------------------------------------------------------- 1. pick a face
    const picker = el('div', 'face-picker', root);
    for (const [name, paths] of Object.entries(PATTERNS)) {
      const b = el('button', 'face-choice', picker);
      b.type = 'button';
      b.setAttribute('aria-label', name + ' face');
      const s = makeSVG('');
      pumpkinBody(shape('g', {}, s));
      for (const d of paths) shape('path', { d, fill: '#FFD34E', stroke: '#2b1b17', 'stroke-width': 8, 'stroke-linejoin': 'round' }, s);
      b.appendChild(s);
      b.addEventListener('click', () => {
        sfx('tap');
        pulseClass(b, 'bounce');
        later(() => { picker.remove(); stopTrace = trace(paths); }, 250);
      });
    }
    say('pumpkin-pick');

    // ---------------------------------------------------------- 2. trace
    function trace(paths) {
      say('pumpkin-trace');
      const wrap = el('div', 'carve-wrap', root);
      const s = makeSVG('carve');
      wrap.appendChild(s);
      const glow = shape('defs', {}, s);
      glow.innerHTML =
        '<radialGradient id="candle" cx="50%" cy="58%" r="55%"><stop offset="0" stop-color="#FFF6B0"/>' +
        '<stop offset=".5" stop-color="#FFC93C"/><stop offset="1" stop-color="#FF8C1A" stop-opacity="0"/></radialGradient>';
      pumpkinBody(shape('g', {}, s));
      const inner = shape('ellipse', { cx: 300, cy: 340, rx: 230, ry: 210, fill: 'url(#candle)', class: 'candle', opacity: 0 }, s);
      const hand = hintHand(root);

      const shapes = paths.map((d) => {
        const g = shape('g', {}, s);
        const cut = shape('path', { d, class: 'cut', fill: '#5A2A00', stroke: '#2b1b17', 'stroke-width': 8, 'stroke-linejoin': 'round', opacity: 0 }, g);
        shape('path', { d, class: 'dots', fill: 'none', stroke: '#FFF3D6', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-dasharray': '1 20' }, g);
        const len = cut.getTotalLength();
        const n = Math.max(24, Math.round(len / 12));
        const pts = [];
        for (let i = 0; i < n; i++) {
          const p = cut.getPointAtLength((len * i) / n);
          pts.push({ x: p.x, y: p.y });
        }
        const segs = pts.map((p, i) => {
          const q = pts[(i + 1) % n];
          return shape('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'seg', stroke: '#FFD34E', 'stroke-width': 14, 'stroke-linecap': 'round', opacity: 0 }, g);
        });
        return { cut, pts, segs, covered: new Array(n).fill(false), count: 0, done: false };
      });

      const snapDot = shape('circle', { r: 16, fill: '#FFF6B0', stroke: '#FF8C1A', 'stroke-width': 5, class: 'snap', opacity: 0 }, s);

      function toSVG(e) {
        const m = s.getScreenCTM().inverse();
        return { x: m.a * e.clientX + m.c * e.clientY + m.e, y: m.b * e.clientX + m.d * e.clientY + m.f };
      }

      function cover(sh, i) {
        if (sh.covered[i]) return;
        sh.covered[i] = true;
        sh.count++;
        sh.segs[i].setAttribute('opacity', 1);
      }

      // Mark every sample point near p; return the nearest point for the snap glow.
      function touch(p) {
        let best = null;
        let bestD = TOLERANCE;
        for (const sh of shapes) {
          if (sh.done) continue;
          sh.pts.forEach((q, i) => {
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < TOLERANCE) {
              const n = sh.pts.length;
              for (let k = -SNAP; k <= SNAP; k++) cover(sh, (i + k + n) % n);
            }
            if (d < bestD) { bestD = d; best = q; }
          });
          if (sh.count / sh.pts.length >= DONE_AT) cutOut(sh);
        }
        return best;
      }

      let remaining = shapes.length;
      function cutOut(sh) {
        sh.done = true;
        sh.pts.forEach((_, i) => cover(sh, i));
        sh.cut.setAttribute('opacity', 1);
        sh.cut.parentNode.querySelector('.dots').remove();
        sh.segs.forEach((l) => l.remove());
        pulseClass(sh.cut, 'popcut');
        sfx('pop');
        const r = sh.cut.getBoundingClientRect();
        sparkleBurst(r.left + r.width / 2, r.top + r.height / 2, 10, 110);
        later(() => sh.cut.setAttribute('fill', '#FFD34E'), 200);
        remaining--;
        showHint();
        if (remaining === 0) lightUp();
      }

      function lightUp() {
        hand.hide();
        snapDot.setAttribute('opacity', 0);
        later(() => {
          wrap.classList.add('lit');
          inner.setAttribute('opacity', 1);
          shapes.forEach((sh) => sh.cut.classList.add('flicker'));
          sfx('glow');
          say('pumpkin-glow');
        }, 500);
        later(() => finish(), 3200);
      }

      // the hint hand sits on the start of the next uncut shape
      let hintTimer = 0;
      function showHint(delay = 900) {
        hand.hide();
        clearTimeout(hintTimer);
        const next = shapes.find((sh) => !sh.done);
        if (!next) return;
        hintTimer = setTimeout(() => {
          const i = next.covered.indexOf(false);
          const p = next.pts[Math.max(0, i)];
          const m = s.getScreenCTM();
          hand.showAt(m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f);
        }, delay);
      }

      let last = null;
      let down = false;
      function move(e) {
        if (!down) return;
        const p = toSVG(e);
        // fill in fast swipes so no gaps are skipped
        const steps = last ? Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / 10) : 1;
        let snap = null;
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          const q = last ? { x: last.x + (p.x - last.x) * t, y: last.y + (p.y - last.y) * t } : p;
          snap = touch(q) || snap;
        }
        last = p;
        if (snap) {
          snapDot.setAttribute('cx', snap.x);
          snapDot.setAttribute('cy', snap.y);
          snapDot.setAttribute('opacity', 1);
        } else snapDot.setAttribute('opacity', 0);
      }
      function up() {
        down = false;
        last = null;
        snapDot.setAttribute('opacity', 0);
        if (remaining) showHint(2500);
      }
      s.addEventListener('pointerdown', (e) => {
        if (!remaining) return;
        down = true;
        hand.hide();
        clearTimeout(hintTimer);
        try { s.setPointerCapture(e.pointerId); } catch { /* fine */ }
        move(e);
      });
      s.addEventListener('pointermove', move);
      s.addEventListener('pointerup', up);
      s.addEventListener('pointercancel', up);

      showHint(1600);
      return () => clearTimeout(hintTimer);
    }

    return () => {
      stopTrace();
      timers.forEach(clearTimeout);
    };
  },
};
