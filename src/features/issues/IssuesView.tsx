import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/app/AppContext';
import { IssueStatus, IssuePriority, Issue
} from '@/shared/types';
import { StatusBadge, PriorityBadge } from '@/shared/components/Badge';
import { AgentRunProgress } from '@/features/runs/AgentRunProgress';
import { SquadRunFlow } from '@/features/runs/SquadRunFlow';
import { 
  Users,
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
  RefreshCw
} from 'lucide-react';

/** "just now", "3m", "2h" — a timestamp is noise in a toolbar. */
function syncAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

interface IssuesViewProps {
  onOpenNewIssue: () => void;
  onlyMyIssues?: boolean;
  /**
   * Show one project only, and hide the project picker.
   *
   * The project page used to render its own kanban — four columns to this
   * one's five, cards that looked clickable and opened nothing, no comments, no
   * squad assignment, no approval. Two boards over one dataset, drifting.
   * Embedding this one instead means there is a single board and the project
   * page stops being a lesser copy of it.
   */
  lockedProjectId?: string;
  /** Drop the page chrome, for rendering inside a page that has its own. */
  embedded?: boolean;
}

export const IssuesView: React.FC<IssuesViewProps> = ({
  onOpenNewIssue,
  onlyMyIssues = false,
  lockedProjectId,
  embedded = false
}) => {
  const { 
    issues, 
    updateIssueStatus, 
    updateIssue,
    addIssueComment, 
    runAgentOnIssue, 
    prototypeRuns,
    projects, 
    agents, 
    squads,
    triggerSquadRun,
    identity,
    localMode,
    createIssue,
    syncBoard,
    syncing,
    lastSyncedAt,
    can,
    role
  } = useApp();

  const canManageIssues = can('manage_issues');
  const canRunAgents = can('run_agents');
  const canRunSquads = can('run_squads');

  const [viewMode, setViewMode] = useState<'board' | 'list'>('list');
  /**
   * `mine` is issues you created, which is what My Issues always claimed to be.
   *
   * It used to preset this to `members` — "has a squad or a human assigned" —
   * which is neither yours nor created by you, and which one click on the All
   * chip undid. Issues now record `createdBy`, so the question is answerable.
   */
  const [filterCategory, setFilterCategory] = useState<'all' | 'mine' | 'members' | 'agents'>(
    onlyMyIssues ? 'mine' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>(lockedProjectId ?? 'all');

  /**
   * Follow the lock when the page switches projects.
   *
   * The component stays mounted while `selectedProject` changes underneath it,
   * so without this the board would keep showing the project you navigated
   * away from.
   */
  useEffect(() => {
    if (lockedProjectId) setSelectedProject(lockedProjectId);
  }, [lockedProjectId]);

  /** The column an inline add is open in, or null. */
  const [quickAddStatus, setQuickAddStatus] = useState<IssueStatus | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<IssueStatus | null>(null);
  const [pendingDoneIssueId, setPendingDoneIssueId] = useState<string | null>(null);
  
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
      // An issue created before Alpha recorded an author has no answer here,
       // so it is not yours — guessing would put someone else's work in your list.
      if (filterCategory === 'mine' && (!identity || (
        issue.assignedHuman !== identity.login &&
        issue.assignedHuman !== identity.name
      ))) return false;
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
  }, [issues, filterCategory, selectedProject, selectedPriority, selectedAgent, searchQuery, identity]);

  /** Only when one project is named, because a create needs one. */
  const canQuickAdd = selectedProject !== 'all' && canManageIssues;

  /**
   * A title and a column is a whole issue.
   *
   * The two fields the create modal exists to collect are already answered
   * here: the project by where you are, the status by which column you typed
   * into. Asking again in a dialog is the friction that stops people filing
   * issues at all — so the modal stays for filing something properly, and this
   * is for noting it down before it is forgotten.
   *
   * Everything else the daemon fills in, including the identifier and the
   * author, so a title-only issue is a complete and correct one.
   */
  const submitQuickAdd = (status: IssueStatus) => {
    const title = quickAddTitle.trim();
    if (!title || !canQuickAdd) return;

    createIssue({
      title,
      description: '',
      status,
      priority: 'medium',
      projectId: selectedProject,
      labels: []
    });

    // Left open on the same column: adding one usually means adding three.
    setQuickAddTitle('');
  };

  const runningAgentsCount = useMemo(() => {
    return issues.filter(i => i.status === 'agent_running').length;
  }, [issues]);

  const clearDragState = () => {
    setDraggedIssueId(null);
    setDragOverColumn(null);
  };

  const handleIssueDragStart = (event: React.DragEvent<HTMLDivElement>, issueId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', issueId);
    setDraggedIssueId(issueId);
  };

  /**
   * Keep board movement aligned with the execution lifecycle. Agent Running
   * is a real run, not a label, so it must go through the same preparation
   * dialog as the Run button. Done is a human checkpoint, so direct moves ask
   * for confirmation instead of silently bypassing review.
   */
  const requestIssueStatusChange = (issue: Issue, nextStatus: IssueStatus) => {
    if (issue.status === nextStatus) return;

    if (nextStatus === 'agent_running') {
      runAgentOnIssue(issue.id);
      return;
    }

    if (nextStatus === 'done') {
      setPendingDoneIssueId(issue.id);
      return;
    }

    updateIssueStatus(issue.id, nextStatus);
  };

  const handleIssueDrop = (event: React.DragEvent<HTMLDivElement>, columnId: IssueStatus) => {
    event.preventDefault();
    const issueId = event.dataTransfer.getData('text/plain') || draggedIssueId;
    const issue = issueId ? issues.find(item => item.id === issueId) : undefined;

    if (issue) requestIssueStatusChange(issue, columnId);

    clearDragState();
  };

  const pendingDoneIssue = pendingDoneIssueId
    ? issues.find(issue => issue.id === pendingDoneIssueId)
    : undefined;

  const confirmDoneStatusChange = () => {
    if (pendingDoneIssue) updateIssueStatus(pendingDoneIssue.id, 'done');
    setPendingDoneIssueId(null);
  };

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
    addIssueComment(selectedIssue.id, newComment);
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
          <div className="w-6 h-6 rounded-full bg-surface-raised border border-white/10 flex items-center justify-center text-white" title={`Agent: ${agent.name}`}>
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
          <div className="w-6 h-6 rounded-full bg-surface-raised border border-white/10 flex items-center justify-center text-amber-400" title={`Agent: ${agent.name}`}>
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          </div>
        );
      }
      if (agent.role === 'QA Tester') {
        return (
          <div className="w-6 h-6 rounded-full bg-surface-raised border border-white/10 flex items-center justify-center text-orange-400" title={`Agent: ${agent.name}`}>
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
    <div className="h-full flex flex-col overflow-hidden bg-shell text-sm text-gray-200">
      {/* Header & Jira-like Control Bar */}
      <div className="space-y-2 border-b border-white/[0.06] bg-shell px-5 py-3">
        {/* Top Row: Title, Filters & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Issues title & category pills */}
          <div className="flex items-center gap-4">
            {/*
              The project page has its own title, and two headings stacked with
              the project name above "Issues" reads as a mistake. Only the
              heading goes — the filters and the view switcher are as useful
              inside a project as outside one.
            */}
            {!embedded && (
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-gray-400" />
                <h1 className="text-base font-semibold text-white">
                  Issues
                </h1>
              </div>
            )}

            {/* Scope is a compact text control, not a second container inside the header. */}
            <div className={`flex items-center gap-1 text-xs ${role === 'dev' ? 'rounded-lg border border-white/[0.08] bg-white/[0.025] p-1' : ''}`} role={role === 'dev' ? 'tablist' : undefined} aria-label={role === 'dev' ? 'Issue scope' : undefined}>
              <button
                onClick={() => setFilterCategory('all')}
                role={role === 'dev' ? 'tab' : undefined}
                aria-selected={role === 'dev' ? filterCategory === 'all' : undefined}
                className={`${role === 'dev' ? 'rounded-md px-3 py-1.5' : 'px-2 py-1 border-b'} font-medium transition-colors ${
                  filterCategory === 'all'
                    ? 'border-brand-400 bg-brand-500/15 text-white'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                {role === 'dev' ? 'Assigned project issues' : 'All'}
              </button>
              <button
                onClick={() => setFilterCategory('mine')}
                title={identity ? `Issues assigned to ${identity.login}` : 'Waiting for your identity'}
                role={role === 'dev' ? 'tab' : undefined}
                aria-selected={role === 'dev' ? filterCategory === 'mine' : undefined}
                className={`${role === 'dev' ? 'rounded-md px-3 py-1.5' : 'px-2 py-1 border-b'} font-medium transition-colors ${
                  filterCategory === 'mine'
                    ? 'border-brand-400 bg-brand-500/15 text-white'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                {role === 'dev' ? 'Assigned to me' : 'Mine'}
              </button>
              {role !== 'dev' && <>
                <button
                  onClick={() => setFilterCategory('members')}
                  className={`px-2 py-1 border-b font-medium transition-colors ${
                    filterCategory === 'members'
                      ? 'border-brand-400 text-white'
                      : 'border-transparent text-gray-500 hover:text-white'
                  }`}
                >
                  Members
                </button>
                <button
                  onClick={() => setFilterCategory('agents')}
                  className={`px-2 py-1 border-b font-medium transition-colors ${
                    filterCategory === 'agents'
                      ? 'border-brand-400 text-white'
                      : 'border-transparent text-gray-500 hover:text-white'
                  }`}
                >
                  Agents
                </button>
              </>}
              <button
                onClick={() => setFilterCategory('all')}
                className="p-1 text-gray-500 hover:text-white transition-colors"
                title="Group / Stack options"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Actions, Status telemetry & View switches */}
          <div className="flex items-center gap-2.5">
            {/* Active work remains visible as plain status text. */}
            <div className="flex items-center gap-1.5 px-1 py-1.5 text-xs text-gray-500">
              {runningAgentsCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-cyan-300 font-medium">{runningAgentsCount} agents working</span>
                </>
              ) : (
                <span>0 agents working</span>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                showFilterBar || selectedProject !== 'all' || selectedPriority !== 'all'
                  ? 'bg-white/[0.05] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Display Button */}
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Display</span>
            </button>

            {/* View Mode Toggle: Board vs List */}
            <div className="flex items-center text-xs">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-white/[0.05] text-white' : 'text-gray-500 hover:text-white'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'board' ? 'bg-white/[0.05] text-white' : 'text-gray-500 hover:text-white'
                }`}
                title="Board View"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
            </div>

            {/*
              The board is shared through GitHub, so it needs a way to say when
              it last looked and a way to look now. Polling runs every minute;
              this is for the moment you know a teammate just did something.
            */}
            {localMode ? (
              <span
                title="GitHub sync is off while Alpha is in local mode"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/10 text-gray-500 font-medium text-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="hidden sm:inline">Local board</span>
              </span>
            ) : (
              <button
                onClick={() => void syncBoard()}
                disabled={syncing}
                title={
                  lastSyncedAt
                    ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
                    : 'Not synced yet'
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 font-medium text-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {syncing ? 'Syncing' : lastSyncedAt ? syncAgo(lastSyncedAt) : 'Sync'}
                </span>
              </button>
            )}

            {/* New Issue Button */}
            <button
              onClick={onOpenNewIssue}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 text-on-accent font-medium text-xs transition-colors"
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

            {/*
              Hidden when the page has already chosen. Offering "All Projects"
              inside one project's page is an invitation to navigate somewhere
              the surrounding chrome still claims you are not.
            */}
            {!lockedProjectId && (
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
            )}

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
      <div className="flex-1 flex overflow-hidden relative bg-surface">
        {viewMode === 'board' ? (
          /* Kanban Board Mode */
          <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex gap-5">
            {columns.map(column => {
              const colIssues = filteredIssues.filter(i => i.status === column.id);

              return (
                <div
                  key={column.id}
                  onDragOver={event => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverColumn(column.id);
                  }}
                  onDrop={event => handleIssueDrop(event, column.id)}
                  className={`w-80 flex-shrink-0 flex flex-col rounded-2xl border overflow-hidden transition-colors ${
                    dragOverColumn === column.id
                      ? 'border-brand-500/60 bg-brand-500/[0.05] ring-1 ring-brand-500/30'
                      : 'border-white/5 bg-surface-200/40'
                  }`}
                  aria-label={
                    column.id === 'agent_running'
                      ? 'Drop issues here to prepare an agent run'
                      : column.id === 'done'
                        ? 'Drop issues here to request confirmation before marking done'
                        : `Drop issues here to move them to ${column.title}`
                  }
                >
                  <div className={`p-3.5 border-b border-white/5 flex items-center justify-between bg-surface-100/60 ${column.color}`}>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={column.id} />
                      <span className="text-xs font-mono text-gray-400">({colIssues.length})</span>
                    </div>
                    {/*
                      Quick add needs a project to create into, and "All
                      projects" does not name one. On the project page the lock
                      always supplies it; on the global board it appears the
                      moment you filter to a single project.
                    */}
                    {canManageIssues && (
                      <button
                        onClick={() =>
                          canQuickAdd
                            ? (setQuickAddStatus(column.id), setQuickAddTitle(''))
                            : onOpenNewIssue()
                        }
                        className="text-gray-500 hover:text-white p-1 rounded hover:bg-white/5"
                        title={canQuickAdd ? 'Add an issue to this column' : 'New issue'}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {quickAddStatus === column.id && (
                      <div className="rounded-xl border border-brand-500/40 bg-surface-100 p-2">
                        <input
                          autoFocus
                          value={quickAddTitle}
                          onChange={e => setQuickAddTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitQuickAdd(column.id);
                            if (e.key === 'Escape') setQuickAddStatus(null);
                          }}
                          onBlur={() => !quickAddTitle.trim() && setQuickAddStatus(null)}
                          placeholder="Issue title, then Enter"
                          className="w-full bg-transparent text-xs text-white placeholder:text-gray-600 focus:outline-none"
                        />
                        <div className="mt-1.5 flex items-center justify-between">
                          {/* The daemon assigns the real identifier; promising
                              one here is what produced TES-107. */}
                          <span className="font-mono text-[10px] text-gray-600">
                            {projects.find(p => p.id === selectedProject)?.key ?? ''}
                          </span>
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => submitQuickAdd(column.id)}
                            disabled={!quickAddTitle.trim()}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold text-brand-300 hover:bg-white/5 disabled:opacity-30"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                    {colIssues.map(issue => {
                      const completedSubtasks = issue.subtasks.filter(s => s.completed).length;

                      return (
                        <div
                          key={issue.id}
                          onClick={() => setSelectedIssueId(issue.id)}
                          draggable
                          onDragStart={event => handleIssueDragStart(event, issue.id)}
                          onDragEnd={clearDragState}
                          aria-label={`Drag ${issue.identifier} to move its status`}
                          className={`p-4 rounded-xl bg-surface-100 border transition-all cursor-grab active:cursor-grabbing space-y-3 group shadow-sm hover:shadow-glow-brand ${
                            draggedIssueId === issue.id ? 'opacity-50' : ''
                          } ${
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
                            {canRunAgents && issue.status !== 'done' && issue.status !== 'agent_running' && (
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
          <div className="flex-1 space-y-2.5 overflow-y-auto p-4 sm:px-5 sm:py-4">
            {statusGroups.map(group => {
              const groupIssues = filteredIssues.filter(i => group.statusMatch(i.status));
              const isCollapsed = collapsedSections[group.id] ?? false;

              return (
                <div key={group.id} className="space-y-1">
                  {/* Jira Section Header Bar */}
                  <div
                    onClick={() => toggleSection(group.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-raised hover:bg-surface-high border border-white/[0.04] cursor-pointer select-none transition-colors"
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
                        <div className="py-2.5 text-center font-mono text-xs text-gray-500">
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
                    className="w-full select-text cursor-text bg-transparent text-xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand-500 rounded p-1.5"
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
                    className="w-full select-text cursor-text bg-surface-200 border border-white/10 rounded-xl p-4 text-sm text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-brand-500"
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
                      className="flex-1 select-text cursor-text bg-surface-200 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
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
                      className="flex-1 select-text cursor-text bg-surface-200 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentContent.trim()}
                      className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-xs font-semibold text-on-accent transition-colors flex items-center gap-1.5"
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
                {canRunAgents && selectedIssue.status !== 'done' && !prototypeRuns.some(run => run.issueId === selectedIssue.id) && (
                  <button
                    onClick={() => runAgentOnIssue(selectedIssue.id)}
                    disabled={selectedIssue.status === 'agent_running'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-on-accent font-bold text-sm shadow-glow-brand transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{selectedIssue.status === 'agent_running' ? 'Agent Running...' : 'Launch Autonomous Agent'}</span>
                  </button>
                )}

                {/*
                  Launching a squad was only possible from the Squads page, so
                  the multi-agent path could not be started from the board where
                  the work actually lives. Shown only when a squad is assigned,
                  and only while a single-agent run is not already underway.
                */}
                {canRunSquads && selectedIssue.assignedSquadId &&
                  selectedIssue.status !== 'done' &&
                  !prototypeRuns.some(run => run.issueId === selectedIssue.id) && (
                    <button
                      onClick={() =>
                        void triggerSquadRun(
                          selectedIssue.assignedSquadId!,
                          selectedIssue.id,
                          [],
                          selectedIssue.title
                        )
                      }
                      disabled={selectedIssue.status === 'agent_running'}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 border border-white/10 text-white font-medium text-sm transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      <span>
                        Launch {squads.find(sq => sq.id === selectedIssue.assignedSquadId)?.name ?? 'Squad'}
                      </span>
                    </button>
                  )}

                <AgentRunProgress issueId={selectedIssue.id} />

                {/* The squad's own shape: who ran, who is running, who is next. */}
                <SquadRunFlow issueId={selectedIssue.id} />

                {/* Status Picker */}
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-medium">Status</label>
                  <select
                    value={selectedIssue.status}
                    onChange={(e) => requestIssueStatusChange(selectedIssue, e.target.value as IssueStatus)}
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

                {/*
                  A squad could be chosen when an issue was created and never
                  afterwards — and the choice was discarded anyway, because the
                  column did not exist. Sitting under the agent picker because
                  they answer the same question: who owns this issue.
                */}
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-medium">Assigned Squad</label>
                  <select
                    value={selectedIssue.assignedSquadId || ''}
                    onChange={(e) => updateIssue(selectedIssue.id, { assignedSquadId: e.target.value || undefined })}
                    className="w-full bg-surface-100 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">No squad</option>
                    {squads.map(sq => (
                      <option key={sq.id} value={sq.id}>
                        {sq.name} ({sq.memberAgentIds.length})
                      </option>
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

      {pendingDoneIssue && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPendingDoneIssueId(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-done-title"
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface-100 p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h2 id="confirm-done-title" className="text-base font-semibold text-white">
                  Mark issue as done?
                </h2>
                <p className="text-sm leading-relaxed text-gray-400">
                  This skips the normal review checkpoint for <span className="font-semibold text-gray-200">{pendingDoneIssue.identifier}</span>. Continue only if the work has already been reviewed.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDoneIssueId(null)}
                className="rounded-lg border border-white/10 px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                Keep in {pendingDoneIssue.status === 'review' ? 'Review' : 'current status'}
              </button>
              <button
                type="button"
                onClick={confirmDoneStatusChange}
                className="rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-emerald-400"
              >
                Mark done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
