import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { 
  Plus, 
  Folder,
  Search, 
  Filter, 
  ArrowDown, 
  ArrowUp, 
  Check, 
  Edit3, 
  Trash2, 
  GitBranch, 
  Sparkles, 
  Flame, 
  Minus,
  Workflow,
  ChevronLeft,
} from 'lucide-react';
import { CreateProjectModal } from '@/features/projects/CreateProjectModal';
import { ProjectResourcesPanel } from '@/features/projects/ProjectResourcesPanel';
import { IssuesView } from '@/features/issues/IssuesView';
import { ProjectRepositoryView } from '@/features/projects/repository/ProjectRepositoryView';
import { useProjectRepos } from '@/features/projects/repository/useProjectRepos';
import { deriveProjectKey } from '@/features/projects/useProjectsViewModel';
import { Project, ProjectStatus, ProjectPriority } from '@/shared/types';
import { Modal } from '@/shared/components/Modal';
import { apiService } from '@/shared/services/apiService';

type ProjectOrchestrationSettings = {
  enabled: boolean;
  available: boolean;
  localOnly: true;
  reason?: string;
};

interface ProjectsViewProps {
  /** Opens the full create-issue dialog, which App owns. */
  onOpenNewIssue?: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onOpenNewIssue }) => {
  const { 
    projects, 
    issues, 
    updateProject, 
    deleteProject, 
    showToast,


    agents,
    can
  } = useApp();

  const canManageProjects = can('manage_projects');
  /** Editing is the team's; creating a project stays with project managers. */
  const canEditProjects = can('edit_projects');
  /** Repository provisioning is narrower than general project administration. */
  const canProvisionRepositories = can('provision_repositories');
  const canManageIssues = can('manage_issues');
  
  // Selected Project for dedicated Workspace Kanban View
  const [selectedProjectId, setSelectedProjectId] = useTabSessionState<string | null>('projects.selectedProject', null);
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [resourcesModalOpen, setResourcesModalOpen] = useState<boolean>(false);
  const [orchestrationSettings, setOrchestrationSettings] = useState<ProjectOrchestrationSettings | null>(null);
  const [orchestrationSettingsLoading, setOrchestrationSettingsLoading] = useState(false);
  const [repositoryFocus, setRepositoryFocus] = useState<{ projectId: string; repo: string } | null>(null);
  const clearRepositoryFocus = useCallback(() => setRepositoryFocus(null), []);

  useEffect(() => {
    if (!repositoryFocus) return;
    const focus = repositoryFocus;
    const timer = window.setTimeout(() => {
      setRepositoryFocus(current =>
        current?.projectId === focus.projectId && current.repo === focus.repo ? null : current
      );
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [repositoryFocus]);

  // Search & Filters on main list
  const [searchQuery, setSearchQuery] = useTabSessionState<string>('projects.search', '');
  const [statusFilter, setStatusFilter] = useTabSessionState<string>('projects.statusFilter', 'all');
  const [priorityFilter, setPriorityFilter] = useTabSessionState<string>('projects.priorityFilter', 'all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useTabSessionState<'desc' | 'asc'>('projects.sortOrder', 'desc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);
  const [sortBy, setSortBy] = useTabSessionState<'createdAt' | 'name' | 'progress' | 'targetDate'>('projects.sortBy', 'createdAt');


  // Selected project memo
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  useEffect(() => {
    let current = true;
    if (!selectedProject) {
      setOrchestrationSettings(null);
      return () => { current = false; };
    }
    setOrchestrationSettingsLoading(true);
    void apiService.getProjectOrchestrationSettings(selectedProject.id)
      .then(settings => { if (current) setOrchestrationSettings(settings); })
      .catch(error => {
        if (current) {
          setOrchestrationSettings({ enabled: false, available: false, localOnly: true,
            reason: error instanceof Error ? error.message : 'Could not read local orchestration settings.' });
        }
      })
      .finally(() => { if (current) setOrchestrationSettingsLoading(false); });
    return () => { current = false; };
  }, [selectedProject?.id]);

  // GitHub repositories the API can read for this project. Given the attached
  // repositories so one created a moment ago shows up without a reload.
  const attachedRepos = (selectedProject?.resources ?? [])
    .filter(r => r.type === 'github_repo')
    .map(r => r.pathOrUrl);
  const { repos: projectRepos, loading: repositoriesLoading } = useProjectRepos(selectedProject?.id ?? null, attachedRepos);

  // `key` is UNIQUE in the daemon's schema and a duplicate makes the write fail
  // with nothing on screen to explain it. Flag it while the dialog is still open.
  const keyCollision = useMemo(() => {
    if (!editingProject) return false;
    const key = editingProject.key.trim().toUpperCase();
    if (!key) return false;
    return projects.some(p => p.id !== editingProject.id && p.key.toUpperCase() === key);
  }, [editingProject, projects]);

  // Filter and Sort Main Projects List
  const filteredProjects = useMemo(() => {
    let list = projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && (p.priority || 'none') !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesKey = p.key.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        if (!matchesName && !matchesKey && !matchesDesc) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'targetDate') cmp = (a.targetDate || '').localeCompare(b.targetDate || '');
      else if (sortBy === 'progress') {
        const aIssues = issues.filter(i => i.projectId === a.id);
        const bIssues = issues.filter(i => i.projectId === b.id);
        const aProg = aIssues.length > 0 ? (aIssues.filter(i => i.status === 'done').length / aIssues.length) : (a.progressPercentage || 0);
        const bProg = bIssues.length > 0 ? (bIssues.filter(i => i.status === 'done').length / bIssues.length) : (b.progressPercentage || 0);
        cmp = aProg - bProg;
      } else {
        cmp = (a.createdAt || a.id).localeCompare(b.createdAt || b.id);
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [projects, issues, statusFilter, priorityFilter, searchQuery, sortBy, sortOrder]);

  const projectIssues = useMemo(() => issues.filter(issue => issue.projectId === selectedProject?.id),
    [issues, selectedProject?.id]);

  // Bound Agents in this project
  const boundAgents = useMemo(() => {
    if (!selectedProject) return [];
    const agentIds = new Set<string>();
    projectIssues.forEach(i => {
      if (i.assignedAgentId) agentIds.add(i.assignedAgentId);
    });
    if (selectedProject.leadAgentId) agentIds.add(selectedProject.leadAgentId);
    return agents.filter(a => agentIds.has(a.id));
  }, [selectedProject, projectIssues, agents]);

  // Helper for Circular Progress Ring
  const renderProgressRing = (done: number, total: number) => {
    if (total === 0) {
      return (
        <span className="text-gray-500 font-mono text-sm">—</span>
      );
    }
    
    const percentage = Math.min(100, Math.round((done / total) * 100));
    const radius = 6;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
          <circle
            cx="8"
            cy="8"
            r={radius}
            className="stroke-gray-700/60"
            strokeWidth="2"
            fill="transparent"
          />
          <circle
            cx="8"
            cy="8"
            r={radius}
            className="stroke-emerald-400 transition-all duration-300"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="text-xs text-gray-300 font-mono">
          {done}/{total}
        </span>
      </div>
    );
  };

  // =========================================================================
  // VIEW 1: PROJECT WORKSPACE
  // =========================================================================
  if (selectedProject) {
    const totalCount = issues.filter(i => i.projectId === selectedProject.id).length;
    const doneCount = issues.filter(i => i.projectId === selectedProject.id && i.status === 'done').length;
    const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-shell text-gray-300 select-none font-sans">
        
        {/* ================= WORKSPACE TOP BREADCRUMB & ACTION BAR ================= */}
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-shell px-4 py-3 sm:px-5">
          
          {/* Left: Breadcrumbs navigation */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSelectedProjectId(null)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Projects</span>
            </button>

            <span className="text-gray-600 font-mono">/</span>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base flex-shrink-0">{selectedProject.icon || '⚡'}</span>
              <h1 className="truncate text-base font-semibold tracking-tight text-white">
                {selectedProject.name}
              </h1>
              <span className="text-xs text-gray-500 font-mono">#{selectedProject.key}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs tabular-nums text-emerald-400" aria-label="Project progress">
              {doneCount}/{totalCount} done ({progressPercent}%)
            </span>
            {/* Edit Project */}
            {canEditProjects && (
              <button
                onClick={() => setEditingProject(selectedProject)}
                className="p-1.5 rounded-xl bg-surface-raised hover:bg-surface-high border border-white/5 text-gray-400 hover:text-white transition-colors"
                title="Edit Project Details"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

          </div>
        </div>

        <ProjectRepositoryView
          key={selectedProject.id}
          projectId={selectedProject.id}
          repositories={projectRepos}
          repositoriesLoading={repositoriesLoading}
          initialRepository={repositoryFocus?.projectId === selectedProject.id ? repositoryFocus.repo : undefined}
          onInitialRepositoryApplied={clearRepositoryFocus}
          onManageRepositories={canEditProjects ? () => setResourcesModalOpen(true) : undefined}
          overview={(
            <div className="flex h-full min-h-0 flex-col">
              <details className="group shrink-0 border-b border-white/[0.06] text-xs">
                <summary className="cursor-pointer px-5 py-3 text-gray-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400">
                  <span className="ml-1 font-medium">Project details</span>
                  <span className="ml-3 capitalize text-gray-500">{selectedProject.status.replace('_', ' ')}</span>
                  <span className="ml-3 text-gray-500">{projectRepos.length} repositories</span>
                </summary>
                <div className="grid max-h-[45vh] gap-5 overflow-y-auto px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
                  <section className="space-y-3">
                    <h2 className="font-medium text-gray-300">Properties</h2>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3">
                      <dt className="text-gray-500">Status</dt>
                      <dd className="capitalize">{selectedProject.status.replace('_', ' ')}</dd>
                      <dt className="text-gray-500">Priority</dt>
                      <dd className="capitalize">{selectedProject.priority || 'Medium'}</dd>
                      <dt className="text-gray-500">Build lead</dt>
                      <dd className="flex min-w-0 items-center gap-1.5">
                        <Workflow className="h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden />
                        <span>Orchestrator</span>
                      </dd>
                      <dt className="text-gray-500">Target date</dt>
                      <dd>{selectedProject.targetDate || 'No deadline'}</dd>
                    </dl>
                    {boundAgents.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h3 className="text-gray-400">Active agents ({boundAgents.length})</h3>
                        <div className="flex flex-wrap gap-2">
                          {boundAgents.map(agent => (
                            <div key={agent.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/5 px-2 py-1.5" title={agent.role}>
                              <img src={agent.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                              <span className="truncate">{agent.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                  <section className="space-y-2">
                    <section aria-label="Orchestrated build workflow" className="space-y-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.045] p-3">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-3.5 w-3.5 text-violet-300" aria-hidden />
                        <h2 className="font-semibold text-gray-200">Orchestrator builds</h2>
                        {orchestrationSettings?.available && <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">ALWAYS ON</span>}
                      </div>
                      <p className="text-[11px] leading-relaxed text-gray-400">
                        The Orchestrator leads every desktop product build. It shows its plan and specialist assignments first, then coordinates the selected codebases together. You review the finished change before it is sent to GitHub.
                      </p>
                      <p className="text-[10px] leading-relaxed text-gray-500">
                        {orchestrationSettingsLoading ? 'Checking this desktop…'
                          : orchestrationSettings?.available ? 'Always enabled. One product plan can cover the frontend, backend, and other selected codebases.'
                            : orchestrationSettings?.reason ?? 'The Orchestrator is unavailable in this environment.'}
                      </p>
                    </section>
                    <h2 className="flex items-center gap-1.5 font-medium text-gray-300">
                      <Sparkles className="h-3.5 w-3.5 text-brand-400" aria-hidden />Ground Rules &amp; Context
                    </h2>
                    <p className="select-text whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-well p-3 font-mono text-[11px] leading-relaxed">
                      {selectedProject.description || 'No specific ground rules configured.'}
                    </p>
                  </section>
                  <section className="space-y-2 md:col-span-2 xl:col-span-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="flex items-center gap-1.5 font-medium text-gray-300">
                        <GitBranch className="h-3.5 w-3.5 text-cyan-400" aria-hidden />Connected Repositories
                      </h2>
                      {canEditProjects && (
                        <button type="button" onClick={() => setResourcesModalOpen(true)} className="inline-flex items-center gap-1 text-gray-400 hover:text-white">
                          <Plus className="h-3 w-3" aria-hidden />
                          {canProvisionRepositories ? 'Add repository' : 'Attach existing'}
                        </button>
                      )}
                    </div>
                    <ProjectResourcesPanel
                      variant="inline"
                      projectId={selectedProject.id}
                      resources={selectedProject.resources || []}
                      onChange={next => updateProject(selectedProject.id, { resources: next })}
                      readOnly={!canEditProjects}
                      canCreateRepository={canProvisionRepositories}
                    />
                  </section>
                </div>
              </details>
              <div className="min-h-0 flex-1">
                <IssuesView
                  embedded
                  lockedProjectId={selectedProject.id}
                  onOpenNewIssue={canManageIssues ? () => onOpenNewIssue?.() : () => {}}
                />
              </div>
            </div>
          )}
        />

        {/* ================= RESOURCES MODAL =================
            Repo creation and attachment both changed the project the moment you
            hit the button, so they cannot live behind a Save/Cancel form — this
            dialog keeps the immediate writes and only borrows the room. */}
        {resourcesModalOpen && (
          <Modal
            isOpen={true}
            onClose={() => setResourcesModalOpen(false)}
            title="Project Resources"
            subtitle={canProvisionRepositories
              ? 'Create a repository, or attach an existing repo or local folder.'
              : 'Attach an existing repository or local folder. New repositories are created by a project manager.'}
          >
            <ProjectResourcesPanel
              projectId={selectedProject.id}
              resources={selectedProject.resources || []}
              onChange={(next) => updateProject(selectedProject.id, { resources: next })}
              githubOrg={selectedProject.githubOrg}
              onOrgChange={(org) => updateProject(selectedProject.id, { githubOrg: org })}
              readOnly={!canEditProjects}
              canCreateRepository={canProvisionRepositories}
              onRepositoryCreated={(_repositories, previewRepository) => {
                setRepositoryFocus({ projectId: selectedProject.id, repo: previewRepository });
                setResourcesModalOpen(false);
              }}
            />
          </Modal>
        )}

        {/* ================= EDIT PROJECT MODAL ================= */}
        {editingProject && (
          <Modal
            isOpen={true}
            onClose={() => setEditingProject(null)}
            closeDisabled={savingProject}
            title="Edit Project"
            subtitle="Update project details, priority, or target dates."
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                // An empty key would break every issue identifier in the
                // project (`<KEY>-101`), so fall back to a derived one.
                const key = editingProject.key.trim().toUpperCase()
                  || deriveProjectKey(editingProject.name, projects, editingProject.id);
                setSavingProject(true);
                try {
                  const saved = await updateProject(editingProject.id, { ...editingProject, key });
                  if (saved) {
                    setEditingProject(null);
                    showToast('Project saved', 'Ground rules are ready for future Orchestrator builds.', 'success');
                  }
                } finally {
                  setSavingProject(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              {/* Icon, name and key. Creation derives the key and never shows
                  these three, so this is where they stay editable. */}
              <div className="flex items-start gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-gray-400">Icon</label>
                  <div className="relative group">
                    <div className="w-12 h-[38px] rounded-xl bg-surface-raised border border-white/10 flex items-center justify-center text-xl cursor-pointer hover:border-brand-500/50 transition-colors">
                      {editingProject.icon || '⚡'}
                    </div>
                    <div className="absolute top-full left-0 mt-1 p-2 bg-surface-100 border border-white/15 rounded-xl shadow-2xl z-30 hidden group-hover:grid grid-cols-4 gap-1.5 w-40">
                      {['⚡', '🎨', '🚀', '🛡️', '💳', '🧠', '📦', '🌐', '⚙️', '🎯', '📱', '🔒'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setEditingProject({ ...editingProject, icon: emoji })}
                          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    className="w-full bg-surface-raised border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="w-24">
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Key</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={editingProject.key}
                    onChange={(e) => setEditingProject({ ...editingProject, key: e.target.value.toUpperCase() })}
                    className="w-full bg-surface-raised border border-white/10 rounded-xl px-3 py-2 text-white font-mono uppercase text-center focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* The daemon enforces UNIQUE on key, and the write fails silently
                  from the user's side. Catch the clash before they hit Save. */}
              {keyCollision && (
                <p className="text-[11px] text-amber-300">
                  Key <span className="font-mono">{editingProject.key.toUpperCase()}</span> is already
                  used by another project. Saving will fail — try{' '}
                  <span className="font-mono">
                    {deriveProjectKey(editingProject.name, projects, editingProject.id)}
                  </span>.
                </p>
              )}

              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">
                  Goal & Ground Rules (Agent Context)
                </label>
                <textarea
                  rows={3}
                  maxLength={8000}
                  value={editingProject.description ?? ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full bg-surface-raised border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand-500 font-mono text-[11px]"
                />
                <p className="mt-1 text-right text-[10px] text-gray-500">{(editingProject.description ?? '').length.toLocaleString()} / 8,000 characters</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Status</label>
                  <select
                    value={editingProject.status}
                    onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value as ProjectStatus })}
                    className="w-full bg-surface-raised border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In progress</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Priority</label>
                  <select
                    value={editingProject.priority || 'none'}
                    onChange={(e) => setEditingProject({ ...editingProject, priority: e.target.value as ProjectPriority })}
                    className="w-full bg-surface-raised border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="none">No priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-violet-300/15 bg-violet-300/[0.045] p-3"><Workflow className="mt-0.5 h-4 w-4 shrink-0 text-violet-200" /><div><div className="text-xs font-medium text-violet-100">Orchestrator leads every product build</div><p className="mt-1 text-[11px] leading-5 text-gray-400">It prepares the work plan, chooses specialists, and shows the assignments before they start.</p></div></div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editingProject.startDate || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, startDate: e.target.value })}
                    className="w-full bg-surface-raised border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={editingProject.targetDate || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, targetDate: e.target.value })}
                    className="w-full bg-surface-raised border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  type="button"
                  disabled={savingProject}
                  onClick={() => {
                    deleteProject(editingProject.id);
                    setSelectedProjectId(null);
                    setEditingProject(null);
                  }}
                  className="flex items-center gap-1 text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Project</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProject(null)}
                    disabled={savingProject}
                    className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProject || keyCollision}
                    className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-on-accent font-medium"
                  >
                    {savingProject ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </Modal>
        )}

      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MAIN PROJECTS TABLE LIST
  // =========================================================================
  return (
    <div className="relative flex h-full flex-col space-y-5 overflow-y-auto bg-shell p-5 text-gray-300 select-none font-sans lg:p-6">
      
      {/* ================= TOP HEADER BAR ================= */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-gray-400" />
            <h1 className="text-base font-semibold text-white">Projects</h1>
            <span className="text-xs tabular-nums text-gray-500">{projects.length}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Choose a project, then open an issue to prepare an agent run.</p>
        </div>

        {/* + New project button */}
        {canManageProjects && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 text-xs font-medium text-on-accent transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New project</span>
          </button>
        )}
      </div>

      {/* ================= SEARCH & ACTION ROW ================= */}
      {projects.length > 0 && (
      <div className="flex items-center justify-between gap-4">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-surface border border-white/[0.07] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Right: Action Buttons (Filter, Created Sort, Table view) */}
        <div className="flex items-center gap-2 relative">
          
          {/* Filter Button */}
          <div className="relative">
            <button
              onClick={() => {
                setFilterDropdownOpen(prev => !prev);
                setSortDropdownOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                statusFilter !== 'all' || priorityFilter !== 'all' 
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' 
                  : 'bg-transparent hover:bg-white/[0.03] text-gray-400 hover:text-white border-transparent'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Filter Dropdown */}
            {filterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 p-2 rounded-xl bg-surface-raised border border-white/10 shadow-2xl z-30 space-y-2 text-xs">
                <div>
                  <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1">Status</div>
                  {['all', 'in_progress', 'planned', 'paused', 'completed'].map((st) => (
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
                      <span>{st.replace('_', ' ')}</span>
                      {statusFilter === st && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
                </div>

                <div className="pt-1 border-t border-white/5">
                  <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1">Priority</div>
                  {['all', 'urgent', 'high', 'medium', 'low', 'none'].map((pr) => (
                    <button
                      key={pr}
                      onClick={() => {
                        setPriorityFilter(pr);
                        setFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                        priorityFilter === pr ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <span>{pr === 'all' ? 'All priorities' : pr}</span>
                      {priorityFilter === pr && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
                </div>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors"
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              <span>{sortBy === 'name' ? 'Name' : sortBy === 'progress' ? 'Progress' : sortBy === 'targetDate' ? 'Target date' : 'Created'}</span>
            </button>

            {/* Sort Dropdown */}
            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-2 rounded-xl bg-surface-raised border border-white/10 shadow-2xl z-30 space-y-1 text-xs">
                {(['createdAt', 'name', 'progress', 'targetDate'] as const).map((field) => (
                  <button
                    key={field}
                    onClick={() => {
                      setSortBy(field);
                      setSortDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                      sortBy === field ? 'bg-white/10 text-white font-semibold' : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="capitalize">{field === 'createdAt' ? 'Created time' : field === 'targetDate' ? 'Target date' : field}</span>
                    {sortBy === field && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}
                <div className="pt-1 border-t border-white/5">
                  <button
                    onClick={() => {
                      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                      setSortDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-between"
                  >
                    <span>Direction</span>
                    <span className="font-mono text-[10px] text-brand-400 uppercase">{sortOrder}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      )}

      {/* ================= MINIMALIST PROJECTS TABLE ================= */}
      {filteredProjects.length === 0 ? (
        <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-surface/30 px-6 py-12 text-center">
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-inset ring-brand-400/20">
            <Folder className="h-5 w-5" />
          </span>
          <h2 className="text-sm font-semibold text-white">
            {projects.length === 0
              ? (canManageProjects ? 'Start with a project' : 'Waiting for a PM to create a project')
              : 'No projects match your filters'}
          </h2>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-gray-500">
            {projects.length === 0
              ? (canManageProjects
                ? 'Projects keep issues, agents, and connected resources organized in one place.'
                : 'Projects and repositories will appear here when a project manager initiates them for this workspace.')
              : 'Try a different search or clear the active filters to see more projects.'}
          </p>
          {projects.length === 0 ? (
            canManageProjects ? (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="mt-5 flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-brand-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create project</span>
              </button>
            ) : null
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="mt-5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="w-full">
          {/* Table Column Headers */}
          <div className="grid grid-cols-12 gap-4 border-b border-white/[0.04] px-4 py-2 text-xs font-normal text-gray-500">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Priority</div>
            <div className="col-span-1 text-left">Progress</div>
            <div className="col-span-2 flex items-center justify-end gap-1 text-right">
              <span>Created</span>
              <ArrowDown className="h-3 w-3 text-gray-500" />
            </div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/[0.02]">
            {filteredProjects.map((project) => {
            const prIssues = issues.filter(i => i.projectId === project.id);
            const totalIssues = prIssues.length || project.totalIssues || 0;
            const doneIssues = prIssues.length > 0
              ? prIssues.filter(i => i.status === 'done').length 
              : (project.completedIssues || 0);

              return (
                <div
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className="group grid grid-cols-12 items-center gap-4 px-4 py-3.5 text-xs transition-colors hover:bg-white/[0.02]"
                >
                {/* 1. Name with Emoji / Icon */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <span className="text-base flex-shrink-0">{project.icon || '⚡'}</span>
                  <span className="font-medium text-white truncate group-hover:text-gray-200">
                    {project.name}
                  </span>
                </div>

                {/* 2. Status Dot */}
                <div className="col-span-2 flex items-center gap-1.5 text-gray-300 font-mono text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    project.status === 'in_progress' ? 'bg-cyan-400' :
                    project.status === 'completed' ? 'bg-emerald-400' :
                    project.status === 'paused' ? 'bg-amber-400' : 'bg-gray-500'
                  }`} />
                  <span className="capitalize">
                    {project.status.replace('_', ' ')}
                  </span>
                </div>

                {/* 3. Priority */}
                <div className="col-span-2 flex items-center gap-1.5 text-gray-400">
                  {project.priority === 'urgent' ? (
                    <div className="flex items-center gap-1.5 text-rose-400">
                      <Flame className="w-3.5 h-3.5" />
                      <span>Urgent</span>
                    </div>
                  ) : project.priority === 'high' ? (
                    <span className="text-amber-400">High</span>
                  ) : project.priority === 'medium' ? (
                    <span className="text-blue-400">Medium</span>
                  ) : project.priority === 'low' ? (
                    <span className="text-gray-400">Low</span>
                  ) : (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Minus className="w-3.5 h-3.5" />
                      <span>No priority</span>
                    </div>
                  )}
                </div>

                {/* 4. Progress (Circular Ring) */}
                <div className="col-span-1">
                  {renderProgressRing(doneIssues, totalIssues)}
                </div>

                {/* 6. Created */}
                <div className="col-span-2 text-right text-xs text-gray-500 tabular-nums">
                  {project.createdAt ? new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= CREATE PROJECT MODAL ================= */}
      <CreateProjectModal
        isOpen={createModalOpen && canManageProjects}
        onClose={() => setCreateModalOpen(false)}
        // Land inside the new project rather than back on the list.
        onCreated={(project) => setSelectedProjectId(project.id)}
      />

    </div>
  );
};
