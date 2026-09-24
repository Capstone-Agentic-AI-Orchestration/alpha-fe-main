import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ROLE_NAV } from '@/config/navigation';
import {
  NavigationTab,
  TabItem,
  Issue,
  IssueComment,
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
  RunActivity,
  ToastMessage,
  User,
  UserRole,
  SquadRun,
  RequirementDoc,
  IntakeAnswers,
  Milestone,
  Identity,
  IdentityStatus,
  WorkspaceSummary
} from '@/shared/types';
import {
  defaultSettings,
  emptyAnalytics,
  isLegacyDemoAnalytics,
  migrateLegacyMockStorage,
  normalizeInboxNotifications,
  normalizeLegacyAgents,
  normalizeLegacyDeployments,
  normalizeLegacyIssues,
  normalizeLegacyPrototypeRuns,
  normalizeRequirementDocs,
  normalizeSettings
} from '@/data/defaults';
import { apiService, normalizeGitHubRepo, normalizeSkill, setActiveWorkspaceId } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import { fetchServerSnapshot, persist, describeWriteError, ServerStatus } from '@/shared/services/serverSync';
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage';
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase';
import { isDesktop } from '@/shared/desktop';

function normalizeAnalytics(value: unknown, fallback: AnalyticsData = emptyAnalytics): AnalyticsData {
  if (isLegacyDemoAnalytics(value)) return fallback;
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const legacyTimeline = Array.isArray(raw.tokenTimeline) ? raw.tokenTimeline : [];
  const timeline = Array.isArray(raw.runTimeline)
    ? raw.runTimeline.map(item => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          hour: String(row.hour ?? '—'),
          runs: Number(row.runs ?? 0),
          completed: Number(row.completed ?? row.runs ?? 0),
          failed: Number(row.failed ?? 0)
        };
      })
    : legacyTimeline.map(item => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return { hour: String(row.hour ?? '—'), runs: 0, completed: 0, failed: 0 };
      });
  const agentBreakdown = Array.isArray(raw.agentBreakdown)
    ? raw.agentBreakdown.map(item => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          agentId: String(row.agentId ?? ''),
          agentName: String(row.agentName ?? row.agentId ?? 'Unknown agent'),
          runs: Number(row.runs ?? 0),
          efficiency: Number(row.efficiency ?? 0)
        };
      })
    : fallback.agentBreakdown;
  const modelBreakdown = Array.isArray(raw.modelBreakdown)
    ? raw.modelBreakdown.map(item => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          modelName: String(row.modelName ?? 'Unknown model'),
          percentage: Number(row.percentage ?? 0),
          totalCalls: Number(row.totalCalls ?? 0)
        };
      })
    : fallback.modelBreakdown;
  return {
    totalRuns24h: Number(raw.totalRuns24h ?? raw.totalAgentRuns ?? fallback.totalRuns24h),
    avgLatencyMs: Number(raw.avgLatencyMs ?? fallback.avgLatencyMs),
    totalAgentRuns: Number(raw.totalAgentRuns ?? fallback.totalAgentRuns),
    successRate: Number(raw.successRate ?? fallback.successRate),
    runTimeline: timeline,
    agentBreakdown,
    modelBreakdown
  };
}

export interface RunPlanDraft {
  agentId: string;
  plan: string[];
  updatedAt: string;
}

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
  createIssue: (issue: Omit<Issue, 'id' | 'identifier' | 'createdAt' | 'updatedAt' | 'comments' | 'subtasks'> & { subtasks?: string[] }) => Issue | null;
  updateIssueStatus: (id: string, status: IssueStatus) => void;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  addIssueComment: (issueId: string, comment: IssueComment) => void;
  deleteIssue: (id: string) => void;
  runAgentOnIssue: (issueId: string, agentId?: string) => void;
  prototypeRuns: PrototypeRun[];
  runSetupIssueId: string | null;
  runSetupAgentId: string | null;
  runPlanDrafts: Record<string, RunPlanDraft>;
  saveRunPlanDraft: (issueId: string, agentId: string, plan: string[]) => void;
  clearRunPlanDraft: (issueId: string) => void;
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
  createAgent: (agent: Omit<Agent, 'id' | 'stats' | 'status'>) => Agent | null;
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
  createSquad: (squad: Omit<Squad, 'id' | 'activeRunsCount' | 'completedRunsCount'>) => Squad | null;
  updateSquad: (id: string, updates: Partial<Squad>) => void;
  deleteSquad: (id: string) => void;
  squadRuns: SquadRun[];
  /**
   * A squad works on an issue. `issueId` is required because there is no
   * longer a way to run a squad against nothing — that was the old timer.
   */
  triggerSquadRun: (squadId: string, issueId: string, plan?: string[], missionGoal?: string) => Promise<void>;
  
  // Runtimes
  runtimes: RuntimeEngine[];
  isScanningRuntimes: boolean;
  scanLocalRuntimes: () => Promise<void>;
  setDefaultRuntime: (id: string) => void;
  
  // Skills
  skills: Skill[];
  toggleSkill: (id: string) => void;
  isScanningSkills: boolean;
  scanInstalledSkills: () => Promise<void>;
  
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
  createNewThread: (title?: string, projectId?: string) => string;
  setThreadProject: (threadId: string, projectId: string | null) => Promise<ChatThread & {
    workspaceDir: string | null;
    workspaceManaged: boolean | null;
  }>;
  refreshChatThread: (threadId: string) => Promise<ChatMessage[]>;
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
  /**
   * Who the daemon says you are. Undefined until it answers, and `source`
   * distinguishes a GitHub login from a bare OS username.
   */
  identity?: Identity;
  /**
   * Whether `/me` has answered. `'unreachable'` means it has not answered at
   * all, which is different from answering "signed out" -- the web build must
   * not guess a role from silence. See App.tsx.
   */
  identityStatus: IdentityStatus;
  /** True when the user chose to keep using Alpha without GitHub. */
  localMode: boolean;
  /** Leave the GitHub setup gate and use the local board. */
  continueInLocalMode: () => void;
  /** Re-resolve identity, for after someone is added to a team. */
  refreshIdentity: () => Promise<void>;
  /** Pull the board from GitHub now. */
  syncBoard: () => Promise<void>;
  /** When the last successful sync finished, or null if none has. */
  lastSyncedAt: string | null;
  syncing: boolean;
  users: User[];
  /** The signed-in user's role in the active workspace, as the server says. */
  role: UserRole;
  can: (capability: Capability) => boolean;
  visibleTabs: NavigationTab[];

  // Product workspace context
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceSummary | null;
  workspaceLoading: boolean;
  workspaceSwitching: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string, members?: Array<{ userId: string; role: UserRole }>) => Promise<WorkspaceSummary | null>;
  refreshWorkspaces: () => Promise<void>;
  refreshLiveBuildRoomProjects: () => Promise<void>;

  // Requirement documents
  requirementDocs: RequirementDoc[];
  submitIntake: (answers: IntakeAnswers) => RequirementDoc | null;
  updateRequirementDoc: (id: string, updates: Partial<RequirementDoc>) => void;
  toggleRequirementIncluded: (docId: string, reqId: string) => void;
  sendDocToClient: (docId: string) => void;
  approveScope: (docId: string) => Project | undefined;
  requestScopeChanges: (docId: string, reason: string) => void;

}

/* Capability names are behavioural, not tab names, so a surface can be shared
 * by two roles while the actions on it differ. */
export type Capability =
  | 'view_identity'
  | 'view_projects'
  | 'manage_projects'
  | 'view_issues'
  | 'manage_issues'
  | 'view_agents'
  | 'manage_agents'
  | 'view_squads'
  | 'manage_squads'
  | 'run_squads'
  | 'view_skills'
  | 'manage_skills'
  | 'view_runtimes'
  | 'manage_runtimes'
  | 'view_runs'
  | 'approve_runs'
  | 'manage_chat'
  | 'view_integrations'
  | 'manage_integrations'
  | 'manage_mcp'
  | 'sync_board'
  | 'manage_settings'
  | 'manage_deployments'
  | 'create_project'
  | 'manage_documents'
  | 'approve_scope'
  | 'approve_production'
  | 'run_agents'
  | 'contact_client'
  | 'submit_intake'
  | 'bind_workspace'
  | 'view_members'
  | 'manage_members';

const KNOWN_ROLES: UserRole[] = ['client', 'dev', 'pm', 'admin'];

const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  client: ['view_identity', 'view_projects', 'manage_chat', 'approve_scope', 'submit_intake'],
  dev: [
    'view_identity',
    'view_projects',
    'view_issues',
    'manage_issues',
    'view_agents',
    'run_agents',
    'view_squads',
    'run_squads',
    'view_skills',
    'view_runtimes',
    'manage_runtimes',
    'view_runs',
    'manage_chat',
    'view_integrations',
    'sync_board',
    // Developers may see the real workspace roster, but cannot edit it.
    'view_members',
    // A developer points Alpha at their own checkout; it is their disk.
    'bind_workspace'
  ],
  pm: [
    'view_identity',
    'view_projects',
    'manage_projects',
    'view_issues',
    'manage_issues',
    'view_agents',
    'view_squads',
    'view_skills',
    'manage_skills',
    'view_runtimes',
    'manage_runtimes',
    'view_runs',
    'approve_runs',
    'manage_chat',
    'manage_documents',
    'view_integrations',
    'manage_integrations',
    'manage_deployments',
    'manage_mcp',
    'sync_board',
    'manage_settings',
    'create_project',
    'approve_production',
    'contact_client',
    'bind_workspace',
    'view_members',
    /*
     * A project manager staffs their own workspace. Granting `admin` is still
     * an admin's to do, and the server refuses it for anyone else.
     */
    'manage_members'
  ],
  admin: [
    'view_identity',
    'view_projects',
    'manage_projects',
    'view_issues',
    'manage_issues',
    'view_agents',
    'manage_agents',
    'view_squads',
    'manage_squads',
    'run_squads',
    'view_skills',
    'manage_skills',
    'view_runtimes',
    'manage_runtimes',
    'view_runs',
    'approve_runs',
    'manage_chat',
    'manage_documents',
    'approve_scope',
    'view_integrations',
    'manage_integrations',
    'manage_mcp',
    'sync_board',
    'manage_settings',
    'manage_deployments',
    'create_project',
    'approve_production',
    'run_agents',
    'contact_client',
    'view_members',
    'manage_members',
    'bind_workspace'
  ]
};

/**
 * Which destinations each role may reach.
 *
 * Was a literal here, a second table in Sidebar.tsx, and two switch statements
 * in App.tsx — four copies that had already diverged. Now one table in
 * config/navigation, and this is the alias the rest of the store still reads.
 */
const ROLE_TABS = ROLE_NAV;

const AppContext = createContext<AppContextType | undefined>(undefined);

type WorkspaceMemberRecord = {
  id: string;
  userId: string;
  role: UserRole;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This runs before any cache-backed state initializer below. The migration
  // only recognizes records from Alpha's retired demo dataset.
  migrateLegacyMockStorage();

  // Role is resolved before any tab state, because what a tab is allowed to be
  // depends on it.
  /**
   * Resolved once from the daemon, which reads it from `gh`.
   *
   * Not persisted: signing in or out on the machine changes the answer, and a
   * stale login attributing issues to the wrong person is worse than a moment
   * without one.
  */
  const [identity, setIdentity] = useState<Identity | undefined>(undefined);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>('loading');
  /**
   * GitHub is optional for solo use. Persist the choice so a reload does not
   * put a user back in the setup gate before they can reach Settings.
   */
  const [localMode, setLocalMode] = useState<boolean>(() =>
    loadFromStorage<boolean>('local_mode', false)
  );

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() =>
    loadFromStorage<string | null>('active_workspace_id', null)
  );
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberRecord[]>([]);
  /** Project ids for which the current role has an owned/assigned squad room. */
  const [liveBuildRoomProjectIds, setLiveBuildRoomProjectIds] = useState<string[]>([]);

  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null;
  /**
   * Normalised here, not at each lookup.
   *
   * The daemon has its own role vocabulary and has served 'owner', which is no
   * key in ROLE_TABS, ROLE_CAPABILITIES or ROLE_SECTION_ORDER. Reading an
   * unknown key straight through returned undefined and crashed the first
   * component to index one, so an unrecognised role is funnelled into the same
   * 'pm' fallback an absent one already used.
   */
  const rawRole = activeWorkspace?.role ?? identity?.role;
  const role: UserRole = KNOWN_ROLES.includes(rawRole as UserRole) ? (rawRole as UserRole) : 'pm';
  const roleTabs = ROLE_TABS[role];

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  /** Guards against overlapping syncs without waiting for a re-render. */
  const syncingRef = useRef(false);
  /** A sync was asked for while one ran; run it again when that one ends. */
  const resyncRef = useRef(false);
  /** Sync warnings already shown this session. */
  const reportedSyncErrorsRef = useRef(new Set<string>());
  const syncBoardRef = useRef<() => Promise<void>>(async () => {});

  /**
   * Pull the board from GitHub.
   *
   * One at a time: the poll and the button share this, and two overlapping
   * pulls race to write the same cards — the second to finish leaves the board
  * holding the older answer.
  */
  const syncBoard = useCallback(async () => {
    // Local mode deliberately keeps the board on this machine. Avoid calling
    // the GitHub-backed sync endpoint (and surfacing an avoidable ENOENT toast)
    // until the user connects an account.
    if (localMode || !ROLE_CAPABILITIES[role].includes('sync_board')) return;
    // A change announced mid-sync is not lost: it runs once more afterwards.
    if (syncingRef.current) {
      resyncRef.current = true;
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      const report = await apiService.syncBoard();
      // Re-read rather than patching from the report: the daemon already
      // assembled the board consistently, and rebuilding it from a summary is
      // how the two versions drift apart.
      // Projects too when the sync made any: a repository new to the
      // organisation becomes a project, and its cards would otherwise sit
      // under a project the sidebar does not know about until a reload.
      const imported = report.projectsImported ?? 0;
      // Any project change, not only imports: a project a manager created or
      // renamed on the team's board reaches a desktop through this pull.
      const projectsMoved = imported > 0 || (report.projects ?? 0) > 0;
      const [fresh, freshProjects] = await Promise.all([
        apiService.getIssues(),
        projectsMoved ? apiService.getProjects() : Promise.resolve(null)
      ]);
      if (freshProjects?.length) setProjects(freshProjects);
      if (fresh?.length) setIssues(fresh as any);
      setLastSyncedAt(new Date().toISOString());

      if (imported > 0) {
        showToast(
          'Repositories added',
          `${imported} ${imported === 1 ? 'repository is' : 'repositories are'} now on the board as projects.`,
          'success'
        );
      }
      if (report.created + report.updated > 0) {
        showToast('Board synced', `${report.created} new, ${report.updated} updated from GitHub.`, 'success');
      }
      // A workspace where one repository is unreachable still synced the
      // others, so failures are named rather than failing the whole run.
      for (const e of report.errors ?? []) {
        // Once per session: the board syncs every minute, and a warning that
        // needs someone to act on it does not get more useful by repeating.
        const seen = `${e.project}
${e.detail}`;
        if (reportedSyncErrorsRef.current.has(seen)) continue;
        reportedSyncErrorsRef.current.add(seen);
        showToast(`${e.project} did not sync`, e.detail, 'error');
      }
    } catch (err) {
      showToast('Sync failed', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      if (resyncRef.current) {
        resyncRef.current = false;
        void syncBoardRef.current();
      }
    }
  }, [localMode, role]);
  syncBoardRef.current = syncBoard;

  /**
   * The board, as it moves.
   *
   * Everyone used to find out when they next asked: this app re-syncs when it
   * regains focus, a desktop when someone presses Sync. So a project manager
   * watching a developer's run saw the card move some time after it moved, and
   * two people editing the same board spent that interval looking at different
   * truths.
   *
   * The database announces each write on the workspace's own channel (`0012`),
   * and this re-reads what changed. The message is a nudge, not the board: it
   * says a write happened and which table, and the answer comes from the API,
   * which applies the same permissions as everywhere else. Acting on the
   * payload would be trusting a row this person may not be allowed to see.
   *
   * Private, like every channel here: Realtime admits only a token whose
   * workspace matches the channel's.
   */
  useEffect(() => {
    if (localMode || !activeWorkspaceId || !isSupabaseConfigured() || !supabase) return;

    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const changed = new Set<string>();

    const reread = () => {
      pending = null;
      const tables = new Set(changed);
      changed.clear();
      /*
       * On a desktop the API answers from this machine's copy of the board,
       * which the write has not reached yet -- re-reading it showed the
       * project or card that was just created as missing. Pull it from the
       * team's board first; the sync re-reads issues and projects after.
       */
      if (isDesktop) {
        void syncBoardRef.current();
        return;
      }
      if (tables.has('issues')) {
        void apiService.getIssues().then(rows => {
          if (!cancelled && rows) setIssues(rows as any);
        }).catch(() => {
          // A failed re-read leaves what is on screen; the next message or the
          // next focus will try again.
        });
      }
      if (tables.has('projects')) {
        void apiService.getProjects().then(rows => {
          if (!cancelled && rows) setProjects(rows);
        }).catch(() => {});
      }
    };

    /** A burst of writes -- a sync, a run finishing -- is one re-read. */
    const onBoardWrite = ({ payload }: { payload: any }) => {
      changed.add(String(payload?.table ?? 'issues'));
      if (pending) clearTimeout(pending);
      pending = setTimeout(reread, 400);
    };

    const channel = supabase
      .channel(`workspace:${activeWorkspaceId}:board`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, onBoardWrite)
      .on('broadcast', { event: 'UPDATE' }, onBoardWrite)
      .on('broadcast', { event: 'DELETE' }, onBoardWrite)
      .subscribe();

    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
      void supabase?.removeChannel(channel);
    };
  }, [activeWorkspaceId, localMode]);

  /**
    * The role you chose, which is an override rather than the answer.
    *
    * GitHub knows the answer — team membership in the workspace org — so this
    * is only consulted when someone has deliberately switched. Kept because a
    * capstone has to demonstrate four personas from one laptop, and the person
    * demonstrating them is in exactly one team.
    */
  /**
   * What you actually are: GitHub first, your override only if you set one.
   *
   * `pm` remains the fallback for the case where nothing knows — no GitHub
   * sign-in, or a workspace whose teams are named something the daemon does not
   * recognise. It is the role that can see the most, so an unknown user gets a
   * usable app rather than an empty one; the daemon still refuses anything they
   * are not entitled to, and GitHub refuses it again after that.
   */
  /**
   * What you actually are: GitHub first, your override only if you set one.
   *
   * The `pm` fallback is for the cases where nothing can know yet — identity
   * still resolving, no GitHub sign-in, no workspace organisation. It is not a
   * decision, and it no longer covers the case where GitHub *did* answer and
   * the answer was nobody: that is `access === 'no_team'`, and the shell shows
   * an explanation instead of a workspace. Falling through to `pm` there gave
   * an unrecognised member the most powerful role in the product.
   */
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
  const [issues, setIssues] = useState<Issue[]>(() => normalizeLegacyIssues(loadFromStorage<Issue[]>('issues', [])));
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage<Project[]>('projects', []));
  const [agents, setAgents] = useState<Agent[]>(() => normalizeLegacyAgents(loadFromStorage<Agent[]>('agents', [])));
  const [squads, setSquads] = useState<Squad[]>(() => loadFromStorage<Squad[]>('squads', []));
  const [runtimes, setRuntimes] = useState<RuntimeEngine[]>(() => loadFromStorage<RuntimeEngine[]>('runtimes', []));
  const [skills, setSkills] = useState<Skill[]>(() => {
    const saved = loadFromStorage<unknown[]>('skills', []);
    return Array.isArray(saved) ? saved.map(normalizeSkill) : [];
  });
  const [deployments] = useState<Deployment[]>(() => normalizeLegacyDeployments(loadFromStorage('deployments_v2', [])));
  /**
   * Starts empty, not seeded.
   *
   * `initialInbox` shipped three notifications about work nobody in this
   * install had done — a money-transfer view, two home-screen redesigns — sitting
   * above the real run notifications and indistinguishable from them at a
   * glance. An inbox that invents its own contents cannot be trusted for the
   * ones that matter.
   */
  const [inbox, setInbox] = useState<InboxNotification[]>(() => normalizeInboxNotifications(loadFromStorage<InboxNotification[]>('inbox', [])));
  const [analytics, setAnalytics] = useState<AnalyticsData>(() => normalizeAnalytics(loadFromStorage('analytics_v2', emptyAnalytics)));
  const [settings, setSettings] = useState<WorkspaceSettings>(() =>
    normalizeSettings(loadFromStorage('settings', defaultSettings))
  );
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(() => loadFromStorage<ChatThread[]>('chat_threads', []));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  /**
   * Threads whose messages have been fetched this session.
   *
   * A ref rather than state: it must not trigger a render, and it must not be
   * stale inside the effect that reads it. Without it, re-opening a thread
   * would re-fetch on every switch.
   */
  const loadedThreadsRef = useRef<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadFromStorage<ChatMessage[]>('chat_messages', []));
  const [prototypeRuns, setPrototypeRuns] = useState<PrototypeRun[]>(() => loadFromStorage('prototype_runs', []));
  const [squadRuns, setSquadRuns] = useState<SquadRun[]>(() => loadFromStorage('squad_runs', []));

  const [runSetupIssueId, setRunSetupIssueId] = useState<string | null>(null);
  const [runSetupAgentId, setRunSetupAgentId] = useState<string | null>(null);
  const [runPlanDrafts, setRunPlanDrafts] = useState<Record<string, RunPlanDraft>>(() =>
    loadFromStorage<Record<string, RunPlanDraft>>('run_plan_drafts_v1', {})
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const handledRunEventsRef = useRef<Set<string>>(new Set());
  /**
   * Backend run IDs do not exist until POST /runs/start returns. Keeping this
   * small pending map lets a user cancel during that window without sending a
   * request for the optimistic ID and without allowing the response to revive
   * the cancelled row.
   */
  const pendingRunStartsRef = useRef(new Map<string, { issueId: string; agentId: string; cancelled: boolean }>());

  const [requirementDocs, setRequirementDocs] = useState<RequirementDoc[]>(() =>
    normalizeRequirementDocs(loadFromStorage<RequirementDoc[]>('requirement_docs', []))
  );
  const [isScanningRuntimes, setIsScanningRuntimes] = useState(false);
  const [isScanningSkills, setIsScanningSkills] = useState(false);
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
      let selectedWorkspaceId = activeWorkspaceId;
      try {
        const available = await apiService.getWorkspaces();
        if (!cancelled && Array.isArray(available)) {
          setWorkspaces(available);
          const selected = available.find(workspace => workspace.id === selectedWorkspaceId) ?? available[0];
          selectedWorkspaceId = selected?.id ?? null;
          setActiveWorkspaceIdState(selectedWorkspaceId);
          setActiveWorkspaceId(selectedWorkspaceId);
          try {
            const roomProjects = await apiService.getLiveBuildRoomProjects();
            if (!cancelled) setLiveBuildRoomProjectIds(roomProjects.map(project => project.id));
          } catch {
            if (!cancelled) setLiveBuildRoomProjectIds([]);
          }
        }
      } catch {
        // Keep the local cache usable when the daemon is offline or still on an
        // older build that does not expose workspaces yet.
      }

      const snapshot = await fetchServerSnapshot();
      if (cancelled) return;

      // Empty object = nothing succeeded, i.e. the daemon is not answering.
      if (Object.keys(snapshot).length === 0) {
        setServerStatus('offline');
        setWorkspaceLoading(false);
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
      /**
       * Keep whatever messages are already loaded.
       *
       * `GET /chat/threads` returns thread rows and nothing else — the daemon
       * keeps messages in their own table, while the client nests them inside
       * the thread. So a plain replace handed every thread `messages:
       * undefined`, wiping the conversation out of state, and the persistence
       * effect below then wrote that empty version back over localStorage.
       *
       * The transcript was never lost — 217 rows sat in SQLite the whole time —
       * but the UI destroyed its own copy on every page load and had no way to
       * ask for it back. Merging keeps what is in hand; `loadThreadMessages`
       * fetches the rest when a thread is opened.
       */
      if (snapshot.chatThreads) {
        setChatThreads(prev => {
          const loaded = new Map(prev.map(t => [t.id, t.messages]));
          return (snapshot.chatThreads as ChatThread[]).map(t => ({
            ...t,
            messages: t.messages ?? loaded.get(t.id)
          }));
        });
      }
      if (snapshot.runs) setPrototypeRuns(normalizeLegacyPrototypeRuns(snapshot.runs));
      if (snapshot.squadRuns) setSquadRuns(snapshot.squadRuns as SquadRun[]);
      if (snapshot.analytics && typeof snapshot.analytics === 'object') {
        setAnalytics(normalizeAnalytics(snapshot.analytics));
      }

      setServerStatus('online');
      setWorkspaceLoading(false);

    };

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  /** Keep the local user directory tied to the selected workspace. */
  useEffect(() => {
    setActiveWorkspaceId(activeWorkspaceId);
    if (!activeWorkspaceId) {
      setWorkspaceMembers([]);
      return;
    }

    let cancelled = false;
    void apiService.getWorkspaceMembers(activeWorkspaceId)
      .then(rows => {
        if (!cancelled) setWorkspaceMembers(rows as WorkspaceMemberRecord[]);
      })
      .catch(() => {
        // The authenticated identity remains usable when the directory is
        // unavailable; never invent a roster as a fallback.
        if (!cancelled) setWorkspaceMembers([]);
      });

    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  /**
   * Resolve access independently of collection hydration.
   *
   * A denied collection is normal for a restricted role, and a no-team
   * identity can make every protected collection return 403. `/me` is the
   * authoritative answer in both cases, so it cannot be nested inside an
   * all-or-nothing board load.
   */
  useEffect(() => {
    let cancelled = false;

    apiService.getIdentity()
      .then(next => {
        if (cancelled) return;
        setIdentity(next);
        setIdentityStatus('ready');
        if (next.github === 'ok') setLocalMode(false);
      })
      .catch(() => {
        // The desktop keeps its cached/local shell when an older or offline
        // daemon does not expose /me; protected writes still fail closed.
        // The web build does not -- App.tsx refuses to render on this status.
        if (!cancelled) setIdentityStatus('unreachable');
      });

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

  /** Keep the analytics cards tied to persisted daemon runs, not demo counters. */
  useEffect(() => {
    const REFRESH_MS = 30_000;
    let cancelled = false;

    const refresh = async () => {
      try {
        const latest = await apiService.getAnalytics();
        if (!cancelled && latest && typeof latest === 'object') {
          setAnalytics(normalizeAnalytics(latest));
        }
      } catch {
        // Daemon down; retain the last known snapshot until it reconnects.
      }
    };

    const id = window.setInterval(refresh, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  /**
   * Load a thread's transcript from the daemon when it is opened.
   *
   * The daemon has always served this (`GET /chat/threads/:id/messages`) and
   * `apiService.getChatMessages` has always existed — nothing called either.
   * `useChatViewModel` even implements the loader, but no component mounts it,
   * so the route had no caller at all and a conversation only existed in
   * whatever the browser happened to still hold.
   *
   * Fetched once per thread per session. Live sends append to state directly,
   * so re-fetching on every switch would cost a request to learn what is
   * already on screen.
   */
  useEffect(() => {
    const threadId = activeThreadId;
    if (!threadId || loadedThreadsRef.current.has(threadId)) return;

    let cancelled = false;
    loadedThreadsRef.current.add(threadId);

    apiService
      .getChatMessages(threadId)
      .then(messages => {
        if (cancelled || !messages) return;
        setChatThreads(prev =>
          prev.map(t => (t.id === threadId ? { ...t, messages } : t))
        );
      })
      .catch(() => {
        // Allow a retry on the next open rather than leaving the thread
        // permanently marked as loaded against a daemon that was briefly down.
        loadedThreadsRef.current.delete(threadId);
      });

    return () => { cancelled = true; };
  }, [activeThreadId]);

  // Sync to local storage
  useEffect(() => { saveToStorage('active_workspace_id', activeWorkspaceId); }, [activeWorkspaceId]);
  useEffect(() => { saveToStorage('workspace_tabs_v2', tabs); }, [tabs]);
  useEffect(() => { saveToStorage('active_tab_id_v2', activeTabId); }, [activeTabId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('issues'), issues); }, [issues, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('projects'), projects); }, [projects, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('agents'), agents); }, [agents, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('squads'), squads); }, [squads, activeWorkspaceId]);
  useEffect(() => { saveToStorage('runtimes', runtimes); }, [runtimes]);
  useEffect(() => { saveToStorage('skills', skills); }, [skills]);
  useEffect(() => { saveToStorage(workspaceStorageKey('deployments_v2'), deployments); }, [deployments, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('inbox'), inbox); }, [inbox, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('analytics_v2'), analytics); }, [analytics, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('settings'), settings); }, [settings, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('chat_threads'), chatThreads); }, [chatThreads, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('chat_messages'), chatMessages); }, [chatMessages, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('prototype_runs'), prototypeRuns); }, [prototypeRuns, activeWorkspaceId]);
  useEffect(() => { saveToStorage(workspaceStorageKey('squad_runs'), squadRuns); }, [squadRuns, activeWorkspaceId]);
  useEffect(() => { saveToStorage('run_plan_drafts_v1', runPlanDrafts); }, [runPlanDrafts]);
  useEffect(() => { saveToStorage('local_mode', localMode); }, [localMode]);

  /**
   * Pull the board every minute, and once on load.
   *
   * A webhook would be push-based and instant, and it needs a public URL a
   * laptop does not have — which would mean hosting something, the thing this
   * architecture exists to avoid. A minute is well inside what anyone notices
   * on a six-person board, and it costs four API calls against a limit of five
   * thousand an hour.
   *
   * Paused while the tab is hidden: a laptop with Alpha open in a background
   * tab for a week should not spend the rate limit on a board nobody is
   * looking at.
   */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void syncBoard();
      /*
       * And which workspaces this person is in. A project manager can put a
       * developer in a workspace at any time, and the developer does nothing
       * to accept it -- so the app has to notice, not wait for a restart.
       * Quiet on failure: the board sync already reports an offline daemon.
       */
      void apiService.getWorkspaces()
        .then(available => {
          if (!Array.isArray(available)) return;
          setWorkspaces(prev =>
            prev.length === available.length &&
            prev.every((workspace, i) => workspace.id === available[i].id && workspace.name === available[i].name && workspace.role === available[i].role)
              ? prev
              : available
          );
        })
        .catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    // Catch up immediately when someone comes back to the tab, rather than
    // showing a stale board until the next interval.
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [syncBoard]);
  useEffect(() => { saveToStorage(workspaceStorageKey('requirement_docs'), requirementDocs); }, [requirementDocs, activeWorkspaceId]);

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

  const workspaceStorageKey = (key: string) =>
    activeWorkspaceId ? `${key}:${activeWorkspaceId}` : key;

  const refreshWorkspaces = async () => {
    try {
      const available = await apiService.getWorkspaces();
      setWorkspaces(available);
      const selected = available.find(workspace => workspace.id === activeWorkspaceId) ?? available[0];
      if (selected && selected.id !== activeWorkspaceId) {
        setActiveWorkspaceIdState(selected.id);
        setActiveWorkspaceId(selected.id);
      }
    } catch (error) {
      showToast('Workspaces unavailable', error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const refreshLiveBuildRoomProjects = async () => {
    try {
      const roomProjects = await apiService.getLiveBuildRoomProjects();
      setLiveBuildRoomProjectIds(roomProjects.map(project => project.id));
    } catch {
      // Fail closed: an unavailable room index must never expose a stale room.
      setLiveBuildRoomProjectIds([]);
    }
  };

  const switchWorkspace = async (workspaceId: string, knownTarget?: WorkspaceSummary) => {
    const target = knownTarget ?? workspaces.find(workspace => workspace.id === workspaceId);
    if (!target || workspaceId === activeWorkspaceId) return;

    setWorkspaceSwitching(true);
    setActiveWorkspaceIdState(workspaceId);
    setActiveWorkspaceId(workspaceId);
    setLiveBuildRoomProjectIds([]);
    setActiveThreadId(null);
    setRunSetupIssueId(null);
    setRunSetupAgentId(null);
    setProjects(loadFromStorage<Project[]>(`projects:${workspaceId}`, []));
    setIssues(normalizeLegacyIssues(loadFromStorage<Issue[]>(`issues:${workspaceId}`, [])));
    setAgents(normalizeLegacyAgents(loadFromStorage<Agent[]>(`agents:${workspaceId}`, [])));
    setSquads(loadFromStorage<Squad[]>(`squads:${workspaceId}`, []));
    setChatThreads(loadFromStorage<ChatThread[]>(`chat_threads:${workspaceId}`, []));
    setChatMessages(loadFromStorage<ChatMessage[]>(`chat_messages:${workspaceId}`, []));
    setPrototypeRuns(normalizeLegacyPrototypeRuns(loadFromStorage<PrototypeRun[]>(`prototype_runs:${workspaceId}`, [])));
    setSquadRuns(loadFromStorage<SquadRun[]>(`squad_runs:${workspaceId}`, []));
    setInbox(normalizeInboxNotifications(loadFromStorage<InboxNotification[]>(`inbox:${workspaceId}`, [])));
    setRequirementDocs(normalizeRequirementDocs(loadFromStorage<RequirementDoc[]>(`requirement_docs:${workspaceId}`, [])));
    setAnalytics(normalizeAnalytics(loadFromStorage<AnalyticsData>(`analytics_v2:${workspaceId}`, emptyAnalytics)));

    try {
      const snapshot = await fetchServerSnapshot();
      try {
        const roomProjects = await apiService.getLiveBuildRoomProjects();
        setLiveBuildRoomProjectIds(roomProjects.map(project => project.id));
      } catch {
        setLiveBuildRoomProjectIds([]);
      }
      if (snapshot.projects) setProjects(snapshot.projects as Project[]);
      if (snapshot.agents) setAgents(snapshot.agents as Agent[]);
      if (snapshot.issues) setIssues(snapshot.issues as Issue[]);
      if (snapshot.squads) setSquads(snapshot.squads as Squad[]);
      if (snapshot.skills) setSkills(snapshot.skills as Skill[]);
      if (snapshot.runtimes) setRuntimes(snapshot.runtimes as RuntimeEngine[]);
      if (snapshot.chatThreads) setChatThreads(snapshot.chatThreads as ChatThread[]);
      if (snapshot.runs) setPrototypeRuns(normalizeLegacyPrototypeRuns(snapshot.runs));
      if (snapshot.squadRuns) setSquadRuns(snapshot.squadRuns as SquadRun[]);
      if (snapshot.analytics && typeof snapshot.analytics === 'object') {
        setAnalytics(normalizeAnalytics(snapshot.analytics));
      }
      setServerStatus('online');
      const nextTabId = `tab-${Date.now()}`;
      setTabs([{ id: nextTabId, view: ROLE_TABS[target.role][0] }]);
      setActiveTabId(nextTabId);
      showToast('Workspace switched', `Now viewing ${target.name}.`, 'success');
    } catch (error) {
      showToast('Workspace switch failed', error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setWorkspaceSwitching(false);
    }
  };

  const createWorkspace = async (
    name: string,
    members: Array<{ userId: string; role: UserRole }> = []
  ): Promise<WorkspaceSummary | null> => {
    try {
      const created = await apiService.createWorkspace({ name, members });
      setWorkspaces(prev => [...prev, created]);
      await switchWorkspace(created.id, created);
      return created;
    } catch (error) {
      showToast('Workspace not created', error instanceof Error ? error.message : String(error), 'error');
      return null;
    }
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
          if (idx === stageIndex) return { ...s, status, startedAt: s.startedAt || new Date().toISOString(), completedAt: status === 'success' || status === 'failed' || status === 'skipped' ? new Date().toISOString() : undefined };
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

    const unsubActivity = runnerSocket.on('run_activity', ({ runId, activity }: { runId: string; activity: RunActivity }) => {
      if (!runId || !activity) return;
      setPrototypeRuns(prev => prev.map(run => {
        if (run.id !== runId) return run;
        const activities = [...(run.activities ?? [])];
        const existingIndex = activities.findIndex(item => item.id === activity.id);
        if (existingIndex >= 0) activities[existingIndex] = activity;
        else activities.push(activity);
        activities.sort((a, b) => a.sequence - b.sequence);
        return { ...run, activities, updatedAt: new Date().toISOString() };
      }));
    });

    /**
     * A queued run reaching the front of its workspace queue.
     *
     * Runs sharing a project share its checkout, so the daemon serialises them.
     * Nothing else rewrites `status` between accepting a run and finishing it,
     * so without this a queued run would read as queued for its whole life.
     */
    const unsubStarted = runnerSocket.on('run_started', (startedRun) => {
      setPrototypeRuns(prev => prev.map(r => r.id === startedRun.id ? startedRun : r));
    });

    /**
     * A member finishing is not the squad finishing.
     *
     * Every member of a squad emits `run_completed`, so a four-member squad
     * fired this handler four times: four "Run completed" toasts, and the card
     * moved to Review while three agents were still working the branch. A run
     * carrying a `squadRunId` records its result and stops there —
     * `squad_run_completed` below is the event that means the work is done.
     */
    const unsubComplete = runnerSocket.on('run_completed', (finalRun) => {
      setPrototypeRuns(prev => prev.map(r => r.id === finalRun.id ? finalRun : r));

      if (finalRun.squadRunId) {
        // Only the last member opens a pull request. Record the link the moment
        // it exists, but leave the card where it is until the squad is done.
        if (finalRun.prUrl) {
          setIssues(prev => prev.map(i =>
            i.id === finalRun.issueId ? { ...i, prUrl: finalRun.prUrl } : i
          ));
        }
        return;
      }

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
      // A failed member stops its squad, and `squad_run_failed` says so with the
      // reason and the position it stopped at. Reporting both is reporting twice.
      if (failedRun.squadRunId) return;
      setIssues(prev => prev.map(i => i.id === failedRun.issueId ? { ...i, status: 'in_progress', updatedAt: new Date().toISOString() } : i));
      showToast('Run failed', failedRun.testSummary || 'Agent encountered an error.', 'error');
    });

    const unsubCancelled = runnerSocket.on('run_cancelled', (cancelledRun) => {
      setPrototypeRuns(prev => prev.map(r => r.id === cancelledRun.id ? cancelledRun : r));
      setIssues(prev => prev.map(issue => issue.id === cancelledRun.issueId
        ? { ...issue, status: 'in_progress', updatedAt: new Date().toISOString() }
        : issue
      ));
      setAgents(prev => prev.map(agent => agent.id === cancelledRun.agentId
        ? { ...agent, status: 'idle', workStatus: 'idle', currentTask: undefined }
        : agent
      ));
    });

    /**
     * Who is working now.
     *
     * The daemon raises this at each handoff. What the context keeps is only
     * the pointer every view needs — which member is live — while SquadRunFlow
     * re-reads the run itself. Rebuilding a squad run from event payloads is
     * how the two versions of it drift apart.
     */
    const unsubSquadMember = runnerSocket.on('squad_member_started', ({ squadRunId, memberIndex, memberCount, agentName }) => {
      setSquadRuns(prev => prev.map(sr => sr.id === squadRunId
        ? { ...sr, currentMemberIndex: memberIndex, status: 'running' as const, updatedAt: new Date().toISOString() }
        : sr));
      // Handoffs only. triggerSquadRun already announced the first member.
      if (memberIndex > 0) {
        showToast('Squad handoff', `${agentName} picked up member ${memberIndex + 1} of ${memberCount}.`, 'info');
      }
    });

    const unsubSquadDone = runnerSocket.on('squad_run_completed', (squadRun) => {
      setSquadRuns(prev => prev.map(sr => sr.id === squadRun.id ? squadRun : sr));
      setSquads(prev => prev.map(s => s.id === squadRun.squadId
        ? { ...s, activeRunsCount: Math.max(0, s.activeRunsCount - 1) }
        : s));
      setIssues(prev => prev.map(i => i.id === squadRun.issueId
        ? { ...i, status: 'review', updatedAt: new Date().toISOString() }
        : i));
      showToast(
        'Squad run finished',
        `${squadRun.memberAgentIds.length} member(s) worked on ${squadRun.branchName}.`,
        'success'
      );
    });

    const unsubSquadFailed = runnerSocket.on('squad_run_failed', (squadRun) => {
      setSquadRuns(prev => prev.map(sr => sr.id === squadRun.id ? squadRun : sr));
      setSquads(prev => prev.map(s => s.id === squadRun.squadId
        ? { ...s, activeRunsCount: Math.max(0, s.activeRunsCount - 1) }
        : s));
      setIssues(prev => prev.map(i => i.id === squadRun.issueId
        ? { ...i, status: 'in_progress', updatedAt: new Date().toISOString() }
        : i));
      // The daemon's reason names the member and the position. It is better
      // than anything this side could reconstruct.
      showToast('Squad run stopped', squadRun.stoppedReason ?? 'A member did not finish.', 'error');
    });

    return () => {
      unsubStage();
      unsubLog();
      unsubActivity();
      unsubStarted();
      unsubComplete();
      unsubFailed();
      unsubCancelled();
      unsubSquadMember();
      unsubSquadDone();
      unsubSquadFailed();
    };
  }, []);

  // Unread count is derived from the scoped inbox further down, not from the
  // raw list — a client must not be given a badge for internal traffic.

  // Issue CRUD
  const createIssue = (input: Omit<Issue, 'id' | 'identifier' | 'createdAt' | 'updatedAt' | 'comments' | 'subtasks'> & { subtasks?: string[] }): Issue | null => {
    if (!requireCapability('manage_issues')) return null;
    const project = projects.find(p => p.id === input.projectId) || projects[0];

    /**
     * A placeholder, not a guess.
     *
     * This used to compute `${key}-${issues.length + 101}` — a count of every
     * issue in every project — and the daemon honoured whatever it was sent, so
     * that number became the real one. The first issue of a new project came
     * out as TES-107 because six issues happened to exist elsewhere.
     *
     * The daemon numbers per project and owns it now. This label exists only
     * for the moment between the click and the response, and says so rather
     * than inventing a number that is about to change under the reader.
     */
    const placeholder = `${project ? project.key : 'NEW'}-…`;

    const newIssue: Issue = {
      ...input,
      id: `iss-${Date.now()}`,
      identifier: placeholder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtasks: (input.subtasks || []).map((st, i) => ({
        id: `sub-${Date.now()}-${i}`,
        title: st,
        completed: false
      })),
      // The opening comment is written by the daemon, where the real identifier
      // and the real author are both known.
      comments: []
    };

    setIssues(prev => [newIssue, ...prev]);

    // Add inbox notification
    const newNotification: InboxNotification = {
      id: `notif-${Date.now()}`,
      type: 'issue_assigned',
      title: 'New issue created',
      message: `${newIssue.title} was created in project ${project ? project.name : 'Alpha'}.`,
      read: false,
      audience: 'internal',
      timestamp: new Date().toISOString(),
      entityType: 'issue',
      entityId: newIssue.id,
      meta: {
        issueIdentifier: placeholder
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
    if (!requireCapability('manage_issues')) return;
    const previousIssue = issues.find(iss => iss.id === id);
    setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, status, updatedAt: new Date().toISOString() } : iss));
    persist(
      () => status === 'done'
        ? apiService.completeIssue(id)
        : apiService.updateIssue(id, { status }),
      saved => setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, ...saved } : iss)),
      msg => {
        if (previousIssue) {
          setIssues(prev => prev.map(iss => iss.id === id ? previousIssue : iss));
        }
        showToast('Status not saved', msg, 'error');
      }
    );
  };

  const updateIssue = (id: string, updates: Partial<Issue>) => {
    if (!requireCapability('manage_issues')) return;
    setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, ...updates, updatedAt: new Date().toISOString() } : iss));
    persist(
      () => apiService.updateIssue(id, updates),
      () => {},
      msg => showToast('Issue not saved', msg, 'error')
    );
  };

  /**
   * Comments have their own endpoint because they have their own table.
   *
   * The board used to add one with `updateIssue(id, { comments: [...] })`, and
   * that silently discarded it: `UPDATE issues SET ...` has no comments column,
   * so nothing was written — but the handler returns the merged object with the
   * comment included, so the response looked like a save and the UI agreed until
   * the next reload.
   */
  const addIssueComment = (issueId: string, comment: IssueComment) => {
    if (!requireCapability('manage_issues')) return;
    setIssues(prev =>
      prev.map(iss =>
        iss.id === issueId ? { ...iss, comments: [...(iss.comments ?? []), comment] } : iss
      )
    );
    persist(
      () => apiService.addIssueComment(issueId, comment),
      saved =>
        setIssues(prev =>
          prev.map(iss =>
            iss.id === issueId
              ? { ...iss, comments: (iss.comments ?? []).map(c => (c.id === comment.id ? saved : c)) }
              : iss
          )
        ),
      msg => {
        setIssues(prev =>
          prev.map(iss =>
            iss.id === issueId
              ? { ...iss, comments: (iss.comments ?? []).filter(c => c.id !== comment.id) }
              : iss
          )
        );
        showToast('Comment not saved', msg, 'error');
      }
    );
  };

  const deleteIssue = (id: string) => {
    if (!requireCapability('manage_issues')) return;
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
    if (!requireCapability('run_agents')) return;
    const targetIssue = issues.find(issue => issue.id === issueId);
    if (!targetIssue) return;

    const blockingRun = prototypeRuns.find(run =>
      run.issueId === issueId && ['queued', 'running', 'awaiting_approval', 'validating'].includes(run.status)
    );
    if (blockingRun) {
      showToast('Run already in progress', 'Open the issue to view its current status.', 'info');
      return;
    }

    setRunSetupIssueId(issueId);
    setRunSetupAgentId(
      agentId || runPlanDrafts[issueId]?.agentId || targetIssue.assignedAgentId || agents[0]?.id || null
    );
  };

  const saveRunPlanDraft = (issueId: string, agentId: string, plan: string[]) => {
    setRunPlanDrafts(prev => ({
      ...prev,
      [issueId]: { agentId, plan, updatedAt: new Date().toISOString() }
    }));
  };

  const clearRunPlanDraft = (issueId: string) => {
    setRunPlanDrafts(prev => {
      if (!prev[issueId]) return prev;
      const next = { ...prev };
      delete next[issueId];
      return next;
    });
  };

  const closeRunSetup = () => {
    setRunSetupIssueId(null);
    setRunSetupAgentId(null);
  };

  const reconcileRunAfterCancelFailure = (localRunId: string, serverRunId: string) => {
    apiService.getRuns().then(serverRuns => {
      const latest = serverRuns.find(item => item.id === serverRunId);
      if (!latest) return;

      setPrototypeRuns(prev => prev.map(item =>
        item.id === localRunId || item.id === serverRunId ? latest : item
      ));

      const active = latest.status === 'queued' || latest.status === 'running';
      const issueStatus = active
        ? 'agent_running'
        : latest.status === 'awaiting_approval'
          ? 'review'
          : latest.status === 'completed'
            ? 'done'
            : 'in_progress';
      setIssues(prev => prev.map(issue => issue.id === latest.issueId
        ? { ...issue, status: issueStatus, updatedAt: new Date().toISOString() }
        : issue
      ));
      setAgents(prev => prev.map(agent => agent.id === latest.agentId
        ? {
            ...agent,
            status: active ? 'executing' : 'idle',
            workStatus: active ? 'working' : 'idle',
            currentTask: active ? latest.issueId : undefined
          }
        : agent
      ));
    }).catch(() => {
      showToast('Run state uncertain', 'Refresh the board to confirm whether cancellation succeeded.', 'error');
    });
  };

  const startPrototypeRun = (
    issueId: string,
    agentId: string,
    plan: string[],
    scenario: PrototypeRun['scenario']
  ): PrototypeRun | null => {
    if (!requireCapability('run_agents')) return null;
    const targetIssue = issues.find(issue => issue.id === issueId);
    const assignedAgent = agents.find(agent => agent.id === agentId);
    if (!targetIssue || !assignedAgent) return null;

    const now = new Date().toISOString();
    const run: PrototypeRun = {
      id: `run-${Date.now()}`,
      issueId,
      projectId: targetIssue.projectId,
      agentId,
      // No process exists until the daemon accepts the request. Keeping this
      // queued avoids showing invented stages, logs, or progress during that
      // short request window.
      status: 'queued',
      scenario,
      plan,
      stages: [],
      currentStageIndex: 0,
      createdAt: now,
      updatedAt: now
    };

    setPrototypeRuns(prev => [run, ...prev]);
    setIssues(prev => prev.map(issue => issue.id === issueId ? {
      ...issue,
      comments: [...issue.comments, {
        id: `comm-${run.id}-started`,
        authorType: 'system' as const,
        authorName: 'Alpha',
        content: `Requested a run from ${assignedAgent.name} for ${targetIssue.identifier}. Waiting for the daemon to confirm it started.`,
        createdAt: now
      }],
      updatedAt: now
    } : issue));
    closeRunSetup();
    showToast('Run requested', `Waiting for Alpha to start ${assignedAgent.name}.`, 'info');

    pendingRunStartsRef.current.set(run.id, { issueId, agentId, cancelled: false });

    /**
     * Trigger the real backend run, and adopt the id it assigns.
     *
     * This used to write `id: run.id` — keeping the optimistic id and throwing
     * the backend's away. Both sides mint `run-${Date.now()}`, at different
     * moments, so the two never matched, and every socket handler below
     * ('stage_update', 'log_chunk', 'run_completed', 'run_failed') selects by
     * `run.id === runId`. Nothing the real agent did could reach this row: no
     * stage transitions, no logs, no final diff, and no token counts. What
     * looked like a working run was the local timer, which is why it always
     * finished in about seven seconds with the same numbers.
     *
     * `cancelRun` was posting that unknown id too, so cancelling never reached
     * the process either.
     */
    apiService.startRun({ issueId, agentId, plan, scenario }).then((realRun) => {
      const pending = pendingRunStartsRef.current.get(run.id);
      pendingRunStartsRef.current.delete(run.id);
      if (realRun && realRun.id) {
        if (pending?.cancelled) {
          const cancelledAt = new Date().toISOString();
          setPrototypeRuns(prev => prev.map(item => item.id === run.id ? {
            ...realRun,
            status: 'cancelled',
            updatedAt: cancelledAt,
            stages: realRun.stages.map((stage, index) => index === realRun.currentStageIndex
              ? { ...stage, status: 'cancelled' as const, completedAt: cancelledAt }
              : stage)
          } : item));

          // The daemon has now given us the real ID. Finish the cancellation
          // that was requested while the start call was still in flight.
          apiService.cancelRun(realRun.id).catch((err: unknown) => {
            const detail = err instanceof Error ? err.message : String(err);
            showToast('Run cancellation failed', detail, 'error');
            reconcileRunAfterCancelFailure(run.id, realRun.id);
          });
          return;
        }

        setPrototypeRuns(prev => prev.map(r => r.id === run.id ? {
          ...r,
          ...realRun,
          scenario: (realRun.scenario || scenario || 'success') as any
        } : r));
        const active = realRun.status === 'running' || realRun.status === 'validating';
        const queued = realRun.status === 'queued';
        setIssues(prev => prev.map(issue => issue.id === issueId ? {
          ...issue,
          status: 'agent_running',
          assignedAgentId: agentId,
          updatedAt: new Date().toISOString()
        } : issue));
        setAgents(prev => prev.map(agent => agent.id === agentId ? {
          ...agent,
          status: active ? 'executing' : queued ? 'thinking' : 'idle',
          workStatus: active ? 'working' : queued ? 'queued' : 'idle',
          currentTask: active || queued ? targetIssue.identifier : undefined
        } : agent));
        clearRunPlanDraft(issueId);
      }
    }).catch(err => {
      const pending = pendingRunStartsRef.current.get(run.id);
      pendingRunStartsRef.current.delete(run.id);
      // The user already cancelled this optimistic row. Do not turn that
      // intentional terminal state into a failed run when the start request
      // later rejects.
      if (pending?.cancelled) return;

      /**
       * Say the run did not start, rather than leaving it "running" forever.
       *
       * The previous handler logged "Real run dispatched with local fallback"
       * and left the optimistic row alone for the simulation to complete, so a
       * backend that was down, or a project with no working copy, still
       * produced a finished run on screen.
       */
      const detail = err instanceof Error ? err.message : String(err);
      setPrototypeRuns(prev => prev.map(r => r.id === run.id ? {
        ...r,
        status: 'failed',
        testSummary: `The run could not be started: ${detail}`,
        updatedAt: new Date().toISOString()
      } : r));
      setAgents(prev => prev.map(agent => agent.id === agentId ? {
        ...agent,
        status: 'idle',
        workStatus: 'idle',
        currentTask: undefined
      } : agent));
      setIssues(prev => prev.map(issue => issue.id === issueId
        ? {
            ...issue,
            status: 'in_progress',
            comments: [...issue.comments, {
              id: `comm-${run.id}-failed-to-start`,
              authorType: 'system' as const,
              authorName: 'Alpha',
              content: `Run did not start: ${detail}`,
              createdAt: new Date().toISOString()
            }],
            updatedAt: new Date().toISOString()
          }
        : issue
      ));
      showToast('Run could not start', detail, 'error');
    });

    return run;
  };

  const cancelPrototypeRun = (runId: string) => {
    if (!requireCapability('run_agents')) return;
    const run = prototypeRuns.find(item => item.id === runId);
    if (!run || !['queued', 'running'].includes(run.status)) return;
    const now = new Date().toISOString();

    const pending = pendingRunStartsRef.current.get(runId);
    if (pending) {
      pending.cancelled = true;
    } else {
      apiService.cancelRun(runId).catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : String(err);
        showToast('Run cancellation failed', detail, 'error');
        reconcileRunAfterCancelFailure(runId, runId);
      });
    }

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
    if (!requireCapability('run_agents')) return;
    const run = prototypeRuns.find(item => item.id === runId);
    if (!run || !['failed', 'changes_requested', 'cancelled'].includes(run.status)) {
      showToast('Retry unavailable', 'The failed run is no longer available. Refresh the issue and try again.', 'error');
      return;
    }
    // The daemon creates a new run when retrying. Keep the failed run in
    // history and adopt the daemon-assigned id so websocket updates reach the
    // row the user is watching. Previously the old id was marked running while
    // the new backend run was discarded, making Retry appear to do nothing.
    apiService.retryRun(runId).then(newRun => {
      const now = new Date().toISOString();
      setPrototypeRuns(prev => [newRun, ...prev.filter(item => item.id !== newRun.id)]);
      setIssues(prev => prev.map(issue => issue.id === run.issueId ? {
        ...issue,
        status: 'agent_running',
        comments: [...issue.comments, {
          id: `comm-${newRun.id}-retry`,
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
        workStatus: 'working',
        currentTask: run.issueId
      } : agent));
      showToast('Run restarted', 'The failed stage will be attempted again.', 'success');
    }).catch(err => {
      const detail = err instanceof Error ? err.message : String(err);
      showToast('Retry failed', detail, 'error');
    });
  };

  /**
   * The simulated stage advancer is gone.
   *
   * It ran every 350ms over every run whose status was 'running' and, once
   * each stage's `durationMs ?? 1500` had elapsed, advanced it — finally
   * writing `changedFiles: 4, insertions: 86, deletions: 14, testSummary:
   * '42 tests passed'` and flipping the run to 'awaiting_approval'.
   *
   * It applied to real backend runs as well as local ones, so about seven
   * seconds after starting anything the UI reported a finished run with those
   * four invented numbers, whatever the agent was actually doing. The honest
   * diff statistics the daemon computes were overwritten before they arrived,
   * and a run that later genuinely failed had already been shown as reviewed.
   *
   * Runs are driven by the backend: 'stage_update' and 'log_chunk' move them
   * along, 'run_completed' and 'run_failed' finish them, and the snapshot
   * fetch restores them after a refresh. A run that starts is now allowed to
   * stay running until something real says otherwise.
   */


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
        currentTask: undefined
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
                content: run.testSummary || 'The agent run failed. Review the run details and retry when ready.',
                createdAt: now
              }],
          updatedAt: now
        } : issue));
        setInbox(prev => prev.some(item => item.id === `notif-${run.id}-failed`) ? prev : [{
          id: `notif-${run.id}-failed`,
          type: 'agent_failed',
          title: `Run needs attention: ${targetIssue.identifier}`,
          message: `${assignedAgent.name} stopped because the run failed. Open the run details for the provider error and next action.`,
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
        showToast('Run needs attention', run.testSummary || 'The agent run failed. Open the issue to retry.', 'error');
        return;
      }

      /**
       * A branch name, and no invented pull request.
       *
       * This minted `github.com/multica/alpha-engine/pull/<random 10-89>` — a
       * repository nobody here owns, numbered at random. It is where
       * `pull/mock-alf-101` came from, and a plausible-looking URL is worse
       * than an empty field: the Inbox rendered it as a real review link.
       *
       * A real run sets `prUrl` from what `gh` actually opened. If there is no
       * remote there is no pull request, and the UI should say so.
       */
      // The daemon owns the branch name. A finished run without one must not
      // be presented as if the browser created a real working branch.
      const branchName = run.branchName;
      setIssues(prev => prev.map(issue => issue.id === run.issueId ? {
        ...issue,
        status: 'review',
        ...(branchName ? { branchName } : {}),
        subtasks: issue.subtasks.map(subtask => ({ ...subtask, completed: true })),
        comments: issue.comments.some(comment => comment.id === `comm-${run.id}-review`)
          ? issue.comments
          : [...issue.comments, {
              id: `comm-${run.id}-review`,
              authorType: 'agent' as const,
              authorName: assignedAgent.name,
              authorAvatar: assignedAgent.avatar,
              agentId: assignedAgent.id,
              /**
               * The run's own numbers, including none.
               *
               * This read `${run.changedFiles || 4} files changed and
               * ${run.testSummary || 'all tests passed'}` — so a run that
               * changed nothing announced four files and passing tests, in the
               * agent's own voice, on the issue. The backend verifier now
               * records the repository checks and their exit status; the
               * daemon's testSummary is used verbatim when present.
               */
              content: run.changedFiles
                ? `Implementation is ready for review: ${run.changedFiles} file(s) changed.` +
                  (run.testSummary ? ` ${run.testSummary}` : '')
                : 'The run finished without changing any files. Check the run log before reviewing.',
              createdAt: now,
              isThinking: false
            }],
        updatedAt: now
      } : issue));
      setInbox(prev => prev.some(item => item.id === `notif-${run.id}-approval`) ? prev : [{
        id: `notif-${run.id}-approval`,
        type: 'agent_approval',
        title: `Review requested: ${targetIssue.identifier}`,
        /**
         * What actually happened, which is not always the same thing.
         *
         * This read "prepared a simulated pull request" for every run. It was
         * written when a run was a 4.5s timer and a mock URL, and stayed after
         * runs became real — so a run that opened a genuine pull request still
         * announced itself as simulated. Three outcomes are possible and they
         * are not interchangeable: a real PR, a commit with no remote to push
         * to, or no change at all.
         */
        message: run.prUrl
          ? `${assignedAgent.name} opened a pull request: ${run.prUrl}`
          : run.changedFiles
            ? `${assignedAgent.name} committed ${run.changedFiles} file(s)${branchName ? ` to ${branchName}` : ''}. No pull request was recorded for this run.`
            : `${assignedAgent.name} finished without changing any files. Check the run log.`,
        read: false,
        timestamp: now,
        entityType: 'issue',
        entityId: targetIssue.id,
        approvalStatus: 'pending',
        meta: {
          agentName: assignedAgent.name,
          agentRole: assignedAgent.role,
          issueIdentifier: targetIssue.identifier,
          proposedChanges: run.changedFiles
            ? `${run.insertions ?? 0} insertions, ${run.deletions ?? 0} deletions in ${run.changedFiles} files.`
            : 'No files were changed.'
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
    if (!requireCapability('manage_projects')) {
      throw new Error('Your role cannot create projects.');
    }
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
    if (!requireCapability('manage_projects')) return;
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    persist(
      () => apiService.updateProject(id, updates),
      () => {},
      msg => showToast('Project not saved', msg, 'error')
    );
  };

  const deleteProject = (id: string) => {
    if (!requireCapability('manage_projects')) return;
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
  const createAgent = (input: Omit<Agent, 'id' | 'stats' | 'status'>): Agent | null => {
    if (!requireCapability('manage_agents')) return null;
    const newAgent: Agent = {
      ...input,
      id: `agent-${Date.now()}`,
      owner: input.owner && input.owner !== 'You'
        ? input.owner
        : identity?.name || identity?.login || 'Unassigned',
      isMine: input.isMine ?? true,
      allowedUsers: input.allowedUsers || 'team',
      workStatus: input.workStatus || 'idle',
      isArchived: false,
      concurrencyLimit: input.concurrencyLimit || 2,
      envVars: input.envVars || [],
      mcpServers: input.mcpServers || [],
      customCliArgs: input.customCliArgs || '',
      runHistory: [],
      activity30d: new Array(30).fill(0),
      stats: {
        totalRuns: 0,
        successRate: 0,
        tokensUsed: 0,
        avgLatencyMs: 0
      },
      status: 'idle'
    };
    setAgents(prev => [newAgent, ...prev]);

    persist(
      () => apiService.createAgent(newAgent),
      saved => setAgents(prev => prev.map(a => (a.id === newAgent.id ? saved : a))),
      msg => {
        // A failed create never existed on the daemon. Do not leave its
        // optimistic shell in browser storage as if it were a real agent.
        setAgents(prev => prev.filter(agent => agent.id !== newAgent.id));
        showToast('Agent not saved', msg, 'error');
      }
    );

    return newAgent;
  };

  const importAgent = async (content: string) => {
    if (!requireCapability('manage_agents')) {
      throw new Error('Your role cannot import agents.');
    }
    // No optimistic insert: the id and the validated fields are decided by the
    // daemon, so there is nothing meaningful to show until it answers.
    const result = await apiService.importAgent(content);
    setAgents(prev => [result.agent, ...prev]);
    return result;
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    if (!requireCapability('manage_agents')) return;
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    persist(
      () => apiService.updateAgent(id, updates),
      /**
       * Take the daemon's answer, do not keep the optimistic guess.
       *
       * Two fields on an agent are computed by the daemon and cannot be derived
       * here: `readiness`, which depends on the model list each CLI currently
       * advertises, and `managedByFile`, which depends on the persona file on
       * the daemon's machine. The optimistic merge above can only apply the
       * fields the user just edited, so both keep whatever the last full roster
       * fetch left behind.
       *
       * That showed up as an agent switched from codex to Antigravity still
       * displaying "codex is installed but not signed in, so this agent cannot
       * answer" — advice about a CLI it no longer used, on an agent that was
       * working. `createAgent` above already reconciles this way; this was the
       * odd one out.
       */
      saved => setAgents(prev => prev.map(a => (a.id === id ? saved : a))),
      msg => showToast('Agent not saved', msg, 'error')
    );
  };

  const duplicateAgent = (id: string): Agent | null => {
    if (!requireCapability('manage_agents')) return null;
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
      owner: identity?.name || identity?.login || existing.owner || 'Unassigned',
      isMine: true,
      isArchived: false,
      envVars: safeEnvVars,
      stats: {
        totalRuns: 0,
        successRate: 0,
        tokensUsed: 0,
        avgLatencyMs: 0
      },
      status: 'idle',
      workStatus: 'idle',
      runHistory: [],
      activity30d: new Array(30).fill(0)
    };

    setAgents(prev => [newAgent, ...prev]);
    // A duplicate is a new agent, so it is created the same way one typed into
    // the builder is. Without this the copy existed only in this tab and was
    // gone on reload, having looked saved the whole time.
    persist(
      () => apiService.createAgent(newAgent),
      saved => setAgents(prev => prev.map(a => (a.id === newAgent.id ? saved : a))),
      msg => {
        setAgents(prev => prev.filter(a => a.id !== newAgent.id));
        showToast('Agent not duplicated', msg, 'error');
      }
    );
    return newAgent;
  };

  /**
   * Archive and restore write `isArchived` and nothing else.
   *
   * `status` and `workStatus` are not columns — the daemon derives them, and it
   * now reports `offline` for an archived row rather than the hardcoded `idle`
   * it used to. So the optimistic values here agree with what comes back, and
   * the reconcile is not fighting the local guess.
   */
  const setAgentArchived = (id: string, isArchived: boolean) => {
    if (!requireCapability('manage_agents')) return;
    setAgents(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, isArchived, status: isArchived ? 'offline' : 'idle', workStatus: 'idle' }
          : a
      )
    );
    persist(
      () => apiService.updateAgent(id, { isArchived }),
      saved => setAgents(prev => prev.map(a => (a.id === id ? saved : a))),
      msg => {
        setAgents(prev => prev.map(a => (a.id === id ? { ...a, isArchived: !isArchived } : a)));
        showToast(isArchived ? 'Agent not archived' : 'Agent not restored', msg, 'error');
      }
    );
  };

  const archiveAgent = (id: string) => setAgentArchived(id, true);
  const restoreAgent = (id: string) => setAgentArchived(id, false);

  const deleteAgent = (id: string) => {
    if (!requireCapability('manage_agents')) return;
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

  /**
   * One request per agent, because the daemon has no bulk endpoint.
   *
   * Deliberately not wrapped in a single all-or-nothing call: a partial failure
   * is reported per agent and the ones that succeeded stay succeeded, which is
   * what someone selecting eight rows and changing a model expects. A failure
   * toast names the agent rather than the count, so the retry is targeted.
   */
  const bulkUpdateAgents = (ids: string[], updates: Partial<Agent>) => {
    if (!requireCapability('manage_agents')) return;
    setAgents(prev => prev.map(a => ids.includes(a.id) ? { ...a, ...updates } : a));
    for (const id of ids) {
      persist(
        () => apiService.updateAgent(id, updates),
        saved => setAgents(prev => prev.map(a => (a.id === id ? saved : a))),
        msg => showToast(`${agents.find(a => a.id === id)?.name ?? id} not saved`, msg, 'error')
      );
    }
  };

  const bulkArchiveAgents = (ids: string[]) => {
    if (!requireCapability('manage_agents')) return;
    for (const id of ids) setAgentArchived(id, true);
  };

  // Squads
  const createSquad = (input: Omit<Squad, 'id' | 'activeRunsCount' | 'completedRunsCount'>): Squad | null => {
    if (!requireCapability('manage_squads')) return null;
    const newSquad: Squad = {
      ...input,
      id: `sq-${Date.now()}`,
      activeRunsCount: 0,
      completedRunsCount: 0
    };
    setSquads(prev => [...prev, newSquad]);
    // `POST /squads` and `apiService.createSquad` both already existed; nothing
    // called them, so a squad assembled in the UI lived in one tab and vanished
    // on reload.
    persist(
      () => apiService.createSquad(newSquad),
      saved => setSquads(prev => prev.map(s => (s.id === newSquad.id ? saved : s))),
      msg => {
        setSquads(prev => prev.filter(s => s.id !== newSquad.id));
        showToast('Squad not saved', msg, 'error');
      }
    );
    return newSquad;
  };

  const updateSquad = (id: string, updates: Partial<Squad>) => {
    if (!requireCapability('manage_squads')) return;
    setSquads(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
    persist(
      () => apiService.updateSquad(id, updates),
      saved => setSquads(prev => prev.map(s => (s.id === id ? saved : s))),
      msg => showToast('Squad not saved', msg, 'error')
    );
  };

  const deleteSquad = (id: string) => {
    if (!requireCapability('manage_squads')) return;
    const removed = squads.find(s => s.id === id);
    setSquads(prev => prev.filter(s => s.id !== id));
    persist(
      () => apiService.deleteSquad(id),
      () => {},
      msg => {
        // Put it back rather than leave the roster lying about what exists.
        if (removed) setSquads(prev => [...prev, removed]);
        showToast('Squad not deleted', msg, 'error');
      }
    );
  };

  /**
   * Run a squad over an issue.
   *
   * This used to be theatre: it incremented activeRunsCount, posted an inbox
   * notification saying "N agents coordinating", and set a 4.5 second timer
   * that moved the run into completedRunsCount. No endpoint was called, no
   * process was spawned, and no agent was told anything — the daemon had no
   * concept of more than one agent per run.
   *
   * It now starts a real sequential squad run: one shared branch, members in
   * order, each one handed a summary of what the members before it did. The
   * issue is required because a squad works on something; there is no longer a
   * way to "run a squad" against nothing.
   */
  const triggerSquadRun = async (squadId: string, issueId: string, plan?: string[], missionGoal?: string) => {
    if (!requireCapability('run_squads')) return;
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return;

    try {
      const squadRun = await apiService.runSquad(squadId, { issueId, plan, mission: missionGoal });

      setSquadRuns(prev => [squadRun, ...prev.filter(r => r.id !== squadRun.id)]);
      setSquads(prev => prev.map(s => s.id === squadId ? { ...s, activeRunsCount: s.activeRunsCount + 1 } : s));

      const issue = issues.find(i => i.id === issueId);
      setInbox(prev => [{
        id: `notif-${Date.now()}`,
        type: 'agent_completed',
        title: `${squad.name} started on ${issue?.identifier ?? 'an issue'}`,
        message:
          `${squadRun.memberAgentIds.length} member(s) will work in sequence on \`${squadRun.branchName}\`. ` +
          `Mission: "${squadRun.mission}".`,
        read: false,
        audience: 'internal',
        timestamp: new Date().toISOString(),
        entityType: 'squad',
        entityId: squad.id
      }, ...prev]);

      showToast('Squad run started', `${squad.name} is working on ${issue?.identifier ?? 'the issue'}.`, 'success');
    } catch (err) {
      /**
       * Say why it did not start.
       *
       * The daemon refuses a squad it cannot honestly run — an unimplemented
       * topology, no members, members that were archived — and that reason is
       * worth more to the user than a generic failure.
       */
      const detail = err instanceof Error ? err.message : String(err);
      showToast('Squad run could not start', detail, 'error');
    }
  };

  // Runtimes
  const scanLocalRuntimes = async () => {
    if (!requireCapability('manage_runtimes')) return;
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
    if (!requireCapability('manage_runtimes')) return;
    setRuntimes(prev => prev.map(rt => ({
      ...rt,
      isDefault: rt.id === id
    })));
  };

  // Skills
  const scanInstalledSkills = async () => {
    if (!requireCapability('manage_skills')) return;
    setIsScanningSkills(true);
    try {
      const detectedSkills = await apiService.scanSkills();
      setSkills(detectedSkills);
      const installedCount = detectedSkills.filter(skill => skill.installed).length;
      showToast(
        'Skill scan completed',
        installedCount > 0
          ? `Found ${installedCount} installed SKILL.md definitions.`
          : 'No filesystem skill definitions were found.',
        'success'
      );
    } catch (err) {
      showToast(
        'Skill scan failed',
        err instanceof Error ? err.message : 'The local daemon could not scan the skill folders.',
        'error'
      );
    } finally {
      setIsScanningSkills(false);
    }
  };

  const toggleSkill = (id: string) => {
    if (!requireCapability('manage_skills')) return;
    const next = !skills.find(sk => sk.id === id)?.enabled;
    setSkills(prev => prev.map(sk => sk.id === id ? { ...sk, enabled: next } : sk));
    /**
     * A skill toggle decides what tools an agent's turn is allowed to use, so
     * losing it on reload silently changed what the agents could do. The route
     * (`PUT /skills/:id`) and the client method both existed already.
     *
     * The response is `{ success }` rather than the skill, so there is nothing
     * to reconcile — the optimistic value is the value.
     */
    persist(
      () => apiService.setSkillEnabled(id, next),
      () => {},
      msg => {
        setSkills(prev => prev.map(sk => sk.id === id ? { ...sk, enabled: !next } : sk));
        showToast('Skill not saved', msg, 'error');
      }
    );
  };

  // Deployments
  const triggerDeployment = async (
    projectId: string,
    env: 'Production' | 'Staging' | 'Preview' = 'Staging',
    source?: { issueId?: string; runId?: string }
  ) => {
    if (!requireCapability('manage_deployments')) return;
    void source;
    const proj = projects.find(p => p.id === projectId) || projects[0];
    if (!proj) {
      showToast('Cannot deploy', 'No project is available yet.', 'error');
      return;
    }

    const localResource = (proj.resources || []).find(resource =>
      (resource.type === 'local_path' || resource.type === 'local_dir') &&
      Boolean(resource.localPath || resource.pathOrUrl)
    );
    const githubResource = (proj.resources || []).find(resource =>
      resource.type === 'github_repo' && Boolean(resource.pathOrUrl)
    );
    // A managed clone is the best target. If the saved local path is only a
    // parent folder (as it is for the bundled workspace), use the configured
    // GitHub repository rather than asking the daemon to dispatch from a
    // directory that is not itself a Git checkout.
    const cwd = localResource?.localPath ||
      normalizeGitHubRepo(githubResource?.pathOrUrl) ||
      localResource?.pathOrUrl;
    if (!cwd) {
      showToast(
        'Cannot deploy',
        'Attach a local repository to this project before dispatching its workflow.',
        'error'
      );
      return;
    }

    try {
      const result = await apiService.dispatchWorkflow({
        projectId: proj.id,
        cwd,
        ref: localResource?.branchOrMachine || githubResource?.branchOrMachine || undefined,
        // Workflows that want environment-specific behavior can declare this
        // standard input; the daemon will report a clear GitHub validation
        // error when the selected workflow does not accept it.
        inputs: { environment: env.toLowerCase() }
      });
      showToast(
        'Workflow dispatched',
        `${result.workflow} was requested for ${proj.name} on ${result.ref}. Refresh Live GitHub Actions to follow it.`,
        'success'
      );
    } catch (err) {
      showToast(
        'Workflow dispatch failed',
        err instanceof Error ? err.message : String(err),
        'error'
      );
    }
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
    if (!requireCapability('approve_runs')) return;
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

    /**
     * Tell the daemon, so the decision outlives this tab.
     *
     * The state changes below are optimistic; without this the run stayed
     * `awaiting_approval` in SQLite and the same notification returned on the
     * next reload.
     */
    if (action === 'approved') {
      /**
       * The daemon merges; this waits to hear whether it did.
       *
       * Two things used to happen here at once: `approveRun` recorded the
       * decision and a separate `mergeGitHubPR` call did the merging, with its
       * failure going to `console.warn`. So a merge blocked by a required check
       * or a conflict still produced "Review approved", the card moved to Done,
       * and the pull request stayed open with nobody told.
       *
       * The merge now belongs to the approve endpoint, which reports what
       * actually happened. Nothing here moves until it answers.
       */
      apiService
        .approveRun(run.id, true)
        .then(() => {
          setPrototypeRuns(prev => prev.map(item =>
            item.id === run.id ? { ...item, status: 'completed', updatedAt: new Date().toISOString() } : item
          ));
          setIssues(prev => prev.map(issue =>
            issue.id === run.issueId ? { ...issue, status: 'done', updatedAt: new Date().toISOString() } : issue
          ));
          showToast(
            'Review approved',
            run.prUrl ? `Merged ${run.prUrl}.` : 'No pull request to merge.',
            'success'
          );
        })
        .catch((err: unknown) => {
          // Put the decision back: the run is still at the gate, and the
          // notification must return rather than read as handled.
          setInbox(prev => prev.map(n =>
            n.id === notificationId ? { ...n, approvalStatus: undefined, read: true } : n
          ));
          const detail = err instanceof Error ? err.message : String(err);
          showToast('Not merged', detail, 'error');
        });

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
  /**
   * Open a conversation, and tell the daemon it exists.
   *
   * This used to be `setChatThreads` and nothing else, so a new thread lived in
   * this tab and nowhere else until its first message — `chatService` creates
   * one lazily when a message arrives for a thread it does not know. Everything
   * addressed to a thread by id therefore failed on a conversation that had not
   * been spoken in yet:
   *
   *   - setting its project answered 404 "Thread not found", surfaced as
   *     "Project not set" — the two halves of that toast are the daemon's
   *     complaint and the picker's guess at what it meant
   *   - deleting it answered 404 too, and `deleteThread` rolls a failure back by
   *     restoring the row, so the conversation reappeared and could not be
   *     removed
   *   - reloading dropped it, because hydration replaces this list with the
   *     server's
   *
   * One cause, three symptoms: the sidebar and the daemon disagreed about which
   * threads existed. Creating it up front is what removes the disagreement,
   * rather than teaching each of those call sites to tolerate it.
   *
   * Still synchronous, and still returns the id: `sendMessage` below calls this
   * and then posts to the id it gets back. `persist` writes optimistically and
   * reconciles, which is why the POST has to be idempotent — see the route.
  */
  const createNewThread = (title = 'New Conversation', projectId?: string) => {
    if (!requireCapability('manage_chat')) return '';
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
      // A project-scoped agent is selected explicitly from the Call Agent
      // control. Never seed a hidden agent roster on a new thread.
      agentIds: [],
      projectId: isClientThread ? undefined : projectId,
      messages: []
    };
    setChatThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newThreadId);

    persist(
      () => apiService.createChatThread(newThread),
      /*
       * Keep the local copy rather than adopting the server's.
       *
       * The row that comes back is the same thread, but `ChatThread` carries
       * fields SQLite has no column for — `messages`, `pinned`, `audience`,
       * `iconType` — so replacing wholesale would blank them. The id is what
       * both sides agree on, and it was ours to begin with.
       */
      () => {},
      msg => {
        /*
         * Drop it, the way a failed delete restores.
         *
         * The rule both directions follow is the same: leave this list saying
         * what the daemon actually holds. A thread kept after the write failed
         * is the phantom this change exists to remove — it would take a project
         * that will not save and refuse to be deleted.
         */
        setChatThreads(prev => prev.filter(t => t.id !== newThreadId));
        setActiveThreadId(prev => (prev === newThreadId ? null : prev));
        showToast('Conversation not created', msg, 'error');
      }
    );

    return newThreadId;
  };

  const setThreadProject = async (threadId: string, projectId: string | null): Promise<ChatThread & {
    workspaceDir: string | null;
    workspaceManaged: boolean | null;
  }> => {
    if (!requireCapability('manage_chat')) throw new Error('Your role cannot manage chat.');
    const previous = chatThreads.find(thread => thread.id === threadId);
    const updated = await apiService.setThreadProject(threadId, projectId);
    loadedThreadsRef.current.add(threadId);
    setChatThreads(prev => prev.map(thread => thread.id === threadId
      ? { ...thread, ...updated, messages: previous?.projectId === projectId ? thread.messages : [] }
      : thread
    ));
    if (activeThreadId === threadId && previous?.projectId !== projectId) {
      setChatMessages([]);
    }
    return updated;
  };

  const refreshChatThread = async (threadId: string): Promise<ChatMessage[]> => {
    const messages = await apiService.getChatMessages(threadId);
    loadedThreadsRef.current.add(threadId);
    setChatThreads(prev => prev.map(thread => thread.id === threadId ? { ...thread, messages } : thread));
    if (activeThreadId === threadId) setChatMessages(messages);
    return messages;
  };

  const deleteThread = (id: string) => {
    if (!requireCapability('manage_chat')) return;
    const removed = chatThreads.find(t => t.id === id);
    const wasActive = activeThreadId === id;

    setChatThreads(prev => prev.filter(t => t.id !== id));
    if (wasActive) setActiveThreadId(null);

    /**
     * This button removed the thread from React state and nothing else, so the
     * rows stayed in SQLite. It looked convincing because hydration was wiping
     * the client's messages anyway — the thread came back empty and read as
     * deleted. Now that transcripts are re-fetched, a delete that does not
     * reach the daemon would visibly undo itself on the next reload.
     */
    persist(
      () => apiService.deleteChatThread(id),
      () => { loadedThreadsRef.current.delete(id); },
      msg => {
        if (removed) setChatThreads(prev => [removed, ...prev]);
        if (wasActive) setActiveThreadId(id);
        showToast('Conversation not deleted', msg, 'error');
      }
    );
  };

  const sendChatMessage = async (content: string) => {
    if (!requireCapability('manage_chat')) return;
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

    /**
     * Who will answer is decided by the daemon, from the @mentions in this
     * message. The client does not guess.
     *
     * It used to. This defaulted to `agents[0]` and then reassigned on
     * keywords — the bare word "code", "bug", "test", "review" or "deploy"
     * anywhere in a message picked a different agent, by array position, with
     * comments naming agents ("Nyx", "Cipher") that are not in the roster. The
     * final message was then attributed to that guess rather than to the agent
     * that actually replied, so the name and avatar on a reply could belong to
     * someone who was never involved.
     *
     * `mentionedAgent` is only for the placeholder shown while waiting, and
     * only when the message names someone unambiguously. Everything after the
     * response comes from the response.
     */
    const mentionedAgent = agents.find(a => {
      const first = a.name.split(' ')[0].toLowerCase();
      return new RegExp(`@${first}\b`, 'i').test(content);
    });

    // Streaming placeholder
    const streamingMsgId = `msg-${Date.now() + 1}`;
    const streamingMsg: ChatMessage = {
      id: streamingMsgId,
      senderType: 'agent',
      agentId: mentionedAgent?.id,
      // Alpha answers anything that names no agent, so that is what the
      // placeholder says rather than borrowing an agent's name.
      senderName: mentionedAgent?.name ?? 'Alpha',
      senderAvatar: mentionedAgent?.avatar,
      content: 'Thinking...',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      thinkingProcess: mentionedAgent
        ? `Analyzing prompt intent using ${mentionedAgent.modelName} on ${mentionedAgent.modelProvider}...`
        : 'Answering directly on the default runtime...'
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

      /**
       * One reply, or several.
       *
       * Addressing a squad expands to its members and each one answers in
       * turn, so the daemon returns a list. `agentMessage` is the first of
       * them and is still sent for callers that expect exactly one; the
       * placeholder becomes that first reply and the rest are appended after
       * it, in the order the members spoke.
       */
      const replies = (res.agentMessages?.length ? res.agentMessages : [res.agentMessage]).map(
        (reply: any, index: number): ChatMessage => ({
          // The first reply takes over the placeholder's id so it replaces it
          // in place; the others are new messages.
          id: index === 0 ? (reply.id || streamingMsgId) : reply.id,
          senderType: reply.senderType ?? 'agent',
          // From the daemon, which knows who actually replied. Taking this from
          // a client-side guess is how a reply ended up labelled with the wrong
          // agent's name and face.
          agentId: reply.agentId,
          senderName: reply.senderName ?? 'Alpha',
          senderAvatar: agents.find(a => a.id === reply.agentId)?.avatar,
          content: reply.content,
          timestamp: reply.timestamp || new Date().toISOString(),
          isStreaming: false,
          thinkingProcess: reply.thinkingProcess,
          toolsExecuted: (reply.toolsExecuted || []).map((t: any) => ({
            name: t.toolName || t.name || 'tool',
            input: typeof t.parameters === 'object' ? JSON.stringify(t.parameters) : String(t.parameters || '{}'),
            output: t.output || 'Execution completed',
            durationMs: t.durationMs || 120
          }))
        })
      );

      const [firstReply, ...laterReplies] = replies;

      setChatThreads(prev => prev.map(t => {
        if (t.id !== targetThreadId) return t;
        const msgs = t.messages || [];
        return {
          ...t,
          // The last speaker is what the thread list should preview.
          lastMessageSnippet: replies[replies.length - 1].content.slice(0, 60) + '...',
          messages: [...msgs.map(m => m.id === streamingMsgId ? firstReply : m), ...laterReplies]
        };
      }));

      setChatMessages(prev => [
        ...prev.map(m => m.id === streamingMsgId ? firstReply : m),
        ...laterReplies
      ]);
    } catch (err: any) {
      console.warn('Real AI chat service unavailable, falling back to local persona:', err);

      /**
       * Say the daemon is unreachable, rather than answering for it.
       *
       * This used to reply "[Agent · model]: I have received your request …
       * Backend connection established." — a fabricated success, in an agent's
       * voice, at the exact moment the backend could not be reached. Nothing
       * had been received and no connection was established.
       */
      const fallbackMsg: ChatMessage = {
        ...streamingMsg,
        senderType: 'system',
        senderName: 'Alpha',
        senderAvatar: undefined,
        content: [
          'I could not reach the Alpha daemon, so nobody has seen this message yet.',
          '',
          `Reason: ${err?.message ?? 'the request failed'}`,
          '',
          'Check that the backend is running, then send it again.'
        ].join('\n'),
        isStreaming: false,
        thinkingProcess: undefined,
        toolsExecuted: []
      };

      setChatThreads(prev => prev.map(t => {
        if (t.id !== targetThreadId) return t;
        const msgs = t.messages || [];
        return {
          ...t,
          lastMessageSnippet: 'Could not reach the Alpha daemon.',
          messages: msgs.map(m => m.id === streamingMsgId ? fallbackMsg : m)
        };
      }));

      setChatMessages(prev => prev.map(m => m.id === streamingMsgId ? fallbackMsg : m));
    } finally {
      setIsAgentTyping(false);
    }

  };

  const clearChat = () => {
    if (!requireCapability('manage_chat')) return;
    const id = activeThreadId;
    if (!id) return;

    const previous = chatThreads.find(t => t.id === id)?.messages;
    setChatThreads(prev =>
      prev.map(t => (t.id === id ? { ...t, messages: [], lastMessageSnippet: '' } : t))
    );
    setChatMessages([]);

    // Emptied on the daemon too, session rows included — a resumed CLI session
    // would otherwise answer from the history that was just cleared.
    persist(
      () => apiService.clearChatMessages(id),
      () => { loadedThreadsRef.current.delete(id); },
      msg => {
        setChatThreads(prev =>
          prev.map(t => (t.id === id ? { ...t, messages: previous } : t))
        );
        showToast('Conversation not cleared', msg, 'error');
      }
    );
  };

  // Settings
  const updateSettings = (updates: Partial<WorkspaceSettings>) => {
    if (!requireCapability('manage_settings')) return;
    setSettings(prev => ({ ...prev, ...updates }));
  };

  /* ---------------------------------------------------------------------
   * Identity & access
   * ------------------------------------------------------------------ */

  /**
   * The member directory is the source for other people in the workspace.
   * GitHub identity is the source for the current person. There is no static
   * persona roster to fall back to when either service is empty.
   */
  const users = useMemo<User[]>(() => {
    const members = workspaceMembers
      .filter(member => member.status === 'active')
      .map(member => ({
        id: member.userId,
        name: member.userId,
        role: member.role
      }));

    const login = identity?.login?.trim();
    if (login && !members.some(member => member.id.toLowerCase() === login.toLowerCase())) {
      members.unshift({
        id: login,
        name: identity?.name?.trim() || login,
        role
      });
    }
    return members;
  }, [identity, role, workspaceMembers]);

  const currentUser = useMemo<User>(() => {
    const login = identity?.login?.trim();
    const member = login
      ? users.find(user => user.id.toLowerCase() === login.toLowerCase())
      : undefined;
    if (member) {
      return {
        ...member,
        name: identity?.name?.trim() || member.name,
        role
      };
    }
    return {
      id: login ?? '',
      name: identity?.name?.trim() || login || 'Current user',
      role
    };
  }, [identity, role, users]);
  const roomVisible = role !== 'client' && liveBuildRoomProjectIds.some(projectId => projects.some(project => project.id === projectId));
  const visibleTabs = roleTabs.filter(tab => tab !== 'live_build_room' || roomVisible);
  const can = (capability: Capability) => ROLE_CAPABILITIES[role].includes(capability);
  const requireCapability = (capability: Capability): boolean => {
    if (can(capability)) return true;
    showToast(
      'Permission required',
      `Your ${role} role cannot perform this action.`,
      'error'
    );
    return false;
  };

  useEffect(() => {
    if (activeTab === 'live_build_room' && !visibleTabs.includes('live_build_room')) {
      setActiveTab(roleTabs[0]);
    }
  }, [activeTab, roleTabs, visibleTabs]);

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

  const submitIntake = (answers: IntakeAnswers): RequirementDoc | null => {
    if (!requireCapability('submit_intake')) return null;
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
        answers.integrations ? `Integrations: ${answers.integrations}` : ''
      ].filter(Boolean),
      outOfScope: answers.outOfScope ? [answers.outOfScope] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setRequirementDocs(prev => [doc, ...prev]);

    setInbox(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'issue_assigned',
        title: `New request from ${doc.company || doc.clientName}`,
        message: `${identifier} — "${doc.title}". ${doc.functionalRequirements.length} requirements compiled. Awaiting PM review.`,
        read: false,
        audience: 'internal',
        timestamp: new Date().toISOString(),
        entityType: 'issue',
        entityId: doc.id,
        meta: { issueIdentifier: identifier }
      },
      ...prev
    ]);

    return doc;
  };

  const updateRequirementDoc = (id: string, updates: Partial<RequirementDoc>) => {
    if (!requireCapability('manage_documents')) return;
    setRequirementDocs(prev =>
      prev.map(d => (d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d))
    );
  };

  /** Include or exclude a requirement before the scope is approved. */
  const toggleRequirementIncluded = (docId: string, reqId: string) => {
    if (!requireCapability('manage_documents')) return;
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
  };

  const sendDocToClient = (docId: string) => {
    if (!requireCapability('manage_documents')) return;
    updateRequirementDoc(docId, { status: 'awaiting_client' });

    const doc = requirementDocs.find(d => d.id === docId);
    setInbox(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'agent_approval',
        title: `Specification ready for your review`,
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
   * The gate: approving the specification converts it into a project.
   * ------------------------------------------------------------------ */

  const approveScope = (docId: string): Project | undefined => {
    if (!requireCapability('approve_scope')) return undefined;
    const doc = requirementDocs.find(d => d.id === docId);
    if (!doc) return undefined;

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
      description: `${req.requirement}\n\nFrom ${doc.identifier} (approved rev ${doc.version}). Complexity band ${req.band}.`,
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
    setInbox(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'agent_completed',
        title: `${doc.identifier} approved — project created`,
        message: `${doc.clientName} approved the specification. ${newIssues.length} issues created in ${project.name}.`,
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

  const requestScopeChanges = (docId: string, reason: string) => {
    if (!requireCapability('approve_scope')) {
      return;
    }
    setRequirementDocs(prev =>
      prev.map(d => d.id === docId ? { ...d, status: 'in_review', updatedAt: new Date().toISOString() } : d)
    );

    const doc = requirementDocs.find(d => d.id === docId);
    setInbox(prev => [
      {
        id: `notif-${Date.now()}`,
        type: 'agent_failed',
        title: `Changes requested on ${doc?.identifier}`,
        message: reason || 'The client requested changes before approving the specification.',
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
    if (role === 'pm') return projects;
    // Developers fail closed. An empty assignment list means that no project
    // is currently authorized; it must never silently expand to the whole
    // workspace because a project URL, search result, or cached board could
    // expose another team's work.
    const assigned = currentUser.projectIds ?? [];
    return projects.filter(p => assigned.includes(p.id));
  }, [projects, requirementDocs, role, currentUser]);

  const scopedProjectIds = useMemo(() => scopedProjects.map(p => p.id), [scopedProjects]);

  /** Clients never see internal issues; developers see issues in assigned projects. */
  const scopedIssues = useMemo(() => {
    if (role === 'admin') return issues;
    if (role === 'client') return [];
    const inScope = issues.filter(i => scopedProjectIds.includes(i.projectId));
    if (role === 'pm') return inScope;
    return inScope;
  }, [issues, scopedProjectIds, role, currentUser]);

  /** Specifications: a client sees only their own; staff see their projects'. */
  const scopedDocs = useMemo(() => {
    if (role === 'admin') return requirementDocs;
    if (role === 'client') return requirementDocs.filter(d => d.clientId === currentUser.id);
    return requirementDocs.filter(d => !d.projectId || scopedProjectIds.includes(d.projectId));
  }, [requirementDocs, scopedProjectIds, role, currentUser]);

  /** Agents are catalog entries: clients cannot see them; developers can browse them. */
  const scopedAgents = useMemo(() => {
    if (role === 'client') return [];
    return agents;
  }, [agents, role]);

  const scopedSquads = useMemo(() => {
    if (role === 'client') return [];
    if (role === 'dev') {
      // Developer squad visibility is fail-closed. The daemon decorates squad
      // rows with the workspace owner; legacy/local rows without that field
      // must not silently become visible to every developer.
      return identity?.login ? squads.filter(squad => squad.ownerId === identity.login) : [];
    }
    return squads;
  }, [squads, role, identity]);

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

  /** Analytics is operational only; clients do not receive internal run data. */
  const scopedAnalytics = useMemo<AnalyticsData>(() => {
    if (role === 'admin' || role === 'pm') return analytics;
    if (role === 'client') {
      return { ...analytics, agentBreakdown: [], modelBreakdown: [], runTimeline: [] };
    }
    // A dev sees the activity of their own agents, not the whole workspace.
    const mine = scopedAgents.map(a => a.id);
    return {
      ...analytics,
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
      runPlanDrafts,
      saveRunPlanDraft,
      clearRunPlanDraft,
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
      addIssueComment,
      duplicateAgent,
      archiveAgent,
      restoreAgent,
      deleteAgent,
      bulkUpdateAgents,
      bulkArchiveAgents,
      squads: scopedSquads,
      createSquad,
      updateSquad,
      deleteSquad,
      squadRuns,
      identity,
      identityStatus,
      localMode,
      continueInLocalMode: () => setLocalMode(true),
      lastSyncedAt,
      syncing,
      syncBoard,
      refreshIdentity: async () => {
        // A retry from the unreachable screen shows progress; a refresh after
        // a team change must not blank a workspace that is already showing.
        setIdentityStatus(prev => (prev === 'ready' ? prev : 'loading'));
        try {
          // Re-read, not the cache: this runs after someone signs in or joins a team.
          const next = await apiService.getIdentity(true);
          setIdentity(next);
          setIdentityStatus('ready');
          if (next.github === 'ok') setLocalMode(false);
        } catch {
          // An unreachable daemon leaves the last answer standing.
          setIdentityStatus(prev => (prev === 'ready' ? prev : 'unreachable'));
        }
      },
      triggerSquadRun,
      runtimes,
      isScanningRuntimes,
      scanLocalRuntimes,
      setDefaultRuntime,
      skills,
      toggleSkill,
      isScanningSkills,
      scanInstalledSkills,
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
      setThreadProject,
      refreshChatThread,
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
      can,
      visibleTabs,
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      workspaceLoading,
      workspaceSwitching,
      switchWorkspace,
      createWorkspace,
      refreshWorkspaces,
      refreshLiveBuildRoomProjects,
      requirementDocs: scopedDocs,
      submitIntake,
      updateRequirementDoc,
      toggleRequirementIncluded,
      sendDocToClient,
      approveScope,
      requestScopeChanges,
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
