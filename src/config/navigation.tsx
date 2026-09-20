import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, PenLine, FileText, CreditCard, Inbox, MessageSquare, User,
  CheckSquare, FolderKanban, Rocket, Bot, Users, BarChart3, Monitor, BookOpen, Settings, Workflow
} from 'lucide-react';

import { NavigationTab, UserRole } from '@/shared/types';

/**
 * Every fact about a navigation destination, in one place.
 *
 * This existed four times over and had already drifted. `ALL_TABS` in App.tsx
 * held titles, subtitles and icons but was missing `portal` and `intake`
 * entirely — the two views a client lands on. `NAV_META` in Sidebar.tsx held a
 * second set of labels, a second set of icons and the grouping. Two `switch`
 * statements in App.tsx mapped a tab to an icon and a title a third and fourth
 * time. `deployments` reads "CI/CD Platform" in one and "Deployments" in
 * another depending on which one you happen to be looking at.
 *
 * Four copies of a table is four chances to add a view and forget one — which
 * is exactly what happened to `portal` and `intake`. Everything below is
 * derived from this array, so a new destination is one entry.
 *
 * ## Why sections, not the old `group`
 *
 * The three groups (`primary`/`workspace`/`configure`) put eleven items in one
 * bucket. Sections come from the UI-Refactor prototype's `navigationSchema`,
 * which is the one genuinely good idea in that export: the grouping matches how
 * someone thinks about the work rather than how the code was organised.
 */

export type SectionId = 'workspace' | 'requests' | 'work' | 'ai_ops' | 'delivery' | 'insights' | 'config';

export interface NavSection {
  id: SectionId;
  label: string;
}

/** Order is the order they appear in the sidebar. */
export const NAV_SECTIONS: NavSection[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'requests', label: 'Requests' },
  { id: 'work', label: 'Work' },
  { id: 'ai_ops', label: 'AI Operations' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'insights', label: 'Insights' },
  { id: 'config', label: 'Configuration' }
];

export interface NavItem {
  id: NavigationTab;
  /** Sidebar label — short, because it sits in a 240px column. */
  label: string;
  /**
   * What a client sees instead.
   *
   * Same destination, named the way that reader recognises it: a client has
   * "Messages", not an "Agent Chat Canvas". Was scattered as `clientLabel` in
   * the sidebar and a `role === 'client' ? … : …` ternary in App.tsx.
   */
  clientLabel?: string;
  /** Tab-strip title — longer, because a tab has room and needs to be unique. */
  title: string;
  /** One line under the title in the tab bar. */
  subtitle: string;
  section: SectionId;
  /**
   * The sidebar's current three-way grouping.
   *
   * Kept alongside `section` so single-sourcing the table changes no pixels.
   * `section` is the finer grouping the sidebar moves to next; when it does,
   * this field and the old three-label markup go together.
   */
  group: 'primary' | 'workspace' | 'configure';
  /**
   * The Lucide component, not a rendered element.
   *
   * The tab strip draws these at `w-3.5` and the sidebar at `w-4`. Storing a
   * finished element would force one size on both, which is why the icon table
   * was duplicated between them in the first place.
   */
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'portal', label: 'Overview', title: 'Overview', subtitle: 'Your requests, progress, and budget', group: 'primary', section: 'workspace', icon: LayoutDashboard },
  { id: 'inbox', label: 'Inbox', title: 'Inbox & Approvals', subtitle: 'View notifications & agent approvals', group: 'primary', section: 'workspace', icon: Inbox },
  { id: 'chat', label: 'Chat', clientLabel: 'Messages', title: 'Agent Chat Canvas', subtitle: 'Chat with autonomous agents & squads', group: 'primary', section: 'workspace', icon: MessageSquare },

  { id: 'intake', label: 'New request', title: 'New Request', subtitle: 'Describe what you need in plain language', group: 'primary', section: 'requests', icon: PenLine },
  { id: 'documents', label: 'Specifications', clientLabel: 'My requests', title: 'Specifications', subtitle: 'Requirement documents & acceptance criteria', group: 'workspace', section: 'requests', icon: FileText },

  { id: 'my_issues', label: 'My Issues', title: 'My Issues', subtitle: 'Tasks assigned to you across projects', group: 'primary', section: 'work', icon: User },
  { id: 'issues', label: 'Issues', title: 'Issues & Tasks', subtitle: 'Kanban board & issue tracking', group: 'workspace', section: 'work', icon: CheckSquare },
  { id: 'projects', label: 'Projects', title: 'Projects & Milestones', subtitle: 'Project roadmap & deliverable progress', group: 'workspace', section: 'work', icon: FolderKanban },

  { id: 'agents', label: 'Agents', title: 'Agent Studio', subtitle: 'Manage personas, models, and autonomy', group: 'workspace', section: 'ai_ops', icon: Bot },
  { id: 'squads', label: 'Squads', title: 'Agent Squads', subtitle: 'Configure multi-agent topologies', group: 'workspace', section: 'ai_ops', icon: Users },
  { id: 'runtimes', label: 'Runtimes', title: 'AI Runtimes & Endpoints', subtitle: 'Local Ollama/LM Studio & cloud APIs', group: 'configure', section: 'ai_ops', icon: Monitor },
  { id: 'skills', label: 'Skills', title: 'System Skills & MCP', subtitle: 'Tool registry, bash, browser, & MCP', group: 'configure', section: 'ai_ops', icon: BookOpen },

  { id: 'deployments', label: 'CI/CD Platform', title: 'CI/CD Platform', subtitle: 'Release pipelines & preview builds', group: 'workspace', section: 'delivery', icon: Rocket },
  { id: 'build_room', label: 'Build Room', title: 'Live Build Room', subtitle: 'Project execution, handoffs, and validation', group: 'workspace', section: 'delivery', icon: Workflow },

  { id: 'analytics', label: 'Analytics', title: 'Token & Cost Analytics', subtitle: 'Token consumption & model latency', group: 'workspace', section: 'insights', icon: BarChart3 },
  { id: 'billing', label: 'Billing & Usage', title: 'Billing & Usage', subtitle: 'Committed client value and agent compute', group: 'workspace', section: 'insights', icon: CreditCard },

  { id: 'settings', label: 'Settings', title: 'Workspace Settings', subtitle: 'Preferences, keys, and autonomy governance', group: 'configure', section: 'config', icon: Settings }
];

const BY_ID = new Map(NAV_ITEMS.map(item => [item.id, item]));

/** The entry for a destination. Throws on an unknown id — see the assertion below. */
export function navItem(id: NavigationTab): NavItem {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`No navigation entry for "${id}"`);
  return item;
}

/** The label this reader recognises. */
export const navLabel = (id: NavigationTab, role: UserRole): string => {
  const item = BY_ID.get(id);
  if (!item) return id;
  return role === 'client' && item.clientLabel ? item.clientLabel : item.label;
};

export const navTitle = (id: NavigationTab): string => BY_ID.get(id)?.title ?? id;
export const navSubtitle = (id: NavigationTab): string => BY_ID.get(id)?.subtitle ?? '';
/** Rendered at the caller's size, because the two call sites differ. */
export function navIcon(id: NavigationTab, className = 'w-4 h-4'): React.ReactNode {
  const Icon = BY_ID.get(id)?.icon;
  return Icon ? <Icon className={className} /> : null;
}

/**
 * Which destinations each role may reach.
 *
 * Order matters — it is the order of the sidebar and decides the landing view,
 * so it is written out rather than derived from NAV_ITEMS.
 *
 * This is *navigation* only. What someone may **do** once they arrive is the
 * `Capability` union in AppContext, which is deliberately separate: hiding a
 * tab is not a permission, and a role that can open Billing is not necessarily
 * one that can change it.
 */
export const ROLE_NAV: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'documents', 'inbox', 'chat', 'settings'],
  dev: ['my_issues', 'issues', 'documents', 'inbox', 'chat', 'agents', 'deployments', 'build_room', 'runtimes', 'skills', 'settings'],
  pm: [
    'inbox', 'chat', 'my_issues', 'issues', 'projects', 'documents',
    'deployments', 'build_room', 'agents', 'squads', 'analytics', 'runtimes', 'skills', 'settings'
  ],
  admin: [
    'inbox', 'chat', 'my_issues', 'issues', 'projects', 'documents', 'billing',
    'deployments', 'build_room', 'agents', 'squads', 'analytics', 'runtimes', 'skills', 'settings'
  ]
};

/** The view a role lands on, and falls back to when it opens one it may not. */
export const landingTab = (role: UserRole): NavigationTab => ROLE_NAV[role][0];

/** A role's destinations, grouped for the sidebar, empty sections dropped. */
export function sectionsFor(role: UserRole): Array<{ section: NavSection; items: NavItem[] }> {
  const allowed = new Set(ROLE_NAV[role]);
  return NAV_SECTIONS
    .map(section => ({
      section,
      items: NAV_ITEMS.filter(item => item.section === section.id && allowed.has(item.id))
    }))
    .filter(group => group.items.length > 0);
}

/**
 * Catch at module load what would otherwise be invisible.
 *
 * The sidebar is the only route to most views, so a destination missing from
 * NAV_ITEMS — or reachable by a role but absent from the table — hides a whole
 * feature, silently, and only for that role. Exactly the class of bug nobody
 * finds until a demo.
 *
 * Development only: a shipped build should not refuse to start over a menu.
 */
if (import.meta.env.DEV) {
  const known = new Set(NAV_ITEMS.map(i => i.id));

  for (const [role, tabs] of Object.entries(ROLE_NAV)) {
    for (const tab of tabs) {
      if (!known.has(tab)) {
        console.error(`[navigation] role "${role}" can reach "${tab}", which has no entry in NAV_ITEMS.`);
      }
    }
  }

  const sectionIds = new Set(NAV_SECTIONS.map(s => s.id));
  for (const item of NAV_ITEMS) {
    if (!sectionIds.has(item.section)) {
      console.error(`[navigation] "${item.id}" is in section "${item.section}", which is not in NAV_SECTIONS.`);
    }
  }

  // An entry no role can reach is dead weight, and usually a forgotten ROLE_NAV edit.
  const reachable = new Set(Object.values(ROLE_NAV).flat());
  for (const item of NAV_ITEMS) {
    if (!reachable.has(item.id)) {
      console.warn(`[navigation] "${item.id}" is defined but no role can reach it.`);
    }
  }
}
