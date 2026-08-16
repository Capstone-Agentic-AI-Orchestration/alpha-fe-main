import React, { useState, useRef, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { CommandPalette } from './components/common/CommandPalette';
import { CreateIssueModal } from './components/issues/CreateIssueModal';
import { InboxView } from './views/InboxView';
import { ChatView } from './views/ChatView';
import { IssuesView } from './views/IssuesView';
import { ProjectsView } from './views/ProjectsView';
import { AgentsView } from './views/AgentsView';
import { SquadsView } from './views/SquadsView';
import { AnalyticsView } from './views/AnalyticsView';
import { RuntimesView } from './views/RuntimesView';
import { SkillsView } from './views/SkillsView';
import { DeploymentsView } from './views/DeploymentsView';
import { SettingsView } from './views/SettingsView';
import { NavigationTab } from './types';
import { 
  Inbox, 
  MessageSquare, 
  User,
  CheckSquare, 
  FolderKanban, 
  Bot, 
  Users, 
  BarChart3, 
  Monitor, 
  BookOpen, 
  Settings, 
  Rocket, 
  Plus,
  X
} from 'lucide-react';

const ALL_TABS: { id: NavigationTab; title: string; subtitle: string; icon: React.ReactNode }[] = [
  { id: 'inbox', title: 'Inbox & Approvals', subtitle: 'View notifications & agent approvals', icon: <Inbox className="w-4 h-4 text-amber-400" /> },
  { id: 'chat', title: 'Agent Chat Canvas', subtitle: 'Chat with autonomous agents & squads', icon: <MessageSquare className="w-4 h-4 text-cyan-400" /> },
  { id: 'my_issues', title: 'My Issues', subtitle: 'Tasks assigned to you across projects', icon: <User className="w-4 h-4 text-emerald-400" /> },
  { id: 'issues', title: 'Issues & Tasks', subtitle: 'Kanban board & issue tracking', icon: <CheckSquare className="w-4 h-4 text-indigo-400" /> },
  { id: 'projects', title: 'Projects & Milestones', subtitle: 'Project roadmap & deliverable progress', icon: <FolderKanban className="w-4 h-4 text-blue-400" /> },
  { id: 'deployments', title: 'CI/CD Platform', subtitle: 'Release pipelines & preview builds', icon: <Rocket className="w-4 h-4 text-pink-400" /> },
  { id: 'agents', title: 'Agent Studio', subtitle: 'Manage personas, models, and autonomy', icon: <Bot className="w-4 h-4 text-purple-400" /> },
  { id: 'squads', title: 'Agent Squads', subtitle: 'Configure multi-agent topologies', icon: <Users className="w-4 h-4 text-teal-400" /> },
  { id: 'analytics', title: 'Token & Cost Analytics', subtitle: 'Token consumption & model latency', icon: <BarChart3 className="w-4 h-4 text-rose-400" /> },
  { id: 'runtimes', title: 'AI Runtimes & Endpoints', subtitle: 'Local Ollama/LM Studio & cloud APIs', icon: <Monitor className="w-4 h-4 text-orange-400" /> },
  { id: 'skills', title: 'System Skills & MCP', subtitle: 'Tool registry, bash, browser, & MCP', icon: <BookOpen className="w-4 h-4 text-sky-400" /> },
  { id: 'settings', title: 'Workspace Settings', subtitle: 'Preferences, keys, and autonomy governance', icon: <Settings className="w-4 h-4 text-gray-400" /> },
];

export const App: React.FC = () => {
  const { activeTab, tabs, activeTabId, setActiveTabId, openNewTab, closeTab } = useApp();
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newTabMenuOpen, setNewTabMenuOpen] = useState(false);
  const newTabMenuRef = useRef<HTMLDivElement>(null);

  // Close new tab dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (newTabMenuRef.current && !newTabMenuRef.current.contains(event.target as Node)) {
        setNewTabMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNewTabMenuOpen(false);
      }
    };
    if (newTabMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [newTabMenuOpen]);

  const getTabIcon = (tab: NavigationTab) => {
    switch (tab) {
      case 'inbox': return <Inbox className="w-3.5 h-3.5" />;
      case 'chat': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'my_issues': return <User className="w-3.5 h-3.5" />;
      case 'issues': return <CheckSquare className="w-3.5 h-3.5" />;
      case 'projects': return <FolderKanban className="w-3.5 h-3.5" />;
      case 'deployments': return <Rocket className="w-3.5 h-3.5" />;
      case 'agents': return <Bot className="w-3.5 h-3.5" />;
      case 'squads': return <Users className="w-3.5 h-3.5" />;
      case 'analytics': return <BarChart3 className="w-3.5 h-3.5" />;
      case 'runtimes': return <Monitor className="w-3.5 h-3.5" />;
      case 'skills': return <BookOpen className="w-3.5 h-3.5" />;
      case 'settings': return <Settings className="w-3.5 h-3.5" />;
      default: return <Inbox className="w-3.5 h-3.5" />;
    }
  };

  const getTabTitle = (tab: NavigationTab) => {
    switch (tab) {
      case 'inbox': return 'Inbox';
      case 'chat': return 'Chat';
      case 'my_issues': return 'My Issues';
      case 'issues': return 'Issues';
      case 'projects': return 'Projects';
      case 'deployments': return 'CI/CD Platform';
      case 'agents': return 'Agents';
      case 'squads': return 'Squads';
      case 'analytics': return 'Analytics';
      case 'runtimes': return 'Runtimes';
      case 'skills': return 'Skills';
      case 'settings': return 'Settings';
      default: return 'Inbox';
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#111217] text-gray-100 font-sans overflow-hidden select-none text-sm">
      {/* Multica Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onOpenNewIssue={() => setCreateIssueOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#16171D] overflow-hidden">
        {/* Multica Top Window Tab Bar */}
        <div className="h-11 bg-[#121318] border-b border-white/[0.06] flex items-center px-3 z-20 relative">
          {/* Scrollable Open Tabs List */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-[calc(100%-60px)] no-scrollbar py-1">
            {tabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      closeTab(tab.id);
                    }
                  }}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all border-t border-x select-none max-w-[200px] min-w-[110px] ${
                    isActive
                      ? 'bg-[#16171D] border-white/[0.08] text-white shadow-sm'
                      : 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-400'}`}>
                    {getTabIcon(tab.view)}
                  </span>
                  <span className="truncate flex-1 text-left">{getTabTitle(tab.view)}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-opacity"
                      title="Close Tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* New Tab Button & Dropdown Picker */}
          <div className="relative ml-1 flex-shrink-0" ref={newTabMenuRef}>
            <button
              onClick={() => setNewTabMenuOpen(prev => !prev)}
              className={`p-1.5 rounded-lg transition-colors ${
                newTabMenuOpen 
                  ? 'bg-white/10 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              title="Open New Tab"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* New Tab Dropdown Menu */}
            {newTabMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#1A1B22] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-slide-up space-y-1">
                <div className="text-[11px] font-mono uppercase tracking-wider text-gray-500 px-2.5 py-1">
                  Open New Tab
                </div>
                <div className="max-h-80 overflow-y-auto space-y-0.5">
                  {ALL_TABS.map((item) => {
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          openNewTab(item.id);
                          setNewTabMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors hover:bg-white/[0.05] text-gray-300 hover:text-white"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1 rounded-md bg-white/[0.04] flex-shrink-0">
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{item.title}</div>
                            <div className="text-[10px] text-gray-500 truncate">{item.subtitle}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic View Content */}
        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'inbox' && <InboxView />}
          {activeTab === 'chat' && <ChatView />}
          {activeTab === 'my_issues' && <IssuesView onlyMyIssues={true} onOpenNewIssue={() => setCreateIssueOpen(true)} />}
          {activeTab === 'issues' && <IssuesView onOpenNewIssue={() => setCreateIssueOpen(true)} />}
          {activeTab === 'projects' && <ProjectsView />}
          {activeTab === 'agents' && <AgentsView />}
          {activeTab === 'squads' && <SquadsView />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'runtimes' && <RuntimesView />}
          {activeTab === 'skills' && <SkillsView />}
          {activeTab === 'deployments' && <DeploymentsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global ⌘K Command Palette */}
      <CommandPalette />

      {/* Multica Create Issue Modal */}
      <CreateIssueModal
        isOpen={createIssueOpen}
        onClose={() => setCreateIssueOpen(false)}
      />
    </div>
  );
};

export default App;
