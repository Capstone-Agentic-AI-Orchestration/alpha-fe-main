import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={twMerge('animate-pulse rounded-md bg-surface-high/70', className)} {...props} />;
}
