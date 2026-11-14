const MIN_MS = 3400;
const KEY = 'deltatrace.splash';

/** Dismisses the launch screen once the minimum time has passed and the first page is ready. */
export function runSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('leaving');
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* storage unavailable */
    }
    window.setTimeout(() => {
      el.remove();
      document.documentElement.classList.remove('splash-on');
    }, 850);
  };
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const minimum = new Promise<void>((r) => window.setTimeout(r, reduce ? 900 : MIN_MS));
  const ready = Promise.all([import('./pages/Overview'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))]).catch(() => undefined);
  void Promise.all([minimum, ready]).then(() => {
    el.classList.add('ready'); // progress bar completes
    window.setTimeout(close, 380);
  });
  const skip = () => window.setTimeout(close, 0);
  el.addEventListener('click', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
}
