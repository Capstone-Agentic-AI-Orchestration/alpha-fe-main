import React from 'react';
import { ExternalLink, GitMerge, Loader2, RotateCw } from 'lucide-react';

import type { ProjectBuildOrchestration } from '@/shared/types';
import { buildChangesCode, buildPublications, buildReviewSummary, type BuildReviewSummary } from './ChatBuildBodies';
import { ResolvedWithoutYouSummary } from './ResolvedWithoutYou';
import { useBuildApproval } from './useBuildApproval';
import { useDevMerge } from './useDevMerge';

export interface BuildNextStepCardProps {
  projectId: string;
  orchestration: ProjectBuildOrchestration;
  canApprove: boolean;
  /** Open the build's changes on the right. */
  onReview: () => void;
  /** Put a change request in the message box, with these words when given. */
  onAskChanges: (prefill?: string) => void;
  /** Refresh the build after it was approved. */
  onApproved?: () => void | Promise<void>;
}

const primary = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-content px-3.5 text-[13px] font-medium text-shell hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-divider px-3.5 text-[13px] font-medium text-content hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

type Finding = ProjectBuildOrchestration['findings'][number];

/**
 * Open findings about the product: each names a file in the codebase. Notes about Alpha's own
 * records (a handoff and a patch that disagree) name none, and stay in the full build report.
 */
export function findingsToPolish(orchestration: ProjectBuildOrchestration): Finding[] {
  return orchestration.findings.filter(finding => finding.status === 'open' && Boolean(finding.path));
}

function tasksSentence(summary: BuildReviewSummary): string {
  if (summary.tasksTotal === 1) return summary.tasksDone === 1 ? 'The task is done' : 'The task is not done';
  if (summary.tasksDone === summary.tasksTotal) return `All ${summary.tasksTotal} tasks are done`;
  return `${summary.tasksDone} of ${summary.tasksTotal} tasks are done`;
}

function checksSentence(summary: BuildReviewSummary): string {
  if (!summary.checksTotal) return 'no checks were recorded';
  if (summary.checksPassed === summary.checksTotal) return 'every check passed';
  return `${summary.checksTotal - summary.checksPassed} of ${summary.checksTotal} checks failed`;
}

/** "The build is finished. All 3 tasks are done, and every check passed." */
export function finishedSentence(summary: BuildReviewSummary): string {
  return `The build is finished. ${tasksSentence(summary)}, and ${checksSentence(summary)}.`;
}

/** What "Polish them first" puts in the message box. */
export function polishRequest(findings: Finding[]): string {
  return ['Please polish these first:', ...findings.map(finding => `- ${finding.title ?? 'Finding'} (${finding.path})`)].join('\n');
}

/**
 * What comes after a build, in the conversation's own words, under the build's message:
 * how it went, what is worth polishing, and the question with its answers as plain buttons.
 */
export const BuildNextStepCard: React.FC<BuildNextStepCardProps> = props => {
  const status = props.orchestration.run.status;
  if (status === 'awaiting_approval') return <ReviewNextStep {...props} />;
  if (status === 'publishing') return <PublishingNextStep {...props} />;
  if (status !== 'completed') return null;
  return <CompletedNextStep projectId={props.projectId} orchestration={props.orchestration} publications={buildPublications(props.orchestration)} />;
};

/** A build waiting for review: how it went, what to polish, and whether to open the pull request. */
function ReviewNextStep({ projectId, orchestration, canApprove, onReview, onAskChanges, onApproved }: BuildNextStepCardProps) {
  const { approve, busy, error, blocker } = useBuildApproval(projectId, orchestration, canApprove, onApproved);
  const polish = findingsToPolish(orchestration);
  const question = polish.length
    ? 'Want me to open the pull request, or polish those first?'
    : 'Want me to open the pull request? You can also ask for changes first.';
  return <section aria-label="Next step" className="mt-3 space-y-3 text-left text-sm leading-relaxed text-content">
      <p>{finishedSentence(buildReviewSummary(orchestration))}</p>
      {/* What Alpha resolved on the person's behalf, before they approve it. */}
      <ResolvedWithoutYouSummary items={orchestration.resolvedWithoutYou} />
      {polish.length > 0 && <div>
        <p>{polish.length === 1 ? 'One thing you may want to polish first:' : `${polish.length} things you may want to polish first:`}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-content-secondary">
          {polish.map(finding => <li key={finding.id}>{finding.title ?? 'A review finding'} <code className="font-mono text-[12px] text-content-muted">{finding.path}</code></li>)}
        </ul>
      </div>}
      {blocker ? <p className="text-status-warning">{blocker}</p> : <p>{question}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!blocker && <button type="button" onClick={() => { approve().catch(() => undefined); }} disabled={busy} className={primary}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}{busy ? 'Opening…' : 'Open the pull request'}
        </button>}
        {polish.length > 0
          ? <button type="button" onClick={() => onAskChanges(polishRequest(polish))} className={secondary}>Polish them first</button>
          : <button type="button" onClick={() => onAskChanges()} className={secondary}>Ask for changes</button>}
        <button type="button" onClick={onReview} className="px-1 text-[13px] text-content-muted hover:text-content">Review the changes</button>
      </div>
      {error && <p role="alert" className="text-xs text-status-danger">{error}</p>}
    </section>;
}

/** Opening the pull request, or why it stopped and a retry. */
function PublishingNextStep({ projectId, orchestration, canApprove, onApproved }: BuildNextStepCardProps) {
  const { approve, busy, error, blocker } = useBuildApproval(projectId, orchestration, canApprove, onApproved);
  const reason = orchestration.run.stoppedReason;
  if (!reason) return <p aria-label="Next step" aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-content-secondary">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Opening the pull request…
    </p>;
    // Publishing stopped. Approving the same revision again is how a publication is retried:
    // it continues the unfinished steps without opening duplicate pull requests.
    return <section aria-label="Next step" className="mt-3 space-y-2 text-left text-sm text-content">
      <p>The pull request was not opened.</p>
      <p role="alert" className="whitespace-pre-wrap rounded-lg border border-status-warning-border bg-status-warning-subtle px-3 py-2 text-xs leading-5 text-status-warning">{reason}</p>
      <div className="flex flex-wrap items-center gap-2">
        {!blocker && <button type="button" onClick={() => { approve().catch(() => undefined); }} disabled={busy} className={primary}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}{busy ? 'Retrying…' : 'Retry'}
        </button>}
        <span className="text-xs text-content-muted">or reply 'retry' in the chat</span>
      </div>
      {blocker && <p className="text-xs text-status-warning">{blocker}</p>}
      {error && <p role="alert" className="text-xs text-status-danger">{error}</p>}
    </section>;
}

/** A finished build: what it opened, and the next step, which is to merge it into dev. */
function CompletedNextStep({ projectId, orchestration, publications }: {
  projectId: string;
  orchestration: ProjectBuildOrchestration;
  publications: ReturnType<typeof buildPublications>;
}) {
  const { merge, busy, outcome: mergeResult } = useDevMerge(projectId, orchestration.run.id);

  if (!buildChangesCode(orchestration)) {
    return <p aria-label="Next step" className="mt-3 text-sm text-content">
      The investigation is done. No code changed, so no pull request is needed. The reports are in the full build report.
    </p>;
  }

  let opened = 'The build is done.';
  if (publications.length) opened = publications.length === 1 ? 'The pull request is open.' : `${publications.length} pull requests are open.`;
  return <section aria-label="Next step" className="mt-3 space-y-3 text-left text-sm text-content">
    <p>{opened} {publications.length > 0 && 'Merge it into dev once its checks pass, here or by saying "merge it". Open the web preview to see the result.'}</p>
    <div className="flex flex-wrap items-center gap-2">
      {publications.length > 0 && !mergeResult?.merged && <button type="button" onClick={() => void merge()} disabled={busy} className={primary}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />}{busy ? 'Merging…' : 'Merge into dev'}
      </button>}
      {publications.map(publication => <a key={publication.pullRequestUrl} href={publication.pullRequestUrl} target="_blank" rel="noopener noreferrer" className={secondary}>
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{publications.length > 1 ? `${publication.repository ?? 'Repository'} pull request` : 'Open the pull request'}
      </a>)}
    </div>
    {/* The result, or the server's reason it did not merge, stays next to the button. */}
    {mergeResult && <p role={mergeResult.merged ? 'status' : 'alert'} className={'text-xs ' + (mergeResult.merged ? 'text-status-success' : 'text-status-danger')}>{mergeResult.message}</p>}
  </section>;
}
