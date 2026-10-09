import './style.css';
import { Game, DT } from './sim/game';
import { LEVELS } from './sim/levels';
import { DEFAULT_SPECS, cloneSpecs, type Specs } from './sim/specs';
import { drawHourly, drawScene, drawTimeline } from './render/scene';
import { hudHtml, operatorHtml, traceHtml } from './ui/panels';
import { REPORT_VIEWS, downloadCsv, reportView, requestReport, type ReportView } from './ui/reports';
import { buildSpecLab, decodeSpecs, encodeSpecs } from './ui/speclab';
import { bizCase, briefing, closeDialog, debrief, help, openDialog } from './ui/dialogs';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.hash.slice(1));

const specs: Specs = { ...cloneSpecs(DEFAULT_SPECS), ...decodeSpecsSafe() };
function decodeSpecsSafe(): Partial<Specs> {
  let fromStore: string | null = null;
  try { fromStore = localStorage.getItem('bridges.specs'); } catch { /* storage may be blocked */ }
  return decodeSpecs(params.get('s') ?? fromStore);
}
function saveSpecs() { try { localStorage.setItem('bridges.specs', encodeSpecs(specs)); } catch { /* ignore */ } }

let levelIdx = Math.max(0, LEVELS.findIndex((l) => l.id === params.get('l')));
let game: Game;
let running = false;
let speed = 1;
let seed = 1;
let showLabels = true;
let ended = false;

const scene = $<HTMLCanvasElement>('scene'), sctx = scene.getContext('2d')!;
const tl = $<HTMLCanvasElement>('timeline'), tctx = tl.getContext('2d')!;
const levelSel = $<HTMLSelectElement>('levelSel');
LEVELS.forEach((l, i) => levelSel.add(new Option(l.title, String(i))));

function link(): string {
  const p = new URLSearchParams();
  p.set('l', LEVELS[levelIdx].id);
  const s = encodeSpecs(specs);
  if (s !== btoa('{}')) p.set('s', s);
  return `${location.origin}${location.pathname}#${p.toString()}`;
}

function setModeButtons() {
  $('modeAuto').classList.toggle('on', game.auto);
  $('modeManual').classList.toggle('on', !game.auto);
}

function load(i: number, auto?: boolean) {
  levelIdx = i; levelSel.value = String(i); ended = false;
  const lv = LEVELS[i];
  game = new Game(lv, specs, seed, auto ?? !lv.manualDefault);
  seed += 1;
  setModeButtons();
  running = false; $('playBtn').textContent = 'Resume';
  lastHtml = {};
  render(true);
  briefing(lv, specs, () => { running = true; $('playBtn').textContent = 'Pause'; });
}

// ---- tabs ----
let tab = 'op';
document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab!;
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  for (const id of ['op', 'trace', 'dot', 'specs']) $('tab-' + id).hidden = id !== tab;
  lastHtml = {}; render(true);
}));

// ---- DOT reports tab: static controls built once, only the body refreshes ----
let dotView: ReportView = 'summary';
$('tab-dot').innerHTML = `<div class="card"><h3>DOT reports</h3>
  <div class="small muted">The State DOT wants usage data: how many cars and boats, and how long passages take. Pick a report, or request the full data pull.</div>
  <div class="ctl"><select id="dotSel" aria-label="Report">${REPORT_VIEWS.map((v) => `<option value="${v.id}">${v.label}</option>`).join('')}</select></div>
  <div class="actions"><button class="primary" id="dotRequest">Request passage data (pull)</button><button id="dotCsv">Download CSV</button></div></div><div id="dotBody"></div>`;
$<HTMLSelectElement>('dotSel').addEventListener('change', (e) => { dotView = (e.target as HTMLSelectElement).value as ReportView; lastHtml = {}; render(true); });
$('dotRequest').addEventListener('click', () => { running = false; $('playBtn').textContent = 'Resume'; requestReport(game); });
$('dotCsv').addEventListener('click', () => downloadCsv(game));

const refreshSpecs = buildSpecLab($('tab-specs'), specs, () => saveSpecs());

// ---- manual controls (delegated so periodic re-rendering never eats a click) ----
$('tab-op').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  const act = b?.dataset.act;
  if (!act || game.auto) return;
  const w = game.world, [kind, a, c] = act.split('-');
  if (kind === 'gate') w.setGate(a as 'EB' | 'WB', c as 'go' | 'stop');
  else if (kind === 'light') w.setLight(a as 'NB' | 'SB', c as 'go' | 'stop');
  else if (kind === 'siren') w.setSiren(a as 'off' | 'on' | 'beep');
  else if (kind === 'cit') w.setCitizen(a as 'go' | 'stop');
  else if (kind === 'bridge') { if (a === 'up') w.raise(); else w.lower(); }
  render(true);
});

// ---- header controls ----
$('modeAuto').addEventListener('click', () => { game.setAuto(true); setModeButtons(); render(true); });
$('modeManual').addEventListener('click', () => { game.setAuto(false); setModeButtons(); render(true); });
$('playBtn').addEventListener('click', () => { running = !running; $('playBtn').textContent = running ? 'Pause' : 'Resume'; });
$('restartBtn').addEventListener('click', () => load(levelIdx, game.auto));
levelSel.addEventListener('change', () => load(Number(levelSel.value)));
$<HTMLSelectElement>('speedSel').addEventListener('change', (e) => { speed = Number((e.target as HTMLSelectElement).value); });
$('helpBtn').addEventListener('click', () => { running = false; $('playBtn').textContent = 'Resume'; help(); });
$('bizBtn').addEventListener('click', () => { running = false; $('playBtn').textContent = 'Resume'; bizCase(); });
$('shareBtn').addEventListener('click', async (e) => {
  const url = link();
  try { await navigator.clipboard.writeText(url); (e.target as HTMLElement).textContent = 'Copied!'; setTimeout(() => ((e.target as HTMLElement).textContent = 'Copy share link'), 1500); }
  catch { openDialog(`<h2>Share link</h2><p>Copy this link:</p><textarea style="width:100%" rows="4" readonly>${url}</textarea><div class="actions"><button data-close class="primary">Close</button></div>`); }
});
$('dlg').addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  if (el.closest('[data-close]')) closeDialog();
  const reset = el.closest('[data-reset-specs]');
  if (reset) {
    Object.assign(specs, DEFAULT_SPECS); saveSpecs(); refreshSpecs();
    reset.closest('.card')!.innerHTML = '<b class="good">Specs reset to defaults.</b>';
  }
});
$('hud').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-goto-specs]')) document.querySelector<HTMLButtonElement>('.tabs button[data-tab="specs"]')!.click();
});
window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); $('playBtn').click(); } });

// ---- render ----
let lastHtml: Record<string, string> = {};
function setHtml(id: string, html: string) { if (lastHtml[id] !== html) { lastHtml[id] = html; $(id).innerHTML = html; } }
function render(force = false) {
  drawScene(sctx, game, showLabels);
  drawTimeline(tctx, game);
  setHtml('hud', hudHtml(game));
  if (tab === 'op') setHtml('tab-op', operatorHtml(game));
  else if (tab === 'trace') setHtml('tab-trace', traceHtml(game));
  else if (tab === 'dot') {
    setHtml('dotBody', reportView(game, dotView));
    const c = document.getElementById('hourly') as HTMLCanvasElement | null;
    if (c) drawHourly(c.getContext('2d')!, game, c.width, c.height);
  } else if (tab === 'specs' && force) refreshSpecs();
}

let prev = performance.now(), acc = 0, panelAcc = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
  if (running && !game.done) {
    acc += dt * speed;
    let n = 0;
    while (acc >= DT && n < 400) { game.step(DT); acc -= DT; n++; }
    if (n === 400) acc = 0;
  }
  panelAcc += dt;
  drawScene(sctx, game, showLabels);
  if (panelAcc > 0.2) { panelAcc = 0; render(); }
  if (game.done && !ended) {
    ended = true; running = false; $('playBtn').textContent = 'Resume';
    debrief(game, specs, levelIdx < LEVELS.length - 1, link(), {
      replay: () => load(levelIdx, game.auto),
      next: () => load(levelIdx + 1),
      report: () => requestReport(game),
    });
  }
  requestAnimationFrame(frame);
}

// hooks for tests / screenshots
(window as unknown as { __bridges: unknown }).__bridges = { get game() { return game; }, load, get running() { return running; } };

game = new Game(LEVELS[levelIdx], specs, seed, !LEVELS[levelIdx].manualDefault);
load(levelIdx);
requestAnimationFrame(frame);
