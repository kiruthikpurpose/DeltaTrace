/**
 * DeltaTrace mark: several alarm streams merge, pass a trust gauge, and end as one incident.
 * Geometry matches the launch animation's final state so the launch screen can dock into it.
 */
export function Logo({ size = 32, className, id }: { size?: number; className?: string; id?: string }) {
  return (
    <svg id={id} className={className} viewBox="100 300 830 440" width={(size * 830) / 440} height={size} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g stroke="var(--text)" strokeWidth="30">
        <path d="M126,332 C320,332 380,520 560,520 L690,520" />
        <path d="M126,520 C320,520 380,520 560,520 L690,520" />
        <path d="M126,708 C320,708 380,520 560,520 L690,520" />
      </g>
      <circle cx="650" cy="520" r="168" stroke="var(--text-muted)" strokeWidth="14" />
      <path d="M498.3 392.7 A198 198 0 1 1 651.4 718.0" stroke="var(--brand)" strokeWidth="26" />
      <path d="M530,520 H884" stroke="var(--text)" strokeWidth="30" />
      <circle cx="884" cy="520" r="34" fill="var(--brand)" stroke="none" />
    </svg>
  );
}
