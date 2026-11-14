/** DeltaTrace mark: trust ring, a delta whose corners are sensors, and one incident at the centre. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" width={size} height={size} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="60" cy="60" r="52" stroke="var(--border-strong)" strokeWidth="5" />
      <path d="M60 8 A52 52 0 1 1 15 86" stroke="var(--brand)" strokeWidth="6" />
      <path d="M60 34 L87 80 H33 Z" stroke="currentColor" strokeWidth="5" />
      <g fill="currentColor">
        <circle cx="60" cy="34" r="5.5" />
        <circle cx="87" cy="80" r="5.5" />
        <circle cx="33" cy="80" r="5.5" />
      </g>
      <circle cx="60" cy="63" r="8" fill="var(--brand)" />
    </svg>
  );
}
