import {
  Agent,
  Issue,
  Deployment,
  InboxNotification,
  AnalyticsData,
  WorkspaceSettings,
  User,
  RequirementDoc
} from '@/shared/types';
export const initialAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Ada Lovelace',
    role: 'Architect',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    color: '#6366f1',
    description: 'System design, microservices boundaries, API contracts & distributed RFCs',
    owner: 'You',
    isMine: true,
    allowedUsers: 'everyone',
    machineStatus: 'online',
    workStatus: 'idle',
    machineName: 'AWS Cloud Cluster',
    lastActive: '5m ago',
    isArchived: false,
    concurrencyLimit: 4,
    envVars: [
      { key: 'LOG_LEVEL', value: 'debug' },
      { key: 'ANTHROPIC_API_KEY', value: 'sk-ant-api03-••••••••', isSecret: true }
    ],
    mcpServers: ['github', 'postgres', 'filesystem'],
    customCliArgs: '--max-tokens 8192 --temperature 0.2',
    runHistory: [
      { id: 'run-1', timestamp: '10m ago', issueKey: 'ALF-101', command: 'multica-agent plan --rfc "auth-session-v2"', status: 'success', durationMs: 1420, outputSnippet: 'Generated technical RFC specification in /docs/rfc/002-auth.md' },
      { id: 'run-2', timestamp: '1h ago', issueKey: 'ALF-102', command: 'multica-agent analyze --arch', status: 'success', durationMs: 980, outputSnippet: 'Identified 3 cyclic dependencies in microservice routes.' }
    ],
    activity30d: [2, 4, 3, 6, 8, 5, 7, 9, 12, 10, 8, 14, 15, 12, 11, 13, 16, 18, 14, 12, 15, 17, 19, 16, 14, 18, 20, 22, 19, 21],
    modelProvider: 'Anthropic',
    modelName: 'claude-3-7-sonnet',
    runtimeId: 'rt-cloud-anthropic',
    systemPrompt: 'You are Ada, a Principal System Architect. Decompose user requirements into clean distributed bounded contexts, enforce modular API contracts, and supervise technical plans.',
    autonomyLevel: 'Full Autonomy',
    temperature: 0.2,
    skills: ['sk-fs', 'sk-git', 'sk-mcp-postgres', 'sk-bash'],
    stats: {
      totalRuns: 342,
      successRate: 98.2,
      tokensUsed: 1420500,
      avgLatencyMs: 620
    },
    status: 'idle',
    currentTask: 'Reviewing distributed consensus protocol RFC'
  },
  {
    id: 'agent-2',
    name: 'Kaelen Vance',
    role: 'Coder',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    color: '#38bdf8',
    description: 'Fullstack TypeScript/Rust developer, API endpoints & reactive WebSockets',
    owner: 'You',
    isMine: true,
    allowedUsers: 'team',
    machineStatus: 'online',
    workStatus: 'working',
    machineName: 'Local Mac Studio M2',
    lastActive: 'Just now',
    isArchived: false,
    concurrencyLimit: 2,
    envVars: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'OPENAI_API_KEY', value: 'sk-proj-••••••••', isSecret: true }
    ],
    mcpServers: ['bash', 'filesystem', 'git'],
    customCliArgs: '--timeout 60000 --stream',
    runHistory: [
      { id: 'run-3', timestamp: 'Just now', issueKey: 'ALF-104', command: 'git checkout -b feat/ws-reconnect && npm run test', status: 'running', durationMs: 480, outputSnippet: 'Compiling websocket reconnect handler test suite...' },
      { id: 'run-4', timestamp: '2h ago', issueKey: 'ALF-103', command: 'tsc --noEmit && cargo check', status: 'success', durationMs: 2310, outputSnippet: 'Code generation successful with 0 errors.' }
    ],
    activity30d: [5, 7, 6, 10, 12, 9, 11, 14, 16, 18, 15, 20, 22, 19, 17, 21, 24, 26, 23, 20, 25, 28, 30, 27, 24, 29, 31, 34, 30, 32],
    modelProvider: 'OpenAI',
    modelName: 'gpt-4o',
    runtimeId: 'rt-cloud-openai',
    systemPrompt: 'You are Kaelen, a Senior Fullstack Engineer. Write clean, defensive, typed code following modern TypeScript and Rust paradigms. Never leave unhandled promise rejections.',
    autonomyLevel: 'Semi-Autonomous (Requires Approval)',
    temperature: 0.3,
    skills: ['sk-fs', 'sk-bash', 'sk-code-exec', 'sk-git'],
    stats: {
      totalRuns: 512,
      successRate: 94.6,
      tokensUsed: 2840000,
      avgLatencyMs: 480
    },
    status: 'executing',
    currentTask: 'Implementing WebSockets reconnect backoff on ALF-104'
  },
  {
    id: 'agent-3',
    name: 'Vesper Nyx',
    role: 'Reviewer',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    color: '#a855f7',
    description: 'Security audit, static analysis, XSS/injection scanning & PR diff reviews',
    owner: 'Security Team',
    isMine: false,
    allowedUsers: 'everyone',
    machineStatus: 'unstable',
    workStatus: 'queued',
    machineName: 'Ollama GPU Pod',
    lastActive: '12m ago',
    isArchived: false,
    concurrencyLimit: 3,
    envVars: [
      { key: 'SEMGREP_RULES', value: 'p/security-audit' }
    ],
    mcpServers: ['git', 'code-review', 'ast-grep'],
    customCliArgs: '--strict-mode --fail-on-warning',
    runHistory: [
      { id: 'run-5', timestamp: '12m ago', issueKey: 'PR #49', command: 'semgrep --config p/security-audit src/', status: 'success', durationMs: 820, outputSnippet: 'Audit complete: 0 high vulnerabilities found.' }
    ],
    activity30d: [1, 2, 4, 3, 5, 4, 6, 8, 7, 9, 11, 10, 8, 12, 13, 11, 14, 15, 12, 10, 14, 16, 17, 14, 13, 15, 18, 19, 16, 18],
    modelProvider: 'DeepSeek',
    modelName: 'deepseek-r1:70b',
    runtimeId: 'rt-local-ollama',
    systemPrompt: 'You are Vesper, an ultra-strict Code and Security Reviewer. Scrutinize PR diffs for injection flaws, race conditions, memory leaks, and anti-patterns.',
    autonomyLevel: 'Full Autonomy',
    temperature: 0.1,
    skills: ['sk-git', 'sk-fs', 'sk-code-exec'],
    stats: {
      totalRuns: 289,
      successRate: 99.1,
      tokensUsed: 1950000,
      avgLatencyMs: 310
    },
    status: 'thinking',
    currentTask: 'Running static analysis on PR #49'
  },
  {
    id: 'agent-4',
    name: 'Nyx Orion',
    role: 'QA Tester',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    color: '#34d399',
    description: 'End-to-end Playwright automation, edge-case fuzzing & regression testing',
    owner: 'You',
    isMine: true,
    allowedUsers: 'team',
    machineStatus: 'offline',
    workStatus: 'idle',
    machineName: 'Local Mac Studio M2',
    lastActive: '3h ago',
    isArchived: false,
    concurrencyLimit: 1,
    envVars: [
      { key: 'HEADLESS', value: 'true' },
      { key: 'PLAYWRIGHT_WORKERS', value: '4' }
    ],
    mcpServers: ['playwright-browser', 'bash'],
    customCliArgs: '--retries 2',
    runHistory: [
      { id: 'run-6', timestamp: '3h ago', issueKey: 'ALF-105', command: 'npx playwright test e2e/auth.spec.ts', status: 'success', durationMs: 4120, outputSnippet: '18 passed in 4.12s' }
    ],
    activity30d: [0, 1, 2, 1, 3, 2, 4, 5, 6, 4, 5, 7, 8, 6, 7, 9, 10, 8, 7, 9, 11, 12, 10, 9, 11, 13, 14, 12, 11, 13],
    modelProvider: 'Ollama',
    modelName: 'llama3.3:70b-instruct-q8',
    runtimeId: 'rt-local-ollama',
    systemPrompt: 'You are Nyx, an automated QA Engineer. Generate end-to-end Playwright tests, edge-case fuzzing matrices, and verify regression boundaries.',
    autonomyLevel: 'Full Autonomy',
    temperature: 0.4,
    skills: ['sk-browser', 'sk-code-exec', 'sk-bash'],
    stats: {
      totalRuns: 194,
      successRate: 96.4,
      tokensUsed: 980000,
      avgLatencyMs: 290
    },
    status: 'idle'
  },
  {
    id: 'agent-5',
    name: 'Cipher Drake',
    role: 'DevOps Engineer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    color: '#f59e0b',
    description: 'Docker containerization, SRE telemetry, blue/green deployments & CI/CD',
    owner: 'DevOps Team',
    isMine: false,
    allowedUsers: 'admins',
    machineStatus: 'online',
    workStatus: 'idle',
    machineName: 'Google Cloud Engine',
    lastActive: '45m ago',
    isArchived: false,
    concurrencyLimit: 5,
    envVars: [
      { key: 'DOCKER_BUILDKIT', value: '1' }
    ],
    mcpServers: ['docker', 'kubernetes', 'cloud-api'],
    customCliArgs: '--platform linux/amd64',
    runHistory: [
      { id: 'run-7', timestamp: '45m ago', issueKey: 'DEP-801', command: 'docker buildx bake --push', status: 'success', durationMs: 8450, outputSnippet: 'Pushed image ghcr.io/multica/engine:v1.4.2 to registry' }
    ],
    activity30d: [3, 4, 5, 6, 8, 7, 9, 11, 12, 10, 13, 15, 14, 12, 16, 18, 17, 15, 19, 21, 20, 18, 22, 24, 22, 20, 25, 27, 24, 26],
    modelProvider: 'Google Gemini',
    modelName: 'gemini-2.0-flash',
    runtimeId: 'rt-cloud-gemini',
    systemPrompt: 'You are Cipher, an SRE and CI/CD Pipeline Automation Engineer. Manage containerization, blue/green deployments, telemetry alerting, and zero-downtime upgrades.',
    autonomyLevel: 'Semi-Autonomous (Requires Approval)',
    temperature: 0.2,
    skills: ['sk-bash', 'sk-git', 'sk-docker', 'sk-cloud'],
    stats: {
      totalRuns: 420,
      successRate: 97.8,
      tokensUsed: 1650000,
      avgLatencyMs: 340
    },
    status: 'idle'
  },
  {
    id: 'agent-6',
    name: 'Atlas Prime',
    role: 'Triager',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    color: '#ec4899',
    description: 'Automated triage assistant, severity tagging, ticket routing & squad dispatch',
    owner: 'Platform',
    isMine: false,
    allowedUsers: 'everyone',
    machineStatus: 'online',
    workStatus: 'idle',
    machineName: 'Local LM Studio Host',
    lastActive: '1m ago',
    isArchived: false,
    concurrencyLimit: 10,
    envVars: [
      { key: 'TRIAGE_AUTO_ASSIGN', value: 'true' }
    ],
    mcpServers: ['postgres', 'jira', 'slack'],
    customCliArgs: '--fast-inference',
    runHistory: [
      { id: 'run-8', timestamp: '1m ago', issueKey: 'ALF-106', command: 'multica-triage parse --webhook-payload', status: 'success', durationMs: 190, outputSnippet: 'Classified bug report as Medium priority, assigned to Core Swarm.' }
    ],
    activity30d: [8, 10, 12, 14, 16, 15, 18, 20, 22, 19, 23, 26, 25, 22, 28, 30, 29, 26, 32, 35, 33, 30, 36, 38, 35, 32, 40, 42, 38, 41],
    modelProvider: 'LM Studio',
    modelName: 'qwen2.5-coder-32b-instruct',
    runtimeId: 'rt-local-lmstudio',
    systemPrompt: 'You are Atlas, the automated triage assistant. Parse incoming issue reports, assign severity scores, attach related past tickets, and delegate to the optimal agent squad.',
    autonomyLevel: 'Full Autonomy',
    temperature: 0.1,
    skills: ['sk-fs', 'sk-mcp-postgres'],
    stats: {
      totalRuns: 610,
      successRate: 99.4,
      tokensUsed: 780000,
      avgLatencyMs: 190
    },
    status: 'idle'
  },
  {
    id: 'agent-7',
    name: 'Echo Legacy',
    role: 'Researcher',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    color: '#94a3b8',
    description: 'Historical technical research and deprecated API documentation scraper',
    owner: 'You',
    isMine: true,
    allowedUsers: 'private',
    machineStatus: 'offline',
    workStatus: 'idle',
    machineName: 'Old Ubuntu Server',
    lastActive: '2 months ago',
    isArchived: true,
    concurrencyLimit: 1,
    envVars: [],
    mcpServers: [],
    customCliArgs: '',
    runHistory: [],
    activity30d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    modelProvider: 'Ollama',
    modelName: 'mistral:7b-instruct',
    runtimeId: 'rt-local-ollama',
    systemPrompt: 'You are Echo, a technical researcher. Search documentation archive.',
    autonomyLevel: 'Supervised',
    temperature: 0.5,
    skills: ['sk-fs', 'sk-browser'],
    stats: {
      totalRuns: 88,
      successRate: 91.2,
      tokensUsed: 420000,
      avgLatencyMs: 410
    },
    status: 'offline'
  }
];
export const initialIssues: Issue[] = [
  {
    id: 'iss-1',
    identifier: 'ALF-101',
    title: 'Implement Local AI Runtime Auto-Detection Scanner',
    description: 'Build a background polling probe for discovering Ollama (11434), LM Studio (1234), and vLLM (8000) instances running on the host system.',
    status: 'done',
    priority: 'urgent',
    projectId: 'proj-1',
    assignedAgentId: 'agent-2',
    assignedSquadId: 'sq-1',
    labels: ['runtime', 'backend', 'core'],
    branchName: 'feat/runtime-probe-autodetect',
    prUrl: 'https://github.com/multica/alpha-engine/pull/38',
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-08-14T16:30:00Z',
    subtasks: [
      { id: 'sub-1', title: 'Port scanner for 11434 & 1234', completed: true, assignedAgentId: 'agent-2' },
      { id: 'sub-2', title: 'VRAM & Hardware probe telemetry', completed: true, assignedAgentId: 'agent-2' },
      { id: 'sub-3', title: 'Unit test suite with mock endpoints', completed: true, assignedAgentId: 'agent-4' },
    ],
    comments: [
      {
        id: 'c-1',
        authorType: 'agent',
        authorName: 'Kaelen Vance',
        agentId: 'agent-2',
        content: 'Verified local Ollama `/api/tags` and LM Studio `/v1/models` formats. Both return JSON models list cleanly.',
        createdAt: '2026-08-12T14:20:00Z'
      }
    ]
  },
  {
    id: 'iss-2',
    identifier: 'ALF-104',
    title: 'WebSocket Auto-Reconnect with Exponential Backoff & Jitter',
    description: 'Prevent client UI disconnection dropouts during agent swarm task streaming by introducing robust heartbeat and reconnect state sync.',
    status: 'agent_running',
    priority: 'high',
    projectId: 'proj-1',
    assignedAgentId: 'agent-2',
    assignedSquadId: 'sq-1',
    labels: ['realtime', 'agent-stream', 'network'],
    branchName: 'feat/ws-backoff-jitter',
    createdAt: '2026-08-14T08:00:00Z',
    updatedAt: '2026-08-15T13:40:00Z',
    subtasks: [
      { id: 'sub-4', title: 'Exponential backoff formula with jitter', completed: true, assignedAgentId: 'agent-2' },
      { id: 'sub-5', title: 'Message buffer queue while offline', completed: false, assignedAgentId: 'agent-2' },
      { id: 'sub-6', title: 'E2E disconnect/reconnect simulation test', completed: false, assignedAgentId: 'agent-4' }
    ],
    comments: [
      {
        id: 'c-2',
        authorType: 'agent',
        authorName: 'Ada Lovelace',
        agentId: 'agent-1',
        content: 'Ensure the message buffer maintains an immutable sequence ID so we avoid duplicate state dispatch upon reconnection.',
        createdAt: '2026-08-14T11:00:00Z'
      },
      {
        id: 'c-3',
        authorType: 'agent',
        authorName: 'Kaelen Vance',
        agentId: 'agent-2',
        content: 'Executing task now. State sequence ID implemented, testing queue buffer serialization.',
        createdAt: '2026-08-15T13:42:00Z',
        isThinking: false
      }
    ]
  },
  {
    id: 'iss-3',
    identifier: 'NEU-205',
    title: 'Agent Topology Canvas with Interactive Node Connections',
    description: 'Render drag-and-drop squad topologies showing dataflow directions, consensus leader badges, and real-time execution pulses.',
    status: 'in_progress',
    priority: 'medium',
    projectId: 'proj-2',
    assignedAgentId: 'agent-1',
    assignedSquadId: 'sq-2',
    labels: ['canvas', 'ui', 'squads'],
    createdAt: '2026-08-13T09:00:00Z',
    updatedAt: '2026-08-15T11:20:00Z',
    subtasks: [
      { id: 'sub-7', title: 'Node layout calculation', completed: true, assignedAgentId: 'agent-1' },
      { id: 'sub-8', title: 'Animated pulse lines on active run', completed: false, assignedAgentId: 'agent-1' }
    ],
    comments: []
  },
  {
    id: 'iss-4',
    identifier: 'ALF-109',
    title: 'Dynamic MCP Server Discovery & Protocol Handshake',
    description: 'Allow users to register arbitrary Model Context Protocol (MCP) servers via stdio or SSE and automatically expose declared tools.',
    status: 'todo',
    priority: 'high',
    projectId: 'proj-1',
    assignedAgentId: 'agent-1',
    assignedSquadId: 'sq-1',
    labels: ['mcp', 'skills', 'protocols'],
    createdAt: '2026-08-14T15:00:00Z',
    updatedAt: '2026-08-14T15:00:00Z',
    subtasks: [
      { id: 'sub-9', title: 'MCP stdio process spawner', completed: false },
      { id: 'sub-10', title: 'Tool schema parser and validator', completed: false }
    ],
    comments: []
  },
  {
    id: 'iss-5',
    identifier: 'GRD-302',
    title: 'Automated Canary Health Evaluator on Agent Deployments',
    description: 'Evaluate HTTP 5xx error rate and p99 latency for 5 minutes post-deployment; automatically invoke rollback if anomalies exceed 1.5%.',
    status: 'backlog',
    priority: 'medium',
    projectId: 'proj-3',
    assignedAgentId: 'agent-5',
    assignedSquadId: 'sq-3',
    labels: ['cicd', 'canary', 'devops'],
    createdAt: '2026-08-15T02:00:00Z',
    updatedAt: '2026-08-15T02:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'iss-6',
    identifier: 'NEU-209',
    title: 'Run Reliability Advisor Widget',
    description: 'Provide proactive tips in the analytics dashboard when an agent needs a stronger validation or retry strategy.',
    status: 'review',
    priority: 'low',
    projectId: 'proj-2',
    assignedAgentId: 'agent-3',
    assignedSquadId: 'sq-2',
    labels: ['analytics', 'reliability', 'optimization'],
    createdAt: '2026-08-11T12:00:00Z',
    updatedAt: '2026-08-15T09:15:00Z',
    subtasks: [
      { id: 'sub-11', title: 'Run reliability rules', completed: true, assignedAgentId: 'agent-3' },
      { id: 'sub-12', title: 'Advisor UI banner component', completed: true, assignedAgentId: 'agent-3' }
    ],
    comments: [
      {
        id: 'c-4',
        authorType: 'agent',
        authorName: 'Vesper Nyx',
        agentId: 'agent-3',
        content: 'Review complete. Code looks solid with zero vulnerabilities found.',
        createdAt: '2026-08-15T09:15:00Z'
      }
    ]
  },
  {
    id: 'iss-alp-41',
    identifier: 'ALP-41',
    title: 'Notification inbox: real unread-count/red-dot wiring for header bell',
    description: 'Connect header notification bell to real-time notification stream count and red-dot badge.',
    status: 'backlog',
    priority: 'none',
    projectId: 'proj-4',
    assignedAgentId: 'agent-2',
    labels: ['notifications', 'ui'],
    createdAt: '2026-08-14T08:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'iss-alp-42',
    identifier: 'ALP-42',
    title: 'Home screen redesign v2: delta badge, no-container quick actions, illustrated quest card, Cash flow + Tip cards',
    description: 'Refine dashboard layout with illustrated balance overview and streamlined quick actions.',
    status: 'in_progress',
    priority: 'medium',
    projectId: 'proj-4',
    assignedSquadId: 'sq-2',
    labels: ['home', 'redesign'],
    createdAt: '2026-08-14T10:00:00Z',
    updatedAt: '2026-08-15T09:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'iss-alp-40',
    identifier: 'ALP-40',
    title: 'Home screen: 1:1 layout replication of reference (card summary, skyline illustration, bell)',
    description: 'Pixel-perfect replication of reference card summary and skyline background graphics.',
    status: 'review',
    priority: 'none',
    projectId: 'proj-4',
    assignedSquadId: 'sq-2',
    labels: ['design', '1:1'],
    createdAt: '2026-08-14T11:00:00Z',
    updatedAt: '2026-08-15T10:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'iss-alp-39',
    identifier: 'ALP-39',
    title: 'Explore e-wallet app and suggest alternative branding color',
    description: 'Propose and test dynamic theme tokens and color palettes for mobile experience.',
    status: 'review',
    priority: 'none',
    projectId: 'proj-4',
    assignedAgentId: 'agent-1',
    labels: ['branding', 'themes'],
    createdAt: '2026-08-14T12:00:00Z',
    updatedAt: '2026-08-15T11:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'iss-alp-38',
    identifier: 'ALP-38',
    title: 'Implement Move Money multi-step layout (Send money & Add money)',
    description: 'Build animated multi-step wizard for transfer flows with recipient search and confirmation receipts.',
    status: 'review',
    priority: 'high',
    projectId: 'proj-4',
    assignedSquadId: 'sq-2',
    labels: ['payments', 'flow'],
    createdAt: '2026-08-13T14:00:00Z',
    updatedAt: '2026-08-15T12:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'iss-alp-36',
    identifier: 'ALP-36',
    title: 'Design a better layout for Move Money actions (Send money & Add money)',
    description: 'Streamline touch targets and action hierarchy for top transfer shortcuts.',
    status: 'review',
    priority: 'high',
    projectId: 'proj-4',
    labels: ['ux', 'quick-actions'],
    createdAt: '2026-08-13T15:00:00Z',
    updatedAt: '2026-08-15T13:00:00Z',
    subtasks: [
      { id: 'sub-36-1', title: 'Action card layout', completed: false },
      { id: 'sub-36-2', title: 'Interactive hover animations', completed: false }
    ],
    comments: []
  },
  {
    id: 'iss-alp-24',
    identifier: 'ALP-24',
    title: 'Quality gate: accessibility audit of Stages 1-2 (GAP-01..10)',
    description: 'WCAG 2.2 AA accessibility audit across core navigation and checkout elements.',
    status: 'done',
    priority: 'none',
    projectId: 'proj-4',
    assignedAgentId: 'agent-4',
    labels: ['a11y', 'qa'],
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-14T14:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'iss-alp-12',
    identifier: 'ALP-12',
    title: 'Implement approved feature gaps in E-Wallet prototype (handoff from ALP-11)',
    description: 'Implement complete suite of approved gaps including offline caching and biometric unlock.',
    status: 'done',
    priority: 'none',
    projectId: 'proj-4',
    assignedSquadId: 'sq-2',
    labels: ['features', 'prototype'],
    createdAt: '2026-08-11T10:00:00Z',
    updatedAt: '2026-08-14T15:00:00Z',
    subtasks: Array.from({ length: 12 }, (_, i) => ({
      id: `sub-12-${i}`,
      title: `Feature gap item GAP-${String(i + 1).padStart(2, '0')}`,
      completed: true
    })),
    comments: []
  },
  {
    id: 'iss-alp-23',
    identifier: 'ALP-23',
    title: 'Quality gate: integration review of Stages 1-2 (GAP-01..10)',
    description: 'Comprehensive integration and regression test verification across stages 1 and 2.',
    status: 'done',
    priority: 'none',
    projectId: 'proj-4',
    assignedAgentId: 'agent-3',
    labels: ['review', 'security'],
    createdAt: '2026-08-12T11:00:00Z',
    updatedAt: '2026-08-14T16:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'iss-alp-22',
    identifier: 'ALP-22',
    title: 'GAP-10: KYC resubmission path',
    description: 'Allow users with rejected or expired KYC documents to securely upload replacement verification.',
    status: 'done',
    priority: 'none',
    projectId: 'proj-4',
    assignedAgentId: 'agent-2',
    labels: ['kyc', 'compliance'],
    createdAt: '2026-08-12T12:00:00Z',
    updatedAt: '2026-08-14T17:00:00Z',
    subtasks: [],
    comments: []
  }
];
export const initialDeployments: Deployment[] = [
  {
    id: 'dep-101',
    projectId: 'proj-1',
    projectName: 'E-Wallet',
    name: 'Production Deploy v2.4.0',
    environment: 'Production',
    status: 'success',
    branch: 'main',
    commitSha: '8f2a4b9',
    commitMessage: 'feat(payments): integrate biometrics and instant settlement rails',
    triggeredBy: {
      type: 'agent',
      name: 'Cipher Drake (DevOps)',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
    },
    durationSec: 62,
    startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    previewUrl: 'https://app.multica.io',
    stages: [
      { name: 'Lint & Typecheck', status: 'success', durationSec: 10, logs: ['TypeScript 5.6 check passed: 0 errors.', 'Biome linter passed with 0 warnings.'] },
      { name: 'Playwright E2E Suite', status: 'success', durationSec: 26, logs: ['42 integration suites passed.', '0 regressions detected.'] },
      { name: 'Secrets & SAST Audit', status: 'success', durationSec: 8, logs: ['Trivy scan clean: 0 vulnerabilities found.'] },
      { name: 'Global Edge Rollout', status: 'success', durationSec: 18, logs: ['Traffic shifted 100% to production containers. HTTP 200 OK.'] }
    ]
  },
  {
    id: 'dep-102',
    projectId: 'proj-3',
    projectName: 'Capstone',
    name: 'PR #42 Preview Build',
    environment: 'Preview',
    status: 'agent_evaluating',
    branch: 'feat/ws-backoff-jitter',
    commitSha: '3c8e11a',
    commitMessage: 'fix(ws): implement exponential reconnect backoff with jitter',
    triggeredBy: {
      type: 'agent',
      name: 'Kaelen Vance (Coder)',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    durationSec: 38,
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    previewUrl: 'https://pr42-capstone.preview.multica.internal',
    stages: [
      { name: 'Lint & Typecheck', status: 'success', durationSec: 8, logs: ['Typecheck passed in 6.2s.'] },
      { name: 'Vite Bundle Build', status: 'success', durationSec: 16, logs: ['Production bundle created: 1.1MB compressed.'] },
      { name: 'Nyx Orion QA Verification', status: 'running', durationSec: 14, logs: ['Running Playwright socket disconnection stress test...'] },
      { name: 'Ephemeral Edge Deploy', status: 'pending', logs: [] }
    ]
  },
  {
    id: 'dep-103',
    projectId: 'proj-4',
    projectName: 'ServEase',
    name: 'Nightly Canary Release',
    environment: 'Staging',
    status: 'failed',
    branch: 'release/v1.9',
    commitSha: 'a19f02b',
    commitMessage: 'chore(deps): bump redis driver to v4.8.0',
    triggeredBy: {
      type: 'human',
      name: 'lloyd lim'
    },
    durationSec: 45,
    startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    stages: [
      { name: 'Lint & Typecheck', status: 'success', durationSec: 9, logs: ['Typecheck passed.'] },
      { name: 'Redis Integration Tests', status: 'failed', durationSec: 22, logs: ['Error: ConnectionTimeoutError on redis-cluster:6379', 'Pipeline terminated with exit code 1.'] },
      { name: 'Container Build', status: 'pending', logs: [] },
      { name: 'Deploy to Staging', status: 'pending', logs: [] }
    ]
  },
  {
    id: 'dep-104',
    projectId: 'proj-2',
    projectName: 'Calculator',
    name: 'Release v1.2.0 Staging',
    environment: 'Staging',
    status: 'success',
    branch: 'main',
    commitSha: '7e4c291',
    commitMessage: 'feat(math): add trigonometric expression solver',
    triggeredBy: {
      type: 'agent',
      name: 'Ada Lovelace (Architect)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    durationSec: 51,
    startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    previewUrl: 'https://staging-calc.multica.internal',
    stages: [
      { name: 'Lint & Typecheck', status: 'success', durationSec: 11, logs: ['Clean typecheck pass.'] },
      { name: 'Unit Math Solver Matrix', status: 'success', durationSec: 21, logs: ['120 precision calculation tests passed.'] },
      { name: 'Staging Cluster Deploy', status: 'success', durationSec: 19, logs: ['Staging deployment complete.'] }
    ]
  }
];

export const initialInbox: InboxNotification[] = [
  {
    id: 'notif-client-1',
    type: 'agent_approval',
    title: 'Specification ready for your review',
    message:
      'SPEC-1042 — "Appointment booking and reminders" is ready for review. Nothing is built until you approve.',
    read: false,
    audience: 'client',
    clientId: 'usr-client',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    entityType: 'issue',
    entityId: 'doc-1042',
    approvalStatus: 'pending',
    meta: { issueIdentifier: 'SPEC-1042' }
  },
  {
    id: 'notif-client-2',
    type: 'agent_completed',
    title: 'Patient intake form digitisation is underway',
    message:
      '4 of 10 items are complete. Your project manager will share the next progress update before anything changes.',
    read: true,
    audience: 'client',
    clientId: 'usr-client',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    entityType: 'issue',
    entityId: 'doc-1041',
    meta: { issueIdentifier: 'SPEC-1041' }
  },
  {
    id: 'notif-1',
    type: 'agent_failed',
    audience: 'internal',
    title: 'make the send money and add money vi...',
    message: "Failed: There's an issue with the selected model context or socket stream.",
    read: false,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    entityType: 'issue',
    entityId: 'iss-2',
    meta: {
      agentName: 'Kaelen Vance',
      agentRole: 'Coder',
      issueIdentifier: 'ALP-44'
    }
  },
  {
    id: 'notif-2',
    type: 'agent_failed',
    audience: 'internal',
    title: 'Home screen redesign v2: delta badge...',
    message: 'Task failed during Playwright layout validation pass.',
    read: false,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    entityType: 'issue',
    entityId: 'iss-3',
    meta: {
      agentName: 'Nyx Orion',
      agentRole: 'QA & Testing',
      issueIdentifier: 'ALP-43'
    }
  },
  {
    id: 'notif-3',
    type: 'agent_approval',
    audience: 'internal',
    title: 'Home screen: 1:1 layout replication of r...',
    message: 'Opened [ALP-42](mention://issue/92283bc0-4e12) and generated patch diff ready for merge.',
    read: false,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    entityType: 'issue',
    entityId: 'iss-1',
    approvalStatus: 'pending',
    meta: {
      agentName: 'Ada Lovelace',
      agentRole: 'Architect',
      issueIdentifier: 'ALP-42',
      proposedChanges: `+ export const InboxView: React.FC = () => {
+   return <div className="h-full flex bg-surface">{/* 2-pane split inbox */}</div>;
+ };`,
    }
  }
];

export const initialAnalytics: AnalyticsData = {
  totalRuns24h: 34,
  avgLatencyMs: 380,
  totalAgentRuns: 89,
  successRate: 98.4,
  runTimeline: [
    { hour: '00:00', runs: 2, completed: 2, failed: 0 },
    { hour: '03:00', runs: 1, completed: 1, failed: 0 },
    { hour: '06:00', runs: 3, completed: 3, failed: 0 },
    { hour: '09:00', runs: 6, completed: 6, failed: 0 },
    { hour: '12:00', runs: 5, completed: 4, failed: 1 },
    { hour: '15:00', runs: 7, completed: 7, failed: 0 },
    { hour: '18:00', runs: 5, completed: 4, failed: 1 },
    { hour: '21:00', runs: 5, completed: 5, failed: 0 },
  ],
  agentBreakdown: [
    { agentId: 'agent-2', agentName: 'Kaelen Vance (Coder)', runs: 34, efficiency: 94 },
    { agentId: 'agent-1', agentName: 'Ada Lovelace (Architect)', runs: 22, efficiency: 99 },
    { agentId: 'agent-3', agentName: 'Vesper Nyx (Reviewer)', runs: 16, efficiency: 98 },
    { agentId: 'agent-5', agentName: 'Cipher Drake (DevOps)', runs: 11, efficiency: 96 },
    { agentId: 'agent-4', agentName: 'Nyx Orion (QA)', runs: 6, efficiency: 95 }
  ],
  modelBreakdown: [
    { modelName: 'claude-3-7-sonnet', percentage: 48, totalCalls: 45 },
    { modelName: 'gpt-4o', percentage: 28, totalCalls: 28 },
    { modelName: 'deepseek-r1 (Local 70B)', percentage: 14, totalCalls: 32 },
    { modelName: 'llama3.3-70b (Local)', percentage: 7, totalCalls: 18 },
    { modelName: 'gemini-2.0-flash', percentage: 3, totalCalls: 12 }
  ]
};

/** Empty, honest baseline used until the daemon returns real run telemetry. */
export const emptyAnalytics: AnalyticsData = {
  totalRuns24h: 0,
  avgLatencyMs: 0,
  totalAgentRuns: 0,
  successRate: 0,
  runTimeline: [],
  agentBreakdown: [],
  modelBreakdown: []
};

export const initialSettings: WorkspaceSettings = {
  workspaceName: '',
  workspaceSlug: 'alpha-multica-hq',
  activeTheme: 'dark',
  apiKeys: {
    openai: 'sk-proj-••••••••••••••••••••••••4892',
    anthropic: 'sk-ant-••••••••••••••••••••••••9102',
    gemini: 'AIzaSy••••••••••••••••••••••••3310',
    groq: 'gsk_••••••••••••••••••••••••8819',
    huggingface: 'hf_••••••••••••••••••••••••1092'
  },
  localRuntimeUrl: 'http://localhost:11434',
  enableAutoTriage: true,
  defaultAutonomy: 'Semi-Autonomous (Requires Approval)',
  notificationsEnabled: true,
  telemetryEnabled: true,
  maxParallelAgentRuns: 4
};
export const initialUsers: User[] = [
  {
    id: 'usr-client',
    name: 'Marisol Reyes',
    email: 'marisol@northbaydental.ph',
    role: 'client',
    company: 'Northbay Dental Group',
    projectIds: ['proj-4']
  },
  {
    id: 'usr-dev',
    name: 'lloyd lim',
    email: 'lloyd@multica.io',
    role: 'dev',
    projectIds: ['proj-1', 'proj-3']
  },
  {
    id: 'usr-pm',
    name: 'Dana Okafor',
    email: 'dana@multica.io',
    role: 'pm',
    projectIds: ['proj-1', 'proj-2', 'proj-3', 'proj-4']
  },
  {
    id: 'usr-admin',
    name: 'Francis Peña',
    email: 'francis@multica.io',
    role: 'admin'
  }
];

/* ---------------------------------------------------------------------------
 * Requirement documents
 * ------------------------------------------------------------------------ */

export const initialRequirementDocs: RequirementDoc[] = [
  {
    id: 'doc-1042',
    identifier: 'SPEC-1042',
    title: 'Appointment booking and reminders',
    track: 'project',
    status: 'awaiting_client',
    version: 3,
    clientId: 'usr-client',
    clientName: 'Marisol Reyes',
    company: 'Northbay Dental Group',
    answers: {
      title: 'Appointment booking and reminders',
      problem:
        'Patients book by calling the front desk during clinic hours. Staff spend most of the morning on the phone, and we still lose roughly a fifth of appointments to no-shows.',
      affected: 'Front desk staff (4 people), and about 900 recurring patients',
      currentWorkaround: 'A paper diary at each of our three branches, reconciled by hand every evening',
      definitionOfDone:
        'A patient can book, reschedule, or cancel online without calling, and gets an automatic reminder the day before.',
      successMeasure: 'No-show rate under 8%, and at least half of bookings made online within three months',
      urgency: 'high',
      capabilities: [
        'Let patients see open slots per branch and book one',
        'Send a reminder by text 24 hours before the appointment',
        'Let patients reschedule or cancel from the reminder',
        'Take a small deposit at booking to reduce no-shows',
        'Give front desk staff a daily view of every branch',
        'Let staff block out holidays and dentist leave',
        'Show patients where each branch is',
        'Keep a record of past visits per patient',
        'Send a confirmation email after each booking'
      ],
      outOfScope: 'Insurance claims, clinical records, and anything touching treatment notes',
      concerns: ['Patient data privacy', 'Must work on older phones', 'Tagalog and English'],
      targetDate: '2026-11-30',
      expectedUsers: 4000,
      integrations: 'We use Xero for accounting. Nothing else that matters.',
      attachments: [
        { id: 'att-1', name: 'current-paper-diary-photo.jpg', sizeKb: 1840 },
        { id: 'att-2', name: 'branch-opening-hours.xlsx', sizeKb: 22 }
      ],
      approvers: 'Me, and Dr. Alvarez for anything touching patient records',
      updateCadence: 'weekly'
    },
    problemStatement:
      'Northbay Dental Group takes all appointments by phone across three branches, reconciled nightly against paper diaries. Front-desk capacity is consumed by call handling and the no-show rate sits near 20%, costing both chair time and staff hours.',
    goals: [
      'Move at least 50% of bookings to self-service within three months of launch',
      'Reduce no-show rate below 8%',
      'Eliminate nightly manual reconciliation across branches'
    ],
    functionalRequirements: [
      {
        id: 'fr-1',
        clientWording: 'Let patients see open slots per branch and book one',
        requirement:
          'Public booking interface showing real-time availability filtered by branch, service type, and practitioner, with atomic slot reservation to prevent double-booking.',
        band: 'L',
        acceptanceCriteria: [
          'Availability reflects staff calendars within 60 seconds of a change',
          'Two concurrent bookings for the same slot cannot both succeed',
          'A booking can be completed in under 90 seconds on a 3G connection',
          'Slots outside a branch\'s opening hours are never offered'
        ],
        included: true
      },
      {
        id: 'fr-2',
        clientWording: 'Send a reminder by text 24 hours before the appointment',
        requirement:
          'Scheduled SMS reminder dispatched 24 hours ahead, with delivery-failure retry and an opt-out path.',
        band: 'M',
        acceptanceCriteria: [
          'Reminder sends within 5 minutes of the 24-hour mark',
          'Failed sends retry twice before flagging staff',
          'Patients can opt out by replying STOP'
        ],
        included: true
      },
      {
        id: 'fr-3',
        clientWording: 'Let patients reschedule or cancel from the reminder',
        requirement:
          'Tokenised self-service link in the reminder allowing reschedule or cancellation without login, honouring a configurable cut-off window.',
        band: 'M',
        acceptanceCriteria: [
          'Link expires after the appointment time passes',
          'Cancellation inside the cut-off window is refused with a clear reason',
          'Freed slots return to public availability immediately'
        ],
        included: true
      },
      {
        id: 'fr-4',
        clientWording: 'Take a small deposit at booking to reduce no-shows',
        requirement:
          'Card deposit captured at booking with automatic refund on in-window cancellation and forfeit on no-show.',
        band: 'L',
        acceptanceCriteria: [
          'Deposit amount is configurable per service type',
          'In-window cancellations refund automatically within one business day',
          'Failed payments do not consume the slot'
        ],
        included: true
      },
      {
        id: 'fr-5',
        clientWording: 'Give front desk staff a daily view of every branch',
        requirement:
          'Staff console presenting a combined and per-branch day view with check-in state, filterable by practitioner.',
        band: 'M',
        acceptanceCriteria: [
          'Day view loads in under 2 seconds with 200 appointments',
          'Check-in state updates across open sessions without refresh',
          'Staff see only branches they are assigned to'
        ],
        included: true
      },
      {
        id: 'fr-6',
        clientWording: 'Let staff block out holidays and dentist leave',
        requirement:
          'Availability exception management for public holidays, practitioner leave, and ad-hoc closures, applied ahead of slot generation.',
        band: 'S',
        acceptanceCriteria: [
          'A blocked range immediately withdraws affected open slots',
          'Existing bookings in a newly blocked range are flagged, never silently cancelled'
        ],
        included: true
      },
      {
        id: 'fr-7',
        clientWording: 'Show patients where each branch is',
        requirement: 'Branch locator with map, address, and travel directions per branch.',
        band: 'S',
        acceptanceCriteria: [
          'Each branch shows an accurate pin and a directions link',
          'Locator is usable without JavaScript geolocation permission'
        ],
        included: true
      },
      {
        id: 'fr-8',
        clientWording: 'Keep a record of past visits per patient',
        requirement:
          'Patient-facing appointment history limited to scheduling metadata, explicitly excluding clinical notes.',
        band: 'S',
        acceptanceCriteria: [
          'History shows date, branch, practitioner, and service only',
          'No clinical or treatment field is reachable from this surface'
        ],
        included: true
      },
      {
        id: 'fr-9',
        clientWording: 'Send a confirmation email after each booking',
        requirement:
          'Transactional confirmation email with calendar attachment, sent on booking and on any subsequent change.',
        band: 'S',
        acceptanceCriteria: [
          'Email arrives within 2 minutes of booking',
          'Attached calendar entry opens correctly in Google and Apple calendars'
        ],
        included: true
      }
    ],
    nonFunctionalRequirements: [
      'Patient data handled under Philippine Data Privacy Act; deposits never store raw card data',
      'Interface must remain usable on Android 8 and Safari 13',
      'Tagalog and English throughout, switchable per patient',
      'Availability target 99.5% during clinic opening hours'
    ],
    constraints: [
      'Target launch 30 November 2026',
      'Xero is the only existing system requiring integration'
    ],
    outOfScope: [
      'Insurance claim submission',
      'Clinical records and treatment notes',
      'Practitioner payroll'
    ],
    createdAt: '2026-08-14T09:12:00Z',
    updatedAt: '2026-08-16T15:40:00Z'
  },
  {
    id: 'doc-1041',
    identifier: 'SPEC-1041',
    title: 'Patient intake form digitisation',
    track: 'project',
    status: 'approved',
    version: 2,
    clientId: 'usr-client',
    clientName: 'Marisol Reyes',
    company: 'Northbay Dental Group',
    answers: {
      title: 'Patient intake form digitisation',
      problem: 'New patients fill a four-page paper form in the waiting room; staff retype it later.',
      affected: 'Front desk staff and every new patient',
      currentWorkaround: 'Paper forms, retyped into a spreadsheet each evening',
      definitionOfDone: 'New patients complete intake on their phone before arriving.',
      successMeasure: 'Zero retyping; intake completed before arrival for 70% of new patients',
      urgency: 'medium',
      capabilities: [
        'Send an intake link when an appointment is booked',
        'Let patients fill the form on a phone',
        'Flag incomplete forms for staff'
      ],
      outOfScope: 'Clinical assessment forms',
      concerns: ['Patient data privacy'],
      targetDate: '2026-09-30',
      expectedUsers: 4000,
      integrations: 'None',
      attachments: [{ id: 'att-3', name: 'existing-intake-form.pdf', sizeKb: 410 }],
      approvers: 'Me',
      updateCadence: 'on_milestone'
    },
    problemStatement:
      'New-patient intake is captured on paper and manually retyped, creating duplicate effort and transcription errors.',
    goals: ['Eliminate retyping', 'Complete intake before arrival for most new patients'],
    functionalRequirements: [
      {
        id: 'fr-1041-1',
        clientWording: 'Send an intake link when an appointment is booked',
        requirement: 'Tokenised intake link issued on booking confirmation email.',
        band: 'S',
        acceptanceCriteria: ['Link issued within 2 minutes of booking', 'Link expires after the appointment'],
        included: true
      },
      {
        id: 'fr-1041-2',
        clientWording: 'Let patients fill the form on a phone',
        requirement: 'Mobile-first multi-step intake form with per-step autosave.',
        band: 'M',
        acceptanceCriteria: ['Partial answers survive a dropped connection', 'Completable on a 360px viewport'],
        included: true
      },
      {
        id: 'fr-1041-3',
        clientWording: 'Flag incomplete forms for staff',
        requirement: 'Staff queue listing incomplete intakes ahead of the appointment date.',
        band: 'S',
        acceptanceCriteria: ['Queue sorts by appointment time', 'Completed forms leave the queue automatically'],
        included: true
      }
    ],
    nonFunctionalRequirements: ['Data Privacy Act compliance', 'Usable on Android 8'],
    constraints: ['Launch before the booking system'],
    outOfScope: ['Clinical assessment forms'],
    projectId: 'proj-4',
    approvedBy: 'Marisol Reyes',
    approvedAt: '2026-08-12T10:30:00Z',
    createdAt: '2026-08-08T11:00:00Z',
    updatedAt: '2026-08-12T10:30:00Z'
  }
];
