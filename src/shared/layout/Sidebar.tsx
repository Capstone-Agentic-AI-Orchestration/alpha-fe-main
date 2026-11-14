import React, { useEffect, useId, useRef, useState } from 'react';
import alphaMarkUrl from '@/assets/alpha-mark.png';
import { navIcon, navLabel, sectionsFor } from '@/config/navigation';
import { useApp } from '@/app/AppContext';
import { NavigationTab, UserRole } from '@/shared/types';
import { CreateWorkspaceModal } from '@/features/settings/CreateWorkspaceModal';
import { SidebarFrame } from './SidebarFrame';
import { projectChatStorageKey } from '@/features/chat/useProjectChatPins';
import { ProjectChatSidebar } from '@/features/chat/ProjectChatSidebar';
import { UsageLimitsPopover } from './UsageLimitsPopover';
import { SidebarSearchResults, useSidebarSearch, type SidebarSearchResult } from './SidebarSearch';
import { sidebarRow } from '@/features/chat/ProjectChatSidebar';
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import {
  ChevronDown,
  Edit3,
  Plus,
  LogOut,
  MessageSquarePlus,
  ArrowLeftRight,
  ChevronsUpDown,
  Palette,
  Settings as SettingsIcon,
  MessageSquare,
  House,
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
    role,
    can,
    currentUser,
    identity,
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    workspaceLoading,
    workspaceSwitching,
    openChatDraft,
    openChatHistory,
    chatThreads,
    switchWorkspace,
    visibleTabs,
    tabs,
    setActiveTabId,
    openNewTab,
    setTabSessionState,
  } = useApp();

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  // Creating is the only way into a workspace from here. Nobody joins one:
  // a project manager puts people in theirs, straight away, as they make it.
  const [createOpen, setCreateOpen] = useState(false);
  const [mode, setModeState] = useState<'home' | 'chat'>(() => loadFromStorage<string>('sidebar_mode', 'home') === 'chat' ? 'chat' : 'home');
  const setMode = (next: 'home' | 'chat') => { setModeState(next); saveToStorage('sidebar_mode', next); };
  const [query, setQuery] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchListId = useId();

  const userName = identity?.login ?? currentUser.name;
  // Prefer the GitHub team role, but keep the active workspace membership as
  // the local fallback. A desktop session without GitHub can still be a PM in
  // its existing workspace and should be able to open the workspace creator;
  // the API remains the final authority when the form is submitted.
  const creatorRole = identity?.role ?? role;
  const canCreateWorkspace = creatorRole === 'pm' || creatorRole === 'admin';
  const workspaceName = activeWorkspace?.name || settings.workspaceName?.trim() || identity?.workspaceOrg || 'Alpha';
  const unifiedChat = role === 'dev' && can('manage_chat') && visibleTabs.includes('chat');
  const shortcutModifier = navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl+';
  const chatStorageKey = projectChatStorageKey(identity?.login ?? currentUser.id, activeWorkspaceId);
  const canManageIssues = can('manage_issues');
  const labelFor = (tab: NavigationTab) => navLabel(tab, role);
  // Navigation and RBAC share one source of truth. A newly added tab cannot
  // become an orphaned page because the sidebar is now derived from the role's
  // section map instead of a second hand-maintained list.
  const visibleTabSet = new Set(visibleTabs);
  const groups = sectionsFor(role)
    .map(group => ({ ...group, items: group.items.filter(item => visibleTabSet.has(item.id)) }))
    .filter(group => group.items.length > 0);
  const chatMode = unifiedChat && mode === 'chat';
  const results = useSidebarSearch(query, unifiedChat);
  const order = chatMode ? ['Chats', 'Pages', 'Tasks', 'Projects'] : ['Pages', 'Tasks', 'Projects', 'Chats'];
  const orderedResults = [...results].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));

  /** Ctrl+K (Cmd+K) focuses this field, opening the sidebar first when it is collapsed. */
  useEffect(() => {
    const onFocusSearch = (event: Event) => {
      event.preventDefault();
      setCollapsed(false);
      setFocusRequest(Date.now());
    };
    window.addEventListener('alpha:focus-sidebar-search', onFocusSearch);
    return () => window.removeEventListener('alpha:focus-sidebar-search', onFocusSearch);
  }, [setCollapsed]);
  useEffect(() => { if (workspaceSwitching) setQuery(''); }, [workspaceSwitching]);

  const navGroup = (group: (typeof groups)[number], compact: boolean, close: () => void) => {
    // Settings lives in the account menu; chat lives in the Chat view.
    const items = group.items.filter(item => item.id !== 'settings' && !(unifiedChat && item.id === 'chat'));
    if (!items.length) return null;
    const label = group.section.label;
    // A one-item section such as Settings already names itself.
    const showLabel = !compact && group.section.id !== 'my_work' && !(items.length === 1 && labelFor(items[0].id) === label);
    return <div key={group.section.id} className={compact ? 'flex flex-col items-center gap-0.5' : 'pt-2 first:pt-0'}>
      {showLabel && <h3 className="flex h-7 items-end px-2 pb-1 text-[11px] font-medium text-content-muted">{label}</h3>}
      {items.map(item => navButton(item.id, compact, close))}
    </div>;
  };

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
    // Return focus to the page rather than leaving it on a menu item that is about to disappear.
    if (collapsed) event?.currentTarget.blur();
  };

  const navButton = (tab: NavigationTab, compact: boolean, closeIfFloating: () => void) => {
    const active = activeTab === tab;
    const label = labelFor(tab);
    const button = (
      <button
        key={tab}
        type="button"
        onClick={() => { setActiveTab(tab); closeIfFloating(); }}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={(compact ? 'grid h-9 w-9 place-items-center rounded-lg transition-colors ' : sidebarRow + ' w-full gap-2.5 ')
          + (active ? 'bg-selected font-medium text-selected-content hover:bg-selected' : 'text-content-secondary hover:bg-surface-high hover:text-content')}
      >
        <span className={active ? 'text-link' : 'text-content-muted'}>{navIcon(tab)}</span>
        {!compact && <span className="truncate">{label}</span>}
      </button>
    );
    if (!compact) return button;
    return (
      <Tooltip key={'nav-' + tab}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  const actionRow = (props: { label: string; icon: React.ReactNode; onClick: () => void; compact: boolean; shortcut?: string; disabled?: boolean; expand?: boolean }) => {
    const button = <button key={props.label} type="button" onClick={props.onClick} disabled={props.disabled} aria-label={props.label}
      data-sidebar-expand={props.expand ? '' : undefined}
      className={(props.compact ? 'grid h-9 w-9 place-items-center rounded-lg text-content-muted hover:bg-surface-high hover:text-content ' : sidebarRow + ' w-full gap-2.5 ') + 'disabled:opacity-40'}>
      <span className="text-content-muted">{props.icon}</span>
      {!props.compact && <span className="truncate">{props.label}</span>}
      {!props.compact && props.shortcut && <kbd className="ml-auto text-[11px] text-content-muted">{props.shortcut}</kbd>}
    </button>;
    if (!props.compact) return button;
    return <Tooltip key={props.label}><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right">{props.label}</TooltipContent></Tooltip>;
  };

  const renderModes = (compact: boolean) => (
    // One segmented control: the open view is filled, the other is a plain icon; names live in tooltips.
    <div role="group" aria-label="Sidebar view"
      className={'inline-flex gap-0.5 rounded-lg border border-divider bg-well p-0.5 ' + (compact ? 'flex-col' : 'items-center self-start')}>
      {([['home', 'Home', House], ['chat', 'Chat', MessageSquare]] as const).map(([id, label, Icon]) => {
        const active = mode === id;
        return <Tooltip key={id}>
          <TooltipTrigger asChild>
            <button type="button" aria-pressed={active} aria-label={label} onClick={() => { setMode(id); setQuery(''); }}
              className={'grid h-7 w-8 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus '
                + (active ? 'bg-selected text-link shadow-sm' : 'text-content-muted hover:bg-surface-high hover:text-content')}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side={compact ? 'right' : 'bottom'}>{label}</TooltipContent>
        </Tooltip>;
      })}
    </div>
  );


  const renderWorkspaceSwitcher = (compact: boolean) => (
    <div ref={workspaceMenuRef} className="relative">
      <div className={`flex items-center ${compact ? 'justify-center' : ''}`}>
        <button
          onClick={() => setWorkspaceMenuOpen(open => !open)}
          className={`flex h-[32px] min-w-0 items-center rounded-lg text-left transition-colors hover:bg-surface-high ${
            compact ? 'w-[36px] justify-center px-0' : 'flex-1 justify-between gap-2 px-1.5'
          }`}
          title={compact ? `${workspaceName} workspace` : undefined}
          aria-label={`Open workspace menu for ${workspaceName}`}
          aria-expanded={workspaceMenuOpen}
        >
          <span className={`flex min-w-0 items-center ${compact ? '' : 'gap-2'}`}>
            <span className="flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-md bg-action dark:bg-surface-raised ring-1 ring-inset ring-content/[0.08]">
              <img
                src={alphaMarkUrl}
                alt=""
                aria-hidden="true"
                className="h-[24px] w-[20px] object-contain"
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

  const openSettings = (section?: string) => {
    if (!visibleTabs.includes('settings')) return;
    const existing = tabs.find(tab => tab.view === 'settings');
    if (existing) {
      if (section) setTabSessionState(existing.id, 'settings.section', section);
      setActiveTabId(existing.id);
    } else openNewTab('settings', section ? { 'settings.section': section } : {});
  };
  const openSettingsRef = useRef(openSettings);
  openSettingsRef.current = openSettings;
  /** Ctrl+, (Cmd+, on macOS) opens Settings in its own tab, as in desktop apps. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key !== ',') return;
      event.preventDefault();
      openSettingsRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const avatar = (size: string) => identity?.avatarUrl
    ? <img src={identity.avatarUrl} alt="" className={size + ' flex-shrink-0 rounded-full border border-divider object-cover'} />
    : <span aria-hidden="true" className={size + ' flex flex-shrink-0 items-center justify-center rounded-full border border-divider bg-surface-raised text-xs font-semibold text-content'}>{userName[0].toUpperCase()}</span>;
  const menuItem = 'gap-2.5 py-2 text-[13px] text-content-secondary focus:text-content';

  /** The account menu holds profile, Settings and Log out, so the footer stays one quiet row. */
  const renderProfileFooter = (compact: boolean, closeIfFloating: () => void) => (
    <div className={'shrink-0 px-2 pb-2 pt-1 ' + (compact ? 'flex justify-center' : '')}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={'Account menu for ' + userName}
            className={'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus data-[state=open]:bg-surface-high '
              + (compact ? 'grid h-9 w-9 place-items-center rounded-full hover:bg-surface-high' : 'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-surface-high')}>
            {avatar('h-7 w-7')}
            {!compact && <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-content">{identity?.name?.trim() || userName}</span>
              <span className="block truncate text-[11px] text-content-muted">{ROLE_LABEL[role]}</span>
            </span>}
            {!compact && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={compact ? 'right' : 'top'} align="start" sideOffset={6} data-sidebar-overlay=""
          className="w-[min(15rem,calc(100vw-1rem))] rounded-xl p-1.5">
          <div className="flex items-center gap-2.5 px-2 py-2">
            {avatar('h-8 w-8')}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-content">{identity?.name?.trim() || userName}</p>
              <p className="truncate text-[11px] text-content-muted">@{userName}</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          {onSwitchProfile && <DropdownMenuItem className={menuItem} onSelect={onSwitchProfile}>
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />Switch profile
          </DropdownMenuItem>}
          {visibleTabs.includes('settings') && <>
            <DropdownMenuItem className={menuItem} onSelect={() => { openSettings('appearance'); closeIfFloating(); }}>
              <Palette className="h-4 w-4" aria-hidden="true" />Appearance
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onSelect={() => { openSettings(); closeIfFloating(); }}>
              <SettingsIcon className="h-4 w-4" aria-hidden="true" />Settings
              <DropdownMenuShortcut>{shortcutModifier},</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>}
          <DropdownMenuSeparator />
          <DropdownMenuItem className={menuItem} disabled={signingOut} onSelect={() => void onSignOut()}>
            <LogOut className="h-4 w-4" aria-hidden="true" />{signingOut ? 'Signing out…' : 'Log out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );


  return (
    <SidebarFrame
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      ariaLabel="Application sidebar"
      expandedWidth={200}
      onBeforeCollapse={() => { closeWorkspaceMenu(); setQuery(''); }}
    >
      {({ compact, closeIfFloating }) => {
        const runResult = (result: SidebarSearchResult) => {
          result.run();
          setQuery('');
          searchRef.current?.blur();
          closeIfFloating();
        };
        return <>
          {/* The switcher shares the tab row (6px down, 32px tall) so neither it
              nor its hover highlight crosses the page panel's top edge at 44px. */}
          <div className={'shrink-0 px-2 pb-2 pt-[6px] ' + (compact ? 'flex flex-col items-center gap-1.5' : 'space-y-2')}>
            {renderWorkspaceSwitcher(compact)}
            {compact
              ? actionRow({ label: 'Search (' + shortcutModifier + 'K)', icon: <Search className="h-4 w-4" />, compact, expand: true,
                  onClick: () => { setCollapsed(false); setFocusRequest(Date.now()); } })
              : <SidebarSearchField inputRef={searchRef} query={query} setQuery={setQuery} focusRequest={focusRequest}
                  listId={searchListId} shortcut={shortcutModifier + 'K'} placeholder="Search" />}
            {unifiedChat && renderModes(compact)}
          </div>

          <div className={'flex min-h-0 flex-1 flex-col overflow-hidden pb-1 ' + (compact ? 'items-center gap-0.5 px-1.5' : 'px-2')}>
            {!compact && query.trim()
              ? <SidebarSearchResults results={orderedResults} inputRef={searchRef} onRun={runResult} listId={searchListId} />
              : chatMode
                ? <>
                    {compact
                      ? actionRow({ label: 'New chat', icon: <MessageSquarePlus className="h-4 w-4" />, compact,
                          disabled: workspaceSwitching || workspaceLoading, onClick: () => { openChatDraft(); closeIfFloating(); } })
                      // New chat and All chats share the top row; history is one step from starting.
                      : <div className="flex shrink-0 items-center gap-1">
                          <button type="button" disabled={workspaceSwitching || workspaceLoading} onClick={() => { openChatDraft(); closeIfFloating(); }}
                            className={sidebarRow + ' min-w-0 flex-1 disabled:opacity-40'}>
                            <MessageSquarePlus className="h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />
                            <span className="truncate">New chat</span>
                          </button>
                          <button type="button" disabled={workspaceSwitching || workspaceLoading} onClick={() => { openChatHistory(); closeIfFloating(); }}
                            aria-label={'All chats, ' + chatThreads.length} title="All chats"
                            className={sidebarRow + ' shrink-0 gap-1 px-1.5 text-xs text-content-muted disabled:opacity-40'}>
                            <span>All chats</span>
                            {chatThreads.length > 0 && <span className="text-[11px] tabular-nums">{chatThreads.length}</span>}
                          </button>
                        </div>}

                    {compact
                      ? actionRow({ label: 'Show chats', icon: <MessageSquare className="h-4 w-4" />, compact, onClick: () => setCollapsed(false) })
                      : !workspaceLoading && !workspaceSwitching && <ProjectChatSidebar key={chatStorageKey} storageKey={chatStorageKey} onNavigate={closeIfFloating} />}
                  </>
                : <>
                    {canManageIssues && actionRow({ label: 'New task', icon: <Edit3 className="h-4 w-4" />, compact, shortcut: 'C', onClick: onOpenNewIssue })}
                    {groups.map(group => navGroup(group, compact, closeIfFloating))}
                  </>}
          </div>

          {role !== 'client' && <UsageLimitsPopover compact={compact} onNavigate={closeIfFloating} />}
          {renderProfileFooter(compact, closeIfFloating)}
          <CreateWorkspaceModal
            isOpen={createOpen}
            onClose={() => setCreateOpen(false)}
            // Staffed already; Settings is where the rest of it is set up.
            onCreated={() => setActiveTab('settings')}
          />
        </>;
      }}
    </SidebarFrame>
  );
};

/** A real search field: typing filters in place, and Ctrl+K focuses it. */
function SidebarSearchField({ inputRef, query, setQuery, focusRequest, listId, shortcut, placeholder }: {
  inputRef: React.RefObject<HTMLInputElement>;
  query: string;
  setQuery: (query: string) => void;
  focusRequest: number;
  listId: string;
  shortcut: string;
  placeholder: string;
}) {
  useEffect(() => {
    if (Date.now() - focusRequest < 1500) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [focusRequest, inputRef]);
  return <label className="flex h-8 items-center gap-2 rounded-lg border border-divider bg-well px-2.5 text-content-muted transition-colors focus-within:border-control focus-within:text-content-secondary">
    <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <input ref={inputRef} type="text" role="combobox" aria-label="Search workspace" aria-autocomplete="list"
      aria-expanded={Boolean(query.trim())} aria-controls={listId} autoComplete="off" spellCheck={false}
      value={query} placeholder={placeholder} onChange={event => setQuery(event.target.value)}
      onKeyDown={event => {
        if (event.key !== 'Escape') return;
        if (query) { event.preventDefault(); setQuery(''); } else event.currentTarget.blur();
      }}
      className="min-w-0 flex-1 bg-transparent text-[13px] text-content outline-none placeholder:text-content-muted" />
    {!query && <kbd className="rounded border border-divider px-1 text-[10px] text-content-muted">{shortcut}</kbd>}
  </label>;
}
