/**
 * Every tunable requirement lives here. The game reads these live, so a student can
 * change a spec in the Spec Lab and immediately see the consequence.
 * `source` points back to the course decks; `gap` marks something the decks left open
 * (Business Requirements 4.1 "Omitted or Vague Functional Requirements") for which the
 * game supplies a sensible default.
 */
export interface Specs {
  sirenLeadS: number;
  bridgeMoveS: number;
  tallThresholdM: number;
  pollIntervalS: number;
  emergencyInterrupt: boolean;
  preemptEmergency: boolean;
  arbitration: 'vessel-first' | 'longest-wait' | 'longest-queue';
  maxHoldVehS: number;
  maxHoldVesselS: number;
  occupancySensors: boolean;
  pedestrianCheck: boolean;
  clearDelayS: number;
  stalledTimeoutS: number;
  vehicleSpeed: number;
}

export type SpecKey = keyof Specs;

export interface SpecDef {
  key: SpecKey;
  label: string;
  group: string;
  kind: 'number' | 'bool' | 'select';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  source: string;
  gap: boolean;
  help: string;
}

export const DEFAULT_SPECS: Specs = {
  sirenLeadS: 10,
  bridgeMoveS: 12,
  tallThresholdM: 3.5,
  pollIntervalS: 1,
  emergencyInterrupt: true,
  preemptEmergency: true,
  arbitration: 'vessel-first',
  maxHoldVehS: 45,
  maxHoldVesselS: 60,
  occupancySensors: true,
  pedestrianCheck: true,
  clearDelayS: 12,
  stalledTimeoutS: 20,
  vehicleSpeed: 30,
};

export const SPEC_DEFS: SpecDef[] = [
  {
    key: 'sirenLeadS', label: 'Pedestrian siren lead time', group: 'Safety rules', kind: 'number',
    min: 0, max: 30, step: 1, unit: 's', source: 'Software Specs slide 10 (business rules xx, yy)', gap: false,
    help: 'The siren must be ON this many seconds before the bridge moves. The business rule says 10 s. Pedestrians need about 10 s to clear the span. Try 2 s and watch what happens.',
  },
  {
    key: 'pedestrianCheck', label: 'Verify span is free of pedestrians before moving', group: 'Safety rules', kind: 'bool',
    source: 'Business Req. slide 7 (risk: pedestrians and bicyclists)', gap: true,
    help: 'The decks never say the controller must confirm no pedestrian is on the span. Default: it must.',
  },
  {
    key: 'occupancySensors', label: 'Span / channel occupancy sensors installed', group: 'Safety rules', kind: 'bool',
    source: 'Not in the decks (arrival and departure sensors only)', gap: true,
    help: 'With them the controller knows the span is truly empty and can resynchronise a wrong vehicle count. Without them it can only guess using a fixed delay.',
  },
  {
    key: 'clearDelayS', label: 'Fallback "assume clear" delay', group: 'Safety rules', kind: 'number',
    min: 0, max: 40, step: 1, unit: 's', source: 'Gap: used only without occupancy sensors', gap: true,
    help: 'How long the controller waits before assuming the span is empty when it has no occupancy sensor.',
  },
  {
    key: 'tallThresholdM', label: '"Tall" vessel threshold', group: 'Vessels', kind: 'number',
    min: 1, max: 8, step: 0.1, unit: 'm', source: 'Business Req. slide 46 ("what is tall?")', gap: true,
    help: 'Vessels taller than this make the bridge raise. The closed bridge clears 4.0 m. Set it too high and a ship hits the bridge (liability risk). Set it too low and the bridge raises for boats that fit.',
  },
  {
    key: 'maxHoldVesselS', label: 'Max vessel hold when road traffic waits', group: 'Vessels', kind: 'number',
    min: 10, max: 600, step: 5, unit: 's', source: 'Business Req. slide 54 (constraint) and slide 46', gap: true,
    help: 'Longest the bridge stays up for vessels while vehicles are waiting. Maritime law gives vessels priority, but the road cannot wait forever.',
  },
  {
    key: 'bridgeMoveS', label: 'Time to raise or lower the bridge', group: 'Bridge hardware', kind: 'number',
    min: 4, max: 40, step: 1, unit: 's', source: 'Business Req. slide 54 (speed of raising and lowering)', gap: false,
    help: 'Slower motors (cheaper) lengthen every vessel cycle. Faster motors cost more. This is the "bridge motor upgrade" cost line.',
  },
  {
    key: 'vehicleSpeed', label: 'Vehicle speed limit', group: 'Bridge hardware', kind: 'number',
    min: 10, max: 60, step: 1, unit: 'u/s', source: 'Business Req. slide 3 (photo radar, speed laws)', gap: true,
    help: 'Faster traffic clears the span sooner. The units are game units per second, not mph.',
  },
  {
    key: 'arbitration', label: 'Who gets the bridge next (arbitration)', group: 'Controller logic', kind: 'select',
    options: [
      { value: 'vessel-first', label: 'Vessels first, then longest wait' },
      { value: 'longest-wait', label: 'Longest wait first (fair)' },
      { value: 'longest-queue', label: 'Longest queue first (throughput)' },
    ],
    source: 'Software Specs slides 27-28 (Manage Bridge); Business Req. slide 7', gap: true,
    help: 'The decks say vessels have maritime priority but not how to choose among competing vehicle directions.',
  },
  {
    key: 'maxHoldVehS', label: 'Max vehicle hold when others wait', group: 'Controller logic', kind: 'number',
    min: 10, max: 600, step: 5, unit: 's', source: 'Slides 7, 22, 25: "what if the count never reaches 0?"', gap: true,
    help: 'The decks only release the bridge when the vehicle count hits 0, so steady traffic starves the other side. After this long, the controller stops admitting vehicles. Try 600 s.',
  },
  {
    key: 'pollIntervalS', label: 'Polling interval', group: 'Controller logic', kind: 'number',
    min: 0.1, max: 15, step: 0.1, unit: 's', source: 'Business Req. slide 46 (clock requirement for polling)', gap: true,
    help: 'How often the controller reads bridge status and sensors. Slow polling saves cost but adds reaction lag.',
  },
  {
    key: 'emergencyInterrupt', label: 'Emergency arrival interrupts polling', group: 'Controller logic', kind: 'bool',
    source: 'Business Req. slide 46 (polling vs. interrupt)', gap: true,
    help: 'If on, an emergency vehicle arrival is handled immediately, not at the next poll.',
  },
  {
    key: 'preemptEmergency', label: 'Emergency vehicles preempt other traffic', group: 'Controller logic', kind: 'bool',
    source: 'Software Specs slides 34-45 (emergency state diagram)', gap: false,
    help: 'If off, ambulances queue like everyone else. Check the emergency response time in the debrief.',
  },
  {
    key: 'stalledTimeoutS', label: 'Stalled vehicle: alarm and tow after', group: 'Exceptions', kind: 'number',
    min: 5, max: 300, step: 5, unit: 's', source: 'Business Req. slide 46 (vehicle stops on the bridge)', gap: true,
    help: 'A vehicle that stops on the span blocks the lane. After this long the system raises an alarm and dispatches a tow.',
  },
];

export function cloneSpecs(s: Specs): Specs {
  return { ...s };
}

/** Names of specs that differ from the defaults, for debrief and sharing. */
export function changedSpecs(s: Specs): SpecKey[] {
  return (Object.keys(DEFAULT_SPECS) as SpecKey[]).filter((k) => s[k] !== DEFAULT_SPECS[k]);
}
