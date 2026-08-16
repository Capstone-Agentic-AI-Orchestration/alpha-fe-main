import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { NavigationTab } from '../../types';
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
  Search,
  Edit3,
  ChevronDown,
  HelpCircle,
  Rocket
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onOpenNewIssue: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenNewIssue }) => {
  const { 
    activeTab, 
    setActiveTab, 
    unreadInboxCount, 
    settings,
    setCommandPaletteOpen 
  } = useApp();

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  return (
    <aside className="w-64 bg-[#121318] border-r border-white/[0.06] flex flex-col flex-shrink-0 select-none z-20 text-gray-300 font-sans text-sm">
      {/* Top Window Header: Workspace Switcher */}
      <div className="pt-3 px-4 pb-3 space-y-3">

        {/* Workspace Dropdown */}
        <div className="relative">
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-6 h-6 rounded-full bg-white/10 text-gray-200 flex items-center justify-center text-xs font-bold">
                A
              </div>
              <span className="text-sm font-semibold text-white truncate">
                {settings.workspaceName || 'Alpha work'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </button>

          {/* Workspace Switcher Menu */}
          {workspaceMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-[#1A1B22] border border-white/10 rounded-xl shadow-2xl p-2 space-y-1 animate-slide-up text-sm">
              <div className="text-xs font-mono uppercase text-gray-500 px-2 py-1">Workspaces</div>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-brand-500/20 text-white font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="truncate">{settings.workspaceName || 'Alpha work'}</span>
              </div>
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setWorkspaceMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg"
              >
                Workspace Settings
              </button>
            </div>
          )}
        </div>

        {/* Quick Search & New Issue Buttons */}
        <div className="space-y-1.5 pt-1">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] text-gray-400 hover:text-gray-200 transition-colors text-sm"
          >
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-500" />
              <span>Search...</span>
            </div>
            <kbd className="text-xs font-mono text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
              ⌘ K
            </kbd>
          </button>

          <button
            onClick={onOpenNewIssue}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] text-gray-400 hover:text-gray-200 transition-colors text-sm"
          >
            <div className="flex items-center gap-3">
              <Edit3 className="w-4 h-4 text-gray-500" />
              <span>New Issue</span>
            </div>
            <kbd className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
              C
            </kbd>
          </button>
        </div>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 overflow-y-auto px-2.5 space-y-5 py-2">
        {/* Top 3 Core Items */}
        <div className="space-y-1">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-colors ${
              activeTab === 'inbox'
                ? 'bg-white/[0.08] text-white font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Inbox className="w-4 h-4" />
              <span>Inbox</span>
            </div>
            {unreadInboxCount > 0 && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                {unreadInboxCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition-colors ${
              activeTab === 'chat'
                ? 'bg-white/[0.08] text-white font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('my_issues')}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition-colors ${
              activeTab === 'my_issues'
                ? 'bg-white/[0.08] text-white font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>My Issues</span>
          </button>
        </div>

        {/* Section: Workspace */}
        <div className="space-y-1">
          <div className="px-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Workspace
          </div>

          {[
            { id: 'issues', label: 'Issues', icon: <CheckSquare className="w-4 h-4" /> },
            { id: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" /> },
            { id: 'deployments', label: 'CI/CD Platform', icon: <Rocket className="w-4 h-4" /> },
            { id: 'agents', label: 'Agents', icon: <Bot className="w-4 h-4" /> },
            { id: 'squads', label: 'Squads', icon: <Users className="w-4 h-4" /> },
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as NavigationTab)}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition-colors ${
                activeTab === item.id
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Section: Configure */}
        <div className="space-y-1">
          <div className="px-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Configure
          </div>

          {[
            { id: 'runtimes', label: 'Runtimes', icon: <Monitor className="w-4 h-4" /> },
            { id: 'skills', label: 'Skills', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as NavigationTab)}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition-colors ${
                activeTab === item.id
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Footer: Help & Feedback */}
      <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between text-gray-400 text-xs">
        <button
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-2 hover:text-gray-200 transition-colors font-medium"
        >
          <HelpCircle className="w-4 h-4 text-gray-500" />
          <span>Help & Support</span>
        </button>
        <span className="font-mono text-[10px] text-gray-600">v1.4.0</span>
      </div>
    </aside>
  );
};
