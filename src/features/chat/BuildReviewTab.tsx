import React, { useEffect, useState } from 'react';
import { OrchestrationPlanPreview } from '../live-build-room/OrchestrationPlanPreview';
import { PlanBody, ReviewBody } from './ChatBuildBodies';
import { OrchestratorReport } from './ChatBuildWizard';
import type { ProjectLiveBuild } from './useProjectLiveBuild';
import { buildAgentNodes, snapshotBelongsToThread } from './useProjectLiveBuild';
import { apiService } from '@/shared/services/apiService';

export interface BuildReviewTabProps {
  projectId: string;
  build: ProjectLiveBuild;
  canStart: boolean;
  canApprove: boolean;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onApprove: () => void;
}

/** Older reviews stay readable in their tab after a later build starts. */
export const SavedBuildReviewTab: React.FC<{ projectId: string; runId: string; threadId: string }> = ({ projectId, runId, threadId }) => {
  const [build, setBuild] = useState<ProjectLiveBuild | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setBuild(null);
    setError('');
    void apiService.getLiveBuildRoom(projectId, runId, threadId).then(snapshot => {
      if (cancelled) return;
      const orchestration = snapshot.orchestration;
      if (!orchestration || orchestration.run.id !== runId || !snapshotBelongsToThread(snapshot, threadId)) throw new Error('This review does not belong to this conversation.');
      setBuild({ runId, status: orchestration.run.status, revision: orchestration.run.revision, repository: orchestration.run.repository,
        goal: orchestration.run.goal, running: false, canControl: false, agents: buildAgentNodes(snapshot), orchestration });
    }).catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'The saved review could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, runId, threadId, retry]);
  if (error) return <div className="space-y-2 p-4"><p role="alert" className="text-xs text-status-danger">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="text-xs text-link underline">Retry</button></div>;
  if (!build) return <p role="status" className="p-4 text-xs text-content-secondary">Loading saved review…</p>;
  return <BuildReviewTab key={runId + ':' + build.revision} projectId={projectId} build={build} canStart={false} canApprove={false} busy={false} error={null} onStart={() => undefined} onApprove={() => undefined} />;
};

/** Explicit approval of the currently displayed revision, alongside its evidence. */
export const BuildReviewTab: React.FC<BuildReviewTabProps> = ({ projectId, build, canStart, canApprove, busy, error, onStart, onApprove }) => {
  const [command, setCommand] = useState('');
  const [documentVersion, setDocumentVersion] = useState(0);
  const [diffReady, setDiffReady] = useState(false);
  const planning = build.status === 'awaiting_plan_approval';
  const reviewing = build.status === 'awaiting_approval';
  const retrying = build.status === 'publishing' && Boolean(error);
  const decision = planning ? 'start' : retrying ? 'retry publication' : 'approve';
  const blocking = build.orchestration.findings.some(item => item.status === 'open' && ['blocking', 'critical'].includes(item.severity));
  const allowed = planning ? canStart && documentVersion === build.orchestration.run.planVersion
    : canApprove && diffReady && !blocking && build.orchestration.finalValidation?.status === 'passed';
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!allowed || busy || command.trim().toLowerCase() !== decision) return;
    setCommand('');
    if (planning) onStart();
    else onApprove();
  };
  return <section aria-label="Build review" className="flex min-h-0 flex-1 flex-col">
    <header className="shrink-0 border-b border-divider px-4 py-3">
      <h2 className="text-sm font-semibold text-content">{planning ? 'Plan approval' : reviewing ? 'Build review' : build.status === 'completed' ? 'Completed report' : 'Build progress'}</h2>
      <p className="mt-1 break-words text-[11px] text-content-secondary">{build.repository} · Revision {build.revision}</p>
    </header>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <OrchestrationPlanPreview projectId={projectId} runId={build.runId} planVersion={build.orchestration.run.planVersion} autoShow={false} onReady={setDocumentVersion} />
      {build.orchestration.run.stoppedReason && <p role="alert" className="whitespace-pre-wrap rounded-lg border border-status-warning-border bg-status-warning-subtle p-3 text-xs leading-5 text-status-warning">{build.orchestration.run.stoppedReason}</p>}
      {planning ? <PlanBody orchestration={build.orchestration} />
        : ['awaiting_approval', 'publishing'].includes(build.status) || (build.status === 'completed' && build.orchestration.tasks.some(task => ['backend', 'frontend', 'database', 'mobile'].includes(task.kind)))
          ? <ReviewBody projectId={projectId} orchestration={build.orchestration} expandedDiff onDiffReady={() => setDiffReady(true)} />
          : <OrchestratorReport build={build} />}
      {!planning && build.orchestration.tasks.map(task => {
        const attempts = build.orchestration.attempts.filter(attempt => attempt.taskId === task.id);
        const attempt = [...attempts].reverse().find(item => item.status === 'accepted') ?? attempts.at(-1);
        if (!attempt?.report) return null;
        return <details key={task.id} className="rounded-lg border border-divider p-3" open={build.status === 'completed'}>
          <summary className="cursor-pointer text-xs font-medium text-content">{task.ownerName} · {task.title}</summary>
          {attempt.summary && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-content-secondary">{attempt.summary}</p>}
          <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-5 text-content-secondary">{attempt.report.deliverables.map((item, index) => <li key={index} className="whitespace-pre-wrap break-words">{item.summary}{item.paths.length > 0 && <span className="block font-mono text-[10px] text-link">{item.paths.join(', ')}</span>}</li>)}</ul>
        </details>;
      })}
      {build.status === 'completed' && !build.orchestration.tasks.some(task => ['backend', 'frontend', 'database', 'mobile'].includes(task.kind)) && <p className="text-xs text-status-success">Read-only investigation complete. Its reports are above; no pull request is needed.</p>}
    </div>
    {(planning || reviewing || retrying) && <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-divider bg-shell p-4">
      <p id="build-approval-help" className="text-xs leading-5 text-content-secondary">{planning
        ? 'Review the Markdown plan, then type start and press Enter to authorize the planned work.'
        : retrying ? 'Type retry publication and press Enter to resume the previously approved publication.'
          : 'Review the checks, findings and validated diff, then type approve and press Enter to authorize pushing this revision and creating its pull request.'}</p>
      {!(planning ? canStart : canApprove) && <p className="text-[11px] text-status-warning">{planning ? 'Your workspace role cannot start builds.' : 'A project manager or admin must approve publication.'}</p>}
      {blocking && !planning && <p className="text-[11px] text-status-warning">Blocking findings must be resolved before approval.</p>}
      <input aria-label={planning ? 'Plan approval command' : 'Publication approval command'} aria-describedby="build-approval-help" value={command} onChange={event => setCommand(event.target.value)} disabled={!allowed || busy} placeholder={busy ? 'Processing…' : decision} autoComplete="off" className="w-full rounded-lg border border-control bg-well px-3 py-2 text-sm text-content outline-none focus:border-control focus:ring-1 focus:ring-focus disabled:opacity-50" />
      {error && <p role="alert" className="text-xs text-status-danger">{error}</p>}
    </form>}
    {build.status === 'publishing' && !retrying && <p role="status" className="border-t border-divider p-4 text-xs text-link">Publishing the approved revision…</p>}
  </section>;
};
