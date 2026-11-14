import { useEffect, useRef, useState } from 'react';
import { CHANNELS, NOMINAL, type Simulation } from '../../engine';
import { runner } from '../../state/runner';
import { useUiStore } from '../../state/uiStore';
import { readTheme } from '../../utils/colors';

export interface StripSeries {
  id: string;
  label: string;
  /** channel index, or custom value function */
  ch?: number;
  fn?: (sim: Simulation, t: number) => number;
  color?: string;
}
interface Props {
  series: StripSeries[];
  windowSec: number;
  height?: number;
  unit: string;
  title: string;
  minSpan?: number;
  showAlarms?: boolean;
  showDelayTicks?: boolean;
}

/** Canvas strip chart: rolling window, alarm triangles, delay ticks, hover crosshair (pauses on hover). */
export function StripChart({ series, windowSec, height = 190, unit, title, minSpan = 1, showAlarms = true, showDelayTicks = true }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const theme = useUiStore((s) => s.theme);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const hover = useRef<{ x: number } | null>(null);
  const frozen = useRef<number | null>(null);
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);
  const propsRef = useRef({ series, windowSec, unit, minSpan, showAlarms, showDelayTicks });
  propsRef.current = { series, windowSec, unit, minSpan, showAlarms, showDelayTicks };

  const valueOf = (sim: Simulation, s: StripSeries, t: number) => (s.fn ? s.fn(sim, t) : sim.measAt(s.ch!, t) - NOMINAL[s.ch!]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0;
    let colors = readTheme();
    const resize = () => {
      if (!wrap.current) return;
      const dpr = window.devicePixelRatio || 1;
      w = wrap.current!.clientWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    colors = readTheme();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current!);
    let lastDraw = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastDraw < 33) return;
      lastDraw = now;
      const p = propsRef.current;
      const sim = runner.sim;
      const L = 46;
      const R = 10;
      const T = 8;
      const B = 22;
      const pw = w - L - R;
      const ph = height - T - B;
      const tNow = frozen.current ?? Math.floor(runner.visualTime());
      const tFrac = frozen.current !== null ? 0 : runner.visualTime() - Math.floor(runner.visualTime());
      const t0 = tNow - p.windowSec;
      const vis = p.series.filter((s) => !hiddenRef.current.has(s.id));
      // scale
      let mn = Infinity;
      let mx = -Infinity;
      const step = Math.max(1, Math.floor(p.windowSec / 300));
      const data: { s: StripSeries; vals: number[] }[] = [];
      for (const s of vis) {
        const vals: number[] = [];
        for (let t = Math.max(0, t0); t <= tNow; t += step) {
          const v = valueOf(sim, s, t);
          vals.push(v);
          if (Number.isFinite(v)) {
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
        }
        data.push({ s, vals });
      }
      if (!Number.isFinite(mn)) {
        mn = -1;
        mx = 1;
      }
      let span = Math.max(p.minSpan, mx - mn);
      const mid = (mx + mn) / 2;
      mn = mid - span * 0.6;
      mx = mid + span * 0.6;
      span = mx - mn;
      const X = (t: number) => L + ((t - t0 - tFrac * 0) / p.windowSec) * pw;
      const Y = (v: number) => T + (1 - (v - mn) / span) * ph;
      ctx.clearRect(0, 0, w, height);
      ctx.font = '11px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.axis;
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const v = mn + (span * i) / 4;
        const y = Y(v);
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(w - R, y);
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.fillText(v.toFixed(Math.abs(span) < 5 ? 2 : 1), L - 6, y);
      }
      ctx.textAlign = 'center';
      const tickEvery = p.windowSec <= 60 ? 10 : p.windowSec <= 300 ? 60 : 120;
      for (let tt = Math.ceil(t0 / tickEvery) * tickEvery; tt <= tNow; tt += tickEvery) {
        ctx.beginPath();
        ctx.moveTo(X(tt), T);
        ctx.lineTo(X(tt), T + ph);
        ctx.stroke();
        ctx.fillText(`−${tNow - tt}s`, X(tt), height - 8);
      }
      ctx.fillText('now', w - R - 8, height - 8);
      // zero line
      if (mn < 0 && mx > 0) {
        ctx.strokeStyle = colors.axis;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(L, Y(0));
        ctx.lineTo(w - R, Y(0));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // delay ticks for latest wave
      if (p.showDelayTicks) {
        const ev = [...sim.faults.procEvents].reverse().find((e) => e.type !== 'batch' && sim.t - e.t0 < 400 && e.t0 >= t0 - 100);
        if (ev) {
          ctx.setLineDash([2, 3]);
          ctx.lineWidth = 1.2;
          for (const s of vis) {
            if (s.ch === undefined || s.ch >= 12) continue;
            const exp = ev.t0 + (Math.abs(CHANNELS[s.ch].km - ev.km) * 1000) / sim.cfg.waveSpeed;
            if (exp < t0 || exp > tNow) continue;
            ctx.strokeStyle = s.color ?? colors.info;
            ctx.beginPath();
            ctx.moveTo(X(exp), T);
            ctx.lineTo(X(exp), T + ph);
            ctx.stroke();
            ctx.fillStyle = s.color ?? colors.info;
            ctx.fillText('▾', X(exp), T + 6);
          }
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
        }
      }
      // series
      ctx.lineWidth = 1.7;
      ctx.lineJoin = 'round';
      data.forEach(({ s, vals }, idx) => {
        ctx.strokeStyle = s.color ?? colors.series[idx % colors.series.length];
        ctx.beginPath();
        let first = true;
        let k = 0;
        for (let t = Math.max(0, t0); t <= tNow; t += step, k++) {
          const v = vals[k];
          if (!Number.isFinite(v)) continue;
          if (first) {
            ctx.moveTo(X(t), Y(v));
            first = false;
          } else ctx.lineTo(X(t), Y(v));
        }
        ctx.stroke();
      });
      // alarm markers
      if (p.showAlarms) {
        const log = sim.alarmLog;
        for (let i = log.length - 1; i >= 0; i--) {
          const a = log[i];
          if (a.trueTime < t0) break;
          const idx = vis.findIndex((s) => s.ch === a.ch);
          if (idx < 0 || a.trueTime > tNow) continue;
          const sIdx = p.series.findIndex((s) => s.id === vis[idx].id);
          const v = valueOf(sim, vis[idx], a.trueTime);
          if (!Number.isFinite(v)) continue;
          const x = X(a.trueTime);
          const y = Math.max(T + 8, Math.min(T + ph - 2, Y(v)));
          ctx.fillStyle = a.safetyCritical ? colors.bad : colors.warn;
          ctx.beginPath();
          ctx.moveTo(x, y - 7);
          ctx.lineTo(x - 5, y + 3);
          ctx.lineTo(x + 5, y + 3);
          ctx.closePath();
          ctx.fill();
          void sIdx;
        }
      }
      // hover
      const h = hover.current;
      if (h && h.x >= L && h.x <= w - R) {
        ctx.strokeStyle = colors.text;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(h.x, T);
        ctx.lineTo(h.x, T + ph);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, theme]);

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    hover.current = { x };
    const sim = runner.sim;
    if (frozen.current === null) frozen.current = Math.floor(runner.visualTime());
    const L = 46;
    const R = 10;
    const pw = rect.width - L - R;
    const t = Math.round(frozen.current - windowSec + ((x - L) / pw) * windowSec);
    if (t < 0 || t > sim.t) return setTip(null);
    const parts = series.filter((s) => !hidden.has(s.id)).map((s) => `${s.label} ${valueOf(sim, s, t).toFixed(2)}`);
    setTip({ x, text: `T+${t}s · ${parts.join(' · ')} ${unit}` });
  };
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <b style={{ fontSize: 13 }}>{title}</b>
        <div className="row" style={{ gap: 6 }}>
          {series.map((s, i) => (
            <button key={s.id} type="button" className="chip" aria-pressed={!hidden.has(s.id)} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} style={{ opacity: hidden.has(s.id) ? 0.45 : 1 }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color ?? `var(--chart-${i})`, display: 'inline-block', ...(s.color ? {} : { background: readTheme().series[i % 6] }) }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <canvas
        ref={ref}
        role="img"
        aria-label={`${title}. Rolling ${windowSec} second window of ${series.map((s) => s.label).join(', ')}. Triangles mark alarms.`}
        onMouseMove={onMove}
        onMouseLeave={() => {
          hover.current = null;
          frozen.current = null;
          setTip(null);
        }}
        style={{ display: 'block' }}
      />
      {tip && (
        <div className="tip" style={{ position: 'absolute', left: Math.min(tip.x + 10, (wrap.current?.clientWidth ?? 500) - 250), top: 30, bottom: 'auto', transform: 'none' }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
