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
      return <article key={recovery.runId} className={`overflow-hidden rounded-2xl border ${unresolved ? 'border-status-warning-border bg-status-warning-subtle' : 'border-status-success-border bg-status-success-subtle'}`}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex min-w-0 gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${unresolved ? 'border-status-warning-border bg-status-warning-subtle text-status-warning' : 'border-status-success-border bg-status-success-subtle text-status-success'}`}>
              {unresolved ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-content">{statusLabel(recovery.state)}</h2>
                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${unresolved ? 'border-status-warning-border bg-status-warning-subtle text-status-warning' : 'border-status-success-border bg-status-success-subtle text-status-success'}`}>
                  {recovery.state === 'retained' ? 'Repository unlocked' : 'Repository paused'}
                </span>
              </div>
              <p className="mt-1.5 max-w-3xl text-xs leading-5 text-content-secondary">{recovery.reason}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-content-muted">
                <span className="max-w-full truncate font-medium text-content-secondary">{recovery.repository}</span>
                <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{recovery.branchName}</span>
                <span>Reserved from {shortCommit(recovery.baseCommit)}</span>
                <span>{new Date(recovery.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              {recovery.state === 'interrupted' && <p className="mt-3 text-[10px] leading-4 text-content-secondary">No task plan was activated, so no specialist started. Alpha will remove the workspace only if its branch and contents still match the clean reservation.</p>}
              {recovery.state === 'manual_review' && <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-status-warning"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />Alpha kept this folder unchanged while it checks that it belongs to this build. Reconnect the same repository and recheck; any issue found will be explained above.</p>}
              {recovery.state === 'retained' && <p className="mt-3 text-[10px] leading-4 text-status-success">The saved workspace remains on this desktop. New work can use the repository; it will not include these saved changes automatically.</p>}
              {recovery.state === 'cleaned' && <p className="mt-3 text-[10px] leading-4 text-status-success">Alpha verified the interrupted planning workspace was clean, removed it safely, and released the repository lock.</p>}
            </div>
          </div>

          {canManage && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {['interrupted', 'manual_review'].includes(recovery.state) && <button type="button" onClick={() => void runAction(recovery.runId, async () => {
              const result = await apiService.inspectOrchestrationPlanningRecovery(projectId, recovery.runId);
              if (result.state === 'needs_review' || result.state === 'manual_review') {
                setErrorByRunId(current => ({ ...current, [recovery.runId]: '' }));
              }
            })} disabled={Boolean(busyRunId)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-status-warning-border bg-status-warning-subtle px-3 text-xs font-semibold text-status-warning transition hover:bg-status-warning-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait disabled:opacity-50">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}{busy ? 'Checking saved work…' : recovery.state === 'interrupted' ? 'Inspect saved work' : 'Recheck workspace'}
            </button>}
            {recovery.canPreview && <button type="button" onClick={() => preview ? setPreviewByRunId(current => ({ ...current, [recovery.runId]: null })) : void loadPreview(recovery)} disabled={busy} aria-expanded={Boolean(preview)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-divider px-3 text-xs font-medium text-content transition hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">
              {busy && !preview ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className={`h-3.5 w-3.5 transition-transform ${preview ? 'rotate-180' : ''}`} />}{preview ? 'Hide saved changes' : 'Review saved changes'}
            </button>}
            {recovery.state === 'needs_review' && <button type="button" onClick={() => setConfirmRunId(confirming ? null : recovery.runId)} disabled={Boolean(busyRunId)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-status-success-border bg-status-success-subtle px-3 text-xs font-semibold text-status-success transition hover:bg-status-success-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />Keep files and unlock
            </button>}
          </div>}
        </div>

        {preview && <div className="border-t border-divider px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-xs font-semibold text-content">Saved workspace preview</div><p className="mt-1 text-[10px] text-content-muted">Compared with {shortCommit(preview.baseCommit)} · current HEAD {shortCommit(preview.headCommit)} · {preview.changedPaths.length}{preview.pathsTruncated ? '+' : ''} changed paths</p></div>
            {preview.truncated && <span className="rounded-md border border-status-warning-border px-2 py-1 text-[9px] text-status-warning">Preview shortened</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Changed files in saved workspace">
            {preview.changedPaths.map(file => <code key={file} className="max-w-full truncate rounded-md border border-divider bg-surface-raised px-1.5 py-1 text-[10px] text-content-secondary">{file}</code>)}
            {!preview.changedPaths.length && <span className="text-[10px] text-content-muted">No file changes are visible in this preview.</span>}
          </div>
          {preview.diff && <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-divider bg-code p-3 font-mono text-[10px] leading-5 text-content-secondary" tabIndex={0} aria-label="Saved workspace diff">{preview.diff}</pre>}
          {!preview.diff && <p className="mt-3 rounded-lg border border-divider bg-well px-3 py-2 text-[10px] leading-4 text-content-secondary">The branch or file state changed, but there is no text diff to display. Keep the saved workspace if you need to inspect it later.</p>}
          {preview.pathsTruncated && <p className="mt-2 text-[10px] text-content-muted">Only the first 200 changed paths are listed.</p>}
        </div>}

        {confirming && <div role="group" aria-label="Confirm keeping saved workspace" className="border-t border-status-success-border bg-status-success-subtle px-4 py-3 sm:px-5">
          <p className="text-xs leading-5 text-status-success">Keep this workspace on the desktop and release the repository lock? Its changes will not be included in later builds automatically.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => void runAction(recovery.runId, () => apiService.retainOrchestrationPlanningRecovery(projectId, recovery.runId, recovery.revision))} disabled={Boolean(busyRunId)} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-status-success-subtle px-3 text-[11px] font-semibold text-status-success transition hover:bg-status-success-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">{busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{busy ? 'Keeping workspace…' : 'Confirm keep and unlock'}</button>
            <button type="button" onClick={() => setConfirmRunId(null)} disabled={Boolean(busyRunId)} className="min-h-9 rounded-lg px-3 text-[11px] text-content-secondary transition hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">Cancel</button>
          </div>
        </div>}
        {errorByRunId[recovery.runId] && <div role="alert" className="border-t border-status-danger-border bg-status-danger-subtle px-4 py-3 text-xs leading-5 text-status-danger sm:px-5">{errorByRunId[recovery.runId]}</div>}
      </article>;
    })}
  </section>;
};
