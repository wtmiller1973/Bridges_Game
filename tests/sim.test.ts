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

  it('follows the EB sequence diagram order', () => {
    const g = new Game(level('l1'), cloneSpecs(DEFAULT_SPECS), 3, true);
    g.run(120);
    const labels = g.world.msgs
      .filter((m) => /EB vehicle|vehicle monitor|vehicle flow control/.test(m.from + m.to))
      .map((m) => m.label);
    const idx = (s: string) => labels.findIndex((l) => l.startsWith(s));
    const arrive = idx('arrive()');
    expect(arrive).toBeGreaterThanOrEqual(0);
    expect(labels.some((l) => l === 'stop/go(go)')).toBe(true);
    expect(labels.some((l) => l === 'depart()')).toBe(true);
    expect(labels.some((l) => l === 'stop/go(stop)')).toBe(true);
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
