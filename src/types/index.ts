export type NavigationTab = 
  | 'inbox' 
  | 'chat' 
  | 'my_issues'
  | 'issues' 
  | 'projects' 
  | 'agents' 
  | 'squads' 
  | 'analytics' 
  | 'runtimes' 
  | 'skills' 
  | 'deployments' 
  | 'settings';

export interface TabItem {
  id: string;
  view: NavigationTab;
}

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'agent_running' | 'review' | 'done';
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignedAgentId?: string;
}

export interface IssueComment {
  id: string;
  authorType: 'user' | 'agent' | 'system';
  authorName: string;
  authorAvatar?: string;
  agentId?: string;
  content: string;
  createdAt: string;
  isThinking?: boolean;
}

export interface Issue {
  id: string;
  identifier: string; // e.g. ALF-101
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  projectId: string;
  assignedAgentId?: string;
  assignedSquadId?: string;
  assignedHuman?: string;
  labels: string[];
  subtasks: Subtask[];
  comments: IssueComment[];
  branchName?: string;
  prUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'active';
export type ProjectPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface ProjectResource {
  id: string;
  type: 'github_repo' | 'local_dir';
  name: string;
  pathOrUrl: string;
  branchOrMachine?: string;
}

export interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  color: string;
  icon: string;
  status: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: string;
  targetDate: string;
  leadType?: 'member' | 'agent';
  leadName?: string;
  leadAgentId?: string;
  leadSquadId?: string;
  resources?: ProjectResource[];
  progressPercentage?: number;
  totalIssues?: number;
  completedIssues?: number;
  milestones?: Milestone[];
  createdAt?: string;
}

export type AgentRole = 
  | 'Architect' 
  | 'Coder' 
  | 'Reviewer' 
  | 'QA Tester' 
  | 'DevOps Engineer' 
  | 'Researcher' 
  | 'Triager';

export type AgentAutonomyLevel = 
  | 'Supervised' 
  | 'Semi-Autonomous (Requires Approval)' 
  | 'Full Autonomy';

export type ModelProvider = 
  | 'Anthropic' 
  | 'OpenAI' 
  | 'DeepSeek' 
  | 'Ollama' 
  | 'LM Studio' 
  | 'Google Gemini' 
  | 'Groq';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'error' | 'offline';
export type ReachabilityStatus = 'online' | 'unstable' | 'offline';
export type WorkStatus = 'working' | 'queued' | 'idle';
export type AgentAccessLevel = 'everyone' | 'team' | 'admins' | 'private';

export interface AgentEnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface AgentRunLog {
  id: string;
  timestamp: string;
  issueKey?: string;
  command: string;
  status: 'success' | 'failed' | 'running';
  durationMs: number;
  outputSnippet: string;
}

export interface AgentStats {
  totalRuns: number;
  successRate: number;
  tokensUsed: number;
  avgLatencyMs: number;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  avatar: string;
  color: string;
  description?: string;
  owner?: string;
  isMine?: boolean;
  allowedUsers?: AgentAccessLevel;
  machineStatus?: ReachabilityStatus;
  workStatus?: WorkStatus;
  machineName?: string;
  lastActive?: string;
  isArchived?: boolean;
  concurrencyLimit?: number;
  envVars?: AgentEnvVar[];
  mcpServers?: string[];
  customCliArgs?: string;
  runHistory?: AgentRunLog[];
  activity30d?: number[];
  modelProvider: ModelProvider;
  modelName: string;
  runtimeId: string;
  systemPrompt: string;
  autonomyLevel: AgentAutonomyLevel;
  temperature: number;
  skills: string[]; // skill IDs
  stats: AgentStats;
  status: AgentStatus;
  currentTask?: string;
}

export type SquadTopology = 'hierarchical' | 'sequential' | 'swarm' | 'consensus';

export interface Squad {
  id: string;
  name: string;
  description: string;
  avatar: string;
  color: string;
  leaderAgentId: string;
  memberAgentIds: string[];
  topology: SquadTopology;
  mission: string;
  activeRunsCount: number;
  completedRunsCount: number;
}

export type RuntimeType = 'local' | 'cloud' | 'remote';
export type RuntimeStatus = 'online' | 'offline' | 'degraded' | 'scanning';

export interface RuntimeEngine {
  id: string;
  name: string;
  type: RuntimeType;
  provider: ModelProvider;
  endpoint: string;
  port?: number;
  status: RuntimeStatus;
  latencyMs: number;
  modelsLoaded: string[];
  vramUsageGb?: number;
  vramTotalGb?: number;
  gpuName?: string;
  isDefault: boolean;
  detectedAt?: string;
}

export type SkillCategory = 
  | 'File Operations' 
  | 'Browser & Web' 
  | 'Code Execution' 
  | 'Terminal & Shell' 
  | 'Git & GitHub' 
  | 'MCP Servers' 
  | 'Cloud & API';

export type SkillPermission = 'read_only' | 'write' | 'full_execution';

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  permissions: SkillPermission;
  parametersCount: number;
  enabled: boolean;
  source: 'builtin' | 'system_detected' | 'mcp_server';
  commandExample?: string;
}

export type DeploymentStatus = 'queued' | 'building' | 'agent_evaluating' | 'success' | 'failed';

export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  durationSec?: number;
  logs: string[];
}

export interface Deployment {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  environment: 'Production' | 'Staging' | 'Preview';
  status: DeploymentStatus;
  branch: string;
  commitSha: string;
  commitMessage: string;
  triggeredBy: {
    type: 'human' | 'agent';
    name: string;
    avatar?: string;
  };
  durationSec: number;
  startedAt: string;
  stages: PipelineStage[];
  previewUrl?: string;
}

export type NotificationType = 
  | 'agent_approval' 
  | 'issue_assigned' 
  | 'agent_completed' 
  | 'agent_failed' 
  | 'mention' 
  | 'deployment_status';

export interface InboxNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  archived?: boolean;
  timestamp: string;
  entityType: 'issue' | 'agent' | 'squad' | 'deployment';
  entityId: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  meta?: {
    agentName?: string;
    agentRole?: string;
    issueIdentifier?: string;
    proposedChanges?: string;
    costTokens?: number;
  };
}

export interface ToolExecutionRecord {
  name: string;
  input: string;
  output: string;
  durationMs: number;
}

export interface ChatMessage {
  id: string;
  senderType: 'user' | 'agent' | 'system';
  agentId?: string;
  squadId?: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  thinkingProcess?: string;
  toolsExecuted?: ToolExecutionRecord[];
  isStreaming?: boolean;
}

export interface ChatThread {
  id: string;
  title: string;
  agentIds: string[];
  squadId?: string;
  lastMessageAt: string;
  pinned: boolean;
  lastMessageSnippet?: string;
  isFailed?: boolean;
  iconType?: 'asterisk' | 'flame' | 'sparkle' | 'bot';
  messages?: ChatMessage[];
}

export interface AnalyticsData {
  totalTokens24h: number;
  totalCost24h: number;
  avgLatencyMs: number;
  totalAgentRuns: number;
  successRate: number;
  tokenTimeline: { hour: string; promptTokens: number; completionTokens: number; cost: number }[];
  agentBreakdown: { agentId: string; agentName: string; tokens: number; cost: number; runs: number; efficiency: number }[];
  modelBreakdown: { modelName: string; percentage: number; cost: number; totalCalls: number }[];
}

export interface WorkspaceSettings {
  workspaceName: string;
  workspaceSlug: string;
  activeTheme: 'dark' | 'midnight' | 'cyber';
  apiKeys: {
    openai: string;
    anthropic: string;
    gemini: string;
    groq: string;
    huggingface: string;
  };
  localRuntimeUrl: string;
  enableAutoTriage: boolean;
  defaultAutonomy: AgentAutonomyLevel;
  notificationsEnabled: boolean;
  telemetryEnabled: boolean;
  maxParallelAgentRuns: number;
}
