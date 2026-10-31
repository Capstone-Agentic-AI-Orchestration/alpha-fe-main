import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Inbox, Mail, PanelLeftOpen, RefreshCw, Search, UserRound, XCircle } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi, type PmCentralIntakeItem } from './pmApi';
import { secondary } from './ticketUi';

interface CentralIntakeApi {
  listCentralIntakes(after?: string | null, filter?: 'pending' | 'handled'): ReturnType<typeof pmTicketApi.listCentralIntakes>;
  acceptCentralIntake(intakeId: string, operationId: string): ReturnType<typeof pmTicketApi.acceptCentralIntake>;
  declineCentralIntake(intakeId: string, operationId: string, reason?: string | null): ReturnType<typeof pmTicketApi.declineCentralIntake>;
}

function friendlyError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'Your sign-in expired. Sign in again to review shared intake.';
    if (error.status === 403) return 'You need PM access in the selected workspace to review or route intake items.';
    if (error.status === 404 || error.status === 409) return 'This item has already been handled or is no longer available. Refresh the inbox.';
    if (error.status === 429) return 'There were too many requests. Wait a moment, then refresh.';
    if (error.status !== null && error.status >= 500) return 'The shared inquiry service is temporarily unavailable.';
  }
  return 'Could not complete that action. Check your connection and refresh the inbox.';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Date unavailable';
}

function formatCompactDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Date unavailable';
}

export function PmCentralIntakeInbox({ workspaceName, workspaceId, workspaceCanReview, onAccepted, api = pmTicketApi, refreshToken }: {
  workspaceName: string | null;
  workspaceId: string | null;
  workspaceCanReview: boolean;
  onAccepted: (reference: string) => void;
  api?: CentralIntakeApi;
  /** Parent-owned refresh control shared with the Tickets/Inquiries subtab. */
  refreshToken?: number;
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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const itemsRef = useRef<PmCentralIntakeItem[]>([]);
  const operationIds = useRef(new Map<string, string>());
  const declineOperationIds = useRef(new Map<string, string>());
  const initialized = useRef(false);
  const selected = items.find(item => item.id === selectedId) ?? null;
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(item => [item.title, item.fullName, item.email, item.company ?? '', item.publicReference ?? '']
      .some(value => value.toLowerCase().includes(needle)));
  }, [items, search]);

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
        setSelectedId(current => current && page.items.some(item => item.id === current) ? current : null);
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
  }, [load, refreshToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

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
      setSelectedId(null);
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

  const selectInquiry = (id: string) => {
    setSelectedId(id);
    setNavigationCollapsed(false);
    setNewIds(current => { const next = new Set(current); next.delete(id); return next; });
    setDeclineReason('');
  };

  const renderInquiryItem = (item: PmCentralIntakeItem, variant: 'queue' | 'sidebar') => {
    const statusText = filter === 'pending'
      ? item.kind === 'project_proposal' ? 'Proposal · verified client' : 'Inquiry · email not verified'
      : item.status === 'accepted' ? 'Accepted' : 'Declined';
    const statusTone = filter === 'pending' ? 'pending' : item.status;
    return <button key={item.id} type="button" onClick={() => selectInquiry(item.id)} aria-pressed={selected?.id === item.id}
      className={`pm-inquiries__list-item pm-inquiries__list-item--${variant}${selected?.id === item.id ? ' is-selected' : ''}`}>
      <span className="pm-inquiries__item-request"><strong>{item.title}</strong><small>{item.publicReference ?? (item.kind === 'project_proposal' ? 'Project proposal' : 'Inquiry')}</small></span>
      <span className="pm-inquiries__item-client"><strong>{item.fullName}</strong><small>{item.email}</small></span>
      <span className={`pm-inquiries__item-status pm-inquiries__item-status--${statusTone}`}><strong>{statusText}</strong><small>{item.company ?? 'No company linked'}</small></span>
      <time dateTime={item.submittedAt}>{formatCompactDate(item.submittedAt)}</time>
      {newIds.has(item.id) && <span className="pm-inquiries__new-marker">New</span>}
    </button>;
  };

  const statusControls = (className: string) => <div className={`pm-inquiries__status-toggle ${className}`} role="group" aria-label="Inquiry status">
    {(['pending', 'handled'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value}
      disabled={accepting || declining} onClick={() => setFilter(value)} className={filter === value ? 'is-active' : ''}>
      {value === 'pending' ? 'Pending review' : 'Handled'}
    </button>)}
  </div>;

  const loadingRows = <div role="status" aria-label="Loading inquiries" className="pm-inquiries__skeleton-list">
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="pm-inquiries__skeleton-row">
      <Skeleton className="h-3 w-2/5" /><Skeleton className="h-2.5 w-1/4" /><Skeleton className="h-2.5 w-1/5" />
    </div>)}
  </div>;

  return <section className={`pm-inquiries${selected ? ' pm-inquiries--selected' : ''}${navigationCollapsed ? ' is-navigation-collapsed' : ''}`} aria-label="Shared PM intake inbox">
    <p className="sr-only">Review new client inquiries and project proposals, then route accepted items into the selected workspace.{workspaceName ? ` Accept destination: ${workspaceName}.` : ''}</p>
    {!workspaceId ? <div className="pm-inquiries__notice rounded-xl border border-status-warning-border bg-status-warning-subtle p-4 text-sm text-status-warning">
      Select a PM workspace to review inquiries.
    </div> : !workspaceCanReview ? <div className="pm-inquiries__notice rounded-xl border border-status-warning-border bg-status-warning-subtle p-4 text-sm text-status-warning">
      PM access is required to review inquiries.
    </div> : <div className="pm-inquiries__shell">
      {selected && <aside className="pm-inquiries__navigation" aria-label="Inquiry views" title="Click empty sidebar space to collapse or expand"
        onClick={event => {
          if (event.target instanceof Element && event.target.closest('button, a, select, input, textarea')) return;
          setNavigationCollapsed(value => !value);
        }}>
        <header className="pm-inquiries__navigation-heading">
          <div className="pm-inquiries__navigation-title"><Inbox size={17} aria-hidden="true" /><span>Inquiries</span></div>
          {navigationCollapsed && <button type="button" className="pm-inquiries__navigation-expand" aria-label="Show inquiry navigation" title="Show inquiry navigation"
            onClick={event => { event.stopPropagation(); setNavigationCollapsed(false); }}>
            <PanelLeftOpen size={16} aria-hidden="true" /><span className="sr-only">Show inquiry navigation</span>
          </button>}
        </header>
        {statusControls('pm-inquiries__status-toggle--sidebar')}
        <nav className="pm-inquiries__chat-list" aria-label="Inquiry conversations">
          <div className="pm-inquiries__list-summary">{visibleItems.length} {visibleItems.length === 1 ? 'inquiry' : 'inquiries'} · {filter === 'pending' ? 'Pending review' : 'Handled'}</div>
          <div className="pm-inquiries__list-scroll">
            {loading && items.length === 0 ? loadingRows : visibleItems.length === 0 ? <p className="pm-inquiries__empty-copy">{search ? 'No inquiries match your search.' : 'No inquiries in this view.'}</p> : visibleItems.map(item => renderInquiryItem(item, 'sidebar'))}
          </div>
          {nextCursor && <button type="button" className={`${secondary} pm-inquiries__load-more`} onClick={() => void load(nextCursor)} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>}
        </nav>
      </aside>}

      <div className="pm-inquiries__main">
        {!selected && <header className="pm-inquiries__queue-header">
          <div className="pm-inquiries__view-heading"><h1>Inquiries</h1><span>{visibleItems.length}</span></div>
          <div className="pm-inquiries__queue-actions">
            <label className="pm-inquiries__search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search inquiries</span>
              <input value={searchInput} disabled={loading && items.length === 0} onChange={event => setSearchInput(event.target.value)} placeholder="Search inquiries…" /></label>
            {statusControls('pm-inquiries__status-toggle--queue')}
          </div>
        </header>}

        {selected && <header className="pm-inquiries__detail-header">
          <div className="pm-inquiries__detail-heading">
            <button type="button" className="pm-inquiries__detail-back" aria-label="Back to inquiries" title="Back to inquiries" onClick={() => setSelectedId(null)}>
              <ArrowLeft size={17} aria-hidden="true" /><span className="sr-only">Back to inquiries</span>
            </button>
            <div className="pm-inquiries__detail-heading-copy">
              <div className="pm-inquiries__detail-meta">
                <div className="pm-inquiries__detail-identity"><Inbox size={16} aria-hidden="true" /><span>{selected.publicReference ?? 'Inquiry'}</span><span className={`pm-inquiries__detail-status pm-inquiries__detail-status--${filter === 'pending' ? 'pending' : selected.status}`}>{filter === 'pending' ? 'Pending review' : selected.status === 'accepted' ? 'Accepted' : 'Declined'}</span></div>
                <span>Submitted {formatCompactDate(selected.submittedAt)}</span>
              </div>
              <h2>{selected.title}</h2>
              <p>{selected.fullName}<span>·</span>{selected.company ?? selected.email}</p>
            </div>
          </div>
        </header>}

        {error && <p role="alert" className="pm-inquiries__error"><AlertCircle size={15} aria-hidden="true" />{error}</p>}

        {selected ? <div className="pm-inquiries__detail-content">
          <div className="pm-inquiries__meta-grid">
            <div className="pm-inquiries__info-card">
              <p className="pm-inquiries__eyebrow">{selected.kind === 'project_proposal' ? 'Client account · Verified email' : filter === 'pending' ? 'Client contact · Unverified' : 'Original inquiry contact'}</p>
              <p className="pm-inquiries__info-value"><UserRound size={14} aria-hidden="true" />{selected.fullName}</p>
              <p className="pm-inquiries__info-secondary"><Mail size={14} aria-hidden="true" />{selected.email}</p>
              {selected.company && <p className="pm-inquiries__info-secondary">{selected.company}</p>}
            </div>
            <div className="pm-inquiries__info-card">
              <p className="pm-inquiries__eyebrow">{selected.kind === 'project_proposal' ? 'Target date' : 'Requested date'}</p>
              <p className="pm-inquiries__info-value">{selected.requestedDeadline ?? 'Not specified'}</p>
              <p className="pm-inquiries__info-secondary">{selected.kind === 'project_proposal' ? 'Preferred date' : 'Client preference'}</p>
            </div>
          </div>
          <div className="pm-inquiries__request">
            <p className="pm-inquiries__eyebrow">{selected.kind === 'project_proposal' ? 'Project goal' : 'What they need'}</p>
            <p className="pm-inquiries__description">{selected.description}</p>
          </div>
          {filter === 'pending' ? <div className="pm-inquiries__decision">
            <p className="pm-inquiries__decision-copy">{selected.kind === 'project_proposal'
              ? <>Route this proposal to <span className="font-medium text-content">{workspaceName ?? 'the selected workspace'}</span> after reviewing the requested scope.</>
              : <>Accepting creates a normal ticket in <span className="font-medium text-content">{workspaceName ?? 'the selected workspace'}</span>.</>}</p>
            <label className="pm-inquiries__decline-note"><span>Optional internal decline note</span><textarea maxLength={1000} rows={2} value={declineReason} disabled={declining || accepting} onChange={event => setDeclineReason(event.target.value)} placeholder="For your team's records only" /></label>
            <div className="pm-inquiries__decision-actions"><button type="button" onClick={() => void decline()} disabled={declining || accepting || !workspaceName}
              className="inline-flex items-center gap-2 rounded-lg border border-status-danger-border px-4 py-2.5 text-sm font-medium text-status-danger hover:bg-status-danger-subtle disabled:cursor-not-allowed disabled:opacity-50">
              {declining ? <RefreshCw size={15} className="animate-spin" /> : <XCircle size={15} />}
              {declining ? 'Declining…' : selected.kind === 'project_proposal' ? 'Decline proposal' : 'Decline inquiry'}
            </button><button type="button" onClick={() => void accept()} disabled={accepting || declining || !workspaceName}
              className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2.5 text-sm font-medium text-on-action hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50">
              {accepting ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {accepting ? 'Routing…' : selected.kind === 'project_proposal' ? `Route proposal to ${workspaceName ?? 'workspace'}` : `Accept into ${workspaceName ?? 'workspace'}`}
            </button></div>
          </div> : <div className="pm-inquiries__decision pm-inquiries__decision--handled">
            {selected.handledAt && <p>Handled {formatDate(selected.handledAt)}</p>}
            <p>{selected.status === 'accepted' ? selected.kind === 'project_proposal'
              ? 'A request was created in its workspace and linked to this client.'
              : 'Accepted into a workspace. The regular ticket is managed in that workspace’s Tickets page.'
              : selected.kind === 'project_proposal' ? 'Declined. No ticket or project was created.' : 'Declined. This record creates no ticket or client access.'}</p>
            {selected.status === 'declined' && selected.kind === 'public_inquiry' && <p>{selected.outcomeEmailStatus === 'delivered'
              ? 'Outcome email accepted by the provider; inbox delivery is not confirmed.'
              : selected.outcomeEmailStatus === 'dead' ? 'Outcome email could not be sent. Contact the client directly.'
                : selected.outcomeEmailStatus ? 'Outcome email queued. The internal note is kept private.' : 'No outcome email was recorded for this older inquiry.'}</p>}
          </div>}
        </div> : <div className="pm-inquiries__queue-panel">
          <div className="pm-inquiries__queue-toolbar"><span>{visibleItems.length} {visibleItems.length === 1 ? 'inquiry' : 'inquiries'} · {filter === 'pending' ? 'Pending review' : 'Handled'}{newIds.size > 0 ? ` · ${newIds.size} new` : ''}</span><span>Open an inquiry to review</span></div>
          <div className="pm-inquiries__queue-columns" aria-hidden="true"><span>INQUIRY</span><span>CLIENT</span><span>STATUS</span><span>SUBMITTED</span></div>
          <div className="pm-inquiries__queue-scroll">
            {loading && items.length === 0 ? loadingRows : visibleItems.length === 0 ? <div className="pm-inquiries__empty"><Inbox size={20} aria-hidden="true" /><p>{search ? 'No inquiries match your search.' : filter === 'pending' ? 'No inquiries waiting for review' : 'No handled inquiries yet'}</p></div> : visibleItems.map(item => renderInquiryItem(item, 'queue'))}
          </div>
          {nextCursor && <button type="button" className={`${secondary} pm-inquiries__queue-load-more`} onClick={() => void load(nextCursor)} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>}
        </div>}
      </div>
    </div>}
  </section>;
}
