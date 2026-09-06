Alpha Frontend - Complete System Prompt & Architecture Guide
Project: Capstone Prototype Alpha - AI Agent Orchestration Dashboard
Version: 2.0 (Hierarchical Navigation)
Date: August 27, 2026
Audience: Developers, architects, product managers, designers
Status: Production-ready with UX improvements queued

EXECUTIVE SUMMARY
Alpha is a professional SaaS platform that enables:

Clients to submit feature requests, approve budgets, track delivery, and communicate with teams
Teams (Dev, PM, Admin) to manage AI agents, coordinate work, run deployments, and track costs
AI Agents to autonomously code, review, architect, and test with human approval workflows
Key Improvements in v2.0:

✨ Hierarchical Navigation: 16 tabs organized into 7 conceptual groups (Workspace, Work, Requests, AI Operations, Delivery, Insights, Settings)
🎨 UI Design System: Aligned with AIDEA Smart SaaS Dashboard UI Kit (light-mode ready)
🔐 Data-Driven RBAC: Master navigation tree + role-based filters (maintainable, scalable)
📊 Role-Specific Views: 4 distinct navigation layouts (client, dev, pm, admin)
Tech Stack: React 18 + TypeScript + Vite 6 + Tailwind CSS 3 + Supabase
Architecture: React Context API + local daemon (port 3001) + WebSocket + localStorage

1. SYSTEM ARCHITECTURE
1.1 High-Level Layers
┌────────────────────────────────────────────────────┐
│ Frontend: React 18 + TypeScript + Vite             │
│ ├─ App.tsx: 16-tab window chrome + view routing    │
│ ├─ AppContext.tsx: Global state (50+ methods)      │
│ ├─ 16 Feature modules (agents, issues, etc.)       │
│ ├─ HierarchicalSidebar.tsx: Master nav tree        │
│ └─ Shared components & services                    │
├────────────────────────────────────────────────────┤
│ Services: API + WebSocket + Sync                   │
│ ├─ apiService.ts: HTTP to daemon/Supabase          │
│ ├─ runnerSocket.ts: WebSocket for live updates     │
│ └─ serverSync.ts: Persistence & offline fallback   │
├────────────────────────────────────────────────────┤
│ Backend: Alpha Daemon                              │
│ ├─ Port 3001/api: REST endpoints                   │
│ ├─ Port 3002: WebSocket for run progress           │
│ └─ Manages: Projects, Agents, Issues, Runs         │
├────────────────────────────────────────────────────┤
│ Persistence: Browser + Supabase                    │
│ ├─ localStorage: Client-side cache                 │
│ └─ Supabase PostgreSQL: Server of truth            │
└────────────────────────────────────────────────────┘
1.2 Key Dependencies
{
  "react": "18.3.1",
  "typescript": "5.7.3",
  "vite": "6.1.0",
  "tailwindcss": "3.4.17",
  "lucide-react": "0.475.0",
  "@supabase/supabase-js": "2.112.3"
}
2. NAVIGATION ARCHITECTURE (NEW)
2.1 Master Navigation Tree (Role-Agnostic)
The source of truth for all navigation. RBAC applies filters on top.

MASTER NAVIGATION TREE
│
├── WORKSPACE (Workspace Hub)
│   ├── Overview (portal) → Dashboard & status
│   ├── Inbox & Approvals (inbox) → Notifications & approvals
│   └── Agent Chat (chat) → Team messaging & agent collaboration
│
├── WORK MANAGEMENT (Task Coordination)
│   ├── My Issues (my_issues) → Personal task queue
│   ├── Issues & Tasks (issues) → Team Kanban board
│   ├── Projects & Milestones (projects) → Delivery roadmap
│   └── Specifications (documents) → Requirement specs
│
├── REQUESTS (Client Intake)
│   ├── New Request (intake) → Submit requirements
│   └── My Requests (documents) → Track requests [CLIENT ONLY]
│
├── AI OPERATIONS (Agent Automation)
│   ├── Agent Studio (agents) → Create & manage agents
│   ├── Agent Squads (squads) → Multi-agent teams
│   ├── AI Runtimes (runtimes) → Model providers
│   └── Skills & MCP (skills) → Tool registry
│
├── DELIVERY (Release Management)
│   └── Deployments (deployments) → CI/CD pipelines
│
├── INSIGHTS (Analytics & Billing)
│   ├── Analytics (analytics) → Token burn & metrics
│   └── Billing & Usage (billing) → Costs & margins [ADMIN ONLY]
│
└── SETTINGS (Configuration)
    └── Workspace Settings (settings) → Governance & API keys
2.2 Role-Based Navigation Layout
CLIENT (6 items in 3 groups)
CLIENT WORKSPACE
├── 🏠 Workspace
│   ├── Overview
│   ├── Inbox & Approvals
│   └── Messages [Label: "Agent Chat" → "Messages"]
├── 📥 Requests
│   ├── New Request
│   └── My Requests [Label: "Specifications" → "My Requests"]
└── ⚙️ Settings
    └── Workspace Settings
Journey: Overview → Submit Request → Approve Budget → Track Delivery

DEVELOPER (10 items in 5 groups)
DEVELOPER WORKSPACE
├── 🏠 Workspace
│   ├── Inbox & Approvals
│   └── Agent Chat
├── 📋 Work Management
│   ├── My Issues [Landing tab]
│   ├── Issues & Tasks
│   └── Specifications
├── 🤖 AI Operations
│   ├── Agent Studio [View-only: no create/delete]
│   ├── AI Runtimes
│   └── Skills & MCP
├── 🚀 Delivery
│   └── Deployments
└── ⚙️ Settings
    └── Workspace Settings
Journey: My Issues → Execute → Chat → Deploy

PROJECT MANAGER (13 items in 7 groups)
PM WORKSPACE
├── 🏠 Workspace
│   ├── Inbox & Approvals [Landing tab]
│   └── Agent Chat
├── 📋 Work Management
│   ├── My Issues
│   ├── Issues & Tasks
│   ├── Projects & Milestones
│   └── Specifications
├── 📥 Requests
│   └── New Request [Can test client flow]
├── 🤖 AI Operations
│   ├── Agent Studio
│   ├── Agent Squads
│   ├── AI Runtimes
│   └── Skills & MCP
├── 🚀 Delivery
│   └── Deployments
├── 📊 Insights
│   └── Analytics [NO Billing]
└── ⚙️ Settings
    └── Workspace Settings
Journey: Inbox → Approve Run → Coordinate Deployment → Track Analytics

ADMIN (16 items in 7 groups)
ADMIN WORKSPACE
├── 🏠 Workspace
│   ├── Overview
│   ├── Inbox & Approvals [Landing tab]
│   └── Agent Chat
├── 📋 Work Management
│   ├── My Issues
│   ├── Issues & Tasks
│   ├── Projects & Milestones
│   └── Specifications
├── 📥 Requests
│   ├── New Request
│   └── My Requests [Can view client portal]
├── 🤖 AI Operations
│   ├── Agent Studio
│   ├── Agent Squads
│   ├── AI Runtimes
│   └── Skills & MCP
├── 🚀 Delivery
│   └── Deployments
├── 📊 Business & Insights
│   ├── Analytics
│   └── Billing & Usage [Full access]
└── ⚙️ Administration
    └── Workspace Settings [Governance + API keys]
Journey: Full unrestricted access to all features

2.3 RBAC Implementation (Data-Driven)
// src/shared/config/navigationRBAC.ts
export const NAVIGATION_RBAC: Record<UserRole, NavigationFilter> = {
  client: {
    visibleSections: ['workspace', 'requests', 'settings'],
    visibleItems: {
      workspace: ['overview', 'inbox', 'chat'],
      requests: ['new_request', 'my_requests'],
      settings: ['settings']
    },
    defaultView: 'portal',
    labels: {
      'chat': 'Messages',
      'documents': 'My Requests',
    }
  },
  
  dev: {
    visibleSections: ['workspace', 'work', 'ai_ops', 'delivery', 'settings'],
    visibleItems: {
      workspace: ['inbox', 'chat'],
      work: ['my_issues', 'issues', 'specifications'],
      ai_ops: ['agents', 'runtimes', 'skills'],
      delivery: ['deployments'],
      settings: ['settings']
    },
    defaultView: 'my_issues',
    restrictions: {
      agents: { canCreate: false, canDelete: false, canArchive: false }
    }
  },
  
  pm: {
    visibleSections: ['workspace', 'work', 'requests', 'ai_ops', 'delivery', 'insights', 'settings'],
    visibleItems: {
      workspace: ['inbox', 'chat'],
      work: ['my_issues', 'issues', 'projects', 'specifications'],
      requests: ['new_request'],
      ai_ops: ['agents', 'squads', 'runtimes', 'skills'],
      delivery: ['deployments'],
      insights: ['analytics'],
      settings: ['settings']
    },
    defaultView: 'inbox'
  },
  
  admin: {
    visibleSections: ['workspace', 'work', 'requests', 'ai_ops', 'delivery', 'insights', 'settings'],
    visibleItems: {
      workspace: ['overview', 'inbox', 'chat'],
      work: ['my_issues', 'issues', 'projects', 'specifications'],
      requests: ['new_request', 'my_requests'],
      ai_ops: ['agents', 'squads', 'runtimes', 'skills'],
      delivery: ['deployments'],
      insights: ['analytics', 'billing'],
      settings: ['settings']
    },
    defaultView: 'inbox'
  }
};
Benefits:

Single source of truth (master tree + RBAC filters)
Easy to extend: add to master tree, update RBAC for each role
Maintainable: labels/restrictions in config, not in components
Scalable: future roles can be added with simple RBAC entry
3. CORE FEATURES (16 Modules)
3.1 Workspace Hub
Overview (portal): Dashboard with active projects, budget usage, team activity
Inbox & Approvals (inbox): 6 notification types, approval workflow gates
Agent Chat (chat): Real-time messaging with agent routing, threading, audience scoping
3.2 Work Management
My Issues (my_issues): Personal task queue (auto-filtered by current user)
Issues & Tasks (issues): Team Kanban board, status transitions, comments, subtasks
Projects & Milestones (projects): Delivery roadmap, resource allocation, progress tracking
Specifications (documents): Requirement docs with functional/non-functional requirements, acceptance criteria
3.3 Requests (Client-Facing)
New Request (intake): Guided wizard (title → problem → capabilities → timeline → budget)
My Requests (documents): Client view of submitted specs, estimate approvals, delivery tracking
3.4 AI Operations
Agent Studio (agents): Create agents with model/runtime config, env vars, MCP servers, system prompts
Agent Squads (squads): Compose multi-agent teams (chain, parallel, voting, hierarchy topologies)
AI Runtimes (runtimes): Discover & manage model providers (Anthropic, OpenAI, Ollama, LM Studio)
Skills & MCP (skills): Enable/disable execution tools (bash, git, filesystem, MCP servers)
3.5 Delivery
Deployments (deployments): 4-stage CI/CD pipeline (lint → test → build → deploy) with live logs
3.6 Insights
Analytics (analytics): Token consumption, cost tracking, model efficiency metrics
Billing & Usage (billing): Margin view, rate card management, subscription tracking [ADMIN ONLY]
3.7 Settings
Workspace Settings (settings): API keys, autonomy governance, user management, notification preferences
4. DATA MODEL & STATE MANAGEMENT
4.1 Core Entities
User (4 roles: client, dev, pm, admin)
  ├─ Issue (task with status, comments, subtasks, agent assignment)
  ├─ Project (delivery scope, milestones, team resources)
  ├─ Agent (autonomous executor with model, runtime, skills)
  ├─ Squad (multi-agent team with topology)
  ├─ PrototypeRun (5-stage execution with live progress)
  ├─ Deployment (CI/CD pipeline with stage tracking)
  ├─ ChatThread (messaging with role-based audience)
  ├─ InboxNotification (events with approval actions)
  ├─ RequirementDoc (client-submitted specs)
  ├─ Estimate (auto-generated pricing)
  ├─ BudgetLedger (cost tracking per project)
  └─ WorkspaceSettings (configuration)
4.2 Global Context (AppContext.tsx - 2300+ lines)
AppContextType {
  // Navigation
  activeTab, tabs, activeTabId, setActiveTabId, openNewTab, closeTab
  role, switchRole, can(capability), visibleTabs
  
  // CRUD (50+ methods)
  createIssue, updateIssue, deleteIssue
  createProject, updateProject, deleteProject
  createAgent, updateAgent, duplicateAgent, archiveAgent, deleteAgent
  createSquad, triggerSquadRun
  triggerDeployment, startPrototypeRun, cancelPrototypeRun
  createNewThread, sendChatMessage
  handleApproval, markNotificationRead
  // ... and 30+ more
  
  // Entities (cached from backend)
  issues, projects, agents, squads, deployments
  inbox, chatThreads, chatMessages, prototypeRuns
  analytics, settings, requirementDocs, estimates, ledgers
  
  // Server Status
  serverStatus: 'connecting' | 'online' | 'offline'
}
4.3 Persistence Strategy
User Action
  ↓
Optimistic Update (local state)
  ↓
Background Sync (apiService)
  ↓ Success → No-op (already updated)
  ↓ Failure → Revert + error toast
  ↓
localStorage Persistence
  ↓
WebSocket Events (real-time updates)
5. UI DESIGN SYSTEM
5.1 Design Philosophy: "High Signal, Low Noise"
Every pixel must serve actionable insight:

✅ Minimalist (remove decorative elements)
✅ Dark-mode native (deep black #0D0E10)
✅ Scannable (dense tables > large cards)
✅ Clear hierarchy (typography, color, spacing)
✅ Shared context (agents & humans see identical data)
5.2 Color Palette
Dark Mode (Current):

Background:         #0D0E10 (canvas)
Surface 1:          #141518 (inputs, panels)
Surface 2:          #191A1D (modals, popovers)
Surface 3:          #202124 (hover states)

Text Primary:       #FFFFFF
Text Secondary:     #9CA3AF (gray-400)
Text Muted:         #6B7280 (gray-500)

Brand Accent:       #6366F1 (indigo)
Success:            #34D399 (emerald)
Working:            #22D3EE (cyan)
Warning:            #F59E0B (amber)
Error:              #EF4444 (red)
Light Mode (Future - Aligned with AIDEA):

Background:         #FFFFFF
Surface 1:          #F9FAFB
Surface 2:          #F3F4F6
Surface 3:          #E5E7EB

Text Primary:       #000000 (gray-950)
Text Secondary:     #6B7280 (gray-500)
Text Muted:         #9CA3AF (gray-400)

[Semantic colors remain consistent]
5.3 Key Components
Buttons: Primary (indigo), Secondary (gray), Ghost (no bg), Destructive (red)
Status Indicators: Colored dots (not pills) — Idle ●, Working ● (pulsing), Offline ●
Tables: Full-width rows, subtle dividers, hover highlight
Forms: Clean borders, focus ring on brand color
Modals: Centered overlay, backdrop blur, Escape to close
Navigation: Collapsible sections (Workspace, Work, etc.) with icon + label
5.4 Figma Reference
AIDEA Smart SaaS Dashboard UI Kit:
https://www.figma.com/community/file/1532723729743223601/aidea-smart-saas-dashboard-ui-kit

Components to Adopt:

Table layouts (dense, scannable)
Button system (primary, secondary, tertiary, icon)
Form controls (input, select, checkbox, radio)
Modal dialog (centered, with header/body/footer)
Toast notifications (auto-dismiss)
Sidebar navigation (collapsible, active state)
Alpha Customizations:

No rounded pill badges → Use dots + text
Indigo accent (#6366F1) consistent
Dark-mode native (light-mode migration ready with CSS tokens)
Hierarchical grouping (new in v2.0)
6. BUSINESS LOGIC
6.1 Issue Execution Workflow
Agent run assigned
  ↓
5-stage pipeline (1.1s → 1.25s → 1.7s → 1.45s → 1.05s)
  1. Workspace preparation (restore context, branch)
  2. Analysis (index requirements, identify files)
  3. Implementation (apply plan, format code)
  4. Tests (type check, unit tests)
  5. Review (summarize changes, create PR)
  ↓
Success → Issue to 'review', await approval notification
  ↓
User approves
  ↓
GitHub PR auto-merged, deployment triggered
  ↓
Deployment succeeds → Issue marked 'done'
6.2 Cost Estimation (Simplified in v2.0)
Complexity band inference (S/M/L/XL) from requirement text
Token cost = baseline * band_multiplier * rework_multiplier
Human oversight hours by band
Infrastructure tier (Starter/Growth/Scale)
Service costs (payments, SMS, email, integrations)
Result: Auto-generated estimate with PM review & client approval

6.3 Approval Workflow
Run completes (success)
  ↓
Notification: "Review ready: ALF-101"
  ↓
PM clicks "Approve"
  ↓
PR merged, Preview deployment started
  ↓
Issue transitions: review → validating → done
  ↓
Toast: "Deployment complete"
7. DEVELOPMENT PATTERNS
7.1 Feature Module Structure
src/features/{name}/
├── {Name}View.tsx           # Main view
├── use{Name}ViewModel.ts    # Business logic
├── {Name}Card.tsx           # Sub-components
├── {Name}Modal.tsx
└── index.ts                 # Barrel export
7.2 Creating a View Model
export const useMyFeatureViewModel = () => {
  const { entities, createEntity, updateEntity } = useApp();
  
  // Derive computed state
  const filtered = useMemo(() => 
    entities.filter(e => e.status === 'active'),
    [entities]
  );
  
  // Memoize handlers
  const handleCreate = useCallback((name: string) => {
    createEntity({ name });
  }, [createEntity]);
  
  return { entities, filtered, handleCreate, handleUpdate: updateEntity };
};
7.3 Best Practices
Use view models (separation of concerns)
Memoize computed state (useMemo)
Memoize handlers (useCallback)
Follow type system (strict TypeScript)
Test all 4 roles
Handle offline mode (localStorage fallback)
Show error toasts on failures
8. DEPLOYMENT & CONFIGURATION
8.1 Environment Variables
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3002
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key
8.2 Build Commands
npm install              # Install dependencies
npm run dev              # Dev server (localhost:5173)
npm run build            # Vite production build
npm run preview          # Serve dist/ locally
npm run typecheck        # Validate TypeScript
9. NAVIGATION IMPLEMENTATION ROADMAP
v2.0 (Now)
✅ Master navigation tree (data-driven)
✅ RBAC filters per role
✅ Hierarchical sidebar component
✅ Role-specific label overrides
✅ Collapsible navigation groups
v2.1 (Q3 2026)
Favorites/pinning for frequently used items
Navigation search (⌘K integration)
Breadcrumbs showing current location
Collapse state persistence
v2.2 (Q4 2026)
Mobile drawer navigation
Custom roles & permissions (admin panel)
Analytics on navigation usage
10. QUICK REFERENCE
File Map
File	Purpose
src/app/App.tsx	Main window chrome, 16-tab bar, view routing
src/app/AppContext.tsx	Global state, CRUD operations
src/shared/layout/HierarchicalSidebar.tsx	NEW: Grouped navigation
src/shared/config/navigationSchema.ts	NEW: Master nav tree
src/shared/config/navigationRBAC.ts	NEW: Role-based filters
src/shared/types/index.ts	TypeScript type definitions
src/shared/services/apiService.ts	HTTP client + Supabase fallback
src/shared/services/runnerSocket.ts	WebSocket for live updates
DESIGN.md	UI/UX guidelines & color palette
Common Tasks
Add new navigation item:

Add to MASTER_NAVIGATION_TREE
Add view export in feature module
Update NAVIGATION_RBAC for each role
Create issue programmatically:

const { createIssue } = useApp();
createIssue({ title, description, status: 'todo', priority: 'high', projectId });
Check role permission:

const { can, role } = useApp();
if (can('manage_agents')) { /* show button */ }
if (role === 'client') { /* show client UI */ }
11. NEXT STEPS
Review this prompt with team (architecture, navigation, UI)
Implement hierarchical sidebar (2-3 days)
Test all 4 roles (1 day)
Deploy to staging (1 day)
Gather feedback (1 week)
Iterate & deploy to production (1 week)
CONCLUSION
Alpha v2.0 combines:

✅ Robust, modular architecture (React Context + daemon)
✅ Clean, hierarchical navigation (7 groups, role-based)
✅ Professional UI design (dark-mode native, Figma-aligned)
✅ Production-ready features (16 modules, full RBAC)
✅ Scalable codebase (data-driven RBAC, easy to extend)
Result: A coherent platform that feels organized, not like 16 separate pages.

System Prompt v2.0 Complete
Status: ✅ Ready for implementation
Last Updated: August 27, 2026

APPENDIX: IMPLEMENTATION TASKS
Phase 1: Navigation Infrastructure (2-3 days)
 Create navigationSchema.ts with MASTER_NAVIGATION_TREE
 Create navigationRBAC.ts with NAVIGATION_RBAC
 Create navigationTypes.ts with TypeScript interfaces
 Build HierarchicalSidebar.tsx component
 Update App.tsx to use HierarchicalSidebar
Phase 2: Testing & Refinement (1 day)
 Test all 4 roles (client, dev, pm, admin)
 Verify RBAC restrictions (dev can't create agents, etc.)
 Test sidebar collapse/expand
 Verify label overrides work
 Test default landing tabs
Phase 3: Deployment (1 day)
 Update documentation
 Deploy to staging
 Final QA pass
 Deploy to production
 Monitor for issues