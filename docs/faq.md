# FAQ and troubleshooting

## Does DeltaTrace replace the SCADA alarm system?

No. It runs beside it, reads data and alarms, and writes back only incident records, data-quality flags and operator-approved settings. If DeltaTrace is off or fails, SCADA alarms reach the operator unchanged.

## Can it hide a safety-critical alarm?

No. Safety-critical alarms are never demoted and lead their incident headline. This is tested across many seeds and by experiment E3.

## Why was an alarm moved to an Instrument Advisory?

The channel had low trust and nothing nearby corroborated the alarm. The alarm is still in the advisory shelf and the raw list, and can be retrieved for one hour by default.

## Why were two events merged into one incident?

They overlapped in time and place so that one pressure wave could explain both. Experiment E2 documents this limit.

## Why did one event split into several incidents?

Clock differences between RTUs may exceed the clock tolerance. Raise the tolerance in Settings (experiment E4).

## The tuner recommends nothing.

No feasible candidate improved on the current setting, or alarm load is already low. This is a valid result.

## The launch animation does not play.

It is skipped when the operating system asks for reduced motion. Otherwise it plays on every page load.

## The simulation looks frozen.

Check that it is not paused (`Space`) and that the launch animation has finished. Use Reset to restart with the same seed.

## How do I reproduce a run?

Use the same seed (top bar), the same settings and the same injections. The runner replays recorded injections for the last five minutes.

## How do I clear my settings?

Settings, then Clear saved data. Or remove the `deltatrace.v1.*` keys from local storage.

## Which browsers are supported?

Current versions of Chrome, Edge, Firefox and Safari.
