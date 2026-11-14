import { afterEach, describe, it, expect } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { runner } from '../src/state/runner';

const mount = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

afterEach(() => cleanup());

describe('app smoke tests', () => {
  it('renders every route', async () => {
    const routes: [string, RegExp][] = [
      ['/', /Fewer alarms/i],
      ['/console', /Live Console/],
      ['/incidents', /^Incidents$/],
      ['/trust', /Trust Center/],
      ['/tuner', /Alarm Tuner/],
      ['/writeback', /Write-back & Audit/],
      ['/benchmarks', /^Benchmarks$/],
      ['/demo', /Guided Demo/],
      ['/how-it-works', /How It Works/],
      ['/settings', /^Settings$/],
      ['/nope', /Page not found/],
    ];
    for (const [path, h] of routes) {
      const { unmount } = mount(path);
      await waitFor(() => expect(screen.getAllByRole('heading', { level: 1 }).some((e) => h.test(e.textContent ?? ''))).toBe(true), { timeout: 8000 });
      expect(screen.getAllByText(/Simulated data/i).length).toBeGreaterThan(0);
      unmount();
      cleanup();
    }
  });

  it('theme toggle works', async () => {
    mount('/');
    const before = document.documentElement.dataset.theme;
    fireEvent.click(await screen.findByRole('button', { name: /Switch to (light|dark) theme/ }));
    await waitFor(() => expect(document.documentElement.dataset.theme).not.toBe(before));
  });

  it('fault drawer opens and injecting a fault updates the raw alarm list', async () => {
    mount('/console');
    fireEvent.click(await screen.findByRole('button', { name: /Inject fault \(F\)/ }));
    expect(await screen.findByRole('dialog', { name: /Fault injector/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pump trip at PS-2/ }));
    act(() => {
      for (let i = 0; i < 200; i++) runner.sim.step();
      runner.setSpeed(1); // forces a snapshot push
    });
    await waitFor(() => expect(document.querySelectorAll('.alarm-row').length).toBeGreaterThan(3));
    expect(screen.getByText(/ALARM FLOOD/)).toBeTruthy();
  });
});
