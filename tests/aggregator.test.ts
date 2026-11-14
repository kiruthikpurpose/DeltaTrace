import { describe, it, expect } from 'vitest';
import { Aggregator, DEFAULT_CONFIG, TrustEngine, type RawAlarm } from '../src/engine';

let id = 1;
function alarm(node: number, time: number, over: Partial<RawAlarm> = {}): RawAlarm {
  return {
    id: id++, tag: `PT-${node}`, ch: node, node, type: 'ROC', severity: 2, priority: 'Medium', safetyCritical: false,
    time, trueTime: time, value: 0, state: 'active', source: 'scada', trustAtRaise: 1, ...over,
  };
}
const hooks = { audit() {}, wb() {}, event() {} };

describe('aggregator', () => {
  it('does not merge simultaneous alarms 150 km apart; merges adjacent ones; fixed window merges the far pair', () => {
    const trust = new TrustEngine();
    const agg = new Aggregator(hooks);
    agg.ingest(alarm(1, 100), 100, DEFAULT_CONFIG, trust);
    agg.ingest(alarm(9, 100), 100, DEFAULT_CONFIG, trust); // 160 km away
    expect(agg.open.length).toBe(2);
    agg.ingest(alarm(2, 112), 112, DEFAULT_CONFIG, trust); // 20 km → 20 s + 10 s tolerance
    expect(agg.open.length).toBe(2);
    expect(agg.open.find((i) => i.alarmIds.length === 2)).toBeTruthy();

    const fixed = new Aggregator(hooks);
    const cfg = { ...DEFAULT_CONFIG, groupingMode: 'fixed' as const };
    fixed.ingest(alarm(1, 100), 100, cfg, trust);
    fixed.ingest(alarm(9, 100), 100, cfg, trust);
    expect(fixed.open.length).toBe(1);
  });
  it('alarms outside the delay window are not merged', () => {
    const trust = new TrustEngine();
    const agg = new Aggregator(hooks);
    agg.ingest(alarm(1, 100), 100, DEFAULT_CONFIG, trust);
    agg.ingest(alarm(2, 140), 140, DEFAULT_CONFIG, trust); // 40 s > 20 + 10
    expect(agg.open.length).toBe(2);
  });
  it('closes an incident after the quiet time', () => {
    const trust = new TrustEngine();
    const agg = new Aggregator(hooks);
    agg.ingest(alarm(1, 100), 100, DEFAULT_CONFIG, trust);
    agg.tick(150, DEFAULT_CONFIG, trust);
    expect(agg.open.length).toBe(1);
    agg.tick(230, DEFAULT_CONFIG, trust);
    expect(agg.open.length).toBe(0);
    expect(agg.archive.length).toBe(1);
    expect(agg.archive[0].alarmIds.length).toBe(1); // raw alarm retained
  });
});
