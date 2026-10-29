import { useState } from 'react';
import { GitBranch, PlayCircle, RefreshCw } from 'lucide-react';
import { apiService } from '@/shared/services/apiService';
import type { RepoBranch } from '@/shared/types';
import type { ActionsFilters, ActionsRun, ActionsWorkflow } from '@/shared/types/actions';
import { RepoSection, SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { useActionsResource } from './useActionsResource';
import { ActionsRunDetail, ActionsStatus, PageControls, actionsButton, actionsInput } from './ActionsRunDetail';
import { relativeTime } from './repoFormat';
import { PipelineStrip } from './PipelineStrip';

interface Props { projectId: string; repositories: string[]; repository: string | null; active: boolean; canPromote: boolean; canPromoteUat?: boolean }
const initialFilters: ActionsFilters = {};

/** GitHub executes the workflow; all inspection stays in this project page. */
export function ProjectActionsView({ projectId, repositories, repository, active, canPromote, canPromoteUat = canPromote }: Props) {
  const [filters, setFilters] = useState<ActionsFilters>(initialFilters);
  const [draft, setDraft] = useState<ActionsFilters>(initialFilters);
  const [selected, selectRun] = useState<ActionsRun | null>(null);
  const [refresh, setRefresh] = useState(0);
  const visibleRepos = repository ? repositories.filter(r => r === repository) : repositories;
  const filterKey = JSON.stringify(filters);
  const pick = (run: ActionsRun) => selectRun(run);
  const opened = selected && visibleRepos.includes(selected.repository) ? selected : null;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold text-content"><PlayCircle className="h-4 w-4 text-link" />GitHub Actions</h2>
        <p className="mt-1 text-xs text-content-secondary">Inspect workflow runs, jobs, logs, and artifacts here in the project.</p></div>
      <button type="button" className={actionsButton} onClick={() => setRefresh(n => n + 1)}><RefreshCw className="mr-1 inline h-3 w-3" />Refresh history</button>
    </div>
    {repository && <Promotion projectId={projectId} repo={repository} active={active} canPromote={canPromote} canPromoteUat={canPromoteUat} />}
    <form aria-label="Actions run filters" className="flex flex-wrap items-end gap-3 rounded-xl border border-divider bg-surface/50 p-3" onSubmit={e => { e.preventDefault(); setFilters(draft); }}>
      <label className="min-w-0 flex-1 text-[11px] text-content-secondary">Branch<input className={`${actionsInput} mt-1 block w-full`} placeholder="All branches" value={draft.branch || ''} onChange={e => setDraft(f => ({ ...f, branch: e.target.value.trim() || undefined }))} /></label>
      <label className="text-[11px] text-content-secondary">Status<select aria-label="Run status" className={`${actionsInput} mt-1 block`} value={draft.status || ''} onChange={e => setDraft(f => ({ ...f, status: e.target.value || undefined }))}>
        {[['', 'All statuses'], ['success', 'Success'], ['failure', 'Failed'], ['in_progress', 'In progress'], ['queued', 'Queued'], ['waiting', 'Waiting'], ['cancelled', 'Cancelled'], ['timed_out', 'Timed out'], ['skipped', 'Skipped'], ['action_required', 'Action required']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="text-[11px] text-content-secondary">Event<input list="actions-events" placeholder="All events" className={`${actionsInput} mt-1 block w-36`} value={draft.event || ''} onChange={e => setDraft(f => ({ ...f, event: e.target.value.trim() || undefined }))} /><datalist id="actions-events">{['push', 'pull_request', 'workflow_dispatch', 'schedule', 'workflow_run', 'release'].map(event => <option key={event} value={event} />)}</datalist></label>
      <label className="text-[11px] text-content-secondary">From<input aria-label="Runs from date" type="date" value={draft.from || ''} onChange={e => setDraft(f => ({ ...f, from: e.target.value || undefined }))} className={`${actionsInput} mt-1 block [color-scheme:dark]`} /></label>
      <label className="text-[11px] text-content-secondary">To<input aria-label="Runs to date" type="date" value={draft.to || ''} onChange={e => setDraft(f => ({ ...f, to: e.target.value || undefined }))} className={`${actionsInput} mt-1 block [color-scheme:dark]`} /></label>
      <button className={actionsButton} type="submit">Apply filters</button>
      <button className={actionsButton} type="button" onClick={() => { setDraft({}); setFilters({}); }}>Clear filters</button>
    </form>
    <p className="text-[11px] text-content-secondary">{repository || 'All repositories'} · {filters.branch || 'All branches'} · Retained GitHub history. Deleted runs and expired logs cannot be restored here.</p>
    <div className={opened ? 'grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(260px,0.6fr)_minmax(0,1.4fr)]' : 'space-y-4'}>
      <div className={`${opened ? 'hidden xl:block' : ''} min-w-0 space-y-4`} aria-label="Actions run history">
        {visibleRepos.map(repo => <RepoHistory key={repo} projectId={projectId} repo={repo} filters={filters} filterKey={filterKey} active={active} refresh={refresh} selected={opened} onSelect={pick} />)}
        {!visibleRepos.length && <SectionEmpty>No accessible repositories are attached to this project.</SectionEmpty>}
      </div>
      {opened && <ActionsRunDetail key={`${opened.repository}|${opened.id}`} projectId={projectId} selected={opened} active={active} onBack={() => selectRun(null)} />}
    </div>
  </div>;
}

function RepoHistory({ projectId, repo, filters, filterKey, active, refresh, selected, onSelect }: {
  projectId: string; repo: string; filters: ActionsFilters; filterKey: string; active: boolean; refresh: number;
  selected: ActionsRun | null; onSelect: (run: ActionsRun) => void;
}) {
  const [workflow, setWorkflow] = useState<ActionsWorkflow | null>(null);
  const [workflowPage, setWorkflowPage] = useState(1);
  const inventory = useActionsResource(s => apiService.getActionsWorkflows(projectId, repo, workflowPage, s), `${repo}|workflows|${workflowPage}|${refresh}`, active);
  const workflows = inventory.data?.workflows || [];
  return <RepoSection id={`actions-${repo.replace(/[^a-z0-9]/gi, '-')}`} title={repo} icon={<GitBranch className="h-3.5 w-3.5" />}>
    <div className="space-y-3 p-3">
      <label className="block text-[11px] text-content-secondary">Workflow
        <select aria-label={`Workflow in ${repo}`} className={`${actionsInput} mt-1 block w-full`} value={workflow?.id || ''} onChange={e => setWorkflow(workflows.find(w => String(w.id) === e.target.value) || null)}>
          <option value="">All workflows</option>
          {workflow && !workflows.some(w => w.id === workflow.id) && <option value={workflow.id}>{workflow.name}</option>}
          {workflows.map(w => <option value={w.id} key={w.id}>{w.name}{w.state !== 'active' ? ` (${w.state})` : ''}</option>)}
        </select>
      </label>
      {inventory.error && <SectionError message={inventory.error} onRetry={inventory.reload} />}
      <PageControls page={workflowPage} nextPage={inventory.data?.nextPage} loading={inventory.loading} onPage={setWorkflowPage} />
    </div>
    <RunsPage key={`${repo}|${filterKey}|${workflow?.id || ''}`} projectId={projectId} repo={repo} filters={{ ...filters, workflow: workflow ? String(workflow.id) : undefined }} active={active} refresh={refresh} selected={selected} onSelect={onSelect} />
  </RepoSection>;
}

function RunsPage({ projectId, repo, filters, active, refresh, selected, onSelect }: {
  projectId: string; repo: string; filters: ActionsFilters; active: boolean; refresh: number;
  selected: ActionsRun | null; onSelect: (run: ActionsRun) => void;
}) {
  const [page, setPage] = useState(1);
  const [pollMs, setPollMs] = useState(15000);
  const resource = useActionsResource(async signal => {
    const data = await apiService.getActionsRuns(projectId, repo, { ...filters, page }, signal);
    if (!signal.aborted) setPollMs(data.runs.some(run => run.status !== 'completed') ? 15000 : 60000);
    return data;
  }, `${repo}|${JSON.stringify(filters)}|${page}|${refresh}`, active, pollMs);
  const data = resource.data;
  return <div className="space-y-2 pb-3">
    {resource.error && <SectionError message={resource.error} onRetry={resource.reload} />}
    {!data && resource.loading && <SectionLoading label="Loading workflow runs…" />}
    {data && <>
      <p className="px-3 text-[11px] text-content-secondary">{data.totalCount} matching runs · Page {page}{resource.updated && ` · Updated ${new Date(resource.updated).toLocaleTimeString()}`}</p>
      {data.runs.length === 0 && <SectionEmpty>No retained runs match these filters. Try All branches or a different date range.</SectionEmpty>}
      <ul className="divide-y divide-divider">{data.runs.map(run => <li key={run.id}><button type="button" onClick={() => onSelect(run)} aria-pressed={selected?.repository === repo && selected.id === run.id}
        className={`flex w-full flex-wrap items-start justify-between gap-3 p-3 text-left hover:bg-surface-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${selected?.repository === repo && selected.id === run.id ? 'bg-selected' : ''}`}>
        <span className="min-w-0 flex-1"><span className="block break-words text-xs font-medium text-content">{run.name} #{run.number}</span><span className="mt-1 block break-words text-xs text-content-secondary">{run.title}</span>
          <span className="mt-2 block break-words text-[11px] text-content-secondary">{run.branch || 'Branch unavailable'} · {run.event} · {run.sha.slice(0, 7)} · {relativeTime(run.createdAt)} · {run.actor}</span></span>
        <ActionsStatus value={run} />
      </button></li>)}</ul>
      {data.limited && <p className="px-3 text-xs text-status-warning">GitHub limits filtered history to 1,000 results. Narrow the date range to browse older retained runs.</p>}
    </>}
    <div className="px-3"><PageControls page={page} nextPage={data?.nextPage} loading={resource.loading} onPage={setPage} /></div>
  </div>;
}

function Promotion({ projectId, repo, active, canPromote, canPromoteUat }: { projectId: string; repo: string; active: boolean; canPromote: boolean; canPromoteUat: boolean }) {
  const [branch, setBranch] = useState('dev');
  const branches = useActionsResource<{ branches: RepoBranch[] }>(() => apiService.getRepoBranches(projectId, repo), `${repo}|promotion-branches`, active);
  if (!branches.data) return null;
  return <details className="rounded-lg border border-divider p-3"><summary className="cursor-pointer text-xs text-content-secondary">Branch promotion: dev → uat → main</summary>
    <div className="mt-3"><PipelineStrip projectId={projectId} repo={repo} branchNames={branches.data.branches.map(b => b.name)} selectedBranch={branch} onSelectBranch={setBranch} canPromote={canPromote} canPromoteUat={canPromoteUat} onPromoted={branches.reload} /></div>
  </details>;
}
