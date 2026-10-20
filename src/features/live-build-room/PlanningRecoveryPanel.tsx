import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, FileSearch, GitBranch, LoaderCircle, ShieldAlert } from 'lucide-react';
import { apiService } from '@/shared/services/apiService';
import type { LiveBuildPlanningRecovery, LiveBuildPlanningRecoveryPreview } from '@/shared/types';

interface PlanningRecoveryPanelProps {
  projectId: string;
  recoveries: LiveBuildPlanningRecovery[];
  canManage: boolean;
  onChanged: () => void;
}

function shortCommit(value: string): string {
  return value.slice(0, 7);
}

function statusLabel(state: LiveBuildPlanningRecovery['state']): string {
  if (state === 'interrupted') return 'Planning interrupted';
  if (state === 'needs_review') return 'Saved work needs review';
  if (state === 'manual_review') return 'Workspace needs attention';
  if (state === 'retained') return 'Saved work retained';
  return 'Planning workspace safely cleared';
}

export const PlanningRecoveryPanel: React.FC<PlanningRecoveryPanelProps> = ({ projectId, recoveries, canManage, onChanged }) => {
  const [busyRunId, setBusyRunId] = useState<string | null>(null);
  const [errorByRunId, setErrorByRunId] = useState<Record<string, string>>({});
  const [previewByRunId, setPreviewByRunId] = useState<Record<string, LiveBuildPlanningRecoveryPreview | null>>({});
  const [confirmRunId, setConfirmRunId] = useState<string | null>(null);

  const runAction = async (runId: string, action: () => Promise<unknown>) => {
    if (busyRunId) return;
    setBusyRunId(runId);
    setErrorByRunId(current => ({ ...current, [runId]: '' }));
    try {
      await action();
      setConfirmRunId(null);
      onChanged();
    } catch (error: any) {
      setErrorByRunId(current => ({ ...current, [runId]: error?.message ?? 'The saved workspace could not be recovered. Refresh and try again.' }));
    } finally {
      setBusyRunId(null);
    }
  };

  const loadPreview = async (recovery: LiveBuildPlanningRecovery) => {
    if (previewByRunId[recovery.runId] || busyRunId) return;
    setBusyRunId(recovery.runId);
    setErrorByRunId(current => ({ ...current, [recovery.runId]: '' }));
    try {
      const preview = await apiService.getOrchestrationPlanningRecoveryPreview(projectId, recovery.runId);
      setPreviewByRunId(current => ({ ...current, [recovery.runId]: preview }));
    } catch (error: any) {
      setErrorByRunId(current => ({ ...current, [recovery.runId]: error?.message ?? 'The saved changes could not be previewed.' }));
    } finally {
      setBusyRunId(null);
    }
  };

  return <section aria-label="Interrupted planning recovery" className="space-y-3">
    {recoveries.map(recovery => {
      const preview = previewByRunId[recovery.runId];
      const busy = busyRunId === recovery.runId;
      const confirming = confirmRunId === recovery.runId;
      const unresolved = recovery.state !== 'retained' && recovery.state !== 'cleaned';
      return <article key={recovery.runId} className={`overflow-hidden rounded-2xl border ${unresolved ? 'border-amber-300/20 bg-[linear-gradient(135deg,rgba(55,42,25,0.34),rgba(16,20,30,0.92))]' : 'border-emerald-300/15 bg-[linear-gradient(135deg,rgba(23,52,43,0.2),rgba(16,20,30,0.92))]'}`}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex min-w-0 gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${unresolved ? 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100' : 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100'}`}>
              {unresolved ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-white">{statusLabel(recovery.state)}</h2>
                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${unresolved ? 'border-amber-300/20 bg-amber-300/[0.05] text-amber-100/85' : 'border-emerald-300/15 bg-emerald-300/[0.045] text-emerald-100/75'}`}>
                  {recovery.state === 'retained' ? 'Repository unlocked' : 'Repository paused'}
                </span>
              </div>
              <p className="mt-1.5 max-w-3xl text-xs leading-5 text-slate-300">{recovery.reason}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500">
                <span className="max-w-full truncate font-medium text-slate-300">{recovery.repository}</span>
                <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{recovery.branchName}</span>
                <span>Reserved from {shortCommit(recovery.baseCommit)}</span>
                <span>{new Date(recovery.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              {recovery.state === 'interrupted' && <p className="mt-3 text-[10px] leading-4 text-slate-400">No task plan was activated, so no specialist started. Alpha will remove the workspace only if its branch and contents still match the clean reservation.</p>}
              {recovery.state === 'manual_review' && <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-amber-100/80"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />Alpha kept this folder unchanged while it checks that it belongs to this build. Reconnect the same repository and recheck; any issue found will be explained above.</p>}
              {recovery.state === 'retained' && <p className="mt-3 text-[10px] leading-4 text-emerald-100/70">The saved workspace remains on this desktop. New work can use the repository; it will not include these saved changes automatically.</p>}
              {recovery.state === 'cleaned' && <p className="mt-3 text-[10px] leading-4 text-emerald-100/70">Alpha verified the interrupted planning workspace was clean, removed it safely, and released the repository lock.</p>}
            </div>
          </div>

          {canManage && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {['interrupted', 'manual_review'].includes(recovery.state) && <button type="button" onClick={() => void runAction(recovery.runId, async () => {
              const result = await apiService.inspectOrchestrationPlanningRecovery(projectId, recovery.runId);
              if (result.state === 'needs_review' || result.state === 'manual_review') {
                setErrorByRunId(current => ({ ...current, [recovery.runId]: '' }));
              }
            })} disabled={Boolean(busyRunId)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/20 bg-amber-200/[0.06] px-3 text-xs font-semibold text-amber-50 transition hover:bg-amber-200/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100 disabled:cursor-wait disabled:opacity-50">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}{busy ? 'Checking saved work…' : recovery.state === 'interrupted' ? 'Inspect saved work' : 'Recheck workspace'}
            </button>}
            {recovery.canPreview && <button type="button" onClick={() => preview ? setPreviewByRunId(current => ({ ...current, [recovery.runId]: null })) : void loadPreview(recovery)} disabled={busy} aria-expanded={Boolean(preview)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-50">
              {busy && !preview ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className={`h-3.5 w-3.5 transition-transform ${preview ? 'rotate-180' : ''}`} />}{preview ? 'Hide saved changes' : 'Review saved changes'}
            </button>}
            {recovery.state === 'needs_review' && <button type="button" onClick={() => setConfirmRunId(confirming ? null : recovery.runId)} disabled={Boolean(busyRunId)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200/20 bg-emerald-200/[0.055] px-3 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-200/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />Keep files and unlock
            </button>}
          </div>}
        </div>

        {preview && <div className="border-t border-white/[0.07] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-xs font-semibold text-white">Saved workspace preview</div><p className="mt-1 text-[10px] text-slate-500">Compared with {shortCommit(preview.baseCommit)} · current HEAD {shortCommit(preview.headCommit)} · {preview.changedPaths.length}{preview.pathsTruncated ? '+' : ''} changed paths</p></div>
            {preview.truncated && <span className="rounded-md border border-amber-300/15 px-2 py-1 text-[9px] text-amber-100/80">Preview shortened</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Changed files in saved workspace">
            {preview.changedPaths.map(file => <code key={file} className="max-w-full truncate rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-1 text-[10px] text-slate-300">{file}</code>)}
            {!preview.changedPaths.length && <span className="text-[10px] text-slate-500">No file changes are visible in this preview.</span>}
          </div>
          {preview.diff && <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-white/[0.07] bg-[#0b0d12] p-3 font-mono text-[10px] leading-5 text-slate-300" tabIndex={0} aria-label="Saved workspace diff">{preview.diff}</pre>}
          {!preview.diff && <p className="mt-3 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2 text-[10px] leading-4 text-slate-400">The branch or file state changed, but there is no text diff to display. Keep the saved workspace if you need to inspect it later.</p>}
          {preview.pathsTruncated && <p className="mt-2 text-[10px] text-slate-500">Only the first 200 changed paths are listed.</p>}
        </div>}

        {confirming && <div role="group" aria-label="Confirm keeping saved workspace" className="border-t border-emerald-300/10 bg-emerald-300/[0.025] px-4 py-3 sm:px-5">
          <p className="text-xs leading-5 text-emerald-50/90">Keep this workspace on the desktop and release the repository lock? Its changes will not be included in later builds automatically.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => void runAction(recovery.runId, () => apiService.retainOrchestrationPlanningRecovery(projectId, recovery.runId, recovery.revision))} disabled={Boolean(busyRunId)} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-200 px-3 text-[11px] font-semibold text-slate-950 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50">{busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{busy ? 'Keeping workspace…' : 'Confirm keep and unlock'}</button>
            <button type="button" onClick={() => setConfirmRunId(null)} disabled={Boolean(busyRunId)} className="min-h-9 rounded-lg px-3 text-[11px] text-slate-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-50">Cancel</button>
          </div>
        </div>}
        {errorByRunId[recovery.runId] && <div role="alert" className="border-t border-rose-300/10 bg-rose-300/[0.025] px-4 py-3 text-xs leading-5 text-rose-100 sm:px-5">{errorByRunId[recovery.runId]}</div>}
      </article>;
    })}
  </section>;
};
