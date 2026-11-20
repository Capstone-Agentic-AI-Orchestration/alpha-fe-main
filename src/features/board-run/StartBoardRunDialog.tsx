import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Modal } from '@/shared/components/Modal';
import { apiService } from '@/shared/services/apiService';
import type { Issue } from '@/shared/types';
import type { BoardRun } from '@/shared/types/boardRun';
import { dependencyNote, runCandidates } from './boardRunPresentation';

export const BOARD_RUN_RULES = [
  'Tasks go one at a time, highest priority first, after the tasks they depend on.',
  'Every pull request waits for your Approve button. Agents never merge or mark a task done.',
  'A failed or blocked build, a changed task, or a reached limit pauses the run and tells you why.',
  'Stop the run at any time; a build already going stays for you to finish or stop.'
];

const MAX_TASKS = 20;

/** Start a board run from a project chat: which tasks, how far, and whether plans are approved up front. */
export const StartBoardRunDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  projectId: string;
  threadId: string;
  issues: Issue[];
  onStarted: (run: BoardRun) => void;
}> = ({ open, onClose, projectId, threadId, issues, onStarted }) => {
  const candidates = useMemo(() => runCandidates(issues, projectId), [issues, projectId]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.filter(item => item.preselected).map(item => item.issue.id)));
  const [maxTasks, setMaxTasks] = useState('5');
  const [maxTokens, setMaxTokens] = useState('2000000');
  const [maxCostUsd, setMaxCostUsd] = useState('10');
  const [preApprovePlans, setPreApprovePlans] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) => setSelected(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const limit = (value: string) => (value.trim() === '' ? null : Number(value));
  const taskCount = Number(maxTasks);
  const invalid = !selected.size || !Number.isInteger(taskCount) || taskCount < 1 || taskCount > MAX_TASKS
    || [limit(maxTokens), limit(maxCostUsd)].some(value => value !== null && (!Number.isFinite(value) || value <= 0));

  const start = async () => {
    if (invalid || busy) return;
    setBusy(true);
    setError('');
    try {
      const run = await apiService.startBoardRun(projectId, {
        threadId, issueIds: candidates.filter(item => selected.has(item.issue.id)).map(item => item.issue.id),
        maxTasks: taskCount, maxTokens: limit(maxTokens), maxCostUsd: limit(maxCostUsd), preApprovePlans
      });
      onStarted(run);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The run could not start.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-lg border border-control bg-surface-raised px-2.5 py-1.5 text-xs text-content';
  return <Modal isOpen={open} onClose={onClose} closeDisabled={busy} title="Start board run" maxWidth="max-w-xl"
    subtitle="Agents work through the tasks you choose, one after another, in this chat."
    footer={<div className="flex items-center justify-end gap-2">
      <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-divider px-3 py-1.5 text-xs text-content hover:bg-surface-high">Cancel</button>
      <button type="button" onClick={() => void start()} disabled={invalid || busy} className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 text-xs font-semibold text-on-action hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50">
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}{busy ? 'Starting…' : `Start run (${Math.min(selected.size, taskCount || 0)} tasks)`}
      </button>
    </div>}>
    <div className="space-y-4 text-xs">
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-[11px] font-semibold text-content">Tasks, highest priority first</legend>
        {candidates.length === 0 && <p className="text-content-muted">There are no open tasks to work on.</p>}
        <ul className="max-h-60 divide-y divide-divider overflow-y-auto rounded-lg border border-divider">
          {candidates.map(({ issue }) => {
            const after = dependencyNote(issue, issues);
            return <li key={issue.id}><label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-surface-high">
              <input type="checkbox" checked={selected.has(issue.id)} onChange={() => toggle(issue.id)} />
              <span className="font-mono text-[11px] text-content-muted">{issue.identifier}</span>
              <span className="min-w-0 flex-1 truncate text-content">{issue.title}</span>
              {after && <span className="shrink-0 text-[10px] text-content-muted">{after}</span>}
              <span className="shrink-0 text-[10px] capitalize text-content-secondary">{issue.priority}</span>
            </label></li>;
          })}
        </ul>
      </fieldset>
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1"><span className="block text-[11px] text-content-secondary">At most (tasks)</span>
          <input type="number" min={1} max={MAX_TASKS} value={maxTasks} onChange={event => setMaxTasks(event.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="block text-[11px] text-content-secondary">Token limit</span>
          <input type="number" min={1} value={maxTokens} onChange={event => setMaxTokens(event.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="block text-[11px] text-content-secondary">Cost limit (USD)</span>
          <input type="number" min={0.01} step={0.5} value={maxCostUsd} onChange={event => setMaxCostUsd(event.target.value)} className={field} /></label>
      </div>
      <p className="text-[10px] text-content-muted">Token and cost limits apply to what your agent providers report; builds without reported usage are shown on the run.</p>
      <label className="flex items-start gap-2.5 rounded-lg border border-divider px-3 py-2.5">
        <input type="checkbox" checked={preApprovePlans} onChange={event => setPreApprovePlans(event.target.checked)} className="mt-0.5" />
        <span><span className="block font-medium text-content">Approve the plans for these tasks now</span>
          <span className="block text-[11px] text-content-secondary">Agents start coding each task without waiting for you. You still approve every pull request.</span></span>
      </label>
      <ul className="list-disc space-y-1 pl-4 text-[11px] text-content-secondary">{BOARD_RUN_RULES.map(rule => <li key={rule}>{rule}</li>)}</ul>
      {error && <p role="alert" className="text-status-danger">{error}</p>}
    </div>
  </Modal>;
};
