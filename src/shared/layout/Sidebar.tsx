import React, { useEffect, useRef, useState } from 'react';
import alphaMarkUrl from '@/assets/alpha-mark.png';
import { navIcon, navLabel, sectionsFor } from '@/config/navigation';
import { useApp } from '@/app/AppContext';
import { NavigationTab, UserRole } from '@/shared/types';
import { CreateWorkspaceModal } from '@/features/settings/CreateWorkspaceModal';
import { SidebarFrame } from './SidebarFrame';
import {
  ChevronDown,
  Edit3,
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
  signingOut?: boolean;
  onSwitchProfile?: () => void;
}

const ROLE_LABEL: Record<UserRole, string> = {
  client: 'Client',
  dev: 'Developer',
  pm: 'Project Manager',
  admin: 'Admin',
};

export const Sidebar: React.FC<SidebarProps> = ({
  onSignOut,
  signingOut = false,
  collapsed,
  setCollapsed,
  onOpenNewIssue,
  onSwitchProfile,
}) => {
  const {
    activeTab,
    setActiveTab,
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
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  // Creating is the only way into a workspace from here. Nobody joins one:
  // a project manager puts people in theirs, straight away, as they make it.
  const [createOpen, setCreateOpen] = useState(false);

  const userName = identity?.login ?? currentUser.name;
  // Prefer the GitHub team role, but keep the active workspace membership as
  // the local fallback. A desktop session without GitHub can still be a PM in
  // its existing workspace and should be able to open the workspace creator;
  // the API remains the final authority when the form is submitted.
  const creatorRole = identity?.role ?? role;
  const canCreateWorkspace = creatorRole === 'pm' || creatorRole === 'admin';
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

  /**
   * The workspace switcher is a transient surface. Close it when focus moves
   * away or the user presses Escape, so it cannot remain stranded over the
   * content after the rail collapses or another role changes the navigation.
   */
  useEffect(() => {
    if (!workspaceMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !workspaceMenuRef.current?.contains(target)) {
        setWorkspaceMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWorkspaceMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [workspaceMenuOpen]);

  const closeWorkspaceMenu = (event?: React.SyntheticEvent<HTMLElement>) => {
    setWorkspaceMenuOpen(false);
    // When the rail is in hover mode, a focused menu item must not keep the
    // entire sidebar expanded after the action is complete.
    if (collapsed) event?.currentTarget.blur();
  };

  const navButton = (tab: NavigationTab, compact: boolean) => {
    const active = activeTab === tab;
    const label = labelFor(tab);

    return (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        title={compact ? label : undefined}
        aria-label={label}
        className={`group relative flex w-full items-center rounded-lg transition-colors ${
          compact ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2'
        } ${
          active
            ? 'bg-selected font-semibold text-selected-content ring-1 ring-inset ring-content/[0.06]'
            : 'text-content-secondary hover:bg-surface-high hover:text-content'
        }`}
      >
        <span
          className={`flex items-center ${compact ? 'justify-center' : 'gap-3'} ${
            active ? 'text-link' : 'text-content-muted group-hover:text-content-secondary'
          }`}
        >
          {navIcon(tab)}
          <span
            className={`sidebar-label ${compact ? 'sidebar-label--hidden' : 'sidebar-label--visible'}`}
          >
            {label}
          </span>
        </span>
      </button>
    );
  };

  const renderWorkspaceSwitcher = (compact: boolean) => (
    <div ref={workspaceMenuRef} className="relative">
      <div className={`flex items-center ${compact ? 'justify-center' : ''}`}>
        <button
          onClick={() => setWorkspaceMenuOpen(open => !open)}
          className={`flex min-w-0 items-center rounded-lg py-1.5 text-left transition-colors hover:bg-surface-high ${
            compact ? 'w-9 justify-center px-0' : 'flex-1 justify-between gap-2 px-2'
          }`}
          title={compact ? `${workspaceName} workspace` : undefined}
          aria-label={`Open workspace menu for ${workspaceName}`}
          aria-expanded={workspaceMenuOpen}
        >
          <span className={`flex min-w-0 items-center ${compact ? '' : 'gap-2'}`}>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-action dark:bg-surface-raised ring-1 ring-inset ring-content/[0.08]">
              <img
                src={alphaMarkUrl}
                alt=""
                aria-hidden="true"
                className="h-7 w-6 object-contain"
              />
            </span>
            <span
              className={`sidebar-label ${compact ? 'sidebar-label--hidden' : 'sidebar-label--visible'} truncate text-sm font-semibold text-content`}
            >
              {workspaceName}
            </span>
          </span>
          {!compact && <ChevronDown className="h-4 w-4 flex-shrink-0 text-content-muted" />}
        </button>
      </div>

      {workspaceMenuOpen && (
        <div
          role="menu"
          aria-label="Workspaces"
          className={`absolute top-full z-30 mt-1.5 max-h-[min(28rem,calc(100vh-6rem))] space-y-1 overflow-y-auto rounded-xl border border-divider bg-surface p-2 text-sm shadow-2xl animate-slide-up no-scrollbar ${
            compact ? 'left-0 w-56' : 'left-0 right-0'
          }`}
        >
          <div className="px-2 py-1 text-xs font-medium text-content-muted">Workspaces</div>
          {workspaceLoading && workspaces.length === 0 ? (
            <div className="px-3 py-3 text-xs text-content-muted">Loading workspaces…</div>
          ) : (
            <div className="space-y-0.5">
              {workspaces.map(workspace => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    void switchWorkspace(workspace.id);
                    closeWorkspaceMenu();
                  }}
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-content-secondary transition-colors hover:bg-surface-high hover:text-content"
                >
                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ${workspace.id === activeWorkspace?.id ? 'bg-selected text-selected-content' : 'bg-surface-raised text-content-secondary'}`}>
                    {workspace.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {workspace.id === activeWorkspace?.id && <Check className="h-3.5 w-3.5 text-link" />}
                </button>
              ))}
            </div>
          )}
          {/* Project managers and admins, by GitHub team; the creator
              joins at that role. Offering it to anyone else was a
              button whose only outcome was a 403. */}
          {canCreateWorkspace && (
            <div className="mt-1.5 grid grid-cols-1 gap-1 border-t border-divider pt-2">
              <button
                onClick={() => {
                  setCreateOpen(true);
                  closeWorkspaceMenu();
                }}
                role="menuitem"
                className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs text-content-secondary hover:bg-surface-high hover:text-content"
              >
                <Plus className="h-3.5 w-3.5" /> Add workspace
              </button>
            </div>
          )}
          <button
            onClick={() => {
              setActiveTab('settings');
              closeWorkspaceMenu();
            }}
            role="menuitem"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-content-secondary hover:bg-surface-high hover:text-content"
          >
            Settings
          </button>
        </div>
      )}
    </div>
  );

  const renderProfileFooter = (compact: boolean) => (
    <div className="border-t border-divider px-2 py-2.5">
      <div className={`flex items-center ${compact ? 'justify-center' : 'gap-2'}`}>
        {onSwitchProfile ? (
          <button
            type="button"
            onClick={onSwitchProfile}
            className={`flex min-w-0 items-center rounded-lg text-left transition hover:bg-surface-high focus-visible:ring-2 focus-visible:ring-focus ${compact ? 'h-9 w-9 justify-center' : 'flex-1 gap-2.5 px-1.5 py-1'}`}
            title={`Switch GitHub profile · ${userName}`}
            aria-label={`Switch GitHub profile. Currently ${userName}`}
          >
            {identity?.avatarUrl ? (
              <img src={identity.avatarUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-full border border-divider object-cover" />
            ) : (
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-divider bg-surface-raised text-xs font-semibold text-content"
                aria-hidden="true"
              >
                {userName[0].toUpperCase()}
              </span>
            )}
            <span
              className={`sidebar-label ${compact ? 'sidebar-label--hidden' : 'sidebar-label--visible min-w-0 flex-1'}`}
            >
              <span className="block truncate text-xs text-content">{userName}</span>
              <span className="block truncate text-[11px] text-content-muted">{ROLE_LABEL[role]} · Switch profile</span>
            </span>
          </button>
        ) : (
          <div
            className={`flex min-w-0 items-center ${compact ? 'h-9 w-9 justify-center' : 'flex-1 gap-2.5 px-1.5'}`}
            title={`${userName} · ${ROLE_LABEL[role]}`}
            aria-label={`${userName}, ${ROLE_LABEL[role]}`}
          >
            {identity?.avatarUrl ? (
              <img src={identity.avatarUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-full border border-divider object-cover" />
            ) : (
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-divider bg-surface-raised text-xs font-semibold text-content"
                aria-hidden="true"
              >
                {userName[0].toUpperCase()}
              </span>
            )}
            <span
              className={`sidebar-label ${compact ? 'sidebar-label--hidden' : 'sidebar-label--visible min-w-0 flex-1'}`}
            >
              <span className="block truncate text-xs text-content">{userName}</span>
              <span className="block text-[11px] text-content-muted">{ROLE_LABEL[role]}</span>
            </span>
          </div>
        )}
        {!compact && (
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={signingOut}
            aria-busy={signingOut}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-surface-high hover:text-content focus-visible:ring-2 focus-visible:ring-focus"
            title={signingOut ? 'Signing out…' : 'Sign out'}
            aria-label={signingOut ? 'Signing out' : 'Sign out'}
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
      {!compact && <div className="mt-1 px-1.5 text-right font-mono text-[10px] text-content-muted">v2.0.0</div>}
    </div>
  );

  return (
    <SidebarFrame
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      ariaLabel="Application sidebar"
      onBeforeCollapse={() => closeWorkspaceMenu()}
    >
      {({ compact }) => (
        <>
          {/* Workspace and primary actions */}
          <div className="space-y-3 px-2 pb-3 pt-3">
            {renderWorkspaceSwitcher(compact)}

            <div className={`space-y-1.5 pt-1 ${compact ? 'flex flex-col items-center' : ''}`}>
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className={`flex rounded-lg text-content-secondary transition-colors hover:bg-surface-high hover:text-content ${
                  compact ? 'h-9 w-9 items-center justify-center' : 'w-full items-center justify-between px-3 py-2'
                }`}
                title={compact ? 'Search (⌘ K)' : undefined}
                aria-label="Search"
              >
                <span className={`flex items-center ${compact ? 'justify-center' : 'gap-3'}`}>
                  <Search className="h-4 w-4 text-content-muted" />
                  <span
                    className={`sidebar-label ${compact ? 'sidebar-label--hidden' : 'sidebar-label--visible'}`}
                  >
                    Search...
                  </span>
                </span>
                {!compact && <kbd className="px-1.5 py-0.5 text-[11px] text-content-muted">⌘ K</kbd>}
              </button>

              {canManageIssues && (
                <button
                  onClick={onOpenNewIssue}
                  className={`flex rounded-lg text-content-secondary transition-colors hover:bg-surface-high hover:text-content ${
                    compact ? 'h-9 w-9 items-center justify-center' : 'w-full items-center justify-between px-3 py-2'
                  }`}
                  title={compact ? 'New task' : undefined}
                  aria-label="New task"
                >
                  <span className={`flex items-center ${compact ? 'justify-center' : 'gap-3'}`}>
                    <Edit3 className="h-4 w-4 text-content-muted" />
                    <span
                      className={`sidebar-label ${compact ? 'sidebar-label--hidden' : 'sidebar-label--visible'}`}
                    >
                      New Task
                    </span>
                  </span>
                  {!compact && <kbd className="px-2 py-0.5 text-[11px] text-content-muted">C</kbd>}
                </button>
              )}
            </div>
          </div>

          {/* Main navigation */}
          <div className={`no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto py-2 ${compact ? 'px-1.5' : 'px-2'}`}>
            {groups.map(({ section, items }) => (
              <div key={section.id} className="space-y-0.5 border-t border-divider pt-3 first:border-t-0 first:pt-0">
                <div className={compact ? 'sr-only' : 'mb-1 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-muted'}>
                  <span>{section.label}</span>
                  <span className="h-px flex-1 bg-surface-raised" aria-hidden="true" />
                </div>
                {items.map(item => navButton(item.id, compact))}
              </div>
            ))}
          </div>

          {renderProfileFooter(compact)}
          <CreateWorkspaceModal
            isOpen={createOpen}
            onClose={() => setCreateOpen(false)}
            // Staffed already; Settings is where the rest of it is set up.
            onCreated={() => setActiveTab('settings')}
          />
        </>
      )}
    </SidebarFrame>
  );
};
