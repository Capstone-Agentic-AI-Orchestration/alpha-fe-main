import type { UserRole, NavigationFilter, SectionId, ViewId } from "./types";

export const NAVIGATION_RBAC: Record<UserRole, NavigationFilter> = {
  client: {
    visibleSections: ["workspace", "requests", "settings_section"],
    visibleItems: {
      workspace: ["portal", "inbox", "chat"],
      requests: ["intake", "my_requests"],
      settings_section: ["profile_settings", "settings"],
    },
    defaultView: "portal",
    labels: { chat: "Messages", my_requests: "My Requests" },
  },

  dev: {
    visibleSections: ["workspace", "work", "ai_ops", "delivery", "settings_section"],
    visibleItems: {
      workspace: ["inbox", "chat"],
      work: ["my_issues", "issues", "calendar", "documents"],
      ai_ops: ["agents", "runtimes", "skills"],
      delivery: ["deployments", "live_build"],
      settings_section: ["profile_settings", "settings"],
    },
    defaultView: "my_issues",
    restrictions: {
      agents: { canCreate: false, canDelete: false, canArchive: false },
    },
  },

  pm: {
    visibleSections: [
      "workspace",
      "work",
      "requests",
      "ai_ops",
      "delivery",
      "insights",
      "settings_section",
    ],
    visibleItems: {
      workspace: ["inbox", "chat"],
      work: ["my_issues", "issues", "projects", "calendar", "documents"],
      requests: ["intake"],
      ai_ops: ["agents", "squads", "runtimes", "skills"],
      delivery: ["deployments", "live_build"],
      insights: ["analytics"],
      settings_section: ["profile_settings", "settings"],
    },
    defaultView: "inbox",
  },

  admin: {
    visibleSections: [
      "workspace",
      "work",
      "requests",
      "ai_ops",
      "delivery",
      "insights",
      "settings_section",
    ],
    visibleItems: {
      workspace: ["portal", "inbox", "chat"],
      work: ["my_issues", "issues", "projects", "calendar", "documents"],
      requests: ["intake", "my_requests"],
      ai_ops: ["agents", "squads", "runtimes", "skills"],
      delivery: ["deployments", "live_build"],
      insights: ["analytics", "billing"],
      settings_section: ["profile_settings", "settings"],
    },
    defaultView: "inbox",
    labels: { settings_section: "Administration" },
  },
};

export function getVisibleSections(role: UserRole) {
  return NAVIGATION_RBAC[role].visibleSections;
}

export function getVisibleItems(role: UserRole, sectionId: SectionId): ViewId[] {
  return (NAVIGATION_RBAC[role].visibleItems[sectionId] as ViewId[]) ?? [];
}

export function getItemLabel(role: UserRole, itemId: string, defaultLabel: string): string {
  return NAVIGATION_RBAC[role].labels?.[itemId] ?? defaultLabel;
}

export function getSectionLabel(role: UserRole, sectionId: string, defaultLabel: string): string {
  return NAVIGATION_RBAC[role].labels?.[sectionId] ?? defaultLabel;
}

export function getDefaultView(role: UserRole): ViewId {
  return NAVIGATION_RBAC[role].defaultView;
}

export function canDo(role: UserRole, feature: string, action: string): boolean {
  const rbac = NAVIGATION_RBAC[role];
  if (!rbac.restrictions?.[feature]) return true;
  return rbac.restrictions[feature][action] !== false;
}
