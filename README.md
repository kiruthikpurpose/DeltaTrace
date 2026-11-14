<div align="center">

# DeltaTrace

**Trust-Aware Alarm Grouping and Tuning for Pipelines**

Sensor trust scoring, delay-based incident grouping and trust-gated alarm tuning for pipeline control rooms.

[![CI](https://github.com/kiruthikpurpose/DeltaTrace/actions/workflows/ci.yml/badge.svg)](https://github.com/kiruthikpurpose/DeltaTrace/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)

</div>

<p align="center">
  <img src="docs/images/console.png" alt="Live console: pipeline schematic, raw alarm list and DeltaTrace incident view" width="900">
</p>

DeltaTrace sits beside an existing SCADA system. It reads sensor data and alarms, scores how far each sensor can be trusted, groups related alarms into single incidents, and proposes safer alarm settings. It writes back only incident records, data-quality flags and operator-approved parameters. It never issues control commands.

This repository is a complete browser application with a built-in process simulator, so every feature can be exercised without a plant connection.

## Contents

[Why](#why) · [Motivation](#why-this-problem) · [Functions](#functions) · [Applications](#applications-and-use-cases) · [Architecture](#architecture) · [Alarm decisions](#alarm-decisions) · [Safety rules](#safety-rules) · [Screens](#screens) · [Getting started](#getting-started) · [Testing and CI](#testing-and-ci) · [Deployment](#deployment) · [Reports](#reports) · [Project layout](#project-layout) · [Configuration](#configuration) · [Roadmap](#future-improvements) · [Limitations](#limitations) · [Contributing](#contributing) · [License](#license)

## Why

A long pipeline is monitored by sensors every ~20 km, and the control system raises an alarm at every limit crossing. Two problems follow:

- **One event, many alarms.** A leak or pump trip sends a pressure wave past many sensors in turn, producing dozens of alarms within minutes.
- **Some alarms are not real.** Sensors freeze, drift, spike, replay old data, go offline or are tampered with, and hand-set alarm limits drift back toward flooding.

## Why this problem

I chose alarm handling on pipelines for four reasons.

- **It is a real operational problem.** Alarm floods are a recognised cause of missed or late responses in process control. Industry guidance (ISA-18.2, EEMUA 191) treats roughly one alarm per 10 minutes as manageable and more than ten in ten minutes as a flood. A single pump trip or leak on a long line can exceed that within a minute.
- **The physics gives a usable signal.** A pressure wave travels at a known speed, so the time between two alarms says whether one event can explain both. That turns "group alarms" from guesswork into a rule that can be explained to an operator.
- **Trust and alarms are linked.** A sensor that lies produces alarms that should not be believed, and a flood of alarms from one event hides which sensors are failing. Treating trust, grouping and tuning as one loop is more useful than solving each alone.
- **It can be done safely.** The design keeps the existing system in charge: read-only inputs, no control commands, every raw alarm retained, fail-open behaviour, and operator approval for every setting change. That makes it adoptable in a safety-conscious environment.

## Functions

| Function | What it does | Page |
|---|---|---|
| **Trust engine** | Scores every channel from 0 to 1 using neighbour agreement, mass balance, signal behaviour and communication health. | Trust Center |
| **Delay-based grouping** | Merges alarms whose time gaps fit the pressure-wave travel time between sensors, classifies the incident, ranks it and estimates an origin. | Live Console, Incidents |
| **Trust-gated replay tuner** | Replays candidate thresholds, deadbands and delays on stored data from trusted sensors only and recommends the best safe setting for approval. | Alarm Tuner |

The three feed each other: trust improves grouping, grouping produces labelled events, labelled events improve tuning, and tuning reduces false alarms, which cleans the data trust relies on.

## Applications and use cases

DeltaTrace is designed for supervisory monitoring of long linear assets where events propagate along the line and sensors are spaced far apart.

| Setting | Use case | What DeltaTrace contributes |
|---|---|---|
| Oil and refined-product pipelines | Leak, pump trip and valve closure events during normal operation | One ranked incident with a likely origin instead of dozens of alarms |
| Gas transmission lines | Pressure transients from compressor trips or valve actions | Delay-window grouping across stations, separate handling of flow-balance alarms |
| Water and wastewater mains | Burst detection and pump-station faults | Distinguishes a real burst from a stuck or drifting pressure transmitter |
| Remote sites with weak links | Radio or satellite outages | Flags stale channels as a data-integrity incident so a real event nearby is not masked |
| Cyber-physical security | Replayed or injected sensor data | Detects exact replays and false drops that no neighbour confirms |
| Alarm rationalisation projects | Periodic review of limits, deadbands and delays | Replays candidate settings on trusted history and records every approved change |
| Training and evaluation | Operator training, vendor demonstrations, method research | Reproducible scenarios, fault injection, benchmark reports and PDF output |

These are intended applications. The behaviour has been exercised only on the built-in process simulator, not on plant data.

## Architecture

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/architecture-dark.svg">
    <img src="docs/images/architecture-light.svg" alt="System architecture: field, communication and control centre feed a read-only gateway into the DeltaTrace unit, which writes approved results back to the SCADA server" width="900">
  </picture>
</p>

DeltaTrace is a read-only consumer of SCADA data. Its write-back module returns incident records, quality flags and approved settings to the SCADA server through a controlled interface. If DeltaTrace is switched off or fails, SCADA alarms reach the operator console unchanged (fail-open).

### Processing per scan

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/scan-flow-dark.svg">
    <img src="docs/images/scan-flow-light.svg" alt="Seven processing stages of one scan: sample, SCADA alarms, trust, group, classify, safety rules, write-back" width="900">
  </picture>
</p>

## Alarm decisions

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/decision-flow-dark.svg">
    <img src="docs/images/decision-flow-light.svg" alt="Decision flow for a raw alarm: demotion test, then delay-window linking, then classification" width="760">
  </picture>
</p>

| Class | Rule (first match wins) |
|---|---|
| Data integrity | Two or more channels stale or bad with a communications cause, or a replayed or flat-lined channel while neighbours change |
| Process event | Trust-weighted corroboration >= 0.6 |
| Instrument fault | One channel (or only low-trust channels) and corroboration < 0.2 |
| Needs review | Everything else |

Two alarms are linked when they are within 3 hops and their time difference is at most `distance / wave speed + clock tolerance + scan interval`. For example 20 km at 1000 m/s gives 20 s (plus 10 s). Comms and no-change alarms describe the instrument, so they only group with their own kind.

## Safety rules

Enforced in code, checked live in the UI and covered by `tests/safety.test.ts`.

1. Safety-critical alarms are never hidden and lead the incident headline.
2. Low trust alone never deletes an alarm; it becomes a visible, retrievable Instrument Advisory.
3. A corroborated alarm is never demoted because one source has low trust.
4. Every raw alarm is retained and linked to its incident or advisory.
5. With the engine off, raw alarms pass through unchanged.
6. No control commands are ever issued. Write-backs are limited to incident records, quality flags and operator-approved parameters, and are dry-run in this build.

## Screens

<table>
  <tr>
    <td width="50%"><img src="docs/images/incidents.png" alt="Incident detail with classification reasons, timeline and member alarms"><br><sub>Incident detail: classification basis, position-time timeline, member alarms</sub></td>
    <td width="50%"><img src="docs/images/trust.png" alt="Trust center with heatmap and sensor cards"><br><sub>Trust Center: heatmap, sensor cards, neighbour graph</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/tuner.png" alt="Alarm tuner Pareto chart of candidate settings"><br><sub>Alarm Tuner: Pareto front of candidate settings</sub></td>
    <td width="50%"><img src="docs/images/benchmarks.png" alt="Benchmark results for scenarios S0 to S8"><br><sub>Benchmarks: scenarios S0 to S8, existing system against DeltaTrace</sub></td>
  </tr>
</table>

## Getting started

Requires Node 18 or newer.

```bash
git clone https://github.com/kiruthikpurpose/DeltaTrace.git
cd DeltaTrace
npm ci
npm run dev        # http://localhost:5173
```

Open **Guided Demo** for a ten-step walkthrough, or press `F` anywhere to inject a fault.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the test suite |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run check:bundle` | Fail if initial JavaScript exceeds 400 kB gzip |
| `npm run ci` | Everything CI runs, in order |
| `npm run diagrams` | Regenerate the README diagrams |

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `F` | Fault injector |
| `1` to `9` | Quick faults (pump trip, leak, frozen sensor, replay, false injection, comms outage, comms plus leak, valve closure, batch interface) |
| `Ctrl/Cmd + K` | Command palette |
| `P` / `R` | Presenter mode / emergency reset |
| `?` | Shortcut help |

## Testing and CI

The suite has 52 tests: engine unit and property tests (trust, grouping, classification, origin, tuner, metrics), scenario tests S0 to S8, safety invariants across many seeds, persistence, and UI smoke tests.

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request, on Node 18, 20 and 22:

`npm ci` → typecheck → lint → test → build → bundle budget check.

Run the same sequence locally with `npm run ci`.

## Deployment

The build is a static site.

- **Vercel:** import the repository, preset *Vite*, build command `npm run build`, output directory `dist`. `vercel.json` already contains the single-page-app rewrite and immutable asset caching.
- **Any static host:** serve `dist/` and rewrite unknown paths to `index.html`.

The application makes no network requests at runtime and works offline.

## Reports

PDF reports are generated in the browser, without a server or external library.

| Report | Where | Contents |
|---|---|---|
| Benchmark | Benchmarks | Summary, scenario table, charts, confusion matrix, experiments, method |
| Operations and audit | Write-back and Audit | KPIs, safety compliance, sensor trust, incidents, advisories, change records, audit trail, configuration |
| Incident | Incident detail | Summary, classification basis, origin, member alarms, write-back |
| Alarm tuning | Alarm Tuner | Recommendations, Pareto charts, candidate tables, contamination check |

## Project layout

```text
src/
  engine/       Pure TypeScript simulation and the three functions (no React, seeded RNG)
  state/        Zustand stores, the simulation runner, persistence
  components/   Shell, UI kit, SVG and canvas visuals, domain widgets
  pages/        One module per route
  styles/       Design tokens (light and dark) and component styles
  utils/        Formatting, PDF writer, report builders, accessibility helpers
tests/          Vitest suites
scripts/        Diagram generator, bundle-size check
docs/           README images and architecture notes
```

More detail: [docs/architecture.md](docs/architecture.md).

## Configuration

Defaults live in `src/engine/config.ts` and can be changed on the Settings page.

| Parameter | Default |
|---|---|
| Wave speed | 1000 m/s |
| Clock tolerance / scan interval | 5 s / 5 s |
| Hop limit | 3 |
| Trust weights (residual, signal, comms, balance) | 0.15 / 1.0 / 0.8 / 0.5 |
| Trust classes | GOOD >= 0.7, BAD < 0.4 |
| Process / fault corroboration | 0.6 / 0.2 |
| Demotion (trust, corroboration) | < 0.4 and < 0.2 |
| Incident quiet time | 120 s |

The simulation is reproducible: the same seed, configuration and injection timeline give the same run. The seed is shown in the top bar.

## Future improvements

| Area | Improvement |
|---|---|
| Real data | Replay historian exports (CSV, OPC UA history) through the same engine; calibrate trust weights and wave speed per segment from field data. |
| Wave speed | Estimate wave speed online from observed arrival times instead of a fixed setting; allow different speeds per segment and product. |
| Topology | Support branches, loops and multiple lines; use real elevation and pump curves in the process model. |
| Grouping | Separate overlapping events in time and place with a joint origin fit; learn linking windows from operator-confirmed incidents. |
| Trust | Add pressure-flow consistency models, temperature channels and learned per-sensor noise baselines; explain trust changes with the contributing evidence. |
| Tuner | Multi-objective search beyond the grid, per-priority constraints, and rollback simulation before approval. |
| Operator feedback | Use dispositions (confirmed, false alarm) as training labels in the loop, with drift monitoring for the labels themselves. |
| Integration | Read-only OPC UA and historian connectors, a signed write-back interface and an approval workflow integrated with management of change. |
| Performance | Move the engine into a Web Worker or a service for larger networks and long histories. |
| Quality | Property-based tests for more safety invariants, load tests, and an accessibility audit with assistive technology. |

## Limitations

- Trust weights and thresholds are defaults and need calibration for a specific line.
- Wave speed must be known or estimated; a wrong value shifts every delay window.
- The origin estimate is a grouping aid, not a leak locator.
- Events that overlap in both time and place can merge into one incident.
- Where baseline alarm load is already low, there is little to reduce.
- Operator approval is always required before a setting change.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## License

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE).
