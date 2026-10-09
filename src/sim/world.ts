import { RNG } from './rng';
import type { Specs } from './specs';
import type { Level } from './levels';

/** Geometry. Vehicles use `s` (distance travelled in their own direction), vessels use `u`. */
export const GEO = {
  W: 400, H: 300,
  spawnS: -10, arrivalS: 40, gateS: 140, spanA: 170, spanB: 230, departS: 270, endS: 420,
  vSpawn: -20, vArrive: 40, vLight: 100, vCross: 150, vDepart: 220, vEnd: 330,
  pedA: 140, pedB: 260, curbA: 164, curbB: 236,
  roadY: 150, laneNB: 210, laneSB: 190,
};
export const RULE_SIREN_LEAD = 10;
export const BRIDGE_CLEARANCE_M = 4;
const CAR_LEN = 8;
const GAP = 3;

export type Dir = 'EB' | 'WB';
export type VDir = 'NB' | 'SB';
export type Go = 'go' | 'stop';
export type Siren = 'off' | 'on' | 'beep';
export type Status = 'idle' | 'east' | 'west' | 'ns';

export interface Vehicle {
  id: number; dir: Dir; emergency: boolean; s: number; v: number; len: number;
  arrivedT: number; enteredT: number; counted: boolean; entered: boolean;
  willStall: boolean; stalledLeft: number; stallStart: number; missDeparture: boolean;
}
export interface Vessel {
  id: number; dir: VDir; u: number; v: number; len: number; heightM: number;
  tall: boolean; counted: boolean; crossed: boolean; arrivedT: number; passedT: number;
}
export interface Ped { id: number; dir: 1 | -1; x: number; arrivedT: number; waitedS: number; crossing: boolean }

export type ViolationKind =
  | 'moved_with_traffic' | 'siren_rule' | 'vehicle_into_open_span'
  | 'vessel_hit_bridge' | 'head_on';
export interface Violation { t: number; kind: ViolationKind; detail: string }

export const VIOLATION_INFO: Record<ViolationKind, { title: string; concept: string }> = {
  moved_with_traffic: { title: 'Bridge moved with people or vehicles on the span', concept: 'Legal risk: liability for pedestrian and bicyclist injury. Verify the span is clear before moving.' },
  siren_rule: { title: 'Siren rule broken', concept: 'Business rules xx and yy (timing diagram): the siren must be on 10 s before the bridge moves.' },
  vehicle_into_open_span: { title: 'Vehicle drove into an open span', concept: 'Barriers may only be set to go when the bridge position is down. Verify bridge position.' },
  vessel_hit_bridge: { title: 'Vessel hit the bridge', concept: 'Legal risk: liability for tall vessel damage. "Tall" is a requirement (slide 46).' },
  head_on: { title: 'Opposing vehicles met on the one-lane bridge', concept: 'One-lane bridge: only one direction may hold the bridge at a time (bridge status).' },
};

export interface Message { t: number; from: string; to: string; label: string }

/** One row of the conceptual data model's VEHICLE PASSAGE / EMERGENCYVEHICLE PASSAGE. */
export interface VehPassage { id: number; dir: Dir; emergency: boolean; arrivedT: number; enteredT: number; departedT: number; arrHour: number }
/** One row of VESSEL PASSAGE (also logs short boats, flagged tall=false). */
export interface BoatPassage { id: number; dir: VDir; heightM: number; tall: boolean; arrivedT: number; passedT: number; departedT: number; arrHour: number }

/** PassageDataTabulator from the class diagram. */
export class Tabulator {
  volume: Record<string, number> = { EB: 0, WB: 0, EBE: 0, WBE: 0, NB: 0, SB: 0, PED: 0 };
  hourly: Record<string, number[]> = {
    EB: Array(24).fill(0), WB: Array(24).fill(0), NB: Array(24).fill(0), SB: Array(24).fill(0),
  };
  tripSum: Record<string, number> = { EB: 0, WB: 0, NB: 0, SB: 0 };
  tripN: Record<string, number> = { EB: 0, WB: 0, NB: 0, SB: 0 };
  waitSum: Record<string, number> = { veh: 0, vessel: 0, emer: 0, ped: 0 };
  waitN: Record<string, number> = { veh: 0, vessel: 0, emer: 0, ped: 0 };
  waitMax = 0;
  ebGoS = 0; wbGoS = 0; bridgeUpS = 0;
  turnedAway = 0;
  vehPassages: VehPassage[] = [];
  boatPassages: BoatPassage[] = [];
  hourlyEmer: number[] = Array(24).fill(0);
  hourlyShort: number[] = Array(24).fill(0);
  shortBoats = 0;
  sensorMisses = 0; towed = 0; stalls = 0; raiseCycles = 0;
  addWait(kind: 'veh' | 'vessel' | 'emer' | 'ped', w: number) {
    this.waitSum[kind] += w; this.waitN[kind]++;
    if (w > this.waitMax) this.waitMax = w;
  }
  avgWait(kind: 'veh' | 'vessel' | 'emer' | 'ped'): number {
    return this.waitN[kind] ? this.waitSum[kind] / this.waitN[kind] : 0;
  }
  avgTrip(k: string): number { return this.tripN[k] ? this.tripSum[k] / this.tripN[k] : 0; }
}

interface Monitor { count: number; waitQ: number[]; emerWaiting: number }

export class World {
  t = 0;
  rng: RNG;
  vehicles: Vehicle[] = [];
  vessels: Vessel[] = [];
  peds: Ped[] = [];
  private nextId = 1;

  gates: Record<Dir, Go> = { EB: 'stop', WB: 'stop' };
  lights: Record<VDir, Go> = { NB: 'stop', SB: 'stop' };
  siren: Siren = 'off';
  sirenSince = 0;
  citizen: Go = 'go';
  bridge = { p: 0, dir: 0 as -1 | 0 | 1, status: 'idle' as Status };

  veh: Record<Dir, Monitor> = {
    EB: { count: 0, waitQ: [], emerWaiting: 0 }, WB: { count: 0, waitQ: [], emerWaiting: 0 },
  };
  vsl: Record<VDir, Monitor> = {
    NB: { count: 0, waitQ: [], emerWaiting: 0 }, SB: { count: 0, waitQ: [], emerWaiting: 0 },
  };
  emergencyFlag = false;
  alarm = false;
  towAt = -1;

  tab = new Tabulator();
  violations: Violation[] = [];
  msgs: Message[] = [];
  history: { t: number; siren: Siren; p: number }[] = [];
  flash: Record<string, number> = {};
  private seen = new Set<string>();
  private headOn = false;
  private lastHist = -1;

  constructor(public level: Level, public specs: Specs, seed = 1) {
    this.rng = new RNG(seed);
  }

  // ---------- helpers ----------
  emit(from: string, to: string, label: string) {
    this.msgs.push({ t: this.t, from, to, label });
    if (this.msgs.length > 400) this.msgs.splice(0, 100);
  }
  private violate(kind: ViolationKind, detail: string, key?: string) {
    const k = key ?? `${kind}${this.t.toFixed(1)}${detail}`;
    if (this.seen.has(k)) return;
    this.seen.add(k);
    this.violations.push({ t: this.t, kind, detail });
  }
  hourOfDay(): number {
    return (this.level.startHour + (this.t * this.level.compression) / 3600) % 24;
  }
  /** Simulated hour of day at an earlier sim time. */
  hourAt(t: number): number {
    return (this.level.startHour + (t * this.level.compression) / 3600) % 24;
  }
  private profile(kind: 'veh' | 'vessel' | 'ped'): number {
    if (!this.level.useProfile) return 1;
    const h = this.hourOfDay();
    const g = (c: number, w: number) => Math.exp(-Math.pow((h - c) / w, 2));
    if (kind === 'veh') return 0.25 + 1.6 * g(8, 1.6) + 1.6 * g(17, 1.8) + 0.5 * g(12.5, 3);
    if (kind === 'vessel') return 0.2 + 1.8 * g(13, 3.5);
    return 0.2 + 1.2 * g(12.5, 4);
  }
  vehicleLen(v: Vehicle) { return v.len; }

  // ---------- sensors read by the controller ----------
  spanVehicles(dir?: Dir): number {
    return this.vehicles.filter((v) => (!dir || v.dir === dir) && v.s > GEO.spanA && v.s - v.len < GEO.spanB).length;
  }
  spanPeds(): number {
    return this.peds.filter((p) => p.x > GEO.spanA && p.x < GEO.spanB).length;
  }
  vesselsInChannel(): number {
    return this.vessels.filter((v) => v.tall && v.u > GEO.vLight && v.u < GEO.vDepart).length;
  }
  stalledFor(): number {
    const s = this.vehicles.find((v) => v.stalledLeft > 0);
    return s ? this.t - s.stallStart : 0;
  }
  pedsWaiting(): number {
    return this.peds.filter((p) => !p.crossing).length;
  }
  bridgePosition(): 'down' | 'moving up' | 'up' | 'moving down' {
    if (this.bridge.p <= 0 && this.bridge.dir === 0) return 'down';
    if (this.bridge.p >= 1 && this.bridge.dir === 0) return 'up';
    return this.bridge.dir >= 0 ? 'moving up' : 'moving down';
  }

  // ---------- actuators (controller or player) ----------
  setGate(d: Dir, s: Go) {
    if (this.gates[d] === s) return;
    this.gates[d] = s;
    this.emit('vehicle monitor', 'vehicle flow control', `stop/go(${s})`);
  }
  setLight(d: VDir, s: Go) {
    if (this.lights[d] === s) return;
    this.lights[d] = s;
    this.emit('vessel monitor', 'vessel flow control', `stop/go(${s}) ${d} light`);
  }
  setSiren(s: Siren) {
    if (this.siren === s) return;
    this.siren = s; this.sirenSince = this.t;
    this.emit('bridge control', 'pedestrian flow control', `siren(${s})`);
  }
  setCitizen(s: Go) {
    if (this.citizen === s) return;
    this.citizen = s;
    this.emit('bridge control', 'pedestrian flow control', `citizen movement(${s})`);
  }
  setStatus(s: Status) {
    if (this.bridge.status === s) return;
    this.emit('vehicle monitor', 'bridge control', `set bridge status(${s})`);
    this.bridge.status = s;
  }
  raise() { this.startMove(1); }
  lower() { this.startMove(-1); }
  private startMove(d: 1 | -1) {
    if ((d === 1 && (this.bridge.p >= 1 || this.bridge.dir === 1)) || (d === -1 && (this.bridge.p <= 0 || this.bridge.dir === -1))) return;
    if (this.bridge.dir !== 0) { this.bridge.dir = d; return; }
    const lead = this.t - this.sirenSince;
    if (this.siren !== 'on' || lead < RULE_SIREN_LEAD - 0.05) {
      this.violate('siren_rule', `Bridge started moving with siren "${this.siren}" for only ${lead.toFixed(0)} s (rule: "on" for ${RULE_SIREN_LEAD} s)`);
    }
    const onSpanV = this.vehicles.filter((v) => v.s > GEO.spanA && v.s - v.len < GEO.spanB);
    const onSpanP = this.peds.filter((p) => p.x > GEO.spanA && p.x < GEO.spanB);
    if (onSpanV.length || onSpanP.length) {
      this.violate('moved_with_traffic', `${onSpanP.length} pedestrian(s) and ${onSpanV.length} vehicle(s) on the span when it moved`);
      this.vehicles = this.vehicles.filter((v) => !onSpanV.includes(v));
      this.peds = this.peds.filter((p) => !onSpanP.includes(p));
    }
    this.bridge.dir = d;
    this.emit('bridge control', 'bridge', d === 1 ? 'raise()' : 'lower()');
  }
  /** Tow a stalled vehicle (operator dispatch). */
  tow() {
    const v = this.vehicles.find((x) => x.stalledLeft > 0);
    if (!v) return;
    this.vehicles = this.vehicles.filter((x) => x !== v);
    if (!v.missDeparture && v.counted) this.veh[v.dir].count = Math.max(0, this.veh[v.dir].count - 1);
    this.tab.towed++;
    this.emit('virtual bridge operator', 'tow truck', 'vehicle removed from span');
    this.alarm = false;
  }

  // ---------- simulation ----------
  step(dt: number) {
    this.t += dt;
    this.spawn(dt);
    this.updateBridge(dt);
    this.updateVehicles(dt);
    this.updateVessels(dt);
    this.updatePeds(dt);
    this.checkHeadOn();
    if (this.towAt >= 0 && this.t >= this.towAt) { this.towAt = -1; this.tow(); }
    if (this.gates.EB === 'go') this.tab.ebGoS += dt;
    if (this.gates.WB === 'go') this.tab.wbGoS += dt;
    if (this.bridge.p > 0) this.tab.bridgeUpS += dt;
    if (this.t - this.lastHist >= 0.5) {
      this.lastHist = this.t;
      this.history.push({ t: this.t, siren: this.siren, p: this.bridge.p });
      if (this.history.length > 900) this.history.splice(0, 100);
    }
  }

  private spawn(dt: number) {
    const L = this.level, r = L.rates;
    const pv = this.profile('veh'), pb = this.profile('vessel'), pp = this.profile('ped');
    const roll = (rate: number) => this.rng.chance(1 - Math.exp(-rate * dt));
    if (roll(r.EB * pv)) this.spawnVehicle('EB', false);
    if (roll(r.WB * pv)) this.spawnVehicle('WB', false);
    if (roll(r.EBE * pv)) this.spawnVehicle('EB', true);
    if (roll(r.WBE * pv)) this.spawnVehicle('WB', true);
    if (roll(r.NB * pb)) this.spawnVessel('NB');
    if (roll(r.SB * pb)) this.spawnVessel('SB');
    if (roll(r.PED * pp)) {
      const dir = this.rng.chance(0.5) ? 1 : -1;
      this.peds.push({ id: this.nextId++, dir, x: dir === 1 ? GEO.pedA : GEO.pedB, arrivedT: this.t, waitedS: 0, crossing: false });
      this.tab.volume.PED++;
    }
  }

  private spawnVehicle(dir: Dir, emergency: boolean) {
    const tail = this.vehicles.filter((v) => v.dir === dir).reduce((m, v) => Math.min(m, v.s - v.len), Infinity);
    if (tail < GEO.spawnS + GAP + 2) { this.tab.turnedAway++; return; }
    const len = emergency ? CAR_LEN + 2 : CAR_LEN;
    this.vehicles.push({
      id: this.nextId++, dir, emergency, s: GEO.spawnS, v: this.specs.vehicleSpeed, len,
      arrivedT: -1, enteredT: -1, counted: false, entered: false,
      willStall: !emergency && this.rng.chance(this.level.stallProb), stalledLeft: 0, stallStart: 0,
      missDeparture: this.rng.chance(this.level.faultRate),
    });
  }

  private spawnVessel(dir: VDir) {
    const tail = this.vessels.filter((v) => v.dir === dir).reduce((m, v) => Math.min(m, v.u - v.len), Infinity);
    if (tail < GEO.vSpawn + 6) return;
    const tallPhys = this.rng.chance(this.level.tallFraction);
    // heights straddle the 4.0 m clearance so thresholds matter
    const heightM = tallPhys ? this.rng.range(4.2, 11) : this.rng.range(0.8, 3.8);
    const len = tallPhys ? 22 : 12;
    this.vessels.push({ id: this.nextId++, dir, u: GEO.vSpawn, v: tallPhys ? 14 : 18, len, heightM, tall: false, counted: false, crossed: false, arrivedT: -1, passedT: -1 });
  }

  private updateBridge(dt: number) {
    const b = this.bridge;
    if (b.dir === 0) return;
    b.p += (b.dir * dt) / this.specs.bridgeMoveS;
    if (b.p >= 1) { b.p = 1; b.dir = 0; this.tab.raiseCycles++; this.emit('bridge', 'bridge control', 'set bridge position status(up)'); }
    if (b.p <= 0) { b.p = 0; b.dir = 0; this.emit('bridge', 'bridge control', 'set bridge position status(down)'); }
  }

  private updateVehicles(dt: number) {
    for (const dir of ['EB', 'WB'] as Dir[]) {
      const list = this.vehicles.filter((v) => v.dir === dir).sort((a, b) => b.s - a.s);
      const vmax = this.specs.vehicleSpeed;
      const mid = (GEO.spanA + GEO.spanB) / 2;
      const gone: Vehicle[] = [];
      list.forEach((veh, i) => {
        const lead = list[i - 1];
        const prev = veh.s;
        if (veh.stalledLeft > 0) {
          veh.v = 0;
          veh.stalledLeft -= dt;
          return;
        }
        let limit = Infinity;
        if (lead) limit = lead.s - lead.len - GAP;
        if (this.gates[dir] === 'stop' && veh.s < GEO.gateS) limit = Math.min(limit, GEO.gateS - 0.5);
        veh.v = Math.min(vmax * (veh.emergency ? 1.3 : 1), veh.v + 60 * dt);
        let ns = veh.s + veh.v * dt;
        if (ns > limit) { ns = Math.max(veh.s, limit); veh.v = (ns - veh.s) / dt; }
        if (veh.willStall && prev < mid && ns >= mid && this.bridge.p === 0) {
          ns = mid; veh.v = 0; veh.willStall = false;
          veh.stalledLeft = this.rng.range(50, 90); veh.stallStart = this.t; this.tab.stalls++;
          this.emit(`${dir} vehicle`, 'vehicle monitor', 'STALLED on span');
        }
        if (prev < GEO.spanA && ns >= GEO.spanA && this.bridge.p > 0.001) {
          this.violate('vehicle_into_open_span', `${dir} vehicle drove into the open span (bridge ${this.bridgePosition()})`);
          gone.push(veh);
          return;
        }
        veh.s = ns;
        const m = this.veh[dir];
        if (veh.arrivedT < 0 && prev < GEO.arrivalS && ns >= GEO.arrivalS) {
          veh.arrivedT = this.t; veh.counted = true;
          m.count++; m.waitQ.push(this.t);
          if (veh.emergency) { m.emerWaiting++; this.emergencyFlag = true; }
          this.tab.volume[veh.emergency ? dir + 'E' : dir]++;
          this.tab.hourly[dir][Math.floor(this.hourOfDay())]++;
          if (veh.emergency) this.tab.hourlyEmer[Math.floor(this.hourOfDay())]++;
          this.flash[dir + 'arr'] = this.t;
          this.emit(`${dir} vehicle`, 'vehicle monitor', 'arrive()');
        }
        if (!veh.entered && prev < GEO.gateS && ns >= GEO.gateS && veh.counted) {
          veh.entered = true; veh.enteredT = this.t;
          const w = this.t - (m.waitQ.shift() ?? this.t);
          this.tab.addWait(veh.emergency ? 'emer' : 'veh', w);
          if (veh.emergency) m.emerWaiting = Math.max(0, m.emerWaiting - 1);
          this.flash[dir + 'ent'] = this.t;
        }
        if (prev < GEO.departS && ns >= GEO.departS && veh.counted) {
          if (!veh.missDeparture) {
            m.count = Math.max(0, m.count - 1);
            this.tab.tripSum[dir] += this.t - veh.arrivedT; this.tab.tripN[dir]++;
            this.tab.vehPassages.push({ id: veh.id, dir, emergency: veh.emergency, arrivedT: veh.arrivedT, enteredT: veh.enteredT, departedT: this.t, arrHour: this.hourAt(veh.arrivedT) });
            this.flash[dir + 'dep'] = this.t;
            this.emit(`${dir} vehicle`, 'vehicle monitor', 'depart()');
          } else {
            this.tab.sensorMisses++;
            this.flash[dir + 'miss'] = this.t;
            this.emit(`${dir} vehicle`, 'vehicle monitor', 'depart() MISSED by sensor');
          }
        }
        if (ns >= GEO.endS) gone.push(veh);
      });
      if (gone.length) this.vehicles = this.vehicles.filter((v) => !gone.includes(v));
    }
  }

  private updateVessels(dt: number) {
    const gone: Vessel[] = [];
    for (const dir of ['NB', 'SB'] as VDir[]) {
      const list = this.vessels.filter((v) => v.dir === dir).sort((a, b) => b.u - a.u);
      const m = this.vsl[dir];
      list.forEach((v, i) => {
        const lead = list[i - 1];
        const prev = v.u;
        let limit = Infinity;
        if (lead) limit = lead.u - lead.len - 4;
        if (v.tall && this.lights[dir] === 'stop' && v.u < GEO.vLight) limit = Math.min(limit, GEO.vLight - 0.5);
        const cruise = v.heightM >= 4 ? 14 : 18;
        v.v = Math.min(cruise, v.v + 20 * dt);
        let nu = v.u + v.v * dt;
        if (nu > limit) { nu = Math.max(v.u, limit); v.v = (nu - v.u) / dt; }
        v.u = nu;
        if (v.arrivedT < 0 && prev < GEO.vArrive && nu >= GEO.vArrive) {
          v.arrivedT = this.t;
          v.tall = v.heightM > this.specs.tallThresholdM;
          this.flash[dir + 'varr'] = this.t;
          if (!v.tall) { this.tab.shortBoats++; this.tab.hourlyShort[Math.floor(this.hourOfDay())]++; }
          if (v.tall) {
            v.counted = true; m.count++; m.waitQ.push(this.t);
            this.tab.volume[dir]++;
            this.tab.hourly[dir][Math.floor(this.hourOfDay())]++;
            this.emit(`${dir} vessel`, 'vessel monitor', `arrive() h=${v.heightM.toFixed(1)}m`);
          }
        }
        if (v.passedT < 0 && prev < GEO.vLight && nu >= GEO.vLight) {
          v.passedT = this.t;
          if (v.counted) this.tab.addWait('vessel', this.t - (m.waitQ.shift() ?? this.t));
        }
        if (!v.crossed && prev < GEO.vCross && nu >= GEO.vCross) {
          v.crossed = true;
          const clearance = BRIDGE_CLEARANCE_M + this.bridge.p * 30;
          if (v.heightM >= clearance) {
            this.violate('vessel_hit_bridge', `${v.heightM.toFixed(1)} m vessel hit the bridge (clearance ${clearance.toFixed(1)} m, threshold set to ${this.specs.tallThresholdM} m)`);
            gone.push(v);
            if (v.counted) m.count = Math.max(0, m.count - 1);
            return;
          }
        }
        if (prev < GEO.vDepart && nu >= GEO.vDepart) {
          if (v.counted) {
            m.count = Math.max(0, m.count - 1);
            this.flash[dir + 'vdep'] = this.t;
            this.emit(`${dir} vessel`, 'vessel monitor', 'depart()');
          }
          this.tab.boatPassages.push({ id: v.id, dir, heightM: v.heightM, tall: v.tall, arrivedT: v.arrivedT, passedT: v.passedT, departedT: this.t, arrHour: this.hourAt(v.arrivedT) });
        }
        if (nu >= GEO.vEnd) gone.push(v);
      });
    }
    if (gone.length) this.vessels = this.vessels.filter((v) => !gone.includes(v));
  }

  private updatePeds(dt: number) {
    const speed = 6;
    const allowed = this.citizen === 'go' && this.siren === 'off' && this.bridge.p === 0 && this.bridge.dir === 0;
    const gone: Ped[] = [];
    for (const p of this.peds) {
      const curb = p.dir === 1 ? GEO.curbA : GEO.curbB;
      let nx = p.x + p.dir * speed * dt;
      const atCurb = p.dir === 1 ? nx >= curb && p.x < GEO.spanA : nx <= curb && p.x > GEO.spanB;
      if (!p.crossing && atCurb) {
        if (!allowed) { nx = curb; p.waitedS += dt; } else { p.crossing = true; this.tab.addWait('ped', p.waitedS); }
      }
      p.x = nx;
      if ((p.dir === 1 && p.x >= GEO.pedB) || (p.dir === -1 && p.x <= GEO.pedA)) gone.push(p);
    }
    if (gone.length) this.peds = this.peds.filter((p) => !gone.includes(p));
  }

  private checkHeadOn() {
    const eb = this.vehicles.some((v) => v.dir === 'EB' && v.s > GEO.spanA && v.s - v.len < GEO.spanB);
    const wb = this.vehicles.some((v) => v.dir === 'WB' && v.s > GEO.spanA && v.s - v.len < GEO.spanB);
    if (eb && wb && !this.headOn) this.violate('head_on', 'East- and west-bound vehicles were on the span together');
    this.headOn = eb && wb;
  }
}
