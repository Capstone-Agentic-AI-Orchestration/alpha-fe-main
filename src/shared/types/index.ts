export type NavigationTab =
  | 'portal'
  | 'intake'
  | 'documents'
  | 'inbox'
  | 'chat'
  | 'issues'
  | 'projects'
  | 'agents'
  | 'squads'
  | 'live_build_room'
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
  /**
   * Who created it — a GitHub login, or an OS username when GitHub is not
   * signed in. Absent on issues written before Alpha recorded it, which is why
   * the "Mine" filter treats absence as "not yours" rather than guessing.
   */
  createdBy?: string;
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

/**
 * One thing Alpha, an agent, or a person did to a remote repository.
 *
 * `actor` is the point: agents reach GitHub through MCP tools and Alpha's
 * pipeline pushes on their behalf, and until this existed neither left a record
 * the UI could show. A failed or refused attempt is recorded too — an agent
 * trying to push to a protected branch is exactly what a reviewer wants to see.
 */
export interface RemoteAction {
  id: string;
  runId?: string;
  agentId?: string;
  issueId?: string;
  actor: 'agent' | 'alpha' | 'user';
  action: string;
  target?: string;
  detail?: string;
  succeeded: boolean;
  createdAt: string;
}

export type PrototypeRunStatus =
  /**
   * Accepted, but not started: another run holds this project's checkout.
   *
   * Runs on one project share a working directory, so the daemon serialises
   * them. A run that is waiting says so rather than showing a progress bar for
   * work no process has begun.
   */
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'validating'
  | 'failed'
  | 'changes_requested'
  | 'cancelled'
  | 'completed';

export type PrototypeRunStageStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped';

export interface PrototypeRunStage {
  id: string;
  label: string;
  description: string;
  status: PrototypeRunStageStatus;
  durationMs?: number;
  logs: string[];
  startedAt?: string;
  completedAt?: string;
}

export type RunActivityKind =
  | 'assistant'
  | 'tool'
  | 'tool_result'
  | 'status'
  | 'error'
  | 'summary';

export interface RunActivity {
  id: string;
  sequence: number;
  kind: RunActivityKind;
  message: string;
  createdAt: string;
  stageId?: string;
  streamKey?: string;
  isStreaming?: boolean;
  /** True when this entry received at least one incremental provider fragment. */
  streamed?: boolean;
  detail?: string;
}

export interface PrototypeRun {
  id: string;
  issueId: string;
  projectId: string;
  agentId: string;
  status: PrototypeRunStatus;
  scenario?: 'success' | 'test_failure' | 'review_required';
  plan: string[];
  stages: PrototypeRunStage[];
  activities?: RunActivity[];
  currentStageIndex: number;
  createdAt: string;
  updatedAt: string;
  branchName?: string;
  prUrl?: string;
  changedFiles?: number;
  insertions?: number;
  deletions?: number;
  testSummary?: string;
  usage?: RunUsage;
  /** Set when this run is one member's turn inside a squad run. */
  squadRunId?: string;
  /** This member's position in the squad's order, 0-based. */
  squadOrder?: number;
}

/**
 * Token and cost figures the CLI reported for a run.
 *
 * Every field is optional and absence is meaningful: it means the CLI did not
 * report that figure, not that the figure was zero. codex reports no cache
 * reads, Claude no separate thinking tokens, Antigravity no cost — so render
 * a missing value as unknown rather than as 0.
 */
export interface RunUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  thinkingTokens?: number;
  costUsd?: number;
  numTurns?: number;
}

/**
 * One squad working one issue: an ordered list of member runs sharing a branch.
 *
 * Until this existed, "run squad" incremented a counter and set a 4.5 second
 * timer — no endpoint, no process, no agent.
 */
export interface SquadRun {
  id: string;
  squadId: string;
  issueId: string;
  projectId: string;
  branchName: string;
  memberAgentIds: string[];
  currentMemberIndex: number;
  status: 'running' | 'awaiting_approval' | 'failed' | 'cancelled';
  mission: string;
  plan: string[];
  /** Why the squad stopped early, when it did. */
  stoppedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'error';
}

export type ProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'active';
export type ProjectPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

/** Stacks the scaffold can generate, in the order the UI offers them. */
export type ScaffoldStack = 'nodejs' | 'nestjs' | 'nextjs' | 'react';

export interface ProjectResource {
  id: string;
  /**
   * Mirrors the daemon's `ProjectResource['type']`, which this was missing two
   * members of.
   *
   * `local_path` is the one that matters: it is what an attached working copy
   * is stored as, and what `resolveProjectWorkspace` looks for. The seeded
   * project used it, so the client has always received values its own type said
   * were impossible — narrowing that TypeScript could not catch, because the
   * data arrives as JSON.
   */
  type: 'github_repo' | 'local_path' | 'local_dir' | 'documentation' | 'api_endpoint';
  name: string;
  pathOrUrl: string;
  branchOrMachine?: string;
  /** Stack the scaffold was generated from. Absent on attached repositories. */
  stack?: ScaffoldStack;
  /** Repository shape the scaffold used. Absent on attached repositories. */
  shape?: string;
  /** Managed working copy on this machine, when Alpha created or cloned it. */
  localPath?: string;
}

export interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
}

export interface Project {
  /**
   * Values this project resolves `${VAR}` against in MCP server definitions.
   *
   * The MCP catalog is global, so one Supabase entry serves every project —
   * this is what makes it point at a different Supabase project per board.
   * Overrides the daemon's environment; an agent's own envVars override these.
   */
  envVars?: { key: string; value: string; isSecret?: boolean }[];
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
  /**
   * GitHub organization every repository for this project is created under.
   * Alpha creates no personal repositories, so a project without one cannot
   * create a repository until it is set.
   */
  githubOrg?: string;
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
  | 'Triager'
  | 'Research Agent'
  | 'Architecture Agent'
  | 'Manager Agent'
  | 'Database Agent'
  | 'Backend Agent'
  | 'Frontend Agent'
  | 'Mobile Agent'
  | 'Security / Code Quality Agent'
  | 'Validation / Checking Agent'
  | 'GitHub Finalization Agent';

export type AgentPhase = 'Planning' | 'Development' | 'Validation' | 'Finalization';

export type AgentAutonomyLevel = 
  | 'Supervised' 
  | 'Semi-Autonomous (Requires Approval)' 
  | 'Full Autonomy';

export type ModelProvider =
  | 'Anthropic'
  | 'OpenAI'
  /**
   * Google Antigravity (`agy`). Fronts Gemini 3.x, Claude and GPT-OSS through a
   * single CLI, and is what is actually installed on a machine with the
   * Antigravity IDE — the standalone `gemini` CLI usually is not.
   */
  | 'Antigravity'
  | 'DeepSeek'
  | 'Ollama'
  | 'LM Studio'
  | 'Google Gemini'
  | 'Groq'
  | 'OpenCode';

/** Effort values shared by the local CLI runtimes. Empty means Auto. */
export type ReasoningEffort =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'ultra';

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
  /** Summed across this agent's runs, cache reads included. 0 until it runs. */
  tokensUsed: number;
  avgLatencyMs: number;
  /**
   * What the CLIs said the equivalent API calls would have cost. Alpha spawns
   * subscription CLIs, so this is a comparison figure, not a bill — and it is
   * absent for any provider whose CLI does not report cost.
   */
  costUsd?: number;
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
  /** Stable key for an official agent template seeded by the local daemon. */
  templateKey?: string;
  /** Template revision used when the local agent record was created. */
  templateVersion?: number;
  /** Paper-aligned delivery phase for official agent roles. */
  phase?: AgentPhase;
  /** True for Alpha's built-in, idempotently seeded role instances. */
  isSeeded?: boolean;
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
  /** Optional; when absent the selected runtime uses its model default. */
  reasoningEffort?: ReasoningEffort | null;
  runtimeId: string;
  systemPrompt: string;
  autonomyLevel: AgentAutonomyLevel;
  temperature: number;
  skills: string[]; // skill IDs
  stats: AgentStats;
  status: AgentStatus;
  currentTask?: string;
  /**
   * Fields whose value comes from the agent's persona file rather than the
   * database, and which therefore cannot be changed from these controls.
   *
   * The daemon merges the file over the row before returning an agent, so the
   * values here are what the agent will actually run with. This list is what
   * lets the UI say so instead of offering an input that silently reverts.
   */
  managedByFile?: string[];
  /**
   * Whether the CLI behind this agent is usable on this machine.
   *
   * Alpha stores no provider credentials — agents run by spawning `claude`,
   * `codex` or `agy`, which authenticate from the machine's own keychain. So an
   * agent is only as available as its CLI, and that differs per person. Shown
   * on the roster because that is where someone looks before sending a message,
   * rather than after one has already failed.
   */
  readiness?: AgentReadiness;
}

/**
 * One MCP server in Alpha's catalog.
 *
 * Alpha's own registry is the whole list an agent can be granted from — the
 * runner passes `--strict-mcp-config` unconditionally, so nothing configured
 * for the machine owner's personal CLI is reachable from here.
 */
/** How a server is reached: a process Alpha spawns, or a URL it connects to. */
export type McpTransport = 'stdio' | 'http' | 'sse';

export interface McpServer {
  name: string;
  transport: McpTransport;

  /** stdio only — the command Alpha spawns, and its argv. */
  command?: string;
  args?: string[];
  /**
   * Key names only. The daemon never returns env values, because a catalog
   * entry can carry an API token and the panel only needs to count and replace
   * them, never read them back.
   */
  envKeys?: string[];

  /** http/sse only — the endpoint the CLI connects to. */
  url?: string;
  /** Header names only, for the same reason envKeys omits values. */
  headerKeys?: string[];

  /** Ships with Alpha; lives in code, not the catalog file. */
  builtin: boolean;
  /** A catalog entry of the same name is shadowing a built-in. */
  overridden: boolean;
  /** Agent ids granting this server, so a delete can name them before removing. */
  grantedTo: string[];
}

/** What the panel sends when adding or editing a catalog entry. */
export type McpServerInput =
  | { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'http' | 'sse'; url: string; headers?: Record<string, string> };

export type AgentReadinessStatus =
  | 'ready'
  | 'signed_out'
  | 'not_installed'
  /** CLI is fine; the model this agent is pinned to is not offered any more. */
  | 'stale_model'
  | 'unknown';

export interface AgentReadiness {
  status: AgentReadinessStatus;
  /** One sentence naming what to do about it. */
  detail: string;
  /** The command to run, when there is one. */
  command?: string;
}

/**
 * An agent's persona file on the machine running the daemon.
 *
 * The file is the editable source for the system prompt, and its frontmatter
 * overrides the matching database columns. `effective` is the merged result —
 * what the agent will actually be on its next run — which neither the file nor
 * the agent record shows on its own.
 */
export interface AgentPersonaFile {
  agentId: string;
  /** Absolute path on the daemon's machine, shown so the file can be found. */
  path: string;
  exists: boolean;
  /** Raw markdown, frontmatter included. */
  content: string;
  /** Values the file declared but that had to be ignored, in plain language. */
  warnings: string[];
  effective: {
    name: string;
    role: AgentRole;
    modelProvider: ModelProvider;
    modelName: string;
    reasoningEffort?: ReasoningEffort;
    autonomyLevel: AgentAutonomyLevel;
    skills: string[];
    mcpServers: string[];
    systemPromptChars: number;
    /** 'agents/{id}.md' when the file supplied the prompt, else 'alpha.db'. */
    promptSource: string;
  };
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
  /** Workspace-level owner used to scope developer-owned reusable squads. */
  ownerId?: string;
}

export type LiveBuildRoomCardStatus = 'completed' | 'running' | 'waiting' | 'review' | 'failed' | 'idle';

export interface LiveBuildRoomPhase {
  id: string;
  label: string;
  description: string;
  status: 'completed' | 'running' | 'waiting' | 'failed';
  progress: number;
}

export interface LiveBuildRoomAgentCard {
  agentId: string;
  agentName: string;
  agentRole: string;
  avatar?: string;
  color?: string;
  status: LiveBuildRoomCardStatus;
  progress: number;
  currentTask: string;
  currentStage?: string;
  runId?: string;
  activity: RunActivity[];
  updatedAt?: string | null;
  output?: { kind: string; label: string; value: string };
}

export interface LiveBuildRoomSnapshot {
  project: Pick<Project, 'id' | 'name' | 'key' | 'description' | 'color' | 'status'>;
  squad: Squad & { projectIds: string[]; memberCount: number };
  squads: Array<Squad & { assignment?: WorkspaceSquadProjectAssignment }>;
  eligible: boolean;
  canRun: boolean;
  canManage: boolean;
  status: SquadRun['status'] | 'idle';
  summary: {
    totalAgents: number;
    completed: number;
    running: number;
    waiting: number;
    progress: number;
  };
  phases: LiveBuildRoomPhase[];
  issue?: Issue;
  activeRun: (SquadRun & { memberRuns: PrototypeRun[]; activities: RunActivity[] }) | null;
  agentCards: LiveBuildRoomAgentCard[];
  activity: RunActivity[];
  handoff: {
    from: string;
    to: string;
    current?: string;
    next?: string;
  };
  artifacts: Array<{
    id: string;
    name: string;
    kind: string;
    detail: string;
    status: string;
    runId: string;
  }>;
  lastUpdated: string;
}

export type RuntimeType = 'local' | 'cloud' | 'remote';
export type RuntimeStatus = 'online' | 'offline' | 'degraded' | 'scanning';

export interface RuntimeEngine {
  id: string;
  name: string;
  type?: RuntimeType;
  provider: ModelProvider;
  endpoint?: string;
  port?: number;
  status: RuntimeStatus;
  latencyMs?: number;
  modelsLoaded?: string[];
  models?: string[];
  version?: string;
  account?: {
    email?: string;
    org?: string;
    billing?: 'subscription' | 'api';
    plan?: string;
  };
  vramUsageGb?: number;
  vramTotalGb?: number;
  gpuName?: string;
  isDefault?: boolean;
  detectedAt?: string;
}

export type SkillCategory = 
  | 'File Operations' 
  | 'Browser & Web' 
  | 'Code Execution' 
  | 'Terminal & Shell' 
  | 'Git & GitHub' 
  | 'MCP Servers' 
  | 'Cloud & API'
  | 'Agent Skills';

export type SkillPermission = 'read_only' | 'write' | 'full_execution';
export type SkillSource = 'builtin' | 'system_detected' | 'mcp_server' | 'user' | 'project' | 'plugin';

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  permissions: SkillPermission;
  parametersCount: number;
  enabled: boolean;
  source: SkillSource;
  /** True when the skill came from an installed SKILL.md on this machine. */
  installed?: boolean;
  /** Absolute local path for a filesystem-detected skill. */
  path?: string;
  commandExample?: string;
  /**
   * CLI tools this skill grants a chat turn.
   *
   * Sent by the daemon from its own SKILL_TOOLS map rather than mirrored here —
   * a second copy is how the agent card came to advertise capability the runner
   * did not grant. Absent on an older daemon; render it as "unknown", never as
   * "nothing".
   */
  grantedTools?: string[];
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
  sourceIssueId?: string;
  sourceRunId?: string;
}

export type NotificationType = 
  | 'agent_approval' 
  | 'issue_assigned' 
  | 'agent_completed' 
  | 'agent_failed' 
  | 'mention' 
  | 'deployment_status';

/** Who a notification is written for. Internal items never reach a client. */
export type Audience = 'client' | 'internal';

export interface InboxNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  archived?: boolean;
  timestamp: string;
  /** Defaults to 'internal' when absent — the safe direction. */
  audience?: Audience;
  /** Restricts an internal item further, to one staff member. */
  forUserId?: string;
  /** Scopes a client item to the client who owns it. */
  clientId?: string;
  entityType: 'issue' | 'agent' | 'squad' | 'deployment';
  entityId: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  meta?: {
    agentName?: string;
    agentRole?: string;
    issueIdentifier?: string;
    proposedChanges?: string;
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
  messageType?: 'user' | 'assistant' | 'agent' | 'system' | 'agent_call';
  agentCallId?: string;
  operationMode?: AgentCallMode;
  agentCallStatus?: AgentCallStatus;
  revisionTarget?: AgentCallTarget;
}

export interface ChatThread {
  id: string;
  title: string;
  agentIds: string[];
  /**
   * Which project this conversation is about, when it is about one.
   *
   * Decides the directory the agents in this thread can read. Absent means the
   * managed workspace root, which is right for a chat that is not about code.
   */
  projectId?: string;
  squadId?: string;
  lastMessageAt: string;
  pinned: boolean;
  lastMessageSnippet?: string;
  isFailed?: boolean;
  iconType?: 'asterisk' | 'flame' | 'sparkle' | 'bot';
  messages?: ChatMessage[];
  /**
   * 'internal' threads are staff talking to agents. 'client' threads are a
   * client talking to their project manager — never to an agent directly.
   * Defaults to 'internal' when absent.
   */
  audience?: Audience;
  clientId?: string;
  /** Set on creation. Matches `chat_threads.created_at` in the backend schema. */
  createdAt?: string;
}

export type AgentCallMode = 'ask' | 'review' | 'revise' | 'implement';
export type AgentCallStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'awaiting_confirmation';

export type AgentCallTargetType =
  | 'message'
  | 'agent_response'
  | 'issue'
  | 'specification'
  | 'file'
  | 'code'
  | 'branch'
  | 'commit'
  | 'pull_request'
  | 'diff';

export interface AgentCallTarget {
  type: AgentCallTargetType;
  id: string;
  label?: string;
}

export interface AgentCallArtifact {
  id: string;
  agentCallId: string;
  artifactType: 'summary' | 'finding' | 'diff' | 'patch' | 'test_result' | 'file_reference' | 'log';
  path?: string;
  contentReference?: string;
  content?: string;
  createdAt: string;
}

export interface AgentCall {
  id: string;
  workspaceId: string;
  projectId: string;
  threadId: string;
  messageId?: string;
  squadId: string;
  agentId: string;
  requestedBy: string;
  operationMode: AgentCallMode;
  status: AgentCallStatus;
  revisionTarget?: AgentCallTarget;
  instruction: string;
  workingCopyId?: string;
  resultMessageId?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  artifacts: AgentCallArtifact[];
}

export interface ProjectChatAgent {
  id: string;
  name: string;
  role: string;
  description?: string;
  avatar?: string;
  color?: string;
  squadId: string;
  squadName: string;
  availability: 'ready';
  supportedModes: AgentCallMode[];
}

export interface ProjectChatSnapshot {
  project: {
    id: string;
    name: string;
    key: string;
    branch?: string;
    workingCopy: {
      status: 'connected' | 'not_connected';
      managed: boolean;
    };
    assignedSquadNames: string[];
  };
  squads: Array<{
    id: string;
    name: string;
    agents: ProjectChatAgent[];
  }>;
  agents: ProjectChatAgent[];
}

export interface AnalyticsData {
  totalRuns24h: number;
  avgLatencyMs: number;
  totalAgentRuns: number;
  successRate: number;
  runTimeline: { hour: string; runs: number; completed: number; failed: number }[];
  agentBreakdown: { agentId: string; agentName: string; runs: number; efficiency: number }[];
  modelBreakdown: { modelName: string; percentage: number; totalCalls: number }[];
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

/* ---------------------------------------------------------------------------
 * Identity & access
 * ------------------------------------------------------------------------ */

/**
 * Who Alpha thinks you are, from the daemon.
 *
 * The GitHub login the org, the teams and every pull request already use, or
 * the OS username when GitHub is not signed in. `source` says which, so the UI
 * never implies a GitHub account that is not there.
 */
export interface Identity {
  login: string;
  name?: string;
  source: 'github' | 'local';
  /** Every team the account belongs to, across organisations. */
  teams?: { org: string; slug: string }[];
  /**
   * The role the workspace's teams imply, or absent when nothing said —
   * no GitHub, no workspace org, or teams named something unrecognised.
   */
  role?: UserRole;
  /** The organisation this installation's projects belong to. */
  workspaceOrg?: string;
  /**
   * Whether this person may use Alpha at all.
   *
   * `no_team` means a GitHub account in a known workspace organisation that
   * belongs to no team granting a role. Every other reason a role is absent —
   * still loading, no GitHub, no workspace yet — stays `granted`, because
   * refusing those would lock out solo use and every fresh install.
   */
  access?: 'granted' | 'no_team';
  /**
   * Why GitHub is unavailable, when it is. `missing` means the CLI is not
   * installed — where a teammate who downloaded only the packaged app lands,
   * since `gh` is not bundled and every GitHub call shells out to it.
   */
  github?: 'ok' | 'missing' | 'signed_out';
}

export type UserRole = 'client' | 'dev' | 'pm' | 'admin';

/** A product workspace membership returned by the daemon. */
export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'archived';
  role: UserRole;
  memberCount: number;
  joinCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceProjectAssignment {
  id: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSquadProjectAssignment {
  id: string;
  workspaceId: string;
  squadId: string;
  projectId: string;
  relationship: 'owned' | 'assigned';
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  /** Organisation the client belongs to. Absent for internal staff. */
  company?: string;
  /** Project ids this user may see. Admin ignores this. */
  projectIds?: string[];
}

/* ---------------------------------------------------------------------------
 * Requirement documents (client intake -> specification)
 * ------------------------------------------------------------------------ */

/** Sizing band the architect assigns per requirement for delivery planning. */
export type ComplexityBand = 'S' | 'M' | 'L' | 'XL';

export type RequirementDocStatus =
  | 'draft'          // wizard answers captured, not yet compiled
  | 'in_review'      // compiled, PM refining
  | 'awaiting_client'// sent to client for scope review
  | 'approved'       // scope signed off
  | 'superseded';

export type RequestTrack = 'quick_task' | 'project';

export interface FunctionalRequirement {
  id: string;
  /** Plain-language line the client wrote, kept verbatim for traceability. */
  clientWording: string;
  /** Architect's formalised restatement. */
  requirement: string;
  band: ComplexityBand;
  acceptanceCriteria: string[];
  /** Client can drop this at the approval gate before scope is approved. */
  included: boolean;
}

export interface IntakeAnswers {
  // Step 1 - problem & background
  title: string;
  problem: string;
  affected: string;
  currentWorkaround: string;
  // Step 2 - goals & success
  definitionOfDone: string;
  successMeasure: string;
  urgency: IssuePriority;
  // Step 3 - scope
  capabilities: string[];
  outOfScope: string;
  concerns: string[];
  // Step 4 - constraints & references
  targetDate: string;
  expectedUsers: number;
  integrations: string;
  attachments: { id: string; name: string; sizeKb: number }[];
  // Step 5 - stakeholders
  approvers: string;
  updateCadence: 'daily' | 'weekly' | 'on_milestone';
}

export interface RequirementDoc {
  id: string;
  identifier: string;        // SPEC-1042
  title: string;
  track: RequestTrack;
  status: RequirementDocStatus;
  version: number;
  clientId: string;
  clientName: string;
  company?: string;
  answers: IntakeAnswers;
  /** Compiled by the architect agent from `answers`. */
  problemStatement: string;
  goals: string[];
  functionalRequirements: FunctionalRequirement[];
  nonFunctionalRequirements: string[];
  constraints: string[];
  outOfScope: string[];
  projectId?: string;        // set once converted
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
