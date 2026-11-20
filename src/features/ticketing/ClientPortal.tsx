import { EntrySkeleton, LoadingRows } from '@/shared/components/ui/skeleton';
import { TicketDetailSkeleton } from './TicketingSkeletons';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  AlertCircle, FolderKanban, House, Lightbulb, ListChecks, LogOut, Plus, RefreshCw, Search, type LucideIcon,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

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
import { CLIENT_REQUEST_GROUPS, CLIENT_STEP_GUIDE, clientRequestGroup } from './clientFriendly';
import { effectivePortalFilter, portalFilterFromHash } from './clientPortalLink';
import { ClientOverviewPage, ClientProjectsPage, clientProjectKey } from './ClientProjectPages';
import { ClientProposalsPage } from './ClientProposalsPage';
import { Toast, type ToastTone } from '@/shared/components/ui/toast';
import { ClientTabBar, ClientTopBar } from './ClientTopBar';
import { CxChips, CxEmpty, CxPageHeader, CxPanel, CxRequestRow, CxRow, CxSection } from './clientKit';
import { ClientConversationRequestPage, ClientProjectConversation } from './ClientProjectConversation';
import type { ConversationRequest } from './projectConversation';
import { useClientWorkspaceTabs, type ClientPage as Page } from './clientWorkspaceTabs';
import './clientDesignTokens.css';
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
  proposals: { label: 'Project ideas', subtitle: 'New project ideas you have sent to your project manager', Icon: Lightbulb },
  requests: { label: 'Requests', subtitle: 'Follow requests and message your project manager', Icon: ListChecks },
};

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
  // One page at a time: the portal keeps a single workspace tab, so clients never manage browser-style tabs.
  const { tabs, activeTabId, tabState, resetTabs, selectProject } = useClientWorkspaceTabs(
    typeof window === 'undefined' ? 'all' : portalFilterFromHash(window.location.hash));
  const portalRootRef = useRef<HTMLElement>(null);
  /** The scrolling page area; each new page or opened request starts at the top. */
  const pageScrollRef = useRef<HTMLDivElement>(null);
  /** Where the open request's back button returns: Home, when it was opened from Home. */
  const [returnToHome, setReturnToHome] = useState(false);
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
  const [selectedConversationKey, setSelectedConversationKey] = tabState('selectedConversationKey');
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

  useEffect(() => { pageScrollRef.current?.scrollTo?.({ top: 0 }); }, [page, view, selectedId, selectedProjectKey]);

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

  async function openCreateForm(project: ClientProject, fromChooser = false) {
    if (!canStartProjectRequest || (!fromChooser && (!selectedProjectKey || selectedProjectKey !== clientProjectKey(project)))
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
        setCreateContext(null); setCreateProject(null);
      },
    }).catch(() => undefined);
  }

  function openRequest(item: ClientProjectRequestItem, fromProject = false, fromHome = false) {
    setReturnToHome(fromHome);
    historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(item.id); setSelectedWorkspaceId(item.workspaceId);
    setSelectedItemFallback(item); setReturnToProjects(fromProject); setPage('requests'); setView('portal'); setWriteError('');
    if (fromProject) { setFilter('all'); setSearchInput(''); setSearch(''); }
  }

  /** Leaves the open request for wherever it was opened from. */
  function closeRequest() {
    historyGeneration.current += 1; setSelectedId(null); setSelectedWorkspaceId(null); setSelectedItemFallback(null);
    if (returnToProjects) { setPage('projects'); setReturnToProjects(false); }
    else if (returnToHome) { setPage('overview'); setReturnToHome(false); }
  }

  /** "New request": a project the client already has, or a new project idea. */
  function startRequestFor(project: ClientProject) {
    navigate('projects'); setSelectedProjectKey(clientProjectKey(project));
    void openCreateForm(project, true);
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
    // Choosing Requests from the navigation shows the list, not the last request that was open.
    if (nextPage === 'requests') {
      historyGeneration.current += 1; setSelectedId(null); setSelectedWorkspaceId(null); setSelectedItemFallback(null); setReturnToHome(false);
      setSelectedConversationKey(null);
    }
  }

  /** A project's one conversation, on the Requests page. */
  /**
   * A project's one conversation. With an open request it shows beside that request
   * (the newest open one); without one, on its own with the project's requests.
   */
  function openConversation(project: ClientProject) {
    const onProject = (queue?.items ?? []).filter(item => item.workspaceId === project.workspaceId && item.projectId === project.projectId);
    const first = onProject.find(item => !['closed', 'declined', 'cancelled'].includes(item.status)) ?? onProject[0];
    if (first) { setSelectedConversationKey(null); openRequest(first); return; }
    navigate('requests');
    setSelectedConversationKey(clientProjectKey(project));
  }

  /** Opens a request by ID, as one just made that is not in the loaded list yet. */
  function openRequestById(workspaceId: string, ticketId: string) {
    const item = queue?.items.find(entry => entry.id === ticketId && entry.workspaceId === workspaceId);
    if (item) { openRequest(item); return; }
    historyGeneration.current += 1; setSelectedId(ticketId); setSelectedWorkspaceId(workspaceId); setSelectedItemFallback(null);
    setReturnToProjects(false); setReturnToHome(false); setPage('requests'); setView('portal'); setRefreshVersion(value => value + 1);
  }

  /** Another request picked in the conversation's Requests list. */
  function openConversationRequest(request: ConversationRequest) {
    openRequestById(request.workspaceId, request.ticketId);
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
  // A request on a shared project shows inside that project's one conversation.
  const requestProject = activeRequest?.projectId ? (projects ?? []).find(project => project.workspaceId === activeRequest.workspaceId
    && project.projectId === activeRequest.projectId) ?? null : null;
  const requestConversation: RequestConversation | null = requestProject ? {
    project: requestProject, clientName: session?.fullName?.trim() || 'Client', readOnly: inspectionOnly,
    canCreateRequests: canStartProjectRequest, onSelectRequest: openConversationRequest,
    onRequestCreated: ticketId => openRequestById(requestProject.workspaceId, ticketId),
  } : null;
  const conversationProject = (projects ?? []).find(project => clientProjectKey(project) === selectedConversationKey) ?? null;
  const openOnProject = (project: ClientProject) => (displayQueue?.items ?? []).filter(item => item.workspaceId === project.workspaceId
    && item.projectId === project.projectId && !['closed', 'declined', 'cancelled'].includes(item.status)).length;
  const showPendingLinkNotice = activeRequest?.projectLinkStatus === 'pending_review';
  const proposalsNeedingReply = (projectProposals ?? []).filter(proposal => proposal.status === 'awaiting_client').length;
  const proposeProject = inspectionOnly ? undefined : () => { setProposeRequestTab(activeTabId); navigate('proposals'); };
  const clientEmail = session?.email?.trim() ?? '';
  const clientName = session?.fullName?.trim() || 'Client';
  const clientInitials = clientName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  const newRequestMenu = !inspectionOnly && (canStartProjectRequest || proposeProject)
    ? (trigger: ReactNode) => <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={createLoading || writing || Boolean(pending)}>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-[min(18rem,calc(100vw-1rem))] rounded-xl p-1.5">
        <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-content-secondary">What is this for?</p>
        {canStartProjectRequest && (projects ?? []).map(project => <DropdownMenuItem key={clientProjectKey(project)}
          className="gap-2.5 py-2 text-[13px]" onSelect={() => startRequestFor(project)}>
          <FolderKanban className="h-4 w-4 text-content-muted" aria-hidden="true" /><span className="truncate">{project.name}</span>
        </DropdownMenuItem>)}
        {canStartProjectRequest && (projects ?? []).length > 0 && proposeProject && <DropdownMenuSeparator />}
        {proposeProject && <DropdownMenuItem className="gap-2.5 py-2 text-[13px]" onSelect={() => proposeProject()}>
          <Lightbulb className="h-4 w-4 text-content-muted" aria-hidden="true" />
          <span><span className="block">Something new</span><span className="block text-xs text-content-muted">Suggest a new project</span></span>
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu> : null;
  const needsYouCount = (workflowActionsDisabled ? 0 : queue?.counters.needsClient ?? 0) + proposalsNeedingReply;
  const goTo = (target: Page) => { if (!writing && !pending) navigate(target); };
  /** Requests and project ideas share one header: ideas are one of the Requests views. */
  const requestViews = [
    ...filters.filter(option => !workflowActionsDisabled || option.id !== 'needs_client').map(option => ({
      id: option.id as string, label: option.label, tone: option.id === 'needs_client' ? 'attention' as const : undefined,
      count: queue?.counters.kind !== 'client' ? null : option.id === 'open' ? queue.counters.open : option.id === 'needs_client' ? queue.counters.needsClient : null,
    })),
    { id: 'ideas', label: 'Project ideas', count: proposalsNeedingReply || (projectProposals?.length ?? null),
      tone: proposalsNeedingReply ? 'attention' as const : undefined },
  ];
  const requestsHeader = <>
    <CxPageHeader titleId={activeTabId + '-requests-title'} title="Requests"
      description="Everything you’ve asked for, including new project ideas, and where each one stands." />
    <CxChips label="Show" value={page === 'proposals' ? 'ideas' : filter as string} options={requestViews} disabled={Boolean(pending)}
      onChange={(value: string) => { if (value === 'ideas') { goTo('proposals'); return; } if (page !== 'requests') goTo('requests');
        setFilter(value as NonNullable<Filter>); setSearchInput(''); setSearch(''); }} />
  </>;

  return <main ref={portalRootRef} className={'client-portal-shell cx-shell' + (inspectionOnly ? ' client-portal-shell--inspection' : '')}>
    <ClientTopBar page={page} onNavigate={goTo} needsYou={needsYouCount}
      newRequest={newRequestMenu?.(<button type="button" className="cx-button is-primary cx-new-request"><Plus size={15} aria-hidden="true" />{createLoading ? 'Checking access…' : 'New request'}</button>)}
      actions={<>
        <button type="button" aria-label="Refresh portal" title="Refresh portal"
          onClick={() => { setQueueNotice(''); setRefreshVersion(value => value + 1); }}
          disabled={queueLoading || projectsLoading || notificationsLoading || Boolean(pending)} className="cx-icon-button">
          <RefreshCw size={16} className={queueLoading || projectsLoading || notificationsLoading ? 'animate-spin' : ''} />
        </button>
        <ClientNotificationBell email={clientEmail} updates={portalUpdates} ready={notificationsLoaded && !projectsLoading}
          loading={notificationsLoading} error={notificationsError}
          onRefresh={() => setRefreshVersion(value => value + 1)} onOpen={openPortalUpdate} />
      </>}
      account={<DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="cx-avatar" aria-label={'Account menu for ' + clientName}>{clientInitials}</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-[min(15rem,calc(100vw-1rem))] rounded-xl p-1.5">
          <div className="min-w-0 px-2 py-2">
            <p className="truncate text-[13px] font-medium text-content">{clientName}</p>
            {clientEmail && <p className="truncate text-xs text-content-muted">{clientEmail}</p>}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2.5 py-2 text-[13px] text-content-secondary focus:text-content"
            disabled={inspectionOnly || signingOut || Boolean(pending)} onSelect={() => void signOut()}>
            <LogOut className="h-4 w-4" aria-hidden="true" />{signingOut ? 'Signing out…' : 'Log out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>} />
    <div ref={pageScrollRef} id="client-portal-page" aria-label={CLIENT_PAGES[page].label} className="cx-main">
        {inspectionOnly && <p role="status" className="cx-status-note cx-notice">Read-only inspection. Sign-in, messages, decisions, uploads, downloads, and requests are disabled.</p>}
        {pageError && <p role="alert" className="cx-error cx-notice"><AlertCircle size={14} aria-hidden="true" /> {pageError}</p>}
        {refreshError && <p role="status" className="cx-error cx-notice">{refreshError}</p>}

        {page === 'overview' && <ClientOverviewPage clientName={session?.fullName ?? ''} requests={displayQueue} projects={projects ?? []}
          api={api} refreshToken={refreshVersion}
          requestsLoading={!queue && !queueError} requestsError={queueError} projectsLoading={!projects && !projectsError} projectsError={projectsError}
          onOpenRequest={item => openRequest(item, false, true)} onOpenProject={openProject} onGoToProjects={() => navigate('projects')}
          onGoToRequests={() => navigate('requests')}
          proposalsNeedingReply={proposalsNeedingReply} onOpenProposals={() => navigate('proposals')}
          onProposeProject={proposeProject} />}

        {page === 'projects' && view === 'create' && createContext && createProject && <div className="cx-page cx-form-page">
          <CxPageHeader titleId={activeTabId + '-new-request-title'} title="New request"
            back={{ label: 'Back to ' + createProject.name, onClick: cancelCreateForm, disabled: Boolean(pending) }}
            description={'For ' + createProject.name + '. Your project manager will review it before any work is scheduled.'} />
          {createError && <p role="alert" className="cx-error">{createError}</p>}
          <ClientCreateTicketForm key={clientProjectKey(createProject)} embedded context={createContext} submissionEnabled={!inspectionOnly && createContext.canCreate}
            relatedTicket={null} busy={writing || Boolean(pending)} error={writeError} onCreate={submitNewTicket} onCancel={cancelCreateForm}
            selectedProjectOptionId={createProject.intakeOptionId} selectedProjectName={createProject.name} />
        </div>}
        {tabs.filter(tab => tab.navigation.page === 'projects').map(tab => <div key={tab.id} hidden={tab.id !== activeTabId || view === 'create'}>
          {tab.id === activeTabId && createError && <p role="alert" className="cx-error cx-notice">{createError}</p>}
          <ClientProjectsPage idPrefix={tab.id} api={api} projects={projects ?? []} requests={displayQueue?.items ?? []} loading={!projects && !projectsError} error={projectsError}
            selectedProjectKey={tab.navigation.selectedProjectKey} onSelectedProjectKeyChange={key => selectProject(tab.id, key)}
            onOpenRequest={item => openRequest(item, true)} onNewRequest={project => void openCreateForm(project)}
            onOpenConversation={project => openConversation(project)}
            inspectionOnly={inspectionOnly} newRequestEnabled={canStartProjectRequest} newRequestLoading={createLoading}
            projectFocusVersion={tab.navigation.notificationProjectFocus} refreshToken={refreshVersion}
            proposalsNeedingReply={proposalsNeedingReply} onOpenProposals={() => navigate('proposals')} onProposeProject={proposeProject} />
        </div>)}

        {page === 'proposals' && <div className="cx-page">{requestsHeader}<ClientProposalsPage key={activeTabId} idPrefix={activeTabId} api={api} projects={projects ?? []}
          proposals={projectProposals ?? []} loading={projectProposalsLoading || (!projectProposals && !projectProposalsError)} error={projectProposalsError}
          inspectionOnly={inspectionOnly} selectedProposalId={selectedProposalId} onSelectedProposalIdChange={setSelectedProposalId}
          onRefresh={() => setRefreshVersion(value => value + 1)} onSubmitted={() => setRefreshVersion(value => value + 1)}
          onOpenProject={openProject} openForm={proposeRequestTab === activeTabId} onOpenFormHandled={() => setProposeRequestTab(null)} /></div>}

        {page === 'requests' && !selectedId && conversationProject && <ClientProjectConversation key={activeTabId + ':' + selectedConversationKey}
          api={api} project={conversationProject} clientName={clientName} readOnly={inspectionOnly} canCreateRequests={canStartProjectRequest}
          onBack={() => setSelectedConversationKey(null)} onSelectRequest={openConversationRequest}
          onRequestCreated={ticketId => openRequestById(conversationProject.workspaceId, ticketId)} />}

        {page === 'requests' && !selectedId && !conversationProject && <div className="cx-page">
          {requestsHeader}
          {(projects ?? []).length > 0 && <CxSection titleId={activeTabId + '-conversations'} title="Conversations" count={(projects ?? []).length}>
            <p className="cx-page-description">One conversation per project with your project manager. Make new requests there and tick them off when they are done.</p>
            <CxPanel>{(projects ?? []).map(project => {
              const open = openOnProject(project);
              return <CxRow key={clientProjectKey(project)} title={project.name} disabled={Boolean(pending)}
                meta={open ? `${open} open ${open === 1 ? 'request' : 'requests'}` : 'No open requests'} onClick={() => openConversation(project)} />;
            })}</CxPanel>
          </CxSection>}
          <div className="cx-toolbar">
            <label className="cx-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search requests</span>
              <input value={searchInput} onChange={event => setSearchInput(event.target.value)} disabled={Boolean(pending)} placeholder="Search requests" /></label>
          </div>
          {queueNotice && <p role="status" className="cx-status-note">{queueNotice}</p>}
          {queueError && <p role="alert" className="cx-error">{queueError}</p>}
          <div className="cx-requests-layout"><div className="cx-requests-main">
          {!queue && !queueError ? <CxPanel><LoadingRows label="Loading your requests" rows={4} className="px-3" /></CxPanel>
            : displayQueue?.items.length ? <div className="cx-request-groups">{CLIENT_REQUEST_GROUPS.map(group => {
              // Grouped by what the client needs to do, so the list reads as a to-do list rather than a ticket queue.
              const rows = displayQueue.items.filter(item => clientRequestGroup(item) === group.id);
              if (!rows.length) return null;
              return <CxSection key={group.id} titleId={activeTabId + '-requests-' + group.id} title={group.label} count={rows.length}>
                <CxPanel tone={group.id === 'needs_you' ? 'attention' : undefined}>
                  {rows.map(item => <CxRequestRow key={rowKey(item)} item={item} disabled={Boolean(pending)} onOpen={openRequest} />)}
                </CxPanel>
              </CxSection>;
            })}</div>
              : !queueError && <CxPanel><CxEmpty title={search ? 'No requests match your search' : 'No requests here yet'}
                body={search ? 'Try a shorter search or clear the search field.' : 'Requests you send, and the ones your project manager opens for you, appear here.'} /></CxPanel>}
          {queue && <div className="cx-list-footer"><span>{queue.items.length} shown</span>{queue.nextCursor && <button type="button" className="cx-button" onClick={() => void loadMoreQueue()} disabled={queueMoreLoading || queueLoading}>
            {queueMoreLoading ? 'Loading…' : 'Load more'}</button>}</div>}
          </div>
          <aside className="cx-guide" aria-labelledby={activeTabId + '-guide-title'}>
            <h2 id={activeTabId + '-guide-title'}>How a request moves</h2>
            <ol>{CLIENT_STEP_GUIDE.map((step, index) => <li key={step.label}><span aria-hidden="true">{index + 1}</span>
              <p><strong>{step.label}</strong>{step.detail}</p></li>)}</ol>
          </aside></div>
        </div>}

        {page === 'requests' && selectedId && <div className="cx-request-page">
          {queueNotice && <p role="status" className="cx-status-note">{queueNotice}</p>}
          {!activeRequest ? <CxPanel><CxEmpty title="Request not available" body="Refresh and try again. If it is still missing, contact your project manager."
            action={<button type="button" className="cx-button" onClick={closeRequest}>Back to requests</button>} /></CxPanel>
            : (detailLoading || (!detail && !detailError)) ? <TicketDetailSkeleton label="Loading request" stepper />
              : detailError ? <p role="alert" className="cx-error">{detailError}</p>
                : detail && <>
                  {showPendingLinkNotice && <p role="status" className="cx-status-note"><strong>Waiting for your project manager</strong>
                    This request is not linked to a project yet. Your project manager will confirm the project before it shows there.</p>}
                  <PortalRequestPage projectConversation={requestConversation} workspaceId={activeRequest.workspaceId} api={api} key={activeTabId + ':' + activeRequest.workspaceId + ':' + detail.id}
                    replyDraft={replyDrafts[activeRequest.workspaceId + ':' + detail.id] ?? ''}
                    onReplyDraftChange={value => setReplyDrafts(previous => ({ ...previous, [activeRequest.workspaceId + ':' + detail.id]: value }))}
                    ticket={detail} messages={messages} messageCursor={messageCursor} historyLoading={historyLoading} historyError={historyError}
                    busy={writing || Boolean(pending)} error={writeError} replyResetVersion={replyResetVersion}
                    workflowActionsDisabled={workflowActionsDisabled} newRequestsDisabled communicationEnabled={communicationEnabled && !inspectionOnly}
                    readOnlyPreview={inspectionOnly}
                    backLabel={returnToProjects ? 'Back to project' : returnToHome ? 'Back to Home' : 'Back to requests'}
                    onBack={closeRequest}
                    onLoadMore={() => void loadMoreMessages()} onReply={sendReply} onCorrection={sendCorrection} onDecision={makeDecision}
                    onAdditionalWork={() => undefined} />
                </>}
        </div>}
        {pending && <div role="status" className="cx-status-note cx-notice cx-pending">
          <span>We’re checking whether your update was saved. Please don’t send it again yet.</span>
          <button onClick={() => void performWrite(pending).catch(() => undefined)} disabled={writing} className="cx-button">{writing ? 'Checking…' : 'Check update status'}</button>
        </div>}
        {clientToast && <div className="pointer-events-none fixed right-5 top-5 z-[80] w-[calc(100%-2.5rem)] max-w-sm" aria-live="polite" aria-atomic="true">
          <Toast {...clientToast} onDismiss={() => setClientToast(null)} className="pointer-events-auto" />
        </div>}
        {session?.expiresAt && <span className="sr-only">Session expires {session.expiresAt}</span>}
    </div>
    <ClientTabBar page={page} onNavigate={goTo} needsYou={needsYouCount} newRequest={newRequestMenu} />
  </main>;
}


type RequestConversation = Omit<ComponentProps<typeof ClientConversationRequestPage>, keyof ComponentProps<typeof ClientTicketDetail>>;

/** A request on a shared project opens inside the project's one conversation; any other request keeps its own messages. */
function PortalRequestPage({ projectConversation, ...props }: Readonly<ComponentProps<typeof ClientTicketDetail> & { projectConversation: RequestConversation | null }>) {
  return projectConversation ? <ClientConversationRequestPage {...props} {...projectConversation} /> : <ClientTicketDetail {...props} />;
}
