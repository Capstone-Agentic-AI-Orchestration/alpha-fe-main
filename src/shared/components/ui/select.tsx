import * as React from 'react';
import { twMerge } from 'tailwind-merge';

/** Native, accessible select with the local shadcn/ui field styles. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={twMerge(
        'flex h-9 w-full rounded-md border border-control bg-surface-raised px-3 py-1 text-sm text-content shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);

Select.displayName = 'Select';
