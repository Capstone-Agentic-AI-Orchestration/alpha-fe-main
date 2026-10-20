import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronRight, FileText, LogOut, Plus, RefreshCw, Search, Ticket } from 'lucide-react';

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
import { input, primary, secondary, time } from './ticketUi';

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
  const [signInPending, setSignInPending] = useState(false);
  const [signInSent, setSignInSent] = useState(false);
  const [signInError, setSignInError] = useState('');
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

  async function requestSignInLink(email: string): Promise<void> {
    if (signInPending || portalState !== 'signed_out') return;
    setSignInPending(true); setSignInSent(false); setSignInError('');
    try {
      await api.requestSignInLink(email);
      setSignInSent(true);
    } catch (error) {
      setSignInError(friendlyError(error, 'session'));
    } finally {
      setSignInPending(false);
    }
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
    signInError={signInError} signInSent={signInSent} signingIn={signInPending}
    onRequestSignIn={email => void requestSignInLink(email)}
    onRetry={() => setSessionCheckVersion(value => value + 1)}
  />;

  const selectedWorkspace = workspaceOptions.find(item => item.workspaceId === workspaceId);
  const relatedTicket = createRelatedId
    ? queue?.items.find(item => item.id === createRelatedId) ?? null
    : null;

  return <main className="flex h-dvh flex-col overflow-hidden bg-canvas font-sans text-gray-300">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-shell px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3"><img src={alphaMarkUrl} alt="" className="h-8 w-8 object-contain" /><div className="min-w-0"><p className="text-sm font-semibold text-white">Alpha Client Portal</p><p className="truncate text-xs text-gray-400">{selectedWorkspace?.displayName ?? 'Your shared requests'}</p></div></div>
      <div className="flex items-center gap-2">
        {workspaceOptions.length > 1 && <label><span className="sr-only">Choose which team’s requests to view</span><select aria-label="Choose which team’s requests to view" value={workspaceId} disabled={Boolean(pending)} onChange={event => { queueGeneration.current += 1; historyGeneration.current += 1; setQueueLoading(false); setQueueMoreLoading(false); setHistoryLoading(false); setWorkspaceId(event.target.value); setQueue(null); setSelectedId(null); setDetail(null); }} className={`${input} w-auto min-w-40 py-2 text-xs`}>
          {workspaceOptions.map(option => <option key={option.workspaceId} value={option.workspaceId}>{option.displayName}</option>)}
        </select></label>}
        <button aria-label={workspaceOptions.length === 0 ? 'Try loading your requests again' : 'Refresh requests'} onClick={() => workspaceOptions.length === 0
          ? setSessionCheckVersion(value => value + 1) : setRefreshVersion(value => value + 1)} disabled={queueLoading || Boolean(pending)} className={`${secondary} min-h-[44px] min-w-[44px]`}><RefreshCw size={15} className={queueLoading ? 'animate-spin' : ''} /><span className="hidden sm:inline">{workspaceOptions.length === 0 ? 'Try again' : 'Refresh'}</span></button>
        <button aria-label={signingOut ? 'Signing out' : 'Sign out'} onClick={() => void signOut()} disabled={inspectionOnly || signingOut || Boolean(pending)} className={`${secondary} min-h-[44px] min-w-[44px]`}><LogOut size={15} /><span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span></button>
      </div>
    </header>
    <h1 className="sr-only">Your requests</h1>

    {inspectionOnly && <p role="status" className="mx-4 mt-3 rounded-lg border border-amber-400/15 bg-amber-500/[0.04] px-3 py-2 text-xs text-amber-100/80 md:mx-6">Fictional sample requests · the same client interface used by Alpha. Submissions, replies, sign-in, uploads and downloads are disabled.</p>}
    {pageError && <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-3 text-xs text-rose-200 md:mx-6"><AlertCircle size={14} className="mt-0.5 shrink-0" />{pageError}</div>}

    {workspaceOptions.length === 0 ? <section className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto p-6 md:p-12">
      <EmptyState title={pageError ? 'We could not load your requests' : 'No requests shared yet'} body={pageError ? 'Try again using the button above. If the problem continues, contact your project manager.' : 'Your project manager will share your requests here. If you expected to see one, contact them for help.'} />
    </section> : canCreateRequests && view === 'create' && createContext ? <div className="min-h-0 flex-1 overflow-y-auto"><ClientCreateTicketForm
      context={createContext}
      submissionEnabled={!inspectionOnly}
      relatedTicket={relatedTicket ? { id: relatedTicket.id, reference: relatedTicket.reference, title: relatedTicket.title } : null}
      busy={writing || Boolean(pending)} error={writeError}
      onCreate={submitNewTicket}
      onCancel={() => { if (!pending) { setView('tickets'); setCreateContext(null); setCreateRelatedId(null); setWriteError(''); } }}
    /></div> : <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:p-6">
      {queue && <section className={`${selectedId ? 'hidden xl:block' : 'block'} shrink-0`} aria-label="Request overview">
        <div className="mb-2"><h2 className="text-lg font-semibold text-white">Your requests</h2><p className="text-xs text-gray-400">See what needs your attention and what happens next.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => { setFilter(workflowActionsDisabled ? 'all' : 'needs_client'); setSearchInput(''); setSearch(''); }} aria-label={workflowActionsDisabled ? 'View your requests and updates' : queue.counters.needsClient ? `${queue.counters.needsClient} ${queue.counters.needsClient === 1 ? 'request needs' : 'requests need'} your attention. Show them.` : 'You are all caught up. Show your requests.'} className="min-h-20 rounded-xl border border-white/[0.08] bg-surface p-3 text-left transition-colors hover:border-brand-400/30 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300">
            <span className="block text-xs text-gray-400">{workflowActionsDisabled ? 'Stay up to date' : 'Needs your attention'}</span>
            <span className="mt-1 block text-lg font-semibold text-white">{workflowActionsDisabled ? 'View your requests' : queue.counters.needsClient ? `${queue.counters.needsClient} ${queue.counters.needsClient === 1 ? 'request' : 'requests'}` : 'You’re all caught up'}</span>
            <span className="block text-xs leading-relaxed text-gray-400">{workflowActionsDisabled ? 'Open a request to read updates or message your project manager.' : queue.counters.needsClient ? 'A reply, decision, or review is needed.' : 'Nothing needs your reply right now.'}</span>
          </button>
          <button type="button" onClick={() => { setFilter('open'); setSearchInput(''); setSearch(''); }} aria-label={`${queue.counters.open} active ${queue.counters.open === 1 ? 'request' : 'requests'}. Show them.`} className="min-h-20 rounded-xl border border-white/[0.08] bg-surface p-3 text-left transition-colors hover:border-brand-400/30 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300">
            <span className="block text-xs text-gray-400">Active requests</span><span className="mt-1 block text-lg font-semibold text-white">{queue.counters.open}</span><span className="block text-xs text-gray-400">Requests that are not closed yet.</span>
          </button>
          {queue.items[0] ? <button type="button" aria-label={`Open most recently updated request: ${queue.items[0].title}`} onClick={() => { historyGeneration.current += 1; setSelectedId(queue.items[0].id); setView('tickets'); setWriteError(''); }} className="col-span-2 min-h-20 min-w-0 rounded-xl border border-white/[0.08] bg-surface p-3 text-left transition-colors hover:border-brand-400/30 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300 sm:col-span-1">
            <span className="block text-xs text-gray-400">Latest update in this view</span><span className="mt-1 block truncate text-sm font-medium text-white">{queue.items[0].title}</span><time dateTime={queue.items[0].updatedAt} className="mt-0.5 block text-xs text-gray-400">Updated {time(queue.items[0].updatedAt)}</time>
          </button> : <div className="col-span-2 min-h-20 rounded-xl border border-white/[0.08] bg-surface p-3 sm:col-span-1"><span className="block text-xs text-gray-400">Latest update</span><span className="mt-1 block text-sm font-medium text-white">No matching requests</span><span className="block text-xs text-gray-400">Choose All requests or clear your search.</span></div>}
        </div>
      </section>}
      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.6fr)] 2xl:grid-cols-[minmax(300px,22rem)_minmax(0,1fr)]">
      <div className={`${selectedId ? 'hidden xl:flex' : 'flex'} min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-surface`}>
        <div className="space-y-3 border-b border-white/[0.07] p-3">
          <div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-gray-100">Request list</h2><p className="mt-0.5 text-xs text-gray-400">Choose a request to see its status and conversation.</p></div>
            {canCreateRequests && <button onClick={() => void openCreateForm()} disabled={!workspaceId || createLoading || Boolean(pending)} className={primary}><Plus size={14} />{createLoading ? 'Loading…' : 'New request'}</button>}</div>
          <label className="relative block"><Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-gray-500" /><span className="sr-only">Search requests</span>
            <input value={searchInput} onChange={event => setSearchInput(event.target.value)} disabled={Boolean(pending)} placeholder="Search your requests…" className={`${input} py-2 pl-9`} /></label>
          <div className="flex flex-wrap gap-1.5">{filters.filter(option => !workflowActionsDisabled || option.id !== 'needs_client').map(option => {
            const count = queue?.counters.kind !== 'client' ? null : option.id === 'open' ? queue.counters.open : option.id === 'needs_client' ? queue.counters.needsClient : null;
            const active = filter === option.id;
            return <button key={option.id} aria-pressed={active} disabled={Boolean(pending)} onClick={() => setFilter(option.id)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${active ? 'bg-brand-600 text-on-accent' : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'}`}>{option.label}{count !== null && <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-white/20' : 'bg-white/[0.07]'}`}>{count}</span>}</button>;
          })}</div>
        </div>
        {queueError && <p role="alert" className="m-3 rounded-md border border-rose-400/20 bg-rose-500/[0.06] p-2.5 text-[11px] text-rose-200">{queueError}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {queueLoading && !queue ? <p role="status" className="p-6 text-center text-sm text-gray-400">Loading your requests…</p>
            : queue?.items.length ? queue.items.map(item => <button key={item.id} aria-pressed={selectedId === item.id} disabled={Boolean(pending)} onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(item.id); setView('tickets'); setWriteError(''); }} className={`flex w-full items-center gap-3 border-b border-white/[0.05] p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-300 disabled:opacity-50 ${selectedId === item.id ? 'bg-brand-500/[0.10] shadow-[inset_2px_0_0_0_#a78bfa]' : 'hover:bg-white/[0.025]'}`}>
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-brand-300"><FileText size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-100">{item.title}</span>
                <span className="mt-1 flex items-center justify-between gap-2"><span className="truncate font-mono text-[10px] text-gray-400">{item.reference}</span><StatusPill status={item.status} /></span>
                <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-gray-400"><span className={`truncate ${item.requestedAction && !workflowActionsDisabled ? 'font-medium text-amber-100' : ''}`}>{clientTicketProgress(item.status, workflowActionsDisabled ? null : item.requestedAction).label}</span><time dateTime={item.updatedAt} className="shrink-0">Updated {time(item.updatedAt)}</time></span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-gray-600" />
            </button>)
              : !queueError && <EmptyState title={search ? 'No requests match your search' : filter === 'all' ? 'No requests here yet' : 'No requests match this view'} body={search ? 'Try a shorter search or clear the search field.' : filter === 'all' ? canCreateRequests ? 'Choose New request above to tell your project manager what you need.' : 'Your project manager will share requests here. If you expected to see one, contact them for help.' : 'Choose All requests to see your full request list.'} />}
        </div>
        {queue && <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2 text-xs text-gray-400"><span>{queue.items.length} shown</span>{queue.nextCursor && <button onClick={() => void loadMoreQueue()} disabled={queueMoreLoading || queueLoading} className="min-h-[44px] px-2 text-brand-300 hover:text-brand-200 disabled:opacity-50">{queueMoreLoading ? 'Loading…' : 'Load more'}</button>}</div>}
      </div>

      <div className={`${selectedId ? 'flex' : 'hidden xl:flex'} min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-surface`}>
        {!selectedId || !selectedQueueItem ? <EmptyState title="Choose a request" body={workflowActionsDisabled ? 'Select a request to see its latest status.' : 'Select a request to see its status, messages, and any action your project manager needs from you.'} />
          : detailLoading ? <p role="status" className="p-8 text-center text-sm text-gray-400">Loading request…</p>
            : detailError ? <div role="alert" className="m-4 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-4 text-xs text-rose-200">{detailError}</div>
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
      </div>
    </section></div>}

    {pending && <div role="status" className="fixed bottom-4 left-4 right-4 z-40 flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-shell p-4 text-sm text-amber-100 shadow-xl sm:left-auto sm:right-4">
      <span>We’re checking whether your update was saved. Please don’t send it again yet.</span>
      <button onClick={() => void performWrite(pending).catch(() => undefined)} disabled={writing} className={`${secondary} min-h-[44px]`}>{writing ? 'Checking…' : 'Check update status'}</button>
    </div>}
    {session?.expiresAt && <span className="sr-only">Session expires {session.expiresAt}</span>}
  </main>;
}

function FullPageState({ title }: { title: string }) {
  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-sm text-gray-400" role="status"><RefreshCw size={15} className="mr-2 animate-spin" />{title}</main>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center"><Ticket aria-hidden="true" size={22} className="text-gray-400" /><p className="mt-3 text-sm font-medium text-gray-200">{title}</p><p className="mt-1 max-w-md text-sm leading-relaxed text-gray-400">{body}</p></div>;
}

function StatusPill({ status }: { status: ClientTicketQueueItem['status'] }) {
  const color = status === 'closed' ? 'text-emerald-300 bg-emerald-500/10'
    : status === 'ready_for_review' || status === 'awaiting_client' ? 'text-amber-300 bg-amber-500/10'
      : status === 'in_progress' ? 'text-brand-300 bg-brand-500/10'
        : status === 'declined' || status === 'cancelled' ? 'text-rose-300 bg-rose-500/10'
          : 'text-gray-300 bg-white/[0.06]';
  return <span className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${color}`}>{clientTicketProgress(status, null).statusLabel}</span>;
}
