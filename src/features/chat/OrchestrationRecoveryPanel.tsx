import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MessageSquareText,
  Pause,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Wrench
} from 'lucide-react';
import { apiService, userMessage } from '@/shared/services/apiService';
import type {
  LiveBuildOrchestratorResolution,
  LiveBuildRecoveryAction,
  LiveBuildRecoveryProjection,
  LiveBuildRecoveryState
} from '@/shared/types';

interface OrchestrationRecoveryPanelProps {
  projectId: string;
  runId: string;
  runRevision: number;
  taskRevision?: number;
  recovery?: LiveBuildRecoveryProjection;
  canControl: boolean;
  threadId?: string;
  onOpenReview?: () => void;
  onActionComplete?: (state?: LiveBuildRecoveryState) => void | Promise<void>;
  compact?: boolean;
}

const actionMeta: Record<LiveBuildRecoveryAction, { label: string; icon: React.ReactNode; tone: string }> = {
  explain_failure: { label: 'Explain issue', icon: <MessageSquareText className="h-3.5 w-3.5" />, tone: 'border-divider text-content hover:bg-surface-high' },
  retry_report_format: { label: 'Retry report format', icon: <ClipboardCheck className="h-3.5 w-3.5" />, tone: 'border-status-info-border bg-status-info-subtle text-status-info hover:bg-status-info-subtle' },
  repair_and_continue: { label: 'Retry failed step', icon: <Wrench className="h-3.5 w-3.5" />, tone: 'border-divider bg-selected text-selected-content hover:bg-selected' },
  apply_proposed_fix: { label: 'Apply this fix', icon: <CheckCircle2 className="h-3.5 w-3.5" />, tone: 'border-transparent bg-action text-on-action hover:bg-action-hover' },
  provide_guidance: { label: 'Provide direction', icon: <MessageSquareText className="h-3.5 w-3.5" />, tone: 'border-divider bg-selected text-selected-content hover:bg-selected' },
  recheck_prerequisite: { label: 'Recheck and resume', icon: <RefreshCw className="h-3.5 w-3.5" />, tone: 'border-status-info-border bg-status-info-subtle text-status-info hover:bg-status-info-subtle' },
  plan_final_validation_corrections: { label: 'Fix failed checks', icon: <Wrench className="h-3.5 w-3.5" />, tone: 'border-divider bg-selected text-selected-content hover:bg-selected' },
  resume_checkpoint: { label: 'Resume saved work', icon: <RotateCcw className="h-3.5 w-3.5" />, tone: 'border-status-info-border bg-status-info-subtle text-status-info hover:bg-status-info-subtle' },
  review_saved_changes: { label: 'Review saved changes', icon: <ClipboardCheck className="h-3.5 w-3.5" />, tone: 'border-divider text-content hover:bg-surface-high' },
  keep_paused: { label: 'Keep paused', icon: <Pause className="h-3.5 w-3.5" />, tone: 'border-status-warning-border text-status-warning hover:bg-status-warning-subtle' },
  cancel_build: { label: 'Cancel build', icon: <Square className="h-3.5 w-3.5" />, tone: 'border-status-danger-border text-status-danger hover:bg-status-danger-subtle' }
};

/** Why the Orchestrator handed this stop to the person, in plain words. */
const ESCALATION_REASONS: Record<string, string> = {
  product: 'This is a decision about what to build, so it is yours.',
  sensitive: 'The fix touches a sensitive area (such as sign-in, data, payments or deployment), so it needs your approval.',
  strict: 'The fix changes earlier finished work, and this project lets Alpha fix only routine problems on its own.',
  unverified: 'Alpha could not confirm the evidence for a fix, so it did not act on it.',
  outside_scope: 'The fix would change files outside this task, so Alpha did not act on it.',
  repeat: 'The same problem came back after Alpha already handled it once in this build.',
  budget: 'Alpha has already fixed the most problems it may fix in one build, so this one is yours.',
  unavailable: 'Alpha could not look into this one on this computer.',
  retry_refused: 'Alpha could not start its fix.',
  out_of_bounds: 'Alpha’s fix changed files it was not cleared to change on its own. The work is kept for you to check.'
};

/** One line on where the Orchestrator's own look at this stop ended. */
export function orchestratorStatusText(resolution: LiveBuildOrchestratorResolution, resolving: boolean): string | undefined {
  if (resolving) return 'Alpha is looking into why this stopped. It will fix it or ask you; you do not need to act yet.';
  if (resolution.outcome === 'escalated') return ESCALATION_REASONS[resolution.escalation ?? ''] ?? 'Alpha could not resolve this on its own.';
  if (resolution.outcome === 'retrying') return 'Alpha sent its fix to the same specialist. The result goes through the same checks and review.';
  if (resolution.outcome === 'retry_failed') return 'Alpha’s fix did not pass its checks, so this is yours now.';
  if (resolution.outcome === 'interrupted') return 'Alpha was interrupted while looking into this. It will not try again on its own.';
  return undefined;
}

/** What the Orchestrator found: its diagnosis, its question for the person, and any fix it proposes. */
const OrchestratorFindings: React.FC<{
  resolution?: LiveBuildOrchestratorResolution;
  resolving: boolean;
  onAnswer?: (answer: string) => void;
}> = ({ resolution, resolving, onAnswer }) => {
  if (!resolution && !resolving) return null;
  const status = orchestratorStatusText(resolution ?? { outcome: 'resolving' }, resolving);
  const question = resolving ? undefined : resolution?.question;
  const proposedFix = resolving ? undefined : resolution?.proposedFix;
  return <div aria-label="What Alpha found" className="mt-3 space-y-2 rounded-lg border border-divider bg-surface-raised p-3 text-[11px] leading-5">
    <p className="flex items-center gap-1.5 font-semibold text-content">
      {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-status-info" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5 text-status-info" aria-hidden="true" />}
      {resolving ? 'Alpha is resolving this' : 'What Alpha found'}
    </p>
    {status && <p role={resolving ? 'status' : undefined} className="text-content-secondary">{status}</p>}
    {!resolving && resolution?.diagnosis && <p className="whitespace-pre-wrap break-words text-content-secondary">{resolution.diagnosis}</p>}
    {question && <div className="space-y-1.5 rounded-lg border border-status-info-border bg-status-info-subtle p-2.5">
      <p className="font-medium text-content">{question.text}</p>
      {question.why && <p className="text-[10px] text-content-secondary">{question.why}</p>}
      {question.options.length > 0 && <div className="flex flex-wrap gap-1.5">
        {question.options.map(option => onAnswer
          ? <button key={option.label} type="button" onClick={() => onAnswer(option.label)} title={option.description}
            className="rounded-lg border border-divider bg-surface-raised px-2 py-1 text-[10px] font-medium text-content hover:bg-surface-high">{option.label}</button>
          : <span key={option.label} title={option.description} className="rounded-lg border border-divider bg-surface-raised px-2 py-1 text-[10px] text-content-secondary">{option.label}</span>)}
      </div>}
    </div>}
    {proposedFix && <div className="space-y-1">
      <p className="font-medium text-content">{resolution?.outcome === 'retrying' ? 'The fix it sent' : 'The fix Alpha proposes'}</p>
      <p className="whitespace-pre-wrap break-words rounded-lg border border-divider bg-well px-2.5 py-2 text-content-secondary">{proposedFix}</p>
    </div>}
    {!resolving && Boolean(resolution?.evidence?.length) && <details className="text-[10px] text-content-muted">
      <summary className="cursor-pointer">What Alpha checked ({resolution?.evidence?.length})</summary>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 font-mono">{resolution?.evidence?.map(item => <li key={item} className="break-all">{item}</li>)}</ul>
    </details>}
  </div>;
};

/** The panel's heading for a recovery the Orchestrator is not looking into right now. */
function recoveryPhaseLabel(recovery: LiveBuildRecoveryProjection): string {
  if (recovery.phase === 'repairing') return 'Recovery in progress';
  if (recovery.phase === 'ready_to_continue') return 'Review continuation';
  if (recovery.attemptsUsed >= 4) return 'Recovery limit reached';
  return recovery.category === 'configuration' || recovery.category === 'provider' ? 'Setup needs review' : 'Recovery needs review';
}

function idempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export const OrchestrationRecoveryPanel: React.FC<OrchestrationRecoveryPanelProps> = ({
  projectId, runId, runRevision, taskRevision, recovery, canControl, threadId, onOpenReview, onActionComplete, compact = false
}) => {
  const [guidance, setGuidance] = useState('');
  const [showGuidance, setShowGuidance] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busyAction, setBusyAction] = useState<LiveBuildRecoveryAction | null>(null);
  const [message, setMessage] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const available = useMemo(() => new Set(recovery?.availableActions ?? []), [recovery?.availableActions]);

  if (!recovery) return null;
  const active = recovery.phase !== 'resolved' && recovery.phase !== 'cancelled';
  const summaryBoundary = recovery.summary.search(/Agent's last update:|Recent output:/);
  const shortSummary = summaryBoundary < 0 ? recovery.summary : recovery.summary.slice(0, summaryBoundary).trim();
  const availabilityNote = recovery.actionReasons.provide_guidance
    ?? recovery.actionReasons.recheck_prerequisite
    ?? recovery.actionReasons.retry_report_format
    ?? recovery.actionReasons.repair_and_continue
    ?? recovery.actionReasons.resume_checkpoint;
  const resolving = recovery.resolving === true;
  const actions = (['explain_failure', 'retry_report_format', 'repair_and_continue', 'apply_proposed_fix', 'provide_guidance', 'recheck_prerequisite',
    'plan_final_validation_corrections', 'resume_checkpoint', 'review_saved_changes', 'keep_paused', 'cancel_build'] as LiveBuildRecoveryAction[])
    .filter(action => available.has(action) &&
      (canControl || action === 'explain_failure' || action === 'review_saved_changes') &&
      (action !== 'review_saved_changes' || Boolean(onOpenReview)));
  const phaseLabel = resolving ? 'Alpha is resolving this' : recoveryPhaseLabel(recovery);
  const recoveryUsage = recovery.category === 'project_code' && recovery.taskTitle
    ? `${Math.min(2, Math.max(0, recovery.attemptsUsed - 1))} of 2 automatic repairs used${recovery.attemptsUsed > 3 ? ` · ${recovery.attemptsUsed - 3} guided retry used` : ''}`
    : recovery.category === 'report' && recovery.taskTitle
      ? `${recovery.reportCorrectionsUsed ?? 0} of ${recovery.reportCorrectionLimit ?? 3} report corrections used`
      : undefined;
  const retryAction = async (action: LiveBuildRecoveryAction) => {
    if (busyAction || !recovery) return;
    if (action === 'provide_guidance' && !guidance.trim()) {
      setError('Add a short direction for the specialist before continuing.');
      return;
    }
    setBusyAction(action);
    setError('');
    setMessage('');
    setExplanation('');
    try {
      const result = await apiService.performOrchestrationRecoveryAction(projectId, runId, {
        recoveryId: recovery.id,
        expectedRunRevision: runRevision,
        expectedRecoveryRevision: recovery.revision,
        expectedTaskRevision: recovery.taskId ? taskRevision : undefined,
        idempotencyKey: idempotencyKey(),
        action,
        guidance: action === 'provide_guidance' ? guidance.trim() : undefined,
        threadId
      });
      if (result.explanation) setExplanation(result.explanation);
      if (result.message) setMessage(result.message);
      if (action === 'provide_guidance') {
        setGuidance('');
        setShowGuidance(false);
      }
      if (action === 'cancel_build') setConfirmCancel(false);
      await onActionComplete?.(result.state);
      if (action === 'review_saved_changes') onOpenReview?.();
    } catch (caught: any) {
      setError(userMessage(caught, 'Alpha could not complete this recovery action. Refresh the build and try again.'));
    } finally {
      setBusyAction(null);
    }
  };

  let phaseIcon = <CheckCircle2 className="h-4 w-4" />;
  if (active) phaseIcon = recovery.phase === 'repairing' || resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />;

  return <section aria-label="Build recovery" className={`overflow-hidden rounded-xl border ${active ? 'border-status-warning-border bg-status-warning-subtle' : 'border-status-success-border bg-status-success-subtle'}`}>
    <div className={`flex items-start gap-3 ${compact ? 'p-3' : 'p-4'}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${active ? 'border-status-warning-border bg-status-warning-subtle text-status-warning' : 'border-status-success-border bg-status-success-subtle text-status-success'}`}>
        {phaseIcon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`text-xs font-semibold ${active ? 'text-status-warning' : 'text-status-success'}`}>{phaseLabel}</h3>
          <span className="rounded border border-divider bg-well px-1.5 py-0.5 text-[9px] capitalize text-content-secondary">{recovery.category.replace(/_/g, ' ')}</span>
          {recovery.taskTitle && <span className="min-w-0 truncate text-[10px] text-content-secondary">· {recovery.taskTitle}</span>}
        </div>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-5 text-content-secondary">{shortSummary}</p>
        {summaryBoundary >= 0 && <details className="mt-1 text-[10px] text-content-muted">
          <summary className="cursor-pointer">Agent output</summary>
          <p className="mt-2 whitespace-pre-wrap break-words leading-5">{recovery.summary.slice(summaryBoundary)}</p>
        </details>}
        {active && <OrchestratorFindings resolution={recovery.orchestratorResolution} resolving={resolving}
          onAnswer={canControl && available.has('provide_guidance') ? answer => { setGuidance(answer); setShowGuidance(true); setConfirmCancel(false); } : undefined} />}
        {active && availabilityNote && <p className="mt-1 text-[10px] leading-4 text-content-muted">{availabilityNote}</p>}
        {active && <p className="mt-1 text-[9px] text-content-muted">Recovery {recovery.episodeNumber}{recoveryUsage ? ` · ${recoveryUsage}` : ''}</p>}
        {explanation && <div role="status" className="mt-3 rounded-lg border border-divider bg-selected p-3 text-[11px] leading-5 text-selected-content">{explanation}</div>}
        {message && <p role="status" className="mt-2 text-[10px] leading-4 text-status-success">{message}</p>}
        {error && <p role="alert" className="mt-2 text-[10px] leading-4 text-status-danger">{error}</p>}
        {actions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
          {actions.map(action => {
            if (action === 'provide_guidance' && !showGuidance) return <button key={action} type="button" onClick={() => { setShowGuidance(true); setConfirmCancel(false); }} disabled={Boolean(busyAction)} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold transition disabled:opacity-50 ${actionMeta[action].tone}`}>
              {actionMeta[action].icon}{actionMeta[action].label}
            </button>;
            if (action === 'cancel_build' && !confirmCancel) return <button key={action} type="button" onClick={() => { setConfirmCancel(true); setShowGuidance(false); }} disabled={Boolean(busyAction)} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold transition disabled:opacity-50 ${actionMeta[action].tone}`}>
              {actionMeta[action].icon}{actionMeta[action].label}
            </button>;
            if (action === 'provide_guidance' || action === 'cancel_build') return <button key={action} type="button" onClick={() => void retryAction(action)} disabled={Boolean(busyAction) || (action === 'provide_guidance' && !guidance.trim())} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold transition disabled:cursor-wait disabled:opacity-50 ${actionMeta[action].tone}`}>
              {busyAction === action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action === 'provide_guidance' ? <ShieldCheck className="h-3.5 w-3.5" /> : <Square className="h-3 w-3" />}
              {action === 'provide_guidance' ? 'Send direction and retry' : 'Confirm cancel'}
            </button>;
            return <button key={action} type="button" onClick={() => void retryAction(action)} disabled={Boolean(busyAction)} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold transition disabled:cursor-wait disabled:opacity-50 ${actionMeta[action].tone}`}>
              {busyAction === action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : actionMeta[action].icon}{actionMeta[action].label}
            </button>;
          })}
        </div>}
        {showGuidance && available.has('provide_guidance') && <div className="mt-3 space-y-2">
          <label htmlFor={`recovery-guidance-${recovery.id}`} className="block text-[10px] font-medium text-content-secondary">What should the specialist change or check?</label>
          <textarea id={`recovery-guidance-${recovery.id}`} value={guidance} onChange={event => setGuidance(event.target.value.slice(0, 2_000))} maxLength={2_000} rows={3} placeholder="Describe the correction. Alpha keeps the original task and file boundaries." className="w-full resize-y rounded-lg border border-control bg-well px-3 py-2 text-[11px] leading-5 text-content placeholder:text-content-muted outline-none focus:border-control focus:ring-2 focus:ring-focus" />
          <div className="flex flex-wrap items-center justify-between gap-3 text-[9px] text-content-muted"><span>Guidance cannot expand the approved task scope. Avoid passwords or access tokens.</span><span>{guidance.length}/2,000</span></div>
          <button type="button" onClick={() => { setShowGuidance(false); setGuidance(''); setError(''); }} className="text-[10px] text-content-muted hover:text-content-secondary">Clear direction</button>
        </div>}
        {confirmCancel && <div className="mt-2 flex flex-wrap items-center gap-2"><p role="alert" className="mr-auto text-[10px] text-status-danger">Alpha will stop this build and preserve its saved work.</p><button type="button" onClick={() => setConfirmCancel(false)} className="min-h-8 rounded-lg px-2.5 text-[10px] text-content-secondary hover:text-content">Keep build</button></div>}
      </div>
    </div>
  </section>;
};
