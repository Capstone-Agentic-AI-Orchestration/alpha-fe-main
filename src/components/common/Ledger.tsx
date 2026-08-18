import React from 'react';
import { CostCadence, RequirementDocStatus, EstimateStatus, ComplexityBand } from '../../types';
import { formatMoney } from '../../lib/estimator';

/**
 * Shared primitives for the money and specification surfaces.
 *
 * The house rule these enforce: no client-facing figure appears without its
 * basis or its uncertainty beside it. Status is carried by a dot plus a word,
 * never by colour alone.
 */

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

export const Figure: React.FC<{
  amount: number;
  confidence?: number;
  cents?: boolean;
  className?: string;
}> = ({ amount, confidence, cents, className = '' }) => (
  <span className={`font-mono tabular-nums ${className}`}>
    {formatMoney(amount, { cents })}
    {confidence !== undefined && confidence > 0 && (
      <span className="text-gray-500 text-[0.85em] ml-1.5">±{Math.round(confidence * 100)}%</span>
    )}
  </span>
);

export const Range: React.FC<{ low: number; high: number }> = ({ low, high }) => (
  <span className="font-mono tabular-nums text-gray-500 text-xs">
    {formatMoney(low, { cents: false })}–{formatMoney(high, { cents: false })}
  </span>
);

export const Cadence: React.FC<{ cadence: CostCadence }> = ({ cadence }) => {
  const label =
    cadence === 'one_time' ? 'one-time' : cadence === 'monthly' ? 'per month' : 'per transaction';
  return <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{label}</span>;
};

/* ------------------------------------------------------------------ */
/* Status — dot plus word, per DESIGN.md                               */
/* ------------------------------------------------------------------ */

const Dot: React.FC<{ color: string; pulse?: boolean }> = ({ color, pulse }) => (
  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color} ${pulse ? 'animate-pulse' : ''}`} />
);

export const DocStatus: React.FC<{ status: RequirementDocStatus }> = ({ status }) => {
  const map: Record<RequirementDocStatus, { dot: string; text: string; label: string; pulse?: boolean }> = {
    draft: { dot: 'bg-gray-600', text: 'text-gray-400', label: 'Draft' },
    in_review: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'In review', pulse: true },
    awaiting_client: { dot: 'bg-cyan-400', text: 'text-cyan-300', label: 'Awaiting client', pulse: true },
    approved: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Approved' },
    superseded: { dot: 'bg-gray-700', text: 'text-gray-500', label: 'Superseded' }
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs ${s.text}`}>
      <Dot color={s.dot} pulse={s.pulse} />
      {s.label}
    </span>
  );
};

export const EstStatus: React.FC<{ status: EstimateStatus }> = ({ status }) => {
  const map: Record<EstimateStatus, { dot: string; text: string; label: string }> = {
    draft: { dot: 'bg-gray-600', text: 'text-gray-400', label: 'Draft' },
    awaiting_client: { dot: 'bg-cyan-400', text: 'text-cyan-300', label: 'Awaiting approval' },
    approved: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Approved' },
    rejected: { dot: 'bg-rose-400', text: 'text-rose-300', label: 'Changes requested' },
    superseded: { dot: 'bg-gray-700', text: 'text-gray-500', label: 'Superseded' }
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs ${s.text}`}>
      <Dot color={s.dot} />
      {s.label}
    </span>
  );
};

export const Band: React.FC<{ band: ComplexityBand }> = ({ band }) => {
  const label: Record<ComplexityBand, string> = {
    S: 'Small',
    M: 'Medium',
    L: 'Large',
    XL: 'Extra large'
  };
  return (
    <span className="font-mono text-[11px] text-gray-500" title={`${label[band]} complexity band`}>
      {band}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Progress ring — per DESIGN.md 4.3, rings not bars                   */
/* ------------------------------------------------------------------ */

export const ProgressRing: React.FC<{
  value: number;
  total: number;
  size?: number;
  /** Overrides the colour when tracking budget rather than completion. */
  tone?: 'brand' | 'emerald' | 'amber' | 'rose';
}> = ({ value, total, size = 26, tone = 'brand' }) => {
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const stroke = {
    brand: '#6366f1',
    emerald: '#34d399',
    amber: '#f59e0b',
    rose: '#fb7185'
  }[tone];

  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
      />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Section heading                                                     */
/* ------------------------------------------------------------------ */

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <div className={`text-[11px] font-mono uppercase tracking-wider text-gray-500 ${className}`}>{children}</div>
);
