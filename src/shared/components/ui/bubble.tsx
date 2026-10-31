import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export function Bubble({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('ui-bubble min-w-0', className)} {...props} />;
}

export function BubbleContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('ui-bubble-content whitespace-pre-wrap break-words', className)} {...props} />;
}
