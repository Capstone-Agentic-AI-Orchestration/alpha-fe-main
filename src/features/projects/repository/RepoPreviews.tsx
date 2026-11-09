import { LoadingRows } from '@/shared/components/ui/skeleton';
import React, { useEffect, useRef, useState } from 'react';
import { Activity, ExternalLink, Eye, Loader2, MonitorPlay, ScrollText } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import type { BranchPreview, HealthResult, HostingPreviews, PipelineBranch } from '@/shared/types';
import { PIPELINE_BRANCHES } from '@/shared/types';
import { CopyButton } from '@/shared/components/CopyButton';
import { canFramePreview, previewFrameSandbox, previewUnavailableReason } from './previewRules';
import { describeRepoError, humanize } from './repoFormat';
import { RefreshButton, RepoSection, SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { useRepoResource } from './useRepoResource';
import { RepoLogs } from './deploymentLogs/RepoLogs';

/**
 * The live preview of one of a repository's hosted branches, picked from a
 * dropdown: a frontend branch's site, inline when its host allows being
 * framed, or a backend branch's health on request.
 *
 * The same component in the browser and the desktop app. On the desktop the
 * renderer's origin is `file://`, which no hosted preview shares, so the
 * frame is genuinely cross-origin in both.
 */
export const RepoPreviews: React.FC<{
  projectId: string;
  repo: string;
  active: boolean;
  onOpenHosting?: () => void;
}> = ({ projectId, repo, active, onOpenHosting }) => {
  const previews = useRepoResource<HostingPreviews>(
    () => apiService.getRepoHostingPreviews(projectId, repo),
    `${projectId}|${repo}|previews`
  );
  const autoRefreshCount = useRef(0);
  const [selectedBranch, setSelectedBranch] = useState<PipelineBranch | null>(null);
  const data = previews.data;
  const sorted = data
    ? [...data.previews].sort((a, b) => PIPELINE_BRANCHES.indexOf(a.branch) - PIPELINE_BRANCHES.indexOf(b.branch))
    : [];
  const selected = sorted.find(preview => preview.branch === selectedBranch) ?? sorted[0];
  const devPreview = data?.previews.find(preview => preview.branch === 'dev');
  const trackedPreview = devPreview ?? data?.previews[0];
  const terminalDeploy = /fail|error|cancel/i.test(trackedPreview?.deployStatus ?? '');
  const shouldAutoRefresh = Boolean(
    active &&
    data &&
    data.role === 'frontend' &&
    data.state !== 'unavailable' &&
    trackedPreview &&
    !trackedPreview.ready &&
    !terminalDeploy &&
    autoRefreshCount.current < 18
  );

  // A newly created Vercel project can be ready before its first branch
  // deployment is. Keep the preview current briefly so the user sees it come
  // online without having to leave the tab or keep pressing Refresh.
  useEffect(() => {
    if (!shouldAutoRefresh || previews.loading) return;
    const timer = window.setTimeout(() => {
      autoRefreshCount.current += 1;
      previews.reload();
    }, 8_000);
    return () => window.clearTimeout(timer);
  }, [active, shouldAutoRefresh, previews.loading, data, previews.reload]);

  return (
    <RepoSection
      id={`repo-previews-${repo}`}
      title="Previews"
      icon={<MonitorPlay className="h-3.5 w-3.5 text-link" aria-hidden />}
      actions={<RefreshButton onClick={previews.reload} loading={previews.loading} label="Refresh previews" />}
    >
      <div aria-busy={previews.loading}>
        {previews.loading && !data ? (
          <SectionLoading label="Loading previews" layout="list" />
        ) : previews.error ? (
          <SectionError message={previews.error} onRetry={previews.reload} />
        ) : !data || sorted.length === 0 ? (
          <div className="space-y-2 px-3.5 py-4">
            <p className="text-[11px] text-content-muted">
              {data?.state === 'unavailable'
                ? (data.error ?? 'Hosting is not available here.')
                : data?.state === 'failed'
                  ? (data.error ?? 'Hosting setup needs attention.')
                  : data?.state === 'partial'
                    ? 'Hosting is only partly set up. Review hosting setup above to finish it.'
                    : data?.state === 'not_set_up'
                      ? 'Hosting has not been set up yet. Review hosting setup above to start it.'
                      : 'No hosting status is available yet. Review hosting setup above.'}
            </p>
            {onOpenHosting && (
              <button
                type="button"
                onClick={onOpenHosting}
                className="rounded-lg bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-content transition-colors hover:bg-surface-high"
              >
                Review hosting setup
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {shouldAutoRefresh && (
              <p role="status" className="flex items-center gap-1.5 px-3.5 pt-3 text-[11px] text-content-secondary">
                <Loader2 className="h-3 w-3 motion-safe:animate-spin text-link" aria-hidden />
                {trackedPreview?.deployStatus
                  ? `${trackedPreview.branch} is ${humanize(trackedPreview.deployStatus).toLowerCase()}.`
                  : `Preparing the ${trackedPreview?.branch ?? 'dev'} preview.`}{' '}
                Refreshing automatically.
              </p>
            )}
            {!shouldAutoRefresh && autoRefreshCount.current >= 18 && trackedPreview && !trackedPreview.ready && !terminalDeploy && (
              <p role="status" className="px-3.5 pt-3 text-[11px] text-status-warning">
                The first preview is taking longer than expected. Use Refresh previews to check again.
              </p>
            )}
            <div className="p-3">
              {selected.surface === 'health' ? (
                <HealthCard
                  key={selected.branch}
                  projectId={projectId}
                  repo={repo}
                  preview={selected}
                  picker={<BranchPicker repo={repo} previews={sorted} selected={selected} onSelect={setSelectedBranch} />}
                />
              ) : (
                <PageCard
                  key={selected.branch}
                  preview={selected}
                  picker={<BranchPicker repo={repo} previews={sorted} selected={selected} onSelect={setSelectedBranch} />}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </RepoSection>
  );
};

/**
 * The Logs tab: the logs of each branch that is hosted, which is the same
 * list the previews are drawn from -- a backend has main and uat, a
 * frontend dev as well.
 */
export const RepoLogsTab: React.FC<{ projectId: string; repo: string; active: boolean }> = ({ projectId, repo, active }) => {
  const previews = useRepoResource<HostingPreviews>(
    () => apiService.getRepoHostingPreviews(projectId, repo),
    `${projectId}|${repo}|previews`
  );
  const branches = previews.data
    ? previews.data.previews
        .map(p => p.branch)
        .sort((a, b) => PIPELINE_BRANCHES.indexOf(a) - PIPELINE_BRANCHES.indexOf(b))
    : [];

  if (branches.length > 0) return <RepoLogs projectId={projectId} repo={repo} branches={branches} active={active} />;

  return (
    <RepoSection
      id={`repo-logs-${repo}`}
      title="Logs"
      icon={<ScrollText className="h-3.5 w-3.5 text-link" aria-hidden />}
      actions={<RefreshButton onClick={previews.reload} loading={previews.loading} label="Refresh logs" />}
    >
      {previews.loading && !previews.data ? (
        <SectionLoading label="Loading logs" layout="code" rows={8} />
      ) : previews.error ? (
        <SectionError message={previews.error} onRetry={previews.reload} />
      ) : (
        <SectionEmpty>
          {previews.data?.state === 'unavailable'
            ? (previews.data.error ?? 'Hosting is not available here.')
            : 'Nothing is hosted yet, so there are no logs. Set up hosting from the Previews tab.'}
        </SectionEmpty>
      )}
    </RepoSection>
  );
};

const statusLabel = (preview: BranchPreview): string =>
  preview.ready ? 'Live' : preview.deployStatus ? humanize(preview.deployStatus) : 'Not deployed';

/** Which hosted branch the preview shows; a plain label when there is only one. */
const BranchPicker: React.FC<{
  repo: string;
  previews: BranchPreview[];
  selected: BranchPreview;
  onSelect: (branch: PipelineBranch) => void;
}> = ({ repo, previews, selected, onSelect }) => {
  if (previews.length < 2) {
    return (
      <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-content-secondary">{selected.branch}</span>
    );
  }
  return (
    <>
      <label className="sr-only" htmlFor={`preview-branch-${repo}`}>
        Environment to preview
      </label>
      <select
        id={`preview-branch-${repo}`}
        value={selected.branch}
        onChange={e => onSelect(e.target.value as PipelineBranch)}
        className="rounded-md border border-divider bg-well px-2 py-1 font-mono text-[11px] text-content focus:border-control focus:outline-none"
      >
        {previews.map(preview => (
          <option key={preview.branch} value={preview.branch}>
            {preview.branch}
            {preview.branch === 'main' ? ' (production)' : ''} · {statusLabel(preview)}
          </option>
        ))}
      </select>
    </>
  );
};

const CardHeader: React.FC<{ preview: BranchPreview; picker: React.ReactNode }> = ({ preview, picker }) => (
  <div className="flex items-center justify-between gap-2 px-3 py-2">
    {picker}
    <span className={`flex items-center gap-1.5 text-[11px] ${preview.ready ? 'text-status-success' : 'text-content-muted'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${preview.ready ? 'bg-emerald-400' : 'bg-gray-600'}`} aria-hidden />
      {statusLabel(preview)}
    </span>
  </div>
);

const CardLinks: React.FC<{ preview: BranchPreview }> = ({ preview }) =>
  preview.url ? (
    <div className="flex min-w-0 items-center gap-1 px-3 py-2">
      <a
        href={preview.url}
        target="_blank"
        rel="noreferrer"
        title={preview.url}
        className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-link transition-colors hover:text-link-hover"
      >
        <span className="truncate">{preview.url.replace(/^https?:\/\//, '')}</span>
        <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden />
        <span className="sr-only">(opens site)</span>
      </a>
      <CopyButton value={preview.url} label={`${preview.branch} URL`} />
    </div>
  ) : null;

const PageCard: React.FC<{ preview: BranchPreview; picker: React.ReactNode }> = ({ preview, picker }) => {
  const [loaded, setLoaded] = useState(false);
  const framable = canFramePreview(preview);
  const sandbox = preview.url ? previewFrameSandbox(preview.url, window.location.origin) : '';

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-divider bg-well">
      <CardHeader preview={preview} picker={picker} />
      {framable && preview.url ? (
        <div className="relative border-y border-divider bg-surface-raised">
          <iframe
            title={`${preview.branch} preview`}
            src={preview.url}
            sandbox={sandbox}
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            className="block h-[70vh] min-h-[420px] w-full bg-white"
          />
          {!loaded && (
            <LoadingRows label="Loading preview" layout="detail" className="pointer-events-none absolute inset-0 bg-surface-raised px-5" />
          )}
        </div>
      ) : (
        <p className="flex items-start gap-1.5 border-y border-divider bg-surface-raised px-3 py-6 text-[11px] leading-relaxed text-content-secondary">
          <Eye className="mt-0.5 h-3 w-3 flex-shrink-0 text-content-muted" aria-hidden />
          {previewUnavailableReason(preview)}
        </p>
      )}
      <CardLinks preview={preview} />
    </article>
  );
};

const HealthCard: React.FC<{ projectId: string; repo: string; preview: BranchPreview; picker: React.ReactNode }> = ({
  projectId,
  repo,
  preview,
  picker
}) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<HealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setResult(await apiService.checkRepoHealth(projectId, repo, preview.branch));
    } catch (err) {
      setError(describeRepoError(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-divider bg-well">
      <CardHeader preview={preview} picker={picker} />
      <div className="space-y-2 border-y border-divider bg-surface-raised px-3 py-3">
        <p className="text-[11px] leading-relaxed text-content-secondary">
          A backend has no page to show. Check that it answers on{' '}
          <code className="font-mono text-content-secondary">/health</code> — a sleeping free-tier service can take up to a
          minute to wake.
        </p>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking || !preview.url}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-content transition-colors hover:bg-surface-high disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />
          ) : (
            <Activity className="h-3 w-3" aria-hidden />
          )}
          {checking ? 'Checking…' : 'Check health'}
        </button>
        <div aria-live="polite">
          {result && (
            <p className={`text-[11px] ${result.ok ? 'text-status-success' : 'text-status-warning'}`}>
              {result.ok
                ? `Healthy — answered ${result.status} in ${(result.latencyMs / 1000).toFixed(1)}s.`
                : (result.error ?? `Unhealthy — answered ${result.status ?? 'nothing'}.`)}
            </p>
          )}
          {error && <p className="text-[11px] text-status-warning">{error}</p>}
        </div>
      </div>
      <CardLinks preview={preview} />
    </article>
  );
};
