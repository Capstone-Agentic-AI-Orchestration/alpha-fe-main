import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={twMerge(
        'flex h-9 w-full rounded-md border border-control bg-surface-raised px-3 py-1 text-sm text-content shadow-sm transition-colors placeholder:text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
