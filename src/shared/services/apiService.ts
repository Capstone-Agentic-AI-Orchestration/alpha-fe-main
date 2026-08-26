import {
  Project,
  Agent,
  Issue,
  IssueComment,
  Squad,
  Skill,
  RuntimeEngine,
  PrototypeRun,
  ChatThread,
  ChatMessage,
  ScaffoldStack
} from '@/shared/types';
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
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
  getProjects: async (): Promise<Project[]> => {
    try {
      return await fetchJson<Project[]>('/projects');
    } catch (err) {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from('projects').select('*');
        if (!error && data) {
          return data.map((p: any) => ({
            id: p.id,
            name: p.name,
            key: p.key,
            description: p.description || '',
            color: p.color || '#6366f1',
            icon: p.icon || '⚡',
            status: p.status || 'in_progress',
            priority: p.priority || 'medium',
            startDate: p.start_date,
            targetDate: p.target_date,
            leadType: p.lead_type || 'agent',
            leadName: p.lead_name,
            leadAgentId: p.lead_agent_id,
            resources: p.resources || [],
            totalIssues: 0,
            completedIssues: 0,
            progressPercentage: 0
          }));
        }
      }
      throw err;
    }
  },

  createProject: async (project: Partial<Project>): Promise<Project> => {
    try {
      return await fetchJson<Project>('/projects', { method: 'POST', body: JSON.stringify(project) });
    } catch (err) {
      if (isSupabaseConfigured() && supabase) {
        const payload = {
          name: project.name,
          key: project.key,
          description: project.description,
          color: project.color,
          icon: project.icon,
          status: project.status,
          priority: project.priority,
          lead_type: project.leadType,
          lead_name: project.leadName,
          lead_agent_id: project.leadAgentId,
          resources: project.resources || []
        };
        const { data, error } = await supabase.from('projects').insert(payload).select().single();
        if (!error && data) return data as any;
      }
      throw err;
    }
  },

  updateProject: (id: string, updates: Partial<Project>) =>
    fetchJson<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteProject: (id: string) =>
    fetchJson<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),

  // Agents
  getAgents: async (): Promise<Agent[]> => {
    try {
      return await fetchJson<Agent[]>('/agents');
    } catch (err) {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from('agents').select('*');
        if (!error && data) {
          return data.map((a: any) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            avatar: a.avatar,
            color: a.color,
            description: a.description,
            owner: a.owner,
            isMine: a.is_mine,
            modelProvider: a.model_provider,
            modelName: a.model_name,
            runtimeId: a.runtime_id || 'claude-3-7-sonnet',
            systemPrompt: a.system_prompt,
            autonomyLevel: a.autonomy_level,
            temperature: a.temperature ?? 0.7,
            skills: a.skills || [],
            mcpServers: a.mcp_servers || [],
            customCliArgs: a.custom_cli_args,
            envVars: a.env_vars || [],
            isArchived: a.is_archived,
            createdAt: a.created_at,
            stats: { totalRuns: 0, successRate: 100, tokensUsed: 0, avgLatencyMs: 0 },
            status: 'idle'
          }));
        }
      }
      throw err;
    }
  },

  createAgent: (agent: Partial<Agent>) =>
    fetchJson<Agent>('/agents', { method: 'POST', body: JSON.stringify(agent) }),
  updateAgent: (id: string, updates: Partial<Agent>) =>
    fetchJson<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteAgent: (id: string) =>
    fetchJson<{ success: boolean }>(`/agents/${id}`, { method: 'DELETE' }),

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
    try {
      return await fetchJson<Issue[]>('/issues');
    } catch (err) {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from('issues').select('*');
        if (!error && data) {
          return data.map((i: any) => ({
            id: i.id,
            identifier: i.identifier,
            title: i.title,
            description: i.description || '',
            status: i.status || 'todo',
            priority: i.priority || 'medium',
            projectId: i.project_id,
            assignedAgentId: i.assigned_agent_id,
            assignedHuman: i.assigned_human,
            labels: i.labels || [],
            subtasks: i.subtasks || [],
            branchName: i.branch_name,
            prUrl: i.pr_url,
            createdAt: i.created_at,
            updatedAt: i.updated_at,
            comments: []
          }));
        }
      }
      throw err;
    }
  },

  createIssue: async (issue: Partial<Issue>): Promise<Issue> => {
    try {
      return await fetchJson<Issue>('/issues', { method: 'POST', body: JSON.stringify(issue) });
    } catch (err) {
      if (isSupabaseConfigured() && supabase) {
        const payload = {
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
          status: issue.status,
          priority: issue.priority,
          project_id: issue.projectId,
          assigned_agent_id: issue.assignedAgentId,
          assigned_human: issue.assignedHuman,
          labels: issue.labels || [],
          subtasks: issue.subtasks || [],
          branch_name: issue.branchName,
          pr_url: issue.prUrl
        };
        const { data, error } = await supabase.from('issues').insert(payload).select().single();
        if (!error && data) return data as any;
      }
      throw err;
    }
  },

  updateIssue: (id: string, updates: Partial<Issue>) =>
    fetchJson<Issue>(`/issues/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteIssue: (id: string) =>
    fetchJson<{ success: boolean }>(`/issues/${id}`, { method: 'DELETE' }),
  addIssueComment: (issueId: string, comment: Partial<IssueComment>) =>
    fetchJson<IssueComment>(`/issues/${issueId}/comments`, { method: 'POST', body: JSON.stringify(comment) }),

  // Squads
  getSquads: () => fetchJson<Squad[]>('/squads'),
  createSquad: (squad: Partial<Squad>) =>
    fetchJson<Squad>('/squads', { method: 'POST', body: JSON.stringify(squad) }),

  // Skills
  getSkills: () => fetchJson<Skill[]>('/skills'),
  setSkillEnabled: (id: string, isEnabled: boolean) =>
    fetchJson<{ success: boolean }>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify({ isEnabled }) }),

  // Runtimes
  getRuntimes: () => fetchJson<RuntimeEngine[]>('/runtimes'),
  scanRuntimes: () => fetchJson<RuntimeEngine[]>('/runtimes/scan', { method: 'POST' }),

  // Runs
  getRuns: () => fetchJson<PrototypeRun[]>('/runs'),
  startRun: (payload: { issueId: string; agentId: string; plan?: string[]; scenario?: string }) =>
    fetchJson<PrototypeRun>('/runs/start', { method: 'POST', body: JSON.stringify(payload) }),
  cancelRun: (id: string) =>
    fetchJson<{ success: boolean }>(`/runs/${id}/cancel`, { method: 'POST' }),
  retryRun: (id: string) =>
    fetchJson<PrototypeRun>(`/runs/${id}/retry`, { method: 'POST' }),

  // Chat
  getChatThreads: () => fetchJson<ChatThread[]>('/chat/threads'),
  createChatThread: (thread: Partial<ChatThread>) =>
    fetchJson<ChatThread>('/chat/threads', { method: 'POST', body: JSON.stringify(thread) }),
  getChatMessages: (threadId: string) => fetchJson<ChatMessage[]>(`/chat/threads/${threadId}/messages`),
  sendChatMessage: (payload: { threadId: string; content: string; senderName?: string }) =>
    fetchJson<{ userMessage: ChatMessage; agentMessage: ChatMessage }>('/chat/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

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
