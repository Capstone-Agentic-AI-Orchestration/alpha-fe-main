import {
  Project,
  ProjectBinding,
  CheckoutStatus,
  Agent,
  AgentPersonaFile,
  Issue,
  IssueComment,
  Squad,
  Skill,
  RuntimeEngine,
  PrototypeRun,
  SquadRun,
  ChatThread,
  ChatMessage,
  ScaffoldStack,
  McpServer,
  McpServerInput,
  RemoteAction,
  Identity,
  AnalyticsData,
  WorkspaceSummary,
  WorkspaceProjectAssignment,
  WorkspaceSquadProjectAssignment,
  LiveBuildRoomSnapshot,
  UserRole,
  AgentCall,
  ProjectChatSnapshot,
  AgentCallMode,
  AgentCallTarget,
  ChatMessage as ProjectChatMessage
} from '@/shared/types';

import { API_BASE } from '@/shared/config';

const API_TOKEN = import.meta.env.VITE_ALPHA_LOCAL_TOKEN;
let activeWorkspaceId: string | null = null;

/** Bind subsequent daemon calls to the selected product workspace. */
export function setActiveWorkspaceId(workspaceId: string | null): void {
  activeWorkspaceId = workspaceId;
}

const SKILL_CATEGORIES: Skill['category'][] = [
  'File Operations',
  'Browser & Web',
  'Code Execution',
  'Terminal & Shell',
  'Git & GitHub',
  'MCP Servers',
  'Cloud & API',
  'Agent Skills'
];

const SKILL_CATEGORY_ALIASES: Record<string, Skill['category']> = {
  browser: 'Browser & Web',
  web: 'Browser & Web',
  terminal: 'Terminal & Shell',
  shell: 'Terminal & Shell',
  git: 'Git & GitHub',
  github: 'Git & GitHub',
  code: 'Code Execution',
  execution: 'Code Execution',
  file: 'File Operations',
  files: 'File Operations',
  mcp: 'MCP Servers',
  cloud: 'Cloud & API',
  api: 'Cloud & API'
};

const SKILL_SOURCES = new Set<Skill['source']>([
  'builtin',
  'system_detected',
  'mcp_server',
  'user',
  'project',
  'plugin'
]);

/**
 * Convert the daemon's wire shape into the frontend's stable Skill shape.
 *
 * The backend deliberately calls the persisted flag `isEnabled`; the client
 * uses `enabled` because that is what the cards and toggle state expose. Keep
 * this translation at the boundary so a fresh daemon snapshot cannot silently
 * make every skill look disabled or crash on missing presentation fields.
 */
export function normalizeSkill(raw: unknown): Skill {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawCategory = String(value.category ?? '').trim();
  const category = SKILL_CATEGORIES.includes(rawCategory as Skill['category'])
    ? rawCategory as Skill['category']
    : SKILL_CATEGORY_ALIASES[rawCategory.toLowerCase()] ?? 'MCP Servers';
  const rawPermission = String(value.permissions ?? 'read_only');
  const permissions: Skill['permissions'] =
    rawPermission === 'write' || rawPermission === 'full_execution' ? rawPermission : 'read_only';
  const rawEnabled = value.enabled ?? value.isEnabled;
  const enabled = typeof rawEnabled === 'string'
    ? rawEnabled.toLowerCase() === 'true'
    : Boolean(rawEnabled);
  const parametersCount = Number(value.parametersCount);

  return {
    id: String(value.id ?? ''),
    name: String(value.name ?? value.id ?? 'Unnamed skill'),
    description: String(value.description ?? ''),
    icon: String(value.icon ?? '✦'),
    category,
    permissions,
    parametersCount: Number.isFinite(parametersCount) && parametersCount >= 0 ? parametersCount : 0,
    enabled,
    source: SKILL_SOURCES.has(value.source as Skill['source'])
      ? value.source as Skill['source']
      : 'builtin',
    installed: value.installed === true || value.installed === 1,
    path: typeof value.path === 'string' ? value.path : undefined,
    commandExample: typeof value.commandExample === 'string' ? value.commandExample : undefined,
    grantedTools: Array.isArray(value.grantedTools)
      ? value.grantedTools.filter((tool): tool is string => typeof tool === 'string')
      : undefined
  };
}

/**
 * Convert the repository forms accepted by project resources into the
 * owner/name form used by GitHub's API and CLI. A project can store a browser
 * URL, an SSH remote, or an already-normalized owner/name value.
 */
export function normalizeGitHubRepo(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(trimmed)) return trimmed;

  const match = trimmed.match(
    /github\.com[/:]([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+?)(?:\.git)?\/?$/i
  );
  return match?.[1];
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    /**
     * Send the session cookie.
     *
     * Without this the browser never attaches it, because the API is a
     * different origin from the app — Vercel to Render. `fetch` omits
     * credentials cross-origin unless asked, so every request arrived
     * anonymous and the hosted app could not have signed anyone in.
     *
     * Safe against CSRF because the cookie is `SameSite=Lax` (a cross-site
     * POST carries nothing) and the API's CORS allowlist is exact — a wildcard
     * over a shared hosting apex is refused at parse time, precisely so this
     * line cannot be turned against us.
     */
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(activeWorkspaceId ? { 'X-Workspace-Id': activeWorkspaceId } : {}),
      ...(API_TOKEN ? { 'X-Alpha-Token': API_TOKEN } : {})
    },
    ...options
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    // The daemon answers failures with `{ "error": "..." }`. Unwrap it — a
    // message shown to a user should read as a sentence, not as a JSON blob
    // with the sentence buried inside it.
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed && typeof parsed.error === 'string') detail = parsed.error;
    } catch {
      /* not JSON — the raw text is the best we have */
    }
    throw new Error(`API Error [${res.status}]: ${detail}`);
  }
  return res.json();
}

export const apiService = {
  // Health
  checkHealth: () => fetchJson<{ status: string; version: string }>('/health'),

  // Projects
  /**
   * Pull the shared board down from GitHub.
   *
   * Returns what moved. The public sync route updates PM-owned projects that
   * already exist in Alpha; repository-to-project importing is explicit.
   */
  syncBoard: () =>
    fetchJson<{
      /** Optional count from an explicit repository importer. */
      projectsImported?: number;
      projects: number; created: number; updated: number; unchanged: number;
      skipped: { project: string; reason: string }[];
      errors: { project: string; detail: string }[];
    }>('/board/sync', { method: 'POST' }),

  /** Who the daemon thinks you are — a GitHub login where one is available. */
  /**
   * `refresh` asks the desktop daemon to re-read `gh` rather than answer from
   * its boot-time cache -- needed right after a sign-in made while the app was
   * open. The hosted API ignores it: a session is always current.
   */
  getIdentity: (refresh = false) => fetchJson<Identity>(refresh ? '/me?refresh=1' : '/me'),
  /** End the hosted session server-side, then clear the cookie. */
  signOut: () => fetchJson<{ success: boolean }>('/github/session/logout', { method: 'POST' }),
  /**
   * A ten-minute database token minted from this session, for Supabase
   * Realtime. Run channels are private, and this is what they check.
   */
  getDatabaseToken: () => fetchJson<{ token: string; expiresAt: string }>('/database/token'),
  getWorkspaces: () => fetchJson<WorkspaceSummary[]>('/workspaces'),
  createWorkspace: (payload: { name: string; slug?: string }) =>
    fetchJson<WorkspaceSummary>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getWorkspaceMembers: (workspaceId: string) =>
    fetchJson<Array<{ id: string; userId: string; role: UserRole; status: string; createdAt: string; updatedAt: string }>>(
      `/workspaces/${encodeURIComponent(workspaceId)}/members`
    ),
  /**
   * Put someone in this workspace at once, rather than sending them a code.
   *
   * A project manager staffing their workspace already knows who they want;
   * the person finds it waiting at their next sign-in.
   */
  addWorkspaceMember: (workspaceId: string, userId: string, role: UserRole) =>
    fetchJson<{ id: string; userId: string; role: UserRole; status: string; createdAt: string; updatedAt: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/members`,
      { method: 'POST', body: JSON.stringify({ userId, role }) }
    ),
  /** Who there is to add: the organisation's people, minus this workspace's. */
  getWorkspaceMemberCandidates: (workspaceId: string) =>
    fetchJson<Array<{ login: string; avatarUrl: string | null }>>(
      `/workspaces/${encodeURIComponent(workspaceId)}/members/candidates`
    ),
  updateWorkspaceMember: (workspaceId: string, memberId: string, updates: { role?: UserRole; status?: string }) =>
    fetchJson(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
  getProjectAssignments: (workspaceId: string, projectId: string) =>
    fetchJson<WorkspaceProjectAssignment[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/assignments`
    ),
  assignProjectMember: (workspaceId: string, projectId: string, userId: string) =>
    fetchJson<WorkspaceProjectAssignment>(
      `/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/assignments/${encodeURIComponent(userId)}`,
      { method: 'PUT' }
    ),
  removeProjectMember: (workspaceId: string, projectId: string, userId: string) =>
    fetchJson<{ success: boolean }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/assignments/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    ),
  /** Where this machine keeps a project's code. Null in the cloud, which has no checkout. */
  getProjectBinding: (projectId: string) =>
    fetchJson<ProjectBinding | null>(`/projects/${encodeURIComponent(projectId)}/binding`),
  /** Point this machine at a folder that already holds the project's code. */
  bindProject: (projectId: string, localDir: string) =>
    fetchJson<ProjectBinding>(`/projects/${encodeURIComponent(projectId)}/binding`, {
      method: 'PUT',
      body: JSON.stringify({ localDir })
    }),
  unbindProject: (projectId: string) =>
    fetchJson<{ success: boolean }>(`/projects/${encodeURIComponent(projectId)}/binding`, { method: 'DELETE' }),
  /** Clone the repository here and bind it, in one press. Safe to repeat. */
  cloneProject: (projectId: string) =>
    fetchJson<ProjectBinding>(`/projects/${encodeURIComponent(projectId)}/clone`, { method: 'POST' }),
  /** Branch, uncommitted work and unpushed commits, read from git now. */
  getProjectCheckoutStatus: (projectId: string) =>
    fetchJson<CheckoutStatus | null>(`/projects/${encodeURIComponent(projectId)}/binding/status`),
  getProjects: async (): Promise<Project[]> => {
    return fetchJson<Project[]>('/projects');
  },

  createProject: async (project: Partial<Project>): Promise<Project> => {
    return fetchJson<Project>('/projects', { method: 'POST', body: JSON.stringify(project) });
  },

  /**
   * Is this folder usable as a project working copy?
   *
   * Asked before saving so a bad path is reported while the person is looking
   * at the field, not during the workspace stage of an agent run.
   */
  checkWorkspace: (path: string) =>
    fetchJson<{ ok: boolean; problem?: string; detail?: string }>('/projects/check-workspace', {
      method: 'POST',
      body: JSON.stringify({ path })
    }),
  updateProject: (id: string, updates: Partial<Project>) =>
    fetchJson<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteProject: (id: string) =>
    fetchJson<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),

  // Agents
  getAgents: async (): Promise<Agent[]> => {
    return fetchJson<Agent[]>('/agents');
  },

  createAgent: (agent: Partial<Agent>) =>
    fetchJson<Agent>('/agents', { method: 'POST', body: JSON.stringify(agent) }),
  updateAgent: (id: string, updates: Partial<Agent>) =>
    fetchJson<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteAgent: (id: string) =>
    fetchJson<{ success: boolean }>(`/agents/${id}`, { method: 'DELETE' }),
  /**
   * Alpha's MCP catalog.
   *
   * Separate from anything the machine owner has configured for their own CLI:
   * agents are fenced to this list alone. `getMcpServers` returns built-ins and
   * catalog entries together, flagged, because the panel shows one list.
   *
   * The write calls return the whole list rather than the single row they
   * changed — saving one entry can flip another's `overridden` flag, and the
   * panel would otherwise render it stale.
   */
  getMcpServers: () => fetchJson<McpServer[]>('/mcp/servers'),
  saveMcpServer: (name: string, server: McpServerInput) =>
    fetchJson<McpServer[]>(`/mcp/servers/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(server)
    }),
  deleteMcpServer: (name: string) =>
    fetchJson<McpServer[]>(`/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  /**
   * The agent's persona file — `~/.alpha/agents/{id}.md` — as text.
   *
   * Separate from `updateAgent` because the two write different stores and one
   * overrides the other: the file wins for whatever its frontmatter declares.
   * `effective` is what the agent actually resolves to once the file is merged
   * over the database row, which is the only place that answer exists.
   */
  getAgentPersona: (id: string) => fetchJson<AgentPersonaFile>(`/agents/${id}/persona`),

  saveAgentPersona: (id: string, content: string) =>
    fetchJson<AgentPersonaFile>(`/agents/${id}/persona`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    }),

  /**
   * Create an agent from a persona file someone shared.
   *
   * The counterpart to downloading a persona file. An agent definition is data,
   * not execution, so it travels between machines without carrying the sender's
   * keys or subscription — the recipient runs it on their own CLI.
   */
  importAgent: (content: string) =>
    fetchJson<{ agent: Agent; warnings: string[] }>('/agents/import', {
      method: 'POST',
      body: JSON.stringify({ content })
    }),

  /**
   * One turn of the conversational agent builder. `message` is already the
   * encoded envelope — see `builderProtocol.encodeBuilderInput`. `sessionId` is
   * minted by the client and is what makes the next turn a continuation.
   */
  sendBuilderMessage: (payload: { sessionId: string; runtimeId: string; message: string }) =>
    fetchJson<{ content: string; runtimeId: string; provider: string; modelName: string }>(
      '/agents/builder/message',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  // Issues
  getIssues: async (): Promise<Issue[]> => {
    return fetchJson<Issue[]>('/issues');
  },

  createIssue: async (issue: Partial<Issue>): Promise<Issue> => {
    return fetchJson<Issue>('/issues', { method: 'POST', body: JSON.stringify(issue) });
  },

  updateIssue: (id: string, updates: Partial<Issue>) =>
    fetchJson<Issue>(`/issues/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  completeIssue: (id: string) =>
    fetchJson<Issue>('/issues/' + id + '/complete', {
      method: 'POST',
      body: JSON.stringify({ reviewed: true })
    }),
  deleteIssue: (id: string) =>
    fetchJson<{ success: boolean }>(`/issues/${id}`, { method: 'DELETE' }),
  addIssueComment: (issueId: string, comment: Partial<IssueComment>) =>
    fetchJson<IssueComment>(`/issues/${issueId}/comments`, { method: 'POST', body: JSON.stringify(comment) }),

  // Squads
  getSquads: () => fetchJson<Squad[]>('/squads'),
  createSquad: (squad: Partial<Squad>) =>
    fetchJson<Squad>('/squads', { method: 'POST', body: JSON.stringify(squad) }),
  updateSquad: (id: string, updates: Partial<Squad>) =>
    fetchJson<Squad>(`/squads/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteSquad: (id: string) =>
    fetchJson<{ success: boolean }>(`/squads/${id}`, { method: 'DELETE' }),
  getSquadProjectAssignments: (squadId: string) =>
    fetchJson<WorkspaceSquadProjectAssignment[]>(`/squads/${encodeURIComponent(squadId)}/projects`),
  assignSquadToProject: (squadId: string, projectId: string, relationship: 'owned' | 'assigned' = 'assigned') =>
    fetchJson<WorkspaceSquadProjectAssignment>(
      `/squads/${encodeURIComponent(squadId)}/projects/${encodeURIComponent(projectId)}`,
      { method: 'PUT', body: JSON.stringify({ relationship }) }
    ),
  removeSquadFromProject: (squadId: string, projectId: string) =>
    fetchJson<{ success: boolean }>(
      `/squads/${encodeURIComponent(squadId)}/projects/${encodeURIComponent(projectId)}`,
      { method: 'DELETE' }
    ),
  getLiveBuildRoom: (projectId: string) =>
    fetchJson<LiveBuildRoomSnapshot>(`/projects/${encodeURIComponent(projectId)}/live-build-room`),
  getLiveBuildRoomProjects: () =>
    fetchJson<Array<Pick<Project, 'id' | 'key' | 'name' | 'color'>>>('/live-build-room/projects'),

  // Skills
  getSkills: async (): Promise<Skill[]> => {
    const skills = await fetchJson<unknown[]>('/skills');
    return Array.isArray(skills) ? skills.map(normalizeSkill) : [];
  },
  scanSkills: async (): Promise<Skill[]> => {
    const skills = await fetchJson<unknown[]>('/skills/scan', { method: 'POST' });
    return Array.isArray(skills) ? skills.map(normalizeSkill) : [];
  },
  setSkillEnabled: (id: string, isEnabled: boolean) =>
    fetchJson<{ success: boolean }>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify({ isEnabled }) }),

  // Runtimes
  getRuntimes: () => fetchJson<RuntimeEngine[]>('/runtimes'),
  scanRuntimes: () => fetchJson<RuntimeEngine[]>('/runtimes/scan', { method: 'POST' }),

  // Runs
  getRuns: () => fetchJson<PrototypeRun[]>('/runs'),
  getAnalytics: () => fetchJson<AnalyticsData>('/analytics'),
  startRun: (payload: { issueId: string; agentId: string; plan?: string[]; scenario?: string }) =>
    fetchJson<PrototypeRun>('/runs/start', { method: 'POST', body: JSON.stringify(payload) }),
  /** Settle a run waiting at the review gate. */
  approveRun: (id: string, approved: boolean) =>
    fetchJson<PrototypeRun>(`/runs/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved })
    }),
  cancelRun: (id: string) =>
    fetchJson<{ success: boolean }>(`/runs/${id}/cancel`, { method: 'POST' }),
  /** What this run did to a remote — Alpha's pushes and the agent's, together. */
  getRemoteActions: (id: string) =>
    fetchJson<RemoteAction[]>(`/runs/${id}/remote-actions`),
  retryRun: (id: string) =>
    fetchJson<PrototypeRun>(`/runs/${id}/retry`, { method: 'POST' }),

  // Squad runs
  getSquadRuns: () => fetchJson<SquadRun[]>('/squad-runs'),
  getSquadRun: (id: string) =>
    fetchJson<SquadRun & { runs: PrototypeRun[] }>(`/squad-runs/${id}`),
  runSquad: (squadId: string, payload: { issueId: string; plan?: string[]; mission?: string }) =>
    fetchJson<SquadRun>(`/squads/${squadId}/run`, { method: 'POST', body: JSON.stringify(payload) }),

  // Chat
  getChatThreads: () => fetchJson<ChatThread[]>('/chat/threads'),
  /**
   * Point a thread at a project, or at nothing.
   *
   * Returns the thread plus `workspaceDir` — the directory that choice actually
   * resolved to, which is not always the obvious one when a project holds both
   * a scaffolded checkout and a hand-attached folder.
   */
  setThreadProject: (id: string, projectId: string | null) =>
    fetchJson<ChatThread & { workspaceDir: string | null; workspaceManaged: boolean | null }>(
      `/chat/threads/${id}`,
      { method: 'PUT', body: JSON.stringify({ projectId }) }
    ),
  createChatThread: (thread: Partial<ChatThread>) =>
    fetchJson<ChatThread>('/chat/threads', { method: 'POST', body: JSON.stringify(thread) }),
  /** Delete a conversation. Its messages cascade; its CLI session rows go too. */
  deleteChatThread: (id: string) =>
    fetchJson<{ success: boolean }>(`/chat/threads/${id}`, { method: 'DELETE' }),
  /** Empty a conversation but keep it. */
  clearChatMessages: (id: string) =>
    fetchJson<{ success: boolean; removed: number }>(`/chat/threads/${id}/messages`, {
      method: 'DELETE'
    }),
  getChatMessages: (threadId: string) => fetchJson<ChatMessage[]>(`/chat/threads/${threadId}/messages`),
  sendChatMessage: (payload: { threadId: string; content: string; senderName?: string }) =>
    fetchJson<{
      userMessage: ChatMessage;
      agentMessage: ChatMessage;
      /**
       * Every reply. More than one when a squad was addressed — each member
       * answers in turn. `agentMessage` is the first of these.
       */
      agentMessages?: ChatMessage[];
    }>('/chat/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getProjectChatAgents: (projectId: string) =>
    fetchJson<ProjectChatSnapshot>(`/projects/${encodeURIComponent(projectId)}/chat/available-agents`),
  createAgentCall: (
    projectId: string,
    threadId: string,
    payload: {
      squadId: string;
      agentId: string;
      mode: AgentCallMode;
      target?: AgentCallTarget;
      instruction: string;
      senderName?: string;
    }
  ) =>
    fetchJson<{ call: AgentCall; userMessage: ProjectChatMessage; agentMessage?: ProjectChatMessage }>(
      `/projects/${encodeURIComponent(projectId)}/chat/threads/${encodeURIComponent(threadId)}/agent-calls`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  getAgentCall: (id: string) =>
    fetchJson<{ call: AgentCall; agentMessage?: ProjectChatMessage }>(`/agent-calls/${encodeURIComponent(id)}`),
  getThreadAgentCalls: (projectId: string, threadId: string) =>
    fetchJson<{ calls: AgentCall[] }>(
      `/projects/${encodeURIComponent(projectId)}/chat/threads/${encodeURIComponent(threadId)}/agent-calls`
    ),
  confirmAgentCall: (id: string) =>
    fetchJson<{ call: AgentCall; agentMessage?: ProjectChatMessage }>(`/agent-calls/${encodeURIComponent(id)}/confirm`, {
      method: 'POST', body: JSON.stringify({})
    }),
  applyAgentCallPatch: (id: string) =>
    fetchJson<{ call: AgentCall; message: ProjectChatMessage }>(`/agent-calls/${encodeURIComponent(id)}/apply-patch`, {
      method: 'POST', body: JSON.stringify({ confirmed: true })
    }),
  cancelAgentCall: (id: string) =>
    fetchJson<{ call: AgentCall }>(`/agent-calls/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  retryAgentCall: (id: string) =>
    fetchJson<{ call: AgentCall; agentMessage?: ProjectChatMessage }>(`/agent-calls/${encodeURIComponent(id)}/retry`, {
      method: 'POST', body: JSON.stringify({})
    }),
  followUpAgentCall: (id: string, instruction: string) =>
    fetchJson<{ call: AgentCall; userMessage: ProjectChatMessage; agentMessage?: ProjectChatMessage }>(
      `/agent-calls/${encodeURIComponent(id)}/follow-up`,
      { method: 'POST', body: JSON.stringify({ instruction }) }
    ),

  // GitHub Core
  getGitHubAuth: () =>
    fetchJson<{
      authenticated: boolean;
      username?: string;
      protocol?: string;
      scopes?: string[];
      tokenSource?: 'keyring' | 'env' | 'oauth' | 'github_app';
      mode?: 'cli' | 'rest' | 'github_app';
      appInstalled?: boolean;
    }>('/github/auth'),
  checkGitHubAuth: () =>
    fetchJson<{
      authenticated: boolean;
      username?: string;
      protocol?: string;
      scopes?: string[];
      tokenSource?: 'keyring' | 'env' | 'oauth' | 'github_app';
      envVarName?: string;
      mode?: 'cli' | 'rest' | 'github_app';
    }>('/github/auth'),
  getGitHubRepos: () => fetchJson<any[]>('/github/repos'),
  getGitHubRuns: (cwd?: string) => fetchJson<any[]>(`/github/runs${cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''}`),
  dispatchWorkflow: (payload: { projectId: string; cwd: string; workflow?: string; ref?: string; inputs?: Record<string, string> }) =>
    fetchJson<{ workflow: string; ref: string; ownerRepo?: string }>('/github/dispatch', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getGitHubRunLogs: (runId: string | number, cwd?: string) =>
    fetchJson<{ logs: string }>(`/github/runs/${runId}/logs${cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''}`),
  createGitHubPR: (payload: { cwd?: string; title: string; body: string; base?: string; headBranch?: string }) =>
    fetchJson<{ prUrl: string }>('/github/pr', { method: 'POST', body: JSON.stringify(payload) }),
  mergeGitHubPR: (payload: { cwd?: string; prUrl: string; method?: string }) =>
    fetchJson<{ success: boolean; result?: any }>('/github/merge', { method: 'POST', body: JSON.stringify(payload) }),

  // GitHub OAuth & App
  getGitHubOAuthUrl: () => fetchJson<{ url: string; state: string }>('/github/oauth/url'),
  getGitHubAppInstallUrl: () => fetchJson<{ url: string }>('/github/app/install-url'),
  startGitHubLogin: () =>
    fetchJson<{ code: string; verificationUrl: string }>('/github/auth/login', { method: 'POST' }),
  githubLogout: () => fetchJson<{ success: boolean }>('/github/auth/logout', { method: 'POST' }),
  listGitHubOrgs: () => fetchJson<Array<{ login: string; role: string }>>('/github/orgs'),

  createGitHubRepo: (payload: {
    name: string;
    visibility?: 'private' | 'public' | 'internal';
    description?: string;
    org?: string;
    initReadme?: boolean;
  }) =>
    fetchJson<{ url: string; nameWithOwner: string }>('/github/repos', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  /**
   * Create an organization repository that starts with a project structure.
   * The organization comes from the project; `org` only seeds it the first time.
   */
  scaffoldGitHubRepo: (payload: {
    projectId: string;
    repoName: string;
    stack: ScaffoldStack;
    org?: string;
    visibility?: 'private' | 'public';
    shape?: string;
    includeDocker?: boolean;
  }) =>
    fetchJson<{ url: string; nameWithOwner: string; localPath: string; files: string[] }>(
      '/github/repos/scaffold',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  cloneGitHubRepo: (payload: { repo: string; intoDir: string }) =>
    fetchJson<{ path: string }>('/github/repos/clone', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  inspectRepo: (cwd: string) =>
    fetchJson<{
      isRepo: boolean;
      remote?: string;
      branch?: string;
      workflows: string[];
      hasReadme: boolean;
    }>(`/github/inspect?cwd=${encodeURIComponent(cwd)}`)
};
