import React from 'react';
import { ExternalLink, PlayCircle } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { RepoRun } from '@/shared/types';
import { relativeTime, RUN_TONE_CLASS, runState } from './repoFormat';
import { RefreshButton, RepoSection, SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { useRepoResource } from './useRepoResource';

/** CI runs on the selected branch, newest first as GitHub returns them. */
export const RepoRunsList: React.FC<{ projectId: string; repo: string; branch: string }> = ({
  projectId,
  repo,
  branch
}) => {
  const runs = useRepoResource<{ runs: RepoRun[] }>(
    () => apiService.getRepoRuns(projectId, repo, branch),
    `${projectId}|${repo}|${branch}|runs`
  );
  const list = runs.data?.runs ?? [];

  return (
    <RepoSection
      id={`repo-runs-${repo}`}
      title={`CI runs on ${branch}`}
      icon={<PlayCircle className="h-3.5 w-3.5 text-cyan-400" aria-hidden />}
      actions={<RefreshButton onClick={runs.reload} loading={runs.loading} label="Refresh CI runs" />}
    >
      <div aria-live="polite" aria-busy={runs.loading}>
        {runs.loading && !runs.data ? (
          <SectionLoading label="Loading runs…" />
        ) : runs.error ? (
          <SectionError message={runs.error} onRetry={runs.reload} />
        ) : list.length === 0 ? (
          <SectionEmpty>No CI runs on {branch} yet.</SectionEmpty>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {list.map(run => {
              const state = runState(run);
              const tone = RUN_TONE_CLASS[state.tone];
              return (
                <li key={run.id}>
                  <a
                    href={run.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between gap-3 px-3.5 py-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-white">{run.name}</span>
                      <span className="block truncate text-[10px] text-gray-500">
                        {run.event}
                        {run.createdAt && ` · ${relativeTime(run.createdAt)}`}
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
                        {state.label}
                      </span>
                      <ExternalLink className="h-3 w-3 text-gray-600 transition-colors group-hover:text-gray-300" aria-hidden />
                      <span className="sr-only">(opens GitHub)</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </RepoSection>
  );
};
