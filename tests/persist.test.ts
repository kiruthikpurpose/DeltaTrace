import { describe, it, expect, vi, afterEach } from 'vitest';

describe('persist', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('works when localStorage throws', async () => {
    const boom = () => {
      throw new Error('storage unavailable');
    };
    vi.stubGlobal('window', {
      localStorage: { getItem: boom, setItem: boom, removeItem: boom, key: boom, get length(): number { throw new Error('x'); } },
    });
    const { load, save, remove, clearAll } = await import('../src/state/persist');
    expect(() => save('k', { a: 1 })).not.toThrow();
    expect(load('k', null)).toEqual({ a: 1 }); // in-memory fallback
    expect(load('missing', 42)).toBe(42);
    expect(() => remove('k')).not.toThrow();
    expect(() => clearAll()).not.toThrow();
  });
  it('round-trips through a working storage and survives corrupt JSON', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; } },
    });
    const { load, save } = await import('../src/state/persist');
    save('cfg', { x: 2 });
    expect(store.get('deltatrace.v1.cfg')).toBe('{"x":2}');
    store.set('deltatrace.v1.bad', '{not json');
    expect(load('bad', 'fallback')).toBe('fallback');
  });
});
