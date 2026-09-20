import React, { useState, useMemo } from 'react';
import { useApp } from '@/app/AppContext';
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
  Bot,
  Kanban as KanbanIcon,
  List as ListIcon,
  ChevronLeft,
  Workflow,
} from 'lucide-react';
import { CreateProjectModal } from '@/features/projects/CreateProjectModal';
import { ProjectResourcesPanel } from '@/features/projects/ProjectResourcesPanel';
import { IssuesView } from '@/features/issues/IssuesView';
import { ProjectEnvPanel } from '@/features/projects/ProjectEnvPanel';
import { deriveProjectKey } from '@/features/projects/useProjectsViewModel';
import { Project, ProjectStatus, ProjectPriority } from '@/shared/types';
import { Modal } from '@/shared/components/Modal';

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

    agents,
    openBuildRoom
  } = useApp();
  
  // Selected Project for dedicated Workspace Kanban View
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [resourcesModalOpen, setResourcesModalOpen] = useState<boolean>(false);

  // Search & Filters on main list
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'progress' | 'targetDate'>('createdAt');

  // Workspace board view state
  const [boardViewMode, setBoardViewMode] = useState<'kanban' | 'list'>('kanban');
  const [boardSearchQuery, setBoardSearchQuery] = useState<string>('');

  // Selected project memo
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

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

  // Issues belonging to currently selected project
  const projectIssues = useMemo(() => {
    if (!selectedProject) return [];
    return issues.filter(i => {
      if (i.projectId !== selectedProject.id) return false;
      if (boardSearchQuery.trim()) {
        const q = boardSearchQuery.toLowerCase();
        return (
          i.title.toLowerCase().includes(q) ||
          (i.identifier && i.identifier.toLowerCase().includes(q)) ||
          i.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedProject, issues, boardSearchQuery]);

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
  // VIEW 1: DEDICATED PROJECT WORKSPACE (KANBAN BOARD + RIGHT PROPERTIES)
  // =========================================================================
  if (selectedProject) {
    const totalCount = issues.filter(i => i.projectId === selectedProject.id).length;
    const doneCount = issues.filter(i => i.projectId === selectedProject.id && i.status === 'done').length;
    const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-shell text-gray-300 select-none font-sans">
        
        {/* ================= WORKSPACE TOP BREADCRUMB & ACTION BAR ================= */}
        <div className="px-6 py-3.5 border-b border-white/[0.06] bg-shell flex items-center justify-between gap-4 flex-shrink-0">
          
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
              <h1 className="text-sm font-semibold text-white tracking-wide truncate">
                {selectedProject.name}
              </h1>
              <span className="text-xs text-gray-500 font-mono">#{selectedProject.key}</span>
            </div>
          </div>

          {/* Right: Board Search, View Toggle, Edit & New Task Actions */}
          <div className="flex items-center gap-2">
            
            {/* Search Input */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={boardSearchQuery}
                onChange={(e) => setBoardSearchQuery(e.target.value)}
                placeholder="Search issues..."
                className="w-full bg-surface-raised border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {/* View Mode Toggle (Kanban vs List) */}
            <div className="flex items-center bg-surface-raised border border-white/5 rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setBoardViewMode('kanban')}
                className={`p-1.5 rounded-lg transition-colors ${
                  boardViewMode === 'kanban' ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                }`}
                title="Kanban Board"
              >
                <KanbanIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setBoardViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  boardViewMode === 'list' ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                }`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Edit Project */}
            <button
              onClick={() => setEditingProject(selectedProject)}
              className="p-1.5 rounded-xl bg-surface-raised hover:bg-surface-high border border-white/5 text-gray-400 hover:text-white transition-colors"
              title="Edit Project Details"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <button
              onClick={() => openBuildRoom(selectedProject.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-raised hover:bg-surface-high border border-white/5 text-gray-300 hover:text-white transition-colors"
              title="Open Live Build Room"
            >
              <Workflow className="w-3.5 h-3.5 text-brand-300" />
              <span className="hidden xl:inline">Build room</span>
            </button>

            {/* New Issue Button */}
            <button
              onClick={() => onOpenNewIssue?.()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-on-accent text-xs font-semibold shadow-glow-brand transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add issue</span>
            </button>
          </div>
        </div>

        {/* ================= MAIN WORKSPACE SPLIT (KANBAN + RIGHT PROPERTIES) ================= */}
        <div className="flex-1 flex overflow-hidden">
          
          {/*
            The board, rather than a second one that looked like it.

            This was ~185 lines of its own kanban: four columns to the real
            board's five, folding backlog into Todo, with cards that carried
            hover styling and a cursor-pointer and no onClick — so an issue
            could not be opened, commented on, assigned a squad, or approved
            from the page dedicated to its project.

            IssuesView locked to this project is the same board everywhere, so
            the two cannot drift apart again.
          */}
          <div className="flex-1 overflow-hidden">
            <IssuesView
              embedded
              lockedProjectId={selectedProject.id}
              onOpenNewIssue={() => onOpenNewIssue?.()}
            />
          </div>

          {/* ================= RIGHT SIDE PANEL: PROPERTIES, STATUS, RESOURCES ================= */}
          <div className="w-80 border-l border-white/5 bg-shell p-5 overflow-y-auto flex-shrink-0 space-y-6 text-xs font-sans">
            
            {/* 1. Progress. The bar duplicated the per-column counts sitting a
                few inches to the left, so only the number survives. */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-gray-400">Progress</span>
              <span className="text-emerald-400 tabular-nums">{doneCount}/{totalCount} done ({progressPercent}%)</span>
            </div>

            {/* 2. Metadata / Properties List */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <span className="text-[11px] font-medium text-gray-400 block">Properties</span>
              
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status</span>
                <div className="flex items-center gap-1.5 font-mono text-gray-300 capitalize">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedProject.status === 'in_progress' ? 'bg-cyan-400' :
                    selectedProject.status === 'completed' ? 'bg-emerald-400' :
                    selectedProject.status === 'paused' ? 'bg-amber-400' : 'bg-gray-500'
                  }`} />
                  <span>{selectedProject.status.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Priority</span>
                <span className="font-mono text-gray-300 capitalize">{selectedProject.priority || 'Medium'}</span>
              </div>

              {/* Project Lead */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Lead</span>
                <div className="flex items-center gap-1.5 text-gray-300">
                  <Bot className="w-3.5 h-3.5 text-gray-400" />
                  <span className="truncate max-w-[120px]">{selectedProject.leadName || 'Unassigned'}</span>
                </div>
              </div>

              {/* Target Date */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Target Date</span>
                <span className="font-mono text-gray-300">{selectedProject.targetDate || 'No deadline'}</span>
              </div>
            </div>

            {/* 3. Ground Rules & Agent Directive */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <span>Ground Rules & Context</span>
                </span>
              </div>
              <p className="p-3 rounded-xl bg-well border border-white/5 text-gray-300 leading-relaxed font-mono text-[11px]">
                {selectedProject.description || 'No specific ground rules configured.'}
              </p>
            </div>

            {/* 4. Connected Code Resources. The rail lists what is attached and
                nothing more — both attach forms carry eight controls between
                them, which never fit a 320px column, so they live in a dialog. */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Connected Repositories</span>
                </span>
                <button
                  onClick={() => setResourcesModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
                  title="Attach or create a repository"
                >
                  <Plus className="w-3 h-3" />
                  <span>Attach</span>
                </button>
              </div>

              <ProjectResourcesPanel
                variant="inline"
                projectId={selectedProject.id}
                resources={selectedProject.resources || []}
                onChange={(next) => updateProject(selectedProject.id, { resources: next })}
              />
            </div>

            {/* Values this project's agents resolve MCP servers against. */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <ProjectEnvPanel
                envVars={selectedProject.envVars || []}
                onChange={(next) => updateProject(selectedProject.id, { envVars: next })}
              />
            </div>

            {/* 5. Active Agents. Dropped entirely when there are none — a
                header plus an italic "no agents" line is pure noise. */}
            {boundAgents.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <span className="text-[11px] font-medium text-gray-400 block">
                  Active Agents ({boundAgents.length})
                </span>

                <div className="space-y-1.5">
                  {boundAgents.map(agent => (
                    <div key={agent.id} className="p-2 rounded-xl bg-well border border-white/5 flex items-center gap-2.5">
                      <img src={agent.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white truncate">{agent.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono truncate">{agent.role}</div>
                      </div>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        agent.workStatus === 'working' || agent.status === 'executing' ? 'bg-emerald-400' : 'bg-gray-600'
                      }`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* ================= RESOURCES MODAL =================
            Repo creation and attachment both changed the project the moment you
            hit the button, so they cannot live behind a Save/Cancel form — this
            dialog keeps the immediate writes and only borrows the room. */}
        {resourcesModalOpen && (
          <Modal
            isOpen={true}
            onClose={() => setResourcesModalOpen(false)}
            title="Project Resources"
            subtitle="Create a repository, or attach an existing repo or local folder."
          >
            <ProjectResourcesPanel
              projectId={selectedProject.id}
              resources={selectedProject.resources || []}
              onChange={(next) => updateProject(selectedProject.id, { resources: next })}
              githubOrg={selectedProject.githubOrg}
              onOrgChange={(org) => updateProject(selectedProject.id, { githubOrg: org })}
            />
          </Modal>
        )}

        {/* ================= EDIT PROJECT MODAL ================= */}
        {editingProject && (
          <Modal
            isOpen={true}
            onClose={() => setEditingProject(null)}
            title="Edit Project"
            subtitle="Update status, priority, lead, or target dates."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // An empty key would break every issue identifier in the
                // project (`<KEY>-101`), so fall back to a derived one.
                const key = editingProject.key.trim().toUpperCase()
                  || deriveProjectKey(editingProject.name, projects, editingProject.id);
                updateProject(editingProject.id, { ...editingProject, key });
                setEditingProject(null);
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
                  value={editingProject.description}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full bg-surface-raised border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand-500 font-mono text-[11px]"
                />
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

              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Project Lead</label>
                <input
                  type="text"
                  value={editingProject.leadName || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, leadName: e.target.value })}
                  placeholder="e.g. lloyd lim"
                  className="w-full bg-surface-raised border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

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
                    className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-on-accent font-medium"
                  >
                    Save
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
    <div className="h-full flex flex-col overflow-y-auto bg-shell text-gray-300 p-6 space-y-6 select-none font-sans relative">
      
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
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 text-xs font-medium text-on-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New project</span>
        </button>
      </div>

      {/* ================= SEARCH & ACTION ROW ================= */}
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

      {/* ================= MINIMALIST PROJECTS TABLE ================= */}
      <div className="w-full">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-normal text-gray-500 border-b border-white/[0.04]">
          <div className="col-span-4">Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Priority</div>
          <div className="col-span-1 text-left">Progress</div>
          <div className="col-span-2 pl-4">Lead</div>
          <div className="col-span-1 text-right flex items-center justify-end gap-1">
            <span>Created</span>
            <ArrowDown className="w-3 h-3 text-gray-500" />
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
                className="grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs hover:bg-white/[0.02] cursor-pointer transition-colors group"
              >
                {/* 1. Name with Emoji / Icon */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
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

                {/* 5. Lead */}
                <div className="col-span-2 pl-4 flex items-center gap-2">
                  {project.leadName ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-orange-600/30 border border-orange-500/40 flex items-center justify-center text-[10px] text-orange-200 font-bold overflow-hidden">
                        {project.leadName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-300 truncate">{project.leadName}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-600">
                      <div className="w-4 h-4 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-[10px]">
                      </div>
                      <span className="text-gray-500">—</span>
                    </div>
                  )}
                </div>

                {/* 6. Created */}
                <div className="col-span-1 text-right text-xs text-gray-500 font-mono">
                  {project.createdAt || '4d ago'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= CREATE PROJECT MODAL ================= */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        // Land inside the new project rather than back on the list.
        onCreated={(project) => setSelectedProjectId(project.id)}
      />

    </div>
  );
};
