# Design System & Aesthetic Principles

This document defines the core UI/UX philosophy, design tokens, component guidelines, and interaction patterns for the **Multica** application.

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
| **Canvas Background** | `#0E0E12` (`bg-[#0E0E12]`) | Primary application backdrop |
| **Surface Level 1 (Inputs/Cards)** | `#14151B` (`bg-[#14151B]`) | Search boxes, tables, rows, secondary containers |
| **Surface Level 2 (Modals/Popups)** | `#121318` / `#1A1B22` | Centered dialog popups, popover menus, inspectors |
| **Surface Level 3 (Active/Hover)** | `#1B1C23` (`bg-[#1B1C23]`) | Hover states, subtle button backings |
| **Borders (Subtle)** | `rgba(255, 255, 255, 0.04)` | Default component boundaries and dividers |
| **Borders (Active/Focus)** | `rgba(255, 255, 255, 0.12)` | Hover states, active tabs, focused inputs |
| **Primary Text** | `#FFFFFF` (`text-white`) | Headings, project names, active states |
| **Secondary Text** | `#9CA3AF` (`text-gray-400`) | Descriptions, column headers, icons |
| **Muted / Metadata Text** | `#6B7280` (`text-gray-500`) | Timestamps, counters, placeholder text |
| **Brand Accent** | `#6366F1` (`text-brand-400`) | Action buttons, active tabs, highlights |
| **Success / Online** | `#34D399` (`text-emerald-400`) | Live status dots, completed stages |
| **Working / Active** | `#22D3EE` (`text-cyan-400`) | Autonomous agent active pulse |

---

## 3. Typography & Hierarchy

* **Font Family**: Modern sans-serif (`Inter`, system UI font stack) for UI text, with `font-mono` (`JetBrains Mono`, `ui-monospace`) for identifiers, keys, timestamps, and file paths.
* **Type Scale**:
  * **View Title**: `text-sm font-semibold text-white` (clean, non-oversized).
  * **Section Headers / Table Columns**: `text-xs font-normal text-gray-500 tracking-normal`.
  * **Row Titles**: `text-xs font-medium text-white group-hover:text-gray-200`.
  * **Metadata & Roles**: `text-[11px] font-mono text-gray-500` (e.g. `• Coder`, `• Architect`).
  * **Counters & Timestamps**: `text-xs font-mono text-gray-500`.

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
* **Centered Pop-up Modals (e.g. Agent Profiles, Create Flows)**:
  * Open in the center of the screen with a dark backdrop blur (`fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm`).
  * Ideal for complex entity configuration with multiple sub-tabs (Instructions, Skills & MCP, Secrets & Env, Run History).
* **Slide-In Focus Drawers (e.g. Projects, CI/CD Runs)**:
  * Open from the right edge (`fixed inset-y-0 right-0 w-full max-w-xl`) when contextual side inspection is desired alongside the roster.

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
