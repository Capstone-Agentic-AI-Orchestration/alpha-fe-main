import React from 'react';
import { ComplexityBand, RequirementDocStatus } from '@/shared/types';

const Dot: React.FC<{ color: string; pulse?: boolean }> = ({ color, pulse }) => (
  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
);

export const DocStatus: React.FC<{ status: RequirementDocStatus }> = ({ status }) => {
  const map: Record<RequirementDocStatus, { dot: string; text: string; label: string; pulse?: boolean }> = {
    draft: { dot: 'bg-gray-600', text: 'text-gray-400', label: 'Draft' },
    in_review: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'In review', pulse: true },
    awaiting_client: { dot: 'bg-cyan-400', text: 'text-cyan-300', label: 'Awaiting client', pulse: true },
    approved: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Approved' },
    superseded: { dot: 'bg-gray-700', text: 'text-gray-500', label: 'Superseded' }
  };
  const current = map[status];
  return <span className={`inline-flex items-center gap-2 text-xs ${current.text}`}><Dot color={current.dot} pulse={current.pulse} />{current.label}</span>;
};

/** Small delivery-sizing marker used to communicate sequencing complexity. */
export const Band: React.FC<{ band: ComplexityBand }> = ({ band }) => {
  const label: Record<ComplexityBand, string> = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra large' };
  return <span className="font-mono text-[11px] text-gray-500" title={`${label[band]} complexity band`}>{band}</span>;
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
  const stroke = { brand: '#8b5cf6', emerald: '#34d399', amber: '#f59e0b', rose: '#fb7185' }[tone];
  return (
    <svg width={size} height={size} className="-rotate-90 flex-shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)} />
    </svg>
  );
};

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`text-[11px] font-mono uppercase tracking-wider text-gray-500 ${className}`}>{children}</div>
);
