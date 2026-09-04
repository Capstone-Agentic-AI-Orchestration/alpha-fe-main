import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Circle, ExternalLink, GitBranch, Loader2, RotateCcw, Square } from 'lucide-react';
import { describeRunUsage } from '@/shared/lib/runUsage';
import { useApp } from '@/app/AppContext';
import { runnerSocket } from '@/shared/services/runnerSocket';

interface AgentRunProgressProps {
  issueId: string;
}

const statusCopy = {
  running: 'Running',
  awaiting_approval: 'Awaiting review',
  validating: 'Validating in CI/CD',
  failed: 'Needs attention',
  changes_requested: 'Changes requested',
  cancelled: 'Cancelled',
  completed: 'Completed'
} as const;

export const AgentRunProgress: React.FC<AgentRunProgressProps> = ({ issueId }) => {
  const {
    prototypeRuns,
    cancelPrototypeRun,
    retryPrototypeRun,
    setActiveTab
  } = useApp();
  const [logsOpen, setLogsOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const run = useMemo(
    () => prototypeRuns.find(item => item.issueId === issueId),
    [prototypeRuns, issueId]
  );

  useEffect(() => {
    if (run?.id && run.status === 'running') {
      runnerSocket.subscribeToRunStream(run.id);
      return () => {
        runnerSocket.unsubscribeFromRunStream(run.id);
      };
    }
  }, [run?.id, run?.status]);

  // Null when the CLI reported no token figures, which is how the panel tells
  // an unmeasured run apart from a free one.
  const usageLine = run ? describeRunUsage(run) : null;

  if (!run) return null;

  const completedStages = run.stages.filter(stage => stage.status === 'success').length;
  const progress = run.status === 'completed' || run.status === 'awaiting_approval' || run.status === 'validating'
    ? 100
    : Math.round((completedStages / run.stages.length) * 100);
  const currentStage = run.stages[run.currentStageIndex];

  return (
    <section className="space-y-3 border-y border-white/[0.07] py-4" aria-label="Agent run progress">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-gray-500">Agent run</p>
          <div className="mt-1 flex items-center gap-2 text-xs font-medium text-gray-200">
            {run.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
            {run.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
            {run.status === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-rose-400" />}
            {['awaiting_approval', 'validating'].includes(run.status) && <Circle className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            <span>{statusCopy[run.status]}</span>
          </div>
        </div>
        <span className="text-xs tabular-nums text-gray-500">{progress}%</span>
      </div>

      <div className="h-0.5 overflow-hidden bg-white/[0.08]">
        <div className="h-full bg-brand-400 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <ol className="space-y-2.5">
        {run.stages.map(stage => (
          <li key={stage.id} className="flex items-start gap-2.5 text-[11px]">
            {stage.status === 'success' && <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />}
            {stage.status === 'running' && <Loader2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 animate-spin text-cyan-400" />}
            {stage.status === 'failed' && <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-400" />}
            {stage.status === 'cancelled' && <Square className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-500" />}
            {stage.status === 'pending' && <Circle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-700" />}
            <div className="min-w-0">
              <p className={stage.status === 'pending' ? 'text-gray-600' : 'text-gray-300'}>{stage.label}</p>
              {stage.status === 'running' && <p className="mt-0.5 leading-relaxed text-gray-500">{stage.description}</p>}
            </div>
          </li>
        ))}
      </ol>

      {/* PR and Branch Link */}
      {run.prUrl && (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D0E10] border border-white/5 text-[11px]">
          <div className="flex items-center gap-1.5 text-gray-400 font-mono">
            <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
            <span className="truncate">{run.branchName || 'feature-branch'}</span>
          </div>
          <a
            href={run.prUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-brand-400 hover:text-brand-300 font-medium"
          >
            <span>View PR</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {(currentStage?.logs.length || run.testSummary) && (
        <div>
          <button
            type="button"
            onClick={() => setLogsOpen(value => !value)}
            className="flex items-center gap-1 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-300"
            aria-expanded={logsOpen}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${logsOpen ? 'rotate-180' : ''}`} />
            Run details
          </button>
          {logsOpen && (
            <div className="mt-2 space-y-1 bg-[#0D0E10] p-3 font-mono text-[10px] leading-relaxed text-gray-500">
              {currentStage?.logs.map(log => <p key={log}>{log}</p>)}
              {run.testSummary && <p className="text-gray-300">{run.testSummary}</p>}
              {run.changedFiles ? <p>+{run.insertions || 0} / -{run.deletions || 0} across {run.changedFiles} files</p> : null}
              {/*
                * What the run cost, when the CLI said.
                *
                * Absent for a run whose CLI reported nothing — every run from
                * before token counts were stored. Showing "0 tokens" there
                * would claim it was free rather than unmeasured.
                */}
              {usageLine && <p className="text-gray-400">{usageLine}</p>}
            </div>
          )}
        </div>
      )}

      {run.status === 'running' && (
        confirmCancel ? (
          <div className="space-y-2 text-[11px] text-gray-400">
            <p>Cancel this run?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmCancel(false)} className="text-gray-400 hover:text-white">Keep running</button>
              <button type="button" onClick={() => cancelPrototypeRun(run.id)} className="text-rose-400 hover:text-rose-300">Cancel run</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="text-[11px] font-medium text-gray-500 transition-colors hover:text-rose-300"
          >
            Cancel run
          </button>
        )
      )}

      {['failed', 'changes_requested', 'cancelled'].includes(run.status) && (
        <button
          type="button"
          onClick={() => retryPrototypeRun(run.id)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-brand-300 transition-colors hover:text-brand-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry run
        </button>
      )}

      {run.status === 'awaiting_approval' && (
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className="text-[11px] font-medium text-brand-300 transition-colors hover:text-brand-200"
        >
          Review output in Inbox →
        </button>
      )}

      {['validating', 'completed'].includes(run.status) && (
        <button
          type="button"
          onClick={() => setActiveTab('deployments')}
          className="text-[11px] font-medium text-brand-300 transition-colors hover:text-brand-200"
        >
          Open CI/CD validation →
        </button>
      )}
    </section>
  );
};
