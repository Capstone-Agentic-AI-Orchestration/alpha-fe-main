import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import {
  Rocket,
  Play,
  GitBranch,
  CheckCircle2,
  ExternalLink,
  Terminal,
  Search,
  Filter,
  ArrowDown,
  ArrowUp,
  Table as TableIcon,
  Check,
  Copy,
  AlertCircle,
  Activity
} from 'lucide-react';
import { Deployment, DeploymentStatus } from '@/shared/types';
import { Modal } from '@/shared/components/Modal';
import { DeploymentsActionsView } from './DeploymentsActionsView';

export const DeploymentsView: React.FC = () => {
  const { deployments, projects, triggerDeployment, can } = useApp();
  const canManageDeployments = can('manage_deployments');
  // Active Sub-view Tab: 'actions' (Live GitHub Actions) | 'deployments' (Environment Releases)
  const [viewMode, setViewMode] = useTabSessionState<'actions' | 'deployments'>('deployments.viewMode', 'actions');

  // States
  const [selectedDepId, setSelectedDepId] = useTabSessionState<string | null>('deployments.selectedDeployment', null);
  const [triggerModalOpen, setTriggerModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useTabSessionState<string>('deployments.search', '');

  // Filter & Sort state
  const [envFilter, setEnvFilter] = useTabSessionState<string>('deployments.environmentFilter', 'all');
  const [statusFilter, setStatusFilter] = useTabSessionState<string>('deployments.statusFilter', 'all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useTabSessionState<'desc' | 'asc'>('deployments.sortOrder', 'desc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);

  // Trigger form state
  const deployableProject = projects.find(project =>
    (project.resources || []).some(resource =>
      (resource.type === 'local_path' || resource.type === 'local_dir' || resource.type === 'github_repo') &&
      Boolean(resource.localPath || resource.pathOrUrl)
    )
  ) || projects[0];
  const [targetProjectId, setTargetProjectId] = useTabSessionState<string>('deployments.targetProject', deployableProject?.id || '');
  const [targetEnv, setTargetEnv] = useTabSessionState<'Production' | 'Staging' | 'Preview'>('deployments.targetEnvironment', 'Staging');
  const [copiedLogId, setCopiedLogId] = useState<boolean>(false);

  useEffect(() => {
    if (!projects.some(project => project.id === targetProjectId)) {
      setTargetProjectId(deployableProject?.id || '');
    }
  }, [projects, targetProjectId, deployableProject?.id]);

  // Selected Deployment Memo
  const selectedDeployment = useMemo(() => {
    return deployments.find(d => d.id === selectedDepId) || null;
  }, [deployments, selectedDepId]);

  // Copy Logs Helper
  const handleCopyLogs = useCallback((dep: Deployment) => {
    const allLogs = dep.stages.flatMap(s => s.logs).join('\n');
    navigator.clipboard.writeText(allLogs);
    setCopiedLogId(true);
    setTimeout(() => setCopiedLogId(false), 2000);
  }, []);

  // Filter and Sort Deployments
  const filteredDeployments = useMemo(() => {
    let list = deployments.filter(d => {
      if (envFilter !== 'all' && d.environment !== envFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesCommit = d.commitMessage.toLowerCase().includes(q) || d.commitSha.toLowerCase().includes(q);
        const matchesBranch = d.branch.toLowerCase().includes(q);
        const matchesProject = (d.projectName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCommit && !matchesBranch && !matchesProject) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      const timeA = new Date(a.startedAt).getTime();
      const timeB = new Date(b.startedAt).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [deployments, envFilter, statusFilter, searchQuery, sortOrder]);

  const formatRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const renderStatusBadge = (status: DeploymentStatus | string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-status-success-subtle text-status-success text-[11px] font-medium border border-status-success-border">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Success</span>
          </span>
        );
      case 'in_progress':
      case 'agent_evaluating':
      case 'building':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-status-info-subtle text-status-info text-[11px] font-medium border border-status-info-border">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Running</span>
          </span>
        );
      case 'failure':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-status-danger-subtle text-status-danger text-[11px] font-medium border border-status-danger-border">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Failed</span>
          </span>
        );
      case 'queued':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-surface-raised text-content-secondary text-[11px] font-medium border border-divider">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            <span>{status}</span>
          </span>
        );
    }
  };

  const renderEnvBadge = (env: string) => {
    switch (env) {
      case 'Production':
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-selected text-selected-content text-[11px] font-medium border border-divider">
            Production
          </span>
        );
      case 'Staging':
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-surface-raised text-content-secondary text-[11px] font-medium">
            Staging
          </span>
        );
      case 'Preview':
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-status-info-subtle text-status-info text-[11px] font-medium border border-status-info-border">
            Preview
          </span>
        );
      default:
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-surface-raised text-content-secondary text-[11px]">
            {env}
          </span>
        );
    }
  };

  const renderStageDots = (stages: Deployment['stages']) => {
    return (
      <div className="flex items-center gap-1">
        {stages.map((st, idx) => (
          <div
            key={idx}
            title={`${st.name}: ${st.status}`}
            className={`w-2 h-2 rounded-full transition-colors ${
              st.status === 'success' ? 'bg-emerald-400' :
              st.status === 'running' ? 'bg-cyan-400 animate-pulse' :
              st.status === 'failed' ? 'bg-rose-400' :
              'bg-gray-700'
            }`}
          />
        ))}
      </div>
    );
  };

  const handleTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await triggerDeployment(targetProjectId, targetEnv);
    setTriggerModalOpen(false);
  };

  return (
    <div className="flex h-full flex-col space-y-5 overflow-y-auto bg-canvas p-5 text-content-secondary select-none font-sans lg:p-6">

      {/* ================= TOP HEADER BAR ================= */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-content-secondary" />
            <h1 className="text-base font-semibold tracking-tight text-content">CI/CD & GitHub Actions</h1>
            <span className="text-xs text-content-muted font-mono">
              {viewMode === 'deployments' ? deployments.length : ''}
            </span>
          </div>
          <p className="mt-1 text-xs text-content-muted">
            Project workflow runs, job logs, and environment deployments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Trigger run button */}
          {canManageDeployments && (
            <button
              onClick={() => setTriggerModalOpen(true)}
              disabled={projects.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-high border border-divider text-xs font-medium text-content transition-colors shadow-sm"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Trigger run</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= SUB-NAVIGATION TABS ================= */}
      <div className="flex items-center gap-2 border-b border-divider pb-2">
        <button
          onClick={() => setViewMode('actions')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            viewMode === 'actions'
              ? 'bg-surface-raised text-content font-semibold'
              : 'text-content-secondary hover:text-content hover:bg-surface-high'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-status-info" />
          <span>Live GitHub Actions</span>

        </button>

        <button
          onClick={() => setViewMode('deployments')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            viewMode === 'deployments'
              ? 'bg-surface-raised text-content font-semibold'
              : 'text-content-secondary hover:text-content hover:bg-surface-high'
          }`}
        >
          <Rocket className="w-3.5 h-3.5 text-link" />
          <span>Environment Deployments</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-selected text-selected-content">
            {deployments.length}
          </span>
        </button>
      </div>

      {/* ================= SEARCH & ACTION ROW ================= */}
      {viewMode === 'deployments' && <div className="flex items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runs, commits, branches..."
            className="w-full bg-surface border border-control rounded-xl pl-8 pr-3 py-1.5 text-xs text-content placeholder-content-muted focus:outline-none focus:border-control transition-colors"
          />
        </div>

        {/* Right Actions: Filter, Sort, Table indicator */}
        <div className="flex items-center gap-2 relative">

          {/* Filter Popover */}
          <div className="relative">
            <button
              onClick={() => {
                setFilterDropdownOpen(prev => !prev);
                setSortDropdownOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                envFilter !== 'all' || statusFilter !== 'all'
                  ? 'bg-selected text-selected-content border-divider'
                  : 'bg-surface hover:bg-surface-raised text-content-secondary hover:text-content border-divider'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 p-2 rounded-xl bg-surface-raised border border-divider shadow-2xl z-30 space-y-2 text-xs">
                {viewMode === 'deployments' && (
                  <>
                    <div className="text-[10px] font-mono uppercase text-content-secondary px-2 py-1">Environment</div>
                    {['all', 'Production', 'Staging', 'Preview'].map((env) => (
                      <button
                        key={env}
                        onClick={() => {
                          setEnvFilter(env);
                          setFilterDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                          envFilter === env ? 'bg-surface-raised text-content font-semibold' : 'text-content-secondary hover:text-content'
                        }`}
                      >
                        <span>{env}</span>
                        {envFilter === env && <Check className="w-3 h-3 text-status-success" />}
                      </button>
                    ))}
                  </>
                )}

                <div className="text-[10px] font-mono uppercase text-content-secondary px-2 py-1 pt-2 border-t border-divider">Status</div>
                {['all', 'success', 'failure', 'in_progress', 'queued'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      statusFilter === st ? 'bg-surface-raised text-content font-semibold' : 'text-content-secondary hover:text-content'
                    }`}
                  >
                    <span>{st}</span>
                    {statusFilter === st && <Check className="w-3 h-3 text-status-success" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort Button */}
          <div className="relative">
            <button
              onClick={() => {
                setSortDropdownOpen(prev => !prev);
                setFilterDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-divider text-xs font-medium text-content-secondary hover:text-content transition-colors"
            >
              {sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
              <span>Time</span>
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-2 rounded-xl bg-surface-raised border border-divider shadow-2xl z-30 space-y-1 text-xs">
                <button
                  onClick={() => {
                    setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
                    setSortDropdownOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-content-secondary hover:text-content hover:bg-surface-high flex items-center justify-between"
                >
                  <span>Toggle Direction</span>
                  <span className="font-mono text-[10px] text-link uppercase">{sortOrder}</span>
                </button>
              </div>
            )}
          </div>

          {/* Table View Button */}
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-divider text-xs font-medium text-content-secondary shadow-sm cursor-default"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>}

      {viewMode === 'actions' && <DeploymentsActionsView />}

      {/* ================= VIEW 2: ENVIRONMENT DEPLOYMENTS ================= */}
      {viewMode === 'deployments' && (
        <div className="w-full">
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-normal text-content-muted border-b border-divider">
            <div className="col-span-4">Pipeline & Commit</div>
            <div className="col-span-2">Environment</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-left">Stages</div>
            <div className="col-span-2 pl-4">Triggered By</div>
            <div className="col-span-1 text-right flex items-center justify-end gap-1">
              <span>Time</span>
              <ArrowDown className="w-3 h-3 text-content-muted" />
            </div>
          </div>

          <div className="divide-y divide-divider">
            {filteredDeployments.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-content-muted">
                No environment deployments have been acknowledged. Trigger a configured GitHub Actions workflow to create a real run.
              </div>
            ) : filteredDeployments.map((dep) => {
              return (
                <div
                  key={dep.id}
                  onClick={() => setSelectedDepId(dep.id)}
                  className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs hover:bg-surface-high cursor-pointer transition-colors group ${
                    selectedDepId === dep.id ? 'bg-surface-raised' : ''
                  }`}
                >
                  <div className="col-span-4 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-content truncate group-hover:text-content">
                        {dep.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-raised text-content-secondary border border-divider flex-shrink-0">
                        {dep.commitSha}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-content-muted font-mono truncate">
                      <span className="flex items-center gap-1 text-content-secondary">
                        <GitBranch className="w-3 h-3 text-content-muted" /> {dep.branch}
                      </span>
                      <span>•</span>
                      <span className="truncate">{dep.commitMessage}</span>
                    </div>
                  </div>

                  <div className="col-span-2">
                    {renderEnvBadge(dep.environment)}
                  </div>

                  <div className="col-span-2">
                    {renderStatusBadge(dep.status)}
                  </div>

                  <div className="col-span-1">
                    {renderStageDots(dep.stages)}
                  </div>

                  <div className="col-span-2 pl-4 flex items-center gap-2">
                    {dep.triggeredBy.avatar ? (
                      <img
                        src={dep.triggeredBy.avatar}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-content/10 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-selected border border-divider flex items-center justify-center text-[10px] text-selected-content font-bold flex-shrink-0">
                        {dep.triggeredBy.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-content-secondary truncate">{dep.triggeredBy.name}</span>
                  </div>

                  <div className="col-span-1 text-right text-xs text-content-muted font-mono">
                    <div>{formatRelativeTime(dep.startedAt)}</div>
                    {dep.durationSec > 0 && (
                      <div className="text-[10px] text-content-muted font-mono">{dep.durationSec}s</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= PIPELINE RUN MODAL (DEPLOYMENTS) ================= */}
      {selectedDeployment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDepId(null)}
          title={selectedDeployment.name}
          subtitle={`${selectedDeployment.projectName} · ${selectedDeployment.commitSha}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 text-xs text-content-secondary">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-4">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-pink-400" />
                {renderStatusBadge(selectedDeployment.status)}
                {renderEnvBadge(selectedDeployment.environment)}
              </div>
              <span className="text-[11px] tabular-nums text-content-muted">
                {selectedDeployment.durationSec}s runtime
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-content-secondary">
                <span className="flex items-center gap-1.5 font-mono text-content-secondary">
                  <GitBranch className="h-3.5 w-3.5 text-status-info" />
                  {selectedDeployment.branch}
                </span>
                <span>Triggered by {selectedDeployment.triggeredBy.name}</span>
              </div>
              <p className="rounded-md border border-divider bg-canvas p-3 font-mono text-xs text-content">
                {selectedDeployment.commitMessage}
              </p>
              {selectedDeployment.previewUrl && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-content-muted">Live preview</span>
                  <a
                    href={selectedDeployment.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1 font-mono text-link hover:underline"
                  >
                    <span className="truncate">{selectedDeployment.previewUrl}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="space-y-2.5">
                <h3 className="text-xs font-medium text-content-secondary">Pipeline stages</h3>
                <div className="divide-y divide-divider border-y border-divider">
                  {selectedDeployment.stages.map((stage, idx) => {
                    const isSuccess = stage.status === 'success';
                    const isRunning = stage.status === 'running';
                    const isFailed = stage.status === 'failed';

                    return (
                      <div key={idx} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {isSuccess && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-status-success" />}
                          {isRunning && <span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-cyan-400" />}
                          {isFailed && <AlertCircle className="h-4 w-4 flex-shrink-0 text-status-danger" />}
                          {!isSuccess && !isRunning && !isFailed && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-600" />}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-content">{stage.name}</div>
                            <div className="text-[10px] capitalize text-content-muted">{stage.status}</div>
                          </div>
                        </div>
                        {stage.durationSec !== undefined && (
                          <span className="text-[11px] tabular-nums text-content-muted">{stage.durationSec}s</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-content-secondary">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-link" />
                    <h3>Execution logs</h3>
                  </div>
                  <button
                    onClick={() => handleCopyLogs(selectedDeployment)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-content-muted transition-colors hover:bg-surface-high hover:text-content"
                  >
                    {copiedLogId ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedLogId ? 'Copied' : 'Copy logs'}</span>
                  </button>
                </div>
                <div className="max-h-72 min-h-52 space-y-1.5 overflow-y-auto rounded-md border border-divider bg-well p-3.5 font-mono text-[11px] text-content-secondary">
                  {selectedDeployment.stages.flatMap((stage, stageIndex) =>
                    stage.logs.map((log, logIndex) => (
                      <div key={`${stageIndex}-${logIndex}`} className="flex items-start gap-2 leading-relaxed">
                        <span className="select-none text-content-muted">[{stage.name.split(' ')[0]}]</span>
                        <span className={log.includes('Error') ? 'text-status-danger' : 'text-content-secondary'}>{log}</span>
                      </div>
                    )),
                  )}
                </div>
              </section>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= TRIGGER RUN MODAL ================= */}
      {triggerModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setTriggerModalOpen(false)}
          title="Trigger Pipeline Run"
          subtitle="Dispatch the selected project’s configured GitHub Actions workflow."
        >
          <form onSubmit={handleTriggerSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-content-secondary mb-1">Target Project</label>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="w-full bg-surface-raised border border-control rounded-xl px-3 py-2 text-content focus:outline-none focus:border-control"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-content-secondary mb-1">Deployment Target Environment</label>
              <select
                value={targetEnv}
                onChange={(e) => setTargetEnv(e.target.value as any)}
                className="w-full bg-surface-raised border border-control rounded-xl px-3 py-2 text-content focus:outline-none focus:border-control"
              >
                <option value="Staging">Staging (Integration Cluster)</option>
                <option value="Preview">Preview (Ephemeral PR Branch)</option>
                <option value="Production">Production (Global Edge Fleet)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-divider">
              <button
                type="button"
                onClick={() => setTriggerModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-content-secondary hover:text-content"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!targetProjectId || projects.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-action hover:bg-action-hover text-on-action font-medium shadow-glow-brand"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Start Pipeline</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
