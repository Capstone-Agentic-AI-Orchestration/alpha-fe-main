import type { NavSection } from "./types";

export const MASTER_NAVIGATION: NavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: "LayoutDashboard",
    items: [
      { id: "portal", label: "Overview", icon: "LayoutDashboard" },
      { id: "inbox", label: "Inbox & Approvals", icon: "Bell" },
      { id: "chat", label: "Agent Chat", icon: "MessageSquare" },
    ],
  },
  {
    id: "work",
    label: "Work Management",
    icon: "Kanban",
    items: [
      { id: "my_issues", label: "My Issues", icon: "CheckSquare" },
      { id: "issues", label: "Issues & Tasks", icon: "Kanban" },
      { id: "projects", label: "Projects & Milestones", icon: "FolderKanban" },
      { id: "calendar", label: "Calendar", icon: "Calendar" },
      { id: "documents", label: "Specifications", icon: "FileText" },
    ],
  },
  {
    id: "requests",
    label: "Requests",
    icon: "Inbox",
    items: [
      { id: "intake", label: "New Request", icon: "PlusCircle" },
      { id: "my_requests", label: "My Requests", icon: "ClipboardList" },
    ],
  },
  {
    id: "ai_ops",
    label: "AI Operations",
    icon: "Bot",
    items: [
      { id: "agents", label: "Agent Studio", icon: "Bot" },
      { id: "squads", label: "Agent Squads", icon: "Users" },
      { id: "runtimes", label: "AI Runtimes", icon: "Cpu" },
      { id: "skills", label: "Skills & MCP", icon: "Wrench" },
    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    icon: "Rocket",
    items: [
      { id: "deployments", label: "Deployments", icon: "Rocket" },
      { id: "live_build", label: "Live Build Room", icon: "Zap" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: "BarChart2",
    items: [
      { id: "analytics", label: "Analytics", icon: "BarChart2" },
      { id: "billing", label: "Billing & Usage", icon: "CreditCard" },
    ],
  },
  {
    id: "settings_section",
    label: "Settings",
    icon: "Settings",
    items: [
      { id: "profile_settings", label: "Profile Settings", icon: "Users" },
      { id: "settings", label: "Workspace Settings", icon: "Settings" }
    ],
  },
];
