import { useEffect, useRef, useState } from 'react';
import { CHANNELS, NCH } from '../../engine';
import { runner } from '../../state/runner';
import { useUiStore } from '../../state/uiStore';
import { readTheme, trustRgb } from '../../utils/colors';

const COLS = 120;
const LABEL_W = 56;

/** Rows = 15 channels, columns = scans (scrolling). BAD cells get a hatch so colour is not the only signal. */
export function TrustHeatmap({ height = 330 }: { height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const theme = useUiStore((s) => s.theme);
  const selected = useUiStore((s) => s.selectedChannel);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const hover = useRef<{ r: number; c: number } | null>(null);

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
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current!);
    colors = readTheme();
    const draw = () => {
      const sim = runner.sim;
      const rowH = (height - 22) / NCH;
      const cw = (w - LABEL_W) / COLS;
      ctx.clearRect(0, 0, w, height);
      ctx.font = '11px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      const frac = ((sim.t % 5) + (runner.running ? 0 : 0)) / 5;
      const scan0 = sim.scanCount - COLS;
      ctx.save();
      ctx.beginPath();
      ctx.rect(LABEL_W, 0, w - LABEL_W, height - 22);
      ctx.clip();
      for (let i = 0; i <= COLS; i++) {
        const sidx = scan0 + i;
        if (sidx >= sim.scanCount) continue;
        const x = LABEL_W + (i - frac) * cw;
        if (sidx < 0) {
          // no history yet: faint placeholder cells keep the grid readable
          ctx.fillStyle = 'rgba(128,138,150,0.10)';
          for (let ch = 0; ch < NCH; ch++) ctx.fillRect(x, ch * rowH + 1, cw + 0.6, rowH - 1.5);
          continue;
        }
        for (let ch = 0; ch < NCH; ch++) {
          const t = sim.trustAt(sidx, ch);
          const [r, g, b] = trustRgb(t);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, ch * rowH + 1, cw + 0.6, rowH - 1.5);
          if (t < 0.4) {
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let k = -rowH; k < cw + rowH; k += 5) {
              ctx.moveTo(x + k, ch * rowH + rowH - 1);
              ctx.lineTo(x + k + rowH - 2, ch * rowH + 1);
            }
            ctx.stroke();
          }
        }
      }
      ctx.restore();
      ctx.fillStyle = colors.axis;
      for (let ch = 0; ch < NCH; ch++) {
        ctx.fillStyle = ch === selected ? colors.text : colors.axis;
        ctx.font = ch === selected ? 'bold 11px ui-monospace, monospace' : '11px ui-monospace, monospace';
        ctx.fillText(CHANNELS[ch].tag, 4, ch * rowH + rowH / 2);
      }
      ctx.strokeStyle = colors.brand;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(LABEL_W - 1, selected * rowH + 0.5, w - LABEL_W, rowH);
      ctx.fillStyle = colors.axis;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (const m of [0, 2, 4, 6, 8, 10]) ctx.fillText(m === 0 ? 'now' : `−${m} min`, w - LABEL_W / 2 - (m * 12 * cw) + 14, height - 8);
      ctx.textAlign = 'left';
      const h = hover.current;
      if (h) {
        ctx.strokeStyle = colors.text;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(LABEL_W + (h.c - frac) * cw, h.r * rowH + 0.5, cw, rowH);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, theme, selected]);

  const locate = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rowH = (height - 22) / NCH;
    const cw = (rect.width - LABEL_W) / COLS;
    const r = Math.floor(y / rowH);
    const c = Math.floor((x - LABEL_W) / cw);
    if (r < 0 || r >= NCH || c < 0 || c >= COLS) return null;
    return { r, c, x, y };
  };
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <canvas
        ref={ref}
        role="img"
        aria-label="Trust heatmap: 15 channels over the last 10 minutes. Green is trusted, amber uncertain, red hatched is bad. Click a row to select a channel."
        onMouseMove={(e) => {
          const l = locate(e);
          hover.current = l ? { r: l.r, c: l.c } : null;
          if (!l) return setTip(null);
          const sim = runner.sim;
          const sidx = sim.scanCount - COLS + l.c;
          if (sidx < 0 || sidx >= sim.scanCount) return setTip(null);
          const t = sim.trustAt(sidx, l.r);
          const st = sim.trust.states[l.r];
          const latest = sidx === sim.scanCount - 1;
          setTip({ x: l.x, y: l.y, text: `${CHANNELS[l.r].tag}: trust ${t.toFixed(2)}${latest ? ` · ${st.cls}${st.likelyFault ? ` · ${st.likelyFault}` : ''} · z=${st.c.z.toFixed(1)} S=${st.c.S.toFixed(1)} C=${st.c.C.toFixed(1)} M=${st.c.M.toFixed(1)}` : ` · ${Math.round((sim.scanCount - 1 - sidx) * 5)} s ago`}` });
        }}
        onMouseLeave={() => {
          hover.current = null;
          setTip(null);
        }}
        onClick={(e) => {
          const l = locate(e);
          if (l) useUiStore.getState().set({ selectedChannel: l.r });
        }}
        style={{ display: 'block', borderRadius: 8, cursor: 'pointer' }}
      />
      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 12, (wrap.current?.clientWidth ?? 600) - 260), top: tip.y + 12, bottom: 'auto', transform: 'none', position: 'absolute' }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
