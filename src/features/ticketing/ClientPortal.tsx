import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, ChevronLeft, FileText, FolderKanban, LayoutDashboard,
  ListChecks, LogOut, Pin, RefreshCw, Search, Ticket,
} from 'lucide-react';

import alphaMarkUrl from '@/assets/alpha-mark.png';
import type {
  ClientProject, ClientProjectRequestItem, ClientProjectRequestQueue, ClientSession,
  ClientTicketCommandInput, ClientTicketCreateInput, ClientTicketDetail as TicketDetail,
  ClientTicketMessage, ClientTicketReceipt, ClientTicketReplyInput,
} from './clientApi';
import { ClientTicketApiError, clientTicketApi } from './clientApi';
import { ClientCreateTicketForm } from './ClientCreateTicketForm';
import { ClientTicketDetail } from './ClientTicketDetail';
import { ClientAccessPanel } from './ClientAccessPanel';
import { ClientPasswordSignIn } from './ClientPasswordSignIn';
import { clientTicketProgress } from './clientTicketProgress';
import { effectivePortalFilter, portalFilterFromHash } from './clientPortalLink';
import { secondary, time } from './ticketUi';
import { ClientOverviewPage, ClientProjectsPage, clientProjectKey } from './ClientProjectPages';
import './clientPortal.css';
import { mergeClientMessages, startClientAutoRefresh } from './clientAutoRefresh';

type Filter = NonNullable<Parameters<typeof clientTicketApi.listRequests>[0]>['filter'];
type PortalState = 'checking' | 'signed_out' | 'unavailable' | 'ready';
type Page = 'overview' | 'projects' | 'requests';
interface PendingOperation {
  operationId: string;
  label: string;
  run: () => Promise<ClientTicketReceipt>;
  onSuccess?: (receipt: ClientTicketReceipt) => void;
}
interface PendingProjectReview { ticketId: string; project: ClientProject }

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
  const [portalState, setPortalState] = useState<PortalState>('checking');
  const [session, setSession] = useState<ClientSession | null>(null);
  const [phaseWorkflowEnabled, setPhaseWorkflowEnabled] = useState(false);
  const [workflowChecked, setWorkflowChecked] = useState(false);
  const [projects, setProjects] = useState<ClientProject[] | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [page, setPage] = useState<Page>('overview');
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [queue, setQueue] = useState<ClientProjectRequestQueue | null>(null);
  const [filter, setFilter] = useState<NonNullable<Filter>>(() => (typeof window === 'undefined' ? 'all' : portalFilterFromHash(window.location.hash)));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedItemFallback, setSelectedItemFallback] = useState<ClientProjectRequestItem | null>(null);
  const [returnToProjects, setReturnToProjects] = useState(false);
  const [pendingProjectReview, setPendingProjectReview] = useState<PendingProjectReview | null>(null);
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
  const [requestListShown, setRequestListShown] = useState(true);
  const queueGeneration = useRef(0);
  const historyGeneration = useRef(0);
  const writeLock = useRef(false);
  const queueSnapshot = useRef(queue);
  queueSnapshot.current = queue;

  const workflowActionsDisabled = workflowActionsDisabledOverride || !phaseWorkflowEnabled;
  const canStartProjectRequest = !newRequestsDisabled && !inspectionOnly;
  const selectedQueueItem = useMemo(() => {
    if (!selectedId || !selectedWorkspaceId) return null;
    return queue?.items.find(item => item.id === selectedId && item.workspaceId === selectedWorkspaceId)
      ?? (selectedItemFallback?.id === selectedId && selectedItemFallback.workspaceId === selectedWorkspaceId ? selectedItemFallback : null);
  }, [queue, selectedId, selectedWorkspaceId, selectedItemFallback]);

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

  function clearExpiredClientSession(): void {
    setSession({ authenticated: false }); setPortalState('signed_out');
    setProjects(null); setQueue(null); setSelectedId(null); setSelectedWorkspaceId(null); setSelectedItemFallback(null);
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
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

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
    const generation = ++queueGeneration.current;
    setQueueLoading(true); setQueueMoreLoading(false); setQueueError(''); setRefreshError('');
    void api.listRequests({ limit: 50, filter, search }).then(result => {
      if (!current || generation !== queueGeneration.current) return;
      setQueue(result);
      setSelectedId(existing => existing && (result.items.some(item => item.id === existing)
        || (selectedItemFallback?.id === existing && selectedItemFallback.workspaceId === selectedWorkspaceId)
        || pendingProjectReview?.ticketId === existing) ? existing : null);
      setSelectedItemFallback(existing => existing && result.items.some(item => item.id === existing.id && item.workspaceId === existing.workspaceId)
        ? null : existing);
    }).catch(error => {
      if (!current || generation !== queueGeneration.current) return;
      if (isExpiredClientSession(error)) return;
      setQueue(null); setSelectedId(null); setQueueError(friendlyError(error, 'queue'));
    }).finally(() => { if (current && generation === queueGeneration.current) setQueueLoading(false); });
    return () => { current = false; };
  }, [portalState, filter, search, refreshVersion, api, pendingProjectReview?.ticketId,
    selectedItemFallback?.id, selectedItemFallback?.workspaceId, selectedWorkspaceId]);

  useEffect(() => {
    if (page !== 'requests' || !queue || queueLoading || selectedId || !window.matchMedia('(min-width: 900px)').matches) return;
    const mostRecent = [...queue.items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    if (mostRecent) {
      setSelectedId(mostRecent.id); setSelectedWorkspaceId(mostRecent.workspaceId); setSelectedItemFallback(mostRecent); setRequestListShown(true);
    }
  }, [page, queue, queueLoading, selectedId]);

  useEffect(() => {
    if (pendingProjectReview && queue?.items.some(item => item.id === pendingProjectReview.ticketId
      && item.workspaceId === pendingProjectReview.project.workspaceId
      && (item.projectId !== null || item.status === 'declined' || item.status === 'cancelled'))) {
      setPendingProjectReview(null);
    }
  }, [pendingProjectReview, queue]);

  useEffect(() => {
    const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
    if (portalState !== 'ready' || !activeWorkspaceId || !selectedId || !selectedQueueItem) {
      setDetail(null); setMessages([]); setMessageCursor(null); setDetailError(''); setDetailLoading(false);
      return;
    }
    let current = true;
    const generation = ++historyGeneration.current;
    setDetail(null); setMessages([]); setMessageCursor(null); setDetailError(''); setHistoryError(''); setHistoryLoading(false); setDetailLoading(true);
    const load = workflowActionsDisabled && !communicationEnabled
      ? api.getTicket(activeWorkspaceId, selectedId).then(ticket => [ticket, null] as const)
      : Promise.all([api.getTicket(activeWorkspaceId, selectedId), api.getMessages(activeWorkspaceId, selectedId, { limit: 50 })] as const);
    load.then(([ticket, messagePage]) => {
      if (!current) return;
      setDetail(ticket); setMessages(messagePage?.items ?? []); setMessageCursor(messagePage?.nextCursor ?? null);
    }).catch(error => {
      if (current && !isExpiredClientSession(error)) setDetailError(friendlyError(error, 'ticket'));
    }).finally(() => { if (current) setDetailLoading(false); });
    return () => {
      current = false;
      if (historyGeneration.current === generation) historyGeneration.current += 1;
    };
  }, [portalState, selectedId, selectedWorkspaceId, selectedQueueItem?.workspaceId, selectedQueueItem?.id,
    refreshVersion, api, workflowActionsDisabled, communicationEnabled]);

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
  }, [api, portalState, page, view, selectedWorkspaceId, selectedQueueItem?.workspaceId, selectedId, filter, search,
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
      setRefreshVersion(value => value + 1); return receipt;
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

  async function openCreateForm(project: ClientProject) {
    if (!canStartProjectRequest || !selectedProjectKey || selectedProjectKey !== clientProjectKey(project)
      || createLoading || pending) return;
    setCreateLoading(true); setCreateError(''); setPageError('');
    try {
      const context = await api.getIntakeContext(project.workspaceId);
      if (!context.canCreate) {
        setCreateContext(null); setCreateProject(null);
        setCreateError('New requests are not enabled for your account in this workspace. Contact your project manager.');
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
        setPendingProjectReview({ ticketId: receipt.ticketId, project: target });
        setQueueNotice(`Request sent for PM review. It will appear under ${target.name} after your project manager confirms the link.`);
        setPage('requests'); setView('portal'); setFilter('all'); setSearchInput(''); setSearch('');
        setSelectedId(receipt.ticketId); setSelectedWorkspaceId(target.workspaceId); setSelectedItemFallback(null);
        setRequestListShown(true); setCreateContext(null); setCreateProject(null);
      },
    }).catch(() => undefined);
  }

  function openRequest(item: ClientProjectRequestItem, fromProject = false) {
    historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(item.id); setSelectedWorkspaceId(item.workspaceId);
    setSelectedItemFallback(item); setReturnToProjects(fromProject); setPage('requests'); setView('portal'); setWriteError('');
    if (fromProject) { setFilter('all'); setSearchInput(''); setSearch(''); }
    setRequestListShown(false);
  }

  function sendReply(body: string): Promise<void> {
    const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
    if (!detail || !activeWorkspaceId || pending) return Promise.reject(new Error('A ticket change is already being reconciled.'));
    const payload: ClientTicketReplyInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version, body, action: { type: 'reply' } };
    return performWrite({ operationId: payload.operationId, label: 'message', run: () => api.reply(activeWorkspaceId, detail.id, payload),
      onSuccess: () => setReplyResetVersion(value => value + 1) }).then(() => undefined);
  }

  function sendCorrection(body: string, deliveryId: string): Promise<void> {
    const activeWorkspaceId = selectedQueueItem?.workspaceId ?? selectedWorkspaceId;
    if (!detail || !activeWorkspaceId || pending || detail.readOnly || !detail.writesAvailable
      || detail.requestedAction !== 'review_result' || detail.delivery?.id !== deliveryId || detail.delivery.accepted) {
      return Promise.reject(new Error('The current result is not awaiting feedback.'));
    }
    const payload: ClientTicketReplyInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      body, action: { type: 'request_correction', deliveryId } };
    return performWrite({ operationId: payload.operationId, label: 'correction feedback',
      run: () => api.reply(activeWorkspaceId, detail.id, payload) }).then(() => undefined);
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
    if (nextPage === 'requests') setRequestListShown(true);
  }

  if (portalState === 'checking') return <FullPageState title="Checking your sign-in…" />;
  if (!inspectionOnly && (portalState === 'signed_out' || portalState === 'unavailable')) return <ClientPasswordSignIn
    unavailable={portalState === 'unavailable'} error={pageError}
    onRetry={() => setSessionCheckVersion(value => value + 1)} onSignedIn={() => setSessionCheckVersion(value => value + 1)} />;
  if (portalState === 'signed_out' || portalState === 'unavailable') return <ClientAccessPanel
    unavailable={portalState === 'unavailable'} error={pageError} onRetry={() => setSessionCheckVersion(value => value + 1)} />;

  const activeRequest = selectedQueueItem;
  const currentPendingProject = pendingProjectReview && activeRequest?.id === pendingProjectReview.ticketId
    && activeRequest.workspaceId === pendingProjectReview.project.workspaceId && activeRequest.projectId === null
    && activeRequest.status !== 'declined' && activeRequest.status !== 'cancelled' ? pendingProjectReview : null;
  const showPendingLinkNotice = activeRequest?.projectLinkStatus === 'pending_review' || Boolean(currentPendingProject);
  const currentNav = page;

  return <main className="client-portal-shell client-portal-shell--workspace">
    <aside className={`client-sidebar ${sidebarPinned ? 'is-pinned' : ''}`} aria-label="Client portal navigation">
      <div className="client-sidebar-brand"><img src={alphaMarkUrl} alt="" /><div><strong>Alphaexplora</strong><small>Client portal</small></div></div>
      <nav className="client-sidebar-nav">
        <button type="button" aria-current={currentNav === 'overview' ? 'page' : undefined} onClick={() => navigate('overview')}>
          <LayoutDashboard size={18} /><span>Overview</span>
        </button>
        <button type="button" aria-current={currentNav === 'projects' ? 'page' : undefined} onClick={() => navigate('projects')}>
          <FolderKanban size={18} /><span>Projects</span>
        </button>
        <button type="button" aria-current={currentNav === 'requests' ? 'page' : undefined} onClick={() => navigate('requests')}>
          <ListChecks size={18} /><span>Requests</span>
        </button>
      </nav>
      <div className="client-sidebar-footer">
        <div className="client-sidebar-account" role="group" aria-label="Client account controls">
          <span className="client-sidebar-avatar" aria-hidden="true">C</span>
          <span className="client-sidebar-account-copy"><strong>Client account</strong><small>Client</small></span>
          <div className="client-sidebar-account-actions">
            <button type="button" className="client-sidebar-action" aria-label="Refresh portal data"
              title="Refresh portal data" onClick={() => { setQueueNotice(''); setRefreshVersion(value => value + 1); }}
              disabled={queueLoading || projectsLoading || Boolean(pending)}>
              <RefreshCw size={16} className={queueLoading || projectsLoading ? 'animate-spin' : ''} />
            </button>
            <button type="button" className="client-sidebar-action" aria-label={signingOut ? 'Signing out' : 'Sign out'}
              title={signingOut ? 'Signing out…' : 'Sign out'} onClick={() => void signOut()}
              disabled={inspectionOnly || signingOut || Boolean(pending)} aria-busy={signingOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <button type="button" className="client-sidebar-pin" aria-pressed={sidebarPinned} aria-label={sidebarPinned ? 'Collapse sidebar' : 'Keep sidebar expanded'}
          onClick={() => setSidebarPinned(value => !value)}><Pin size={16} /><span>{sidebarPinned ? 'Collapse sidebar' : 'Keep open'}</span></button>
      </div>
    </aside>

    <div className="client-portal-mainview">
      <div className="client-portal-main client-portal-main--workspace">
        {inspectionOnly && <p role="status" className="client-portal-notice">Read-only inspection. Sign-in, messages, decisions, uploads, downloads, and requests are disabled.</p>}
        {pageError && <div role="alert" className="client-portal-error"><AlertCircle size={16} />{pageError}</div>}
        {refreshError && <div role="status" className="client-portal-error">{refreshError}</div>}

        {page === 'overview' && <ClientOverviewPage requests={queue} projects={projects ?? []}
          requestsLoading={queueLoading} requestsError={queueError} projectsLoading={projectsLoading} projectsError={projectsError}
          onOpenRequest={item => openRequest(item)} onGoToProjects={() => navigate('projects')}
          onGoToRequests={() => navigate('requests')} />}

        {page === 'projects' && (view === 'create' && createContext && createProject ? <div className="client-create-view client-create-view--project">
          <div className="client-create-project-context"><button type="button" className="client-back-link" onClick={cancelCreateForm}><ChevronLeft size={15} />Back to {createProject.name}</button>
            {createError && <p role="alert" className="client-project-error">{createError}</p>}
          </div>
          <ClientCreateTicketForm key={clientProjectKey(createProject)} context={createContext} submissionEnabled={!inspectionOnly && createContext.canCreate}
            relatedTicket={null} busy={writing || Boolean(pending)} error={writeError} onCreate={submitNewTicket} onCancel={cancelCreateForm}
            selectedProjectOptionId={createProject.intakeOptionId} selectedProjectName={createProject.name} />
        </div> : <>
          {createError && <p role="alert" className="client-project-error">{createError}</p>}
          <ClientProjectsPage api={api} projects={projects ?? []} loading={projectsLoading} error={projectsError}
            selectedProjectKey={selectedProjectKey} onSelectedProjectKeyChange={setSelectedProjectKey}
            onOpenRequest={item => openRequest(item, true)} onNewRequest={project => void openCreateForm(project)}
            inspectionOnly={inspectionOnly} newRequestEnabled={canStartProjectRequest} newRequestLoading={createLoading} />
        </>)}

        {page === 'requests' && <div className="client-requests-page">
          <section className={`client-portal-page-heading ${selectedId && !requestListShown ? 'client-mobile-heading-hidden' : ''}`} aria-label="Request overview">
            <div><p className="client-eyebrow">CLIENT PORTAL</p><h1>Requests</h1><p className="client-page-description">Follow the status of each request and message your project manager.</p></div>
            {queue && queue.counters.needsClient > 0 && !workflowActionsDisabled && <button type="button" className="client-attention-link" onClick={() => { setFilter('needs_client'); setSearchInput(''); setSearch(''); }}>
              <span className="client-attention-dot" /><span><strong>{queue.counters.needsClient} {queue.counters.needsClient === 1 ? 'request needs' : 'requests need'} your attention</strong><small>Open a request to see the next step.</small></span><ArrowRight size={17} />
            </button>}
            {queue && queue.counters.needsClient === 0 && !workflowActionsDisabled && <p className="client-all-caught-up"><Check size={15} />Nothing needs your reply right now</p>}
          </section>
          {queueNotice && <p role="status" className="client-project-pending-notice">{queueNotice}</p>}
          {queueError && <p role="alert" className="client-project-error">{queueError}</p>}
          <section className="client-portal-workspace client-portal-workspace--requests" aria-label="Your requests and updates">
            <aside className={`client-request-list ${selectedId && !requestListShown ? 'client-mobile-hidden' : ''}`} aria-label="Request list">
              <div className="client-list-header"><div className="client-list-title"><h2>All requests</h2></div></div>
              <label className="client-search"><Search size={16} /><span className="sr-only">Search requests</span>
                <input value={searchInput} onChange={event => setSearchInput(event.target.value)} disabled={Boolean(pending)} placeholder="Search requests" /></label>
              <div className="client-request-filters" aria-label="Filter requests">{filters.filter(option => !workflowActionsDisabled || option.id !== 'needs_client').map(option => {
                const count = queue?.counters.kind !== 'client' ? null : option.id === 'open' ? queue.counters.open : option.id === 'needs_client' ? queue.counters.needsClient : null;
                const active = filter === option.id;
                return <button key={option.id} aria-pressed={active} disabled={Boolean(pending)} onClick={() => setFilter(option.id)} className={`client-request-filter ${active ? 'is-active' : ''}`}>
                  {option.label}{count !== null && <span>{count}</span>}</button>;
              })}</div>
              <div className="client-request-items">
                {queueLoading && !queue ? <p role="status" className="client-list-loading">Loading your requests…</p>
                  : queue?.items.length ? queue.items.map(item => {
                    const pendingLink = item.projectLinkStatus === 'pending_review';
                    return <button key={rowKey(item)} aria-pressed={selectedId === item.id && selectedWorkspaceId === item.workspaceId} disabled={Boolean(pending)}
                      onClick={() => openRequest(item)} className={`client-request-row ${selectedId === item.id && selectedWorkspaceId === item.workspaceId ? 'is-selected' : ''}`}>
                      <span className="client-request-icon" aria-hidden="true"><FileText size={18} /></span>
                      <span className="client-request-copy"><span className="client-request-title">{item.title}</span>
                        <span className="client-request-meta"><span className="client-request-reference">{item.reference}</span><StatusPill status={item.status} /></span>
                        <span className={`client-request-progress ${pendingLink ? 'needs-action' : item.requestedAction && !workflowActionsDisabled ? 'needs-action' : ''}`}>
                          {pendingLink ? `PM review pending${item.requestedProjectName ? ` · ${item.requestedProjectName}` : ''}`
                            : clientTicketProgress(item.status, workflowActionsDisabled ? null : item.requestedAction).label}</span>
                        <time dateTime={item.updatedAt}>Updated {time(item.updatedAt)}</time>
                      </span><ArrowRight size={16} className="client-request-chevron" aria-hidden="true" />
                    </button>;
                  }) : !queueError && <EmptyState title={search ? 'No requests match your search' : 'No requests yet'}
                    body={search ? 'Try a shorter search or clear the search field.' : 'Requests from your project manager and requests awaiting review will appear here.'} />}
              </div>
              {queue && <div className="client-list-footer"><span>{queue.items.length} shown</span>{queue.nextCursor && <button onClick={() => void loadMoreQueue()} disabled={queueMoreLoading || queueLoading}>
                {queueMoreLoading ? 'Loading…' : 'Load more'}</button>}</div>}
            </aside>
            <section className={`client-request-detail-pane ${selectedId && !requestListShown ? '' : 'client-mobile-hidden'}`} aria-label="Selected request">
              {!selectedId ? <EmptyState title="Choose a request" body="Select a request to see its status, messages, and any action your project manager needs from you." />
                : !activeRequest && pendingProjectReview?.ticketId === selectedId ? <div className="client-request-pending-state" role="status">
                  <RefreshCw size={18} /><h2>Your request was submitted</h2><p>Waiting for the request list to update. It will appear under {pendingProjectReview.project.name} only after your project manager confirms the link.</p>
                </div>
                  : !activeRequest ? <EmptyState title="Request not available" body="Refresh the list and try again. If it is still missing, contact your project manager." />
                    : detailLoading ? <p role="status" className="p-8 text-center text-sm text-content-secondary">Loading request…</p>
                      : detailError ? <div role="alert" className="m-4 rounded-lg border border-status-danger-border bg-status-danger-subtle p-4 text-xs text-status-danger">{detailError}</div>
                        : detail && <>
                          {returnToProjects && <button type="button" className="client-back-link client-ticket-project-back" onClick={() => {
                            historyGeneration.current += 1; setSelectedId(null); setSelectedWorkspaceId(null); setSelectedItemFallback(null);
                            setRequestListShown(true); setPage('projects'); setReturnToProjects(false);
                          }}><ChevronLeft size={15} />Back to project requests</button>}
                          {showPendingLinkNotice && <div role="status" className="client-project-pending-notice">
                            <strong>PM review pending</strong><span>This request is not linked to a project yet. Your project manager must review and confirm the project link before it appears in that project.</span>
                          </div>}
                          {activeRequest.projectLinkStatus === 'linked' && activeRequest.projectId && <p className="client-request-project-link">Linked to {activeRequest.projectName || 'a shared project'}</p>}
                          <ClientTicketDetail workspaceId={activeRequest.workspaceId} api={api} key={`${activeRequest.workspaceId}:${detail.id}`}
                            ticket={detail} messages={messages} messageCursor={messageCursor} historyLoading={historyLoading} historyError={historyError}
                            busy={writing || Boolean(pending)} error={writeError} replyResetVersion={replyResetVersion}
                            workflowActionsDisabled={workflowActionsDisabled} newRequestsDisabled communicationEnabled={communicationEnabled && !inspectionOnly}
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
        {session?.expiresAt && <span className="sr-only">Session expires {session.expiresAt}</span>}
      </div>
    </div>
  </main>;
}

function FullPageState({ title }: { title: string }) {
  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-sm text-content-secondary" role="status"><RefreshCw size={15} className="mr-2 animate-spin" />{title}</main>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="client-empty-state"><Ticket aria-hidden="true" size={22} /><p>{title}</p><p>{body}</p></div>;
}

function StatusPill({ status }: { status: ClientProjectRequestItem['status'] }) {
  const tone = status === 'closed' ? 'is-complete'
    : status === 'ready_for_review' || status === 'awaiting_client' ? 'is-waiting'
      : status === 'in_progress' ? 'is-active'
        : status === 'declined' || status === 'cancelled' ? 'is-ended' : 'is-neutral';
  return <span className={`client-status ${tone}`}>{clientTicketProgress(status, null).statusLabel}</span>;
}
