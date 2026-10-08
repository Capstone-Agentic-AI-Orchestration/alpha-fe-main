import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, LogOut, Plus, RefreshCw, Search, Ticket } from 'lucide-react';

import alphaMarkUrl from '@/assets/alpha-mark.png';
import type {
  ClientSession, ClientTicketCommandInput, ClientTicketCreateInput, ClientTicketDetail as TicketDetail,
  ClientTicketMessage, ClientTicketQueue, ClientTicketQueueItem, ClientTicketReceipt, ClientTicketReplyInput,
} from './clientApi';
import { ClientTicketApiError, clientTicketApi } from './clientApi';
import { ClientCreateTicketForm } from './ClientCreateTicketForm';
import { ClientTicketDetail } from './ClientTicketDetail';
import { ClientAccessPanel } from './ClientAccessPanel';
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
  { id: 'all', label: 'All tickets' },
  { id: 'open', label: 'Open' },
  { id: 'needs_client', label: 'Needs your action' },
  { id: 'history', label: 'History' },
];

function friendlyError(error: unknown, context: 'session' | 'queue' | 'ticket' | 'write' | 'create'): string {
  if (!(error instanceof ClientTicketApiError)) {
    return context === 'session' ? 'Could not check client access. Try again later.'
      : context === 'queue' ? 'Could not load your tickets. Try again later.'
        : context === 'ticket' ? 'Could not load this ticket. Try again later.'
          : context === 'create' ? 'Could not prepare a new request. Try again later.'
            : 'Your change could not be completed.';
  }
  if (context === 'session' && error.status === 404) return 'The secure client service is not connected in this environment yet.';
  if (context === 'session' && error.status === 503) return 'Secure client sign-in is not configured in this environment yet.';
  if (context === 'session' && error.status === 401) return 'There is no active client session. Secure invitation sign-in is not connected in this environment yet.';
  if (context === 'queue' && error.status === 404) return 'Your ticket service is not connected in this environment yet.';
  if (error.reconciliationRequired) return 'The result is still uncertain. Use “Check same request” before starting another request.';
  return error.message;
}

function statusName(status: ClientTicketQueueItem['status']): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, value => value.toUpperCase());
}

export default function ClientPortal({ api = clientTicketApi, inspectionOnly = false }: {
  api?: typeof clientTicketApi;
  inspectionOnly?: boolean;
} = {}) {
  const [portalState, setPortalState] = useState<PortalState>('checking');
  const [session, setSession] = useState<ClientSession | null>(null);
  const [workspaceOptions, setWorkspaceOptions] = useState<Array<{ workspaceId: string; displayName: string }>>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [queue, setQueue] = useState<ClientTicketQueue | null>(null);
  const [filter, setFilter] = useState<NonNullable<Filter>>('all');
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
    Promise.all([
      api.getTicket(workspaceId, selectedId),
      api.getMessages(workspaceId, selectedId, { limit: 50 }),
    ]).then(([ticket, page]) => {
      if (!current) return;
      setDetail(ticket); setMessages(page.items); setMessageCursor(page.nextCursor);
    }).catch(error => {
      if (current && !isExpiredClientSession(error)) setDetailError(friendlyError(error, 'ticket'));
    }).finally(() => {
      if (current) setDetailLoading(false);
    });
    return () => {
      current = false;
      if (historyGeneration.current === generation) historyGeneration.current += 1;
    };
  }, [portalState, workspaceId, selectedId, selectedQueueItem?.id, refreshVersion, api]);

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
    if (!workspaceId || !selectedId || !messageCursor || historyLoading) return;
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
    if (!workspaceId || createLoading || pending) return;
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
    if (pending || !workspaceId) return;
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

  if (portalState === 'checking') return <FullPageState title="Checking secure client access…" />;
  if (portalState === 'signed_out' || portalState === 'unavailable') return <ClientAccessPanel
    unavailable={portalState === 'unavailable'} error={pageError}
    onRetry={() => setSessionCheckVersion(value => value + 1)}
  />;

  const selectedWorkspace = workspaceOptions.find(item => item.workspaceId === workspaceId);
  const relatedTicket = createRelatedId
    ? queue?.items.find(item => item.id === createRelatedId) ?? null
    : null;

  return <main className="flex min-h-dvh flex-col bg-canvas font-sans text-gray-300">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-shell px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3"><img src={alphaMarkUrl} alt="Alpha" className="h-8 w-8 object-contain" /><div className="min-w-0"><p className="text-sm font-semibold text-white">Alpha Client Portal</p><p className="truncate text-[10px] text-gray-500">{selectedWorkspace?.displayName ?? 'Invitation-only access'}</p></div></div>
      <div className="flex items-center gap-2">
        {workspaceOptions.length > 1 && <label><span className="sr-only">Choose workspace</span><select value={workspaceId} disabled={Boolean(pending)} onChange={event => { queueGeneration.current += 1; historyGeneration.current += 1; setQueueLoading(false); setQueueMoreLoading(false); setHistoryLoading(false); setWorkspaceId(event.target.value); setQueue(null); setSelectedId(null); setDetail(null); }} className={`${input} w-auto min-w-40 py-2 text-xs`}>
          {workspaceOptions.map(option => <option key={option.workspaceId} value={option.workspaceId}>{option.displayName}</option>)}
        </select></label>}
        <button onClick={() => setRefreshVersion(value => value + 1)} disabled={queueLoading || Boolean(pending)} className={secondary}><RefreshCw size={13} className={queueLoading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span></button>
        <button onClick={() => void signOut()} disabled={inspectionOnly || signingOut || Boolean(pending)} className={secondary}><LogOut size={13} /><span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span></button>
      </div>
    </header>

    {inspectionOnly && <p role="status" className="mx-4 mt-3 rounded-lg border border-amber-400/15 bg-amber-500/[0.04] px-3 py-2 text-[11px] text-amber-100/80 md:mx-6">Fictional sample tickets · the same client interface used by Alpha. Submissions, replies, sign-in, uploads and downloads are disabled.</p>}
    {pageError && <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-3 text-xs text-rose-200 md:mx-6"><AlertCircle size={14} className="mt-0.5 shrink-0" />{pageError}</div>}

    {workspaceOptions.length === 0 ? <section className="mx-auto w-full max-w-2xl p-6 md:p-12">
      <EmptyState title="No shared workspace yet" body="Your project manager has not enabled client access to a workspace. You will only see projects and requests that are explicitly shared with your account." />
    </section> : view === 'create' && createContext ? <ClientCreateTicketForm
      context={createContext}
      submissionEnabled={!inspectionOnly}
      relatedTicket={relatedTicket ? { id: relatedTicket.id, reference: relatedTicket.reference, title: relatedTicket.title } : null}
      busy={writing || Boolean(pending)} error={writeError}
      onCreate={submitNewTicket}
      onCancel={() => { if (!pending) { setView('tickets'); setCreateContext(null); setCreateRelatedId(null); setWriteError(''); } }}
    /> : <section className="grid min-h-0 flex-1 gap-4 p-4 md:p-6 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.6fr)]">
      <div className={`${selectedId ? 'hidden xl:flex' : 'flex'} min-h-[360px] min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-surface`}>
        <div className="space-y-3 border-b border-white/[0.07] p-3">
          <div className="flex items-center justify-between gap-2"><div><h1 className="text-sm font-semibold text-gray-100">My tickets</h1><p className="mt-0.5 text-[10px] text-gray-500">Talk with your project manager on each request.</p></div>
            <button onClick={() => void openCreateForm()} disabled={!workspaceId || createLoading || Boolean(pending)} className={primary}><Plus size={14} />{createLoading ? 'Loading…' : 'New request'}</button></div>
          <label className="relative block"><Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-gray-600" /><span className="sr-only">Search tickets</span>
            <input value={searchInput} onChange={event => setSearchInput(event.target.value)} disabled={Boolean(pending)} placeholder="Search your tickets…" className={`${input} py-2 pl-9`} /></label>
          <div className="flex flex-wrap gap-1.5">{filters.map(option => <button key={option.id} aria-pressed={filter === option.id} disabled={Boolean(pending)} onClick={() => setFilter(option.id)} className={`rounded-md px-2 py-1 text-[10px] ${filter === option.id ? 'bg-brand-500/15 text-brand-200' : 'text-gray-500 hover:bg-white/[0.05] hover:text-gray-300'}`}>{option.label}</button>)}</div>
          {queue?.counters.kind === 'client' && <div className="grid grid-cols-2 gap-2"><Metric label="Open" value={queue.counters.open} /><Metric label="Needs your action" value={queue.counters.needsClient} /></div>}
        </div>
        {queueError && <p role="alert" className="m-3 rounded-md border border-rose-400/20 bg-rose-500/[0.06] p-2.5 text-[11px] text-rose-200">{queueError}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {queueLoading && !queue ? <p className="p-6 text-center text-xs text-gray-500">Loading your tickets…</p>
            : queue?.items.length ? queue.items.map(item => <button key={item.id} disabled={Boolean(pending)} onClick={() => { historyGeneration.current += 1; setHistoryLoading(false); setSelectedId(item.id); setView('tickets'); setWriteError(''); }} className={`w-full border-b border-white/[0.05] p-4 text-left transition-colors disabled:opacity-50 ${selectedId === item.id ? 'bg-brand-500/[0.08] shadow-[inset_2px_0_0_0_#a78bfa]' : 'hover:bg-white/[0.025]'}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-gray-500">{item.reference}</span><StatusPill status={item.status} /></div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-200">{item.title}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-gray-500"><span>{item.requestedAction ? 'Your action needed' : ['closed', 'declined', 'cancelled'].includes(item.status) ? 'Read-only history' : item.status === 'in_progress' ? 'Work in progress' : 'With your project manager'}</span><time dateTime={item.updatedAt}>{time(item.updatedAt)}</time></div>
            </button>)
              : !queueError && <EmptyState title="No tickets in this view" body={filter === 'all' ? 'Submit a request when you need help with your project.' : 'Try another filter or clear your search.'} />}
        </div>
        {queue && <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2 text-[10px] text-gray-600"><span>{queue.items.length} shown</span>{queue.nextCursor && <button onClick={() => void loadMoreQueue()} disabled={queueMoreLoading || queueLoading} className="text-brand-300 hover:text-brand-200 disabled:opacity-50">{queueMoreLoading ? 'Loading…' : 'Load more'}</button>}</div>}
      </div>

      <div className={`${selectedId ? 'block' : 'hidden xl:block'} min-h-[420px] min-w-0 overflow-hidden rounded-xl border border-white/[0.08] bg-surface`}>
        {!selectedId || !selectedQueueItem ? <EmptyState title="Select a ticket" body="Choose one of your requests to read the conversation, review shared scope or results, and reply to your project manager." />
          : detailLoading ? <p role="status" className="p-8 text-center text-xs text-gray-500">Loading ticket…</p>
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
                onBack={() => { historyGeneration.current += 1; setSelectedId(null); setDetail(null); }}
                onLoadMore={() => void loadMoreMessages()}
                onReply={sendReply}
                onCorrection={sendCorrection}
                onDecision={makeDecision}
                onAdditionalWork={() => void openCreateForm(detail.id)}
              />}
      </div>
    </section>}

    {pending && <div className="fixed bottom-4 right-4 z-40 flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-shell p-4 text-xs text-amber-100 shadow-xl">
      <span>Unconfirmed {pending.label} · {pending.operationId.slice(0, 8)}… Keep this same request while it is checked.</span>
      <button onClick={() => void performWrite(pending).catch(() => undefined)} disabled={writing} className={secondary}>{writing ? 'Checking…' : 'Check same request'}</button>
    </div>}
    {session?.expiresAt && <span className="sr-only">Session expires {session.expiresAt}</span>}
  </main>;
}

function FullPageState({ title }: { title: string }) {
  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-sm text-gray-400" role="status"><RefreshCw size={15} className="mr-2 animate-spin" />{title}</main>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center"><Ticket size={22} className="text-gray-600" /><p className="mt-3 text-sm font-medium text-gray-300">{title}</p><p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500">{body}</p></div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2"><span className="block text-[10px] text-gray-500">{label}</span><span className="mt-1 block text-base font-semibold tabular-nums text-gray-100">{value}</span></div>;
}

function StatusPill({ status }: { status: ClientTicketQueueItem['status'] }) {
  const color = status === 'closed' ? 'text-emerald-300 bg-emerald-500/10'
    : status === 'ready_for_review' || status === 'awaiting_client' ? 'text-amber-300 bg-amber-500/10'
      : status === 'in_progress' ? 'text-brand-300 bg-brand-500/10'
        : status === 'declined' || status === 'cancelled' ? 'text-rose-300 bg-rose-500/10'
          : 'text-gray-300 bg-white/[0.06]';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${color}`}>{statusName(status)}</span>;
}
