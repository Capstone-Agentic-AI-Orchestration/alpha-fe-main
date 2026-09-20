import React, { useState, useRef, useEffect } from 'react';
import { navItem, navIcon, navLabel } from '@/config/navigation';
import { useApp } from '@/app/AppContext';
import { NavigationTab, UserRole } from '@/shared/types';
import { Search, Edit3, ChevronDown, HelpCircle, Sun, Moon, Plus, Loader2 } from 'lucide-react';
import { useTheme } from '@/shared/hooks/useTheme';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onOpenNewIssue: () => void;
}

/**
 * The navigation table used to be duplicated here.
 *
 * Labels, icons and grouping lived in a `NAV_META` record that App.tsx
 * mirrored in three more places, and they had already drifted — App.tsx knew
 * nothing about `portal` or `intake`. All four now read config/navigation.
 */
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
    currentUser,
    identity,
    roleIsOverridden,
    workspaces,
    activeWorkspace,
    switchWorkspace,
    createWorkspace,
    workspaceSwitching,
    showToast
  } = useApp();

  const { theme, toggle: toggleTheme } = useTheme();

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
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

  /**
   * What this workspace is actually called.
   *
   * Defaulted to "Multica Alpha Workspace" — a product this is not — seeded
   * from mockData and shown to everyone who never opened Settings. The
   * organisation the daemon derived from the attached repositories is a true
   * answer and needs no configuring.
   */
  const workspaceName =
    activeWorkspace?.name || settings.workspaceName?.trim() || identity?.workspaceOrg || 'Alpha';

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name || creatingWorkspace) return;
    setCreatingWorkspace(true);
    try {
      await createWorkspace(name);
      setNewWorkspaceName('');
      setWorkspaceMenuOpen(false);
    } catch (error) {
      showToast('Workspace not created', error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const isClient = role === 'client';
  const labelFor = (tab: NavigationTab) => navLabel(tab, role);

  const group = (name: 'primary' | 'workspace' | 'configure') =>
    visibleTabs.filter(t => navItem(t).group === name);

  const navButton = (tab: NavigationTab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md border-l-2 transition-colors ${
        activeTab === tab
          ? 'border-brand-400 bg-white/[0.035] text-white font-medium'
          : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.025]'
      }`}
    >
      <div className="flex items-center gap-3">
        {navIcon(tab)}
        <span>{labelFor(tab)}</span>
      </div>
      {tab === 'inbox' && unreadInboxCount > 0 && (
        <span className="text-xs tabular-nums text-amber-300 font-medium">{unreadInboxCount}</span>
      )}
    </button>
  );

  return (
    <aside className="w-60 bg-shell border-r border-white/[0.06] flex flex-col flex-shrink-0 select-none z-20 text-gray-300 font-sans text-sm">

      {/* Workspace */}
      <div className="pt-3 px-3 pb-3 space-y-3">
        <div className="relative">
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/[0.035] transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-6 h-6 rounded-md bg-white/[0.07] text-gray-300 flex items-center justify-center text-xs font-semibold">
                {(workspaceName[0] ?? 'A').toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-white truncate">
                {workspaceName}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </button>

          {workspaceMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-surface border border-white/[0.08] rounded-lg shadow-2xl p-2 space-y-1 animate-slide-up text-sm">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">Workspaces</div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {workspaces.map(workspace => (
                  <button
                    key={workspace.id}
                    onClick={() => {
                      void switchWorkspace(workspace.id);
                      setWorkspaceMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
                      workspace.id === activeWorkspace?.id
                        ? 'bg-white/[0.06] text-white font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.035]'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${workspace.id === activeWorkspace?.id ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    <span className="truncate">{workspace.name}</span>
                    {workspace.id === activeWorkspace?.id && workspaceSwitching && (
                      <Loader2 className="w-3 h-3 ml-auto animate-spin text-gray-500" />
                    )}
                  </button>
                ))}
              </div>
              <form onSubmit={handleCreateWorkspace} className="pt-1 mt-1 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <input
                    value={newWorkspaceName}
                    onChange={event => setNewWorkspaceName(event.target.value)}
                    placeholder="New workspace"
                    className="min-w-0 flex-1 bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-brand-400/50"
                  />
                  <button
                    type="submit"
                    disabled={!newWorkspaceName.trim() || creatingWorkspace}
                    className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-40"
                    title="Create workspace"
                  >
                    {creatingWorkspace ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </form>
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setWorkspaceMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/[0.035] rounded-md"
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
            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/[0.035] text-gray-400 hover:text-gray-200 transition-colors text-sm"
          >
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-500" />
              <span>Search...</span>
            </div>
            <kbd className="text-[11px] text-gray-500 px-1.5 py-0.5">
              ⌘ K
            </kbd>
          </button>

          {!isClient && (
            <button
              onClick={onOpenNewIssue}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/[0.035] text-gray-400 hover:text-gray-200 transition-colors text-sm"
            >
              <div className="flex items-center gap-3">
                <Edit3 className="w-4 h-4 text-gray-500" />
                <span>New Issue</span>
              </div>
              <kbd className="text-[11px] text-gray-500 px-2 py-0.5">
                C
              </kbd>
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-5 py-2">
        <div className="space-y-1">{group('primary').map(navButton)}</div>

        {group('workspace').length > 0 && (
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-medium text-gray-600 mb-1.5">
              {isClient ? 'Your project' : 'Workspace'}
            </div>
            {group('workspace').map(navButton)}
          </div>
        )}

        {group('configure').length > 0 && (
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-medium text-gray-600 mb-1.5">
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
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.035] transition-colors text-left"
        >
          {/*
            Who you actually are.
            
            This read `currentUser`, which is picked from a mock array by
            whichever role the switcher is on — so the footer showed a person
            who does not exist while the daemon knew perfectly well it was
            talking to a GitHub account. `identity` is that account; the mock
            remains only as the fallback for a machine with no gh at all.
          */}
          <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-xs font-semibold text-gray-200 flex-shrink-0">
            {(identity?.login ?? currentUser.name)[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white truncate">{identity?.login ?? currentUser.name}</p>
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <span>{ROLE_LABEL[role]}</span>
              {/*
                Say when the role is not the one GitHub gave you. Without it the
                footer asserts a persona you are only borrowing.
              */}
              {roleIsOverridden && <span className="text-amber-500/80">· viewing as</span>}
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        </button>

        {roleMenuOpen && (
          <div className="absolute bottom-full left-2.5 right-2.5 mb-1.5 z-30 bg-surface border border-white/[0.08] rounded-lg shadow-2xl p-2 space-y-0.5 animate-slide-up">
            <div className="text-xs font-medium text-gray-500 px-2.5 py-1.5">
              View as
            </div>
            {(['client', 'dev', 'pm', 'admin'] as UserRole[]).map(r => (
              <button
                key={r}
                onClick={() => { switchRole(r); setRoleMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-xs transition-colors ${
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
          onClick={() => window.dispatchEvent(new Event('alpha:open-prototype-guide'))}
          className="flex items-center gap-2 hover:text-gray-200 transition-colors font-medium"
        >
          <HelpCircle className="w-4 h-4 text-gray-500" />
          <span>Prototype guide</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-1 rounded hover:bg-white/[0.06] hover:text-gray-200 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <span className="font-mono text-[10px] text-brand-400 font-medium">v2.0.0</span>
        </div>
      </div>
    </aside>
  );
};
