import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHANNELS, NODES, NODE_KM, hops, delay, type Incident, type Snapshot } from '../../engine';
import { runner } from '../../state/runner';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { readTheme, TRUST_COLOR } from '../../utils/colors';
import { fmt } from '../../utils/format';

const W = 1200;
const HALO = { stroke: 'var(--bg-elev-1)', strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const;
const H = 385;
const X0 = 60;
const KMX = 5.4;
const PY = 190;
export const xOf = (km: number) => X0 + km * KMX;

function NodeIcon({ kind, x, y, tripped, closed }: { kind: string; x: number; y: number; tripped?: boolean; closed?: boolean }) {
  const col = tripped ? 'var(--bad)' : 'var(--text-muted)';
  const body = tripped ? 'var(--bad-soft)' : 'var(--bg-elev-2)';
  const sw = 1.8;
  if (kind === 'pump' || kind === 'injection')
    return (
      <g transform={`translate(${x},${y})`}>
        {/* discharge nozzle and motor */}
        <rect x={-3} y={-21} width={12} height={9} rx={1.5} fill={body} stroke={col} strokeWidth={sw} />
        <rect x={-24} y={-6} width={11} height={12} rx={2} fill={body} stroke={col} strokeWidth={sw} />
        <path d="M-13,-2 H-9 M-13,2 H-9" stroke={col} strokeWidth={1.4} />
        {/* volute */}
        <circle r={13} fill={body} stroke={col} strokeWidth={sw} />
        {/* impeller blades are drawn on the canvas overlay so rotation does not repaint the SVG */}
        <circle r={2.2} fill={col} />
        {kind === 'injection' && <path d="M-34,10 H-26 M-30,6 L-26,10 L-30,14" stroke={col} strokeWidth={sw} fill="none" strokeLinecap="round" />}
        {tripped && <path d="M16,-14 L22,-4 H10 Z" fill="var(--bad)" />}
      </g>
    );
  if (kind === 'valve')
    return (
      <g transform={`translate(${x},${y})`}>
        {/* actuator and stem */}
        <path d="M0,-3 V-15" stroke={col} strokeWidth={sw} />
        <path d="M-8,-15 H8" stroke={col} strokeWidth={2.4} strokeLinecap="round" />
        {/* body */}
        <path d="M-13,-9 L0,0 L-13,9 Z M13,-9 L0,0 L13,9 Z" fill={closed || tripped ? col : body} stroke={col} strokeWidth={sw} strokeLinejoin="round" />
        <circle r={2.4} fill={closed || tripped ? 'var(--bg-elev-1)' : col} />
        {closed && <path d="M-16,12 H16" stroke="var(--bad)" strokeWidth={2} strokeLinecap="round" />}
      </g>
    );
  if (kind === 'tap')
    return (
      <g transform={`translate(${x},${y})`}>
        <path d="M0,18 V6" stroke={col} strokeWidth={sw} />
        <rect x={-13} y={-15} width={26} height={21} rx={4} fill={body} stroke={col} strokeWidth={sw} />
        <path d="M-9,1 H-4 L-1,-8 L2,8 L5,1 H9" fill="none" stroke={col} strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M13,-4 H21 M18,-8 L22,-4 L18,0" fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" />
      </g>
    );
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M-14,-12 v21 a14,5 0 0 0 28,0 v-21" fill={body} stroke={col} strokeWidth={sw} />
      <path d="M-14,0 v9 a14,5 0 0 0 28,0 v-9 a14,5 0 0 1 -28,0 Z" fill="var(--brand)" opacity={0.28} />
      <ellipse cx={0} cy={-12} rx={14} ry={5} fill={body} stroke={col} strokeWidth={sw} />
    </g>
  );
}

interface Props {
  snap: Snapshot;
  explain?: boolean;
  showTruth?: boolean;
  selectedIncident?: Incident | null;
  height?: number;
}

/** Hero visual: SVG structure + canvas overlay (particles, pressure waves, sensor pings). */
export const PipelineSchematic = memo(function PipelineSchematic({ snap, explain, showTruth, selectedIncident }: Props) {
  const nav = useNavigate();
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const snap0 = useRef(snap);
  snap0.current = snap;
  const theme = useUiStore((s) => s.theme);
  const [tip, setTip] = useState<{ ch: number; x: number } | null>(null);

  // ---- canvas overlay loop
  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let scale = 1;
    let colors = readTheme();
    const resize = () => {
      if (!wrap.current) return;
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.current!.clientWidth;
      scale = w / W;
      cv.width = w * dpr;
      cv.height = H * scale * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${H * scale}px`;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    };
    resize();
    colors = readTheme();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current!);
    let phase = 0;
    let spin = 0;
    let last = performance.now();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let gap = 16;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < gap) return;
      const cost0 = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = useSimStore.getState().snap ?? snap0.current; // canvas reads the live snapshot; the SVG below renders at a lower rate
      ctx.clearRect(0, 0, W, H);
      const vt = runner.visualTime();
      if (runner.running && !reduce) phase = (phase + dt * 26 * Math.min(1.8, 0.5 + Math.log10(1 + runner.speed))) % 40;
      // flowing chevrons
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const flowOn = !s.faults.some((f) => f.spec.type === 'pumpTrip');
      ctx.strokeStyle = colors.brand;
      for (let x = X0 - 40 + phase; x < xOf(200) + 4; x += 40) {
        if (x < X0 + 4) continue;
        ctx.globalAlpha = flowOn ? 0.75 : 0.28;
        ctx.beginPath();
        ctx.moveTo(x - 4, PY - 5);
        ctx.lineTo(x + 2, PY);
        ctx.lineTo(x - 4, PY + 5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // pump impellers (rotate while running, stop when the pump has tripped)
      const tripped = new Set<number>();
      for (const f of s.faults) if (f.started && f.spec.type === 'pumpTrip') tripped.add(f.spec.node ?? 4);
      spin = runner.running && !reduce ? (spin + dt * 2.6 * Math.min(2, 0.5 + Math.log10(1 + runner.speed))) % (Math.PI * 2) : spin;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      for (const nd of NODES) {
        if (nd.kind !== 'pump' && nd.kind !== 'injection') continue;
        ctx.save();
        ctx.translate(xOf(nd.km), PY - 46);
        ctx.rotate(tripped.has(nd.id) ? 0 : spin);
        ctx.strokeStyle = tripped.has(nd.id) ? colors.bad : colors.axis;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.quadraticCurveTo(6, -5, 0, 0);
        ctx.quadraticCurveTo(-6, 5, 0, 8);
        ctx.moveTo(-8, 0);
        ctx.quadraticCurveTo(-5, -6, 0, 0);
        ctx.quadraticCurveTo(5, 6, 8, 0);
        ctx.stroke();
        ctx.restore();
      }
      // batch interface bands
      for (const f of s.faults) {
        if (f.spec.type !== 'batch' || !f.started) continue;
        const k = Math.min(1, (vt - f.startAt) / 90);
        const x = xOf(200 * k);
        const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
        g.addColorStop(0, 'rgba(245,158,11,0)');
        g.addColorStop(0.5, 'rgba(245,158,11,0.7)');
        g.addColorStop(1, 'rgba(245,158,11,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 40, PY - 12, 80, 24);
      }
      // pressure waves
      const c = s.cfg.waveSpeed;
      for (const w of s.waves) {
        const age = vt - w.t0;
        if (age < 0) continue;
        const front = (age * c) / 1000;
        // origin ripples
        for (let r = 0; r < 3; r++) {
          const a = age - r * 1.6;
          if (a < 0 || a > 7) continue;
          ctx.strokeStyle = colors.info;
          ctx.globalAlpha = 1 - a / 7;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(xOf(w.km), PY, 6 + a * 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (const dir of [-1, 1]) {
          const km = w.km + dir * front;
          if (km < -2 || km > 202) continue;
          for (let k = 0; k < 3; k++) {
            const kk = km - dir * k * 5;
            if (kk < 0 || kk > 200 || Math.abs(kk - w.km) > front) continue;
            ctx.strokeStyle = colors.info;
            ctx.globalAlpha = (1 - k * 0.3) * Math.max(0.25, 1 - front / 320);
            ctx.lineWidth = 3 - k * 0.7;
            ctx.beginPath();
            ctx.ellipse(xOf(kk), PY, 6 + k, 30 - k * 4, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        // sensor pings
        for (let n = 0; n < 12; n++) {
          const d = Math.abs(NODE_KM[n] - w.km);
          const a = age - (d * 1000) / c;
          if (a >= 0 && a < 3) {
            ctx.strokeStyle = colors.info;
            ctx.globalAlpha = 1 - a / 3;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(xOf(NODE_KM[n]), PY - 48, 10 + a * 9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = colors.info;
            ctx.beginPath();
            ctx.arc(xOf(NODE_KM[n]), PY - 48, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      gap = Math.min(100, Math.max(16, (performance.now() - cost0) * 3));
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [theme]);

  // ---- derived overlays (10 Hz)
  const faultAt = useMemo(() => {
    const m: Record<number, { trip?: boolean; closed?: boolean }> = {};
    for (const f of snap.faults) {
      if (!f.started) continue;
      const n = f.spec.node ?? (f.spec.type === 'pumpTrip' ? 4 : 5);
      if (f.spec.type === 'pumpTrip') m[n] = { ...m[n], trip: true };
      if (f.spec.type === 'valveClosure') m[n] = { ...m[n], closed: true };
    }
    return m;
  }, [snap.faults]);
  const leaks = snap.faults.filter((f) => f.started && f.spec.type === 'leak');
  const alarmsAtNode = useMemo(() => {
    const m: Record<number, { n: number; crit: boolean }> = {};
    for (const a of snap.activeAlarms) {
      if (a.source !== 'scada') continue;
      const e = (m[a.node] ??= { n: 0, crit: false });
      e.n++;
      if (a.safetyCritical) e.crit = true;
    }
    return m;
  }, [snap.activeAlarms]);

  const focus = selectedIncident ?? snap.openIncidents[0] ?? null;
  const alarmedKm = useMemo(() => {
    if (!explain || !focus) return [];
    const byNode = new Map<number, number>();
    for (const a of snap.recentAlarms) if (a.incidentId === focus.id && a.source === 'scada' && a.type !== 'COMM' && a.type !== 'FLAT' && CHANNELS[a.ch].kind === 'PT') if (!byNode.has(a.node) || a.time < byNode.get(a.node)!) byNode.set(a.node, a.time);
    return [...byNode.entries()].sort((a, b) => a[0] - b[0]).map(([node, t]) => ({ node, t }));
  }, [explain, focus, snap.recentAlarms]);
  const notMerged = useMemo(() => {
    if (!explain) return null;
    const recent = snap.recentAlarms.filter((a) => a.source === 'scada' && snap.t - a.trueTime < 150 && CHANNELS[a.ch].kind === 'PT');
    for (const a of recent)
      for (const b of recent) {
        if (a.id < b.id && a.incidentId !== b.incidentId && hops(a.node, b.node) > snap.cfg.hopLimit && Math.abs(a.time - b.time) < 40) return { a: a.node, b: b.node, km: Math.abs(NODE_KM[a.node] - NODE_KM[b.node]) };
      }
    return null;
  }, [explain, snap.recentAlarms, snap.t, snap.cfg.hopLimit]);

  // stack incident labels into lanes so neighbouring labels never overlap
  const incLane = new Map<number, number>();
  const incX = new Map<number, number>();
  {
    const ends: number[] = [];
    const info = snap.openIncidents.map((inc) => {
      const cs = inc.channels.length ? inc.channels.map((c) => CHANNELS[c].km) : [NODE_KM[inc.segment[0]]];
      const l = inc.origin ? Math.min(inc.origin.km, ...cs) : Math.min(...cs);
      const w = Math.max(120, `INC-000 · ${inc.alarmIds.length} alarms`.length * 6.6 + 14);
      return { id: inc.id, x1: Math.min(xOf(l) - 24, W - w - 2), w };
    }).sort((x, y) => x.x1 - y.x1);
    for (const it of info) {
      let ln = ends.findIndex((e) => it.x1 >= e + 4);
      if (ln < 0) ln = ends.length < 3 ? ends.length : ends.indexOf(Math.min(...ends));
      ends[ln] = it.x1 + it.w;
      incLane.set(it.id, ln);
      incX.set(it.id, it.x1);
    }
  }
  // with nothing above the pipe to show, give the unused headroom back
  const calm = !snap.openIncidents.length && !explain && !showTruth;
  const desc = `Pipeline schematic, 200 km west to east with 12 sensor nodes. ${snap.openIncidents.length} open incident(s); ${snap.activeAlarms.length} active raw alarm(s); trust: ${snap.trust.filter((t) => t.cls === 'GOOD').length} good, ${snap.trust.filter((t) => t.cls === 'UNCERTAIN').length} uncertain, ${snap.trust.filter((t) => t.cls === 'BAD').length} bad.`;

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%', marginTop: calm ? -64 : 0, transition: 'margin-top 400ms var(--ease)' }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={desc} style={{ display: 'block' }}>
        {/* pipe */}
        <rect x={X0 - 8} y={PY - 13} width={KMX * 200 + 16} height={26} rx={13} fill="var(--pipe)" />
        <rect x={X0 - 4} y={PY - 9} width={KMX * 200 + 8} height={18} rx={9} fill="var(--pipe-inner)" />
        {/* ruler */}
        {Array.from({ length: 11 }, (_, i) => i * 20).map((km) => (
          <g key={km}>
            <line x1={xOf(km)} x2={xOf(km)} y1={PY + 18} y2={PY + 26} stroke="var(--chart-axis)" />
            <text x={xOf(km)} y={PY + 40} textAnchor="middle" fontSize={11} fill="var(--chart-axis)" fontFamily="var(--mono)">{km}</text>
          </g>
        ))}
        <text x={xOf(200) + 14} y={PY + 40} fontSize={11} fill="var(--chart-axis)">km</text>

        {/* incident envelopes */}
        {snap.openIncidents.map((inc) => {
          const cols = inc.channels.length ? inc.channels.map((c) => CHANNELS[c].km) : [NODE_KM[inc.segment[0]]];
          const lo = inc.origin ? Math.min(inc.origin.km, ...cols) : Math.min(...cols);
          const hi = Math.max(...cols);
          const x1 = xOf(lo) - 24;
          const x2 = xOf(hi) + 24;
          const col = inc.cls === 'process-event' ? 'var(--c-group)' : inc.cls === 'data-integrity' ? 'var(--k-integrity)' : 'var(--k-fault)';
          const lx = incX.get(inc.id) ?? x1;
          const label = `INC-${String(inc.id).padStart(3, '0')} · ${inc.alarmIds.length} alarms`;
          return (
            <g key={inc.id}>
              <rect x={x1} y={PY - 122} width={x2 - x1} height={PY - 122 > 0 ? 122 + 58 : 180} rx={4} fill={col} opacity={0.07} stroke={col} strokeWidth={1.2} />
              <line x1={lx + 10} x2={lx + 10} y1={PY - 140 - (incLane.get(inc.id) ?? 0) * 20 + 18} y2={PY - 122} stroke={col} strokeWidth={1.2} opacity={(incLane.get(inc.id) ?? 0) ? 1 : 0} />
              <rect x={lx} y={PY - 140 - (incLane.get(inc.id) ?? 0) * 20} width={Math.max(120, label.length * 6.6 + 14)} height={18} rx={3} fill={col} />
              <text x={lx + 7} y={PY - 127 - (incLane.get(inc.id) ?? 0) * 20} fontSize={11} fontWeight={600} fill="var(--on-accent)">{label}</text>
            </g>
          );
        })}

        {/* leaks (process faults) */}
        {leaks.map((f) => (
          <g key={f.id} transform={`translate(${xOf(f.km ?? 0)},${PY})`}>
            <circle r={14} fill="var(--bad)" opacity={0.25}>
              <animate attributeName="r" values="10;22;10" dur="1.4s" repeatCount="indefinite" />
            </circle>
            <path d="M0,-4 L5,5 A6,6 0 1 1 -5,5 Z" fill="var(--bad)" transform="translate(0,16)">
              <animateTransform attributeName="transform" type="translate" values="0,12;0,34;0,12" dur="1.2s" repeatCount="indefinite" />
            </path>
            <circle r={6} fill="var(--bad)" />
            <text y={-22} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--bad-ink)" {...HALO}>Leak at km {f.km}</text>
          </g>
        ))}
        {showTruth &&
          leaks.map((f) => (
            <g key={`t${f.id}`} transform={`translate(${xOf(f.km ?? 0)},${PY - 34})`}>
              <circle r={8} fill="none" stroke="var(--text)" strokeWidth={2} strokeDasharray="3 2" />
              <text y={-12} textAnchor="middle" fontSize={10} fill="var(--text-muted)">truth</text>
            </g>
          ))}

        {/* origin markers */}
        {snap.openIncidents.filter((i) => i.origin).map((i) => {
          const o = i.origin!;
          const y = PY - 160;
          return (
            <g key={`o${i.id}`}>
              <line x1={xOf(o.lo)} x2={xOf(o.hi)} y1={y} y2={y} stroke="var(--c-group)" strokeWidth={2.5} />
              <path d={`M${xOf(o.lo)},${y - 5} v10 M${xOf(o.hi)},${y - 5} v10`} stroke="var(--c-group)" strokeWidth={2} />
              <path d={`M${xOf(o.km)},${y - 10} v20 M${xOf(o.km) - 10},${y} h20`} stroke="var(--c-group)" strokeWidth={2} />
              <text x={xOf(o.km)} y={y - 16} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--text)" {...HALO}>Origin estimate: km {fmt(o.km, 0)} ± {fmt((o.hi - o.lo) / 2, 0)}</text>
            </g>
          );
        })}

        {/* explain overlay: orthogonal brackets with the expected delay on each */}
        {explain &&
          alarmedKm.slice(0, -1).map((p, i) => {
            const q = alarmedKm[i + 1];
            if (hops(p.node, q.node) > 3) return null;
            const x1 = xOf(NODE_KM[p.node]);
            const x2 = xOf(NODE_KM[q.node]);
            const d = delay(p.node, q.node, snap.cfg.waveSpeed);
            const obs = Math.abs(q.t - p.t);
            const ok = obs <= d + snap.cfg.clockTol + snap.cfg.scanInterval;
            const y = PY - 76;
            const col = ok ? 'var(--c-group)' : 'var(--bad)';
            const label = `${fmt(d, 0)} s`;
            return (
              <g key={`e${i}`}>
                <path d={`M${x1 + 4},${y + 8} V${y} H${x2 - 4} V${y + 8}`} fill="none" stroke={col} strokeWidth={1.5} />
                <rect x={(x1 + x2) / 2 - 20} y={y - 8} width={40} height={16} rx={3} fill="var(--bg-elev-1)" stroke={col} />
                <text x={(x1 + x2) / 2} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={600} fill="var(--text)" fontFamily="var(--mono)">{label}</text>
              </g>
            );
          })}
        {explain && notMerged && (
          <g>
            <path d={`M${xOf(NODE_KM[notMerged.a])},${PY - 106} V${PY - 114} H${xOf(NODE_KM[notMerged.b])} V${PY - 106}`} fill="none" stroke="var(--bad)" strokeWidth={1.5} strokeDasharray="5 4" />
            <rect x={(xOf(NODE_KM[notMerged.a]) + xOf(NODE_KM[notMerged.b])) / 2 - 78} y={PY - 122} width={156} height={16} rx={3} fill="var(--bg-elev-1)" stroke="var(--bad)" />
            <text x={(xOf(NODE_KM[notMerged.a]) + xOf(NODE_KM[notMerged.b])) / 2} y={PY - 113.5} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={600} fill="var(--bad-ink)">Not merged: {notMerged.km} km apart</text>
          </g>
        )}
        {explain && (
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
            Merge window = distance ÷ wave speed + tolerance. Example: 20 km ÷ {snap.cfg.waveSpeed} m/s = {fmt(20000 / snap.cfg.waveSpeed, 0)} s (+{snap.cfg.clockTol + snap.cfg.scanInterval} s).
          </text>
        )}

        {/* nodes */}
        {NODES.map((n) => {
          const st = snap.trust[n.id];
          const x = xOf(n.km);
          const al = alarmsAtNode[n.id];
          const f = faultAt[n.id];
          const r = 15;
          const circ = 2 * Math.PI * r;
          return (
            <g key={n.id} style={{ cursor: 'pointer' }} onMouseEnter={() => setTip({ ch: n.id, x })} onFocus={() => setTip({ ch: n.id, x })} onBlur={() => setTip(null)} onClick={() => { useUiStore.getState().set({ selectedChannel: n.id }); nav('/trust'); }} tabIndex={0} role="button" aria-label={`${CHANNELS[n.id].tag} ${n.name}: trust ${st.T.toFixed(2)} ${st.cls}${st.likelyFault ? `, ${st.likelyFault}` : ''}. Open trust detail.`} onKeyDown={(e) => e.key === 'Enter' && (useUiStore.getState().set({ selectedChannel: n.id }), nav('/trust'))}>
              <line x1={x} x2={x} y1={PY - 44} y2={PY - 13} stroke="var(--pipe)" strokeWidth={2} />
              <NodeIcon kind={n.kind} x={x} y={PY - 52 + 6} tripped={f?.trip} closed={f?.closed} />
              {/* heartbeat */}
              <circle cx={x + 17} cy={PY - 70} r={2.6} fill="var(--ok)" />
              {/* alarm badge */}
              {al && (
                <g transform={`translate(${x},${PY - 96})`}>
                  <><circle r={14} fill={al.crit ? 'var(--bad)' : 'var(--warn)'} opacity={0.22} /><circle r={10} fill={al.crit ? 'var(--bad)' : 'var(--warn)'} /></>
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} fill="var(--on-accent)">{al.n}</text>
                </g>
              )}
              {/* trust ring + tag */}
              <g transform={`translate(${x},${PY + 74})`} className={st.cls === 'BAD' ? 'glow-bad' : undefined}>
                <circle r={r} fill="var(--bg-elev-1)" stroke="var(--bg-elev-3)" strokeWidth={5} />
                <circle r={r} fill="none" stroke={TRUST_COLOR[st.cls]} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${circ * st.T} ${circ}`} transform="rotate(-90)" style={{ transition: 'stroke-dasharray 300ms' }} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fontFamily="var(--mono)" fill="var(--text)">{st.cls === 'BAD' ? '✕' : st.cls === 'UNCERTAIN' ? '!' : (st.T * 100).toFixed(0)}</text>
              </g>
              <text x={x} y={PY + 104} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)" fontFamily="var(--mono)">PT-{n.id}</text>
              <text x={x} y={PY + 117} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="var(--mono)">{Number.isFinite(snap.measured[n.id]) ? snap.measured[n.id].toFixed(1) : '--'} bar</text>
              {st.likelyFault && st.cls !== 'GOOD' && (
                <g transform={`translate(${x},${PY + 134})`}>
                  <rect x={-(st.likelyFault.length * 3 + 8)} y={-8} width={st.likelyFault.length * 6 + 16} height={15} rx={7.5} fill={st.cls === 'BAD' ? 'var(--bad-soft)' : 'var(--warn-soft)'} stroke={st.cls === 'BAD' ? 'var(--bad)' : 'var(--warn)'} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={800} fill={st.cls === 'BAD' ? 'var(--bad-ink)' : 'var(--warn-ink)'}>{st.likelyFault.toUpperCase()}</text>
                </g>
              )}
            </g>
          );
        })}
        {/* flow meters */}
        {[12, 13, 14].map((ch) => {
          const st = snap.trust[ch];
          const x = xOf(CHANNELS[ch].km);
          return (
            <g key={ch} transform={`translate(${x + (ch === 12 ? 30 : ch === 14 ? -30 : 0)},${PY + 168})`}>
              <rect x={-((CHANNELS[ch].tag.length + 4) * 3.2 + 10)} y={-9} width={(CHANNELS[ch].tag.length + 4) * 6.4 + 20} height={18} rx={9} fill="var(--bg-elev-1)" stroke={TRUST_COLOR[st.cls]} strokeWidth={2} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontFamily="var(--mono)" fontWeight={700} fill="var(--text)">{CHANNELS[ch].tag} {(st.T * 100).toFixed(0)}</text>
            </g>
          );
        })}
      </svg>
      <canvas ref={canvas} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      {tip && (
        <div className="tip" style={{ position: 'absolute', left: `${(tip.x / W) * 100}%`, top: 8, transform: 'translateX(-50%)', bottom: 'auto' }}>
          <b>{CHANNELS[tip.ch].tag}</b> · {NODES[tip.ch].name} · km {NODE_KM[tip.ch]}
          <br />
          value {fmt(snap.measured[tip.ch], 2)} bar (Δ {fmt(snap.measured[tip.ch] - snap.nominal[tip.ch], 2)})
          <br />
          trust {fmt(snap.trust[tip.ch].T, 2)} {snap.trust[tip.ch].cls}
          {snap.trust[tip.ch].likelyFault ? ` · ${snap.trust[tip.ch].likelyFault}` : ''}
          <br />
          last alarm: {(() => { const a = snap.recentAlarms.find((x) => x.node === tip.ch && CHANNELS[x.ch].kind === 'PT'); return a ? `${a.type} at T+${Math.round(a.trueTime)}s` : 'none'; })()}
        </div>
      )}
    </div>
  );
});
