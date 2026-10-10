# The Bridges

A free, browser-based teaching game built from the CIS610 *The Bridges* case (Business Requirements v2.0 and Software Specifications v03). Students run an automated one-lane drawbridge: east and west bound cars, emergency vehicles, tall north and south bound vessels, pedestrians, and the DOT data the state wants.

No server, no accounts, no paid assets. It is a static site (TypeScript, Canvas, Vite) that deploys to GitHub Pages.

## Play and share

- Play locally: `npm install && npm run dev`
- Share: push to `main`, enable **Settings > Pages > Source: GitHub Actions**, and the included workflow publishes a public link.
- **Copy share link** in the game encodes the level and any changed specs in the URL, so a student can send an exact configuration to the instructor.

## What students do

| Piece | What it teaches |
|---|---|
| **Automatic mode** | Runs the Manage Bridge, Control East/West Bound Vehicles, Control Vessels and emergency use cases. The Operator tab shows the current use-case step and the bridge state diagram. |
| **Trace tab** | Live messages between the classes in the specs class diagram (vehicle monitor, bridge control, vehicle flow control, real time clock, passage data tabulator), matching the EB vehicle sequence diagram. |
| **Manual mode** | Students operate gates, lights, siren and bridge and feel why the state diagram and the siren rules exist. |
| **Spec Lab** | Every requirement is a live setting: siren lead time, tall-vessel threshold, polling interval, max hold, emergency preemption, occupancy sensors, and more. Items marked **GAP** are things the decks left unspecified (Business Requirements slide 46), each with a sensible default and an explanation. |
| **DOT reports** | Simulated reports the Department of Transportation asked for: cars and boats counted by direction, traversal times (min, median, mean, 90th percentile, max; wait vs. span), volume by hour of day, bridge utilisation, data quality, and a raw passage log. Request the full report as a printable page, or download the passage log as CSV. A "push" report is sent when a run ends. |
| **Business case** | Staffing-cost calculator (14 bridges, 858,480 hours, $17.50/hour) with payback and NPV. The cost inputs are placeholders to challenge. |
| **Debrief** | Score, violations tied to the requirement behind each one, the student's spec changes, and a short quiz per level. |

## Levels

1. One lane, two directions: the vehicle count and bridge status.
2. Tall ships have priority: arbitration and the siren timing rules (xx, yy).
3. Be the operator: manual control.
4. First responders: emergency preemption and exception flows.
5. Murphy's law: sensor misses and stalled vehicles (the count may never reach 0).
6. A day for DOT: a full day of compressed traffic for the reports.

## Gaps filled by default

| Gap in the decks | Default in the game |
|---|---|
| What is "tall"? | Taller than 3.5 m triggers a raise. The closed bridge clears 4.0 m. |
| Count never reaches 0 | Stop admitting vehicles after 45 s if others wait; resynchronise the count once the bridge zone (stop line to departure sensor) is verified empty. |
| Vehicle stops on the bridge | Alarm and tow after 20 s. |
| Polling clock | 1 s polling, with emergency arrivals handled as interrupts. |
| Pedestrians on the span | Verify the span is clear before moving; siren on for 10 s first. |
| Arbitration among vehicle directions | Vessels first, then longest wait. After a max-hold cut, everyone who was waiting gets a turn before the cut mode can win again. |
| Resuming automatic control after manual play | Stop all gates and signals, lower the bridge with the siren rules if it is up, verify the zone is clear, then resync the counts. |

## Code map

```
src/sim/world.ts        physical world: vehicles, vessels, pedestrians, sensors, gates, bridge, tabulator
src/sim/controller.ts   the virtual bridge operator (use cases and state machine)
src/sim/specs.ts        every tunable requirement, with its source slide and help text
src/sim/reports.ts      DOT report generation and CSV export
src/sim/levels.ts       levels and quiz questions
src/render, src/ui      canvas drawing and panels
tests/                  Vitest scenarios (npm test)
```

The simulation in `src/sim` has no DOM dependency, so it can be unit-tested and replayed headless.
