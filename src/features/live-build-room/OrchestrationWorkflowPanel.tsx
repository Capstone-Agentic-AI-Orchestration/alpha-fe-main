import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Code2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  ExternalLink,
  GitBranch,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Square,
  Workflow
} from 'lucide-react';
import { apiService } from '@/shared/services/apiService';
import type { LiveBuildRoomDiffPreview, LiveBuildRoomOrchestration, LiveBuildTaskStatus } from '@/shared/types';

interface OrchestrationWorkflowPanelProps {
  projectId: string;
  workflow: LiveBuildRoomOrchestration;
  canManage: boolean;
  canResume?: boolean;
  busyAction?: string | null;
  actionError?: string | null;
  onRetry: (taskId: string, expectedRevision: number) => void;
  onStartPlan: () => void;
  onResume: () => void;
  onCancel: () => void;
  onApprove: () => void;
  canApprove?: boolean;
  publicationSynced?: boolean;
}

const runStatusMeta: Record<LiveBuildRoomOrchestration['run']['status'], { label: string; tone: string; icon: React.ReactNode }> = {
  planning: { label: 'Preparing plan', tone: 'border-sky-300/20 bg-sky-300/[0.07] text-sky-100', icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> },
  awaiting_plan_approval: { label: 'Plan ready to review', tone: 'border-sky-300/20 bg-sky-300/[0.07] text-sky-100', icon: <ListChecks className="h-3.5 w-3.5" /> },
  executing: { label: 'In progress', tone: 'border-violet-300/25 bg-violet-300/[0.08] text-violet-100', icon: <CircleDot className="h-3.5 w-3.5" /> },
  cancelling: { label: 'Stopping build', tone: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100', icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> },
  validating: { label: 'Final checks', tone: 'border-sky-300/20 bg-sky-300/[0.07] text-sky-100', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  awaiting_approval: { label: 'Ready for review', tone: 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  publishing: { label: 'Opening pull requests', tone: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100', icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> },
  completed: { label: 'Published for review', tone: 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  blocked: { label: 'Action needed', tone: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  recovery_required: { label: 'Recovery needed', tone: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100', icon: <RotateCcw className="h-3.5 w-3.5" /> },
  failed: { label: 'Build stopped', tone: 'border-rose-300/25 bg-rose-300/[0.08] text-rose-100', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Stopped', tone: 'border-white/10 bg-white/[0.04] text-slate-300', icon: <Square className="h-3 w-3" /> }
};

const taskStatusMeta: Record<LiveBuildTaskStatus, { label: string; tone: string; icon: React.ReactNode }> = {
  pending: { label: 'Waiting', tone: 'border-white/10 bg-white/[0.03] text-slate-400', icon: <Clock3 className="h-3 w-3" /> },
  ready: { label: 'Ready next', tone: 'border-sky-300/20 bg-sky-300/[0.06] text-sky-100', icon: <ArrowDown className="h-3 w-3" /> },
  running: { label: 'Working now', tone: 'border-violet-300/25 bg-violet-300/[0.08] text-violet-100', icon: <LoaderCircle className="h-3 w-3 animate-spin" /> },
  submitted: { label: 'Checking result', tone: 'border-sky-300/20 bg-sky-300/[0.06] text-sky-100', icon: <ListChecks className="h-3 w-3" /> },
  accepted: { label: 'Completed', tone: 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100', icon: <Check className="h-3 w-3" /> },
  blocked: { label: 'Blocked', tone: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-100', icon: <AlertTriangle className="h-3 w-3" /> },
  failed: { label: 'Failed', tone: 'border-rose-300/20 bg-rose-300/[0.06] text-rose-100', icon: <AlertTriangle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', tone: 'border-white/10 bg-white/[0.03] text-slate-400', icon: <Square className="h-3 w-3" /> },
  superseded: { label: 'Replaced', tone: 'border-white/10 bg-white/[0.03] text-slate-500', icon: <RotateCcw className="h-3 w-3" /> }
};

function formatTime(value?: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{children}</div>;
}

function TaskEvidence({ workflow, taskId, taskById }: {
  workflow: LiveBuildRoomOrchestration;
  taskId: string;
  taskById: Map<string, LiveBuildRoomOrchestration['tasks'][number]>;
}) {
  const attempts = workflow.attempts.filter(attempt => attempt.taskId === taskId).slice().reverse();
  const findings = workflow.findings.filter(finding => finding.taskId === taskId);
  if (!attempts.length && !findings.length) return <p className="text-xs leading-5 text-slate-500">No attempts have been recorded yet.</p>;

  return <div className="space-y-3">
    {findings.map(finding => <div key={finding.id} className="rounded-lg border border-amber-300/15 bg-amber-300/[0.045] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-amber-100"><AlertTriangle className="h-3.5 w-3.5" />{finding.title || `${finding.severity} finding`}{finding.path && <code className="font-normal text-amber-100/60">{finding.path}</code>}<span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${finding.status === 'resolved' ? 'border-emerald-300/15 text-emerald-100/70' : 'border-amber-300/15 text-amber-100/75'}`}>{finding.status === 'resolved' ? 'Resolved' : finding.severity}</span></div>
      {finding.evidence && <p className="mt-1 text-[10px] leading-4 text-amber-100/60">Evidence: {finding.evidence}</p>}
      <p className="mt-1 text-xs leading-5 text-amber-100/75">{finding.instruction || 'This result needs a correction or review.'}</p>
      {finding.correctionTaskId && <p className="mt-1.5 text-[10px] text-slate-400">Correction assigned to <span className="font-medium text-slate-200">{taskById.get(finding.correctionTaskId)?.title || 'the task owner'}</span></p>}
    </div>)}
    {attempts.map(attempt => <div key={attempt.id} className="rounded-lg border border-white/[0.07] bg-black/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="text-[11px] font-medium text-slate-200">Attempt {attempt.attemptNumber} <span className="font-normal text-slate-500">· {attempt.agentName}</span></div>
        <span className="text-[10px] text-slate-500">{attempt.status.replace(/_/g, ' ')}</span>
      </div>
      {attempt.summary && <p className="mt-2 max-w-prose text-xs leading-5 text-slate-300">{attempt.summary}</p>}
      {attempt.failureReason && <p className="mt-2 text-xs leading-5 text-amber-100/80">{attempt.failureReason}</p>}
      {attempt.report && <div className="mt-3 space-y-2.5 border-t border-white/[0.05] pt-3">
        {!!attempt.report.requirementCoverage.length && <div><div className="text-[10px] font-medium text-slate-400">Requirement evidence</div><div className="mt-1.5 space-y-1.5">{attempt.report.requirementCoverage.map((item, index) => <div key={`${item.requirementId}-${index}`} className="text-[10px] leading-4 text-slate-500"><span className="font-mono text-violet-100/65">{item.requirementId || 'Requirement'}</span>{item.evidence && <span className="ml-2">{item.evidence}</span>}</div>)}</div></div>}
        {!!attempt.report.criteriaEvidence.length && <div><div className="text-[10px] font-medium text-slate-400">Acceptance evidence</div><div className="mt-1.5 space-y-1.5">{attempt.report.criteriaEvidence.map((item, index) => <div key={`${item.criterion}-${index}`} className="text-[10px] leading-4 text-slate-500"><span className="text-slate-300">{item.criterion || 'Criterion'}</span>{item.evidence && <span className="ml-2">{item.evidence}</span>}</div>)}</div></div>}
        {!!attempt.report.deliverables.length && <div><div className="text-[10px] font-medium text-slate-400">Reported deliverables</div><div className="mt-1.5 space-y-1.5">{attempt.report.deliverables.map((item, index) => <div key={`${item.summary}-${index}`} className="text-[10px] leading-4 text-slate-500">{item.summary}{item.paths.length > 0 && <span className="ml-2 font-mono text-slate-600">{item.paths.join(', ')}</span>}</div>)}</div></div>}
        {!!attempt.report.reviewFindings?.length && <div><div className="text-[10px] font-medium text-slate-400">Independent review findings</div><div className="mt-1.5 space-y-2">{attempt.report.reviewFindings.map((finding, index) => <div key={`${finding.targetTaskId}-${finding.title}-${index}`} className="rounded-md border border-amber-300/10 bg-amber-300/[0.025] px-2.5 py-2 text-[10px] leading-4"><div className="font-medium text-amber-100/85">{finding.title} <span className="font-normal text-amber-100/55">· {finding.severity}</span></div><div className="mt-0.5 text-slate-500">On {taskById.get(finding.targetTaskId)?.title || 'accepted code work'}{finding.path ? ` · ${finding.path}` : ''}</div><div className="mt-1 text-slate-400">{finding.evidence}</div><div className="mt-1 text-slate-500">Requested: {finding.instruction}</div></div>)}</div></div>}
      </div>}
      {!!attempt.changedPaths.length && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Observed changed files">
        {attempt.changedPaths.map(file => <code key={file} className="max-w-full truncate rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-1 text-[10px] text-slate-300">{file}</code>)}
      </div>}
      {attempt.report?.reportedChecks.length ? <div className="mt-3">
        <div className="text-[10px] font-medium text-slate-400">Checks reported by agent</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{attempt.report.reportedChecks.map((check, index) => <span key={`${check.script}-${index}`} className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[10px] text-slate-400">{check.script || 'Check'} · {check.result.replace(/_/g, ' ')}</span>)}</div>
      </div> : null}
      {attempt.verification && <div className="mt-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-400"><span>Checks observed by Alpha</span><span className={`rounded border px-1.5 py-0.5 ${attempt.verification.status === 'passed' ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100' : attempt.verification.status === 'failed' ? 'border-rose-300/20 bg-rose-300/[0.06] text-rose-100' : 'border-white/10 text-slate-400'}`}>{attempt.verification.status || 'not recorded'}</span></div>
        <div className="mt-1.5 space-y-1">{attempt.verification.commands.map((command, index) => <div key={`${command.script}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-slate-400"><span>{command.script || command.display || 'Command'}</span><span className={command.exitCode === 0 && command.signal === null ? 'text-emerald-200' : 'text-rose-200'}>{command.exitCode === 0 && command.signal === null ? 'passed' : command.signal ? `stopped · ${command.signal}` : command.exitCode === null ? 'unknown' : `exit ${command.exitCode}`}</span></div>)}</div>
        {attempt.verification.preparation && <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-slate-400"><span>Dependencies · {attempt.verification.preparation.display || 'install'}</span><span className={attempt.verification.preparation.exitCode === 0 && !attempt.verification.preparation.signal ? 'text-emerald-200' : 'text-rose-200'}>{attempt.verification.preparation.exitCode === 0 && !attempt.verification.preparation.signal ? 'ready' : attempt.verification.preparation.signal ? `stopped · ${attempt.verification.preparation.signal}` : `exit ${attempt.verification.preparation.exitCode ?? 'unknown'}`}</span></div>}
        {!!attempt.verification.missingScripts.length && <p className="mt-1.5 text-[10px] text-amber-200">Not set up in this codebase: {attempt.verification.missingScripts.join(', ')}</p>}
      </div>}
      {attempt.completedAt && <div className="mt-2 text-[10px] text-slate-600">Finished {formatTime(attempt.completedAt)}{attempt.resultCommit ? ` · ${attempt.resultCommit.slice(0, 7)}` : ''}</div>}
    </div>)}
  </div>;
}

const ReviewDiff: React.FC<{ projectId: string; runId: string; branchName?: string }> = ({ projectId, runId, branchName }) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<LiveBuildRoomDiffPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      setPreview(await apiService.getOrchestrationDiffPreview(projectId, runId));
    } catch (caught: any) {
      setError(caught?.message ?? 'The validated changes could not be loaded. Refresh the build and try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !preview) void loadPreview();
  };

  useEffect(() => {
    setPreview(null);
    setError(null);
    setOpen(false);
  }, [projectId, runId]);

  return <section className="overflow-hidden rounded-xl border border-violet-300/15 bg-violet-300/[0.025]">
    <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-200">
      <span className="flex min-w-0 items-center gap-2.5"><Code2 className="h-4 w-4 shrink-0 text-violet-200" /><span className="min-w-0"><span className="block text-xs font-semibold text-white">Review code changes</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-400">Inspect the exact commit that passed final validation before approving.</span></span></span>
      <span className="shrink-0 text-[10px] font-medium text-violet-100">{open ? 'Hide changes' : 'Open review'}</span>
    </button>
    {open && <div className="border-t border-white/[0.06] px-4 py-3">
      {loading && <div role="status" className="flex items-center gap-2 py-3 text-xs text-slate-400"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading the validated patch…</div>}
      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300/15 bg-rose-300/[0.04] p-3" role="alert"><p className="text-xs leading-5 text-rose-100/85">{error}</p><button type="button" onClick={() => void loadPreview()} disabled={loading} className="min-h-8 rounded-md border border-rose-200/20 px-2.5 text-[10px] font-semibold text-rose-100 hover:bg-rose-200/[0.07] disabled:opacity-50">Retry</button></div>}
      {preview?.repositories && preview.repositories.length > 1 ? preview.repositories.map(repository => <div key={repository.repository} className="border-t border-white/[0.06] py-4 first:border-0 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span className="font-semibold text-slate-200">{repository.repository}</span><span>Branch <code className="ml-1 text-slate-300">{repository.branchName}</code></span><span>Checked change <code className="ml-1 text-slate-300">{repository.resultCommit.slice(0, 7)}</code></span></div>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`Changed files in ${repository.repository}`}>
          {repository.changedPaths.map(file => <code key={file} className="max-w-full truncate rounded-md border border-white/[0.07] bg-black/[0.12] px-2 py-1 text-[10px] text-slate-300">{file}</code>)}
          {repository.pathsTruncated && <span className="text-[10px] text-slate-500">More changed files are omitted.</span>}
        </div>
        {repository.diff ? <div className="mt-3 max-h-[30rem] overflow-auto rounded-lg border border-white/[0.07] bg-[#0b0d14] p-3 font-mono text-[10px] leading-[1.65]" aria-label={`Validated code changes in ${repository.repository}`}>
          {repository.diff.split('\n').map((line, index) => <div key={index} className={`min-w-max whitespace-pre ${line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git') ? 'text-slate-400' : line.startsWith('+') ? 'bg-emerald-300/[0.055] text-emerald-200' : line.startsWith('-') ? 'bg-rose-300/[0.055] text-rose-200' : line.startsWith('@@') ? 'text-sky-200' : 'text-slate-300'}`}>{line || ' '}</div>)}
        </div> : <p className="mt-3 rounded-lg border border-white/[0.06] bg-black/[0.08] px-3 py-3 text-xs text-slate-400">No file changes in this codebase.</p>}
        {repository.truncated && <p role="status" className="mt-2 text-[10px] leading-4 text-amber-100/75">This preview was shortened. Inspect the full branch diff before approving.</p>}
      </div>) : preview && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>Branch <code className="ml-1 text-slate-300">{preview.branchName || branchName}</code></span><span>Checked change <code className="ml-1 text-slate-300">{preview.resultCommit.slice(0, 7)}</code></span></div>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Changed files in the validated commit">
          {preview.changedPaths.map(file => <code key={file} className="max-w-full truncate rounded-md border border-white/[0.07] bg-black/[0.12] px-2 py-1 text-[10px] text-slate-300">{file}</code>)}
          {preview.pathsTruncated && <span className="text-[10px] text-slate-500">More changed files are omitted.</span>}
        </div>
        {preview.diff ? <div className="mt-3 max-h-[30rem] overflow-auto rounded-lg border border-white/[0.07] bg-[#0b0d14] p-3 font-mono text-[10px] leading-[1.65]" aria-label="Validated code diff">
          {preview.diff.split('\n').map((line, index) => <div key={index} className={`min-w-max whitespace-pre ${line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git') ? 'text-slate-400' : line.startsWith('+') ? 'bg-emerald-300/[0.055] text-emerald-200' : line.startsWith('-') ? 'bg-rose-300/[0.055] text-rose-200' : line.startsWith('@@') ? 'text-sky-200' : 'text-slate-300'}`}>{line || ' '}</div>)}
        </div> : <p className="mt-3 rounded-lg border border-white/[0.06] bg-black/[0.08] px-3 py-3 text-xs text-slate-400">The validated commit contains no file changes.</p>}
        {preview.truncated && <p role="status" className="mt-2 text-[10px] leading-4 text-amber-100/75">The preview was shortened to keep this page responsive. Inspect the full branch diff in the local repository before approving.</p>}
      </>}
    </div>}
  </section>;
};

export const OrchestrationWorkflowPanel: React.FC<OrchestrationWorkflowPanelProps> = ({
  projectId, workflow, canManage, canResume = false, canApprove = false, publicationSynced = false, busyAction, actionError, onRetry, onStartPlan, onResume, onCancel, onApprove
}) => {
  const firstActionableTask = workflow.tasks.find(task => ['failed', 'blocked'].includes(task.status));
  const [expandedTaskId, setExpandedTaskId] = useState(workflow.run.currentTaskId ?? firstActionableTask?.id ?? workflow.tasks[0]?.id ?? '');
  const [confirmStop, setConfirmStop] = useState(false);
  const taskById = useMemo(() => new Map(workflow.tasks.map(task => [task.id, task])), [workflow.tasks]);
  const requiredTasks = workflow.tasks.filter(task => task.required);
  const completedRequired = requiredTasks.filter(task => task.status === 'accepted').length;
  const progress = requiredTasks.length ? Math.round(completedRequired / requiredTasks.length * 100) : 0;
  const status = workflow.run.status === 'completed' && !workflow.run.publication
    ? { ...runStatusMeta.completed, label: 'Completed · no pull request' }
    : runStatusMeta[workflow.run.status];
  const activeTask = workflow.tasks.find(task => task.id === workflow.run.currentTaskId);
  const liveTask = workflow.tasks.find(task => task.status === 'running' || task.status === 'submitted');
  const approvalActionAvailable = workflow.run.status === 'awaiting_approval' || workflow.run.status === 'publishing' ||
    (workflow.run.status === 'completed' && Boolean(workflow.run.publication) && !publicationSynced);
  const resumable = canManage && canResume && (
    workflow.run.status === 'recovery_required' ||
    (workflow.run.status === 'blocked' && /orchestrator is unavailable/i.test(workflow.run.stoppedReason || ''))
  );
  const cancellable = canManage && !['publishing', 'completed', 'failed', 'cancelled'].includes(workflow.run.status);
  const ownerCount = new Set(workflow.tasks.map(task => task.ownerName).filter(name => name !== 'Project specialist')).size;

  useEffect(() => {
    if (workflow.run.currentTaskId) setExpandedTaskId(workflow.run.currentTaskId);
  }, [workflow.run.currentTaskId]);

  return <section aria-labelledby="orchestration-title" className="overflow-hidden rounded-[1.35rem] border border-violet-300/[0.16] bg-[radial-gradient(ellipse_at_12%_0%,rgba(139,92,246,0.11),transparent_44%),linear-gradient(135deg,rgba(20,24,39,0.96),rgba(14,17,27,0.92))] shadow-[0_24px_70px_-45px_rgba(91,74,169,0.45)]">
    <div className="border-b border-white/[0.07] px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium tracking-wide text-violet-200/75">
            <Workflow className="h-3.5 w-3.5" /> Orchestrator build
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 id="orchestration-title" className="text-lg font-semibold tracking-[-0.025em] text-white sm:text-xl">Product build</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold ${status.tone}`}>{status.icon}{status.label}</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 [text-wrap:pretty]">{workflow.run.goal || (workflow.run.status === 'planning' ? 'The Orchestrator is preparing a plan before any specialist starts.' : 'The build goal is not available in this snapshot.')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] text-slate-500">
            {(workflow.run.repositories?.length ? workflow.run.repositories : [{ repository: workflow.run.repository, branchName: workflow.run.branchName ?? '' }]).map(repository => <span key={repository.repository} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1"><GitBranch className="h-3.5 w-3.5 text-violet-300" /><span>{repository.repository}</span><span className="text-slate-600">Branch</span><code className="text-slate-400">{repository.branchName}</code></span>)}
            <span>Updated {formatTime(workflow.run.updatedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {workflow.run.status === 'awaiting_plan_approval' && canManage && <button type="button" onClick={onStartPlan} disabled={Boolean(busyAction)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-400 px-3.5 text-xs font-semibold text-[#171224] transition duration-200 hover:bg-violet-300 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:cursor-wait disabled:opacity-55">
            {busyAction === 'start-plan' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Workflow className="h-3.5 w-3.5" />}{busyAction === 'start-plan' ? 'Starting…' : 'Start planned work'}
          </button>}
          {approvalActionAvailable && canApprove && <button type="button" onClick={onApprove} disabled={Boolean(busyAction)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-300 px-3.5 text-xs font-semibold text-[#10201b] transition duration-200 hover:bg-emerald-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-wait disabled:opacity-55">
            {busyAction === 'approve' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{busyAction === 'approve' ? workflow.run.status === 'publishing' ? 'Publishing…' : 'Preparing pull requests…' : workflow.run.status === 'completed' ? 'Retry issue sync' : workflow.run.status === 'publishing' ? 'Retry opening pull requests' : `Approve & open ${workflow.run.repositories && workflow.run.repositories.length > 1 ? 'pull requests' : 'pull request'}`}
          </button>}
          {resumable && <button type="button" onClick={onResume} disabled={Boolean(busyAction)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-400 px-3.5 text-xs font-semibold text-[#171224] transition duration-200 hover:bg-violet-300 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:cursor-wait disabled:opacity-55">
            {busyAction === 'resume' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}{workflow.run.status === 'recovery_required' ? 'Resume after review' : 'Resume build'}
          </button>}
          {cancellable && <div className="flex items-center gap-1.5">
            {workflow.run.status === 'cancelling' ? <button type="button" onClick={onCancel} disabled={Boolean(busyAction)} className="min-h-10 rounded-lg border border-amber-300/25 bg-amber-300/[0.08] px-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/[0.14] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-50">{busyAction === 'cancel' ? 'Stopping…' : 'Retry stop'}</button>
              : confirmStop ? <><span className="hidden text-[10px] text-amber-100 sm:inline">Keep partial work for recovery?</span><button type="button" onClick={() => { setConfirmStop(false); onCancel(); }} disabled={Boolean(busyAction)} className="min-h-10 rounded-lg border border-rose-300/30 bg-rose-300/[0.1] px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/[0.16] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:opacity-50">{busyAction === 'cancel' ? 'Stopping…' : 'Stop build'}</button><button type="button" onClick={() => setConfirmStop(false)} disabled={Boolean(busyAction)} className="min-h-10 rounded-lg px-2.5 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-50">Keep running</button></>
              : <button type="button" onClick={() => setConfirmStop(true)} disabled={Boolean(busyAction)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-xs font-medium text-slate-300 transition duration-200 hover:border-rose-300/25 hover:bg-rose-300/[0.06] hover:text-rose-100 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-50"><Square className="h-3 w-3" />Stop</button>}
          </div>}
        </div>
      </div>
      {workflow.run.stoppedReason && <div role="status" className={`mt-4 rounded-lg border px-3.5 py-3 text-xs leading-5 ${workflow.run.status === 'recovery_required' || workflow.run.status === 'blocked' || workflow.run.status === 'failed' ? 'border-amber-300/15 bg-amber-300/[0.04] text-amber-100/85' : 'border-white/[0.07] bg-white/[0.025] text-slate-400'}`}>
        <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{workflow.run.stoppedReason}</span></div>
      </div>}
      {workflow.run.status === 'awaiting_plan_approval' && <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-sky-300/15 bg-sky-300/[0.04] px-3.5 py-3 text-xs leading-5 text-sky-100/85"><ListChecks className="mt-0.5 h-4 w-4 shrink-0" /><div><span className="font-semibold text-sky-100">Review the plan before work begins.</span> Check each task, its specialist, and why that person was chosen. No specialist has started changing code.</div></div>}
      {workflow.run.status === 'cancelling' && <div role="status" className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3.5 py-3 text-xs leading-5 text-amber-100/80">Alpha is waiting for the specialist process to exit. The repository stays reserved, and this build will not dispatch more work while it stops.</div>}
      {actionError && <div role="alert" className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-3.5 py-2.5 text-xs text-rose-100">{actionError}</div>}
      {workflow.run.status === 'awaiting_approval' && <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.045] px-3.5 py-3 text-xs leading-5 text-emerald-100/85"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><div><span className="font-semibold text-emerald-100">Ready for your final review.</span> The Orchestrator completed its checks; a person still decides whether this work is approved.</div></div>}
      {workflow.run.status === 'awaiting_approval' && <div className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.035] px-3.5 py-3 text-xs leading-5 text-amber-100/80">Approving sends each checked branch to GitHub and opens {workflow.run.repositories && workflow.run.repositories.length > 1 ? 'a pull request in each selected codebase' : 'a pull request'} for review. It does not merge or deploy the change.</div>}
      {workflow.run.status === 'publishing' && <div role="status" className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.035] px-3.5 py-3 text-xs leading-5 text-amber-100/80">Your approval is recorded. Alpha is checking that each branch and pull request reached GitHub. Retry continues unfinished steps without opening duplicates.</div>}
      {['awaiting_approval', 'publishing', 'completed'].includes(workflow.run.status) && <div className="mt-4"><ReviewDiff projectId={projectId} runId={workflow.run.id} branchName={workflow.run.branchName} /></div>}
    </div>

    <div className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(270px,0.8fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><SectionLabel>{workflow.run.status === 'awaiting_plan_approval' ? 'Proposed plan' : 'Work plan'}</SectionLabel><p className="mt-1 text-xs text-slate-500">See what needs to happen, who the Orchestrator chose, and why. Each step waits for earlier work to finish.</p></div>
          <div className="text-right"><div className="font-mono text-sm tabular-nums text-white">{completedRequired}<span className="text-slate-500">/{requiredTasks.length}</span></div><div className="text-[10px] text-slate-500">work steps complete</div></div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label="Required task progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-300 transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        {workflow.tasks.length ? <div className="mt-4 space-y-2.5">
          {workflow.tasks.map((task, index) => {
            const meta = taskStatusMeta[task.status];
            const expanded = expandedTaskId === task.id;
            const taskAttempts = workflow.attempts.filter(attempt => attempt.taskId === task.id);
            const dependencies = task.dependsOn.map(id => taskById.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
            const unresolvedDependencies = dependencies.filter(dependency => dependency.status !== 'accepted');
            const taskFindings = workflow.findings.filter(finding => finding.taskId === task.id);
            const correctionParent = task.correctionOfTaskId ? taskById.get(task.correctionOfTaskId) : undefined;
            const correctionFindings = workflow.findings.filter(finding => finding.correctionTaskId === task.id);
            const taskRequirements = workflow.requirements.filter(requirement => task.requirementIds.includes(requirement.id));
            const retryable = canManage && ['executing', 'blocked'].includes(workflow.run.status) && ['failed', 'blocked'].includes(task.status) && task.attemptCount < 2;
            const taskBusy = busyAction === `retry:${task.id}`;
            return <article key={task.id} className={`relative overflow-hidden rounded-xl border transition-colors ${task.id === workflow.run.currentTaskId ? 'border-violet-300/25 bg-violet-300/[0.045]' : task.status === 'accepted' ? 'border-emerald-300/[0.11] bg-emerald-300/[0.018]' : 'border-white/[0.07] bg-black/[0.08]'}`}>
              {index < workflow.tasks.length - 1 && <span aria-hidden="true" className="absolute left-[19px] top-11 bottom-[-15px] w-px bg-white/[0.07]" />}
              <button type="button" aria-expanded={expanded} onClick={() => setExpandedTaskId(expanded ? '' : task.id)} className="relative flex w-full items-start gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-200 sm:gap-4 sm:p-4">
                <span className={`relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-semibold tabular-nums ${task.status === 'accepted' ? 'border-emerald-300/20 bg-[#12231f] text-emerald-100' : task.id === workflow.run.currentTaskId ? 'border-violet-300/25 bg-[#211a35] text-violet-100' : 'border-white/[0.08] bg-[#181b26] text-slate-400'}`}>{task.status === 'accepted' ? <Check className="h-3.5 w-3.5" /> : String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-white sm:text-[13px]">{task.title}</span><span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${meta.tone}`}>{meta.icon}{meta.label}</span>{!task.required && <span className="text-[9px] text-slate-600">Optional</span>}{correctionParent && <span className="rounded-md border border-amber-300/15 bg-amber-300/[0.04] px-1.5 py-0.5 text-[9px] text-amber-100/80">Follow-up to {correctionParent.title}</span>}{correctionFindings.length > 0 && <span className="rounded-md border border-amber-300/10 px-1.5 py-0.5 text-[9px] text-amber-100/65">{correctionFindings.length} review note{correctionFindings.length === 1 ? '' : 's'}</span>}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-500"><span>{task.ownerName}</span><span className="text-slate-700">·</span><span className="capitalize">{task.kind}</span><span className="text-slate-700">·</span><span>{task.repository}</span>{taskAttempts.length > 0 && <><span className="text-slate-700">·</span><span>{taskAttempts.length} attempt{taskAttempts.length === 1 ? '' : 's'}</span></>}</span>
                  {dependencies.length > 0 && <span className="mt-2 flex flex-wrap items-center gap-1.5">{dependencies.map(dependency => <span key={dependency.id} className={`rounded border px-1.5 py-0.5 text-[9px] ${dependency.status === 'accepted' ? 'border-emerald-300/10 text-emerald-100/70' : 'border-amber-300/15 text-amber-100/75'}`}>{dependency.status === 'accepted' ? 'After' : 'Waiting for'} {dependency.title}</span>)}</span>}
                  {unresolvedDependencies.length > 0 && <span className="mt-1.5 block text-[10px] text-amber-100/65">This task becomes eligible after its dependencies are accepted.</span>}
                </span>
                <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && <div className="border-t border-white/[0.06] px-3.5 pb-4 pt-3.5 sm:ml-[3.9rem] sm:px-4 sm:pt-3">
                <p className="max-w-3xl text-xs leading-5 text-slate-400">{task.description}</p>
                <div className="mt-3 rounded-lg border border-violet-300/10 bg-violet-300/[0.035] px-3 py-2.5"><SectionLabel>Why this specialist</SectionLabel><p className="mt-1 text-xs leading-5 text-slate-300">{task.assignmentReason}</p></div>
                <div className="mt-4"><SectionLabel>How we’ll know this is done</SectionLabel><ul className="mt-2 space-y-2">{task.acceptanceCriteria.map((criterion, criterionIndex) => <li key={`${criterion}-${criterionIndex}`} className="flex gap-2 text-xs leading-5 text-slate-300"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-violet-300/70" />{criterion}</li>)}</ul></div>
                {(taskRequirements.length > 0 || task.requiredChecks.length > 0 || task.scope.includePaths.length > 0) && <details className="group mt-4 rounded-lg border border-white/[0.06] bg-black/[0.08] px-3 py-2.5"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"><span>More build details</span><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary><div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">{taskRequirements.length > 0 && <div><SectionLabel>Project needs covered</SectionLabel><ul className="mt-2 space-y-1.5">{taskRequirements.map(requirement => <li key={requirement.id} className="text-[11px] leading-4 text-slate-400">{requirement.description}</li>)}</ul></div>}{task.requiredChecks.length > 0 && <div><SectionLabel>Checks after this work</SectionLabel><div className="mt-2 flex flex-wrap gap-1.5">{task.requiredChecks.map(check => <code key={check} className="rounded-md border border-white/[0.08] px-1.5 py-1 text-[9px] text-slate-400">{check}</code>)}</div></div>}{!!task.scope.includePaths.length && <div><SectionLabel>Files this specialist may change</SectionLabel><div className="mt-2 flex flex-wrap gap-1.5">{task.scope.includePaths.map(file => <code key={file} className="max-w-full truncate rounded-md bg-white/[0.035] px-1.5 py-1 text-[9px] text-slate-400">{file}</code>)}</div></div>}</div></details>}
                {(taskAttempts.length > 0 || taskFindings.length > 0) && <div className="mt-4 border-t border-white/[0.06] pt-3.5"><SectionLabel>Result and verification</SectionLabel><div className="mt-2.5"><TaskEvidence workflow={workflow} taskId={task.id} taskById={taskById} /></div></div>}
                {retryable && <button type="button" onClick={() => onRetry(task.id, task.revision)} disabled={Boolean(busyAction)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.045] px-3 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-300/[0.09] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-wait disabled:opacity-50">{taskBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}{taskBusy ? 'Preparing retry…' : task.attemptCount >= 1 ? 'Retry this task' : 'Try this task again'}</button>}
                {task.status === 'failed' && task.attemptCount >= 2 && <p className="mt-3 text-[10px] leading-4 text-amber-100/70">The retry limit was reached. This task needs a reviewed plan change or a human decision.</p>}
              </div>}
            </article>;
          })}
        </div> : <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-400">The validated task plan will appear here when planning finishes.</div>}
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-white/[0.07] bg-black/[0.1] p-4">
          <SectionLabel>Orchestrator</SectionLabel>
          <div className="mt-2 flex items-start gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-300/[0.06] text-violet-200"><Workflow className="h-4 w-4" /></div><div><div className="text-xs font-semibold text-slate-200">The Orchestrator guides the work</div><p className="mt-1 text-[11px] leading-5 text-slate-500">It sends one ready step at a time, checks the result, and then decides what can happen next.</p></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
            <div><div className="font-mono text-sm tabular-nums text-white">{workflow.tasks.length}</div><div className="text-[10px] text-slate-500">steps in the plan</div></div>
            <div><div className="font-mono text-sm tabular-nums text-white">{ownerCount}</div><div className="text-[10px] text-slate-500">assigned specialists</div></div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${liveTask ? 'border-violet-300/18 bg-violet-300/[0.035]' : workflow.run.status === 'awaiting_plan_approval' ? 'border-sky-300/15 bg-sky-300/[0.025]' : workflow.run.status === 'awaiting_approval' ? 'border-emerald-300/15 bg-emerald-300/[0.025]' : workflow.run.status === 'publishing' ? 'border-amber-300/15 bg-amber-300/[0.025]' : 'border-white/[0.07] bg-black/[0.1]'}`}>
          <SectionLabel>{liveTask ? 'Current task' : workflow.run.status === 'awaiting_plan_approval' ? 'Before work starts' : workflow.run.status === 'awaiting_approval' ? 'Next step' : workflow.run.status === 'publishing' ? 'Publication' : 'Build state'}</SectionLabel>
          {liveTask ? <><div className="mt-2 text-sm font-semibold text-white">{liveTask.title}</div><div className="mt-1 text-xs text-violet-100/75">Owned by {liveTask.ownerName}</div><div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />{liveTask.status === 'submitted' ? 'Alpha is checking the submitted result' : 'The specialist is working within its assigned scope'}</div></>
            : workflow.run.status === 'awaiting_plan_approval' ? <><div className="mt-2 text-sm font-semibold text-sky-100">Your review is next</div><p className="mt-1 text-xs leading-5 text-slate-400">Review the Orchestrator's choices. Choose Start planned work when the assignments and checks look right.</p></>
              : workflow.run.status === 'awaiting_approval' ? <><div className="mt-2 text-sm font-semibold text-emerald-100">Human review is next</div><p className="mt-1 text-xs leading-5 text-slate-400">All required tasks are accepted and final checks passed across every selected codebase. Review every code change before approving.</p></>
              : workflow.run.status === 'publishing' ? <><div className="mt-2 text-sm font-semibold text-amber-100">Opening your pull requests</div><p className="mt-1 text-xs leading-5 text-slate-400">Your approval is recorded. Alpha checks that each pull request is on GitHub. If work is interrupted, retry continues the unfinished steps without opening duplicates.</p></>
              : workflow.run.status === 'validating' ? <><div className="mt-2 text-sm font-semibold text-white">Final validation is running</div><p className="mt-1 text-xs leading-5 text-slate-400">Alpha is checking the accepted work together before asking for human review.</p></>
                : workflow.run.status === 'recovery_required' ? <><div className="mt-2 text-sm font-semibold text-amber-100">Review saved work before continuing</div><p className="mt-1 text-xs leading-5 text-slate-400">Alpha preserved the last checkpoint. Resume starts only after you choose to continue.</p></>
                  : <><div className="mt-2 text-sm font-semibold text-slate-200">No specialist is running</div><p className="mt-1 text-xs leading-5 text-slate-500">{workflow.run.status === 'planning' ? 'The Orchestrator is preparing the plan before anyone starts.' : 'The Orchestrator is waiting for a clear next action.'}</p></>}
        </div>

        <details className="group rounded-xl border border-white/[0.07] bg-black/[0.1] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"><span>Project requirements <span className="ml-1 font-normal text-slate-600">{workflow.requirements.length}</span></span><ChevronDown className="h-3.5 w-3.5 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-3 space-y-2.5 border-t border-white/[0.06] pt-3">{workflow.requirements.length ? workflow.requirements.map(requirement => <div key={requirement.id}><div className="font-mono text-[9px] text-violet-200/70">{requirement.id}</div><p className="mt-0.5 text-[11px] leading-4 text-slate-400">{requirement.description}</p></div>) : <p className="text-[11px] text-slate-500">Requirements are still being prepared.</p>}</div>
        </details>

        {workflow.run.exclusions.length > 0 && <details className="group rounded-xl border border-white/[0.07] bg-black/[0.1] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"><span>Out of scope <span className="ml-1 font-normal text-slate-600">{workflow.run.exclusions.length}</span></span><ChevronDown className="h-3.5 w-3.5 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <ul className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">{workflow.run.exclusions.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-[11px] leading-4 text-slate-400"><LockKeyhole className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />{item}</li>)}</ul>
        </details>}

        {workflow.run.status === 'completed' && workflow.run.publication && <div className="rounded-xl border border-emerald-300/12 bg-emerald-300/[0.025] px-4 py-3 text-[10px] leading-4 text-emerald-100/75"><div>Your approved changes are ready for review.</div><div className="mt-2 space-y-2">{(workflow.run.publications?.length ? workflow.run.publications : [{ ...workflow.run.publication, repository: workflow.run.publication.repository ?? workflow.run.repository }]).map(publication => <div key={publication.repository} className="rounded-lg border border-emerald-100/[0.08] bg-black/[0.08] px-3 py-2"><div className="font-semibold text-emerald-100">{publication.repository}</div><a href={publication.pullRequestUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 font-semibold text-emerald-100 underline decoration-emerald-100/30 underline-offset-2 hover:decoration-emerald-100">Open pull request <ExternalLink className="h-3 w-3" /></a><div className="mt-1 text-emerald-100/55">{publication.branchName} → {publication.baseBranch}</div></div>)}</div></div>}
        {workflow.run.status === 'completed' && workflow.run.publication && !publicationSynced && <div className="rounded-xl border border-amber-300/12 bg-amber-300/[0.025] px-4 py-3 text-[10px] leading-4 text-amber-100/75">The pull request is open; the linked issue still needs its review status synchronized. Retry the issue sync when ready.</div>}
        {workflow.run.status === 'completed' && !workflow.run.publication && <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-[10px] leading-4 text-slate-400">This earlier build has no pull request. Review its saved changes or start a new Orchestrator build to send the changes to GitHub for review.</div>}
        {workflow.run.status === 'recovery_required' && <div className="rounded-xl border border-amber-300/12 bg-amber-300/[0.025] px-4 py-3 text-[10px] leading-4 text-amber-100/65">A saved task may need a retry. Inspect its attempt evidence and changed files above before choosing Resume.</div>}
        {['recovery_required', 'blocked'].includes(workflow.run.status) && !canResume && /orchestrator is unavailable|restarted|recovery/i.test(workflow.run.stoppedReason || '') && <div className="rounded-xl border border-amber-300/12 bg-amber-300/[0.025] px-4 py-3 text-[10px] leading-4 text-amber-100/65"><div>The Orchestrator is unavailable in this desktop version. Update the app before continuing this build.</div></div>}
        {workflow.finalValidation && <div className="rounded-xl border border-white/[0.07] bg-black/[0.08] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><SectionLabel>Final checks</SectionLabel><span className={`rounded-md border px-1.5 py-0.5 text-[9px] ${workflow.finalValidation.status === 'passed' ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100' : 'border-amber-300/20 bg-amber-300/[0.06] text-amber-100'}`}>{workflow.finalValidation.status || 'not recorded'}</span></div>
          {workflow.finalValidation.repositories?.length ? <div className="mt-3 space-y-2.5">{workflow.finalValidation.repositories.map(repository => <div key={repository.repository} className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-200">{repository.repository}</span><span className={`text-[10px] ${repository.status === 'passed' ? 'text-emerald-200' : 'text-amber-200'}`}>{repository.status || 'not recorded'}</span></div>{repository.commands.length ? <div className="mt-2 space-y-1.5">{repository.commands.map((command, index) => <div key={`${command.script}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-slate-400"><span>{command.script || command.display || 'Check'}</span><span className={command.exitCode === 0 && command.signal === null ? 'text-emerald-200' : 'text-rose-200'}>{command.exitCode === 0 && command.signal === null ? 'passed' : command.signal ? `stopped · ${command.signal}` : command.exitCode === null ? 'unknown' : `exit ${command.exitCode}`}</span></div>)}</div> : <p className="mt-1.5 text-[10px] text-slate-500">No checks were recorded.</p>}{!!repository.missingScripts.length && <p className="mt-1.5 text-[10px] text-amber-200">Not set up in this codebase: {repository.missingScripts.join(', ')}</p>}{repository.resultCommit && <div className="mt-1.5 font-mono text-[9px] text-slate-600">Review reference {repository.resultCommit.slice(0, 7)}</div>}</div>)}</div> : <>{workflow.finalValidation.commands.length ? <div className="mt-2 space-y-1.5">{workflow.finalValidation.commands.map((command, index) => <div key={`${command.script}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-slate-400"><span>{command.script || command.display || 'Command'}</span><span className={command.exitCode === 0 && command.signal === null ? 'text-emerald-200' : 'text-rose-200'}>{command.exitCode === 0 && command.signal === null ? 'passed' : command.signal ? `stopped · ${command.signal}` : command.exitCode === null ? 'unknown' : `exit ${command.exitCode}`}</span></div>)}</div> : <p className="mt-2 text-[10px] leading-4 text-slate-500">No checks were recorded.</p>}{!!workflow.finalValidation.missingScripts.length && <p className="mt-2 text-[10px] text-amber-200">Not set up in this codebase: {workflow.finalValidation.missingScripts.join(', ')}</p>}{workflow.finalValidation.resultCommit && <div className="mt-2 font-mono text-[9px] text-slate-600">Review reference {workflow.finalValidation.resultCommit.slice(0, 7)}</div>}</>}
        </div>}
        {workflow.tasks.length > 0 && !activeTask && !liveTask && workflow.run.status === 'executing' && <p className="text-[10px] leading-4 text-slate-600">{workflow.run.stoppedReason || 'The Orchestrator is choosing the next ready task.'}</p>}
      </aside>
    </div>
  </section>;
};
