# Trust-gated replay tuner

Source: `src/engine/tuner.ts`. Tests: `tests/tuner.test.ts`. Page: Alarm Tuner.

## Purpose

Alarm limits, deadbands and on-delays drift over the years toward settings that flood operators. The tuner proposes better settings by replaying candidates on stored data, using only data that can be trusted.

## Alarm classes

| Class | Unit | Parameters tuned |
|---|---|---|
| PT-low | bar | limit, deadband, on-delay |
| PT-high | bar | limit, deadband, on-delay |
| Rate-of-change | bar per 10 s | limit, deadband, on-delay |
| Flow-deviation | percent of line flow | limit, deadband, on-delay |

## Training history

A deterministic six-hour synthetic history is generated with a scripted mix of pump trips, valve closures, leaks, batch interfaces, communication loss, stuck, drifting, spiking, replaying and falsely injecting sensors. Events carry ground-truth labels, so false alarms and missed events can be counted.

## Candidate grid

Each class is searched over 7 limit offsets, 5 deadbands and 5 on-delays: 175 candidates.

| Dimension | Values |
|---|---|
| Limit offset | -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0 (scaled per class) |
| Deadband | 0.2, 0.3, 0.5, 0.8, 1.2 |
| On-delay (s) | 0, 5, 10, 20, 30 |

## Trust gating

When gating is on, readings from channels whose trust is below `tMin` (default 0.6) at that moment are excluded from the replay. Without gating, faulty sensors teach the tuner to tune around their faults. Experiment E5 compares the two.

## Objective

```text
J = 1.0 * alarms_per_10_min + 2.0 * false_alarms + 0.05 * mean_delay + 1e6 * missed_events
```

The large missed-event weight acts as a constraint: a candidate that misses a labelled event is not feasible.

## Recommendation

1. Discard infeasible candidates.
2. Compute the Pareto front over alarm load, false alarms and detection delay.
3. Pick the feasible candidate with the lowest `J`.
4. Recommend it only if it improves on the current setting.

## Approval and write-back

A recommendation is never applied automatically. The operator approves it, and the change is recorded with before and after values, reason and time on the Write-back and Audit page. In this build the write-back is a dry run.
