# Design System & Aesthetic Principles

This document defines the core UI/UX philosophy, design tokens, component guidelines, and interaction patterns for the **Alpha** client MVP. The product keeps the proven human-and-agent workspace model popularized by Multica while adapting the experience to our client's workflow and identity.

---

## 1. Core Philosophy: High Signal, Low Noise

We design for developers, engineering leads, and autonomous AI agents. Every pixel must serve a purpose:
* **Minimalist & Clean**: Favor clarity, density, and typography over decorative flair. If an element does not provide actionable insight, remove it.
* **Avoid Unnecessary Pills & Nested Containers**: Do not wrap every piece of text or status in boxed pill containers or heavy borders. Favor simple colored indicator dots, clean typography, and muted text.
* **Scannable Table/List First**: Dense, aligned tabular rosters provide higher signal density than large cards or complex graphs.
* **Dark-Mode Native**: Deep matte black backgrounds with subtle contrast boundaries rather than heavy borders or bright gradients.
* **Shared Context for Agents**: Metadata (project descriptions, ground rules, repo paths) is directly surfaced and structured so humans and AI agents share identical context.

---

## 2. Color Palette & Surfaces

| Token / Usage | Hex / Tailwind | Purpose |
| :--- | :--- | :--- |
| **Canvas Background** | `#0D0E10` (`bg-background`) | Primary application backdrop |
| **Surface Level 1** | `#141518` (`bg-surface-200`) | Inputs and content that require a defined boundary |
| **Surface Level 2** | `#191A1D` (`bg-surface-100`) | Popovers, modals, and inspectors |
| **Surface Level 3** | `#202124` (`bg-surface-50`) | Active and hover states used sparingly |
| **Borders (Subtle)** | `rgba(255, 255, 255, 0.06)` | Section boundaries and dividers |
| **Borders (Active/Focus)** | `rgba(255, 255, 255, 0.12)` | Hover states, active tabs, focused inputs |
| **Primary Text** | `#FFFFFF` (`text-white`) | Headings, project names, active states |
| **Secondary Text** | `#9CA3AF` (`text-gray-400`) | Descriptions, column headers, icons |
| **Muted / Metadata Text** | `#6B7280` (`text-gray-500`) | Timestamps, counters, placeholder text |
| **Brand Accent** | `#6366F1` (`text-brand-400`) | Action buttons, active tabs, highlights |
| **Success / Online** | `#34D399` (`text-emerald-400`) | Live status dots, completed stages |
| **Working / Active** | `#22D3EE` (`text-cyan-400`) | Autonomous agent active pulse |

---

## 3. Typography & Hierarchy

* **Font Family**: `DM Sans` for interface copy and hierarchy, with system sans-serif fallbacks. `IBM Plex Mono` is reserved for code, commands, file paths, commit hashes, and machine-readable identifiers.
* **Monospace Restraint**: Do not use `font-mono` merely to make metadata feel technical. Counts, dates, status labels, roles, and navigation use the primary sans-serif face unless fixed-width alignment is functionally useful.
* **Type Scale**:
  * **View Title**: `text-base font-semibold text-white` (clear but non-oversized).
  * **Section Headers / Table Columns**: `text-xs font-normal text-gray-500 tracking-normal`.
  * **Row Titles**: `text-xs font-medium text-white group-hover:text-gray-200`.
  * **Metadata & Roles**: `text-[11px] font-medium text-gray-500` (e.g. `• Coder`, `• Architect`).
  * **Counters & Timestamps**: `text-xs tabular-nums text-gray-500`.

---

## 4. Key Component Patterns

### 4.1. Table & List Views
* Use full-width, clean rows with `hover:bg-white/[0.02]`.
* Separated by ultra-light dividers (`divide-y divide-white/[0.02]`).
* Consistent column alignment across views (e.g. `Name`, `Status`, `Machine/Model`, `Runs`, `Access`).

### 4.2. Status Indicators: Clean Dots over Boxed Pills
* Avoid bulky rounded pill containers with borders for simple statuses.
* Use **colored indicator dots with clean typography**:
  * `Idle`: `<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Idle` (`text-gray-300`)
  * `Working`: `<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> Working` (`text-cyan-300`)
  * `Queued`: `<span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Queued` (`text-purple-300`)
  * `Offline`: `<span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Offline` (`text-gray-400`)
  * `Unstable`: `<span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Unstable` (`text-amber-300`)
  * `Archived`: `<span className="w-1.5 h-1.5 rounded-full bg-gray-600" /> Archived` (`text-gray-500`)

### 4.3. Progress Representation
* Use **Circular SVG Progress Rings** with fractional text (e.g. `○ 23/30`) rather than bulky horizontal bars.
* Empty tasks display a clean dash (`—`) rather than `0%`.

### 4.4. Assignees & Leads
* **Assigned**: Circular avatar with name label (e.g. `[avatar] lloyd lim`).
* **Unassigned**: Subtle dashed circular placeholder with a dash (`◯ —`).

### 4.5. Inspection & Detail Views: Centered Modals vs Slide-In Drawers
* **Centered Pop-up Modals (e.g. Agent Profiles, Create Flows, CI/CD Runs)**:
  * Open in the center of the screen with a dark backdrop blur (`fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm`).
  * Ideal for complex entity configuration with multiple sub-tabs (Instructions, Skills & MCP, Secrets & Env, Run History).
* **Slide-In Focus Drawers (e.g. Issue Inspectors)**:
  * Open from the right edge (`fixed inset-y-0 right-0 w-full max-w-xl`) when contextual side inspection is desired alongside the roster.

### 4.6. Containers, Radius, and Elevation
* A container must communicate grouping, interaction, safety, or hierarchy. Do not place a bordered card inside another bordered card solely for decoration.
* Prefer whitespace, typography, dividers, and alignment before adding another surface.
* Standard controls use a restrained `3px–8px` radius. Larger radii are reserved for modals and substantial overlays; `rounded-full` is reserved for avatars, status dots, and genuinely circular controls.
* Avoid glow shadows. Use a subtle border and conventional shadow only when a popover or modal must sit above the workspace.
* Inputs, error states, approval decisions, code blocks, and destructive confirmations may retain clear containers because their boundaries are meaningful.

---

## 5. Navigation & Multi-Tab Guidelines

1. **In-Place Navigation by Default**:
   * Clicking a sidebar navigation item navigates in-place within the current active tab.
   * **Only** create a new tab when the user explicitly clicks the `+` button in the top tab bar.
2. **Minimal Window Chrome**:
   * No decorative mock traffic light dots.
   * Clean, unified window header.
3. **Dedicated Personal Scope**:
   * "My Issues" automatically filters tasks to the logged-in user.
   * "Issues" remains the global team/workspace board.

---

## 6. Rules for Future Additions

* **Do not add decorative gradients or loud background cards** unless explicitly requested.
* **Avoid container bloat**: Before wrapping an element in a border or background box, ask if simple typography or a status dot communicates the information more cleanly.
* **Keep forms concise**: Clean modal dialogs with auto-saving and clear defaults.
* **Always provide 1-click copy** for code paths, CLI commands, endpoints, and identifiers.
* **Preserve keyboard friendliness**: Support <kbd>Enter</kbd> to submit inline items and <kbd>Esc</kbd> to close dialogs/drawers.

---

## 7. MVP Visual Refinement — 2026-08-17

### Objective

Make the initial prototype feel like a credible client-facing productivity tool rather than a game-inspired agent dashboard. Preserve the Multica-style workspace, tabs, issue flow, projects, agents, and simulated MVP behavior while reducing decorative UI weight.

### Implemented changes

* Replaced `Inter` and `JetBrains Mono` with `DM Sans` and `IBM Plex Mono`.
* Neutralized the canvas and surface palette while retaining the existing indigo action accent.
* Reduced the global radius scale and removed brand, cyan, and emerald glow shadows.
* Changed top-level workspace tabs from boxed browser-style tabs to a simple active underline.
* Simplified the sidebar with neutral icons, flatter rows, and a narrow active-section marker.
* Replaced boxed status, priority, role, runtime, and deployment pills with lightweight icons, dots, and text.
* Flattened the primary Inbox, Chat, Issues, and Projects surfaces by removing redundant backgrounds and nested borders.
* Converted CI/CD run details from a fixed right-side drawer into a centered, responsive modal with a dimmed workspace backdrop, outside-click dismissal, and Escape-key dismissal.
* Reorganized CI/CD details into repository context, a scan-friendly stage list, and a dedicated execution-log region that uses the wider modal space effectively.
* Kept strong containers for inputs, popovers, modals, errors, approvals, and technical output where boundaries improve comprehension.
* Removed the nonfunctional Projects “Table” control from the MVP surface.

### Behavior intentionally preserved

* Existing tab navigation and command palette behavior.
* Issue, project, inbox, chat, agent, and deployment interactions.
* Browser `localStorage` persistence and all current mock-data simulations.
* The existing information architecture and Multica-inspired human-and-agent collaboration model.

### Files changed

* `index.html`
* `tailwind.config.js`
* `src/index.css`
* `src/App.tsx`
* `src/components/common/Badge.tsx`
* `src/components/layout/Sidebar.tsx`
* `src/views/InboxView.tsx`
* `src/views/ChatView.tsx`
* `src/views/IssuesView.tsx`
* `src/views/ProjectsView.tsx`
* `src/views/DeploymentsView.tsx`

### Verification

* Strict TypeScript validation passes with `tsc --noEmit`.
* The Vite production build completes successfully.
* No environment configuration or application data contracts were changed.

---

## 8. Guided Prototype Workflow — 2026-08-18

### Objective

Turn the existing mock screens into one understandable frontend-only journey before backend integration. A user should be able to move from project context to an approved agent plan, follow simulated work, review its output, and observe Preview validation without encountering a dead end.

### Primary journey

`Project → Issue → Agent plan → Simulated run → Inbox review → Preview CI/CD → Completed issue`

### Implemented behavior

* Added a three-step first-visit guide with persistent dismissal and a replay action in the sidebar.
* Replaced immediate issue execution with a preparation modal that exposes project context, agent selection, repository readiness, and an issue-specific plan before approval.
* Added optional successful and test-failure demo scenarios so both the happy path and retry path can be presented without external services.
* Added a persisted prototype run lifecycle with workspace, analysis, implementation, testing, and review stages.
* Embedded compact run progress, logs, cancellation, retry, review, and CI/CD navigation in the issue inspector.
* Connected successful runs to Inbox approval requests and connected approvals to simulated Preview deployments.
* Kept rejected work in progress, allowed retry after failures or requested changes, and marked issues complete only after Preview validation succeeds.
* Added lightweight toast feedback for important transitions without introducing another notification container inside each view.
* Improved the shared modal with dialog semantics, labelled titles, Escape dismissal, and focus restoration.

### State and integration boundaries

* Prototype runs use the existing `AppContext` and `localStorage` persistence model.
* Stage timestamps allow a running simulation to continue after navigation or refresh.
* Repository links, pull requests, logs, tests, and deployments remain clearly simulated.
* No backend, authentication, GitHub integration, API contract, environment file, or package dependency was added.

### Main files

* `src/types/index.ts`
* `src/context/AppContext.tsx`
* `src/App.tsx`
* `src/components/common/Modal.tsx`
* `src/components/common/ToastRegion.tsx`
* `src/components/onboarding/PrototypeGuide.tsx`
* `src/components/issues/AgentRunModal.tsx`
* `src/components/issues/AgentRunProgress.tsx`
* `src/components/layout/Sidebar.tsx`
* `src/views/IssuesView.tsx`
* `src/views/ProjectsView.tsx`
* `src/views/InboxView.tsx`

### Prototype acceptance target

A first-time user can understand the workflow and complete a successful simulated issue-to-validation journey in approximately two to three minutes. The same prototype also demonstrates cancellation, test failure, retry, requested changes, empty context, and reload persistence.
