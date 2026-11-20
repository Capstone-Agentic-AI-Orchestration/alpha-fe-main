import React from 'react';
import { ListChecks } from 'lucide-react';

import type { BoardRun } from '@/shared/types/boardRun';
import { runStatusLabel } from './boardRunPresentation';

/**
 * A board run seen from the board: where it stands and a way back to the chat it
 * lives in, where its builds and approvals are. Nothing is decided from here.
 */
export const BoardRunBanner: React.FC<{ run: BoardRun | null; onOpenChat: (threadId: string) => void }> = ({ run, onOpenChat }) => {
  if (!run) return null;
  const waiting = run.status === 'waiting_on_you' || run.status === 'paused';
  const done = run.tasks.filter(task => task.state === 'done').length;
  return <div role="status" className={'mt-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[11px] '
    + (waiting ? 'border-status-warning-border bg-status-warning-subtle text-status-warning' : 'border-divider bg-surface-raised text-content-secondary')}>
    <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span className="min-w-0 flex-1">Board run in chat · {runStatusLabel(run)} · {done} of {run.tasks.length} done{run.reason && waiting ? ` · ${run.reason}` : ''}</span>
    <button type="button" onClick={() => onOpenChat(run.threadId)} className="shrink-0 font-medium text-link hover:underline">Open chat</button>
  </div>;
};
