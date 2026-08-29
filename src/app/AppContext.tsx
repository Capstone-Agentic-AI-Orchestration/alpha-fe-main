import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  NavigationTab,
  TabItem,
  Issue,
  IssueStatus,
  Project,
  Agent,
  Squad,
  RuntimeEngine,
  Skill,
  Deployment,
  InboxNotification,
  AnalyticsData,
  WorkspaceSettings,
  ChatMessage,
  ChatThread,
  PrototypeRun,
  ToastMessage,
  User,
  UserRole,
  RequirementDoc,
  IntakeAnswers,
  Estimate,
  RateCard,
  BudgetLedger,
  Milestone
} from '@/shared/types';
import {
  initialIssues,
  initialAgents,
  initialDeployments,
  initialInbox,
  initialAnalytics,
  initialSettings,
  initialUsers,
  initialRequirementDocs,
  initialLedgers
} from '@/data/mockData';
import { buildEstimate, DEFAULT_RATE_CARD } from '@/features/delivery/estimator';
import { apiService } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import { fetchServerSnapshot, persist, describeWriteError, ServerStatus } from '@/shared/services/serverSync';
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage';

interface AppContextType {
  /** Reachability of the local Alpha daemon. Agents cannot run while 'offline'. */
  serverStatus: ServerStatus;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  tabs: TabItem[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  openNewTab: (view?: NavigationTab) => void;
  closeTab: (tabId: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  
  // Issues
  issues: Issue[];
  createIssue: (issue: Omit<Issue, 'id' | 'identifier' | 'createdAt' | 'updatedAt' | 'comments' | 'subtasks'> & { subtasks?: string[] }) => Issue;
  updateIssueStatus: (id: string, status: IssueStatus) => void;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  deleteIssue: (id: string) => void;
  runAgentOnIssue: (issueId: string, agentId?: string) => void;
  prototypeRuns: PrototypeRun[];
  runSetupIssueId: string | null;
  runSetupAgentId: string | null;
  closeRunSetup: () => void;
  startPrototypeRun: (issueId: string, agentId: string, plan: string[], scenario: PrototypeRun['scenario']) => PrototypeRun | null;
  cancelPrototypeRun: (runId: string) => void;
  retryPrototypeRun: (runId: string) => void;
  
  // Projects
  projects: Project[];
  createProject: (project: Omit<Project, 'id' | 'totalIssues' | 'completedIssues' | 'progressPercentage' | 'milestones'>) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  
  // Agents
  agents: Agent[];
  createAgent: (agent: Omit<Agent, 'id' | 'stats' | 'status'>) => Agent;
  /**
   * Create an agent from a persona file someone shared.
   *
   * The daemon owns this one rather than the client: it parses the file,
   * validates it, mints an id that does not collide on this machine, and writes
   * the persona to disk. Resolves with anything the file declared that had to be
   * ignored, so the importer can be told rather than left guessing.
   */
  importAgent: (content: string) => Promise<{ agent: Agent; warnings: string[] }>;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  duplicateAgent: (id: string) => Agent | null;
  archiveAgent: (id: string) => void;
  restoreAgent: (id: string) => void;
  deleteAgent: (id: string) => void;
  bulkUpdateAgents: (ids: string[], updates: Partial<Agent>) => void;
  bulkArchiveAgents: (ids: string[]) => void;
  
  // Squads
  squads: Squad[];
  createSquad: (squad: Omit<Squad, 'id' | 'activeRunsCount' | 'completedRunsCount'>) => Squad;
  triggerSquadRun: (squadId: string, missionGoal?: string) => Promise<void>;
  
  // Runtimes
  runtimes: RuntimeEngine[];
  isScanningRuntimes: boolean;
  scanLocalRuntimes: () => Promise<void>;
  setDefaultRuntime: (id: string) => void;
  
  // Skills
  skills: Skill[];
  toggleSkill: (id: string) => void;
  
  // Deployments
  deployments: Deployment[];
  triggerDeployment: (
    projectId: string,
    env?: 'Production' | 'Staging' | 'Preview',
    source?: { issueId?: string; runId?: string }
  ) => Promise<void>;
  
  // Inbox
  inbox: InboxNotification[];
  unreadInboxCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  archiveNotification: (id: string) => void;
  handleApproval: (notificationId: string, action: 'approved' | 'rejected') => void;
  
  // Analytics
  analytics: AnalyticsData;
  
  // Chat
  chatThreads: ChatThread[];
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  createNewThread: (title?: string) => string;
  deleteThread: (id: string) => void;
  chatMessages: ChatMessage[];
  isAgentTyping: boolean;
  activeChatAgentId: string | null;
  setActiveChatAgentId: (id: string | null) => void;
  activeChatSquadId: string | null;
  setActiveChatSquadId: (id: string | null) => void;
  sendChatMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  
  // Settings
  settings: WorkspaceSettings;
  updateSettings: (updates: Partial<WorkspaceSettings>) => void;

  // Prototype feedback
  toasts: ToastMessage[];
  showToast: (title: string, description?: string, tone?: ToastMessage['tone']) => void;
  dismissToast: (id: string) => void;
  // Identity & access
  currentUser: User;
  users: User[];
  role: UserRole;
  switchRole: (role: UserRole) => void;
  can: (capability: Capability) => boolean;
  visibleTabs: NavigationTab[];

  // Requirement documents
  requirementDocs: RequirementDoc[];
  submitIntake: (answers: IntakeAnswers) => RequirementDoc;
  updateRequirementDoc: (id: string, updates: Partial<RequirementDoc>) => void;
  toggleRequirementIncluded: (docId: string, reqId: string) => void;
  sendDocToClient: (docId: string) => void;

  // Estimates
  estimates: Estimate[];
  estimateForDoc: (docId: string) => Estimate | undefined;
  regenerateEstimate: (docId: string, rateCard?: RateCard) => Estimate | undefined;
  approveScopeAndBudget: (docId: string) => Project | undefined;
  rejectEstimate: (docId: string, reason: string) => void;

  // Budget tracking
  ledgers: BudgetLedger[];
  ledgerForProject: (projectId: string) => BudgetLedger | undefined;
}

/* Capability names are behavioural, not tab names, so a surface can be shared
 * by two roles while the actions on it differ. */
export type Capability =
  | 'create_project'
  | 'author_estimate'
  | 'approve_budget'
  | 'approve_production'
  | 'manage_agents'
  | 'run_agents'
  | 'contact_client'
  | 'view_margin'
  | 'manage_billing'
  | 'submit_intake';

const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  client: ['approve_budget', 'submit_intake'],
  dev: ['run_agents'],
  pm: [
    'create_project',
    'author_estimate',
    'approve_production',
    'manage_agents',
    'run_agents',
    'contact_client'
  ],
  admin: [
    'create_project',
    'author_estimate',
    'approve_production',
    'manage_agents',
    'run_agents',
    'contact_client',
    'view_margin',
    'manage_billing'
  ]
};

const ROLE_TABS: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'documents', 'inbox', 'chat', 'settings'],
  dev: ['my_issues', 'issues', 'documents', 'inbox', 'chat', 'agents', 'deployments', 'runtimes', 'skills', 'settings'],
  pm: [
    'inbox',
    'chat',
    'my_issues',
    'issues',
    'projects',
    'documents',
    'deployments',
    'agents',
    'squads',
    'analytics',
    'runtimes',
    'skills',
    'settings'
  ],
  admin: [
    'inbox',
    'chat',
    'my_issues',
    'issues',
    'projects',
    'documents',
    'billing',
    'deployments',
    'agents',
    'squads',
    'analytics',
    'runtimes',
    'skills',
    'settings'
  ]
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Role is resolved before any tab state, because what a tab is allowed to be
  // depends on it.
  const [role, setRole] = useState<UserRole>(() => loadFromStorage<UserRole>('active_role', 'pm'));
  const roleTabs = ROLE_TABS[role];

  const initialDefaultTabs: TabItem[] = [{ id: 'tab-default', view: roleTabs[0] }];

  const [tabs, setTabs] = useState<TabItem[]>(() => {
    const saved = loadFromStorage<TabItem[]>('workspace_tabs_v2', initialDefaultTabs);
    if (Array.isArray(saved) && saved.length > 0 && saved[0]?.view) {
      return saved;
    }
    return initialDefaultTabs;
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const saved = loadFromStorage<string>('active_tab_id_v2', 'tab-default');
    return saved || 'tab-default';
  });

  // Calculate current active tab view.
  // A view the current role may not open resolves to that role's landing
  // surface. Hiding it from the sidebar is not enough on its own — persisted
  // tabs, deep links, and the command palette can all point somewhere else.
  const currentTab = tabs.find(t => t.id === activeTabId) || tabs[0] || initialDefaultTabs[0];
  const requestedTab: NavigationTab = currentTab ? currentTab.view : roleTabs[0];
  const activeTab: NavigationTab = roleTabs.includes(requestedTab) ? requestedTab : roleTabs[0];

  // When clicking any section / sidebar / command:
  // It navigates inside the CURRENT active tab without creating a new tab!
  const setActiveTab = (view: NavigationTab) => {
    setTabs(prev => {
      if (prev.length === 0) {
        const newTab: TabItem = { id: `tab-${Date.now()}`, view };
        setActiveTabId(newTab.id);
        return [newTab];
      }
      return prev.map(tab => {
        if (tab.id === activeTabId || (prev.length === 1)) {
          return { ...tab, view };
        }
        return tab;
      });
    });
  };

  // Only when user presses + (and selects a destination):
  // Creates a brand new tab and activates it!
  const openNewTab = (view: NavigationTab = roleTabs[0]) => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: TabItem = { id: newTabId, view };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const closeTab = (tabIdToClose: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabIdToClose);
      if (filtered.length === 0) {
        const fallbackTab: TabItem = { id: `tab-${Date.now()}`, view: roleTabs[0] };
        setActiveTabId(fallbackTab.id);
        return [fallbackTab];
      }
      
      // If we closed the active tab, switch to the last remaining tab
      if (activeTabId === tabIdToClose) {
        const nextActive = filtered[filtered.length - 1];
        setActiveTabId(nextActive.id);
      }
      return filtered;
    });
  };

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Raw collections. These are never handed to a view directly — the scoped
  // derivations further down are what the provider exposes, so a view cannot
  // accidentally render another persona's data.
  const [issues, setIssues] = useState<Issue[]>(() => loadFromStorage<Issue[]>('issues', []));
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage<Project[]>('projects', []));
  const [agents, setAgents] = useState<Agent[]>(() => loadFromStorage<Agent[]>('agents', []));
  const [squads, setSquads] = useState<Squad[]>(() => loadFromStorage<Squad[]>('squads', []));
  const [runtimes, setRuntimes] = useState<RuntimeEngine[]>(() => loadFromStorage<RuntimeEngine[]>('runtimes', []));
  const [skills, setSkills] = useState<Skill[]>(() => loadFromStorage<Skill[]>('skills', []));
  const [deployments, setDeployments] = useState<Deployment[]>(() => loadFromStorage('deployments', initialDeployments));
  const [inbox, setInbox] = useState<InboxNotification[]>(() => loadFromStorage('inbox', initialInbox));
  const [analytics, setAnalytics] = useState<AnalyticsData>(() => loadFromStorage('analytics', initialAnalytics));
  const [settings, setSettings] = useState<WorkspaceSettings>(() => loadFromStorage('settings', initialSettings));
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(() => loadFromStorage<ChatThread[]>('chat_threads', []));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadFromStorage<ChatMessage[]>('chat_messages', []));
  const [prototypeRuns, setPrototypeRuns] = useState<PrototypeRun[]>(() => loadFromStorage('prototype_runs', []));
  const [runSetupIssueId, setRunSetupIssueId] = useState<string | null>(null);
  const [runSetupAgentId, setRunSetupAgentId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const handledRunEventsRef = useRef<Set<string>>(new Set());

  const [users] = useState<User[]>(initialUsers);
  const [requirementDocs, setRequirementDocs] = useState<RequirementDoc[]>(() =>
    loadFromStorage('requirement_docs', initialRequirementDocs)
  );
  const [estimates, setEstimates] = useState<Estimate[]>(() => {
    const saved = loadFromStorage<Estimate[]>('estimates', []);
    if (saved.length > 0) return saved;

    // Price the seeded specifications with the real engine rather than
    // hardcoding figures, so the demo numbers move when the rate card,
    // agent telemetry, or scope changes.
    return initialRequirementDocs.map(doc => {
      const est = buildEstimate(
        doc,
        initialAgents,
        initialAnalytics,
        DEFAULT_RATE_CARD,
        undefined,
        initialIssues
      );
      return {
        ...est,
        id: doc.estimateId ?? est.id,
        revision: doc.version,
        status:
          doc.status === 'approved'
            ? 'approved'
            : doc.status === 'awaiting_client'
              ? 'awaiting_client'
              : 'draft',
        approvedBy: doc.approvedBy,
        approvedAt: doc.approvedAt
      } as Estimate;
    });
  });
  const [ledgers, setLedgers] = useState<BudgetLedger[]>(() => loadFromStorage('ledgers', initialLedgers));

  const [isScanningRuntimes, setIsScanningRuntimes] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [activeChatAgentId, setActiveChatAgentId] = useState<string | null>(null);
  const [activeChatSquadId, setActiveChatSquadId] = useState<string | null>(null);

  /* ---------------------------------------------------------------------------
   * Daemon hydration
   *
   * The local daemon is authoritative for every entity it has a table for. On
   * mount we replace the localStorage cache with what it returns; if it is not
   * running we keep the cache and mark the workspace offline.
   *
   * This is what stops the two seed sets — this app's defaults and the backend's
   * `seedDefaultsIfEmpty()` — from drifting: there is now one source of truth
   * whenever the daemon is reachable.
   * ------------------------------------------------------------------------ */
  const [serverStatus, setServerStatus] = useState<ServerStatus>('connecting');

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const snapshot = await fetchServerSnapshot();
      if (cancelled) return;

      // Empty object = nothing succeeded, i.e. the daemon is not answering.
      if (Object.keys(snapshot).length === 0) {
        setServerStatus('offline');
        return;
      }

      // Only overwrite what actually came back; a partially-implemented backend
      // must not blank the entities it does not serve yet.
      if (snapshot.projects) setProjects(snapshot.projects as Project[]);
      if (snapshot.agents) setAgents(snapshot.agents as Agent[]);
      if (snapshot.issues) setIssues(snapshot.issues as Issue[]);
      if (snapshot.squads) setSquads(snapshot.squads as Squad[]);
      if (snapshot.skills) setSkills(snapshot.skills as Skill[]);
      if (snapshot.runtimes) setRuntimes(snapshot.runtimes as RuntimeEngine[]);
      if (snapshot.chatThreads) setChatThreads(snapshot.chatThreads as ChatThread[]);
      if (snapshot.runs) setPrototypeRuns(snapshot.runs as PrototypeRun[]);

      setServerStatus('online');
    };

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  /**
   * Keep detected runtimes fresh.
   *
   * Hydration runs once on mount, so anything the daemon discovers afterwards —
   * a CLI installed, a login completed, a slow model list finally arriving —
   * never reached an open tab. That looked like a bug in the agent editor: the
   * provider appeared but its model dropdown stayed empty, because the browser
   * still held a copy captured before the models loaded.
   *
   * A cheap poll fixes it and matches what the Settings screen already promises.
   * Reads only; the expensive `POST /runtimes/scan` stays a manual action.
   */
  useEffect(() => {
    const REFRESH_MS = 30_000;
    let cancelled = false;

    const refresh = async () => {
      try {
        const latest = await apiService.getRuntimes();
        if (!cancelled && Array.isArray(latest) && latest.length) {
          setRuntimes(latest as RuntimeEngine[]);
        }
      } catch {
        // Daemon down; the offline badge already says so.
      }
    };

    const id = window.setInterval(refresh, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Sync to local storage
  useEffect(() => { saveToStorage('workspace_tabs_v2', tabs); }, [tabs]);
  useEffect(() => { saveToStorage('active_tab_id_v2', activeTabId); }, [activeTabId]);
  useEffect(() => { saveToStorage('issues', issues); }, [issues]);
  useEffect(() => { saveToStorage('projects', projects); }, [projects]);
  useEffect(() => { saveToStorage('agents', agents); }, [agents]);
  useEffect(() => { saveToStorage('squads', squads); }, [squads]);
  useEffect(() => { saveToStorage('runtimes', runtimes); }, [runtimes]);
  useEffect(() => { saveToStorage('skills', skills); }, [skills]);
  useEffect(() => { saveToStorage('deployments', deployments); }, [deployments]);
  useEffect(() => { saveToStorage('inbox', inbox); }, [inbox]);
  useEffect(() => { saveToStorage('analytics', analytics); }, [analytics]);
  useEffect(() => { saveToStorage('settings', settings); }, [settings]);
  useEffect(() => { saveToStorage('chat_threads', chatThreads); }, [chatThreads]);
  useEffect(() => { saveToStorage('chat_messages', chatMessages); }, [chatMessages]);
  useEffect(() => { saveToStorage('prototype_runs', prototypeRuns); }, [prototypeRuns]);
  useEffect(() => { saveToStorage('active_role', role); }, [role]);
  useEffect(() => { saveToStorage('requirement_docs', requirementDocs); }, [requirementDocs]);
  useEffect(() => { saveToStorage('estimates', estimates); }, [estimates]);
  useEffect(() => { saveToStorage('ledgers', ledgers); }, [ledgers]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showToast = (title: string, description?: string, tone: ToastMessage['tone'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts(prev => {
      if (prev.some(toast => toast.title === title && toast.description === description)) return prev;
      return [...prev.slice(-3), { id, title, description, tone }];
    });
    window.setTimeout(() => dismissToast(id), 4200);
  };

  // Global Keyboard shortcuts (Cmd+K for command palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync real state with alpha-be-main backend and listen to live WebSocket execution
  useEffect(() => {
    runnerSocket.connect();

    const unsubStage = runnerSocket.on('stage_update', ({ runId, status, stageIndex }) => {
      setPrototypeRuns(prev => prev.map(run => {
        if (run.id !== runId) return run;
        const updatedStages = run.stages.map((s, idx) => {
          if (idx < stageIndex && s.status === 'running') return { ...s, status: 'success' as const, completedAt: new Date().toISOString() };
          if (idx === stageIndex) return { ...s, status, startedAt: s.startedAt || new Date().toISOString(), completedAt: status === 'success' || status === 'failed' ? new Date().toISOString() : undefined };
          return s;
        });
        return {
          ...run,
          currentStageIndex: stageIndex,
          stages: updatedStages,
          updatedAt: new Date().toISOString()
        };
      }));
    });

    const unsubLog = runnerSocket.on('log_chunk', ({ runId, stageId, message }) => {
      setPrototypeRuns(prev => prev.map(run => {
        if (run.id !== runId) return run;
        const updatedStages = run.stages.map(s => {
          if (s.id === stageId) return { ...s, logs: [...s.logs, message] };
          return s;
        });
        return { ...run, stages: updatedStages, updatedAt: new Date().toISOString() };
      }));
    });

    const unsubComplete = runnerSocket.on('run_completed', (finalRun) => {
      setPrototypeRuns(prev => prev.map(r => r.id === finalRun.id ? finalRun : r));
      setIssues(prev => prev.map(i => i.id === finalRun.issueId ? {
        ...i,
        status: 'review',
        prUrl: finalRun.prUrl,
        updatedAt: new Date().toISOString()
      } : i));
      showToast('Run completed', `Agent finished work on issue. ${finalRun.insertions || 0} insertions, ${finalRun.deletions || 0} deletions.`, 'success');
    });

    const unsubFailed = runnerSocket.on('run_failed', (failedRun) => {
      setPrototypeRuns(prev => prev.map(r => r.id === failedRun.id ? failedRun : r));
      setIssues(prev => prev.map(i => i.id === failedRun.issueId ? { ...i, status: 'in_progress', updatedAt: new Date().toISOString() } : i));
      showToast('Run failed', failedRun.testSummary || 'Agent encountered an error.', 'error');
    });

    // Fetch initial persistent real state from backend
    apiService.checkHealth().then(async () => {
      try {
        const [dbProjects, dbAgents, dbIssues, dbSquads, dbRuntimes, dbSkills, dbRuns] = await Promise.all([
          apiService.getProjects(),
          apiService.getAgents(),
          apiService.getIssues(),
          apiService.getSquads(),
          apiService.getRuntimes(),
          apiService.getSkills(),
          apiService.getRuns()
        ]);
        if (dbProjects?.length) setProjects(dbProjects as any);
        if (dbAgents?.length) setAgents(dbAgents as any);
        if (dbIssues?.length) setIssues(dbIssues as any);
        if (dbSquads?.length) setSquads(dbSquads as any);
        if (dbRuntimes?.length) setRuntimes(dbRuntimes as any);
        if (dbSkills?.length) setSkills(dbSkills as any);
        if (dbRuns?.length) setPrototypeRuns(dbRuns as any);
      } catch (err) {
        console.warn('Backend sync error:', err);
      }
    }).catch(() => {
      // Backend not running yet; gracefully use local storage cache
    });

    return () => {
      unsubStage();
      unsubLog();
      unsubComplete();
      unsubFailed();
    };
  }, []);

  // Unread count is derived from the scoped inbox further down, not from the
  // raw list — a client must not be given a badge for internal traffic.

  // Issue CRUD
  const createIssue = (input: Omit<Issue, 'id' | 'identifier' | 'createdAt' | 'updatedAt' | 'comments' | 'subtasks'> & { subtasks?: string[] }): Issue => {
    const project = projects.find(p => p.id === input.projectId) || projects[0];
    const nextNum = issues.length + 101;
    const identifier = `${project ? project.key : 'ALF'}-${nextNum}`;
    
    const newIssue: Issue = {
      ...input,
      id: `iss-${Date.now()}`,
      identifier,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtasks: (input.subtasks || []).map((st, i) => ({
        id: `sub-${Date.now()}-${i}`,
        title: st,
        completed: false
      })),
      comments: [
        {
          id: `comm-${Date.now()}`,
          authorType: 'system',
          authorName: 'System',
          content: `Issue ${identifier} created and queued.`,
          createdAt: new Date().toISOString()
        }
      ]
    };

    setIssues(prev => [newIssue, ...prev]);

    // Add inbox notification
    const newNotification: InboxNotification = {
      id: `notif-${Date.now()}`,
      type: 'issue_assigned',
      title: `New Issue Created: ${identifier}`,
      message: `${newIssue.title} was created in project ${project ? project.name : 'Alpha'}.`,
      read: false,
      audience: 'internal',
      timestamp: new Date().toISOString(),
      entityType: 'issue',
      entityId: newIssue.id,
      meta: {
        issueIdentifier: identifier
      }
    };
    setInbox(prev => [newNotification, ...prev]);

    persist(
      () => apiService.createIssue(newIssue),
      saved => setIssues(prev => prev.map(i => (i.id === newIssue.id ? saved : i))),
      msg => showToast('Issue not saved', msg, 'error')
    );

    return newIssue;
  };

  const updateIssueStatus = (id: string, status: IssueStatus) => {
    setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, status, updatedAt: new Date().toISOString() } : iss));
    persist(
      () => apiService.updateIssue(id, { status }),
      () => {},
      msg => showToast('Status not saved', msg, 'error')
    );
  };

  const updateIssue = (id: string, updates: Partial<Issue>) => {
    setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, ...updates, updatedAt: new Date().toISOString() } : iss));
    persist(
      () => apiService.updateIssue(id, updates),
      () => {},
      msg => showToast('Issue not saved', msg, 'error')
    );
  };

  const deleteIssue = (id: string) => {
    const removed = issues.find(iss => iss.id === id);
    setIssues(prev => prev.filter(iss => iss.id !== id));
    persist(
      () => apiService.deleteIssue(id),
      () => {},
      msg => {
        if (removed) setIssues(prev => [removed, ...prev]);
        showToast('Issue not deleted', msg, 'error');
      }
    );
  };

  // Prototype agent-run setup and lifecycle
  const runAgentOnIssue = (issueId: string, agentId?: string) => {
    const targetIssue = issues.find(issue => issue.id === issueId);
    if (!targetIssue) return;

    const blockingRun = prototypeRuns.find(run =>
      run.issueId === issueId && ['running', 'awaiting_approval', 'validating'].includes(run.status)
    );
    if (blockingRun) {
      showToast('Run already in progress', 'Open the issue to view its current status.', 'info');
      return;
    }

    setRunSetupIssueId(issueId);
    setRunSetupAgentId(agentId || targetIssue.assignedAgentId || agents[0]?.id || null);
  };

  const closeRunSetup = () => {
    setRunSetupIssueId(null);
    setRunSetupAgentId(null);
  };

  const buildRunStages = (startedAt: string): PrototypeRun['stages'] => [
    {
      id: 'workspace',
      label: 'Preparing workspace',
      description: 'Restoring project context and opening a safe working branch.',
      status: 'running',
      durationMs: 1100,
      logs: ['Workspace context restored.', 'Created isolated prototype branch.'],
      startedAt
    },
    {
      id: 'analysis',
      label: 'Analyzing issue',
      description: 'Reviewing the issue, subtasks, and connected project resources.',
      status: 'pending',
      durationMs: 1250,
      logs: ['Issue requirements indexed.', 'Relevant project files identified.']
    },
    {
      id: 'implementation',
      label: 'Implementing changes',
      description: 'Applying the approved plan to the simulated workspace.',
      status: 'pending',
      durationMs: 1700,
      logs: ['Implementation patch generated.', 'Changed files formatted.']
    },
    {
      id: 'tests',
      label: 'Running tests',
      description: 'Checking types, unit tests, and expected behavior.',
      status: 'pending',
      durationMs: 1450,
      logs: ['Type checking passed.', 'Test suite completed.']
    },
    {
      id: 'review',
      label: 'Preparing review',
      description: 'Summarizing changes and preparing a mock pull request.',
      status: 'pending',
      durationMs: 1050,
      logs: ['Change summary generated.', 'Review artifacts prepared.']
    }
  ];

  const startPrototypeRun = (
    issueId: string,
    agentId: string,
    plan: string[],
    scenario: PrototypeRun['scenario']
  ): PrototypeRun | null => {
    const targetIssue = issues.find(issue => issue.id === issueId);
    const assignedAgent = agents.find(agent => agent.id === agentId);
    if (!targetIssue || !assignedAgent) return null;

    const now = new Date().toISOString();
    const run: PrototypeRun = {
      id: `run-${Date.now()}`,
      issueId,
      projectId: targetIssue.projectId,
      agentId,
      status: 'running',
      scenario,
      plan,
      stages: buildRunStages(now),
      currentStageIndex: 0,
      createdAt: now,
      updatedAt: now
    };

    setPrototypeRuns(prev => [run, ...prev]);
    setIssues(prev => prev.map(issue => issue.id === issueId ? {
      ...issue,
      status: 'agent_running',
      assignedAgentId: agentId,
      comments: [...issue.comments, {
        id: `comm-${run.id}-started`,
        authorType: 'agent' as const,
        authorName: assignedAgent.name,
        authorAvatar: assignedAgent.avatar,
        agentId,
        content: `Started the approved plan for ${targetIssue.identifier}. Live 5-stage progress is active.`,
        createdAt: now,
        isThinking: true
      }],
      updatedAt: now
    } : issue));
    setAgents(prev => prev.map(agent => agent.id === agentId ? {
      ...agent,
      status: 'executing',
      workStatus: 'working',
      currentTask: targetIssue.identifier
    } : agent));
    closeRunSetup();
    showToast('Agent run started', `${assignedAgent.name} is working on ${targetIssue.identifier}.`, 'success');

    // Trigger real backend run
    apiService.startRun({ issueId, agentId, plan, scenario }).then((realRun) => {
      if (realRun && realRun.id) {
        setPrototypeRuns(prev => prev.map(r => r.id === run.id ? {
          ...r,
          ...realRun,
          id: run.id,
          scenario: (realRun.scenario || scenario || 'success') as any
        } : r));
      }
    }).catch(err => {
      console.warn('Real run dispatched with local fallback:', err);
    });

    return run;
  };

  const cancelPrototypeRun = (runId: string) => {
    const run = prototypeRuns.find(item => item.id === runId);
    if (!run || run.status !== 'running') return;
    const now = new Date().toISOString();

    apiService.cancelRun(runId).catch(() => {});

    setPrototypeRuns(prev => prev.map(item => item.id === runId ? {
      ...item,
      status: 'cancelled',
      updatedAt: now,
      stages: item.stages.map((stage, index) => index === item.currentStageIndex
        ? { ...stage, status: 'cancelled', completedAt: now }
        : stage)
    } : item));
    setIssues(prev => prev.map(issue => issue.id === run.issueId ? {
      ...issue,
      status: 'in_progress',
      comments: [...issue.comments, {
        id: `comm-${run.id}-cancelled`,
        authorType: 'system' as const,
        authorName: 'Prototype runner',
        content: 'Run cancelled. The issue remains in progress and can be started again.',
        createdAt: now
      }],
      updatedAt: now
    } : issue));
    setAgents(prev => prev.map(agent => agent.id === run.agentId ? {
      ...agent,
      status: 'idle',
      workStatus: 'idle',
      currentTask: undefined
    } : agent));
    showToast('Run cancelled', 'No changes were submitted for review.', 'info');
  };

  const retryPrototypeRun = (runId: string) => {
    const run = prototypeRuns.find(item => item.id === runId);
    if (!run || !['failed', 'changes_requested', 'cancelled'].includes(run.status)) return;
    const now = new Date().toISOString();

    apiService.retryRun(runId).catch(() => {});

    setPrototypeRuns(prev => prev.map(item => item.id === runId ? {
      ...item,
      status: 'running',
      scenario: 'success',
      stages: buildRunStages(now),
      currentStageIndex: 0,
      updatedAt: now,
      branchName: undefined,
      prUrl: undefined,
      testSummary: undefined
    } : item));
    setIssues(prev => prev.map(issue => issue.id === run.issueId ? {
      ...issue,
      status: 'agent_running',
      comments: [...issue.comments, {
        id: `comm-${run.id}-retry-${Date.now()}`,
        authorType: 'system' as const,
        authorName: 'Prototype runner',
        content: 'Run restarted with a clean workspace.',
        createdAt: now
      }],
      updatedAt: now
    } : issue));
    setAgents(prev => prev.map(agent => agent.id === run.agentId ? {
      ...agent,
      status: 'executing',
      workStatus: 'working'
    } : agent));
    showToast('Run restarted', 'The failed stage will be attempted again.', 'success');
  };

  // Advance simulated stages from their stored timestamps so a refresh can resume a run.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const nowMs = Date.now();
      setPrototypeRuns(prev => prev.map(run => {
        if (run.status !== 'running') return run;

        const currentStage = run.stages[run.currentStageIndex];
        if (!currentStage) return run;
        const startedAt = currentStage.startedAt || run.updatedAt;
        const duration = currentStage.durationMs ?? 1500;
        if (nowMs - new Date(startedAt).getTime() < duration) return run;

        const completedAt = new Date(nowMs).toISOString();
        const shouldFail = run.scenario === 'test_failure' && currentStage.id === 'tests';
        if (shouldFail) {
          return {
            ...run,
            status: 'failed',
            testSummary: '2 tests failed · retry available',
            updatedAt: completedAt,
            stages: run.stages.map((stage, index) => index === run.currentStageIndex ? {
              ...stage,
              status: 'failed',
              completedAt,
              logs: ['Type checking passed.', '2 tests failed in the simulated regression suite.']
            } : stage)
          };
        }

        const nextIndex = run.currentStageIndex + 1;
        const hasNextStage = nextIndex < run.stages.length;
        const nextStages = run.stages.map((stage, index) => {
          if (index === run.currentStageIndex) {
            return { ...stage, status: 'success' as const, completedAt };
          }
          if (index === nextIndex) {
            return { ...stage, status: 'running' as const, startedAt: completedAt };
          }
          return stage;
        });

        return {
          ...run,
          status: hasNextStage ? 'running' : 'awaiting_approval',
          currentStageIndex: hasNextStage ? nextIndex : run.currentStageIndex,
          changedFiles: hasNextStage ? run.changedFiles : 4,
          insertions: hasNextStage ? run.insertions : 86,
          deletions: hasNextStage ? run.deletions : 14,
          testSummary: hasNextStage ? run.testSummary : '42 tests passed',
          updatedAt: completedAt,
          stages: nextStages
        };
      }));
    }, 350);

    return () => window.clearInterval(timer);
  }, []);

  // Materialize review and failure events into the existing issue and inbox views.
  useEffect(() => {
    prototypeRuns.forEach(run => {
      if (!['awaiting_approval', 'failed'].includes(run.status)) return;
      const eventKey = `${run.id}:${run.status}`;
      if (handledRunEventsRef.current.has(eventKey)) return;
      handledRunEventsRef.current.add(eventKey);

      const targetIssue = issues.find(issue => issue.id === run.issueId);
      const assignedAgent = agents.find(agent => agent.id === run.agentId);
      if (!targetIssue || !assignedAgent) return;
      const now = new Date().toISOString();

      setAgents(prev => prev.map(agent => agent.id === run.agentId ? {
        ...agent,
        status: 'idle',
        workStatus: 'idle',
        currentTask: undefined,
        stats: {
          totalRuns: ((agent.stats && agent.stats.totalRuns) || 0) + 1,
          successRate: agent.stats ? agent.stats.successRate : 100,
          tokensUsed: agent.stats ? agent.stats.tokensUsed : 0,
          avgLatencyMs: agent.stats ? agent.stats.avgLatencyMs : 250
        }
      } : agent));

      if (run.status === 'failed') {
        setIssues(prev => prev.map(issue => issue.id === run.issueId ? {
          ...issue,
          status: 'in_progress',
          comments: issue.comments.some(comment => comment.id === `comm-${run.id}-failed`)
            ? issue.comments
            : [...issue.comments, {
                id: `comm-${run.id}-failed`,
                authorType: 'agent' as const,
                authorName: assignedAgent.name,
                authorAvatar: assignedAgent.avatar,
                agentId: assignedAgent.id,
                content: 'The simulated test stage found two regressions. Review the run and retry when ready.',
                createdAt: now
              }],
          updatedAt: now
        } : issue));
        setInbox(prev => prev.some(item => item.id === `notif-${run.id}-failed`) ? prev : [{
          id: `notif-${run.id}-failed`,
          type: 'agent_failed',
          title: `Run needs attention: ${targetIssue.identifier}`,
          message: `${assignedAgent.name} stopped after the simulated test stage failed.`,
          read: false,
          timestamp: now,
          entityType: 'issue',
          entityId: targetIssue.id,
          meta: {
            agentName: assignedAgent.name,
            agentRole: assignedAgent.role,
            issueIdentifier: targetIssue.identifier
          }
        }, ...prev]);
        showToast('Run needs attention', 'The simulated tests failed. Open the issue to retry.', 'error');
        return;
      }

      const branchName = `feat/${targetIssue.identifier.toLowerCase()}-prototype`;
      const prUrl = `https://github.com/multica/alpha-engine/pull/${Math.floor(Math.random() * 80) + 10}`;
      setPrototypeRuns(prev => prev.map(item => item.id === run.id ? {
        ...item,
        branchName,
        prUrl
      } : item));
      setIssues(prev => prev.map(issue => issue.id === run.issueId ? {
        ...issue,
        status: 'review',
        branchName,
        prUrl,
        subtasks: issue.subtasks.map(subtask => ({ ...subtask, completed: true })),
        comments: issue.comments.some(comment => comment.id === `comm-${run.id}-review`)
          ? issue.comments
          : [...issue.comments, {
              id: `comm-${run.id}-review`,
              authorType: 'agent' as const,
              authorName: assignedAgent.name,
              authorAvatar: assignedAgent.avatar,
              agentId: assignedAgent.id,
              content: `Implementation is ready for review. ${run.changedFiles || 4} files changed and ${run.testSummary || 'all tests passed'}.`,
              createdAt: now,
              isThinking: false
            }],
        updatedAt: now
      } : issue));
      setInbox(prev => prev.some(item => item.id === `notif-${run.id}-approval`) ? prev : [{
        id: `notif-${run.id}-approval`,
        type: 'agent_approval',
        title: `Review requested: ${targetIssue.identifier}`,
        message: `${assignedAgent.name} completed the approved plan and prepared a simulated pull request.`,
        read: false,
        timestamp: now,
        entityType: 'issue',
        entityId: targetIssue.id,
        approvalStatus: 'pending',
        meta: {
          agentName: assignedAgent.name,
          agentRole: assignedAgent.role,
          issueIdentifier: targetIssue.identifier,
          proposedChanges: `${run.insertions || 86} insertions, ${run.deletions || 14} deletions in ${run.changedFiles || 4} files.`,
          costTokens: 3850
        }
      }, ...prev]);
      showToast('Review ready', `${targetIssue.identifier} is waiting in Inbox.`, 'success');
    });
  }, [prototypeRuns, issues, agents]);

  /* Projects
   *
   * Create is the one project write that is not optimistic, unlike the update
   * and delete below. A failed edit can roll back into a row that still exists;
   * a failed create cannot. `key` is UNIQUE in the daemon's schema and it is now
   * derived rather than typed, so a rejected insert is a reachable case — and an
   * optimistic row would sit in the list looking real, accept issues, and vanish
   * on the next reload. Wait for the write instead and surface the failure.
   */
  const createProject = async (
    input: Omit<Project, 'id' | 'totalIssues' | 'completedIssues' | 'progressPercentage' | 'milestones'>
  ): Promise<Project> => {
    const draft: Project = {
      ...input,
      id: `proj-${Date.now()}`,
      status: input.status || 'planned',
      priority: input.priority || 'medium',
      resources: input.resources || [],
      totalIssues: 0,
      completedIssues: 0,
      progressPercentage: 0,
      createdAt: new Date().toISOString(),
      milestones: [
        { id: `m-${Date.now()}`, title: 'Initial Architecture Scaffolding', targetDate: input.targetDate, completed: false }
      ]
    };

    try {
      const saved = await apiService.createProject(draft);
      // Take only the id from the server. The daemon echoes the draft back
      // unchanged, but the Supabase fallback returns a snake_case row, and
      // spreading that would put `start_date`-shaped keys into state.
      const project: Project = { ...draft, id: saved?.id ?? draft.id };
      setProjects(prev => [project, ...prev]);
      return project;
    } catch (err) {
      const message = describeWriteError(err);
      console.warn('[sync] project create failed:', err);
      showToast('Project not saved', message, 'error');
      // Re-throw the tidied message so the dialog shows the same one line the
      // toast does, not Express's HTML error page.
      throw new Error(message);
    }
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    persist(
      () => apiService.updateProject(id, updates),
      () => {},
      msg => showToast('Project not saved', msg, 'error')
    );
  };

  const deleteProject = (id: string) => {
    const removed = projects.find(p => p.id === id);
    setProjects(prev => prev.filter(p => p.id !== id));
    persist(
      () => apiService.deleteProject(id),
      () => {},
      msg => {
        // Put it back: the server still has it, so hiding it would lie.
        if (removed) setProjects(prev => [removed, ...prev]);
        showToast('Project not deleted', msg, 'error');
      }
    );
  };

  // Agents
  const createAgent = (input: Omit<Agent, 'id' | 'stats' | 'status'>): Agent => {
    const newAgent: Agent = {
      ...input,
      id: `agent-${Date.now()}`,
      owner: input.owner || 'You',
      isMine: input.isMine ?? true,
      allowedUsers: input.allowedUsers || 'team',
      machineStatus: input.machineStatus || 'online',
      workStatus: input.workStatus || 'idle',
      machineName: input.machineName || 'Local Runner',
      lastActive: 'Just now',
      isArchived: false,
      concurrencyLimit: input.concurrencyLimit || 2,
      envVars: input.envVars || [],
      mcpServers: input.mcpServers || [],
      customCliArgs: input.customCliArgs || '',
      runHistory: [],
      activity30d: new Array(30).fill(0),
      stats: {
        totalRuns: 0,
        successRate: 100,
        tokensUsed: 0,
        avgLatencyMs: 250
      },
      status: 'idle'
    };
    setAgents(prev => [newAgent, ...prev]);

    persist(
      () => apiService.createAgent(newAgent),
      saved => setAgents(prev => prev.map(a => (a.id === newAgent.id ? saved : a))),
      msg => showToast('Agent not saved', msg, 'error')
    );

    return newAgent;
  };

  const importAgent = async (content: string) => {
    // No optimistic insert: the id and the validated fields are decided by the
    // daemon, so there is nothing meaningful to show until it answers.
    const result = await apiService.importAgent(content);
    setAgents(prev => [result.agent, ...prev]);
    return result;
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    persist(
      () => apiService.updateAgent(id, updates),
      () => {},
      msg => showToast('Agent not saved', msg, 'error')
    );
  };

  const duplicateAgent = (id: string): Agent | null => {
    const existing = agents.find(a => a.id === id);
    if (!existing) return null;

    // Filter out secret environment variables when duplicating (per Step 6)
    const safeEnvVars = (existing.envVars || [])
      .filter(ev => !ev.isSecret)
      .map(ev => ({ ...ev }));

    const newAgent: Agent = {
      ...existing,
      id: `agent-${Date.now()}`,
      name: `${existing.name} (Copy)`,
      owner: 'You',
      isMine: true,
      isArchived: false,
      envVars: safeEnvVars,
      stats: {
        totalRuns: 0,
        successRate: 100,
        tokensUsed: 0,
        avgLatencyMs: existing.stats?.avgLatencyMs || 250
      },
      status: 'idle',
      workStatus: 'idle',
      runHistory: [],
      activity30d: new Array(30).fill(0)
    };

    setAgents(prev => [newAgent, ...prev]);
    return newAgent;
  };

  const archiveAgent = (id: string) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, isArchived: true, status: 'offline', workStatus: 'idle' } : a));
  };

  const restoreAgent = (id: string) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, isArchived: false, status: 'idle' } : a));
  };

  const deleteAgent = (id: string) => {
    const removed = agents.find(a => a.id === id);
    setAgents(prev => prev.filter(a => a.id !== id));
    persist(
      () => apiService.deleteAgent(id),
      () => {},
      msg => {
        if (removed) setAgents(prev => [removed, ...prev]);
        showToast('Agent not deleted', msg, 'error');
      }
    );
  };

  const bulkUpdateAgents = (ids: string[], updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => ids.includes(a.id) ? { ...a, ...updates } : a));
  };

  const bulkArchiveAgents = (ids: string[]) => {
    setAgents(prev => prev.map(a => ids.includes(a.id) ? { ...a, isArchived: true, status: 'offline', workStatus: 'idle' } : a));
  };

  // Squads
  const createSquad = (input: Omit<Squad, 'id' | 'activeRunsCount' | 'completedRunsCount'>): Squad => {
    const newSquad: Squad = {
      ...input,
      id: `sq-${Date.now()}`,
      activeRunsCount: 0,
      completedRunsCount: 0
    };
    setSquads(prev => [...prev, newSquad]);
    return newSquad;
  };

  const triggerSquadRun = async (squadId: string, missionGoal?: string) => {
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return;

    setSquads(prev => prev.map(s => s.id === squadId ? { ...s, activeRunsCount: s.activeRunsCount + 1 } : s));

    // Add inbox item
    const runNotif: InboxNotification = {
      id: `notif-${Date.now()}`,
      type: 'agent_completed',
      title: `Squad Swarm Run Initiated: ${squad.name}`,
      message: `Mission: "${missionGoal || squad.mission}". Topology: ${squad.topology.toUpperCase()}. ${squad.memberAgentIds.length} agents coordinating.`,
      read: false,
      audience: 'internal',
      timestamp: new Date().toISOString(),
      entityType: 'squad',
      entityId: squad.id
    };
    setInbox(prev => [runNotif, ...prev]);

    setTimeout(() => {
      setSquads(prev => prev.map(s => s.id === squadId ? { 
        ...s, 
        activeRunsCount: Math.max(0, s.activeRunsCount - 1),
        completedRunsCount: s.completedRunsCount + 1 
      } : s));
    }, 4500);
  };

  // Runtimes
  const scanLocalRuntimes = async () => {
    setIsScanningRuntimes(true);
    try {
      const realRuntimes = await apiService.scanRuntimes();
      if (realRuntimes && realRuntimes.length > 0) {
        setRuntimes(realRuntimes as any);
        showToast('Runtime scan completed', `Discovered ${realRuntimes.filter(r => r.status === 'online').length} online AI tools.`, 'success');
      }
    } catch {
      showToast('Runtime scan completed', 'Scanned local environment.', 'info');
    } finally {
      setIsScanningRuntimes(false);
    }
  };

  const setDefaultRuntime = (id: string) => {
    setRuntimes(prev => prev.map(rt => ({
      ...rt,
      isDefault: rt.id === id
    })));
  };

  // Skills
  const toggleSkill = (id: string) => {
    setSkills(prev => prev.map(sk => sk.id === id ? { ...sk, enabled: !sk.enabled } : sk));
  };

  // Deployments
  const triggerDeployment = async (
    projectId: string,
    env: 'Production' | 'Staging' | 'Preview' = 'Staging',
    source?: { issueId?: string; runId?: string }
  ) => {
    const proj = projects.find(p => p.id === projectId) || projects[0];
    if (!proj) {
      // No projects loaded yet — deploying has nothing to point at.
      showToast('Cannot deploy', 'No project is available yet.', 'error');
      return;
    }

    const newDep: Deployment = {
      id: `dep-${Date.now()}`,
      projectId: proj.id,
      projectName: proj.name,
      name: `Automated Pipeline Trigger (${env})`,
      environment: env,
      status: 'queued',
      branch: 'main',
      commitSha: Math.random().toString(16).substring(2, 9),
      commitMessage: 'Automated CI/CD release triggered by Agent Orchestrator',
      triggeredBy: {
        type: 'agent',
        name: 'Cipher Drake (DevOps)'
      },
      durationSec: 0,
      startedAt: new Date().toISOString(),
      sourceIssueId: source?.issueId,
      sourceRunId: source?.runId,
      stages: [
        { name: 'Lint & Strict Typecheck', status: 'running', logs: ['Starting TypeScript compiler...'] },
        { name: 'Autonomous Agent QA Tests', status: 'pending', logs: [] },
        { name: 'Container Artifact Build', status: 'pending', logs: [] },
        { name: 'Deploy to Cloud Cluster', status: 'pending', logs: [] },
      ]
    };

    setDeployments(prev => [newDep, ...prev]);

    // Simulate stage progress
    setTimeout(() => {
      setDeployments(prev => prev.map(d => {
        if (d.id !== newDep.id) return d;
        return {
          ...d,
          status: 'building',
          durationSec: 20,
          stages: [
            { name: 'Lint & Strict Typecheck', status: 'success', durationSec: 10, logs: ['0 errors found. Strict type rules valid.'] },
            { name: 'Autonomous Agent QA Tests', status: 'running', durationSec: 10, logs: ['Executing 42 test suites...'] },
            { name: 'Container Artifact Build', status: 'pending', logs: [] },
            { name: 'Deploy to Cloud Cluster', status: 'pending', logs: [] },
          ]
        };
      }));
    }, 2000);

    setTimeout(() => {
      setDeployments(prev => prev.map(d => {
        if (d.id !== newDep.id) return d;
        return {
          ...d,
          status: 'success',
          durationSec: 48,
          previewUrl: `https://${env.toLowerCase()}-alpha.multica.internal`,
          stages: [
            { name: 'Lint & Strict Typecheck', status: 'success', durationSec: 10, logs: ['0 errors found.'] },
            { name: 'Autonomous Agent QA Tests', status: 'success', durationSec: 18, logs: ['All 42 tests passed.'] },
            { name: 'Container Artifact Build', status: 'success', durationSec: 12, logs: ['Docker image sha256:7f4a... generated.'] },
            { name: 'Deploy to Cloud Cluster', status: 'success', durationSec: 8, logs: ['Kubernetes pods healthy. Traffic switched.'] },
          ]
        };
      }));

      // Notify in inbox
      setInbox(prev => [{
        id: `notif-${Date.now()}`,
        type: 'deployment_status',
        title: `${env} Deployment Succeeded`,
        message: `${proj.name} successfully deployed to ${env}.`,
        read: false,
        audience: 'internal',
        timestamp: new Date().toISOString(),
        entityType: 'deployment',
        entityId: newDep.id
      }, ...prev]);

      if (source?.issueId) {
        const completedAt = new Date().toISOString();
        setIssues(prev => prev.map(issue => issue.id === source.issueId ? {
          ...issue,
          status: 'done',
          comments: issue.comments.some(comment => comment.id === `comm-${source.runId}-validated`)
            ? issue.comments
            : [...issue.comments, {
                id: `comm-${source.runId}-validated`,
                authorType: 'system' as const,
                authorName: 'Prototype CI',
                content: `Preview validation completed successfully. The issue is ready for delivery.`,
                createdAt: completedAt
              }],
          updatedAt: completedAt
        } : issue));
      }

      if (source?.runId) {
        setPrototypeRuns(prev => prev.map(run => run.id === source.runId ? {
          ...run,
          status: 'completed',
          updatedAt: new Date().toISOString()
        } : run));
        showToast('Prototype delivery complete', `${proj.name} passed the Preview pipeline.`, 'success');
      }
    }, 4500);
  };

  // Inbox
  const markNotificationRead = (id: string) => {
    setInbox(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setInbox(prev => prev.map(n => ({ ...n, read: true })));
  };

  const archiveNotification = (id: string) => {
    setInbox(prev => prev.map(n => n.id === id ? { ...n, archived: true } : n));
  };

  const handleApproval = (notificationId: string, action: 'approved' | 'rejected') => {
    const notif = inbox.find(n => n.id === notificationId);
    if (!notif) return;

    setInbox(prev => prev.map(n => n.id === notificationId ? { ...n, approvalStatus: action, read: true } : n));

    if (notif.entityType !== 'issue') return;

    const run = prototypeRuns.find(item =>
      item.issueId === notif.entityId && item.status === 'awaiting_approval'
    );

    // Preserve approval behavior for older seeded notifications that are not tied to a run.
    if (!run) {
      if (action === 'approved') updateIssueStatus(notif.entityId, 'done');
      showToast(action === 'approved' ? 'Work approved' : 'Changes requested', undefined, action === 'approved' ? 'success' : 'info');
      return;
    }

    const now = new Date().toISOString();
    if (action === 'approved') {
      setPrototypeRuns(prev => prev.map(item => item.id === run.id ? {
        ...item,
        status: 'validating',
        updatedAt: now
      } : item));
      setIssues(prev => prev.map(issue => issue.id === run.issueId ? {
        ...issue,
        comments: [...issue.comments, {
          id: `comm-${run.id}-approved`,
          authorType: 'system' as const,
          authorName: 'Prototype runner',
          content: 'Review approved. Merge triggered & Preview validation started.',
          createdAt: now
        }],
        updatedAt: now
      } : issue));

      // If a real GitHub PR exists for this run, merge it
      if (run.prUrl && !run.prUrl.includes('mock-')) {
        apiService.mergeGitHubPR({ prUrl: run.prUrl })
          .then(() => showToast('GitHub PR Merged', `Squashed and merged ${run.prUrl}`, 'success'))
          .catch(err => console.warn('PR auto-merge warning:', err));
      }

      void triggerDeployment(run.projectId, 'Preview', { issueId: run.issueId, runId: run.id });
      showToast('Review approved', 'PR merge dispatched and validation running in CI/CD.', 'success');
      return;
    }

    setPrototypeRuns(prev => prev.map(item => item.id === run.id ? {
      ...item,
      status: 'changes_requested',
      updatedAt: now
    } : item));
    setIssues(prev => prev.map(issue => issue.id === run.issueId ? {
      ...issue,
      status: 'in_progress',
      comments: [...issue.comments, {
        id: `comm-${run.id}-rejected`,
        authorType: 'system' as const,
        authorName: 'Prototype runner',
        content: 'Changes requested during review. The run can be retried from the issue.',
        createdAt: now
      }],
      updatedAt: now
    } : issue));
    showToast('Changes requested', 'Return to the issue when you are ready to retry.', 'info');
  };

  // Chat & Threads
  const createNewThread = (title = 'New Conversation') => {
    const newThreadId = `th-${Date.now()}`;
    const isClientThread = role === 'client';

    // A thread must be created in the audience of whoever opened it, or its
    // author would immediately lose sight of it.
    const newThread: ChatThread = {
      id: newThreadId,
      title: isClientThread ? 'Message your project manager' : title,
      lastMessageSnippet: isClientThread ? 'Ask us anything about your request.' : 'Ready for instructions...',
      lastMessageAt: new Date().toISOString(),
      pinned: false,
      iconType: isClientThread ? 'sparkle' : 'asterisk',
      audience: isClientThread ? 'client' : 'internal',
      clientId: isClientThread ? currentUser.id : undefined,
      agentIds: isClientThread ? [] : [agents[0]?.id || 'agent-1'],
      messages: []
    };
    setChatThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newThreadId);
    return newThreadId;
  };

  const deleteThread = (id: string) => {
    setChatThreads(prev => prev.filter(t => t.id !== id));
    if (activeThreadId === id) {
      setActiveThreadId(null);
    }
  };

  const sendChatMessage = async (content: string) => {
    let targetThreadId = activeThreadId;
    if (!targetThreadId) {
      targetThreadId = createNewThread(content.slice(0, 32) + (content.length > 32 ? '...' : ''));
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderType: 'user',
      senderName: currentUser.name,
      content,
      timestamp: new Date().toISOString()
    };

    // Add user message to thread
    setChatThreads(prev => prev.map(t => {
      if (t.id !== targetThreadId) return t;
      const msgs = t.messages || [];
      return {
        ...t,
        lastMessageSnippet: content,
        lastMessageAt: new Date().toISOString(),
        isFailed: false,
        messages: [...msgs, userMsg]
      };
    }));

    setChatMessages(prev => [...prev, userMsg]);

    // A client is talking to a person, not an agent. The message is delivered
    // to the project manager's queue and left there — no synthetic reply is
    // fabricated on the PM's behalf.
    if (role === 'client') {
      const pm = users.find(u => u.role === 'pm');
      setInbox(prev => [
        {
          id: `notif-${Date.now()}`,
          type: 'mention',
          title: `Message from ${currentUser.company || currentUser.name}`,
          message: content,
          read: false,
          audience: 'internal',
          forUserId: pm?.id,
          timestamp: new Date().toISOString(),
          entityType: 'issue',
          entityId: targetThreadId
        },
        ...prev
      ]);
      return;
    }

    setIsAgentTyping(true);

    // Pick responder agent
    let responder = agents[0]; // Ada
    if (activeChatAgentId) {
      responder = agents.find(a => a.id === activeChatAgentId) || agents[0];
    } else if (content.toLowerCase().includes('@kaelen') || content.toLowerCase().includes('code') || content.toLowerCase().includes('bug')) {
      responder = agents[1]; // Kaelen
    } else if (content.toLowerCase().includes('@vesper') || content.toLowerCase().includes('security') || content.toLowerCase().includes('review')) {
      responder = agents[2]; // Vesper
    } else if (content.toLowerCase().includes('@nyx') || content.toLowerCase().includes('test')) {
      responder = agents[3]; // Nyx
    } else if (content.toLowerCase().includes('@cipher') || content.toLowerCase().includes('deploy')) {
      responder = agents[4]; // Cipher
    }

    // Streaming placeholder
    const streamingMsgId = `msg-${Date.now() + 1}`;
    const streamingMsg: ChatMessage = {
      id: streamingMsgId,
      senderType: 'agent',
      agentId: responder.id,
      senderName: responder.name,
      senderAvatar: responder.avatar,
      content: 'Thinking...',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      thinkingProcess: `Analyzing prompt intent using ${responder.modelName} on ${responder.modelProvider}...`
    };

    setChatThreads(prev => prev.map(t => {
      if (t.id !== targetThreadId) return t;
      const msgs = t.messages || [];
      return {
        ...t,
        messages: [...msgs, streamingMsg]
      };
    }));
    setChatMessages(prev => [...prev, streamingMsg]);

    try {
      // Call backend Chat Service (executes real Claude / Gemini CLI)
      const res = await apiService.sendChatMessage({
        threadId: targetThreadId,
        content,
        senderName: currentUser.name
      });

      const finalAgentMsg: ChatMessage = {
        id: res.agentMessage.id || streamingMsgId,
        senderType: 'agent',
        agentId: responder.id,
        senderName: responder.name,
        senderAvatar: responder.avatar,
        content: res.agentMessage.content,
        timestamp: res.agentMessage.timestamp || new Date().toISOString(),
        isStreaming: false,
        thinkingProcess: res.agentMessage.thinkingProcess || `Response generated via ${responder.modelName} on ${responder.modelProvider}.`,
        toolsExecuted: (res.agentMessage.toolsExecuted || []).map((t: any) => ({
          name: t.toolName || t.name || 'tool',
          input: typeof t.parameters === 'object' ? JSON.stringify(t.parameters) : String(t.parameters || '{}'),
          output: t.output || 'Execution completed',
          durationMs: t.durationMs || 120
        }))
      };

      setChatThreads(prev => prev.map(t => {
        if (t.id !== targetThreadId) return t;
        const msgs = t.messages || [];
        return {
          ...t,
          lastMessageSnippet: res.agentMessage.content.slice(0, 60) + '...',
          messages: msgs.map(m => m.id === streamingMsgId ? finalAgentMsg : m)
        };
      }));

      setChatMessages(prev => prev.map(m => m.id === streamingMsgId ? finalAgentMsg : m));
    } catch (err: any) {
      console.warn('Real AI chat service unavailable, falling back to local persona:', err);

      // Fallback response generator if backend offline
      let responseText = `[${responder.name} · ${responder.modelName}]: I have received your request regarding: "${content}". Backend connection established.`;
      
      const fallbackMsg: ChatMessage = {
        ...streamingMsg,
        content: responseText,
        isStreaming: false,
        thinkingProcess: `Generated response via ${responder.modelName}.`,
        toolsExecuted: []
      };

      setChatThreads(prev => prev.map(t => {
        if (t.id !== targetThreadId) return t;
        const msgs = t.messages || [];
        return {
          ...t,
          lastMessageSnippet: responseText.slice(0, 60) + '...',
          messages: msgs.map(m => m.id === streamingMsgId ? fallbackMsg : m)
        };
      }));

      setChatMessages(prev => prev.map(m => m.id === streamingMsgId ? fallbackMsg : m));
    } finally {
      setIsAgentTyping(false);
    }

    // Update analytics
    setAnalytics(prev => ({
      ...prev,
      totalTokens24h: prev.totalTokens24h + 480,
      totalCost24h: prev.totalCost24h + 0.004
    }));
  };

  const clearChat = () => {
    if (activeThreadId) {
      setChatThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, messages: [], lastMessageSnippet: '' } : t));
    }
    setChatMessages([]);
  };

  // Settings
  const updateSettings = (updates: Partial<WorkspaceSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  /* ---------------------------------------------------------------------
   * Identity & access
   * ------------------------------------------------------------------ */

  const currentUser = users.find(u => u.role === role) || users[0];
  const visibleTabs = roleTabs;
  const can = (capability: Capability) => ROLE_CAPABILITIES[role].includes(capability);

  const switchRole = (next: UserRole) => {
    setRole(next);
    // Reset the workspace to a landing surface that role is actually allowed on,
    // so no tab from the previous role survives the switch.
    const resetTab: TabItem = { id: `tab-${Date.now()}`, view: ROLE_TABS[next][0] };
    setTabs([resetTab]);
    setActiveTabId(resetTab.id);
  };

  /* ---------------------------------------------------------------------
   * Requirement documents
   *
   * Compilation is a deterministic template-fill for now, standing in for the
   * architect agent. Shape first, model later.
   * ------------------------------------------------------------------ */

  const inferBand = (capability: string): 'S' | 'M' | 'L' | 'XL' => {
    const text = capability.toLowerCase();
    if (/payment|deposit|booking|book one|real-?time|sync|availability|schedul/.test(text)) return 'L';
    if (/reminder|reschedul|cancel|dashboard|view of|console|report|search|history of/.test(text)) return 'M';
    if (/show|display|list|record|block|email|link/.test(text)) return 'S';
    return 'M';
  };

  const formaliseRequirement = (capability: string): string => {
    const trimmed = capability.trim().replace(/^let\s+/i, '').replace(/^(give|send|show|keep)\s+/i, '$1 ');
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + '.';
  };

  const draftCriteria = (capability: string): string[] => {
    const base = capability.toLowerCase();
    const criteria = [`${capability.charAt(0).toUpperCase() + capability.slice(1)} works end to end.`];
    if (/payment|deposit/.test(base)) criteria.push('A failed payment never consumes the reserved slot.');
    if (/reminder|email|text|sms/.test(base)) criteria.push('Delivery failures retry before staff are alerted.');
    if (/book|schedul|availab/.test(base)) criteria.push('Two concurrent attempts on the same slot cannot both succeed.');
    criteria.push('Behaviour is verified on a 360px viewport.');
    return criteria;
  };

  const submitIntake = (answers: IntakeAnswers): RequirementDoc => {
    const seq = 1043 + requirementDocs.filter(d => d.track === 'project').length - 2;
    const identifier = `SPEC-${seq}`;

    const doc: RequirementDoc = {
      id: `doc-${Date.now()}`,
      identifier,
      title: answers.title || 'Untitled request',
      track: 'project',
      status: 'in_review',
      version: 1,
      clientId: currentUser.id,
      clientName: currentUser.name,
      company: currentUser.company,
      answers,
      problemStatement: answers.problem,
      goals: [answers.definitionOfDone, answers.successMeasure].filter(Boolean),
      functionalRequirements: answers.capabilities
        .filter(c => c.trim())
        .map((capability, i) => ({
          id: `fr-${Date.now()}-${i}`,
          clientWording: capability,
          requirement: formaliseRequirement(capability),
          band: inferBand(capability),
          acceptanceCriteria: draftCriteria(capability),
          included: true
        })),
      nonFunctionalRequirements: answers.concerns.filter(Boolean),
      constraints: [
        answers.targetDate ? `Target launch ${answers.targetDate}` : '',
        answers.budgetCeiling ? `Client budget ceiling stated as $${answers.budgetCeiling.toLocaleString()}` : '',
        answers.integrations ? `Integrations: ${answers.integrations}` : ''
      ].filter(Boolean),
      outOfScope: answers.outOfScope ? [answers.outOfScope] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setRequirementDocs(prev => [doc, ...prev]);

    // The estimate is generated immediately so the PM has something to adjust.
    const estimate = buildEstimate(doc, agents, analytics, DEFAULT_RATE_CARD, undefined, issues);
    setEstimates(prev => [estimate, ...prev]);
    setRequirementDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, estimateId: estimate.id } : d)));

    setInbox(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'issue_assigned',
        title: `New request from ${doc.company || doc.clientName}`,
        message: `${identifier} — "${doc.title}". ${doc.functionalRequirements.length} requirements compiled and priced. Awaiting PM review.`,
        read: false,
        audience: 'internal',
        timestamp: new Date().toISOString(),
        entityType: 'issue',
        entityId: doc.id,
        meta: { issueIdentifier: identifier }
      },
      ...prev
    ]);

    return { ...doc, estimateId: estimate.id };
  };

  const updateRequirementDoc = (id: string, updates: Partial<RequirementDoc>) => {
    setRequirementDocs(prev =>
      prev.map(d => (d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d))
    );
  };

  // Reads the scoped list, so a role that may not see pricing gets nothing here.
  const estimateForDoc = (docId: string) =>
    scopedEstimates.find(e => e.docId === docId && e.status !== 'superseded');

  const regenerateEstimate = (docId: string, rateCard?: RateCard): Estimate | undefined => {
    const doc = requirementDocs.find(d => d.id === docId);
    if (!doc) return undefined;

    const previous = estimates.find(e => e.docId === docId && e.status !== 'superseded');
    const next = buildEstimate(
      doc,
      agents,
      analytics,
      rateCard ?? previous?.rateCard ?? DEFAULT_RATE_CARD,
      previous,
      issues
    );

    setEstimates(prev => [next, ...prev.filter(e => e.id !== next.id)]);
    updateRequirementDoc(docId, { estimateId: next.id });
    return next;
  };

  /** Dropping a requirement at the gate re-prices the whole estimate. */
  const toggleRequirementIncluded = (docId: string, reqId: string) => {
    const doc = requirementDocs.find(d => d.id === docId);
    if (!doc) return;

    const nextDoc: RequirementDoc = {
      ...doc,
      functionalRequirements: doc.functionalRequirements.map(r =>
        r.id === reqId ? { ...r, included: !r.included } : r
      ),
      updatedAt: new Date().toISOString()
    };

    setRequirementDocs(prev => prev.map(d => (d.id === docId ? nextDoc : d)));

    const previous = estimates.find(e => e.docId === docId && e.status !== 'superseded');
    const next = buildEstimate(
      nextDoc,
      agents,
      analytics,
      previous?.rateCard ?? DEFAULT_RATE_CARD,
      previous,
      issues
    );
    setEstimates(prev => [next, ...prev.filter(e => e.id !== next.id)]);
  };

  const sendDocToClient = (docId: string) => {
    updateRequirementDoc(docId, { status: 'awaiting_client' });
    setEstimates(prev => prev.map(e => (e.docId === docId ? { ...e, status: 'awaiting_client' } : e)));

    const doc = requirementDocs.find(d => d.id === docId);
    setInbox(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'agent_approval',
        title: `Scope and budget ready for your approval`,
        message: `${doc?.identifier} — "${doc?.title}" is ready for review. Nothing is built until you approve.`,
        read: false,
        audience: 'client',
        clientId: doc?.clientId,
        timestamp: new Date().toISOString(),
        entityType: 'issue',
        entityId: docId,
        approvalStatus: 'pending',
        meta: { issueIdentifier: doc?.identifier }
      },
      ...prev
    ]);
  };

  /* ---------------------------------------------------------------------
   * The gate: approving scope and budget converts the spec into a project
   * ------------------------------------------------------------------ */

  const approveScopeAndBudget = (docId: string): Project | undefined => {
    const doc = requirementDocs.find(d => d.id === docId);
    const estimate = estimates.find(e => e.docId === docId && e.status !== 'superseded');
    if (!doc || !estimate) return undefined;

    const included = doc.functionalRequirements.filter(r => r.included);
    const now = new Date().toISOString();
    const key = (doc.company || doc.title).slice(0, 3).toUpperCase();

    const milestones: Milestone[] = doc.goals.slice(0, 3).map((goal, i) => ({
      id: `m-${Date.now()}-${i}`,
      title: goal.length > 60 ? goal.slice(0, 57) + '…' : goal,
      targetDate: doc.answers.targetDate,
      completed: false
    }));

    const project: Project = {
      id: `proj-${Date.now()}`,
      name: doc.title,
      key,
      description: doc.problemStatement,
      color: '#6366f1',
      icon: '📁',
      status: 'planned',
      priority: doc.answers.urgency === 'none' ? 'medium' : doc.answers.urgency,
      startDate: now.slice(0, 10),
      targetDate: doc.answers.targetDate,
      leadType: 'member',
      leadName: users.find(u => u.role === 'pm')?.name,
      resources: [],
      totalIssues: included.length,
      completedIssues: 0,
      progressPercentage: 0,
      milestones,
      createdAt: now
    };

    // Requirements become issues; acceptance criteria become subtasks;
    // non-functional requirements become labels.
    const labels = doc.nonFunctionalRequirements
      .map(nfr => nfr.toLowerCase().split(/[\s,;]+/)[0].replace(/[^a-z]/g, ''))
      .filter(Boolean)
      .slice(0, 3);

    const newIssues: Issue[] = included.map((req, i) => ({
      id: `iss-${Date.now()}-${i}`,
      identifier: `${key}-${101 + i}`,
      title: req.clientWording,
      description: `${req.requirement}\n\nFrom ${doc.identifier} (approved rev ${estimate.revision}). Complexity band ${req.band}.`,
      status: 'backlog',
      priority: doc.answers.urgency === 'none' ? 'medium' : doc.answers.urgency,
      projectId: project.id,
      labels: [...labels, `band-${req.band.toLowerCase()}`],
      subtasks: req.acceptanceCriteria.map((c, ci) => ({
        id: `sub-${Date.now()}-${i}-${ci}`,
        title: c,
        completed: false
      })),
      comments: [
        {
          id: `comm-${Date.now()}-${i}`,
          authorType: 'system',
          authorName: 'System',
          content: `Created from approved specification ${doc.identifier}. Acceptance criteria were fixed at approval and are not editable without a new client sign-off.`,
          createdAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    }));

    setProjects(prev => [project, ...prev]);
    setIssues(prev => [...newIssues, ...prev]);

    setRequirementDocs(prev =>
      prev.map(d =>
        d.id === docId
          ? { ...d, status: 'approved', projectId: project.id, approvedBy: currentUser.name, approvedAt: now, updatedAt: now }
          : d
      )
    );
    setEstimates(prev =>
      prev.map(e =>
        e.id === estimate.id ? { ...e, status: 'approved', approvedBy: currentUser.name, approvedAt: now } : e
      )
    );

    // Open a budget ledger so drift is trackable from day one.
    setLedgers(prev => [
      {
        projectId: project.id,
        estimateId: estimate.id,
        baseline: estimate.buildTotal,
        actualToDate: 0,
        projectedFinal: estimate.buildTotal,
        entries: []
      },
      ...prev
    ]);

    setInbox(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'agent_completed',
        title: `${doc.identifier} approved — project created`,
        message: `${doc.clientName} approved scope and budget. ${newIssues.length} issues created in ${project.name} against a $${estimate.buildTotal.toLocaleString()} baseline.`,
        read: false,
        audience: 'internal',
        timestamp: now,
        entityType: 'issue',
        entityId: project.id,
        meta: { issueIdentifier: doc.identifier }
      },
      ...prev
    ]);

    return project;
  };

  const rejectEstimate = (docId: string, reason: string) => {
    updateRequirementDoc(docId, { status: 'in_review' });
    setEstimates(prev => prev.map(e => (e.docId === docId ? { ...e, status: 'rejected' } : e)));

    const doc = requirementDocs.find(d => d.id === docId);
    setInbox(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'agent_failed',
        title: `Changes requested on ${doc?.identifier}`,
        message: reason || 'The client requested changes before approving.',
        read: false,
        audience: 'internal',
        timestamp: new Date().toISOString(),
        entityType: 'issue',
        entityId: docId,
        meta: { issueIdentifier: doc?.identifier }
      },
      ...prev
    ]);
  };

  const ledgerForProject = (projectId: string) => scopedLedgers.find(l => l.projectId === projectId);

  /* =====================================================================
   * Scoping layer
   *
   * Navigation gating alone is not access control: a hidden tab still leaves
   * the data reachable through search, a persisted tab, or a sibling view.
   * Everything below narrows each collection to what the current role is
   * entitled to, and these are the values the provider publishes.
   * ================================================================== */

  /** Projects this role may know exist at all. */
  const scopedProjects = useMemo(() => {
    if (role === 'admin') return projects;
    if (role === 'client') {
      const mine = requirementDocs
        .filter(d => d.clientId === currentUser.id && d.projectId)
        .map(d => d.projectId);
      return projects.filter(p => mine.includes(p.id));
    }
    // PM and dev are scoped to their assignment list.
    //
    // That list lives in mock user data (`proj-1`…`proj-4`), so once projects
    // come from the daemon their real ids match nothing and the board renders
    // empty even though the API returned rows. Until membership is a real
    // table, an empty assignment list means "not scoped" rather than "nothing".
    const assigned = currentUser.projectIds ?? [];
    if (assigned.length === 0) return projects;

    const scoped = projects.filter(p => assigned.includes(p.id));
    return scoped.length > 0 ? scoped : projects;
  }, [projects, requirementDocs, role, currentUser]);

  const scopedProjectIds = useMemo(() => scopedProjects.map(p => p.id), [scopedProjects]);

  /** A client never sees issues at all; a dev sees only what is theirs. */
  const scopedIssues = useMemo(() => {
    if (role === 'admin') return issues;
    if (role === 'client') return [];
    const inScope = issues.filter(i => scopedProjectIds.includes(i.projectId));
    if (role === 'pm') return inScope;
    return inScope.filter(
      i => i.assignedHuman === currentUser.name || !i.assignedHuman
    );
  }, [issues, scopedProjectIds, role, currentUser]);

  /** Specifications: a client sees only their own; staff see their projects'. */
  const scopedDocs = useMemo(() => {
    if (role === 'admin') return requirementDocs;
    if (role === 'client') return requirementDocs.filter(d => d.clientId === currentUser.id);
    return requirementDocs.filter(d => !d.projectId || scopedProjectIds.includes(d.projectId));
  }, [requirementDocs, scopedProjectIds, role, currentUser]);

  const scopedDocIds = useMemo(() => scopedDocs.map(d => d.id), [scopedDocs]);

  /** Pricing follows the specification it belongs to. Devs see no pricing. */
  const scopedEstimates = useMemo(() => {
    if (role === 'admin') return estimates;
    if (role === 'dev') return [];
    return estimates.filter(e => scopedDocIds.includes(e.docId));
  }, [estimates, scopedDocIds, role]);

  const scopedLedgers = useMemo(() => {
    if (role === 'admin') return ledgers;
    if (role === 'dev') return [];
    return ledgers.filter(l => scopedProjectIds.includes(l.projectId));
  }, [ledgers, scopedProjectIds, role]);

  /** Agents are invisible to clients and narrowed to ownership for devs. */
  const scopedAgents = useMemo(() => {
    if (role === 'client') return [];
    if (role === 'dev') return agents.filter(a => a.isMine || a.allowedUsers === 'everyone');
    return agents;
  }, [agents, role]);

  const scopedSquads = useMemo(() => (role === 'client' ? [] : squads), [squads, role]);

  const scopedDeployments = useMemo(() => {
    if (role === 'admin') return deployments;
    if (role === 'client') return [];
    return deployments.filter(d => scopedProjectIds.includes(d.projectId));
  }, [deployments, scopedProjectIds, role]);

  /**
   * Notifications carry an explicit audience. Anything unlabelled is treated
   * as internal, so a new notification added later fails closed rather than
   * leaking to a client.
   */
  const scopedInbox = useMemo(() => {
    if (role === 'client') {
      return inbox.filter(
        n => n.audience === 'client' && (!n.clientId || n.clientId === currentUser.id)
      );
    }
    const internal = inbox.filter(n => n.audience !== 'client');
    if (role === 'admin' || role === 'pm') return internal;
    return internal.filter(n => !n.forUserId || n.forUserId === currentUser.id);
  }, [inbox, role, currentUser]);

  /** Clients talk to their project manager; staff talk to agents. */
  const scopedChatThreads = useMemo(() => {
    if (role === 'client') {
      return chatThreads.filter(
        t => t.audience === 'client' && (!t.clientId || t.clientId === currentUser.id)
      );
    }
    return chatThreads.filter(t => t.audience !== 'client');
  }, [chatThreads, role, currentUser]);

  /**
   * Analytics is the same telemetry rendered at three altitudes. A client is
   * given no token or latency figures at all — their money view is the budget
   * ledger, which speaks in dollars.
   */
  const scopedAnalytics = useMemo<AnalyticsData>(() => {
    if (role === 'admin' || role === 'pm') return analytics;
    if (role === 'client') {
      return { ...analytics, agentBreakdown: [], modelBreakdown: [], tokenTimeline: [] };
    }
    // A dev sees their own agents' consumption, not the workspace's spend.
    const mine = scopedAgents.map(a => a.id);
    return {
      ...analytics,
      totalCost24h: 0,
      agentBreakdown: analytics.agentBreakdown.filter(b => mine.includes(b.agentId)),
      modelBreakdown: []
    };
  }, [analytics, role, scopedAgents]);

  /** Secrets are admin-only. Everyone else gets the shape with nothing in it. */
  const scopedSettings = useMemo<WorkspaceSettings>(() => {
    if (role === 'admin') return settings;
    return {
      ...settings,
      apiKeys: { openai: '', anthropic: '', gemini: '', groq: '', huggingface: '' }
    };
  }, [settings, role]);

  const unreadInboxCountScoped = scopedInbox.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      serverStatus,
      activeTab,
      setActiveTab,
      tabs,
      activeTabId,
      setActiveTabId,
      openNewTab,
      closeTab,
      commandPaletteOpen,
      setCommandPaletteOpen,
      issues: scopedIssues,
      createIssue,
      updateIssueStatus,
      updateIssue,
      deleteIssue,
      runAgentOnIssue,
      prototypeRuns,
      runSetupIssueId,
      runSetupAgentId,
      closeRunSetup,
      startPrototypeRun,
      cancelPrototypeRun,
      retryPrototypeRun,
      projects: scopedProjects,
      createProject,
      updateProject,
      deleteProject,
      agents: scopedAgents,
      createAgent,
    importAgent,
      updateAgent,
      duplicateAgent,
      archiveAgent,
      restoreAgent,
      deleteAgent,
      bulkUpdateAgents,
      bulkArchiveAgents,
      squads: scopedSquads,
      createSquad,
      triggerSquadRun,
      runtimes,
      isScanningRuntimes,
      scanLocalRuntimes,
      setDefaultRuntime,
      skills,
      toggleSkill,
      deployments: scopedDeployments,
      triggerDeployment,
      inbox: scopedInbox,
      unreadInboxCount: unreadInboxCountScoped,
      markNotificationRead,
      markAllNotificationsRead,
      archiveNotification,
      handleApproval,
      analytics: scopedAnalytics,
      chatThreads: scopedChatThreads,
      activeThreadId,
      setActiveThreadId,
      createNewThread,
      deleteThread,
      chatMessages,
      isAgentTyping,
      activeChatAgentId,
      setActiveChatAgentId,
      activeChatSquadId,
      setActiveChatSquadId,
      sendChatMessage,
      clearChat,
      settings: scopedSettings,
      updateSettings,
      toasts,
      showToast,
      dismissToast,
      currentUser,
      users,
      role,
      switchRole,
      can,
      visibleTabs,
      requirementDocs: scopedDocs,
      submitIntake,
      updateRequirementDoc,
      toggleRequirementIncluded,
      sendDocToClient,
      estimates: scopedEstimates,
      estimateForDoc,
      regenerateEstimate,
      approveScopeAndBudget,
      rejectEstimate,
      ledgers: scopedLedgers,
      ledgerForProject
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
