import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  FileCode2,
  GitBranch,
  GitPullRequest,
  KeyRound,
  LayoutDashboard,
  MonitorPlay,
  PlayCircle,
  ScrollText,
  Workflow,
  type LucideIcon
} from 'lucide-react';

import { useApp } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { RepoBranch, RepoPullRequest } from '@/shared/types';
import { BranchSwitcher } from './BranchSwitcher';
import { PipelineStrip } from './PipelineStrip';
import { RepoFileBrowser } from './RepoFileBrowser';
import { RepoHostingPanel } from './RepoHostingPanel';
import { RepoLogsTab, RepoPreviews } from './RepoPreviews';
import { RepoEnvEditor } from './RepoEnvEditor';
import { RepoPullsList } from './RepoPullsList';
import { RepoRunsList } from './RepoRunsList';
import { defaultBranch } from './repoFormat';
import { REPO_TABS, readStoredTab, storeTab, tabForKey, type RepoTab } from './repoTabs';
import { SectionError, SectionLoading } from './SectionState';
import { useRepoResource, type RepoResource } from './useRepoResource';

interface ProjectRepositoryViewProps {
  projectId: string;
  /** `owner/name`, from `GET /projects/:id/repos`. Render nothing when empty. */
  repositories: string[];
}

/** `acme/shop-be` → `shop-be`, which is what tells a pair apart. */
const shortName = (repo: string) => repo.split('/').pop() ?? repo;

const TAB_ICONS: Record<RepoTab, LucideIcon> = {
  overview: LayoutDashboard,
  code: FileCode2,
  pulls: GitPullRequest,
  runs: PlayCircle,
  previews: MonitorPlay,
  logs: ScrollText,
  environment: KeyRound
};

/**
 * Where a project's code stands, one concern per tab: the pipeline and its
 * hosting, the code, pull requests, CI runs, previews, logs and variables.
 *
 * Everything is read through the API against GitHub and the hosting
 * platforms; the writes are a promotion (which opens a pull request rather
 * than merging anything), setting hosting up, and variables.
 */
export const ProjectRepositoryView: React.FC<ProjectRepositoryViewProps> = ({ projectId, repositories }) => {
  const { role, can } = useApp();
  const canPromote = role === 'pm' || role === 'admin';
  // The same role the server checks (deployment.manage): project managers and admins.
  const canSetUpHosting = can('manage_deployments');
  // uat/dev variables: any developer. Production goes with canSetUpHosting (deployment.manage).
  const canManagePreviewEnv = can('manage_preview_env');

  const [selectedRepo, setSelectedRepo] = useState<string | null>(repositories[0] ?? null);
  // The list can change under us (a repository created, the project switched).
  useEffect(() => {
    if (!selectedRepo || !repositories.includes(selectedRepo)) setSelectedRepo(repositories[0] ?? null);
  }, [repositories, selectedRepo]);

  // Held here, above the per-repository panel, so switching between the -be
  // and the -fe of a pair stays on the same tab.
  const [tab, setTabState] = useState<RepoTab>(readStoredTab);
  const setTab = (next: RepoTab) => {
    setTabState(next);
    storeTab(next);
  };

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

      {/* Keyed by repository: branch choice, promotion outcomes, the open
          file and which tabs have loaded all belong to one repository and
          must not carry across. */}
      <RepoPanel
        key={selectedRepo}
        projectId={projectId}
        repo={selectedRepo}
        tab={tab}
        onTabChange={setTab}
        canPromote={canPromote}
        canSetUpHosting={canSetUpHosting}
        canManagePreviewEnv={canManagePreviewEnv}
      />
    </div>
  );
};

const RepoPanel: React.FC<{
  projectId: string;
  repo: string;
  tab: RepoTab;
  onTabChange: (tab: RepoTab) => void;
  canPromote: boolean;
  canSetUpHosting: boolean;
  canManagePreviewEnv: boolean;
}> = ({ projectId, repo, tab, onTabChange, canPromote, canSetUpHosting, canManagePreviewEnv }) => {
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

  // A tab mounts the first time it is opened and then stays mounted, hidden:
  // its answers and whatever was typed into it survive switching away, and
  // nothing is fetched for a tab nobody opens.
  const [visited, setVisited] = useState<ReadonlySet<RepoTab>>(() => new Set([tab]));
  useEffect(() => {
    setVisited(current => (current.has(tab) ? current : new Set(current).add(tab)));
  }, [tab]);

  const idBase = `repo-${repo.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const tabId = (id: RepoTab) => `${idBase}-tab-${id}`;
  const panelId = (id: RepoTab) => `${idBase}-panel-${id}`;
  const tabRefs = useRef<Partial<Record<RepoTab, HTMLButtonElement | null>>>({});

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const next = tabForKey(tab, event.key);
    if (!next) return;
    event.preventDefault();
    onTabChange(next);
    tabRefs.current[next]?.focus();
  };

  const openPulls = pulls.data?.pullRequests.length;
  const branchPicker = (
    <BranchSwitcher
      id={`${idBase}-branch`}
      branches={branchList}
      value={branch}
      onChange={setBranch}
      disabled={branches.loading && !branches.data}
    />
  );

  const content: Record<RepoTab, () => React.ReactNode> = {
    overview: () => (
      <>
        <BranchGate branches={branches} empty={branchList.length === 0}>
          <PipelineStrip
            projectId={projectId}
            repo={repo}
            branchNames={branchNames}
            selectedBranch={branch}
            onSelectBranch={setBranch}
            canPromote={canPromote}
            onPromoted={pulls.reload}
          />
        </BranchGate>
        <RepoHostingPanel projectId={projectId} repo={repo} canManage={canSetUpHosting} />
      </>
    ),
    code: () => (
      <BranchGate branches={branches} empty={branchList.length === 0}>
        {branchPicker}
        {branch && <RepoFileBrowser key={branch} projectId={projectId} repo={repo} branch={branch} />}
      </BranchGate>
    ),
    pulls: () => <RepoPullsList repo={repo} pulls={pulls} />,
    runs: () => (
      <BranchGate branches={branches} empty={branchList.length === 0}>
        {branchPicker}
        {branch && <RepoRunsList projectId={projectId} repo={repo} branch={branch} />}
      </BranchGate>
    ),
    previews: () => <RepoPreviews projectId={projectId} repo={repo} />,
    logs: () => <RepoLogsTab projectId={projectId} repo={repo} active={tab === 'logs'} />,
    environment: () => (
      <RepoEnvEditor projectId={projectId} repo={repo} canManageMain={canSetUpHosting} canManagePreview={canManagePreviewEnv} />
    )
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-white/[0.06]">
        <div role="tablist" aria-label={`${shortName(repo)} sections`} className="-mb-px flex flex-wrap gap-x-1" onKeyDown={onTabKeyDown}>
          {REPO_TABS.map(({ id, label }) => {
            const Icon = TAB_ICONS[id];
            const selected = id === tab;
            return (
              <button
                key={id}
                ref={el => {
                  tabRefs.current[id] = el;
                }}
                id={tabId(id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTabChange(id)}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${
                  selected ? 'border-brand-400 text-white' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
                {id === 'pulls' && openPulls ? (
                  <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-gray-200" aria-label={`${openPulls} open`}>
                    {openPulls}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noreferrer"
          className="mb-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-400 transition-colors hover:text-white"
        >
          <GitBranch className="h-3.5 w-3.5" aria-hidden />
          {repo}
          <ExternalLink className="h-3 w-3" aria-hidden />
          <span className="sr-only">(opens GitHub)</span>
        </a>
      </div>

      {REPO_TABS.map(({ id }) =>
        visited.has(id) ? (
          <div
            key={id}
            id={panelId(id)}
            role="tabpanel"
            aria-labelledby={tabId(id)}
            hidden={id !== tab}
            tabIndex={0}
            className="space-y-4 focus:outline-none"
          >
            {content[id]()}
          </div>
        ) : null
      )}
    </div>
  );
};

/** What a tab that needs the branch list shows until there is one. */
const BranchGate: React.FC<{
  branches: RepoResource<{ branches: RepoBranch[] }>;
  empty: boolean;
  children: React.ReactNode;
}> = ({ branches, empty, children }) => {
  if (branches.loading && !branches.data) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-surface-200/50">
        <SectionLoading label="Loading branches…" />
      </div>
    );
  }
  if (branches.error) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-surface-200/50">
        <SectionError message={branches.error} onRetry={branches.reload} />
      </div>
    );
  }
  if (empty) {
    return (
      <p className="rounded-xl border border-white/[0.06] bg-surface-200/50 px-3.5 py-4 text-[11px] text-gray-500">
        This repository has no branches yet — push a first commit to dev.
      </p>
    );
  }
  return <>{children}</>;
};
