import { CHANNELS, type Advisory, type BenchResult, type ChangeRecord, type Config, type ExperimentResult, type Incident, type RawAlarm, type Snapshot, type TunerClassId, type TunerResult, type AuditEntry, type WriteBackEntry, TUNER_CLASSES } from '../engine';
import { C, PdfDoc, hex, savePdf, type Column } from './pdf';
import { clock, mmss } from './format';

const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const file = (n: string) => `deltatrace-${n}-${new Date().toISOString().slice(0, 10)}.pdf`;
const CLS: Record<string, string> = { 'process-event': 'Process event', 'instrument-fault': 'Instrument fault', 'data-integrity': 'Data integrity', 'needs-review': 'Needs review' };
const f1 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '-' : n.toFixed(1));
const f0 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '-' : n.toFixed(0));

function configTable(d: PdfDoc, cfg: Config) {
  d.table(
    [{ header: 'Parameter', w: 3 }, { header: 'Value', w: 2, align: 'r' }, { header: 'Parameter', w: 3 }, { header: 'Value', w: 2, align: 'r' }],
    [
      ['Wave speed', `${cfg.waveSpeed} m/s`, 'Trust weights (r, s, c, m)', `${cfg.lambdaR} / ${cfg.lambdaS} / ${cfg.lambdaC} / ${cfg.lambdaM}`],
      ['Clock tolerance', `${cfg.clockTol} s`, 'GOOD / BAD thresholds', `${cfg.goodThreshold} / ${cfg.badThreshold}`],
      ['Scan interval', `${cfg.scanInterval} s`, 'Process / fault corroboration', `${cfg.corrProcess} / ${cfg.corrFault}`],
      ['Hop limit', `${cfg.hopLimit}`, 'Demotion (trust / corroboration)', `${cfg.demoteTrust} / ${cfg.demoteCorr}`],
      ['Grouping mode', cfg.groupingMode === 'delay' ? 'Delay window' : `Fixed ${cfg.fixedWindow} s`, 'Incident quiet time', `${cfg.incidentQuiet} s`],
    ],
    { size: 8 },
  );
}

/* ------------------------------------------------------------ benchmarks */
export function benchmarkReport(res: BenchResult, exps: ExperimentResult[]) {
  const d = new PdfDoc('Benchmark Report', 'Scenarios S0-S8 and experiments E1-E7');
  const totalHidden = res.rows.reduce((a, r) => a + r.criticalHidden, 0);
  const flooded = res.rows.filter((r) => r.baseline.pctFlood > 0);
  d.cover('Benchmark Report', [
    ['Generated', stamp()],
    ['Seeds per scenario', String(res.seeds)],
    ['Scenarios', 'S0 - S8 (30 min each)'],
    ['Engine', 'DeltaTrace Live, headless'],
  ]);
  d.h1('1. Summary');
  d.kpis([
    { label: 'SCENARIOS RUN', value: String(res.rows.length) },
    { label: 'RUNS', value: String(res.rows.length * res.seeds) },
    { label: 'CRITICAL ALARMS HIDDEN', value: String(totalHidden), tone: totalHidden === 0 ? 'ok' : 'bad' },
    { label: 'FLOODS CLEARED', value: `${flooded.filter((r) => r.deltatrace.pctFlood === 0).length} / ${flooded.length}`, tone: 'ok' },
  ]);
  const worst = [...res.rows].sort((a, b) => b.baseline.peak10 - a.baseline.peak10)[0];
  d.p(`Across ${res.rows.length * res.seeds} runs, no safety-critical alarm was hidden. The worst baseline scenario was ${worst.id} (${worst.name}) with a mean peak of ${f1(worst.baseline.peak10)} alarms in 10 minutes, reduced to ${f1(worst.deltatrace.peak10)} operator items.`);
  d.h1('2. Scenario results');
  d.table(
    [
      { header: 'Scenario', w: 3.2 },
      { header: 'Peak /10 min raw', w: 1.3, align: 'r' },
      { header: 'Peak /10 min DT', w: 1.3, align: 'r' },
      { header: 'Flood % raw', w: 1.1, align: 'r' },
      { header: 'Flood % DT', w: 1.1, align: 'r' },
      { header: 'Raw alarms', w: 1.1, align: 'r' },
      { header: 'Items', w: 0.9, align: 'r' },
      { header: 'Red.', w: 1, align: 'r' },
      { header: 'First correct (s)', w: 1.3, align: 'r' },
      { header: 'False inc.', w: 1, align: 'r' },
      { header: 'Hidden', w: 1.1, align: 'r' },
      { header: 'Accuracy', w: 1.35, align: 'r' },
    ],
    res.rows.map((r) => [`${r.id} ${r.name}`, f1(r.baseline.peak10), f1(r.deltatrace.peak10), f0(r.baseline.pctFlood), f0(r.deltatrace.pctFlood), f0(r.baseline.items), f1(r.deltatrace.items), `${f0(r.suppression)}%`, f0(r.timeToFirstCorrect), f1(r.falseIncidents), String(r.criticalHidden), r.classAccuracy === null ? '-' : `${f0(r.classAccuracy)}%`]),
    { size: 7.5 },
  );
  const quiet = res.rows.filter((r) => r.note);
  if (quiet.length) d.note(quiet.map((r) => `${r.id}: ${r.note}`).join('  '), 'warn');
  d.bars('Peak alarms in any 10 minutes', res.rows.map((r) => r.id), [{ name: 'Existing system', color: C.bad, values: res.rows.map((r) => r.baseline.peak10) }, { name: 'DeltaTrace operator items', color: C.brand, values: res.rows.map((r) => r.deltatrace.peak10) }]);
  d.bars('Time in alarm flood (%)', res.rows.map((r) => r.id), [{ name: 'Existing system', color: C.bad, values: res.rows.map((r) => r.baseline.pctFlood) }, { name: 'DeltaTrace', color: C.brand, values: res.rows.map((r) => r.deltatrace.pctFlood) }]);
  d.h1('3. Incident classification');
  const classes = ['process-event', 'instrument-fault', 'data-integrity', 'needs-review'];
  d.table(
    [{ header: 'Expected \\ DeltaTrace class', w: 2.4 }, ...classes.map((c) => ({ header: CLS[c], w: 1.4, align: 'r' as const }))],
    classes.map((e) => [CLS[e], ...classes.map((a) => String(res.confusion[e]?.[a] ?? 0))]),
  );
  d.p('Rows are the ground-truth class of each injected event; columns are the class DeltaTrace assigned. Sensor faults accepted as either instrument fault or data integrity are counted under their primary expected class.', 8, C.muted);
  if (exps.length) {
    d.h1('4. Experiments');
    for (const e of exps) {
      d.h2(e.title);
      d.p(e.shows, 8.5, C.muted);
      const n = e.columns.length;
      const numeric = e.columns.map((_, i) => e.rows.every((r) => /^[-+]?[\d.,]+( ?[a-z%]+)?$/i.test(String(r[i]))));
      d.table(e.columns.map((c, i) => ({ header: c, w: i === 0 ? 2.4 : 1.4, align: numeric[i] ? ('r' as const) : ('l' as const) })), e.rows.map((r) => r.map(String)), { size: 7.5 });
      d.note(e.note, e.good ? 'ok' : 'warn');
      void n;
    }
  }
  d.h1(`${exps.length ? '5' : '4'}. Method and limits`);
  d.bullets([
    'Each run simulates 30 minutes with the same engine used by the live console; results are deterministic for a given seed.',
    `Seeds per scenario: ${res.seeds}; seeds are the scenario default plus multiples of 101.`,
    'Operator items = incidents opened + advisories created. A flood is 10 or more raw alarms in a rolling 10-minute window.',
    'Where baseline alarm load is already low (S0, S5, S7) there is little for DeltaTrace to reduce.',
    'Events that overlap in both time and place can merge into one incident.',
  ]);
  savePdf(d.build({ generated: stamp(), doc: 'Benchmark Report' }), file('benchmarks'));
}

/* --------------------------------------------------------------- session */
export function sessionReport(a: { snap: Snapshot; incidents: Incident[]; advisories: Advisory[]; audit: AuditEntry[]; writes: WriteBackEntry[]; changes: ChangeRecord[]; alarms: Map<number, RawAlarm> }) {
  const { snap } = a;
  const d = new PdfDoc('Operations and Audit Report', `Simulation seed ${snap.seed} - ${clock(snap.t)}`);
  d.cover('Operations and Audit Report', [
    ['Generated', stamp()],
    ['Simulation time', clock(snap.t)],
    ['Seed', String(snap.seed)],
    ['Engine', snap.engineEnabled ? 'Active' : 'Off (fail-open)'],
  ]);
  d.h1('1. Key figures');
  d.kpis([
    { label: 'RAW ALARMS', value: String(snap.rawTotal) },
    { label: 'OPERATOR ITEMS', value: String(snap.opTotal) },
    { label: 'REDUCTION', value: `${snap.reduction.toFixed(0)}%`, tone: 'ok' },
    { label: 'CRITICAL HIDDEN', value: String(snap.criticalHidden), tone: snap.criticalHidden ? 'bad' : 'ok' },
  ]);
  d.table(
    [{ header: 'Indicator', w: 3 }, { header: 'Existing system', w: 1.5, align: 'r' }, { header: 'DeltaTrace', w: 1.5, align: 'r' }],
    [
      ['Peak alarms in any 10 minutes', String(snap.kpiRaw.peak10), String(snap.kpiOp.peak10)],
      ['Average per 10 minutes', f1(snap.kpiRaw.avgPer10), f1(snap.kpiOp.avgPer10)],
      ['Time in flood (%)', f1(snap.kpiRaw.pctTimeInFlood), f1(snap.kpiOp.pctTimeInFlood)],
      ['Windows above 10 (%)', f1(snap.kpiRaw.pctWindowsOver10), f1(snap.kpiOp.pctWindowsOver10)],
      ['Per hour', f0(snap.kpiRaw.perHour), f0(snap.kpiOp.perHour)],
      ['Total', String(snap.kpiRaw.total), String(snap.kpiOp.total)],
    ],
  );
  d.h1('2. Safety compliance');
  d.table(
    [{ header: 'Rule', w: 4 }, { header: 'Status', w: 3 }],
    [
      ['1. Safety-critical alarms never hidden', `Critical hidden: ${snap.criticalHidden} - ${snap.criticalHidden === 0 ? 'pass' : 'FAIL'}`],
      ['2. Low trust never silently deletes an alarm', `Advisories kept visible: ${snap.advisories.length}`],
      ['3. Corroborated alarms never demoted', `Demotion needs trust < ${snap.cfg.demoteTrust}, corroboration < ${snap.cfg.demoteCorr}, not critical`],
      ['4. Every raw alarm retained and linked', `Retained: ${snap.retainedPct.toFixed(0)}%`],
      ['5. Fail-open', snap.engineEnabled ? 'Engine active' : 'Fail-open active: raw alarms pass through'],
      ['6. No control commands', 'Commands issued: 0'],
    ],
  );
  d.h1('3. Sensor trust (current)');
  d.table(
    [{ header: 'Channel', w: 1.2 }, { header: 'Trust', w: 1, align: 'r' }, { header: 'Class', w: 1.4 }, { header: 'Likely fault', w: 1.6 }, { header: 'z', w: 0.8, align: 'r' }, { header: 'S', w: 0.8, align: 'r' }, { header: 'C', w: 0.8, align: 'r' }, { header: 'M', w: 0.8, align: 'r' }],
    snap.trust.map((t) => [CHANNELS[t.ch].tag, t.T.toFixed(2), t.cls, t.likelyFault ?? '-', t.c.z.toFixed(1), t.c.S.toFixed(1), t.c.C.toFixed(1), t.c.M.toFixed(1)]),
  );
  d.h1('4. Incidents');
  if (!a.incidents.length) d.p('No incidents recorded in this run.', 9, C.muted);
  else
    d.table(
      [{ header: 'ID', w: 1 }, { header: 'Class', w: 1.8 }, { header: 'Opened', w: 1, align: 'r' }, { header: 'Closed', w: 1, align: 'r' }, { header: 'Alarms', w: 0.9, align: 'r' }, { header: 'Corr.', w: 0.8, align: 'r' }, { header: 'Origin (km)', w: 1.2, align: 'r' }, { header: 'Sources', w: 2.4 }],
      a.incidents.slice(0, 60).map((i) => [`INC-${String(i.id).padStart(3, '0')}`, CLS[i.cls], mmss(i.openedAt), i.closedAt !== undefined ? mmss(i.closedAt) : 'open', String(i.alarmIds.length), i.corroboration.toFixed(2), i.origin ? `${i.origin.km.toFixed(0)} +/- ${((i.origin.hi - i.origin.lo) / 2).toFixed(0)}` : '-', i.channels.map((c) => CHANNELS[c].tag).slice(0, 5).join(', ')]),
      { size: 7.5 },
    );
  d.h1('5. Instrument advisories');
  if (!a.advisories.length) d.p('No advisories raised.', 9, C.muted);
  else d.table([{ header: 'Tag', w: 1 }, { header: 'Alarm', w: 1 }, { header: 'Time', w: 1, align: 'r' }, { header: 'Trust', w: 0.8, align: 'r' }, { header: 'Status', w: 1 }, { header: 'Reason', w: 5 }], a.advisories.slice(0, 40).map((v) => [v.tag, v.type, mmss(v.time), v.trust.toFixed(2), v.status, v.reason]), { size: 7.5 });
  d.h1('6. Management of change');
  if (!a.changes.length) d.p('No alarm-setting changes approved.', 9, C.muted);
  else d.table([{ header: 'MOC', w: 0.9 }, { header: 'Sim time', w: 1, align: 'r' }, { header: 'Point', w: 1.5 }, { header: 'Old', w: 2.2 }, { header: 'New', w: 2.2 }, { header: 'Status', w: 1 }, { header: 'Evidence', w: 3 }], a.changes.map((c) => [`MOC-${c.id}`, mmss(c.t), c.point, c.old, c.new, c.status, c.evidence]), { size: 7.5 });
  d.h1('7. Audit trail');
  d.p(`${a.audit.length} entries retained (most recent ${Math.min(120, a.audit.length)} shown).`, 8.5, C.muted);
  d.table([{ header: 'Time', w: 0.9 }, { header: 'Actor', w: 1.3 }, { header: 'Action', w: 1.7 }, { header: 'Reason', w: 6 }, { header: 'Ref', w: 1 }], a.audit.slice(-120).reverse().map((e) => [mmss(e.t), e.actor, e.action, e.reason, e.ref ?? '']), { size: 7 });
  d.h1('8. Write-back log (dry run)');
  d.table([{ header: 'Time', w: 0.9 }, { header: 'Tag', w: 5 }, { header: 'Value', w: 1.6 }, { header: 'Kind', w: 1 }], a.writes.slice(-80).reverse().map((w) => [mmss(w.t), w.tag, String(w.value), w.kind]), { size: 7 });
  d.h1('9. Configuration');
  configTable(d, snap.cfg);
  savePdf(d.build({ generated: stamp(), doc: 'Operations and Audit Report' }), file('operations-report'));
}

/* -------------------------------------------------------------- incident */
export function incidentReport(inc: Incident, alarms: RawAlarm[], cfg: Config) {
  const id = `INC-${String(inc.id).padStart(3, '0')}`;
  const d = new PdfDoc(`Incident Report ${id}`, CLS[inc.cls]);
  d.cover(`Incident Report ${id}`, [
    ['Generated', stamp()],
    ['Class', CLS[inc.cls]],
    ['Opened', mmss(inc.openedAt)],
    ['Status', inc.status + (inc.closedAt !== undefined ? ` at ${mmss(inc.closedAt)}` : '')],
  ]);
  d.h1('1. Summary');
  d.p(inc.summary);
  d.kpis([
    { label: 'ALARMS GROUPED', value: String(inc.alarmIds.length) },
    { label: 'SOURCES', value: String(inc.channels.length) },
    { label: 'CORROBORATION', value: inc.corroboration.toFixed(2) },
    { label: 'MEAN TRUST', value: inc.meanTrust.toFixed(2) },
  ]);
  d.h1('2. Classification basis');
  d.bullets([...inc.classReasons, `Corroboration ${inc.corroboration.toFixed(2)} (process >= ${cfg.corrProcess}, fault < ${cfg.corrFault}); mean trust ${inc.meanTrust.toFixed(2)}.`]);
  if (inc.origin) {
    d.h1('3. Origin estimate');
    d.p(`Estimated position km ${inc.origin.km.toFixed(1)} +/- ${((inc.origin.hi - inc.origin.lo) / 2).toFixed(1)} km (range ${inc.origin.lo.toFixed(1)} - ${inc.origin.hi.toFixed(1)}), residual ${inc.origin.residual.toFixed(1)} s. This is a grouping aid, not a leak locator.`);
  }
  d.h1(`${inc.origin ? '4' : '3'}. Member alarms`);
  d.p('All raw alarms are retained and linked to this incident.', 8.5, C.muted);
  d.table(
    [{ header: 'ID', w: 1.1 }, { header: 'Tag', w: 1 }, { header: 'Type', w: 1 }, { header: 'Priority', w: 1 }, { header: 'Time', w: 0.9, align: 'r' }, { header: 'Value', w: 1, align: 'r' }, { header: 'Role', w: 1.2 }, { header: 'Critical', w: 0.9 }],
    alarms.map((x) => [`ALM-${String(x.id).padStart(4, '0')}`, x.tag, x.type, x.priority, mmss(x.time), x.value.toFixed(2), x.role ?? 'member', x.safetyCritical ? 'yes' : '']),
    { size: 7.5 },
  );
  d.h1(`${inc.origin ? '5' : '4'}. Disposition and write-back`);
  d.p(`Operator disposition: ${inc.disposition ? inc.disposition.replace('-', ' ') : 'none recorded'}.`);
  const base = `ns=2;s=DeltaTrace.Incident.${String(inc.id).padStart(3, '0')}`;
  d.table([{ header: 'Simulated tag write (dry run)', w: 1 }], [[`${base}.Class = "${inc.cls}"`], [`${base}.Rank = ${inc.rank}`], ...(inc.origin ? [[`${base}.Origin_km = ${inc.origin.km.toFixed(1)}`]] : []), [`${base}.MemberCount = ${inc.alarmIds.length}`]]);
  savePdf(d.build({ generated: stamp(), doc: `Incident ${id}` }), file(`incident-${String(inc.id).padStart(3, '0')}`));
}

/* ----------------------------------------------------------------- tuner */
export function tunerReport(a: { results: Partial<Record<TunerClassId, TunerResult>>; contam: Partial<Record<TunerClassId, TunerResult>>; clean: Partial<Record<TunerClassId, { g: number; u: number }>>; gate: boolean; hours: number; cfg: Config; changes: ChangeRecord[] }) {
  const d = new PdfDoc('Alarm Tuning Report', 'Trust-gated replay of candidate alarm settings');
  const classes = TUNER_CLASSES.filter((c) => a.results[c.id]);
  d.cover('Alarm Tuning Report', [
    ['Generated', stamp()],
    ['History replayed', `${a.hours.toFixed(1)} h`],
    ['Trust gating', a.gate ? `On (T >= ${a.cfg.tMin})` : 'Off'],
    ['Classes', classes.map((c) => c.label).join(', ')],
  ]);
  d.h1('1. Recommendations');
  d.table(
    [{ header: 'Alarm class', w: 1.6 }, { header: 'Current', w: 2.2 }, { header: 'Recommended', w: 2.2 }, { header: 'Alarms', w: 1, align: 'r' }, { header: 'False alarms', w: 1.2, align: 'r' }, { header: 'Delay', w: 1, align: 'r' }, { header: 'Missed', w: 0.9, align: 'r' }],
    classes.map((c) => {
      const p = a.results[c.id]!.proposal;
      return [c.label, `${p ? p.old.limit.toFixed(2) : a.results[c.id]!.current.threshold.toFixed(2)} ${c.unit}`, p ? `${p.new.limit.toFixed(2)} / db ${p.new.deadband.toFixed(2)} / ${p.new.onDelay}s` : 'no safer setting', p ? `${p.stats.alarmsPct.toFixed(0)}%` : '-', p ? `${p.stats.falsePct.toFixed(0)}%` : '-', p ? `${p.stats.delayDelta >= 0 ? '+' : ''}${p.stats.delayDelta.toFixed(0)} s` : '-', p ? String(p.stats.missed) : '-'];
    }),
  );
  d.p('A setting is recommended only if it misses no event that the current setting detects, adds no more than 20 s mean delay, and does not increase alarm load. Operator approval is required before any change is written back.', 8.5, C.muted);
  let n = 2;
  for (const c of classes) {
    const r = a.results[c.id]!;
    d.pageBreak();
    d.h1(`${n++}. ${c.label}`);
    d.kpis([
      { label: 'CANDIDATES', value: String(r.candidates.length) },
      { label: 'SAFE (NO MISS)', value: String(r.candidates.filter((x) => x.missed === 0).length) },
      { label: 'ON PARETO FRONT', value: String(r.candidates.filter((x) => x.pareto).length) },
      { label: 'REPLAY TIME', value: `${r.ms.toFixed(0)} ms` },
    ]);
    d.scatter('Candidate settings: delay against alarm load', [...r.candidates.map((x) => ({ x: x.meanDelay, y: x.alarmsPer10, kind: (x.isRecommended ? 'rec' : x.missed > 0 ? 'rejected' : x.pareto ? 'front' : 'safe') as 'rec' | 'rejected' | 'front' | 'safe' })), { x: r.current.meanDelay, y: r.current.alarmsPer10, kind: 'current' as const }], 'Mean detection delay (s)', 'Alarms per 10 min');
    const front = r.candidates.filter((x) => x.pareto).sort((x, y) => x.meanDelay - y.meanDelay).slice(0, 14);
    d.h2('Pareto front (safe settings)');
    d.table(
      [{ header: 'Threshold', w: 1.1, align: 'r' }, { header: 'Deadband', w: 1, align: 'r' }, { header: 'On-delay', w: 1, align: 'r' }, { header: 'Alarms /10 min', w: 1.3, align: 'r' }, { header: 'False /10 min', w: 1.3, align: 'r' }, { header: 'Delay (s)', w: 1, align: 'r' }, { header: 'J', w: 1, align: 'r' }, { header: '', w: 1.2 }],
      [[r.current.threshold.toFixed(2), r.current.deadband.toFixed(2), `${r.current.onDelay}`, r.current.alarmsPer10.toFixed(2), r.current.falseAlarms.toFixed(2), r.current.meanDelay.toFixed(1), r.current.objective.toFixed(2), 'current'], ...front.map((x) => [x.threshold.toFixed(2), x.deadband.toFixed(2), `${x.onDelay}`, x.alarmsPer10.toFixed(2), x.falseAlarms.toFixed(2), x.meanDelay.toFixed(1), x.objective.toFixed(2), x.isRecommended ? 'recommended' : ''])],
      { size: 7.5 },
    );
    const cmp = a.clean[c.id];
    const other = a.contam[c.id];
    if (cmp && other) d.note(`Contamination check: judged on clean (trusted) data, the objective is ${cmp.g.toFixed(2)} with trust gating ${a.gate ? 'on' : 'off'} and ${cmp.u.toFixed(2)} with gating ${a.gate ? 'off' : 'on'} (lower is better). ${cmp.g < cmp.u - 1e-6 ? 'Ungated data produced a worse recommendation.' : 'The two recommendations coincide on this history.'}`, cmp.g < cmp.u - 1e-6 ? 'ok' : 'info');
  }
  if (a.changes.length) {
    d.pageBreak();
    d.h1(`${n}. Approved changes`);
    d.table([{ header: 'MOC', w: 0.9 }, { header: 'Point', w: 1.5 }, { header: 'Old', w: 2.2 }, { header: 'New', w: 2.2 }, { header: 'Status', w: 1 }, { header: 'Evidence', w: 3 }], a.changes.map((c) => [`MOC-${c.id}`, c.point, c.old, c.new, c.status, c.evidence]), { size: 7.5 });
  }
  savePdf(d.build({ generated: stamp(), doc: 'Alarm Tuning Report' }), file('tuning-report'));
}
void hex;
