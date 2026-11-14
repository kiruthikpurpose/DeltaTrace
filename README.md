<div align="center">

#  DeltaTrace Live

### Fewer alarms. Clearer incidents. Safer settings.

An in-browser control-room application showing how a software layer reduces alarm floods on an oil and gas pipeline.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white&style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white&style=for-the-badge)
![Tests](https://img.shields.io/badge/tests-51%20passing-22C55E?style=for-the-badge)
![Bundle](https://img.shields.io/badge/initial%20JS-~87%20kB%20gzip-14B8A6?style=for-the-badge)
![Network](https://img.shields.io/badge/runtime%20network-none-8B5CF6?style=for-the-badge)

** Trust Engine &nbsp;·&nbsp;  Delay-Based Grouping &nbsp;·&nbsp;  Trust-Gated Replay Tuner**

</div>

---

## Contents

1. [The problem](#the-problem) · 2. [The idea](#the-idea) · 3. [Architecture](#architecture) · 4. [The three innovations](#the-three-innovations) · 5. [Safety rules](#safety-rules) · 6. [Pages](#pages) · 7. [Quick start](#quick-start) · 8. [Demo script](#the-7-minute-demo) · 9. [Shortcuts](#keyboard-shortcuts) · 10. [Results](#results) · 11. [Assumptions](#assumptions) · 12. [Limits](#honest-limitations) · 13. [Project layout](#project-layout)

---

## The problem

A 200 km pipeline is watched by sensors about every 20 km. The existing control system (SCADA) raises an alarm whenever a reading crosses a limit. Two things go wrong:

```mermaid
flowchart LR
  E([ One event<br/>leak / pump trip]):::bad --> W[Pressure wave<br/>passes sensor after sensor]:::info
  W --> F[ Dozens of alarms<br/>in minutes = alarm flood]:::bad
  L([ Lying sensor<br/>frozen · drift · spike · replay · offline]):::warn --> X[ False alarms &<br/>missed real ones]:::warn
  F --> O[ Operator overload]:::bad
  X --> O
  classDef bad fill:#ef4444,stroke:#991b1b,color:#fff
  classDef info fill:#38bdf8,stroke:#0369a1,color:#00253a
  classDef warn fill:#f59e0b,stroke:#92400e,color:#1f1300
```

## The idea

**DeltaTrace** sits *beside* the existing system (read-only in, controlled write-back out) and adds three connected innovations. Together they form a **closed loop**:

```mermaid
flowchart LR
  T[ 1 · Trust<br/>score every sensor]:::trust --> G[ 2 · Grouping<br/>alarms → incidents]:::group
  G --> L[ Labelled events]:::neutral
  L --> U[ 3 · Tuning<br/>safe alarm settings]:::tune
  U --> R[ Fewer false alarms]:::ok
  R --> D[ Cleaner data]:::ok
  D --> T
  classDef trust fill:#14b8a6,stroke:#0f766e,color:#03201d
  classDef group fill:#8b5cf6,stroke:#5b21b6,color:#fff
  classDef tune fill:#f59e0b,stroke:#92400e,color:#1f1300
  classDef ok fill:#22c55e,stroke:#15803d,color:#04210f
  classDef neutral fill:#64748b,stroke:#334155,color:#fff
```

## Architecture

```mermaid
flowchart TB
  subgraph FIELD[" Field level"]
    P[Pipeline + 15 channels<br/>12 PT · 3 FT]:::field --> RTU[RTUs / PLCs<br/>sample · timestamp · quality]:::field
  end
  subgraph COMM[" Communication"]
    C[Radio · Satellite · Cellular<br/>Modbus · DNP3 · IEC 104 · OPC UA]:::comm
  end
  subgraph CC[" Control centre"]
    S[Central server / SCADA]:::cc
    H[(Historian)]:::cc
    GPS[GPS time]:::cc
    OC[Operator console]:::cc
  end
  subgraph DT[" DeltaTrace unit"]
    GW[ Read-only gateway]:::dt
    TR[Trust engine]:::trust
    GR[Grouping &<br/>classification]:::group
    TU[Replay tuner]:::tune
    AU[(Audit log)]:::dt
    WB[Write-back module]:::dt
  end
  RTU --> C --> S
  S --- H
  S --- GPS
  S --> OC
  S ==>|copy of tags & alarms| GW
  GW --> TR --> GR
  H -.history.-> TU
  TR --> TU
  GR --> AU
  GR --> WB
  TU --> WB
  WB ==>|incident records · quality flags · approved settings| S
  S -. " fail-open bypass: raw alarms unchanged" .-> OC
  classDef field fill:#334155,stroke:#94a3b8,color:#fff
  classDef comm fill:#0ea5e9,stroke:#075985,color:#fff
  classDef cc fill:#4f6bff,stroke:#1e3a8a,color:#fff
  classDef dt fill:#7c3aed,stroke:#4c1d95,color:#fff
  classDef trust fill:#14b8a6,stroke:#0f766e,color:#03201d
  classDef group fill:#8b5cf6,stroke:#5b21b6,color:#fff
  classDef tune fill:#f59e0b,stroke:#92400e,color:#1f1300
```

### Data flow per 5-second scan

```mermaid
sequenceDiagram
  autonumber
  participant Proc as  Process + faults
  participant RTU as  RTU sampling
  participant Trust as  Trust engine
  participant Scada as  SCADA baseline
  participant Agg as  Aggregator
  participant Log as  Write-back & audit
  Proc->>RTU: true values → faulty / skewed measurements
  RTU->>Trust: held values, age, quality
  Trust-->>Agg: trust T, class, likely fault
  RTU->>Scada: limits, rate-of-change, flow balance
  Scada->>Agg: raw alarms (always retained)
  Agg->>Agg: link by delay · classify · rank · demote?
  Agg->>Log: incident tags, quality flags, audit entries
  Log-->>Scada: dry-run write-back (never control commands)
```

## The three innovations

### 1 · Trust Engine

Every channel gets a live score from four checks:

```mermaid
flowchart LR
  A[Neighbour residual z<br/>vs ±2-hop pipeline neighbours]:::trust --> M
  B[Mass balance M<br/>FT-in − FT-del − FT-out]:::trust --> M
  C[Signal behaviour S<br/>flat-line · spike · replay]:::trust --> M
  D[Comms C<br/>age · quality code]:::trust --> M
  M["T = exp(−(0.15·z² + 1.0·S + 0.8·C + 0.5·M))"]:::calc --> K{Class}
  K -->|≥ 0.7| G[ GOOD]:::ok
  K -->|0.4 – 0.7| U[ UNCERTAIN]:::warn
  K -->|< 0.4| BAD[ BAD<br/>leave only at T ≥ 0.55 for 3 scans]:::bad
  classDef trust fill:#14b8a6,stroke:#0f766e,color:#03201d
  classDef calc fill:#0f172a,stroke:#14b8a6,color:#5eead4
  classDef ok fill:#22c55e,color:#04210f
  classDef warn fill:#f59e0b,color:#1f1300
  classDef bad fill:#ef4444,color:#fff
```

A real transient seen by several neighbours **widens the tolerance** instead of punishing healthy sensors.

### 2 · Delay-Based Incident Grouping

Two alarms join one incident if `hops ≤ 3` **and** `|Δt| ≤ distance ÷ wave speed + clock tolerance + scan interval`.
Example: 20 km ÷ 1000 m/s = **20 s** (+10 s). Two simultaneous alarms 150 km apart are **not** merged.

```mermaid
flowchart TD
  S([New raw alarm]) --> Q{Trust &lt; 0.4 AND<br/>corroboration &lt; 0.2 AND<br/>not safety-critical?}
  Q -->|yes| ADV[ Instrument Advisory<br/>visible &amp; retrievable]:::warn
  Q -->|no| LNK[Link by delay window<br/>union-find over open alarms]:::group
  LNK --> CL{Classify<br/>first match wins}
  CL -->|"≥2 stale / replay / flat-line"| DI[ Data-integrity anomaly]:::di
  CL -->|"corroboration ≥ 0.6"| PE[ Process event]:::pe
  CL -->|"one channel, corr &lt; 0.2"| IF[ Instrument fault]:::warn
  CL -->|otherwise| NR[ Needs review]:::nr
  PE --> OR[Origin estimate<br/>grouping aid, not a locator]:::group
  classDef warn fill:#f59e0b,color:#1f1300
  classDef group fill:#8b5cf6,color:#fff
  classDef di fill:#d946ef,color:#fff
  classDef pe fill:#3b82f6,color:#fff
  classDef nr fill:#94a3b8,color:#0f172a
```

Score `S = Σ severity · Tᵝ · (1 + γ·Corr)` ranks incidents; safety-critical alarms always lead the headline.

### 3 · Trust-Gated Replay Tuner

```mermaid
flowchart LR
  H[(6 h stored history<br/>+ labelled events)]:::tune --> TG[Trust gate<br/>T ≥ 0.6 only]:::trust
  TG --> CG[≤175 candidates / class<br/>threshold × deadband × on-delay]:::tune
  CG --> RP[Replay]:::tune --> MS[Measure alarms · false alarms<br/>delay · missed]:::tune
  MS --> PF{Missed = 0 and<br/>delay ≤ +20 s?}
  PF -->|no| X[ Rejected]:::bad
  PF -->|yes| PR[ Pareto front →<br/>recommended setting]:::ok
  PR --> AP[ Operator approves]:::group --> WB[Write-back + MOC record<br/>revertible]:::ok
  classDef tune fill:#f59e0b,stroke:#92400e,color:#1f1300
  classDef trust fill:#14b8a6,color:#03201d
  classDef bad fill:#ef4444,color:#fff
  classDef ok fill:#22c55e,color:#04210f
  classDef group fill:#8b5cf6,color:#fff
```

Objective: `J = 1·alarms + 2·falseAlarms + 0.05·meanDelay + 1e6·missed`. Turning trust gating **off** lets faulty-sensor samples contaminate the replay and can produce a worse recommendation.

## Safety rules

Enforced in code, checked live in the UI, covered by tests.

| # | Rule |
|---|---|
| 1 | Safety-critical alarms are **never hidden**; they lead the incident headline. |
| 2 | Low trust alone **never silently deletes** an alarm; it becomes a visible Instrument Advisory. |
| 3 | A **corroborated** alarm is never demoted because one source has low trust. |
| 4 | **Every raw alarm is retained** and linked to its incident or advisory. |
| 5 | **Fail-open:** engine OFF ⇒ raw alarms pass through unchanged. |
| 6 | DeltaTrace **never issues control commands** (only incident records, quality flags, operator-approved parameters; dry-run here). |

## Pages

| Page | What it shows |
|---|---|
| **Overview** | Hero, three innovation cards with live numbers, before/after tickers, loop diagram, safety rules |
| **Live Console** | Animated pipeline, raw-alarm view vs DeltaTrace view, flood gauge, strip charts, explain overlay, replay last 5 min |
| **Incidents** | Filter/sort, class reasoning, position-time timeline with wavefront, member alarms, origin, dispositions |
| **Trust Center** | Trust heatmap, sensor cards, predicted-vs-measured, neighbour graph, live formula, quick faults |
| **Alarm Tuner** | Run replay, Pareto chart, gated vs contaminated, approve & write back, MOC change log, loop iterations |
| **Write-back & Audit** | Dry-run tag feed, audit log, live rule compliance, CSV/JSON export |
| **Benchmarks** | Scenarios S0–S8 × N seeds, charts, confusion matrix, experiments E1–E7, exports |
| **Guided Demo** | 10-step narrated story with auto fault injection and presenter mode |
| **How It Works** | 12 interactive sections driven by live data, with text alternatives |
| **Settings** | Wave speed, tolerances, trust weights, thresholds, demotion rules, seed, theme |

## Quick start

```bash
npm i
npm run dev          # http://localhost:5173
npm test             # 51 tests: engine, safety, scenarios, tuner, persistence, UI smoke
npm run typecheck
npm run lint
npm run build        # → dist/
npm run preview
```

Requires Node 18+. No backend, no accounts, no analytics, no external fonts/CDNs. Works offline.

### ▲ Deploy to Vercel
Import the repo → framework preset **Vite** → build `npm run build` → output `dist`. `vercel.json` already has the SPA rewrite and immutable asset caching.

## The 7-minute demo

```mermaid
flowchart LR
  s1[1 Normal]:::a --> s2[2 Pump trip<br/>flood]:::b --> s3[3 Grouping<br/>not merged]:::c --> s4[4 Leak km 87]:::c --> s5[5 Stuck PT-7]:::d --> s6[6 Replay + valve]:::d --> s7[7 Comms + leak]:::c --> s8[8 Tuning]:::e --> s9[9 Fail-open]:::b --> s10[10 Close loop]:::a
  classDef a fill:#22c55e,color:#04210f
  classDef b fill:#ef4444,color:#fff
  classDef c fill:#8b5cf6,color:#fff
  classDef d fill:#14b8a6,color:#03201d
  classDef e fill:#f59e0b,color:#1f1300
```

Open **Guided Demo → Start**. Auto-play, skip/back, presenter mode (`P`) and emergency reset (`R`) are built in.

## ⌨ Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `F` | Fault injector |
| `1`–`9` | Quick faults: pump trip · leak km 87 · freeze PT-7 · replay PT-3 · false injection PT-9 · comms outage · comms + leak · valve closure · batch interface |
| `Ctrl/Cmd + K` | Command palette |
| `P` | Presenter mode |
| `R` | Emergency reset (presenter / demo) |
| `?` | Shortcut help |

## Results

5 seeds each, headless, 30-minute timelines:

| Scenario | Peak alarms / 10 min | % time in flood | Operator items | Critical hidden |
|---|---|---|---|---|
| S1 Pump trip cascade | 52.8 → **1.0** | 37% → 0% | 53 → 1.0 | **0** |
| S2 Small leak | 16.8 → **1.0** | 33% → 0% | 17 → 1.2 | **0** |
| S4 Spoofed transmitter | 28.0 → **2.0** | 35% → 0% | 28 → 2.0 | **0** |
| S6 Comms outage + leak | 15.0 → **2.0** | 32% → 0% | 15 → 2.0 | **0** |
| S8 Mixed stress | 80.4 → **2.8** | 52% → 0% | 82 → 3.0 | **0** |

Class accuracy 100% on matched incidents; leak origin within ±6 km. Run **Benchmarks** in the app for the full S0–S8 table and experiments E1–E7.

## Assumptions

- Built at the repo root (no nested folder). Recharts is not used; all charts are hand-written SVG/canvas.
- **Baseline floods by design:** transients include water-hammer ringing (amp 0.9, period 12 s, decay 40 s) and leak amplitudes are 1.6× the spec's starting values (1.0 / 2.4 / 4.8 bar).
- Flow lag = distance ÷ 1.2 m/s clipped to 90 s so it is visible in a demo.
- The "existing system" also raises *no-change* and *communications* alarms, otherwise frozen/dead sensors would be silent.
- Replay detection emits a DeltaTrace-derived `DQ` alarm (not counted as raw) that opens a data-integrity incident.
- Operator items = incidents opened + advisories created (+ pass-through alarms when the engine is off).
- Default clock tolerance 5 s, scan 5 s ⇒ link window = delay + 10 s.
- Tuner: 6 h seeded training history (8 labelled events, many sensor faults), generated once (~1.5 s) and cached; recommendations must miss no event the current setting catches, add ≤ 20 s delay and not raise alarm load.

## Honest limitations

- Trust weights and thresholds are defaults and require calibration for a specific line.
- **Wave speed must be known or estimated;** a wrong value shifts every delay window.
- **The origin estimate is a grouping aid, not a leak locator.**
- **Overlapping events merge** when they coincide in time and place (e.g. S8 trip + nearby leak; two medium leaks whose wave tails overlap).
- **Quiet scenarios** (S0, S7) give DeltaTrace nothing to reduce; S7 still yields one false incident.
- **Clock skew** is tolerated only up to the configured tolerance (experiment E4).
- **Slow drift** is noticed only after the residual grows (~2 min).
- **Flow corroboration is coarse:** two moving pressure sensors anywhere count.
- **Tuner gating** clearly helped only the rate-of-change class on this history (experiment E5).
- Operator approval is always required for any setting change.

## Project layout

```text
PLAN.md · README.md · vercel.json · vite.config.ts
src/
  engine/      pure, seeded simulation + the 3 innovations (no React)
               rng · topology · process · faults · scada · trust · aggregator · classifier
               origin · tuner · metrics · scenarios · experiments · simulation
  state/       zustand stores · SimulationRunner tick loop · persistence
  components/  shell · ui kit · viz (SVG/canvas) · domain widgets
  pages/       Overview · Console · Incidents · Trust · Tuner · Writeback
               Benchmarks · Demo · HowItWorks · Settings
  styles/      tokens.css (light + dark) · base · shell · components · pages
tests/         vitest: engine, safety properties, scenarios, tuner, persistence, app smoke
```

---

