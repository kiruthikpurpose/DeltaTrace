import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('start-up with corrupted saved data', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  it('ignores wrongly typed saved config, seed and logs instead of crashing', async () => {
    localStorage.setItem('deltatrace.v1.config', JSON.stringify({ waveSpeed: 'fast', hopLimit: 4, alarms: { roc: { limit: 'x' }, ptLow: { limit: 2, deadband: 0.2, onDelay: 5 } }, bogus: 1 }));
    localStorage.setItem('deltatrace.v1.seed', JSON.stringify('abc'));
    localStorage.setItem('deltatrace.v1.changeLog', JSON.stringify({ not: 'an array' }));
    localStorage.setItem('deltatrace.v1.dispositions', JSON.stringify([1, 2]));
    const { useConfigStore } = await import('../src/state/configStore');
    const { useLogStore } = await import('../src/state/logStore');
    const { DEFAULT_CONFIG } = await import('../src/engine');
    const { cfg, seed } = useConfigStore.getState();
    expect(cfg.waveSpeed).toBe(DEFAULT_CONFIG.waveSpeed);
    expect(cfg.hopLimit).toBe(4);
    expect(cfg.alarms.roc).toEqual(DEFAULT_CONFIG.alarms.roc);
    expect(cfg.alarms.ptLow).toEqual({ limit: 2, deadband: 0.2, onDelay: 5 });
    expect(seed).toBe(42);
    expect(useLogStore.getState().changeLog).toEqual([]);
    expect(useLogStore.getState().dispositions).toEqual({});
    const { runner } = await import('../src/state/runner');
    expect(runner.sim.t).toBe(0);
  });
});

describe('runner replay safety', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  it('an operator action during a replay ends the replay and acts on the live run', async () => {
    const { runner } = await import('../src/state/runner');
    const { useSimStore } = await import('../src/state/simStore');
    runner.setSpeed(5);
    runner.inject({ type: 'pumpTrip', node: 4 });
    for (let i = 0; i < 60; i++) runner.sim.step();
    const live = runner.sim;
    runner.startReplay();
    expect(useSimStore.getState().replaying).toBe(true);
    expect(runner.sim).not.toBe(live);
    runner.inject({ type: 'stuck', channel: 7 });
    expect(useSimStore.getState().replaying).toBe(false);
    expect(runner.sim).toBe(live);
    expect(runner.speed).toBe(5);
    expect(live.timeline.filter((e) => e.kind === 'fault')).toHaveLength(2);
  });
  it('reset during a replay restores the live speed', async () => {
    const { runner } = await import('../src/state/runner');
    runner.setSpeed(10);
    runner.inject({ type: 'leak', km: 40 });
    for (let i = 0; i < 40; i++) runner.sim.step();
    runner.startReplay();
    expect(runner.speed).toBe(0.25);
    runner.reset();
    expect(runner.speed).toBe(10);
  });
  it('visual time never runs more than one second ahead of the engine', async () => {
    const { runner } = await import('../src/state/runner');
    expect(runner.visualTime() - runner.sim.t).toBeLessThanOrEqual(1);
  });
});
