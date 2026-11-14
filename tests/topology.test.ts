import { describe, it, expect } from 'vitest';
import { alongPipeDistance, hops, delay, neighbours, CHANNELS, NODES, nominalPressureAt } from '../src/engine';

describe('topology', () => {
  it('has 12 nodes and 15 channels over 200 km', () => {
    expect(NODES.length).toBe(12);
    expect(CHANNELS.length).toBe(15);
    expect(NODES[11].km).toBe(200);
  });
  it('distances, hops and delays', () => {
    expect(alongPipeDistance(3, 4)).toBe(20);
    expect(alongPipeDistance(9, 10)).toBe(10);
    expect(hops(2, 6)).toBe(4);
    expect(delay(3, 4)).toBe(20); // 20 km ÷ 1000 m/s = 20 s
    expect(delay(3, 4, 500)).toBe(40);
  });
  it('neighbours are ±2 hops with inverse-distance weights', () => {
    const n = neighbours(5);
    expect(n.map((x) => x.node)).toEqual([3, 4, 6, 7]);
    expect(n[1].w).toBeGreaterThan(n[0].w);
  });
  it('pumps boost pressure back to ~55 bar', () => {
    expect(nominalPressureAt(0)).toBe(62);
    expect(nominalPressureAt(80)).toBe(55);
    expect(nominalPressureAt(160)).toBe(55);
  });
});
