import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, Info, Loader2, Lock, Rocket } from 'lucide-react';

import { apiService, parseApiError } from '@/shared/services/apiService';
import { HostingStatus, PIPELINE_BRANCHES } from '@/shared/types';
import { CopyButton } from '@/shared/components/CopyButton';
import { describeRepoError, humanize, relativeTime, RunTone, RUN_TONE_CLASS } from './repoFormat';
import { RefreshButton, RepoSection, SectionError, SectionLoading } from './SectionState';
import { useRepoResource } from './useRepoResource';

const PLATFORM_LABEL: Record<'render' | 'vercel', string> = {
  render: 'Render',
  vercel: 'Vercel'
};

const STATE_PILL: Record<HostingStatus['state'], { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'bg-emerald-400/15 text-emerald-300' },
  partial: { label: 'Partially set up', className: 'bg-amber-400/15 text-amber-300' },
  not_set_up: { label: 'Not set up', className: 'bg-white/10 text-gray-400' },
  failed: { label: 'Failed', className: 'bg-rose-400/15 text-rose-300' },
  unavailable: { label: 'Unavailable', className: 'bg-white/10 text-gray-500' }
};

/**
 * Render and Vercel each report deploy status in their own vocabulary
 * (`live`/`build_failed` vs `READY`/`ERROR`/`BUILDING`), so this reads for
 * shape rather than matching an exact enum, and falls back to neutral.
 */
function deployTone(status: string): RunTone {
  const s = status.toLowerCase();
  if (/fail|error|cancel/.test(s)) return 'failure';
  if (/build|deploy|progress/.test(s)) return 'running';
  if (/queue|pending|init/.test(s)) return 'queued';
  if (/live|ready|success|active/.test(s)) return 'success';
  return 'neutral';
}

interface RepoHostingPanelProps {
  projectId: string;
  repo: string;
  /** Same permission as provisioning repositories; the server enforces it regardless. */
  canManage: boolean;
}

/**
 * Where a repository's code actually runs: Render for backends, Vercel for
 * frontends, wired up through the platform's own GitHub app rather than CI.
 *
 * This is the one place that answers "where do I see the secrets and
 * variables" — Alpha sets some of them itself (`managedByAlpha`), the rest
 * come from the platform, and none of them are ever re-readable once secret.
 */
export const RepoHostingPanel: React.FC<RepoHostingPanelProps> = ({ projectId, repo, canManage }) => {
  const hosting = useRepoResource<HostingStatus>(
    () => apiService.getRepoHosting(projectId, repo),
    `${projectId}|${repo}|hosting`
  );
  const data = hosting.data;

  const [running, setRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const runSetUp = async () => {
    setRunning(true);
    setActionError(null);
    try {
      const result = await apiService.setUpRepoHosting(projectId, repo);
      // Only a set-up knows how wiring the partner went; a plain status read does not.
      if (result.partnerWiring && !result.partnerWiring.ok) {
        setActionError(
          `Hosting is set up, but ${result.partner ?? 'the paired repository'} could not be updated with its URLs: ` +
            `${result.partnerWiring.error ?? 'unknown error'}. Retry to connect them.`
        );
      }
      hosting.reload();
    } catch (err) {
      const { status } = parseApiError(err);
      setActionError(status === 403 ? 'Only a project manager or admin can set up hosting.' : describeRepoError(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <RepoSection
      id={`repo-hosting-${repo}`}
      title="Hosting"
      icon={<Rocket className="h-3.5 w-3.5 text-brand-400" aria-hidden />}
      actions={
        <>
          {data?.platform && (
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
              {PLATFORM_LABEL[data.platform]}
            </span>
          )}
          {data && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATE_PILL[data.state].className}`}>
              {STATE_PILL[data.state].label}
            </span>
          )}
          <RefreshButton onClick={hosting.reload} loading={hosting.loading} label="Refresh hosting" />
        </>
      }
    >
      {/* Only the set-up outcome is announced (role="alert" below); a live
          region here would read the whole table out on every refresh. */}
      <div aria-busy={hosting.loading}>
        {hosting.loading && !data ? (
          <SectionLoading label="Loading hosting…" />
        ) : hosting.error ? (
          <SectionError message={hosting.error} onRetry={hosting.reload} />
        ) : !data ? (
          <SectionError message="No hosting information yet." onRetry={hosting.reload} />
        ) : (
          <HostingBody
            data={data}
            canManage={canManage}
            running={running}
            actionError={actionError}
            onSetUp={() => void runSetUp()}
          />
        )}
      </div>
    </RepoSection>
  );
};

const HostingBody: React.FC<{
  data: HostingStatus;
  canManage: boolean;
  running: boolean;
  actionError: string | null;
  onSetUp: () => void;
}> = ({ data, canManage, running, actionError, onSetUp }) => {
  const showSections = data.state === 'ready' || data.state === 'partial' || data.state === 'failed';
  const environments = [...data.environments].sort(
    (a, b) => PIPELINE_BRANCHES.indexOf(a.branch) - PIPELINE_BRANCHES.indexOf(b.branch)
  );

  return (
    <div className="divide-y divide-white/[0.06]">
      {data.state === 'unavailable' && (
        <p className="flex items-start gap-1.5 px-3.5 py-3 text-[11px] leading-relaxed text-gray-400">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-500" aria-hidden />
          Hosting isn't configured on the Alpha server yet (Render/Vercel tokens missing). An admin adds them to the
          Alpha API service.
        </p>
      )}

      {(data.state === 'not_set_up' || data.state === 'partial' || data.state === 'failed') && (
        <div className="space-y-2 px-3.5 py-3">
          <p
            className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${
              data.state === 'failed' ? 'text-amber-300' : 'text-gray-400'
            }`}
          >
            {data.state === 'failed' ? (
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
            ) : (
              <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-500" aria-hidden />
            )}
            <span className="break-words">
              {data.state === 'not_set_up' &&
                `This repository has no hosting set up yet. Alpha creates ${
                  data.platform ? `a ${PLATFORM_LABEL[data.platform]} service` : 'a hosting service'
                } and connects it to its paired repository, if there is one.`}
              {data.state === 'partial' &&
                'Hosting is partially set up — some environments or variables still need to be created.'}
              {data.state === 'failed' && (data.error || 'The last attempt to set up hosting failed.')}
            </span>
          </p>
          {canManage ? (
            <button
              type="button"
              onClick={onSetUp}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1.5 text-[11px] font-medium text-on-accent transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />
              ) : (
                <Rocket className="h-3 w-3" aria-hidden />
              )}
              {running ? 'Setting up… this can take up to a minute' : data.state === 'not_set_up' ? 'Set up hosting' : 'Retry'}
            </button>
          ) : (
            <p className="text-[11px] text-gray-500">Only a project manager or admin can set up hosting.</p>
          )}
        </div>
      )}

      {/* Outside the set-up block: a partner that could not be wired is reported
          even when this repository's own hosting came up ready. */}
      {actionError && (
        <p role="alert" className="px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-300">
          {actionError}
        </p>
      )}

      {showSections && (
        <>
          <ul className="divide-y divide-white/[0.04]">
            {environments.map(env => {
              const tone = env.latestDeploy ? RUN_TONE_CLASS[deployTone(env.latestDeploy.status)] : null;
              return (
                <li key={env.branch} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex-shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
                      {env.branch}
                    </span>
                    {env.url ? (
                      <span className="flex min-w-0 items-center gap-1">
                        <a
                          href={env.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-brand-400 transition-colors hover:text-brand-100"
                          title={env.url}
                        >
                          <span className="truncate">{env.url.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden />
                          <span className="sr-only">(opens site)</span>
                        </a>
                        <CopyButton value={env.url} label={`${env.branch} URL`} />
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500">No live URL yet</span>
                    )}
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-3">
                    {env.latestDeploy && tone && (
                      <span className={`inline-flex items-center gap-1.5 text-[11px] ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
                        {humanize(env.latestDeploy.status)}
                        {env.latestDeploy.createdAt && ` · ${relativeTime(env.latestDeploy.createdAt)}`}
                      </span>
                    )}
                    {env.dashboardUrl && (
                      <a
                        href={env.dashboardUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-gray-400 transition-colors hover:text-white"
                      >
                        Dashboard
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        <span className="sr-only">(opens dashboard)</span>
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
            {environments.length === 0 && (
              <li className="px-3.5 py-3 text-[11px] text-gray-500">No environments reported yet.</li>
            )}
          </ul>

          <p className="px-3.5 py-2.5 text-[11px] leading-relaxed text-gray-400">
            {data.partner ? (
              <>
                Connected to <span className="font-mono text-gray-300">{data.partner}</span> —{' '}
                {data.role === 'frontend'
                  ? 'this frontend calls that backend.'
                  : data.role === 'backend'
                  ? 'this backend accepts requests from that frontend.'
                  : 'the two are paired.'}
              </>
            ) : (
              'Not connected to a partner repository.'
            )}
          </p>

          <div className="space-y-1 px-3.5 py-2.5">
            <p className="text-[10px] text-gray-500">Environment variables</p>
            {data.envVars.length === 0 ? (
              <p className="text-[11px] text-gray-500">None.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.envVars.map(v => (
                  <li key={`${v.scope}-${v.key}`} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <code className="truncate font-mono text-[11px] text-gray-200">{v.key}</code>
                      <span className="flex-shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-gray-400">
                        {v.scope}
                      </span>
                      {v.managedByAlpha && (
                        <span className="flex-shrink-0 rounded bg-brand-500/15 px-1.5 py-px text-[10px] text-brand-400">
                          Set by Alpha
                        </span>
                      )}
                    </span>
                    {v.value === null ? (
                      <span className="flex flex-shrink-0 items-center gap-1 text-[11px] text-gray-500">
                        <Lock className="h-3 w-3" aria-hidden /> Secret — set
                      </span>
                    ) : (
                      <span className="flex min-w-0 flex-shrink items-center gap-1.5">
                        <code className="max-w-[10rem] truncate font-mono text-[11px] text-gray-200" title={v.value}>
                          {v.value}
                        </code>
                        <CopyButton value={v.value} label={v.key} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5 px-3.5 py-2.5">
            <p className="text-[10px] text-gray-500">GitHub Actions</p>
            {data.github.secrets.length === 0 && data.github.variables.length === 0 ? (
              <p className="text-[11px] text-gray-500">None.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.github.secrets.map(name => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-gray-300"
                  >
                    <Lock className="h-2.5 w-2.5" aria-hidden /> {name} — set
                  </span>
                ))}
                {data.github.variables.map(v => (
                  <span
                    key={v.name}
                    className="max-w-full truncate rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-gray-300"
                    title={`${v.name}=${v.value}`}
                  >
                    {v.name}={v.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
