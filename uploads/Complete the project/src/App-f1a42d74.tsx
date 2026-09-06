import { useApp } from "./context/AppContext";
import HierarchicalSidebar from "./components/HierarchicalSidebar";
import OverviewView from "./views/OverviewView";
import InboxView from "./views/InboxView";
import ChatView from "./views/ChatView";
import MyIssuesView from "./views/MyIssuesView";
import IssuesView from "./views/IssuesView";
import ProjectsView from "./views/ProjectsView";
import CalendarView from "./views/CalendarView";
import SpecificationsView from "./views/SpecificationsView";
import NewRequestView from "./views/NewRequestView";
import MyRequestsView from "./views/MyRequestsView";
import AgentsView from "./views/AgentsView";
import SquadsView from "./views/SquadsView";
import RuntimesView from "./views/RuntimesView";
import SkillsView from "./views/SkillsView";
import DeploymentsView from "./views/DeploymentsView";
import LiveBuildRoomView from "./views/LiveBuildRoomView";
import AnalyticsView from "./views/AnalyticsView";
import BillingView from "./views/BillingView";
import SettingsView from "./views/SettingsView";
import ProfileSettingsView from "./views/ProfileSettingsView";
import type { ViewId } from "./config/types";

export default function AppShell() {
  const { activeView } = useApp();
  
  const VIEW_MAP: Record<ViewId, React.ReactNode> = {
    portal: <OverviewView />,
    inbox: <InboxView />,
    chat: <ChatView />,
    my_issues: <MyIssuesView />,
    issues: <IssuesView />,
    projects: <ProjectsView />,
    calendar: <CalendarView />,
    documents: <SpecificationsView />,
    intake: <NewRequestView />,
    my_requests: <MyRequestsView />,
    agents: <AgentsView />,
    squads: <SquadsView />,
    runtimes: <RuntimesView />,
    skills: <SkillsView />,
    deployments: <DeploymentsView />,
    live_build: <LiveBuildRoomView />,
    analytics: <AnalyticsView />,
    billing: <BillingView />,
    settings: <SettingsView />,
    profile_settings: <ProfileSettingsView />,
  };

  const currentView = VIEW_MAP[activeView] ?? (
    <div className="p-8 text-slate-400 text-[14px]">View not found</div>
  );

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      <HierarchicalSidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {currentView}
      </main>
    </div>
  );
}
