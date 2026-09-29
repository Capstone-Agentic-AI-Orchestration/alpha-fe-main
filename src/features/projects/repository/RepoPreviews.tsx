import React, { useEffect, useRef, useState } from 'react';
import { Activity, ExternalLink, Eye, Loader2, Maximize2, Minimize2, MonitorPlay } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import type { BranchPreview, HealthResult, HostingPreviews } from '@/shared/types';
import { PIPELINE_BRANCHES } from '@/shared/types';
import { CopyButton } from '@/shared/components/CopyButton';
import { canFramePreview, previewFrameSandbox, previewUnavailableReason } from './previewRules';
import { describeRepoError, humanize } from './repoFormat';
import { RefreshButton, RepoSection, SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { useRepoResource } from './useRepoResource';

/** The width a thumbnail is laid out at before it is scaled into its card. */
const THUMB_LAYOUT_WIDTH = 1280;
const THUMB_LAYOUT_HEIGHT = 800;

/**
 * Live previews of a repository's hosted branches: each frontend branch's
 * site, inline when its host allows being framed, or a backend branch's
 * health on request.
 *
 * The same component in the browser and the desktop app. On the desktop the
 * renderer's origin is `file://`, which no hosted preview shares, so the
 * frame is genuinely cross-origin in both.
 */
export const RepoPreviews: React.FC<{ projectId: string; repo: string }> = ({ projectId, repo }) => {
  const previews = useRepoResource<HostingPreviews>(
    () => apiService.getRepoHostingPreviews(projectId, repo),
    `${projectId}|${repo}|previews`
  );
  const data = previews.data;
  const sorted = data
    ? [...data.previews].sort((a, b) => PIPELINE_BRANCHES.indexOf(a.branch) - PIPELINE_BRANCHES.indexOf(b.branch))
    : [];

  return (
    <RepoSection
      id={`repo-previews-${repo}`}
      title="Previews"
      icon={<MonitorPlay className="h-3.5 w-3.5 text-brand-400" aria-hidden />}
      actions={<RefreshButton onClick={previews.reload} loading={previews.loading} label="Refresh previews" />}
    >
      <div aria-busy={previews.loading}>
        {previews.loading && !data ? (
          <SectionLoading label="Loading previews…" />
        ) : previews.error ? (
          <SectionError message={previews.error} onRetry={previews.reload} />
        ) : !data || sorted.length === 0 ? (
          <SectionEmpty>
            {data?.state === 'unavailable'
              ? data.error ?? 'Hosting is not available here.'
              : 'Nothing is hosted yet. Set up hosting to get a preview of each branch.'}
          </SectionEmpty>
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2">
            {sorted.map(preview =>
              preview.surface === 'health' ? (
                <HealthCard key={preview.branch} projectId={projectId} repo={repo} preview={preview} />
              ) : (
                <PageCard key={preview.branch} preview={preview} />
              )
            )}
          </div>
        )}
      </div>
    </RepoSection>
  );
};

const CardHeader: React.FC<{ preview: BranchPreview }> = ({ preview }) => (
  <div className="flex items-center justify-between gap-2 px-3 py-2">
    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-gray-300">{preview.branch}</span>
    <span className={`flex items-center gap-1.5 text-[11px] ${preview.ready ? 'text-emerald-300' : 'text-gray-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${preview.ready ? 'bg-emerald-400' : 'bg-gray-600'}`} aria-hidden />
      {preview.ready ? 'Live' : preview.deployStatus ? humanize(preview.deployStatus) : 'Not deployed'}
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
        className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-brand-400 transition-colors hover:text-brand-100"
      >
        <span className="truncate">{preview.url.replace(/^https?:\/\//, '')}</span>
        <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden />
        <span className="sr-only">(opens site)</span>
      </a>
      <CopyButton value={preview.url} label={`${preview.branch} URL`} />
    </div>
  ) : null;

/** Scale factor that fits the fixed-width layout into the card, kept current as the card resizes. */
function useFitScale(ref: React.RefObject<HTMLDivElement>): number {
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setScale(width / THUMB_LAYOUT_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

const PageCard: React.FC<{ preview: BranchPreview }> = ({ preview }) => {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(boxRef);
  const framable = canFramePreview(preview);
  const sandbox = preview.url ? previewFrameSandbox(preview.url, window.location.origin) : '';

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-white/[0.06] bg-black/20">
      <CardHeader preview={preview} />
      {framable && preview.url ? (
        expanded ? (
          <div className="relative border-y border-white/[0.06]">
            <iframe
              title={`${preview.branch} preview`}
              src={preview.url}
              sandbox={sandbox}
              referrerPolicy="no-referrer"
              className="h-[70vh] w-full bg-white"
            />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] text-gray-200 hover:bg-black/90"
            >
              <Minimize2 className="h-3 w-3" aria-hidden /> Shrink
            </button>
          </div>
        ) : (
          <div
            ref={boxRef}
            className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.02]"
            style={{ height: THUMB_LAYOUT_HEIGHT * scale }}
          >
            {!loaded && (
              <p className="absolute inset-0 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
                <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden /> Loading preview…
              </p>
            )}
            {/* A thumbnail, not the site: not focusable or clickable. `inert` is
                set through the ref because React 18 does not pass it through. */}
            <iframe
              ref={el => el?.setAttribute('inert', '')}
              title={`${preview.branch} preview thumbnail`}
              src={preview.url}
              sandbox={sandbox}
              referrerPolicy="no-referrer"
              loading="lazy"
              tabIndex={-1}
              onLoad={() => setLoaded(true)}
              className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white"
              style={{ width: THUMB_LAYOUT_WIDTH, height: THUMB_LAYOUT_HEIGHT, transform: `scale(${scale})` }}
            />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] text-gray-200 hover:bg-black/90"
            >
              <Maximize2 className="h-3 w-3" aria-hidden /> Open here
            </button>
          </div>
        )
      ) : (
        <p className="flex items-start gap-1.5 border-y border-white/[0.06] bg-white/[0.02] px-3 py-6 text-[11px] leading-relaxed text-gray-400">
          <Eye className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-500" aria-hidden />
          {previewUnavailableReason(preview)}
        </p>
      )}
      <CardLinks preview={preview} />
    </article>
  );
};

const HealthCard: React.FC<{ projectId: string; repo: string; preview: BranchPreview }> = ({ projectId, repo, preview }) => {
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
    <article className="min-w-0 overflow-hidden rounded-lg border border-white/[0.06] bg-black/20">
      <CardHeader preview={preview} />
      <div className="space-y-2 border-y border-white/[0.06] bg-white/[0.02] px-3 py-3">
        <p className="text-[11px] leading-relaxed text-gray-400">
          A backend has no page to show. Check that it answers on <code className="font-mono text-gray-300">/health</code>
          {' '}— a sleeping free-tier service can take up to a minute to wake.
        </p>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking || !preview.url}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-gray-200 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {checking ? <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden /> : <Activity className="h-3 w-3" aria-hidden />}
          {checking ? 'Checking…' : 'Check health'}
        </button>
        <div aria-live="polite">
          {result && (
            <p className={`text-[11px] ${result.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
              {result.ok
                ? `Healthy — answered ${result.status} in ${(result.latencyMs / 1000).toFixed(1)}s.`
                : result.error ?? `Unhealthy — answered ${result.status ?? 'nothing'}.`}
            </p>
          )}
          {error && <p className="text-[11px] text-amber-300">{error}</p>}
        </div>
      </div>
      <CardLinks preview={preview} />
    </article>
  );
};
