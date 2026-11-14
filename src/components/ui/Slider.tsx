import { useId } from 'react';

export function Slider({ label, value, min, max, step = 1, unit = '', onChange, format }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="slider-row">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <output htmlFor={id}>
          {format ? format(value) : value}
          {unit}
        </output>
      </div>
    </div>
  );
}
