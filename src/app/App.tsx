import React, { useState, useRef, useEffect } from 'react';
import { NAV_ITEMS, navIcon, navLabel } from '@/config/navigation';
import { NoTeamAccess } from '@/features/onboarding/NoTeamAccess';
import { GitHubSetup } from '@/features/onboarding/GitHubSetup';
import { useApp } from '@/app/AppContext';
import { Sidebar } from '@/shared/layout/Sidebar';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { CreateIssueModal } from '@/features/issues/CreateIssueModal';
import { AgentRunModal } from '@/features/runs/AgentRunModal';
import { PrototypeGuide } from '@/features/onboarding/PrototypeGuide';
import { ToastRegion } from '@/shared/components/ToastRegion';
import { DownloadDesktopModal } from '@/shared/components/DownloadDesktopModal';
import { InboxView } from '@/features/inbox/InboxView';
import { ChatView } from '@/features/chat/ChatView';
import { IssuesView } from '@/features/issues/IssuesView';
import { ProjectsView } from '@/features/projects/ProjectsView';
import { AgentsView } from '@/features/agents/AgentsView';
import { SquadsView } from '@/features/squads/SquadsView';
import { AnalyticsView } from '@/features/analytics/AnalyticsView';
import { RuntimesView } from '@/features/runtimes/RuntimesView';
import { SkillsView } from '@/features/skills/SkillsView';
import { DeploymentsView } from '@/features/deployments/DeploymentsView';
import { LiveBuildRoomView } from '@/features/live-build-room/LiveBuildRoomView';
import { SettingsView } from '@/features/settings/SettingsView';
import { ClientPortalView } from '@/features/delivery/ClientPortalView';
import { IntakeWizardView } from '@/features/delivery/IntakeWizardView';
import { DocumentsView } from '@/features/delivery/DocumentsView';
import { NavigationTab } from '@/shared/types';
import { Plus, X, Download } from 'lucide-react';

/**
 * The new-tab picker's list, derived rather than declared.
 *
 * This was a hand-maintained array that had already lost `portal` and
 * `intake` — the two views a client lands on — while the sidebar's own table
 * still had them. One table now, in config/navigation.
 */
const ALL_TABS = NAV_ITEMS;

export const App: React.FC = () => {
  const { activeTab, tabs, activeTabId, setActiveTabId, openNewTab, closeTab, visibleTabs, role,
    identity,
    refreshIdentity,
    localMode,
    continueInLocalMode
  } = useApp();
  const availableTabs = ALL_TABS.filter(t => visibleTabs.includes(t.id));

  // A tab persisted under a different role must not keep its old label in the
  // strip; resolve it the same way the context resolves the rendered view.
  const resolveView = (view: NavigationTab): NavigationTab =>
    visibleTabs.includes(view) ? view : visibleTabs[0];
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
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

  // Rendered smaller here than in the sidebar; the table serves both.
  const getTabIcon = (tab: NavigationTab) => navIcon(tab, 'w-3.5 h-3.5');


  // Client label overrides live with the destination, not in a ternary here.
  const getTabTitle = (tab: NavigationTab) => navLabel(tab, role);


  /**
   * No role from GitHub means no workspace, not an empty one.
   *
   * Checked here rather than inside the shell because `ROLE_TABS[role]` drives
   * navigation and its first entry is the default tab — a role with no tabs
   * renders nothing and reads as a broken build. Only `no_team` blocks; the
   * daemon has already excluded the cases where a missing role means "not yet
   * known" rather than "nobody".
   */
  /**
   * Setup comes before the role check.
   *
   * Without `gh` there is no identity, so there is no role either — showing
   * "you have no team" to someone who has not installed the CLI would send
   * them to an org owner for a problem they can fix themselves in a minute.
   */
  if (!localMode && identity && identity.github && identity.github !== 'ok') {
    return (
      <GitHubSetup
        identity={identity}
        onRetry={refreshIdentity}
        onContinueLocally={continueInLocalMode}
      />
    );
  }

  if (identity?.access === 'no_team') {
    return <NoTeamAccess identity={identity} onRetry={refreshIdentity} />;
  }

  return (
    <div className="flex h-screen w-screen bg-background text-gray-100 font-sans overflow-hidden text-sm">
      {/* Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onOpenNewIssue={() => setCreateIssueOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="relative flex-1 min-w-0 bg-shell overflow-hidden">
        {/* Floating workspace toolbar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="pointer-events-auto mx-auto flex w-full max-w-[1800px] items-center gap-1.5 rounded-2xl border border-white/[0.10] bg-surface-200/80 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/[0.04]">
            {/* Scrollable Open Tabs List */}
            <div
              role="tablist"
              aria-label="Open workspace tabs"
              className="workspace-tab-strip flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar"
            >
            {tabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setActiveTabId(tab.id);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      closeTab(tab.id);
                    }
                  }}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  title={getTabTitle(resolveView(tab.view))}
                  className={`group flex h-9 min-w-[112px] max-w-[220px] cursor-pointer select-none items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all ${
                    isActive
                      ? 'border-brand-400/30 bg-brand-500/15 text-white shadow-sm'
                      : 'border-transparent text-gray-500 hover:bg-white/[0.05] hover:text-gray-200'
                  }`}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-400'}`}>
                    {getTabIcon(resolveView(tab.view))}
                  </span>
                  <span className="truncate flex-1 text-left">{getTabTitle(resolveView(tab.view))}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="rounded-md p-1 text-gray-500 opacity-0 transition-all hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100"
                      title="Close tab"
                      aria-label={`Close ${getTabTitle(resolveView(tab.view))} tab`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            </div>

            {/* New Tab Button & Dropdown Picker */}
            <div className="relative flex-shrink-0" ref={newTabMenuRef}>
              <button
                onClick={() => setNewTabMenuOpen(prev => !prev)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  newTabMenuOpen
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                }`}
                title="Open new tab"
                aria-label="Open new tab"
                aria-expanded={newTabMenuOpen}
                aria-haspopup="menu"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* New Tab Dropdown Menu */}
              {newTabMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-1 rounded-2xl border border-white/[0.10] bg-surface p-2 shadow-2xl animate-slide-up"
                >
                  <div className="px-2.5 py-1 text-xs font-medium text-gray-500">
                    Open new tab
                  </div>
                  <div className="max-h-80 space-y-0.5 overflow-y-auto">
                    {availableTabs.map((item) => {
                      return (
                        <button
                          key={item.id}
                          role="menuitem"
                          onClick={() => {
                            openNewTab(item.id);
                            setNewTabMenuOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-xl p-2 text-left text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex-shrink-0 p-1 text-gray-500">
                              {navIcon(item.id)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium">{item.title}</div>
                              <div className="truncate text-[10px] text-gray-500">{item.subtitle}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Actions */}
            <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 pl-1">
              <div className="hidden h-6 w-px bg-white/[0.08] sm:block" aria-hidden="true" />
              <button
                onClick={() => setDownloadModalOpen(true)}
                className="flex h-9 items-center gap-2 rounded-xl border border-brand-400/30 bg-brand-500/15 px-2.5 text-xs font-semibold text-brand-600 transition-all hover:bg-brand-500/25 hover:text-brand-700 dark:text-brand-100 dark:hover:text-white sm:px-3"
                title="Download desktop app (.exe)"
                aria-label="Download desktop app (.exe)"
              >
                <Download className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                <span className="hidden sm:inline">Desktop App (.exe)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic View Content */}
        <main className="relative h-full overflow-hidden pt-16 sm:pt-20">
          {activeTab === 'portal' && <ClientPortalView />}
          {activeTab === 'intake' && <IntakeWizardView />}
          {activeTab === 'documents' && <DocumentsView />}
          {activeTab === 'inbox' && <InboxView />}
          {activeTab === 'chat' && <ChatView />}
          {activeTab === 'issues' && <IssuesView onOpenNewIssue={() => setCreateIssueOpen(true)} />}
          {activeTab === 'projects' && <ProjectsView onOpenNewIssue={() => setCreateIssueOpen(true)} />}
          {activeTab === 'agents' && <AgentsView />}
          {activeTab === 'squads' && <SquadsView />}
          {activeTab === 'live_build_room' && <LiveBuildRoomView />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'runtimes' && <RuntimesView />}
          {activeTab === 'skills' && <SkillsView />}
          {activeTab === 'deployments' && <DeploymentsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global ⌘K Command Palette */}
      <CommandPalette />

      {/* Create issue */}
      <CreateIssueModal
        isOpen={createIssueOpen}
        onClose={() => setCreateIssueOpen(false)}
      />

      <DownloadDesktopModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />

      <AgentRunModal />
      <PrototypeGuide />
      <ToastRegion />
    </div>
  );
};

export default App;
