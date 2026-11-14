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
  { id: 'pipeline', label: 'Pipeline and sensors', sub: '12 pressure, 3 flow channels', x: 24, y: 70, w: 180, h: 60, group: 'field' },
  { id: 'rtu', label: 'RTUs / PLCs', sub: 'sample, timestamp, quality', x: 24, y: 190, w: 180, h: 60, group: 'field' },
  { id: 'comm', label: 'Communication', sub: 'radio, satellite, cellular', x: 254, y: 190, w: 190, h: 60, group: 'comm' },
  { id: 'proto', label: 'Protocols', sub: 'Modbus, DNP3, IEC 104, OPC UA', x: 254, y: 70, w: 190, h: 60, group: 'comm' },
  { id: 'scada', label: 'Central server / SCADA', sub: 'historian, GPS time, alarms', x: 484, y: 190, w: 220, h: 60, group: 'control' },
  { id: 'console', label: 'Operator console', sub: 'alarm list or incidents', x: 484, y: 70, w: 220, h: 60, group: 'control' },
  { id: 'gateway', label: 'Read-only gateway', sub: 'data in only', x: 764, y: 70, w: 276, h: 52, group: 'dt' },
  { id: 'map', label: 'Pipeline map', sub: 'topology, delays', x: 764, y: 152, w: 132, h: 52, group: 'dt' },
  { id: 'trust', label: 'Trust engine', sub: 'function 1', x: 908, y: 152, w: 132, h: 52, group: 'dt' },
  { id: 'group', label: 'Grouping and classification', sub: 'function 2', x: 764, y: 234, w: 276, h: 52, group: 'dt' },
  { id: 'tuner', label: 'Replay tuner', sub: 'function 3', x: 764, y: 316, w: 132, h: 52, group: 'dt' },
  { id: 'audit', label: 'Audit log', sub: 'every decision', x: 908, y: 316, w: 132, h: 52, group: 'dt' },
  { id: 'wb', label: 'Write-back module', sub: 'incidents, flags, approved settings', x: 764, y: 398, w: 276, h: 52, group: 'dt' },
  { id: 'wbif', label: 'Write-back interface', sub: 'controlled, dry run, no commands', x: 764, y: 480, w: 276, h: 52, group: 'dt' },
];

const ARROWS: { id: string; d: string; dash?: boolean; color?: string }[] = [
  { id: 'a1', d: 'M114,130 V190' },
  { id: 'a2', d: 'M204,220 H254' },
  { id: 'a3', d: 'M444,220 H484' },
  { id: 'a3b', d: 'M349,190 V130', color: 'var(--text-muted)' },
  { id: 'a4', d: 'M594,190 V130', dash: true, color: 'var(--warn)' },
  { id: 'a5', d: 'M704,212 H734 V96 H764', color: 'var(--c-trust)' },
  { id: 'a6', d: 'M830,122 V152', color: 'var(--c-trust)' },
  { id: 'a7', d: 'M974,122 V152', color: 'var(--c-trust)' },
  { id: 'a8', d: 'M830,204 V234', color: 'var(--c-group)' },
  { id: 'a9', d: 'M974,204 V234', color: 'var(--c-group)' },
  { id: 'a10', d: 'M830,286 V316', color: 'var(--c-tune)' },
  { id: 'a11', d: 'M974,286 V316', color: 'var(--c-group)' },
  { id: 'a12', d: 'M830,368 V398', color: 'var(--c-tune)' },
  { id: 'a13', d: 'M974,368 V398', color: 'var(--c-group)' },
  { id: 'a14', d: 'M902,450 V480', color: 'var(--brand)' },
  { id: 'a15', d: 'M764,506 H620 Q594,506 594,480 V250', color: 'var(--brand)' },
];
const GROUP_COLOR = { field: 'var(--text-muted)', comm: 'var(--text-muted)', control: 'var(--brand)', dt: 'var(--c-group)' };

export function ArchitectureDiagram({ selected, onSelect, failOpen }: { selected: string | null; onSelect: (id: string) => void; failOpen?: boolean }) {
  return (
    <svg viewBox="0 0 1064 560" width="100%" role="group" aria-label="System architecture diagram. Field sensors and RTUs connect through communication links and protocols to the central SCADA server and operator console. A read-only gateway feeds the DeltaTrace unit, whose write-back interface returns incidents, quality flags and approved settings to the central server. When the engine is off, the SCADA alarm list reaches the console unchanged." style={{ minWidth: 720 }}>
      <defs>
        <marker id="arh" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
        </marker>
      </defs>
      {[
        ['FIELD', 10, 232, 28, 250, 'field'],
        ['COMMUNICATION', 240, 218, 28, 250, 'comm'],
        ['CONTROL CENTRE', 470, 248, 28, 250, 'control'],
        ['DELTATRACE UNIT', 750, 304, 28, 520, 'dt'],
      ].map(([t, x, w, y, h, g]) => (
        <g key={String(t)}>
          <rect x={Number(x)} y={Number(y)} width={Number(w)} height={Number(h)} rx={6} fill="var(--bg-elev-2)" stroke="var(--border)" />
          <text x={Number(x) + 12} y={Number(y) + 18} fontSize={11} fontWeight={700} fill={GROUP_COLOR[g as keyof typeof GROUP_COLOR]} letterSpacing="0.08em">{String(t)}</text>
        </g>
      ))}
      {ARROWS.map((a) => (
        <g key={a.id}>
          <path d={a.d} fill="none" stroke={a.id === 'a4' && !failOpen ? 'var(--text-muted)' : a.color ?? 'var(--brand)'} strokeWidth={1.8} strokeDasharray={a.dash && failOpen ? '6 4' : undefined} markerEnd="url(#arh)" />
          {a.id !== 'a3b' && [0].map((k) => (
            <circle key={k} r={3} fill={a.color ?? 'var(--brand)'}>
              <animateMotion dur="3s" begin={`${(a.id.length % 3) * 0.7}s`} repeatCount="indefinite" path={a.d} />
            </circle>
          ))}
        </g>
      ))}
      <text x={602} y={166} fontSize={10.5} fill="var(--text-muted)">alarm list{failOpen ? ' (fail-open: unchanged)' : ''}</text>
      <text x={602} y={300} fontSize={10.5} fill="var(--text-muted)">operator-approved write-back</text>
      {ARCH_BLOCKS.map((b) => {
        const sel = selected === b.id;
        return (
          <g key={b.id} role="button" tabIndex={0} aria-label={`${b.label}: ${b.sub ?? ''}`} aria-pressed={sel} onClick={() => onSelect(b.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(b.id))} style={{ cursor: 'pointer' }}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={5} fill={sel ? 'var(--brand-soft)' : 'var(--bg-elev-1)'} stroke={sel ? 'var(--brand)' : 'var(--border-strong)'} strokeWidth={sel ? 2 : 1} />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 3} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--text)">{b.label}</text>
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 13} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">{b.sub}</text>
          </g>
        );
      })}
      <g transform="translate(1010,506)" aria-hidden>
        <rect x={-8} y={-2} width={16} height={12} rx={2} fill="var(--bad)" />
        <path d="M-4,-2 v-3 a4,4 0 0 1 8,0 v3" fill="none" stroke="var(--bad)" strokeWidth={2} />
      </g>
      <g transform="translate(478,330)">
        <line x1={0} x2={28} y1={0} y2={0} stroke="var(--brand)" strokeWidth={1.8} />
        <text x={36} y={4} fontSize={11} fill="var(--text-muted)">data flow</text>
        <line x1={0} x2={28} y1={22} y2={22} stroke="var(--warn)" strokeWidth={1.8} strokeDasharray="6 4" />
        <text x={36} y={26} fontSize={11} fill="var(--text-muted)">fail-open path</text>
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
