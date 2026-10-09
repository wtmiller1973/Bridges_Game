import { GEO, RULE_SIREN_LEAD } from '../sim/world';
import type { Game } from '../sim/game';

const K = 2; // sim units -> canvas pixels
const C = {
  land: '#cfe3bd', water: '#86bfe6', road: '#585e66', deck: '#8a929c', deckEdge: '#444b53',
  lane: '#f2f2f2', side: '#b9b09c', eb: '#2b6cd9', wb: '#e08a1e', emer: '#d62839', tall: '#1d3557', short: '#2a9d8f',
  ink: '#14202b', go: '#27ae60', stop: '#d62839', sensor: '#ffd23f',
};

function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  c.fillStyle = fill; c.fillRect(x * K, y * K, w * K, h * K);
}
function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.arc(x * K, y * K, r * K, 0, Math.PI * 2); c.fill();
}
function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#222', size = 10) {
  c.font = `${size}px system-ui, sans-serif`; c.fillStyle = color; c.textAlign = 'center';
  c.fillText(text, x * K, y * K);
}
function sensor(c: CanvasRenderingContext2D, x: number, y: number, flashT: number | undefined, now: number, miss = false) {
  const hot = flashT !== undefined && now - flashT < 0.4;
  c.save(); c.translate(x * K, y * K); c.rotate(Math.PI / 4);
  c.fillStyle = hot ? (miss ? '#d62839' : '#fff') : C.sensor; c.strokeStyle = '#333'; c.lineWidth = 1;
  c.fillRect(-4, -4, 8, 8); c.strokeRect(-4, -4, 8, 8); c.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, g: Game, showLabels: boolean) {
  const w = g.world, now = w.t, p = w.bridge.p;
  ctx.clearRect(0, 0, GEO.W * K, GEO.H * K);
  rect(ctx, 0, 0, GEO.W, GEO.H, C.land);
  rect(ctx, GEO.spanA, 0, GEO.spanB - GEO.spanA, GEO.H, C.water);
  // buoys
  for (let y = 10; y < GEO.H; y += 22) { circle(ctx, GEO.laneNB + 12, y, 1.6, '#fff'); circle(ctx, GEO.laneSB - 12, y, 1.6, '#fff'); circle(ctx, 200, y, 1.2, '#ffb703'); }
  // road + sidewalk
  rect(ctx, 0, GEO.roadY - 6, GEO.spanA, 12, C.road);
  rect(ctx, GEO.spanB, GEO.roadY - 6, GEO.W - GEO.spanB, 12, C.road);
  rect(ctx, 0, GEO.roadY + 6, GEO.spanA, 5, C.side);
  rect(ctx, GEO.spanB, GEO.roadY + 6, GEO.W - GEO.spanB, 5, C.side);
  ctx.setLineDash([10, 10]); ctx.strokeStyle = C.lane; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, GEO.roadY * K); ctx.lineTo(GEO.spanA * K, GEO.roadY * K); ctx.moveTo(GEO.spanB * K, GEO.roadY * K); ctx.lineTo(GEO.W * K, GEO.roadY * K); ctx.stroke(); ctx.setLineDash([]);
  // bridge leaves: they fold toward the banks as the bridge rises
  const leaf = ((GEO.spanB - GEO.spanA) / 2) * (1 - 0.9 * p);
  for (const [x0, x1] of [[GEO.spanA, GEO.spanA + leaf], [GEO.spanB - leaf, GEO.spanB]]) {
    rect(ctx, x0, GEO.roadY - 6, x1 - x0, 17, p > 0 ? '#a8aeb6' : C.deck);
    ctx.strokeStyle = C.deckEdge; ctx.lineWidth = 1.5; ctx.strokeRect(x0 * K, (GEO.roadY - 6) * K, (x1 - x0) * K, 17 * K);
  }
  if (p === 0) { ctx.setLineDash([10, 10]); ctx.strokeStyle = C.lane; ctx.beginPath(); ctx.moveTo(GEO.spanA * K, GEO.roadY * K); ctx.lineTo(GEO.spanB * K, GEO.roadY * K); ctx.stroke(); ctx.setLineDash([]); }
  label(ctx, `BRIDGE ${w.bridgePosition().toUpperCase()}`, 200, 132, '#0b2a4a', 11);

  // sensors
  const sx = (d: 'EB' | 'WB', s: number) => (d === 'EB' ? s : GEO.W - s);
  for (const d of ['EB', 'WB'] as const) {
    const sy = d === 'EB' ? 164 : 182;
    sensor(ctx, sx(d, GEO.arrivalS), sy, w.flash[d + 'arr'], now);
    sensor(ctx, sx(d, GEO.gateS), sy, w.flash[d + 'ent'], now);
    sensor(ctx, sx(d, GEO.departS), sy, w.flash[d + 'dep'] ?? w.flash[d + 'miss'], now, w.flash[d + 'miss'] !== undefined && w.flash[d + 'miss'] > (w.flash[d + 'dep'] ?? -1));
  }
  for (const d of ['NB', 'SB'] as const) {
    const y = (u: number) => (d === 'NB' ? GEO.H - u : u);
    const x = d === 'NB' ? GEO.laneNB + 14 : GEO.laneSB - 14;
    sensor(ctx, x, y(GEO.vArrive), w.flash[d + 'varr'], now);
    sensor(ctx, x, y(GEO.vDepart), w.flash[d + 'vdep'], now);
    // signal lamp
    circle(ctx, x, y(GEO.vLight), 4.5, '#222');
    circle(ctx, x, y(GEO.vLight), 3.2, w.lights[d] === 'go' ? C.go : C.stop);
  }
  // gates
  for (const d of ['EB', 'WB'] as const) {
    const x = sx(d, GEO.gateS);
    const stop = w.gates[d] === 'stop';
    circle(ctx, x, GEO.roadY - 10, 4.5, '#222'); circle(ctx, x, GEO.roadY - 10, 3.2, stop ? C.stop : C.go);
    if (stop) {
      for (let i = 0; i < 6; i++) rect(ctx, x - 1.2, GEO.roadY - 6 + i * 2, 2.4, 2, i % 2 ? '#fff' : C.stop);
    } else {
      for (let i = 0; i < 6; i++) rect(ctx, x + (d === 'EB' ? -14 : 8) + i * 1, GEO.roadY - 16, 1, 1.6, i % 2 ? '#fff' : C.go);
    }
  }
  // siren
  const pulse = w.siren === 'off' ? 0 : w.siren === 'on' ? (Math.floor(now * 4) % 2) : (Math.floor(now * 2) % 2);
  circle(ctx, 250, 112, 5, '#222');
  circle(ctx, 250, 112, 3.8, w.siren === 'off' ? '#666' : pulse ? '#ffcf33' : '#ff7b00');
  if (w.siren !== 'off') { ctx.strokeStyle = '#ff7b00'; ctx.lineWidth = 1.5; for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.arc(250 * K, 112 * K, (6 + i * 4 + (pulse ? 2 : 0)) * K, -0.9, 0.9 - Math.PI / 2 * 0); ctx.stroke(); } }
  label(ctx, `siren ${w.siren}`, 250, 98, '#333', 10);
  // vehicles
  for (const v of w.vehicles) {
    const x = sx(v.dir, v.s) - (v.dir === 'EB' ? v.len / 2 : -v.len / 2);
    const col = v.emergency ? ((Math.floor(now * 6) % 2) ? C.emer : '#ffffff') : v.dir === 'EB' ? C.eb : C.wb;
    ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect((x - v.len / 2) * K, (GEO.roadY - 2.6) * K, v.len * K, 5.2 * K, 3); ctx.fill(); ctx.stroke();
    if (v.stalledLeft > 0) label(ctx, '!', x, GEO.roadY - 5, (Math.floor(now * 3) % 2) ? '#d62839' : '#000', 14);
  }
  // pedestrians
  for (const pd of w.peds) circle(ctx, pd.x, GEO.roadY + 8.5, 1.8, pd.crossing ? '#ffd23f' : '#f4733b');
  // vessels
  for (const v of w.vessels) {
    const y = v.dir === 'NB' ? GEO.H - v.u : v.u;
    const x = v.dir === 'NB' ? GEO.laneNB : GEO.laneSB;
    const dirSign = v.dir === 'NB' ? -1 : 1;
    ctx.save(); ctx.translate(x * K, y * K);
    ctx.fillStyle = v.arrivedT < 0 ? '#6c757d' : v.tall ? C.tall : C.short; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
    const hw = (v.heightM >= 4 ? 5 : 3.2) * K, hl = (v.len / 2) * K;
    ctx.beginPath(); ctx.moveTo(0, dirSign * hl); ctx.lineTo(hw, -dirSign * hl * 0.6); ctx.lineTo(hw, -dirSign * hl); ctx.lineTo(-hw, -dirSign * hl); ctx.lineTo(-hw, -dirSign * hl * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (v.heightM >= 4) { ctx.fillStyle = '#fff'; ctx.fillRect(-hw * 0.5, -hl * 0.2, hw, hl * 0.5); }
    ctx.restore();
    label(ctx, `${v.heightM.toFixed(1)} m`, x + 12, y + 3, '#06324f', 9);
  }
  // labels
  if (showLabels) {
    label(ctx, 'EB arrival', GEO.arrivalS, 173, '#222', 9); label(ctx, 'EB entry', GEO.gateS, 173, '#222', 9); label(ctx, 'EB departure', GEO.departS, 173, '#222', 9);
    label(ctx, 'WB arrival', GEO.W - GEO.arrivalS, 191, '#222', 9); label(ctx, 'WB entry', GEO.W - GEO.gateS, 191, '#222', 9); label(ctx, 'WB departure', GEO.W - GEO.departS, 191, '#222', 9);
    label(ctx, 'EB gate', GEO.gateS, GEO.roadY - 15, '#222', 9); label(ctx, 'WB gate', GEO.W - GEO.gateS, GEO.roadY - 15, '#222', 9);
    label(ctx, 'EB queue ->', 70, 134, '#222', 10); label(ctx, '<- WB queue', GEO.W - 70, 134, '#222', 10);
    label(ctx, 'N', 200, 10, '#06324f', 12); label(ctx, 'S', 200, GEO.H - 4, '#06324f', 12);
    label(ctx, 'NB light', GEO.laneNB + 14, GEO.H - GEO.vLight - 8, '#222', 9); label(ctx, 'SB light', GEO.laneSB - 14, GEO.vLight - 8, '#222', 9);
  }
}

/** Siren/bridge timeline: shows business rules xx and yy as 10 s lead brackets. */
export function drawTimeline(ctx: CanvasRenderingContext2D, g: Game) {
  const W = 800, H = 110, span = 150;
  ctx.fillStyle = '#10161c'; ctx.fillRect(0, 0, W, H);
  const t1 = g.world.t, t0 = t1 - span;
  const X = (t: number) => ((t - t0) / span) * (W - 70) + 62;
  ctx.font = '11px system-ui'; ctx.fillStyle = '#9db0c1'; ctx.textAlign = 'right';
  ctx.fillText('siren', 56, 30); ctx.fillText('bridge', 56, 76);
  const hist = g.world.history.filter((h) => h.t >= t0 - 1);
  for (let i = 0; i < hist.length; i++) {
    const h = hist[i], nx = i + 1 < hist.length ? hist[i + 1].t : t1;
    const x0 = X(h.t), x1 = X(nx);
    ctx.fillStyle = h.siren === 'off' ? '#2b3946' : h.siren === 'on' ? '#e5484d' : '#e3a74a';
    ctx.fillRect(x0, 18, Math.max(1, x1 - x0), 18);
    ctx.fillStyle = h.p <= 0 ? '#2d6a4f' : h.p >= 1 ? '#5aa2ff' : '#9d7bd8';
    const bh = 8 + h.p * 40;
    ctx.fillRect(x0, 90 - bh, Math.max(1, x1 - x0), bh);
  }
  // rule brackets before every movement start
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 1;
  for (let i = 1; i < hist.length; i++) {
    const a = hist[i - 1], b = hist[i];
    const started = (a.p === 0 && b.p > 0) || (a.p === 1 && b.p < 1);
    if (!started) continue;
    const xe = X(b.t), xs = X(b.t - RULE_SIREN_LEAD);
    ctx.beginPath(); ctx.moveTo(xs, 44); ctx.lineTo(xs, 48); ctx.lineTo(xe, 48); ctx.lineTo(xe, 44); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillText(`${RULE_SIREN_LEAD} s`, (xs + xe) / 2, 60);
  }
  ctx.fillStyle = '#9db0c1'; ctx.textAlign = 'left';
  ctx.fillText('siren: gray off, red on, amber beep.  bridge: green down, purple moving, blue up.  Brackets show the 10 s rule.', 62, 106);
  ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(W - 8, 14); ctx.lineTo(W - 8, 92); ctx.stroke();
}

export function drawHourly(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number) {
  const t = g.world.tab;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const ink = dark ? '#e8eef3' : '#14202b';
  ctx.clearRect(0, 0, w, h);
  const veh = t.hourly.EB.map((n, i) => n + t.hourly.WB[i]);
  const ves = t.hourly.NB.map((n, i) => n + t.hourly.SB[i]);
  const max = Math.max(1, ...veh, ...ves.map((x) => x * 3));
  const bw = (w - 30) / 24;
  ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  for (let i = 0; i < 24; i++) {
    const x = 26 + i * bw;
    const vh = (veh[i] / max) * (h - 28);
    ctx.fillStyle = '#2b6cd9'; ctx.fillRect(x + 1, h - 16 - vh, bw / 2 - 1, vh);
    const sh = ((ves[i] * 3) / max) * (h - 28);
    ctx.fillStyle = '#2a9d8f'; ctx.fillRect(x + bw / 2, h - 16 - sh, bw / 2 - 1, sh);
    if (i % 3 === 0) { ctx.fillStyle = ink; ctx.fillText(String(i), x + bw / 2, h - 4); }
  }
  ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(String(max), 0, 10);
  const cur = Math.floor(g.world.hourOfDay());
  ctx.strokeStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(26 + cur * bw + bw / 2, 4); ctx.lineTo(26 + cur * bw + bw / 2, h - 16); ctx.stroke();
}
