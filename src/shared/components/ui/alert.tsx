import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export type AlertProps = React.HTMLAttributes<HTMLDivElement>;

/** shadcn/ui-style accessible alert primitive using Alpha's shared theme tokens. */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, role = 'alert', ...props }, ref) => (
    <div
      ref={ref}
      role={role}
      className={twMerge(
        'relative grid w-full grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-lg border border-divider bg-surface p-4 text-content shadow-2xl [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-content-secondary',
        className,
      )}
      {...props}
    />
  ),
);
Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={twMerge('col-start-2 text-sm font-medium leading-5 tracking-tight text-content', className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={twMerge('col-start-2 text-xs leading-relaxed text-content-secondary [&_p]:leading-relaxed', className)}
      {...props}
    />
  ),
);
AlertDescription.displayName = 'AlertDescription';
