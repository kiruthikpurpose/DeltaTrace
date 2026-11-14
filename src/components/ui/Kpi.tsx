import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Sparkline } from '../viz/Sparkline';
import { Ticker } from './Ticker';

interface Props {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  delta?: ReactNode;
  spark?: number[];
  sparkColor?: string;
  tone?: 'bad' | 'ok';
  className?: string;
}
export function Kpi({ label, value, decimals = 0, suffix, delta, spark, sparkColor, tone, className }: Props) {
  return (
    <div className={clsx('kpi', tone, className)}>
      <span className="label">{label}</span>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Ticker className="value" value={value} decimals={decimals} suffix={suffix} />
        {spark && spark.length > 1 && <Sparkline data={spark} color={sparkColor} width={90} height={30} label={`${label} trend`} />}
      </div>
      {delta && <span className="delta">{delta}</span>}
    </div>
  );
}
