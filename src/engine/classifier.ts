import type { Config, IncidentClass } from './types';

export interface ClassifyInput {
  channelCount: number;
  corroboration: number;
  staleChannels: number;
  replayChannels: number;
  stuckChannels: number;
  allChannelsBad: boolean;
  fixedClass?: IncidentClass;
  age: number;
  alarmCount: number;
  meanTrust: number;
  neighbourAgree: string;
}

export interface Classification {
  cls: IncidentClass;
  provisional: boolean;
  reasons: string[];
}

export const CLASS_LABEL: Record<IncidentClass, string> = {
  'process-event': 'Process event',
  'instrument-fault': 'Instrument fault',
  'data-integrity': 'Data-integrity anomaly',
  'needs-review': 'Needs review',
};

/** First match wins: data-integrity → process event → instrument fault → needs review. */
export function classify(i: ClassifyInput, cfg: Config): Classification {
  const reasons: string[] = [];
  const corr = i.corroboration.toFixed(2);
  if (i.fixedClass) {
    return { cls: i.fixedClass, provisional: false, reasons: ['Replayed or spoofed data detected on this channel (derived data-quality alarm)', `Trust mean ${i.meanTrust.toFixed(2)}`] };
  }
  if (i.staleChannels >= 2) {
    reasons.push(`${i.staleChannels} channels stale/BAD with a communications cause`);
    reasons.push('Rule 1: coherent loss of data breaks the physical picture → data-integrity');
    return { cls: 'data-integrity', provisional: false, reasons };
  }
  if (i.replayChannels >= 1 || i.stuckChannels >= 2) {
    reasons.push('Flat-lined or replayed channels while neighbours / flow change');
    return { cls: 'data-integrity', provisional: false, reasons };
  }
  const young = i.age < 25 && i.alarmCount <= 2 && i.corroboration < cfg.corrProcess;
  if (young) return { cls: 'needs-review', provisional: true, reasons: ['Assessing: waiting for neighbouring sensors inside the delay window'] };
  if (i.corroboration >= cfg.corrProcess) {
    reasons.push(`Corroboration ${corr} ≥ ${cfg.corrProcess}`);
    reasons.push(`Mean trust ${i.meanTrust.toFixed(2)}`);
    reasons.push(i.neighbourAgree);
    return { cls: 'process-event', provisional: false, reasons };
  }
  if ((i.channelCount === 1 || i.allChannelsBad) && i.corroboration < cfg.corrFault) {
    reasons.push(`Confined to ${i.channelCount === 1 ? 'one channel' : 'low-trust channels'}`);
    reasons.push(`Corroboration ${corr} < ${cfg.corrFault}`);
    reasons.push(`Mean trust ${i.meanTrust.toFixed(2)}`);
    return { cls: 'instrument-fault', provisional: false, reasons };
  }
  reasons.push(`Corroboration ${corr} is between ${cfg.corrFault} and ${cfg.corrProcess}: not conclusive`);
  return { cls: 'needs-review', provisional: false, reasons };
}
