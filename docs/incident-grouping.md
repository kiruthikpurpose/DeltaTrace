# Delay-based incident grouping

Source: `src/engine/aggregator.ts`, `classifier.ts`, `origin.ts`. Tests: `tests/aggregator.test.ts`, `tests/classifier.test.ts`, `tests/origin.test.ts`, `tests/safety.test.ts`.

## The idea

A pressure wave moves along the line at a roughly known speed. If a sensor 20 km away alarms 20 s after the first one, one event can explain both. If a sensor 150 km away alarms at the same moment, it cannot. The delay between two alarms therefore decides whether they belong together, instead of an arbitrary fixed time window.

## Linking rule

Two alarms are linked when both conditions hold:

1. The nodes are within `hopLimit` hops (default 3).
2. `|t1 - t2| <= distance / waveSpeed + clockTol + scanInterval`.

With the defaults (1000 m/s, 5 s clock tolerance, 5 s scan interval), 20 km gives 20 s + 10 s = 30 s. The clock tolerance absorbs real RTU timestamp differences. Experiment E4 shows what happens with a tolerance of zero.

Communications and no-change alarms describe an instrument, not the process, so they group only with their own kind.

## Incident lifecycle

- A new alarm joins the best matching open incident or opens a new one.
- An incident closes after `incidentQuiet` seconds (default 120) without new members.
- If the same alarm recurs on a recently closed incident, the incident is reopened and the event is written to the audit log.
- Every raw alarm stays attached to its incident or to an advisory.

## Classification

The first matching rule wins.

| Class | Rule |
|---|---|
| Data integrity | Two or more channels stale or bad with a communications cause, or a replayed or flat-lined channel while neighbours change |
| Process event | Trust-weighted corroboration >= `corrProcess` (0.6) |
| Instrument fault | One channel, or only low-trust channels, and corroboration < `corrFault` (0.2) |
| Needs review | Everything else |

Each incident stores the reasons that led to its class, shown on the incident detail page.

## Demotion to advisory

A raw alarm is demoted from the operator list only when both hold: the channel trust is below `demoteTrust` (0.4) and corroboration is below `demoteCorr` (0.2). A demoted alarm becomes an Instrument Advisory that remains visible and retrievable for `advisoryRetention` seconds (default 1 hour). Safety-critical alarms are never demoted.

## Ranking and headline

Open incidents are ranked with safety-critical incidents first, then by score. Within an incident, the headline alarm is chosen by safety-critical status first, then severity, then earliest time, so a safety-critical member always leads.

## Origin estimate

For process events the engine fits the origin position by grid search over the line, minimising the mismatch between observed arrival times and `distance / waveSpeed`. The result is a grouping aid with an uncertainty range, not a leak locator.

## Known limits

- Events that overlap in both time and place can merge into one incident (experiment E2 shows this honestly for medium leaks).
- A wrong wave speed shifts every window.
