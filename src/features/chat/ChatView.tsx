import { ChatPanelHandle } from './ChatPanelHandle';
import { LocalPreviewTab, WebPreviewCard, useLocalPreviews } from './LocalPreview';
import { reconcileCallSnapshot } from './chatCallSnapshot';
import { WorkUsageRow, useChatUsage, entriesAtMessage } from './ChatUsage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OrchestrationPlanPreview, PlanDocumentTab, PlanPanelContext, planFileName, type PlanPanelRequest } from '../live-build-room/OrchestrationPlanPreview';
import {
  AlertTriangle,
  Activity,
  Brain,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clipboard,
  Code2,
  Copy,
  FileCode2,
  FileText,
  FolderGit2,
  FolderOpen,
  GitBranch,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Globe,
  PencilLine,
  Paperclip,
  Image as ImageIcon,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
  Kanban
} from 'lucide-react';

import { useApp, useTabSessionState } from '@/app/AppContext';
import { statusLabel as taskStatusLabel, taskHandoffContext } from '@/features/issues';
import { isDesktop } from '@/shared/desktop';
import { Modal } from '@/shared/components/Modal';
import { apiService } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import {
  AgentCall,
  AgentCallMode,
  AgentCallTarget,
  ChatMessage,
  ChatAttachmentReference,
  ProjectChatAgent,
  ProjectChatSnapshot,
  LiveBuildRoomSnapshot,
  ChatSyncStatus,
  LiveBuildRecoveryAction
} from '@/shared/types';
import { CreateProjectModal } from '@/features/projects/CreateProjectModal';
import { MessageMarkdown } from './MessageMarkdown';
import { OrchestratorFlow, isOrchestratorCall } from './OrchestratorFlow';
import { AgentActivityPanel } from './AgentActivityPanel';
import { BuildAgentActivityPanel } from './BuildAgentActivityPanel';
import { ChatSidePanel, type SidePanelTab } from './ChatSidePanel';
import { BuildReviewTab, SavedBuildReviewTab } from './BuildReviewTab';
import { LiveChangesView } from './LiveChangesView';
import { ChatBuildWizard, planningFailureReason, type BuildPlanningFailure } from './ChatBuildWizard';
import { buildHandoffs, buildStatusLabel, needsSecurityAuditPlan, useProjectLiveBuild } from './useProjectLiveBuild';
import { OrchestrationRecoveryPanel } from './OrchestrationRecoveryPanel';
import { inferRecoveryAction, isBuildDirection, isContinueRequest, isExplicitBuildRetry, isRetryRequest, resolveRecoveryAction } from './chatRecoveryIntent';
import { ChatHome } from './ChatHome';
import { useTranscriptScroll } from './useTranscriptScroll';

const MODE_META: Record<AgentCallMode, {
  label: string;
  description: string;
  icon: React.ReactNode;
}> = {
  ask: {
    label: 'Ask',
    description: 'Get a focused answer from the selected agent.',
    icon: <MessageSquare className="h-3.5 w-3.5" />
  },
  review: {
    label: 'Review',
    description: 'Inspect a target and return findings without changing files.',
    icon: <ShieldCheck className="h-3.5 w-3.5" />
  },
  revise: {
    label: 'Revise',
    description: 'Propose a patch for review. Nothing is applied automatically.',
    icon: <PencilLine className="h-3.5 w-3.5" />
  },
  implement: {
    label: 'Implement',
    description: 'Prepare a patch after a separate confirmation step.',
    icon: <Play className="h-3.5 w-3.5" />
  }
};

const TARGET_LABELS: Record<string, string> = {
  message: 'Message',
  agent_response: 'Agent response',
  issue: 'Task',
  specification: 'Specification',
  file: 'File',
  code: 'Code selection',
  branch: 'Branch',
  commit: 'Commit',
  pull_request: 'Pull request',
  diff: 'Diff'
};
const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CHAT_FILES = 8;

function recoveryActionKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `chat-recovery-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

interface ChatMentionQuery {
  start: number;
  end: number;
  query: string;
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function statusLabel(status: AgentCall['status']): string {
  switch (status) {
    case 'awaiting_confirmation': return 'Ready for confirmation';
    case 'queued': return 'Queued';
    case 'running': return 'Responding';
    case 'completed': return 'Completed';
    case 'failed': return 'Needs attention';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

function statusTone(status: AgentCall['status']): string {
  switch (status) {
    case 'running': return 'text-selected-content bg-selected border-divider';
    case 'queued': return 'text-status-info bg-status-info-subtle border-status-info-border';
    case 'awaiting_confirmation': return 'text-status-warning bg-status-warning-subtle border-status-warning-border';
    case 'completed': return 'text-status-success bg-status-success-subtle border-status-success-border';
    case 'failed': return 'text-status-danger bg-status-danger-subtle border-status-danger-border';
    default: return 'text-content-secondary bg-surface-raised border-divider';
  }
}

function getMentionQueryAtCursor(value: string, cursor: number): ChatMentionQuery | null {
  const match = /(?:^|[\s(\[{])@([a-zA-Z0-9_-]*)$/.exec(value.slice(0, cursor));
  if (!match) return null;
  const mentionStart = cursor - match[0].length + (match[0][0] === '@' ? 0 : 1);
  return { start: mentionStart, end: cursor, query: match[1] };
}

function ChatTurnActivityRow({
  calls,
  agents
}: {
  calls: AgentCall[];
  agents: ProjectChatAgent[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (!calls.length) return null;
  const ordered = [...calls].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const current = ordered.find(call => call.status === 'running' || call.status === 'queued') ?? ordered.at(-1)!;
  const currentAgent = agents.find(agent => agent.id === current.agentId);
  const latestActivity = current.activities.at(-1);
  const changedFiles = [...new Set(ordered.flatMap(call => call.activities
    .filter(activity => activity.kind === 'file_change')
    .flatMap(activity => activity.paths ?? [])))];
  const working = current.status === 'running' || current.status === 'queued';
  const summary = latestActivity?.message ?? (working ? 'Starting work' : statusLabel(current.status));
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-divider bg-surface-raised/75 text-left">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-high">
        {working ? <span className="h-2 w-2 shrink-0 rounded-full bg-violet-300 animate-pulse" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" />}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-link">{currentAgent?.name ?? (current.squadId === 'alpha-chat' ? 'Alpha' : current.agentId)} · {summary}</span>
        <span className="shrink-0 text-[10px] text-content-muted">{changedFiles.length} changed</span>
        <span className="shrink-0 text-[10px] text-link">{expanded ? 'Hide activity' : 'View activity'}</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-content-muted" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-content-muted" />}
      </button>
      {expanded && <div className="space-y-3 border-t border-divider px-3 py-3">
        {ordered.map(call => {
          const agent = agents.find(item => item.id === call.agentId);
          return <section key={call.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="font-semibold text-content">{agent?.name ?? (call.squadId === 'alpha-chat' ? 'Alpha' : call.agentId)}</span>
              <span className={call.status === 'running' ? 'text-link' : call.status === 'completed' ? 'text-status-success' : call.status === 'failed' ? 'text-status-danger' : 'text-content-muted'}>{statusLabel(call.status)}</span>
            </div>
            {call.activities.length ? <ol className="space-y-2 border-l border-divider pl-3">
              {[...call.activities].reverse().map(activity => <li key={activity.id} className="relative text-[10px] leading-4 text-content-secondary">
                <span className={`absolute -left-[17px] top-1.5 h-1.5 w-1.5 rounded-full ${activity.kind === 'error' ? 'bg-rose-400' : activity.kind === 'file_change' ? 'bg-emerald-400' : activity.kind === 'handoff' ? 'bg-amber-300' : 'bg-violet-300'}`} />
                <span>{activity.toolName ? `${activity.toolName} · ` : ''}{activity.message}</span>
                {activity.detail && <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-well px-2 py-1.5 font-mono text-[9px] text-content-secondary">{activity.detail}</pre>}
                {!!activity.paths?.length && <div className="mt-1 flex flex-wrap gap-1.5">{activity.paths.map(file => <span key={file} className="inline-flex items-center gap-1 rounded bg-surface-raised px-1.5 py-1 text-left font-mono text-[9px] text-status-success hover:bg-surface-high"><FileCode2 className="h-3 w-3" />{file}</span>)}</div>}
              </li>)}
            </ol> : <p className="text-[10px] text-content-muted">Waiting for the first visible work update.</p>}
          </section>;
        })}

      </div>}
    </div>
  );
}

function OrchestratorBuildActivityRow({
  projectId,
  runId,
  threadId,
  onOpenReview,
  onWithdraw,
  withdrawing = false
}: {
  projectId: string;
  runId: string;
  threadId: string;
  onOpenReview: () => void;
  /** Turn an unstarted plan back into a question for Alpha to answer. */
  onWithdraw?: () => void;
  withdrawing?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<LiveBuildRoomSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [retryNotice, setRetryNotice] = useState('');
  const [retryNoticeTaskId, setRetryNoticeTaskId] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    setLoading(true);
    const sync = async () => {
      try {
        const next = await apiService.getLiveBuildRoom(projectId, runId);
        if (cancelled) return;
        setSnapshot(next);
        if (next.orchestration?.run.id !== runId) {
          setError('Run details could not be matched to this chat update. The saved Build review tab contains the build details.');
          return;
        }
        setError('');
        const status = next.orchestration?.run.status;
        const shouldSurface = Boolean(status && [
          'planning', 'executing', 'validating', 'publishing', 'cancelling',
          'awaiting_plan_approval', 'awaiting_approval', 'paused', 'blocked', 'recovery_required', 'failed'
        ].includes(status));
        if (shouldSurface && !autoExpanded) {
          setAutoExpanded(true);
          setExpanded(true);
        }
        if (status && !['completed', 'failed', 'cancelled'].includes(status)) {
          const active = ['planning', 'executing', 'validating', 'publishing', 'cancelling'].includes(status);
          timer = window.setTimeout(() => void sync(), active ? 2_500 : expanded ? 6_000 : 15_000);
        }
      } catch (syncError: any) {
        if (cancelled) return;
        setError(syncError?.message ?? 'Run details could not be loaded.');
        timer = window.setTimeout(() => void sync(), expanded ? 5_000 : 15_000);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void sync();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [autoExpanded, expanded, projectId, runId]);

  const orchestration = snapshot?.orchestration;
  const tasks = orchestration?.tasks ?? [];
  const attempts = orchestration?.attempts ?? [];
  const changedFiles = [...new Set([
    ...attempts.flatMap(attempt => [
      ...attempt.changedPaths,
      ...(attempt.report?.deliverables ?? []).flatMap(deliverable => deliverable.paths)
    ]),
    ...(snapshot?.agentCards ?? []).flatMap(card => [
      ...(card.filePaths ?? []),
      ...card.activity.filter(item => item.kind === 'file_change').flatMap(item => item.paths ?? [])
    ])
  ])].sort((a, b) => a.localeCompare(b));
  const status = orchestration?.run.status;
  const working = Boolean(status && ['planning', 'executing', 'validating', 'publishing', 'cancelling'].includes(status));
  const currentTask = tasks.find(task => task.id === orchestration?.run.currentTaskId)
    ?? tasks.find(task => ['running', 'submitted'].includes(task.status));
  const currentAttempt = currentTask
    ? [...attempts].reverse().find(attempt => attempt.taskId === currentTask.id)
    : undefined;
  const currentAgent = snapshot?.agentCards.find(card => card.runId === currentAttempt?.prototypeRunId)
    ?? snapshot?.agentCards.find(card => card.status === 'running');
  const failedAttempt = [...attempts].reverse().find(attempt =>
    ['failed', 'recovery_required', 'rejected'].includes(attempt.status) &&
    tasks.some(task => task.id === attempt.taskId && ['failed', 'blocked'].includes(task.status)));
  const failedTask = failedAttempt ? tasks.find(task => task.id === failedAttempt.taskId) : undefined;
  const recovery = orchestration?.recovery;
  const activeRecovery = recovery && !['resolved', 'cancelled'].includes(recovery.phase) ? recovery : undefined;
  const retryAvailable = Boolean(snapshot?.canControlOrchestration ?? snapshot?.canRun) &&
    failedTask?.retryAvailable === true && !activeRecovery;
  const refreshAfterRecovery = async () => {
    const refreshed = await apiService.getLiveBuildRoom(projectId, runId);
    setSnapshot(refreshed);
  };
  const retryFailedTask = async () => {
    if (!retryAvailable || !failedTask || retryBusy) return;
    setRetryBusy(true);
    setRetryError('');
    setRetryNotice('');
    try {
      await apiService.retryOrchestrationTask(projectId, runId, failedTask.id, failedTask.revision);
      const refreshed = await apiService.getLiveBuildRoom(projectId, runId);
      setSnapshot(refreshed);
      if (refreshed.orchestration?.run.currentTaskId === failedTask.id) {
        setRetryNotice('The task restarted. Alpha will check its new result before handing work to the next specialist.');
        setRetryNoticeTaskId(failedTask.id);
      } else {
        setRetryError(refreshed.orchestration?.run.stoppedReason || 'Alpha could not start the retry. Open the Build review tab to review the saved reason.');
        setRetryNotice('');
        setRetryNoticeTaskId('');
      }
    } catch (retryFailure: any) {
      setRetryError(retryFailure?.message ?? 'The retry could not be started. Refresh the build and try again.');
    } finally {
      setRetryBusy(false);
    }
  };
  const activity = (snapshot?.agentCards ?? []).flatMap(card => card.activity
    .filter(item => ['status', 'stage', 'assistant', 'tool', 'tool_result', 'file_change', 'handoff', 'error', 'summary'].includes(item.kind))
    .map(item => ({ ...item, agentName: card.agentName })))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);
  const statusLabel = status?.replace(/_/g, ' ') ?? (loading ? 'connecting' : 'activity unavailable');

  return <div className="mt-2 overflow-hidden rounded-xl border border-divider bg-surface-raised/75 text-left">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-high">
      {working ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-300" />
        : status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" />
          : status === 'awaiting_approval' || status === 'awaiting_plan_approval' ? <Circle className="h-3 w-3 shrink-0 text-status-warning" />
            : status ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-warning" />
              : <Activity className="h-3.5 w-3.5 shrink-0 text-link" />}
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-link">{currentAgent?.agentName ?? currentTask?.ownerName ?? 'Orchestrator activity'}{currentTask ? ` · ${currentTask.title}` : ` · ${statusLabel}`}</span>
      <span className="hidden shrink-0 text-[10px] text-content-muted sm:inline">{changedFiles.length} {changedFiles.length === 1 ? 'file changed' : 'files changed'}</span>
      <span className="shrink-0 text-[10px] text-link">{expanded ? 'Hide details' : 'View details'}</span>
      {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-content-muted" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-content-muted" />}
    </button>
    {!expanded && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-divider px-3 py-2 text-[10px] text-content-secondary">
      <span className="capitalize text-link">{statusLabel}</span>
      {activity[0] && <><span className="text-content-muted">·</span><span className="min-w-0 truncate">{activity[0].toolName ? `${activity[0].toolName}: ` : ''}{activity[0].message}</span></>}
      {!activity.length && <span>{currentTask ? `${currentTask.ownerName} is assigned and activity will appear here.` : 'Open to see task assignments and live work.'}</span>}
    </div>}
    {onWithdraw && (status === 'planning' || status === 'awaiting_plan_approval') && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider px-3 py-2 text-[10px] text-content-secondary">
      <span>No code has changed yet. Review the plan, or tell Alpha this was only a question.</span>
      <button type="button" onClick={onWithdraw} disabled={withdrawing} className="rounded-md border border-divider px-2 py-1 font-medium text-content hover:bg-surface-high disabled:opacity-50">{withdrawing ? 'Answering…' : 'This was just a question'}</button>
    </div>}
    {activeRecovery && orchestration && snapshot && <div className="border-t border-divider p-2.5">
      <OrchestrationRecoveryPanel
        projectId={projectId}
        runId={runId}
        threadId={threadId}
        runRevision={orchestration.run.revision}
        taskRevision={activeRecovery.taskId ? tasks.find(task => task.id === activeRecovery.taskId)?.revision : undefined}
        recovery={activeRecovery}
        canControl={Boolean(snapshot.canControlOrchestration ?? snapshot.canRun)}
        onOpenReview={onOpenReview}
        onActionComplete={refreshAfterRecovery}
        compact
      />
    </div>}
    {orchestration && <div className="px-3 py-2"><OrchestrationPlanPreview projectId={projectId} runId={runId} planVersion={orchestration.run.planVersion} autoShow={false} /></div>}
    {expanded && <div className="space-y-4 border-t border-divider px-3 py-3">
      {loading && !snapshot && <div className="flex items-center gap-2 text-[10px] text-content-muted"><Loader2 className="h-3 w-3 animate-spin" />Loading run details…</div>}
      {error && <p role="alert" className="text-[10px] text-status-danger">{error}</p>}
      {currentTask && <section className="rounded-lg border border-divider bg-selected px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-link"><Activity className="h-3 w-3" />{working ? 'Working now' : 'Current assignment'}<span className="normal-case tracking-normal text-content-muted">· {currentAgent?.agentName ?? currentTask.ownerName}</span>{currentAgent?.status === 'running' && <span className="inline-flex items-center gap-1 rounded border border-divider px-1.5 py-0.5 normal-case tracking-normal text-link"><span className="h-1 w-1 animate-pulse rounded-full bg-violet-200" />Live</span>}</div>
        <div className="mt-1 text-[11px] font-medium text-content">{currentTask.title}</div>
        {currentAgent?.currentStage && <div className="mt-1 text-[10px] text-content-secondary">{currentAgent.currentStage}</div>}
      </section>}
      {tasks.length > 0 && <section className="space-y-2">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-content-muted">Orchestrator assignments</div>
        {tasks.map(task => <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg bg-well px-2.5 py-2">
          <div className="min-w-0"><div className="text-[10px] font-medium text-content">{task.title}</div><div className="mt-0.5 text-[9px] text-content-muted">{task.ownerName}{task.assignmentReason ? ` · ${task.assignmentReason}` : ''}</div></div>
          <span className="shrink-0 text-[9px] capitalize text-link">{task.status.replace(/_/g, ' ')}</span>
        </div>)}
      </section>}
      {(activeRecovery || ((!recovery || ['resolved', 'cancelled'].includes(recovery.phase)) && ['blocked', 'failed', 'recovery_required'].includes(status ?? '') && (failedAttempt?.failureReason || orchestration?.run.stoppedReason))) && <section role="alert" className="rounded-lg border border-status-warning-border bg-status-warning-subtle px-3 py-2.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-status-warning">Why the build stopped</div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-4 text-content-secondary">{failedAttempt?.failureReason || orchestration?.run.stoppedReason}</p>
        {failedAttempt?.verification?.commands?.length ? <ul className="mt-2 space-y-1 border-t border-status-warning-border pt-2">{failedAttempt.verification.commands.map((command, index) => <li key={`${command.script ?? command.display ?? 'check'}-${index}`} className="flex flex-wrap items-center gap-x-1.5 text-[9px] text-content-secondary"><code>{command.display ?? command.script ?? 'Verification check'}</code><span>·</span><span className={command.exitCode === 0 ? 'text-status-success' : command.exitCode === null ? 'text-status-warning' : 'text-status-danger'}>{command.exitCode === 0 ? 'passed' : command.exitCode === null ? command.signal ?? 'stopped' : `failed (exit ${command.exitCode})`}</span></li>)}</ul> : null}
        {retryAvailable && failedTask && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-status-warning-border pt-2">
          <span className="text-[9px] leading-4 text-content-secondary">Retry {failedTask.title} with {failedTask.ownerName}; Alpha checks the result before continuing.</span>
          <button type="button" onClick={() => void retryFailedTask()} disabled={retryBusy} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-status-warning-border bg-status-warning-subtle px-2.5 text-[10px] font-semibold text-status-warning hover:bg-status-warning-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-50">
            {retryBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}{retryBusy ? 'Starting retry…' : 'Retry and continue'}
          </button>
        </div>}
        {retryNotice && orchestration?.run.currentTaskId === retryNoticeTaskId && <p role="status" className="mt-2 text-[10px] leading-4 text-status-success">{retryNotice}</p>}
        {retryError && <p role="alert" className="mt-2 text-[10px] leading-4 text-status-danger">{retryError}</p>}
      </section>}
      <section className="space-y-2">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-content-muted">Files changed</div>
        {changedFiles.length ? <div className="flex flex-wrap gap-1.5">{changedFiles.map(file => <code key={file} className="max-w-full truncate rounded-md bg-well px-2 py-1 font-mono text-[9px] text-status-success">{file}</code>)}</div>
          : <p className="text-[10px] text-content-muted">No files changed yet. File updates will appear here as specialists work.</p>}
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2"><div className="text-[9px] font-semibold uppercase tracking-wider text-content-muted">Agent actions and updates</div>{working && <span className="inline-flex items-center gap-1 text-[9px] text-link"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />Refreshing live</span>}</div>
        {activity.length > 0 ? <ol className="space-y-2 border-l border-divider pl-3">{activity.map(item => <li key={`${item.id}-${item.agentName}`} className="relative text-[10px] leading-4 text-content-secondary">
          <span className={`absolute -left-[17px] top-1.5 h-1.5 w-1.5 rounded-full ${item.kind === 'error' ? 'bg-rose-400' : item.kind === 'file_change' ? 'bg-emerald-400' : 'bg-violet-300'}`} />
          <div className="flex flex-wrap items-center gap-x-1.5"><span className="font-medium text-content">{item.agentName}</span><span className="text-content-muted">·</span><span className="text-content-muted">{item.toolName ?? item.kind.replace(/_/g, ' ')}</span>{item.isStreaming && <span className="inline-flex items-center gap-1 rounded border border-divider px-1 py-0.5 text-[8px] text-link"><span className="h-1 w-1 animate-pulse rounded-full bg-violet-200" />Live</span>}<time className="text-content-muted">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
          <div className="mt-0.5 whitespace-pre-wrap break-words text-content-secondary">{item.message}</div>
          {item.detail && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-well px-2 py-1.5 font-mono text-[9px] text-content-secondary">{item.detail}</pre>}
          {!!item.paths?.length && <div className="mt-1 flex flex-wrap gap-1">{item.paths.map(file => <code key={file} className="max-w-full truncate rounded bg-surface-raised px-1.5 py-1 font-mono text-[9px] text-status-success">{file}</code>)}</div>}
        </li>)}</ol> : <p className="text-[10px] text-content-muted">{working ? 'The agent is starting. Its conversation, tool calls, and file edits will appear here.' : 'No agent actions were recorded for this build.'}</p>}
      </section>

    </div>}
  </div>;
}

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageAttachments({ attachments }: { attachments?: ChatAttachmentReference[] }) {
  if (!attachments?.length) return null;
  return <div className="mt-2 flex flex-wrap gap-1.5">{attachments.map(attachment => <span key={attachment.id} title={`${attachment.contentType} · ${attachment.inspection === 'included_text' ? 'Text included with the request' : attachment.inspection === 'available_to_runtime' ? 'Local file available to the selected runtime' : 'Stored locally; not analyzed'}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-divider bg-well px-2 py-1 text-[10px] text-current">
    {attachment.contentType.startsWith('image/') ? <ImageIcon className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
    <span className="max-w-48 truncate">{attachment.name}</span><span className="shrink-0 opacity-60">{formatFileSize(attachment.byteLength)}</span>
    {attachment.inspection === 'stored_only' && <span className="shrink-0 opacity-70">· not analyzed</span>}
  </span>)}</div>;
}

/** One thing open in the chat's right side panel. */
type SideTab =
  | { id: string; kind: 'plan'; projectId: string; runId: string; planVersion: number }
  | { id: string; kind: 'agent'; agentId: string }
  | { id: string; kind: 'call'; callId: string }
  | { id: string; kind: 'review'; projectId: string; runId: string }
  | { id: string; kind: 'preview' }
  | { id: string; kind: 'changes'; projectId: string; runId: string };

export const ChatView: React.FC = () => {
  const {
    chatThreads,
    activeThreadId,
    setActiveThreadId,
    createNewThread,
    deleteThread,
    sendChatMessage,
    refreshChatThread,
    isAgentTyping,
    isActiveTab,
    activeChatAgentId,
    projects,
    activeWorkspace,
    role,
    users,
    can,
    showToast,
    setActiveTab,
    setTabSessionState,
    activeTabId,
    agents: workspaceAgents,
    runtimes,
    updateAgent,
    currentUser,
    issues
  } = useApp();

  const sessionStateKey = (key: string, threadId = activeThreadId) => `chat.session.${threadId ?? 'draft'}.${key}`;
  const [input, setInput] = useTabSessionState<string>(sessionStateKey('draft'), '');
  const [approvalMode, setApprovalMode] = useTabSessionState<'ask' | 'approve' | 'full'>(sessionStateKey('approvalMode'), 'ask');
  /** A board task handed to this conversation from its details; sent with the next message. */
  const [taskRefId, setTaskRefId] = useTabSessionState<string | null>(sessionStateKey('taskRef'), null);
  const taskRef = taskRefId ? issues.find(issue => issue.id === taskRefId) : undefined;
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingFileViews, setPendingFileViews] = useState<Array<{ file: File; previewUrl?: string }>>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [chatTurnActionBusy, setChatTurnActionBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** What is open in the right side panel, one tab each, and which tab is showing. */
  const panelKey = (key: string) => `${sessionStateKey(key)}.${activeWorkspace?.id ?? ''}.${currentUser?.id ?? ''}`;
  const [panelVisible, setPanelVisible] = useTabSessionState<boolean>(panelKey('panelVisible'), false);
  const [sideTabs, setSideTabs] = useTabSessionState<SideTab[]>(panelKey('sideTabs'), []);
  const [activeSideTabId, setActiveSideTabId] = useTabSessionState<string | null>(panelKey('activeSideTab'), null);
  const [openedReviewDecisions, setOpenedReviewDecisions] = useTabSessionState<string[]>(sessionStateKey('openedReviewDecisions'), []);
  const activeSideTab = sideTabs.find(tab => tab.id === activeSideTabId) ?? null;
  const inspectedCallId = activeSideTab?.kind === 'call' ? activeSideTab.callId : null;
  const inspectedBuildAgentId = activeSideTab?.kind === 'agent' ? activeSideTab.agentId : null;
  const openSideTab = (tab: SideTab, focus = true) => {
    setSideTabs(current => current.some(item => item.id === tab.id) ? current.map(item => item.id === tab.id ? tab : item) : [...current, tab]);
    if (focus) { setActiveSideTabId(tab.id); setPanelVisible(true); }
    else { setActiveSideTabId(active => active ?? tab.id); if (!sideTabs.length) setPanelVisible(true); }
  };
  const closeSideTab = (id: string) => {
    if (sideTabs.find(tab => tab.id === id)?.kind === 'preview') void previews.stop();
    setSideTabs(current => {
      const index = current.findIndex(item => item.id === id);
      const next = current.filter(item => item.id !== id);
      setActiveSideTabId(active => active === id ? next[Math.min(index, next.length - 1)]?.id ?? null : active);
      return next;
    });
  };
  /** Plans that opened by themselves, once per version, so a closed plan tab stays closed. */
  const autoOpenedPlans = useRef(new Set<string>());
  const openPlanTab = (request: PlanPanelRequest) => {
    const key = request.runId + ':' + request.planVersion;
    if (request.auto && autoOpenedPlans.current.has(key)) return;
    autoOpenedPlans.current.add(key);
    // Opening by itself adds the tab without taking over the agent you are watching.
    openSideTab({ id: 'plan:' + request.runId, kind: 'plan', projectId: request.projectId, runId: request.runId, planVersion: request.planVersion }, !request.auto);
  };
  const [buildDecisionBusy, setBuildDecisionBusy] = useState<'start' | 'approve' | 'stop' | 'continue' | 'retry' | null>(null);
  const [buildDecisionError, setBuildDecisionError] = useState<string | null>(null);
  /** Planning failures someone closed in the build panel, by message id. */
  const [dismissedBuildFailures, setDismissedBuildFailures] = useTabSessionState<string[]>(sessionStateKey('dismissedBuildFailures'), []);
  const [publishedBuild, setPublishedBuild] = useTabSessionState<{ projectId: string; links: Array<{ repository: string; url: string }> } | null>(sessionStateKey('publishedBuild'), null);
  const [snapshot, setSnapshot] = useState<ProjectChatSnapshot | null>(null);
      const [chatSyncStatus, setChatSyncStatus] = useState<ChatSyncStatus | null>(null);
  const [syncRetrying, setSyncRetrying] = useState(false);
  const [selectedBuildRepositories, setSelectedBuildRepositories] = useTabSessionState<string[]>(sessionStateKey('buildRepositories'), []);
  const [routingMessageId, setRoutingMessageId] = useState<string | null>(null);
  // The list stays docked; a collapsed rail expands only on click.
  const [threadListCollapsed, setThreadListCollapsed] = useTabSessionState<boolean>('chatThreadListCollapsed', false);
  const [expandedProjectIds, setExpandedProjectIds] = useTabSessionState<string[]>('chatExpandedProjectIds', []);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [threadPendingDelete, setThreadPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [memoryThreadId, setMemoryThreadId] = useState<string | null>(null);
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [openThreadMenuId, setOpenThreadMenuId] = useState<string | null>(null);
  const threadMenuRef = useRef<HTMLDivElement>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showMoreThreads, setShowMoreThreads] = useState<Record<string, boolean>>({});
  // The composer floats over the transcript; the transcript keeps room for it.
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(96);
  useEffect(() => {
    const element = composerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setComposerHeight(Math.ceil(entry.contentRect.height)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeThreadId]);
  useEffect(() => {
    setPendingFileViews(current => {
      current.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
      return [];
    });
    setPendingFiles([]);
    setIsDraggingFiles(false);
    setChatTurnActionBusy(false);
    setBuildDecisionBusy(null);
    setBuildDecisionError(null);
    setStoppingProjectRunId(null);
    setRoutingMessageId(null);
    setRepositoryMenuOpen(false);
    setMentionQuery(null);
    setMemoryThreadId(null);
  }, [activeThreadId]);
  const [calls, setCalls] = useState<Record<string, AgentCall>>({});
  const [busyCallId, setBusyCallId] = useState<string | null>(null);
  const [stoppingProjectRunId, setStoppingProjectRunId] = useState<string | null>(null);
  const [repositoryMenuOpen, setRepositoryMenuOpen] = useState(false);
  const repositoryMenuRef = useRef<HTMLDivElement>(null);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [copiedCallId, setCopiedCallId] = useState<string | null>(null);
  const [expandedCallPanel, setExpandedCallPanel] = useState<Record<string, boolean>>({});
  const callsRef = useRef<Record<string, AgentCall>>({});
  const acceptCallSnapshot = (next: AgentCall, threadId: string) => {
    const accepted = reconcileCallSnapshot(callsRef.current[next.id], next, threadId);
    if (!accepted) return;
    callsRef.current = { ...callsRef.current, [accepted.id]: accepted };
    setCalls(previous => ({ ...previous, [accepted.id]: accepted }));
  };
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<ChatMentionQuery | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  useEffect(() => {
    if (!openThreadMenuId && !openProjectMenuId) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !threadMenuRef.current?.contains(event.target)) {
        setOpenThreadMenuId(null);
        setOpenProjectMenuId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenThreadMenuId(null);
        setOpenProjectMenuId(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openThreadMenuId, openProjectMenuId]);


  const activeThread = useMemo(
    () => chatThreads.find(thread => thread.id === activeThreadId) ?? null,
    [chatThreads, activeThreadId]
  );
  const currentMessages = activeThread?.messages ?? [];
  const usage = useChatUsage(activeThread?.id, `${activeWorkspace?.id ?? ''}:${currentUser?.id ?? ''}`, isActiveTab, isAgentTyping);
  const usageNames = Object.fromEntries(workspaceAgents.map(agent => [agent.id, agent.name]));
  const isClient = role === 'client';
  const project = projects.find(item => item.id === activeThread?.projectId);
  const openPreview = () => openSideTab({ id: 'preview', kind: 'preview' });
  const previews = useLocalPreviews(activeThreadId ?? undefined, `${activeWorkspace?.id}:${currentUser?.id}:${activeThreadId}`, Boolean(project && !isClient && isActiveTab), openPreview);
  // Only a build originating in this conversation can appear or be controlled here.
  const { build: liveBuild, latestBuild, refresh: refreshLiveBuild } = useProjectLiveBuild(
    project?.id,
    !isClient && Boolean(project) && Boolean(activeThreadId) && isActiveTab,
    activeThreadId
  );
  const inspectedBuildAgent = latestBuild?.agents.find(agent => agent.agentId === inspectedBuildAgentId) ?? null;
  const buildIsOpen = Boolean(liveBuild);
  const canStopBuild = !isClient && can('run_builds') && buildIsOpen && liveBuild?.status !== 'cancelling' && liveBuild?.status !== 'publishing';
  // Plan approval and final review are answered in the chat itself.
  const buildDecision = !isClient && liveBuild && ['awaiting_plan_approval', 'awaiting_approval', 'publishing'].includes(liveBuild.status) ? liveBuild : null;
  const buildDecisionKey = liveBuild ? liveBuild.runId + ':' + liveBuild.status : '';
  const openBuildReview = () => {
    if (latestBuild && project) openSideTab({ id: 'review:' + latestBuild.runId, kind: 'review', projectId: project.id, runId: latestBuild.runId });
  };
  useEffect(() => {
    if (isClient || !latestBuild || !project || !['awaiting_plan_approval', 'awaiting_approval', 'completed'].includes(latestBuild.status)) return;
    const key = `${latestBuild.runId}:${latestBuild.status}:${latestBuild.orchestration.run.planVersion}`;
    if (openedReviewDecisions.includes(key)) return;
    setOpenedReviewDecisions(current => [...current, key]);
    openBuildReview();
  }, [activeThreadId, isClient, latestBuild?.runId, latestBuild?.status, latestBuild?.orchestration.run.planVersion, openedReviewDecisions]);
  useEffect(() => { setBuildDecisionError(null); }, [buildDecisionKey]);
  const startPlannedBuild = async () => {
    if (!liveBuild || !project?.id || buildDecisionBusy) return;
    setBuildDecisionBusy('start');
    setBuildDecisionError(null);
    try {
      await apiService.startPlannedOrchestration(project.id, liveBuild.runId, liveBuild.revision);
      showToast('Build started', 'The first agent is starting. Follow each agent in the bar above.', 'success');
    } catch (error: any) {
      setBuildDecisionError(error?.message ?? 'The plan could not be started. It may have changed; check it and try again.');
    } finally {
      setBuildDecisionBusy(null);
      void refreshLiveBuild();
    }
  };
  const resumePausedBuild = async () => {
    if (!liveBuild || !project?.id) return;
    try {
      await apiService.resumeOrchestration(project.id, liveBuild.runId);
      showToast('Build resumed', 'The Orchestrator picked the build up where it paused.', 'success');
    } catch (error: any) {
      showToast('Build not resumed', error?.message ?? 'Open the build to see what it is waiting for.', 'error');
    } finally {
      void refreshLiveBuild();
    }
  };
  const approveBuild = async () => {
    if (!liveBuild || !project?.id || buildDecisionBusy || !can('approve_runs')) return;
    setBuildDecisionBusy('approve');
    setBuildDecisionError(null);
    try {
      const result = await apiService.approveOrchestration(project.id, liveBuild.runId, liveBuild.revision);
      const publication = result.publication;
      if (publication?.pullRequestUrl) {
        setPublishedBuild({ projectId: project.id, links: [{ repository: publication.repository ?? liveBuild.repository, url: publication.pullRequestUrl }] });
      }
      showToast('Pull request ready', 'The checked branch was pushed and its pull request is open for review.', 'success');
    } catch (error: any) {
      setBuildDecisionError(error?.message ?? 'The pull request could not be opened. Check the build and try again.');
    } finally {
      setBuildDecisionBusy(null);
      void refreshLiveBuild();
    }
  };
  const selectCall = (callId: string | null) => {
    if (callId) openSideTab({ id: 'call:' + callId, kind: 'call', callId });
    else if (activeSideTab?.kind === 'call') closeSideTab(activeSideTab.id);
  };
  const selectBuildAgent = (agentId: string | null) => {
    const selected = workspaceAgents.find(agent => agent.id === agentId);
    if (selected && (selected.templateKey === 'orchestrator' || /orchestrator/i.test(selected.role)) && latestBuild) { openBuildReview(); return; }
    if (agentId) openSideTab({ id: 'agent:' + agentId, kind: 'agent', agentId });
    else if (activeSideTab?.kind === 'agent') closeSideTab(activeSideTab.id);
  };

  useEffect(() => {
    if (isClient || !activeThreadId || !isActiveTab) {
      setChatSyncStatus(null);
      return undefined;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await apiService.getChatSyncStatus(activeThreadId);
        if (!cancelled) setChatSyncStatus(status);
      } catch {
        if (!cancelled) setChatSyncStatus(null);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeThreadId, isActiveTab, isClient]);
  const pmName = users.find(user => user.role === 'pm')?.name ?? 'your project manager';
  const projectRepositories = snapshot?.project.repositories ?? [];
  const repositorySignature = projectRepositories.map(item => `${item.repo}:${item.connected ? '1' : '0'}`).join('|');
  const validBuildRepositories = selectedBuildRepositories.filter(repo => projectRepositories.some(item => item.repo === repo));
  const selectedBuildRepositoryLabel = validBuildRepositories.length === projectRepositories.length && projectRepositories.length > 1
    ? `All ${validBuildRepositories.length} codebases`
    : validBuildRepositories.length > 1 ? `${validBuildRepositories.length} codebases selected`
      : validBuildRepositories[0];
  const forcedBuild = /^\/build(?:\s|$)/i.test(input.trim());
  const requiresRepositorySelection = projectRepositories.length === 0 || validBuildRepositories.length === 0;
  const repositorySelectionMessage = projectRepositories.length === 0
    ? 'Connect a repository before building.'
    : validBuildRepositories.length > 1
      ? `One coordinated product build across ${validBuildRepositories.length} codebases.`
      : 'Choose every codebase this product needs; the Orchestrator will coordinate them in one build.';

  useEffect(() => {
    if (!repositorySignature) {
      setSelectedBuildRepositories([]);
      return;
    }
    setSelectedBuildRepositories(current => {
      const selected = Array.isArray(current) ? current : typeof current === 'string' && current ? [current] : [];
      const available = selected.filter(repo => projectRepositories.some(item => item.repo === repo));
      // A product may span a frontend and backend codebase. Select every
      // attached repository on first use; users can narrow it from the menu.
      return available.length ? available : projectRepositories.map(item => item.repo);
    });
  }, [repositorySignature, setSelectedBuildRepositories]);

  useEffect(() => {
    if (!repositoryMenuOpen) return undefined;
    const closeWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !repositoryMenuRef.current?.contains(event.target)) setRepositoryMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRepositoryMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [repositoryMenuOpen]);

  const callList = useMemo(
    () => Object.values(calls).filter(call => call.threadId === activeThreadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [calls, activeThreadId]
  );
  const highlightedCall = callList[0];
  const inspectedCall = inspectedCallId ? calls[inspectedCallId] : undefined;

  const activeCall = callList.find(call => ['queued', 'running', 'awaiting_confirmation'].includes(call.status));
  const activeChatTurnCall = callList.find(call => call.origin === 'chat_turn' && ['queued', 'running'].includes(call.status));
  const latestUserMessage = [...currentMessages].reverse().find(message => message.senderType === 'user');
  const activeTurnMessageId = activeChatTurnCall?.messageId
    ?? (isAgentTyping && !/^\/build(?:\s|$)/i.test(latestUserMessage?.content.trim() ?? '') ? latestUserMessage?.id : undefined);
  const mentionSuggestions = useMemo(() => {
    if (!mentionQuery || isClient || activeTurnMessageId) return [];
    const query = mentionQuery.query.trim().toLowerCase();
    return (snapshot?.agents ?? [])
      .filter(agent => !query || `${agent.name} ${agent.role}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [activeTurnMessageId, isClient, mentionQuery, snapshot?.agents]);
  useEffect(() => {
    const views = pendingFiles.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));
    setPendingFileViews(views);
    return () => views.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  }, [pendingFiles]);

  useEffect(() => setPendingFiles([]), [activeThread?.id]);

  useEffect(() => {
    callsRef.current = calls;
  }, [calls]);

  const { transcriptRef, onScroll, showLatest, jumpToLatest, followNextMessage } = useTranscriptScroll(
    activeThreadId, `${currentMessages.length}:${currentMessages.at(-1)?.content}:${isAgentTyping}:${highlightedCall?.status}`, isActiveTab
  );

  useEffect(() => {
    if (isActiveTab && activeThreadId) setActiveThreadId(activeThreadId);
  }, [activeThreadId, isActiveTab, setActiveThreadId]);

  useEffect(() => {
    setMentionQuery(null);
    setActiveMentionIndex(0);
  }, [activeThreadId]);

  useEffect(() => {
    if (!isActiveTab) return undefined;
    let cancelled = false;
    setSnapshot(null);
    setCalls({});

    if (isClient || !activeThread?.projectId) return undefined;
    Promise.all([
      apiService.getProjectChatAgents(activeThread.projectId),
      apiService.getThreadAgentCalls(activeThread.projectId, activeThread.id)
    ]).then(([nextSnapshot, nextCalls]) => {
      if (cancelled) return;
      setSnapshot(nextSnapshot);
      setCalls(Object.fromEntries(nextCalls.calls.map(call => [call.id, call])));

    }).catch(() => {
      // The transcript remains usable while project activity access is unavailable.
    });

    return () => { cancelled = true; };
  }, [activeChatAgentId, activeThread?.id, activeThread?.projectId, isActiveTab, isClient]);


  useEffect(() => {
    if (!isActiveTab) return undefined;
    const projectId = activeThread?.projectId;
    const threadId = activeThread?.id;
    if (isClient || !projectId || !threadId) return undefined;

    let disposed = false;
    const requests = new Map<string, number>();
    const updateFromSocket = (payload: Partial<AgentCall> & Pick<AgentCall, 'id'>) => {
      if (!payload?.id) return;
      const existing = callsRef.current[payload.id];
      if ((!existing && payload.threadId !== threadId) || (existing && existing.threadId !== threadId)) return;
      const sequence = (requests.get(payload.id) ?? 0) + 1;
      requests.set(payload.id, sequence);
      // Socket frames are notifications. Fetch current, authorized state instead of trusting a late started frame.
      void apiService.getAgentCall(payload.id).then(result => {
        if (disposed || requests.get(payload.id) !== sequence || result.call.threadId !== threadId) return;
        acceptCallSnapshot(result.call, threadId);
        if (['completed', 'failed', 'cancelled'].includes(result.call.status) || result.call.activities?.some(activity => activity.kind === 'file_change' && activity.message === 'Proposed patch applied to the project working copy')) {
          void refreshChatThread(threadId);
        }
      }).catch(() => undefined);
    };
    const eventNames = [
      'agent_call.created',
      'agent_call.queued',
      'agent_call.started',
      'agent_call.activity',
      'agent_call.completed',
      'agent_call.failed',
      'agent_call.cancelled'
    ];
    const unsubscribers = eventNames.map(eventName => runnerSocket.on(eventName, payload => updateFromSocket(payload)));
    return () => { disposed = true; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [activeThread?.id, activeThread?.projectId, isActiveTab, isClient, refreshChatThread]);

  useEffect(() => {
    if (!isActiveTab) return undefined;
    const projectId = activeThread?.projectId;
    const threadId = activeThread?.id;
    if (isClient || !projectId || !threadId || !activeCall) return undefined;

    let cancelled = false;
    const syncCall = async () => {
      try {
        const result = await apiService.getAgentCall(activeCall.id);
        if (cancelled) return;
        acceptCallSnapshot(result.call, threadId);
        if (['completed', 'failed', 'cancelled'].includes(result.call.status)) {
          await refreshChatThread(threadId);
        }
      } catch {
        // The socket remains the primary path; polling recovers missed frames.
      }
    };
    const timer = window.setInterval(() => void syncCall(), 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeCall?.id, activeCall?.status, activeThread?.id, activeThread?.projectId, isActiveTab, isClient, refreshChatThread]);

  useEffect(() => {
    if (!isActiveTab || isClient || !activeThread?.projectId || !activeThread.id || (!isAgentTyping && !activeChatTurnCall)) return undefined;
    let cancelled = false;
    const refreshTurnActivity = async () => {
      try {
        const result = await apiService.getThreadAgentCalls(activeThread.projectId!, activeThread.id);
        if (cancelled) return;
        result.calls.forEach(call => acceptCallSnapshot(call, activeThread.id));
      } catch {
        // Live room updates may be delayed while workspace access refreshes.
      }
    };
    void refreshTurnActivity();
    const timer = window.setInterval(() => void refreshTurnActivity(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeChatTurnCall?.id, activeChatTurnCall?.status, activeThread?.id, activeThread?.projectId, isActiveTab, isAgentTyping, isClient]);

  const confirmCall = async (call: AgentCall) => {
    setBusyCallId(call.id);
    try {
      const result = await apiService.confirmAgentCall(call.id);
      setCalls(prev => ({ ...prev, [call.id]: result.call }));
      if (activeThread) await refreshChatThread(activeThread.id);
    } catch (error: any) {
      showToast('Confirmation failed', error?.message ?? 'The call could not be confirmed.', 'error');
    } finally {
      setBusyCallId(null);
    }
  };

  const applyPatch = async (call: AgentCall) => {
    const patch = call.artifacts.find(artifact => artifact.artifactType === 'patch')?.content;
    if (!patch || !window.confirm('Apply this proposed patch to the project working copy? Review the diff first.')) return;
    setBusyCallId(call.id);
    try {
      const result = await apiService.applyAgentCallPatch(call.id);
      setCalls(prev => ({ ...prev, [call.id]: result.call }));
      if (activeThread) await refreshChatThread(activeThread.id);
      showToast('Patch applied', 'The working copy changed. Review the diff before committing.', 'success');
    } catch (error: any) {
      showToast('Patch not applied', error?.message ?? 'The patch was rejected by the working copy.', 'error');
    } finally {
      setBusyCallId(null);
    }
  };

  const retryCall = async (call: AgentCall) => {
    setBusyCallId(call.id);
    try {
      const result = await apiService.retryAgentCall(call.id);
      setCalls(prev => ({ ...prev, [call.id]: result.call }));
      if (activeThread) await refreshChatThread(activeThread.id);
    } catch (error: any) {
      showToast('Retry failed', error?.message ?? 'The call could not be retried.', 'error');
    } finally {
      setBusyCallId(null);
    }
  };

  const followUpCall = async (call: AgentCall) => {
    const instruction = window.prompt('Follow up with this agent:', 'Please go deeper on the highest-priority finding.')?.trim();
    if (!instruction) return;
    setBusyCallId(call.id);
    try {
      const result = await apiService.followUpAgentCall(call.id, instruction);
      setCalls(prev => ({ ...prev, [result.call.id]: result.call }));
      if (activeThread) await refreshChatThread(activeThread.id);
    } catch (error: any) {
      showToast('Follow-up failed', error?.message ?? 'The follow-up could not be created.', 'error');
    } finally {
      setBusyCallId(null);
    }
  };

  const copyResponse = async (call: AgentCall, message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedCallId(call.id);
      window.setTimeout(() => setCopiedCallId(null), 1500);
    } catch {
      showToast('Copy unavailable', 'Your browser did not allow clipboard access.', 'info');
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    const accepted: File[] = [];
    let oversized = 0;
    let limitReached = false;
    for (const file of incoming) {
      if (file.size > MAX_CHAT_FILE_BYTES) { oversized += 1; continue; }
      if (pendingFiles.length + accepted.length >= MAX_CHAT_FILES) { limitReached = true; break; }
      if (!pendingFiles.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)
        && !accepted.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) accepted.push(file);
    }
    if (accepted.length) setPendingFiles(current => [...current, ...accepted]);
    if (oversized) showToast('Some files are too large', `${oversized} file(s) exceeded the 10 MB limit.`, 'info');
    if (limitReached) showToast('Attachment limit reached', `Attach up to ${MAX_CHAT_FILES} files to one message.`, 'info');
  };

  const removePendingFile = (index: number) => setPendingFiles(current => current.filter((_, fileIndex) => fileIndex !== index));

  const stopChatTurn = async () => {
    if (!activeThread?.id || !activeTurnMessageId || chatTurnActionBusy) return;
    setChatTurnActionBusy(true);
    try {
      await apiService.stopChatTurn(activeThread.id, activeTurnMessageId);
      showToast('Stopping response', 'Alpha is waiting for the current tool to stop before ending this turn.', 'info');
    } catch (error: any) {
      showToast('Could not stop response', error?.message ?? 'This chat turn could not be stopped.', 'error');
    } finally {
      setChatTurnActionBusy(false);
    }
  };

  /** With `optional`, a message the open recovery cannot take returns false so it goes to Alpha's chat instead. */
  const proposeSecurityAuditPlan = async (): Promise<boolean> => {
    if (!liveBuild || !project || !liveBuild.canControl || !can('run_builds')) return false;
    setBuildDecisionBusy('continue'); setBuildDecisionError(null);
    try {
      const next = await apiService.proposeSecurityAuditPlan(project.id, liveBuild.runId, liveBuild.revision);
      await refreshLiveBuild();
      openPlanTab({ projectId: project.id, runId: liveBuild.runId, planVersion: next.planVersion, auto: false });
      showToast('Security audit plan ready', 'Review the revised Markdown plan before starting work.', 'success');
    } catch (error) {
      setBuildDecisionError(error instanceof Error ? error.message : 'The Orchestrator could not prepare the audit plan.');
    } finally { setBuildDecisionBusy(null); }
    return true;
  };

  const dispatchRecoveryFollowUp = async (message: string, requestedAction: LiveBuildRecoveryAction, optional = false): Promise<boolean> => {
    if (needsSecurityAuditPlan(liveBuild) && requestedAction === 'repair_and_continue' && isExplicitBuildRetry(message)) return proposeSecurityAuditPlan();
    if (!activeThread?.id || !activeThread.projectId) return false;
    const explicitBuildRetry = isExplicitBuildRetry(message);
    // This conversation's build messages and the live build filtered to this thread.
    const runIds = [...new Set([
      ...currentMessages.filter(item => item.messageType === 'build' && item.orchestrationRunId).map(item => item.orchestrationRunId!),
      ...(liveBuild ? [liveBuild.runId] : [])
    ])];
    if (!runIds.length) {
      const requestedRetry = explicitBuildRetry || requestedAction === 'retry_report_format';
      if (requestedRetry) showToast('No build to retry', 'Start a build with Build with Orchestrator, or open the build you want to continue.', 'info');
      return requestedRetry;
    }

    const states = await Promise.all(runIds.map(async runId => {
      try {
        return { runId, state: await apiService.getOrchestrationRecovery(activeThread.projectId!, runId) };
      } catch {
        return { runId, state: undefined };
      }
    }));
    const activeStates = states.filter(item => item.state?.recovery);
    if (activeStates.length > 1) {
      showToast('Choose a build first', 'More than one build is waiting for a decision. Use the recovery controls under the build you mean.', 'info');
      return true;
    }
    const selected = activeStates[0] ?? (runIds.length === 1
      ? states.find(item => item.state?.history.length)
      : undefined);
    if (!selected?.state) {
      if (states.some(item => !item.state)) {
        showToast('Recovery details unavailable', 'Refresh the Build review tab to load this build’s recovery controls.', 'error');
        return true;
      }
      if (explicitBuildRetry && runIds.length > 1) {
        showToast('Choose a build first', 'This conversation has more than one saved build. Open the one you want to retry so Alpha uses the right work and history.', 'info');
        return true;
      }
      return false;
    }
    const recovery = selected.state.recovery ?? (requestedAction === 'explain_failure' || requestedAction === 'review_saved_changes'
      ? selected.state.history[0]
      : undefined);
    if (!recovery) {
      if (optional) return false;
      showToast('No open recovery', 'This build has no saved recovery waiting for an action. Open the Build review tab to review its current status.', 'info');
      return true;
    }

    const action = resolveRecoveryAction(requestedAction, recovery);
    if (!recovery.availableActions.includes(action)) {
      if (optional) return false;
      const reason = recovery.actionReasons[action]
        ?? recovery.actionReasons.provide_guidance
        ?? Object.values(recovery.actionReasons).find(value => typeof value === 'string' && value.trim())
        ?? 'This build has no eligible retry in its current state. Review the recovery panel for the saved failure and next available action.';
      showToast('That recovery action is unavailable', reason, 'info');
      return true;
    }

    try {
      const result = await apiService.performOrchestrationRecoveryAction(activeThread.projectId, selected.runId, {
        recoveryId: recovery.id,
        expectedRunRevision: selected.state.runRevision,
        expectedRecoveryRevision: recovery.revision,
        expectedTaskRevision: recovery.taskRevision,
        idempotencyKey: recoveryActionKey(),
        action,
        guidance: action === 'provide_guidance' || action === 'repair_and_continue' ? message : undefined,
        // Only the conversation that started the build may name itself; for a build started
        // in another chat of this project the server attributes the action without a thread,
        // as the Live Build Room does. Naming this chat made every action fail as "not
        // attached to your project conversation".
        threadId: currentMessages.some(item => item.orchestrationRunId === selected.runId) ? activeThread.id : undefined
      });
      setInput('');
      if (activeThread.id) await refreshChatThread(activeThread.id);
      followNextMessage();
      if (action === 'review_saved_changes') openSavedBuildReview(selected.runId);
      showToast(action === 'explain_failure' ? 'Build explanation' : 'Build recovery updated',
        result.explanation ?? result.message ?? 'Alpha saved the recovery action.',
        action === 'explain_failure' ? 'info' : 'success');
      return true;
    } catch (error: any) {
      showToast('Recovery action not completed', error?.message ?? 'Refresh the build and try again.', 'error');
      return true;
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const typedMessage = input.trim();
    if (activeTurnMessageId) {
      if (!typedMessage || !activeThread?.id || chatTurnActionBusy) return;
      setChatTurnActionBusy(true);
      try {
        const result = await apiService.steerChatTurn(activeThread.id, activeTurnMessageId, typedMessage);
        setInput('');
        showToast('Direction queued', `Alpha will apply it at the next safe point in this turn (direction ${result.position}).`, 'success');
      } catch (error: any) {
        showToast('Direction not queued', error?.message ?? 'Alpha could not accept this direction.', 'error');
      } finally {
        setChatTurnActionBusy(false);
      }
      return;
    }
    if (isAgentTyping) return;
    const sendsBuild = /^\/build(?:\s|$)/i.test(typedMessage);
    const message = typedMessage || (pendingFiles.length && !sendsBuild
      ? 'Please inspect the attached files and summarize the relevant information.'
      : '');
    if (!message) return;
    // "Continue", "go ahead", "keep going": carry the open build to its next step.
    const continueRequest = !sendsBuild && Boolean(liveBuild) && isContinueRequest(message);
    if (continueRequest && liveBuild?.status === 'awaiting_plan_approval') {
      if (!liveBuild.canControl || !can('run_builds')) {
        showToast('Build access needed', 'Your workspace role cannot start builds.', 'info');
        return;
      }
      setInput('');
      await startPlannedBuild();
      return;
    }
    if (continueRequest && liveBuild?.status === 'paused') {
      setInput('');
      await resumePausedBuild();
      return;
    }
    const requestedRecoveryAction = inferRecoveryAction(message)
      ?? ((continueRequest || isRetryRequest(message)) && !sendsBuild && liveBuild && ['blocked', 'recovery_required'].includes(liveBuild.status) ? 'repair_and_continue' : undefined);
    if (requestedRecoveryAction && await dispatchRecoveryFollowUp(message, requestedRecoveryAction)) return;
    // A build waiting for direction takes an instruction typed here as its answer.
    if (!requestedRecoveryAction && !sendsBuild && liveBuild && ['blocked', 'recovery_required'].includes(liveBuild.status) &&
        isBuildDirection(message) && await dispatchRecoveryFollowUp(message, 'repair_and_continue', true)) return;
    if (sendsBuild && !can('run_agents')) {
      showToast('Build access needed', 'Your workspace role cannot start Orchestrator builds.', 'info');
      return;
    }
    if (sendsBuild && projectRepositories.length === 0) {
      showToast('Connect a repository', 'Attach a repository to this project before starting an Orchestrator build.', 'info');
      return;
    }
    if (sendsBuild && requiresRepositorySelection) {
      setRepositoryMenuOpen(true);
      showToast('Choose a codebase', 'Select at least one project codebase for the Orchestrator to build.', 'info');
      return;
    }
    if (sendsBuild && buildIsOpen) {
      showToast('Build already open', liveBuild?.status === 'awaiting_plan_approval'
        ? 'A build plan is waiting for your approval. Review it, or stop it before starting another build.'
        : 'Stop the current build or wait for it to finish before starting another one.', 'info');
      return;
    }
    followNextMessage();
    setInput('');
    setMentionQuery(null);
    const buildRepositories = validBuildRepositories;
    const uploadedAttachments: ChatAttachmentReference[] = [];
    try {
      if (pendingFiles.length && !activeThread?.id) throw new Error('Open or create a conversation before attaching files.');
      for (const file of pendingFiles) {
        const result = await apiService.uploadChatAttachment(activeThread!.id, file);
        uploadedAttachments.push(result.attachment);
      }
    } catch (error: any) {
      if (activeThread?.id && uploadedAttachments.length) {
        await Promise.allSettled(uploadedAttachments.map(item => apiService.deleteChatAttachment(activeThread.id, item.id)));
      }
      showToast('Attachments not sent', error?.message ?? 'Alpha could not save the selected files locally.', 'error');
      setInput(typedMessage);
      return;
    }
    setPendingFiles([]);
    // A handed-off task travels with the message: the agent gets its details, and the
    // issue id links any build back to this task instead of filing a new one.
    const handedOff = taskRef;
    if (handedOff) setTaskRefId(null);
    await sendChatMessage(
      handedOff ? `${message}\n\n${taskHandoffContext(handedOff)}` : message,
      activeThread?.id,
      buildRepositories,
      'auto',
      uploadedAttachments,
      handedOff ? { approvalMode, issueId: handedOff.id, projectId: handedOff.projectId } : { approvalMode }
    );
    if (activeThread?.id) {
      void apiService.getChatSyncStatus(activeThread.id).then(setChatSyncStatus).catch(() => undefined);
    }
  };

  const stopProjectBuild = async () => {
    const orchestrationRunId = liveBuild && liveBuild.status !== 'cancelling' ? liveBuild.runId : null;
    if (!orchestrationRunId || stoppingProjectRunId || !project?.id) return;
    if (!window.confirm(liveBuild?.status === 'awaiting_plan_approval'
      ? 'Stop this build plan? No agents have started, and the plan will not run.'
      : 'Stop the current build? Running agents stop at the next safe point. Work already saved on the build branch stays available.')) return;
    setStoppingProjectRunId('all');
    try {
      const results = await Promise.allSettled([
        apiService.cancelOrchestration(project.id, orchestrationRunId)
      ]);
      const stoppedCount = results.filter(result => result.status === 'fulfilled').length;
      if (stoppedCount === 1) {
        showToast('Build stopped', 'The agents are stopping. Work already on the build branch remains available for review.', 'success');
      } else {
        const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        showToast(stoppedCount ? 'Some builds could not be stopped' : 'Could not stop build', failure?.reason?.message ?? 'Check the Build review tab for current status.', 'error');
      }
    } finally {
      setStoppingProjectRunId(null);
      void refreshLiveBuild();
    }
  };

  /**
   * The last planning attempt in this conversation that ended before a build
   * existed, unless the person has since sent something else or closed it.
   */
  const buildFailure = useMemo<BuildPlanningFailure | null>(() => {
    if (isClient || liveBuild) return null;
    for (let index = currentMessages.length - 1; index >= 0; index -= 1) {
      const message = currentMessages[index];
      if (message.senderType === 'user') return null;
      if (message.messageType !== 'build' || !/\*\*Build not started(?: for any repository)?\.\*\*/i.test(message.content)) continue;
      if (dismissedBuildFailures.includes(message.id)) return null;
      // Replan the goal the planner actually received; the user's words may only say "do that".
      const earlier = currentMessages.slice(0, index);
      const words = [...earlier].reverse().find(item => item.senderType === 'user')?.content;
      // Older build replies carry no goal; a retry of the same words reuses the goal accepted for them.
      const accepted = message.routeProposal ?? [...earlier].reverse().find(item =>
        item.routeProposal?.status === 'accepted' && item.routeProposal.goal &&
        earlier.find(source => source.id === item.routeProposal!.sourceMessageId)?.content === words)?.routeProposal;
      const request = accepted?.goal || words;
      return { messageId: message.id, reason: planningFailureReason(message.content), request, repositories: accepted?.repositories };
    }
    return null;
  }, [currentMessages, dismissedBuildFailures, isClient, liveBuild]);

  const dismissBuildFailure = () => {
    if (buildFailure) setDismissedBuildFailures(previous => [...previous.slice(-19), buildFailure.messageId]);
  };
  const replyInComposer = (prefill?: string) => {
    if (prefill) setInput(prefill);
    window.requestAnimationFrame(() => messageInputRef.current?.focus());
  };
  const continueBuild = async (action: LiveBuildRecoveryAction = 'repair_and_continue') => {
    if (!liveBuild || buildDecisionBusy) return;
    if (needsSecurityAuditPlan(liveBuild)) { await proposeSecurityAuditPlan(); return; }
    if (liveBuild.status === 'paused' || (liveBuild.status === 'blocked' && /^(Milestone planning stopped|Plan document could not be saved) before dispatch:/.test(liveBuild.orchestration.run.stoppedReason ?? ''))) {
      setBuildDecisionBusy('continue');
      try { await resumePausedBuild(); } finally { setBuildDecisionBusy(null); }
      return;
    }
    setBuildDecisionBusy('continue');
    try {
      if (!await dispatchRecoveryFollowUp('continue', action)) {
        showToast('Nothing to continue', 'Open the build to see what it is waiting for.', 'info');
      }
    } finally {
      setBuildDecisionBusy(null);
      void refreshLiveBuild();
    }
  };
  const retryPlanning = async () => {
    if (!buildFailure?.request || !activeThread?.id || buildDecisionBusy) return;
    setBuildDecisionBusy('retry');
    try {
      dismissBuildFailure();
      followNextMessage();
      const repositories = buildFailure.repositories?.length ? buildFailure.repositories : validBuildRepositories;
      await sendChatMessage(buildFailure.request, activeThread.id, repositories, 'build', [], { approvalMode });
    } finally {
      setBuildDecisionBusy(null);
    }
  };

  const handleRetryChatSync = async () => {
    if (!activeThread?.id || syncRetrying) return;
    setSyncRetrying(true);
    try {
      await apiService.retryChatSync(activeThread.id);
      setChatSyncStatus(await apiService.getChatSyncStatus(activeThread.id));
    } catch (error: any) {
      showToast('Sync retry unavailable', error?.message || 'The conversation could not be queued for sync.', 'error');
    } finally {
      setSyncRetrying(false);
    }
  };



  const canRouteBuild = !isClient && can('run_agents');
  /** The user message a reply answers: the proposal's source, else the nearest earlier user message. */
  const sourceMessageIdFor = (message: ChatMessage): string | undefined => {
    if (message.routeProposal?.sourceMessageId) return message.routeProposal.sourceMessageId;
    const index = currentMessages.findIndex(item => item.id === message.id);
    return currentMessages.slice(0, Math.max(index, 0)).reverse().find(item => item.senderType === 'user')?.id;
  };
  const latestAlphaAnswerId = [...currentMessages].reverse().find(item =>
    item.senderType === 'agent' && !item.agentId && item.senderName === 'Alpha' && !item.isStreaming &&
    (!item.messageType || item.messageType === 'agent' || item.messageType === 'assistant'))?.id;

  /** Plan a message as a build, or have Alpha answer it instead. */
  const routeChatMessage = async (sourceMessageId: string, action: 'build' | 'answer') => {
    if (!activeThread || routingMessageId) return;
    setRoutingMessageId(sourceMessageId);
    try {
      await apiService.routeChatMessage(activeThread.id, sourceMessageId, {
        action,
        repositories: validBuildRepositories.length ? validBuildRepositories : undefined,
        projectId: activeThread.projectId
      });
      await refreshChatThread(activeThread.id);
    } catch (error: any) {
      showToast(
        action === 'build' ? 'Build not planned' : 'Answer not started',
        error?.message ?? 'Alpha could not update how this message is handled.',
        'error'
      );
    } finally {
      setRoutingMessageId(null);
    }
  };

  const renderRouteProposal = (message: ChatMessage) => {
    const proposal = message.routeProposal;
    const needsProject = message.messageType === 'project_needed';
    const source = sourceMessageIdFor(message);
    const busy = Boolean(source && routingMessageId === source);
    const open = proposal?.status === 'open' && Boolean(source);
    const blockedReason = !canRouteBuild ? 'Your workspace role cannot start builds.' : !project ? 'Choose a project in the header first.' : undefined;
    return <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-link"><Sparkles className="h-3.5 w-3.5" /> {needsProject ? 'Project needed' : 'Build proposal'}</div>
      <MessageMarkdown content={message.content} />
      {proposal?.goal && <div className="rounded-lg border border-divider bg-well px-3 py-2 text-xs text-content-secondary"><span className="text-content-muted">Proposed change: </span>{proposal.goal}</div>}
      {open ? <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void routeChatMessage(source!, 'build')} disabled={Boolean(routingMessageId) || Boolean(blockedReason)} title={blockedReason} className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 text-[11px] font-semibold text-on-action hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}Plan this build</button>
        <button type="button" onClick={() => void routeChatMessage(source!, 'answer')} disabled={Boolean(routingMessageId)} className="inline-flex items-center gap-1.5 rounded-lg border border-divider px-3 py-1.5 text-[11px] font-medium text-content hover:bg-surface-high disabled:opacity-40"><MessageSquare className="h-3 w-3" />Just answer</button>
        {blockedReason && <span className="text-[10px] text-status-warning">{blockedReason}</span>}
      </div> : proposal && <div className="text-[10px] text-content-muted">{proposal.status === 'accepted' ? 'Sent to the Orchestrator.' : 'Answered instead.'}</div>}
    </div>;
  };

  /** A quiet way to turn Alpha's latest answer into a build. */
  const renderBuildInstead = (message: ChatMessage) => {
    if (!canRouteBuild || !project || message.id !== latestAlphaAnswerId) return null;
    const source = sourceMessageIdFor(message);
    if (!source || currentMessages.some(item => item.id === source + '-build')) return null;
    return <button type="button" onClick={() => void routeChatMessage(source, 'build')} disabled={Boolean(routingMessageId)} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-content-muted hover:text-link-hover disabled:opacity-50">{routingMessageId === source ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}Build this instead</button>;
  };


  const openSavedBuildReview = (runId: string) => {
    if (!activeThread?.projectId) return;
    openSideTab({ id: 'review:' + runId, kind: 'review', projectId: activeThread.projectId, runId });
  };

  const updateMessageInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setInput(next);
    const nextMention = getMentionQueryAtCursor(next, event.target.selectionStart ?? next.length);
    setMentionQuery(nextMention);
    if (nextMention) setActiveMentionIndex(0);
  };

  const insertAgentMention = (agent: ProjectChatAgent) => {
    if (!mentionQuery) return;
    const agents = snapshot?.agents ?? [];
    const firstName = agent.name.trim().split(/\s+/)[0] ?? agent.name;
    const compactName = agent.name.replace(/\s+/g, '');
    const firstNameIsUnique = agents.filter(item => item.name.trim().split(/\s+/)[0]?.toLowerCase() === firstName.toLowerCase()).length === 1;
    const compactNameIsUnique = agents.filter(item => item.name.replace(/\s+/g, '').toLowerCase() === compactName.toLowerCase()).length === 1;
    const token = /^[a-zA-Z0-9_-]+$/.test(firstName) && firstNameIsUnique
      ? firstName
      : /^[a-zA-Z0-9_-]+$/.test(compactName) && compactNameIsUnique
        ? compactName
        : agent.id;
    const before = input.slice(0, mentionQuery.start);
    const after = input.slice(mentionQuery.end);
    const mention = `@${token}`;
    const replacement = `${mention}${after && !/^\s/.test(after) ? ' ' : after ? '' : ' '}`;
    const next = `${before}${replacement}${after}`;
    const cursor = before.length + replacement.length;
    setInput(next);
    setMentionQuery(null);
    setActiveMentionIndex(0);
    window.requestAnimationFrame(() => {
      const textarea = messageInputRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const handleMessageInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery && mentionSuggestions.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveMentionIndex(index => (index + 1) % mentionSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveMentionIndex(index => (index - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        insertAgentMention(mentionSuggestions[activeMentionIndex] ?? mentionSuggestions[0]);
        return;
      }
    }
    if (event.key === 'Escape' && mentionQuery) {
      event.preventDefault();
      setMentionQuery(null);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const openProjectSetup = () => {
    if (activeThread?.projectId) {
      setTabSessionState(activeTabId, 'projects.selectedProject', activeThread.projectId);
      setTabSessionState(activeTabId, 'projects.boardView', 'repository');
    }
    setActiveTab('projects');
  };

  // Chat starts unscoped; project-specific chats are created from a project folder.
  const assignedProjects = projects.filter(project => project.assigned !== false);
  const chatProjects = useMemo(() => assignedProjects
    .map(project => ({
      project,
      threads: chatThreads.filter(thread => thread.projectId === project.id)
        .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))
    }))
    .sort((a, b) => {
      const aLatest = a.threads[0]?.lastMessageAt ?? '';
      const bLatest = b.threads[0]?.lastMessageAt ?? '';
      return bLatest.localeCompare(aLatest) || a.project.name.localeCompare(b.project.name);
    }), [assignedProjects, chatThreads]);
  const recentThreads = chatThreads
    .filter(thread => !thread.projectId || !assignedProjects.some(project => project.id === thread.projectId))
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  const visibleProjects = showAllProjects ? chatProjects : chatProjects.slice(0, 6);
  useEffect(() => {
    const projectId = activeThread?.projectId;
    if (projectId && assignedProjects.some(project => project.id === projectId)) {
      setExpandedProjectIds(current => current.includes(projectId) ? current : [...current, projectId]);
    }
  }, [activeThread?.projectId, projects]);
  const canStartThread = isClient || can('manage_chat');

  useEffect(() => {
    if (!memoryThreadId) {
      setMemoryContent('');
      setMemoryError(null);
      setMemoryLoading(false);
      return undefined;
    }
    let cancelled = false;
    setMemoryLoading(true);
    setMemoryError(null);
    apiService.getChatThreadMemory(memoryThreadId).then(memory => {
      if (!cancelled) setMemoryContent(memory.content);
    }).catch((error: any) => {
      if (!cancelled) setMemoryError(error?.message ?? 'Could not load this chat\'s memory.');
    }).finally(() => {
      if (!cancelled) setMemoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [memoryThreadId]);

  const saveSessionMemory = async () => {
    if (!memoryThreadId) return;
    setMemoryBusy(true);
    setMemoryError(null);
    try {
      const saved = await apiService.saveChatThreadMemory(memoryThreadId, memoryContent);
      setMemoryContent(saved.content);
      showToast('Session memory saved', 'These notes will be used only in this conversation.', 'success');
    } catch (error: any) {
      setMemoryError(error?.message ?? 'Could not save this chat\'s memory.');
    } finally {
      setMemoryBusy(false);
    }
  };

  const clearSessionMemory = async () => {
    if (!memoryThreadId) return;
    setMemoryBusy(true);
    setMemoryError(null);
    try {
      await apiService.clearChatThreadMemory(memoryThreadId);
      setMemoryContent('');
      showToast('Session memory cleared', 'This conversation will start with no saved notes.', 'success');
    } catch (error: any) {
      setMemoryError(error?.message ?? 'Could not clear this chat\'s memory.');
    } finally {
      setMemoryBusy(false);
    }
  };

  // A new chat is a draft until its first message, and is connected to no project until one is picked.
  const [draftProjectChoice, setDraftProjectChoice] = useTabSessionState<string>('chat.session.draft.projectId', '');
  const draftProjectId = draftProjectChoice && assignedProjects.some(item => item.id === draftProjectChoice) ? draftProjectChoice : null;
  const startDraft = (projectId?: string | null) => {
    setTabSessionState(activeTabId, 'chat.session.draft.draft', '');
    setTabSessionState(activeTabId, 'chat.session.draft.approvalMode', 'ask');
    setTabSessionState(activeTabId, 'chat.session.draft.callInstruction', '');
    setTabSessionState(activeTabId, 'chat.session.draft.dismissedBuildFailures', []);
    setTabSessionState(activeTabId, 'chat.session.draft.selectedAgent', '');
    setTabSessionState(activeTabId, 'chat.session.draft.buildRepositories', []);
    setTabSessionState(activeTabId, 'chat.session.draft.sideTabs', []);
    setTabSessionState(activeTabId, 'chat.session.draft.activeSideTab', null);
    setActiveThreadId(null);
    setDraftProjectChoice(projectId ?? '');
  };
  const sendFromHome = async () => {
    const message = input.trim();
    if (!message) return;
    if (!canStartThread) {
      showToast('Chat unavailable', 'Your workspace role cannot create conversations.', 'info');
      return;
    }
    const threadId = createNewThread(message.slice(0, 32) + (message.length > 32 ? '...' : ''), draftProjectId ?? undefined);
    if (!threadId) return;
    setInput('');
    setDraftProjectChoice('');
    followNextMessage();
    await sendChatMessage(message, threadId, undefined, 'auto', [], { approvalMode });
  };

  const startNewThread = () => {
    if (!canStartThread) {
      showToast('Chat unavailable', 'Your workspace role cannot create conversations.', 'info');
      return;
    }
    if (isClient) createNewThread('New project conversation');
    else startDraft();
  };

  const renderThreadRow = (thread: (typeof chatThreads)[number], nested = false) => {
    const selected = activeThreadId === thread.id;
    const threadProject = projects.find(item => item.id === thread.projectId);
    const rowMenuOpen = openThreadMenuId === thread.id;
    return <div key={thread.id} className="group relative">
      <button type="button" onClick={() => { setActiveThreadId(thread.id); setOpenThreadMenuId(null); }} className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${selected ? 'bg-surface-raised' : 'hover:bg-surface-high'}`}>
        <span className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${thread.messages?.some(message => message.isStreaming) ? 'animate-pulse bg-violet-300' : selected ? 'bg-action' : 'bg-gray-700'}`} /><span className={`min-w-0 flex-1 truncate text-xs font-medium ${selected ? 'text-content' : 'text-content'}`}>{thread.title}</span><span className="shrink-0 text-[10px] text-content-muted">{formatDate(thread.lastMessageAt)}</span></span>
        {thread.lastMessageSnippet && <span className="mt-1 block truncate pl-4 text-[10px] text-content-muted">{thread.lastMessageSnippet}</span>}
        {!nested && thread.projectId && !assignedProjects.some(item => item.id === thread.projectId) && <span className="mt-1 block truncate pl-4 text-[10px] text-content-muted">{threadProject ? threadProject.key + ' · ' + threadProject.name : 'Project chat'}</span>}
      </button>
      {!isClient && <div className="absolute right-1 top-1">
        <button type="button" onClick={() => setOpenThreadMenuId(value => value === thread.id ? null : thread.id)} aria-label={`More options for ${thread.title}`} aria-expanded={rowMenuOpen} className={`rounded-md p-1 text-content-muted hover:bg-surface-high hover:text-content focus:opacity-100 ${rowMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><MoreHorizontal className="h-3.5 w-3.5" /></button>
        {rowMenuOpen && <div ref={threadMenuRef} role="menu" aria-label={`Options for ${thread.title}`} className="absolute right-0 top-full z-50 mt-1 min-w-52 rounded-xl border border-divider bg-surface-raised p-1.5 shadow-xl">
          {isDesktop && <button type="button" role="menuitem" onClick={() => { setOpenThreadMenuId(null); setMemoryThreadId(thread.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-content-secondary hover:bg-surface-high"><Brain className="h-3.5 w-3.5" />Session memory</button>}
          <button type="button" role="menuitem" onClick={() => { setOpenThreadMenuId(null); setThreadPendingDelete({ id: thread.id, title: thread.title }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-status-danger hover:bg-status-danger-subtle"><Trash2 className="h-3.5 w-3.5" />Delete chat</button>
        </div>}
      </div>}
    </div>;
  };

  const agentForCall = (call: AgentCall): ProjectChatAgent | undefined =>
    snapshot?.agents.find(agent => agent.id === call.agentId);

  const renderCallCard = (call: AgentCall, message: ChatMessage) => {
    const agent = agentForCall(call);
    const patch = call.artifacts.find(artifact => artifact.artifactType === 'patch')?.content;
    const expanded = expandedCallPanel[call.id] ?? false;
    const canImplement = can('run_agents');
    return (
      <div className={`rounded-2xl border p-4 space-y-3 ${call.status === 'running' ? 'border-divider bg-selected shadow-[0_0_28px_rgb(var(--ui-accent)/0.13)]' : 'border-divider bg-surface-raised/90'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-on-accent shrink-0" style={{ backgroundColor: agent?.color || '#6d28d9' }}>
              {agent?.avatar ? <img src={agent.avatar} alt="" className="h-9 w-9 rounded-xl object-cover" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold text-content">{agent?.name ?? call.agentId}</span><span className="text-[10px] text-content-muted">{agent?.role ?? 'Project agent'}</span><span className="text-[10px] text-content-muted">·</span><span className="text-[10px] text-content-muted">{formatDate(call.createdAt)}</span></div><div className="flex items-center gap-1.5 text-[10px] text-content-muted mt-0.5"><Users className="h-3 w-3" /><span>{agent?.role ?? 'Project agent'}</span><span>·</span><span>{project?.key ?? call.projectId}</span></div></div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusTone(call.status)}`}>{call.status === 'running' && <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-pulse" />}{call.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}{statusLabel(call.status)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[10px]"><span className="inline-flex items-center gap-1 rounded-md bg-surface-raised border border-divider px-2 py-1 text-content-secondary">{MODE_META[call.operationMode].icon}{MODE_META[call.operationMode].label}</span>{call.revisionTarget && <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised border border-divider px-2 py-1 text-content-secondary"><TargetIcon type={call.revisionTarget.type} />{TARGET_LABELS[call.revisionTarget.type] ?? call.revisionTarget.type}: {call.revisionTarget.label ?? call.revisionTarget.id}</span>}</div>
        <div className="text-sm text-content leading-relaxed prose prose-invert prose-sm max-w-none"><MessageMarkdown content={message.content} /></div>
        {patch && <div className="rounded-xl border border-divider bg-well overflow-hidden"><button type="button" onClick={() => setExpandedDiffs(prev => ({ ...prev, [call.id]: !prev[call.id] }))} className="w-full flex items-center justify-between px-3 py-2 text-left text-xs text-link hover:bg-surface-high"><span className="flex items-center gap-2"><FileCode2 className="h-3.5 w-3.5" /> Proposed patch · review before applying</span>{expandedDiffs[call.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>{expandedDiffs[call.id] && <pre className="max-h-72 overflow-auto border-t border-divider p-3 text-[11px] leading-relaxed text-content-secondary">{patch}</pre>}</div>}
        {(call.error || call.status === 'awaiting_confirmation') && <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${call.status === 'awaiting_confirmation' ? 'bg-status-warning-subtle text-status-warning' : 'bg-status-danger-subtle text-status-danger'}`}>{call.status === 'awaiting_confirmation' ? <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}<span>{call.error || 'No files changed. Confirm the implementation call when you are ready for a proposed patch.'}</span></div>}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {call.status === 'awaiting_confirmation' && canImplement && <button type="button" disabled={busyCallId === call.id} onClick={() => void confirmCall(call)} className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 text-[11px] font-semibold text-on-action hover:bg-action-hover disabled:opacity-50">{busyCallId === call.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}Confirm & generate patch</button>}
          {call.status === 'completed' && patch && canImplement && <button type="button" disabled={busyCallId === call.id} onClick={() => void applyPatch(call)} className="inline-flex items-center gap-1.5 rounded-lg border border-status-success-border bg-status-success-subtle px-3 py-1.5 text-[11px] font-semibold text-status-success hover:bg-status-success-subtle disabled:opacity-50"><Check className="h-3 w-3" /> Apply patch</button>}
          {call.status === 'failed' && <button type="button" disabled={busyCallId === call.id} onClick={() => void retryCall(call)} className="inline-flex items-center gap-1.5 rounded-lg border border-divider px-3 py-1.5 text-[11px] text-content-secondary hover:bg-surface-high disabled:opacity-50"><RefreshCw className="h-3 w-3" /> Retry</button>}
          {call.status === 'completed' && <button type="button" disabled={busyCallId === call.id} onClick={() => void followUpCall(call)} className="inline-flex items-center gap-1.5 rounded-lg border border-divider px-3 py-1.5 text-[11px] text-content-secondary hover:bg-surface-high disabled:opacity-50"><MessageSquare className="h-3 w-3" /> Follow up</button>}
          <button type="button" onClick={() => void copyResponse(call, message)} className="inline-flex items-center gap-1.5 rounded-lg border border-divider px-3 py-1.5 text-[11px] text-content-secondary hover:bg-surface-high">{copiedCallId === call.id ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}{copiedCallId === call.id ? 'Copied' : 'Copy'}</button>
          <button type="button" onClick={() => setExpandedCallPanel(prev => ({ ...prev, [call.id]: !expanded }))} className="ml-auto inline-flex items-center gap-1 text-[10px] text-content-muted hover:text-content-secondary">Details {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</button>
        </div>
        {expanded && <div className="grid grid-cols-2 gap-2 border-t border-divider pt-3 text-[10px] text-content-muted"><span>Call ID <b className="font-mono text-content-secondary">{call.id.slice(-12)}</b></span><span>Requested by <b className="text-content-secondary">{call.requestedBy}</b></span><span>Started <b className="text-content-secondary">{call.startedAt ? new Date(call.startedAt).toLocaleTimeString() : '—'}</b></span><span>Finished <b className="text-content-secondary">{call.completedAt ? new Date(call.completedAt).toLocaleTimeString() : '—'}</b></span></div>}
      </div>
    );
  };




  let stopBuildLabel: string;
  if (stoppingProjectRunId) stopBuildLabel = 'Stopping…';
  else stopBuildLabel = liveBuild?.status === 'awaiting_plan_approval' ? 'Stop plan' : 'Stop build';
  const composerHasContent = Boolean(input.trim()) || pendingFiles.length > 0;
  const composerStop: 'turn' | 'build' | null = composerHasContent ? null : activeTurnMessageId ? 'turn' : canStopBuild ? 'build' : null;

  const buildChangedFiles = liveBuild ? [...new Set(liveBuild.agents.flatMap(agent => agent.changedFiles))] : [];
  const openBuildChanges = () => { if (liveBuild && project) openSideTab({ id: 'changes:' + liveBuild.runId, kind: 'changes', projectId: project.id, runId: liveBuild.runId }); };
  const sideTabMeta = (tab: SideTab): SidePanelTab => {
    switch (tab.kind) {
      case 'preview': return { id: tab.id, title: 'Web preview', icon: <Globe className="h-3.5 w-3.5" />, live: previews.record?.state === 'starting' };
      case 'plan': return { id: tab.id, title: planFileName(tab.planVersion), icon: <FileText className="h-3.5 w-3.5" /> };
      case 'changes': return { id: tab.id, title: 'Code changes', icon: <Code2 className="h-3.5 w-3.5" />, live: Boolean(liveBuild?.running && liveBuild.runId === tab.runId) };
      case 'review': return { id: tab.id, title: 'Build review', icon: <ShieldCheck className="h-3.5 w-3.5" />, live: Boolean(liveBuild?.running && liveBuild.runId === tab.runId) };
      case 'agent': {
        const agent = latestBuild?.agents.find(item => item.agentId === tab.agentId);
        return { id: tab.id, title: agent?.name ?? workspaceAgents.find(item => item.id === tab.agentId)?.name ?? 'Agent', icon: <Bot className="h-3.5 w-3.5" />, live: Boolean(latestBuild?.running && agent?.state === 'running') };
      }
      case 'call': {
        const call = calls[tab.callId];
        return { id: tab.id, title: call ? (isOrchestratorCall(call) ? 'Orchestrator' : agentForCall(call)?.name ?? 'Agent') : 'Agent', icon: <MessageSquare className="h-3.5 w-3.5" />, live: Boolean(call && ['queued', 'running'].includes(call.status)) };
      }
    }
  };
  const renderSideTab = (tab: SideTab): React.ReactNode => {
    switch (tab.kind) {
      case 'preview': return <LocalPreviewTab record={previews.record} repositories={projectRepositories.map(item => item.repo)} busy={previews.busy} error={previews.error} onStart={repo => void previews.start(repo)} onStop={() => void previews.stop()} blocked={Boolean(!isActiveTab || memoryThreadId || threadPendingDelete || showCreateProject || repositoryMenuOpen)} />;
      case 'plan': return <PlanDocumentTab key={tab.id + ':' + tab.planVersion} projectId={tab.projectId} runId={tab.runId} planVersion={tab.planVersion} />;
      case 'review': return latestBuild?.runId === tab.runId
        ? <BuildReviewTab key={tab.id + ':' + latestBuild.revision} projectId={tab.projectId} build={latestBuild} canStart={Boolean(liveBuild?.canControl) && can('run_builds')} canApprove={Boolean(liveBuild) && can('approve_runs')} busy={Boolean(buildDecisionBusy)} error={buildDecisionError} onStart={() => void startPlannedBuild()} onApprove={() => void approveBuild()} />
        : activeThreadId ? <SavedBuildReviewTab key={tab.id} projectId={tab.projectId} runId={tab.runId} threadId={activeThreadId} /> : null;
      case 'changes': return <div key={tab.id} className="min-h-0 flex-1 overflow-y-auto p-4"><LiveChangesView projectId={tab.projectId} runId={tab.runId} live={Boolean(liveBuild?.running && liveBuild.runId === tab.runId)} /></div>;
      case 'agent': {
        const agent = latestBuild?.agents.find(item => item.agentId === tab.agentId);
        if (!agent || !latestBuild || !project) {
          const member = workspaceAgents.find(item => item.id === tab.agentId);
          return <section className="space-y-3 p-5"><h2 className="text-sm font-semibold text-content">{member?.name ?? 'Agent'}</h2><p className="text-xs text-content-secondary">{member?.description ?? member?.role}</p><p className="text-xs text-content-muted">No task is assigned to this agent in this conversation.</p></section>;
        }
        const tasks = latestBuild.orchestration.tasks.filter(task => task.ownerAgentId === agent.agentId);
        const task = tasks.find(item => item.status === 'running' || item.status === 'submitted') ?? tasks[0];
        return <BuildAgentActivityPanel key={tab.id} agent={agent} projectId={project.id} runId={latestBuild.runId} repository={task?.repository ?? latestBuild.repository} onOpenReview={() => openSavedBuildReview(latestBuild.runId)} usage={<WorkUsageRow entries={(usage.snapshot?.entries ?? []).filter(entry => entry.agentId === agent.agentId && entry.orchestrationRunId === latestBuild.runId)} now={usage.now} names={usageNames} />} />;
      }
      case 'call': {
        const call = calls[tab.callId];
        if (!call) return <p className="p-5 text-xs text-content-muted">This agent call is no longer available.</p>;
        return <AgentActivityPanel key={tab.id} call={call} agent={agentForCall(call)} name={isOrchestratorCall(call) ? 'Orchestrator' : undefined} subtitle={isOrchestratorCall(call) ? (project?.name ?? 'Alpha') + ' · Alpha' : undefined} usage={<WorkUsageRow entries={(usage.snapshot?.entries ?? []).filter(entry => entry.callId === call.id)} now={usage.now} names={usageNames} />} />;
      }
    }
  };

  return (
    <PlanPanelContext.Provider value={isClient ? null : openPlanTab}>
    <div className="relative h-full min-h-0 flex overflow-hidden bg-shell text-sm text-content">
      <div className={'relative shrink-0 ' + (threadListCollapsed ? 'w-12' : 'w-72 sm:w-80')}>
      {threadListCollapsed ? <div className="group flex h-full items-center justify-center bg-shell">
        <button type="button" onClick={() => setThreadListCollapsed(false)} aria-label="Show conversations" title="Show conversations" className="flex h-16 w-5 items-center justify-center rounded-full border border-divider bg-surface-raised/90 text-content-secondary opacity-0 shadow-lg shadow-black/40 transition-all duration-200 hover:border-divider hover:text-content group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ChevronRight className="h-3.5 w-3.5" /></button>
      </div> : <aside aria-label="Project conversations" className="relative z-30 flex h-full w-full min-w-0 flex-col border-r border-divider bg-shell">
        <div className="flex items-start justify-between gap-2 border-b border-divider px-4 py-3"><div className="min-w-0"><h2 className="text-base font-semibold text-content">{isClient ? 'Messages' : 'Project chat'}</h2><p className="mt-0.5 truncate text-[10px] text-content-muted">{activeWorkspace?.name ?? 'Workspace'}</p></div><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={startNewThread} aria-label="New chat" title="New chat" className="rounded-lg p-1.5 text-content-secondary hover:bg-surface-high hover:text-content"><Plus className="h-4 w-4" /></button><button type="button" onClick={() => setThreadListCollapsed(true)} aria-label="Collapse conversations" title="Collapse conversations" className="rounded-lg p-1.5 text-content-secondary hover:bg-surface-high hover:text-content"><PanelLeftClose className="h-4 w-4" /></button></div></div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {isClient ? <div className="space-y-1">{chatThreads.map(thread => renderThreadRow(thread))}</div> : <>
            <div className="mb-2 flex items-center justify-between px-2"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Projects</h3>{can('create_project') && <button type="button" onClick={() => setShowCreateProject(true)} aria-label="Create project" title="Create project" className="rounded-md p-1 text-content-secondary hover:bg-surface-high hover:text-content"><Plus className="h-4 w-4" /></button>}</div>
            <div className="space-y-1">{visibleProjects.map(({ project: item, threads }) => {
              const expanded = expandedProjectIds.includes(item.id);
              const more = showMoreThreads[item.id];
              const projectMenuOpen = openProjectMenuId === item.id;
              const visible = more ? threads : threads.slice(0, 5);
              return <section key={item.id}>
                <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-surface-high">
                  <button type="button" aria-expanded={expanded} onClick={() => setExpandedProjectIds(current => expanded ? current.filter(id => id !== item.id) : [...current, item.id])} className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-medium text-content"><ChevronRight className={'h-3.5 w-3.5 shrink-0 text-content-muted transition-transform ' + (expanded ? 'rotate-90' : '')} /><FolderOpen className="h-4 w-4 shrink-0 text-content-secondary" /><span className="truncate">{item.name}</span></button>
                  <button type="button" onClick={() => startDraft(item.id)} aria-label={'New chat in ' + item.name} title="New chat in this project" className="rounded p-1 text-content-muted opacity-0 hover:bg-surface-high hover:text-content group-hover:opacity-100 focus:opacity-100"><Plus className="h-3.5 w-3.5" /></button>
                  <div className="relative"><button type="button" onClick={() => setOpenProjectMenuId(value => value === item.id ? null : item.id)} aria-label={'Options for ' + item.name} aria-expanded={projectMenuOpen} className={'rounded p-1 text-content-muted hover:bg-surface-high hover:text-content focus:opacity-100 ' + (projectMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}><MoreHorizontal className="h-3.5 w-3.5" /></button>
                    {projectMenuOpen && <div role="menu" aria-label={'Options for ' + item.name} className="absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border border-divider bg-surface-raised p-1.5 shadow-xl"><button type="button" role="menuitem" onClick={() => { setOpenProjectMenuId(null); startDraft(item.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-content-secondary hover:bg-surface-high"><Plus className="h-3.5 w-3.5" />New chat</button><button type="button" role="menuitem" onClick={() => { setOpenProjectMenuId(null); setTabSessionState(activeTabId, 'projects.boardView', 'repository'); setActiveTab('projects'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-content-secondary hover:bg-surface-high"><FolderGit2 className="h-3.5 w-3.5" />Open project</button></div>}</div>
                </div>
                {expanded && <div className="ml-3 border-l border-divider pl-2">{threads.length ? <div className="space-y-0.5">{visible.map(thread => renderThreadRow(thread, true))}{threads.length > 5 && <button type="button" onClick={() => setShowMoreThreads(previous => ({ ...previous, [item.id]: !previous[item.id] }))} className="w-full rounded-md px-3 py-1.5 text-left text-[10px] text-content-muted hover:bg-surface-high hover:text-content-secondary">{more ? 'Show less' : 'Show ' + (threads.length - 5) + ' more'}</button>}</div> : <div className="px-3 py-2 text-[10px] text-content-muted">No chats</div>}</div>}
              </section>;
            })}{!chatProjects.length && <div className="px-2 py-3 text-[11px] text-content-muted">No projects assigned yet.</div>}{chatProjects.length > 6 && <button type="button" onClick={() => setShowAllProjects(value => !value)} className="w-full px-2 py-2 text-left text-[11px] text-content-muted hover:text-content-secondary">{showAllProjects ? 'Show fewer projects' : 'Show ' + (chatProjects.length - 6) + ' more projects'}</button>}</div>
            <div className="mb-2 mt-6 px-2"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Recents</h3></div>
            <div className="space-y-1">{recentThreads.map(thread => renderThreadRow(thread))}{!recentThreads.length && <div className="px-2 py-2 text-[10px] text-content-muted">No recent chats</div>}</div>
          </>}
          {!chatThreads.length && <div className="px-3 py-6 text-xs text-content-muted">No conversations yet. Start one with +.</div>}
        </div>
      </aside>}
      </div>
      <CreateProjectModal isOpen={showCreateProject} onClose={() => setShowCreateProject(false)} onCreated={created => { setExpandedProjectIds(current => current.includes(created.id) ? current : [...current, created.id]); startDraft(created.id); }} />
      <Modal
        isOpen={Boolean(threadPendingDelete)}
        onClose={() => setThreadPendingDelete(null)}
        title="Delete chat?"
        subtitle="This permanently removes the conversation and its messages."
        maxWidth="max-w-md"
        footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setThreadPendingDelete(null)} className="rounded-lg px-3 py-2 text-xs text-content-secondary hover:bg-surface-high">Cancel</button><button type="button" onClick={() => { if (threadPendingDelete) deleteThread(threadPendingDelete.id); setThreadPendingDelete(null); }} className="rounded-lg bg-status-danger-subtle px-3 py-2 text-xs font-semibold text-status-danger hover:bg-status-danger-subtle">Delete chat</button></div>}
      >
        <p className="text-sm text-content-secondary">Are you sure you want to delete <span className="font-semibold text-content">{threadPendingDelete?.title}</span>?</p>
      </Modal>
      <Modal
        isOpen={Boolean(memoryThreadId)}
        onClose={() => setMemoryThreadId(null)}
        title="Session memory"
        subtitle="Private notes used only in this chat. Add durable facts or decisions you want Alpha to remember."
        maxWidth="max-w-2xl"
        closeDisabled={memoryBusy}
        footer={<div className="flex items-center justify-between gap-3"><button type="button" onClick={() => void clearSessionMemory()} disabled={memoryBusy || memoryLoading} className="rounded-lg px-3 py-2 text-xs text-status-danger hover:bg-status-danger-subtle disabled:opacity-50">Clear notes</button><div className="flex gap-2"><button type="button" onClick={() => setMemoryThreadId(null)} disabled={memoryBusy} className="rounded-lg px-3 py-2 text-xs text-content-secondary hover:bg-surface-high">Close</button><button type="button" onClick={() => void saveSessionMemory()} disabled={memoryBusy || memoryLoading || memoryContent.length > 6000} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-on-action hover:bg-action-hover disabled:opacity-50">{memoryBusy ? 'Saving…' : 'Save notes'}</button></div></div>}
      >
        <div className="space-y-3">
          <p className="text-xs leading-5 text-content-secondary">These notes stay in this conversation’s local session memory. They are not copied to project, agent, or global memory. Keep secrets and credentials out of notes.</p>
          <textarea value={memoryContent} onChange={event => setMemoryContent(event.target.value)} maxLength={6000} rows={12} disabled={memoryLoading || memoryBusy} aria-label="Session memory notes" placeholder="Example: We chose PostgreSQL, the API must remain backward compatible, and the next step is to add migration tests." className="w-full resize-y rounded-xl border border-control bg-well p-3 text-sm leading-6 text-content outline-none placeholder:text-content-muted focus:border-control disabled:opacity-60" />
          <div className="flex items-center justify-between text-[10px] text-content-muted"><span>{memoryLoading ? 'Loading saved notes…' : 'Notes are added to future turns in this chat.'}</span><span>{memoryContent.length}/6000</span></div>
          {memoryError && <p role="alert" className="rounded-lg border border-status-danger-border bg-status-danger-subtle p-2.5 text-xs text-status-danger">{memoryError}</p>}
        </div>
      </Modal>
      <main className="relative flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden bg-shell">
        {activeThread ? <>
          {!isClient && chatSyncStatus?.state === 'failed' && <div className="shrink-0 px-5 pt-3 lg:px-7"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full border border-status-warning-border bg-status-warning-subtle px-4 py-2 text-[11px] text-status-warning"><span>Chat sync paused</span><button type="button" onClick={() => void handleRetryChatSync()} disabled={syncRetrying} className="font-medium hover:text-content disabled:opacity-50">{syncRetrying ? 'Retrying…' : 'Retry'}</button></div></div>}


          {!isClient && <div className="relative z-20 shrink-0 px-5 pt-2 lg:px-7"><OrchestratorFlow calls={callList} agents={snapshot?.agents ?? []} isWorking={isAgentTyping} title={project?.name ?? 'Alpha'} selectedCallId={inspectedCall ? inspectedCallId : null} onSelectCall={selectCall} build={latestBuild ? { runId: latestBuild.runId, label: buildStatusLabel(latestBuild), running: latestBuild.running, agents: latestBuild.agents, handoffs: buildHandoffs(latestBuild.orchestration) } : null} sidePanelOpen={Boolean(panelVisible)} selectedBuildAgentId={inspectedBuildAgent ? inspectedBuildAgentId : null} onSelectBuildAgent={selectBuildAgent} roster={workspaceAgents} runtimes={runtimes} canEditAgents={can('manage_agents')} onUpdateAgent={updateAgent} /></div>}
          <div ref={transcriptRef} onScroll={onScroll} aria-label="Conversation messages" style={{ paddingBottom: composerHeight + 120 }} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 lg:p-7 [overflow-anchor:none]"><div className={'mx-auto w-full max-w-3xl space-y-5 ' + (currentMessages.length === 0 ? 'h-full' : '')}>{currentMessages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4"><div className="h-12 w-12 rounded-2xl border border-divider bg-selected flex items-center justify-center"><Sparkles className="h-6 w-6 text-link" /></div><div className="space-y-1.5"><h3 className="text-base font-semibold text-content">{isClient ? `Message ${pmName}` : 'Start a project conversation'}</h3><p className="text-xs text-content-muted max-w-md leading-relaxed">{isClient ? `${pmName} manages your project and can help with scope, progress, and timing.` : project ? 'Ask a question or describe a product change. For a change, Alpha plans it as the Orchestrator and waits for your approval before any code changes.' : 'Ask Alpha anything. Choose a project above when you want Alpha to plan a build in its codebases.'}</p></div></div> : currentMessages.map(message => { const isUser = message.senderType === 'user'; const isSystem = message.senderType === 'system'; const call = message.agentCallId ? calls[message.agentCallId] : undefined; const turnCalls = callList.filter(item => item.origin === 'chat_turn' && item.messageId === message.id); const turnIsActive = activeTurnMessageId === message.id; if (message.agentCallId && !isUser && call) return <div key={message.id} className="w-full">{renderCallCard(call, message)}<WorkUsageRow entries={entriesAtMessage(currentMessages, message.id, usage.snapshot?.entries ?? [])} now={usage.now} names={usageNames} /></div>; if (message.agentCallId && !isUser && !call) return <div key={message.id} className="w-full rounded-xl border border-divider bg-surface-raised p-4 text-xs text-content-secondary">Loading agent call details…</div>; if (isSystem) return <div key={message.id} className="flex justify-center"><div className="max-w-2xl rounded-xl border border-divider bg-surface-raised px-4 py-2 text-xs text-content-secondary flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-link" />{message.content}</div></div>; return <div key={message.id} className="w-full"><div className={`min-w-0 space-y-2 ${isUser ? 'flex flex-col items-end' : ''}`}><div className={`text-sm leading-relaxed ${isUser ? 'max-w-[80%] rounded-2xl bg-surface-raised px-4 py-2.5 text-content' : 'text-content'}`}>{message.isStreaming ? <span className="flex items-center gap-2 text-xs text-link"><Circle className="h-2.5 w-2.5 fill-current animate-pulse" /> Responding…</span> : isUser ? <div className="whitespace-pre-wrap break-words">{message.content}</div> : (message.messageType === 'build_proposal' || message.messageType === 'project_needed') ? renderRouteProposal(message)  : message.messageType === 'build_milestone' ? <div className="flex items-start gap-2.5 py-2 text-xs text-content"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-link" /><div className="min-w-0"><div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-link">Build update</div><MessageMarkdown content={message.content} /></div></div>: message.messageType === 'build' ? <div className="space-y-3"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-link"><Activity className="h-3.5 w-3.5" /> Orchestrator update</div><MessageMarkdown content={message.content} />{(() => {
  const setupRequired = /review the project setup|project needs setup|configured model|available model|workspace identity|reconnect (?:this )?repository/i.test(message.content);
  if (message.content.includes('Choose a codebase') || message.content.includes('Choose one repository')) {
    return <button type="button" onClick={() => setRepositoryMenuOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-status-warning"><FolderGit2 className="h-3.5 w-3.5" /> Choose codebases</button>;
  }
  return setupRequired ? <button type="button" onClick={openProjectSetup} className="px-3 py-2 text-xs text-content-secondary">Review project setup</button> : null;
})()}</div> : <MessageMarkdown content={message.content} />}</div>{!isUser && renderBuildInstead(message)}{isUser && <><MessageAttachments attachments={message.attachments} />{turnCalls.length ? <ChatTurnActivityRow calls={turnCalls} agents={snapshot?.agents ?? []} /> : turnIsActive ? <div className="mt-2 rounded-xl border border-divider bg-surface-raised/75 px-3 py-2 text-[11px] text-link"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-violet-300" />Alpha · Starting response</div> : null}</>}{!isUser && message.messageType === 'build' && message.orchestrationRunId && project?.id && <OrchestratorBuildActivityRow projectId={project.id} runId={message.orchestrationRunId} threadId={activeThread.id} onOpenReview={() => openSavedBuildReview(message.orchestrationRunId!)} onWithdraw={canRouteBuild && message.id.endsWith('-build') ? () => void routeChatMessage(message.id.slice(0, -'-build'.length), 'answer') : undefined} withdrawing={routingMessageId === message.id.slice(0, -'-build'.length)} />}<WorkUsageRow entries={entriesAtMessage(currentMessages, message.id, usage.snapshot?.entries ?? [])} now={usage.now} names={usageNames} /></div></div>; })}{previews.record && <WebPreviewCard record={previews.record} onOpen={openPreview} />}</div></div>

          <div ref={composerRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-shell px-4 pb-4 pt-2 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-10 before:bg-gradient-to-t before:from-shell before:to-transparent before:content-[''] lg:px-8 lg:pb-6">
            <div className="pointer-events-auto mx-auto w-full max-w-3xl space-y-2">
              {showLatest && <div className="flex justify-center"><button type="button" onClick={jumpToLatest} className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface-raised px-4 py-2 text-xs font-medium text-selected-content shadow-lg shadow-black/40 hover:bg-selected">Jump to latest <ChevronDown className="h-3.5 w-3.5" /></button></div>}
              {publishedBuild && publishedBuild.projectId === project?.id && !buildDecision && <div role="status" className="flex items-center gap-3 rounded-2xl border border-status-success-border bg-surface-raised/95 px-4 py-2.5 text-[11px] text-status-success shadow-lg shadow-black/40">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden="true" />
                <span className="min-w-0 flex-1 font-semibold">Pull request opened</span>
                {publishedBuild.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-status-success-border px-3 py-1 font-medium text-status-success hover:bg-status-success-subtle">{publishedBuild.links.length > 1 ? link.repository : 'Open on GitHub'}</a>)}
                <button type="button" onClick={() => setPublishedBuild(null)} aria-label="Dismiss" className="rounded-full p-1 text-status-success hover:bg-surface-high hover:text-content"><X className="h-3.5 w-3.5" /></button>
              </div>}
              {/* When the agents have finished their part, what they changed, one click from the diff. */}
              {!isClient && project && liveBuild && !liveBuild.running && buildChangedFiles.length > 0 && <div className="flex items-center gap-3 rounded-xl border border-divider bg-surface-raised/95 px-3 py-2 text-[11px] shadow-lg shadow-black/40">
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-link" aria-hidden="true" />
                <span className="shrink-0 font-medium text-content">{buildChangedFiles.length} {buildChangedFiles.length === 1 ? 'file' : 'files'} changed</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-content-muted">{buildChangedFiles.slice(0, 4).map(file => file.split('/').pop()).join(', ')}{buildChangedFiles.length > 4 ? ' …' : ''}</span>
                <button type="button" onClick={openBuildChanges} className="shrink-0 rounded-lg px-2 py-1 font-medium text-link hover:bg-surface-high hover:text-content">Review changes</button>
              </div>}
              {/* The build, step by step, with the choices it is waiting on. */}
              {!isClient && project && (liveBuild || buildFailure) && <ChatBuildWizard
                key={liveBuild ? liveBuild.runId : buildFailure?.messageId}
                projectId={project.id}
                build={liveBuild}
                failure={buildFailure}
                canStart={Boolean(liveBuild?.canControl) && can('run_builds')}
                canApprove={can('approve_runs')}
                canStop={canStopBuild}
                busy={stoppingProjectRunId ? 'stop' : buildDecisionBusy}
                error={buildDecisionError}
                onStart={() => void startPlannedBuild()}
                onApprove={() => void approveBuild()}
                onStop={() => void stopProjectBuild()}
                onContinue={action => void continueBuild(action)}
                onAuditPlan={() => void proposeSecurityAuditPlan()}
                onReply={replyInComposer}
                onRetry={() => void retryPlanning()}
                onDismiss={dismissBuildFailure}
                onOpenReview={openBuildReview}
                />}
              {forcedBuild && !isClient && <div className={`px-4 text-[10px] ${requiresRepositorySelection ? 'text-status-warning' : 'text-content-muted'}`}>{repositorySelectionMessage}</div>}
              {pendingFileViews.length > 0 && <div className="flex flex-wrap gap-2 px-2">{pendingFileViews.map(({ file, previewUrl }, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex max-w-full items-center gap-2 rounded-xl border border-divider bg-surface-raised px-2 py-1.5 text-[10px] text-content-secondary shadow-lg shadow-black/30">
                {previewUrl ? <img src={previewUrl} alt={`Preview of ${file.name}`} className="h-8 w-8 rounded-md object-cover" /> : <FileText className="ml-1 h-4 w-4 shrink-0 text-link" />}
                <span className="max-w-48 truncate">{file.name}</span><span className="shrink-0 text-content-muted">{formatFileSize(file.size)}</span>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removePendingFile(index)} className="rounded-md p-1 text-content-muted hover:bg-surface-high hover:text-content"><X className="h-3.5 w-3.5" /></button>
              </div>)}</div>}
              {taskRef && <div className="px-2">
                <div className="flex max-w-full items-center gap-2.5 rounded-lg border border-divider bg-surface-raised px-2.5 py-1.5 text-xs">
                  <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-selected text-link"><Kanban className="h-3.5 w-3.5" /></span>
                  <span className="shrink-0 font-mono text-[11px] text-content-muted">{taskRef.identifier}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-content">{taskRef.title}</span>
                  <span className="shrink-0 text-[11px] text-content-muted">{taskStatusLabel(taskRef.status)}</span>
                  <button type="button" aria-label={`Remove attached task ${taskRef.identifier}`} onClick={() => setTaskRefId(null)} className="rounded-md p-1 text-content-muted hover:bg-surface-high hover:text-content"><X className="h-3.5 w-3.5" /></button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-content-muted">Task attached. Its description and open subtasks are sent with your message.</p>
              </div>}
              <form onSubmit={handleSend} onDragOver={event => { event.preventDefault(); if (!activeTurnMessageId) setIsDraggingFiles(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFiles(false); }} onDrop={event => { event.preventDefault(); setIsDraggingFiles(false); if (!activeTurnMessageId) addFiles(event.dataTransfer.files); }} className={`relative flex items-end gap-1.5 rounded-[1.75rem] border border-divider bg-surface-raised/95 p-1.5 shadow-2xl shadow-black/50 transition-colors focus-within:border-control ${isDraggingFiles ? 'ring-2 ring-selected-content/70' : ''}`}>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={event => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ''; }} />
                <div ref={repositoryMenuRef} className="relative shrink-0">
                  <button type="button" aria-label="Open message tools" aria-haspopup="menu" aria-expanded={repositoryMenuOpen} onClick={() => setRepositoryMenuOpen(value => !value)} className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${repositoryMenuOpen ? 'bg-surface-raised text-content' : 'text-content-secondary hover:bg-surface-high hover:text-content'}`}>
                    <Plus className={`h-5 w-5 transition-transform duration-200 ${repositoryMenuOpen ? 'rotate-45' : ''}`} />
                    {buildIsOpen && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-400" />}
                  </button>
                  {repositoryMenuOpen && <div role="menu" aria-label="Message tools" className="absolute bottom-full left-0 z-40 mb-3 w-[min(22rem,calc(100vw-2rem))] animate-slide-up overflow-hidden rounded-2xl border border-divider bg-surface-high p-1.5 shadow-2xl shadow-black/60">
                    <button type="button" role="menuitem" disabled={Boolean(activeTurnMessageId) || pendingFiles.length >= MAX_CHAT_FILES} onClick={() => { setRepositoryMenuOpen(false); fileInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-content transition hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-40"><Paperclip className="h-4 w-4 shrink-0 text-content-secondary" /><span className="min-w-0 flex-1"><span className="block text-xs font-medium">Attach files</span><span className="block text-[10px] text-content-muted">{activeTurnMessageId ? 'Finish this response before attaching files.' : 'Images, documents, or code'}</span></span></button>
                    {!isClient && project && <div className="mt-1 border-t border-divider pt-1.5">
                      {projectRepositories.length > 1 ? <>
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="flex items-center gap-2 text-[11px] font-semibold text-content"><FolderGit2 className="h-3.5 w-3.5 text-link" />Codebases<span className="font-normal text-content-muted">{selectedBuildRepositoryLabel ?? 'none selected'}</span></span>
                          <span className="flex items-center gap-2 text-[10px]"><button type="button" onClick={() => setSelectedBuildRepositories(projectRepositories.map(item => item.repo))} className="text-link hover:text-content">All</button><button type="button" onClick={() => setSelectedBuildRepositories([])} className="text-content-secondary hover:text-content">Clear</button></span>
                        </div>
                        <div className="max-h-48 overflow-y-auto" role="group" aria-label="Select product codebases">
                          {projectRepositories.map(item => {
                            const selected = selectedBuildRepositories.includes(item.repo);
                            return <button key={item.repo} type="button" aria-pressed={selected} onClick={() => setSelectedBuildRepositories(current => current.includes(item.repo) ? current.filter(repo => repo !== item.repo) : [...current, item.repo])} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-surface-high focus:bg-surface-raised focus:outline-none">
                              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-divider bg-selected text-selected-content' : 'border-divider'}`}>{selected && <Check className="h-3 w-3" />}</span>
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-content">{item.repo}</span>
                              <span className={`shrink-0 text-[10px] ${item.connected ? 'text-status-success' : 'text-status-info'}`}>{item.connected ? 'Ready here' : 'Will clone'}</span>
                            </button>;
                          })}
                        </div>
                      </> : projectRepositories.length === 1 ? <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-content-secondary"><FolderGit2 className="h-3.5 w-3.5 text-link" /><span className="min-w-0 flex-1 truncate">{projectRepositories[0].repo}</span><span className={projectRepositories[0].connected ? 'text-[10px] text-status-success' : 'text-[10px] text-status-info'}>{projectRepositories[0].connected ? 'Ready here' : 'Will clone'}</span></div>
                        : snapshot ? <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-status-warning"><FolderGit2 className="h-3.5 w-3.5" />Connect a repository to build project files</div> : null}
                    </div>}
                  </div>}
                </div>
                {mentionQuery && !isClient && !activeTurnMessageId && <div id="chat-mention-suggestions" role="listbox" aria-label="Project agent suggestions" className="absolute bottom-full left-12 z-50 mb-3 w-[min(22rem,calc(100vw-5rem))] overflow-hidden rounded-xl border border-divider bg-surface-high p-1.5 shadow-2xl shadow-black/50">
                  <div className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-content-muted">Mention a project agent</div>
                  {!snapshot ? <div className="px-2.5 py-3 text-xs text-content-secondary">Open a project conversation to see its agents.</div> : mentionSuggestions.length ? mentionSuggestions.map((agent, index) => <button key={agent.id} type="button" role="option" aria-selected={index === activeMentionIndex} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveMentionIndex(index)} onClick={() => insertAgentMention(agent)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${index === activeMentionIndex ? 'bg-selected text-selected-content' : 'text-content-secondary hover:bg-surface-high'}`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-[10px] font-semibold text-on-accent" style={{ backgroundColor: agent.color || '#6d28d9' }}>{agent.avatar ? <img src={agent.avatar} alt="" className="h-full w-full object-cover" /> : agent.name.charAt(0)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{agent.name}</span><span className="block truncate text-[10px] text-content-muted">{agent.role}</span></span>
                    <span className="text-[10px] text-link">@</span>
                  </button>) : <div className="px-2.5 py-3 text-xs text-content-secondary">No matching project agents.</div>}
                  <div className="border-t border-divider px-2.5 py-2 text-[10px] text-content-muted">Use ↑ and ↓ to choose, Enter to add, or Esc to close.</div>
                </div>}
                <textarea ref={messageInputRef} value={input} onChange={updateMessageInput} onPaste={event => { if (!activeTurnMessageId && event.clipboardData.files.length) { event.preventDefault(); addFiles(event.clipboardData.files); } }} onKeyDown={handleMessageInputKeyDown} aria-autocomplete="list" aria-expanded={Boolean(mentionQuery && mentionSuggestions.length)} aria-controls={mentionQuery ? 'chat-mention-suggestions' : undefined} rows={1} placeholder={activeTurnMessageId ? 'Add a direction for the current agent…' : isClient ? `Write a message to ${pmName}…` : 'Ask Alpha anything or describe what to build. Type @ to call an agent…'} className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-content placeholder-content-muted outline-none" />
                <div className="flex shrink-0 items-center gap-1">
                {!isClient && !activeTurnMessageId && <span className="relative flex items-center">
                  <select aria-label="Model access" title="Choose how much access the selected model has for this chat" value={approvalMode} onChange={event => setApprovalMode(event.target.value as 'ask' | 'approve' | 'full')} className="max-w-36 cursor-pointer appearance-none rounded-md bg-transparent py-1.5 pl-2 pr-5 text-[11px] text-content-secondary outline-none hover:text-content focus-visible:text-content focus-visible:ring-2 focus-visible:ring-focus [&>option]:bg-surface-high [&>option]:text-content">
                    <option value="ask">Ask for approval</option><option value="approve">Approve for me</option><option value="full">Full access</option>
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1 h-3 w-3 text-content-muted" />
                </span>}
                {/* One button: it stops the running response or build while the box is empty, and sends as soon as you type. */}
                {composerStop ? <button type="button" onClick={() => void (composerStop === 'turn' ? stopChatTurn() : stopProjectBuild())}
                  disabled={composerStop === 'turn' ? Boolean(chatTurnActionBusy) : Boolean(stoppingProjectRunId)}
                  aria-label={composerStop === 'turn' ? 'Stop this response' : stopBuildLabel}
                  title={composerStop === 'turn' ? 'Stop this response. Type to queue a direction instead.' : stopBuildLabel + ' · work already on the build branch stays available. Type to send a message instead.'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action text-on-action hover:bg-action-hover disabled:opacity-40">
                  <Square className={(composerStop === 'turn' ? chatTurnActionBusy : stoppingProjectRunId) ? 'h-3.5 w-3.5 animate-pulse fill-current' : 'h-3.5 w-3.5 fill-current'} />
                </button>
                : <button type="submit" aria-label={activeTurnMessageId ? 'Queue direction for current agent' : forcedBuild ? 'Start Orchestrator build' : 'Send message'} disabled={(!input.trim() && (!pendingFiles.length || Boolean(activeTurnMessageId) || forcedBuild)) || Boolean(chatTurnActionBusy) || isAgentTyping && !activeTurnMessageId || !activeTurnMessageId && forcedBuild && (!can('run_agents') || buildIsOpen || requiresRepositorySelection)} title={activeTurnMessageId ? 'Queue this direction for the current response.' : forcedBuild && !can('run_agents') ? 'Your workspace role cannot start product builds.' : forcedBuild && buildIsOpen ? 'Stop the earlier build before starting another.' : forcedBuild && projectRepositories.length === 0 ? 'Connect a codebase before building.' : forcedBuild && requiresRepositorySelection ? 'Select at least one codebase to build.' : undefined} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action text-on-action hover:bg-action-hover disabled:opacity-30"><Send className="h-4 w-4" /></button>}
                </div>
              </form>
              {(pendingFiles.length > 0 || Boolean(activeTurnMessageId)) && <div className="px-4 text-center text-[10px] text-content-muted">{pendingFiles.length ? `Files stay in this device’s private Alpha storage. ${forcedBuild ? 'Project builds store attachments but do not inspect them yet.' : 'Unsupported file types are marked as not analyzed.'}` : 'Directions are queued and picked up at the next safe point.'}</div>}
            </div>
          </div>

        </> : isClient ? <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4"><MessageSquare className="h-12 w-12 text-content-muted" /><p className="text-sm text-content-muted">Pick a project conversation, or start a new one with +.</p></div>
          : <ChatHome
              userName={currentUser?.name ?? ''}
              projects={assignedProjects.map(item => ({ id: item.id, name: item.name }))}
              projectId={draftProjectId}
              onProjectChange={projectId => setDraftProjectChoice(projectId ?? '')}
              message={input}
              onMessageChange={setInput}
              approvalMode={approvalMode}
              onApprovalModeChange={setApprovalMode}
              onSend={() => void sendFromHome()}
              canSend={canStartThread}
              blockedReason={canStartThread ? undefined : 'Your workspace role cannot start conversations.'}
              recent={[...chatThreads]
                .filter(thread => (thread.messages?.length ?? 0) > 0 || thread.lastMessageSnippet !== 'Ready for instructions...')
                .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))
                .slice(0, 5)
                .map(thread => ({ id: thread.id, title: thread.title, projectName: projects.find(item => item.id === thread.projectId)?.name, lastMessageAt: thread.lastMessageAt }))}
              onOpenRecent={threadId => setActiveThreadId(threadId)}
            />}
      </main>
      {!isClient && <ChatPanelHandle open={Boolean(panelVisible)} onToggle={() => setPanelVisible(value => !value)} />}
      {!isClient && panelVisible && <ChatSidePanel tabs={sideTabs.map(sideTabMeta)} activeId={activeSideTabId} onSelect={setActiveSideTabId} onClose={closeSideTab} onCloseAll={() => { setPanelVisible(false); document.getElementById('chat-panel-toggle')?.focus(); }}>
        {activeSideTab ? renderSideTab(activeSideTab) : <section className="space-y-4 p-5"><h2 className="text-sm font-semibold">Side panel</h2><p className="text-xs text-content-secondary">Keep previews, plans, agents and changes beside your conversation.</p><button type="button" onClick={openPreview} className="flex w-full items-center gap-2 rounded-lg border border-divider p-3 text-xs hover:bg-surface-high"><Globe className="h-4 w-4" />Web preview</button>{latestBuild && project && <><button type="button" onClick={() => openPlanTab({ projectId: project.id, runId: latestBuild.runId, planVersion: latestBuild.orchestration.run.planVersion, auto: false })} className="block text-xs text-link">Open saved plan</button><button type="button" onClick={() => openSavedBuildReview(latestBuild.runId)} className="block text-xs text-link">Build review</button><button type="button" onClick={openBuildChanges} className="block text-xs text-link">Code changes</button></>}</section>}
      </ChatSidePanel>}
    </div>
    </PlanPanelContext.Provider>
  );
};

function TargetIcon({ type }: { type: AgentCallTarget['type'] }) {
  if (type === 'file' || type === 'code' || type === 'diff') return <Code2 className="h-3 w-3" />;
  if (type === 'branch' || type === 'commit' || type === 'pull_request') return <GitBranch className="h-3 w-3" />;
  if (type === 'issue' || type === 'specification') return <Clipboard className="h-3 w-3" />;
  return <MessageSquare className="h-3 w-3" />;
}
