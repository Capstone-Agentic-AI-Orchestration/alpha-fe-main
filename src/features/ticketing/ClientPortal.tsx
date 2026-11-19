import { EntrySkeleton, LoadingRows } from '@/shared/components/ui/skeleton';
import { TicketDetailSkeleton } from './TicketingSkeletons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronsUpDown, FileText, FolderKanban, House,
  Lightbulb, ListChecks, LogOut, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Ticket, type LucideIcon,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

import alphaMarkUrl from '@/assets/alpha-mark.png';
import type {
  ClientProject, ClientProjectProposal, ClientProjectRequestItem, ClientProjectRequestQueue, ClientSession,
  ClientTicketCommandInput, ClientTicketCreateInput, ClientTicketDetail as TicketDetail,
  ClientTicketMessage, ClientTicketReceipt, ClientTicketReplyInput,
} from './clientApi';
import { ClientTicketApiError, clientTicketApi } from './clientApi';
import { ClientCreateTicketForm } from './ClientCreateTicketForm';
import { ClientTicketDetail } from './ClientTicketDetail';
import { ClientNotificationBell, projectProposalPortalUpdate, type ClientPortalUpdate } from './ClientNotificationBell';
import { ClientAccessPanel } from './ClientAccessPanel';
import { ClientPasswordSignIn } from './ClientPasswordSignIn';
import { clientTicketProgress } from './clientTicketProgress';
import { CLIENT_REQUEST_GROUPS, clientRequestGroup, relativeTime } from './clientFriendly';
import { effectivePortalFilter, portalFilterFromHash } from './clientPortalLink';
import { secondary, time } from './ticketUi';
import { ClientOverviewPage, ClientProjectsPage, clientProjectKey } from './ClientProjectPages';
import { ClientProposalsPage } from './ClientProposalsPage';
import { StatusPill } from './ClientProjectSections';
import { Toast, type ToastTone } from '@/shared/components/ui/toast';
import { WorkspaceToolbar, WorkspaceTabStrip, WorkspaceTab, WorkspaceNewTabMenu } from '@/shared/layout/WorkspaceToolbar';
import { useSidebarToggle } from '@/shared/layout/useSidebarToggle';
import { SidebarFrame } from '@/shared/layout/SidebarFrame';
import { sidebarRow } from '@/features/chat/ProjectChatSidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useClientWorkspaceTabs, type ClientPage as Page } from './clientWorkspaceTabs';
import './clientDesignTokens.css';
import './clientPortal.css';
import { mergeClientMessages, startClientAutoRefresh } from './clientAutoRefresh';

type Filter = NonNullable<Parameters<typeof clientTicketApi.listRequests>[0]>['filter'];
type PortalState = 'checking' | 'signed_out' | 'unavailable' | 'ready';
interface PendingOperation {
  operationId: string;
  label: string;
  run: () => Promise<ClientTicketReceipt>;
  onSuccess?: (receipt: ClientTicketReceipt) => void;
  /** Skip the broad portal reload when the active conversation is updated in place. */
  refresh?: boolean;
}
interface ClientToast { title: string; description?: string; tone: ToastTone }

const filters: Array<{ id: NonNullable<Filter>; label: string }> = [
  { id: 'all', label: 'All requests' },
  { id: 'open', label: 'Active requests' },
  { id: 'needs_client', label: 'Needs your action' },
  { id: 'history', label: 'Past requests' },
];

function friendlyError(error: unknown, context: 'session' | 'queue' | 'ticket' | 'write' | 'create' | 'projects'): string {
  if (!(error instanceof ClientTicketApiError)) {
    return context === 'session' ? 'Could not check your sign-in. Try again later.'
      : context === 'queue' ? 'Could not load your requests. Try again later.'
        : context === 'ticket' ? 'Could not load this request. Try again later.'
          : context === 'projects' ? 'Could not load your shared projects. Try again later.'
            : context === 'create' ? 'Could not prepare a new request. Try again later.'
              : 'Your change could not be completed.';
  }
  if (context === 'session' && (error.status === 404 || error.status === 503)) return 'Client sign-in is temporarily unavailable. Please try again later.';
  if (context === 'session' && error.status === 401) return 'Your sign-in has expired. Sign in again to continue.';
  if ((context === 'queue' || context === 'ticket' || context === 'projects') && (error.status === 404 || error.status === 503)) {
    return context === 'projects' ? 'We could not load your shared projects right now. Please try again later.'
      : 'We could not load your requests right now. Please try again later.';
  }
  if (error.reconciliationRequired) return 'We could not confirm whether this update was saved. Use “Check update status” before trying again.';
  return error.message;
}

function rowKey(item: ClientProjectRequestItem): string { return `${item.workspaceId}\u0000${item.id}`; }

function appendClientMessage(messages: ClientTicketMessage[], message: ClientTicketMessage): ClientTicketMessage[] {
  return messages.some(current => current.id === message.id) ? messages : [...messages, message];
}

const CLIENT_PAGES: Record<Page, { label: string; subtitle: string; Icon: LucideIcon }> = {
  overview: { label: 'Home', subtitle: 'What needs you and your latest updates', Icon: House },
  projects: { label: 'Projects', subtitle: 'Projects shared by your project manager', Icon: FolderKanban },
  proposals: { label: 'Proposals', subtitle: 'Ideas you have sent to your project manager', Icon: Lightbulb },
  requests: { label: 'Requests', subtitle: 'Follow requests and message your project manager', Icon: ListChecks },
};
const CLIENT_PAGE_ORDER: readonly Page[] = ['overview', 'projects', 'proposals', 'requests'];
function clientPageIcon(page: Page, size: number) {
  const { Icon } = CLIENT_PAGES[page];
  return <Icon size={size} />;
}

export default function ClientPortal({ api = clientTicketApi, inspectionOnly = false,
  workflowActionsDisabled: workflowActionsDisabledOverride = false, newRequestsDisabled = true,
  communicationEnabled = false }: {
  api?: typeof clientTicketApi;
  inspectionOnly?: boolean;
  /** Disables client-initiated lifecycle decisions while preserving scoped ticket access. */
  workflowActionsDisabled?: boolean;
  /** New Request can be enabled by AppEntry, but is rendered only inside a selected project. */
  newRequestsDisabled?: boolean;
  /** Enables ticket-scoped messages and documents independently of workflow decisions. */
  communicationEnabled?: boolean;
} = {}) {
  const { tabs, activeTabId, tabState, openTab, activateTab, closeTab, resetTabs, selectProject } = useClientWorkspaceTabs(
    typeof window === 'undefined' ? 'all' : portalFilterFromHash(window.location.hash));
  const portalRootRef = useRef<HTMLElement>(null);
  const workspaceFrameRef = useRef<HTMLDivElement>(null);
  // The staff sidebar's frame (SidebarFrame): no hover; double-click empty sidebar
  // space or press Ctrl+B. Open on wide windows pushes the page over; on narrow
  // ones it floats and closes on navigation, Escape or an outside click.
  const clientNav = useSidebarToggle('alpha.client-sidebar');
  // Home's "Propose a project" opens the form on the Projects page of the same tab.
  /** The tab whose Proposals page should open the proposal form once it shows. */
  const [proposeRequestTab, setProposeRequestTab] = useState<string | null>(null);
  const [portalState, setPortalState] = useState<PortalState>('checking');
  const [session, setSession] = useState<ClientSession | null>(null);
  const [phaseWorkflowEnabled, setPhaseWorkflowEnabled] = useState(false);
  const [workflowChecked, setWorkflowChecked] = useState(false);
  const [projects, setProjects] = useState<ClientProject[] | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [projectProposals, setProjectProposals] = useState<ClientProjectProposal[] | null>(null);
  const [projectProposalsLoading, setProjectProposalsLoading] = useState(false);
  const [projectProposalsError, setProjectProposalsError] = useState('');
  const [page, setPage] = tabState('page');
  const [selectedProjectKey, setSelectedProjectKey] = tabState('selectedProjectKey');
  const [selectedProposalId, setSelectedProposalId] = tabState('selectedProposalId');
  const [queue, setQueue] = useState<ClientProjectRequestQueue | null>(null);
  const [notificationRequests, setNotificationRequests] = useState<ClientProjectRequestItem[] | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [filter, setFilter] = tabState('filter');
  const [searchInput, setSearchInput] = tabState('searchInput');
  const [search, setSearch] = tabState('search');
  const [replyDrafts, setReplyDrafts] = tabState('replyDrafts');
  const [selectedId, setSelectedId] = tabState('selectedId');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = tabState('selectedWorkspaceId');
  const [selectedItemFallback, setSelectedItemFallback] = tabState('selectedItemFallback');
  const [returnToProjects, setReturnToProjects] = tabState('returnToProjects');
  const [navigationCollapsed, setNavigationCollapsed] = tabState('navigationCollapsed');
  const [, setNotificationProjectFocus] = tabState('notificationProjectFocus');
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<ClientTicketMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueMoreLoading, setQueueMoreLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createContext, setCreateContext] = useState<Awaited<ReturnType<typeof api.getIntakeContext>> | null>(null);
  const [createProject, setCreateProject] = useState<ClientProject | null>(null);
  const [createError, setCreateError] = useState('');
  const [view, setView] = useState<'portal' | 'create'>('portal');
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const [pageError, setPageError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [replyResetVersion, setReplyResetVersion] = useState(0);
  const [sessionCheckVersion, setSessionCheckVersion] = useState(0);
  const [refreshError, setRefreshError] = useState('');
  const [queueNotice, setQueueNotice] = useState('');
  const [clientToast, setClientToast] = useState<ClientToast | null>(null);
  const [requestListShown, setRequestListShown] = tabState('requestListShown');
  const queueGeneration = useRef(0);
  const historyGeneration = useRef(0);
  const writeLock = useRef(false);
  const queueSnapshot = useRef(queue);
  queueSnapshot.current = queue;

  useEffect(() => {
    if (!clientToast) return;
    const timer = window.setTimeout(() => setClientToast(null), 4800);
    return () => window.clearTimeout(timer);
  }, [clientToast]);

  const workflowActionsDisabled = workflowActionsDisabledOverride || !phaseWorkflowEnabled;
  const canStartProjectRequest = !newRequestsDisabled && !inspectionOnly;
  const selectedQueueItem = useMemo(() => {
    if (!selectedId || !selectedWorkspaceId) return null;
    return queue?.items.find(item => item.id === selectedId && item.workspaceId === selectedWorkspaceId)
      ?? (selectedItemFallback?.id === selectedId && selectedItemFallback.workspaceId === selectedWorkspaceId ? selectedItemFallback : null);
  }, [queue, selectedId, selectedWorkspaceId, selectedItemFallback]);
  const portalUpdates = useMemo<ClientPortalUpdate[]>(() => {
    const requests: ClientPortalUpdate[] = (notificationRequests ?? []).map(item => ({
      id: `request:${item.workspaceId}:${item.id}:${item.updatedAt}`,
      title: item.requestedAction ? 'Action needed' : item.status === 'closed' ? 'Request completed' : 'Request updated',
      message: `${item.reference} · ${clientTicketProgress(item.status, item.requestedAction).label}`,
      timestamp: item.updatedAt,
      target: { kind: 'request', item },
    }));
    const projectUpdates: ClientPortalUpdate[] = (projects ?? []).map(item => ({
      id: `project:${item.workspaceId}:${item.projectId}:${item.updatedAt}`,
      title: 'Project updated',
      message: item.name,
      timestamp: item.updatedAt,
      target: { kind: 'project', item },
    }));
    const proposalUpdates = (projectProposals ?? []).flatMap(item => {
      const update = projectProposalPortalUpdate(item);
      return update ? [update] : [];
    });
    return [...requests, ...projectUpdates, ...proposalUpdates]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 30);
  }, [notificationRequests, projects, projectProposals]);

  useEffect(() => {
    let current = true;
    setPhaseWorkflowEnabled(false);
    setWorkflowChecked(false);
    if (workflowActionsDisabledOverride || inspectionOnly) { setWorkflowChecked(true); return () => { current = false; }; }
    void api.getWorkflowCapabilities().then(capabilities => {
      if (current) setPhaseWorkflowEnabled(capabilities.phaseWorkflowEnabled === true);
    }).catch(() => {
      if (current) setPhaseWorkflowEnabled(false);
    }).finally(() => { if (current) setWorkflowChecked(true); });
    return () => { current = false; };
  }, [api, inspectionOnly, workflowActionsDisabledOverride]);

  useEffect(() => {
    if (workflowChecked && effectivePortalFilter(filter, !workflowActionsDisabled) !== filter) setFilter('all');
  }, [workflowChecked, workflowActionsDisabled, filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [activeTabId, searchInput]);

  function clearExpiredClientSession(): void {
    resetTabs();
    setSession({ authenticated: false }); setPortalState('signed_out');
    setProjects(null); setQueue(null); setNotificationRequests(null); setNotificationsLoaded(false); setSelectedId(null); setSelectedWorkspaceId(null); setSelectedItemFallback(null);
    setDetail(null); setMessages([]); setMessageCursor(null); setPending(null);
    setCreateContext(null); setCreateProject(null); setView('portal'); setPage('overview');
    setQueueError(''); setDetailError(''); setHistoryError(''); setWriteError('');
    setQueueLoading(false); setQueueMoreLoading(false); setDetailLoading(false); setHistoryLoading(false);
    queueGeneration.current += 1; historyGeneration.current += 1;
  }

  function isExpiredClientSession(error: unknown): boolean {
    if (!(error instanceof ClientTicketApiError) || error.status !== 401) return false;
    clearExpiredClientSession();
    return true;
  }

  useEffect(() => {
    let current = true;
    setPortalState('checking'); setPageError('');
    api.getSession().then(currentSession => {
      if (!current) return;
      setSession(currentSession);
      setPortalState(currentSession.authenticated ? 'ready' : 'signed_out');
    }).catch(error => {
      if (!current) return;
      setPageError(friendlyError(error, 'session'));
      setPortalState(error instanceof ClientTicketApiError && error.status === 401 ? 'signed_out' : 'unavailable');
    });
    return () => { current = false; };
  }, [sessionCheckVersion, api]);

  useEffect(() => {
    if (portalState !== 'ready') return;
    let current = true;
    setProjectsLoading(true); setProjectsError('');
    void api.listProjects().then(result => { if (current) setProjects(result.items); })
      .catch(error => {
        if (!current || isExpiredClientSession(error)) return;
        setProjects(null); setProjectsError(friendlyError(error, 'projects'));
      }).finally(() => { if (current) setProjectsLoading(false); });
    return () => { current = false; };
  }, [api, portalState, refreshVersion]);

  useEffect(() => {
    if (portalState !== 'ready') return;
    let current = true;
    let busy = false;
    let loaded = false;
    const refreshProjectProposals = async () => {
      if (!current || busy) return;
      busy = true;
      if (!loaded) { setProjectProposalsLoading(true); setProjectProposalsError(''); }
      try {
        const result = await api.listProjectProposals();
        if (current) { setProjectProposals(result.items); setProjectProposalsError(''); }
      } catch (error) {
        if (!current || isExpiredClientSession(error)) return;
        setProjectProposals(null);
        setProjectProposalsError(error instanceof ClientTicketApiError && (error.status === 404 || error.status === 503)
          ? 'Project proposals are temporarily unavailable. Please try again later.'
          : 'We could not load your project proposals. Refresh and try again.');
      } finally {
        busy = false;
        if (current && !loaded) { loaded = true; setProjectProposalsLoading(false); }
      }
    };
    void refreshProjectProposals();
    const stop = inspectionOnly ? () => undefined : startClientAutoRefresh(refreshProjectProposals);
    return () => { current = false; stop(); };
  }, [api, portalState, refreshVersion, inspectionOnly]);

  useEffect(() => {
    if (portalState !== 'ready') return;
    let current = true;
    let busy = false;
    const refreshNotifications = async () => {
      if (!current || busy) return;
      busy = true;
      setNotificationsLoading(true);
      try {
        const result = await api.listRequests({ limit: 50, filter: 'all' });
        if (current) { setNotificationRequests(result.items); setNotificationsError(''); }
      } catch (error) {
        if (current) setNotificationsError(friendlyError(error, 'queue'));
      } finally {
        busy = false;
        if (current) { setNotificationsLoaded(true); setNotificationsLoading(false); }
      }
    };
    void refreshNotifications();
    const stop = inspectionOnly ? () => undefined : startClientAutoRefresh(refreshNotifications);
    return () => { current = false; stop(); };
  }, [api, portalState, refreshVersion, inspectionOnly]);

  useEffect(() => {
    if (portalState !== 'ready') return;
    let current = true;
    const generation = ++queueGeneration.current;
    setQueueLoading(true); setQueueMoreLoading(false); setQueueError(''); setRefreshError('');
    void api.listRequests({ limit: 50, filter, search }).then(result => {
      if (!current || generation !== queueGeneration.current) return;
      setQueue(result);
      setSelectedId(existing => existing && (result.items.some(item => item.id === existing)
        || (selectedItemFallback?.id === existing && selectedItemFallback.workspaceId === selectedWorkspaceId)) ? existing : null);
      setSelectedItemFallback(existing => existing && result.items.some(item => item.id === existing.id && item.workspaceId === existing.workspaceId)
        ? null : existing);
    }).catch(error => {
      if (!current || generation !== queueGeneration.current) return;
      if (isExpiredClientSession(error)) return;
      setQueue(null); setSelectedId(null); setQueueError(friendlyError(error, 'queue'));
    }).finally(() => { if (current && generation === queueGeneration.current) setQueueLoading(false); });
    return () => { current = false; };
  }, [activeTabId, portalState, filter, search, refreshVersion, api,
    selectedItemFallback?.id, selectedItemFallback?.workspaceId, selectedWorkspaceId]);

  useEffect(() => {
    const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
    if (portalState !== 'ready' || !activeWorkspaceId || !selectedId || !selectedQueueItem) {
      setDetail(null); setMessages([]); setMessageCursor(null); setDetailError(''); setDetailLoading(false);
      return;
    }
    let current = true;
    const generation = ++historyGeneration.current;
    setDetail(null); setMessages([]); setMessageCursor(null); setDetailError(''); setHistoryError(''); setHistoryLoading(!(workflowActionsDisabled && !communicationEnabled)); setDetailLoading(true);
    const load = workflowActionsDisabled && !communicationEnabled
      ? api.getTicket(activeWorkspaceId, selectedId).then(ticket => [ticket, null] as const)
      : Promise.all([api.getTicket(activeWorkspaceId, selectedId), api.getMessages(activeWorkspaceId, selectedId, { limit: 50 })] as const);
    load.then(([ticket, messagePage]) => {
      if (!current) return;
      setDetail(ticket); setMessages(messagePage?.items ?? []); setMessageCursor(messagePage?.nextCursor ?? null);
    }).catch(error => {
      if (current && !isExpiredClientSession(error)) setDetailError(friendlyError(error, 'ticket'));
    }).finally(() => { if (current) { setDetailLoading(false); setHistoryLoading(false); } });
    return () => {
      current = false;
      if (historyGeneration.current === generation) historyGeneration.current += 1;
    };
  }, [portalState, selectedId, selectedWorkspaceId, selectedQueueItem?.workspaceId, selectedQueueItem?.id,
    refreshVersion, api, workflowActionsDisabled, communicationEnabled, activeTabId]);

  useEffect(() => {
    if (inspectionOnly || portalState !== 'ready' || page === 'projects' || view === 'create'
      || writing || pending || signingOut || queueLoading || detailLoading || historyLoading || queueMoreLoading) return;
    let current = true;
    const stop = startClientAutoRefresh(async () => {
      const queueVersion = queueGeneration.current; const historyVersion = historyGeneration.current;
      const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
      try {
        const loadQueue = async () => {
          let result = await api.listRequests({ limit: 50, filter, search });
          const items = [...result.items]; const count = queueSnapshot.current?.items.length ?? 50;
          const cursors = new Set<string>();
          while (result.nextCursor && items.length < count && !cursors.has(result.nextCursor)) {
            cursors.add(result.nextCursor);
            result = await api.listRequests({ limit: 50, filter, search, after: result.nextCursor });
            items.push(...result.items);
          }
          return { ...result, items };
        };
        const [freshQueue, freshDetail, freshMessages] = await Promise.all([
          loadQueue(),
          selectedId && activeWorkspaceId ? api.getTicket(activeWorkspaceId, selectedId) : null,
          selectedId && activeWorkspaceId && (!workflowActionsDisabled || communicationEnabled)
            ? api.getMessages(activeWorkspaceId, selectedId, { limit: 50 }) : null,
        ]);
        if (!current || writeLock.current || queueVersion !== queueGeneration.current || historyVersion !== historyGeneration.current) return;
        setQueue(freshQueue); if (freshDetail) setDetail(freshDetail);
        if (freshMessages) setMessages(previous => mergeClientMessages(previous, freshMessages.items));
        setRefreshError('');
      } catch (error) {
        if (!current || queueVersion !== queueGeneration.current || historyVersion !== historyGeneration.current) return;
        if (isExpiredClientSession(error)) return;
        if (error instanceof ClientTicketApiError && (error.status === 403 || error.status === 404)) {
          setSelectedId(null); setDetail(null); setRefreshVersion(value => value + 1);
          setRefreshError('This request is no longer available. Choose another request.'); return;
        }
        setRefreshError('Could not refresh updates. Your message draft is kept. Use Refresh to try again.');
      }
    });
    return () => { current = false; stop(); };
  }, [activeTabId, api, portalState, page, view, selectedWorkspaceId, selectedQueueItem?.workspaceId, selectedId, filter, search,
    inspectionOnly, writing, pending, signingOut, queueLoading, detailLoading, historyLoading, queueMoreLoading,
    workflowActionsDisabled, communicationEnabled]);

  async function loadMoreQueue() {
    if (!queue?.nextCursor || queueMoreLoading) return;
    const generation = queueGeneration.current; setQueueMoreLoading(true); setQueueError('');
    try {
      const result = await api.listRequests({ limit: 50, after: queue.nextCursor, filter, search });
      if (generation !== queueGeneration.current) return;
      setQueue(current => {
        if (!current) return result;
        const seen = new Set(current.items.map(rowKey));
        return { ...result, items: [...current.items, ...result.items.filter(item => !seen.has(rowKey(item)))] };
      });
    } catch (error) {
      if (isExpiredClientSession(error)) return;
      if (generation === queueGeneration.current) setQueueError(friendlyError(error, 'queue'));
    } finally { if (generation === queueGeneration.current) setQueueMoreLoading(false); }
  }

  async function loadMoreMessages() {
    const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
    if (!communicationEnabled || !activeWorkspaceId || !selectedId || !messageCursor || historyLoading) return;
    const generation = historyGeneration.current; const cursor = messageCursor;
    setHistoryLoading(true); setHistoryError('');
    try {
      const result = await api.getMessages(activeWorkspaceId, selectedId, { after: cursor });
      if (generation !== historyGeneration.current) return;
      setMessages(current => [...result.items, ...current]); setMessageCursor(result.nextCursor);
    } catch (error) {
      if (isExpiredClientSession(error)) return;
      if (generation === historyGeneration.current) setHistoryError(friendlyError(error, 'ticket'));
    } finally { if (generation === historyGeneration.current) setHistoryLoading(false); }
  }

  async function performWrite(operation: PendingOperation): Promise<ClientTicketReceipt> {
    if (inspectionOnly) throw new Error('Changes are disabled while inspecting sample tickets.');
    if (writeLock.current) throw new Error('Another ticket change is already being processed.');
    writeLock.current = true; setWriting(true); setWriteError('');
    try {
      const receipt = await operation.run(); setPending(null); setWriteError(''); operation.onSuccess?.(receipt);
      if (operation.refresh !== false) setRefreshVersion(value => value + 1);
      return receipt;
    } catch (error) {
      if (isExpiredClientSession(error)) setWriteError('');
      else {
        if (error instanceof ClientTicketApiError && error.reconciliationRequired) setPending(operation);
        else setPending(null);
        setWriteError(friendlyError(error, 'write'));
      }
      throw error;
    } finally { writeLock.current = false; setWriting(false); }
  }

  function applyLocalClientMessage(ticketId: string, body: string, receipt: ClientTicketReceipt): void {
    const updatedAt = new Date().toISOString();
    const messageId = receipt.messageId;
    if (messageId) {
      setMessages(current => appendClientMessage(current, {
        id: messageId, author: 'client', body: body.trim(), createdAt: updatedAt,
      }));
    }
    setDetail(current => current && current.id === ticketId
      ? { ...current, version: receipt.version, status: receipt.status, updatedAt }
      : current);
    setQueue(current => current ? {
      ...current,
      items: current.items.map(item => item.id === ticketId
        ? { ...item, status: receipt.status, requestedAction: null, updatedAt }
        : item),
    } : current);
    setSelectedItemFallback(current => current && current.id === ticketId
      ? { ...current, status: receipt.status, requestedAction: null, updatedAt }
      : current);
  }

  async function openCreateForm(project: ClientProject) {
    if (!canStartProjectRequest || !selectedProjectKey || selectedProjectKey !== clientProjectKey(project)
      || createLoading || pending) return;
    setCreateLoading(true); setCreateError(''); setPageError('');
    try {
      const context = await api.getIntakeContext(project.workspaceId);
      if (!context.canCreate) {
        setCreateContext(null); setCreateProject(null);
        setCreateError('New requests are unavailable in this workspace right now. Contact your project manager.');
        return;
      }
      if (!context.sharedProjects.some(option => option.optionId === project.intakeOptionId)) {
        setCreateContext(null); setCreateProject(null);
        setCreateError('This project is no longer available for new requests. Refresh Projects and try again.');
        return;
      }
      setCreateProject(project); setCreateContext(context); setWriteError(''); setView('create');
    } catch (error) {
      if (isExpiredClientSession(error)) return;
      setCreateError(friendlyError(error, 'create'));
    } finally { setCreateLoading(false); }
  }

  function cancelCreateForm() {
    if (pending) return;
    setView('portal'); setCreateContext(null); setCreateProject(null); setCreateError(''); setWriteError('');
  }

  function submitNewTicket(value: ClientTicketCreateInput) {
    const target = createProject;
    if (!canStartProjectRequest || !target || !createContext?.canCreate || pending
      || !createContext.sharedProjects.some(option => option.optionId === target.intakeOptionId)
      || value.projectPreference?.kind !== 'shared_project' || value.projectPreference.optionId !== target.intakeOptionId) return;
    void performWrite({
      operationId: value.operationId, label: 'ticket submission', run: () => api.createTicket(value),
      onSuccess: receipt => {
        setQueueNotice(`Request sent for PM review and linked under ${target.name}.`);
        setClientToast({ title: 'Request submitted', description: `Your request is waiting for ${target.name} to review it.`, tone: 'success' });
        setPage('requests'); setView('portal'); setFilter('all'); setSearchInput(''); setSearch('');
        setSelectedId(receipt.ticketId); setSelectedWorkspaceId(target.workspaceId); setSelectedItemFallback(null);
        setRequestListShown(true); setCreateContext(null); setCreateProject(null);
      },
    }).catch(() => undefined);
  }

  function openRequest(item: ClientProjectRequestItem, fromProject = false) {
    historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(item.id); setSelectedWorkspaceId(item.workspaceId);
    setSelectedItemFallback(item); setReturnToProjects(fromProject); setPage('requests'); setView('portal'); setWriteError(''); setNavigationCollapsed(false);
    if (fromProject) { setFilter('all'); setSearchInput(''); setSearch(''); }
    setRequestListShown(false);
  }

  function sendReply(body: string): Promise<void> {
    const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
    if (!detail || !activeWorkspaceId || pending) return Promise.reject(new Error('A ticket change is already being reconciled.'));
    const ticketId = detail.id;
    const payload: ClientTicketReplyInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version, body, action: { type: 'reply' } };
    return performWrite({ operationId: payload.operationId, label: 'message', refresh: false,
      run: () => api.reply(activeWorkspaceId, ticketId, payload), onSuccess: receipt => {
        applyLocalClientMessage(ticketId, body, receipt);
        setReplyResetVersion(value => value + 1);
      } }).then(() => undefined);
  }

  function sendCorrection(body: string, deliveryId: string): Promise<void> {
    const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
    if (!detail || !activeWorkspaceId || pending || detail.readOnly || !detail.writesAvailable
      || detail.requestedAction !== 'review_result' || detail.delivery?.id !== deliveryId || detail.delivery.accepted) {
      return Promise.reject(new Error('The current result is not awaiting feedback.'));
    }
    const payload: ClientTicketReplyInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      body, action: { type: 'request_correction', deliveryId } };
    const ticketId = detail.id;
    return performWrite({ operationId: payload.operationId, label: 'correction feedback', refresh: false,
      run: () => api.reply(activeWorkspaceId, ticketId, payload), onSuccess: receipt => {
        applyLocalClientMessage(ticketId, body, receipt);
      } }).then(() => undefined);
  }

  function makeDecision(command: Extract<ClientTicketCommandInput['command'], { type: 'agree_scope' | 'accept_delivery' }>) {
    const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
    if (!detail || !activeWorkspaceId || pending) return;
    if (command.type === 'accept_delivery' && (detail.requestedAction !== 'review_result'
      || detail.delivery?.id !== command.deliveryId || detail.delivery.accepted || !detail.writesAvailable || detail.readOnly)) return;
    const payload: ClientTicketCommandInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version, command };
    void performWrite({ operationId: payload.operationId, label: command.type === 'accept_delivery' ? 'result acceptance' : 'scope agreement',
      run: () => api.decide(activeWorkspaceId, detail.id, payload) }).catch(() => undefined);
  }

  async function signOut() {
    if (signingOut || pending || inspectionOnly) return;
    setSigningOut(true); setPageError('');
    try { await api.signOut(); clearExpiredClientSession(); }
    catch (error) { if (!isExpiredClientSession(error)) setPageError(friendlyError(error, 'write')); }
    finally { setSigningOut(false); }
  }

  function navigate(nextPage: Page) {
    setPage(nextPage); setView('portal'); setCreateContext(null); setCreateProject(null); setCreateError('');
    if (nextPage !== 'requests') { setReturnToProjects(false); setQueueNotice(''); }
    if (nextPage === 'projects') setSelectedProjectKey(null);
    if (nextPage === 'proposals') setSelectedProposalId(null);
    if (nextPage === 'requests') setRequestListShown(true);
  }

  function changeWorkspaceTab(change: () => void) {
    if (writing || pending || view === 'create') return;
    historyGeneration.current += 1;
    setDetail(null); setMessages([]); setMessageCursor(null); setDetailError(''); setHistoryError(''); setWriteError('');
    change();
  }

  function openPortalUpdate(update: ClientPortalUpdate) {
    if (update.target.kind === 'request') {
      setFilter('all'); setSearchInput(''); setSearch('');
      openRequest(update.target.item);
      return;
    }
    if (update.target.kind === 'proposal') {
      setPage('proposals'); setView('portal'); setCreateContext(null); setCreateProject(null); setCreateError('');
      setSelectedProposalId(update.target.item.id);
      setRefreshVersion(value => value + 1);
      return;
    }
    openProject(update.target.item);
  }

  function openProject(project: ClientProject) {
    setPage('projects'); setView('portal'); setCreateContext(null); setCreateProject(null); setCreateError('');
    setSelectedProjectKey(clientProjectKey(project));
    setNotificationProjectFocus(value => value + 1);
  }

  // When workflow actions are off, no request asks the client for a decision, so Home and the project cards match the request list.
  const displayQueue = useMemo(() => workflowActionsDisabled && queue
    ? { ...queue, items: queue.items.map(item => ({ ...item, requestedAction: null })) } : queue, [queue, workflowActionsDisabled]);

  if (portalState === 'checking') return <EntrySkeleton label="Checking your sign-in" />;
  if (!inspectionOnly && (portalState === 'signed_out' || portalState === 'unavailable')) return <ClientPasswordSignIn
    unavailable={portalState === 'unavailable'} error={pageError}
    onRetry={() => setSessionCheckVersion(value => value + 1)} onSignedIn={() => setSessionCheckVersion(value => value + 1)} />;
  if (portalState === 'signed_out' || portalState === 'unavailable') return <ClientAccessPanel
    unavailable={portalState === 'unavailable'} error={pageError} onRetry={() => setSessionCheckVersion(value => value + 1)} />;

  const activeRequest = selectedQueueItem;
  const showPendingLinkNotice = activeRequest?.projectLinkStatus === 'pending_review';
  const currentNav = page;
  const proposalsNeedingReply = (projectProposals ?? []).filter(proposal => proposal.status === 'awaiting_client').length;
  const proposeProject = inspectionOnly ? undefined : () => { setProposeRequestTab(activeTabId); navigate('proposals'); };
  const clientEmail = session?.email?.trim() ?? '';
  const clientName = session?.fullName?.trim() || 'Client';
  const clientInitials = clientName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return <main ref={portalRootRef} className={`client-portal-shell client-portal-shell--workspace${page === 'requests' && selectedId ? ' client-portal-shell--chat-open' : ''}${inspectionOnly ? ' client-portal-shell--inspection' : ''}`}>
    {/* The PM and Developer sidebar, row for row: SidebarFrame's 56px rail that opens to a
        resizable 200px panel, the workspace-style header, 32px rows and the account footer. */}
    <SidebarFrame collapsed={!clientNav.open} setCollapsed={collapsed => clientNav.setOpen(!collapsed)}
      ariaLabel="Client portal navigation" widthStorageKey="client_sidebar_width" expandedWidth={200}>
      {({ compact, closeIfFloating }) => <>
        <div className={'shrink-0 px-2 pb-2 pt-[6px] ' + (compact ? 'flex flex-col items-center gap-1.5' : 'space-y-2')}>
          <div className={'flex h-[32px] min-w-0 items-center rounded-lg ' + (compact ? 'w-[36px] justify-center px-0' : 'gap-2 px-1.5')}
            title={compact ? 'Alphaexplora client portal' : undefined}>
            <span className="flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center">
              <img src={alphaMarkUrl} alt="" aria-hidden="true" className="h-[24px] w-[20px] object-contain invert dark:invert-0" />
            </span>
            {!compact && <span className="truncate text-sm font-semibold text-content">Alphaexplora</span>}
          </div>
        </div>
        <nav aria-label="Client portal pages" className={'flex min-h-0 flex-1 flex-col overflow-hidden pb-1 ' + (compact ? 'items-center gap-0.5 px-1.5' : 'px-2')}>
          {CLIENT_PAGE_ORDER.map(id => {
            const { label, Icon } = CLIENT_PAGES[id];
            const active = currentNav === id;
            const waiting = id === 'proposals' ? proposalsNeedingReply : 0;
            const button = <button key={id} type="button" aria-label={waiting ? `${label}, ${waiting} waiting on your reply` : label} aria-current={active ? 'page' : undefined}
              onClick={() => { navigate(id); closeIfFloating(); }}
              className={(compact ? 'relative grid h-9 w-9 place-items-center rounded-lg transition-colors ' : sidebarRow + ' w-full gap-2.5 ')
                + (active ? 'bg-selected font-medium text-selected-content hover:bg-selected' : 'text-content-secondary hover:bg-surface-high hover:text-content')}>
              <span className={active ? 'text-link' : 'text-content-muted'}><Icon className="h-4 w-4" aria-hidden="true" /></span>
              {!compact && <span className="truncate">{label}</span>}
              {waiting > 0 && (compact
                ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" />
                : <span aria-hidden="true" className="ml-auto rounded-full bg-warning-subtle px-1.5 text-[11px] font-semibold leading-5 text-warning">{waiting}</span>)}
            </button>;
            return compact
              ? <Tooltip key={id}><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>
              : button;
          })}
        </nav>
        {/* The account menu holds sign-out, so the footer stays one quiet row, as for staff. */}
        <div className={'shrink-0 px-2 pb-2 pt-1 ' + (compact ? 'flex justify-center' : '')}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Account menu for ${clientName}`}
                className={'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus data-[state=open]:bg-surface-high '
                  + (compact ? 'grid h-9 w-9 place-items-center rounded-full hover:bg-surface-high' : 'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-surface-high')}>
                <span aria-hidden="true" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-divider bg-surface-raised text-xs font-semibold text-content">{clientInitials}</span>
                {!compact && <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-content" title={clientName}>{clientName}</span>
                  <span className="block truncate text-[11px] text-content-muted">Client</span>
                </span>}
                {!compact && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={compact ? 'right' : 'top'} align="start" sideOffset={6} data-sidebar-overlay=""
              className="w-[min(15rem,calc(100vw-1rem))] rounded-xl p-1.5">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-divider bg-surface-raised text-xs font-semibold text-content">{clientInitials}</span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-content">{clientName}</p>
                  {clientEmail && <p className="truncate text-[11px] text-content-muted">{clientEmail}</p>}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5 py-2 text-[13px] text-content-secondary focus:text-content"
                disabled={inspectionOnly || signingOut || Boolean(pending)} onSelect={() => void signOut()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />{signingOut ? 'Signing out…' : 'Log out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </>}
    </SidebarFrame>

    <div ref={workspaceFrameRef} className="client-portal-mainview">
      <header className="client-portal-toolbar client-portal-toolbar--shared" aria-label="Client portal navigation and actions">
        <WorkspaceToolbar actions={<>
          <button type="button" aria-label="Refresh portal" title="Refresh portal"
            onClick={() => { setQueueNotice(''); setRefreshVersion(value => value + 1); }}
            disabled={queueLoading || projectsLoading || notificationsLoading || Boolean(pending)} className="client-portal-action">
            <RefreshCw size={16} className={queueLoading || projectsLoading || notificationsLoading ? 'animate-spin' : ''} />
          </button>
          <ClientNotificationBell email={clientEmail} updates={portalUpdates} ready={notificationsLoaded && !projectsLoading}
            loading={notificationsLoading} error={notificationsError}
            onRefresh={() => setRefreshVersion(value => value + 1)} onOpen={openPortalUpdate} />
        </>}>
          <WorkspaceTabStrip label="Client portal pages">
            {tabs.map(tab => <WorkspaceTab key={tab.id} title={(tab.navigation.page === 'projects'
              && projects?.find(project => clientProjectKey(project) === tab.navigation.selectedProjectKey)?.name) || CLIENT_PAGES[tab.navigation.page].label}
              icon={clientPageIcon(tab.navigation.page, 14)}
              active={activeTabId === tab.id} onActivate={() => { if (activeTabId !== tab.id) changeWorkspaceTab(() => activateTab(tab.id)); }}
              onClose={() => {
                if (writing || pending || view === 'create') return;
                if (tab.id === activeTabId) changeWorkspaceTab(() => closeTab(tab.id));
                else closeTab(tab.id);
              }} closable={tabs.length > 1 && !writing && !pending && view !== 'create'} controls="client-portal-page" />)}
          </WorkspaceTabStrip>
          <WorkspaceNewTabMenu boundaryRef={workspaceFrameRef} portalRootRef={portalRootRef} disabled={writing || Boolean(pending) || view === 'create'}
            items={CLIENT_PAGE_ORDER.map(id => ({ id, title: CLIENT_PAGES[id].label, subtitle: CLIENT_PAGES[id].subtitle, icon: clientPageIcon(id, 18) }))} onSelect={id => changeWorkspaceTab(() => openTab(id as Page))} />
        </WorkspaceToolbar>
      </header>
      <div id="client-portal-page" role="tabpanel" aria-label={CLIENT_PAGES[currentNav].label} className="client-portal-main client-portal-main--workspace">
        {inspectionOnly && <p role="status" className="client-portal-notice">Read-only inspection. Sign-in, messages, decisions, uploads, downloads, and requests are disabled.</p>}
        {pageError && <div role="alert" className="client-portal-error"><AlertCircle size={16} />{pageError}</div>}
        {refreshError && <div role="status" className="client-portal-error">{refreshError}</div>}

        {page === 'overview' && <ClientOverviewPage clientName={session?.fullName ?? ''} requests={displayQueue} projects={projects ?? []}
          requestsLoading={!queue && !queueError} requestsError={queueError} projectsLoading={!projects && !projectsError} projectsError={projectsError}
          onOpenRequest={item => openRequest(item)} onOpenProject={openProject} onGoToProjects={() => navigate('projects')}
          onGoToRequests={() => navigate('requests')}
          onProposeProject={proposeProject} />}

        {page === 'projects' && view === 'create' && createContext && createProject && <div className="client-create-view client-create-view--project">
          <div className="client-create-project-context"><button type="button" className="client-back-link" onClick={cancelCreateForm}><ChevronLeft size={15} />Back to {createProject.name}</button>
            {createError && <p role="alert" className="client-project-error">{createError}</p>}
          </div>
          <ClientCreateTicketForm key={clientProjectKey(createProject)} context={createContext} submissionEnabled={!inspectionOnly && createContext.canCreate}
            relatedTicket={null} busy={writing || Boolean(pending)} error={writeError} onCreate={submitNewTicket} onCancel={cancelCreateForm}
            selectedProjectOptionId={createProject.intakeOptionId} selectedProjectName={createProject.name} />
        </div>}
        {tabs.filter(tab => tab.navigation.page === 'projects').map(tab => <div key={tab.id} hidden={tab.id !== activeTabId || view === 'create'} className="client-project-tab-pane">
          {tab.id === activeTabId && createError && <p role="alert" className="client-project-error">{createError}</p>}
          <ClientProjectsPage idPrefix={tab.id} api={api} projects={projects ?? []} requests={displayQueue?.items ?? []} loading={!projects && !projectsError} error={projectsError}
            selectedProjectKey={tab.navigation.selectedProjectKey} onSelectedProjectKeyChange={key => selectProject(tab.id, key)}
            onOpenRequest={item => openRequest(item, true)} onNewRequest={project => void openCreateForm(project)}
            inspectionOnly={inspectionOnly} newRequestEnabled={canStartProjectRequest} newRequestLoading={createLoading}
            projectFocusVersion={tab.navigation.notificationProjectFocus} refreshToken={refreshVersion}
            proposalsNeedingReply={proposalsNeedingReply} onOpenProposals={() => navigate('proposals')} onProposeProject={proposeProject} />
        </div>)}

        {page === 'proposals' && <ClientProposalsPage key={activeTabId} idPrefix={activeTabId} api={api} projects={projects ?? []}
          proposals={projectProposals ?? []} loading={projectProposalsLoading || (!projectProposals && !projectProposalsError)} error={projectProposalsError}
          inspectionOnly={inspectionOnly} selectedProposalId={selectedProposalId} onSelectedProposalIdChange={setSelectedProposalId}
          onRefresh={() => setRefreshVersion(value => value + 1)} onSubmitted={() => setRefreshVersion(value => value + 1)}
          onOpenProject={openProject} openForm={proposeRequestTab === activeTabId} onOpenFormHandled={() => setProposeRequestTab(null)} />}

        {page === 'requests' && <div className={`client-requests-page ${selectedId ? 'has-selected-request' : ''}`}>
          <section className={`client-portal-page-heading ${selectedId && !requestListShown ? 'client-mobile-heading-hidden' : ''}`} aria-label="Request overview">
            <div><h1>Requests</h1><p className="client-page-description">Everything you’ve asked for, and where each one stands.</p></div>
            {queue && queue.counters.needsClient > 0 && !workflowActionsDisabled && <button type="button" className="client-attention-link" onClick={() => { setFilter('needs_client'); setSearchInput(''); setSearch(''); }}>
              <span className="client-attention-dot" /><span><strong>{queue.counters.needsClient} {queue.counters.needsClient === 1 ? 'request needs' : 'requests need'} your attention</strong><small>Open a request to see the next step.</small></span><ArrowRight size={17} />
            </button>}
            {queue && queue.counters.needsClient === 0 && !workflowActionsDisabled && <p className="client-all-caught-up"><Check size={15} />Nothing needs your reply right now</p>}
          </section>
          {queueNotice && <p role="status" className="client-project-pending-notice">{queueNotice}</p>}
          {queueError && <p role="alert" className="client-project-error">{queueError}</p>}
          {/* Collapsing narrows the list beside an open request. With none open the list is
              the whole page, so the remembered preference must not shrink or empty it. */}
          <section className={`client-portal-workspace client-portal-workspace--requests ${selectedId ? 'has-selected-request' : ''} ${selectedId && navigationCollapsed ? 'is-navigation-collapsed' : ''}`} aria-label="Your requests and updates">
            <aside className={`client-request-list ${selectedId && navigationCollapsed ? 'is-collapsed' : ''} ${selectedId && !requestListShown ? 'client-mobile-hidden' : ''}`} aria-label="Request list"
              title={selectedId ? 'Click empty space to collapse or expand request navigation' : undefined}
              onClick={event => {
                if (!selectedId) return;
                const target = event.target;
                if (target instanceof HTMLElement && target.closest('button,a,input,textarea,select')) return;
                setNavigationCollapsed(value => !value);
              }}>
              <div className="client-list-header">
                <div className="client-list-title"><h2>Requests</h2></div>
                {selectedId && <button type="button" className="role-chat-navigation-toggle"
                  aria-label={navigationCollapsed ? 'Show request navigation' : 'Collapse request navigation'} aria-expanded={!navigationCollapsed}
                  onClick={event => { event.stopPropagation(); setNavigationCollapsed(value => !value); }}>
                  {navigationCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
                </button>}
              </div>
              <div className={`client-request-toolbar ${selectedId ? 'is-detail' : 'is-list'}`}>
                {selectedId ? <label className="client-request-filter-select">
                  <span className="sr-only">Filter requests</span>
                  <select value={filter} disabled={Boolean(pending)} onChange={event => setFilter(event.target.value as NonNullable<Filter>)}>
                    {filters.filter(option => !workflowActionsDisabled || option.id !== 'needs_client').map(option => {
                      const count = queue?.counters.kind !== 'client' ? null : option.id === 'open' ? queue.counters.open : option.id === 'needs_client' ? queue.counters.needsClient : null;
                      return <option key={option.id} value={option.id}>{count === null ? option.label : `${option.label} (${count})`}</option>;
                    })}
                  </select>
                  <ChevronDown size={14} aria-hidden />
                </label> : <>
                  <div className="client-request-filters" aria-label="Filter requests">{filters.filter(option => !workflowActionsDisabled || option.id !== 'needs_client').map(option => {
                    const count = queue?.counters.kind !== 'client' ? null : option.id === 'open' ? queue.counters.open : option.id === 'needs_client' ? queue.counters.needsClient : null;
                    const active = filter === option.id;
                    return <button key={option.id} aria-pressed={active} disabled={Boolean(pending)} onClick={() => setFilter(option.id)} className={`client-request-filter ${active ? 'is-active' : ''}`}>
                      {option.label}{count !== null && <span>{count}</span>}</button>;
                  })}</div>
                  <label className="client-search"><Search size={16} /><span className="sr-only">Search requests</span>
                    <input value={searchInput} onChange={event => setSearchInput(event.target.value)} disabled={Boolean(pending)} placeholder="Search requests" /></label>
                </>}
              </div>
              <div className="client-request-items">
                {!queue && !queueError ? <LoadingRows label="Loading your requests" rows={4} className="px-3" />
                  : queue?.items.length ? CLIENT_REQUEST_GROUPS.map(group => {
                    // Grouped by what the client needs to do, so the list reads as a to-do list rather than a ticket queue.
                    const rows = queue.items.filter(item => clientRequestGroup(workflowActionsDisabled ? { ...item, requestedAction: null } : item) === group.id);
                    if (!rows.length) return null;
                    return <div key={group.id} role="group" aria-label={group.label} className={`client-request-group is-${group.id}`}>
                      <p className="client-request-group-label" aria-hidden="true">{group.label}<span>{rows.length}</span></p>
                      {rows.map(item => {
                        const pendingLink = item.projectLinkStatus === 'pending_review';
                        return <button key={rowKey(item)} aria-pressed={selectedId === item.id && selectedWorkspaceId === item.workspaceId} disabled={Boolean(pending)}
                          onClick={() => openRequest(item)} className={`client-request-row ${selectedId === item.id && selectedWorkspaceId === item.workspaceId ? 'is-selected' : ''}`}>
                          <span className="client-request-icon" aria-hidden="true"><FileText size={18} /></span>
                          <span className="client-request-copy"><span className="client-request-title">{item.title}</span>
                            <span className="client-request-meta"><StatusPill status={item.status} /></span>
                            <span className={`client-request-progress ${pendingLink ? 'needs-action' : item.requestedAction && !workflowActionsDisabled ? 'needs-action' : ''}`}>
                              {pendingLink ? `Your project manager is confirming the project${item.requestedProjectName ? ` · ${item.requestedProjectName}` : ''}`
                                : clientTicketProgress(item.status, workflowActionsDisabled ? null : item.requestedAction).label}</span>
                            <time dateTime={item.updatedAt} title={time(item.updatedAt)}>Updated {relativeTime(item.updatedAt)}</time>
                          </span><ArrowRight size={16} className="client-request-chevron" aria-hidden="true" />
                        </button>;
                      })}
                    </div>;
                  }) : !queueError && <EmptyState title={search ? 'No requests match your search' : 'No requests in this filter'}
                    body={search ? 'Try a shorter search or clear the search field.' : 'Requests from your project manager and requests awaiting review will appear here.'} />}
              </div>
              {queue && <div className="client-list-footer"><span>{queue.items.length} shown</span>{queue.nextCursor && <button onClick={() => void loadMoreQueue()} disabled={queueMoreLoading || queueLoading}>
                {queueMoreLoading ? 'Loading…' : 'Load more'}</button>}</div>}
            </aside>
            <section className={`client-request-detail-pane ${selectedId && !requestListShown ? '' : 'client-mobile-hidden'}`} aria-label="Selected request">
              {!selectedId ? <EmptyState title="Choose a request" body="Select a request to see its status, messages, and any action your project manager needs from you." />
                : !activeRequest ? <EmptyState title="Request not available" body="Refresh the list and try again. If it is still missing, contact your project manager." />
                    : (detailLoading || (!detail && !detailError)) ? <TicketDetailSkeleton label="Loading request" stepper />
                      : detailError ? <div role="alert" className="m-4 rounded-lg border border-status-danger-border bg-status-danger-subtle p-4 text-xs text-status-danger">{detailError}</div>
                        : detail && <>
                          {showPendingLinkNotice && <div role="status" className="client-project-pending-notice">
                            <strong>PM review pending</strong><span>This request is not linked to a project yet. Your project manager must review and confirm the project link before it appears in that project.</span>
                          </div>}
                          <ClientTicketDetail workspaceId={activeRequest.workspaceId} api={api} key={`${activeTabId}:${activeRequest.workspaceId}:${detail.id}`}
                            replyDraft={replyDrafts[`${activeRequest.workspaceId}:${detail.id}`] ?? ''}
                            onReplyDraftChange={value => setReplyDrafts(previous => ({ ...previous, [`${activeRequest.workspaceId}:${detail.id}`]: value }))}
                            ticket={detail} messages={messages} messageCursor={messageCursor} historyLoading={historyLoading} historyError={historyError}
                            busy={writing || Boolean(pending)} error={writeError} replyResetVersion={replyResetVersion}
                            workflowActionsDisabled={workflowActionsDisabled} newRequestsDisabled communicationEnabled={communicationEnabled && !inspectionOnly}
                            readOnlyPreview={inspectionOnly}
                            backLabel={returnToProjects ? 'Back to project requests' : 'Back to requests'}
                            onBack={() => { historyGeneration.current += 1; setSelectedId(null); setSelectedWorkspaceId(null); setSelectedItemFallback(null);
                              setRequestListShown(true); if (returnToProjects) { setPage('projects'); setReturnToProjects(false); } }}
                            onLoadMore={() => void loadMoreMessages()} onReply={sendReply} onCorrection={sendCorrection} onDecision={makeDecision}
                            onAdditionalWork={() => undefined} />
                        </>}
            </section>
          </section>
        </div>}

        {pending && <div role="status" className="client-pending-operation">
          <span>We’re checking whether your update was saved. Please don’t send it again yet.</span>
          <button onClick={() => void performWrite(pending).catch(() => undefined)} disabled={writing} className={secondary}>{writing ? 'Checking…' : 'Check update status'}</button>
        </div>}
        {clientToast && <div className="pointer-events-none fixed right-5 top-5 z-[80] w-[calc(100%-2.5rem)] max-w-sm" aria-live="polite" aria-atomic="true">
          <Toast {...clientToast} onDismiss={() => setClientToast(null)} className="pointer-events-auto" />
        </div>}
        {session?.expiresAt && <span className="sr-only">Session expires {session.expiresAt}</span>}
      </div>
    </div>
  </main>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="client-empty-state"><Ticket aria-hidden="true" size={22} /><p>{title}</p><p>{body}</p></div>;
}
