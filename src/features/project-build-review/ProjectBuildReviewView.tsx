import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';

import { useApp } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import type { ProjectBuildSnapshot } from '@/shared/types';

import { OrchestrationDeliveryPanel } from '@/features/chat/OrchestrationDeliveryPanel';
import { OrchestrationWorkflowPanel } from './OrchestrationWorkflowPanel';

const REFRESHABLE_STATUSES = new Set([
  'planning', 'awaiting_plan_approval', 'executing', 'paused', 'validating',
  'awaiting_approval', 'publishing', 'cancelling', 'blocked', 'recovery_required'
]);

/**
 * Project-scoped build review for roles that do not use the developer chat.
 *
 * The API deliberately loads this by project, not by chat thread. That keeps
 * publication and UAT delivery available to PMs and admins even though build
 * conversations remain private to the developer who owns them.
 */
export const ProjectBuildReviewView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { can } = useApp();
  const [snapshot, setSnapshot] = useState<ProjectBuildSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const refresh = useCallback(async (showLoading = false) => {
    const request = ++requestRef.current;
    if (showLoading) setLoading(true);
    try {
      const next = await apiService.getProjectBuildSnapshot(projectId);
      if (request !== requestRef.current) return;
      setSnapshot(next);
      setError('');
    } catch (failure) {
      if (request !== requestRef.current) return;
      setError(failure instanceof Error ? failure.message : 'The project build review could not be loaded.');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh(true);
    const timer = window.setInterval(() => {
      const status = snapshot?.orchestration?.run.status;
      if (!status || REFRESHABLE_STATUSES.has(status)) void refresh();
    }, 8_000);
    return () => {
      window.clearInterval(timer);
      requestRef.current += 1;
    };
  }, [projectId, refresh, snapshot?.orchestration?.run.status]);

  const workflow = snapshot?.orchestration ?? null;
  const publicationExists = Boolean(workflow?.run.publication || workflow?.run.publications?.length);
  const canPublish = can('publish_build');
  const canControlUat = can('control_uat_delivery');

  const approve = async () => {
    if (!workflow || busy || !canPublish) return;
    setBusy(true);
    setError('');
    try {
      await apiService.approveOrchestration(projectId, workflow.run.id, workflow.run.revision);
      await refresh(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Publication could not be authorized. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !snapshot) {
    return <div role="status" className="flex items-center gap-2 p-6 text-xs text-content-secondary"><LoaderCircle className="h-4 w-4 animate-spin" />Loading the latest project build…</div>;
  }

  if (error && !workflow) {
    return <div className="space-y-3 p-6"><p role="alert" className="text-xs leading-5 text-status-danger">{error}</p><button type="button" onClick={() => void refresh(true)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-divider px-3 py-2 text-xs text-content-secondary hover:bg-surface-high disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Retry</button></div>;
  }

  if (!workflow) {
    return <div className="space-y-2 p-6"><p className="text-sm font-medium text-content">No project build is available yet.</p><p className="text-xs leading-5 text-content-secondary">A developer must start the Orchestrator build from the developer workspace before it can be reviewed and published here.</p></div>;
  }

  return <div className="min-h-0 space-y-3 overflow-y-auto p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-divider bg-surface-raised px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-content">Project build review</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-content-secondary">Review the validated change, then authorize publication. Publication opens the code pull request(s); it does not merge them or deploy production.</p>
      </div>
      <button type="button" onClick={() => void refresh(true)} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-lg border border-divider px-3 py-2 text-xs text-content-secondary hover:bg-surface-high disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
    </div>
    <OrchestrationWorkflowPanel
      projectId={projectId}
      workflow={workflow}
      canManage={false}
      canResume={false}
      canApprove={canPublish}
      publicationSynced={publicationExists}
      busyAction={busy ? 'approve' : null}
      actionError={error || null}
      onRetry={() => {}}
      onStartPlan={() => {}}
      onResume={() => {}}
      onPause={() => {}}
      onCancel={() => {}}
      onApprove={() => void approve()}
    />
    {workflow.run.status === 'completed' && publicationExists && canControlUat && (
      <OrchestrationDeliveryPanel projectId={projectId} runId={workflow.run.id} onRepairPrepared={() => void refresh(true)} />
    )}
  </div>;
};
