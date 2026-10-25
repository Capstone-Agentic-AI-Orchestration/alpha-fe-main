import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Download, ExternalLink, FileCode2, GitBranch, GitPullRequest, KeyRound,
  LayoutDashboard, MonitorPlay, PlayCircle, ScrollText, type LucideIcon
} from 'lucide-react';

import { useApp, useTabSessionState } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { RepoBranch, RepoPullRequest } from '@/shared/types';
import { BranchSwitcher } from './BranchSwitcher';
import { CloneToComputerDialog, canCloneToComputer } from './CloneToComputerDialog';
import { RepoFileBrowser } from './RepoFileBrowser';
import { RepoHostingPanel } from './RepoHostingPanel';
import { RepoLogsTab, RepoPreviews } from './RepoPreviews';
import { RepoEnvEditor } from './RepoEnvEditor';
import { RepoPullsList } from './RepoPullsList';
import { ProjectActionsView } from './ProjectActionsView';
import { defaultBranch } from './repoFormat';
import { REPO_TABS, isRepoTab, tabForKey, type RepoTab } from './repoTabs';
import { SectionError, SectionLoading } from './SectionState';
import { useRepoResource, type RepoResource } from './useRepoResource';

interface ProjectRepositoryViewProps {
  projectId: string;
  repositories: string[];
  initialRepository?: string;
  onInitialRepositoryApplied?: () => void;
  repositoriesLoading?: boolean;
  overview: React.ReactNode;
  onManageRepositories?: () => void;
}

type RepositoryTab = Exclude<RepoTab, 'overview'>;
const shortName = (repo: string) => repo.split('/').pop() ?? repo;
const TAB_ICONS: Record<RepoTab, LucideIcon> = {
  overview: LayoutDashboard, code: FileCode2, pulls: GitPullRequest,
  runs: PlayCircle, previews: MonitorPlay, logs: ScrollText, environment: KeyRound
};

/** Project tasks and repository tools share one navigation row and the full page width. */
export const ProjectRepositoryView: React.FC<ProjectRepositoryViewProps> = ({
  projectId, repositories, repositoriesLoading = false, overview, onManageRepositories, initialRepository, onInitialRepositoryApplied
}) => {
  const { role, can, isActiveTab, activeWorkspaceId, identity } = useApp();
  const [storedTab, setStoredTab] = useTabSessionState<RepoTab>(`projects.workspaceTab:${projectId}`, 'overview');
  const tab = isRepoTab(storedTab) ? storedTab : 'overview';
  const [selectedRepo, setSelectedRepo] = useState<string | null>(repositories[0] ?? null);
  const [actionsRepo, setActionsRepo] = useState<string | null>(null);
  const [actionsOpened, setActionsOpened] = useState(tab === 'runs');
  useEffect(() => { if (tab === 'runs') setActionsOpened(true); }, [tab]);
  const requestedRepository = initialRepository
    ? repositories.find(value => value.toLowerCase() === initialRepository.toLowerCase())
    : undefined;
  const repositoryPending = Boolean(initialRepository && !requestedRepository);
  const repo = requestedRepository ?? (selectedRepo && repositories.includes(selectedRepo) ? selectedRepo : repositories[0] ?? null);
  useEffect(() => {
    if (!initialRepository) return;
    setStoredTab('previews');
    if (!requestedRepository) return;
    setSelectedRepo(requestedRepository);
    onInitialRepositoryApplied?.();
  }, [initialRepository, requestedRepository, onInitialRepositoryApplied, setStoredTab]);
  const [repositoryOpened, setRepositoryOpened] = useState(tab !== 'overview');
  const [cloneOpen, setCloneOpen] = useState(false);
  // Clients never get code; everyone else may clone onto their own computer in the desktop app.
  const canClone = role !== 'client' && repositories.length > 0 && canCloneToComputer();
  useEffect(() => {
    if (tab !== 'overview') setRepositoryOpened(true);
  }, [tab]);

  const instanceId = useId().replace(/:/g, '');
  const idBase = `project-${projectId}-${instanceId}`;
  const tabRefs = useRef<Partial<Record<RepoTab, HTMLButtonElement | null>>>({});
  const tabId = (id: RepoTab) => `${idBase}-tab-${id}`;
  const panelId = (id: RepoTab) => `${idBase}-panel-${id}`;
  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const next = tabForKey(tab, event.key);
    if (!next) return;
    event.preventDefault();
    setStoredTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 border-b border-white/[0.06] px-4 sm:px-5">
        <div role="tablist" aria-label="Project sections" className="-mb-px flex min-w-0 max-w-full overflow-x-auto" onKeyDown={onTabKeyDown}>
          {REPO_TABS.map(({ id, label }) => {
            const Icon = TAB_ICONS[id];
            const selected = id === tab;
            return (
              <button
                key={id}
                ref={el => { tabRefs.current[id] = el; }}
                id={tabId(id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => setStoredTab(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${
                  selected ? 'border-brand-400 text-white' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />{label}
              </button>
            );
          })}
        </div>
        {tab !== 'overview' && repo && !repositoryPending && (
          <div className="my-2 flex max-w-full items-center gap-2">
          <div role="group" aria-label="Repository" className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-white/[0.08] bg-surface-raised p-0.5">
            {tab === 'runs' && <button type="button" aria-pressed={!actionsRepo} onClick={() => setActionsRepo(null)}
              className={`shrink-0 rounded-md px-3 py-1 text-[11px] focus-visible:outline focus-visible:outline-brand-400 ${!actionsRepo ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>All repositories</button>}
            {repositories.map(value => (
              <button
                key={value} type="button" aria-pressed={value === (tab === 'runs' ? actionsRepo : repo)}
                onClick={() => { setSelectedRepo(value); if (tab === 'runs') setActionsRepo(value); }} title={value}
                className={`max-w-48 shrink-0 truncate rounded-md px-3 py-1 font-mono text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${
                  value === (tab === 'runs' ? actionsRepo : repo) ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >{shortName(value)}</button>
            ))}
          </div>
          {canClone && <button type="button" onClick={() => setCloneOpen(true)} title="Clone the project's repositories to a folder on this computer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface-raised px-3 py-1.5 text-[11px] font-medium text-gray-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400">
            <Download className="h-3.5 w-3.5" aria-hidden />Clone to computer
          </button>}
          </div>
        )}
      <CloneToComputerDialog isOpen={cloneOpen} onClose={() => setCloneOpen(false)} projectId={projectId} repositories={repositories} />
      </div>

      <div id={panelId('overview')} role="tabpanel" aria-labelledby={tabId('overview')}
        hidden={tab !== 'overview'} className={tab === 'overview' ? 'min-h-0 flex-1' : 'hidden'}>
        {overview}
      </div>

      {actionsOpened && repo && !repositoryPending && <div id={panelId('runs')} role="tabpanel" aria-labelledby={tabId('runs')}
        hidden={tab !== 'runs'} className={tab === 'runs' ? 'min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 select-text' : 'hidden'}>
        <ProjectActionsView key={`${activeWorkspaceId}|${identity?.login}|${projectId}`} projectId={projectId} repositories={repositories}
          repository={actionsRepo && repositories.includes(actionsRepo) ? actionsRepo : null} active={tab === 'runs' && isActiveTab}
          canPromote={role === 'pm' || role === 'admin'} />
      </div>}

      {tab !== 'overview' && (!repo || repositoryPending) && (
        <div id={panelId(tab)} role="tabpanel" aria-labelledby={tabId(tab)} className="min-h-0 flex-1 overflow-y-auto p-5" tabIndex={0}>
          {repositoriesLoading || repositoryPending ? <SectionLoading label={repositoryPending ? "Connecting the new repository and opening its preview…" : "Loading repositories…"} /> : (
            <div className="rounded-xl border border-white/[0.08] p-8 text-center">
              <GitBranch className="mx-auto h-6 w-6 text-gray-500" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold text-white">No accessible repositories</h2>
              <p className="mt-2 text-xs text-gray-400">Attach a repository or check your access to an existing one.</p>
              {onManageRepositories && (
                <button type="button" onClick={onManageRepositories} className="mt-4 rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-on-accent hover:bg-brand-600">
                  Manage repositories
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {repo && !repositoryPending && (repositoryOpened || tab !== 'overview') && (
        <div hidden={tab === 'overview' || tab === 'runs'} className={tab === 'overview' || tab === 'runs' ? 'hidden' : 'min-h-0 flex-1 overflow-y-auto p-4 select-text sm:p-5'}>
          <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer"
            className="mb-4 inline-flex max-w-full items-center gap-1.5 text-xs text-gray-400 hover:text-white">
            <GitBranch className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate font-mono">{repo}</span>
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            <span className="sr-only">(opens GitHub)</span>
          </a>
          <RepoPanel
            key={`${projectId}|${repo}`} projectId={projectId} repo={repo}
            tab={tab === 'overview' || tab === 'runs' ? null : tab} idBase={idBase}
            canSetUpHosting={can('manage_deployments')}
            canManagePreviewEnv={can('manage_preview_env')}
          />
        </div>
      )}
    </div>
  );
};

const RepoPanel: React.FC<{
  projectId: string;
  repo: string;
  tab: RepositoryTab | null;
  idBase: string;
  canSetUpHosting: boolean;
  canManagePreviewEnv: boolean;
}> = ({ projectId, repo, tab, idBase, canSetUpHosting, canManagePreviewEnv }) => {
  const branches = useRepoResource<{ branches: RepoBranch[] }>(
    () => apiService.getRepoBranches(projectId, repo), `${projectId}|${repo}|branches`
  );
  const pulls = useRepoResource<{ pullRequests: RepoPullRequest[] }>(
    () => apiService.getRepoPulls(projectId, repo, 'open'), `${projectId}|${repo}|pulls`
  );
  const branchList = useMemo(() => branches.data?.branches ?? [], [branches.data]);
  const branchNames = useMemo(() => branchList.map(b => b.name), [branchList]);
  const [branch, setBranch] = useState<string | null>(null);
  useEffect(() => {
    if (branchList.length && (!branch || !branchNames.includes(branch))) setBranch(defaultBranch(branchList));
  }, [branchList, branchNames, branch]);

  // Keep visited sections mounted so inputs and branch selection survive a trip to Overview.
  const [visited, setVisited] = useState<ReadonlySet<RepositoryTab>>(() => new Set(tab ? [tab] : []));
  useEffect(() => {
    if (tab) setVisited(current => current.has(tab) ? current : new Set(current).add(tab));
  }, [tab]);
  const hostingRef = useRef<HTMLDivElement>(null);
  const branchPicker = (section: RepositoryTab) => (
    <BranchSwitcher id={`${idBase}-branch-${section}`} branches={branchList} value={branch}
      onChange={setBranch} disabled={branches.loading && !branches.data} />
  );
  const content: Record<RepositoryTab, () => React.ReactNode> = {
    code: () => (
      <BranchGate branches={branches} empty={!branchList.length}>
        {branchPicker('code')}
        {branch && <RepoFileBrowser key={branch} projectId={projectId} repo={repo} branch={branch} />}
      </BranchGate>
    ),
    pulls: () => <RepoPullsList repo={repo} pulls={pulls} />,
    runs: () => null,
    previews: () => (
      <>
        <div ref={hostingRef}><RepoHostingPanel projectId={projectId} repo={repo} canManage={canSetUpHosting} /></div>
        <RepoPreviews projectId={projectId} repo={repo} active={tab === 'previews'}
          onOpenHosting={() => hostingRef.current?.scrollIntoView({ block: 'start' })} />
      </>
    ),
    logs: () => <RepoLogsTab projectId={projectId} repo={repo} active={tab === 'logs'} />,
    environment: () => <RepoEnvEditor projectId={projectId} repo={repo} canManageMain={canSetUpHosting} canManagePreview={canManagePreviewEnv} />
  };
  return (
    <>
      {REPO_TABS.map(({ id }) => id !== 'overview' && (visited.has(id) || tab === id) ? (
        <div key={id} id={`${idBase}-panel-${id}`} role="tabpanel" aria-labelledby={`${idBase}-tab-${id}`}
          hidden={id !== tab} tabIndex={0} className={id === tab ? 'space-y-4 focus:outline-none' : 'hidden'}>
          {content[id]()}
        </div>
      ) : null)}
    </>
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
