import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { NavigationTab, UserRole } from '../../types';
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
  Rocket,
  FileText,
  Receipt,
  CreditCard,
  LayoutDashboard,
  PenLine
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onOpenNewIssue: () => void;
}

/** Labels differ per persona: same record, named the way the reader recognises it. */
const NAV_META: Record<
  NavigationTab,
  { label: string; clientLabel?: string; icon: React.ReactNode; group: 'primary' | 'workspace' | 'configure' }
> = {
  portal:      { label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" />, group: 'primary' },
  intake:      { label: 'New request', icon: <PenLine className="w-4 h-4" />, group: 'primary' },
  inbox:       { label: 'Inbox', icon: <Inbox className="w-4 h-4" />, group: 'primary' },
  chat:        { label: 'Chat', clientLabel: 'Messages', icon: <MessageSquare className="w-4 h-4" />, group: 'primary' },
  my_issues:   { label: 'My Issues', icon: <User className="w-4 h-4" />, group: 'primary' },
  documents:   { label: 'Specifications', clientLabel: 'My requests', icon: <FileText className="w-4 h-4" />, group: 'workspace' },
  estimates:   { label: 'Estimates', clientLabel: 'Costs', icon: <Receipt className="w-4 h-4" />, group: 'workspace' },
  issues:      { label: 'Issues', icon: <CheckSquare className="w-4 h-4" />, group: 'workspace' },
  projects:    { label: 'Projects', icon: <FolderKanban className="w-4 h-4" />, group: 'workspace' },
  deployments: { label: 'CI/CD Platform', icon: <Rocket className="w-4 h-4" />, group: 'workspace' },
  agents:      { label: 'Agents', icon: <Bot className="w-4 h-4" />, group: 'workspace' },
  squads:      { label: 'Squads', icon: <Users className="w-4 h-4" />, group: 'workspace' },
  analytics:   { label: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, group: 'workspace' },
  billing:     { label: 'Billing & Usage', icon: <CreditCard className="w-4 h-4" />, group: 'workspace' },
  runtimes:    { label: 'Runtimes', icon: <Monitor className="w-4 h-4" />, group: 'configure' },
  skills:      { label: 'Skills', icon: <BookOpen className="w-4 h-4" />, group: 'configure' },
  settings:    { label: 'Settings', icon: <Settings className="w-4 h-4" />, group: 'configure' }
};

const ROLE_LABEL: Record<UserRole, string> = {
  client: 'Client',
  dev: 'Developer',
  pm: 'Project Manager',
  admin: 'Admin'
};

export const Sidebar: React.FC<SidebarProps> = ({ onOpenNewIssue }) => {
  const {
    activeTab,
    setActiveTab,
    unreadInboxCount,
    settings,
    setCommandPaletteOpen,
    visibleTabs,
    role,
    switchRole,
    currentUser
  } = useApp();

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) setRoleMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setRoleMenuOpen(false);
    if (roleMenuOpen) {
      document.addEventListener('mousedown', onClick);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [roleMenuOpen]);

  const isClient = role === 'client';
  const labelFor = (tab: NavigationTab) =>
    (isClient && NAV_META[tab].clientLabel) || NAV_META[tab].label;

  const group = (name: 'primary' | 'workspace' | 'configure') =>
    visibleTabs.filter(t => NAV_META[t].group === name);

  const navButton = (tab: NavigationTab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-colors ${
        activeTab === tab
          ? 'bg-white/[0.08] text-white font-semibold'
          : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-3">
        {NAV_META[tab].icon}
        <span>{labelFor(tab)}</span>
      </div>
      {tab === 'inbox' && unreadInboxCount > 0 && (
        <span className="text-xs font-mono text-amber-300">{unreadInboxCount}</span>
      )}
    </button>
  );

  return (
    <aside className="w-64 bg-[#121318] border-r border-white/[0.06] flex flex-col flex-shrink-0 select-none z-20 text-gray-300 font-sans text-sm">

      {/* Workspace */}
      <div className="pt-3 px-4 pb-3 space-y-3">
        <div className="relative">
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.05] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-6 h-6 rounded-full bg-white/10 text-gray-200 flex items-center justify-center text-xs font-bold">
                {isClient ? (currentUser.company?.[0] ?? 'C') : 'A'}
              </div>
              <span className="text-sm font-semibold text-white truncate">
                {isClient ? currentUser.company : settings.workspaceName || 'Alpha work'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </button>

          {workspaceMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-[#1A1B22] border border-white/10 rounded-xl shadow-2xl p-2 space-y-1 animate-slide-up text-sm">
              <div className="text-xs font-mono uppercase text-gray-500 px-2 py-1">Workspace</div>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-brand-500/20 text-white font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="truncate">
                  {isClient ? currentUser.company : settings.workspaceName || 'Alpha work'}
                </span>
              </div>
              <button
                onClick={() => { setActiveTab('settings'); setWorkspaceMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg"
              >
                Settings
              </button>
            </div>
          )}
        </div>

        {/* Quick actions — clients get a request button, staff get search + new issue */}
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

          {!isClient && (
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
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2.5 space-y-5 py-2">
        <div className="space-y-1">{group('primary').map(navButton)}</div>

        {group('workspace').length > 0 && (
          <div className="space-y-1">
            <div className="px-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              {isClient ? 'Your project' : 'Workspace'}
            </div>
            {group('workspace').map(navButton)}
          </div>
        )}

        {group('configure').length > 0 && (
          <div className="space-y-1">
            <div className="px-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Configure
            </div>
            {group('configure').map(navButton)}
          </div>
        )}
      </div>

      {/* Identity + role switcher (demo affordance) */}
      <div className="border-t border-white/[0.06] px-2.5 py-2.5 relative" ref={roleMenuRef}>
        <button
          onClick={() => setRoleMenuOpen(!roleMenuOpen)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-xs font-semibold text-gray-200 flex-shrink-0">
            {currentUser.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white truncate">{currentUser.name}</p>
            <p className="text-[11px] font-mono text-gray-500">{ROLE_LABEL[role]}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        </button>

        {roleMenuOpen && (
          <div className="absolute bottom-full left-2.5 right-2.5 mb-1.5 z-30 bg-[#1A1B22] border border-white/10 rounded-xl shadow-2xl p-2 space-y-0.5 animate-slide-up">
            <div className="text-[11px] font-mono uppercase text-gray-500 px-2.5 py-1.5">
              View as
            </div>
            {(['client', 'dev', 'pm', 'admin'] as UserRole[]).map(r => (
              <button
                key={r}
                onClick={() => { switchRole(r); setRoleMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                  role === r ? 'bg-white/[0.08] text-white' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${role === r ? 'bg-emerald-400' : 'bg-gray-700'}`} />
                {ROLE_LABEL[r]}
              </button>
            ))}
            <p className="text-[11px] text-gray-600 px-2.5 pt-2 pb-1 leading-relaxed border-t border-white/[0.06] mt-1">
              Prototype affordance. Real sessions resolve the role from sign-in.
            </p>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between text-gray-400 text-xs">
        <button
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-2 hover:text-gray-200 transition-colors font-medium"
        >
          <HelpCircle className="w-4 h-4 text-gray-500" />
          <span>Help</span>
        </button>
        <span className="font-mono text-[10px] text-gray-600">v1.5.0</span>
      </div>
    </aside>
  );
};
