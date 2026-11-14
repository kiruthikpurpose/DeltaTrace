# PLAN — DeltaTrace Live

## Phases
1. Scaffold & design system (Vite, tokens, shell, routing, shared UI)
2. Engine core (rng, topology, process, faults, scada, simulation, metrics)
3. Trust engine
4. Aggregator, classifier, origin, safety rules, write-back log
5. Runner + stores + Live Console (schematic, strip charts, raw list, incidents, fault drawer)
6. Incidents + Trust Center
7. Tuner (engine + page + MOC + loop view)
8. Write-back & Audit, Settings, persistence
9. Benchmarks (S0–S8, E1–E7)
10. Overview, How It Works, Guided Demo / presenter mode
11. Polish (a11y, reduced motion, code-splitting, README)

## File tree
As specified in the build spec §14, built at the repository root (no extra `deltatrace-live/` nesting).

## Risks
- Trust false positives during real transients → neighbour-lag exclusion + coherence-based σ widening.
- Baseline must flood → water-hammer "ringing" component added to transients (documented in README).
- Headless benchmark cost → allocation-free steps; yielding between runs.
- Bundle size → route-level `React.lazy`, hand-written SVG/canvas, Recharts only on Tuner/Benchmarks.
