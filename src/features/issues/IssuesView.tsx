import { LoadingRows, Skeleton } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import React, { useState, useMemo, useEffect } from 'react';
import { currentIssueId, useApp, useTabSessionState } from '@/app/AppContext';
import { IssueStatus, IssuePriority, Issue
} from '@/shared/types';
import { PriorityBadge } from '@/shared/components/Badge';
import { apiService, type IssueBuildStatus } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import { ACTIVE_BUILD_STATUSES, BuildChip } from './BuildChip';
import { BoardAttentionBanner, boardAttention } from './BoardAttentionBanner';
import { ArchivedCardsPanel } from './ArchivedCardsPanel';
import { useBoardAgentChanges } from '@/features/board-agent/useBoardAgentChanges';
import { AgentActivityRail } from '@/features/board-agent/AgentActivityRail';
import { cardMarks, ghostCards } from '@/features/board-agent/agentChanges';
import { isEpic } from '@/features/board-build/epic';
import { BoardAlphaPanel } from '@/features/board-build/BoardAlphaPanel';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { CalendarView } from './CalendarView';
import { initialsOf, taskHandoffMessage } from './taskFlow';
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
  Layers,
  FolderKanban,
  Minus,
  BarChart2,
  Flame,
  CheckSquare,
  RefreshCw,
  Play,
  CalendarDays,
  GitBranch,
  Archive,
  Bot
} from 'lucide-react';
import { GanttView } from './GanttView';

/** "just now", "3m", "2h" — a timestamp is noise in a toolbar. */
function syncAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function dueDateLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
    : value;
}

function isOverdue(issue: Issue): boolean {
  if (!issue.dueDate || issue.status === 'done') return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return issue.dueDate < today;
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
    workspaceLoading,
    updateIssueStatus,
    archiveIssue,
    restoreIssue,
    projects,
    startIssueBuild,
    identity,
    localMode,
    createIssue,
    syncBoard,
    refreshBoardState,
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
  const issueById = useMemo(() => new Map(issues.map(issue => [issue.id, issue])), [issues]);

  // PMs review product work on the kanban board; everyone else starts on the list.
  const [viewMode, setViewMode] = useTabSessionState<'board' | 'list' | 'calendar' | 'gantt'>(`${sessionPrefix}.viewMode`, role === 'pm' ? 'board' : 'list');
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
  const [showArchived, setShowArchived] = useState(false);
  const [showAgentActivity, setShowAgentActivity] = useState(false);
  // True while the Manager Agent is answering in the board panel: read its changes every 2 seconds.
  const [agentWorking, setAgentWorking] = useState(false);
  const agentBoard = useBoardAgentChanges(isDesktop && selectedProject !== 'all' ? selectedProject : null, {
    fast: agentWorking,
    onBoardChanged: () => { void refreshBoardState(); }
  });
  const agentMarks = useMemo(() => cardMarks(agentBoard.changes), [agentBoard.changes]);
  const agentGhosts = useMemo(() => ghostCards(agentBoard.changes), [agentBoard.changes]);
  const waitingCount = agentBoard.changes.filter(change => change.status === 'held').length;
  const [selectedPriority, setSelectedPriority] = useTabSessionState<string>(`${sessionPrefix}.priority`, 'all');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<IssueStatus | null>(null);
  const [pendingDoneIssueId, setPendingDoneIssueId] = useState<string | null>(null);
  const [pendingBuildIssueId, setPendingBuildIssueId] = useState<string | null>(null);
  const [buildInstructions, setBuildInstructions] = useState('');
  const [buildSubmitting, setBuildSubmitting] = useState(false);
  useEffect(() => { setBuildInstructions(''); }, [pendingBuildIssueId]);

  /**
   * The latest Orchestrator build for each issue. Builds do not change an
   * issue's stored status, so the board reads them to place cards in Building
   * and to label each card. Desktop only: the cloud does not run builds.
   */
  const [issueBuilds, setIssueBuilds] = useState<Record<string, IssueBuildStatus>>({});
  const [buildStatusFresh, setBuildStatusFresh] = useState(false);
  /** Re-read build statuses now, so a decision made on a card moves it without waiting for the poll. */
  const refreshIssueBuilds = () => {
    if (!isDesktop) return;
    apiService.getIssueBuildStatuses()
      .then(rows => { setIssueBuilds(Object.fromEntries(rows.map(row => [row.issueId, row]))); setBuildStatusFresh(true); })
      .catch(() => setBuildStatusFresh(false));
  };
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiService.getIssueBuildStatuses()
        .then(rows => { if (!cancelled) { setIssueBuilds(Object.fromEntries(rows.map(row => [row.issueId, row]))); setBuildStatusFresh(true); } })
        // An older daemon has no build-status route; cards simply show no chip.
        .catch(() => { if (!cancelled) setBuildStatusFresh(false); });
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
    canRunBuilds && buildStatusFresh && issue.status !== 'done' && !hasActiveBuild(issue) &&
    !issueBuilds[issue.id]?.blocker && !['waiting', 'planning'].includes(issueBuilds[issue.id]?.request?.status ?? '');
  const boardColumnFor = (issue: Issue): IssueStatus =>
    issue.status !== 'done' && hasActiveBuild(issue) ? 'agent_running' : issue.status;

  /** Assigned to the person looking at the board. */
  const isMine = (issue: Issue) => Boolean(identity && issue.assignedHuman && (
    issue.assignedHuman === identity.login || issue.assignedHuman === identity.name
  ));
  /** A developer's own ready task gets a one-click build; the confirmation still applies. */
  const canQuickBuild = (issue: Issue) => isDesktop && issue.status === 'todo' && isMine(issue) && canStartBuild(issue);

  /** The developer's Alpha panel. Only people who run agents get it; PMs plan with New task. */
  // Agents are for developers only; others see what agents did in Agent activity.
  const canUseAlpha = isDesktop && role === 'dev' && canRunBuilds && can('manage_chat') && selectedProject !== 'all';
  const [alphaOpen, setAlphaOpen] = useTabSessionState<boolean>(`${sessionPrefix}.alphaPanel`, false);

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
  const openCreateIssue = () => {
    const contextProjectId = lockedProjectId ?? (selectedProject !== 'all' ? selectedProject : projects[0]?.id);
    if (contextProjectId) setTabSessionState(activeTabId, 'issueModal.project', contextProjectId);
    onOpenNewIssue();
  };

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

  // Personal filters must not hide active work elsewhere in this project.
  const runningAgentsCount = useMemo(
    () => issues.filter(issue => (selectedProject === 'all' || issue.projectId === selectedProject)
      && ['executing', 'validating', 'publishing'].includes(issueBuilds[issue.id]?.status ?? '')).length,
    [issues, selectedProject, issueBuilds]
  );

  const clearDragState = () => {
    setDraggedIssueId(null);
    setDragOverColumn(null);
  };

  // Only from builds this desktop already polls; no extra requests.
  const attention = useMemo(
    () => buildStatusFresh
      ? boardAttention(issues.filter(issue => selectedProject === 'all' || issue.projectId === selectedProject), issueBuilds)
      : [],
    [issues, selectedProject, issueBuilds, buildStatusFresh]
  );

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

  // A just-created task changes id when it is saved; the open drawer follows it.
  const selectedIssue = issues.find(i => i.id === selectedIssueId)
    ?? (selectedIssueId ? issues.find(i => i.id === currentIssueId(selectedIssueId)) : undefined);
  useEffect(() => {
    if (selectedIssue && selectedIssueId && selectedIssue.id !== selectedIssueId) setSelectedIssueId(selectedIssue.id);
  }, [selectedIssue?.id, selectedIssueId]);

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
  const confirmIssueBuild = async () => {
    if (!pendingBuildIssue || buildSubmitting) return;
    setBuildSubmitting(true);
    try {
      if (await startIssueBuild(pendingBuildIssue.id, buildInstructions)) setPendingBuildIssueId(null);
      refreshIssueBuilds();
    } finally { setBuildSubmitting(false); }
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

  const removeTask = (issue: Issue) => {
    archiveIssue(issue.id);
    setSelectedIssueId(null);
  };

  // Developers own implementation hand-offs; PMs review the resulting work.
  const canHandOff = chatAvailable && can('manage_chat') && (role === 'dev' || role === 'admin');
  const renderFilterToolbar = () => (
    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-content-secondary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks, identifiers, labels..."
          className="w-full rounded-lg border border-control bg-surface-raised py-1.5 pl-8 pr-3 text-xs text-content placeholder-content-muted focus:border-control focus:outline-none"
        />
      </div>

      {!lockedProjectId && (
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-lg border border-control bg-surface-raised px-2.5 py-1.5 text-xs text-content-secondary focus:border-control focus:outline-none"
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
        className="rounded-lg border border-control bg-surface-raised px-2.5 py-1.5 text-xs text-content-secondary focus:border-control focus:outline-none"
      >
        <option value="all">All Priorities</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-shell text-sm text-content">
      {/* Shared task controls stay in one place for list, Kanban, and Gantt views. */}
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
                {role === 'dev' ? 'Project tasks' : 'All'}
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
            {canUseAlpha && (
              <button
                type="button"
                onClick={() => setAlphaOpen(!alphaOpen)}
                aria-pressed={alphaOpen}
                aria-controls="chat-side-panel"
                title="Ask Alpha about tasks, get task suggestions, and start builds"
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  alphaOpen ? 'border-divider bg-selected text-selected-content' : 'border-divider text-content-secondary hover:bg-surface-high hover:text-content'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Alpha</span>
              </button>
            )}
            {/* Active work remains visible as plain status text. */}
            <div className="flex items-center gap-1.5 px-1 py-1.5 text-xs text-content-muted">
              {runningAgentsCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-status-info font-medium">{runningAgentsCount} builds running</span>
                </>
              ) : (
                <span>{buildStatusFresh ? 'No agents running' : 'Build status unavailable'}</span>
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

            {/* Alternate layouts for the same filtered task set. */}
            <div role="group" aria-label="Task view" className="inline-flex items-center gap-0.5 rounded-lg border border-divider bg-surface p-0.5 text-xs">
              <Button
                type="button"
                onClick={() => setViewMode('list')}
                variant="ghost"
                size="sm"
                aria-pressed={viewMode === 'list'}
                className={viewMode === 'list' ? 'bg-surface-raised text-content' : 'text-content-muted'}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </Button>
              <Button
                type="button"
                onClick={() => setViewMode('board')}
                variant="ghost"
                size="sm"
                aria-pressed={viewMode === 'board'}
                className={viewMode === 'board' ? 'bg-surface-raised text-content' : 'text-content-muted'}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Board</span>
              </Button>
              <Button
                type="button"
                onClick={() => setViewMode('calendar')}
                variant="ghost"
                size="sm"
                aria-pressed={viewMode === 'calendar'}
                className={viewMode === 'calendar' ? 'bg-surface-raised text-content' : 'text-content-muted'}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </Button>
              {lockedProjectId && (
                <Button
                  type="button"
                  onClick={() => setViewMode('gantt')}
                  variant="ghost"
                  size="sm"
                  aria-pressed={viewMode === 'gantt'}
                  className={viewMode === 'gantt' ? 'bg-surface-raised text-content' : 'text-content-muted'}
                >
                  <span>Gantt</span>
                </Button>
              )}
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
            {isDesktop && selectedProject !== 'all' && (
              <button
                type="button"
                onClick={() => setShowAgentActivity(open => !open)}
                aria-pressed={showAgentActivity}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-divider text-content-secondary hover:text-content hover:bg-surface-high font-medium text-xs transition-colors"
              >
                <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Agent activity</span>
                {waitingCount > 0 && (
                  <span className="rounded-full bg-status-warning-subtle px-1.5 text-[10px] font-semibold text-status-warning" aria-label={`${waitingCount} waiting for confirmation`}>{waitingCount}</span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowArchived(open => !open)}
              aria-pressed={showArchived}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-divider text-content-secondary hover:text-content hover:bg-surface-high font-medium text-xs transition-colors"
            >
              <Archive className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Archived</span>
            </button>

            <button
              onClick={openCreateIssue}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-action hover:bg-action-hover text-on-action font-medium text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New task</span>
            </button>
          </div>
        </div>

        {/* Collapsible Filter Toolbar */}
        {showFilterBar && renderFilterToolbar()}

        <BoardAttentionBanner
          items={attention}
          canManageIssues={canManageIssues}
          onOpenIssue={setSelectedIssueId}
          onMoveToTodo={issueId => updateIssueStatus(issueId, 'todo')}
        />
      </div>

      {/* Main Issue Canvas */}
      <div className="flex-1 flex overflow-hidden relative bg-surface">
        {showArchived && (
          <ArchivedCardsPanel
            projectId={selectedProject}
            canManageIssues={canManageIssues}
            onRestore={restoreIssue}
            onClose={() => setShowArchived(false)}
          />
        )}
        {showAgentActivity && selectedProject !== 'all' && (
          <AgentActivityRail
            projectId={selectedProject}
            changes={agentBoard.changes}
            login={identity?.login}
            busyId={agentBoard.busyId}
            error={agentBoard.error}
            onDecide={(id, action) => void agentBoard.decide(id, action)}
            onOpenIssue={setSelectedIssueId}
            onClose={() => setShowAgentActivity(false)}
          />
        )}
        {workspaceLoading && !issues.some(issue => !lockedProjectId || issue.projectId === lockedProjectId) ? (
          viewMode === 'board' ? <div className="flex min-w-0 flex-1 overflow-x-auto">
            {columns.map(column => <section key={column.id} className="min-w-48 flex-1 border-r border-divider px-3 py-4">
              <h3 className="text-xs font-medium text-content-secondary">{column.title}</h3>
              <LoadingRows label={`Loading ${column.title} tasks`} layout="detail" rows={2} />
            </section>)}
          </div> : viewMode === 'gantt' ? <div role="status" className="mx-4 overflow-hidden rounded-lg border border-divider">
            <span className="sr-only">Loading task timeline</span>
            <div aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="grid min-h-10 grid-cols-[minmax(7rem,1fr)_3fr] border-b border-divider">
                <div className="flex items-center border-r border-divider px-3"><Skeleton className="h-3 w-3/4" /></div>
                <div className="flex items-center px-3"><Skeleton className={['ml-0 h-3 w-1/3', 'ml-[18%] h-3 w-1/4', 'ml-[36%] h-3 w-2/5'][index % 3]} /></div>
              </div>)}
            </div>
          </div> : viewMode === 'calendar' ? (
            <CalendarView
              issues={[]}
              sessionPrefix={sessionPrefix}
              onOpenIssue={setSelectedIssueId}
              isOverdue={isOverdue}
              loading
            />
          ) : <LoadingRows label="Loading tasks" layout="table" rows={5} className="px-4" />
        ) : viewMode === 'board' ? (
          /* Kanban Board Mode */
          <div className="flex flex-1 overflow-x-auto">
            {columns.map(column => {
              const colIssues = filteredIssues.filter(i => boardColumnFor(i) === column.id);
              const readOnlyBuildColumn = column.id === 'agent_running' && !canRunBuilds;

              return (
                <div
                  key={column.id}
                  onDragOver={event => {
                    if (readOnlyBuildColumn) {
                      event.dataTransfer.dropEffect = 'none';
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverColumn(column.id);
                  }}
                  onDrop={event => {
                    if (!readOnlyBuildColumn) handleIssueDrop(event, column.id);
                  }}
                  className={`flex w-[272px] flex-shrink-0 flex-col border-r border-divider transition-colors ${
                    readOnlyBuildColumn ? 'cursor-not-allowed' : ''
                  } ${
                    dragOverColumn === column.id ? 'bg-selected' : ''
                  }`}
                  aria-disabled={readOnlyBuildColumn || undefined}
                  aria-label={
                    column.id === 'agent_running'
                      ? canRunBuilds ? 'Drop tasks here to start an Orchestrator build' : 'Tasks currently being built by developers'
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
                    {canManageIssues && column.id !== 'agent_running' && (
                      <button
                        onClick={() =>
                          canQuickAdd
                            ? (setQuickAddStatus(column.id), setQuickAddTitle(''))
                            : openCreateIssue()
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
                      const quickBuild = canQuickBuild(issue);
                      const parentIssue = issue.parentIssueId ? issueById.get(issue.parentIssueId) : undefined;
                      const agentMark = agentMarks.get(issue.id);

                      return (
                        <div key={issue.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedIssueId(issue.id)}
                          draggable
                          onDragStart={event => handleIssueDragStart(event, issue.id)}
                          onDragEnd={clearDragState}
                          aria-pressed={selectedIssueId === issue.id}
                          className={`block w-full cursor-grab border bg-surface-raised px-3 pb-2.5 pt-3 text-left transition-colors active:cursor-grabbing ${quickBuild ? 'rounded-t-lg' : 'rounded-lg'} ${
                            draggedIssueId === issue.id ? 'opacity-50' : ''
                          } ${
                            selectedIssueId === issue.id
                              ? 'border-link ring-1 ring-selected'
                              : agentMark?.kind === 'held'
                                ? 'border-status-warning-border ring-1 ring-status-warning-border'
                                : agentMark?.kind === 'recent'
                                  ? 'border-selected-content motion-safe:animate-[pulse_2s_ease-in-out_2] hover:bg-surface-high'
                                  : 'border-divider hover:border-control hover:bg-surface-high'
                          }`}
                        >
                          {agentMark && (
                            <span className={`mb-1.5 flex items-center gap-1 text-[10.5px] font-medium ${agentMark.kind === 'held' ? 'text-status-warning' : 'text-selected-content'}`}>
                              <Bot aria-hidden="true" className="h-3 w-3" />{agentMark.label}
                            </span>
                          )}
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-content-muted">{issue.identifier}</span>
                              {isEpic(issue.labels) && <span className="rounded bg-selected px-1.5 text-[10.5px] font-semibold text-selected-content">Epic</span>}
                            </span>
                            <PriorityBadge priority={issue.priority} showLabel={false} />
                          </span>
                          <span className="mb-2.5 mt-1.5 block text-[13px] font-medium leading-snug text-content line-clamp-2">{issue.title}</span>
                          {parentIssue && (
                            <span className="mb-1.5 inline-flex max-w-full items-center gap-1 truncate text-[10.5px] text-content-muted" title={`Part of ${parentIssue.identifier}: ${parentIssue.title}`}>
                              <GitBranch aria-hidden="true" className="h-3 w-3 shrink-0" />
                              <span className="truncate">Part of {parentIssue.identifier}</span>
                            </span>
                          )}
                          <span className="flex min-h-5 items-center gap-2.5 text-[11.25px] text-content-muted">
                            {issue.subtasks.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 tabular-nums" title={`${completedSubtasks} of ${issue.subtasks.length} subtasks done`}>
                                <span aria-hidden="true" className="relative h-[3px] w-7 overflow-hidden rounded-full bg-surface-high">
                                  <span className="absolute inset-y-0 left-0 rounded-full bg-status-success" style={{ width: `${Math.round((completedSubtasks / issue.subtasks.length) * 100)}%` }} />
                                </span>
                                {completedSubtasks}/{issue.subtasks.length}
                              </span>
                            )}
                            {issue.dueDate && (
                              <span className={`inline-flex shrink-0 items-center gap-1 ${isOverdue(issue) ? 'text-status-danger' : 'text-content-muted'}`} title={`Due date: ${dueDateLabel(issue.dueDate)}`}>
                                <CalendarDays aria-hidden="true" className="h-3 w-3" />{dueDateLabel(issue.dueDate)}
                              </span>
                            )}
                            <BuildChip build={issueBuilds[issue.id]} />
                            {!issueBuilds[issue.id] && issue.labels.find(label => !isEpic([label])) && <span className="truncate">{issue.labels.find(label => !isEpic([label]))}</span>}
                            <span className="ml-auto">{getAssigneeVisual(issue)}</span>
                          </span>
                        </button>
                        {quickBuild && (
                          <button
                            type="button"
                            onClick={() => setPendingBuildIssueId(issue.id)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-b-lg border border-t-0 border-divider bg-surface-raised py-1.5 text-[11.5px] font-semibold text-link hover:bg-surface-high"
                          >
                            <Play aria-hidden="true" className="h-3 w-3" /> Start build
                          </button>
                        )}
                        </div>
                      );
                    })}
                    {agentGhosts.filter(ghost => ghost.column === column.id).map(ghost => (
                      <div key={ghost.changeId} className="rounded-lg border border-dashed border-status-warning-border bg-surface px-3 py-2.5 text-xs opacity-80">
                        <span className="block font-medium text-content line-clamp-2">{ghost.title}</span>
                        <span className="mt-1 flex items-center gap-1 text-[10.5px] text-status-warning">
                          <Bot aria-hidden="true" className="h-3 w-3" />{ghost.label}, waiting for confirmation
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarView
            issues={filteredIssues}
            sessionPrefix={sessionPrefix}
            onOpenIssue={setSelectedIssueId}
            isOverdue={isOverdue}
          />
        ) : viewMode === 'gantt' && lockedProjectId ? (
          <GanttView
            project={projects.find(project => project.id === lockedProjectId)}
            issues={filteredIssues}
            canManageIssues={canManageIssues}
            onOpenIssue={setSelectedIssueId}
            showProjectIdentity={false}
          />
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
                          const parentIssue = issue.parentIssueId ? issueById.get(issue.parentIssueId) : undefined;
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
                                {parentIssue && (
                                  <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] text-content-muted" title={`Part of ${parentIssue.identifier}: ${parentIssue.title}`}>
                                    <GitBranch aria-hidden="true" className="h-3 w-3" />{parentIssue.identifier}
                                  </span>
                                )}

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
                                {issue.dueDate && (
                                  <span className={`inline-flex items-center gap-1.5 text-xs ${isOverdue(issue) ? 'text-status-danger' : 'text-content-secondary'}`} title={`Due date: ${dueDateLabel(issue.dueDate)}`}>
                                    <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-content-muted" />
                                    Due {dueDateLabel(issue.dueDate)}
                                  </span>
                                )}
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

        {canUseAlpha && alphaOpen && (
          <BoardAlphaPanel
            key={selectedProject}
            projectId={selectedProject}
            projectKey={projects.find(project => project.id === selectedProject)?.key}
            issues={issues.filter(issue => issue.projectId === selectedProject)}
            columns={columns}
            columnFor={boardColumnFor}
            canStartBuild={canQuickBuild}
            onStartBuild={issue => setPendingBuildIssueId(issue.id)}
            onOpenIssue={setSelectedIssueId}
            onClose={() => setAlphaOpen(false)}
            onWorkingChange={working => {
              setAgentWorking(working);
              // The turn ended: read what it changed now rather than at the next poll.
              if (!working) { void agentBoard.reload(); void refreshBoardState(); }
            }}
            waiting={agentBoard.changes.filter(change => change.status === 'held')}
            login={identity?.login}
            decidingId={agentBoard.busyId}
            onDecide={(id, action) => void agentBoard.decide(id, action)}
          />
        )}

        {selectedIssue && (
          <TaskDetailDrawer
            issue={selectedIssue}
            sessionPrefix={sessionPrefix}
            build={{ ...(issueBuilds[selectedIssue.id] ?? { issueId: selectedIssue.id, projectId: selectedIssue.projectId, runId: '', status: 'none', updatedAt: '' }), fresh: buildStatusFresh }}
            buildActive={hasActiveBuild(selectedIssue)}
            canStartBuild={canStartBuild(selectedIssue)}
            onClose={() => setSelectedIssueId(null)}
            onRemove={removeTask}
            onRequestStatus={requestIssueStatusChange}
            onPlanBuild={issue => setPendingBuildIssueId(issue.id)}
            onOpenBuildChat={chatAvailable && buildChatFor(selectedIssue) ? openBuildChat : undefined}
            onHandOff={canHandOff ? handOffToChat : undefined}
            onBuildChanged={refreshIssueBuilds}
            onOpenTask={(id, projectId) => { setSelectedProject(projectId); setSelectedIssueId(id); }}
            agentChanges={agentBoard.changes.filter(change => change.issueId === selectedIssue.id)}
            agentDecidingId={agentBoard.busyId}
            onAgentDecide={(id, action) => void agentBoard.decide(id, action)}
          />
        )}
      </div>

      {pendingBuildIssue && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" aria-label="Close plan request" disabled={buildSubmitting} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPendingBuildIssueId(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-build-title" className="relative w-full max-w-md rounded-2xl border border-divider bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-selected text-selected-content">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h2 id="confirm-build-title" className="text-base font-semibold text-content">
                  Plan build for {pendingBuildIssue.identifier}
                </h2>
                <p className="text-sm leading-relaxed text-content-secondary">
                  Alpha plans this task against its acceptance checklist. Review and approve the plan in the Build tab before code changes begin.
                </p>
              </div>
            </div>
            <label htmlFor="build-instructions" className="mt-4 block text-sm font-medium text-content-secondary">Developer instructions <span className="font-normal text-content-muted">(optional)</span></label>
            <textarea id="build-instructions" rows={3} maxLength={1500} value={buildInstructions} onChange={event => setBuildInstructions(event.target.value)}
              placeholder="Add technical context, implementation guidance, or constraints for this task."
              className="mt-2 w-full resize-y rounded-md border border-control bg-well px-3 py-2 text-sm text-content placeholder-content-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={buildSubmitting} onClick={() => setPendingBuildIssueId(null)} className="rounded-lg border border-divider px-3.5 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content">
                Cancel
              </button>
              <button type="button" disabled={buildSubmitting} onClick={() => void confirmIssueBuild()} className="rounded-lg bg-action px-3.5 py-2 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover">
                {buildSubmitting ? 'Requesting plan…' : 'Plan build'}
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
