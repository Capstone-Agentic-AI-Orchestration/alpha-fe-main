import React, { useState, useRef, useEffect } from 'react';
import { NAV_ITEMS, navIcon, navLabel } from '@/config/navigation';
import { NoTeamAccess } from '@/features/onboarding/NoTeamAccess';
import { GitHubSetup } from '@/features/onboarding/GitHubSetup';
import { ProfilePicker } from '@/features/onboarding/ProfilePicker';
import { SignIn, SignInError } from '@/features/onboarding/SignIn';
import { DeveloperGateway } from '@/features/onboarding/DeveloperGateway';
import { ConnectingScreen } from '@/features/onboarding/ConnectingScreen';
import { apiService } from '@/shared/services/apiService';
import { API_BASE } from '@/shared/config';
import { TabSessionContext, useApp, useTabSessionState } from '@/app/AppContext';
import { Sidebar } from '@/shared/layout/Sidebar';
import { WorkspaceToolbar, WorkspaceTabStrip, WorkspaceTab, WorkspaceNewTabMenu } from '@/shared/layout/WorkspaceToolbar';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { CreateIssueModal } from '@/features/issues/CreateIssueModal';
import { AgentRunModal } from '@/features/runs/AgentRunModal';
import { PrototypeGuide } from '@/features/onboarding/PrototypeGuide';
import { ToastRegion } from '@/shared/components/ToastRegion';
import { NotificationPopover } from '@/features/inbox/NotificationPopover';
import { ChatView } from '@/features/chat/ChatView';
import { IssuesView } from '@/features/issues/IssuesView';
import { ProjectsView } from '@/features/projects/ProjectsView';
import { AgentsView } from '@/features/agents/AgentsView';
import { AnalyticsView } from '@/features/analytics/AnalyticsView';
import { OperationsCenterView } from '@/features/operations/OperationsCenterView';
import { RuntimesView } from '@/features/runtimes/RuntimesView';
import { SkillsView } from '@/features/skills/SkillsView';
import { DeploymentsView } from '@/features/deployments/DeploymentsView';
import { SettingsView } from '@/features/settings/SettingsView';
import { ClientPortalView } from '@/features/delivery/ClientPortalView';
import { IntakeWizardView } from '@/features/delivery/IntakeWizardView';
import { DocumentsView } from '@/features/delivery/DocumentsView';
import { PmTicketsPage } from '@/features/ticketing/PmTicketsPage';
import { NavigationTab } from '@/shared/types';
// Whether this is the packaged desktop app rather than a browser tab, read from
// the preload bridge. Shared with the settings panel rather than defined twice.
import { desktop, isDesktop } from '@/shared/desktop';

/**
 * The new-tab picker's list, derived rather than declared.
 *
 * This was a hand-maintained array that had already lost `portal` and
 * `intake` — the two views a client lands on — while the sidebar's own table
 * still had them. One table now, in config/navigation.
 */
const ALL_TABS = NAV_ITEMS;

const WorkspaceTabView: React.FC<{ view: NavigationTab }> = ({ view }) => {
  const [createIssueOpen, setCreateIssueOpen] = useTabSessionState<boolean>('issueModal.open', false);
  const { isActiveTab, runSetupIssueId } = useApp();
  const onOpenNewIssue = () => setCreateIssueOpen(true);
  let content: React.ReactNode;
  switch (view) {
    case 'portal': content = <ClientPortalView />; break;
    case 'intake': content = <IntakeWizardView />; break;
    case 'documents': content = <DocumentsView />; break;
    case 'tickets': content = <PmTicketsPage />; break;
    case 'chat': content = <ChatView />; break;
    case 'issues': content = <IssuesView onOpenNewIssue={onOpenNewIssue} />; break;
    case 'projects': content = <ProjectsView onOpenNewIssue={onOpenNewIssue} />; break;
    case 'agents': content = <AgentsView />; break;
    case 'analytics': content = <AnalyticsView />; break;
    case 'operations': content = <OperationsCenterView />; break;
    case 'runtimes': content = <RuntimesView />; break;
    case 'skills': content = <SkillsView />; break;
    case 'deployments': content = <DeploymentsView />; break;
    case 'settings': content = <SettingsView />; break;
    default: content = null;
  }
  return (
    <>
      {content}
      {isActiveTab && createIssueOpen && <CreateIssueModal isOpen onClose={() => setCreateIssueOpen(false)} />}
      {isActiveTab && runSetupIssueId && <AgentRunModal />}
    </>
  );
};


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
  const {
    tabs, activeTabId, setActiveTabId, openNewTab, closeTab, visibleTabs, role, setTabSessionState,
    projects, chatThreads, issues, agents, runtimes, skills, deployments, requirementDocs,
    identity,
    identityStatus,
    refreshIdentity,
    localMode,
    continueInLocalMode,
    showToast
  } = useApp();
  const availableTabs = ALL_TABS.filter(t => visibleTabs.includes(t.id));
  const [mountedTabIds, setMountedTabIds] = useState<Set<string>>(() => new Set([activeTabId]));

  useEffect(() => {
    setMountedTabIds(previous => previous.has(activeTabId)
      ? previous
      : new Set(previous).add(activeTabId));
  }, [activeTabId]);

  const activateTab = (tabId: string) => {
    setMountedTabIds(previous => previous.has(tabId) ? previous : new Set(previous).add(tabId));
    setActiveTabId(tabId);
  };

  const closeWorkspaceTab = (tabId: string) => {
    setMountedTabIds(previous => {
      const next = new Set(previous);
      next.delete(tabId);
      return next;
    });
    closeTab(tabId);
  };


  // A tab persisted under a different role must not keep its old label in the
  // strip; resolve it the same way the context resolves the rendered view.
  const resolveView = (view: NavigationTab): NavigationTab =>
    visibleTabs.includes(view) ? view : visibleTabs[0];
  const getTabContextTitle = (tab: (typeof tabs)[number]) => {
    const view = resolveView(tab.view);
    const session = tab.sessionState ?? {};
    const projectTitle = (id: unknown) => typeof id === 'string'
      ? projects.find(item => item.id === id)?.name
      : undefined;
    const contextualTitle = (label: string | undefined) => label ? `${getTabTitle(view)} · ${label}` : getTabTitle(view);

    if (view === 'chat') {
      const threadId = session.activeThreadId;
      const thread = typeof threadId === 'string' ? chatThreads.find(item => item.id === threadId) : undefined;
      return contextualTitle(thread?.title);
    }
    if (view === 'projects') return contextualTitle(projectTitle(session['projects.selectedProject']));
    if (view === 'issues') {
      const selectedIssue = issues.find(item => item.id === session['issues.selectedIssue']);
      return contextualTitle(selectedIssue?.identifier ?? projectTitle(session['issues.project']));
    }
    if (view === 'agents') return contextualTitle(agents.find(item => item.id === session['agents.selectedAgent'])?.name);
    if (view === 'runtimes') return contextualTitle(runtimes.find(item => item.id === session['runtimes.selectedRuntime'])?.name);
    if (view === 'skills') return contextualTitle(skills.find(item => item.id === session['skills.selectedSkill'])?.name);
    if (view === 'deployments') return contextualTitle(deployments.find(item => item.id === session['deployments.selectedDeployment'])?.name);
    if (view === 'documents') {
      const doc = requirementDocs.find(item => item.id === session['documents.selectedRequirement']);
      return contextualTitle(doc?.title);
    }
    if (view === 'intake') {
      const answers = session['intake.answers'] as { title?: unknown } | undefined;
      return contextualTitle(typeof answers?.title === 'string' ? answers.title.trim() : undefined);
    }
    return getTabTitle(view);
  };
  // Read once on mount: the fragment is cleared as it is read, so deriving
  // this during render would lose it on the first re-render.
  const [signInError] = useState<SignInError | undefined>(consumeSignInError);
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  /**
   * Sign out, which is a different act on each half.
   *
   * On the web it ends the session cookie. On the desktop it clears Alpha's
   * own GitHub sign-in -- the same action as Connected Accounts in Settings.
   */
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await (isDesktop ? apiService.githubLogout() : apiService.signOut());
      // Reload rather than mutate state: signing out invalidates every cached
      // collection in the provider, and a fresh boot is simpler than unwinding
      // them one at a time.
      window.location.reload();
    } catch (error) {
      showToast('Could not sign out', error instanceof Error ? error.message : String(error), 'error');
      setSigningOut(false);
    }
  };
  // Start in the compact rail. The sidebar reveals itself on pointer hover or
  // keyboard focus, and users can pin it open from the rail's control.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const workspaceFrameRef = useRef<HTMLDivElement>(null);
  // The desktop app on Windows draws its own title bar area; see main.js.
  const nativeWindowControls = isDesktop && desktop?.platform === 'win32';

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
  if (isDesktop && identityStatus !== 'ready') {
    return (
      <ProfilePicker
        identity={identity}
        identityStatus={identityStatus}
        onRetry={refreshIdentity}
      />
    );
  }

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

  if (isDesktop && (!identity || identity.github !== 'ok')) {
    return (
      <ProfilePicker
        identity={identity}
        identityStatus={identityStatus}
        onRetry={refreshIdentity}
      />
    );
  }

  if (!isDesktop && !localMode && identity && identity.github && identity.github !== 'ok') {
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
    <div className="flex h-dvh w-full bg-background text-content font-sans overflow-hidden text-sm">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onOpenNewIssue={() => setTabSessionState(activeTabId, 'issueModal.open', true)}
        onSignOut={signOut}
        onSwitchProfile={isDesktop ? () => setProfilePickerOpen(true) : undefined}
        signingOut={signingOut}
      />

      {/* Main Workspace Frame */}
      <div ref={workspaceFrameRef} className="relative flex-1 min-w-0 bg-shell overflow-hidden">
        {/* On Windows the native title bar is hidden and its minimize, maximize
            and close buttons are drawn over the top-right corner. The strip
            above the toolbar and the toolbar's empty space move the window. */}
        {nativeWindowControls && <div aria-hidden="true" className="app-drag-region absolute inset-x-0 top-0 z-20 h-3 sm:h-4" />}
        {/* Floating workspace toolbar */}
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4 ${nativeWindowControls ? 'pr-[9.5rem] sm:pr-[9.5rem]' : ''}`}>
          <WorkspaceToolbar draggable={nativeWindowControls} actions={<NotificationPopover />}>
            {/* Scrollable Open Tabs List */}
            <WorkspaceTabStrip label="Open workspace tabs">
            {tabs.map((tab) => {
              const title = getTabContextTitle(tab);
              return (
                <WorkspaceTab key={tab.id} active={activeTabId === tab.id} title={title}
                  icon={getTabIcon(resolveView(tab.view))} onActivate={() => activateTab(tab.id)}
                  onClose={() => closeWorkspaceTab(tab.id)} closable={tabs.length > 1} />
              );
            })}
            </WorkspaceTabStrip>

            <WorkspaceNewTabMenu boundaryRef={workspaceFrameRef}
              items={availableTabs.map(item => ({ id: item.id, title: item.title, subtitle: item.subtitle, icon: navIcon(item.id) }))}
              onSelect={id => {
                const tabId = openNewTab(id as NavigationTab);
                setMountedTabIds(previous => new Set(previous).add(tabId));
              }} />
            {/* No download here: the desktop app is where developers work, and
                a developer signing in on the web is sent to its download
                page (DeveloperGateway) instead. Everyone who reaches this
                header works in the browser. */}
          </WorkspaceToolbar>
        </div>

        {/* Dynamic View Content */}
        <main className="relative h-full overflow-hidden pt-16 sm:pt-20">
          {tabs.filter(tab => mountedTabIds.has(tab.id)).map(tab => {
            const view = resolveView(tab.view);
            const isActive = activeTabId === tab.id;
            return (
              <div
                key={tab.id}
                role="tabpanel"
                aria-label={getTabContextTitle(tab)}
                hidden={!isActive}
                className="h-full min-h-0"
              >
                <TabSessionContext.Provider value={{ tabId: tab.id }}>
                  <WorkspaceTabView view={view} />
                </TabSessionContext.Provider>
              </div>
            );
          })}
        </main>
      </div>

      {/* Global ⌘K Command Palette */}
      <CommandPalette />

      <PrototypeGuide />
      <ToastRegion />
      {isDesktop && profilePickerOpen && (
        <ProfilePicker
          identity={identity}
          identityStatus={identityStatus}
          onRetry={refreshIdentity}
          onClose={() => setProfilePickerOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
