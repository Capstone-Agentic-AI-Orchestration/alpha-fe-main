import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, GitBranch, Workflow } from 'lucide-react';

import { useApp } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { RepoBranch, RepoPullRequest } from '@/shared/types';
import { BranchSwitcher } from './BranchSwitcher';
import { PipelineStrip } from './PipelineStrip';
import { RepoFileBrowser } from './RepoFileBrowser';
import { RepoPullsList } from './RepoPullsList';
import { RepoRunsList } from './RepoRunsList';
import { defaultBranch } from './repoFormat';
import { SectionError, SectionLoading } from './SectionState';
import { useRepoResource } from './useRepoResource';

interface ProjectRepositoryViewProps {
  projectId: string;
  /** `owner/name`, from `GET /projects/:id/repos`. Render nothing when empty. */
  repositories: string[];
}

/** `acme/shop-be` → `shop-be`, which is what tells a pair apart. */
const shortName = (repo: string) => repo.split('/').pop() ?? repo;

/**
 * Where a project's code stands: which stage of dev → uat → main it has
 * reached, what is on each branch, and what CI and review make of it.
 *
 * Everything is read through the API against GitHub; the only write is a
 * promotion, which opens a pull request rather than merging anything.
 */
export const ProjectRepositoryView: React.FC<ProjectRepositoryViewProps> = ({ projectId, repositories }) => {
  const { role } = useApp();
  const canPromote = role === 'pm' || role === 'admin';

  const [selectedRepo, setSelectedRepo] = useState<string | null>(repositories[0] ?? null);
  // The list can change under us (a repository created, the project switched).
  useEffect(() => {
    if (!selectedRepo || !repositories.includes(selectedRepo)) setSelectedRepo(repositories[0] ?? null);
  }, [repositories, selectedRepo]);

  if (!selectedRepo || repositories.length === 0) return null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Workflow className="h-4 w-4 text-brand-400" aria-hidden />
            Repository &amp; pipeline
          </h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Work lands on dev and moves to uat, then main, by pull request.
          </p>
        </div>

        {repositories.length > 1 && (
          // A paired project has a -be and a -fe: two halves of one thing, so
          // a pair of toggle buttons rather than a dropdown.
          <div role="group" aria-label="Repository" className="flex items-center rounded-lg border border-white/[0.08] bg-surface-raised p-0.5">
            {repositories.map(repo => {
              const active = repo === selectedRepo;
              return (
                <button
                  key={repo}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedRepo(repo)}
                  title={repo}
                  className={`rounded-md px-3 py-1 font-mono text-[11px] transition-colors ${
                    active ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {shortName(repo)}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Keyed by repository: branch choice, promotion outcomes and the open
          file all belong to one repository and must not carry across. */}
      <RepoPanel key={selectedRepo} projectId={projectId} repo={selectedRepo} canPromote={canPromote} />
    </div>
  );
};

const RepoPanel: React.FC<{ projectId: string; repo: string; canPromote: boolean }> = ({
  projectId,
  repo,
  canPromote
}) => {
  const branches = useRepoResource<{ branches: RepoBranch[] }>(
    () => apiService.getRepoBranches(projectId, repo),
    `${projectId}|${repo}|branches`
  );
  const pulls = useRepoResource<{ pullRequests: RepoPullRequest[] }>(
    () => apiService.getRepoPulls(projectId, repo, 'open'),
    `${projectId}|${repo}|pulls`
  );

  const branchList = useMemo(() => branches.data?.branches ?? [], [branches.data]);
  const branchNames = useMemo(() => branchList.map(b => b.name), [branchList]);
  const [branch, setBranch] = useState<string | null>(null);

  // Default to dev, and fall back again if the chosen branch disappears
  // (an agent branch deleted after its pull request merged).
  useEffect(() => {
    if (branchList.length === 0) return;
    if (!branch || !branchNames.includes(branch)) setBranch(defaultBranch(branchList));
  }, [branchList, branchNames, branch]);

  const switcherId = `repo-branch-${repo.replace(/[^A-Za-z0-9_-]/g, '-')}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BranchSwitcher
          id={switcherId}
          branches={branchList}
          value={branch}
          onChange={setBranch}
          disabled={branches.loading && !branches.data}
        />
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-400 transition-colors hover:text-white"
        >
          <GitBranch className="h-3.5 w-3.5" aria-hidden />
          {repo}
          <ExternalLink className="h-3 w-3" aria-hidden />
          <span className="sr-only">(opens GitHub)</span>
        </a>
      </div>

      {branches.loading && !branches.data ? (
        <div className="rounded-xl border border-white/[0.06] bg-surface-200/50">
          <SectionLoading label="Loading branches…" />
        </div>
      ) : branches.error ? (
        <div className="rounded-xl border border-white/[0.06] bg-surface-200/50">
          <SectionError message={branches.error} onRetry={branches.reload} />
        </div>
      ) : branchList.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-surface-200/50 px-3.5 py-4 text-[11px] text-gray-500">
          This repository has no branches yet — push a first commit to dev.
        </p>
      ) : (
        <>
          <PipelineStrip
            projectId={projectId}
            repo={repo}
            branchNames={branchNames}
            selectedBranch={branch}
            onSelectBranch={setBranch}
            canPromote={canPromote}
            onPromoted={pulls.reload}
          />

          {branch && (
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_24rem]">
              <RepoFileBrowser key={branch} projectId={projectId} repo={repo} branch={branch} />
              <div className="grid content-start gap-4 lg:grid-cols-2 2xl:grid-cols-1">
                <RepoRunsList projectId={projectId} repo={repo} branch={branch} />
                <RepoPullsList repo={repo} pulls={pulls} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
