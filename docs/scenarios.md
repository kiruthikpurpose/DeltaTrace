# Scenarios and experiments

Scenarios live in `src/engine/scenarios.ts` and experiments in `src/engine/experiments.ts`. Both run headless in tests and in the browser on the Benchmarks page. Each run is fully determined by scenario, seed, configuration and injection timeline.

## Scenarios

Each scenario lasts 30 simulated minutes and carries ground truth used to score classification.

| ID | Name | What happens | Expected result |
|---|---|---|---|
| S0 | Normal operation | Noise only | No incidents |
| S1 | Pump trip cascade | PS-2 (node 4) trips at 5:00 | One process-event incident |
| S2 | Small leak | Medium leak at km 87 at 6:00 | Process event, origin near km 87 |
| S3 | Single stuck transmitter | PT-7 sticks at 8:00, small real transient at 14:00 | Instrument fault, then a real process event |
| S4 | Spoofed transmitter | PT-3 replays old data from 5:00, valve closure at node 5 at 10:00 | Data integrity and process event kept separate |
| S5 | False-injection fake leak | PT-9 reports a drop of 5 bar at 7:00 | Data integrity or instrument fault |
| S6 | Communications outage | RTUs of nodes 6 to 8 drop for 4 minutes, leak at km 40 at 7:30 | Two separate incidents |
| S7 | Batch interface | Product interface passes FT-del and FT-out | Flow false alarms, no real event |
| S8 | Mixed stress | Pump trip, stuck PT-2, leak at km 150, 4 s clock skew, batch change | Each cause separated |

## Fault catalogue

| Fault | Effect |
|---|---|
| Pump trip | Pressure wave both ways from the station |
| Valve closure | Upstream surge, downstream drop (small, medium, large) |
| Leak | Pressure drop at a position along the line, later flow imbalance |
| Batch interface | Temporary flow-deviation alarms at a flow meter |
| Stuck | Sensor output frozen |
| Drift | Slowly growing offset |
| Spike | Short large excursions |
| Replay | Sensor repeats earlier data |
| False injection | Sensor reports a drop that nothing else confirms |
| Communications outage | Several RTUs go stale |
| Clock skew | RTU timestamps shifted |

Nine quick faults are bound to keys `1` to `9` (see the README).

## Metrics

Raw alarm count, peak alarms in 10 minutes, operator items, reduction, class accuracy, origin error, critical alarms hidden, detection delays and flood time.

## Experiments

| ID | Question | Reading the result |
|---|---|---|
| E1 | Does trust separate real events from faults? | Mean trust separation above 0.3 |
| E2 | Does delay-based grouping beat a 60 s fixed window? | Fewer incidents spanning two distant leaks |
| E3 | Are critical alarms ever hidden? | Must be zero across all scenarios and seeds |
| E4 | How robust is grouping to clock skew? | Incident count stays at the ideal up to the configured tolerance |
| E5 | Does trust gating improve tuning? | Gated recommendation is better or equal on clean evaluation |
| E6 | Does closed-loop tuning reduce alarm load over iterations? | Raw alarms trend down |
| E7 | How fast is each fault type noticed? | Time to not-GOOD and to BAD, advisories and incidents |

Notes on E2, E5 and E7 state honestly where the method gives no advantage.
