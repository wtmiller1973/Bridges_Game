import type { Game } from '../sim/game';
import { summarize } from '../sim/game';
import { RULE_SIREN_LEAD, VIOLATION_INFO } from '../sim/world';

const f1 = (n: number) => n.toFixed(1);
const clock = (g: Game) => {
  const h = g.world.hourOfDay();
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
};

export function hudHtml(g: Game): string {
  const w = g.world, s = summarize(g);
  const left = Math.max(0, g.level.duration - w.t);
  return `<span>Time left <b>${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}</b></span>
  <span>Clock <b>${clock(g)}</b></span>
  <span>Safety violations <b class="${s.safety ? 'bad' : 'good'}">${s.safety}</b></span>
  <span>Avg car wait <b>${f1(s.avgVehWait)} s</b></span>
  <span>Avg vessel wait <b>${f1(s.avgVesselWait)} s</b></span>
  <span>Score <b>${s.score}</b></span>`;
}

const chip = (label: string, on: boolean) => `<span class="chip ${on ? 'on' : ''}">${label}</span>`;

export function operatorHtml(g: Game): string {
  const w = g.world, c = g.controller, st = w.bridge.status;
  const alarm = w.alarm ? `<div class="alarm">ALARM: stalled vehicle on the span. Tow dispatched.</div>` : '';
  let h = `<div class="card"><h3>Bridge status</h3>
    <div class="chips">${chip('IDLE', st === 'idle')}${chip('EAST', st === 'east')}${chip('WEST', st === 'west')}${chip('NORTH / SOUTH', st === 'ns')}</div>
    <div class="small muted">Position: <b>${w.bridgePosition()}</b> · Siren: <b>${w.siren}</b> · Citizen signal: <b>${w.citizen}</b></div>
    <div class="small muted">Gates: EB <b>${w.gates.EB}</b>, WB <b>${w.gates.WB}</b> · Vessel lights: NB <b>${w.lights.NB}</b>, SB <b>${w.lights.SB}</b></div></div>${alarm}`;
  h += `<div class="card"><h3>Sensor counts (what the controller knows)</h3>
    <table><tr><th></th><th class="n">count</th><th class="n">waiting</th></tr>
    <tr><td>East bound vehicles</td><td class="n">${w.veh.EB.count}</td><td class="n">${w.veh.EB.waitQ.length}</td></tr>
    <tr><td>West bound vehicles</td><td class="n">${w.veh.WB.count}</td><td class="n">${w.veh.WB.waitQ.length}</td></tr>
    <tr><td>North bound tall vessels</td><td class="n">${w.vsl.NB.count}</td><td class="n"></td></tr>
    <tr><td>South bound tall vessels</td><td class="n">${w.vsl.SB.count}</td><td class="n"></td></tr>
    <tr><td>Pedestrians waiting</td><td class="n"></td><td class="n">${w.pedsWaiting()}</td></tr></table></div>`;
  if (g.auto) {
    h += `<div class="card"><h3>Use case: ${c.useCase}</h3><div>${c.step}</div></div>`;
  } else {
    const gate = (d: 'EB' | 'WB') => `<div class="ctl"><span class="lab">${d} gate (${w.gates[d]})</span><button class="go" data-act="gate-${d}-go">Go</button><button class="stop" data-act="gate-${d}-stop">Stop</button></div>`;
    const light = (d: 'NB' | 'SB') => `<div class="ctl"><span class="lab">${d} vessel light (${w.lights[d]})</span><button class="go" data-act="light-${d}-go">Go</button><button class="stop" data-act="light-${d}-stop">Stop</button></div>`;
    const gatesStopped = w.gates.EB === 'stop' && w.gates.WB === 'stop';
    const spanClear = w.spanVehicles() === 0 && w.spanPeds() === 0;
    const sirenOk = w.siren === 'on' && w.t - w.sirenSince >= RULE_SIREN_LEAD;
    const ok = (b: boolean, t: string) => `<div class="check"><span class="dot ${b ? 'ok' : ''}"></span>${t}</div>`;
    h += `<div class="card"><h3>You are the operator</h3>
      ${gate('EB')}${gate('WB')}${light('NB')}${light('SB')}
      <div class="ctl"><span class="lab">Siren (${w.siren})</span><button data-act="siren-off">Off</button><button data-act="siren-on">On</button><button data-act="siren-beep">Beep</button></div>
      <div class="ctl"><span class="lab">Citizen signal (${w.citizen})</span><button class="go" data-act="cit-go">Go</button><button class="stop" data-act="cit-stop">Stop</button></div>
      <div class="ctl"><span class="lab">Bridge</span><button data-act="bridge-up">Raise</button><button data-act="bridge-down">Lower</button></div>
      <h3 style="margin-top:10px">Safe to move the bridge?</h3>
      ${ok(gatesStopped, 'Both vehicle gates are stopped')}
      ${ok(spanClear, 'Span is clear of cars and pedestrians')}
      ${ok(sirenOk, `Siren has been ON for ${RULE_SIREN_LEAD} s`)}
      <div class="small muted">Only let vessels through when the bridge is up. Only let cars through when it is down.</div></div>`;
  }
  const v = w.violations.slice(-6).reverse();
  h += `<div class="card"><h3>Violations (${w.violations.length})</h3>${v.length ? v.map((x) => `<div class="small"><b class="bad">${VIOLATION_INFO[x.kind].title}</b> <span class="muted">at ${Math.round(x.t)} s</span><br>${x.detail}</div>`).join('') : '<div class="small muted">None yet.</div>'}</div>`;
  return h;
}

export function traceHtml(g: Game): string {
  const m = g.world.msgs.slice(-40).reverse();
  return `<div class="card"><h3>Message trace</h3><div class="small muted">Live messages between the classes in the Software Specs class diagram. Follow one east bound car through the sequence diagram: arrive, get/set bridge status, get time, stop/go, depart, stop/go, set status.</div></div>
  <div class="trace">${m.map((x) => `<div><span class="t">${x.t.toFixed(1)}s</span> ${x.from} → ${x.to}: <b>${x.label}</b></div>`).join('') || '<div class="muted">Waiting for the first event...</div>'}</div>`;
}
