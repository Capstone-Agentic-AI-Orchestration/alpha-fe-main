import React, { useState } from 'react';
import { ListChecks, Loader2, Pause, Play, Square } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import type { BoardRun } from '@/shared/types/boardRun';
import { runSpend, runStatusLabel, taskStateLabel } from './boardRunPresentation';

const TONE = {
  done: 'text-status-success',
  attention: 'text-status-warning',
  active: 'text-link',
  quiet: 'text-content-muted'
} as const;

/**
 * A board run in the conversation it was started from: who started it, the tasks in
 * order and where each stands, spend against its limits, and the controls. Each
 * task's own build appears below it as the usual Orchestrator update.
 */
export const BoardRunCard: React.FC<{
  run: BoardRun;
  onChange: (run: BoardRun) => void;
  /** Open a task's build review on the right. */
  onOpenBuild?: (orchestrationRunId: string) => void;
}> = ({ run, onChange, onOpenBuild }) => {
  const [busy, setBusy] = useState<'stop' | 'pause' | 'resume' | null>(null);
  const [error, setError] = useState('');
  const act = async (action: 'stop' | 'pause' | 'resume') => {
    setBusy(action);
    setError('');
    try { onChange(await apiService.boardRunAction(run.projectId, run.id, action)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The run could not be changed.'); }
    finally { setBusy(null); }
  };
  const live = ['running', 'waiting_on_you', 'paused'].includes(run.status);
  const control = 'inline-flex min-h-7 items-center gap-1 rounded-lg border border-divider px-2.5 text-[11px] font-medium text-content hover:bg-surface-high disabled:opacity-50';
  return <section aria-label="Board run" className="mt-2 rounded-xl border border-divider bg-surface-raised px-3.5 py-3 text-left">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-content"><ListChecks className="h-4 w-4 text-link" aria-hidden="true" />Board run · {runStatusLabel(run)}</div>
      {live && <div className="flex gap-1.5">
        {run.status === 'paused'
          ? <button type="button" onClick={() => void act('resume')} disabled={Boolean(busy)} className={control}>{busy === 'resume' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}Resume</button>
          : <button type="button" onClick={() => void act('pause')} disabled={Boolean(busy)} className={control}>{busy === 'pause' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}Pause</button>}
        <button type="button" onClick={() => void act('stop')} disabled={Boolean(busy)} className={control + ' text-status-danger'}>{busy === 'stop' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}Stop run</button>
      </div>}
    </div>
    <p className="mt-1 text-[11px] text-content-secondary">Started by {run.ownerId} · {run.tasks.length} {run.tasks.length === 1 ? 'task' : 'tasks'} · plans {run.preApprovePlans ? 'approved up front' : 'approved one by one'} · {runSpend(run)}</p>
    {run.reason && <p className={'mt-2 text-[11px] ' + (run.status === 'waiting_on_you' || run.status === 'paused' ? 'text-status-warning' : 'text-content-secondary')}>{run.reason}</p>}
    <ol className="mt-2.5 divide-y divide-divider overflow-hidden rounded-lg border border-divider">
      {run.tasks.map(task => {
        const state = taskStateLabel(task.state);
        return <li key={task.issueId} className={'flex items-center gap-2.5 px-3 py-2 text-[11px] ' + (task.state === 'waiting_on_you' ? 'bg-status-warning-subtle' : '')}>
          <span className="font-mono text-content-muted">{task.identifier}</span>
          <span className="min-w-0 flex-1 truncate text-content" title={task.reason ?? task.title}>{task.title}</span>
          <span className="shrink-0 text-[10px] capitalize text-content-muted">{task.priority}</span>
          <span className={'shrink-0 ' + TONE[state.tone]}>{state.label}</span>
          {task.orchestrationRunId && onOpenBuild && <button type="button" onClick={() => onOpenBuild(task.orchestrationRunId!)} className="shrink-0 text-link hover:underline">Review</button>}
        </li>;
      })}
    </ol>
    {run.usage.unmeasuredBuilds > 0 && <p className="mt-2 text-[10px] text-content-muted">{run.usage.unmeasuredBuilds} {run.usage.unmeasuredBuilds === 1 ? 'build has' : 'builds have'} no reported usage, so they are not counted against the limits.</p>}
    <p className="mt-2 text-[10px] text-content-muted">Every pull request waits for your approval. Agents never merge or mark a task done.</p>
    {error && <p role="alert" className="mt-2 text-[11px] text-status-danger">{error}</p>}
  </section>;
};
