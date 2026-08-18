import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
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
  AlertCircle 
} from 'lucide-react';
import { Deployment, DeploymentStatus } from '../types';
import { Modal } from '../components/common/Modal';

export const DeploymentsView: React.FC = () => {
  const { deployments, projects, triggerDeployment } = useApp();
  
  // States
  const [selectedDepId, setSelectedDepId] = useState<string | null>(null);
  const [triggerModalOpen, setTriggerModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Filter & Sort state
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);
  
  // Trigger form state
  const [targetProjectId, setTargetProjectId] = useState<string>(projects[0]?.id || 'proj-1');
  const [targetEnv, setTargetEnv] = useState<'Production' | 'Staging' | 'Preview'>('Staging');
  const [copiedLogId, setCopiedLogId] = useState<boolean>(false);

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

  // Relative Time Formatter
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

  // Status Badge Component
  const renderStatusBadge = (status: DeploymentStatus) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[11px] font-medium border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Success</span>
          </span>
        );
      case 'agent_evaluating':
      case 'building':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-[11px] font-medium border border-cyan-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Evaluating</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-300 text-[11px] font-medium border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Failed</span>
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1B1C23] text-gray-400 text-[11px] font-medium border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            <span>Queued</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Environment Badge
  const renderEnvBadge = (env: string) => {
    switch (env) {
      case 'Production':
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 text-[11px] font-medium border border-purple-500/20">
            Production
          </span>
        );
      case 'Staging':
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#1B1C23] text-gray-300 text-[11px] font-medium">
            Staging
          </span>
        );
      case 'Preview':
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-[11px] font-medium border border-cyan-500/20">
            Preview
          </span>
        );
      default:
        return (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#1B1C23] text-gray-400 text-[11px]">
            {env}
          </span>
        );
    }
  };

  // Stage Progress Indicator
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

  const handleTriggerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerDeployment(targetProjectId, targetEnv);
    setTriggerModalOpen(false);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-[#0E0E12] text-gray-300 p-6 space-y-6 select-none font-sans">
      
      {/* ================= TOP HEADER BAR ================= */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-gray-400" />
            <h1 className="text-sm font-semibold text-white tracking-wide">CI/CD Platform</h1>
            <span className="text-xs text-gray-500 font-mono">{deployments.length}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Inspect Preview validation after approving agent output in Inbox.</p>
        </div>

        {/* Trigger run button */}
        <button
          onClick={() => setTriggerModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#22242D] border border-white/10 text-xs font-medium text-white transition-colors shadow-sm"
        >
          <Play className="w-3 h-3 fill-white" />
          <span>Trigger run</span>
        </button>
      </div>

      {/* ================= SEARCH & ACTION ROW ================= */}
      <div className="flex items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runs, commits, branches..."
            className="w-full bg-[#14151B] border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
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
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-[#14151B] hover:bg-[#1C1D24] text-gray-400 hover:text-white border-white/5'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-2 text-xs">
                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1">Environment</div>
                {['all', 'Production', 'Staging', 'Preview'].map((env) => (
                  <button
                    key={env}
                    onClick={() => {
                      setEnvFilter(env);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      envFilter === env ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{env}</span>
                    {envFilter === env && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}

                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1 pt-2 border-t border-white/5">Status</div>
                {['all', 'success', 'agent_evaluating', 'failed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      statusFilter === st ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{st === 'agent_evaluating' ? 'Evaluating' : st}</span>
                    {statusFilter === st && <Check className="w-3 h-3 text-emerald-400" />}
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14151B] hover:bg-[#1C1D24] border border-white/5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
            >
              {sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
              <span>Time</span>
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-1 text-xs">
                <button
                  onClick={() => {
                    setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
                    setSortDropdownOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 flex items-center justify-between"
                >
                  <span>Toggle Direction</span>
                  <span className="font-mono text-[10px] text-brand-400 uppercase">{sortOrder}</span>
                </button>
              </div>
            )}
          </div>

          {/* Table View Button */}
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14151B] border border-white/5 text-xs font-medium text-gray-400 shadow-sm cursor-default"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* ================= MINIMALIST DEPLOYMENTS TABLE ================= */}
      <div className="w-full">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-normal text-gray-500 border-b border-white/[0.04]">
          <div className="col-span-4">Pipeline & Commit</div>
          <div className="col-span-2">Environment</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-left">Stages</div>
          <div className="col-span-2 pl-4">Triggered By</div>
          <div className="col-span-1 text-right flex items-center justify-end gap-1">
            <span>Time</span>
            <ArrowDown className="w-3 h-3 text-gray-500" />
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-white/[0.02]">
          {filteredDeployments.map((dep) => {
            return (
              <div
                key={dep.id}
                onClick={() => setSelectedDepId(dep.id)}
                className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs hover:bg-white/[0.02] cursor-pointer transition-colors group ${
                  selectedDepId === dep.id ? 'bg-white/[0.04]' : ''
                }`}
              >
                {/* 1. Pipeline Name & Commit */}
                <div className="col-span-4 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate group-hover:text-gray-200">
                      {dep.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5 flex-shrink-0">
                      {dep.commitSha}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono truncate">
                    <span className="flex items-center gap-1 text-gray-400">
                      <GitBranch className="w-3 h-3 text-gray-500" /> {dep.branch}
                    </span>
                    <span>•</span>
                    <span className="truncate">{dep.commitMessage}</span>
                  </div>
                </div>

                {/* 2. Environment Badge */}
                <div className="col-span-2">
                  {renderEnvBadge(dep.environment)}
                </div>

                {/* 3. Status Badge */}
                <div className="col-span-2">
                  {renderStatusBadge(dep.status)}
                </div>

                {/* 4. Stages Dot Sequence */}
                <div className="col-span-1">
                  {renderStageDots(dep.stages)}
                </div>

                {/* 5. Triggered By */}
                <div className="col-span-2 pl-4 flex items-center gap-2">
                  {dep.triggeredBy.avatar ? (
                    <img
                      src={dep.triggeredBy.avatar}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-[10px] text-brand-300 font-bold flex-shrink-0">
                      {dep.triggeredBy.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs text-gray-300 truncate">{dep.triggeredBy.name}</span>
                </div>

                {/* 6. Relative Time & Duration */}
                <div className="col-span-1 text-right text-xs text-gray-500 font-mono">
                  <div>{formatRelativeTime(dep.startedAt)}</div>
                  {dep.durationSec > 0 && (
                    <div className="text-[10px] text-gray-600 font-mono">{dep.durationSec}s</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= PIPELINE RUN MODAL ================= */}
      {selectedDeployment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDepId(null)}
          title={selectedDeployment.name}
          subtitle={`${selectedDeployment.projectName} · ${selectedDeployment.commitSha}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 text-xs text-gray-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-pink-400" />
                {renderStatusBadge(selectedDeployment.status)}
                {renderEnvBadge(selectedDeployment.environment)}
              </div>
              <span className="text-[11px] tabular-nums text-gray-500">
                {selectedDeployment.durationSec}s runtime
              </span>
            </div>

            {/* Repository and commit context */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5 font-mono text-gray-300">
                  <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
                  {selectedDeployment.branch}
                </span>
                <span>Triggered by {selectedDeployment.triggeredBy.name}</span>
              </div>
              <p className="rounded-md border border-white/[0.06] bg-[#0D0E10] p-3 font-mono text-xs text-gray-200">
                {selectedDeployment.commitMessage}
              </p>
              {selectedDeployment.previewUrl && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-gray-500">Live preview</span>
                  <a
                    href={selectedDeployment.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1 font-mono text-brand-400 hover:underline"
                  >
                    <span className="truncate">{selectedDeployment.previewUrl}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              {/* Pipeline stages */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-medium text-gray-400">Pipeline stages</h3>
                <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
                  {selectedDeployment.stages.map((stage, idx) => {
                    const isSuccess = stage.status === 'success';
                    const isRunning = stage.status === 'running';
                    const isFailed = stage.status === 'failed';

                    return (
                      <div key={idx} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {isSuccess && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />}
                          {isRunning && <span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-cyan-400" />}
                          {isFailed && <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400" />}
                          {!isSuccess && !isRunning && !isFailed && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-600" />}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-white">{stage.name}</div>
                            <div className="text-[10px] capitalize text-gray-500">{stage.status}</div>
                          </div>
                        </div>
                        {stage.durationSec !== undefined && (
                          <span className="text-[11px] tabular-nums text-gray-500">{stage.durationSec}s</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Execution logs */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-brand-400" />
                    <h3>Execution logs</h3>
                  </div>
                  <button
                    onClick={() => handleCopyLogs(selectedDeployment)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    {copiedLogId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedLogId ? 'Copied' : 'Copy logs'}</span>
                  </button>
                </div>
                <div className="max-h-72 min-h-52 space-y-1.5 overflow-y-auto rounded-md border border-white/[0.06] bg-[#090A0C] p-3.5 font-mono text-[11px] text-gray-300">
                  {selectedDeployment.stages.flatMap((stage, stageIndex) =>
                    stage.logs.map((log, logIndex) => (
                      <div key={`${stageIndex}-${logIndex}`} className="flex items-start gap-2 leading-relaxed">
                        <span className="select-none text-gray-600">[{stage.name.split(' ')[0]}]</span>
                        <span className={log.includes('Error') ? 'text-rose-300' : 'text-gray-300'}>{log}</span>
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
          subtitle="Dispatch an agent-supervised build and canary verification workflow."
        >
          <form onSubmit={handleTriggerSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Target Project</label>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="w-full bg-[#181920] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Deployment Target Environment</label>
              <select
                value={targetEnv}
                onChange={(e) => setTargetEnv(e.target.value as any)}
                className="w-full bg-[#181920] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Staging">Staging (Integration Cluster)</option>
                <option value="Preview">Preview (Ephemeral PR Branch)</option>
                <option value="Production">Production (Global Edge Fleet)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setTriggerModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium shadow-glow-brand"
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
