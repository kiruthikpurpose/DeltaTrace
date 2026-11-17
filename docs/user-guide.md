# User guide

DeltaTrace runs entirely in the browser. A built-in process simulator supplies the pipeline, so every screen is live as soon as the application opens.

## Launch screen

Every page load starts with a short launch animation: scattered alarms converge into streams, pass the trust lens and end as one incident, and the drawing simplifies into the DeltaTrace mark, which flies into the sidebar logo (the top-bar logo on phones). Click or press any key to skip it. It is not shown when the system is set to reduced motion. The simulation starts when the animation finishes.

## Navigation

| Group | Page | Use it to |
|---|---|---|
| Operate | Overview | See the three functions and live before/after numbers |
| Operate | Live Console | Watch the pipeline, the existing alarm list and the DeltaTrace operator view side by side |
| Operate | Incidents | Open an incident: classification basis, origin, timeline, member alarms, disposition |
| Operate | Trust Center | Inspect the trust of every sensor, heatmap over time, neighbour graph |
| Optimise | Alarm Tuner | Replay candidate settings, view the Pareto front, approve a setting |
| Optimise | Write-back and Audit | Review dry-run write-backs, change records and every engine decision |
| Prove | Benchmarks | Run scenarios S0 to S8 and experiments E1 to E7, export a PDF |
| Prove | Guided Demo | Ten-step walkthrough that drives the real console |
| Learn | How It Works | Explanations with diagrams driven by the live simulation |
| Learn | Settings | Engine parameters, theme, seed, saved data |

## Simulation controls (top bar)

| Control | Function |
|---|---|
| Play / pause | `Space` |
| Speed 1x, 5x, 10x, 30x | Changes how fast simulated time runs. The Guided Demo, including its countdown, follows this speed. |
| Reset | Restarts with the current seed |
| Seed | The same seed, configuration and injection timeline reproduce the same run |
| Engine ON/OFF | Switches DeltaTrace off; raw alarms pass through unchanged |

## Injecting faults

Press `F` for the fault injector, or `1` to `9` for quick faults: pump trip, leak at km 87, frozen sensor, replay, false injection, communication outage, outage plus leak, valve closure, batch interface. The injector also offers sliders for leak position and size and per-sensor faults. Use "Replay last 5 minutes" on the Live Console to review what just happened at 0.25x.

## Reading the Live Console

- **Pipeline schematic:** pumps, valves and tap along 200 km. Each sensor shows its trust as a ring and a class label. Flow meters show a trust percentage. Incident envelopes are drawn over the affected stretch with a label; neighbouring labels stack so none is hidden.
- **Raw alarm view:** what the existing system shows, with a flood meter against the 10-alarms-in-10-minutes threshold.
- **DeltaTrace operator view:** incidents, ranked and explained, with reduction and critical-alarms-hidden counters. "Show the why" adds the evidence behind each decision.

## Incident detail

Shows the class and the reasons, estimated origin with range, a position-time timeline, member alarms, related advisories and the write-back record. Operators can record a disposition: confirmed, false alarm, instrument fault or needs maintenance. A PDF report of the incident is available.

## Trust Center

A heatmap of trust over time for every channel, sensor cards with the four evidence components, and a neighbour graph. Selecting a sensor shows its likely fault label.

## Alarm Tuner

1. Choose an alarm class.
2. Run the replay on the six-hour training history.
3. Compare the gated and ungated results on the Pareto chart.
4. Review the recommendation and its effect on alarm load, false alarms and delay.
5. Approve it to record a write-back, or discard it.

## Themes, presenter mode and accessibility

- Light and dark themes with a neutral, control-room palette; the toggle is in the top bar and the choice is remembered.
- Presenter mode (`P`) hides the sidebar and enlarges text for projection.
- Full keyboard operation, visible focus, focus trapping in dialogs, labelled controls and contrast checked to WCAG AA.
- Responsive layout: the sidebar becomes an off-canvas menu below 820 px and the pipeline collapses to a compact list below 720 px.

## Saved data

Settings, approved changes and logs are kept in the browser's local storage under the `deltatrace.v1.` prefix. Settings has a "Clear saved data" action. Nothing is sent over the network.

## PDF reports

Benchmark, operations and audit, incident, and alarm tuning reports are generated in the browser. See the README for contents.
