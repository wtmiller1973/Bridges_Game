// Hiding spots: something (a ghost, a cat) peeking out from behind
// something else (a tombstone, a bush). Positions are % of the stage:
// x = centre, y = where the bottom of the hiding object sits.
import { el, svg } from './util.js';

export function makeSpot(parent, { x, y, w }, occluder, actorName, cls = '') {
  const spot = el('div', 'spot ' + cls, parent);
  spot.style.left = x + '%';
  spot.style.top = y + '%';
  spot.style.width = w + '%';
  spot.style.zIndex = String(Math.round(y));
  const peek = el('div', 'peek', spot);
  const actor = el('div', 'actor', peek);
  if (actorName) actor.appendChild(svg(actorName));
  const occ = el('div', 'occ', spot);
  const cover = svg('scenes/' + occluder);
  cover.setAttribute('preserveAspectRatio', 'xMidYMax meet'); // sit on the ground
  occ.appendChild(cover);
  return { spot, peek, actor, occ };
}
