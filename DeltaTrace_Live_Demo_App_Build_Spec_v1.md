# DeltaTrace Live Demo — Complete Build Specification (v1)

> **How to use this file.** Put it in an empty folder in VS Code, open Claude Code in that folder and say:
> *"Read DeltaTrace_Live_Demo_App_Build_Spec_v1.md fully and build the entire application exactly as specified. Work autonomously, follow the build phases, run tests and the production build after every phase, and do not ask me questions."*
> The result is a deployable web app for Vercel.
>
> **Note on "React Native":** this spec uses **React for the web (Vite)**, not React Native, because the target is a Vercel website.

---

## 0. ROLE AND WORKING RULES (for Claude Code)

You are a principal front-end engineer and simulation developer with strong product-design skills. Build a **polished, enterprise-grade, front-end-only web application** called **DeltaTrace Live** that demonstrates, in real time and with simulated data, how a software layer improves alarm handling on an oil and gas pipeline.

1. Work autonomously. Where something is unspecified, choose a sensible default and record it in `README.md` under "Assumptions".
2. First write `PLAN.md` (phases, file tree, risks). Then build phase by phase (Section 17). After every phase run `npm run typecheck`, `npm test` and `npm run build`; fix failures before continuing.
3. Everything runs **in the browser**. **No backend, no database, no network calls at runtime, no accounts, no analytics, no external fonts or CDNs** (bundle fonts locally or use a system font stack). It must work offline after `npm install`.
4. The app is a **demonstration with simulated data**. Show a small persistent label "Simulated data — demonstration only". Never use real company names, logos or real operator data anywhere.
5. Quality bar: it must look and feel like a commercial SaaS control-room product — consistent, fast, colourful, alive, and clear to a non-expert evaluator within 60 seconds.
6. At the end, report: what was built, test results, bundle size, Lighthouse-style notes, any assumption made, and any scenario where DeltaTrace does not help (be honest).

---

## 1. THE IDEA IN PLAIN WORDS (implement faithfully)

A long pipeline is watched through sensors about every 20 km. The existing control system (called SCADA here, only mentioned in the Architecture page and tooltips) simply reads the sensors, shows dashboards and raises an alarm whenever a reading crosses a limit. Two things go wrong:

- **One event, many alarms.** A leak or pump trip sends a pressure wave past many sensors one after another, so dozens of alarms appear within minutes (an "alarm flood").
- **Some alarms are not real.** A sensor can freeze, drift, spike, replay old data, go offline or be tampered with. Alarm limits are also set by hand and drift back toward flooding.

**DeltaTrace** sits beside the existing system (read-only in, controlled write-back out) with three connected innovations:

| # | Innovation | One-line meaning | Colour |
|---|---|---|---|
| 1 | **Trust Engine** | Every sensor gets a live trust score (0–1) by checking it against its pipeline neighbours, a mass balance, its own signal behaviour and its communication health. | Teal |
| 2 | **Delay-Based Incident Grouping** | Alarms are grouped into one incident when their time differences fit the pressure-wave travel time between sensors (distance ÷ wave speed + tolerance). Incidents are weighted by trust, classified, ranked and written back, while every raw alarm is kept. | Violet |
| 3 | **Trust-Gated Replay Tuner** | Candidate alarm thresholds, deadbands and delays are replayed on stored data from trusted sensors only; the best safe setting is written back after approval. | Amber |

**The closed loop:** trust → grouping → labelled events → tuning → fewer false alarms → cleaner data → better trust.

**Safety rules (enforced in code AND shown in the UI):**
1. Safety-critical alarms are never hidden; they lead the incident headline.
2. Low trust alone never silently deletes an alarm; an uncorroborated alarm from a low-trust sensor becomes an **Instrument Advisory** that stays visible and retrievable.
3. A corroborated alarm is never demoted because one source has low trust.
4. Every raw alarm is retained and linked to its incident (audit trail).
5. **Fail-open:** if DeltaTrace is switched off or "failed", raw alarms pass straight through unchanged.
6. DeltaTrace **never issues control commands**. Its only write-backs are: incident records, derived data-quality flags, and operator-approved alarm parameters.

---

## 2. WHAT THE DEMO MUST ACHIEVE (acceptance story)

A presenter opens the Live Console. A 200 km pipeline is animated with product flowing, sensors blinking, strip charts moving, and a **side-by-side comparison**: left "Raw alarm view (existing system)", right "DeltaTrace operator view". Everything is **real-time simulated** (continuous, not pre-recorded).

The presenter then **injects faults live** with one click:
- *Inject leak at km 87* → a pressure wave visibly spreads along the pipe; the left panel floods with dozens of alarms; the right panel shows **one incident** with origin estimate near km 87, corroborating sensors, and a delay-window explanation.
- *Freeze sensor PT-7* → its trust ring turns amber then red; its alarms become an **Instrument Advisory**, not an incident, nothing hidden.
- *Replay/spoof PT-3* → classified as **Data-integrity anomaly**.
- *Comms outage + simultaneous leak* → two separate incidents, correctly classified.
- *Open the Tuner* → Pareto chart appears; approve a recommended setting; the **live alarm rate drops** immediately; the Change Log and Write-back panel record it.
- *Toggle "DeltaTrace engine: OFF"* → fail-open: the right panel mirrors raw alarms.
- *Toggle "Trust gating" off in the Tuner* → show contaminated tuning produce a worse recommendation.

Everything must feel instant, animated and explained.

---

## 3. TECH STACK AND CONSTRAINTS

- **Vite + React 18 + TypeScript (strict)**.
- Allowed runtime dependencies (nothing else without a strong reason): `react`, `react-dom`, `react-router-dom` (v6), `zustand` (state), `recharts` (only for static/secondary charts), `lucide-react` (icons), `clsx`. Dev: `vitest`, `@testing-library/react`, `jsdom`, `eslint`, `typescript`, `@vitejs/plugin-react`.
- **Hand-written SVG/Canvas for all real-time visuals** (pipeline schematic, strip charts, trust heatmap, wave animation). Do **not** use Recharts for anything updating more than ~2 times per second.
- Plain CSS with **CSS variables** (design tokens) in a single `styles/tokens.css` plus component CSS modules or a `styles/*.css` set. No Tailwind, no UI kit.
- **Pure, framework-free engine** in `src/engine/` (deterministic via seeded RNG, unit-tested, no React imports).
- Simulation runs on the **main thread** in a controlled tick loop (see Section 6). Engine cost per tick must stay tiny (12 nodes). If profiling shows jank, move the engine to a Web Worker behind the same interface; otherwise keep it simple.
- Node 18+. Scripts: `dev`, `build`, `preview`, `test`, `typecheck`, `lint`.
- **Responsive:** desktop-first (≥1280 px is the design target), usable on tablet (≥900 px); on narrow screens the sidebar collapses to icons.
- **Accessibility:** semantic landmarks, keyboard navigation, visible focus rings, ARIA labels on charts/tables, `prefers-reduced-motion` disables non-essential animation, colour is never the only signal (icons + text too), contrast ≥ 4.5:1 in both themes.
- **Themes:** light and dark, toggle in the top bar, default from `prefers-color-scheme`.
- **Performance targets:** 60 fps animations on a mid laptop, initial JS bundle < 400 kB gzipped (code-split pages with `React.lazy`), UI state updated at ~10 Hz while the engine ticks faster if needed.
- **Vercel:** static build (`dist`). Include `vercel.json` with an SPA rewrite and cache headers (Section 16).

---

## 4. VISUAL DESIGN SYSTEM (consistency across every tab)

### 4.1 Look and feel
Enterprise control-room SaaS: calm neutral surfaces, vivid but disciplined accent colours, soft shadows, rounded cards (12 px), generous spacing, crisp numerals, subtle motion. Think "modern observability product", not a toy.

### 4.2 Design tokens (put in `tokens.css`; define for both themes)
- Surfaces: `--bg`, `--bg-elev-1`, `--bg-elev-2`, `--border`, `--text`, `--text-muted`.
- Brand: `--brand` (indigo/blue `#4F6BFF`), `--brand-soft`.
- Innovation colours: `--c-trust` teal `#14B8A6`, `--c-group` violet `#8B5CF6`, `--c-tune` amber `#F59E0B`.
- Semantic: `--ok` green `#22C55E`, `--warn` amber `#F59E0B`, `--bad` red `#EF4444`, `--info` sky `#38BDF8`.
- Trust classes: GOOD green, UNCERTAIN amber, BAD red. Incident classes: Process event (blue), Instrument fault (amber), Data-integrity (magenta/purple), Needs review (grey). Each class also has a distinct **icon and shape**.
- Dark theme: deep navy surfaces (`#0B1220`, `#111A2E`, `#18233D`), soft glow on active elements. Light theme: off-white `#F6F8FC`, white cards.
- Type: system UI font stack; **tabular, monospaced numerals** for KPIs and timestamps. Scale: 12/14/16/20/28/40.
- Spacing scale 4/8/12/16/24/32; radius 8/12/20; elevation 0/1/2.

### 4.3 App shell (identical on every page)
- **Left sidebar** (collapsible, remembers state): logo mark + "DeltaTrace" wordmark; nav groups with icons:
  - *Operate:* Overview · Live Console · Incidents · Trust Center
  - *Optimise:* Alarm Tuner · Write-back & Audit
  - *Prove:* Benchmarks · Guided Demo
  - *Learn:* How It Works (Architecture) · Settings
  Active item has an accent bar. Bottom of sidebar: engine status pill ("Engine ACTIVE" green / "Fail-open" amber) and the "Simulated data" label.
- **Top bar** (sticky): page title + breadcrumb; **simulation controls** (Play/Pause, speed 1×/5×/10×/30×, Reset, seed chip); **sim clock** (`T+00:12:35`); live chips: *Raw alarms/10 min*, *Operator items/10 min*, *Active faults*; theme toggle; "Inject fault" quick button (opens the Fault Injector drawer from anywhere).
- **Global fault-injector drawer** (right side, openable from every page via top-bar button or key `F`).
- **Toast stack** (bottom-right) for events: "Leak injected at km 87", "Incident #3 opened", "PT-7 trust dropped to BAD", "Setting approved and written back".
- **Command palette** (`Ctrl/Cmd+K`): jump to pages, inject a named fault, toggle engine, change speed. Lightweight custom component.
- **Keyboard shortcuts:** `Space` play/pause, `F` fault drawer, `1–9` quick faults (listed in the drawer), `?` shortcut help.
- **Page header pattern:** title, one-sentence purpose, optional "What am I looking at?" info popover per page (short bullets).
- **Empty/loading states** are designed (skeleton shimmer, never blank).
- **Motion:** 150–250 ms transitions, easing `cubic-bezier(.2,.8,.2,1)`; numeric tickers tween; new list rows slide in; pulses for active alarms; glow for BAD sensors; all disabled under reduced motion (replace with instant changes).

### 4.4 Shared components (build once, reuse)
`AppShell, Sidebar, TopBar, PageHeader, Card, Kpi (value, delta, sparkline), Badge, Chip, Tooltip, Popover, Drawer, Modal, Toast, Tabs, SegmentedControl, Toggle, Slider, Table (sortable, sticky header, virtualised if >200 rows), EmptyState, Skeleton, Legend, Icon wrappers, InfoPopover, CommandPalette, ThemeToggle`.

---

## 5. PAGES (route list) — what each shows

Routes: `/` Overview · `/console` Live Console · `/incidents` · `/trust` · `/tuner` · `/writeback` · `/benchmarks` · `/demo` Guided Demo · `/how-it-works` · `/settings`.

### 5.1 Overview (`/`)
Purpose: explain and sell the product in one screen, with live numbers.
- Hero: "Fewer alarms. Clearer incidents. Safer settings." Sub-line explaining the three innovations. Buttons: **Open Live Console**, **Start Guided Demo**.
- Three large innovation cards (Trust / Grouping / Tuning), each with an animated mini-illustration (e.g., a ring filling, dots merging into one, a slider moving) and a live number from the running simulation (e.g., "11 sensors GOOD · 1 UNCERTAIN", "87 raw alarms → 1 incident", "Last tuning: −42% alarms").
- **Live before/after strip:** big tickers "Raw alarms (last 10 min)" vs "Operator items (last 10 min)" with the flood threshold line at 10.
- Animated loop diagram (Trust → Grouping → Tuning → back) with particles flowing around it.
- "Safety first" row with the six rules as icon chips.
- Footer note: simulated data.

### 5.2 Live Console (`/console`) — the main demo screen
Layout (desktop): top = **animated pipeline schematic** (full width); below it a two-column comparison; right edge a slim context column.
1. **Pipeline schematic (hero visual, SVG + canvas overlay)** — see Section 9.1.
2. **Left column — "Raw alarm view (existing system)":** live scrolling alarm list (newest on top, severity colour, tag, type, time), a **flood meter** (gauge: alarms in rolling 10 min with the "10" threshold line), counters: *Raw alarms total*, *Active*, *Chattering*. Rows animate in. A red "ALARM FLOOD" banner appears when ≥ 10 in 10 min.
3. **Right column — "DeltaTrace operator view":** the **Incident cards** list (class icon, title one-liner, rank, "N alarms grouped", corroborating sources, origin estimate, mean trust bar). A separate **Instrument Advisories** shelf (amber, expandable, with a "restore to alarm list" explainer). A mini **trust strip** (12 chips). Counters: *Operator items*, *Reduction %* (animated), *Critical alarms hidden = 0* (turns red if ever ≠ 0).
4. **Live strip charts** (canvas, 60 s–10 min window selectable): selected sensors' pressure (default PT-4, PT-5, PT-7) with alarm markers and **delay tick marks** showing the expected arrival times; a second chart for flow (FT-in, FT-del, FT-out) and the mass-balance residual.
5. **Incident drawer:** clicking an incident opens the detail view (Section 5.3) in a right-hand drawer without leaving the console.
6. **Fault injector button** + **"Replay last 5 minutes"** (slow-motion 0.25× re-run of the most recent injected event with narration captions).
7. **Engine controls:** toggles *DeltaTrace engine ON/OFF (fail-open)*, *Grouping mode: Delay-window / Fixed 60 s window*, *Trust gating for tuner*, *Clock skew ±s* slider.
8. **Explain overlay (toggle "Show the why"):** draws on the schematic the delay arcs and labels ("20 km ÷ 1000 m/s = 20 s") between alarmed sensors of the selected incident, and highlights why two far-apart alarms were NOT merged.

### 5.3 Incidents (`/incidents`)
- Filter chips by class; sort by rank/time; search by tag.
- Table + detail split view. **Incident detail** includes:
  - Headline summary line and class badge with confidence reasoning ("Why this class?" list: corroboration 0.82 ≥ 0.6; trust mean 0.91; 6 of 7 neighbours agreed in direction within delay window).
  - **Timeline** (canvas): alarms of the incident along time (x) and position in km (y) with the **expected wavefront line** (slope = 1/c); alarms on the line are corroborating; outliers are highlighted.
  - **Member alarm table** (all raw alarms retained; role: headline / member / advisory), with link "show in raw log".
  - **Origin estimate card** (position ± range, residual curve mini-chart), labelled "grouping aid, not a leak locator".
  - **Operator disposition** buttons: *Confirm process event · Mark false alarm · Mark instrument fault · Needs maintenance*. Stored as a label (feeds the tuner and the loop view).
  - **Write-back preview** (the exact simulated tag writes for this incident).
- Closed incidents archive (kept in memory, last 200).

### 5.4 Trust Center (`/trust`)
- **Trust heatmap** (canvas): rows = 15 channels (12 PTs + 3 FTs), columns = time (scrolling), colour = trust (green→amber→red), hover shows value, likely fault, components.
- **Sensor cards grid:** one card per channel with a circular trust gauge, class badge, likely fault type, sparkline of the signal, and four mini bars for the components (Neighbour residual, Mass balance, Signal behaviour, Comms).
- **Sensor detail panel:** predicted vs measured overlay chart; residual z over time; formula with live numbers `T = exp(−(0.15·z² + 1.0·S + 0.8·C + 0.5·M))`; "What does this mean?" plain text.
- **Neighbour graph:** small SVG showing the selected sensor and its neighbours with edge widths = weights and colour = agreement.
- Quick fault buttons beside the selected sensor: *Stuck · Drift · Spike storm · Replay · False drop · Comms loss · Clear*.
- Legend explaining GOOD/UNCERTAIN/BAD and hysteresis.

### 5.5 Alarm Tuner (`/tuner`)
- Select alarm point class (PT-low, PT-high, rate-of-change, flow-deviation) or "All".
- **Current settings** card (threshold, deadband, on-delay) with live alarm load for this class.
- **Run replay** button: runs the candidate grid on the stored history (Section 8). Progress bar + animated "replaying…" timeline. Completes in < 3 s.
- **Pareto chart** (SVG/Recharts allowed here): x = mean detection delay (s), y = alarms per 10 min; all candidates as dots, Pareto front as a stepped green line, current setting = blue dot, recommended = green star, rejected (missed event) = grey cross. Hover tooltip with numbers.
- **Trust gating toggle** (ON/OFF) with a side-by-side "gated vs contaminated" comparison card.
- **Recommendation card:** old → new, evidence ("alarms −42%, false alarms −61%, delay +6 s, missed events 0"), constraint check ticks.
- **Approve & write back** button → confirmation modal showing the simulated writes → applies to the live simulation **immediately** (alarm rate visibly drops in the top-bar chip) → adds a **Management-of-Change record**.
- **Change Log** table (timestamp, who = "Operator", point, old → new, evidence, status Approved/Reverted) with **Revert** button.
- **Loop view:** iteration 0 → 1 → 2 → 3 bars of alarm load, showing the closed-loop improvement (computed by actually re-running the pipeline with the previous iteration's approved settings and operator labels).

### 5.6 Write-back & Audit (`/writeback`)
- Two columns: **Written to control system (simulated)** as a live JSON/OPC-UA-style tag feed, each entry tagged "Dry run / simulated"; and **Audit log** (every grouping decision, demotion, class change, approval, revert, fail-open event) with time, actor (DeltaTrace / Operator), reason.
- Tag examples: `ns=2;s=DeltaTrace.Incident.014.Class = "process-event"`, `.Rank`, `.Origin_km`, `.MemberCount`; `ns=2;s=PT-5.Quality.Derived = "UNCERTAIN"`, `PT-5.Trust = 0.52`; `ns=2;s=PT-5.AlarmCfg.Low.Threshold` (after approval).
- A prominent **"DeltaTrace never issues control commands"** panel with the six safety rules, each with a live compliance check mark (e.g., "Critical alarms hidden: 0 ✓", "Raw alarms retained: 100 % ✓", "Fail-open tested ✓ (toggle to test)").
- Export audit log as CSV / JSON.

### 5.7 Benchmarks (`/benchmarks`)
- Batch-runs scenarios S0–S8 (Section 10) with N seeds (default 5, 1–20) on a simulated 30-minute timeline each, using the **same engine headlessly** (no animation), showing a progress bar.
- Table per scenario: baseline vs DeltaTrace for: peak alarms in any 10 min, % time in flood, alarms/hour, operator items, suppression ratio, time to first correct incident, false incidents, **critical alarms hidden (must be 0)**, classification accuracy.
- Charts: grouped bars (peak alarms baseline vs DeltaTrace), % time in flood, confusion matrix of incident classes.
- **Experiments E1–E7** (cards, run on demand, each with a one-sentence "what this shows" and an honest note if DeltaTrace does not help): E1 trust discrimination (event vs fault), E2 grouping vs fixed window, E3 safety (zero hidden critical alarms across all runs), E4 clock-skew robustness (0/2/4/5 s, delay-window vs fixed), E5 tuner gating ON vs OFF with contaminated data, E6 closed-loop iterations, E7 robustness to fault types.
- Buttons: **Download results (JSON/CSV)**, **Copy as Markdown table**, list the seeds used, label "results are simulated".

### 5.8 Guided Demo (`/demo`)
A scripted, narrated walkthrough (Section 12) with a stepper, big captions, auto-play/skip, and automatic fault injection at the right moments, driving the **Live Console** view embedded or via an overlay on `/console`. Includes a presenter mode (hides sidebar, enlarges text) toggled with `P`.

### 5.9 How It Works / Architecture (`/how-it-works`) — **required, visual**
See Section 11 (a full page with interactive diagrams driven by live data).

### 5.10 Settings (`/settings`)
Wave speed c (400–1200 m/s), clock tolerance (0–5 s), scan interval (fixed 5 s display), hop limit H, trust weights (λ values), thresholds (GOOD ≥ 0.7, BAD < 0.4), corroboration thresholds (process ≥ 0.6, fault < 0.2), demotion rule parameters, advisory retention, seed, theme, "Reset all settings", "Clear saved data". Changes apply to the live engine after confirmation; defaults shown with "restore default" per field.

---

## 6. REAL-TIME ENGINE ARCHITECTURE (how the live simulation runs)

### 6.1 Clock and loop
- **Sim time** advances in **1-second sim steps**. The SCADA scan is every **5 sim-seconds**. At speed 1× one sim-second takes one real second; speeds 5×/10×/30× run multiple steps per animation frame (cap at 30 steps per frame).
- Use a `SimulationRunner` that owns a `Simulation` instance and `requestAnimationFrame`/`setInterval(…, 100)` accumulator logic. UI subscribes through the store at **~10 Hz** (batched snapshots), while canvases read the latest snapshot every animation frame for smooth rendering.
- The simulation is **continuous** (runs indefinitely with a ring buffer of the last 2 hours of data). A `Reset` button restarts with the chosen seed.

### 6.2 Engine interface (pure TypeScript, no React)
```ts
class Simulation {
  constructor(cfg: Config, seed: number)
  step(): void                       // advance 1 sim-second; on scan ticks run SCADA+trust+aggregator
  injectFault(spec: FaultSpec): FaultId   // sensor faults and process events, can be timed (start now or +N s, optional duration)
  clearFault(id: FaultId): void
  clearAllFaults(): void
  setConfig(patch: Partial<Config>): void // wave speed, tolerances, alarm settings, engine on/off, grouping mode
  snapshot(): Snapshot               // immutable view for UI (current values, trust, active alarms, open incidents, KPIs, recent history refs)
  history(): HistoryBuffers          // typed-array ring buffers for charts and tuner
  runHeadless(scenario, seed, cfg): RunResult  // used by benchmarks/tuner; same code path, no UI
}
```
All randomness through a seeded `mulberry32` RNG, so a given `(scenario, seed, config, injection timeline)` is reproducible. The **injection timeline** (what the presenter clicked and when) is recorded so "Replay last 5 minutes" and "Save run" work.

### 6.3 Data flow per scan (5 s)
`true process state → fault/attack layer → RTU sampling with timestamps/skew/quality → baseline alarm logic → trust engine → aggregator (incident update) → classifier & safety rules → write-back log → KPIs → snapshot`.

---

## 7. SIMULATION SPECIFICATION

### 7.1 Pipeline topology (`topology.ts`)
- One product pipeline of **200 km**, flowing west→east.
- **12 nodes** at: `N0=0, N1=20, N2=40, N3=60, N4=80, N5=100, N6=120, N7=140, N8=160, N9=180, N10=190, N11=200` km.
- Node kinds: N0 injection station (pump station PS-1, flow meter FT-in), N4 pump station PS-2, N8 pump station PS-3, N6 delivery tap (FT-del), N11 terminal (FT-out), others sectionalising valve stations.
- Each node has a pressure transmitter `PT-n` and an RTU. Flow meters: `FT-in` (N0), `FT-del` (N6), `FT-out` (N11). Total **15 channels**.
- Helpers: `alongPipeDistance(i,j)`, `hops(i,j)`, `neighbours(i)` (±2 hops with inverse-distance weights), `delay(i,j) = distance_m / c` (default `c = 1000 m/s`, configurable 400–1200).

### 7.2 Process simulator ("hydraulic-lite", `process.ts`)
Not CFD; physically sensible and fast.
- Nominal flow `Q = 600 m³/h` with small noise; FT-del takes `100 m³/h`; the rest goes to FT-out. Flow-meter noise σ = 0.5 % of reading.
- Pressure profile: 62 bar at PS-1 discharge, friction drop ≈ 0.20 bar/km, boosted back to ≈ 55 bar after PS-2 (N4) and PS-3 (N8). PT noise σ = 0.08 bar plus tiny random-walk thermal drift.
- **Transients** are pressure waves travelling both ways from the origin at speed `c`, decaying with distance: `Δp(node,t) = A · exp(−d/Ld) · g(t − t0 − d/c)`, where `g` is a short pulse followed by slower recovery (double exponential) and `Ld = 80 km`.
- **Process events (injectable):**
  - *Pump trip* at PS-1/PS-2/PS-3: downstream drop (A ≈ −6 bar), upstream rise (A ≈ +3 bar), flow dip at FT-out later (lag = distance / 1.2 m/s, clipped).
  - *Valve closure* (partial) at a node: upstream surge (+), downstream drop (−).
  - *Leak* at position x km (slider, default 87) with size small/medium/large (A = −0.6 / −1.5 / −3 bar): negative wave from x, sustained slight decline at nearby PTs, and a **mass imbalance** in the segment containing x (flow-out lower by Q_leak = 15 / 30 / 60 m³/h) visible at the next downstream flow meter after flow lag.
  - *Batch change* (product interface): transient spike at one flow meter (known false-alarm source for flow-deviation).
- Events have optional duration (leaks persist until cleared; trips persist; closures persist) and can be cleared with the injector (represents "repaired").

### 7.3 Sensor faults and attacks (applied to true values → measured values)
- **Stuck:** channel freezes at its last value (jitter ≤ 0.001 bar).
- **Drift:** ramp bias up to ±3 bar over 10 min.
- **Spike storm:** random spikes ±(5–10) bar for 60 s.
- **Replay/spoof:** channel outputs a looped recording of its own earlier normal data, ignoring real changes.
- **False injection ("fake leak"):** channel reports a sudden −5 bar drop while neighbours show nothing.
- **Comms outage:** channel(s) stop updating (stale timestamp), then quality BAD; region option (N6–N8 together).
- **Clock skew:** each RTU timestamp gets a constant offset in [−c_s, +c_s] s (slider up to ±5 s) to test windowing.

### 7.4 Baseline alarm logic (the "before", `scada.ts`)
Scan every **5 s** (sample-and-hold of latest measured values with RTU timestamps). Per PT: **LL, L, H, HH** thresholds as offsets from the local nominal profile (`L = −3.0`, `LL = −5.0`, `H = +3.0`, `HH = +5.0` bar), **rate-of-change** alarm (|dP/dt| > 0.8 bar/10 s), deadband 0.3 bar, on-delay 0 s (deliberately naive so floods occur). Flow alarms: **deviation** between FT-in and FT-out > 4 % of Q for ≥ 20 s (false alarms during batch change), plus low/high flow.
Each alarm: `{id, tag, node, time (RTU timestamp), trueTime, type, severity 1–4, priority (Low/Medium/High/Critical), safetyCritical (LL & HH on PT, flow-imbalance high), state}`.
The baseline must flood (≥ 10 alarms in 10 min) on a pump trip, a leak with several sensors, and the mixed scenario. If it does not, increase severity parameters until it does and document the values in `README.md`.

---

## 8. THE THREE INNOVATIONS — ENGINE SPECS

### 8.1 Trust engine (`trust.ts`) — runs every scan on SCADA-sampled data (never true values)
For each channel i:
1. **Neighbour consistency:** predict `v̂_i` from the two nearest trusted PT neighbours each side using inverse-distance weights plus the nominal pressure-gradient correction. Residual `z_i = (v_i − v̂_i)/σ_i`, σ_i from a rolling robust (MAD) estimate with a floor. If several neighbours move coherently within the expected delay window, **widen σ** (a real transient) instead of punishing the sensor.
2. **Mass balance** (per segment group between flow meters): `m = Q_in − Q_out − Q_del` (with flow lag), normalised by meter accuracy; affects flow-meter trust unless corroborated by PT deviation.
3. **Signal behaviour S:** flat-line (variance in last 60 s ≪ noise floor while ≥ 2 neighbours vary), spike score (count of |Δ| > 4σ jumps that revert within 2 scans), **replay** score (normalised cross-correlation of the last 120 s with an earlier window > 0.98, checked every 30 s), rate-limit score.
4. **Communication C:** `age = now − last_update`; stale if > 15 s; BAD if > 60 s; plus RTU quality code.
5. **Combine:** `T_raw = exp(−(λr·z² + λs·S + λc·C + λm·M))`, defaults `λr=0.15, λs=1.0, λc=0.8, λm=0.5`, z capped at 8. Smooth: `T = 0.3·T_raw + 0.7·T_prev` (slower decay when corroborated). Classes with hysteresis: **GOOD ≥ 0.7, UNCERTAIN 0.4–0.7, BAD < 0.4**; leave BAD only when T ≥ 0.55 for 3 consecutive scans.
6. Output `{channel, T, class, likelyFault: 'stuck'|'drift'|'spike'|'stale'|'replay'|'inconsistent'|null, components}` plus a time series for the heatmap.

**Shared helper `corroboration(channel, tAlarm)`:** trust-weighted fraction of adjacent channels that deviate (|z| > 2.5 or beyond noise) **in the physically consistent sign** within `[τ − δ, τ + δ]`, `τ = delay(channel, neighbour)`, `δ = clockTolerance + scanInterval`.

### 8.2 Delay-based incident grouping (`aggregator.ts`) — streaming
- **Linking rule:** alarms a, b join the same incident if `hops(a,b) ≤ H (3)` and `|t_a − t_b| ≤ delay(a,b) + clockTolerance + scanInterval` (defaults 5 s + 5 s). Implement with union-find over the open-alarm window; an incident **closes after 120 s of inactivity** (configurable). Alarms with no link form singleton incidents (then likely advisories/faults).
- **Fixed-window alternative** (toggle): link if `|Δt| ≤ 60 s` regardless of distance (used for the comparison, E2/E4).
- **Incidents update live:** a card opens at the first alarm, its counters tick up as more alarms arrive, its class may change as evidence accumulates (show a small "reclassified" animation), and it closes after quiet time.
- **Score:** `S = Σ severity_i · T_i^β · (1 + γ·Corr_i)` with β = 1, γ = 1.5.
- **Classification (first match wins):**
  1. **Data-integrity anomaly** if ≥ 2 channels stale/BAD with comms cause, or ≥ 2 channels show a coherent deviation that breaks the physical relationship (flat-line while neighbours/flow change, replay flagged).
  2. **Process event** if mean trust-weighted corroboration ≥ 0.6.
  3. **Instrument fault** if confined to one channel (or BAD-trust channels) and corroboration < 0.2.
  4. **Needs review** otherwise.
- **Protected rules:** a safety-critical alarm is always listed first in `headlineAlarms`. An alarm is **demoted to advisory only if** channel trust < 0.4 AND corroboration < 0.2 AND not safety-critical.
- **Origin estimate (grouping aid, not a leak locator):** grid search `x0 ∈ [0,200]` km (0.5 km step), `t0` to minimise `Σ w_i (t_i − t0 − |x_i − x0|/c)²` over trusted alarms (w_i = T_i); report x0 with ± range from the residual curve. Skip for instrument-fault and data-integrity. Show on the schematic as a pulsing marker with an uncertainty bracket.
- **Ranking:** descending score; critical incidents first.
- **Operator one-liner:** e.g. *"Probable process event · Segment S4–S5 · 6 sources corroborate · likely origin near km 87 (±4) · 2 instrument advisories · 81 alarms grouped"*.
- **Write-back per incident** (simulated tags) when opened/updated/closed; per-channel derived quality flag when the trust class changes.

### 8.3 Trust-gated replay tuner (`tuner.ts`)
- **Training history:** the tuner uses (a) a generated **6-hour training history** at 5 s scan (seeded, different seed from the live run) with 8–12 labelled events (pump trips, valve closures, two leaks), several sensor faults and batch changes; and (b) optionally the **live recorded buffer** plus the operator dispositions as extra labels. Labels = true events with windows (event time to +120 s).
- **Candidates per alarm-point class** (PT-low, PT-high, rate-of-change, flow-deviation): threshold offset `{−1.0, −0.5, 0, +0.5, +1.0, +1.5, +2.0}` (bar; % for flow), deadband `{0.2, 0.3, 0.5, 0.8, 1.2}`, on-delay `{0, 5, 10, 20, 30}` s → ≤ 175 candidates per class. Replay must be fast (typed-array loops; yield to the UI with `await` every ~20 candidates to animate progress).
- **Trust gating:** only samples with `T ≥ Tmin` (0.6) count; toggle off to include faulty-sensor samples (contaminated).
- **Metrics per candidate:** alarms per 10 min (mean and peak), % time in flood, false alarms (outside label windows), per-event detection delay, missed events.
- **Objective:** `J = w1·alarms + w2·falseAlarms + w3·meanDelay + w4·1e6·missed`, defaults `w = [1, 2, 0.05, 1]`, subject to **missed = 0** and **mean delay increase ≤ 20 s** vs current.
- **Output:** all candidates, Pareto front, recommended θ*, a **change proposal** `{point, old, new, reason, evidence}`.
- **Apply:** approving updates the live engine configuration immediately, appends an MOC record, logs a write-back, and persists to `localStorage` if "Save" is chosen. "Revert" restores the previous setting.
- **Loop iterations (E6):** iteration 0 baseline → 1 → 2 → 3, each applying the previous approvals and the operator labels from the previous run.

### 8.4 KPIs (`metrics.ts`) — ISA-18.2 / EEMUA-191 style
Compute for baseline and DeltaTrace views: average alarms per 10 min, **peak alarms in any 10-min window**, **% of 10-min windows > 10 alarms**, **% time in flood** (≥ 10 in rolling 10 min), alarms per hour, stale alarms, time to first correct incident, false incident count, **critical alarms hidden (must be 0)**, classification accuracy vs ground truth. Show commonly used benchmark bands as annotations (about 1 alarm per 10 min acceptable; more than 10 in 10 min is a flood) without quoting standards text.

---

## 9. KEY VISUAL COMPONENTS — DETAILED BEHAVIOUR

### 9.1 Animated pipeline schematic (`PipelineSchematic`) — the signature visual
- Horizontal **200 km pipe** drawn as a thick rounded tube (SVG) with a km ruler (0–200). Subtle **flowing particles** (small chevrons/dots) travelling west→east at a speed proportional to flow (animated with CSS/`requestAnimationFrame`).
- 12 **nodes**: pump stations drawn as pump icons, valve stations as valve icons, delivery tap as a branch with a small tank icon, terminal as a tank. Under each node: tag `PT-n` and a **trust ring** (circular progress) coloured GOOD/UNCERTAIN/BAD, with a soft glow when BAD and a small badge for the likely fault ("STUCK", "REPLAY", "STALE"…).
- **Process events** appear at their position: leak = red burst with drip animation; pump trip = pump icon turns red with ⚠; valve closure = valve icon rotated; batch interface = coloured band moving with the flow.
- **Pressure wave animation:** when a process event starts, draw **expanding concentric blue rings/ripples** travelling left and right along the pipe at a **visual speed scaled to the simulation** (so 1000 m/s ⇒ 200 km in 200 sim-seconds; at 10× it is fast and obvious). Each sensor "pings" when the wave front reaches it (a small flash, then an alarm badge if its limit is crossed).
- **Alarm badges:** raw alarms appear above their node as small red/amber pulses with count; the incident that groups them draws a **translucent violet envelope** over the involved segment(s) with the incident id.
- **Explain overlay:** delay arcs between alarmed neighbours labelled with the delay (`20 km ÷ 1000 m/s = 20 s`), expected vs observed arrival times, and a red "✗ not merged: 150 km apart" label when two simultaneous alarms are far apart.
- **Origin marker:** pulsing crosshair with ± bracket at the estimated origin, plus the true injected position as a hollow marker (toggle "Show ground truth" — only meant for demo/evaluation).
- Hover a node: tooltip with live value, trust, class, last alarm; click: opens Trust detail drawer.
- Perf: SVG for static structure, `<canvas>` overlay for particles/rings, single rAF loop, ≤ 2 ms per frame.

### 9.2 Strip charts (`StripChart`, canvas)
Rolling window (60 s / 5 min / 10 min), multi-series, alarm markers as triangles, delay ticks, hover crosshair with values, pause on hover, 60 fps, device-pixel-ratio aware, theme-aware colours, legend chips to toggle series.

### 9.3 Trust heatmap (`TrustHeatmap`, canvas)
Rows 15 channels × scrolling columns (1 column per scan), perceptual colour scale (green→amber→red) with a pattern/hatch for BAD to avoid colour-only signalling, hover tooltip, click selects channel.

### 9.4 Incident cards and timeline (`IncidentCard`, `IncidentTimeline`)
Cards slide in, show class icon+colour, rank, one-liner, mini trust bar, alarm counter ticker, status (open/closed), and the "reclassified" flash. The timeline plots position (km) vs time with the expected wavefront line and alarm dots (on-line = corroborating, off-line = outliers).

### 9.5 Tickers and gauges
Animated number tween (≈ 500 ms), flood gauge (semi-circle with threshold tick at 10), reduction % ring, KPI sparklines.

### 9.6 Liveliness checklist (must all be visible without user action)
Flowing particles, blinking RTU heartbeat dots, drifting strip charts, scrolling heatmap, ticking sim clock, subtle pulses on active alarms, rotating loop diagram on the Overview. Idle state is never static.

---

## 10. SCENARIOS (also used by Benchmarks and Guided Demo)

Each scenario: `id, name, description, steps (timed fault injections), ground-truth labels, default seed`.

| ID | Name | What happens (30 min) | Ground truth |
|---|---|---|---|
| S0 | Normal operation | Steady state, noise only | no events |
| S1 | Pump trip cascade | PS-2 (N4) trips at 5:00; waves propagate; downstream L/LL and rate alarms across ~8 nodes | 1 process event, origin km 80 |
| S2 | Small leak | Leak at km 87 at 6:00 (medium); PT-4/PT-5 drop, mass imbalance later | 1 process event, origin ≈ km 87 |
| S3 | Single stuck transmitter | PT-7 sticks at 8:00; a small real transient at 14:00 that PT-7 misses | 1 instrument fault + 1 minor process event |
| S4 | Spoofed transmitter | PT-3 replays normal data from 5:00; real valve closure at N5 at 10:00 | 1 data-integrity + 1 process event |
| S5 | False-injection "fake leak" | PT-9 reports a −5 bar drop at 7:00; neighbours unchanged | 1 data-integrity/instrument (not a leak) |
| S6 | Communications outage | RTUs N6–N8 drop at 6:00 for 4 min; real leak at km 40 at 7:30 | 1 data-integrity + 1 process event |
| S7 | Batch interface | Product interface at FT-del at 4:00 and FT-out at 14:00; flow-deviation false alarms | no real event |
| S8 | Mixed stress | Pump trip at PS-3 (N8) at 4:00 + stuck PT-2 at 5:00 + leak at km 150 at 9:00 + clock skew ±4 s + batch change at 12:00 | 2 process events + 1 fault + false alarms |

(Times are mm:ss from start.) The Live Console can also start any scenario as a "script" on top of the running simulation, and the user can add manual injections at any time.

---

## 11. "HOW IT WORKS" / ARCHITECTURE PAGE (required — all visual, driven by live data)

A long, scroll-snapping page with a sticky mini-navigation. Each section has an animated diagram and a short plain-English explanation (students-and-engineers tone, simple words).

1. **The problem in 20 seconds** — animation: one event → wave passes sensors → dozens of alarms + one lying sensor. Live counter from the simulation.
2. **System architecture diagram** (large, animated SVG): *Field level* (pipeline, sensors, RTUs/PLCs) → *Communication* (radio/satellite/cellular, Modbus/DNP3/IEC 60870-5-104/OPC UA) → *Control centre* (central server/SCADA, historian, operator console, GPS time source) → **Read-only gateway** → **DeltaTrace unit** (Pipeline map · Trust engine · Grouping & classification engine · Replay tuner · Write-back module · Audit log) → **write-back interface** → back to the central server (and to field devices as approved settings). Show the **fail-open bypass** and the "no control commands" lock icon. Data packets animate along the arrows; clicking a block opens a side panel with its role, inputs, outputs and the live state from the simulation.
3. **Pipeline map & the delay rule** — animated pipe with a wave and the formula `delay = distance ÷ wave speed`, a slider for wave speed that updates the delays live and shows which alarms would merge.
4. **Innovation 1 — Trust engine** — the four checks as four animated cards feeding one gauge; a live example sensor you can break with buttons (stuck/replay/…) and watch the components and score move; the formula with live numbers; GOOD/UNCERTAIN/BAD with hysteresis.
5. **Innovation 2 — Delay-based grouping** — a step-through: alarms arrive on a position-time plot; the allowed-delay cone is drawn; alarms inside merge, outside don't; corroboration bar fills; decision tree classifies into the four classes; protected-alarm rules panel; "why 150 km-apart alarms are not merged".
6. **Innovation 3 — Replay tuner** — animated pipeline of steps (stored data → trust gate → candidates → replay → measure → reject/select → approve → write back), with the Pareto scatter animating in, and the gating ON/OFF contrast.
7. **The closed loop** — rotating triangle diagram with a live "alarm load per iteration" bar chart.
8. **Safety rules** — six cards with live compliance checks.
9. **Data flow per scan** — a horizontal pipeline of stages with a moving "scan pulse" and the actual timing/volumes from the running engine (alarms in, incidents out, writes issued).
10. **Technology & deployment** — stack, how the demo is simulated, what would change in a real deployment (read-only data gateway, standard protocols, on-premise or cloud, management-of-change workflow).
11. **Glossary** — alarm flood, RTU, SCADA, historian, deadband, on-delay, corroboration, hysteresis, MOC, fail-open.
12. **Honest limits** — simulated data, weights need field calibration, wave speed must be known or estimated, origin estimate is a grouping aid, operator approval always required.

Every diagram must also have a text alternative (visually-hidden description).

---

## 12. GUIDED DEMO SCRIPT (7 minutes, auto-driven)

Stepper with captions (large, bottom-centre) and optional auto-advance. Each step: caption text, camera focus (which part of the UI is highlighted), optional injected fault.

1. **Normal operation** (0:00) — "A 200 km pipeline. Sensors every 20 km. All trusted." Highlight trust rings and the calm flood gauge.
2. **The problem** — inject **Pump trip at PS-2** → waves spread, raw list floods, banner "ALARM FLOOD". Caption: "One event. Dozens of alarms."
3. **Delay-based grouping** — right panel shows **one incident**; Explain overlay on; caption on delay rule; show "not merged" example.
4. **Leak** — inject **leak at km 87** → origin estimate near km 87; caption: "A grouping aid, not a leak locator."
5. **A lying sensor** — inject **Stuck PT-7** → trust ring goes amber→red; alarms become an advisory; "Nothing is hidden."
6. **Spoof/replay** — inject **Replay PT-3** during a real valve closure → data-integrity incident + process event, correctly separated.
7. **Comms outage + leak** — inject S6 → two incidents.
8. **Tuning** — open the Tuner, run replay, show Pareto, toggle trust gating to show contamination, approve the recommendation → live alarm rate drops; MOC record appears.
9. **Fail-open** — turn the engine OFF → right panel mirrors raw alarms; turn it back ON.
10. **Close the loop** — show the loop view and KPIs; summary slide with the six safety rules and "Critical alarms hidden: 0".

Provide **presenter mode** (`P`): bigger fonts, hidden sidebar, caption overlay, a visible countdown/step indicator, and an **"Emergency reset"** (`R`) that clears faults and returns to normal.

---

## 13. STATE, PERSISTENCE AND DATA MODEL

- **Zustand stores:** `useSimStore` (snapshot, controls, speed, running), `useUiStore` (theme, sidebar, drawers, selected incident/channel, presenter mode), `useConfigStore` (engine config, persisted), `useLogStore` (audit log, write-back log, change log), `useToastStore`.
- **localStorage** (guarded `try/catch`, in-memory fallback, namespaced `deltatrace.v1.*`): `theme`, `sidebarCollapsed`, `config`, `changeLog`, `dispositions`, `savedRuns` (max 10), `onboardingSeen`. Provide **Reset/Clear saved data** in Settings. The app must work fully if storage is unavailable.
- Types (`types.ts`): `Channel`, `Node`, `Sample`, `RawAlarm`, `TrustState`, `Incident`, `Advisory`, `FaultSpec`, `Config`, `TunerCandidate`, `ChangeRecord`, `WriteBackEntry`, `AuditEntry`, `KpiSet`, `Scenario`, `Snapshot`.
- **Ring buffers:** typed arrays for 2 h of 1-second true/measured values (15 channels), 5-second trust series, alarm log capped at 5 000 raw alarms (oldest dropped after export prompt), incident archive 200.

---

## 14. FILE TREE (create exactly this, add files if needed)

```
deltatrace-live/
  README.md  PLAN.md  package.json  tsconfig.json  vite.config.ts  vercel.json  index.html
  public/ favicon.svg  og-image.png (simple generated)
  src/
    main.tsx  App.tsx  routes.tsx
    styles/ tokens.css  base.css  shell.css  components.css  pages.css
    engine/
      rng.ts  topology.ts  process.ts  faults.ts  scada.ts  trust.ts
      aggregator.ts  classifier.ts  origin.ts  tuner.ts  writeback.ts
      metrics.ts  scenarios.ts  experiments.ts  simulation.ts  index.ts  types.ts
    state/ simStore.ts  uiStore.ts  configStore.ts  logStore.ts  toastStore.ts  persist.ts  runner.ts
    components/
      shell/ AppShell.tsx  Sidebar.tsx  TopBar.tsx  PageHeader.tsx  CommandPalette.tsx  FaultDrawer.tsx  ToastHost.tsx
      ui/ Card.tsx  Kpi.tsx  Badge.tsx  Chip.tsx  Tooltip.tsx  Popover.tsx  Drawer.tsx  Modal.tsx  Tabs.tsx
          Segmented.tsx  Toggle.tsx  Slider.tsx  Table.tsx  EmptyState.tsx  Skeleton.tsx  Legend.tsx  Ticker.tsx  InfoPopover.tsx
      viz/ PipelineSchematic.tsx  StripChart.tsx  TrustHeatmap.tsx  TrustGauge.tsx  FloodGauge.tsx  IncidentTimeline.tsx
           ParetoChart.tsx  NeighbourGraph.tsx  LoopDiagram.tsx  ArchitectureDiagram.tsx  DelayCone.tsx  Sparkline.tsx
      domain/ RawAlarmList.tsx  IncidentCard.tsx  IncidentDetail.tsx  AdvisoryShelf.tsx  SensorCard.tsx
              TunerPanel.tsx  ChangeLog.tsx  WriteBackFeed.tsx  AuditLog.tsx  SafetyRules.tsx  DemoStepper.tsx  FaultInjector.tsx
    pages/ Overview.tsx  Console.tsx  Incidents.tsx  Trust.tsx  Tuner.tsx  Writeback.tsx
           Benchmarks.tsx  Demo.tsx  HowItWorks.tsx  Settings.tsx  NotFound.tsx
    utils/ format.ts  colors.ts  a11y.ts  download.ts  keyboard.ts
  tests/
    rng.test.ts  topology.test.ts  process.test.ts  trust.test.ts  aggregator.test.ts  classifier.test.ts
    origin.test.ts  tuner.test.ts  metrics.test.ts  safety.test.ts  scenarios.test.ts  simulation.test.ts  persist.test.ts
```

---

## 15. TESTS (vitest — all must pass; engine is pure so tests are fast)

1. `rng`: determinism, gaussian mean/variance.
2. `topology`: distances, hops, delays (20 km ÷ 1000 m/s = 20 s; configurable `c`).
3. `process`: wave arrival times match distance/c within 1 s; leak creates mass imbalance; pump trip signs correct.
4. `trust`: healthy sensors stay GOOD; stuck → UNCERTAIN/BAD with `stuck`; replay detected; comms outage → stale/BAD; **a real event seen by several neighbours does not push healthy sensors to BAD**; hysteresis respected.
5. `aggregator`: two simultaneous alarms **150 km apart are not merged**; adjacent-node alarms within delay + tolerance **are merged**; fixed-window mode merges the far pair (documenting the difference); incident closes after quiet time.
6. `classifier`: S1/S2 → process-event; stuck PT → instrument-fault (advisory); S4/S5 → data-integrity or instrument-fault, **never process-event**; S6 → one data-integrity + one process-event separated.
7. `origin`: leak at km 87 estimated within ±6 km on S2 with default settings.
8. `safety` (property-style, many seeds): **critical alarms hidden = 0 in every scenario/seed**; every raw alarm appears in the audit linkage; engine OFF ⇒ operator list equals raw list (fail-open); no function in the engine emits a "control command".
9. `tuner`: recommended setting has missed = 0; gating OFF produces a worse (or equal) recommendation on contaminated data; Pareto front is non-dominated; approval changes live alarm settings.
10. `metrics`: flood detection, peak-window computation, time-to-first-correct-incident.
11. `scenarios`: baseline floods in S1 and S8; S0 and S7 have no true process events; full-run determinism for a fixed seed.
12. `simulation`: stepping 1 800 s completes in < 1.5 s in node; injecting then clearing a fault restores trust to GOOD within a bounded time.
13. `persist`: works when `localStorage` throws.

Add a few React Testing Library smoke tests: routes render, theme toggle works, fault drawer opens, fault injection updates raw list.

---

## 16. DEPLOYMENT (Vercel)

- `npm run build` → `dist/`. Add `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```
- `README.md` must contain: what the app is, how to run (`npm i && npm run dev`), how to test, how to deploy to Vercel (import repo, framework preset Vite, build `npm run build`, output `dist`), the 7-minute demo script summary, keyboard shortcuts, assumptions, honest limitations, and the sentence: *"All data is simulated; this is a demonstration, not a validated safety product."*
- Add `<title>`, meta description and a simple generated favicon/OG image. No external requests.

---

## 17. BUILD PHASES (run tests + build after each)

1. **Scaffold & design system:** Vite + TS, tokens, AppShell, Sidebar, TopBar, theme, routing, shared UI components, toasts, command palette skeleton.
2. **Engine core:** rng, topology, process, faults, scada baseline, simulation loop, metrics; tests.
3. **Trust engine** + tests.
4. **Aggregator, classifier, origin, safety rules, write-back log** + tests.
5. **Live runner + stores + Live Console** with PipelineSchematic, StripChart, RawAlarmList, flood gauge, IncidentCard list, fault injector drawer. This is the most important phase: make it beautiful and smooth.
6. **Incidents and Trust Center pages** (timeline, heatmap, sensor cards, neighbour graph).
7. **Tuner** (engine + page + MOC log + live apply + loop view) + tests.
8. **Write-back & Audit, Settings, persistence.**
9. **Benchmarks** (headless batch + experiments E1–E7 + exports).
10. **Overview, How It Works, Guided Demo / presenter mode.**
11. **Polish:** accessibility pass, reduced motion, empty/loading states, responsive checks, bundle analysis and code-splitting, final README, final `npm test && npm run build`.

---

## 18. ACCEPTANCE CHECKLIST (verify before finishing)

1. App opens on Overview; sidebar and top bar identical on all pages; theme toggle works; nothing is blank or broken in either theme.
2. Live Console is animated without any click: flowing particles, moving charts, scrolling heatmap, ticking clock.
3. Injecting a **pump trip** shows a visible wave, a raw-alarm flood (≥ 10 in 10 min) on the left and a **much smaller** number of operator items on the right, **0 critical alarms hidden**.
4. **Leak at km 87** → one process-event incident with an origin estimate within ±6 km, delay arcs in the Explain overlay, and a correct "not merged" example for far-apart alarms.
5. **Stuck PT-7** → trust ring turns amber/red with a "STUCK" badge; its alarms become an Instrument Advisory; nothing is deleted.
6. **Replay PT-3** and **false-injection PT-9** → data-integrity class, never process-event.
7. **Comms outage + leak** → two incidents, correctly separated.
8. **Tuner**: replay runs in < 3 s; Pareto chart renders; trust gating ON vs OFF difference is shown; approving a setting reduces the live alarm rate and creates an MOC record; Revert works.
9. **Fail-open** toggle makes the DeltaTrace view mirror the raw alarms; toggling back restores incidents.
10. **Write-back & Audit** shows simulated tag writes and audit entries for everything above; exports work.
11. **Benchmarks** run S0–S8 and E1–E7 headlessly and display tables/charts; honest notes appear where DeltaTrace does not help.
12. **How It Works** page is fully visual, interactive and driven by live data; every diagram has a text alternative.
13. **Guided Demo** drives the full 10-step story hands-free; presenter mode and emergency reset work.
14. `npm run typecheck`, `npm test` and `npm run build` all pass; initial bundle < 400 kB gzipped; no network requests at runtime; works offline.
15. No real company names, no logos, "Simulated data — demonstration only" visible on every page.

---

## 19. FINAL MESSAGE TO ME (Claude Code)

When finished, send a short report: what was built, test results, build size, the measured numbers for S1 and S8 (baseline vs DeltaTrace: peak alarms in 10 min, % time in flood, operator items, critical alarms hidden), any scenario where DeltaTrace did not help, any assumptions made, and the exact commands to run locally and deploy on Vercel.
