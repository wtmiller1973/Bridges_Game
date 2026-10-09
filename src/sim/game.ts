import { BridgeController } from './controller';
import type { Level } from './levels';
import type { Specs } from './specs';
import { World } from './world';

export const DT = 0.05;

/** A world plus its controller. `specs` is shared by reference so live edits take effect. */
export class Game {
  world: World;
  controller: BridgeController;
  done = false;
  constructor(public level: Level, public specs: Specs, seed = 1, public auto = !level.manualDefault) {
    this.world = new World(level, specs, seed);
    this.controller = new BridgeController(this.world);
    this.controller.enabled = auto;
  }
  setAuto(on: boolean) {
    if (on && !this.auto) this.controller.resume();
    this.auto = on;
    this.controller.enabled = on;
  }
  step(dt = DT) {
    if (this.done) return;
    this.world.step(dt);
    this.controller.update(dt);
    if (this.world.t >= this.level.duration - 1e-6) {
      this.done = true;
      this.world.emit('Bridge System', 'DOT', 'push daily passage report');
    }
  }
  run(seconds: number) {
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n && !this.done; i++) this.step();
  }
}

export interface Summary {
  safety: number;
  avgVehWait: number;
  avgVesselWait: number;
  avgEmerWait: number;
  maxWait: number;
  throughput: number;
  score: number;
  grade: string;
}

export function summarize(g: Game): Summary {
  const w = g.world, t = w.tab;
  const safety = w.violations.length;
  const throughput = t.volume.EB + t.volume.WB + t.volume.EBE + t.volume.WBE + t.volume.NB + t.volume.SB;
  // Waits include anyone still waiting, so a starved queue lowers the score.
  const veh = w.waitStats('veh'), ves = w.waitStats('vessel'), emer = w.waitStats('emer'), ped = w.waitStats('ped');
  const avgVehWait = veh.avg, avgVesselWait = ves.avg, avgEmerWait = emer.avg;
  const maxWait = Math.max(t.waitMax, veh.max, ves.max, emer.max, ped.max);
  const score = Math.max(0, Math.round(1000 - 200 * safety - 2 * avgVehWait - 1.5 * avgVesselWait - 6 * avgEmerWait - 0.5 * maxWait - 2 * t.turnedAway));
  const grade = score >= 850 ? 'A' : score >= 700 ? 'B' : score >= 550 ? 'C' : score >= 400 ? 'D' : 'F';
  return { safety, avgVehWait, avgVesselWait, avgEmerWait, maxWait, throughput, score, grade };
}
