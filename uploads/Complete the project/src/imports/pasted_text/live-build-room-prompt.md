# Feature Implementation Prompt: Universal Live Build Room

## Objective

Add a **Live Build Room** feature to every system/workspace in the platform.

The Live Build Room should act as a **real-time visual command center for AI-assisted system generation, implementation, orchestration, and delivery**. It must allow users to see exactly what is happening while the system is being planned and built instead of showing a generic loading state.

Use the attached reference image as the primary UI/UX inspiration for the visual structure, density, dark interface, workflow timeline, module cards, active handoffs, progress tracking, and generated artifacts. Do **not** copy the design blindly; adapt it to the existing application's design system and architecture.

---

# 1. Core Concept

Every system or project should have its own dedicated:

> **Live Build Room**

The Live Build Room represents the current execution state of a system build.

Example:

```text
System
│
├── Overview
├── Requirements
├── Architecture
├── Development
├── Analytics
│
└── Live Build Room
      │
      ├── Build Pipeline
      ├── Active Agents
      ├── Module Progress
      ├── Agent Handoffs
      ├── Generated Artifacts
      ├── Live Logs
      ├── Validation
      └── GitHub / Deployment Status
```

This feature must be reusable across **all systems**, rather than being hardcoded for one specific application.

Each system should have an isolated Live Build Room with its own:

* Build ID
* Build history
* Requirements
* Architecture
* Agents
* Tasks
* Modules
* Generated artifacts
* Logs
* Progress
* Validation results
* GitHub status
* Deployment status

---

# 2. Entry Point

Add a **Live Build Room** action or navigation item inside every system/project workspace.

Recommended structure:

```text
SYSTEM WORKSPACE
│
├── Overview
├── Requirements
├── Specifications
├── Architecture
├── Work / Issues
├── AI Operations
├── Delivery
│
└── ⚡ Live Build Room
```

The Live Build Room should only appear when the user has the appropriate permission to monitor or manage the build.

For example:

```text
Client
└── Can view build progress when enabled

Developer
└── Can monitor assigned build activities

Project Manager
└── Can monitor and control project builds

Admin
└── Full access to all builds, agents, logs, artifacts, and controls
```

---

# 3. Top Application Header

Create a dedicated Live Build Room header similar in hierarchy to the reference.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ◈  Live Build Room     ● All systems nominal                               │
│                                                                             │
│ [ Build context / current objective                           ] [Build ▶]  │
│                                                                  [Logs] 👤 │
└─────────────────────────────────────────────────────────────────────────────┘
```

The header should display:

### Left

* System icon
* System name
* `Live Build Room` title
* Real-time system/build health indicator

Example:

```text
Picasa Operations System
Live Build Room
● Build running normally
```

### Center

A build objective/input area showing the current instruction or build objective.

Example:

```text
Build Objective:
"Implement the inventory reconciliation and sales variance module."
```

The objective should support:

* Current build objective
* Build prompt
* Revision instruction
* Follow-up instruction
* Rebuild request

### Right

Actions:

* View Logs
* Share build status
* User/profile menu
* Pause build
* Resume build
* Cancel build
* Start new build

---

# 4. Build Pipeline Timeline

Below the header, create a horizontal build pipeline.

This should visually communicate the complete lifecycle of the system build.

Recommended default pipeline:

```text
Prompt
   ↓
Requirements
   ↓
Specification / Contract
   ↓
Architecture
   ↓
Build
   ↓
Self Review
   ↓
Validation
   ↓
GitHub
   ↓
Deployment
```

Visual states:

```text
✓ Completed
● Running
◌ Waiting
◌ Pending
⚠ Blocked
✕ Failed
Ⅱ Paused
```

Example:

```text
✓ Prompt
      →
✓ Requirements
      →
✓ Contract
      →
◉ Architecture
      →
◌ Build
      →
◌ Review
      →
◌ Validation
      →
◌ GitHub
      →
◌ Deploy
```

Each stage must support:

```typescript
type BuildStageStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "waiting"
  | "blocked"
  | "failed"
  | "paused"
  | "cancelled";
```

Clicking a stage should open its detailed activity.

---

# 5. Main Live Build Grid

The main workspace should use a responsive card grid.

Each card represents a major build participant, subsystem, module, or pipeline stage.

Example:

```text
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Requirements     │  │ API Contract     │  │ Architecture     │
│ ● Done           │  │ ● Done           │  │ ● Running        │
│ ███████████ 100% │  │ ███████████ 100% │  │ ███████░░░ 64%   │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Frontend         │  │ Backend          │  │ Database         │
│ ● Running        │  │ ◌ Waiting        │  │ ● Running        │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Self Review      │  │ Validation       │  │ GitHub           │
│ ◌ Waiting        │  │ ◌ Waiting        │  │ ◌ Waiting        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Do not limit the system to these modules.

The Live Build Room must dynamically generate cards depending on the architecture of the selected system.

For example, one system may contain:

```text
Frontend
Backend
Database
Authentication
Inventory Engine
Analytics
Notification Service
```

Another may contain:

```text
Mobile Application
API Gateway
AI Orchestrator
Context Engine
Vector Retrieval
Agent Runtime
Admin Dashboard
```

The cards must therefore be generated dynamically from the system architecture or build plan.

---

# 6. Live Build Module Card

Each module card should contain:

```text
┌─────────────────────────────────────┐
│ [ICON] Module Name       ● Running  │
│        Assigned Agent                │
├─────────────────────────────────────┤
│                                     │
│ NOW DOING                           │
│ Building inventory reconciliation   │
│                                     │
│ ████████████░░░░░ 72%               │
│                                     │
│ ● 10:31 Generated reconciliation    │
│ ● 10:32 Creating database queries   │
│ ● 10:33 Running integration tests   │
│                                     │
├─────────────────────────────────────┤
│ IN                                 │
│ architecture-map.json               │
│                                     │
│ OUT                                │
│ reconciliation-service.ts           │
└─────────────────────────────────────┘
```

Every card should support:

### Identity

* Module icon
* Module name
* Assigned agent
* Agent type

### Status

* Running
* Done
* Waiting
* Failed
* Blocked
* Reviewing

### Progress

* Percentage
* Determinate progress when measurable
* Indeterminate animation when progress cannot be calculated

### Current Activity

Use human-readable status updates such as:

```text
Designing database schema
Generating API routes
Implementing authentication
Running unit tests
Reviewing generated code
Waiting for architecture handoff
```

Avoid vague messages such as:

```text
Processing...
Working...
Loading...
```

### Activity Feed

Display recent significant events:

```text
10:31  Created User entity
10:32  Added foreign key relationships
10:33  Generated migration
10:34  Validating schema
```

### Dependencies

Show:

```text
IN
```

What the module is consuming.

Examples:

```text
requirements.md
architecture.json
api-contract.json
database-schema.sql
```

Show:

```text
OUT
```

What the module produces.

Examples:

```text
routes.ts
schema.sql
dashboard.tsx
validation-report.json
```

---

# 7. Real-Time Agent Handoff Panel

Create a dedicated right-side panel called:

> **Active Handoff**

This is one of the most important features.

The system should visibly show when work moves from one agent, team, or system component to another.

Example:

```text
ACTIVE HANDOFF

Architecture Agent
        ↓
Frontend Agent

Status:
● Transferring context
```

The handoff should include:

* From
* To
* Current handoff status
* Handoff timestamp
* Context package
* Files/artifacts being transferred
* Dependencies
* Next expected output

Example:

```text
FROM
Architecture Agent

TO
Frontend Agent

HANDOFF STATUS
● In Progress

CONTEXT PACKAGE
✓ page-map.json
✓ components.json
✓ api-dependencies.json
◉ routes.json

NEXT EXPECTED OUTPUT
React pages and components
```

---

# 8. Context-Aware Handoff Package

Do not simply pass raw chat history between agents.

Each handoff must create a structured:

> **Build Context Package**

Example:

```typescript
interface BuildContextPackage {
  systemId: string;
  buildId: string;

  sourceAgent: string;
  targetAgent: string;

  objective: string;

  completedWork: CompletedWork[];

  requirements: Requirement[];

  architecture: ArchitectureContext;

  decisions: Decision[];

  dependencies: Dependency[];

  artifacts: Artifact[];

  constraints: Constraint[];

  acceptanceCriteria: AcceptanceCriterion[];

  unresolvedIssues: Issue[];

  nextTask: Task;
}
```

The UI should allow users to inspect the context package being transferred.

This is especially important for complex multi-agent systems.

---

# 9. Build Artifacts Panel

At the bottom of the Live Build Room, create a horizontally scrollable:

> **Build Artifacts**

section.

Example:

```text
BUILD ARTIFACTS

[ requirements.md ✓ ]
[ app-contract.json ✓ ]
[ architecture.mermaid ◌ ]
[ schema.sql ◌ ]
[ LoginPage.tsx NEW ]
[ Dashboard.tsx NEW ]
[ +12 more ]
```

Each artifact should display:

* File icon based on type
* Filename
* File type
* Size
* Generation status
* New/updated badge
* Validation status

Possible statuses:

```text
Generated
Updated
Validating
Approved
Failed
Superseded
```

Clicking an artifact should open a preview or the appropriate editor/viewer.

---

# 10. Build Status Panel

Create a real-time summary panel.

Example:

```text
BUILD STATUS

Overall Progress
████████████░░░░ 68%

Current Activity
Transferring architecture context to Frontend Agent

Agents
3 Running
2 Waiting
1 Completed

Modules
5 / 12 Complete

Artifacts
18 Generated

Issues
0 Blocking
2 Warnings
```

The progress must not be fake.

Use weighted progress based on actual pipeline and module completion.

Example:

```typescript
overallProgress =
  weightedStageProgress +
  weightedModuleProgress +
  validationProgress;
```

Do not simply increment the progress bar using timers.

---

# 11. Live Event Stream

Implement a real-time event architecture.

The UI should update immediately when:

* Agent starts
* Agent completes
* Task starts
* Task completes
* Artifact is generated
* Artifact is updated
* Validation starts
* Validation completes
* Error occurs
* Agent becomes blocked
* Handoff starts
* Handoff completes
* Build pauses
* Build resumes
* Deployment starts
* Deployment completes

Recommended event structure:

```typescript
interface BuildEvent {
  id: string;

  buildId: string;

  type:
    | "BUILD_STARTED"
    | "STAGE_STARTED"
    | "STAGE_COMPLETED"
    | "AGENT_STARTED"
    | "AGENT_COMPLETED"
    | "MODULE_PROGRESS"
    | "ARTIFACT_CREATED"
    | "ARTIFACT_UPDATED"
    | "HANDOFF_STARTED"
    | "HANDOFF_COMPLETED"
    | "VALIDATION_FAILED"
    | "VALIDATION_COMPLETED"
    | "BUILD_FAILED"
    | "BUILD_COMPLETED";

  timestamp: string;

  source?: string;
  target?: string;

  payload: Record<string, unknown>;
}
```

Use real-time subscriptions or streaming appropriate to the existing architecture.

---

# 12. Build History

Each system must retain previous builds.

Add:

```text
Build History
│
├── Build #24
│   ├── Completed
│   ├── 18m 42s
│   └── 42 artifacts
│
├── Build #23
│   ├── Failed
│   ├── Validation error
│   └── View details
│
└── Build #22
    ├── Completed
    └── Deployed
```

Users should be able to:

* Open historical builds
* Inspect logs
* Compare artifacts
* Compare architecture changes
* See what changed between builds
* Retry failed stages
* Resume paused builds
* Clone a build as a new build

Do not overwrite historical build state.

Every build should be immutable as a historical execution record.

---

# 13. Failure and Blocked States

The Live Build Room must clearly expose failures.

Example:

```text
┌─────────────────────────────────────┐
│ Backend                    ✕ Failed │
│                                     │
│ Failed while generating API routes  │
│                                     │
│ ERROR                               │
│ Missing dependency: UserService     │
│                                     │
│ [ View Error ] [ Retry ] [ Escalate ]│
└─────────────────────────────────────┘
```

For blocked modules:

```text
Backend
⚠ Blocked

Waiting for:
Architecture → API contract

Estimated dependency completion:
2 minutes
```

Blocked agents should not appear as generic "loading" states.

The dependency causing the blockage must be visible.

---

# 14. Role-Based Build Controls

The UI should respect existing RBAC.

### Client

```text
Can:
✓ View progress
✓ View approved artifacts
✓ Receive delivery notifications

Cannot:
✕ View internal secrets
✕ View raw agent prompts
✕ Modify build execution
```

### Developer

```text
Can:
✓ View assigned modules
✓ View logs relevant to assigned work
✓ Review generated output
✓ Retry authorized tasks
```

### Project Manager

```text
Can:
✓ Monitor full project build
✓ Pause/resume builds
✓ Approve handoffs
✓ Review artifacts
✓ Trigger validation
```

### Admin

```text
Can:
✓ Full build control
✓ Agent control
✓ View all logs
✓ Retry/restart stages
✓ Modify build configuration
✓ Cancel builds
```

Permissions must be enforced server-side, not only hidden in the UI.

---

# 15. System-Agnostic Architecture

The feature must work for every type of system.

Do not hardcode concepts such as:

```text
Frontend
Backend
Database
```

Instead, create a configurable build topology.

Example:

```typescript
interface BuildModule {
  id: string;

  systemId: string;

  name: string;

  type: string;

  icon: string;

  dependencies: string[];

  assignedAgent?: string;

  status: BuildStageStatus;

  progress: number;

  inputs: ArtifactReference[];

  outputs: ArtifactReference[];
}
```

A system can define its own modules:

```typescript
const modules = [
  "Requirements",
  "Architecture",
  "Frontend",
  "Backend",
  "Database"
];
```

Or:

```typescript
const modules = [
  "Document Scanner",
  "OCR Engine",
  "Image Processing",
  "PDF Generator",
  "Local Storage"
];
```

Or:

```typescript
const modules = [
  "Agent Orchestrator",
  "Context Engine",
  "Memory Layer",
  "RAG Pipeline",
  "Evaluation Engine"
];
```

The Live Build Room UI should automatically adapt.

---

# 16. UX Requirements

The Live Build Room should feel like a professional operations console.

Design principles:

* High information density without clutter
* Clear visual hierarchy
* Real-time but not visually noisy
* Important changes should be noticeable
* Running components should be visually distinguishable
* Completed components should become visually quieter
* Errors should be immediately obvious
* Waiting states should explain what is being waited on
* Progress should be meaningful
* Users should always understand:

  * What is happening now
  * What has completed
  * What is waiting
  * What is blocked
  * What happens next

Avoid excessive animations.

Use animation only for:

* Active processing
* Progress changes
* Agent handoffs
* Newly generated artifacts
* State transitions

---

# 17. Responsive Behavior

### Desktop

Use the full layout:

```text
┌──────────────────────────────────────────────┬──────────────────────┐
│                                              │                      │
│              LIVE BUILD GRID                 │   ACTIVE HANDOFF     │
│                                              │                      │
│ Requirements | Contract | Architecture       │   Context Package    │
│ Frontend     | Backend  | Database           │   Next Output        │
│ Review       | Validate | GitHub             │   Build Status       │
│                                              │                      │
├──────────────────────────────────────────────┴──────────────────────┤
│                         BUILD ARTIFACTS                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Tablet

Move the handoff panel below the build grid.

### Mobile

Use:

```text
Header
Pipeline
Overall Status

Active Module

Module List

Active Handoff

Artifacts

Logs
```

Do not attempt to squeeze the desktop dashboard into a mobile screen.

---

# 18. Suggested Data Model

```typescript
interface LiveBuild {
  id: string;

  systemId: string;

  projectId?: string;

  objective: string;

  status:
    | "queued"
    | "running"
    | "paused"
    | "blocked"
    | "failed"
    | "completed"
    | "cancelled";

  progress: number;

  startedAt?: string;
  completedAt?: string;

  stages: BuildStage[];

  modules: BuildModule[];

  agents: BuildAgent[];

  handoffs: BuildHandoff[];

  artifacts: BuildArtifact[];

  events: BuildEvent[];

  validation?: ValidationResult;
}
```

---

# 19. Build Lifecycle

The complete flow should be:

```text
USER STARTS BUILD
        ↓
Build ID Created
        ↓
Requirements Analyzed
        ↓
Requirements Validated
        ↓
System Contract Generated
        ↓
Architecture Generated
        ↓
Architecture Modules Identified
        ↓
Build Plan Created
        ↓
Agents Assigned
        ↓
Parallel / Sequential Module Execution
        ↓
Artifacts Generated
        ↓
Agent Handoffs
        ↓
Self Review
        ↓
Validation
        ↓
GitHub / Version Control
        ↓
Deployment
        ↓
Build Completed
```

The Live Build Room must reflect this flow in real time.

---

# 20. Implementation Requirements

Implement the feature using reusable components.

Suggested component structure:

```text
components/live-build-room/

├── LiveBuildRoom.tsx
├── BuildHeader.tsx
├── BuildObjectiveBar.tsx
├── BuildPipeline.tsx
├── BuildStage.tsx
│
├── BuildGrid.tsx
├── BuildModuleCard.tsx
├── ModuleActivityFeed.tsx
├── ModuleDependencies.tsx
│
├── ActiveHandoffPanel.tsx
├── HandoffContextViewer.tsx
├── NextExpectedOutput.tsx
│
├── BuildStatusPanel.tsx
├── BuildArtifacts.tsx
├── ArtifactCard.tsx
│
├── BuildEventStream.tsx
├── BuildLogs.tsx
│
├── BuildHistory.tsx
├── BuildComparison.tsx
│
└── build-room.types.ts
```

The architecture must separate:

```text
UI
↓
Build State Management
↓
Real-Time Event Layer
↓
Build Orchestrator
↓
Agents / Build Workers
↓
Artifact Storage
↓
Validation / Deployment
```

Do not place orchestration logic directly inside React components.

---

# Final Acceptance Criteria

The feature is complete only when:

* [ ] Every system can have its own Live Build Room
* [ ] Build rooms are isolated by system/project/build ID
* [ ] The UI adapts dynamically to different system architectures
* [ ] Build pipeline stages update in real time
* [ ] Module cards display actual execution state
* [ ] Agent handoffs are visible
* [ ] Handoff context packages can be inspected
* [ ] Generated artifacts appear live
* [ ] Progress is based on real execution state
* [ ] Blocked dependencies are clearly shown
* [ ] Errors include actionable details
* [ ] Build history is preserved
* [ ] Previous builds can be inspected
* [ ] Role permissions are enforced
* [ ] The feature works responsively
* [ ] The design integrates with the existing application's UI system
* [ ] No fake progress or simulated production data is used
* [ ] Build orchestration is decoupled from the UI
* [ ] The architecture is reusable across every system in the platform

## Final Design Direction

The result should feel like a combination of:

```text
AI Agent Control Center
+
CI/CD Pipeline Monitor
+
Project Operations Dashboard
+
Real-Time Build Orchestrator
```

The Live Build Room should answer, at any moment:

> **What is the system currently building?**

> **Which agent or module is responsible?**

> **What has already been completed?**

> **What is currently blocked or waiting?**

> **What context is being handed to the next agent?**

> **What files and artifacts have been generated?**

> **What happens next?**

The user should be able to open any system and immediately understand the complete live state of its build from one screen.
