import type { Game } from '../sim/game';
import { buildReport, clockText, passagesCsv, type DotReport, type Stat } from '../sim/reports';
import { openDialog } from './dialogs';

export type ReportView = 'summary' | 'times' | 'hourly' | 'util' | 'quality' | 'log';
export const REPORT_VIEWS: { id: ReportView; label: string }[] = [
  { id: 'summary', label: 'Passage volume (cars and boats)' },
  { id: 'times', label: 'Passage times (traversal)' },
  { id: 'hourly', label: 'Volume by hour of day' },
  { id: 'util', label: 'Bridge utilisation' },
  { id: 'quality', label: 'Data quality and safety' },
  { id: 'log', label: 'Passage log (raw records)' },
];

const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => Math.round(n).toLocaleString();

function header(r: DotReport): string {
  const h = r.header;
  return `<div class="card"><h3>State Department of Transportation: Bridge Usage Report</h3>
    <div class="small">${h.bridgeId} · ${h.location}<br>Cycle: <b>${h.cycle}</b> · Period: ${h.periodStart} to ${h.periodEnd} (${h.periodDays.toFixed(2)} days) · Generated at ${h.generated}</div></div>`;
}

function summary(r: DotReport): string {
  const p = r.projection;
  return `<div class="card"><h3>How many cars and boats used the bridge</h3>
    <table><tr><th>Traffic</th><th class="n">Count</th></tr>
    <tr><td>Cars, east bound</td><td class="n">${r.cars.EB}</td></tr>
    <tr><td>Cars, west bound</td><td class="n">${r.cars.WB}</td></tr>
    <tr><td><b>Cars, total</b></td><td class="n"><b>${r.cars.total}</b></td></tr>
    <tr><td>&nbsp;&nbsp;of which emergency vehicles</td><td class="n">${r.cars.emergency}</td></tr>
    <tr><td>Tall vessels, north bound (bridge raised)</td><td class="n">${r.boats.NB}</td></tr>
    <tr><td>Tall vessels, south bound (bridge raised)</td><td class="n">${r.boats.SB}</td></tr>
    <tr><td>Short boats (passed beneath, not vessels)</td><td class="n">${r.boats.short}</td></tr>
    <tr><td><b>Boats, total</b></td><td class="n"><b>${r.boats.total}</b></td></tr>
    <tr><td>Pedestrians and cyclists</td><td class="n">${r.pedestrians}</td></tr></table>
    ${p ? `<h3 style="margin-top:10px">Projected usage (scaled from this ${r.header.periodDays.toFixed(1)}-day run)</h3>
    <table><tr><th></th><th class="n">Cars</th><th class="n">Boats</th></tr>
    <tr><td>Per day</td><td class="n">${f0(p.daily)}</td><td class="n">${f0(p.boatsDaily)}</td></tr>
    <tr><td>Per week</td><td class="n">${f0(p.weekly)}</td><td class="n">${f0(p.boatsWeekly)}</td></tr>
    <tr><td>Per month (30 days)</td><td class="n">${f0(p.monthly)}</td><td class="n">${f0(p.boatsMonthly)}</td></tr></table>` : '<div class="small muted">Play level 6 (a full simulated day) to see daily, weekly and monthly projections.</div>'}</div>`;
}

const row = (name: string, s: Stat) => s.n
  ? `<tr><td>${name}</td><td class="n">${s.n}</td><td class="n">${f1(s.min)}</td><td class="n">${f1(s.median)}</td><td class="n">${f1(s.mean)}</td><td class="n">${f1(s.p90)}</td><td class="n">${f1(s.max)}</td></tr>`
  : `<tr><td>${name}</td><td class="n">0</td><td class="n" colspan="5">no data</td></tr>`;

function times(r: DotReport): string {
  const t = r.times;
  return `<div class="card"><h3>Time to traverse the bridge (seconds)</h3>
    <div class="small muted">Total = arrival sensor to departure sensor, so it includes waiting for the bridge. Span = from the barrier or signal to the departure sensor. Only completed passages are listed; anyone still waiting appears under Data quality.</div>
    <table><tr><th>Passage</th><th class="n">n</th><th class="n">min</th><th class="n">median</th><th class="n">mean</th><th class="n">90th</th><th class="n">max</th></tr>
    ${row('Cars, all: total', t.carTotal)}${row('Cars, east bound: total', t.carEB)}${row('Cars, west bound: total', t.carWB)}
    ${row('Cars: wait for the bridge', t.carWait)}${row('Cars: on the span', t.carSpan)}${row('Emergency vehicles: total', t.emergency)}
    ${row('Tall vessels: total', t.boatTall)}${row('Tall vessels: wait for the bridge', t.boatTallWait)}${row('Short boats: total', t.boatShort)}</table>
    <div class="small muted">Durations are in actual simulated seconds, even in time-compressed levels.</div></div>`;
}

function hourly(r: DotReport): string {
  const rows = r.byHour.filter((h) => h.EB + h.WB + h.NB + h.SB + h.short > 0);
  return `<div class="card"><h3>Volume and traversal time by hour of day</h3>
    <canvas id="hourly" width="520" height="150" style="background:transparent"></canvas>
    <div class="small muted"><span style="color:#2b6cd9">■</span> vehicles <span style="color:#2a9d8f">■</span> tall vessels (x3 scale)</div>
    <table><tr><th>Hour</th><th class="n">EB</th><th class="n">WB</th><th class="n">Emerg.</th><th class="n">NB</th><th class="n">SB</th><th class="n">Short</th><th class="n">Car s</th><th class="n">Boat s</th></tr>
    ${rows.map((h) => `<tr><td>${String(h.hour).padStart(2, '0')}:00</td><td class="n">${h.EB}</td><td class="n">${h.WB}</td><td class="n">${h.emer}</td><td class="n">${h.NB}</td><td class="n">${h.SB}</td><td class="n">${h.short}</td><td class="n">${h.carTransit ? f1(h.carTransit) : ''}</td><td class="n">${h.boatTransit ? f1(h.boatTransit) : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">No data yet.</td></tr>'}</table></div>`;
}

function util(r: DotReport): string {
  const u = r.util;
  return `<div class="card"><h3>Bridge utilisation</h3><table>
    <tr><td>East bound gate open</td><td class="n">${f1(u.ebOpenPct)}% of the period</td></tr>
    <tr><td>West bound gate open</td><td class="n">${f1(u.wbOpenPct)}% of the period</td></tr>
    <tr><td>Bridge raised (not available to road)</td><td class="n">${f1(u.raisedPct)}%</td></tr>
    <tr><td>Raise cycles completed</td><td class="n">${u.raiseCycles}</td></tr>
    <tr><td>Total time raised</td><td class="n">${f1(u.raisedMin)} min</td></tr></table>
    <div class="small muted">Use utilisation by hour to schedule motor and sensor maintenance in the quietest hours.</div></div>`;
}

function quality(r: DotReport): string {
  const q = r.quality;
  return `<div class="card"><h3>Data quality and safety</h3><table>
    <tr><td>Departures missed by sensors (wildlife, glare)</td><td class="n ${q.sensorMisses ? 'warn' : ''}">${q.sensorMisses}</td></tr>
    <tr><td>Vehicles stalled on the span</td><td class="n">${q.stalls}</td></tr>
    <tr><td>Tows dispatched</td><td class="n">${q.towed}</td></tr>
    <tr><td>Safety violations (citation candidates and liability)</td><td class="n ${q.violations ? 'bad' : 'good'}">${q.violations}</td></tr>
    <tr><td>Cars turned away (queue full)</td><td class="n">${q.turnedAway}</td></tr>
    <tr><td>Still waiting at report time: cars / tall vessels</td><td class="n">${q.carsWaiting} / ${q.vesselsWaiting}</td></tr>
    <tr><td>Longest current wait</td><td class="n ${q.longestCurrentWait > 120 ? 'bad' : ''}">${f1(q.longestCurrentWait)} s</td></tr></table>
    <div class="small muted">Sensor accuracy drives controller behaviour (information risk). Missed departures also mean the passage counts above are slightly low.</div></div>`;
}

function log(g: Game): string {
  const w = g.world.tab;
  const rows: { t: number; html: string }[] = [];
  for (const p of w.vehPassages.slice(-30)) rows.push({ t: p.departedT, html: `<tr><td>${clockText(g, p.departedT)}</td><td>${p.emergency ? 'emergency ' : 'car '}${p.dir}</td><td class="n">${f1(p.enteredT - p.arrivedT)}</td><td class="n">${f1(p.departedT - p.enteredT)}</td><td class="n">${f1(p.departedT - p.arrivedT)}</td></tr>` });
  for (const p of w.boatPassages.slice(-30)) rows.push({ t: p.departedT, html: `<tr><td>${clockText(g, p.departedT)}</td><td>${p.tall ? 'vessel' : 'short boat'} ${p.dir} ${p.heightM.toFixed(1)} m</td><td class="n">${f1(p.passedT - p.arrivedT)}</td><td class="n">${f1(p.departedT - p.passedT)}</td><td class="n">${f1(p.departedT - p.arrivedT)}</td></tr>` });
  rows.sort((a, b) => b.t - a.t);
  return `<div class="card"><h3>Passage log (latest 30 each)</h3><div class="small muted">Each row is a VEHICLE PASSAGE or VESSEL PASSAGE record from the conceptual data model.</div>
    <table><tr><th>Departed</th><th>Who</th><th class="n">Wait</th><th class="n">Span</th><th class="n">Total</th></tr>${rows.slice(0, 40).map((r) => r.html).join('') || '<tr><td colspan="5" class="muted">No passages yet.</td></tr>'}</table></div>`;
}

export function reportView(g: Game, view: ReportView): string {
  const r = buildReport(g);
  const body = { summary: summary(r), times: times(r), hourly: hourly(r), util: util(r), quality: quality(r), log: log(g) }[view];
  return header(r) + body;
}

export function fullReportHtml(g: Game): string {
  const r = buildReport(g);
  return header(r) + summary(r) + times(r) + hourly(r) + util(r) + quality(r);
}

export function downloadCsv(g: Game) {
  const blob = new Blob([passagesCsv(g)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bridge-passages-${g.level.id}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Simulates the DOT "request passage data" event (F) and shows the report that comes back. */
export function requestReport(g: Game) {
  g.world.emit('DOT', 'Bridge System', 'request passage data (F)');
  g.world.emit('Bridge System', 'DOT', 'passage data report');
  openDialog(`<div id="printable"><h2>Passage data report</h2>${fullReportHtml(g)}</div>
    <div class="actions"><button class="primary" data-print>Print or save as PDF</button><button data-csv>Download passage log (CSV)</button><button data-close>Close</button></div>`);
  const d = document.getElementById('dlgBody')!;
  d.querySelector('[data-print]')?.addEventListener('click', () => window.print());
  d.querySelector('[data-csv]')?.addEventListener('click', () => downloadCsv(g));
}
