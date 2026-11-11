import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, max = 100, className, ...props }, ref) => {
    const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(safeMax, value)) : 0;
    const percent = (safeValue / safeMax) * 100;
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        className={twMerge('relative h-2 w-full overflow-hidden rounded-full bg-surface-high', className)}
        {...props}
      >
        <div className="h-full bg-action transition-all" style={{ width: `${percent}%` }} />
      </div>
    );
  },
);

Progress.displayName = 'Progress';
