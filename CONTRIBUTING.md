# Contributing to DeltaTrace Live

Thank you for considering a contribution. This guide covers setup, conventions and what a good pull request looks like.

## Getting started

```bash
git clone https://github.com/kiruthikpurpose/DeltaTrace.git
cd DeltaTrace
npm ci
npm run dev
```

Node 18 or newer is required.

## Before you open a pull request

Run the same checks as CI:

```bash
npm run ci      # typecheck, lint, tests, production build, bundle budget
```

All of them must pass.

## Project conventions

| Area | Rule |
|---|---|
| Engine (`src/engine`) | Pure TypeScript. No React, no DOM, no network. All randomness goes through the seeded RNG so runs stay reproducible. |
| UI (`src/components`, `src/pages`) | Hand-written SVG and canvas for anything that updates more than twice a second. No chart or UI libraries. |
| Dependencies | Keep the runtime dependency list short. A new runtime dependency needs a clear reason in the pull request. |
| Styling | Use the tokens in `src/styles/tokens.css`. Do not hard-code colours. Colour is reserved for alarm priority, trust state and incident class. |
| Accessibility | Text must meet WCAG AA contrast in both themes. Diagrams and canvases need a text alternative. Motion must respect `prefers-reduced-motion`. |
| Tests | Behaviour changes need a test in `tests/`. Engine changes should keep the safety tests green. |

## Safety rules are not negotiable

Any change to grouping, classification, demotion or write-back must keep these true, and the tests in `tests/safety.test.ts` must still pass:

1. Safety-critical alarms are never hidden.
2. Low trust alone never deletes an alarm.
3. A corroborated alarm is never demoted.
4. Every raw alarm is retained and linked.
5. With the engine off, raw alarms pass through unchanged.
6. The engine never issues control commands.

## Pull request checklist

- Small, focused change with a clear description.
- Tests added or updated.
- Screenshots for visible UI changes (light and dark).
- `npm run ci` passes.

## Reporting bugs

Open an issue with the seed shown in the top bar, the faults you injected, and your browser. A seed plus an injection list reproduces a run exactly.

## Security

Please report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
