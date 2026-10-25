import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Inbox, Mail, RefreshCw, Send, UserRound, XCircle } from 'lucide-react';
import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi, type PmCentralIntakeItem } from './pmApi';
import { primary, secondary } from './ticketUi';

interface CentralIntakeApi {
  listCentralIntakes(after?: string | null, filter?: 'pending' | 'handled'): ReturnType<typeof pmTicketApi.listCentralIntakes>;
  acceptCentralIntake(intakeId: string, operationId: string): ReturnType<typeof pmTicketApi.acceptCentralIntake>;
  declineCentralIntake(intakeId: string, operationId: string, reason?: string | null): ReturnType<typeof pmTicketApi.declineCentralIntake>;
}

function friendlyError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'Your sign-in expired. Sign in again to review inquiries.';
    if (error.status === 403) return 'You need PM access in the selected workspace to view or accept inquiries.';
    if (error.status === 404 || error.status === 409) return 'This inquiry has already been handled or is no longer available. Refresh the inbox.';
    if (error.status === 429) return 'There were too many requests. Wait a moment, then refresh.';
    if (error.status !== null && error.status >= 500) return 'The shared inquiry service is temporarily unavailable.';
  }
  return 'Could not complete that action. Check your connection and refresh the inbox.';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Date unavailable';
}

export function PmCentralIntakeInbox({ workspaceName, workspaceId, workspaceCanReview, onAccepted, api = pmTicketApi }: {
  workspaceName: string | null;
  workspaceId: string | null;
  workspaceCanReview: boolean;
  onAccepted: (reference: string) => void;
  api?: CentralIntakeApi;
}) {
  const [items, setItems] = useState<PmCentralIntakeItem[]>([]);
  const [filter, setFilter] = useState<'pending' | 'handled'>('pending');
  const loadGeneration = useRef(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const itemsRef = useRef<PmCentralIntakeItem[]>([]);
  const operationIds = useRef(new Map<string, string>());
  const declineOperationIds = useRef(new Map<string, string>());
  const initialized = useRef(false);
  const selected = items.find(item => item.id === selectedId) ?? items[0] ?? null;

  const load = useCallback(async (after: string | null = null) => {
    if (!workspaceId || !workspaceCanReview) return;
    const generation = ++loadGeneration.current;
    if (after) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const page = await api.listCentralIntakes(after, filter);
      if (generation !== loadGeneration.current) return;
      if (after) {
        setItems(current => {
          const combined = [...current, ...page.items];
          itemsRef.current = combined;
          return combined;
        });
      } else {
        if (initialized.current && filter === 'pending') {
          const currentIds = new Set(itemsRef.current.map(item => item.id));
          const fresh = page.items.filter(item => !currentIds.has(item.id)).map(item => item.id);
          if (fresh.length) setNewIds(current => new Set([...current, ...fresh]));
        }
        initialized.current = true;
        itemsRef.current = page.items;
        setItems(page.items);
        setSelectedId(current => current && page.items.some(item => item.id === current) ? current : page.items[0]?.id ?? null);
      }
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      if (generation === loadGeneration.current) setError(friendlyError(loadError));
    } finally {
      if (generation === loadGeneration.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [api, workspaceCanReview, workspaceId, filter]);

  useEffect(() => {
    setItems([]);
    itemsRef.current = [];
    setSelectedId(null);
    setNextCursor(null);
    setDeclineReason(''); setNewIds(new Set()); initialized.current = false;
    void load();
    return () => { loadGeneration.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!workspaceId || !workspaceCanReview) return;
    const refreshIfVisible = () => { if (document.visibilityState === 'visible' && !accepting && !declining) void load(); };
    const timer = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshIfVisible); };
  }, [load, workspaceCanReview, workspaceId, accepting, declining]);

  const accept = async () => {
    if (!selected || !workspaceId || accepting || declining || filter !== 'pending') return;
    const generation = ++loadGeneration.current;
    setLoading(false); setLoadingMore(false);
    let operationId = operationIds.current.get(selected.id);
    if (!operationId) {
      operationId = crypto.randomUUID();
      operationIds.current.set(selected.id, operationId);
    }
    setAccepting(true);
    setError('');
    try {
      const result = await api.acceptCentralIntake(selected.id, operationId);
      if (generation !== loadGeneration.current) return;
      if (result.workspaceId !== workspaceId) throw new Error('The inquiry was accepted into a different workspace.');
      operationIds.current.delete(selected.id);
      onAccepted(result.reference);
    } catch (acceptError) {
      // Retain the same operation key after an uncertain response so a retry
      // safely reconciles the original acceptance rather than creating twice.
      if (!(acceptError instanceof ApiRequestError) || (acceptError.status !== null && acceptError.status < 500)) {
        operationIds.current.delete(selected.id);
      }
      setError(friendlyError(acceptError));
    } finally {
      setAccepting(false);
    }
  };

  const decline = async () => {
    if (!selected || !workspaceId || declining || accepting || filter !== 'pending') return;
    const generation = ++loadGeneration.current;
    setLoading(false); setLoadingMore(false);
    let operationId = declineOperationIds.current.get(selected.id);
    if (!operationId) {
      operationId = crypto.randomUUID();
      declineOperationIds.current.set(selected.id, operationId);
    }
    setDeclining(true);
    setError('');
    try {
      await api.declineCentralIntake(selected.id, operationId, declineReason.trim() || null);
      if (generation !== loadGeneration.current) return;
      declineOperationIds.current.delete(selected.id);
      setNewIds(current => { const next = new Set(current); next.delete(selected.id); return next; });
      const remaining = items.filter(item => item.id !== selected.id);
      itemsRef.current = remaining;
      setItems(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setDeclineReason('');
    } catch (declineError) {
      if (!(declineError instanceof ApiRequestError) || (declineError.status !== null && declineError.status < 500)) {
        declineOperationIds.current.delete(selected.id);
      }
      setError(friendlyError(declineError));
    } finally {
      setDeclining(false);
    }
  };

  return <section className="flex h-full min-h-0 flex-col px-4 pb-4 pt-5 md:px-6" aria-label="Shared PM inquiry inbox">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><Inbox size={18} className="text-link" /><h1 className="text-lg font-semibold text-content">Shared inquiries</h1></div>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-content-secondary">One shared intake queue for Alpha. Review an inquiry, then accept it into your current workspace before it becomes a regular ticket.</p>
        {workspaceName && <p className="mt-2 text-[11px] text-content-muted">Accept destination: <span className="font-medium text-content-secondary">{workspaceName}</span></p>}
      </div>
      <button type="button" className={secondary} onClick={() => void load()} disabled={loading || accepting || declining || !workspaceId || !workspaceCanReview}>
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
      </button>
    </header>
    <nav aria-label="Inquiry status" className="mb-4 flex gap-2">
      {(['pending', 'handled'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value}
        disabled={accepting || declining} onClick={() => setFilter(value)} className={filter === value ? primary : secondary}>
        {value === 'pending' ? 'Pending review' : 'Handled inquiries'}
      </button>)}
    </nav>

    {!workspaceId ? <div className="rounded-xl border border-status-warning-border bg-status-warning-subtle p-4 text-sm text-status-warning">
      Select a workspace where you have PM access to review and accept shared inquiries.
    </div> : !workspaceCanReview ? <div className="rounded-xl border border-status-warning-border bg-status-warning-subtle p-4 text-sm text-status-warning">
      The shared inquiry inbox is available only to PMs in the selected workspace.
    </div> : <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.5fr)]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-divider bg-surface">
        <div className="border-b border-divider px-4 py-3 text-xs text-content-secondary">{items.length} loaded {items.length === 1 ? 'inquiry' : 'inquiries'} · {filter === 'pending' ? 'Pending PM review' : 'Handled inquiries'}{newIds.size > 0 ? ` · ${newIds.size} new` : ''}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && items.length === 0 ? <p role="status" className="p-5 text-xs text-content-secondary">Loading shared inquiries…</p>
            : items.length === 0 ? <div className="p-5 text-center"><Inbox size={22} className="mx-auto text-content-muted" /><p className="mt-3 text-sm text-content-secondary">{filter === 'pending' ? 'No inquiries waiting' : 'No handled inquiries yet'}</p><p className="mt-1 text-xs text-content-muted">{filter === 'pending' ? 'New client inquiries will appear here for PM review.' : 'Accepted and declined inquiries remain here for reference.'}</p></div>
              : items.map(item => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setNewIds(current => { const next = new Set(current); next.delete(item.id); return next; }); setDeclineReason(''); }} aria-pressed={selected?.id === item.id}
                className={`block w-full border-b border-divider border-l-2 p-4 text-left transition-colors ${selected?.id === item.id ? 'border-l-control bg-selected' : 'border-l-transparent hover:bg-surface-high'}`}>
                <span className="flex items-center justify-between gap-2"><span className="block truncate text-sm font-medium text-content">{item.title}</span>{newIds.has(item.id) && <span className="shrink-0 rounded bg-selected px-1.5 py-0.5 text-[9px] text-selected-content">New</span>}</span>
                <span className="mt-1 block truncate text-xs text-content-secondary">{item.fullName} · {item.email}</span>
                <span className="mt-2 flex items-center gap-1 text-[11px] text-status-warning"><Clock3 size={12} />{filter === 'pending' ? 'Email not verified' : item.status === 'accepted' ? 'Accepted' : 'Declined'}</span>
              </button>)}
        </div>
        {nextCursor && <button type="button" className={`${secondary} m-3 justify-center`} onClick={() => void load(nextCursor)} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more inquiries'}
        </button>}
      </div>

      <div className="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-divider bg-surface">
        {error && <p role="alert" className="m-4 flex items-start gap-2 rounded-lg border border-status-danger-border bg-status-danger-subtle p-3 text-xs text-status-danger"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</p>}
        {selected ? <>
          <div className="border-b border-divider p-5">
            <p className="text-[11px] uppercase tracking-wide text-content-muted">{filter === 'pending' ? 'Inquiry · Not yet a ticket' : selected.status === 'accepted' ? 'Accepted inquiry' : 'Declined inquiry'}</p>
            <h2 className="mt-2 text-lg font-semibold text-content">{selected.title}</h2>
            {selected.publicReference && <p className="mt-1 font-mono text-[10px] text-content-muted">{selected.publicReference}</p>}
            <p className="mt-2 text-xs text-content-muted">Received {formatDate(selected.submittedAt)}</p>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <div className="rounded-lg border border-divider p-4">
              <p className="text-[10px] uppercase tracking-wide text-content-muted">{filter === 'pending' ? 'Client contact · Unverified' : 'Original inquiry contact'}</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-content"><UserRound size={14} />{selected.fullName}</p>
              <p className="mt-2 flex items-center gap-2 break-all text-xs text-content-secondary"><Mail size={14} className="shrink-0" />{selected.email}</p>
              {selected.company && <p className="mt-2 text-xs text-content-secondary">{selected.company}</p>}
            </div>
            <div className="rounded-lg border border-divider p-4">
              <p className="text-[10px] uppercase tracking-wide text-content-muted">Requested date</p>
              <p className="mt-3 text-sm text-content">{selected.requestedDeadline ?? 'Not specified'}</p>
              <p className="mt-2 text-xs text-content-muted">The date is a client preference, not a commitment.</p>
            </div>
          </div>
          <div className="mx-5 rounded-lg border border-divider p-4">
            <p className="text-[10px] uppercase tracking-wide text-content-muted">What they need</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-content-secondary">{selected.description}</p>
          </div>
          {filter === 'pending' ? <div className="mt-auto border-t border-divider p-5">
            <p className="mb-3 text-xs leading-relaxed text-content-secondary">Accepting creates a normal ticket in <span className="font-medium text-content">{workspaceName ?? 'the selected workspace'}</span>. It does not verify the email, create a project, invite the client, or grant portal access.</p>
            <label className="mb-3 block space-y-1.5"><span className="text-[11px] font-medium text-content-secondary">Optional internal decline note</span><textarea maxLength={1000} rows={2} value={declineReason} disabled={declining || accepting} onChange={event => setDeclineReason(event.target.value)} className="w-full rounded-lg border border-divider bg-well p-2.5 text-xs text-content outline-none focus:border-control" placeholder="For your team's records only" /></label>
            <p className="mb-3 text-[10px] text-content-muted">Declining queues a general outcome email to the inquiry contact. The internal note is not emailed; no ticket or account is created.</p>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void decline()} disabled={declining || accepting || !workspaceName}
              className="inline-flex items-center gap-2 rounded-lg border border-status-danger-border px-4 py-2.5 text-sm font-medium text-status-danger hover:bg-status-danger-subtle disabled:cursor-not-allowed disabled:opacity-50">
              {declining ? <RefreshCw size={15} className="animate-spin" /> : <XCircle size={15} />}
              {declining ? 'Declining…' : 'Decline inquiry'}
            </button><button type="button" onClick={() => void accept()} disabled={accepting || declining || !workspaceName}
              className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2.5 text-sm font-medium text-on-action hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50">
              {accepting ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {accepting ? 'Accepting…' : `Accept into ${workspaceName ?? 'workspace'}`}
            </button></div>
          </div> : <div className="mt-auto border-t border-divider p-5 text-xs leading-relaxed text-content-secondary">
            {selected.handledAt && <p>Handled {formatDate(selected.handledAt)}</p>}
            <p className="mt-2">{selected.status === 'accepted' ? 'Accepted into a workspace. The regular ticket is managed in that workspace’s Tickets page.' : 'Declined. This record creates no ticket or client access.'}</p>
            {selected.status === 'declined' && <p className="mt-2">{selected.outcomeEmailStatus === 'delivered'
              ? 'Outcome email accepted by the provider; inbox delivery is not confirmed.'
              : selected.outcomeEmailStatus === 'dead' ? 'Outcome email could not be sent. Contact the client directly.'
                : selected.outcomeEmailStatus ? 'Outcome email queued. The internal note is kept private.' : 'No outcome email was recorded for this older inquiry.'}</p>}
          </div>}
        </> : <div className="flex min-h-64 flex-1 flex-col items-center justify-center p-6 text-center">
          {error ? <><AlertCircle size={22} className="text-status-danger" /><p className="mt-3 text-sm text-content-secondary">The inbox could not be loaded.</p></> : <><Send size={22} className="text-content-muted" /><p className="mt-3 text-sm text-content-secondary">Select an inquiry to review</p></>}
        </div>}
      </div>
    </div>}
  </section>;
}
