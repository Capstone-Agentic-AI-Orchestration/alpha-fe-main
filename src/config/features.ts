import type { NavigationTab, UserRole } from '@/shared/types';

/**
 * Which roles see Alpha's AI tooling: Chat with Alpha, agents, Orchestrator builds,
 * runtimes and integrations, and repository setup when creating
 * a project, and attaching folders or repositories to a project.
 *
 * Project managers can inspect agents, ask/review agent work, and inspect
 * cached runtime/skill catalogs. Capability checks keep execution, runtime
 * scans, and configuration read-only for them.
 */
export const AI_FEATURES_BY_ROLE: Record<UserRole, boolean> = {
  client: true,
  dev: true,
  pm: true,
  admin: true
};

/** Navigation destinations that exist only to work with AI agents. */
export const AI_NAV_TABS: readonly NavigationTab[] = ['chat', 'agents', 'runtimes', 'skills'];

export const aiFeaturesEnabled = (role: UserRole): boolean => AI_FEATURES_BY_ROLE[role];

/**
 * Whether the standalone Chat tab is in the navigation.
 *
 * Off while project work happens on the board: each task builds through its own
 * private conversation, and the board shows the decisions that need a person.
 * Turning this back on restores the tab exactly as it was; board builds stay
 * out of the Chat list, and "Open in chat" on a card opens that task's thread.
 */
export const CHAT_TAB_ENABLED = false;
