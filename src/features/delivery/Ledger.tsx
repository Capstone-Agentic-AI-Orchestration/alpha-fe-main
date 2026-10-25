import React from 'react';
import { ComplexityBand, RequirementDocStatus } from '@/shared/types';

const Dot: React.FC<{ color: string; pulse?: boolean }> = ({ color, pulse }) => (
  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
);

export const DocStatus: React.FC<{ status: RequirementDocStatus }> = ({ status }) => {
  const map: Record<RequirementDocStatus, { dot: string; text: string; label: string; pulse?: boolean }> = {
    draft: { dot: 'bg-gray-600', text: 'text-content-secondary', label: 'Draft' },
    in_review: { dot: 'bg-amber-400', text: 'text-status-warning', label: 'In review', pulse: true },
    awaiting_client: { dot: 'bg-cyan-400', text: 'text-status-info', label: 'Awaiting client', pulse: true },
    approved: { dot: 'bg-emerald-400', text: 'text-status-success', label: 'Approved' },
    superseded: { dot: 'bg-gray-700', text: 'text-content-muted', label: 'Superseded' }
  };
  const current = map[status];
  return <span className={`inline-flex items-center gap-2 text-xs ${current.text}`}><Dot color={current.dot} pulse={current.pulse} />{current.label}</span>;
};

/** Small delivery-sizing marker used to communicate sequencing complexity. */
export const Band: React.FC<{ band: ComplexityBand }> = ({ band }) => {
  const label: Record<ComplexityBand, string> = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra large' };
  return <span className="font-mono text-[11px] text-content-muted" title={`${label[band]} complexity band`}>{band}</span>;
};

export const ProgressRing: React.FC<{
  value: number;
  total: number;
  size?: number;
  tone?: 'brand' | 'emerald' | 'amber' | 'rose';
}> = ({ value, total, size = 26, tone = 'brand' }) => {
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const stroke = { brand: 'rgb(var(--ui-accent))', emerald: 'rgb(var(--ui-success))', amber: 'rgb(var(--ui-warning))', rose: 'rgb(var(--ui-danger))' }[tone];
  return (
    <svg width={size} height={size} className="-rotate-90 flex-shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--ui-divider))" strokeWidth="2" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)} />
    </svg>
  );
};

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`text-[11px] font-mono uppercase tracking-wider text-content-muted ${className}`}>{children}</div>
);
