export type UserRole = "client" | "dev" | "pm" | "admin";

export type ViewId =
  | "portal"
  | "inbox"
  | "chat"
  | "my_issues"
  | "issues"
  | "projects"
  | "documents"
  | "calendar"
  | "intake"
  | "my_requests"
  | "agents"
  | "squads"
  | "runtimes"
  | "skills"
  | "deployments"
  | "live_build"
  | "analytics"
  | "billing"
  | "settings"
  | "profile_settings";

export type SectionId =
  | "workspace"
  | "work"
  | "requests"
  | "ai_ops"
  | "delivery"
  | "insights"
  | "settings_section";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

export interface NavSection {
  id: SectionId;
  label: string;
  icon: string;
  items: NavItem[];
}

export interface NavigationFilter {
  visibleSections: SectionId[];
  visibleItems: Partial<Record<SectionId, ViewId[]>>;
  defaultView: ViewId;
  labels?: Partial<Record<string, string>>;
  restrictions?: Record<string, Record<string, boolean>>;
}

export type IssueStatus = "todo" | "in_progress" | "review" | "done";
export type IssuePriority = "low" | "medium" | "high" | "critical";

export interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  projectId: string;
  projectName: string;
  assignee?: string;
  agentId?: string;
  dueDate?: string;
  createdAt: string;
  description?: string;
  tags: string[];
}

export type AgentStatus = "idle" | "working" | "offline" | "error";

export interface Agent {
  id: string;
  name: string;
  model: string;
  runtime: string;
  status: AgentStatus;
  tokensPerRun: number;
  totalTokens: number;
  lastActive: string;
  systemPrompt: string;
  skills: string[];
  description: string;
}

export type SquadTopology = "chain" | "parallel" | "voting" | "hierarchy";

export interface Squad {
  id: string;
  name: string;
  topology: SquadTopology;
  agentIds: string[];
  lastRun?: string;
  runsCount: number;
  description: string;
  successRate: number;
}

export type ProjectStatus = "active" | "on_hold" | "completed";

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  budget: number;
  spent: number;
  description: string;
  milestone: string;
  dueDate: string;
  teamSize: number;
  issueCount: number;
}

export type NotificationType = "approval" | "alert" | "info" | "success" | "mention";

export interface InboxNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  actionRequired: boolean;
  relatedId?: string;
  relatedType?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  sender: string;
  senderType: "human" | "agent";
  content: string;
  timestamp: string;
  avatar?: string;
}

export interface ChatThread {
  id: string;
  name: string;
  lastMessage: string;
  lastActivity: string;
  unread: number;
  participants: string[];
  type: "direct" | "project" | "agent";
}

export interface DeploymentStage {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  duration?: number;
  logs: string[];
}

export interface Deployment {
  id: string;
  projectId: string;
  projectName: string;
  trigger: string;
  status: "running" | "success" | "failed" | "queued";
  stages: DeploymentStage[];
  startedAt: string;
  completedAt?: string;
  branch: string;
  commit: string;
}

export interface Runtime {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "ollama" | "lm_studio" | "custom";
  status: "connected" | "disconnected" | "error";
  models: string[];
  endpoint?: string;
  requestsToday: number;
  avgLatency: number;
}

export interface Skill {
  id: string;
  name: string;
  category: "execution" | "vcs" | "filesystem" | "mcp" | "web";
  enabled: boolean;
  description: string;
  riskLevel: "low" | "medium" | "high";
  usageCount: number;
}

export interface RequirementDoc {
  id: string;
  title: string;
  status: "draft" | "submitted" | "estimating" | "approved" | "in_dev" | "delivered";
  clientId: string;
  createdAt: string;
  complexity: "S" | "M" | "L" | "XL";
  estimatedCost?: number;
  description: string;
  tags: string[];
}

export interface DayMetric {
  date: string;
  tokens: number;
  cost: number;
  runs: number;
}

export interface ModelMetric {
  model: string;
  tokens: number;
  cost: number;
  runs: number;
  avgLatency: number;
}

export interface AnalyticsData {
  totalTokens: number;
  totalCost: number;
  avgTokensPerRun: number;
  totalRuns: number;
  runsByDay: DayMetric[];
  modelBreakdown: ModelMetric[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  joinedAt: string;
  status: "active" | "inactive";
}
