import type { Game } from '../sim/game';
import { summarize } from '../sim/game';
import { QUIZ, type Level } from '../sim/levels';
import { SPEC_DEFS, changedSpecs, DEFAULT_SPECS, type Specs } from '../sim/specs';
import { VIOLATION_INFO } from '../sim/world';
import { buildReport } from '../sim/reports';

const dlg = () => document.getElementById('dlg') as HTMLDialogElement;
const body = () => document.getElementById('dlgBody') as HTMLElement;

export function openDialog(html: string, onClose?: () => void) {
  body().innerHTML = html;
  const d = dlg();
  d.onclose = () => onClose?.();
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
export function closeDialog() { if (dlg().open) dlg().close(); }

export function briefing(l: Level, onStart: () => void) {
  openDialog(`<h2>${l.title}</h2><p>${l.brief}</p>
    <h3>You will learn</h3><ul>${l.goals.map((g) => `<li>${g}</li>`).join('')}</ul>
    <h3>Try this</h3><ul>${l.tryThis.map((g) => `<li>${g}</li>`).join('')}</ul>
    <div class="actions"><button class="primary" data-close>Start</button></div>`, onStart);
}

export function help() {
  openDialog(`<h2>How to play</h2>
    <p>A one-lane drawbridge joins the mainland (west) to an island (east). Cars cross east and west, tall boats pass north and south, and pedestrians walk the sidewalk. The bridge system replaces the human operator.</p>
    <ul><li><b>Automatic</b>: the controller runs the use cases from the course decks. Watch the Operator and Trace tabs.</li>
    <li><b>Manual</b>: you operate gates, lights, siren and bridge. Avoid violations and keep waits short.</li>
    <li><b>Spec Lab</b>: change any requirement and see what breaks. Items marked GAP are things the decks left unspecified.</li>
    <li><b>DOT reports</b>: the usage reports the state wants: how many cars and boats, and how long each took to cross.</li></ul>
    <p class="muted small">Yellow diamonds are sensors (they flash white when they fire, red when a sensor misses). Blue cars go east, orange cars go west, flashing red ones are emergency vehicles. Boat labels show height in metres; the closed bridge clears 4.0 m.</p>
    <div class="actions"><button class="primary" data-close>Got it</button></div>`);
}

export function debrief(g: Game, specs: Specs, hasNext: boolean, link: string, handlers: { replay: () => void; next: () => void; report: () => void }) {
  const s = summarize(g), l = g.level, t = g.world.tab, rep = buildReport(g);
  const kinds = new Map<string, number>();
  for (const v of g.world.violations) kinds.set(v.kind, (kinds.get(v.kind) ?? 0) + 1);
  const changed = changedSpecs(specs);
  const text = `The Bridges - ${l.title} (${g.auto ? 'automatic' : 'manual'}): grade ${s.grade}, score ${s.score}, ${s.safety} safety violation(s), avg car wait ${s.avgVehWait.toFixed(1)} s, avg vessel wait ${s.avgVesselWait.toFixed(1)} s. ${link}`;
  const qs = l.quiz.map((i, n) => {
    const q = QUIZ[i];
    return `<div class="quiz" data-q="${n}"><b>${n + 1}. ${q.q}</b>${q.options.map((o, k) => `<label><input type="radio" name="q${n}" value="${k}"> ${o}</label>`).join('')}<div class="why muted" hidden></div></div>`;
  }).join('');
  openDialog(`<h2>Debrief: ${l.title}</h2>
    <p><b style="font-size:28px">${s.grade}</b> &nbsp; score <b>${s.score}</b> &nbsp; (${g.auto ? 'Automatic' : 'Manual'})</p>
    <table><tr><td>Safety violations</td><td class="n">${s.safety}</td></tr>
    <tr><td>Vehicles through (EB / WB)</td><td class="n">${t.volume.EB + t.volume.EBE} / ${t.volume.WB + t.volume.WBE}</td></tr>
    <tr><td>Tall vessels through (NB / SB)</td><td class="n">${t.volume.NB} / ${t.volume.SB}</td></tr>
    <tr><td>Average car wait</td><td class="n">${s.avgVehWait.toFixed(1)} s</td></tr>
    <tr><td>Average vessel wait</td><td class="n">${s.avgVesselWait.toFixed(1)} s</td></tr>
    <tr><td>Average emergency wait</td><td class="n">${s.avgEmerWait.toFixed(1)} s</td></tr>
    <tr><td>Longest wait</td><td class="n">${s.maxWait.toFixed(0)} s</td></tr>
    <tr><td>Cars turned away (queue full)</td><td class="n">${t.turnedAway}</td></tr>
    <tr><td>DOT report: cars / boats (incl. short)</td><td class="n">${rep.cars.total} / ${rep.boats.total}</td></tr>
    <tr><td>DOT report: mean car / tall-vessel traversal</td><td class="n">${rep.times.carTotal.mean.toFixed(1)} s / ${rep.times.boatTall.mean.toFixed(1)} s</td></tr></table>
    ${kinds.size ? `<h3>What went wrong, and the requirement behind it</h3>${[...kinds].map(([k, n]) => `<div class="card"><b class="bad">${VIOLATION_INFO[k as keyof typeof VIOLATION_INFO].title}</b> x${n}<div class="small">${VIOLATION_INFO[k as keyof typeof VIOLATION_INFO].concept}</div></div>`).join('')}` : '<p class="good"><b>No safety violations.</b></p>'}
    <h3>Your spec changes</h3>${changed.length ? `<ul>${changed.map((k) => { const d = SPEC_DEFS.find((x) => x.key === k)!; return `<li>${d.label}: <b>${specs[k]}</b> (default ${DEFAULT_SPECS[k]})</li>`; }).join('')}</ul>` : '<p class="muted">Default specs.</p>'}
    <h3>Check your understanding</h3>${qs}
    <div class="actions"><button data-replay>Replay</button>${hasNext ? '<button class="primary" data-next>Next level</button>' : ''}<button data-report>Open DOT report</button><button data-copy>Copy my results</button><button data-close>Close</button></div>`);
  const b = body();
  b.querySelectorAll<HTMLInputElement>('.quiz input').forEach((inp) => inp.addEventListener('change', () => {
    const box = inp.closest('.quiz') as HTMLElement;
    const q = QUIZ[l.quiz[Number(box.dataset.q)]];
    const ok = Number(inp.value) === q.answer;
    const why = box.querySelector('.why') as HTMLElement;
    why.hidden = false;
    why.innerHTML = `<b class="${ok ? 'good' : 'bad'}">${ok ? 'Correct.' : 'Not quite.'}</b> ${q.why}`;
  }));
  b.querySelector('[data-replay]')?.addEventListener('click', () => { closeDialog(); handlers.replay(); });
  b.querySelector('[data-report]')?.addEventListener('click', () => handlers.report());
  b.querySelector('[data-next]')?.addEventListener('click', () => { closeDialog(); handlers.next(); });
  b.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(text); (e.target as HTMLElement).textContent = 'Copied!'; } catch { prompt('Copy your results:', text); }
  });
}

export function bizCase() {
  openDialog(`<h2>Business case calculator</h2>
    <p class="small muted">From the Business Requirements deck: 14 staffed bridges, 24x7x365, 858,480 staffing hours a year at a burdened $17.50/hour = <b>$15,023,400 a year</b>. The deck lists cost categories but no amounts, so the costs below are <b>placeholders for you to challenge</b>.</p>
    <div id="bizForm"></div><div id="bizOut" class="card"></div>
    <div class="actions"><button data-close class="primary">Close</button></div>`);
  const fields = [
    { id: 'hours', label: 'Staffing hours per year', v: 858480, min: 100000, max: 1000000, step: 10000 },
    { id: 'rate', label: 'Burdened cost per hour ($)', v: 17.5, min: 10, max: 40, step: 0.5 },
    { id: 'impl', label: 'Implementation cost, all bridges ($ million)', v: 28, min: 1, max: 100, step: 1 },
    { id: 'rec', label: 'Recurring cost per year: engineering and software maintenance ($ million)', v: 2, min: 0, max: 20, step: 0.5 },
    { id: 'keep', label: 'Staff you still need (%)', v: 10, min: 0, max: 100, step: 5 },
    { id: 'disc', label: 'Discount rate (%)', v: 5, min: 0, max: 15, step: 0.5 },
    { id: 'yrs', label: 'Years', v: 10, min: 3, max: 30, step: 1 },
  ];
  const form = document.getElementById('bizForm')!;
  form.innerHTML = fields.map((f) => `<div class="ctl"><span class="lab" style="min-width:260px">${f.label}</span><input type="range" id="biz-${f.id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.v}"><b id="biz-${f.id}-v"></b></div>`).join('');
  const val = (id: string) => parseFloat((document.getElementById('biz-' + id) as HTMLInputElement).value);
  const calc = () => {
    for (const f of fields) document.getElementById(`biz-${f.id}-v`)!.textContent = String(val(f.id));
    const saving = val('hours') * val('rate') * (1 - val('keep') / 100);
    const net = saving - val('rec') * 1e6, impl = val('impl') * 1e6, r = val('disc') / 100, n = val('yrs');
    let npv = -impl; for (let y = 1; y <= n; y++) npv += net / Math.pow(1 + r, y);
    const payback = net > 0 ? impl / net : Infinity;
    const m = (x: number) => `$${(x / 1e6).toFixed(1)}M`;
    document.getElementById('bizOut')!.innerHTML = `<table><tr><td>Annual operator cost avoided</td><td class="n">${m(saving)}</td></tr><tr><td>Net annual benefit after recurring cost</td><td class="n">${m(net)}</td></tr>
      <tr><td>Payback period</td><td class="n">${isFinite(payback) ? payback.toFixed(1) + ' years' : 'never'}</td></tr><tr><td>Net present value (${n} yr)</td><td class="n ${npv >= 0 ? 'good' : 'bad'}">${m(npv)}</td></tr></table>
      <div class="small muted">Intangible benefits (traffic strategy, diversion, satisfaction) and the risk of not doing the project are not counted here.</div>`;
  };
  form.addEventListener('input', calc);
  calc();
}
