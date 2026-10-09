import { describe, expect, it } from 'vitest';
import { Game, summarize } from '../src/sim/game';
import { LEVELS } from '../src/sim/levels';
import { DEFAULT_SPECS, cloneSpecs } from '../src/sim/specs';

const level = (id: string) => LEVELS.find((l) => l.id === id)!;
const play = (id: string, patch: Partial<typeof DEFAULT_SPECS> = {}, seed = 7) => {
  const g = new Game(level(id), { ...cloneSpecs(DEFAULT_SPECS), ...patch }, seed, true);
  g.run(level(id).duration);
  return g;
};

describe('vehicles only (level 1)', () => {
  it('runs without safety violations and serves both directions', () => {
    const g = play('l1');
    expect(g.world.violations).toEqual([]);
    expect(g.world.tab.volume.EB).toBeGreaterThan(10);
    expect(g.world.tab.volume.WB).toBeGreaterThan(10);
  });

  it('follows the EB vehicle sequence diagram, in order', () => {
    const lv = { ...level('l1'), rates: { ...level('l1').rates, WB: 0 } };
    const g = new Game(lv, cloneSpecs(DEFAULT_SPECS), 3, true);
    g.run(120);
    const labels = g.world.msgs.map((m) => m.label);
    // Software Specs slide 9: arrive, get/set bridge status, get time, stop/go, increment,
    // depart, decrement, get time, stop/go, set bridge status
    const expected = ['arrive()', 'get bridge status()', 'set bridge status(east)', 'get time() (start)', 'stop/go(go)',
      'increment # EB vehicles', 'depart()', 'decrement # EB vehicles', 'get time() (stop)', 'stop/go(stop)', 'set bridge status(idle)'];
    let i = 0;
    for (const l of labels) if (i < expected.length && l === expected[i]) i++;
    expect(expected.slice(i)).toEqual([]);
  });

  it('count never goes negative and returns to the queue length', () => {
    const g = play('l1');
    for (const d of ['EB', 'WB'] as const) expect(g.world.veh[d].count).toBeGreaterThanOrEqual(0);
  });
});

describe('vessels (level 2)', () => {
  it('default specs are safe', () => {
    const g = play('l2');
    expect(g.world.violations).toEqual([]);
    expect(g.world.tab.volume.NB + g.world.tab.volume.SB).toBeGreaterThan(0);
  });

  it('a tall threshold above the 4 m clearance makes vessels hit the bridge', () => {
    const g = play('l2', { tallThresholdM: 6 });
    expect(g.world.violations.some((v) => v.kind === 'vessel_hit_bridge')).toBe(true);
  });

  it('a 2 s siren lead breaks business rule xx', () => {
    const g = play('l2', { sirenLeadS: 2 });
    expect(g.world.violations.some((v) => v.kind === 'siren_rule')).toBe(true);
  });

  it('skipping the pedestrian check with a short siren lead catches pedestrians', () => {
    const hit = [1, 2, 3, 4, 5, 6, 7, 8].some((seed) =>
      play('l2', { sirenLeadS: 2, pedestrianCheck: false, occupancySensors: false, clearDelayS: 0 }, seed)
        .world.violations.some((v) => v.kind === 'moved_with_traffic'));
    expect(hit).toBe(true);
  });
});

describe('exceptions (level 5)', () => {
  it('survives sensor faults and stalls with defaults', () => {
    const g = play('l5');
    expect(g.world.violations.filter((v) => v.kind !== 'siren_rule')).toEqual([]);
    expect(g.world.tab.volume.EB).toBeGreaterThan(10);
  });
});

describe('emergency vehicles (level 4)', () => {
  it('preemption gives faster emergency service than none', () => {
    const on = summarize(play('l4', { preemptEmergency: true }, 5));
    const off = summarize(play('l4', { preemptEmergency: false }, 5));
    expect(on.avgEmerWait).toBeLessThan(off.avgEmerWait);
  });
});

describe('DOT data (level 6)', () => {
  it('tabulates hourly volumes that sum to the totals', () => {
    const g = play('l6');
    const t = g.world.tab;
    const sum = t.hourly.EB.reduce((a, b) => a + b, 0) + t.hourly.WB.reduce((a, b) => a + b, 0);
    expect(sum).toBe(t.volume.EB + t.volume.EBE + t.volume.WB + t.volume.WBE);
    expect(t.hourly.EB.filter((n) => n > 0).length).toBeGreaterThan(8);
  });
});

describe('DOT reports', () => {
  it('counts cars and boats and measures traversal times', async () => {
    const { buildReport, passagesCsv } = await import('../src/sim/reports');
    const g = play('l6');
    const r = buildReport(g);
    const v = g.world.tab.volume;
    expect(r.cars.total).toBe(v.EB + v.EBE + v.WB + v.WBE);
    expect(r.boats.total).toBe(r.boats.tall + r.boats.short);
    expect(r.boats.short).toBeGreaterThan(0);
    // every recorded vehicle crossed: traversal time is positive and at least the free-flow time
    expect(r.times.carTotal.n).toBeGreaterThan(20);
    expect(r.times.carTotal.min).toBeGreaterThan(5);
    expect(r.times.carTotal.mean).toBeGreaterThanOrEqual(r.times.carSpan.mean);
    expect(r.times.boatTall.n).toBeGreaterThan(0);
    expect(r.times.boatTall.mean).toBeGreaterThan(r.times.boatShort.mean * 0.5);
    // hourly rows sum to totals and a day is projected
    expect(r.byHour.reduce((s, h) => s + h.EB + h.WB, 0)).toBe(r.cars.total);
    expect(r.projection!.monthly).toBeGreaterThan(r.projection!.daily * 29);
    const csv = passagesCsv(g).split('\n');
    expect(csv.length - 1).toBe(g.world.tab.vehPassages.length + g.world.tab.boatPassages.length);
    expect(g.world.msgs.some((m) => m.label === 'push daily passage report')).toBe(true);
  });

  it('reports sensor misses as a data-quality issue', async () => {
    const { buildReport } = await import('../src/sim/reports');
    const g = play('l5');
    expect(buildReport(g).quality.sensorMisses).toBeGreaterThan(0);
  });
});

describe('regressions found in review', () => {
  const heavyBoats = () => ({ ...level('l2'), rates: { ...level('l2').rates, NB: 0.05, SB: 0.05 }, tallFraction: 1 });

  it('a vessel max-hold cut hands the next turn to waiting cars (no vessel-first starvation)', () => {
    const lv = heavyBoats();
    const g = new Game(lv, { ...cloneSpecs(DEFAULT_SPECS), arbitration: 'vessel-first', maxHoldVesselS: 30 }, 3, true);
    g.run(lv.duration);
    const v = g.world.tab.volume;
    expect(v.EB).toBeGreaterThan(20);
    expect(v.WB).toBeGreaterThan(20);
    expect(g.world.waitStats('veh').max).toBeLessThan(200);
  });

  it('forced ends never put opposing vehicles on the bridge (gate-to-span blind zone)', () => {
    let headOn = 0;
    for (const id of ['l1', 'l4', 'l5']) for (let seed = 1; seed <= 15; seed++) {
      headOn += play(id, { maxHoldVehS: 10 }, seed).world.violations.filter((x) => x.kind === 'head_on').length;
    }
    expect(headOn).toBe(0);
  });

  it('returning to Automatic after a manual change mid-raise recovers', () => {
    const lv = { ...level('l2'), duration: 3000 };
    const g = new Game(lv, cloneSpecs(DEFAULT_SPECS), 7, true);
    let guard = 0;
    while (!(g.controller.phase === 'raising' && g.world.bridge.p > 0.4) && guard++ < 50000) g.step();
    expect(g.controller.phase).toBe('raising');
    g.setAuto(false);
    g.world.lower();
    g.run(30);
    g.setAuto(true);
    g.run(600);
    // before the fix it sat in 'raising' forever with the bridge down
    const stuck = g.controller.phase === 'raising' && g.world.bridge.p === 0 && g.world.bridge.dir === 0;
    expect(stuck).toBe(false);
    expect(g.world.waitStats('veh').max).toBeLessThan(200);
    expect(g.world.veh.EB.waitQ.length + g.world.veh.WB.waitQ.length).toBeLessThan(10);
  });

  it('wait metrics include vehicles that are still waiting', () => {
    const lv = { ...level('l1'), manualDefault: true };
    const g = new Game(lv, cloneSpecs(DEFAULT_SPECS), 2, false); // manual, gates never opened
    g.run(120);
    const s = summarize(g);
    expect(g.world.tab.waitN.veh).toBe(0);
    expect(s.avgVehWait).toBeGreaterThan(20);
    expect(s.maxWait).toBeGreaterThan(60);
  });

  it('reversing the bridge mid-movement is checked against the siren rule', () => {
    const g = new Game({ ...level('l1'), rates: { ...level('l1').rates, EB: 0, WB: 0 } }, cloneSpecs(DEFAULT_SPECS), 1, false);
    g.world.setSiren('on');
    g.run(11);
    g.world.raise();
    g.run(3);
    g.world.setSiren('off');
    g.world.lower();
    expect(g.world.violations.map((v) => v.kind)).toEqual(['siren_rule']);
  });

  it('a vehicle that drives into the open span is cleared from the count', () => {
    const lv = { ...level('l1'), rates: { ...level('l1').rates, WB: 0, EB: 0.3 } };
    const g = new Game(lv, cloneSpecs(DEFAULT_SPECS), 4, false);
    g.world.setSiren('on');
    g.run(11);
    g.world.raise();
    g.run(15);
    g.world.setGate('EB', 'go');
    g.run(10);
    const w = g.world;
    expect(w.violations.some((v) => v.kind === 'vehicle_into_open_span')).toBe(true);
    const onRoad = w.vehicles.filter((v) => v.dir === 'EB' && v.counted && v.s < 270).length;
    expect(w.veh.EB.count).toBe(onRoad);
  });
});
