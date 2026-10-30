import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export function Message({ align = 'start', className, ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' }) {
  return <div data-message-align={align} className={twMerge('ui-message flex min-w-0 items-end gap-2', align === 'end' ? 'flex-row-reverse' : '', className)} {...props} />;
}

export function MessageGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('ui-message-group flex min-w-0 flex-col gap-2', className)} {...props} />;
}

export function MessageAvatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('ui-message-avatar shrink-0 self-end', className)} {...props} />;
}

export function MessageContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('ui-message-content min-w-0', className)} {...props} />;
}

export function MessageHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('ui-message-header flex min-w-0 items-baseline justify-between gap-3', className)} {...props} />;
}

export function MessageFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('ui-message-footer flex min-w-0 items-center gap-2', className)} {...props} />;
}

export const MessageScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={twMerge('ui-message-scroller min-h-0 overflow-y-auto', className)} {...props} />
));

MessageScroller.displayName = 'MessageScroller';
