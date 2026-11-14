export interface ArchBlock {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  group: 'field' | 'comm' | 'control' | 'dt';
}
export const ARCH_BLOCKS: ArchBlock[] = [
  { id: 'pipeline', label: 'Pipeline & sensors', sub: 'PT / FT every ~20 km', x: 20, y: 70, w: 200, h: 70, group: 'field' },
  { id: 'rtu', label: 'RTUs / PLCs', sub: 'sample · timestamp · quality', x: 20, y: 190, w: 200, h: 70, group: 'field' },
  { id: 'comm', label: 'Communication', sub: 'radio · satellite · cellular', x: 270, y: 70, w: 190, h: 70, group: 'comm' },
  { id: 'proto', label: 'Protocols', sub: 'Modbus · DNP3 · IEC 104 · OPC UA', x: 270, y: 190, w: 190, h: 70, group: 'comm' },
  { id: 'scada', label: 'Central server / SCADA', sub: 'reads sensors, raises alarms', x: 510, y: 70, w: 210, h: 70, group: 'control' },
  { id: 'historian', label: 'Historian', sub: 'stored time series', x: 510, y: 190, w: 100, h: 60, group: 'control' },
  { id: 'gps', label: 'GPS time', sub: 'common clock', x: 620, y: 190, w: 100, h: 60, group: 'control' },
  { id: 'console', label: 'Operator console', sub: 'sees the alarm list', x: 510, y: 300, w: 210, h: 70, group: 'control' },
  { id: 'gateway', label: 'Read-only gateway', sub: 'data diode: in only', x: 770, y: 70, w: 190, h: 60, group: 'dt' },
  { id: 'map', label: 'Pipeline map', sub: 'topology · delays', x: 770, y: 170, w: 130, h: 56, group: 'dt' },
  { id: 'trust', label: 'Trust engine', sub: 'innovation 1', x: 910, y: 170, w: 130, h: 56, group: 'dt' },
  { id: 'group', label: 'Grouping & classification', sub: 'innovation 2', x: 770, y: 240, w: 270, h: 56, group: 'dt' },
  { id: 'tuner', label: 'Replay tuner', sub: 'innovation 3', x: 770, y: 310, w: 130, h: 56, group: 'dt' },
  { id: 'audit', label: 'Audit log', sub: 'every decision', x: 910, y: 310, w: 130, h: 56, group: 'dt' },
  { id: 'wb', label: 'Write-back module', sub: 'incidents · flags · approved settings', x: 770, y: 380, w: 270, h: 56, group: 'dt' },
  { id: 'wbif', label: 'Write-back interface', sub: 'controlled, dry-run, no commands', x: 770, y: 470, w: 270, h: 56, group: 'dt' },
];

const ARROWS: { id: string; d: string; dash?: boolean; color?: string }[] = [
  { id: 'a1', d: 'M120,140 V190' },
  { id: 'a2', d: 'M220,225 H270' },
  { id: 'a3', d: 'M365,190 V140' },
  { id: 'a4', d: 'M460,105 H510' },
  { id: 'a5', d: 'M615,140 V190', color: 'var(--text-muted)' },
  { id: 'a6', d: 'M720,105 H770', color: 'var(--c-trust)' },
  { id: 'a7', d: 'M865,130 V170', color: 'var(--c-trust)' },
  { id: 'a8', d: 'M975,226 V240', color: 'var(--c-group)' },
  { id: 'a9', d: 'M905,296 V310', color: 'var(--c-tune)' },
  { id: 'a10', d: 'M905,366 V380', color: 'var(--brand)' },
  { id: 'a11', d: 'M905,436 V470', color: 'var(--brand)' },
  { id: 'a12', d: 'M770,498 H660 Q600,498 600,440 V400 L615,370', color: 'var(--brand)' },
  { id: 'bypass', d: 'M615,140 H640 Q640,215 640,270 V300', dash: true, color: 'var(--warn)' },
];
const GROUP_COLOR = { field: 'var(--text-muted)', comm: 'var(--info)', control: 'var(--brand)', dt: 'var(--c-group)' };

export function ArchitectureDiagram({ selected, onSelect, failOpen }: { selected: string | null; onSelect: (id: string) => void; failOpen?: boolean }) {
  return (
    <svg viewBox="0 0 1080 560" width="100%" role="group" aria-label="System architecture diagram. Field level to communication to control centre; a read-only gateway feeds the DeltaTrace unit; a controlled write-back interface returns incidents, quality flags and approved settings. A fail-open bypass lets raw alarms reach the operator console unchanged.">
      <defs>
        <marker id="arh" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
        </marker>
      </defs>
      {[
        ['Field level', 10, 220, 'field'],
        ['Communication', 260, 210, 'comm'],
        ['Control centre', 500, 230, 'control'],
        ['DeltaTrace unit', 760, 290, 'dt'],
      ].map(([t, x, w, g]) => (
        <g key={String(t)}>
          <rect x={Number(x)} y={28} width={Number(w)} height={t === 'DeltaTrace unit' ? 510 : 360} rx={16} fill="none" stroke={GROUP_COLOR[g as keyof typeof GROUP_COLOR]} strokeDasharray="4 5" opacity={0.6} />
          <text x={Number(x) + 12} y={46} fontSize={12} fontWeight={800} fill={GROUP_COLOR[g as keyof typeof GROUP_COLOR]} letterSpacing="0.06em">{String(t).toUpperCase()}</text>
        </g>
      ))}
      {ARROWS.map((a) => (
        <g key={a.id} opacity={a.id === 'bypass' && !failOpen ? 0.55 : 1}>
          <path id={`arch-${a.id}`} d={a.d} fill="none" stroke={a.color ?? 'var(--brand)'} strokeWidth={a.dash ? 2.5 : 2} strokeDasharray={a.dash ? '7 5' : undefined} markerEnd="url(#arh)" />
          {(!a.dash || failOpen) && [0, 1].map((k) => (
            <circle key={k} r={3.6} fill={a.color ?? 'var(--brand)'}>
              <animateMotion dur={a.dash ? '2.2s' : '2.6s'} begin={`${k * 1.3}s`} repeatCount="indefinite" path={a.d} />
            </circle>
          ))}
        </g>
      ))}
      <text x={652} y={290} fontSize={10.5} fontWeight={700} fill="var(--warn-ink)">fail-open bypass</text>
      {ARCH_BLOCKS.map((b) => {
        const sel = selected === b.id;
        const col = GROUP_COLOR[b.group];
        return (
          <g key={b.id} role="button" tabIndex={0} aria-label={`${b.label}: ${b.sub ?? ''}`} aria-pressed={sel} onClick={() => onSelect(b.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(b.id))} style={{ cursor: 'pointer' }}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} fill={sel ? 'var(--brand-soft)' : 'var(--bg-elev-1)'} stroke={sel ? 'var(--brand)' : col} strokeWidth={sel ? 3 : 1.8} />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 4} textAnchor="middle" fontSize={b.w < 140 ? 11.5 : 13} fontWeight={700} fill="var(--text)">{b.label}</text>
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 13} textAnchor="middle" fontSize={b.w < 140 ? 9 : 10} fill="var(--text-muted)">{b.sub}</text>
          </g>
        );
      })}
      <g transform="translate(1010,495)">
        <rect x={-14} y={-4} width={28} height={22} rx={5} fill="var(--bad)" />
        <path d="M-8,-4 v-6 a8,8 0 0 1 16,0 v6" fill="none" stroke="var(--bad)" strokeWidth={3} />
        <text y={36} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--bad-ink)">NO CONTROL</text>
        <text y={47} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--bad-ink)">COMMANDS</text>
      </g>
    </svg>
  );
}

export const ARCH_INFO: Record<string, { role: string; inputs: string; outputs: string }> = {
  pipeline: { role: 'The physical 200 km product pipeline with a pressure transmitter about every 20 km and three flow meters.', inputs: 'Process (pumps, valves, leaks)', outputs: 'Pressure and flow signals' },
  rtu: { role: 'Remote terminal units sample the sensors, stamp the time and attach a quality code.', inputs: 'Analogue signals', outputs: 'Timestamped samples (clock skew possible)' },
  comm: { role: 'Radio, satellite or cellular links carry the samples to the control centre. Links can drop (comms outage).', inputs: 'RTU frames', outputs: 'Stale or fresh samples' },
  proto: { role: 'Standard industrial protocols: Modbus, DNP3, IEC 60870-5-104 and OPC UA.', inputs: 'Samples', outputs: 'Tag values' },
  scada: { role: 'The existing SCADA server reads the sensors, draws dashboards and raises an alarm whenever a reading crosses a limit.', inputs: 'Tag values, operator actions', outputs: 'Raw alarms, trends' },
  historian: { role: 'Stores every value for later replay. The Replay Tuner uses this history.', inputs: 'Tag values', outputs: 'History' },
  gps: { role: 'A common time source keeps RTU clocks close. DeltaTrace tolerates a few seconds of skew.', inputs: 'GPS', outputs: 'Time' },
  console: { role: 'What the operator sees. Normally the raw alarm list; with DeltaTrace, incidents and advisories.', inputs: 'Alarms or incidents', outputs: 'Operator decisions' },
  gateway: { role: 'Read-only: data flows in only. Nothing from DeltaTrace can reach the field through this door.', inputs: 'Copies of tags and alarms', outputs: 'Data for the engines' },
  map: { role: 'Knows where every sensor is, so it can compute the pressure-wave travel time between any two.', inputs: 'Topology, wave speed', outputs: 'delay = distance ÷ wave speed' },
  trust: { role: 'Gives every sensor a live trust score from neighbour agreement, mass balance, signal behaviour and comms health.', inputs: 'Sensor samples', outputs: 'Trust 0–1, class, likely fault' },
  group: { role: 'Groups alarms whose time differences fit the wave travel time, weights by trust, classifies, ranks and keeps every raw alarm.', inputs: 'Raw alarms, trust', outputs: 'Incidents, advisories' },
  tuner: { role: 'Replays candidate thresholds on stored data from trusted sensors only and proposes the best safe setting.', inputs: 'History, trust, labels', outputs: 'Change proposal (needs approval)' },
  audit: { role: 'Records every grouping decision, demotion, class change, approval, revert and fail-open event.', inputs: 'Engine decisions', outputs: 'Audit trail' },
  wb: { role: 'Prepares the only three kinds of write-back: incident records, derived quality flags and operator-approved alarm parameters.', inputs: 'Incidents, trust, approvals', outputs: 'Tag writes' },
  wbif: { role: 'A controlled interface. Writes are dry-run in this demo. It never carries control commands.', inputs: 'Tag writes', outputs: 'Central server tags' },
};
