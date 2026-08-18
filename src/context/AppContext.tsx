import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  ToastMessage
} from '../types';
import { 
  initialIssues, 
  initialProjects, 
  initialAgents, 
  initialSquads, 
  initialRuntimes, 
  initialSkills, 
  initialDeployments, 
  initialInbox, 
  initialAnalytics, 
  initialSettings, 
  initialChatMessages,
  initialChatThreads
} from '../data/mockData';

interface AppContextType {
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
  createProject: (project: Omit<Project, 'id' | 'totalIssues' | 'completedIssues' | 'progressPercentage' | 'milestones'>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  
  // Agents
  agents: Agent[];
  createAgent: (agent: Omit<Agent, 'id' | 'stats' | 'status'>) => Agent;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_PREFIX = 'alpha_multica_';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialDefaultTabs: TabItem[] = [{ id: 'tab-default', view: 'issues' }];

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

  // Calculate current active tab view
  const currentTab = tabs.find(t => t.id === activeTabId) || tabs[0] || initialDefaultTabs[0];
  const activeTab: NavigationTab = currentTab ? currentTab.view : 'issues';

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
  const openNewTab = (view: NavigationTab = 'issues') => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: TabItem = { id: newTabId, view };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const closeTab = (tabIdToClose: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabIdToClose);
      if (filtered.length === 0) {
        const fallbackTab: TabItem = { id: `tab-${Date.now()}`, view: 'issues' };
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

  const [issues, setIssues] = useState<Issue[]>(() => loadFromStorage('issues', initialIssues));
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage('projects', initialProjects));
  const [agents, setAgents] = useState<Agent[]>(() => loadFromStorage('agents', initialAgents));
  const [squads, setSquads] = useState<Squad[]>(() => loadFromStorage('squads', initialSquads));
  const [runtimes, setRuntimes] = useState<RuntimeEngine[]>(() => loadFromStorage('runtimes', initialRuntimes));
  const [skills, setSkills] = useState<Skill[]>(() => loadFromStorage('skills', initialSkills));
  const [deployments, setDeployments] = useState<Deployment[]>(() => loadFromStorage('deployments', initialDeployments));
  const [inbox, setInbox] = useState<InboxNotification[]>(() => loadFromStorage('inbox', initialInbox));
  const [analytics, setAnalytics] = useState<AnalyticsData>(() => loadFromStorage('analytics', initialAnalytics));
  const [settings, setSettings] = useState<WorkspaceSettings>(() => loadFromStorage('settings', initialSettings));
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(() => loadFromStorage('chat_threads', initialChatThreads));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadFromStorage('chat_messages', initialChatMessages));
  const [prototypeRuns, setPrototypeRuns] = useState<PrototypeRun[]>(() => loadFromStorage('prototype_runs', []));
  const [runSetupIssueId, setRunSetupIssueId] = useState<string | null>(null);
  const [runSetupAgentId, setRunSetupAgentId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const handledRunEventsRef = useRef<Set<string>>(new Set());

  const [isScanningRuntimes, setIsScanningRuntimes] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [activeChatAgentId, setActiveChatAgentId] = useState<string | null>(null);
  const [activeChatSquadId, setActiveChatSquadId] = useState<string | null>(null);

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

  // Unread inbox count
  const unreadInboxCount = inbox.filter(n => !n.read).length;

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
      timestamp: new Date().toISOString(),
      entityType: 'issue',
      entityId: newIssue.id,
      meta: {
        issueIdentifier: identifier
      }
    };
    setInbox(prev => [newNotification, ...prev]);

    return newIssue;
  };

  const updateIssueStatus = (id: string, status: IssueStatus) => {
    setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, status, updatedAt: new Date().toISOString() } : iss));
  };

  const updateIssue = (id: string, updates: Partial<Issue>) => {
    setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, ...updates, updatedAt: new Date().toISOString() } : iss));
  };

  const deleteIssue = (id: string) => {
    setIssues(prev => prev.filter(iss => iss.id !== id));
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
        content: `Started the approved prototype plan for ${targetIssue.identifier}. Progress is available in the run timeline.`,
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
    return run;
  };

  const cancelPrototypeRun = (runId: string) => {
    const run = prototypeRuns.find(item => item.id === runId);
    if (!run || run.status !== 'running') return;
    const now = new Date().toISOString();

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
    showToast('Run cancelled', 'No prototype changes were submitted for review.', 'info');
  };

  const retryPrototypeRun = (runId: string) => {
    const run = prototypeRuns.find(item => item.id === runId);
    if (!run || !['failed', 'changes_requested', 'cancelled'].includes(run.status)) return;
    const now = new Date().toISOString();

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
        content: 'Run restarted with the previous plan and a clean simulated workspace.',
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
        if (nowMs - new Date(startedAt).getTime() < currentStage.durationMs) return run;

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
          ...agent.stats,
          totalRuns: agent.stats.totalRuns + 1
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

  // Projects
  const createProject = (input: Omit<Project, 'id' | 'totalIssues' | 'completedIssues' | 'progressPercentage' | 'milestones'>): Project => {
    const newProj: Project = {
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
    setProjects(prev => [newProj, ...prev]);
    return newProj;
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
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
    return newAgent;
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
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
    setAgents(prev => prev.filter(a => a.id !== id));
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
    // Simulate real port scan
    await new Promise(r => setTimeout(r, 1800));

    setRuntimes(prev => {
      const now = new Date().toISOString();
      return prev.map(rt => {
        if (rt.type === 'local') {
          return {
            ...rt,
            status: 'online',
            latencyMs: Math.floor(Math.random() * 15) + 12,
            detectedAt: now
          };
        }
        return rt;
      });
    });

    setIsScanningRuntimes(false);
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
          content: 'Review approved. A simulated Preview validation has started.',
          createdAt: now
        }],
        updatedAt: now
      } : issue));
      void triggerDeployment(run.projectId, 'Preview', { issueId: run.issueId, runId: run.id });
      showToast('Review approved', 'Preview validation is now running in CI/CD.', 'success');
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
    const newThread: ChatThread = {
      id: newThreadId,
      title,
      lastMessageSnippet: 'Ready for instructions...',
      lastMessageAt: new Date().toISOString(),
      pinned: false,
      iconType: 'asterisk',
      agentIds: [agents[0]?.id || 'agent-1'],
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
      senderName: 'You (Lead)',
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

    await new Promise(r => setTimeout(r, 1400));

    // Dynamic response generator based on agent role
    let responseText = '';
    const tools: { name: string; input: string; output: string; durationMs: number }[] = [];

    if (responder.role === 'Architect') {
      responseText = `I've evaluated your request from an architectural standpoint.\n\n### System Blueprint\n1. **State Isolation**: Ensure the orchestration event bus handles concurrent agent invocations with optimistic concurrency control.\n2. **Runtime Routing**: Routed through **${responder.modelName}** with fallback to local Ollama.\n3. **Action Item**: Created task card and delegated implementation to @Kaelen.`;
      tools.push({ name: 'mcp.architecture.verify', input: '{ "spec": "event-loop" }', output: 'Topology validated. 0 cyclic dependencies.', durationMs: 190 });
    } else if (responder.role === 'Coder') {
      responseText = `On it! I've inspected the workspace files and prepared the patch.\n\n\`\`\`typescript\n// Generated typed orchestration hook\nexport function useAgentStream(agentId: string) {\n  const [state, setState] = useState<AgentStatus>('idle');\n  // Heartbeat reconnect loop with full jitter\n  return { state, emitAction: async () => {} };\n}\n\`\`\`\n\nAll linting checks and type contracts satisfied.`;
      tools.push({ name: 'fs.write_file', input: '{ "path": "src/hooks/useAgentStream.ts" }', output: 'Saved successfully.', durationMs: 95 });
      tools.push({ name: 'bash.exec', input: '{ "command": "npx tsc --noEmit" }', output: 'TypeScript compilation: 0 errors.', durationMs: 310 });
    } else if (responder.role === 'Reviewer') {
      responseText = `Security and static analysis complete.\n\n- **Injection Hazards**: None detected.\n- **Concurrency Locks**: Safe.\n- **Rating**: 9.9/10. Approved for merge.`;
      tools.push({ name: 'sandbox.run', input: '{ "linter": "semgrep" }', output: 'Passed 128 security rules.', durationMs: 240 });
    } else {
      responseText = `Task processed successfully by **${responder.name}**. All parameters verified and pipeline updated.`;
    }

    const finalAgentMsg: ChatMessage = {
      ...streamingMsg,
      content: responseText,
      isStreaming: false,
      thinkingProcess: `Generated complete response via ${responder.modelName} in 420ms (382 tokens).`,
      toolsExecuted: tools
    };

    setChatThreads(prev => prev.map(t => {
      if (t.id !== targetThreadId) return t;
      const msgs = t.messages || [];
      return {
        ...t,
        lastMessageSnippet: responseText.slice(0, 60) + '...',
        messages: msgs.map(m => m.id === streamingMsgId ? finalAgentMsg : m)
      };
    }));

    setChatMessages(prev => prev.map(m => m.id === streamingMsgId ? finalAgentMsg : m));
    setIsAgentTyping(false);

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

  return (
    <AppContext.Provider value={{
      activeTab,
      setActiveTab,
      tabs,
      activeTabId,
      setActiveTabId,
      openNewTab,
      closeTab,
      commandPaletteOpen,
      setCommandPaletteOpen,
      issues,
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
      projects,
      createProject,
      updateProject,
      deleteProject,
      agents,
      createAgent,
      updateAgent,
      duplicateAgent,
      archiveAgent,
      restoreAgent,
      deleteAgent,
      bulkUpdateAgents,
      bulkArchiveAgents,
      squads,
      createSquad,
      triggerSquadRun,
      runtimes,
      isScanningRuntimes,
      scanLocalRuntimes,
      setDefaultRuntime,
      skills,
      toggleSkill,
      deployments,
      triggerDeployment,
      inbox,
      unreadInboxCount,
      markNotificationRead,
      markAllNotificationsRead,
      archiveNotification,
      handleApproval,
      analytics,
      chatThreads,
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
      settings,
      updateSettings,
      toasts,
      showToast,
      dismissToast
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
