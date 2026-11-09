import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={twMerge('rounded-xl border border-divider bg-surface text-content', className)}
      {...props}
    />
  ),
);

Card.displayName = 'Card';
