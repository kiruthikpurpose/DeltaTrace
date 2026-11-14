import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHANNELS, NODES, NODE_KM, hops, delay, type Incident, type Snapshot } from '../../engine';
import { runner } from '../../state/runner';
import { useUiStore } from '../../state/uiStore';
import { readTheme, TRUST_COLOR } from '../../utils/colors';
import { fmt } from '../../utils/format';

const W = 1200;
const H = 345;
const X0 = 60;
const KMX = 5.4;
const PY = 160;
export const xOf = (km: number) => X0 + km * KMX;

function NodeIcon({ kind, x, y, tripped, closed }: { kind: string; x: number; y: number; tripped?: boolean; closed?: boolean }) {
  const col = tripped ? 'var(--bad)' : 'var(--text-muted)';
  const fill = tripped ? 'var(--bad-soft)' : 'var(--bg-elev-1)';
  if (kind === 'pump' || kind === 'injection')
    return (
      <g transform={`translate(${x},${y})`}>
        <circle r={15} fill={fill} stroke={col} strokeWidth={2} />
        <path d="M-6,-7 L9,0 L-6,7 Z" fill={col} />
        {kind === 'injection' && <path d="M-26,0 H-17 M-21,-4 L-17,0 L-21,4" stroke={col} strokeWidth={2} fill="none" />}
        {tripped && <text x={14} y={-12} fontSize={15}>⚠</text>}
      </g>
    );
  if (kind === 'valve')
    return (
      <g transform={`translate(${x},${y}) rotate(${closed ? 90 : 0})`}>
        <path d="M-11,-9 L11,9 L11,-9 L-11,9 Z" fill={fill} stroke={col} strokeWidth={2} strokeLinejoin="round" />
        <path d="M0,0 V-14" stroke={col} strokeWidth={2} />
      </g>
    );
  if (kind === 'tap')
    return (
      <g transform={`translate(${x},${y})`}>
        <path d="M0,18 V4" stroke={col} strokeWidth={2} />
        <rect x={-12} y={-14} width={24} height={18} rx={4} fill={fill} stroke={col} strokeWidth={2} />
        <path d="M-12,-6 H12" stroke={col} strokeWidth={1.5} />
      </g>
    );
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M-13,-12 v22 a13,5 0 0 0 26,0 v-22" fill={fill} stroke={col} strokeWidth={2} />
      <ellipse cx={0} cy={-12} rx={13} ry={5} fill={fill} stroke={col} strokeWidth={2} />
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
export function PipelineSchematic({ snap, explain, showTruth, selectedIncident }: Props) {
  const nav = useNavigate();
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;
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
    let last = performance.now();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = snapRef.current;
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

  const desc = `Pipeline schematic, 200 km west to east with 12 sensor nodes. ${snap.openIncidents.length} open incident(s); ${snap.activeAlarms.length} active raw alarm(s); trust: ${snap.trust.filter((t) => t.cls === 'GOOD').length} good, ${snap.trust.filter((t) => t.cls === 'UNCERTAIN').length} uncertain, ${snap.trust.filter((t) => t.cls === 'BAD').length} bad.`;

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={desc} style={{ display: 'block' }}>
        <title>{desc}</title>
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
          const lo = inc.origin ? Math.max(0, inc.origin.km - 12) : NODE_KM[inc.segment[0]];
          const hiKm = Math.max(...(inc.channels.length ? inc.channels : [0]).map((c) => CHANNELS[c].km), lo);
          const loKm = Math.min(...(inc.channels.length ? inc.channels : [0]).map((c) => CHANNELS[c].km), lo);
          const x1 = xOf(loKm) - 22;
          const x2 = xOf(hiKm) + 22;
          const col = inc.cls === 'process-event' ? 'var(--c-group)' : inc.cls === 'data-integrity' ? 'var(--k-integrity)' : 'var(--k-fault)';
          return (
            <g key={inc.id} opacity={0.95}>
              <rect x={x1} y={26} width={x2 - x1} height={PY + 24} rx={14} fill={col} opacity={0.1} stroke={col} strokeDasharray="5 4" strokeWidth={1.5} />
              <text x={x1 + 8} y={42} fontSize={12} fontWeight={700} fill={col} stroke="var(--bg-elev-1)" strokeWidth={3.5} paintOrder="stroke" strokeLinejoin="round">INC-{String(inc.id).padStart(3, '0')} · {inc.alarmIds.length} alarms</text>
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
            <text y={-20} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--bad-ink)">LEAK {f.km} km</text>
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
          return (
            <g key={`o${i.id}`}>
              <line x1={xOf(o.lo)} x2={xOf(o.hi)} y1={PY - 124} y2={PY - 124} stroke="var(--c-group)" strokeWidth={3} />
              <path d={`M${xOf(o.lo)},${PY - 130} v12 M${xOf(o.hi)},${PY - 130} v12`} stroke="var(--c-group)" strokeWidth={2} />
              <g transform={`translate(${xOf(o.km)},${PY - 124})`}>
                <circle r={9} fill="none" stroke="var(--c-group)" strokeWidth={2}>
                  <animate attributeName="r" values="7;14;7" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <path d="M-14,0 H14 M0,-14 V14" stroke="var(--c-group)" strokeWidth={2} />
              </g>
              <text x={xOf(o.km)} y={PY - 142} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--c-group)" stroke="var(--bg-elev-1)" strokeWidth={3.5} paintOrder="stroke" strokeLinejoin="round">origin ≈ km {fmt(o.km, 0)} ±{fmt((o.hi - o.lo) / 2, 0)}</text>
            </g>
          );
        })}

        {/* explain overlay */}
        {explain &&
          alarmedKm.slice(0, -1).map((p, i) => {
            const q = alarmedKm[i + 1];
            if (hops(p.node, q.node) > 3) return null;
            const x1 = xOf(NODE_KM[p.node]);
            const x2 = xOf(NODE_KM[q.node]);
            const km = Math.abs(NODE_KM[q.node] - NODE_KM[p.node]);
            const d = delay(p.node, q.node, snap.cfg.waveSpeed);
            const obs = Math.abs(q.t - p.t);
            const ok = obs <= d + snap.cfg.clockTol + snap.cfg.scanInterval;
            const my = PY - 104 - (i % 2) * 18;
            return (
              <g key={`e${i}`}>
                <path d={`M${x1},${PY - 28} Q${(x1 + x2) / 2},${my - 20} ${x2},${PY - 28}`} fill="none" stroke={ok ? 'var(--c-group)' : 'var(--bad)'} strokeWidth={2} strokeDasharray="5 4" style={{ animation: 'dash-flow 1s linear infinite' }} />
                <text x={(x1 + x2) / 2} y={my - 6} textAnchor="middle" fontSize={10.5} fill="var(--text)" fontWeight={600} stroke="var(--bg-elev-1)" strokeWidth={3.5} paintOrder="stroke" strokeLinejoin="round">
                  {km} km ÷ {snap.cfg.waveSpeed} m/s = {fmt(d, 0)} s
                </text>
                <text x={(x1 + x2) / 2} y={my + 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)" stroke="var(--bg-elev-1)" strokeWidth={3.5} paintOrder="stroke" strokeLinejoin="round">observed Δ {fmt(obs, 0)} s {ok ? '✓ merged' : '✗'}</text>
              </g>
            );
          })}
        {explain && notMerged && (
          <g>
            <path d={`M${xOf(NODE_KM[notMerged.a])},${PY - 30} Q${(xOf(NODE_KM[notMerged.a]) + xOf(NODE_KM[notMerged.b])) / 2},${PY - 150} ${xOf(NODE_KM[notMerged.b])},${PY - 30}`} fill="none" stroke="var(--bad)" strokeWidth={2} strokeDasharray="3 5" />
            <text x={(xOf(NODE_KM[notMerged.a]) + xOf(NODE_KM[notMerged.b])) / 2} y={PY - 110} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--bad-ink)">✗ not merged: {notMerged.km} km apart</text>
          </g>
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
              <circle cx={x + 17} cy={PY - 70} r={2.6} fill="var(--ok)" style={{ animation: `blink 1.6s ${(n.id % 6) * 0.25}s infinite` }} />
              {/* alarm badge */}
              {al && (
                <g transform={`translate(${x},${PY - 92})`}>
                  <circle r={10} fill={al.crit ? 'var(--bad)' : 'var(--warn)'} style={{ animation: 'pulse-ring 1.3s infinite', color: al.crit ? 'var(--bad)' : 'var(--warn)' }} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} fill="#fff">{al.n}</text>
                </g>
              )}
              {/* trust ring + tag */}
              <g transform={`translate(${x},${PY + 74})`} className={st.cls === 'BAD' ? 'glow-bad' : undefined}>
                <circle r={r} fill="var(--bg-elev-1)" stroke="var(--bg-elev-3)" strokeWidth={5} />
                <circle r={r} fill="none" stroke={TRUST_COLOR[st.cls]} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${circ * st.T} ${circ}`} transform="rotate(-90)" style={{ transition: 'stroke-dasharray 300ms' }} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fontFamily="var(--mono)" fill="var(--text)">{st.cls === 'BAD' ? '✕' : st.cls === 'UNCERTAIN' ? '!' : (st.T * 100).toFixed(0)}</text>
              </g>
              <text x={x} y={PY + 104} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)" fontFamily="var(--mono)">PT-{n.id}</text>
              {st.likelyFault && st.cls !== 'GOOD' && (
                <g transform={`translate(${x},${PY + 120})`}>
                  <rect x={-24} y={-8} width={48} height={15} rx={7.5} fill={st.cls === 'BAD' ? 'var(--bad-soft)' : 'var(--warn-soft)'} stroke={st.cls === 'BAD' ? 'var(--bad)' : 'var(--warn)'} />
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
            <g key={ch} transform={`translate(${x + (ch === 12 ? 30 : ch === 14 ? -30 : 0)},${PY + 150})`}>
              <rect x={-30} y={-9} width={60} height={18} rx={9} fill="var(--bg-elev-1)" stroke={TRUST_COLOR[st.cls]} strokeWidth={2} />
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
}
