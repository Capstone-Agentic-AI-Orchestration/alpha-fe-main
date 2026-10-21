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
  Square,
  Wrench
} from 'lucide-react';
import { apiService } from '@/shared/services/apiService';
import type {
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
  onOpenRoom?: () => void;
  onActionComplete?: (state?: LiveBuildRecoveryState) => void | Promise<void>;
  compact?: boolean;
}

const actionMeta: Record<LiveBuildRecoveryAction, { label: string; icon: React.ReactNode; tone: string }> = {
  explain_failure: { label: 'Explain issue', icon: <MessageSquareText className="h-3.5 w-3.5" />, tone: 'border-white/10 text-slate-200 hover:bg-white/[0.06]' },
  retry_report_format: { label: 'Retry report format', icon: <ClipboardCheck className="h-3.5 w-3.5" />, tone: 'border-sky-300/25 bg-sky-300/[0.07] text-sky-100 hover:bg-sky-300/[0.12]' },
  repair_and_continue: { label: 'Fix and continue', icon: <Wrench className="h-3.5 w-3.5" />, tone: 'border-violet-300/25 bg-violet-300/[0.08] text-violet-100 hover:bg-violet-300/[0.14]' },
  provide_guidance: { label: 'Provide direction', icon: <MessageSquareText className="h-3.5 w-3.5" />, tone: 'border-violet-300/25 bg-violet-300/[0.08] text-violet-100 hover:bg-violet-300/[0.14]' },
  recheck_prerequisite: { label: 'Recheck and resume', icon: <RefreshCw className="h-3.5 w-3.5" />, tone: 'border-sky-300/25 bg-sky-300/[0.07] text-sky-100 hover:bg-sky-300/[0.12]' },
  plan_final_validation_corrections: { label: 'Fix failed checks', icon: <Wrench className="h-3.5 w-3.5" />, tone: 'border-violet-300/25 bg-violet-300/[0.08] text-violet-100 hover:bg-violet-300/[0.14]' },
  resume_checkpoint: { label: 'Resume saved work', icon: <RotateCcw className="h-3.5 w-3.5" />, tone: 'border-sky-300/25 bg-sky-300/[0.07] text-sky-100 hover:bg-sky-300/[0.12]' },
  review_saved_changes: { label: 'Review saved changes', icon: <ClipboardCheck className="h-3.5 w-3.5" />, tone: 'border-white/10 text-slate-200 hover:bg-white/[0.06]' },
  keep_paused: { label: 'Keep paused', icon: <Pause className="h-3.5 w-3.5" />, tone: 'border-amber-300/20 text-amber-100 hover:bg-amber-300/[0.08]' },
  cancel_build: { label: 'Cancel build', icon: <Square className="h-3.5 w-3.5" />, tone: 'border-rose-300/20 text-rose-100 hover:bg-rose-300/[0.08]' }
};

function idempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export const OrchestrationRecoveryPanel: React.FC<OrchestrationRecoveryPanelProps> = ({
  projectId, runId, runRevision, taskRevision, recovery, canControl, threadId, onOpenRoom, onActionComplete, compact = false
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
  const availabilityNote = recovery.actionReasons.provide_guidance
    ?? recovery.actionReasons.recheck_prerequisite
    ?? recovery.actionReasons.retry_report_format
    ?? recovery.actionReasons.repair_and_continue
    ?? recovery.actionReasons.resume_checkpoint;
  const actions = (['explain_failure', 'retry_report_format', 'repair_and_continue', 'provide_guidance', 'recheck_prerequisite',
    'plan_final_validation_corrections', 'resume_checkpoint', 'review_saved_changes', 'keep_paused', 'cancel_build'] as LiveBuildRecoveryAction[])
    .filter(action => available.has(action) &&
      (canControl || action === 'explain_failure' || action === 'review_saved_changes') &&
      (action !== 'review_saved_changes' || Boolean(onOpenRoom)));
  const phaseLabel = recovery.phase === 'repairing' ? 'Recovery in progress'
    : recovery.phase === 'ready_to_continue' ? 'Ready to continue' : 'Waiting for your direction';
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
      if (action === 'review_saved_changes') onOpenRoom?.();
    } catch (caught: any) {
      setError(caught?.message ?? 'Alpha could not complete this recovery action. Refresh the build and try again.');
    } finally {
      setBusyAction(null);
    }
  };

  return <section aria-label="Build recovery" className={`overflow-hidden rounded-xl border ${active ? 'border-amber-300/20 bg-amber-300/[0.035]' : 'border-emerald-300/15 bg-emerald-300/[0.025]'}`}>
    <div className={`flex items-start gap-3 ${compact ? 'p-3' : 'p-4'}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${active ? 'border-amber-200/15 bg-amber-200/[0.06] text-amber-200' : 'border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-200'}`}>
        {active ? recovery.phase === 'repairing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`text-xs font-semibold ${active ? 'text-amber-100' : 'text-emerald-100'}`}>{phaseLabel}</h3>
          <span className="rounded border border-white/[0.08] bg-black/[0.12] px-1.5 py-0.5 text-[9px] capitalize text-slate-400">{recovery.category.replace(/_/g, ' ')}</span>
          {recovery.taskTitle && <span className="min-w-0 truncate text-[10px] text-slate-400">· {recovery.taskTitle}</span>}
        </div>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-300">{recovery.summary}</p>
        {active && availabilityNote && <p className="mt-1 text-[10px] leading-4 text-slate-500">{availabilityNote}</p>}
        {active && <p className="mt-1 text-[9px] text-slate-500">Recovery {recovery.episodeNumber}{recovery.taskTitle ? ` · ${recovery.attemptsUsed} of ${recovery.repairBudget} work attempts used` : ''}</p>}
        {explanation && <div role="status" className="mt-3 rounded-lg border border-violet-300/15 bg-violet-300/[0.045] p-3 text-[11px] leading-5 text-violet-50">{explanation}</div>}
        {message && <p role="status" className="mt-2 text-[10px] leading-4 text-emerald-200">{message}</p>}
        {error && <p role="alert" className="mt-2 text-[10px] leading-4 text-rose-200">{error}</p>}
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
          {onOpenRoom && !available.has('review_saved_changes') && <button type="button" onClick={onOpenRoom} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[10px] font-semibold text-slate-200 hover:bg-white/[0.06]">Open Live Build Room</button>}
        </div>}
        {showGuidance && available.has('provide_guidance') && <div className="mt-3 space-y-2">
          <label htmlFor={`recovery-guidance-${recovery.id}`} className="block text-[10px] font-medium text-slate-300">What should the specialist change or check?</label>
          <textarea id={`recovery-guidance-${recovery.id}`} value={guidance} onChange={event => setGuidance(event.target.value.slice(0, 2_000))} maxLength={2_000} rows={3} placeholder="Describe the correction. Alpha keeps the original task and file boundaries." className="w-full resize-y rounded-lg border border-violet-200/15 bg-[#0d1019] px-3 py-2 text-[11px] leading-5 text-white placeholder:text-slate-600 outline-none focus:border-violet-200/35 focus:ring-2 focus:ring-violet-300/10" />
          <div className="flex flex-wrap items-center justify-between gap-3 text-[9px] text-slate-500"><span>Guidance cannot expand the approved task scope. Avoid passwords or access tokens.</span><span>{guidance.length}/2,000</span></div>
          <button type="button" onClick={() => { setShowGuidance(false); setGuidance(''); setError(''); }} className="text-[10px] text-slate-500 hover:text-slate-300">Clear direction</button>
        </div>}
        {confirmCancel && <div className="mt-2 flex flex-wrap items-center gap-2"><p role="alert" className="mr-auto text-[10px] text-rose-100">Alpha will stop this build and preserve its saved work.</p><button type="button" onClick={() => setConfirmCancel(false)} className="min-h-8 rounded-lg px-2.5 text-[10px] text-slate-400 hover:text-white">Keep build</button></div>}
      </div>
    </div>
  </section>;
};
