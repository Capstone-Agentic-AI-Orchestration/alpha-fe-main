import { LoadingRows } from '@/shared/components/ui/skeleton';
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { OrchestrationPlanPreview } from '../project-build-review/OrchestrationPlanPreview';
import { PlanBody, ReviewBody, ReviewSection, buildChangesCode, buildPublications, buildReviewSummary } from './ChatBuildBodies';
import { OrchestratorReport, buildRepositoriesLabel } from './ChatBuildWizard';
import { approvalBlocker } from './useBuildApproval';
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
    void apiService.getProjectBuildSnapshot(projectId, runId, threadId).then(snapshot => {
      if (cancelled) return;
      const orchestration = snapshot.orchestration;
      if (!orchestration || orchestration.run.id !== runId || !snapshotBelongsToThread(snapshot, threadId)) throw new Error('This review does not belong to this conversation.');
      setBuild({ runId, status: orchestration.run.status, revision: orchestration.run.revision, repository: orchestration.run.repository,
        goal: orchestration.run.goal, running: false, canControl: false, agents: buildAgentNodes(snapshot), orchestration });
    }).catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'The saved review could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, runId, threadId, retry]);
  if (error) return <div className="space-y-2 p-4"><p role="alert" className="text-xs text-status-danger">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="text-xs text-link underline">Retry</button></div>;
  if (!build) return <LoadingRows label="Loading saved review" layout="detail" className="px-4" />;
  return <BuildReviewTab key={runId + ':' + build.revision} projectId={projectId} build={build} canStart={false} canApprove={false} busy={false} error={null} />;
};

/** The build's place in review, as one short pill. */
function reviewStatus(status: ProjectLiveBuild['status']): { label: string; tone: string } {
  switch (status) {
    case 'awaiting_plan_approval': return { label: 'Plan ready', tone: 'border-status-warning-border text-status-warning' };
    case 'awaiting_approval': return { label: 'Ready for your review', tone: 'border-status-success-border text-status-success' };
    case 'publishing': return { label: 'Opening pull request', tone: 'border-divider text-link' };
    case 'completed': return { label: 'Done', tone: 'border-status-success-border text-status-success' };
    default: return { label: status.replace(/_/g, ' '), tone: 'border-divider text-content-secondary' };
  }
}

function reviewTitle(status: ProjectLiveBuild['status']): string {
  if (status === 'awaiting_plan_approval') return 'Plan approval';
  if (status === 'awaiting_approval') return 'Build review';
  return status === 'completed' ? 'Completed report' : 'Build progress';
}

function Stat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="rounded-lg border border-divider bg-surface-raised px-3 py-2">
    <div className={'text-sm font-semibold ' + (good ? 'text-status-success' : 'text-status-warning')}>{value}</div>
    <div className="text-[10px] text-content-muted">{label}</div>
  </div>;
}

/**
 * Read-only view of the displayed revision: plan, progress, checks and changes.
 * Every decision (start, approve, ask for changes, retry) is made in the chat, so the
 * footer only says where to make it and, while publishing, why it is stuck.
 */
export const BuildReviewTab: React.FC<BuildReviewTabProps> = ({ projectId, build, canStart, canApprove, busy, error }) => {
  const planning = build.status === 'awaiting_plan_approval';
  const reviewing = build.status === 'awaiting_approval';
  const publishing = build.status === 'publishing';
  const stoppedReason = build.orchestration.run.stoppedReason;
  const changesCode = buildChangesCode(build.orchestration);
  const showsReview = ['awaiting_approval', 'publishing'].includes(build.status) || (build.status === 'completed' && changesCode);
  const blocker = reviewing ? approvalBlocker(build.orchestration, canApprove) : null;
  const publications = buildPublications(build.orchestration);
  const summary = buildReviewSummary(build.orchestration);
  const pill = reviewStatus(build.status);
  const repositories = buildRepositoriesLabel(build).split(', ').filter(Boolean);
  return <section aria-label="Build review" className="flex min-h-0 flex-1 flex-col">
    <header className="shrink-0 space-y-2 border-b border-divider px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-content">{reviewTitle(build.status)}</h2>
        <span className={'shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ' + pill.tone}>{pill.label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {repositories.map(name => <span key={name} className="rounded-md bg-well px-2 py-0.5 font-mono text-[10px] text-content-secondary">{name}</span>)}
        <span className="text-[10px] text-content-muted">Revision {build.revision}</span>
      </div>
    </header>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      {showsReview && <div className="grid grid-cols-3 gap-2" aria-label="Build summary">
        <Stat label="tasks done" value={`${summary.tasksDone}/${summary.tasksTotal}`} good={summary.tasksDone === summary.tasksTotal} />
        <Stat label="checks passed" value={`${summary.checksPassed}/${summary.checksTotal}`} good={summary.checksTotal > 0 && summary.checksPassed === summary.checksTotal} />
        <Stat label={summary.openFindings === 1 ? 'open finding' : 'open findings'} value={String(summary.openFindings)} good={summary.openFindings === 0} />
      </div>}
      {publications.length > 0 && <div className="space-y-1.5 rounded-lg border border-status-success-border bg-status-success-subtle px-3 py-2.5">
        <div className="text-xs font-semibold text-status-success">{publications.length === 1 ? 'Pull request opened' : 'Pull requests opened'}</div>
        {publications.map(publication => <a key={publication.pullRequestUrl} href={publication.pullRequestUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-link underline">{publication.repository ?? build.repository} · Open pull request</a>)}
      </div>}
      <ReviewSection title="Plan"><OrchestrationPlanPreview projectId={projectId} runId={build.runId} planVersion={build.orchestration.run.planVersion} autoShow={false} /></ReviewSection>
      {/* While publishing, the footer carries the reason. */}
      {stoppedReason && !publishing && <p role="alert" className="whitespace-pre-wrap rounded-lg border border-status-warning-border bg-status-warning-subtle p-3 text-xs leading-5 text-status-warning">{stoppedReason}</p>}
      {planning && <PlanBody orchestration={build.orchestration} />}
      {!planning && showsReview && <ReviewBody projectId={projectId} orchestration={build.orchestration} readOnly />}
      {!planning && !showsReview && <OrchestratorReport build={build} />}
      {/* The review lists each task's report in its own row; other views list them here. */}
      {!planning && !showsReview && build.orchestration.tasks.map(task => {
        const attempts = build.orchestration.attempts.filter(attempt => attempt.taskId === task.id);
        const attempt = [...attempts].reverse().find(item => item.status === 'accepted') ?? attempts.at(-1);
        if (!attempt?.report) return null;
        return <details key={task.id} className="rounded-lg border border-divider p-3" open={build.status === 'completed'}>
          <summary className="cursor-pointer text-xs font-medium text-content">{task.ownerName} · {task.title}</summary>
          {attempt.summary && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-content-secondary">{attempt.summary}</p>}
          <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-5 text-content-secondary">{attempt.report.deliverables.map((item, index) => <li key={index} className="whitespace-pre-wrap break-words">{item.summary}{item.paths.length > 0 && <span className="block font-mono text-[10px] text-link">{item.paths.join(', ')}</span>}</li>)}</ul>
        </details>;
      })}
      {build.status === 'completed' && !changesCode && <p className="text-xs text-status-success">Read-only investigation complete. Its reports are above; no pull request is needed.</p>}
    </div>
    {(planning || reviewing || publishing) && <div className="shrink-0 space-y-2 border-t border-divider bg-shell p-4">
      {planning && <p className="text-xs leading-5 text-content-secondary">Read the plan here, then tell Alpha in the main chat whether to start it. You can use your own words.</p>}
      {planning && !canStart && <p className="text-[11px] text-status-warning">Your workspace role cannot start builds.</p>}
      {reviewing && <p className="text-xs leading-5 text-content-secondary">Approve or ask for changes in the chat</p>}
      {blocker && <p className="text-[11px] text-status-warning">{blocker}</p>}
      {publishing && (stoppedReason
        ? <p role="alert" className="whitespace-pre-wrap text-xs leading-5 text-status-warning">{stoppedReason}</p>
        : <p aria-live="polite" className="flex items-center gap-1.5 text-xs text-link"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Opening the pull request…</p>)}
      {busy && <p aria-live="polite" className="text-xs text-content-secondary">Processing the main-chat decision…</p>}
      {error && <p role="alert" className="text-xs text-status-danger">{error}</p>}
    </div>}
  </section>;
};
