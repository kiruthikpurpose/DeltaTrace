import { Copy, Download, FileText, FlaskConical, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EXPERIMENTS, runBenchmarks, runExperiment, type BenchResult, type ExperimentResult } from '../engine';
import { PageHeader } from '../components/shell/PageHeader';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { download, copyText } from '../utils/download';
import { toCsv, toMarkdownTable } from '../utils/format';
import { toast } from '../state/toastStore';
import { benchmarkReport } from '../utils/reports';

function GroupedBars({ rows, a, b, title, unit }: { rows: { id: string; a: number; b: number }[]; a: string; b: string; title: string; unit: string }) {
  const W = 620;
  const H = 230;
  const L = 40;
  const B = 28;
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b])) * 1.1;
  const bw = (W - L - 10) / rows.length;
  const Y = (v: number) => 10 + (1 - v / max) * (H - 10 - B);
  return (
    <div>
      <b style={{ fontSize: 13 }}>{title}</b>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title}: ${rows.map((r) => `${r.id} ${a} ${r.a.toFixed(0)}${unit}, ${b} ${r.b.toFixed(0)}${unit}`).join('; ')}`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - 4} y1={Y(max * f)} y2={Y(max * f)} stroke="var(--chart-grid)" />
            <text x={L - 5} y={Y(max * f)} textAnchor="end" dominantBaseline="central" fontSize={10.5} fill="var(--chart-axis)" fontFamily="var(--mono)">{(max * f).toFixed(0)}</text>
          </g>
        ))}
        {rows.map((r, i) => (
          <g key={r.id} transform={`translate(${L + i * bw},0)`}>
            <rect x={bw * 0.14} y={Y(r.a)} width={bw * 0.34} height={H - B - Y(r.a)} rx={3} fill="var(--bad)" opacity={0.85} />
            <rect x={bw * 0.5} y={Y(r.b)} width={bw * 0.34} height={H - B - Y(r.b)} rx={3} fill="var(--c-group)" />
            <text x={bw / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--chart-axis)" fontWeight={600}>{r.id}</text>
          </g>
        ))}
      </svg>
      <div className="legend">
        <span className="item"><span className="sw" style={{ background: 'var(--bad)' }} />{a}</span>
        <span className="item"><span className="sw" style={{ background: 'var(--c-group)' }} />{b}</span>
      </div>
    </div>
  );
}

function Confusion({ m }: { m: BenchResult['confusion'] }) {
  const classes = ['process-event', 'instrument-fault', 'data-integrity', 'needs-review'];
  const names: Record<string, string> = { 'process-event': 'Process', 'instrument-fault': 'Instrument', 'data-integrity': 'Data integrity', 'needs-review': 'Review' };
  const max = Math.max(1, ...classes.flatMap((e) => classes.map((a) => m[e]?.[a] ?? 0)));
  return (
    <div>
      <b style={{ fontSize: 13 }}>Confusion matrix of incident classes</b>
      <table className="tbl confusion" aria-label="Confusion matrix: rows are expected classes, columns are DeltaTrace's classes">
        <thead>
          <tr>
            <th>expected ↓ / actual →</th>
            {classes.map((c) => <th key={c}>{names[c]}</th>)}
          </tr>
        </thead>
        <tbody>
          {classes.map((e) => (
            <tr key={e}>
              <td><b>{names[e]}</b></td>
              {classes.map((a) => {
                const v = m[e]?.[a] ?? 0;
                return <td key={a} className="r num" style={{ background: v ? `color-mix(in srgb, ${e === a ? 'var(--ok)' : 'var(--bad)'} ${15 + (v / max) * 55}%, transparent)` : undefined }}>{v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Benchmarks() {
  const [seeds, setSeeds] = useState(5);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  const [res, setRes] = useState<BenchResult | null>(null);
  const [exps, setExps] = useState<Record<string, ExperimentResult>>({});
  const [expBusy, setExpBusy] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setProgress(0);
    const r = await runBenchmarks(seeds, (f, l) => {
      setProgress(f);
      setLabel(l);
    });
    setRes(r);
    setBusy(false);
  };
  // show real results on first visit instead of an empty card
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || import.meta.env.MODE === 'test') return;
    auto.current = true;
    void run();
  }, []);
  const runExp = async (id: string) => {
    setExpBusy(id);
    await new Promise((r) => setTimeout(r, 20));
    const r = await runExperiment(id, Math.min(seeds, 4));
    setExps((e) => ({ ...e, [id]: r }));
    setExpBusy(null);
  };
  const flat = res?.rows.map((r) => ({
    scenario: r.id,
    name: r.name,
    baseline_peak_10min: +r.baseline.peak10.toFixed(1),
    deltatrace_peak_10min: +r.deltatrace.peak10.toFixed(1),
    baseline_pct_flood: +r.baseline.pctFlood.toFixed(1),
    deltatrace_pct_flood: +r.deltatrace.pctFlood.toFixed(1),
    baseline_alarms_per_hour: +r.baseline.perHour.toFixed(1),
    operator_items: +r.deltatrace.items.toFixed(1),
    suppression_pct: +r.suppression.toFixed(0),
    time_to_first_correct_s: r.timeToFirstCorrect === null ? '' : +r.timeToFirstCorrect.toFixed(0),
    false_incidents: +r.falseIncidents.toFixed(2),
    critical_hidden: r.criticalHidden,
    class_accuracy_pct: r.classAccuracy === null ? '' : +r.classAccuracy.toFixed(0),
    seeds: r.seeds.join(' '),
  }));
  return (
    <div className="page">
      <PageHeader
        title="Benchmarks"
        purpose="Scenarios S0–S8 over several seeds: existing system against DeltaTrace."
        info={['Each run is a simulated 30-minute timeline; nothing is animated.', 'Critical alarms hidden must be 0 in every run.', 'Where DeltaTrace does not help (quiet scenarios, overlapping events), the table says so.', 'All results are simulated.']}
      />
      <Card title="Scenario benchmark" sub="Simulated results: not field measurements" accent="group" actions={
        <div className="row">
          <label className="row" style={{ gap: 6 }}>Seeds <input className="input" type="number" min={1} max={20} value={seeds} onChange={(e) => setSeeds(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} aria-label="Number of seeds" /></label>
          <button className="btn group" onClick={run} disabled={busy}><Play size={14} /> {busy ? 'Running…' : 'Run S0–S8'}</button>
        </div>
      }>
        {busy && (
          <div className="stack" role="status" aria-live="polite">
            <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>
            <span className="muted">Running {label}… {Math.round(progress * 100)}%</span>
          </div>
        )}
        {!busy && !res && <div className="empty"><b style={{ color: 'var(--text)' }}>No results yet</b>Press “Run S0–S8”. Five seeds take a few seconds.</div>}
        {res && !busy && (
          <div className="stack" style={{ gap: 18 }}>
            <Table
              label="Benchmark results"
              maxHeight={520}
              rows={res.rows}
              rowKey={(r) => r.id}
              columns={[
                { key: 'id', header: 'Scenario', render: (r) => <><b>{r.id}</b> <span className="muted">{r.name}</span></> },
                { key: 'peak', header: 'Peak / 10 min', render: (r) => <span className="num">{r.baseline.peak10.toFixed(0)} → <b>{r.deltatrace.peak10.toFixed(0)}</b></span>, className: 'r' },
                { key: 'flood', header: 'Time in flood', render: (r) => <span className="num">{r.baseline.pctFlood.toFixed(0)}% → <b>{r.deltatrace.pctFlood.toFixed(0)}%</b></span>, className: 'r' },
                { key: 'ph', header: 'Alarms / hour', render: (r) => <span className="num">{r.baseline.perHour.toFixed(0)}</span>, className: 'r' },
                { key: 'items', header: 'Operator items', render: (r) => <span className="num">{r.baseline.items.toFixed(0)} → <b>{r.deltatrace.items.toFixed(0)}</b></span>, className: 'r' },
                { key: 'sup', header: 'Suppression', render: (r) => <span className="num">{r.suppression.toFixed(0)}%</span>, className: 'r' },
                { key: 'ttfc', header: 'Time to first correct incident', render: (r) => <span className="num">{r.timeToFirstCorrect === null ? '–' : `${r.timeToFirstCorrect.toFixed(0)} s`}</span>, className: 'r' },
                { key: 'fi', header: 'False incidents', render: (r) => <span className="num">{r.falseIncidents.toFixed(1)}</span>, className: 'r' },
                { key: 'ch', header: 'Critical hidden', render: (r) => <span className={`badge ${r.criticalHidden === 0 ? 'ok' : 'bad'}`}>{r.criticalHidden}</span>, className: 'r' },
                { key: 'acc', header: 'Class accuracy', render: (r) => <span className="num">{r.classAccuracy === null ? '–' : `${r.classAccuracy.toFixed(0)}%`}</span>, className: 'r' },
                { key: 'note', header: 'Honest note', className: 'note-col', render: (r) => <span className="muted">{r.note ?? ''}</span> },
              ]}
            />
            <div className="two-col">
              <GroupedBars title="Peak alarms in any 10 min" a="Existing system" b="DeltaTrace operator items" unit="" rows={res.rows.map((r) => ({ id: r.id, a: r.baseline.peak10, b: r.deltatrace.peak10 }))} />
              <GroupedBars title="% of time in alarm flood (≥ 10 in 10 min)" a="Existing system" b="DeltaTrace" unit="%" rows={res.rows.map((r) => ({ id: r.id, a: r.baseline.pctFlood, b: r.deltatrace.pctFlood }))} />
            </div>
            <Confusion m={res.confusion} />
            <div className="row">
              <button className="btn primary" onClick={() => benchmarkReport(res, Object.values(exps))}><FileText size={14} /> PDF report</button>
              <button className="btn" onClick={() => download('deltatrace-benchmarks.json', JSON.stringify({ simulated: true, seeds: res.rows.map((r) => ({ scenario: r.id, seeds: r.seeds })), rows: res.rows, confusion: res.confusion }, null, 2))}><Download size={14} /> JSON</button>
              <button className="btn" onClick={() => download('deltatrace-benchmarks.csv', toCsv(flat!), 'text/csv')}><Download size={14} /> CSV</button>
              <button className="btn" onClick={async () => toast((await copyText(toMarkdownTable(flat!))) ? 'Markdown table copied' : 'Copy failed', 'ok')}><Copy size={14} /> Copy as Markdown table</button>
              <span className="muted">Seeds used: {res.rows[1]?.seeds.join(', ')} (offsets of each scenario’s default). Results are simulated.</span>
            </div>
          </div>
        )}
      </Card>

      <Card title="Experiments E1–E7" sub="Run on demand" accent="tune">
        <div className="exp-grid">
          {EXPERIMENTS.map((e) => {
            const r = exps[e.id];
            return (
              <div key={e.id} className="exp-card">
                <div className="row">
                  <FlaskConical size={16} aria-hidden />
                  <b>{e.id} · {e.title}</b>
                  <span className="grow" />
                  <button className="btn sm" onClick={() => runExp(e.id)} disabled={expBusy !== null}>{expBusy === e.id ? 'Running…' : r ? 'Re-run' : 'Run'}</button>
                </div>
                <p className="muted">{e.shows}</p>
                {r && (
                  <>
                    <div className="table-wrap" style={{ ['--max-h' as string]: '240px' }}>
                      <table className="tbl" aria-label={r.title}>
                        <thead><tr>{r.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                        <tbody>{r.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                    <div className={`note ${r.good ? 'ok' : 'warn'}`}>{r.note}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
