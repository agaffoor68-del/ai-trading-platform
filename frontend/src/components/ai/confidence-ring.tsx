"use client";

/* Circular AI confidence meter (SVG ring + neon glow). */
export function ConfidenceRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#1F2937" strokeWidth="8" />
        <circle
          cx="42" cy="42" r={r} fill="none" stroke="#00E5FF" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          className="drop-shadow-[0_0_6px_rgba(0,229,255,0.7)]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-bold">
        {value.toFixed(0)}%
      </span>
    </div>
  );
}
