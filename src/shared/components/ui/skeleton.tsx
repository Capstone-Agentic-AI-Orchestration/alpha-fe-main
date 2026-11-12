import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={twMerge('motion-safe:animate-pulse rounded-md bg-surface-high/70', className)} {...props} />;
}

const rowLayouts = {
  list: 'flex min-h-14 items-center gap-3 border-b border-divider',
  table: 'grid min-h-12 grid-cols-[2fr_1fr_1fr] items-center gap-4 border-b border-divider',
  detail: 'grid min-h-16 content-center gap-2',
  conversation: 'flex min-h-16 items-center gap-3',
  code: 'flex h-6 items-center gap-4 font-mono',
} as const;

export function LoadingRows({ label, rows = 3, layout = 'list', className }: {
  label: string;
  rows?: number;
  layout?: keyof typeof rowLayouts;
  className?: string;
}) {
  return <div className={className}>
    <span role="status" className="sr-only">{label}</span>
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={rowLayouts[layout]}>
          {(layout === 'list' || layout === 'conversation') && <Skeleton className="h-8 w-8 shrink-0" />}
          {layout === 'code' && <Skeleton className="h-2 w-4 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={index % 2 === 0 ? 'h-3 w-3/5' : 'h-3 w-2/5'} />
            {layout !== 'code' && <Skeleton className="h-2 w-1/3" />}
          </div>
          {layout === 'table' && <><Skeleton className="h-2.5 w-2/3" /><Skeleton className="h-2.5 w-1/2 justify-self-end" /></>}
        </div>
      ))}
    </div>
  </div>;
}

export function EntrySkeleton({ label }: { label: string }) {
  return <main className="grid min-h-dvh place-items-center bg-canvas p-6">
    <div role="status" className="flex flex-col items-center gap-5">
      <img src={`${import.meta.env.BASE_URL}alpha-loading.svg`} alt="" className="h-20 w-20 object-contain" />
      <span className="text-sm text-content-muted">{label}</span>
    </div>
  </main>;
}
