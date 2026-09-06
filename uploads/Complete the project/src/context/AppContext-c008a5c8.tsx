import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type {
  UserRole,
  ViewId,
  Issue,
  Agent,
  Squad,
  Project,
  InboxNotification,
  ChatThread,
  ChatMessage,
  Deployment,
  Runtime,
  Skill,
  RequirementDoc,
  AnalyticsData,
  TeamMember,
} from "../config/types";
import { getDefaultView, canDo } from "../config/navigationRBAC";

const USERS: Record<UserRole, { name: string; email: string; avatar: string }> = {
  client: { name: "Sarah Chen", email: "sarah@acme.co", avatar: "SC" },
  dev: { name: "Marcus Alvarez", email: "marcus@alpha.dev", avatar: "MA" },
  pm: { name: "Alex Johnson", email: "alex@alpha.dev", avatar: "AJ" },
  admin: { name: "Jordan Kim", email: "jordan@alpha.dev", avatar: "JK" },
};

const MOCK_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Alpha Platform v2.0",
    status: "active",
    progress: 78,
    budget: 35000,
    spent: 24500,
    description: "Complete overhaul of the Alpha platform with hierarchical navigation, RBAC, and AI ops.",
    milestone: "M3: Agent Studio",
    dueDate: "2026-09-30",
    teamSize: 4,
    issueCount: 14,
  },
  {
    id: "proj-2",
    name: "Client Portal Redesign",
    status: "active",
    progress: 45,
    budget: 15000,
    spent: 8200,
    description: "Redesign the client-facing portal with improved UX and request tracking.",
    milestone: "M2: Approval Flows",
    dueDate: "2026-10-15",
    teamSize: 2,
    issueCount: 8,
  },
  {
    id: "proj-3",
    name: "AI Runtime Integration",
    status: "active",
    progress: 12,
    budget: 8000,
    spent: 1100,
    description: "Integrate Ollama and LM Studio as local runtime providers.",
    milestone: "M1: Discovery",
    dueDate: "2026-11-01",
    teamSize: 2,
    issueCount: 5,
  },
  {
    id: "proj-4",
    name: "Billing Module",
    status: "on_hold",
    progress: 60,
    budget: 12000,
    spent: 7200,
    description: "Admin billing dashboard with margin tracking and rate card management.",
    milestone: "M2: Rate Cards",
    dueDate: "2026-12-01",
    teamSize: 1,
    issueCount: 6,
  },
];

const MOCK_ISSUES: Issue[] = [
  {
    id: "ALF-101",
    title: "Implement OAuth2 SSO login",
    status: "in_progress",
    priority: "high",
    projectId: "proj-1",
    projectName: "Alpha Platform v2.0",
    assignee: "Marcus Alvarez",
    agentId: "agent-1",
    dueDate: "2026-09-05",
    createdAt: "2026-08-20",
    description: "Integrate Google and GitHub OAuth2 for team login.",
    tags: ["auth", "backend"],
  },
  {
    id: "ALF-102",
    title: "Fix deployment stage timeout on large repos",
    status: "todo",
    priority: "critical",
    projectId: "proj-1",
    projectName: "Alpha Platform v2.0",
    dueDate: "2026-09-03",
    createdAt: "2026-08-25",
    description: "Build stage times out after 120s on repos > 500MB.",
    tags: ["infra", "bug"],
  },
  {
    id: "ALF-103",
    title: "Agent Squad topology visualisation",
    status: "review",
    priority: "medium",
    projectId: "proj-1",
    projectName: "Alpha Platform v2.0",
    assignee: "Marcus Alvarez",
    agentId: "agent-3",
    dueDate: "2026-09-10",
    createdAt: "2026-08-18",
    description: "Visual graph for chain/parallel/voting/hierarchy topologies.",
    tags: ["ui", "agents"],
  },
  {
    id: "ALF-104",
    title: "Client portal dashboard v2",
    status: "done",
    priority: "high",
    projectId: "proj-2",
    projectName: "Client Portal Redesign",
    assignee: "Marcus Alvarez",
    agentId: "agent-2",
    createdAt: "2026-08-10",
    description: "Redesigned overview with project status and budget charts.",
    tags: ["ui", "client"],
  },
  {
    id: "ALF-105",
    title: "Token cost analytics aggregation",
    status: "in_progress",
    priority: "medium",
    projectId: "proj-1",
    projectName: "Alpha Platform v2.0",
    assignee: "Marcus Alvarez",
    agentId: "agent-1",
    dueDate: "2026-09-12",
    createdAt: "2026-08-22",
    description: "Aggregate token usage by model, date, and project.",
    tags: ["analytics", "backend"],
  },
  {
    id: "ALF-106",
    title: "Hierarchical sidebar navigation",
    status: "done",
    priority: "high",
    projectId: "proj-1",
    projectName: "Alpha Platform v2.0",
    assignee: "Marcus Alvarez",
    createdAt: "2026-08-15",
    description: "Implement grouped, collapsible sidebar with role-based filtering.",
    tags: ["ui", "nav"],
  },
  {
    id: "ALF-107",
    title: "Ollama runtime provider integration",
    status: "todo",
    priority: "medium",
    projectId: "proj-3",
    projectName: "AI Runtime Integration",
    dueDate: "2026-10-01",
    createdAt: "2026-08-26",
    description: "Discover and connect to locally running Ollama models.",
    tags: ["ai", "runtime"],
  },
  {
    id: "ALF-108",
    title: "Requirement doc PDF export",
    status: "todo",
    priority: "low",
    projectId: "proj-2",
    projectName: "Client Portal Redesign",
    dueDate: "2026-10-20",
    createdAt: "2026-08-24",
    description: "Allow clients to download their requirement specs as PDF.",
    tags: ["client", "export"],
  },
  {
    id: "ALF-109",
    title: "MCP server health monitoring",
    status: "in_progress",
    priority: "high",
    projectId: "proj-1",
    projectName: "Alpha Platform v2.0",
    assignee: "Marcus Alvarez",
    agentId: "agent-4",
    dueDate: "2026-09-08",
    createdAt: "2026-08-23",
    description: "Ping registered MCP servers and surface status in Skills view.",
    tags: ["mcp", "infra"],
  },
  {
    id: "ALF-110",
    title: "Billing margin rate card UI",
    status: "review",
    priority: "medium",
    projectId: "proj-4",
    projectName: "Billing Module",
    assignee: "Marcus Alvarez",
    agentId: "agent-2",
    dueDate: "2026-09-15",
    createdAt: "2026-08-19",
    description: "Admin UI for setting per-model markup rates.",
    tags: ["billing", "admin"],
  },
];

const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-1",
    name: "CodeSage",
    model: "claude-sonnet-5",
    runtime: "Anthropic",
    status: "working",
    tokensPerRun: 4200,
    totalTokens: 2840000,
    lastActive: "2026-08-27T14:22:00Z",
    systemPrompt: "You are a senior software engineer specializing in TypeScript and React. You write clean, well-tested code following best practices.",
    skills: ["bash", "git", "filesystem", "web_search"],
    description: "Primary implementation agent for frontend tasks.",
  },
  {
    id: "agent-2",
    name: "ArchBot",
    model: "claude-opus-5",
    runtime: "Anthropic",
    status: "idle",
    tokensPerRun: 6700,
    totalTokens: 1120000,
    lastActive: "2026-08-27T10:05:00Z",
    systemPrompt: "You are a principal software architect. You review code, design systems, and create technical specifications.",
    skills: ["filesystem", "web_search"],
    description: "Architecture review and system design specialist.",
  },
  {
    id: "agent-3",
    name: "TestRunner",
    model: "claude-haiku-4-5",
    runtime: "Anthropic",
    status: "idle",
    tokensPerRun: 1100,
    totalTokens: 5600000,
    lastActive: "2026-08-27T13:45:00Z",
    systemPrompt: "You are a QA engineer. You write comprehensive test suites and identify edge cases.",
    skills: ["bash", "git", "filesystem"],
    description: "Automated test generation and quality assurance.",
  },
  {
    id: "agent-4",
    name: "Reviewer",
    model: "gpt-4o",
    runtime: "OpenAI",
    status: "idle",
    tokensPerRun: 2800,
    totalTokens: 890000,
    lastActive: "2026-08-26T18:30:00Z",
    systemPrompt: "You are a code reviewer. You provide thorough, constructive feedback on pull requests.",
    skills: ["filesystem", "git"],
    description: "Code review and PR feedback specialist.",
  },
  {
    id: "agent-5",
    name: "DocWriter",
    model: "mistral-large",
    runtime: "Custom",
    status: "offline",
    tokensPerRun: 900,
    totalTokens: 340000,
    lastActive: "2026-08-25T09:15:00Z",
    systemPrompt: "You are a technical writer. You create clear, concise documentation from code and specifications.",
    skills: ["filesystem"],
    description: "Technical documentation and API reference generation.",
  },
];

const MOCK_SQUADS: Squad[] = [
  {
    id: "squad-1",
    name: "Full-Stack Delivery",
    topology: "chain",
    agentIds: ["agent-1", "agent-3", "agent-4"],
    lastRun: "2026-08-27T11:00:00Z",
    runsCount: 42,
    description: "Implements, tests, and reviews features end-to-end in a sequential chain.",
    successRate: 91,
  },
  {
    id: "squad-2",
    name: "Parallel Reviewers",
    topology: "parallel",
    agentIds: ["agent-2", "agent-4"],
    lastRun: "2026-08-26T15:30:00Z",
    runsCount: 18,
    description: "Two independent reviewers run simultaneously; results are merged.",
    successRate: 97,
  },
  {
    id: "squad-3",
    name: "Architecture Council",
    topology: "voting",
    agentIds: ["agent-2", "agent-4", "agent-1"],
    lastRun: "2026-08-25T09:00:00Z",
    runsCount: 7,
    description: "Three agents vote on architectural decisions; majority wins.",
    successRate: 100,
  },
  {
    id: "squad-4",
    name: "Ops Hierarchy",
    topology: "hierarchy",
    agentIds: ["agent-2", "agent-1", "agent-3"],
    lastRun: "2026-08-24T14:00:00Z",
    runsCount: 12,
    description: "ArchBot leads; delegates implementation and testing sub-tasks.",
    successRate: 83,
  },
];

const MOCK_NOTIFICATIONS: InboxNotification[] = [
  {
    id: "notif-1",
    type: "approval",
    title: "Review ready: ALF-103",
    description: "TestRunner completed agent squad topology UI. PR #47 awaits your approval.",
    read: false,
    createdAt: "2026-08-27T14:30:00Z",
    actionRequired: true,
    relatedId: "ALF-103",
    relatedType: "issue",
  },
  {
    id: "notif-2",
    type: "approval",
    title: "Budget approval needed — Client Portal Redesign",
    description: "Estimate #E-008 for $8,200 has been generated and requires PM sign-off.",
    read: false,
    createdAt: "2026-08-27T12:15:00Z",
    actionRequired: true,
    relatedId: "proj-2",
    relatedType: "estimate",
  },
  {
    id: "notif-3",
    type: "success",
    title: "Deployment successful — Alpha v2.0 staging",
    description: "Deploy #D-021 completed in 4m 32s. Preview at staging.alpha.dev.",
    read: false,
    createdAt: "2026-08-27T11:45:00Z",
    actionRequired: false,
    relatedId: "dep-1",
  },
  {
    id: "notif-4",
    type: "alert",
    title: "CodeSage exceeded token budget",
    description: "Run on ALF-101 consumed 8,400 tokens (200% of budget). Review agent config.",
    read: true,
    createdAt: "2026-08-27T10:00:00Z",
    actionRequired: false,
    relatedId: "agent-1",
  },
  {
    id: "notif-5",
    type: "mention",
    title: "Alex Johnson mentioned you in ALF-109",
    description: '"@Marcus can you review the MCP health check implementation before EOD?"',
    read: true,
    createdAt: "2026-08-26T16:20:00Z",
    actionRequired: false,
    relatedId: "ALF-109",
  },
  {
    id: "notif-6",
    type: "info",
    title: "New client request submitted",
    description: "Sarah Chen submitted \"Mobile App Notifications\" — complexity: M, est. 3 weeks.",
    read: true,
    createdAt: "2026-08-26T14:00:00Z",
    actionRequired: false,
    relatedId: "doc-4",
  },
];

const MOCK_THREADS: ChatThread[] = [
  {
    id: "thread-1",
    name: "Alpha v2.0 — Dev Team",
    lastMessage: "CodeSage: PR #47 is ready for review. All tests passing.",
    lastActivity: "2026-08-27T14:22:00Z",
    unread: 3,
    participants: ["Marcus Alvarez", "CodeSage", "Alex Johnson"],
    type: "project",
  },
  {
    id: "thread-2",
    name: "CodeSage",
    lastMessage: "I've completed the OAuth implementation. Pushing branch now.",
    lastActivity: "2026-08-27T13:55:00Z",
    unread: 1,
    participants: ["Marcus Alvarez", "CodeSage"],
    type: "agent",
  },
  {
    id: "thread-3",
    name: "Client Portal — Stakeholders",
    lastMessage: "Sarah Chen: When can we expect the approval flow to be ready?",
    lastActivity: "2026-08-27T10:30:00Z",
    unread: 0,
    participants: ["Sarah Chen", "Alex Johnson", "Marcus Alvarez"],
    type: "project",
  },
  {
    id: "thread-4",
    name: "ArchBot",
    lastMessage: "The proposed microservice split introduces unnecessary complexity. Here's why...",
    lastActivity: "2026-08-26T17:00:00Z",
    unread: 0,
    participants: ["Alex Johnson", "ArchBot"],
    type: "agent",
  },
];

const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  "thread-1": [
    {
      id: "msg-1", threadId: "thread-1", sender: "Alex Johnson", senderType: "human",
      content: "Morning team. Let's get ALF-103 wrapped up today.", timestamp: "2026-08-27T09:00:00Z",
    },
    {
      id: "msg-2", threadId: "thread-1", sender: "CodeSage", senderType: "agent",
      content: "Acknowledged. I'm starting on the topology visualization component now. ETA ~2 hours.",
      timestamp: "2026-08-27T09:02:00Z",
    },
    {
      id: "msg-3", threadId: "thread-1", sender: "Marcus Alvarez", senderType: "human",
      content: "I'll review as soon as the PR is up.", timestamp: "2026-08-27T09:05:00Z",
    },
    {
      id: "msg-4", threadId: "thread-1", sender: "CodeSage", senderType: "agent",
      content: "PR #47 is ready for review. All tests passing. Coverage at 94%. The graph uses a force-directed layout with D3-free SVG implementation to keep the bundle lean.",
      timestamp: "2026-08-27T14:22:00Z",
    },
  ],
  "thread-2": [
    {
      id: "msg-5", threadId: "thread-2", sender: "Marcus Alvarez", senderType: "human",
      content: "CodeSage, please implement OAuth2 for Google and GitHub on ALF-101.", timestamp: "2026-08-27T08:30:00Z",
    },
    {
      id: "msg-6", threadId: "thread-2", sender: "CodeSage", senderType: "agent",
      content: "Starting on ALF-101. I'll use Passport.js with the existing Express backend. Creating the auth routes, callback handlers, and JWT token exchange. Estimated completion: 1h 45m.",
      timestamp: "2026-08-27T08:32:00Z",
    },
    {
      id: "msg-7", threadId: "thread-2", sender: "CodeSage", senderType: "agent",
      content: "I've completed the OAuth implementation. Pushing branch now. Note: I added refresh token rotation as it was trivial to include and significantly improves security posture.",
      timestamp: "2026-08-27T13:55:00Z",
    },
  ],
};

const MOCK_DEPLOYMENTS: Deployment[] = [
  {
    id: "dep-1",
    projectId: "proj-1",
    projectName: "Alpha Platform v2.0",
    trigger: "PR Merge #46",
    status: "success",
    branch: "feat/sidebar-nav",
    commit: "a3f8c2d",
    startedAt: "2026-08-27T11:10:00Z",
    completedAt: "2026-08-27T11:42:00Z",
    stages: [
      { id: "s1", name: "Lint", status: "success", duration: 24, logs: ["ESLint: 0 errors, 2 warnings", "Prettier: all files formatted"] },
      { id: "s2", name: "Test", status: "success", duration: 87, logs: ["Test suites: 12 passed", "Tests: 142 passed", "Coverage: 91%"] },
      { id: "s3", name: "Build", status: "success", duration: 63, logs: ["Vite build: 1.8s", "Bundle: 847KB gzipped", "Assets: 24 files"] },
      { id: "s4", name: "Deploy", status: "success", duration: 98, logs: ["Uploading to Cloudflare Pages...", "Deployment live at staging.alpha.dev", "Smoke tests: 5/5 passed"] },
    ],
  },
  {
    id: "dep-2",
    projectId: "proj-1",
    projectName: "Alpha Platform v2.0",
    trigger: "Manual — Alex Johnson",
    status: "running",
    branch: "feat/oauth2",
    commit: "7e1d4ab",
    startedAt: "2026-08-27T14:50:00Z",
    stages: [
      { id: "s5", name: "Lint", status: "success", duration: 22, logs: ["ESLint: 0 errors"] },
      { id: "s6", name: "Test", status: "running", duration: undefined, logs: ["Running test suites...", "12/18 suites complete"] },
      { id: "s7", name: "Build", status: "pending", duration: undefined, logs: [] },
      { id: "s8", name: "Deploy", status: "pending", duration: undefined, logs: [] },
    ],
  },
  {
    id: "dep-3",
    projectId: "proj-2",
    projectName: "Client Portal Redesign",
    trigger: "PR Merge #31",
    status: "failed",
    branch: "feat/approval-flows",
    commit: "5c9f1e3",
    startedAt: "2026-08-26T16:00:00Z",
    completedAt: "2026-08-26T16:08:00Z",
    stages: [
      { id: "s9", name: "Lint", status: "success", duration: 21, logs: ["No issues"] },
      { id: "s10", name: "Test", status: "failed", duration: 45, logs: ["FAIL: ApprovalModal.test.tsx", "Error: Cannot read property 'status' of undefined", "3 tests failed"] },
      { id: "s11", name: "Build", status: "skipped", duration: undefined, logs: [] },
      { id: "s12", name: "Deploy", status: "skipped", duration: undefined, logs: [] },
    ],
  },
];

const MOCK_RUNTIMES: Runtime[] = [
  {
    id: "rt-1",
    name: "Anthropic",
    provider: "anthropic",
    status: "connected",
    models: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"],
    requestsToday: 847,
    avgLatency: 1240,
  },
  {
    id: "rt-2",
    name: "OpenAI",
    provider: "openai",
    status: "connected",
    models: ["gpt-4o", "gpt-4o-mini", "o3"],
    requestsToday: 213,
    avgLatency: 890,
  },
  {
    id: "rt-3",
    name: "Ollama (Local)",
    provider: "ollama",
    status: "disconnected",
    models: [],
    endpoint: "http://localhost:11434",
    requestsToday: 0,
    avgLatency: 0,
  },
  {
    id: "rt-4",
    name: "LM Studio",
    provider: "lm_studio",
    status: "disconnected",
    models: [],
    endpoint: "http://localhost:1234",
    requestsToday: 0,
    avgLatency: 0,
  },
];

const MOCK_SKILLS: Skill[] = [
  { id: "sk-1", name: "Bash Execution", category: "execution", enabled: true, description: "Run shell commands in a sandboxed environment.", riskLevel: "high", usageCount: 1842 },
  { id: "sk-2", name: "Git Operations", category: "vcs", enabled: true, description: "Clone, commit, push, and create pull requests.", riskLevel: "medium", usageCount: 3201 },
  { id: "sk-3", name: "File System Read", category: "filesystem", enabled: true, description: "Read files and directory listings.", riskLevel: "low", usageCount: 9814 },
  { id: "sk-4", name: "File System Write", category: "filesystem", enabled: true, description: "Create and modify files within allowed paths.", riskLevel: "medium", usageCount: 4428 },
  { id: "sk-5", name: "Web Search", category: "web", enabled: true, description: "Search the web for documentation and context.", riskLevel: "low", usageCount: 2103 },
  { id: "sk-6", name: "Web Fetch", category: "web", enabled: false, description: "Fetch and parse arbitrary URLs.", riskLevel: "medium", usageCount: 318 },
  { id: "sk-7", name: "MCP: GitHub", category: "mcp", enabled: true, description: "GitHub API via MCP — repos, PRs, issues.", riskLevel: "medium", usageCount: 1077 },
  { id: "sk-8", name: "MCP: Sentry", category: "mcp", enabled: false, description: "Query Sentry for error logs and traces.", riskLevel: "low", usageCount: 44 },
  { id: "sk-9", name: "MCP: Postgres", category: "mcp", enabled: false, description: "Read-only access to the Postgres database.", riskLevel: "high", usageCount: 12 },
  { id: "sk-10", name: "MCP: Figma", category: "mcp", enabled: true, description: "Inspect Figma files and design tokens.", riskLevel: "low", usageCount: 201 },
];

const MOCK_DOCS: RequirementDoc[] = [
  {
    id: "doc-1", title: "Alpha Platform v2.0 — Full Spec", status: "in_dev",
    clientId: "client", createdAt: "2026-07-15", complexity: "XL", estimatedCost: 35000,
    description: "Complete overhaul including navigation, RBAC, and AI ops.", tags: ["platform", "navigation"],
  },
  {
    id: "doc-2", title: "Client Portal Redesign", status: "approved",
    clientId: "client", createdAt: "2026-08-01", complexity: "L", estimatedCost: 15000,
    description: "Modernise the client-facing portal with improved UX.", tags: ["client", "ux"],
  },
  {
    id: "doc-3", title: "AI Runtime Integration", status: "estimating",
    clientId: "client", createdAt: "2026-08-20", complexity: "M", estimatedCost: 8000,
    description: "Local model runner support (Ollama, LM Studio).", tags: ["ai", "runtime"],
  },
  {
    id: "doc-4", title: "Mobile App Notifications", status: "submitted",
    clientId: "client", createdAt: "2026-08-26", complexity: "M",
    description: "Push notifications for iOS and Android via FCM.", tags: ["mobile", "notifications"],
  },
];

const MOCK_ANALYTICS: AnalyticsData = {
  totalTokens: 14_200_000,
  totalCost: 284.40,
  avgTokensPerRun: 3550,
  totalRuns: 4000,
  runsByDay: [
    { date: "Aug 21", tokens: 1800000, cost: 36.00, runs: 480 },
    { date: "Aug 22", tokens: 2100000, cost: 42.00, runs: 560 },
    { date: "Aug 23", tokens: 1600000, cost: 32.00, runs: 410 },
    { date: "Aug 24", tokens: 2400000, cost: 48.00, runs: 650 },
    { date: "Aug 25", tokens: 1900000, cost: 38.00, runs: 500 },
    { date: "Aug 26", tokens: 2200000, cost: 44.00, runs: 590 },
    { date: "Aug 27", tokens: 2200000, cost: 44.40, runs: 810 },
  ],
  modelBreakdown: [
    { model: "claude-sonnet-5", tokens: 6800000, cost: 136.00, runs: 1800, avgLatency: 1240 },
    { model: "claude-opus-5", tokens: 3200000, cost: 96.00, runs: 480, avgLatency: 2100 },
    { model: "claude-haiku-4-5", tokens: 2800000, cost: 14.00, runs: 1400, avgLatency: 380 },
    { model: "gpt-4o", tokens: 1200000, cost: 36.00, runs: 240, avgLatency: 890 },
    { model: "mistral-large", tokens: 200000, cost: 2.40, runs: 80, avgLatency: 620 },
  ],
};

const MOCK_TEAM: TeamMember[] = [
  { id: "u-1", name: "Sarah Chen", email: "sarah@acme.co", role: "client", avatar: "SC", joinedAt: "2026-06-01", status: "active" },
  { id: "u-2", name: "Marcus Alvarez", email: "marcus@alpha.dev", role: "dev", avatar: "MA", joinedAt: "2026-01-15", status: "active" },
  { id: "u-3", name: "Alex Johnson", email: "alex@alpha.dev", role: "pm", avatar: "AJ", joinedAt: "2026-02-01", status: "active" },
  { id: "u-4", name: "Jordan Kim", email: "jordan@alpha.dev", role: "admin", avatar: "JK", joinedAt: "2026-01-01", status: "active" },
  { id: "u-5", name: "Priya Nair", email: "priya@acme.co", role: "client", avatar: "PN", joinedAt: "2026-07-10", status: "active" },
];

interface AppContextType {
  role: UserRole;
  switchRole: (role: UserRole) => void;
  currentUser: { name: string; email: string; avatar: string };
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  can: (feature: string, action: string) => boolean;

  issues: Issue[];
  projects: Project[];
  agents: Agent[];
  squads: Squad[];
  notifications: InboxNotification[];
  threads: ChatThread[];
  messages: Record<string, ChatMessage[]>;
  deployments: Deployment[];
  runtimes: Runtime[];
  skills: Skill[];
  requirementDocs: RequirementDoc[];
  analytics: AnalyticsData;
  team: TeamMember[];

  approveNotification: (id: string) => void;
  declineNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  toggleSkill: (id: string) => void;
  sendMessage: (threadId: string, content: string) => void;
  selectedThreadId: string;
  setSelectedThreadId: (id: string) => void;
  unreadCount: number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("admin");
  const [activeView, setActiveView] = useState<ViewId>(() => getDefaultView("admin"));
  const [notifications, setNotifications] = useState<InboxNotification[]>(MOCK_NOTIFICATIONS);
  const [skills, setSkills] = useState<Skill[]>(MOCK_SKILLS);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(MOCK_MESSAGES);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("thread-1");

  const switchRole = useCallback((newRole: UserRole) => {
    setRole(newRole);
    setActiveView(getDefaultView(newRole));
  }, []);

  const can = useCallback((feature: string, action: string) => canDo(role, feature, action), [role]);

  const approveNotification = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, actionRequired: false } : n))
    );
  }, []);

  const declineNotification = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, actionRequired: false } : n))
    );
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const toggleSkill = useCallback((id: string) => {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }, []);

  const sendMessage = useCallback((threadId: string, content: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      threadId,
      sender: USERS[role].name,
      senderType: "human",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), newMsg],
    }));
  }, [role]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo<AppContextType>(
    () => ({
      role,
      switchRole,
      currentUser: USERS[role],
      activeView,
      setActiveView,
      can,
      issues: MOCK_ISSUES,
      projects: MOCK_PROJECTS,
      agents: MOCK_AGENTS,
      squads: MOCK_SQUADS,
      notifications,
      threads: MOCK_THREADS,
      messages,
      deployments: MOCK_DEPLOYMENTS,
      runtimes: MOCK_RUNTIMES,
      skills,
      requirementDocs: MOCK_DOCS,
      analytics: MOCK_ANALYTICS,
      team: MOCK_TEAM,
      approveNotification,
      declineNotification,
      markNotificationRead,
      toggleSkill,
      sendMessage,
      selectedThreadId,
      setSelectedThreadId,
      unreadCount,
    }),
    [
      role, switchRole, activeView, can, notifications, messages, skills,
      approveNotification, declineNotification, markNotificationRead,
      toggleSkill, sendMessage, selectedThreadId, unreadCount,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
