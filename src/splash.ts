/** Tells the launch screen (public/splash.js) that the first page is ready so it can dock into the sidebar. */
export function runSplash(): void {
  const api = (window as unknown as { __deltaSplash?: { ready: () => void } }).__deltaSplash;
  if (!api) return;
  void Promise.all([import('./pages/Overview'), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))])
    .catch(() => undefined)
    .then(() => api.ready());
}
