import { classify, CLASS_LABEL } from './classifier';
import { estimateOrigin } from './origin';
import type { Advisory, Config, Incident, IncidentClass, RawAlarm } from './types';
import { CHANNELS, NODE_KM, chTag, delay, hops, segmentOf } from './topology';
import type { TrustEngine } from './trust';

export const incLabel = (id: number) => `INC-${String(id).padStart(3, '0')}`;

export interface AggHooks {
  audit(actor: 'DeltaTrace' | 'Operator', action: string, reason: string, ref?: string): void;
  wb(tag: string, value: string | number, kind: 'incident' | 'quality'): void;
  event(kind: string, text: string, ref?: number): void;
}

const NON_ORIGIN: string[] = ['FLAT', 'COMM', 'DQ', 'FLOWDEV', 'FLOWLOW', 'FLOWHIGH'];
/** Diagnostic alarms carry no physical-deviation claim, so neighbours cannot corroborate them. */
const NON_PHYSICAL: string[] = ['FLAT', 'COMM', 'DQ'];

export class Aggregator {
  private pendingCls = new Map<number, { cls: IncidentClass; n: number }>();
  open: Incident[] = [];
  archive: Incident[] = [];
  advisories: Advisory[] = [];
  alarms = new Map<number, RawAlarm>();
  private nextId = 1;
  private nextAdv = 1;
  private dqByChannel = new Map<number, Incident>();
  /** counters for KPIs */
  openedTimes: number[] = [];
  advisoryTimes: number[] = [];
  passThroughTimes: number[] = [];

  constructor(private hooks: AggHooks) {}

  reset() {
    this.open = [];
    this.archive = [];
    this.pendingCls.clear();
    this.advisories = [];
    this.alarms.clear();
    this.nextId = 1;
    this.nextAdv = 1;
    this.dqByChannel.clear();
    this.openedTimes = [];
    this.advisoryTimes = [];
    this.passThroughTimes = [];
  }

  all(): Incident[] {
    return [...this.open, ...this.archive];
  }
  find(id: number): Incident | undefined {
    return this.open.find((i) => i.id === id) ?? this.archive.find((i) => i.id === id);
  }

  private newIncident(t: number, fixed?: IncidentClass): Incident {
    const inc: Incident = {
      id: this.nextId++,
      openedAt: t,
      lastAlarmAt: t,
      status: 'open',
      cls: fixed ?? 'needs-review',
      provisional: !fixed,
      classReasons: [],
      alarmIds: [],
      headlineIds: [],
      channels: [],
      advisoryChannels: [],
      corroboration: 0,
      meanTrust: 1,
      score: 0,
      rank: 0,
      critical: false,
      segment: [0, 0],
      summary: '',
      fixedClass: fixed,
      version: 0,
    };
    this.open.push(inc);
    this.openedTimes.push(t);
    return inc;
  }

  private linkTest(a: RawAlarm, m: RawAlarm, cfg: Config): boolean {
    if (cfg.groupingMode === 'fixed') return Math.abs(a.time - m.time) <= cfg.fixedWindow;
    // diagnostic alarms (comms, no-change) describe the instrument, not the process: they only group with their own kind
    if (NON_PHYSICAL.includes(a.type) || NON_PHYSICAL.includes(m.type)) {
      if (a.type !== m.type) return false;
      if (a.ch === m.ch) return Math.abs(a.time - m.time) <= cfg.incidentQuiet;
    }
    if (a.ch === m.ch) return Math.abs(a.time - m.time) <= cfg.incidentQuiet; // same-source continuation
    if (CHANNELS[a.ch].kind === 'FT' && CHANNELS[m.ch].kind === 'FT') return Math.abs(a.time - m.time) <= cfg.incidentQuiet;
    if (hops(a.node, m.node) > cfg.hopLimit) return false;
    const allowed = delay(a.node, m.node, cfg.waveSpeed) + cfg.clockTol + cfg.scanInterval;
    return Math.abs(a.time - m.time) <= allowed;
  }

  /** Does alarm `a` link to incident `inc` through the delay (or fixed-window) rule? */
  private linksTo(a: RawAlarm, inc: Incident, cfg: Config): boolean {
    if (inc.fixedClass) return false;
    for (let k = inc.alarmIds.length - 1; k >= 0; k--) {
      const m = this.alarms.get(inc.alarmIds[k]);
      if (m && this.linkTest(a, m, cfg)) return true;
    }
    return false;
  }
  /** Mass-balance alarms arrive after the flow lag: they may attach to ONE recent pressure incident (never merge several). */
  private flowCandidate(a: RawAlarm, cfg: Config): Incident | null {
    if (CHANNELS[a.ch].kind !== 'FT' || cfg.groupingMode !== 'delay') return null;
    const lagBound = 90 + (200 * 1000) / cfg.waveSpeed + cfg.clockTol + cfg.scanInterval + cfg.incidentQuiet;
    let best: Incident | null = null;
    for (const inc of this.open) {
      if (inc.fixedClass) continue;
      const hasPt = inc.alarmIds.some((id) => CHANNELS[this.alarms.get(id)!.ch].kind === 'PT');
      if (hasPt && a.trueTime - inc.openedAt <= lagBound && (!best || inc.score > best.score)) best = inc;
    }
    return best;
  }

  /** Ingest one raw alarm. Returns where it went. */
  ingest(a: RawAlarm, t: number, cfg: Config, trust: TrustEngine): 'incident' | 'advisory' {
    this.alarms.set(a.id, a);
    const T = trust.T[a.ch];
    const corr = NON_PHYSICAL.includes(a.type) ? 0 : trust.corroboration(a.ch, a.time, cfg);
    // protected rule: demote only if trust low AND uncorroborated AND not safety-critical
    if (T < cfg.demoteTrust && corr < cfg.demoteCorr && !a.safetyCritical) {
      const adv: Advisory = {
        id: this.nextAdv++,
        alarmId: a.id,
        tag: a.tag,
        ch: a.ch,
        type: a.type,
        time: a.time,
        trust: T,
        corroboration: corr,
        reason: `Trust ${T.toFixed(2)} < ${cfg.demoteTrust} and corroboration ${corr.toFixed(2)} < ${cfg.demoteCorr}; not safety-critical → Instrument Advisory (still retrievable)`,
        status: 'open',
        version: 0,
      };
      this.advisories.push(adv);
      if (this.advisories.length > 600) this.advisories.shift();
      a.role = 'advisory';
      a.advisoryId = adv.id;
      this.advisoryTimes.push(t);
      this.hooks.audit('DeltaTrace', 'demote-to-advisory', `${a.tag} ${a.type}: ${adv.reason}`, `ALM-${a.id}`);
      this.hooks.event('advisory', `${a.tag} alarm kept as Instrument Advisory`);
      return 'advisory';
    }
    let linked = this.open.filter((inc) => this.linksTo(a, inc, cfg));
    if (linked.length === 0) {
      const fc = this.flowCandidate(a, cfg);
      if (fc) linked = [fc];
    }
    if (linked.length === 0) {
      // recurrence of a recently closed incident from the same source → re-open it
      const prev = this.archive.find((c) => !c.fixedClass && t - (c.closedAt ?? 0) <= 600 && c.alarmIds.some((id) => this.alarms.get(id)?.ch === a.ch));
      if (prev) {
        this.archive = this.archive.filter((x) => x !== prev);
        prev.status = 'open';
        prev.closedAt = undefined;
        this.open.push(prev);
        linked = [prev];
        this.hooks.audit('DeltaTrace', 'incident-reopen', `${incLabel(prev.id)} re-opened: ${a.tag} ${a.type} recurred`, incLabel(prev.id));
      }
    }
    let inc: Incident;
    if (linked.length === 0) {
      inc = this.newIncident(t);
      this.hooks.audit('DeltaTrace', 'incident-open', `${incLabel(inc.id)} opened by ${a.tag} ${a.type}`, incLabel(inc.id));
      this.hooks.event('incident-open', `Incident ${incLabel(inc.id)} opened`, inc.id);
    } else {
      inc = linked[0];
      for (let i = 1; i < linked.length; i++) this.merge(inc, linked[i]);
      this.hooks.audit('DeltaTrace', 'group', `${a.tag} ${a.type} joined ${incLabel(inc.id)} (delay rule${cfg.groupingMode === 'fixed' ? ': fixed window' : ''})`, `ALM-${a.id}`);
    }
    inc.alarmIds.push(a.id);
    inc.lastAlarmAt = Math.max(inc.lastAlarmAt, a.trueTime);
    a.incidentId = inc.id;
    a.role = 'member';
    inc.version++;
    return 'incident';
  }

  /** Derived data-quality alarm (replay/spoof) → its own data-integrity incident. */
  ingestDq(a: RawAlarm, t: number, text: string) {
    this.alarms.set(a.id, a);
    const inc = this.newIncident(t, 'data-integrity');
    inc.alarmIds.push(a.id);
    inc.fault = text;
    a.incidentId = inc.id;
    a.role = 'headline';
    this.dqByChannel.set(a.ch, inc);
    this.hooks.audit('DeltaTrace', 'incident-open', `${incLabel(inc.id)} data-integrity: ${text}`, incLabel(inc.id));
    this.hooks.event('incident-open', `Incident ${incLabel(inc.id)} opened (data integrity)`, inc.id);
  }
  touchDq(ch: number, t: number) {
    const inc = this.dqByChannel.get(ch);
    if (inc && inc.status === 'open') inc.lastAlarmAt = t;
  }
  hasOpenDq(ch: number): boolean {
    const inc = this.dqByChannel.get(ch);
    return !!inc && inc.status === 'open';
  }

  private merge(into: Incident, other: Incident) {
    into.alarmIds.push(...other.alarmIds);
    for (const id of other.alarmIds) {
      const a = this.alarms.get(id);
      if (a) a.incidentId = into.id;
    }
    into.openedAt = Math.min(into.openedAt, other.openedAt);
    into.lastAlarmAt = Math.max(into.lastAlarmAt, other.lastAlarmAt);
    this.open = this.open.filter((x) => x !== other);
    this.pendingCls.delete(other.id);
    this.hooks.audit('DeltaTrace', 'merge', `${incLabel(other.id)} merged into ${incLabel(into.id)}`, incLabel(into.id));
  }

  restoreAdvisory(id: number) {
    const adv = this.advisories.find((x) => x.id === id);
    if (adv && adv.status === 'open') {
      adv.status = 'restored';
      adv.version++;
      this.hooks.audit('Operator', 'restore-advisory', `${adv.tag} advisory restored to alarm list`, `ALM-${adv.alarmId}`);
    }
  }

  closeAll(t: number, reason: string) {
    for (const inc of [...this.open]) this.close(inc, t, reason);
    this.dqByChannel.clear();
  }

  private close(inc: Incident, t: number, reason: string) {
    inc.status = 'closed';
    inc.closedAt = t;
    this.pendingCls.delete(inc.id);
    inc.version++;
    this.open = this.open.filter((x) => x !== inc);
    this.archive.unshift(inc);
    if (this.archive.length > 200) this.archive.pop();
    this.hooks.wb(`DeltaTrace.Incident.${String(inc.id).padStart(3, '0')}.Status`, 'closed', 'incident');
    this.hooks.audit('DeltaTrace', 'incident-close', `${incLabel(inc.id)} closed (${reason}); ${inc.alarmIds.length} alarms retained`, incLabel(inc.id));
    this.hooks.event('incident-close', `Incident ${incLabel(inc.id)} closed`, inc.id);
  }

  /** Per-scan maintenance: refresh evidence, classify, rank, close quiet incidents. */
  tick(t: number, cfg: Config, trust: TrustEngine) {
    for (const inc of [...this.open]) {
      this.refresh(inc, t, cfg, trust);
      if (t - inc.lastAlarmAt > cfg.incidentQuiet) this.close(inc, t, 'quiet time');
    }
    // rank: critical first, then score
    const sorted = [...this.open].sort((a, b) => Number(b.critical) - Number(a.critical) || b.score - a.score);
    sorted.forEach((inc, i) => {
      if (inc.rank !== i + 1) {
        inc.rank = i + 1;
        inc.version++;
      }
    });
    this.open.sort((a, b) => a.rank - b.rank);
  }

  refresh(inc: Incident, t: number, cfg: Config, trust: TrustEngine) {
    const members = inc.alarmIds.map((id) => this.alarms.get(id)!).filter(Boolean);
    const scadaMembers = members.filter((m) => m.source === 'scada');
    const firstByCh = new Map<number, RawAlarm>();
    const diagCh = new Set<number>();
    for (const m of scadaMembers) {
      if (NON_PHYSICAL.includes(m.type)) {
        diagCh.add(m.ch);
        continue;
      }
      const prev = firstByCh.get(m.ch);
      if (!prev || m.time < prev.time) firstByCh.set(m.ch, m);
    }
    for (const ch of diagCh) if (!firstByCh.has(ch)) firstByCh.set(ch, scadaMembers.find((m) => m.ch === ch)!);
    const channels = [...firstByCh.keys()].sort((a, b) => a - b);
    if (inc.fixedClass) {
      const ch = members[0]?.ch ?? 0;
      inc.channels = [ch];
      inc.meanTrust = trust.T[ch];
      inc.corroboration = 0;
      inc.score = members.reduce((s, m) => s + m.severity * Math.max(0.1, trust.T[m.ch]), 0) + 2;
      inc.headlineIds = [members[0]?.id].filter((x) => x !== undefined);
      inc.segment = [CHANNELS[ch].node, CHANNELS[ch].node];
      inc.critical = false;
      inc.classReasons = classify({ channelCount: 1, corroboration: 0, staleChannels: 0, replayChannels: 0, stuckChannels: 0, allChannelsBad: true, fixedClass: inc.fixedClass, age: t - inc.openedAt, alarmCount: members.length, meanTrust: inc.meanTrust, neighbourAgree: '' }, cfg).reasons;
      inc.summary = `Data-integrity anomaly · ${chTag(ch)} ${inc.fault ?? 'suspect data'} · trust ${trust.T[ch].toFixed(2)} · not a process event`;
      inc.version++;
      return;
    }
    // corroboration per channel (trust weighted)
    let sw = 0;
    let sc = 0;
    let mt = 0;
    const corrByCh = new Map<number, number>();
    for (const ch of channels) {
      const a = firstByCh.get(ch)!;
      const c = NON_PHYSICAL.includes(a.type) ? 0 : trust.corroboration(ch, a.time, cfg);
      corrByCh.set(ch, c);
      const w = Math.max(trust.T[ch], 0.05);
      sw += w;
      sc += w * c;
      mt += trust.T[ch];
    }
    const corr = sw > 0 ? sc / sw : 0;
    const meanTrust = channels.length ? mt / channels.length : 1;
    const staleChannels = channels.filter((ch) => trust.states[ch].likelyFault === 'stale' || scadaMembers.some((m) => m.ch === ch && m.type === 'COMM')).length;
    const replayChannels = channels.filter((ch) => trust.states[ch].likelyFault === 'replay').length;
    const stuckChannels = channels.filter((ch) => trust.states[ch].likelyFault === 'stuck' && trust.cls[ch] === 'BAD').length;
    const allBad = channels.length > 0 && channels.every((ch) => trust.cls[ch] === 'BAD');
    const ptChannels = channels.filter((c) => c < 12);
    const agreeCnt = ptChannels.filter((c) => (corrByCh.get(c) ?? 0) >= 0.5).length;
    const res = classify(
      {
        channelCount: channels.length,
        corroboration: corr,
        staleChannels,
        replayChannels,
        stuckChannels,
        allChannelsBad: allBad,
        age: t - inc.openedAt,
        alarmCount: members.length,
        meanTrust,
        neighbourAgree: `${agreeCnt} of ${Math.max(1, ptChannels.length)} alarmed sensors had neighbours agree within their delay window`,
      },
      cfg,
    );
    // A settled class changes only after the new class has held for 3 consecutive scans (no flapping)
    if (inc.cls !== res.cls && !res.provisional && !inc.provisional) {
      const pend = this.pendingCls.get(inc.id);
      const n = pend && pend.cls === res.cls ? pend.n + 1 : 1;
      if (n < 3) {
        this.pendingCls.set(inc.id, { cls: res.cls, n });
        res.cls = inc.cls;
      } else {
        this.pendingCls.delete(inc.id);
        inc.prevCls = inc.cls;
        inc.reclassifiedAt = t;
        this.hooks.audit('DeltaTrace', 'class-change', `${incLabel(inc.id)} reclassified ${CLASS_LABEL[inc.cls]} → ${CLASS_LABEL[res.cls]}`, incLabel(inc.id));
        this.hooks.event('reclassified', `${incLabel(inc.id)} reclassified: ${CLASS_LABEL[res.cls]}`, inc.id);
      }
    } else this.pendingCls.delete(inc.id);
    if (inc.cls !== res.cls || inc.provisional !== res.provisional) inc.version++;
    inc.cls = res.cls;
    inc.provisional = res.provisional;
    inc.classReasons = res.reasons;
    inc.channels = channels;
    inc.corroboration = corr;
    inc.meanTrust = meanTrust;
    // score
    let score = 0;
    for (const m of scadaMembers) score += m.severity * Math.max(trust.T[m.ch], 0.05) * (1 + 1.5 * (corrByCh.get(m.ch) ?? 0));
    inc.score = score;
    // headline: safety-critical first
    const ranked = [...scadaMembers].sort((a, b) => Number(b.safetyCritical) - Number(a.safetyCritical) || b.severity - a.severity || a.time - b.time);
    inc.headlineIds = ranked.slice(0, 3).map((m) => m.id);
    inc.critical = scadaMembers.some((m) => m.safetyCritical);
    for (const m of members) m.role = inc.headlineIds.includes(m.id) ? 'headline' : 'member';
    // segment
    const nodes = scadaMembers.map((m) => m.node);
    inc.segment = nodes.length ? [Math.min(...nodes), Math.max(...nodes)] : [0, 0];
    // origin estimate (grouping aid)
    if (inc.cls === 'process-event') {
      const pts = ptChannels
        .map((ch) => firstByCh.get(ch)!)
        .filter((a) => !NON_ORIGIN.includes(a.type) && trust.T[a.ch] >= 0.4)
        .map((a) => ({ km: NODE_KM[a.node], t: a.time, w: trust.T[a.ch] }));
      const o = estimateOrigin(pts, cfg.waveSpeed);
      if (o) inc.origin = o;
      if (o) inc.segment = segmentOf(o.km);
    } else inc.origin = undefined;
    // one-liner
    const advN = this.advisories.filter((x) => x.status === 'open' && t - x.time < 900).length;
    const segTxt = inc.segment[0] === inc.segment[1] ? `S${inc.segment[0]}` : `Segment S${inc.segment[0]}–S${inc.segment[1]}`;
    const parts: string[] = [];
    parts.push(inc.provisional ? 'Assessing' : inc.cls === 'process-event' ? 'Probable process event' : CLASS_LABEL[inc.cls]);
    parts.push(segTxt);
    if (inc.cls === 'process-event') {
      const nCorr = channels.filter((c) => (corrByCh.get(c) ?? 0) >= 0.5).length;
      parts.push(`${nCorr} sources corroborate`);
      if (inc.origin) parts.push(`likely origin near km ${Math.round(inc.origin.km)} (±${Math.max(1, Math.round((inc.origin.hi - inc.origin.lo) / 2))})`);
    } else if (channels.length) parts.push(channels.map(chTag).slice(0, 3).join(', '));
    if (advN) parts.push(`${advN} instrument ${advN === 1 ? 'advisory' : 'advisories'}`);
    parts.push(`${members.length} ${members.length === 1 ? 'alarm' : 'alarms'} grouped`);
    inc.summary = parts.join(' · ');
    inc.version++;
  }
}
