import React from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, GitMerge, Loader2, MessageSquare, RotateCw, ShieldCheck } from 'lucide-react';

import type { ProjectBuildOrchestration } from '@/shared/types';
import { buildChangesCode, buildPublications, buildReviewSummary, buildReviewSummaryText } from './ChatBuildBodies';
import { useBuildApproval } from './useBuildApproval';
import { useDevMerge } from './useDevMerge';

export interface BuildNextStepCardProps {
  projectId: string;
  orchestration: ProjectBuildOrchestration;
  canApprove: boolean;
  /** Open the Build review tab on the right. */
  onReview: () => void;
  /** Put a change request in the message box. */
  onAskChanges: () => void;
  /** Refresh the build after it was approved. */
  onApproved?: () => void | Promise<void>;
}

const primary = 'inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-action px-3 text-[11px] font-semibold text-on-action hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-divider px-3 text-[11px] font-medium text-content hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * Where a build stands and the one thing to do next, under the build's own message,
 * so it scrolls with the conversation instead of sitting over the message box.
 * Shown once the work is finished; a running build has its activity row above.
 */
export const BuildNextStepCard: React.FC<BuildNextStepCardProps> = ({ projectId, orchestration, canApprove, onReview, onAskChanges, onApproved }) => {
  const { approve, busy, error, blocker } = useBuildApproval(projectId, orchestration, canApprove, onApproved);
  const status = orchestration.run.status;
  const publications = buildPublications(orchestration);

  if (status === 'awaiting_approval') {
    const summary = buildReviewSummary(orchestration);
    return <section aria-label="Next step" className="mt-2 rounded-xl border border-status-success-border bg-surface-raised px-3.5 py-3 text-left">
      <div className="flex items-center gap-2 text-xs font-semibold text-content"><CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />Build finished · ready for your review</div>
      <p className="mt-1 text-[11px] text-content-secondary">{buildReviewSummaryText(summary)}</p>
      <p className="mt-2 text-[11px] text-content"><span className="font-semibold">Next:</span> review the changes, then approve to push them and open the pull request.</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onReview} className={secondary}><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Review changes</button>
        {!blocker && <button type="button" onClick={() => { approve().catch(() => undefined); }} disabled={busy} className={primary}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}{busy ? 'Approving…' : 'Approve and open pull request'}
        </button>}
        <button type="button" onClick={onAskChanges} className={secondary}><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />Ask for changes</button>
      </div>
      {/* Why approval is not offered, rather than a button that cannot be pressed. */}
      {blocker && <p className="mt-2 text-[10px] text-status-warning">{blocker}</p>}
      {error && <p role="alert" className="mt-2 text-[10px] text-status-danger">{error}</p>}
      <p className="mt-2 text-[10px] text-content-muted">You can also reply in the chat, for example "push it" or what to change.</p>
    </section>;
  }

  if (status === 'publishing') {
    const reason = orchestration.run.stoppedReason;
    if (!reason) return <section aria-label="Next step" aria-live="polite" className="mt-2 flex items-center gap-2 rounded-xl border border-divider bg-surface-raised px-3.5 py-3 text-[11px] text-link">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Opening the pull request…
    </section>;
    // Publishing stopped. Approving the same revision again is how a publication is retried:
    // it continues the unfinished steps without opening duplicate pull requests.
    return <section aria-label="Next step" className="mt-2 rounded-xl border border-status-warning-border bg-surface-raised px-3.5 py-3 text-left">
      <div className="flex items-center gap-2 text-xs font-semibold text-content"><AlertTriangle className="h-4 w-4 shrink-0 text-status-warning" aria-hidden="true" />The pull request was not opened</div>
      <p role="alert" className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-status-warning">{reason}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {!blocker && <button type="button" onClick={() => { approve().catch(() => undefined); }} disabled={busy} className={primary}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}{busy ? 'Retrying…' : 'Retry'}
        </button>}
        <span className="text-[10px] text-content-muted">or reply 'retry' in the chat</span>
      </div>
      {blocker && <p className="mt-2 text-[10px] text-status-warning">{blocker}</p>}
      {error && <p role="alert" className="mt-2 text-[10px] text-status-danger">{error}</p>}
    </section>;
  }

  if (status !== 'completed') return null;
  return <CompletedNextStep projectId={projectId} orchestration={orchestration} publications={publications} />;
};

/** A finished build: what it opened, and the next step, which is to merge it into dev. */
function CompletedNextStep({ projectId, orchestration, publications }: {
  projectId: string;
  orchestration: ProjectBuildOrchestration;
  publications: ReturnType<typeof buildPublications>;
}) {
  const { merge, busy, outcome: mergeResult } = useDevMerge(projectId, orchestration.run.id);
  let outcome = 'build complete';
  if (publications.length) outcome = publications.length === 1 ? 'pull request opened' : 'pull requests opened';

  if (!buildChangesCode(orchestration)) {
    return <section aria-label="Next step" className="mt-2 rounded-xl border border-divider bg-surface-raised px-3.5 py-3 text-[11px] text-content-secondary">
      <div className="flex items-center gap-2 text-xs font-semibold text-content"><CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" />Investigation complete</div>
      <p className="mt-1">No code changed, so no pull request is needed. The reports are in the Build review tab.</p>
    </section>;
  }

  return <section aria-label="Next step" className="mt-2 rounded-xl border border-status-success-border bg-surface-raised px-3.5 py-3 text-left">
    <div className="flex items-center gap-2 text-xs font-semibold text-content"><CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />Done · {outcome}</div>
    {publications.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{publications.map(publication => <a key={publication.pullRequestUrl} href={publication.pullRequestUrl} target="_blank" rel="noopener noreferrer" className={secondary}>
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{publications.length > 1 ? `${publication.repository ?? 'Repository'} pull request` : 'Open the pull request'}
    </a>)}</div>}
    <p className="mt-2 text-[11px] text-content"><span className="font-semibold">Next:</span> {publications.length
      ? 'merge it into dev once its checks pass, here or by saying "merge it" in the chat. Open the web preview to see the result.'
      : 'open the Build review tab for the report.'}</p>
    {publications.length > 0 && !mergeResult?.merged && <div className="mt-2.5"><button type="button" onClick={() => void merge()} disabled={busy} className={primary}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />}{busy ? 'Merging…' : 'Merge into dev'}
    </button></div>}
    {/* The result, or the server's reason it did not merge, stays next to the button. */}
    {mergeResult && <p role={mergeResult.merged ? 'status' : 'alert'} className={'mt-2 text-[10px] ' + (mergeResult.merged ? 'text-status-success' : 'text-status-danger')}>{mergeResult.message}</p>}
  </section>;
}
