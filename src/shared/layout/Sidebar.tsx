import React, { useState } from 'react';
import { navIcon, navLabel, sectionsFor } from '@/config/navigation';
import { useApp } from '@/app/AppContext';
import { NavigationTab, UserRole } from '@/shared/types';
import { CreateWorkspaceModal } from '@/features/settings/CreateWorkspaceModal';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  HelpCircle,
  Plus,
  LogOut,
  Check,
  Search,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onOpenNewIssue: () => void;
  onSignOut: () => Promise<void> | void;
}

const ROLE_LABEL: Record<UserRole, string> = {
  client: 'Client',
  dev: 'Developer',
  pm: 'Project Manager',
  admin: 'Admin',
};

export const Sidebar: React.FC<SidebarProps> = ({
  onSignOut,
  collapsed,
  setCollapsed,
  onOpenNewIssue,
}) => {
  const {
    activeTab,
    setActiveTab,
    unreadInboxCount,
    settings,
    setCommandPaletteOpen,
    role,
    can,
    currentUser,
    identity,
    workspaces,
    activeWorkspace,
    workspaceLoading,
    switchWorkspace,
    visibleTabs,
  } = useApp();

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  // Creating is the only way into a workspace from here. Nobody joins one:
  // a project manager puts people in theirs, straight away, as they make it.
  const [createOpen, setCreateOpen] = useState(false);

  const userName = identity?.login ?? currentUser.name;
  // The GitHub team, not the open workspace's role: a PM can make someone a
  // `pm` inside a workspace, and that must not also let them create workspaces.
  const canCreateWorkspace = identity?.role === 'pm' || identity?.role === 'admin';
  const workspaceName = activeWorkspace?.name || settings.workspaceName?.trim() || identity?.workspaceOrg || 'Alpha';
  const canManageIssues = can('manage_issues');
  const labelFor = (tab: NavigationTab) => navLabel(tab, role);
  // Navigation and RBAC share one source of truth. A newly added tab cannot
  // become an orphaned page because the sidebar is now derived from the role's
  // section map instead of a second hand-maintained list.
  const visibleTabSet = new Set(visibleTabs);
  const groups = sectionsFor(role)
    .map(group => ({ ...group, items: group.items.filter(item => visibleTabSet.has(item.id)) }))
    .filter(group => group.items.length > 0);

  const navButton = (tab: NavigationTab) => {
    const active = activeTab === tab;
    const label = labelFor(tab);

    return (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        title={collapsed ? label : undefined}
        aria-label={label}
        className={`group relative flex w-full items-center rounded-lg transition-colors ${
          collapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2'
        } ${
          active
            ? 'bg-brand-500/15 font-semibold text-gray-100 ring-1 ring-inset ring-white/[0.06]'
            : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-100'
        }`}
      >
        <span
          className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} ${
            active ? 'text-brand-300' : 'text-gray-500 group-hover:text-gray-300'
          }`}
        >
          {navIcon(tab)}
          <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
        </span>
        {tab === 'inbox' && unreadInboxCount > 0 && (
          collapsed ? (
            <span
              className="absolute ml-6 mt-[-18px] h-1.5 w-1.5 rounded-full bg-amber-300"
              title={`${unreadInboxCount} unread`}
            />
          ) : (
            <span className="text-xs font-medium tabular-nums text-amber-300">
              {unreadInboxCount}
            </span>
          )
        )}
      </button>
    );
  };

  return (
    <aside
      className={`z-20 flex h-full flex-shrink-0 select-none flex-col border-r border-white/[0.08] bg-shell/95 font-sans text-sm text-gray-300 backdrop-blur-xl transition-[width] duration-200 ease-out ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Workspace and primary actions */}
      <div className={`space-y-3 pb-3 pt-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div className="relative">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWorkspaceMenuOpen(open => !open)}
              className={`flex min-w-0 items-center rounded-lg py-1.5 text-left transition-colors hover:bg-white/[0.04] ${
                collapsed ? 'w-9 justify-center px-0' : 'flex-1 justify-between px-2'
              }`}
              title={collapsed ? `${workspaceName} workspace` : undefined}
              aria-label={collapsed ? `${workspaceName} workspace menu` : 'Open workspace menu'}
              aria-expanded={workspaceMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white/[0.08] text-xs font-semibold text-gray-200">
                    {workspaceName.slice(0, 1).toUpperCase()}
                </span>
                {!collapsed && (
                  <span className="truncate text-sm font-semibold text-white">
                    {workspaceName}
                  </span>
                )}
              </span>
              {!collapsed && <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" />}
            </button>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-gray-200"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {workspaceMenuOpen && (
            <div
              className={`absolute top-full z-30 mt-1.5 space-y-1 rounded-xl border border-white/[0.08] bg-surface p-2 text-sm shadow-2xl animate-slide-up ${
                collapsed ? 'left-0 w-56' : 'left-0 right-0'
              }`}
            >
              <div className="px-2 py-1 text-xs font-medium text-gray-500">Workspaces</div>
              {workspaceLoading && workspaces.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-500">Loading workspaces…</div>
              ) : (
                <div className="space-y-0.5">
                  {workspaces.map(workspace => (
                    <button
                      key={workspace.id}
                      onClick={() => {
                        void switchWorkspace(workspace.id);
                        setWorkspaceMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                    >
                      <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ${workspace.id === activeWorkspace?.id ? 'bg-brand-500/20 text-brand-300' : 'bg-white/[0.07] text-gray-400'}`}>
                        {workspace.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                      {workspace.id === activeWorkspace?.id && <Check className="h-3.5 w-3.5 text-brand-300" />}
                    </button>
                  ))}
                </div>
              )}
              {/* Project managers and admins, by GitHub team; the creator
                  joins at that role. Offering it to anyone else was a
                  button whose only outcome was a 403. */}
              {canCreateWorkspace && (
                <div className="mt-1.5 grid grid-cols-1 gap-1 border-t border-white/[0.06] pt-2">
                  <button
                    onClick={() => {
                      setCreateOpen(true);
                      setWorkspaceMenuOpen(false);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs text-gray-400 hover:bg-white/[0.05] hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setWorkspaceMenuOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/[0.04] hover:text-white"
              >
                Settings
              </button>
            </div>
          )}
        </div>

        <div className={`space-y-1.5 pt-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className={`flex rounded-lg text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-gray-200 ${
              collapsed ? 'h-9 w-9 items-center justify-center' : 'w-full items-center justify-between px-3 py-2'
            }`}
            title={collapsed ? 'Search (⌘ K)' : undefined}
            aria-label="Search"
          >
            <span className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
              <Search className="h-4 w-4 text-gray-500" />
              <span className={collapsed ? 'sr-only' : undefined}>Search...</span>
            </span>
            {!collapsed && <kbd className="px-1.5 py-0.5 text-[11px] text-gray-500">⌘ K</kbd>}
          </button>

          {canManageIssues && (
            <button
              onClick={onOpenNewIssue}
              className={`flex rounded-lg text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-gray-200 ${
                collapsed ? 'h-9 w-9 items-center justify-center' : 'w-full items-center justify-between px-3 py-2'
              }`}
              title={collapsed ? 'New issue' : undefined}
              aria-label="New issue"
            >
              <span className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                <Edit3 className="h-4 w-4 text-gray-500" />
                <span className={collapsed ? 'sr-only' : undefined}>New Issue</span>
              </span>
              {!collapsed && <kbd className="px-2 py-0.5 text-[11px] text-gray-500">C</kbd>}
            </button>
          )}
        </div>
      </div>

      {/* Main navigation */}
      <div className={`flex-1 space-y-4 overflow-y-auto py-2 ${collapsed ? 'px-1.5' : 'px-2'}`}>
        {groups.map(({ section, items }) => (
          <div key={section.id} className="space-y-0.5 border-t border-white/[0.05] pt-3 first:border-t-0 first:pt-0">
            <div className={collapsed ? 'sr-only' : 'mb-1 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500'}>
              <span>{section.label}</span>
              <span className="h-px flex-1 bg-white/[0.05]" aria-hidden="true" />
            </div>
            {items.map(item => navButton(item.id))}
          </div>
        ))}
      </div>

      {/*
        Identity, and the way out of it. The role is the one the server
        assigned; it is shown, not chosen. Signing out was reachable only from
        the developer download page, so everyone already inside a workspace --
        every project manager, admin and client -- had no way to leave it.
      */}
      <div className={`border-t border-white/[0.06] py-2.5 ${collapsed ? 'px-1.5' : 'px-2.5'}`}>
        <div
          className={`flex w-full items-center py-2 ${
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
          }`}
          title={collapsed ? `${userName} · ${ROLE_LABEL[role]}` : undefined}
        >
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-xs font-semibold text-gray-200"
            aria-hidden="true"
          >
            {userName[0].toUpperCase()}
          </span>
          <span className={collapsed ? 'sr-only' : 'min-w-0 flex-1'}>
            <span className="block truncate text-xs text-white">{userName}</span>
            <span className="block text-[11px] text-gray-500">{ROLE_LABEL[role]}</span>
          </span>
          {!collapsed && (
            <button
              onClick={() => void onSignOut()}
              className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/[0.05] hover:text-gray-200"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={() => void onSignOut()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.05] hover:text-gray-200"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={`border-t border-white/[0.06] py-2.5 text-xs text-gray-400 ${collapsed ? 'px-1.5' : 'px-4'}`}>
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
          <button
            onClick={() => window.dispatchEvent(new Event('alpha:open-prototype-guide'))}
            className={`flex items-center rounded-lg font-medium transition-colors hover:bg-white/[0.04] hover:text-gray-200 ${
              collapsed ? 'h-9 w-9 justify-center' : 'gap-2'
            }`}
            title={collapsed ? 'Prototype guide' : undefined}
            aria-label="Open prototype guide"
          >
            <HelpCircle className="h-4 w-4 text-gray-500" />
            <span className={collapsed ? 'sr-only' : undefined}>Prototype guide</span>
          </button>
          <span className="font-mono text-[10px] font-medium text-brand-400">{collapsed ? '2.0' : 'v2.0.0'}</span>
        </div>
      </div>
      <CreateWorkspaceModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        // Staffed already; Settings is where the rest of it is set up.
        onCreated={() => setActiveTab('settings')}
      />
    </aside>
  );
};
