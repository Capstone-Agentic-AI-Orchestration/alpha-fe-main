import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant = 'default' | 'outline' | 'ghost';
export type ButtonSize = 'default' | 'sm' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-action text-on-action hover:bg-action-hover',
  outline: 'border border-control bg-surface-raised text-content-secondary hover:bg-surface-high hover:text-content',
  ghost: 'text-content-secondary hover:bg-surface-high hover:text-content',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-9 px-3.5',
  sm: 'h-8 px-2.5 text-xs',
  icon: 'h-9 w-9 px-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={twMerge(
      'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-shell disabled:pointer-events-none disabled:opacity-45',
      variantClasses[variant],
      sizeClasses[size],
      className,
    )}
    {...props}
  />
));

Button.displayName = 'Button';
