import type { Dir, World } from './world';

type Phase =
  | 'idle' | 'vehServe' | 'vehEnd'
  | 'nsClear' | 'nsWarn' | 'raising' | 'vesselServe' | 'vesselEnd' | 'warnDown' | 'lowering';

/**
 * The "virtual bridge operator": Manage Bridge + Control East/West Bound Vehicles +
 * Control Vessels + the emergency flows, as a step-based state machine. All thresholds are
 * read from world.specs on every poll so students can change them live.
 * `step` is the human-readable use-case step shown in the Operator tab.
 */
export class BridgeController {
  phase: Phase = 'idle';
  step = 'Idle: waiting for an arrival event.';
  useCase = 'Manage Bridge';
  alarm = false;
  enabled = true;
  private pollAcc = 0;
  private phaseT = 0;
  private modeStart = 0;
  private dir: Dir = 'EB';
  private towOrdered = false;

  constructor(private w: World) {}

  update(dt: number) {
    if (!this.enabled) return;
    const w = this.w;
    this.pollAcc += dt;
    const interrupt = w.specs.emergencyInterrupt && w.emergencyFlag;
    if (this.pollAcc >= w.specs.pollIntervalS || interrupt) {
      this.pollAcc = 0;
      w.emergencyFlag = false;
      this.think();
    }
  }

  private go(phase: Phase, step: string, useCase?: string) {
    this.phase = phase;
    this.phaseT = this.w.t;
    this.step = step;
    if (useCase) this.useCase = useCase;
  }

  private emergencyAgainst(): boolean {
    const w = this.w;
    if (!w.specs.preemptEmergency) return false;
    const e = w.veh.EB.emerWaiting > 0, wb = w.veh.WB.emerWaiting > 0;
    if (this.phase === 'vehServe') return this.dir === 'EB' ? wb : e;
    return e || wb;
  }

  private otherDemand(): boolean {
    const w = this.w;
    const vehWait = w.veh.EB.waitQ.length + w.veh.WB.waitQ.length;
    const tall = w.vsl.NB.count + w.vsl.SB.count;
    if (this.phase === 'vehServe') {
      const opp = this.dir === 'EB' ? w.veh.WB.waitQ.length : w.veh.EB.waitQ.length;
      return opp + tall > 0;
    }
    return vehWait + w.pedsWaiting() > 0;
  }

  private think() {
    const w = this.w, sp = w.specs;
    const t = w.t;
    // exception: stalled vehicle on the span
    if (w.stalledFor() > sp.stalledTimeoutS && !this.towOrdered) {
      this.towOrdered = true; this.alarm = true; w.alarm = true;
      w.towAt = t + 12;
      w.emit('virtual bridge operator', 'DOT', 'ALARM: stalled vehicle, tow dispatched');
    }
    if (w.stalledFor() === 0) this.towOrdered = false;
    if (!w.alarm) this.alarm = false;

    switch (this.phase) {
      case 'idle': return this.arbitrate();
      case 'vehServe': {
        const m = w.veh[this.dir];
        if (m.count === 0) return this.endVehicles(true);
        const held = t - this.modeStart;
        if ((held > sp.maxHoldVehS && this.otherDemand()) || this.emergencyAgainst()) {
          w.setGate(this.dir, 'stop');
          this.go('vehEnd', this.emergencyAgainst()
            ? 'Exception flow: emergency vehicle waiting. Stop this flow and clear the span.'
            : `Exception flow: max hold (${sp.maxHoldVehS} s) reached with others waiting. Stop admitting vehicles.`);
        }
        return;
      }
      case 'vehEnd': {
        const clear = sp.occupancySensors ? w.spanVehicles() === 0 : t - this.phaseT >= sp.clearDelayS;
        if (w.veh[this.dir].count === 0 || clear) {
          if (sp.occupancySensors) {
            const m = w.veh[this.dir];
            if (m.count !== m.waitQ.length) {
              w.emit('vehicle monitor', 'vehicle monitor', `resync count ${m.count} -> ${m.waitQ.length}`);
              m.count = m.waitQ.length;
            }
          }
          this.endVehicles(false);
        }
        return;
      }
      case 'nsClear': {
        const clear = (sp.occupancySensors ? w.spanVehicles() === 0 : t - this.phaseT >= sp.clearDelayS)
          && (!sp.pedestrianCheck || w.spanPeds() === 0);
        if (clear) { w.setSiren('on'); this.go('nsWarn', `Siren on. Waiting ${sp.sirenLeadS} s before the bridge moves.`); }
        return;
      }
      case 'nsWarn': {
        if (t - this.phaseT < sp.sirenLeadS) return;
        const ok = (!sp.pedestrianCheck || w.spanPeds() === 0) && (!sp.occupancySensors || w.spanVehicles() === 0);
        if (!ok) { this.step = 'Waiting: someone is still on the span.'; return; }
        w.emit('bridge control', 'bridge', 'bridge up');
        w.raise();
        this.go('raising', 'Bridge up using Manage Bridge use case.');
        return;
      }
      case 'raising': {
        if (w.bridge.p < 1) return;
        w.setSiren('beep');
        w.setLight('NB', 'go'); w.setLight('SB', 'go');
        this.modeStart = t;
        this.go('vesselServe', 'Verify bridge position is up. NB/SB movement signal go.');
        return;
      }
      case 'vesselServe': {
        const tall = w.vsl.NB.count + w.vsl.SB.count;
        const held = t - this.modeStart;
        const forced = (held > sp.maxHoldVesselS && this.otherDemand()) || this.emergencyAgainst();
        if (tall === 0 || forced) {
          w.setLight('NB', 'stop'); w.setLight('SB', 'stop');
          this.go('vesselEnd', tall === 0
            ? 'n/s vessel count = 0. Movement signals stop. Clearing the channel.'
            : 'Exception flow: vessels held too long or emergency waiting. Signals stop.');
        }
        return;
      }
      case 'vesselEnd': {
        const clear = sp.occupancySensors ? w.vesselsInChannel() === 0 : t - this.phaseT >= sp.clearDelayS + 6;
        if (clear) { w.setSiren('on'); this.go('warnDown', 'Siren beep to on, 10 s before the bridge moves down.'); }
        return;
      }
      case 'warnDown': {
        if (t - this.phaseT < sp.sirenLeadS) return;
        w.emit('bridge control', 'bridge', 'bridge down');
        w.lower();
        this.go('lowering', 'Bridge down using Manage Bridge use case.');
        return;
      }
      case 'lowering': {
        if (w.bridge.p > 0) return;
        w.setSiren('off'); w.setCitizen('go');
        w.setStatus('idle');
        this.go('idle', 'Verify bridge position is down. Citizen movement go. Status set to idle.', 'Manage Bridge');
        return;
      }
    }
  }

  private endVehicles(normal: boolean) {
    const w = this.w;
    w.setGate(this.dir, 'stop');
    w.setStatus('idle');
    w.emit('vehicle monitor', 'real time clock', 'get time() (stop)');
    this.go('idle', normal
      ? `${this.dir === 'EB' ? 'East' : 'West'} bound vehicle count = 0. Barrier stop. Status set to idle.`
      : 'Span clear. Status set to idle.', 'Manage Bridge');
  }

  private startVehicles(dir: Dir) {
    const w = this.w;
    this.dir = dir;
    this.modeStart = w.t;
    const name = dir === 'EB' ? 'east' : 'west';
    w.emit('vehicle monitor', 'bridge control', 'get bridge status()');
    w.setStatus(name);
    w.emit('vehicle monitor', 'real time clock', 'get time() (start)');
    w.setGate(dir, 'go');
    this.go('vehServe', `Set ${name} bound movement barrier to go.`, `Control ${dir === 'EB' ? 'East' : 'West'} Bound Vehicles`);
  }

  private startNS() {
    const w = this.w;
    w.emit('vessel monitor', 'bridge control', 'get bridge status()');
    w.setStatus('ns');
    w.setGate('EB', 'stop'); w.setGate('WB', 'stop');
    w.setCitizen('stop');
    this.go('nsClear', 'Set bridge status to n/s. Vehicle barriers stop. Citizen signal stop. Clearing the span.', 'Control Vessels');
  }

  private arbitrate() {
    const w = this.w, sp = w.specs;
    const eq = w.veh.EB.waitQ, wq = w.veh.WB.waitQ;
    const tall = w.vsl.NB.count + w.vsl.SB.count;
    const tallWait = Math.min(w.vsl.NB.waitQ[0] ?? Infinity, w.vsl.SB.waitQ[0] ?? Infinity);
    if (sp.preemptEmergency) {
      const e = w.veh.EB.emerWaiting > 0, ww = w.veh.WB.emerWaiting > 0;
      if (e || ww) {
        const pick: Dir = e && ww ? (eq[0] <= wq[0] ? 'EB' : 'WB') : e ? 'EB' : 'WB';
        this.step = `Emergency vehicle arrival (${pick}). Moving ${pick} first.`;
        return this.startVehicles(pick);
      }
    }
    const opts: { k: 'EB' | 'WB' | 'NS'; wait: number; q: number }[] = [];
    if (eq.length) opts.push({ k: 'EB', wait: w.t - eq[0], q: eq.length });
    if (wq.length) opts.push({ k: 'WB', wait: w.t - wq[0], q: wq.length });
    if (tall) opts.push({ k: 'NS', wait: Number.isFinite(tallWait) ? w.t - tallWait : 0, q: tall });
    if (!opts.length) return;
    let pick = opts[0];
    for (const o of opts) {
      if (sp.arbitration === 'vessel-first' && o.k === 'NS') { pick = o; break; }
      const better = sp.arbitration === 'longest-queue' ? o.q > pick.q : o.wait > pick.wait;
      if (better) pick = o;
    }
    if (pick.k === 'NS') this.startNS(); else this.startVehicles(pick.k);
  }
}
