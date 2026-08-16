import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { IssueStatus, IssuePriority, Issue } from '../types';
import { StatusBadge, PriorityBadge } from '../components/common/Badge';
import { 
  Kanban, 
  List, 
  Plus, 
  Search, 
  Bot, 
  CheckCircle2, 
  Play, 
  ExternalLink,
  GitBranch,
  X,
  Send,
  ChevronDown,
  ChevronRight,
  Filter,
  SlidersHorizontal,
  Layers,
  FolderKanban,
  Minus,
  BarChart2,
  Flame,
  Star,
  Asterisk,
  CheckSquare,
  User
} from 'lucide-react';

interface IssuesViewProps {
  onOpenNewIssue: () => void;
  onlyMyIssues?: boolean;
}

export const IssuesView: React.FC<IssuesViewProps> = ({ onOpenNewIssue, onlyMyIssues = false }) => {
  const { 
    issues, 
    updateIssueStatus, 
    updateIssue, 
    runAgentOnIssue, 
    projects, 
    agents, 
    squads 
  } = useApp();

  const [viewMode, setViewMode] = useState<'board' | 'list'>('list');
  const [filterCategory, setFilterCategory] = useState<'all' | 'members' | 'agents'>(onlyMyIssues ? 'members' : 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [showFilterBar, setShowFilterBar] = useState(false);
  
  // Collapsed status sections state (Jira style)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Slide-over drawer state
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const columns: { id: IssueStatus; title: string; color: string }[] = [
    { id: 'backlog', title: 'Backlog', color: 'border-gray-700' },
    { id: 'todo', title: 'Todo', color: 'border-slate-600' },
    { id: 'in_progress', title: 'In Progress', color: 'border-amber-500/50' },
    { id: 'agent_running', title: 'Agent Running', color: 'border-cyan-500/50' },
    { id: 'review', title: 'In Review', color: 'border-purple-500/50' },
    { id: 'done', title: 'Done', color: 'border-emerald-500/50' },
  ];

  // Jira-like Status Groups for List View
  const statusGroups: { 
    id: string; 
    label: string; 
    statusMatch: (s: IssueStatus) => boolean; 
    iconColor: string;
    icon: React.ReactNode;
  }[] = [
    { 
      id: 'backlog', 
      label: 'Backlog', 
      statusMatch: s => s === 'backlog', 
      iconColor: 'text-gray-400',
      icon: <span className="w-2.5 h-2.5 rounded-full border border-gray-500 inline-block" />
    },
    { 
      id: 'todo', 
      label: 'Todo', 
      statusMatch: s => s === 'todo', 
      iconColor: 'text-slate-400',
      icon: <span className="w-2.5 h-2.5 rounded-full border border-slate-400 inline-block" />
    },
    { 
      id: 'in_progress', 
      label: 'In Progress', 
      statusMatch: s => s === 'in_progress' || s === 'agent_running', 
      iconColor: 'text-amber-400',
      icon: <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
    },
    { 
      id: 'review', 
      label: 'In Review', 
      statusMatch: s => s === 'review', 
      iconColor: 'text-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    },
    { 
      id: 'done', 
      label: 'Done', 
      statusMatch: s => s === 'done', 
      iconColor: 'text-sky-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
    }
  ];

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (filterCategory === 'agents' && !issue.assignedAgentId) return false;
      if (filterCategory === 'members' && !issue.assignedSquadId && !issue.assignedHuman) return false;
      if (selectedProject !== 'all' && issue.projectId !== selectedProject) return false;
      if (selectedPriority !== 'all' && issue.priority !== selectedPriority) return false;
      if (selectedAgent !== 'all' && issue.assignedAgentId !== selectedAgent) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          issue.title.toLowerCase().includes(q) ||
          issue.identifier.toLowerCase().includes(q) ||
          issue.description.toLowerCase().includes(q) ||
          issue.labels.some(l => l.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [issues, filterCategory, selectedProject, selectedPriority, selectedAgent, searchQuery]);

  const runningAgentsCount = useMemo(() => {
    return issues.filter(i => i.status === 'agent_running').length;
  }, [issues]);

  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  const handleToggleSubtask = (issueId: string, subtaskId: string) => {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;
    const updated = issue.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
    updateIssue(issueId, { subtasks: updated });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !newSubtaskTitle.trim()) return;
    const newSt = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false
    };
    updateIssue(selectedIssue.id, { subtasks: [...selectedIssue.subtasks, newSt] });
    setNewSubtaskTitle('');
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !newCommentContent.trim()) return;
    const newComment = {
      id: `comm-${Date.now()}`,
      authorType: 'user' as const,
      authorName: 'Lead Engineer (You)',
      content: newCommentContent.trim(),
      createdAt: new Date().toISOString()
    };
    updateIssue(selectedIssue.id, { comments: [...selectedIssue.comments, newComment] });
    setNewCommentContent('');
  };

  const getPriorityIcon = (priority: IssuePriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span title="Urgent">
            <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20" />
          </span>
        );
      case 'high':
        return (
          <span title="High Priority">
            <BarChart2 className="w-3.5 h-3.5 text-amber-400 rotate-90" />
          </span>
        );
      case 'medium':
        return (
          <span title="Medium Priority">
            <BarChart2 className="w-3.5 h-3.5 text-amber-400/80 rotate-90" />
          </span>
        );
      case 'low':
      case 'none':
      default:
        return (
          <span title="Low / None Priority">
            <Minus className="w-3.5 h-3.5 text-gray-500" />
          </span>
        );
    }
  };

  const getAssigneeVisual = (issue: Issue) => {
    const agent = agents.find(a => a.id === issue.assignedAgentId);
    const squad = squads.find(s => s.id === issue.assignedSquadId);

    if (agent) {
      if (agent.role === 'Architect') {
        return (
          <div className="w-6 h-6 rounded-full bg-[#1c1e27] border border-white/10 flex items-center justify-center text-white" title={`Agent: ${agent.name}`}>
            <Asterisk className="w-3.5 h-3.5 text-white stroke-[2.5]" />
          </div>
        );
      }
      if (agent.role === 'Coder') {
        return (
          <img src={agent.avatar} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10" title={`Agent: ${agent.name}`} />
        );
      }
      if (agent.role === 'Reviewer') {
        return (
          <div className="w-6 h-6 rounded-full bg-[#1c1e27] border border-white/10 flex items-center justify-center text-amber-400" title={`Agent: ${agent.name}`}>
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          </div>
        );
      }
      if (agent.role === 'QA Tester') {
        return (
          <div className="w-6 h-6 rounded-full bg-[#1c1e27] border border-white/10 flex items-center justify-center text-orange-400" title={`Agent: ${agent.name}`}>
            <Flame className="w-3.5 h-3.5 fill-orange-400/20 text-orange-400" />
          </div>
        );
      }
      return (
        <img src={agent.avatar} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10" title={`Agent: ${agent.name}`} />
      );
    }

    if (squad) {
      return (
        <div className="w-6 h-6 rounded-full bg-surface-100 border border-white/10 flex items-center justify-center text-xs" title={`Squad: ${squad.name}`}>
          👥
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#121318] text-sm text-gray-200">
      {/* Header & Jira-like Control Bar */}
      <div className="px-6 py-4 border-b border-white/[0.08] bg-[#14151B] space-y-3">
        {/* Top Row: Title, Filters & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Issues title & category pills */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {onlyMyIssues ? (
                <User className="w-4 h-4 text-emerald-400" />
              ) : (
                <CheckSquare className="w-4 h-4 text-gray-400" />
              )}
              <h1 className="text-base font-bold text-white tracking-tight">
                {onlyMyIssues ? 'My Issues' : 'Issues'}
              </h1>
            </div>

            {/* Jira-like Filter Pills: All, Members, Agents, Layers */}
            <div className="flex items-center gap-1.5 bg-[#1a1c24] p-1 rounded-lg border border-white/[0.08] text-xs">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  filterCategory === 'all'
                    ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterCategory('members')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  filterCategory === 'members'
                    ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Members
              </button>
              <button
                onClick={() => setFilterCategory('agents')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  filterCategory === 'agents'
                    ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Agents
              </button>
              <button
                onClick={() => setFilterCategory('all')}
                className="p-1 rounded-md text-gray-400 hover:text-white transition-colors"
                title="Group / Stack options"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Actions, Status telemetry & View switches */}
          <div className="flex items-center gap-2.5">
            {/* Active Agents Running telemetry badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-gray-400">
              {runningAgentsCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-cyan-300 font-semibold">{runningAgentsCount} agents working</span>
                </>
              ) : (
                <span>0 agents working</span>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showFilterBar || selectedProject !== 'all' || selectedPriority !== 'all'
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-white/[0.04] text-gray-300 hover:text-white border-white/[0.08] hover:bg-white/[0.08]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Display Button */}
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-gray-300 hover:text-white border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Display</span>
            </button>

            {/* View Mode Toggle: Board vs List */}
            <div className="flex items-center bg-[#1a1c24] p-1 rounded-lg border border-white/[0.08] text-xs">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-white/[0.12] text-white shadow-sm font-semibold' : 'text-gray-400 hover:text-white'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                  viewMode === 'board' ? 'bg-white/[0.12] text-white shadow-sm font-semibold' : 'text-gray-400 hover:text-white'
                }`}
                title="Board View"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
            </div>

            {/* New Issue Button */}
            <button
              onClick={onOpenNewIssue}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-glow-brand transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Issue</span>
            </button>
          </div>
        </div>

        {/* Collapsible Filter Toolbar */}
        {showFilterBar && (
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues, identifiers, labels..."
                className="w-full bg-surface-100 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-surface-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-surface-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-surface-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Issue Canvas */}
      <div className="flex-1 flex overflow-hidden relative bg-[#16171D]">
        {viewMode === 'board' ? (
          /* Kanban Board Mode */
          <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex gap-5">
            {columns.map(column => {
              const colIssues = filteredIssues.filter(i => i.status === column.id);

              return (
                <div
                  key={column.id}
                  className="w-80 flex-shrink-0 flex flex-col bg-surface-200/40 rounded-2xl border border-white/5 overflow-hidden"
                >
                  <div className={`p-3.5 border-b border-white/5 flex items-center justify-between bg-surface-100/60 ${column.color}`}>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={column.id} />
                      <span className="text-xs font-mono text-gray-400">({colIssues.length})</span>
                    </div>
                    <button
                      onClick={onOpenNewIssue}
                      className="text-gray-500 hover:text-white p-1 rounded hover:bg-white/5"
                      title="Add Issue to this column"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {colIssues.map(issue => {
                      const completedSubtasks = issue.subtasks.filter(s => s.completed).length;

                      return (
                        <div
                          key={issue.id}
                          onClick={() => setSelectedIssueId(issue.id)}
                          className={`p-4 rounded-xl bg-surface-100 border transition-all cursor-pointer space-y-3 group shadow-sm hover:shadow-glow-brand ${
                            selectedIssueId === issue.id 
                              ? 'border-brand-500 shadow-glow-brand bg-brand-500/10' 
                              : 'border-white/10 hover:border-brand-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-bold text-brand-400">
                              {issue.identifier}
                            </span>
                            <PriorityBadge priority={issue.priority} showLabel={false} />
                          </div>

                          <h4 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-brand-300 transition-colors">
                            {issue.title}
                          </h4>

                          {issue.subtasks.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400 bg-surface-200 px-2.5 py-1 rounded-lg w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{completedSubtasks}/{issue.subtasks.length} subtasks</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-gray-400">
                            <div>{getAssigneeVisual(issue)}</div>
                            {issue.status !== 'done' && issue.status !== 'agent_running' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runAgentOnIssue(issue.id);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/40 text-brand-300 text-xs font-semibold border border-brand-500/30 transition-all opacity-80 group-hover:opacity-100"
                              >
                                <Play className="w-3 h-3 text-brand-400 fill-brand-400" />
                                <span>Run</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Jira-like Grouped Status List View (Matching Exact Screenshot) */
          <div className="flex-1 overflow-y-auto p-4 sm:px-6 sm:py-5 space-y-4">
            {statusGroups.map(group => {
              const groupIssues = filteredIssues.filter(i => group.statusMatch(i.status));
              const isCollapsed = collapsedSections[group.id] ?? false;

              return (
                <div key={group.id} className="space-y-1">
                  {/* Jira Section Header Bar */}
                  <div
                    onClick={() => toggleSection(group.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#191a24] hover:bg-[#1e202c] border border-white/[0.04] cursor-pointer select-none transition-colors"
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded bg-transparent border-white/20 text-brand-500 focus:ring-0 cursor-pointer"
                    />

                    {/* Collapse Chevron */}
                    <button className="text-gray-400 hover:text-white p-0.5">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Status Circle & Title + Count */}
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center">{group.icon}</span>
                      <span className="text-xs font-semibold text-white tracking-tight">{group.label}</span>
                      <span className="text-xs font-mono text-gray-500 font-normal">{groupIssues.length}</span>
                    </div>
                  </div>

                  {/* Section Content: Issues or "No issues" */}
                  {!isCollapsed && (
                    <div className="space-y-0.5 pl-2">
                      {groupIssues.length === 0 ? (
                        /* Empty state placeholder for section */
                        <div className="py-4 text-center text-xs text-gray-500 font-mono">
                          No issues
                        </div>
                      ) : (
                        groupIssues.map(issue => {
                          const project = projects.find(p => p.id === issue.projectId);
                          const totalSubtasks = issue.subtasks.length;
                          const completedSubtasks = issue.subtasks.filter(s => s.completed).length;

                          return (
                            <div
                              key={issue.id}
                              onClick={() => setSelectedIssueId(issue.id)}
                              className={`group px-3 py-2.5 rounded-lg flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                                selectedIssueId === issue.id 
                                  ? 'bg-white/[0.08] border border-white/10' 
                                  : 'hover:bg-white/[0.04] border border-transparent'
                              }`}
                            >
                              {/* Left: Checkbox, Priority, Key, Title, Subtasks Ring */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="text-gray-500 flex-shrink-0">
                                  {getPriorityIcon(issue.priority)}
                                </div>

                                <span className="font-mono text-xs font-medium text-gray-400 w-16 flex-shrink-0">
                                  {issue.identifier}
                                </span>

                                <span className="text-xs sm:text-sm font-medium text-white truncate max-w-2xl group-hover:text-brand-300 transition-colors">
                                  {issue.title}
                                </span>

                                {/* Subtasks fraction ring if subtasks exist */}
                                {totalSubtasks > 0 && (
                                  <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400 flex-shrink-0">
                                    {completedSubtasks === totalSubtasks ? (
                                      <span className="text-sky-400 flex items-center gap-1">
                                        <span className="w-2.5 h-2.5 rounded-full border-2 border-sky-400 bg-sky-400/30 inline-block" />
                                        <span>{completedSubtasks}/{totalSubtasks}</span>
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 flex items-center gap-1">
                                        <span className="w-2.5 h-2.5 rounded-full border border-gray-500 inline-block" />
                                        <span>{completedSubtasks}/{totalSubtasks}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Right: Project folder tag & Assignee visual */}
                              <div className="flex items-center gap-4 flex-shrink-0">
                                {project && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                                    <FolderKanban className="w-3.5 h-3.5 text-gray-500" />
                                    <span>{project.name}</span>
                                  </div>
                                )}

                                <div className="flex items-center">
                                  {getAssigneeVisual(issue)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 2-Column Slide-Over Inspector Drawer */}
        {selectedIssue && (
          <div className="absolute inset-y-0 right-0 w-full max-w-4xl bg-surface-100 border-l border-white/15 shadow-2xl z-30 flex flex-col animate-slide-up text-sm">
            <div className="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-surface-200/80">
              <div className="flex items-center gap-3 font-mono text-sm text-gray-400">
                <span className="text-brand-400 font-bold">{selectedIssue.identifier}</span>
                <span>/</span>
                <span>Issue Details & Execution Pipeline</span>
              </div>
              <button
                onClick={() => setSelectedIssueId(null)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/10">
              {/* Left Content */}
              <div className="flex-1 overflow-y-auto p-7 space-y-7">
                <div>
                  <input
                    type="text"
                    value={selectedIssue.title}
                    onChange={(e) => updateIssue(selectedIssue.id, { title: e.target.value })}
                    className="w-full bg-transparent text-xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand-500 rounded p-1.5"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                    Description & Specifications
                  </label>
                  <textarea
                    rows={5}
                    value={selectedIssue.description}
                    onChange={(e) => updateIssue(selectedIssue.id, { description: e.target.value })}
                    className="w-full bg-surface-200 border border-white/10 rounded-xl p-4 text-sm text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Subtasks */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                      Subtasks Checklist ({selectedIssue.subtasks.filter(s => s.completed).length}/{selectedIssue.subtasks.length})
                    </label>
                  </div>

                  <div className="space-y-2">
                    {selectedIssue.subtasks.map(st => (
                      <div
                        key={st.id}
                        onClick={() => handleToggleSubtask(selectedIssue.id, st.id)}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-white/5 hover:border-white/15 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => {}}
                          className="rounded bg-surface-100 border-white/20 text-brand-500 focus:ring-0"
                        />
                        <span className={`text-sm flex-1 ${st.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddSubtask} className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add a new subtask..."
                      className="flex-1 bg-surface-200 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="submit"
                      disabled={!newSubtaskTitle.trim()}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-xs font-semibold text-white transition-colors"
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Comments & Activity Stream */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Agent Activity & Discussion Stream
                  </h4>

                  <div className="space-y-3">
                    {selectedIssue.comments.map(c => (
                      <div key={c.id} className="p-4 rounded-xl bg-surface-200/70 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white flex items-center gap-2">
                            {c.authorType === 'agent' && <Bot className="w-3.5 h-3.5 text-cyan-400" />}
                            <span>{c.authorName}</span>
                          </span>
                          <span className="text-gray-500 font-mono">
                            {new Date(c.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-mono whitespace-pre-wrap">
                          {c.content}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newCommentContent}
                      onChange={(e) => setNewCommentContent(e.target.value)}
                      placeholder="Leave a comment or instruction for the agent..."
                      className="flex-1 bg-surface-200 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentContent.trim()}
                      className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Sidebar Metadata */}
              <div className="w-full md:w-80 bg-surface-200/40 p-6 space-y-6 flex-shrink-0 text-xs">
                {/* Trigger Action */}
                {selectedIssue.status !== 'done' && (
                  <button
                    onClick={() => runAgentOnIssue(selectedIssue.id)}
                    disabled={selectedIssue.status === 'agent_running'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-sm shadow-glow-brand transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{selectedIssue.status === 'agent_running' ? 'Agent Running...' : 'Launch Autonomous Agent'}</span>
                  </button>
                )}

                {/* Status Picker */}
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-medium">Status</label>
                  <select
                    value={selectedIssue.status}
                    onChange={(e) => updateIssueStatus(selectedIssue.id, e.target.value as IssueStatus)}
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500 font-medium"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="agent_running">Agent Running</option>
                    <option value="review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-medium">Priority</label>
                  <select
                    value={selectedIssue.priority}
                    onChange={(e) => updateIssue(selectedIssue.id, { priority: e.target.value as IssuePriority })}
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500 font-medium"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="none">None</option>
                  </select>
                </div>

                {/* Assigned Agent */}
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-medium">Assigned Agent</label>
                  <select
                    value={selectedIssue.assignedAgentId || ''}
                    onChange={(e) => updateIssue(selectedIssue.id, { assignedAgentId: e.target.value || undefined })}
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Unassigned</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                    ))}
                  </select>
                </div>

                {/* Project */}
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-medium">Strategic Project</label>
                  <select
                    value={selectedIssue.projectId}
                    onChange={(e) => updateIssue(selectedIssue.id, { projectId: e.target.value })}
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                    ))}
                  </select>
                </div>

                {/* Git branch info */}
                {selectedIssue.branchName && (
                  <div className="p-3.5 rounded-xl bg-surface-100 border border-white/5 space-y-1 font-mono">
                    <div className="text-gray-500 text-[10px] uppercase">Active Branch</div>
                    <div className="text-cyan-300 flex items-center gap-1.5 truncate">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span className="truncate">{selectedIssue.branchName}</span>
                    </div>
                    {selectedIssue.prUrl && (
                      <a
                        href={selectedIssue.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand-400 hover:underline pt-1 text-[11px]"
                      >
                        <span>Open GitHub PR</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
