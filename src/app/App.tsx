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
import { SettingsView } from '@/features/settings/SettingsView';
import { ClientPortalView } from '@/features/delivery/ClientPortalView';
import { IntakeWizardView } from '@/features/delivery/IntakeWizardView';
import { DocumentsView } from '@/features/delivery/DocumentsView';
import { BillingView } from '@/features/delivery/BillingView';
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
    refreshIdentity
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
  if (identity && identity.github && identity.github !== 'ok') {
    return <GitHubSetup identity={identity} onRetry={refreshIdentity} />;
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
      <div className="flex-1 flex flex-col min-w-0 bg-[#121315] overflow-hidden">
        {/* Tab bar */}
        <div className="h-10 bg-[#101113] border-b border-white/[0.06] flex items-center px-3 z-20 relative">
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
                  className={`group flex h-10 items-center gap-2 px-3 text-xs font-medium cursor-pointer transition-colors border-b select-none max-w-[200px] min-w-[110px] ${
                    isActive
                      ? 'border-brand-400 text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-200'
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
              className={`p-1.5 rounded-md transition-colors ${
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
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#191A1D] border border-white/[0.08] rounded-lg shadow-2xl p-2 z-50 animate-slide-up space-y-1">
                <div className="text-xs font-medium text-gray-500 px-2.5 py-1">
                  Open New Tab
                </div>
                <div className="max-h-80 overflow-y-auto space-y-0.5">
                  {availableTabs.map((item) => {
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          openNewTab(item.id);
                          setNewTabMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-md text-left transition-colors hover:bg-white/[0.04] text-gray-300 hover:text-white"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1 flex-shrink-0 text-gray-500">
                            {navIcon(item.id)}
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

          {/* Right Actions */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button
              onClick={() => setDownloadModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-all shadow-glow-brand cursor-pointer"
              title="Download Desktop App Mode (.exe)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Desktop App (.exe)</span>
            </button>
          </div>
        </div>

        {/* Dynamic View Content */}
        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'portal' && <ClientPortalView />}
          {activeTab === 'intake' && <IntakeWizardView />}
          {activeTab === 'documents' && <DocumentsView />}
          {activeTab === 'billing' && <BillingView />}
          {activeTab === 'inbox' && <InboxView />}
          {activeTab === 'chat' && <ChatView />}
          {activeTab === 'my_issues' && <IssuesView onlyMyIssues={true} onOpenNewIssue={() => setCreateIssueOpen(true)} />}
          {activeTab === 'issues' && <IssuesView onOpenNewIssue={() => setCreateIssueOpen(true)} />}
          {activeTab === 'projects' && <ProjectsView onOpenNewIssue={() => setCreateIssueOpen(true)} />}
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
