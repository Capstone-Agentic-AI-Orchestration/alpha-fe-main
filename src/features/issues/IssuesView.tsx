import React, { useState, useMemo, useEffect } from 'react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { IssueStatus, IssuePriority, Issue
} from '@/shared/types';
import { PriorityBadge } from '@/shared/components/Badge';
import { apiService, type IssueBuildStatus } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import { ACTIVE_BUILD_STATUSES, BuildChip } from './BuildChip';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { BUILD_DECISION_STATUSES, initialsOf, taskHandoffMessage } from './taskFlow';
import {
  Kanban,
  List,
  Plus,
  Search,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Filter,
  SlidersHorizontal,
  Layers,
  FolderKanban,
  Minus,
  BarChart2,
  Flame,
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
   * builds, no approval. Two boards over one dataset, drifting.
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
    projects,
    startIssueBuild,
    identity,
    localMode,
    createIssue,
    syncBoard,
    syncing,
    lastSyncedAt,
    can,
    role,
    visibleTabs,
    setActiveTab,
    activeTabId,
    setTabSessionState,
    chatThreads,
    createNewThread,
    setActiveThreadId
  } = useApp();

  const sessionPrefix = embedded ? `projectIssues:${lockedProjectId ?? 'project'}` : 'issues';

  const canManageIssues = can('manage_issues');
  const canRunBuilds = can('run_builds');

  // Project managers plan on the kanban board, so it is where they land; everyone else starts on the list.
  const [viewMode, setViewMode] = useTabSessionState<'board' | 'list'>(`${sessionPrefix}.viewMode`, role === 'pm' ? 'board' : 'list');
  /**
   * `mine` is issues you created, which is what My Issues always claimed to be.
   *
   * It used to preset this to `members` — "has someone assigned" —
   * which is neither yours nor created by you, and which one click on the All
   * chip undid. Issues now record `createdBy`, so the question is answerable.
   */
  const [filterCategory, setFilterCategory] = useTabSessionState<'all' | 'mine' | 'members'>(
    `${sessionPrefix}.filterCategory`,
    onlyMyIssues ? 'mine' : 'all'
  );
  const [searchQuery, setSearchQuery] = useTabSessionState<string>(`${sessionPrefix}.search`, '');
  const [selectedProject, setSelectedProject] = useTabSessionState<string>(`${sessionPrefix}.project`, lockedProjectId ?? 'all');

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
  const [quickAddTitle, setQuickAddTitle] = useTabSessionState<string>(`${sessionPrefix}.quickAddTitle`, '');
  const [selectedPriority, setSelectedPriority] = useTabSessionState<string>(`${sessionPrefix}.priority`, 'all');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<IssueStatus | null>(null);
  const [pendingDoneIssueId, setPendingDoneIssueId] = useState<string | null>(null);
  const [pendingBuildIssueId, setPendingBuildIssueId] = useState<string | null>(null);

  /**
   * The latest Orchestrator build for each issue. Builds do not change an
   * issue's stored status, so the board reads them to place cards in Building
   * and to label each card. Desktop only: the cloud does not run builds.
   */
  const [issueBuilds, setIssueBuilds] = useState<Record<string, IssueBuildStatus>>({});
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiService.getIssueBuildStatuses()
        .then(rows => { if (!cancelled) setIssueBuilds(Object.fromEntries(rows.map(row => [row.issueId, row]))); })
        // An older daemon has no build-status route; cards simply show no chip.
        .catch(() => undefined);
    };
    const timer = isDesktop ? window.setInterval(load, 10_000) : undefined;
    if (isDesktop) load();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, []);
  const hasActiveBuild = (issue: Issue) => ACTIVE_BUILD_STATUSES.has(issueBuilds[issue.id]?.status ?? '');
  const canStartBuild = (issue: Issue) =>
    canRunBuilds && issue.status !== 'done' && issue.status !== 'agent_running' && !hasActiveBuild(issue);
  const boardColumnFor = (issue: Issue): IssueStatus =>
    issue.status !== 'done' && issue.status !== 'review' && hasActiveBuild(issue) ? 'agent_running' : issue.status;

  // Collapsed status sections state (Jira style)
  const [collapsedSections, setCollapsedSections] = useTabSessionState<Record<string, boolean>>(`${sessionPrefix}.collapsedSections`, {});

  // Slide-over drawer state
  const [selectedIssueId, setSelectedIssueId] = useTabSessionState<string | null>(`${sessionPrefix}.selectedIssue`, null);

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const COLUMN_DOTS: Record<IssueStatus, string> = {
    backlog: 'h-2.5 w-2.5 rounded-full border border-dashed border-content-muted',
    todo: 'h-2.5 w-2.5 rounded-full border border-control',
    in_progress: 'h-2.5 w-2.5 rounded-full bg-status-warning',
    agent_running: 'h-2.5 w-2.5 rounded-full bg-status-info animate-pulse',
    review: 'h-2.5 w-2.5 rounded-full bg-selected-content',
    done: 'h-2.5 w-2.5 rounded-full bg-status-success'
  };

  const columns: { id: IssueStatus; title: string; color: string }[] = [
    { id: 'backlog', title: 'Backlog', color: 'border-divider' },
    { id: 'todo', title: 'Todo', color: 'border-divider' },
    { id: 'in_progress', title: 'In progress', color: 'border-status-warning-border' },
    { id: 'agent_running', title: 'Building', color: 'border-status-info-border' },
    { id: 'review', title: 'In review', color: 'border-divider' },
    { id: 'done', title: 'Done', color: 'border-status-success-border' },
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
      iconColor: 'text-content-secondary',
      icon: <span className="w-2.5 h-2.5 rounded-full border border-divider inline-block" />
    },
    {
      id: 'todo',
      label: 'Todo',
      statusMatch: s => s === 'todo',
      iconColor: 'text-content-secondary',
      icon: <span className="w-2.5 h-2.5 rounded-full border border-divider inline-block" />
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      statusMatch: s => s === 'in_progress' || s === 'agent_running',
      iconColor: 'text-status-warning',
      icon: <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
    },
    {
      id: 'review',
      label: 'In Review',
      statusMatch: s => s === 'review',
      iconColor: 'text-status-success',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
    },
    {
      id: 'done',
      label: 'Done',
      statusMatch: s => s === 'done',
      iconColor: 'text-status-info',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-status-info" />
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
      if (filterCategory === 'members' && !issue.assignedHuman) return false;
      if (selectedProject !== 'all' && issue.projectId !== selectedProject) return false;
      if (selectedPriority !== 'all' && issue.priority !== selectedPriority) return false;
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
  }, [issues, filterCategory, selectedProject, selectedPriority, searchQuery, identity]);

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
    return issues.filter(i => i.status === 'agent_running' || hasActiveBuild(i)).length;
  }, [issues]);

  const clearDragState = () => {
    setDraggedIssueId(null);
    setDragOverColumn(null);
  };

  const handleIssueDragStart = (event: React.DragEvent<HTMLElement>, issueId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', issueId);
    setDraggedIssueId(issueId);
  };

  /**
   * Keep board movement aligned with the execution lifecycle. Building is a
   * real Orchestrator build, not a label, so dropping a card there asks to
   * start one. Done is a human checkpoint, so direct moves ask for
   * confirmation instead of silently bypassing review.
   */
  const requestIssueStatusChange = (issue: Issue, nextStatus: IssueStatus) => {
    if (issue.status === nextStatus) return;

    if (nextStatus === 'agent_running') {
      if (canRunBuilds && !hasActiveBuild(issue) && issue.status !== 'done') setPendingBuildIssueId(issue.id);
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

  const getPriorityIcon = (priority: IssuePriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span title="Urgent">
            <Flame className="w-3.5 h-3.5 text-status-danger fill-rose-400/20" />
          </span>
        );
      case 'high':
        return (
          <span title="High Priority">
            <BarChart2 className="w-3.5 h-3.5 text-status-warning rotate-90" />
          </span>
        );
      case 'medium':
        return (
          <span title="Medium Priority">
            <BarChart2 className="w-3.5 h-3.5 text-status-warning rotate-90" />
          </span>
        );
      case 'low':
      case 'none':
      default:
        return (
          <span title="Low / None Priority">
            <Minus className="w-3.5 h-3.5 text-content-muted" />
          </span>
        );
    }
  };

  /** The person working the issue. Agents are chosen per task by the Orchestrator, not assigned here. */
  const getAssigneeVisual = (issue: Issue) => {
    const person = issue.assignedHuman?.trim();
    if (!person) return null;
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-divider bg-surface-high text-[9px] font-semibold text-content-secondary" title={`Assignee: ${person}`}>
        {initialsOf(person)}
      </span>
    );
  };

  const pendingBuildIssue = pendingBuildIssueId ? issues.find(issue => issue.id === pendingBuildIssueId) : undefined;
  const confirmIssueBuild = () => {
    if (!pendingBuildIssue) return;
    setPendingBuildIssueId(null);
    void startIssueBuild(pendingBuildIssue.id);
  };
  const chatAvailable = visibleTabs.includes('chat');

  /** The project chat a task's build was started in, newest first. */
  const buildChatFor = (issue: Issue) =>
    [...chatThreads].reverse().find(thread => thread.title === `Build ${issue.identifier}` && thread.projectId === issue.projectId);

  const openBuildChat = (issue: Issue) => {
    const thread = buildChatFor(issue);
    if (!thread) return;
    setActiveThreadId(thread.id);
    setActiveTab('chat');
  };

  /**
   * Hand a task to the developer's project chat.
   *
   * Opens a new conversation in the task's project with a short request already
   * typed and the task attached. Nothing is sent: the developer reads it, adds
   * to it if they want, and presses Send.
   */
  const handOffToChat = (issue: Issue) => {
    const threadId = createNewThread(`Work on ${issue.identifier}`, issue.projectId);
    if (!threadId) return;
    setTabSessionState(activeTabId, `chat.session.${threadId}.draft`, taskHandoffMessage(issue));
    setTabSessionState(activeTabId, `chat.session.${threadId}.taskRef`, issue.id);
    setSelectedIssueId(null);
    setActiveTab('chat');
  };
  // Project managers plan and approve; developers do the work, so they get the hand-off.
  const canHandOff = chatAvailable && can('manage_chat') && (role === 'dev' || role === 'admin');

  /** Tasks waiting on a person: a plan or finished build to approve, a stuck build, or work to review. */
  const needsYou = useMemo(() => filteredIssues.filter(issue => {
    const build = issueBuilds[issue.id];
    if (build && BUILD_DECISION_STATUSES.has(build.status)) return can('run_builds');
    return issue.status === 'review' && !hasActiveBuild(issue) && canManageIssues;
  }), [filteredIssues, issueBuilds, canManageIssues]);
  const needsYouLabel = (issue: Issue) => {
    switch (issueBuilds[issue.id]?.status) {
      case 'awaiting_plan_approval': return 'Plan ready to approve';
      case 'awaiting_approval': return 'Build ready for review';
      case 'blocked':
      case 'recovery_required': return 'Build needs direction';
      default: return 'Ready for review';
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-shell text-sm text-content">
      {/* Header & Jira-like Control Bar */}
      <div className="space-y-2 border-b border-divider bg-shell px-5 py-3">
        {/* Top Row: Title, Filters & Controls */}
        <div className={`flex flex-col justify-between gap-4 ${embedded ? 'xl:flex-row xl:flex-wrap xl:items-center' : 'sm:flex-row sm:items-center'}`}>
          {/* Left: Tasks title & category pills */}
          <div className="flex items-center gap-4">
            {/*
              The project page has its own title, and two headings stacked with
               the project name above "Tasks" reads as a mistake. Only the
              heading goes — the filters and the view switcher are as useful
              inside a project as outside one.
            */}
            {!embedded && (
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-content-secondary" />
                <h1 className="text-base font-semibold text-content">
                  Tasks
                </h1>
              </div>
            )}

            {/* Scope is a compact text control, not a second container inside the header. */}
            <div className={`flex items-center gap-1 text-xs ${role === 'dev' ? 'rounded-lg border border-divider bg-surface-raised p-1' : ''}`} role={role === 'dev' ? 'tablist' : undefined} aria-label={role === 'dev' ? 'Task scope' : undefined}>
              <button
                onClick={() => setFilterCategory('all')}
                role={role === 'dev' ? 'tab' : undefined}
                aria-selected={role === 'dev' ? filterCategory === 'all' : undefined}
                className={`${role === 'dev' ? 'rounded-md px-3 py-1.5' : 'px-2 py-1 border-b'} font-medium transition-colors ${
                  filterCategory === 'all'
                    ? 'border-divider bg-selected text-selected-content'
                    : 'border-transparent text-content-muted hover:text-content'
                }`}
              >
                {role === 'dev' ? 'Assigned project tasks' : 'All'}
              </button>
              <button
                onClick={() => setFilterCategory('mine')}
                title={identity ? `Tasks assigned to ${identity.login}` : 'Waiting for your identity'}
                role={role === 'dev' ? 'tab' : undefined}
                aria-selected={role === 'dev' ? filterCategory === 'mine' : undefined}
                className={`${role === 'dev' ? 'rounded-md px-3 py-1.5' : 'px-2 py-1 border-b'} font-medium transition-colors ${
                  filterCategory === 'mine'
                    ? 'border-divider bg-selected text-selected-content'
                    : 'border-transparent text-content-muted hover:text-content'
                }`}
              >
                {role === 'dev' ? 'Assigned to me' : 'Mine'}
              </button>
              {role !== 'dev' && <>
                <button
                  onClick={() => setFilterCategory('members')}
                  className={`px-2 py-1 border-b font-medium transition-colors ${
                    filterCategory === 'members'
                      ? 'border-divider text-content'
                      : 'border-transparent text-content-muted hover:text-content'
                  }`}
                >
                  Members
                </button>
              </>}
              <button
                onClick={() => setFilterCategory('all')}
                className="p-1 text-content-muted hover:text-content transition-colors"
                title="Group / Stack options"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Actions, Status telemetry & View switches */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active work remains visible as plain status text. */}
            <div className="flex items-center gap-1.5 px-1 py-1.5 text-xs text-content-muted">
              {runningAgentsCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-status-info font-medium">{runningAgentsCount} building</span>
                </>
              ) : (
                <span>Nothing building</span>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                showFilterBar || selectedProject !== 'all' || selectedPriority !== 'all'
                  ? 'bg-surface-raised text-content'
                  : 'text-content-secondary hover:text-content hover:bg-surface-high'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Display Button */}
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-content-secondary hover:text-content hover:bg-surface-high transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Display</span>
            </button>

            {/* View Mode Toggle: Board vs List */}
            <div className="flex items-center text-xs">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-surface-raised text-content' : 'text-content-muted hover:text-content'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'board' ? 'bg-surface-raised text-content' : 'text-content-muted hover:text-content'
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-divider text-content-muted font-medium text-xs"
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-divider text-content-secondary hover:text-content hover:bg-surface-high font-medium text-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {syncing ? 'Syncing' : lastSyncedAt ? syncAgo(lastSyncedAt) : 'Sync'}
                </span>
              </button>
            )}

            {/* New Task Button */}
            <button
              onClick={onOpenNewIssue}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-action hover:bg-action-hover text-on-action font-medium text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New task</span>
            </button>
          </div>
        </div>

        {/* Collapsible Filter Toolbar */}
        {showFilterBar && (
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-content-secondary absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, identifiers, labels..."
                className="w-full bg-surface-raised border border-control rounded-lg pl-8 pr-3 py-1.5 text-xs text-content placeholder-content-muted focus:outline-none focus:border-control"
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
                className="bg-surface-raised border border-control rounded-lg px-2.5 py-1.5 text-xs text-content-secondary focus:outline-none focus:border-control"
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
              className="bg-surface-raised border border-control rounded-lg px-2.5 py-1.5 text-xs text-content-secondary focus:outline-none focus:border-control"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

          </div>
        )}
      </div>

      {needsYou.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-divider bg-status-warning-subtle px-5 py-2 text-[12.5px]">
          <span className="inline-flex items-center gap-2 font-semibold text-status-warning">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-warning" />
            {needsYou.length === 1 ? '1 task needs you' : `${needsYou.length} tasks need you`}
          </span>
          {needsYou.slice(0, 4).map(issue => (
            <button key={issue.id} type="button" onClick={() => setSelectedIssueId(issue.id)} className="inline-flex items-center gap-2 text-content-secondary hover:text-content">
              <span className="font-mono text-[11px] text-content-muted">{issue.identifier}</span>
              {needsYouLabel(issue)}
            </button>
          ))}
          {needsYou.length > 4 && <span className="text-content-muted">and {needsYou.length - 4} more</span>}
        </div>
      )}

      {/* Main Issue Canvas */}
      <div className="flex-1 flex overflow-hidden relative bg-surface">
        {viewMode === 'board' ? (
          /* Kanban Board Mode */
          <div className="flex flex-1 overflow-x-auto">
            {columns.map(column => {
              const colIssues = filteredIssues.filter(i => boardColumnFor(i) === column.id);

              return (
                <div
                  key={column.id}
                  onDragOver={event => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverColumn(column.id);
                  }}
                  onDrop={event => handleIssueDrop(event, column.id)}
                  className={`flex w-[272px] flex-shrink-0 flex-col border-r border-divider transition-colors ${
                    dragOverColumn === column.id ? 'bg-selected' : ''
                  }`}
                  aria-label={
                    column.id === 'agent_running'
                      ? 'Drop tasks here to start an Orchestrator build'
                      : column.id === 'done'
                        ? 'Drop tasks here to request confirmation before marking done'
                        : `Drop tasks here to move them to ${column.title}`
                  }
                >
                  <div className="flex h-11 shrink-0 items-center justify-between pl-4 pr-2">
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className={COLUMN_DOTS[column.id]} />
                      <h2 className="text-[12.5px] font-semibold text-content-secondary">{column.title}</h2>
                      <span className="text-[11.25px] tabular-nums text-content-muted">{colIssues.length}</span>
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
                        className="text-content-muted hover:text-content p-1 rounded hover:bg-surface-high"
                        title={canQuickAdd ? 'Add a task to this column' : 'New task'}
                        aria-label={canQuickAdd ? `Add a task to ${column.title}` : 'New task'}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto px-2.5 pb-3">
                    {quickAddStatus === column.id && (
                      <div className="rounded-xl border border-divider bg-surface-raised p-2">
                        <input
                          autoFocus
                          value={quickAddTitle}
                          onChange={e => setQuickAddTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitQuickAdd(column.id);
                            if (e.key === 'Escape') setQuickAddStatus(null);
                          }}
                          onBlur={() => !quickAddTitle.trim() && setQuickAddStatus(null)}
                          placeholder="Task title, then Enter"
                          className="w-full bg-transparent text-xs text-content placeholder:text-content-muted focus:outline-none"
                        />
                        <div className="mt-1.5 flex items-center justify-between">
                          {/* The daemon assigns the real identifier; promising
                              one here is what produced TES-107. */}
                          <span className="font-mono text-[10px] text-content-muted">
                            {projects.find(p => p.id === selectedProject)?.key ?? ''}
                          </span>
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => submitQuickAdd(column.id)}
                            disabled={!quickAddTitle.trim()}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold text-link hover:bg-surface-high disabled:opacity-30"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                    {colIssues.map(issue => {
                      const completedSubtasks = issue.subtasks.filter(s => s.completed).length;

                      return (
                        <button
                          type="button"
                          key={issue.id}
                          onClick={() => setSelectedIssueId(issue.id)}
                          draggable
                          onDragStart={event => handleIssueDragStart(event, issue.id)}
                          onDragEnd={clearDragState}
                          aria-pressed={selectedIssueId === issue.id}
                          className={`block w-full cursor-grab rounded-lg border bg-surface-raised px-3 pb-2.5 pt-3 text-left transition-colors active:cursor-grabbing ${
                            draggedIssueId === issue.id ? 'opacity-50' : ''
                          } ${
                            selectedIssueId === issue.id
                              ? 'border-link ring-1 ring-selected'
                              : 'border-divider hover:border-control hover:bg-surface-high'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-content-muted">{issue.identifier}</span>
                            <PriorityBadge priority={issue.priority} showLabel={false} />
                          </span>
                          <span className="mb-2.5 mt-1.5 block text-[13px] font-medium leading-snug text-content line-clamp-2">{issue.title}</span>
                          <span className="flex min-h-5 items-center gap-2.5 text-[11.25px] text-content-muted">
                            {issue.subtasks.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 tabular-nums" title={`${completedSubtasks} of ${issue.subtasks.length} subtasks done`}>
                                <span aria-hidden="true" className="relative h-[3px] w-7 overflow-hidden rounded-full bg-surface-high">
                                  <span className="absolute inset-y-0 left-0 rounded-full bg-status-success" style={{ width: `${Math.round((completedSubtasks / issue.subtasks.length) * 100)}%` }} />
                                </span>
                                {completedSubtasks}/{issue.subtasks.length}
                              </span>
                            )}
                            <BuildChip build={issueBuilds[issue.id]} />
                            {!issueBuilds[issue.id] && issue.labels[0] && <span className="truncate">{issue.labels[0]}</span>}
                            <span className="ml-auto">{getAssigneeVisual(issue)}</span>
                          </span>
                        </button>
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
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-raised hover:bg-surface-high border border-divider cursor-pointer select-none transition-colors"
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded bg-transparent border-control text-link focus:ring-0 cursor-pointer"
                    />

                    {/* Collapse Chevron */}
                    <button className="text-content-secondary hover:text-content p-0.5">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Status Circle & Title + Count */}
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center">{group.icon}</span>
                      <span className="text-xs font-semibold text-content tracking-tight">{group.label}</span>
                      <span className="text-xs font-mono text-content-muted font-normal">{groupIssues.length}</span>
                    </div>
                  </div>

                  {/* Section Content: Tasks or "No tasks" */}
                  {!isCollapsed && (
                    <div className="space-y-0.5 pl-2">
                      {groupIssues.length === 0 ? (
                        /* Empty state placeholder for section */
                        <div className="py-2.5 text-center font-mono text-xs text-content-muted">
                          No tasks
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
                                  ? 'bg-surface-raised border border-divider'
                                  : 'hover:bg-surface-high border border-transparent'
                              }`}
                            >
                              {/* Left: Checkbox, Priority, Key, Title, Subtasks Ring */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="text-content-muted flex-shrink-0">
                                  {getPriorityIcon(issue.priority)}
                                </div>

                                <span className="font-mono text-xs font-medium text-content-secondary w-16 flex-shrink-0">
                                  {issue.identifier}
                                </span>

                                <span className="text-xs sm:text-sm font-medium text-content truncate max-w-2xl group-hover:text-link-hover transition-colors">
                                  {issue.title}
                                </span>

                                {/* Subtasks fraction ring if subtasks exist */}
                                {totalSubtasks > 0 && (
                                  <div className="flex items-center gap-1 text-[11px] font-mono text-content-secondary flex-shrink-0">
                                    {completedSubtasks === totalSubtasks ? (
                                      <span className="text-status-info flex items-center gap-1">
                                        <span className="w-2.5 h-2.5 rounded-full border-2 border-status-info-border bg-status-info-subtle inline-block" />
                                        <span>{completedSubtasks}/{totalSubtasks}</span>
                                      </span>
                                    ) : (
                                      <span className="text-content-muted flex items-center gap-1">
                                        <span className="w-2.5 h-2.5 rounded-full border border-divider inline-block" />
                                        <span>{completedSubtasks}/{totalSubtasks}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Right: Project folder tag & Assignee visual */}
                              <div className="flex items-center gap-4 flex-shrink-0">
                                {project && (
                                  <div className="flex items-center gap-1.5 text-xs text-content-secondary font-mono">
                                    <FolderKanban className="w-3.5 h-3.5 text-content-muted" />
                                    <span>{project.name}</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  <BuildChip build={issueBuilds[issue.id]} />
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

        {selectedIssue && (
          <TaskDetailDrawer
            issue={selectedIssue}
            sessionPrefix={sessionPrefix}
            build={issueBuilds[selectedIssue.id]}
            buildActive={hasActiveBuild(selectedIssue)}
            canStartBuild={canStartBuild(selectedIssue)}
            onClose={() => setSelectedIssueId(null)}
            onRequestStatus={requestIssueStatusChange}
            onPlanBuild={issue => setPendingBuildIssueId(issue.id)}
            onOpenBuildChat={chatAvailable && buildChatFor(selectedIssue) ? openBuildChat : undefined}
            onHandOff={canHandOff ? handOffToChat : undefined}
          />
        )}
      </div>

      {pendingBuildIssue && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPendingBuildIssueId(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-build-title" className="relative w-full max-w-md rounded-2xl border border-divider bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-selected text-selected-content">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h2 id="confirm-build-title" className="text-base font-semibold text-content">
                  Build task {pendingBuildIssue.identifier} with the Orchestrator?
                </h2>
                <p className="text-sm leading-relaxed text-content-secondary">
                  Alpha opens a project chat for this task and plans the work, choosing an agent for each task by role. Nothing changes in the code until you review the plan and choose <span className="font-semibold text-content">Start planned work</span>.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingBuildIssueId(null)} className="rounded-lg border border-divider px-3.5 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content">
                Cancel
              </button>
              <button type="button" onClick={confirmIssueBuild} className="rounded-lg bg-action px-3.5 py-2 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover">
                Plan the build
              </button>
            </div>
          </div>
        </div>
      )}

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
            className="relative w-full max-w-md rounded-2xl border border-divider bg-surface-raised p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-status-success-subtle text-status-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h2 id="confirm-done-title" className="text-base font-semibold text-content">
                  Mark task as done?
                </h2>
                <p className="text-sm leading-relaxed text-content-secondary">
                  This skips the normal review checkpoint for <span className="font-semibold text-content">{pendingDoneIssue.identifier}</span>. Continue only if the work has already been reviewed.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDoneIssueId(null)}
                className="rounded-lg border border-divider px-3.5 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content"
              >
                Keep in {pendingDoneIssue.status === 'review' ? 'Review' : 'current status'}
              </button>
              <button
                type="button"
                onClick={confirmDoneStatusChange}
                className="rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-content-muted transition-colors hover:bg-emerald-400"
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
