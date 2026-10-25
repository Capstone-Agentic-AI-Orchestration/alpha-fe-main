import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronRight, FileText, LogOut, Plus, RefreshCw, Search, Ticket } from 'lucide-react';

import alphaMarkUrl from '@/assets/alpha-mark.png';
import type {
  ClientSession, ClientTicketCommandInput, ClientTicketCreateInput, ClientTicketDetail as TicketDetail,
  ClientTicketMessage, ClientTicketQueue, ClientTicketQueueItem, ClientTicketReceipt, ClientTicketReplyInput,
} from './clientApi';
import { ClientTicketApiError, clientTicketApi } from './clientApi';
import { ClientCreateTicketForm } from './ClientCreateTicketForm';
import { ClientTicketDetail } from './ClientTicketDetail';
import { ClientAccessPanel } from './ClientAccessPanel';
import { ClientPasswordSignIn } from './ClientPasswordSignIn';
import { clientTicketProgress } from './clientTicketProgress';
import { effectivePortalFilter, portalFilterFromHash } from './clientPortalLink';
import { secondary, time } from './ticketUi';
import './clientPortal.css';

type Filter = NonNullable<Parameters<typeof clientTicketApi.listTickets>[1]>['filter'];
type PortalState = 'checking' | 'signed_out' | 'unavailable' | 'ready';
interface PendingOperation {
  operationId: string;
  label: string;
  run: () => Promise<ClientTicketReceipt>;
  onSuccess?: (receipt: ClientTicketReceipt) => void;
}

const filters: Array<{ id: NonNullable<Filter>; label: string }> = [
  { id: 'all', label: 'All requests' },
  { id: 'open', label: 'Active requests' },
  { id: 'needs_client', label: 'Needs your action' },
  { id: 'history', label: 'Past requests' },
];

function friendlyError(error: unknown, context: 'session' | 'queue' | 'ticket' | 'write' | 'create'): string {
  if (!(error instanceof ClientTicketApiError)) {
    return context === 'session' ? 'Could not check your sign-in. Try again later.'
      : context === 'queue' ? 'Could not load your requests. Try again later.'
        : context === 'ticket' ? 'Could not load this request. Try again later.'
          : context === 'create' ? 'Could not prepare a new request. Try again later.'
            : 'Your change could not be completed.';
  }
  if (context === 'session' && (error.status === 404 || error.status === 503)) return 'Client sign-in is temporarily unavailable. Please try again later.';
  if (context === 'session' && error.status === 401) return 'Your sign-in has expired. Sign in again to continue.';
  if ((context === 'queue' || context === 'ticket') && (error.status === 404 || error.status === 503)) return 'We could not load your requests right now. Please try again later.';
  if (error.reconciliationRequired) return 'We could not confirm whether this update was saved. Use “Check update status” before trying again.';
  return error.message;
}

export default function ClientPortal({ api = clientTicketApi, inspectionOnly = false,
  workflowActionsDisabled: workflowActionsDisabledOverride = false, newRequestsDisabled = true,
  communicationEnabled = false }: {
  api?: typeof clientTicketApi;
  inspectionOnly?: boolean;
  /** Disables client-initiated workflow decisions while preserving scoped ticket access. */
  workflowActionsDisabled?: boolean;
  /** New Request stays out of the current ticket workflow, even when Phase 7–9 is enabled. */
  newRequestsDisabled?: boolean;
  /** Enables ticket-scoped messages and documents independently of workflow decisions. */
  communicationEnabled?: boolean;
} = {}) {
  const [portalState, setPortalState] = useState<PortalState>('checking');
  const [session, setSession] = useState<ClientSession | null>(null);
  const [phaseWorkflowEnabled, setPhaseWorkflowEnabled] = useState(false);
  const [workflowChecked, setWorkflowChecked] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState<Array<{ workspaceId: string; displayName: string }>>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [queue, setQueue] = useState<ClientTicketQueue | null>(null);
  const [filter, setFilter] = useState<NonNullable<Filter>>(() => (typeof window === 'undefined' ? 'all' : portalFilterFromHash(window.location.hash)));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const [createRelatedId, setCreateRelatedId] = useState<string | null>(null);
  const [view, setView] = useState<'tickets' | 'create'>('tickets');
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const [pageError, setPageError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [replyResetVersion, setReplyResetVersion] = useState(0);
  const [sessionCheckVersion, setSessionCheckVersion] = useState(0);
  const queueGeneration = useRef(0);
  const historyGeneration = useRef(0);
  const writeLock = useRef(false);
  const workflowActionsDisabled = workflowActionsDisabledOverride || !phaseWorkflowEnabled;
  const canCreateRequests = !newRequestsDisabled && !workflowActionsDisabled;

  useEffect(() => {
    let current = true;
    setPhaseWorkflowEnabled(false);
    setWorkflowChecked(false);
    if (workflowActionsDisabledOverride || inspectionOnly) { setWorkflowChecked(true); return () => { current = false; }; }
    void api.getWorkflowCapabilities().then(capabilities => {
      if (current) setPhaseWorkflowEnabled(capabilities.phaseWorkflowEnabled === true);
    }).catch(() => {
      // A missing/old workflow endpoint is a safe legacy rollout, not a reason
      // to make the client portal or its conversation unavailable.
      if (current) setPhaseWorkflowEnabled(false);
    }).finally(() => { if (current) setWorkflowChecked(true); });
    return () => { current = false; };
  }, [api, inspectionOnly, workflowActionsDisabledOverride]);

  // An email deep link may ask for "Needs your action" before we know it is offered here.
  useEffect(() => {
    if (workflowChecked && effectivePortalFilter(filter, !workflowActionsDisabled) !== filter) setFilter('all');
  }, [workflowChecked, workflowActionsDisabled, filter]);

  function clearExpiredClientSession(): void {
    setSession({ authenticated: false }); setPortalState('signed_out');
    setWorkspaceOptions([]); setWorkspaceId(''); setQueue(null); setSelectedId(null);
    setDetail(null); setMessages([]); setMessageCursor(null); setPending(null);
    setCreateContext(null); setCreateRelatedId(null); setView('tickets');
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
    setPortalState('checking');
    setPageError('');
    api.getSession().then(async currentSession => {
      if (!current) return;
      setSession(currentSession);
      if (!currentSession.authenticated) {
        clearExpiredClientSession();
        return;
      }
      try {
        const workspaces = await api.listWorkspaces();
        if (!current) return;
        setWorkspaceOptions(workspaces.items);
        setWorkspaceId(existing => workspaces.items.some(item => item.workspaceId === existing)
          ? existing : workspaces.items[0]?.workspaceId ?? '');
        setPortalState('ready');
      } catch (error) {
        if (!current) return;
        if (error instanceof ClientTicketApiError && error.status === 401) {
          clearExpiredClientSession();
        } else {
          setPageError(friendlyError(error, 'queue'));
          setPortalState('ready');
        }
      }
    }).catch(error => {
      if (!current) return;
      setPageError(friendlyError(error, 'session'));
      setPortalState(isExpiredClientSession(error) ? 'signed_out' : 'unavailable');
    });
    return () => { current = false; };
  }, [sessionCheckVersion, api]);

  useEffect(() => {
    if (portalState !== 'ready' || !workspaceId) {
      if (portalState === 'ready' && !workspaceId) {
        setQueue(null); setSelectedId(null); setDetail(null);
      }
      return;
    }
    let current = true;
    const generation = ++queueGeneration.current;
    setQueueLoading(true); setQueueMoreLoading(false); setQueueError('');
    api.listTickets(workspaceId, { limit: 50, filter, search }).then(result => {
      if (!current || generation !== queueGeneration.current) return;
      setQueue(result);
      setSelectedId(existing => existing && result.items.some(item => item.id === existing)
        ? existing : window.matchMedia('(min-width: 1280px)').matches ? result.items[0]?.id ?? null : null);
    }).catch(error => {
      if (!current || generation !== queueGeneration.current) return;
      if (isExpiredClientSession(error)) return;
      setQueue(null); setSelectedId(null); setQueueError(friendlyError(error, 'queue'));
    }).finally(() => {
      if (current && generation === queueGeneration.current) setQueueLoading(false);
    });
    return () => { current = false; };
  }, [portalState, workspaceId, filter, search, refreshVersion, api]);

  const selectedQueueItem = useMemo(
    () => queue?.items.find(item => item.id === selectedId) ?? null,
    [queue, selectedId],
  );

  useEffect(() => {
    if (portalState !== 'ready' || !workspaceId || !selectedId || !selectedQueueItem) {
      setDetail(null); setMessages([]); setMessageCursor(null); setDetailError(''); setDetailLoading(false);
      return;
    }
    let current = true;
    const generation = ++historyGeneration.current;
    setDetail(null); setMessages([]); setMessageCursor(null); setDetailError(''); setHistoryError(''); setHistoryLoading(false); setDetailLoading(true);
    const load = workflowActionsDisabled && !communicationEnabled
      ? api.getTicket(workspaceId, selectedId).then(ticket => [ticket, null] as const)
      : Promise.all([
        api.getTicket(workspaceId, selectedId),
        api.getMessages(workspaceId, selectedId, { limit: 50 }),
      ] as const);
    load.then(([ticket, page]) => {
      if (!current) return;
      setDetail(ticket); setMessages(page?.items ?? []); setMessageCursor(page?.nextCursor ?? null);
    }).catch(error => {
      if (current && !isExpiredClientSession(error)) setDetailError(friendlyError(error, 'ticket'));
    }).finally(() => {
      if (current) setDetailLoading(false);
    });
    return () => {
      current = false;
      if (historyGeneration.current === generation) historyGeneration.current += 1;
    };
  }, [portalState, workspaceId, selectedId, selectedQueueItem?.id, refreshVersion, api, workflowActionsDisabled, communicationEnabled]);

  async function loadMoreQueue() {
    if (!workspaceId || !queue?.nextCursor || queueMoreLoading) return;
    const generation = queueGeneration.current;
    setQueueMoreLoading(true); setQueueError('');
    try {
      const page = await api.listTickets(workspaceId, { limit: 50, after: queue.nextCursor, filter, search });
      if (generation !== queueGeneration.current) return;
      setQueue(current => {
        if (!current) return page;
        const seen = new Set(current.items.map(item => item.id));
        return { ...page, items: [...current.items, ...page.items.filter(item => !seen.has(item.id))] };
      });
    } catch (error) {
      if (isExpiredClientSession(error)) return;
      if (generation === queueGeneration.current) setQueueError(friendlyError(error, 'queue'));
    } finally {
      if (generation === queueGeneration.current) setQueueMoreLoading(false);
    }
  }

  async function loadMoreMessages() {
    if (!communicationEnabled || !workspaceId || !selectedId || !messageCursor || historyLoading) return;
    const generation = historyGeneration.current;
    const activeWorkspace = workspaceId;
    const activeTicket = selectedId;
    const cursor = messageCursor;
    setHistoryLoading(true); setHistoryError('');
    try {
      const page = await api.getMessages(activeWorkspace, activeTicket, { after: cursor });
      if (generation !== historyGeneration.current) return;
      setMessages(current => [...current, ...page.items]);
      setMessageCursor(page.nextCursor);
    } catch (error) {
      if (isExpiredClientSession(error)) return;
      if (generation === historyGeneration.current) setHistoryError(friendlyError(error, 'ticket'));
    } finally {
      if (generation === historyGeneration.current) setHistoryLoading(false);
    }
  }

  async function performWrite(operation: PendingOperation): Promise<ClientTicketReceipt> {
    if (inspectionOnly) throw new Error('Changes are disabled while inspecting sample tickets.');
    if (writeLock.current) throw new Error('Another ticket change is already being processed.');
    writeLock.current = true;
    setWriting(true); setWriteError('');
    try {
      const receipt = await operation.run();
      setPending(null); setWriteError('');
      operation.onSuccess?.(receipt);
      setRefreshVersion(value => value + 1);
      return receipt;
    } catch (error) {
      if (isExpiredClientSession(error)) setWriteError('');
      else {
        if (error instanceof ClientTicketApiError && error.reconciliationRequired) setPending(operation);
        else setPending(null);
        setWriteError(friendlyError(error, 'write'));
      }
      throw error;
    } finally {
      writeLock.current = false;
      setWriting(false);
    }
  }

  async function openCreateForm(relatedId: string | null = null) {
    if (!canCreateRequests || !workspaceId || createLoading || pending) return;
    setCreateLoading(true); setPageError(''); setCreateRelatedId(relatedId);
    try {
      const context = await api.getIntakeContext(workspaceId);
      setCreateContext(context); setView('create');
    } catch (error) {
      if (isExpiredClientSession(error)) return;
      setPageError(friendlyError(error, 'create'));
    } finally {
      setCreateLoading(false);
    }
  }

  function submitNewTicket(value: ClientTicketCreateInput) {
    if (!canCreateRequests || pending || !workspaceId) return;
    void performWrite({
      operationId: value.operationId,
      label: 'ticket submission',
      run: () => api.createTicket(value),
      onSuccess: receipt => {
        // A newly created ticket must not appear to vanish because the client
        // submitted while viewing History or with an active search term.
        setFilter('all'); setSearchInput(''); setSearch('');
        setView('tickets'); setSelectedId(receipt.ticketId); setCreateContext(null); setCreateRelatedId(null);
      },
    }).catch(() => undefined);
  }

  function sendReply(body: string): Promise<void> {
    if (!detail || !workspaceId || pending) return Promise.reject(new Error('A ticket change is already being reconciled.'));
    const payload: ClientTicketReplyInput = {
      schemaVersion: 1 as const,
      operationId: crypto.randomUUID(),
      expectedVersion: detail.version,
      body,
      action: { type: 'reply' },
    };
    return performWrite({
      operationId: payload.operationId,
      label: 'message',
      run: () => api.reply(workspaceId, detail.id, payload),
      onSuccess: () => setReplyResetVersion(value => value + 1),
    }).then(() => undefined);
  }

  function sendCorrection(body: string, deliveryId: string): Promise<void> {
    if (!detail || !workspaceId || pending || detail.readOnly || !detail.writesAvailable
      || detail.requestedAction !== 'review_result' || detail.delivery?.id !== deliveryId || detail.delivery.accepted) {
      return Promise.reject(new Error('The current result is not awaiting feedback.'));
    }
    const activeWorkspace = workspaceId; const activeTicket = detail.id;
    const payload: ClientTicketReplyInput = { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version,
      body, action: { type: 'request_correction', deliveryId } };
    return performWrite({ operationId: payload.operationId, label: 'correction feedback',
      run: () => api.reply(activeWorkspace, activeTicket, payload) }).then(() => undefined);
  }

  function makeDecision(command: Extract<ClientTicketCommandInput['command'], { type: 'agree_scope' | 'accept_delivery' }>) {
    if (!detail || !workspaceId || pending) return;
    if (command.type === 'accept_delivery' && (detail.requestedAction !== 'review_result'
      || detail.delivery?.id !== command.deliveryId || detail.delivery.accepted || !detail.writesAvailable || detail.readOnly)) return;
    const payload: ClientTicketCommandInput = {
      schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version, command,
    };
    void performWrite({
      operationId: payload.operationId,
      label: command.type === 'accept_delivery' ? 'result acceptance' : 'scope agreement',
      run: () => api.decide(workspaceId, detail.id, payload),
    }).catch(() => undefined);
  }

  async function signOut() {
    if (signingOut || pending) return;
    setSigningOut(true); setPageError('');
    try {
      await api.signOut();
      clearExpiredClientSession();
    } catch (error) {
      if (isExpiredClientSession(error)) return;
      setPageError(friendlyError(error, 'write'));
    } finally {
      setSigningOut(false);
    }
  }

  if (portalState === 'checking') return <FullPageState title="Checking your sign-in…" />;
  if (!inspectionOnly && (portalState === 'signed_out' || portalState === 'unavailable')) return <ClientPasswordSignIn
    unavailable={portalState === 'unavailable'} error={pageError}
    onRetry={() => setSessionCheckVersion(value => value + 1)}
    onSignedIn={() => setSessionCheckVersion(value => value + 1)} />;
  if (portalState === 'signed_out' || portalState === 'unavailable') return <ClientAccessPanel
    unavailable={portalState === 'unavailable'} error={pageError}
    onRetry={() => setSessionCheckVersion(value => value + 1)}
  />;

  const selectedWorkspace = workspaceOptions.find(item => item.workspaceId === workspaceId);
  const relatedTicket = createRelatedId
    ? queue?.items.find(item => item.id === createRelatedId) ?? null
    : null;

  return <main className="client-portal-shell">
    <header className="client-portal-header">
      <div className="client-portal-brand"><img src={alphaMarkUrl} alt="" /><div><p>Alphaexplora</p><span>Client portal{selectedWorkspace ? ` · ${selectedWorkspace.displayName}` : ''}</span></div></div>
      <div className="client-portal-header-actions">
        {workspaceOptions.length > 1 && <label className="client-workspace-select"><span className="sr-only">Choose which team’s requests to view</span><select aria-label="Choose which team’s requests to view" value={workspaceId} disabled={Boolean(pending)} onChange={event => { queueGeneration.current += 1; historyGeneration.current += 1; setQueueLoading(false); setQueueMoreLoading(false); setHistoryLoading(false); setWorkspaceId(event.target.value); setQueue(null); setSelectedId(null); setDetail(null); }}>
          {workspaceOptions.map(option => <option key={option.workspaceId} value={option.workspaceId}>{option.displayName}</option>)}
        </select></label>}
        <button aria-label={workspaceOptions.length === 0 ? 'Try loading your requests again' : 'Refresh requests'} onClick={() => workspaceOptions.length === 0
          ? setSessionCheckVersion(value => value + 1) : setRefreshVersion(value => value + 1)} disabled={queueLoading || Boolean(pending)} className="client-control-button"><RefreshCw size={16} className={queueLoading ? 'animate-spin' : ''} /><span>{workspaceOptions.length === 0 ? 'Try again' : 'Refresh'}</span></button>
        <button aria-label={signingOut ? 'Signing out' : 'Sign out'} onClick={() => void signOut()} disabled={inspectionOnly || signingOut || Boolean(pending)} className="client-control-button"><LogOut size={16} /><span>{signingOut ? 'Signing out…' : 'Sign out'}</span></button>
      </div>
    </header>

    <div className="client-portal-main">
      {inspectionOnly && <p role="status" className="client-portal-notice">Fictional sample requests · the same client interface used by Alphaexplora. Submissions, replies, sign-in, uploads and downloads are disabled.</p>}
      {pageError && <div role="alert" className="client-portal-error"><AlertCircle size={16} />{pageError}</div>}

      {workspaceOptions.length === 0 ? <section className="client-portal-empty"><EmptyState title={pageError ? 'We could not load your requests' : 'No requests shared yet'} body={pageError ? 'Try again using the button above. If the problem continues, contact your project manager.' : 'Your project manager will share your requests here. If you expected to see one, contact them for help.'} /></section>
        : canCreateRequests && view === 'create' && createContext ? <div className="client-create-view"><ClientCreateTicketForm
          context={createContext}
          submissionEnabled={!inspectionOnly}
          relatedTicket={relatedTicket ? { id: relatedTicket.id, reference: relatedTicket.reference, title: relatedTicket.title } : null}
          busy={writing || Boolean(pending)} error={writeError}
          onCreate={submitNewTicket}
          onCancel={() => { if (!pending) { setView('tickets'); setCreateContext(null); setCreateRelatedId(null); setWriteError(''); } }}
        /></div> : <div className="client-portal-body">
          <section className={`client-portal-page-heading ${selectedId ? 'client-mobile-heading-hidden' : ''}`} aria-label="Request overview">
            <div><p className="client-eyebrow">CLIENT PORTAL</p><h1>Your requests</h1><p className="client-page-description">Follow updates and keep in touch with your project manager.</p></div>
            {!workflowActionsDisabled && queue && queue.counters.needsClient > 0 && <button type="button" className="client-attention-link" onClick={() => { setFilter('needs_client'); setSearchInput(''); setSearch(''); }}>
              <span className="client-attention-dot" /><span><strong>{queue.counters.needsClient} {queue.counters.needsClient === 1 ? 'request needs' : 'requests need'} your attention</strong><small>Open to see what your project manager is waiting for.</small></span><ChevronRight size={17} />
            </button>}
            {!workflowActionsDisabled && queue && queue.counters.needsClient === 0 && <p className="client-all-caught-up"><Check size={15} />Nothing needs your reply right now</p>}
          </section>

          <section className="client-portal-workspace" aria-label="Your requests and updates">
            <aside className={`client-request-list ${selectedId ? 'client-mobile-hidden' : ''}`} aria-label="Request list">
              <div className="client-list-header">
                <div className="client-list-title"><h2>Requests</h2></div>
                {canCreateRequests && <button onClick={() => void openCreateForm()} disabled={!workspaceId || createLoading || Boolean(pending)} className="client-new-request"><Plus size={15} />{createLoading ? 'Loading…' : 'New request'}</button>}
              </div>
              <label className="client-search"><Search size={16} /><span className="sr-only">Search requests</span>
                <input value={searchInput} onChange={event => setSearchInput(event.target.value)} disabled={Boolean(pending)} placeholder="Search requests" /></label>
              <div className="client-request-filters" aria-label="Filter requests">{filters.filter(option => !workflowActionsDisabled || option.id !== 'needs_client').map(option => {
                const count = queue?.counters.kind !== 'client' ? null : option.id === 'open' ? queue.counters.open : option.id === 'needs_client' ? queue.counters.needsClient : null;
                const active = filter === option.id;
                return <button key={option.id} aria-pressed={active} disabled={Boolean(pending)} onClick={() => setFilter(option.id)} className={`client-request-filter ${active ? 'is-active' : ''}`}>{option.label}{count !== null && <span>{count}</span>}</button>;
              })}</div>
              {queueError && <p role="alert" className="client-inline-error">{queueError}</p>}
              <div className="client-request-items">
                {queueLoading && !queue ? <p role="status" className="client-list-loading">Loading your requests…</p>
                  : queue?.items.length ? queue.items.map(item => <button key={item.id} aria-pressed={selectedId === item.id} disabled={Boolean(pending)} onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(item.id); setView('tickets'); setWriteError(''); }} className={`client-request-row ${selectedId === item.id ? 'is-selected' : ''}`}>
                    <span className="client-request-icon" aria-hidden="true"><FileText size={18} /></span>
                    <span className="client-request-copy">
                      <span className="client-request-title">{item.title}</span>
                      <span className="client-request-meta"><span className="client-request-reference">{item.reference}</span><StatusPill status={item.status} /></span>
                      <span className={`client-request-progress ${item.requestedAction && !workflowActionsDisabled ? 'needs-action' : ''}`}>{clientTicketProgress(item.status, workflowActionsDisabled ? null : item.requestedAction).label}</span>
                      <time dateTime={item.updatedAt}>Updated {time(item.updatedAt)}</time>
                    </span>
                    <ChevronRight size={17} className="client-request-chevron" aria-hidden="true" />
                  </button>)
                    : !queueError && <EmptyState title={search ? 'No requests match your search' : filter === 'all' ? 'No requests here yet' : 'No requests match this view'} body={search ? 'Try a shorter search or clear the search field.' : filter === 'all' ? canCreateRequests ? 'Choose New request above to tell your project manager what you need.' : 'Your project manager will share requests here. If you expected to see one, contact them for help.' : 'Choose All requests to see your full request list.'} />}
              </div>
              {queue && <div className="client-list-footer"><span>{queue.items.length} shown</span>{queue.nextCursor && <button onClick={() => void loadMoreQueue()} disabled={queueMoreLoading || queueLoading}>{queueMoreLoading ? 'Loading…' : 'Load more'}</button>}</div>}
            </aside>

            <section className={`client-request-detail-pane ${selectedId ? '' : 'client-mobile-hidden'}`} aria-label="Selected request">
        {!selectedId || !selectedQueueItem ? <EmptyState title="Choose a request" body={workflowActionsDisabled ? 'Select a request to see its latest status.' : 'Select a request to see its status, messages, and any action your project manager needs from you.'} />
          : detailLoading ? <p role="status" className="p-8 text-center text-sm text-content-secondary">Loading request…</p>
            : detailError ? <div role="alert" className="m-4 rounded-lg border border-status-danger-border bg-status-danger-subtle p-4 text-xs text-status-danger">{detailError}</div>
              : detail && <ClientTicketDetail
                workspaceId={workspaceId}
                api={api}
                key={detail.id}
                ticket={detail}
                messages={messages}
                messageCursor={messageCursor}
                historyLoading={historyLoading}
                historyError={historyError}
                busy={writing || Boolean(pending)}
                error={writeError}
                replyResetVersion={replyResetVersion}
                workflowActionsDisabled={workflowActionsDisabled}
                newRequestsDisabled={newRequestsDisabled}
                communicationEnabled={communicationEnabled && !inspectionOnly}
                onBack={() => { historyGeneration.current += 1; setSelectedId(null); setDetail(null); }}
                onLoadMore={() => void loadMoreMessages()}
                onReply={sendReply}
                onCorrection={sendCorrection}
                onDecision={makeDecision}
                onAdditionalWork={() => void openCreateForm(detail.id)}
              />}
            </section>
          </section>
        </div>}

    {pending && <div role="status" className="fixed bottom-4 left-4 right-4 z-40 flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-xl border border-status-warning-border bg-shell p-4 text-sm text-status-warning shadow-xl sm:left-auto sm:right-4">
      <span>We’re checking whether your update was saved. Please don’t send it again yet.</span>
      <button onClick={() => void performWrite(pending).catch(() => undefined)} disabled={writing} className={`${secondary} min-h-[44px]`}>{writing ? 'Checking…' : 'Check update status'}</button>
    </div>}
    {session?.expiresAt && <span className="sr-only">Session expires {session.expiresAt}</span>}
    </div>
  </main>;
}

function FullPageState({ title }: { title: string }) {
  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-sm text-content-secondary" role="status"><RefreshCw size={15} className="mr-2 animate-spin" />{title}</main>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="client-empty-state"><Ticket aria-hidden="true" size={22} /><p>{title}</p><p>{body}</p></div>;
}

function StatusPill({ status }: { status: ClientTicketQueueItem['status'] }) {
  const tone = status === 'closed' ? 'is-complete'
    : status === 'ready_for_review' || status === 'awaiting_client' ? 'is-waiting'
      : status === 'in_progress' ? 'is-active'
        : status === 'declined' || status === 'cancelled' ? 'is-ended' : 'is-neutral';
  return <span className={`client-status ${tone}`}>{clientTicketProgress(status, null).statusLabel}</span>;
}
