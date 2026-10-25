import React, { useEffect, useMemo, useState } from 'react';
import { OrchestrationPlanPreview } from './OrchestrationPlanPreview';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
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
  Pause,
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
  onPause: () => void;
  onCancel: () => void;
  onApprove: () => void;
  onViewAgentActivity?: (taskId: string, prototypeRunId: string) => void;
  focusTaskId?: string | null;
  canApprove?: boolean;
  publicationSynced?: boolean;
}

const runStatusMeta: Record<LiveBuildRoomOrchestration['run']['status'], { label: string; tone: string; icon: React.ReactNode }> = {
  planning: { label: 'Preparing plan', tone: 'border-status-info-border bg-status-info-subtle text-status-info', icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> },
  awaiting_plan_approval: { label: 'Plan ready to review', tone: 'border-status-info-border bg-status-info-subtle text-status-info', icon: <ListChecks className="h-3.5 w-3.5" /> },
  executing: { label: 'In progress', tone: 'border-divider bg-selected text-selected-content', icon: <CircleDot className="h-3.5 w-3.5" /> },
  paused: { label: 'Paused', tone: 'border-status-warning-border bg-status-warning-subtle text-status-warning', icon: <Pause className="h-3.5 w-3.5" /> },
  cancelling: { label: 'Stopping build', tone: 'border-status-warning-border bg-status-warning-subtle text-status-warning', icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> },
  validating: { label: 'Final checks', tone: 'border-status-info-border bg-status-info-subtle text-status-info', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  awaiting_approval: { label: 'Ready for review', tone: 'border-status-success-border bg-diff-added text-diff-added-content', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  publishing: { label: 'Opening pull requests', tone: 'border-status-warning-border bg-status-warning-subtle text-status-warning', icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> },
  completed: { label: 'Published for review', tone: 'border-status-success-border bg-diff-added text-diff-added-content', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  blocked: { label: 'Action needed', tone: 'border-status-warning-border bg-status-warning-subtle text-status-warning', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  recovery_required: { label: 'Recovery needed', tone: 'border-status-warning-border bg-status-warning-subtle text-status-warning', icon: <RotateCcw className="h-3.5 w-3.5" /> },
  failed: { label: 'Build stopped', tone: 'border-status-danger-border bg-diff-removed text-diff-removed-content', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Stopped', tone: 'border-divider bg-surface-raised text-content-secondary', icon: <Square className="h-3 w-3" /> }
};

const taskStatusMeta: Record<LiveBuildTaskStatus, { label: string; tone: string; icon: React.ReactNode }> = {
  pending: { label: 'Waiting', tone: 'border-divider bg-surface-raised text-content-secondary', icon: <Clock3 className="h-3 w-3" /> },
  ready: { label: 'Ready next', tone: 'border-status-info-border bg-status-info-subtle text-status-info', icon: <ArrowDown className="h-3 w-3" /> },
  running: { label: 'Working now', tone: 'border-divider bg-selected text-selected-content', icon: <LoaderCircle className="h-3 w-3 animate-spin" /> },
  submitted: { label: 'Checking result', tone: 'border-status-info-border bg-status-info-subtle text-status-info', icon: <ListChecks className="h-3 w-3" /> },
  accepted: { label: 'Completed', tone: 'border-status-success-border bg-diff-added text-diff-added-content', icon: <Check className="h-3 w-3" /> },
  blocked: { label: 'Blocked', tone: 'border-status-warning-border bg-status-warning-subtle text-status-warning', icon: <AlertTriangle className="h-3 w-3" /> },
  failed: { label: 'Failed', tone: 'border-status-danger-border bg-diff-removed text-diff-removed-content', icon: <AlertTriangle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', tone: 'border-divider bg-surface-raised text-content-secondary', icon: <Square className="h-3 w-3" /> },
  superseded: { label: 'Replaced', tone: 'border-divider bg-surface-raised text-content-muted', icon: <RotateCcw className="h-3 w-3" /> }
};

function formatTime(value?: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-content-muted">{children}</div>;
}

function isRawReport(value?: string): boolean {
  if (!value) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    return Boolean(parsed && typeof parsed === 'object');
  } catch {
    return false;
  }
}

function ReportResponseDisclosure({ response, truncated }: { response?: string; truncated?: boolean }) {
  if (!response) return null;
  return <details className="mt-2 rounded-md border border-divider bg-well px-2.5 py-2">
    <summary className="cursor-pointer text-[10px] font-medium text-content-secondary">Show original report response</summary>
    <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-4 text-content-muted">{response}{truncated ? '\n[The saved response was cut off at Alpha’s safe display limit.]' : ''}</pre>
  </details>;
}

function ReportContractVersion({ attempt }: { attempt: LiveBuildRoomOrchestration['attempts'][number] }) {
  const expected = attempt.reportSchemaVersionExpected;
  const received = attempt.reportSchemaVersionReceived;
  if (expected === undefined || (!attempt.reportError && received === expected)) return null;
  const label = received === undefined
    ? `Report version missing · expected v${expected}`
    : received === expected
      ? `Report v${expected}`
      : `Expected v${expected} · received v${received}`;
  return <span className="ml-2 inline-flex rounded border border-status-info-border bg-status-info-subtle px-1.5 py-0.5 text-[9px] text-status-info" title={label}>{label}</span>;
}

function TaskEvidence({ workflow, taskId, taskById }: {
  workflow: LiveBuildRoomOrchestration;
  taskId: string;
  taskById: Map<string, LiveBuildRoomOrchestration['tasks'][number]>;
}) {
  const attempts = workflow.attempts.filter(attempt => attempt.taskId === taskId).slice().reverse();
  const findings = workflow.findings.filter(finding => finding.taskId === taskId);
  if (!attempts.length && !findings.length) return <p className="text-xs leading-5 text-content-muted">No attempts have been recorded yet.</p>;

  return <div className="space-y-3">
    {findings.map(finding => <div key={finding.id} className="rounded-lg border border-status-warning-border bg-status-warning-subtle px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-status-warning"><AlertTriangle className="h-3.5 w-3.5" />{finding.title || `${finding.severity} finding`}{['agent_report', 'report_identity', 'review_findings_missing', 'requirement_coverage', 'acceptance_criteria'].includes(finding.check ?? '') ? <span className="rounded border border-status-info-border px-1.5 py-0.5 text-[9px] font-medium text-status-info">Report format</span> : null}{finding.path && <code className="font-normal text-status-warning">{finding.path}</code>}<span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${finding.status === 'resolved' ? 'border-status-success-border text-status-success' : 'border-status-warning-border text-status-warning'}`}>{finding.status === 'resolved' ? 'Resolved' : finding.severity}</span></div>
      {finding.evidence && <p className="mt-1 text-[10px] leading-4 text-status-warning">Evidence: {finding.evidence}</p>}
      <p className="mt-1 text-xs leading-5 text-status-warning">{finding.instruction || 'This result needs a correction or review.'}</p>
      {finding.correctionTaskId && <p className="mt-1.5 text-[10px] text-content-secondary">{finding.check === 'agent_report' || finding.check === 'report_identity' || finding.check === 'review_findings_missing' ? 'Format correction returned to' : 'Correction assigned to'} <span className="font-medium text-content">{taskById.get(finding.correctionTaskId)?.ownerName || 'the same specialist'}</span></p>}
    </div>)}
    {attempts.map(attempt => <div key={attempt.id} className="rounded-lg border border-divider bg-well p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="text-[11px] font-medium text-content">Attempt {attempt.attemptNumber} <span className="font-normal text-content-muted">· {attempt.agentName}</span>{attempt.reportFormatRetry && <span className="ml-2 rounded border border-status-info-border px-1.5 py-0.5 text-[9px] text-status-info">Read-only report fix</span>}<ReportContractVersion attempt={attempt} /></div>
        <span className="text-[10px] text-content-muted">{attempt.status.replace(/_/g, ' ')}</span>
      </div>
      {attempt.summary && !isRawReport(attempt.summary) && <p className="mt-2 max-w-prose break-words text-xs leading-5 text-content-secondary">{attempt.summary}</p>}
      {attempt.summary && isRawReport(attempt.summary) && <details className="mt-2 rounded-md border border-divider bg-well px-2.5 py-2">
        <summary className="cursor-pointer text-[10px] font-medium text-content-secondary">Show original report response</summary>
        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-4 text-content-muted">{attempt.summary}</pre>
      </details>}
      {attempt.reportError && <div className="mt-2 rounded-md border border-status-info-border bg-status-info-subtle px-2.5 py-2 text-[10px] leading-4 text-status-info"><span className="font-semibold">Alpha’s report check:</span> <span className="break-words">{attempt.reportError}</span></div>}
      {attempt.failureReason && <div className="mt-2 rounded-md border border-status-warning-border bg-status-warning-subtle px-2.5 py-2 text-[10px] leading-4 text-status-warning"><span className="font-semibold">Why it stopped:</span> <span className="break-words">{attempt.failureReason}</span></div>}
      <ReportResponseDisclosure response={attempt.reportResponse} truncated={attempt.reportResponseTruncated} />
      {attempt.report && <div className="mt-3 space-y-2.5 border-t border-divider pt-3">
        {!!attempt.report.requirementCoverage.length && <div><div className="text-[10px] font-medium text-content-secondary">Requirement evidence</div><div className="mt-1.5 space-y-1.5">{attempt.report.requirementCoverage.map((item, index) => <div key={`${item.requirementId}-${index}`} className="text-[10px] leading-4 text-content-muted"><span className="font-mono text-link">{item.requirementId || 'Requirement'}</span>{item.evidence && <span className="ml-2">{item.evidence}</span>}</div>)}</div></div>}
        {!!attempt.report.criteriaEvidence.length && <div><div className="text-[10px] font-medium text-content-secondary">Acceptance evidence</div><div className="mt-1.5 space-y-1.5">{attempt.report.criteriaEvidence.map((item, index) => <div key={`${item.criterion}-${index}`} className="text-[10px] leading-4 text-content-muted"><span className="text-content-secondary">{item.criterion || 'Criterion'}</span>{item.evidence && <span className="ml-2">{item.evidence}</span>}</div>)}</div></div>}
        {!!attempt.report.deliverables.length && <div><div className="text-[10px] font-medium text-content-secondary">Reported deliverables</div><div className="mt-1.5 space-y-1.5">{attempt.report.deliverables.map((item, index) => <div key={`${item.summary}-${index}`} className="text-[10px] leading-4 text-content-muted">{item.summary}{item.paths.length > 0 && <span className="ml-2 font-mono text-content-muted">{item.paths.join(', ')}</span>}</div>)}</div></div>}
        {!!attempt.report.reviewFindings?.length && <div><div className="text-[10px] font-medium text-content-secondary">Independent review findings</div><div className="mt-1.5 space-y-2">{attempt.report.reviewFindings.map((finding, index) => <div key={`${finding.targetTaskId}-${finding.title}-${index}`} className="rounded-md border border-status-warning-border bg-status-warning-subtle px-2.5 py-2 text-[10px] leading-4"><div className="font-medium text-status-warning">{finding.title} <span className="font-normal text-status-warning">· {finding.severity}</span></div><div className="mt-0.5 text-content-muted">On {taskById.get(finding.targetTaskId)?.title || 'accepted code work'}{finding.path ? ` · ${finding.path}` : ''}</div><div className="mt-1 text-content-secondary">{finding.evidence}</div><div className="mt-1 text-content-muted">Requested: {finding.instruction}</div></div>)}</div></div>}
      </div>}
      {!!attempt.changedPaths.length && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Observed changed files">
        {attempt.changedPaths.map(file => <code key={file} className="max-w-full truncate rounded-md border border-divider bg-surface-raised px-1.5 py-1 text-[10px] text-content-secondary">{file}</code>)}
      </div>}
      {attempt.report?.reportedChecks.length ? <div className="mt-3">
        <div className="text-[10px] font-medium text-content-secondary">Checks reported by agent</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{attempt.report.reportedChecks.map((check, index) => <span key={`${check.script}-${index}`} className="rounded-md border border-divider bg-surface-raised px-2 py-1 text-[10px] text-content-secondary">{check.script || 'Check'} · {check.result.replace(/_/g, ' ')}</span>)}</div>
      </div> : null}
      {attempt.verification && <div className="mt-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-content-secondary"><span>Checks observed by Alpha</span><span className={`rounded border px-1.5 py-0.5 ${attempt.verification.status === 'passed' ? 'border-status-success-border bg-diff-added text-diff-added-content' : attempt.verification.status === 'failed' ? 'border-status-danger-border bg-diff-removed text-diff-removed-content' : 'border-divider text-content-secondary'}`}>{attempt.verification.status || 'not recorded'}</span></div>
        <div className="mt-1.5 space-y-1">{attempt.verification.commands.map((command, index) => <div key={`${command.script}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-content-secondary"><span>{command.script || command.display || 'Command'}</span><span className={command.exitCode === 0 && command.signal === null ? 'text-status-success' : 'text-status-danger'}>{command.exitCode === 0 && command.signal === null ? 'passed' : command.signal ? `stopped · ${command.signal}` : command.exitCode === null ? 'unknown' : `exit ${command.exitCode}`}</span></div>)}</div>
        {attempt.verification.preparation && <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-content-secondary"><span>Dependencies · {attempt.verification.preparation.display || 'install'}</span><span className={attempt.verification.preparation.exitCode === 0 && !attempt.verification.preparation.signal ? 'text-status-success' : 'text-status-danger'}>{attempt.verification.preparation.exitCode === 0 && !attempt.verification.preparation.signal ? 'ready' : attempt.verification.preparation.signal ? `stopped · ${attempt.verification.preparation.signal}` : `exit ${attempt.verification.preparation.exitCode ?? 'unknown'}`}</span></div>}
        {!!attempt.verification.missingScripts.length && <p className="mt-1.5 text-[10px] text-status-warning">Not set up in this codebase: {attempt.verification.missingScripts.join(', ')}</p>}
      </div>}
      {attempt.completedAt && <div className="mt-2 text-[10px] text-content-muted">Finished {formatTime(attempt.completedAt)}{attempt.resultCommit ? ` · ${attempt.resultCommit.slice(0, 7)}` : ''}</div>}
    </div>)}
  </div>;
}

const attemptStatusMeta: Record<LiveBuildRoomOrchestration['attempts'][number]['status'], { label: string; tone: string }> = {
  starting: { label: 'Sending assignment', tone: 'border-status-info-border bg-status-info-subtle text-status-info' },
  running: { label: 'Working', tone: 'border-divider bg-selected text-selected-content' },
  submitted: { label: 'Checking result', tone: 'border-status-info-border bg-status-info-subtle text-status-info' },
  accepted: { label: 'Accepted', tone: 'border-status-success-border bg-diff-added text-diff-added-content' },
  rejected: { label: 'Correction needed', tone: 'border-status-warning-border bg-status-warning-subtle text-status-warning' },
  failed: { label: 'Stopped', tone: 'border-status-danger-border bg-diff-removed text-diff-removed-content' },
  cancelled: { label: 'Cancelled', tone: 'border-divider bg-surface-raised text-content-secondary' },
  recovery_required: { label: 'Saved for review', tone: 'border-status-warning-border bg-status-warning-subtle text-status-warning' }
};

function HandoffTimeline({ workflow }: { workflow: LiveBuildRoomOrchestration }) {
  const taskById = new Map(workflow.tasks.map(task => [task.id, task]));
  const entries = workflow.attempts.map((attempt, index) => ({ attempt, index })).sort((left, right) => {
    const leftTime = Date.parse(left.attempt.startedAt ?? left.attempt.completedAt ?? '');
    const rightTime = Date.parse(right.attempt.startedAt ?? right.attempt.completedAt ?? '');
    return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime
      ? leftTime - rightTime
      : left.index - right.index;
  });

  return <section aria-label="Orchestrator handoff timeline" className="overflow-hidden rounded-xl border border-divider bg-well">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider px-4 py-3.5 sm:px-5">
      <div><div className="flex items-center gap-2 text-xs font-semibold text-content"><Workflow className="h-3.5 w-3.5 text-link" /> Handoff timeline</div><p className="mt-1 text-[11px] leading-4 text-content-muted">Follow each assignment from the Orchestrator to its specialist and see what happened next.</p></div>
      <span className="rounded-md border border-divider bg-surface-raised px-2 py-1 text-[10px] text-content-secondary">{entries.length ? `${entries.length} ${entries.length === 1 ? 'handoff' : 'handoffs'}` : workflow.tasks.length ? 'Planned route' : 'No handoffs yet'}</span>
    </div>
    {entries.length ? <ol className="max-h-[26rem] space-y-2 overflow-y-auto px-4 py-3.5 sm:px-5" aria-label="Recorded agent handoffs">
      {entries.map(({ attempt, index }, position) => {
        const task = taskById.get(attempt.taskId);
        const meta = attemptStatusMeta[attempt.status];
        const active = attempt.status === 'starting' || attempt.status === 'running' || attempt.status === 'submitted';
        const eventTime = attempt.completedAt ? `Finished ${formatTime(attempt.completedAt)}` : attempt.startedAt ? `Started ${formatTime(attempt.startedAt)}` : `Handoff ${position + 1}`;
        return <li key={attempt.id || `${attempt.taskId}-${attempt.attemptNumber}-${index}`} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
          <span className="relative flex justify-center" aria-hidden="true"><span className={`relative z-[1] mt-3 h-2.5 w-2.5 rounded-full border ${active ? 'animate-pulse border-divider bg-violet-300 shadow-[0_0_12px_rgb(var(--ui-link)/0.45)]' : attempt.status === 'accepted' ? 'border-status-success-border bg-emerald-300' : attempt.status === 'failed' || attempt.status === 'rejected' ? 'border-status-warning-border bg-amber-300' : 'border-divider bg-slate-600'}`} />{position < entries.length - 1 && <span className="absolute bottom-[-0.65rem] top-5 w-px bg-surface-raised" />}</span>
          <div className={`rounded-lg border px-3 py-2.5 ${active ? 'border-divider bg-selected' : 'border-divider bg-surface-raised'}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-content"><span className="text-link">Orchestrator</span><ArrowRight className="h-3 w-3 shrink-0 text-content-muted" /><span className="truncate">{attempt.agentName}</span></div>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${meta.tone}`}>{meta.label}</span>
            </div>
            <div className="mt-1 text-xs font-medium text-content">{task?.title || 'Assigned specialist task'}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-content-muted"><span>{task?.repository || workflow.run.repository}</span><span className="text-content-muted">·</span><span>{eventTime}</span>{attempt.attemptNumber > 1 && <><span className="text-content-muted">·</span><span>Attempt {attempt.attemptNumber}</span></>}</div>
            <ReportContractVersion attempt={attempt} />
            {task?.assignmentReason && <p className="mt-2 border-t border-divider pt-2 text-[10px] leading-4 text-content-secondary"><span className="font-medium text-link">Why assigned:</span> {task.assignmentReason}</p>}
            {attempt.reportFormatRetry && <div className="mt-2 inline-flex rounded border border-status-info-border bg-status-info-subtle px-2 py-1 text-[9px] text-status-info">Read-only report-format correction</div>}
            {attempt.summary && !isRawReport(attempt.summary) && <p className="mt-2 break-words text-[10px] leading-4 text-content-secondary">{attempt.summary}</p>}
            {attempt.summary && isRawReport(attempt.summary) && <details className="mt-2 rounded-md border border-divider bg-well px-2.5 py-2">
              <summary className="cursor-pointer text-[10px] font-medium text-content-secondary">Show original report response</summary>
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-4 text-content-muted">{attempt.summary}</pre>
            </details>}
            {attempt.reportError && <div className="mt-2 rounded-md border border-status-info-border bg-status-info-subtle px-2.5 py-2 text-[10px] leading-4 text-status-info"><span className="font-semibold">Alpha’s report check:</span> <span className="break-words">{attempt.reportError}</span></div>}
            {attempt.failureReason && <div className="mt-2 rounded-md border border-status-warning-border bg-status-warning-subtle px-2.5 py-2 text-[10px] leading-4 text-status-warning"><span className="font-semibold">Why it stopped:</span> <span className="break-words">{attempt.failureReason}</span></div>}
            <ReportResponseDisclosure response={attempt.reportResponse} truncated={attempt.reportResponseTruncated} />
          </div>
        </li>;
      })}
    </ol> : workflow.tasks.length ? <div className="px-4 py-3.5 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="text-[11px] font-medium text-content">Planned assignments</div><div className="text-[10px] text-content-muted">The first handoff appears when planned work starts.</div></div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Planned specialist assignments">
        {workflow.tasks.map((task, index) => {
          const meta = taskStatusMeta[task.status];
          return <li key={task.id} className={`min-w-0 rounded-lg border px-3 py-2.5 ${task.status === 'ready' || task.status === 'running' ? 'border-divider bg-selected' : 'border-divider bg-surface-raised'}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-mono text-content-muted">STEP {String(index + 1).padStart(2, '0')}</span><span className={`rounded border px-1.5 py-0.5 text-[9px] ${meta.tone}`}>{meta.label}</span></div>
            <div className="mt-1.5 truncate text-[11px] font-semibold text-content">{task.title}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-link"><Workflow className="h-3 w-3 shrink-0" /><span className="truncate">{task.ownerName}</span></div>
            <div className="mt-1 truncate text-[9px] text-content-muted">{task.repository}</div>
            <p className="mt-2 border-t border-divider pt-2 text-[10px] leading-4 text-content-muted">{task.assignmentReason}</p>
          </li>;
        })}
      </ol>
    </div> : <div className="px-4 py-4 sm:px-5">
      <div className="text-xs font-medium text-content">No specialist has started</div>
      <p className="mt-1 max-w-3xl text-[11px] leading-5 text-content-muted">{workflow.run.status === 'blocked' || workflow.run.status === 'failed' ? 'Planning stopped before the Orchestrator could hand work to an agent.' : 'Assignments will appear here when the Orchestrator finishes preparing the plan.'}</p>
    </div>}
  </section>;
}

export const ReviewDiff: React.FC<{ projectId: string; runId: string; branchName?: string; savedCheckpoint?: boolean; expanded?: boolean; onReady?: () => void }> = ({ projectId, runId, branchName, savedCheckpoint = false, expanded = false, onReady }) => {
  const [open, setOpen] = useState(expanded);
  const [preview, setPreview] = useState<LiveBuildRoomDiffPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      setPreview(await apiService.getOrchestrationDiffPreview(projectId, runId));
      onReady?.();
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
    setOpen(expanded);
    if (expanded) void loadPreview();
  }, [projectId, runId, expanded]);

  return <section className="overflow-hidden rounded-xl border border-divider bg-selected">
    <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
      <span className="flex min-w-0 items-center gap-2.5"><Code2 className="h-4 w-4 shrink-0 text-link" /><span className="min-w-0"><span className="block text-xs font-semibold text-content">{savedCheckpoint ? 'Review saved changes' : 'Review code changes'}</span><span className="mt-0.5 block text-[10px] leading-4 text-content-secondary">{savedCheckpoint ? 'Inspect the latest committed agent checkpoint and changed files while Alpha keeps the failure details in chat.' : 'Inspect the exact commit that passed final validation before approving.'}</span></span></span>
      <span className="shrink-0 text-[10px] font-medium text-link">{open ? 'Hide changes' : savedCheckpoint ? 'Review checkpoint' : 'Open review'}</span>
    </button>
    {open && <div className="border-t border-divider px-4 py-3">
      {loading && <div role="status" className="flex items-center gap-2 py-3 text-xs text-content-secondary"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading {savedCheckpoint ? 'the saved checkpoint' : 'the validated patch'}…</div>}
      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-danger-border bg-status-danger-subtle p-3" role="alert"><p className="text-xs leading-5 text-status-danger">{error}</p><button type="button" onClick={() => void loadPreview()} disabled={loading} className="min-h-8 rounded-md border border-status-danger-border px-2.5 text-[10px] font-semibold text-status-danger hover:bg-status-danger-subtle disabled:opacity-50">Retry</button></div>}
      {preview?.repositories && preview.repositories.length > 1 ? preview.repositories.map(repository => <div key={repository.repository} className="border-t border-divider py-4 first:border-0 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-content-muted"><span className="font-semibold text-content">{repository.repository}</span><span>Branch <code className="ml-1 text-content-secondary">{repository.branchName}</code></span><span>{repository.reviewType === 'saved_checkpoint' ? 'Saved checkpoint' : 'Checked change'} <code className="ml-1 text-content-secondary">{repository.resultCommit.slice(0, 7)}</code></span></div>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`${repository.reviewType === 'saved_checkpoint' ? 'Saved checkpoint files' : 'Changed files'} in ${repository.repository}`}>
          {repository.changedPaths.map(file => <code key={file} className="max-w-full truncate rounded-md border border-divider bg-well px-2 py-1 text-[10px] text-content-secondary">{file}</code>)}
          {repository.pathsTruncated && <span className="text-[10px] text-content-muted">More changed files are omitted.</span>}
        </div>
        {repository.diff ? <div className="mt-3 max-h-[30rem] overflow-auto rounded-lg border border-divider bg-code p-3 font-mono text-[10px] leading-[1.65]" aria-label={`${repository.reviewType === 'saved_checkpoint' ? 'Saved checkpoint' : 'Validated'} code changes in ${repository.repository}`}>
          {repository.diff.split('\n').map((line, index) => <div key={index} className={`min-w-max whitespace-pre ${line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git') ? 'text-content-secondary' : line.startsWith('+') ? 'bg-diff-added text-diff-added-content' : line.startsWith('-') ? 'bg-diff-removed text-diff-removed-content' : line.startsWith('@@') ? 'text-diff-hunk' : 'text-content-secondary'}`}>{line || ' '}</div>)}
        </div> : <p className="mt-3 rounded-lg border border-divider bg-well px-3 py-3 text-xs text-content-secondary">No file changes in this codebase.</p>}
        {repository.truncated && <p role="status" className="mt-2 text-[10px] leading-4 text-status-warning">This preview was shortened. Inspect the full branch diff before approving.</p>}
      </div>) : preview && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-content-muted"><span>Branch <code className="ml-1 text-content-secondary">{preview.branchName || branchName}</code></span><span>{preview.reviewType === 'saved_checkpoint' ? 'Saved checkpoint' : 'Checked change'} <code className="ml-1 text-content-secondary">{preview.resultCommit.slice(0, 7)}</code></span></div>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`Changed files in the ${preview.reviewType === 'saved_checkpoint' ? 'saved checkpoint' : 'validated commit'}`}>
          {preview.changedPaths.map(file => <code key={file} className="max-w-full truncate rounded-md border border-divider bg-well px-2 py-1 text-[10px] text-content-secondary">{file}</code>)}
          {preview.pathsTruncated && <span className="text-[10px] text-content-muted">More changed files are omitted.</span>}
        </div>
        {preview.diff ? <div className="mt-3 max-h-[30rem] overflow-auto rounded-lg border border-divider bg-code p-3 font-mono text-[10px] leading-[1.65]" aria-label={`${preview.reviewType === 'saved_checkpoint' ? 'Saved checkpoint' : 'Validated'} code diff`}>
          {preview.diff.split('\n').map((line, index) => <div key={index} className={`min-w-max whitespace-pre ${line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git') ? 'text-content-secondary' : line.startsWith('+') ? 'bg-diff-added text-diff-added-content' : line.startsWith('-') ? 'bg-diff-removed text-diff-removed-content' : line.startsWith('@@') ? 'text-diff-hunk' : 'text-content-secondary'}`}>{line || ' '}</div>)}
        </div> : <p className="mt-3 rounded-lg border border-divider bg-well px-3 py-3 text-xs text-content-secondary">The validated commit contains no file changes.</p>}
        {preview.truncated && <p role="status" className="mt-2 text-[10px] leading-4 text-status-warning">The preview was shortened to keep this page responsive. Inspect the full branch diff in the local repository before approving.</p>}
      </>}
    </div>}
  </section>;
};

export const OrchestrationWorkflowPanel: React.FC<OrchestrationWorkflowPanelProps> = ({
  projectId, workflow, canManage, canResume = false, canApprove = false, publicationSynced = false, busyAction, actionError, onRetry, onStartPlan, onResume, onPause, onCancel, onApprove, onViewAgentActivity, focusTaskId
}) => {
  const firstActionableTask = workflow.tasks.find(task => ['failed', 'blocked'].includes(task.status));
  const [expandedTaskId, setExpandedTaskId] = useState(workflow.run.currentTaskId ?? firstActionableTask?.id ?? workflow.tasks[0]?.id ?? '');
  const [confirmStop, setConfirmStop] = useState(false);
  const [documentVersion, setDocumentVersion] = useState(0);
  useEffect(() => {
    if (focusTaskId && workflow.tasks.some(task => task.id === focusTaskId)) setExpandedTaskId(focusTaskId);
  }, [focusTaskId, workflow.tasks]);
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
    workflow.run.status === 'paused' ||
    workflow.run.status === 'recovery_required' ||
    (workflow.run.status === 'blocked' && /orchestrator is unavailable|Milestone planning stopped before dispatch:|Plan document could not be saved before dispatch:/i.test(workflow.run.stoppedReason || ''))
  );
  const pausable = canManage && workflow.run.status === 'executing';
  const cancellable = canManage && !['publishing', 'completed', 'failed', 'cancelled'].includes(workflow.run.status);
  const ownerCount = new Set(workflow.tasks.map(task => task.ownerName).filter(name => name !== 'Project specialist')).size;

  useEffect(() => {
    if (workflow.run.currentTaskId) setExpandedTaskId(workflow.run.currentTaskId);
  }, [workflow.run.currentTaskId]);

  return <section aria-labelledby="orchestration-title" className="overflow-hidden rounded-[1.35rem] border border-divider bg-surface shadow-[0_24px_70px_-45px_rgb(var(--ui-accent)/0.45)]">
    <div className="p-4"><OrchestrationPlanPreview key={workflow.run.id} projectId={projectId} runId={workflow.run.id} planVersion={workflow.run.planVersion} autoShow={['awaiting_plan_approval', 'executing'].includes(workflow.run.status)} onReady={setDocumentVersion} />
      {!!workflow.milestones?.length && <ol aria-label="Milestone progress" className="mt-3 space-y-2 text-xs">{workflow.milestones.map((milestone, index) => <li key={milestone.id} className="flex justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2"><span className="text-content">{index + 1}. {milestone.title}</span><span className="text-link">{milestone.status === 'unplanned' ? 'Planned after prior work' : milestone.status === 'accepted' ? 'Accepted' : 'In progress'}</span></li>)}</ol>}
    </div>
    <div className="border-b border-divider px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium tracking-wide text-link">
            <Workflow className="h-3.5 w-3.5" /> Orchestrator build
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 id="orchestration-title" className="text-lg font-semibold tracking-[-0.025em] text-content sm:text-xl">Product build</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold ${status.tone}`}>{status.icon}{status.label}</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-content-secondary [text-wrap:pretty]">{workflow.run.goal || (workflow.run.status === 'planning' ? 'The Orchestrator is preparing a plan before any specialist starts.' : 'The build goal is not available in this snapshot.')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] text-content-muted">
            {(workflow.run.repositories?.length ? workflow.run.repositories : [{ repository: workflow.run.repository, branchName: workflow.run.branchName ?? '' }]).map(repository => <span key={repository.repository} className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-surface-raised px-2 py-1"><GitBranch className="h-3.5 w-3.5 text-link" /><span>{repository.repository}</span><span className="text-content-muted">Branch</span><code className="text-content-secondary">{repository.branchName}</code></span>)}
            <span>Updated {formatTime(workflow.run.updatedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {workflow.run.status === 'awaiting_plan_approval' && canManage && <button type="button" onClick={onStartPlan} disabled={Boolean(busyAction) || documentVersion !== workflow.run.planVersion} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-action px-3.5 text-xs font-semibold text-on-action transition duration-200 hover:bg-action-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-55">
            {busyAction === 'start-plan' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Workflow className="h-3.5 w-3.5" />}{busyAction === 'start-plan' ? 'Starting…' : 'Start planned work'}
          </button>}
          {approvalActionAvailable && canApprove && <button type="button" onClick={onApprove} disabled={Boolean(busyAction)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-status-success-subtle px-3.5 text-xs font-semibold text-status-success transition duration-200 hover:bg-status-success-subtle active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-55">
            {busyAction === 'approve' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{busyAction === 'approve' ? workflow.run.status === 'publishing' ? 'Publishing…' : 'Preparing pull requests…' : workflow.run.status === 'completed' ? 'Retry issue sync' : workflow.run.status === 'publishing' ? 'Retry opening pull requests' : `Approve & open ${workflow.run.repositories && workflow.run.repositories.length > 1 ? 'pull requests' : 'pull request'}`}
          </button>}
          {pausable && <button type="button" onClick={onPause} disabled={Boolean(busyAction) || Boolean(workflow.run.pauseRequestedAt)} title={workflow.run.currentTaskId ? 'The current specialist will finish this step before the build pauses.' : 'Pause the build before another step starts.'} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3.5 text-xs font-semibold text-status-warning transition hover:bg-status-warning-subtle active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-55">
            {busyAction === 'pause' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}{workflow.run.pauseRequestedAt ? 'Pausing after this step…' : busyAction === 'pause' ? 'Pausing…' : 'Pause'}
          </button>}
          {resumable && <button type="button" onClick={onResume} disabled={Boolean(busyAction)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-action px-3.5 text-xs font-semibold text-on-action transition duration-200 hover:bg-action-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-55">
            {busyAction === 'resume' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}{workflow.run.status === 'recovery_required' ? 'Resume after review' : 'Resume build'}
          </button>}
          {cancellable && <div className="flex items-center gap-1.5">
            {workflow.run.status === 'cancelling' ? <button type="button" onClick={onCancel} disabled={Boolean(busyAction)} className="min-h-10 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3 text-xs font-semibold text-status-warning transition hover:bg-status-warning-subtle active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">{busyAction === 'cancel' ? 'Stopping…' : 'Retry stop'}</button>
              : confirmStop ? <><span className="hidden text-[10px] text-status-warning sm:inline">Keep partial work for recovery?</span><button type="button" onClick={() => { setConfirmStop(false); onCancel(); }} disabled={Boolean(busyAction)} className="min-h-10 rounded-lg border border-status-danger-border bg-status-danger-subtle px-3 text-xs font-semibold text-status-danger transition hover:bg-status-danger-subtle active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">{busyAction === 'cancel' ? 'Stopping…' : 'Stop build'}</button><button type="button" onClick={() => setConfirmStop(false)} disabled={Boolean(busyAction)} className="min-h-10 rounded-lg px-2.5 text-xs text-content-secondary transition hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">Keep running</button></>
              : <button type="button" onClick={() => setConfirmStop(true)} disabled={Boolean(busyAction)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-divider px-3 text-xs font-medium text-content-secondary transition duration-200 hover:border-status-danger-border hover:bg-status-danger-subtle hover:text-status-danger active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"><Square className="h-3 w-3" />Stop</button>}
          </div>}
        </div>
      </div>
      {workflow.run.stoppedReason && <div role="status" className={`mt-4 rounded-lg border px-3.5 py-3 text-xs leading-5 ${workflow.run.status === 'recovery_required' || workflow.run.status === 'blocked' || workflow.run.status === 'failed' ? 'border-status-warning-border bg-status-warning-subtle text-status-warning' : 'border-divider bg-surface-raised text-content-secondary'}`}>
        <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{workflow.run.stoppedReason}</span></div>
      </div>}
      {workflow.run.status === 'awaiting_plan_approval' && <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-status-info-border bg-status-info-subtle px-3.5 py-3 text-xs leading-5 text-status-info"><ListChecks className="mt-0.5 h-4 w-4 shrink-0" /><div><span className="font-semibold text-status-info">Review the plan before work begins.</span> Check each task, its specialist, and why that person was chosen. No specialist has started changing code.</div></div>}
      {workflow.run.status === 'cancelling' && <div role="status" className="mt-3 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3.5 py-3 text-xs leading-5 text-status-warning">Alpha is waiting for the specialist process to exit. The repository stays reserved, and this build will not dispatch more work while it stops.</div>}
      {workflow.run.pauseRequestedAt && workflow.run.status === 'executing' && <div role="status" className="mt-3 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3.5 py-3 text-xs leading-5 text-status-warning">The current specialist is finishing its assigned step. Alpha will pause before handing work to the next specialist.</div>}
      {workflow.run.status === 'paused' && <div role="status" className="mt-3 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3.5 py-3 text-xs leading-5 text-status-warning">The build is paused. Its branch and saved work are preserved. Resume when you’re ready for the Orchestrator to continue.</div>}
      {actionError && <div role="alert" className="mt-3 rounded-lg border border-status-danger-border bg-status-danger-subtle px-3.5 py-2.5 text-xs text-status-danger">{actionError}</div>}
      {workflow.run.status === 'awaiting_approval' && <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-status-success-border bg-status-success-subtle px-3.5 py-3 text-xs leading-5 text-status-success"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><div><span className="font-semibold text-status-success">Ready for your final review.</span> The Orchestrator completed its checks; a person still decides whether this work is approved.</div></div>}
      {workflow.run.status === 'awaiting_approval' && <div className="mt-3 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3.5 py-3 text-xs leading-5 text-status-warning">Approving sends each checked branch to GitHub and opens {workflow.run.repositories && workflow.run.repositories.length > 1 ? 'a pull request in each selected codebase' : 'a pull request'} for review. It does not merge or deploy the change.</div>}
      {workflow.run.status === 'publishing' && <div role="status" className="mt-3 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3.5 py-3 text-xs leading-5 text-status-warning">Your approval is recorded. Alpha is checking that each branch and pull request reached GitHub. Retry continues unfinished steps without opening duplicates.</div>}
      {['awaiting_approval', 'publishing', 'completed', 'blocked', 'failed', 'recovery_required', 'paused', 'cancelled'].includes(workflow.run.status) && <div className="mt-4"><ReviewDiff projectId={projectId} runId={workflow.run.id} branchName={workflow.run.branchName} savedCheckpoint={!['awaiting_approval', 'publishing', 'completed'].includes(workflow.run.status)} /></div>}
    </div>

    <div className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(270px,0.8fr)]">
      <div className="xl:col-span-2"><HandoffTimeline workflow={workflow} /></div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><SectionLabel>{workflow.run.status === 'awaiting_plan_approval' ? 'Proposed plan' : 'Work plan'}</SectionLabel><p className="mt-1 text-xs text-content-muted">See what needs to happen, who the Orchestrator chose, and why. Each step waits for earlier work to finish.</p></div>
          <div className="text-right"><div className="font-mono text-sm tabular-nums text-content">{completedRequired}<span className="text-content-muted">/{requiredTasks.length}</span></div><div className="text-[10px] text-content-muted">{workflow.milestones?.length ? 'planned steps complete' : 'work steps complete'}</div></div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-label="Required task progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
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
            const executionAttemptCount = task.executionAttemptCount ?? task.attemptCount;
            const reportFormatRetryUsed = taskAttempts.some(attempt => attempt.reportFormatRetry);
            const latestExecution = [...taskAttempts].reverse().find(attempt => attempt.prototypeRunId);
            const retryable = canManage && task.retryAvailable === true;
            const taskBusy = busyAction === `retry:${task.id}`;
            return <article key={task.id} className={`relative overflow-hidden rounded-xl border transition-colors ${task.id === workflow.run.currentTaskId ? 'border-divider bg-selected' : task.status === 'accepted' ? 'border-status-success-border bg-status-success-subtle' : 'border-divider bg-well'}`}>
              {index < workflow.tasks.length - 1 && <span aria-hidden="true" className="absolute left-[19px] top-11 bottom-[-15px] w-px bg-surface-raised" />}
              <button type="button" aria-expanded={expanded} onClick={() => setExpandedTaskId(expanded ? '' : task.id)} className="relative flex w-full items-start gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:gap-4 sm:p-4">
                <span className={`relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-semibold tabular-nums ${task.status === 'accepted' ? 'border-status-success-border bg-diff-added text-diff-added-content' : task.id === workflow.run.currentTaskId ? 'border-divider bg-selected text-selected-content' : 'border-divider bg-surface-raised text-content-secondary'}`}>{task.status === 'accepted' ? <Check className="h-3.5 w-3.5" /> : String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-content sm:text-[13px]">{task.title}</span><span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${meta.tone}`}>{meta.icon}{meta.label}</span>{!task.required && <span className="text-[9px] text-content-muted">Optional</span>}{correctionParent && <span className="rounded-md border border-status-warning-border bg-status-warning-subtle px-1.5 py-0.5 text-[9px] text-status-warning">Follow-up to {correctionParent.title}</span>}{correctionFindings.length > 0 && <span className="rounded-md border border-status-warning-border px-1.5 py-0.5 text-[9px] text-status-warning">{correctionFindings.length} review note{correctionFindings.length === 1 ? '' : 's'}</span>}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-content-muted"><span>{task.ownerName}</span><span className="text-content-muted">·</span><span className="capitalize">{task.kind}</span><span className="text-content-muted">·</span><span>{task.repository}</span>{taskAttempts.length > 0 && <><span className="text-content-muted">·</span><span>{executionAttemptCount} work attempt{executionAttemptCount === 1 ? '' : 's'}{reportFormatRetryUsed ? ' · separate report-only retry' : ''}</span></>}</span>
                  {dependencies.length > 0 && <span className="mt-2 flex flex-wrap items-center gap-1.5">{dependencies.map(dependency => <span key={dependency.id} className={`rounded border px-1.5 py-0.5 text-[9px] ${dependency.status === 'accepted' ? 'border-status-success-border text-status-success' : 'border-status-warning-border text-status-warning'}`}>{dependency.status === 'accepted' ? 'After' : 'Waiting for'} {dependency.title}</span>)}</span>}
                  {unresolvedDependencies.length > 0 && <span className="mt-1.5 block text-[10px] text-status-warning">This task becomes eligible after its dependencies are accepted.</span>}
                </span>
                <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-content-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && <div className="border-t border-divider px-3.5 pb-4 pt-3.5 sm:ml-[3.9rem] sm:px-4 sm:pt-3">
                <p className="max-w-3xl text-xs leading-5 text-content-secondary">{task.description}</p>
                <div className="mt-3 rounded-lg border border-divider bg-selected px-3 py-2.5"><SectionLabel>Why this specialist</SectionLabel><p className="mt-1 text-xs leading-5 text-content-secondary">{task.assignmentReason}</p></div>
                {latestExecution?.prototypeRunId && <button type="button" onClick={() => onViewAgentActivity?.(task.id, latestExecution.prototypeRunId!)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-divider bg-selected px-3 text-[11px] font-semibold text-selected-content transition hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ExternalLink className="h-3.5 w-3.5" />View agent activity</button>}
                <div className="mt-4"><SectionLabel>How we’ll know this is done</SectionLabel><ul className="mt-2 space-y-2">{task.acceptanceCriteria.map((criterion, criterionIndex) => <li key={`${criterion}-${criterionIndex}`} className="flex gap-2 text-xs leading-5 text-content-secondary"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-selected" />{criterion}</li>)}</ul></div>
                {(taskRequirements.length > 0 || task.requiredChecks.length > 0 || task.scope.includePaths.length > 0) && <details className="group mt-4 rounded-lg border border-divider bg-well px-3 py-2.5"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><span>More build details</span><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary><div className="mt-3 space-y-3 border-t border-divider pt-3">{taskRequirements.length > 0 && <div><SectionLabel>Project needs covered</SectionLabel><ul className="mt-2 space-y-1.5">{taskRequirements.map(requirement => <li key={requirement.id} className="text-[11px] leading-4 text-content-secondary">{requirement.description}</li>)}</ul></div>}{task.requiredChecks.length > 0 && <div><SectionLabel>Checks after this work</SectionLabel><div className="mt-2 flex flex-wrap gap-1.5">{task.requiredChecks.map(check => <code key={check} className="rounded-md border border-divider px-1.5 py-1 text-[9px] text-content-secondary">{check}</code>)}</div></div>}{!!task.scope.includePaths.length && <div><SectionLabel>Files this specialist may change</SectionLabel><div className="mt-2 flex flex-wrap gap-1.5">{task.scope.includePaths.map(file => <code key={file} className="max-w-full truncate rounded-md bg-surface-raised px-1.5 py-1 text-[9px] text-content-secondary">{file}</code>)}</div></div>}</div></details>}
                {(taskAttempts.length > 0 || taskFindings.length > 0) && <div className="mt-4 border-t border-divider pt-3.5"><SectionLabel>Result and verification</SectionLabel><div className="mt-2.5"><TaskEvidence workflow={workflow} taskId={task.id} taskById={taskById} /></div></div>}
                {retryable && <button type="button" onClick={() => onRetry(task.id, task.revision)} disabled={Boolean(busyAction)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3 text-[11px] font-semibold text-status-warning transition hover:bg-status-warning-subtle active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-50">{taskBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}{taskBusy ? 'Preparing retry…' : executionAttemptCount >= 1 ? 'Retry this task' : 'Try this task again'}</button>}
                {task.status === 'failed' && executionAttemptCount >= 2 && <p className="mt-3 text-[10px] leading-4 text-status-warning">The two-work-attempt limit was reached. {reportFormatRetryUsed ? 'A report-only retry is tracked separately and does not change that count.' : 'A separate report-only correction may still be available.'}</p>}
              </div>}
            </article>;
          })}
        </div> : <div className="mt-4 rounded-xl border border-dashed border-divider p-5 text-center text-xs text-content-secondary">The validated task plan will appear here when planning finishes.</div>}
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-divider bg-well p-4">
          <SectionLabel>Orchestrator</SectionLabel>
          <div className="mt-2 flex items-start gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-divider bg-selected text-selected-content"><Workflow className="h-4 w-4" /></div><div><div className="text-xs font-semibold text-content">The Orchestrator guides the work</div><p className="mt-1 text-[11px] leading-5 text-content-muted">It sends one ready step at a time, checks the result, and then decides what can happen next.</p></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-divider pt-3">
            <div><div className="font-mono text-sm tabular-nums text-content">{workflow.tasks.length}</div><div className="text-[10px] text-content-muted">steps in the plan</div></div>
            <div><div className="font-mono text-sm tabular-nums text-content">{ownerCount}</div><div className="text-[10px] text-content-muted">assigned specialists</div></div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${liveTask ? 'border-divider bg-selected' : workflow.run.status === 'awaiting_plan_approval' ? 'border-status-info-border bg-status-info-subtle' : workflow.run.status === 'awaiting_approval' ? 'border-status-success-border bg-status-success-subtle' : workflow.run.status === 'publishing' ? 'border-status-warning-border bg-status-warning-subtle' : 'border-divider bg-well'}`}>
          <SectionLabel>{liveTask ? 'Current task' : workflow.run.status === 'awaiting_plan_approval' ? 'Before work starts' : workflow.run.status === 'awaiting_approval' ? 'Next step' : workflow.run.status === 'publishing' ? 'Publication' : 'Build state'}</SectionLabel>
          {liveTask ? <><div className="mt-2 text-sm font-semibold text-content">{liveTask.title}</div><div className="mt-1 text-xs text-link">Owned by {liveTask.ownerName}</div><div className="mt-3 flex items-center gap-2 text-[10px] text-content-muted"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />{liveTask.status === 'submitted' ? 'Alpha is checking the submitted result' : 'The specialist is working within its assigned scope'}</div></>
            : workflow.run.status === 'awaiting_plan_approval' ? <><div className="mt-2 text-sm font-semibold text-status-info">Your review is next</div><p className="mt-1 text-xs leading-5 text-content-secondary">Review the Orchestrator's choices. Choose Start planned work when the assignments and checks look right.</p></>
              : workflow.run.status === 'awaiting_approval' ? <><div className="mt-2 text-sm font-semibold text-status-success">Human review is next</div><p className="mt-1 text-xs leading-5 text-content-secondary">All required tasks are accepted and final checks passed across every selected codebase. Review every code change before approving.</p></>
              : workflow.run.status === 'publishing' ? <><div className="mt-2 text-sm font-semibold text-status-warning">Opening your pull requests</div><p className="mt-1 text-xs leading-5 text-content-secondary">Your approval is recorded. Alpha checks that each pull request is on GitHub. If work is interrupted, retry continues the unfinished steps without opening duplicates.</p></>
              : workflow.run.status === 'validating' ? <><div className="mt-2 text-sm font-semibold text-content">Final validation is running</div><p className="mt-1 text-xs leading-5 text-content-secondary">Alpha is checking the accepted work together before asking for human review.</p></>
                : workflow.run.status === 'recovery_required' ? <><div className="mt-2 text-sm font-semibold text-status-warning">Review saved work before continuing</div><p className="mt-1 text-xs leading-5 text-content-secondary">Alpha preserved the last checkpoint. Resume starts only after you choose to continue.</p></>
                  : <><div className="mt-2 text-sm font-semibold text-content">No specialist is running</div><p className="mt-1 text-xs leading-5 text-content-muted">{workflow.run.status === 'planning' ? 'The Orchestrator is preparing the plan before anyone starts.' : 'The Orchestrator is waiting for a clear next action.'}</p></>}
        </div>

        <details className="group rounded-xl border border-divider bg-well p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><span>Project requirements <span className="ml-1 font-normal text-content-muted">{workflow.requirements.length}</span></span><ChevronDown className="h-3.5 w-3.5 text-content-muted transition-transform group-open:rotate-180" /></summary>
          <div className="mt-3 space-y-2.5 border-t border-divider pt-3">{workflow.requirements.length ? workflow.requirements.map(requirement => <div key={requirement.id}><div className="font-mono text-[9px] text-link">{requirement.id}</div><p className="mt-0.5 text-[11px] leading-4 text-content-secondary">{requirement.description}</p></div>) : <p className="text-[11px] text-content-muted">Requirements are still being prepared.</p>}</div>
        </details>

        {workflow.run.exclusions.length > 0 && <details className="group rounded-xl border border-divider bg-well p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><span>Out of scope <span className="ml-1 font-normal text-content-muted">{workflow.run.exclusions.length}</span></span><ChevronDown className="h-3.5 w-3.5 text-content-muted transition-transform group-open:rotate-180" /></summary>
          <ul className="mt-3 space-y-2 border-t border-divider pt-3">{workflow.run.exclusions.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-[11px] leading-4 text-content-secondary"><LockKeyhole className="mt-0.5 h-3 w-3 shrink-0 text-content-muted" />{item}</li>)}</ul>
        </details>}

        {workflow.run.status === 'completed' && workflow.run.publication && <div className="rounded-xl border border-status-success-border bg-status-success-subtle px-4 py-3 text-[10px] leading-4 text-status-success"><div>Your approved changes are ready for review.</div><div className="mt-2 space-y-2">{(workflow.run.publications?.length ? workflow.run.publications : [{ ...workflow.run.publication, repository: workflow.run.publication.repository ?? workflow.run.repository }]).map(publication => <div key={publication.repository} className="rounded-lg border border-status-success-border bg-well px-3 py-2"><div className="font-semibold text-status-success">{publication.repository}</div><a href={publication.pullRequestUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 font-semibold text-status-success underline decoration-emerald-100/30 underline-offset-2 hover:decoration-emerald-100">Open pull request <ExternalLink className="h-3 w-3" /></a><div className="mt-1 text-status-success">{publication.branchName} → {publication.baseBranch}</div></div>)}</div></div>}
        {workflow.run.status === 'completed' && workflow.run.publication && !publicationSynced && <div className="rounded-xl border border-status-warning-border bg-status-warning-subtle px-4 py-3 text-[10px] leading-4 text-status-warning">The pull request is open; the linked task still needs its review status synchronized. Retry the task sync when ready.</div>}
        {workflow.run.status === 'completed' && !workflow.run.publication && <div className="rounded-xl border border-divider bg-surface-raised px-4 py-3 text-[10px] leading-4 text-content-secondary">This earlier build has no pull request. Review its saved changes or start a new Orchestrator build to send the changes to GitHub for review.</div>}
        {workflow.run.status === 'recovery_required' && <div className="rounded-xl border border-status-warning-border bg-status-warning-subtle px-4 py-3 text-[10px] leading-4 text-status-warning">A saved task may need a retry. Inspect its attempt evidence and changed files above before choosing Resume.</div>}
        {['recovery_required', 'blocked'].includes(workflow.run.status) && !canResume && /orchestrator is unavailable|restarted|recovery/i.test(workflow.run.stoppedReason || '') && <div className="rounded-xl border border-status-warning-border bg-status-warning-subtle px-4 py-3 text-[10px] leading-4 text-status-warning"><div>The Orchestrator is unavailable in this desktop version. Update the app before continuing this build.</div></div>}
        {workflow.finalValidation && <div className="rounded-xl border border-divider bg-well p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><SectionLabel>Final checks</SectionLabel><span className={`rounded-md border px-1.5 py-0.5 text-[9px] ${workflow.finalValidation.status === 'passed' ? 'border-status-success-border bg-diff-added text-diff-added-content' : 'border-status-warning-border bg-status-warning-subtle text-status-warning'}`}>{workflow.finalValidation.status || 'not recorded'}</span></div>
          {workflow.finalValidation.repositories?.length ? <div className="mt-3 space-y-2.5">{workflow.finalValidation.repositories.map(repository => <div key={repository.repository} className="rounded-lg border border-divider bg-surface-raised px-3 py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] font-semibold text-content">{repository.repository}</span><span className={`text-[10px] ${repository.status === 'passed' ? 'text-status-success' : 'text-status-warning'}`}>{repository.status || 'not recorded'}</span></div>{repository.commands.length ? <div className="mt-2 space-y-1.5">{repository.commands.map((command, index) => <div key={`${command.script}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-content-secondary"><span>{command.script || command.display || 'Check'}</span><span className={command.exitCode === 0 && command.signal === null ? 'text-status-success' : 'text-status-danger'}>{command.exitCode === 0 && command.signal === null ? 'passed' : command.signal ? `stopped · ${command.signal}` : command.exitCode === null ? 'unknown' : `exit ${command.exitCode}`}</span></div>)}</div> : <p className="mt-1.5 text-[10px] text-content-muted">No checks were recorded.</p>}{!!repository.missingScripts.length && <p className="mt-1.5 text-[10px] text-status-warning">Not set up in this codebase: {repository.missingScripts.join(', ')}</p>}{repository.resultCommit && <div className="mt-1.5 font-mono text-[9px] text-content-muted">Review reference {repository.resultCommit.slice(0, 7)}</div>}</div>)}</div> : <>{workflow.finalValidation.commands.length ? <div className="mt-2 space-y-1.5">{workflow.finalValidation.commands.map((command, index) => <div key={`${command.script}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-content-secondary"><span>{command.script || command.display || 'Command'}</span><span className={command.exitCode === 0 && command.signal === null ? 'text-status-success' : 'text-status-danger'}>{command.exitCode === 0 && command.signal === null ? 'passed' : command.signal ? `stopped · ${command.signal}` : command.exitCode === null ? 'unknown' : `exit ${command.exitCode}`}</span></div>)}</div> : <p className="mt-2 text-[10px] leading-4 text-content-muted">No checks were recorded.</p>}{!!workflow.finalValidation.missingScripts.length && <p className="mt-2 text-[10px] text-status-warning">Not set up in this codebase: {workflow.finalValidation.missingScripts.join(', ')}</p>}{workflow.finalValidation.resultCommit && <div className="mt-2 font-mono text-[9px] text-content-muted">Review reference {workflow.finalValidation.resultCommit.slice(0, 7)}</div>}</>}
        </div>}
        {workflow.tasks.length > 0 && !activeTask && !liveTask && workflow.run.status === 'executing' && <p className="text-[10px] leading-4 text-content-muted">{workflow.run.stoppedReason || 'The Orchestrator is choosing the next ready task.'}</p>}
      </aside>
    </div>
  </section>;
};
