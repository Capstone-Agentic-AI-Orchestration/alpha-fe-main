import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CircleDot, StickyNote, UserRound } from 'lucide-react';
import { pmTicketApi, type PmTicketDetail, type PmTicketNote } from './pmApi';
import { PmContactVerification, pmStatusLabel, pmStatusStyle } from './PmTicketsView';
import { pmTicketNextAction } from './pmTicketNextAction';
import { TicketDocumentsPanel } from './TicketDocumentsPanel';
import type { TicketDocumentsReadApi } from './ticketDocuments';
import type { ConversationRequest } from './projectConversation';
import { time } from './ticketUi';
import './pmTickets.css';

/** The ticket-context tabs the PM had beside a request's chat, kept beside the project conversation. */
export type PmRequestContextSection = 'overview' | 'notes' | 'details' | 'documents';

const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

/** Loads one request's PM detail, again whenever `version` changes. */
export function usePmRequestDetail(api: typeof pmTicketApi, ticketId: string | null, version: unknown) {
  const [detail, setDetail] = useState<PmTicketDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    let current = true;
    if (!ticketId) { setDetail(null); return () => { current = false; }; }
    void api.get(ticketId).then(value => { if (current) setDetail(value); })
      .catch(failure => { if (current) { setDetail(null); setError(errorText(failure, 'This request could not be loaded.')); } });
    return () => { current = false; };
  }, [api, ticketId, version]);
  const current = detail !== null && ticketId !== null && detail.id === ticketId ? detail : null;
  return { detail: current, error };
}

function nextStepText(detail: PmTicketDetail): string {
  const owners = { pm: 'You', client: 'Client', developer: 'Development team' } as const;
  const owner = detail.internal.actionOwner ? owners[detail.internal.actionOwner] : null;
  const action = pmTicketNextAction(detail.internal.nextAction);
  if (action) return owner ? owner + ' · ' + action : action;
  return owner ? owner + ' is up next.' : 'No action is pending.';
}

function projectNote(detail: PmTicketDetail): string {
  if (!detail.internal.projectId) return 'Link a project when you start the work.';
  return detail.internal.projectClientVisible ? 'Client-visible project name' : 'PM-only project link';
}

/** Which request the context tabs describe. */
function RequestPicker({ requests, selectedId, onSelect, id }: Readonly<{
  requests: readonly ConversationRequest[]; selectedId: string | null; onSelect: (ticketId: string) => void; id: string;
}>) {
  if (requests.length < 2) return null;
  return <div className="mb-4 flex items-center gap-2 text-[12px]">
    <label htmlFor={id} className="shrink-0 text-content-muted">Request</label>
    <select id={id} value={selectedId ?? ''} onChange={event => onSelect(event.target.value)}
      className="h-8 min-w-0 flex-1 rounded-md border border-control bg-well px-2 text-[12.5px] text-content">
      {requests.map(request => <option key={request.ticketId} value={request.ticketId}>{request.title}</option>)}
    </select>
  </div>;
}

function Overview({ detail, clientName }: Readonly<{ detail: PmTicketDetail; clientName: string }>) {
  const contact = detail.internal.request?.contact ?? null;
  const name = contact?.fullName ?? clientName;
  return <div>
    <div className="pm-tickets__context-heading">
      <div>
        <p className="pm-tickets__eyebrow">Request context</p>
        <span className="pm-tickets__reference">{detail.reference}</span>
      </div>
      <span className={`pm-tickets__status ${pmStatusStyle(detail.status)}`}>{pmStatusLabel(detail.status)}</span>
    </div>
    <section className="pm-tickets__context-section">
      <p className="pm-tickets__context-label">Client</p>
      <p className="pm-tickets__context-value">{name}</p>
      {contact && <p className="pm-tickets__context-detail">{contact.email}</p>}
      {detail.companyLabel !== name && <p className="pm-tickets__context-detail">{detail.companyLabel}</p>}
      {contact && <p className="pm-tickets__context-detail"><PmContactVerification verification={contact.verification} /></p>}
    </section>
    <section className="pm-tickets__context-section">
      <p className="pm-tickets__context-label">Project</p>
      <p className="pm-tickets__context-value">{detail.internal.projectName ?? detail.request?.projectLabel ?? 'No project linked'}</p>
      <p className="pm-tickets__context-detail">{projectNote(detail)}</p>
    </section>
    {detail.internal.requiredIssueIds.length > 0 && <section className="pm-tickets__context-section" aria-label="Tasks authorized for this request">
      <p className="pm-tickets__context-label">Authorized task IDs</p>
      <ul className="space-y-1">
        {detail.internal.requiredIssueIds.map(issueId => <li key={issueId} className="break-all font-mono text-[11px] text-content-secondary">{issueId}</li>)}
      </ul>
      <p className="pm-tickets__context-detail">These existing project Tasks are the approved work linked to this request.</p>
    </section>}
    <section className="pm-tickets__context-section">
      <p className="pm-tickets__context-label">Next step</p>
      <p className="pm-tickets__context-value pm-tickets__context-value--accent"><CircleDot size={14} aria-hidden="true" />{nextStepText(detail)}</p>
    </section>
    <section className="pm-tickets__context-section">
      <p className="pm-tickets__context-label">Request summary</p>
      <p className="pm-tickets__context-detail whitespace-pre-wrap">{detail.description}</p>
      {detail.request?.requestedDeadline && <p className="pm-tickets__context-detail">Requested by {detail.request.requestedDeadline}</p>}
    </section>
  </div>;
}

function Details({ detail, clientName }: Readonly<{ detail: PmTicketDetail; clientName: string }>) {
  const contact = detail.internal.request?.contact ?? null;
  return <div className="space-y-6">
    <section>
      <p className="pm-tickets__eyebrow">Request</p>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-content">{detail.description}</p>
      {detail.request?.requestedDeadline && <p className="mt-2 text-[12px] text-content-muted">Requested date: {detail.request.requestedDeadline} · not guaranteed</p>}
    </section>
    {detail.scope && <section>
      <p className="pm-tickets__eyebrow">Proposed scope <span>· {detail.scope.agreed ? 'Agreed' : 'Awaiting client'}</span></p>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-content">{detail.scope.summary}</p>
    </section>}
    {detail.internal.scopeVersion && <details className="pm-tickets__internal-brief">
      <summary>Internal developer brief</summary>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-content">{detail.internal.scopeVersion.developerBrief ?? 'No internal brief is available for this older scope record.'}</p>
    </details>}
    <section>
      <p className="pm-tickets__eyebrow">Client & project</p>
      <p className="text-[13px] text-content">{detail.companyLabel || clientName}</p>
      {contact && <div className="mt-1 space-y-0.5 text-[12px] text-content-secondary">
        <p className="flex items-center gap-1.5"><UserRound size={12} aria-hidden="true" />{contact.fullName}</p>
        <p className="break-all">{contact.email} · <PmContactVerification verification={contact.verification} /></p>
      </div>}
      <p className="mt-2 text-[12px] text-content-secondary">{detail.internal.projectId
        ? 'Project: ' + (detail.internal.projectName ?? 'linked') : 'No project linked yet'}</p>
    </section>
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
    catch (failure) { setError(errorText(failure, 'Private notes could not be loaded.')); }
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
    } catch (failure) { setError(errorText(failure, 'The note was not saved. Try again.')); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <p className="text-[12px] text-content-muted">Only authorized project managers can see these notes.</p>
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

/**
 * One tab of the request context beside the conversation: the request picker,
 * then that request's overview, private notes, details or documents.
 */
export function PmRequestContext({ section, api = pmTicketApi, documentsApi, requests, selectedId, onSelect, clientName, refreshToken = '', onChanged }: Readonly<{
  section: PmRequestContextSection;
  api?: typeof pmTicketApi;
  documentsApi: TicketDocumentsReadApi;
  requests: readonly ConversationRequest[] | null;
  selectedId: string | null;
  onSelect: (ticketId: string) => void;
  clientName: string;
  refreshToken?: string;
  /** After a private note is saved, so the conversation shows it too. */
  onChanged?: () => void;
}>) {
  const [version, setVersion] = useState(0);
  const { detail, error } = usePmRequestDetail(api, selectedId, `${version}:${refreshToken}`);
  let body: ReactNode;
  if (requests !== null && requests.length === 0) body = <p className="text-[12.5px] text-content-muted">No requests from this client on this project yet.</p>;
  else if (error) body = <p role="alert" className="text-[12.5px] text-status-danger">{error}</p>;
  else if (!detail) body = <p className="text-[12.5px] text-content-muted">Loading request…</p>;
  else if (section === 'overview') body = <Overview detail={detail} clientName={clientName} />;
  else if (section === 'details') body = <Details detail={detail} clientName={clientName} />;
  else if (section === 'notes') body = <Notes api={api} detail={detail} onSaved={() => { setVersion(value => value + 1); onChanged?.(); }} />;
  else body = <TicketDocumentsPanel api={documentsApi} ticketId={detail.id} heading="Shared files" canUpload={false} showRefresh={false}
    refreshToken={refreshToken} emptyMessage="No client files have been uploaded to this request yet."
    readOnlyMessage="Only the client can upload files. You can download the files they share here." />;
  return <div className="pm-request-context">
    <RequestPicker requests={requests ?? []} selectedId={selectedId} onSelect={onSelect} id={`pm-request-context-${section}`} />
    {body}
  </div>;
}
