import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, PenLine, FileText, Inbox, MessageSquare,
  CheckSquare, FolderKanban, Rocket, Bot, Users, BarChart3, Monitor, BookOpen, Settings,
  RadioTower
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

export type SectionId =
  | 'portal'
  | 'my_work'
  | 'requests'
  | 'projects'
  | 'delivery'
  | 'communication'
  | 'collaboration'
  | 'documents'
  | 'automation'
  | 'resources'
  | 'operations'
  | 'insights'
  | 'workspace'
  | 'administration'
  | 'settings';

export interface NavSection {
  id: SectionId;
  label: string;
  labels?: Partial<Record<UserRole, string>>;
}

/**
 * The complete hierarchy is intentionally role-aware. A client should not see
 * an empty internal section, while a developer needs a clear split between
 * assigned work, automation, resources, and communication.
 */
export const NAV_SECTIONS: NavSection[] = [
  { id: 'portal', label: 'Portal', labels: { pm: 'Overview', admin: 'Overview' } },
  { id: 'my_work', label: 'My Work' },
  { id: 'requests', label: 'Requests' },
  { id: 'projects', label: 'Projects' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'communication', label: 'Communication' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'documents', label: 'Documents' },
  { id: 'automation', label: 'Automation' },
  { id: 'resources', label: 'Resources' },
  { id: 'operations', label: 'Operations' },
  { id: 'insights', label: 'Insights' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'administration', label: 'Administration' },
  { id: 'settings', label: 'Settings' }
];

const ROLE_SECTION_ORDER: Record<UserRole, SectionId[]> = {
  client: ['portal', 'requests', 'communication', 'documents', 'settings'],
  dev: ['my_work', 'automation', 'resources', 'communication', 'settings'],
  pm: ['portal', 'projects', 'delivery', 'collaboration', 'automation', 'operations', 'insights', 'workspace'],
  admin: ['portal', 'projects', 'delivery', 'collaboration', 'automation', 'operations', 'insights', 'administration']
};

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
  /** Override the hierarchy for a persona without duplicating the item. */
  sectionByRole?: Partial<Record<UserRole, SectionId>>;
  /** Reader-friendly labels for the same destination. */
  labels?: Partial<Record<UserRole, string>>;
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
  { id: 'portal', label: 'Overview', labels: { client: 'My Projects' }, title: 'Overview', subtitle: 'Your requests, progress, and project status', group: 'primary', section: 'portal', icon: LayoutDashboard },
  { id: 'inbox', label: 'Inbox', title: 'Inbox & Approvals', subtitle: 'View notifications & agent approvals', group: 'primary', section: 'communication', sectionByRole: { pm: 'collaboration', admin: 'collaboration' }, icon: Inbox },
  { id: 'chat', label: 'Chat', clientLabel: 'Messages', title: 'Agent Chat Canvas', subtitle: 'Chat with autonomous agents & squads', group: 'primary', section: 'communication', sectionByRole: { pm: 'collaboration', admin: 'collaboration' }, icon: MessageSquare },

  { id: 'intake', label: 'New request', title: 'New Request', subtitle: 'Describe what you need in plain language', group: 'primary', section: 'requests', icon: PenLine },
  { id: 'documents', label: 'Specifications', labels: { client: 'Shared Documents' }, title: 'Specifications', subtitle: 'Requirement documents & acceptance criteria', group: 'workspace', section: 'communication', sectionByRole: { client: 'documents' }, icon: FileText },

  { id: 'issues', label: 'Issues', labels: { pm: 'All Issues', admin: 'All Issues' }, title: 'Issues', subtitle: 'Assigned work and project issues', group: 'workspace', section: 'my_work', sectionByRole: { pm: 'delivery', admin: 'delivery' }, icon: CheckSquare },
  { id: 'projects', label: 'Projects', labels: { dev: 'Projects', pm: 'All Projects', admin: 'All Projects' }, title: 'Projects & Milestones', subtitle: 'Project roadmap & deliverable progress', group: 'workspace', section: 'my_work', sectionByRole: { pm: 'projects', admin: 'projects' }, icon: FolderKanban },

  { id: 'agents', label: 'Agents', labels: { dev: 'Agent Directory' }, title: 'Agent Studio', subtitle: 'Manage personas, models, and autonomy', group: 'workspace', section: 'automation', icon: Bot },
  { id: 'squads', label: 'Squads', labels: { dev: 'My Squads', pm: 'Project Squads', admin: 'All Squads' }, title: 'Agent Squads', subtitle: 'Configure multi-agent topologies', group: 'workspace', section: 'automation', icon: Users },
  { id: 'live_build_room', label: 'Live Build Room', labels: { pm: 'Build Rooms', admin: 'Build Rooms' }, title: 'Live Build Room', subtitle: 'Observe project squad execution in real time', group: 'workspace', section: 'automation', icon: RadioTower },
  { id: 'runtimes', label: 'Runtimes', title: 'AI Runtimes & Endpoints', subtitle: 'Local Ollama/LM Studio & cloud APIs', group: 'configure', section: 'resources', sectionByRole: { pm: 'operations', admin: 'operations' }, icon: Monitor },
  { id: 'skills', label: 'Skills', labels: { pm: 'Integrations', admin: 'Integrations' }, title: 'System Skills & MCP', subtitle: 'Tool registry, bash, browser, & MCP', group: 'configure', section: 'resources', sectionByRole: { pm: 'operations', admin: 'operations' }, icon: BookOpen },

  { id: 'deployments', label: 'CI/CD Platform', labels: { dev: 'CI/CD & Deployments', pm: 'Deployments', admin: 'Deployments' }, title: 'CI/CD Platform', subtitle: 'Release pipelines & preview builds', group: 'workspace', section: 'my_work', sectionByRole: { pm: 'operations', admin: 'operations' }, icon: Rocket },

  { id: 'analytics', label: 'Analytics', labels: { pm: 'Delivery Health', admin: 'Delivery Health' }, title: 'Operational Analytics', subtitle: 'Run health, delivery activity, and performance', group: 'workspace', section: 'insights', icon: BarChart3 },

  { id: 'settings', label: 'Settings', labels: { admin: 'Workspace Settings' }, title: 'Workspace Settings', subtitle: 'Preferences, keys, and autonomy governance', group: 'configure', section: 'settings', sectionByRole: { pm: 'workspace', admin: 'administration' }, icon: Settings }
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
  return item.labels?.[role] ?? (role === 'client' && item.clientLabel ? item.clientLabel : item.label);
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
 * tab is not a permission, and a role that can open Analytics is not
 * necessarily one that can change workspace settings.
 */
export const ROLE_NAV: Record<UserRole, NavigationTab[]> = {
  client: ['portal', 'intake', 'documents', 'inbox', 'chat', 'settings'],
  dev: ['issues', 'projects', 'agents', 'squads', 'live_build_room', 'deployments', 'runtimes', 'skills', 'inbox', 'chat', 'documents', 'settings'],
  pm: [
    'portal', 'projects', 'issues', 'documents', 'inbox', 'chat',
    'agents', 'squads', 'live_build_room', 'deployments', 'runtimes', 'skills', 'analytics', 'settings'
  ],
  admin: [
    'portal', 'projects', 'issues', 'documents', 'inbox', 'chat',
    'agents', 'squads', 'live_build_room', 'deployments', 'runtimes', 'skills', 'analytics', 'settings'
  ]
};

/** The view a role lands on, and falls back to when it opens one it may not. */
export const landingTab = (role: UserRole): NavigationTab => ROLE_NAV[role][0];

/** A role's destinations, grouped for the sidebar, empty sections dropped. */
export function sectionsFor(role: UserRole): Array<{ section: NavSection; items: NavItem[] }> {
  const allowed = new Set(ROLE_NAV[role]);
  const byId = new Map(NAV_SECTIONS.map(section => [section.id, section]));
  return ROLE_SECTION_ORDER[role]
    .map(sectionId => {
      const section = byId.get(sectionId);
      if (!section) return null;
      return {
        section: { ...section, label: section.labels?.[role] ?? section.label },
        items: NAV_ITEMS.filter(item =>
          allowed.has(item.id) && (item.sectionByRole?.[role] ?? item.section) === sectionId
        )
      };
    })
    .filter((group): group is { section: NavSection; items: NavItem[] } => Boolean(group))
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
