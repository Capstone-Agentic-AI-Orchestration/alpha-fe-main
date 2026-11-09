import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant = 'default' | 'secondary' | 'outline';

const variants: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-brand-400/15 text-brand-200',
  secondary: 'border-transparent bg-surface-high text-content-secondary',
  outline: 'border-control bg-transparent text-content-secondary',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={twMerge(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-5',
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = 'Badge';
