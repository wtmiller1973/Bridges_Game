import type { Game } from './game';

/**
 * The reports the State DOT asked for (Business Requirements 1.1 and 4.3): how many vehicles and
 * vessels used the bridge, how long passages took, usage by hour of day, and utilisation.
 * Durations are real seconds of simulation; only the clock/arrival profile is time-compressed.
 */
export interface Stat { n: number; min: number; median: number; mean: number; p90: number; max: number }

export function stat(xs: number[]): Stat {
  if (!xs.length) return { n: 0, min: 0, median: 0, mean: 0, p90: 0, max: 0 };
  const a = [...xs].sort((x, y) => x - y);
  const q = (p: number) => a[Math.min(a.length - 1, Math.floor(p * (a.length - 1) + 0.5))];
  return { n: a.length, min: a[0], median: q(0.5), mean: a.reduce((s, x) => s + x, 0) / a.length, p90: q(0.9), max: a[a.length - 1] };
}

export interface HourRow { hour: number; EB: number; WB: number; emer: number; NB: number; SB: number; short: number; carTransit: number; boatTransit: number }

export interface DotReport {
  header: { bridgeId: string; location: string; periodStart: string; periodEnd: string; periodDays: number; cycle: string; generated: string };
  cars: { EB: number; WB: number; total: number; emergency: number };
  boats: { NB: number; SB: number; tall: number; short: number; total: number };
  pedestrians: number;
  times: {
    carTotal: Stat; carEB: Stat; carWB: Stat; carWait: Stat; carSpan: Stat; emergency: Stat;
    boatTall: Stat; boatTallWait: Stat; boatShort: Stat;
  };
  byHour: HourRow[];
  util: { ebOpenPct: number; wbOpenPct: number; raisedPct: number; raiseCycles: number; raisedMin: number };
  quality: { sensorMisses: number; stalls: number; towed: number; violations: number; turnedAway: number };
  projection: { daily: number; weekly: number; monthly: number; boatsDaily: number; boatsWeekly: number; boatsMonthly: number } | null;
}

export function clockText(g: Game, t: number): string {
  const h = g.level.startHour + (t * g.level.compression) / 3600;
  const day = Math.floor(h / 24) + 1, hh = Math.floor(h % 24), mm = Math.floor((h % 1) * 60);
  return `Day ${day} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function buildReport(g: Game): DotReport {
  const w = g.world, tab = w.tab, t = w.t;
  const vp = tab.vehPassages, bp = tab.boatPassages;
  const carTransit = (d?: string) => vp.filter((p) => !d || p.dir === d).map((p) => p.departedT - p.arrivedT);
  const tallB = bp.filter((p) => p.tall), shortB = bp.filter((p) => !p.tall);
  const byHour: HourRow[] = [];
  for (let h = 0; h < 24; h++) {
    const cv = vp.filter((p) => Math.floor(p.arrHour) === h).map((p) => p.departedT - p.arrivedT);
    const bv = tallB.filter((p) => Math.floor(p.arrHour) === h).map((p) => p.departedT - p.arrivedT);
    byHour.push({
      hour: h, EB: tab.hourly.EB[h], WB: tab.hourly.WB[h], emer: tab.hourlyEmer[h], NB: tab.hourly.NB[h], SB: tab.hourly.SB[h],
      short: tab.hourlyShort[h], carTransit: stat(cv).mean, boatTransit: stat(bv).mean,
    });
  }
  const periodDays = (t * g.level.compression) / 86400;
  const ebAll = tab.volume.EB + tab.volume.EBE, wbAll = tab.volume.WB + tab.volume.WBE;
  const cars = ebAll + wbAll;
  const boats = tab.volume.NB + tab.volume.SB + tab.shortBoats;
  const el = Math.max(1, t);
  return {
    header: {
      bridgeId: 'Bridge 07', location: 'Coastal Route 12, Mainland to Seabright Island',
      periodStart: clockText(g, 0), periodEnd: clockText(g, t), periodDays,
      cycle: periodDays >= 0.9 ? 'Daily' : 'Training run', generated: `sim time ${Math.round(t)} s`,
    },
    cars: { EB: ebAll, WB: wbAll, total: cars, emergency: tab.volume.EBE + tab.volume.WBE },
    boats: { NB: tab.volume.NB, SB: tab.volume.SB, tall: tab.volume.NB + tab.volume.SB, short: tab.shortBoats, total: boats },
    pedestrians: tab.volume.PED,
    times: {
      carTotal: stat(carTransit()), carEB: stat(carTransit('EB')), carWB: stat(carTransit('WB')),
      carWait: stat(vp.map((p) => p.enteredT - p.arrivedT)), carSpan: stat(vp.map((p) => p.departedT - p.enteredT)),
      emergency: stat(vp.filter((p) => p.emergency).map((p) => p.departedT - p.arrivedT)),
      boatTall: stat(tallB.map((p) => p.departedT - p.arrivedT)), boatTallWait: stat(tallB.map((p) => p.passedT - p.arrivedT)),
      boatShort: stat(shortB.map((p) => p.departedT - p.arrivedT)),
    },
    byHour,
    util: {
      ebOpenPct: (tab.ebGoS / el) * 100, wbOpenPct: (tab.wbGoS / el) * 100, raisedPct: (tab.bridgeUpS / el) * 100,
      raiseCycles: tab.raiseCycles, raisedMin: tab.bridgeUpS / 60,
    },
    quality: { sensorMisses: tab.sensorMisses, stalls: tab.stalls, towed: tab.towed, violations: w.violations.length, turnedAway: tab.turnedAway },
    projection: periodDays >= 0.5
      ? { daily: cars / periodDays, weekly: (7 * cars) / periodDays, monthly: (30 * cars) / periodDays, boatsDaily: boats / periodDays, boatsWeekly: (7 * boats) / periodDays, boatsMonthly: (30 * boats) / periodDays }
      : null,
  };
}

/** The raw passage log as CSV: the "push" data file DOT would load into its data center. */
export function passagesCsv(g: Game): string {
  const w = g.world, rows = ['kind,id,direction,emergency,height_m,arrived,entered_or_passed,departed,wait_s,span_s,total_s'];
  const f = (n: number) => n.toFixed(1);
  for (const p of w.tab.vehPassages) {
    rows.push(['vehicle', p.id, p.dir, p.emergency ? 'yes' : 'no', '', clockText(g, p.arrivedT), clockText(g, p.enteredT), clockText(g, p.departedT), f(p.enteredT - p.arrivedT), f(p.departedT - p.enteredT), f(p.departedT - p.arrivedT)].join(','));
  }
  for (const p of w.tab.boatPassages) {
    rows.push([p.tall ? 'vessel' : 'short_boat', p.id, p.dir, 'no', p.heightM.toFixed(1), clockText(g, p.arrivedT), clockText(g, p.passedT), clockText(g, p.departedT), f(p.passedT - p.arrivedT), f(p.departedT - p.passedT), f(p.departedT - p.arrivedT)].join(','));
  }
  return rows.join('\n');
}
