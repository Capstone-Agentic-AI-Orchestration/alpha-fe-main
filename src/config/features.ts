import type { NavigationTab, UserRole } from '@/shared/types';

/**
 * Which roles see Alpha's AI tooling: Chat with Alpha, agents, build rooms,
 * runtimes and integrations, the Orchestrator and repository setup when creating
 * a project, and attaching folders or repositories to a project.
 *
 * Project managers do not use AI for now, so it is hidden for them. Hidden, not
 * removed: the views, components and backend APIs all stay. Set `pm` back to
 * true to bring every one of these surfaces back for project managers.
 */
export const AI_FEATURES_BY_ROLE: Record<UserRole, boolean> = {
  client: true,
  dev: true,
  pm: false,
  admin: true
};

/** Navigation destinations that exist only to work with AI agents. */
export const AI_NAV_TABS: readonly NavigationTab[] = ['chat', 'agents', 'live_build_room', 'runtimes', 'skills'];

export const aiFeaturesEnabled = (role: UserRole): boolean => AI_FEATURES_BY_ROLE[role];
