import { 
  Project, 
  Agent, 
  Squad, 
  Issue, 
  RuntimeEngine, 
  Skill, 
  Deployment, 
  InboxNotification, 
  AnalyticsData, 
  WorkspaceSettings,
  ChatMessage,
  ChatThread
} from '../types';

export const initialProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'E-Wallet',
    key: 'EWL',
    description: 'Next-generation fintech mobile wallet, card management, and cash flow workflows.',
    color: '#6366f1',
    icon: '📁',
    status: 'planned',
    priority: 'none',
    startDate: '2026-08-11',
    targetDate: '2026-10-15',
    createdAt: '4d ago',
    leadType: 'member',
    leadName: undefined,
    resources: [
      { id: 'res-1', type: 'github_repo', name: 'ewallet-core', pathOrUrl: 'github.com/multica/ewallet-app', branchOrMachine: 'main' }
    ],
    progressPercentage: 77,
    totalIssues: 30,
    completedIssues: 23,
    milestones: [
      { id: 'm-1', title: 'Payment Gateway Integration', targetDate: '2026-09-01', completed: true }
    ]
  },
  {
    id: 'proj-2',
    name: 'Calculator',
    key: 'CAL',
    description: 'Lightweight arithmetic solver engine and multi-platform scientific calculator UI.',
    color: '#38bdf8',
    icon: '📁',
    status: 'planned',
    priority: 'none',
    startDate: '2026-08-07',
    targetDate: '2026-09-30',
    createdAt: '8d ago',
    leadType: 'member',
    leadName: undefined,
    resources: [
      { id: 'res-2', type: 'github_repo', name: 'calculator-engine', pathOrUrl: 'github.com/multica/calculator-engine', branchOrMachine: 'main' }
    ],
    progressPercentage: 0,
    totalIssues: 0,
    completedIssues: 0,
    milestones: []
  },
  {
    id: 'proj-3',
    name: 'Capstone',
    key: 'CAP',
    description: 'Autonomous multi-agent orchestration frontend with real-time streaming and local LLM execution.',
    color: '#34d399',
    icon: '📁',
    status: 'planned',
    priority: 'none',
    startDate: '2026-08-06',
    targetDate: '2026-10-31',
    createdAt: '9d ago',
    leadType: 'member',
    leadName: 'lloyd lim',
    resources: [
      { id: 'res-3', type: 'local_dir', name: 'alpha-fe', pathOrUrl: '/Users/mac/Capstone - Multica/alpha-fe', branchOrMachine: 'Local Mac' }
    ],
    progressPercentage: 100,
    totalIssues: 1,
    completedIssues: 1,
    milestones: [
      { id: 'm-2', title: 'Interactive Flowchart Builder', targetDate: '2026-09-01', completed: true }
    ]
  },
  {
    id: 'proj-4',
    name: 'ServEase',
    key: 'SRV',
    description: 'On-demand service booking marketplace and automated scheduling dispatch platform.',
    color: '#f59e0b',
    icon: '📁',
    status: 'planned',
    priority: 'none',
    startDate: '2026-08-06',
    targetDate: '2026-11-15',
    createdAt: '9d ago',
    leadType: 'member',
    leadName: undefined,
    resources: [
      { id: 'res-4', type: 'github_repo', name: 'servease-api', pathOrUrl: 'github.com/multica/servease-api', branchOrMachine: 'release' }
    ],
    progressPercentage: 100,
    totalIssues: 1,
    completedIssues: 1,
    milestones: []
  }
];

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

export const initialSquads: Squad[] = [
  {
    id: 'sq-1',
    name: 'Core Swarm Nexus',
    description: 'High-velocity architecture, coding, and continuous review squad for critical core engine components.',
    avatar: '⚡',
    color: '#6366f1',
    leaderAgentId: 'agent-1',
    memberAgentIds: ['agent-1', 'agent-2', 'agent-3', 'agent-4'],
    topology: 'hierarchical',
    mission: 'Deliver scalable multi-agent event loops with 99.9% fault tolerance.',
    activeRunsCount: 2,
    completedRunsCount: 84
  },
  {
    id: 'sq-2',
    name: 'Frontend Velocity Crew',
    description: 'Dedicated user interface, canvas motion, and design system engineering team.',
    avatar: '🎨',
    color: '#38bdf8',
    leaderAgentId: 'agent-2',
    memberAgentIds: ['agent-2', 'agent-4'],
    topology: 'sequential',
    mission: 'Craft flawless 60 FPS interfaces with reactive agent streaming indicators.',
    activeRunsCount: 1,
    completedRunsCount: 52
  },
  {
    id: 'sq-3',
    name: 'Infra & SecOps Strike Force',
    description: 'Autonomous vulnerability scanning, container orchestration, and zero-downtime release pipeline.',
    avatar: '🛡️',
    color: '#34d399',
    leaderAgentId: 'agent-5',
    memberAgentIds: ['agent-5', 'agent-3'],
    topology: 'consensus',
    mission: 'Ensure zero security flaws and self-healing deployment canary checks.',
    activeRunsCount: 0,
    completedRunsCount: 41
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
    title: 'Token Usage & Cost Optimization Advisor Widget',
    description: 'Provide proactive tips in the analytics dashboard when an agent can be downgraded from Claude 3.7 to DeepSeek-R1 for trivial parsing tasks.',
    status: 'review',
    priority: 'low',
    projectId: 'proj-2',
    assignedAgentId: 'agent-3',
    assignedSquadId: 'sq-2',
    labels: ['analytics', 'cost', 'optimization'],
    createdAt: '2026-08-11T12:00:00Z',
    updatedAt: '2026-08-15T09:15:00Z',
    subtasks: [
      { id: 'sub-11', title: 'Cost variance algorithm', completed: true, assignedAgentId: 'agent-3' },
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

export const initialRuntimes: RuntimeEngine[] = [
  {
    id: 'rt-local-ollama',
    name: 'Local Ollama Engine',
    type: 'local',
    provider: 'Ollama',
    endpoint: 'http://localhost:11434',
    port: 11434,
    status: 'online',
    latencyMs: 18,
    modelsLoaded: ['llama3.3:70b-instruct-q8', 'deepseek-r1:70b', 'qwen2.5-coder:32b', 'nomic-embed-text:latest'],
    vramUsageGb: 38.4,
    vramTotalGb: 64.0,
    gpuName: 'Apple M3 Max (64GB Unified)',
    isDefault: true,
    detectedAt: '2026-08-15T14:55:00Z'
  },
  {
    id: 'rt-local-lmstudio',
    name: 'LM Studio Inference Server',
    type: 'local',
    provider: 'LM Studio',
    endpoint: 'http://localhost:1234',
    port: 1234,
    status: 'online',
    latencyMs: 24,
    modelsLoaded: ['deepseek-r1:32b', 'phi-4:14b-instruct'],
    vramUsageGb: 22.1,
    vramTotalGb: 64.0,
    gpuName: 'Apple M3 Max (64GB Unified)',
    isDefault: false,
    detectedAt: '2026-08-15T14:55:12Z'
  },
  {
    id: 'rt-cloud-anthropic',
    name: 'Anthropic Cloud API',
    type: 'cloud',
    provider: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1',
    status: 'online',
    latencyMs: 290,
    modelsLoaded: ['claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
    isDefault: false
  },
  {
    id: 'rt-cloud-openai',
    name: 'OpenAI Cloud Gateway',
    type: 'cloud',
    provider: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    status: 'online',
    latencyMs: 310,
    modelsLoaded: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini'],
    isDefault: false
  },
  {
    id: 'rt-cloud-gemini',
    name: 'Google Gemini Pro Gateway',
    type: 'cloud',
    provider: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    status: 'online',
    latencyMs: 240,
    modelsLoaded: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    isDefault: false
  }
];

export const initialSkills: Skill[] = [
  {
    id: 'sk-fs',
    name: 'Local File System Manager',
    description: 'Read, write, edit, search, and diff files within authorized workspace boundaries.',
    icon: 'FolderKanban',
    category: 'File Operations',
    permissions: 'write',
    parametersCount: 6,
    enabled: true,
    source: 'builtin',
    commandExample: 'fs.read_file({ path: "src/App.tsx", lineStart: 1, lineEnd: 40 })'
  },
  {
    id: 'sk-code-exec',
    name: 'Isolated Code Sandbox Runner',
    description: 'Execute Python, TypeScript, and Node.js snippets in a secure, ephemeral container.',
    icon: 'Terminal',
    category: 'Code Execution',
    permissions: 'full_execution',
    parametersCount: 4,
    enabled: true,
    source: 'builtin',
    commandExample: 'sandbox.run({ runtime: "ts-node", code: "console.log(process.env)" })'
  },
  {
    id: 'sk-browser',
    name: 'Autonomous Web Browser & Scraper',
    description: 'Headless Playwright browser agent for UI verification, screenshots, and dynamic crawling.',
    icon: 'Globe',
    category: 'Browser & Web',
    permissions: 'full_execution',
    parametersCount: 8,
    enabled: true,
    source: 'system_detected',
    commandExample: 'browser.navigate({ url: "http://localhost:3000", captureScreenshot: true })'
  },
  {
    id: 'sk-bash',
    name: 'Shell & Terminal Commander',
    description: 'Execute defensive shell commands, linters, package managers, and system probes.',
    icon: 'Command',
    category: 'Terminal & Shell',
    permissions: 'full_execution',
    parametersCount: 5,
    enabled: true,
    source: 'builtin',
    commandExample: 'bash.exec({ command: "cargo test --all", timeoutMs: 30000 })'
  },
  {
    id: 'sk-git',
    name: 'Git & GitHub Workflow Engine',
    description: 'Branch management, commit creation, git diff analysis, and GitHub PR creation/comments.',
    icon: 'GitBranch',
    category: 'Git & GitHub',
    permissions: 'write',
    parametersCount: 7,
    enabled: true,
    source: 'builtin',
    commandExample: 'git.create_pr({ title: "feat: add telemetry", base: "main" })'
  },
  {
    id: 'sk-mcp-postgres',
    name: 'PostgreSQL MCP Data Connector',
    description: 'Inspect schemas, run read-only analytical queries, and generate entity relationship models.',
    icon: 'Database',
    category: 'MCP Servers',
    permissions: 'read_only',
    parametersCount: 3,
    enabled: true,
    source: 'mcp_server',
    commandExample: 'mcp.postgres.query({ sql: "SELECT count(*) FROM issues;" })'
  },
  {
    id: 'sk-docker',
    name: 'Docker Container Orchestrator',
    description: 'Spin up test databases, Redis caches, and mock external API dependencies during CI tests.',
    icon: 'Box',
    category: 'Cloud & API',
    permissions: 'full_execution',
    parametersCount: 5,
    enabled: true,
    source: 'system_detected',
    commandExample: 'docker.compose_up({ file: "docker-compose.test.yml" })'
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
    id: 'notif-1',
    type: 'agent_failed',
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
+   return <div className="h-full flex bg-[#16171D]">{/* 2-pane split inbox */}</div>;
+ };`,
      costTokens: 3820
    }
  }
];

export const initialAnalytics: AnalyticsData = {
  totalTokens24h: 3840250,
  totalCost24h: 18.42,
  avgLatencyMs: 380,
  totalAgentRuns: 89,
  successRate: 98.4,
  tokenTimeline: [
    { hour: '00:00', promptTokens: 42000, completionTokens: 18000, cost: 0.28 },
    { hour: '03:00', promptTokens: 28000, completionTokens: 12000, cost: 0.19 },
    { hour: '06:00', promptTokens: 64000, completionTokens: 31000, cost: 0.44 },
    { hour: '09:00', promptTokens: 280000, completionTokens: 140000, cost: 1.95 },
    { hour: '12:00', promptTokens: 520000, completionTokens: 260000, cost: 3.65 },
    { hour: '15:00', promptTokens: 710000, completionTokens: 340000, cost: 4.88 },
    { hour: '18:00', promptTokens: 480000, completionTokens: 230000, cost: 3.20 },
    { hour: '21:00', promptTokens: 390000, completionTokens: 185000, cost: 2.65 },
  ],
  agentBreakdown: [
    { agentId: 'agent-2', agentName: 'Kaelen Vance (Coder)', tokens: 1420000, cost: 6.80, runs: 34, efficiency: 94 },
    { agentId: 'agent-1', agentName: 'Ada Lovelace (Architect)', tokens: 980000, cost: 5.10, runs: 22, efficiency: 99 },
    { agentId: 'agent-3', agentName: 'Vesper Nyx (Reviewer)', tokens: 690000, cost: 1.85, runs: 16, efficiency: 98 },
    { agentId: 'agent-5', agentName: 'Cipher Drake (DevOps)', tokens: 450000, cost: 2.45, runs: 11, efficiency: 96 },
    { agentId: 'agent-4', agentName: 'Nyx Orion (QA)', tokens: 300250, cost: 0.72, runs: 6, efficiency: 95 }
  ],
  modelBreakdown: [
    { modelName: 'claude-3-7-sonnet', percentage: 48, cost: 8.84, totalCalls: 45 },
    { modelName: 'gpt-4o', percentage: 28, cost: 5.15, totalCalls: 28 },
    { modelName: 'deepseek-r1 (Local 70B)', percentage: 14, cost: 0.00, totalCalls: 32 },
    { modelName: 'llama3.3-70b (Local)', percentage: 7, cost: 0.00, totalCalls: 18 },
    { modelName: 'gemini-2.0-flash', percentage: 3, cost: 0.43, totalCalls: 12 }
  ]
};

export const initialSettings: WorkspaceSettings = {
  workspaceName: 'Multica Alpha Workspace',
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

export const initialChatThreads: ChatThread[] = [
  {
    id: 'th-1',
    title: 'Switch Frontend Squad to DeepSeek V4...',
    lastMessageSnippet: 'The workspace has no "reasonix" anywhere. Let me ...',
    lastMessageAt: '2026-08-14T18:22:00Z',
    pinned: false,
    iconType: 'asterisk',
    agentIds: ['agent-1', 'agent-2'],
    squadId: 'sq-2',
    messages: [
      {
        id: 'msg-101',
        senderType: 'user',
        senderName: 'You (Lead Engineer)',
        content: 'Switch Frontend Squad to DeepSeek V4 reasonix model.',
        timestamp: '2026-08-14T18:21:40Z'
      },
      {
        id: 'msg-102',
        senderType: 'agent',
        agentId: 'agent-1',
        senderName: 'Ada Lovelace',
        senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        content: 'The workspace has no "reasonix" anywhere. Let me inspect our connected local inference engines (Ollama on port 11434 and LM Studio on port 1234) to list all available DeepSeek checkpoints and route the frontend squad to `deepseek-r1:70b`.',
        thinkingProcess: 'Checking local runtimes. Discovered deepseek-r1:70b on local Ollama engine. Probing latency: 18ms. Routing squad-2 configuration.',
        toolsExecuted: [
          { name: 'runtimes.list', input: '{ "type": "local" }', output: 'Found Ollama (:11434) and LM Studio (:1234)', durationMs: 45 }
        ],
        timestamp: '2026-08-14T18:22:00Z'
      }
    ]
  },
  {
    id: 'th-2',
    title: 'Greeting',
    lastMessageSnippet: 'Failed to send',
    lastMessageAt: '2026-08-14T17:10:00Z',
    pinned: false,
    isFailed: true,
    iconType: 'asterisk',
    agentIds: ['agent-1'],
    messages: [
      {
        id: 'msg-201',
        senderType: 'user',
        senderName: 'You (Lead Engineer)',
        content: 'Hello! Are the agents awake?',
        timestamp: '2026-08-14T17:10:00Z'
      }
    ]
  },
  {
    id: 'th-3',
    title: 'Image Reading Capabilities',
    lastMessageSnippet: "Short answer: not visually — I'm a text-based agent, ...",
    lastMessageAt: '2026-08-14T16:45:00Z',
    pinned: false,
    iconType: 'asterisk',
    agentIds: ['agent-6'],
    messages: [
      {
        id: 'msg-301',
        senderType: 'user',
        senderName: 'You (Lead Engineer)',
        content: 'Can you inspect image attachments or visual mockups directly?',
        timestamp: '2026-08-14T16:44:20Z'
      },
      {
        id: 'msg-302',
        senderType: 'agent',
        agentId: 'agent-6',
        senderName: 'Atlas Prime',
        senderAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
        content: "Short answer: not visually — I'm a text-based agent, but I can use our Playwright browser vision scraper tool or invoke the multimodal Gemini gateway to analyze visual UI diffs and inspect DOM components.",
        thinkingProcess: 'Checking multimodal capabilities in active toolset. Tool sk-browser Playwright available. Cloud Gemini gateway available for vision embeddings.',
        timestamp: '2026-08-14T16:45:00Z'
      }
    ]
  },
  {
    id: 'th-4',
    title: 'Frontend Squad DeepSeek V4 Migration',
    lastMessageSnippet: 'Done — the whole Frontend Engineering squad is no...',
    lastMessageAt: '2026-08-14T15:30:00Z',
    pinned: false,
    iconType: 'asterisk',
    agentIds: ['agent-5'],
    squadId: 'sq-2',
    messages: [
      {
        id: 'msg-401',
        senderType: 'user',
        senderName: 'You (Lead Engineer)',
        content: 'Please update Frontend Velocity Crew configuration to point to deepseek-r1:70b on Ollama.',
        timestamp: '2026-08-14T15:29:10Z'
      },
      {
        id: 'msg-402',
        senderType: 'agent',
        agentId: 'agent-5',
        senderName: 'Cipher Drake',
        senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        content: 'Done — the whole Frontend Engineering squad is now configured to use deepseek-r1:70b on port 11434 with zero external API egress. Token costs reduced to $0.00/day.',
        thinkingProcess: 'Updating squad config. Re-pointing model parameter in workspace state.',
        timestamp: '2026-08-14T15:30:00Z'
      }
    ]
  },
  {
    id: 'th-5',
    title: '1:1 Layout and Illustration Replication',
    lastMessageSnippet: 'Created ALP-40 in the E-Wallet project, assigned to t...',
    lastMessageAt: '2026-08-14T14:15:00Z',
    pinned: false,
    iconType: 'flame',
    agentIds: ['agent-2'],
    messages: [
      {
        id: 'msg-501',
        senderType: 'user',
        senderName: 'You (Lead Engineer)',
        content: 'Replicate 1:1 layout and illustration tokens for the mobile wallet balance card.',
        timestamp: '2026-08-14T14:14:00Z'
      },
      {
        id: 'msg-502',
        senderType: 'agent',
        agentId: 'agent-2',
        senderName: 'Kaelen Vance',
        senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        content: 'Created ALP-40 in the E-Wallet project, assigned to the Frontend Crew. Generated Tailwind component with glassmorphism gradient styles and Lucide icon badges.',
        thinkingProcess: 'Scaffolding card component. Added backdrop blur and rounded border tokens.',
        timestamp: '2026-08-14T14:15:00Z'
      }
    ]
  },
  {
    id: 'th-6',
    title: 'Improve Move Money Layouts',
    lastMessageSnippet: 'Done — two issues created on the E-Wallet project, f...',
    lastMessageAt: '2026-08-13T19:40:00Z',
    pinned: false,
    iconType: 'asterisk',
    agentIds: ['agent-4'],
    messages: [
      {
        id: 'msg-601',
        senderType: 'user',
        senderName: 'You (Lead Engineer)',
        content: 'Improve spacing and padding on the Move Money transaction list flows.',
        timestamp: '2026-08-13T19:39:10Z'
      },
      {
        id: 'msg-602',
        senderType: 'agent',
        agentId: 'agent-4',
        senderName: 'Nyx Orion',
        senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        content: 'Done — two issues created on the E-Wallet project, fixing padding offsets and adding smooth transaction receipt transitions.',
        timestamp: '2026-08-13T19:40:00Z'
      }
    ]
  },
  {
    id: 'th-7',
    title: 'Switch Squad Agents to Claude Sonnet 5',
    lastMessageSnippet: 'Done ✅ All squad agents now run on Claude Sonnet ...',
    lastMessageAt: '2026-08-13T11:20:00Z',
    pinned: false,
    iconType: 'asterisk',
    agentIds: ['agent-1', 'agent-2', 'agent-3'],
    messages: [
      {
        id: 'msg-701',
        senderType: 'user',
        senderName: 'You (Lead Engineer)',
        content: 'Upgrade Core Swarm Nexus reasoning model to claude-3-7-sonnet.',
        timestamp: '2026-08-13T11:19:00Z'
      },
      {
        id: 'msg-702',
        senderType: 'agent',
        agentId: 'agent-1',
        senderName: 'Ada Lovelace',
        senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        content: 'Done ✅ All squad agents now run on Claude Sonnet 3.7 with temperature 0.2 and 64k token context window.',
        timestamp: '2026-08-13T11:20:00Z'
      }
    ]
  }
];

export const initialChatMessages: ChatMessage[] = initialChatThreads[0]?.messages || [];

