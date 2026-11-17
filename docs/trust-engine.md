# Trust engine

The trust engine gives every channel a score between 0 and 1 on each scan (every 5 s by default). A score near 1 means the reading is consistent with the rest of the system. A low score means the sensor disagrees with the evidence or behaves like a failed instrument.

Source: `src/engine/trust.ts`. Tests: `tests/trust.test.ts`.

## Channels

The simulated line has 12 pressure transmitters (`PT-0` to `PT-11`, one per node) and 3 flow transmitters (`FT-in`, `FT-del`, `FT-out`). Nodes sit at km 0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 190 and 200.

## Score

```text
T_raw = exp( -( lambda_r * z^2  +  lambda_s * S  +  lambda_c * C  +  lambda_m * M ) )
```

| Term | Meaning | Default weight |
|---|---|---|
| `z` | Residual of the reading against a prediction from neighbouring nodes, divided by a robust noise estimate (clamped to +/-8). Large when the sensor disagrees with its neighbours. | `lambda_r` 0.15 |
| `S` | Signal behaviour: flat-lined output, spikes, exact replay of earlier data. | `lambda_s` 1.0 |
| `C` | Communication health: age of the last sample and quality flags. | `lambda_c` 0.8 |
| `M` | Mass balance, applied to flow meters: inconsistency between inlet, delivery and outlet flow, blamed on the most likely meter. | `lambda_m` 0.5 |

Because the score is an exponential of a weighted sum, one strong symptom is enough to pull trust down, and several weak ones add up.

## Smoothing and corroboration

- Trust falls and recovers at different speeds. When trust is falling, the new value has weight 0.3, or only 0.1 when the neighbours see the same deviation (a corroborated real event). When trust is recovering, the new value has weight 0.3.
- If a sensor moves and its neighbours do not yet agree, residual evidence is held back for 30 s so a real wave that has not reached the neighbours is not punished.
- The noise estimate learns only from samples taken while the sensor is healthy, so a failing sensor cannot widen its own tolerance.

## Classes and hysteresis

| Class | Condition |
|---|---|
| GOOD | `T >= 0.7` |
| UNCERTAIN | between the two thresholds |
| BAD | `T < 0.4` |

A BAD channel returns to a better class only after three consecutive scans with `T >= 0.55`. This prevents flapping when a sensor hovers near a threshold.

## Likely fault labels

When a channel is not GOOD, the engine attaches the most probable explanation:

| Label | Typical evidence |
|---|---|
| `stuck` | Output flat while neighbours move |
| `drift` | Residual that has grown steadily over the last minutes |
| `spike` | Short, large excursions |
| `stale` | Old sample or bad quality flag |
| `replay` | Differences between consecutive samples match earlier data exactly |
| `inconsistent` | Disagrees with neighbours or mass balance without a more specific pattern |

## Corroboration

For an alarm, the engine computes a trust-weighted corroboration value: how much of the surrounding network, weighted by sensor trust, saw a matching disturbance within the expected delay. This value feeds classification and the demotion rule (see [incident-grouping.md](incident-grouping.md)).

## Tuning the weights

All weights and thresholds are on the Settings page and in `src/engine/config.ts`. Changing them resets the simulation so runs stay comparable. See [development.md](development.md) for how to add a new evidence term.
