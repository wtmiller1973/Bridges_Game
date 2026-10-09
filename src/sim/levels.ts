export interface Rates {
  EB: number; WB: number; EBE: number; WBE: number; NB: number; SB: number; PED: number;
}

export interface Level {
  id: string;
  title: string;
  brief: string;
  goals: string[];
  tryThis: string[];
  /** Simulated seconds. */
  duration: number;
  /** Simulated clock seconds per real sim second (a value of 96 squeezes 15 min into a 24 h day). */
  compression: number;
  startHour: number;
  /** Arrivals per simulated second at profile 1. */
  rates: Rates;
  /** Multiply rates by a time-of-day profile (rush hours, midday boats). */
  useProfile: boolean;
  tallFraction: number;
  stallProb: number;
  /** Probability a departure sensor misses a vehicle (wildlife, dirt, glare). */
  faultRate: number;
  manualDefault: boolean;
  quiz: number[];
}

const none: Rates = { EB: 0, WB: 0, EBE: 0, WBE: 0, NB: 0, SB: 0, PED: 0 };

export const LEVELS: Level[] = [
  {
    id: 'l1', title: '1. One lane, two directions',
    brief: 'Cars only. One lane has to be shared by east-bound and west-bound traffic, so the controller gives the bridge to one side at a time.',
    goals: ['Bridge status states: idle / east / west', 'Arrival and departure sensors keep a vehicle count', 'The count reaching 0 hands the bridge back'],
    tryThis: ['Watch the Trace tab: it replays the EB vehicle sequence diagram.', 'In Spec Lab set the speed limit to 10 and "Max vehicle hold" to 600 s: steady traffic keeps the count above 0 and one side starves.'],
    duration: 240, compression: 1, startHour: 8, useProfile: false,
    rates: { ...none, EB: 0.15, WB: 0.15 },
    tallFraction: 0, stallProb: 0, faultRate: 0, manualDefault: false, quiz: [0, 1, 2],
  },
  {
    id: 'l2', title: '2. Tall ships have priority',
    brief: 'Boats join. Tall vessels need the bridge raised; short boats pass underneath. Raising must wait for the span to clear and for the siren.',
    goals: ['Maritime priority and arbitration', 'Timing diagram: siren 10 s before the bridge moves (rules xx, yy)', 'Defining "tall" is a requirement'],
    tryThis: ['Set "Tall vessel threshold" to 5 m and watch ships hit the bridge.', 'Set siren lead to 2 s and watch pedestrians get caught.'],
    duration: 360, compression: 1, startHour: 12, useProfile: false,
    rates: { ...none, EB: 0.08, WB: 0.08, NB: 0.012, SB: 0.012, PED: 0.025 },
    tallFraction: 0.5, stallProb: 0, faultRate: 0, manualDefault: false, quiz: [3, 4, 5],
  },
  {
    id: 'l3', title: '3. Be the operator',
    brief: 'Switch to manual. YOU run the gates, signals, siren and bridge. Feel why the state diagram exists, then flip to Automatic and compare.',
    goals: ['Why the state diagram and the siren rules exist', 'Contention between vessels, vehicles and pedestrians', 'Wait times are the benefit being sold'],
    tryThis: ['Raise the bridge only after: gates stop, span clear, siren on for 10 s.', 'Replay the same level in Automatic and compare the debrief.'],
    duration: 300, compression: 1, startHour: 12, useProfile: false,
    rates: { ...none, EB: 0.06, WB: 0.06, NB: 0.01, SB: 0.01, PED: 0.02 },
    tallFraction: 0.6, stallProb: 0, faultRate: 0, manualDefault: true, quiz: [4, 5, 6],
  },
  {
    id: 'l4', title: '4. First responders',
    brief: 'Ambulances and fire trucks arrive in either direction while the bridge is serving something else. The emergency state diagram takes over.',
    goals: ['Emergency preemption flows (use cases for EBE / WBE vehicles)', 'Exception flows: clear west bound or vessels, then move east', 'Contention limits first-responder speed (constraint)'],
    tryThis: ['Turn off "Emergency vehicles preempt" and read the emergency response time in the debrief.', 'Slow the polling to 10 s with interrupts off.'],
    duration: 420, compression: 1, startHour: 12, useProfile: false,
    rates: { ...none, EB: 0.08, WB: 0.08, EBE: 0.006, WBE: 0.006, NB: 0.01, SB: 0.01, PED: 0.02 },
    tallFraction: 0.6, stallProb: 0, faultRate: 0, manualDefault: false, quiz: [7, 8, 9],
  },
  {
    id: 'l5', title: "5. Murphy's law",
    brief: 'Wildlife blocks sensors and cars stall on the span. These are the exception flows the decks left blank: the count may never reach 0.',
    goals: ['Exception flows and unknown states (integrity risk)', 'Why a count-only design can deadlock', 'Timeouts, resynchronisation, alarms'],
    tryThis: ['Turn off occupancy sensors and watch the count drift.', 'Set "Max vehicle hold" very high: starvation again.'],
    duration: 420, compression: 1, startHour: 12, useProfile: false,
    rates: { ...none, EB: 0.08, WB: 0.08, EBE: 0.004, WBE: 0.004, NB: 0.01, SB: 0.01, PED: 0.02 },
    tallFraction: 0.6, stallProb: 0.03, faultRate: 0.04, manualDefault: false, quiz: [10, 11, 2],
  },
  {
    id: 'l6', title: '6. A day for DOT',
    brief: 'A whole day squeezed into 15 minutes with rush hours and midday boats. Read the DOT data tab: volumes by hour and time utilisation, then judge the business case.',
    goals: ['Tabulate Vehicle / Vessel Data use cases', 'Periodicity: volume by hour of day', 'Business case: operator cost vs. automation'],
    tryThis: ['Open the Business case calculator after the run.', 'Which hours would you schedule maintenance in?'],
    duration: 900, compression: 96, startHour: 0, useProfile: true,
    rates: { ...none, EB: 0.07, WB: 0.07, EBE: 0.002, WBE: 0.002, NB: 0.01, SB: 0.01, PED: 0.02 },
    tallFraction: 0.5, stallProb: 0.01, faultRate: 0.01, manualDefault: false, quiz: [12, 13, 14],
  },
];

export interface QuizQ { q: string; options: string[]; answer: number; why: string }

export const QUIZ: QuizQ[] = [
  { q: 'Why can only one direction of vehicles use the bridge at a time?', options: ['Maritime law', 'It is a one-lane bridge for bi-directional movement', 'Sensors cannot count two directions'], answer: 1, why: 'The bridge is a single lane, so the controller keeps a bridge status of east, west or idle.' },
  { q: 'In the use case, when does the east-bound barrier go back to "stop"?', options: ['After a fixed timer', 'When the east-bound vehicle count reaches 0', 'When a west-bound vehicle departs'], answer: 1, why: 'Arrival increments and departure decrements the count. At 0 the barrier stops and status returns to idle.' },
  { q: 'What happens if arrivals never stop and the count never reaches 0?', options: ['Nothing, it self-corrects', 'The other direction starves. The decks lack an exception flow here', 'The bridge raises'], answer: 1, why: 'This is an omitted exception flow. A maximum-hold timeout is a sensible requirement to add.' },
  { q: 'Business rule xx says the siren must come on ___ before the bridge goes up.', options: ['2 seconds', '10 seconds', '60 seconds'], answer: 1, why: 'Ten seconds gives pedestrians time to clear the span.' },
  { q: 'Why does the controller check the span is empty before raising?', options: ['To save energy', 'Pedestrians and vehicles on a moving span are a liability and safety risk', 'Sensors need it'], answer: 1, why: 'Legal risk: liability for pedestrian and bicyclist injury.' },
  { q: 'Who gets priority when a tall vessel and cars both wait?', options: ['Cars (more of them)', 'Vessels (maritime law)', 'Whoever arrived last'], answer: 1, why: 'Maritime law and vessel precedence is a regulatory risk the system must respect, within a max-hold limit.' },
  { q: 'What does automation mainly buy compared with a human operator?', options: ['Consistent management and 24x7 coverage at lower staffing cost', 'Faster boats', 'Fewer vehicles'], answer: 0, why: 'The business case compares 858,480 staffing hours ($15.0M a year) against build and maintenance cost.' },
  { q: 'An ambulance arrives east-bound while the bridge serves west-bound cars. What does the spec do?', options: ['Queue it behind west-bound', 'Stop west-bound, clear the span, then move east-bound', 'Raise the bridge'], answer: 1, why: 'Exception flow A: clear WB vehicles using Control West Bound Vehicles, then move EB and EBE vehicles.' },
  { q: 'If vessels are passing when an ambulance arrives, what is the exception flow?', options: ['Drop the bridge at once', 'Clear the n/s vessels and bridge down, then move east-bound', 'Ignore the ambulance'], answer: 1, why: 'Clear n/s vessels and bridge down using Control Vessels, then move.' },
  { q: 'Contention among vessels and vehicles means first responders:', options: ['Always arrive instantly', 'May be delayed by bridge cycle time (a constraint)', 'Never use the bridge'], answer: 1, why: 'The speed of raising and lowering the bridge constrains response speed.' },
  { q: 'A wildlife-blocked sensor misses a departure. The count stays at 1. What fixes it?', options: ['Nothing needed', 'Verify the span is empty (occupancy sensor) and resynchronise the count', 'Raise the bridge'], answer: 1, why: 'Integrity risk: resets associated with unmanaged or unknown states.' },
  { q: 'A car stalls on the span. The best requirement is:', options: ['Wait forever', 'Detect, alarm, dispatch a tow, hold other traffic', 'Raise the bridge anyway'], answer: 1, why: 'The decks ask "what happens when a vehicle stops on the bridge?" and give no answer, so we define one.' },
  { q: 'Which DOT data answers "when is the bridge busiest"?', options: ['Total volume', 'Volume by hour by day by month', 'Bridge cost'], answer: 1, why: 'Tabulate Vehicle Data calculates volume by hour by day by month to find periodicity.' },
  { q: 'Why would DOT want vessel and vehicle usage time, not just counts?', options: ['Counts are enough', 'Utilisation and time-of-use drive scheduling and maintenance', 'To bill boats'], answer: 1, why: 'Operational time information: EB, WB and n/s time utilisation by hour, day and month.' },
  { q: 'A "short boat" passes under the closed bridge. Is it counted as a vessel?', options: ['Yes, always', 'No. Per the assumptions, short boats are not vessels', 'Only at night'], answer: 1, why: 'Assumption: tall vessels are those needing the bridge raised. Short boats are not vessels.' },
];
