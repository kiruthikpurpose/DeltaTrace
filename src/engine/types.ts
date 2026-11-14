export type TrustClass = 'GOOD' | 'UNCERTAIN' | 'BAD';
export type IncidentClass = 'process-event' | 'instrument-fault' | 'data-integrity' | 'needs-review';
export type LikelyFault = 'stuck' | 'drift' | 'spike' | 'stale' | 'replay' | 'inconsistent' | null;
export type AlarmType = 'LL' | 'L' | 'H' | 'HH' | 'ROC' | 'FLOWDEV' | 'FLOWLOW' | 'FLOWHIGH' | 'COMM' | 'FLAT' | 'DQ';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type SensorFaultType = 'stuck' | 'drift' | 'spike' | 'replay' | 'falseDrop' | 'comms' | 'skew';
export type EventType = 'pumpTrip' | 'valveClosure' | 'leak' | 'batch';
export type FaultType = SensorFaultType | EventType;
export type Size = 'small' | 'medium' | 'large';

export interface Channel {
  id: number;
  tag: string;
  kind: 'PT' | 'FT';
  node: number;
  km: number;
}

export interface NodeDef {
  id: number;
  name: string;
  km: number;
  kind: 'injection' | 'pump' | 'valve' | 'tap' | 'terminal';
  rtu: string;
}

export interface FaultSpec {
  type: FaultType;
  /** sensor faults: one or more channels */
  channels?: number[];
  channel?: number;
  /** pump trip / valve closure node */
  node?: number;
  /** leak position */
  km?: number;
  size?: Size;
  /** seconds from now until start (default 0) */
  delay?: number;
  /** seconds; undefined = until cleared */
  duration?: number;
  /** skew amplitude seconds */
  amount?: number;
  label?: string;
}

export interface ActiveFault {
  id: number;
  spec: FaultSpec;
  kind: 'sensor' | 'process';
  startAt: number;
  endAt: number; // Infinity
  started: boolean;
  label: string;
  /** ground-truth tag for scoring */
  channels: number[];
  km: number | null;
  size: Size;
}

export interface AlarmCfg {
  limit: number;
  deadband: number;
  onDelay: number;
}
export interface AlarmSettings {
  ptLow: AlarmCfg;
  ptLowLow: AlarmCfg;
  ptHigh: AlarmCfg;
  ptHighHigh: AlarmCfg;
  roc: AlarmCfg;
  /** percent of nominal line flow */
  flowDev: AlarmCfg;
}
export type TunerClassId = 'ptLow' | 'ptHigh' | 'roc' | 'flowDev';

export interface Config {
  waveSpeed: number; // m/s
  clockTol: number; // s
  scanInterval: number; // s
  hopLimit: number;
  incidentQuiet: number; // s
  engineEnabled: boolean;
  groupingMode: 'delay' | 'fixed';
  fixedWindow: number;
  clockSkew: number; // +- s
  lambdaR: number;
  lambdaS: number;
  lambdaC: number;
  lambdaM: number;
  goodThreshold: number;
  badThreshold: number;
  corrProcess: number;
  corrFault: number;
  demoteTrust: number;
  demoteCorr: number;
  advisoryRetention: number;
  trustGating: boolean;
  tMin: number;
  alarms: AlarmSettings;
}

export interface TrustComponents {
  z: number;
  residual: number;
  predicted: number;
  sigma: number;
  S: number;
  C: number;
  M: number;
  coherent: boolean;
}
export interface TrustState {
  ch: number;
  T: number;
  Traw: number;
  cls: TrustClass;
  likelyFault: LikelyFault;
  c: TrustComponents;
}

export interface RawAlarm {
  id: number;
  tag: string;
  ch: number;
  node: number;
  type: AlarmType;
  severity: 1 | 2 | 3 | 4;
  priority: Priority;
  safetyCritical: boolean;
  time: number; // RTU timestamp (with skew)
  trueTime: number;
  value: number;
  state: 'active' | 'cleared';
  clearedAt?: number;
  source: 'scada' | 'deltatrace';
  incidentId?: number;
  advisoryId?: number;
  role?: 'headline' | 'member' | 'advisory' | 'passthrough';
  trustAtRaise: number;
}

export interface Origin {
  km: number;
  lo: number;
  hi: number;
  t0: number;
  residual: number;
  /** residual curve sampled every 2 km for charts */
  curve: { km: number; cost: number }[];
}

export interface Incident {
  id: number;
  openedAt: number;
  lastAlarmAt: number;
  closedAt?: number;
  status: 'open' | 'closed';
  cls: IncidentClass;
  provisional: boolean;
  reclassifiedAt?: number;
  prevCls?: IncidentClass;
  classReasons: string[];
  alarmIds: number[];
  headlineIds: number[];
  channels: number[];
  advisoryChannels: number[];
  corroboration: number;
  meanTrust: number;
  score: number;
  rank: number;
  critical: boolean;
  origin?: Origin;
  segment: [number, number];
  summary: string;
  fixedClass?: IncidentClass;
  version: number;
  disposition?: Disposition;
  fault?: string;
}

export type Disposition = 'confirmed' | 'false-alarm' | 'instrument-fault' | 'needs-maintenance';

export interface Advisory {
  id: number;
  alarmId: number;
  tag: string;
  ch: number;
  type: AlarmType;
  time: number;
  trust: number;
  corroboration: number;
  reason: string;
  status: 'open' | 'restored';
  version: number;
}

export interface WriteBackEntry {
  id: number;
  t: number;
  tag: string;
  value: string | number;
  kind: 'incident' | 'quality' | 'setting';
  dryRun: boolean;
}

export interface AuditEntry {
  id: number;
  t: number;
  actor: 'DeltaTrace' | 'Operator' | 'Simulation';
  action: string;
  reason: string;
  ref?: string;
}

export interface KpiSet {
  avgPer10: number;
  peak10: number;
  pctWindowsOver10: number;
  pctTimeInFlood: number;
  perHour: number;
  total: number;
  staleAlarms: number;
}

export interface Snapshot {
  t: number;
  running?: boolean;
  engineEnabled: boolean;
  values: Float64Array;
  measured: Float64Array;
  nominal: Float64Array;
  trust: TrustState[];
  activeAlarms: RawAlarm[];
  recentAlarms: RawAlarm[];
  openIncidents: Incident[];
  recentClosed: Incident[];
  advisories: Advisory[];
  faults: ActiveFault[];
  rawTotal: number;
  rawActive: number;
  chattering: number;
  raw10: number;
  /** raw alarms in the last 60 s (shows the effect of a tuning change quickly) */
  raw1m: number;
  op10: number;
  opTotal: number;
  reduction: number;
  flood: boolean;
  criticalHidden: number;
  retainedPct: number;
  kpiRaw: KpiSet;
  kpiOp: KpiSet;
  cfg: Config;
  seed: number;
  version: number;
  rtuBeat: number;
  waves: WaveVis[];
}

export interface WaveVis {
  id: number;
  km: number;
  t0: number;
  type: EventType;
}

export interface ProcEvent {
  id: number;
  type: EventType;
  t0: number;
  tEnd: number;
  node: number;
  km: number;
  size: Size;
  channel: number;
}

export interface TruthLabel {
  kind: 'process' | 'sensor';
  type: FaultType;
  t0: number;
  tEnd: number;
  km: number | null;
  channels: number[];
  expected: IncidentClass[];
  node?: number;
}

export interface ScenarioStep {
  at: number;
  spec: FaultSpec;
}
export interface Scenario {
  id: string;
  name: string;
  description: string;
  duration: number;
  steps: ScenarioStep[];
  truth: TruthLabel[];
  defaultSeed: number;
  clockSkew?: number;
}

export interface RunResult {
  scenario: string;
  seed: number;
  duration: number;
  kpiRaw: KpiSet;
  kpiOp: KpiSet;
  rawTotal: number;
  opTotal: number;
  incidents: Incident[];
  advisoryCount: number;
  alarms: RawAlarm[];
  criticalHidden: number;
  falseIncidents: number;
  timeToFirstCorrect: number | null;
  classAccuracy: number | null;
  confusion: Record<string, Record<string, number>>;
  retainedPct: number;
  truth: TruthLabel[];
  /** mean |origin estimate − true origin| in km for matched process incidents */
  originErr: number | null;
}

export interface TunerCandidate {
  cls: TunerClassId;
  threshold: number; // magnitude
  deadband: number;
  onDelay: number;
  alarmsPer10: number;
  peak10: number;
  pctFlood: number;
  falseAlarms: number;
  meanDelay: number;
  missed: number;
  objective: number;
  feasible: boolean;
  pareto: boolean;
  isCurrent: boolean;
  isRecommended: boolean;
}

export interface ChangeRecord {
  id: number;
  t: number;
  wall: number;
  who: string;
  point: string;
  cls: TunerClassId;
  old: string;
  new: string;
  evidence: string;
  status: 'Approved' | 'Reverted';
  before: AlarmCfg;
  after: AlarmCfg;
}
