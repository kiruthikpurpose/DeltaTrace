# Architecture notes

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Engine | `src/engine` | Process physics, fault injection, SCADA baseline, trust, grouping, classification, origin, tuner, metrics. Pure TypeScript, deterministic. |
| Runner | `src/state/runner.ts` | Owns the live `Simulation`, advances it at the selected speed, publishes snapshots to the UI at about 10 Hz, records the injection timeline for replay. |
| Stores | `src/state` | Zustand stores for simulation snapshot, UI state, configuration, logs and toasts; guarded `localStorage` persistence. |
| UI | `src/components`, `src/pages` | Route-level pages, shared components, canvas and SVG visuals. |

## Engine modules

| Module | Role |
|---|---|
| `topology` | 200 km pipeline, 12 nodes, 15 channels, distances, hops, delays |
| `process` | Pressure transients and flow effects for pump trips, valve closures, leaks, batch changes |
| `faults` | Stuck, drift, spike, replay, false injection, communications outage, clock skew |
| `scada` | Baseline limit, rate-of-change, flow-balance, no-change and communications alarms |
| `trust` | Per-channel trust score, classes with hysteresis, corroboration helper |
| `aggregator`, `classifier` | Streaming incident grouping, demotion rule, classification, ranking |
| `origin` | Grid-search origin estimate from arrival times |
| `tuner` | Candidate grid, trust-gated replay, Pareto front, change proposals |
| `metrics`, `scenarios`, `experiments` | KPIs, scenarios S0 to S8, benchmark experiments |

## Data flow

Each simulated second the engine computes true values, applies faults, adds sensor noise and updates RTU samples. Every fifth second it runs one scan: trust, SCADA alarms, grouping and classification, safety checks, write-back and KPIs. The UI reads immutable snapshots; canvases read the engine's ring buffers directly each frame.

## Determinism

All randomness comes from a seeded generator, so `(scenario, seed, configuration, injection timeline)` fully determines a run. The runner records every injection and configuration change, which powers the 0.25x replay of the last five minutes and the headless benchmark runs.

## Safety invariants

Implemented in `aggregator.ts` and verified in `tests/safety.test.ts`: critical alarms lead headlines and are never demoted, every raw alarm is linked, demotion requires low trust and low corroboration, fail-open passes alarms through, and no engine source contains a control-command path.

## Launch screen and start-up

`public/splash.js` and inline CSS in `index.html` draw the launch animation before the application bundle loads. `src/splash.ts` loads the first route and signals readiness. The runner waits for the `deltatrace:splash-done` event before it starts ticking, so the animation has the main thread to itself. The mark flies into `#brand-logo` (`#brand-logo-m` on phones).

## Persistence

`src/state/persist.ts` wraps `localStorage` with a `deltatrace.v1.` prefix and guards every access, so the application works when storage is blocked.

## Performance

Initial JavaScript is about 86 kB gzip (budget 400 kB, enforced by `npm run check:bundle`). Pages are lazy-loaded. Canvases read ring buffers directly instead of re-rendering React components.
