import type { Config } from './types';

export const DEFAULT_CONFIG: Config = {
  waveSpeed: 1000,
  clockTol: 5,
  scanInterval: 5,
  hopLimit: 3,
  incidentQuiet: 120,
  engineEnabled: true,
  groupingMode: 'delay',
  fixedWindow: 60,
  clockSkew: 0,
  lambdaR: 0.15,
  lambdaS: 1.0,
  lambdaC: 0.8,
  lambdaM: 0.5,
  goodThreshold: 0.7,
  badThreshold: 0.4,
  corrProcess: 0.6,
  corrFault: 0.2,
  demoteTrust: 0.4,
  demoteCorr: 0.2,
  advisoryRetention: 3600,
  trustGating: true,
  tMin: 0.6,
  alarms: {
    ptLow: { limit: 3.0, deadband: 0.3, onDelay: 0 },
    ptLowLow: { limit: 5.0, deadband: 0.3, onDelay: 0 },
    ptHigh: { limit: 3.0, deadband: 0.3, onDelay: 0 },
    ptHighHigh: { limit: 5.0, deadband: 0.3, onDelay: 0 },
    roc: { limit: 0.8, deadband: 0.3, onDelay: 0 },
    flowDev: { limit: 4, deadband: 1, onDelay: 20 },
  },
};

export function cloneConfig(c: Config): Config {
  return { ...c, alarms: Object.fromEntries(Object.entries(c.alarms).map(([k, v]) => [k, { ...v }])) as unknown as Config['alarms'] };
}
export function mergeConfig(base: Config, patch: Partial<Config>): Config {
  const out = cloneConfig(base);
  const { alarms, ...rest } = patch;
  Object.assign(out, rest);
  if (alarms) for (const k of Object.keys(alarms) as (keyof Config['alarms'])[]) out.alarms[k] = { ...out.alarms[k], ...alarms[k] };
  return out;
}
