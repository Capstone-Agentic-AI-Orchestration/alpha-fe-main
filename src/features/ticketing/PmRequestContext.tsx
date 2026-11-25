import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Info, Paperclip, StickyNote, Ticket } from 'lucide-react';
import { pmTicketApi, type PmTicketDetail, type PmTicketNote } from './pmApi';
import { PmContactVerification } from './PmTicketsView';
import { TicketDocumentsPanel } from './TicketDocumentsPanel';
import type { TicketDocumentsReadApi } from './ticketDocuments';
import type { ConversationRequest } from './projectConversation';
import { PmCollapsibleRailCard, PmRailCard } from './PmConversationRail';
import { compactTicketReference, time } from './ticketUi';
import './pmTickets.css';

const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const day = (value: string) => new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });

/** Loads one request's PM detail, again whenever `version` changes. */
export function usePmRequestDetail(api: typeof pmTicketApi, ticketId: string | null, version: unknown) {
  const [detail, setDetail] = useState<PmTicketDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    let current = true;
    if (!ticketId) { setDetail(null); return () => { current = false; }; }
    void api.get(ticketId).then(value => { if (current) setDetail(value); })
      .catch(error_ => { if (current) { setDetail(null); setError(errorText(error_, 'This request could not be loaded.')); } });
    return () => { current = false; };
  }, [api, ticketId, version]);
  const current = detail !== null && ticketId !== null && detail.id === ticketId ? detail : null;
  return { detail: current, error };
}

function projectNote(detail: PmTicketDetail): string {
  if (!detail.internal.projectId) return 'Link a project when you start the work.';
  return detail.internal.projectClientVisible ? 'The client can see this project' : 'PM-only project link';
}

/** A label and its value, one row of a details card. */
function Row({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return <div className="pm-rail-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

function Details({ detail, clientName }: Readonly<{ detail: PmTicketDetail; clientName: string }>) {
  const contact = detail.internal.request?.contact ?? null;
  return <div className="space-y-4">
    <dl className="pm-rail-rows">
      <Row label="Client">{detail.companyLabel || clientName}</Row>
      {contact && <Row label="Contact">{contact.fullName}</Row>}
      {contact && <Row label="Email"><span className="break-all">{contact.email}</span><br /><PmContactVerification verification={contact.verification} /></Row>}
      <Row label="Project">{detail.internal.projectName ?? detail.request?.projectLabel ?? 'No project linked'}
        <span className="pm-rail-row__hint">{projectNote(detail)}</span></Row>
      {detail.request?.requestedDeadline && <Row label="Hoped-for date">{detail.request.requestedDeadline} · not guaranteed</Row>}
      <Row label="Created">{day(detail.createdAt)}</Row>
      <Row label="Reference"><span className="font-mono text-[11.5px]" title={detail.reference}>{compactTicketReference(detail.reference)}</span></Row>
    </dl>
    {detail.scope && <section className="pm-rail-sub">
      <p className="pm-rail-sub__label">Proposed scope · {detail.scope.agreed ? 'Agreed' : 'Awaiting client'}</p>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-content">{detail.scope.summary}</p>
    </section>}
    {detail.internal.scopeVersion && <details className="pm-tickets__internal-brief">
      <summary>Internal developer brief</summary>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-content">{detail.internal.scopeVersion.developerBrief ?? 'No internal brief is available for this older scope record.'}</p>
    </details>}
    {detail.internal.requiredIssueIds.length > 0 && <section className="pm-rail-sub" aria-label="Tasks authorized for this request">
      <p className="pm-rail-sub__label">Authorized task IDs</p>
      <ul className="space-y-1">
        {detail.internal.requiredIssueIds.map(issueId => <li key={issueId} className="break-all font-mono text-[11px] text-content-secondary">{issueId}</li>)}
      </ul>
    </section>}
  </div>;
}

function Notes({ api, detail, onSaved }: Readonly<{ api: typeof pmTicketApi; detail: PmTicketDetail; onSaved: () => void }>) {
  const [notes, setNotes] = useState<PmTicketNote[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const ticketId = detail.id;
  const load = useCallback(async () => {
    try { setNotes((await api.getNotes(ticketId)).items); setError(''); }
    catch (error_) { setError(errorText(error_, 'Private notes could not be loaded.')); }
  }, [api, ticketId]);
  useEffect(() => { setNotes(null); void load(); }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true); setError('');
    try {
      await api.addNote(ticketId, { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: detail.version, body });
      setDraft('');
      await load();
      onSaved();
    } catch (error_) { setError(errorText(error_, 'The note was not saved. Try again.')); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <p className="text-[12px] text-content-muted">Only your team sees these notes. The client never does.</p>
    {error && <p role="alert" className="text-[12.5px] text-status-danger">{error}</p>}
    {notes === null && !error && <p className="text-[12.5px] text-content-muted">Loading notes…</p>}
    {notes?.length === 0 && <p className="text-[12.5px] text-content-muted">No private notes yet. Keep internal context here for the project team.</p>}
    {notes && notes.length > 0 && <ul className="space-y-3">
      {notes.map(note => <li key={note.id} className="border-l-2 border-status-warning/60 pl-3">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-content">{note.body}</p>
        <p className="mt-1 text-[11px] text-content-muted">{time(note.createdAt)}</p>
      </li>)}
    </ul>}
    {detail.writesAvailable && <form onSubmit={event => void save(event)} className="space-y-2 border-t border-divider pt-4">
      <label htmlFor={`pm-note-${ticketId}`} className="sr-only">Private note</label>
      <textarea id={`pm-note-${ticketId}`} value={draft} onChange={event => setDraft(event.target.value)} rows={3} maxLength={6000} disabled={saving}
        placeholder="Write a private note…" className="w-full rounded-md border border-control bg-well px-2.5 py-2 text-[13px] text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-focus" />
      <div className="flex justify-end">
        <button type="submit" disabled={saving || !draft.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-divider px-3 text-[12.5px] font-medium text-content-secondary hover:bg-surface-high disabled:opacity-50">
          <StickyNote size={14} aria-hidden="true" />{saving ? 'Saving…' : 'Save note'}</button>
      </div>
    </form>}
  </div>;
}

export function PmSelectedTicket({ api = pmTicketApi, documentsApi, request, clientName, detail, error, refreshToken = '', onChanged, actions, onOpenWorkflow }: Readonly<{
  api?: typeof pmTicketApi;
  documentsApi: TicketDocumentsReadApi;
  request: ConversationRequest;
  clientName: string;
  detail: PmTicketDetail | null;
  error: string;
  refreshToken?: string;
  actions?: ReactNode;
  onOpenWorkflow?: () => void;
  onChanged?: () => void;
}>) {
  const open = detail && !['closed', 'declined', 'cancelled'].includes(detail.status);
  const inFlight = open && (detail.scope || detail.internal.scopeVersion || detail.internal.authorizedScopeVersionId
    || detail.internal.requiredIssueIds.length || detail.delivery || detail.internal.deliveryAssessment
    || detail.status === 'on_hold' || detail.internal.withdrawalRequested);
  return <PmRailCard icon={<Ticket size={16} />} title={request.title} label="Selected ticket details">
    {error && <p role="alert" className="pm-rail-note is-danger">{error}{' '}
      <button type="button" className="text-link underline" onClick={onChanged}>Retry</button>
    </p>}
    {!detail && !error && <p role="status" className="pm-rail-note">Loading ticket…</p>}
    {detail && <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 empty:hidden">
        {actions}
        {inFlight && onOpenWorkflow && <button type="button" className="text-xs font-semibold text-link hover:underline"
          onClick={onOpenWorkflow}>Open request workflow</button>}
      </div>
      <div>
        <PmCollapsibleRailCard nested id="selected-ticket-details" icon={<Info size={16} />} title="Request details">
          <p className="mb-4 whitespace-pre-wrap text-[13px] leading-relaxed text-content">{detail.description}</p>
          <Details detail={detail} clientName={clientName} />
          {!inFlight && open && detail.writesAvailable && onOpenWorkflow
            && <button type="button" className="mt-4 text-xs font-semibold text-link hover:underline"
              onClick={onOpenWorkflow}>Manage request</button>}
        </PmCollapsibleRailCard>
        <PmCollapsibleRailCard nested id="selected-ticket-notes" icon={<StickyNote size={16} />} title="Private notes" initiallyOpen={false}>
          <Notes api={api} detail={detail} onSaved={() => onChanged?.()} />
        </PmCollapsibleRailCard>
        <PmCollapsibleRailCard nested id="selected-ticket-documents" icon={<Paperclip size={16} />} title="Documents" initiallyOpen={false}>
          <TicketDocumentsPanel api={documentsApi} ticketId={detail.id} heading="Shared files" layout="inline" canUpload={false} showTitle={false} showRefresh={false}
            refreshToken={refreshToken} emptyMessage="No client files have been uploaded to this request yet."
            readOnlyMessage="Only the client can upload files. You can download the files they share here." />
        </PmCollapsibleRailCard>
      </div>
    </>}
  </PmRailCard>;
}
