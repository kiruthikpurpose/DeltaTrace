# Development guide

## Requirements

Node 18 or newer and npm. No other tooling is needed.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | Install exact dependencies |
| `npm run dev` | Development server on port 5173 |
| `npm test` | Vitest suites (jsdom) |
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint 9 |
| `npm run build` | Typecheck and production build |
| `npm run check:splash` | Syntax check of the launch screen script |
| `npm run check:bundle` | Fails if initial JavaScript exceeds 400 kB gzip |
| `npm run diagrams` | Regenerate README diagrams in `docs/images` |
| `npm run ci` | All of the above in CI order |

## Stack

Vite 5, React 18, TypeScript (strict), react-router-dom 6 with lazy routes, Zustand 5, lucide-react, clsx. Tests use Vitest and Testing Library. Charts, the pipeline schematic, the PDF writer and the launch animation are hand-written SVG, canvas and plain JavaScript; there is no chart library.

## Source layout

```text
public/splash.js        Launch animation (runs before the bundle loads)
src/engine/             Pure simulation and the three functions
src/state/              Runner, stores, persistence
src/components/         shell, ui, viz (SVG and canvas), domain
src/pages/              One module per route
src/styles/             Tokens and component CSS
src/utils/              Formatting, PDF writer, report builders, a11y hooks
tests/                  Unit, property, scenario, safety and UI tests
scripts/                Diagram generator, bundle check
```

## Rules for the engine

- Pure TypeScript: no React, DOM or network access.
- Randomness only through the seeded generator in `rng.ts` so runs are reproducible.
- Nothing in the engine may issue a control command. `tests/safety.test.ts` scans for this.
- Raw alarms are never dropped; demotion creates an advisory.

## The runner

`src/state/runner.ts` owns the live `Simulation`. It advances simulated time in whole seconds according to the selected speed, runs a scan every 5 simulated seconds, and publishes an immutable snapshot to the store at about 10 Hz. It records every injection and configuration change so the last five minutes can be replayed and benchmarks can be re-run headless. While the launch animation is on screen the runner waits, and starts on the `deltatrace:splash-done` event.

## Adding a fault type

1. Add the type to `SensorFaultType` or `EventType` in `src/engine/types.ts`.
2. Implement its effect in `faults.ts` (sensor faults) or `process.ts` (process events).
3. Add detection evidence in `trust.ts` if it needs a new signal.
4. Add a quick fault or injector control in `components/domain/FaultInjector.tsx`.
5. Cover it in a scenario or `tests/` and, if useful, in experiment E7.

## Adding a page

Create `src/pages/<Name>.tsx` with a default export, add it to `NAV` and the route list in `src/routes.tsx`, and add a smoke test in `tests/app.test.tsx`.

## Styling

Colours are CSS custom properties defined for light and dark in `src/styles`. Use tokens, not hard-coded colours. Components must work from 360 px wide. Respect `prefers-reduced-motion`.

## Launch screen

`public/splash.js` and the inline CSS in `index.html` draw the animation without waiting for the application. `src/splash.ts` signals readiness once the first route has loaded. The mark flies to `#brand-logo` (or `#brand-logo-m` on phones); keep those ids when changing the shell.

## Continuous integration

`.github/workflows/ci.yml` runs `npm ci`, typecheck, lint, tests, build and the bundle check on Node 18, 20 and 22 for every push to `main` and every pull request.

## Releasing

1. Update `CHANGELOG.md`.
2. Run `npm run ci`.
3. Tag the commit and deploy `dist/` (see the README for Vercel).
