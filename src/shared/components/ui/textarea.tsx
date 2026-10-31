import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={twMerge(
      'flex min-h-20 w-full resize-y rounded-md border border-control bg-well px-3 py-2.5 text-sm leading-6 text-content placeholder:text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));

Textarea.displayName = 'Textarea';
