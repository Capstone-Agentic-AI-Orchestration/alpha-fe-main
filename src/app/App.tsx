import React, { useState, useRef, useEffect } from 'react';
import { NAV_ITEMS, navIcon, navLabel } from '@/config/navigation';
import { NoTeamAccess } from '@/features/onboarding/NoTeamAccess';
import { GitHubSetup } from '@/features/onboarding/GitHubSetup';
import { SignIn, SignInError } from '@/features/onboarding/SignIn';
import { DeveloperGateway } from '@/features/onboarding/DeveloperGateway';
import { ConnectingScreen } from '@/features/onboarding/ConnectingScreen';
import { apiService } from '@/shared/services/apiService';
import { API_BASE } from '@/shared/config';
import { useApp } from '@/app/AppContext';
import { Sidebar } from '@/shared/layout/Sidebar';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { CreateIssueModal } from '@/features/issues/CreateIssueModal';
import { AgentRunModal } from '@/features/runs/AgentRunModal';
import { PrototypeGuide } from '@/features/onboarding/PrototypeGuide';
import { ToastRegion } from '@/shared/components/ToastRegion';
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
import { Plus, X } from 'lucide-react';
// Whether this is the packaged desktop app rather than a browser tab, read from
// the preload bridge. Shared with the settings panel rather than defined twice.
import { isDesktop } from '@/shared/desktop';

/**
 * The new-tab picker's list, derived rather than declared.
 *
 * This was a hand-maintained array that had already lost `portal` and
 * `intake` — the two views a client lands on — while the sidebar's own table
 * still had them. One table now, in config/navigation.
 */
const ALL_TABS = NAV_ITEMS;


/**
 * Why a sign-in attempt bounced back, from the fragment the daemon redirects
 * with.
 *
 * A fragment rather than a query string because it never reaches the server,
 * and never lands in an access log or a Referer header. Read once on load and
 * cleared, so a refresh does not re-show an error the person already resolved.
 */
function consumeSignInError(): SignInError | undefined {
  const match = /[#&]alpha_error=([a-z_]+)/.exec(window.location.hash);
  if (!match) return undefined;

  history.replaceState(null, '', window.location.pathname + window.location.search);
  return match[1] === 'no_team' || match[1] === 'oauth_failed'
    ? (match[1] as SignInError)
    : undefined;
}

const desktopDownloadUrl = `${API_BASE}/download/desktop`;

export const App: React.FC = () => {
  const { activeTab, tabs, activeTabId, setActiveTabId, openNewTab, closeTab, visibleTabs, role,
    identity,
    identityStatus,
    refreshIdentity,
    localMode,
    continueInLocalMode
  } = useApp();
  const availableTabs = ALL_TABS.filter(t => visibleTabs.includes(t.id));


  // A tab persisted under a different role must not keep its old label in the
  // strip; resolve it the same way the context resolves the rendered view.
  const resolveView = (view: NavigationTab): NavigationTab =>
    visibleTabs.includes(view) ? view : visibleTabs[0];
  // Read once on mount: the fragment is cleared as it is read, so deriving
  // this during render would lose it on the first re-render.
  const [signInError] = useState<SignInError | undefined>(consumeSignInError);
  /**
   * Sign out, which is a different act on each half.
   *
   * On the web it ends the session cookie. On the desktop there is no session:
   * the machine is signed in to GitHub, and signing out means disconnecting
   * that account -- the same thing the connection panel in Settings does.
   */
  const signOut = async () => {
    try {
      await (isDesktop ? apiService.githubLogout() : apiService.signOut());
    } finally {
      // Reload rather than mutate state: signing out invalidates every cached
      // collection in the provider, and a fresh boot is simpler than unwinding
      // them one at a time.
      window.location.reload();
    }
  };
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  // Start in the compact rail. The sidebar reveals itself on pointer hover or
  // keyboard focus, and users can pin it open from the rail's control.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
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
  /**
   * The web build renders nothing it cannot attribute to someone.
   *
   * Until `/me` answers there is no identity, and AppContext turns a missing
   * role into 'pm' -- so falling through here showed a PM workspace of sample
   * data to anyone who arrived signed out or while the API was waking. The
   * desktop keeps falling through: its daemon is local and its offline shell
   * is a feature.
   */
  if (!isDesktop && identityStatus !== 'ready') {
    return <ConnectingScreen status={identityStatus} onRetry={() => void refreshIdentity()} />;
  }

  /**
   * Hosted sign-in, before anything else.
   *
   * `authenticated` is only ever false in the web build; the desktop resolves
   * identity from `gh` before the window opens. Checked ahead of the GitHub
   * CLI gate below because that one diagnoses a *local* install problem, which
   * is not a thing a browser can have.
   *
   * On the web, anything short of a positive `authenticated: true` counts as
   * signed out: a server that omits the field is not running in cloud mode and
   * has no sign-in to offer, and SignIn says so rather than the shell pretending.
   */
  if (identity && (isDesktop ? identity.authenticated === false : identity.authenticated !== true)) {
    return <SignIn identity={identity} error={signInError} />;
  }

  /**
   * A developer who signed in to the web app.
   *
   * Their tools need a checkout and the AI CLIs on their own machine, so the
   * web build has nothing to show them. Sending them to the installer is the
   * whole of it -- their session stays valid and the desktop app finds the
   * same account.
   */
  if (identity?.authenticated && role === 'dev' && !isDesktop) {
    return (
      <DeveloperGateway
        identity={identity}
        downloadUrl={desktopDownloadUrl}
        onSignOut={signOut}
      />
    );
  }

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
        onSignOut={signOut}
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

      <AgentRunModal />
      <PrototypeGuide />
      <ToastRegion />
    </div>
  );
};

export default App;
