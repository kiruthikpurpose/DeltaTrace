/** Namespaced localStorage with an in-memory fallback; never throws. */
const NS = 'deltatrace.v1.';
const mem = new Map<string, string>();

export function load<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(NS + key);
  } catch {
    raw = mem.get(NS + key) ?? null;
  }
  if (raw === null) raw = mem.get(NS + key) ?? null;
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
export function save<T>(key: string, value: T): void {
  const s = JSON.stringify(value);
  mem.set(NS + key, s);
  try {
    window.localStorage.setItem(NS + key, s);
  } catch {
    /* storage unavailable: memory fallback already updated */
  }
}
export function remove(key: string): void {
  mem.delete(NS + key);
  try {
    window.localStorage.removeItem(NS + key);
  } catch {}
}
export function clearAll(): void {
  for (const k of [...mem.keys()]) if (k.startsWith(NS)) mem.delete(k);
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(NS)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
}
