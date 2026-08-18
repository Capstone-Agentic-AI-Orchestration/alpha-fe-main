export type NavigationTab =
  | 'portal'
  | 'intake'
  | 'documents'
  | 'estimates'
  | 'billing'
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

export type PrototypeRunStatus =
  | 'running'
  | 'awaiting_approval'
  | 'validating'
  | 'failed'
  | 'changes_requested'
  | 'cancelled'
  | 'completed';

export type PrototypeRunStageStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface PrototypeRunStage {
  id: string;
  label: string;
  description: string;
  status: PrototypeRunStageStatus;
  durationMs: number;
  logs: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface PrototypeRun {
  id: string;
  issueId: string;
  projectId: string;
  agentId: string;
  status: PrototypeRunStatus;
  scenario: 'success' | 'test_failure';
  plan: string[];
  stages: PrototypeRunStage[];
  currentStageIndex: number;
  createdAt: string;
  updatedAt: string;
  branchName?: string;
  prUrl?: string;
  changedFiles?: number;
  insertions?: number;
  deletions?: number;
  testSummary?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'error';
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
  /**
   * 'internal' threads are staff talking to agents. 'client' threads are a
   * client talking to their project manager — never to an agent directly.
   * Defaults to 'internal' when absent.
   */
  audience?: Audience;
  clientId?: string;
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

/* ---------------------------------------------------------------------------
 * Identity & access
 * ------------------------------------------------------------------------ */

export type UserRole = 'client' | 'dev' | 'pm' | 'admin';

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

/** Sizing band the architect assigns per requirement. Drives the estimate. */
export type ComplexityBand = 'S' | 'M' | 'L' | 'XL';

export type RequirementDocStatus =
  | 'draft'          // wizard answers captured, not yet compiled
  | 'in_review'      // compiled, PM refining
  | 'awaiting_client'// sent to client with an estimate attached
  | 'approved'       // scope + budget signed off
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
  /** Client can drop this at the approval gate; recalculates the estimate. */
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
  budgetCeiling?: number;
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
  estimateId?: string;
  projectId?: string;        // set once converted
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------------------------------------------------
 * Cost estimation
 * ------------------------------------------------------------------------ */

/** One-time build vs recurring monthly vs usage-priced. Never blended. */
export type CostClass = 'build' | 'infrastructure' | 'service';
export type CostCadence = 'one_time' | 'monthly' | 'per_transaction';

export interface EstimateLine {
  id: string;
  label: string;
  costClass: CostClass;
  cadence: CostCadence;
  /** What this figure rests on, shown to the client verbatim. */
  basis: string;
  amount: number;
  /** Fractional confidence band, e.g. 0.18 renders as +/-18%. */
  confidence: number;
  /** Requirement that forces this cost, for service lines. */
  forcedBy?: string;
  /** Free-text override when the figure is not a plain number. */
  displayOverride?: string;
}

export interface RateCard {
  devHourly: number;
  pmHourly: number;
  qaHourly: number;
  /** Blended USD per million tokens, derived from live analytics. */
  tokenRatePerMillion: number;
  /** PM-applied contingency on the build total, e.g. 0.1 for 10%. */
  contingency: number;
}

export type EstimateStatus = 'draft' | 'awaiting_client' | 'approved' | 'rejected' | 'superseded';

export interface Estimate {
  id: string;
  identifier: string;        // EST-1042
  docId: string;
  revision: number;
  status: EstimateStatus;
  lines: EstimateLine[];
  rateCard: RateCard;
  buildTotal: number;
  buildLow: number;
  buildHigh: number;
  monthlyTotal: number;
  monthlyLow: number;
  monthlyHigh: number;
  /**
   * Count of genuinely comparable finished requirements behind these ranges.
   * 0 means no history — the figures are seeded defaults, not measurements.
   */
  comparableSampleSize: number;
  /** False while history is too thin to treat the bands as evidenced. */
  calibrated: boolean;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

/** Actual spend accrued against an approved estimate. */
export interface BudgetLedger {
  projectId: string;
  estimateId: string;
  baseline: number;
  actualToDate: number;
  /** Straight-line projection to completion at the current burn rate. */
  projectedFinal: number;
  entries: {
    id: string;
    date: string;
    label: string;
    lineId: string;
    amount: number;
    source: 'agent_run' | 'logged_hours' | 'infrastructure';
  }[];
}
