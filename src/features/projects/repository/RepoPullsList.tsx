import React from 'react';
import { ExternalLink, GitPullRequest } from 'lucide-react';

import { RepoPullRequest } from '@/shared/types';
import { relativeTime } from './repoFormat';
import { RefreshButton, RepoSection, SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { RepoResource } from './useRepoResource';

/**
 * Open pull requests. The resource is owned by the parent so a promotion can
 * reload it the moment it opens one.
 */
export const RepoPullsList: React.FC<{ repo: string; pulls: RepoResource<{ pullRequests: RepoPullRequest[] }> }> = ({
  repo,
  pulls
}) => {
  const list = pulls.data?.pullRequests ?? [];

  return (
    <RepoSection
      id={`repo-pulls-${repo}`}
      title="Open pull requests"
      icon={<GitPullRequest className="h-3.5 w-3.5 text-emerald-400" aria-hidden />}
      actions={<RefreshButton onClick={pulls.reload} loading={pulls.loading} label="Refresh pull requests" />}
    >
      <div aria-live="polite" aria-busy={pulls.loading}>
        {pulls.loading && !pulls.data ? (
          <SectionLoading label="Loading pull requests…" />
        ) : pulls.error ? (
          <SectionError message={pulls.error} onRetry={pulls.reload} />
        ) : list.length === 0 ? (
          <SectionEmpty>No open pull requests.</SectionEmpty>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {list.map(pr => (
              <li key={pr.number}>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start justify-between gap-3 px-3.5 py-2 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="flex items-center gap-1.5 text-xs text-white">
                      <span className="tabular-nums text-gray-500">#{pr.number}</span>
                      <span className="truncate">{pr.title}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-gray-500">
                      <span className="font-mono text-gray-400">{pr.head} → {pr.base}</span>
                      {pr.promotion && (
                        <span className="rounded bg-brand-500/15 px-1.5 py-px text-brand-400">promotion</span>
                      )}
                      {pr.draft && <span>· draft</span>}
                      {pr.author && <span>· {pr.author}</span>}
                      {pr.createdAt && <span>· {relativeTime(pr.createdAt)}</span>}
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-600 transition-colors group-hover:text-gray-300" aria-hidden />
                  <span className="sr-only">(opens GitHub)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RepoSection>
  );
};
