import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CircleDot, Info, MessageSquareText, Paperclip, Route, StickyNote, Ticket } from 'lucide-react';
import { pmTicketApi, type PmTicketDetail, type PmTicketNote } from './pmApi';
import { PmContactVerification, pmStatusLabel, pmStatusStyle } from './PmTicketsView';
import { pmTicketNextAction } from './pmTicketNextAction';
import { TicketDocumentsPanel } from './TicketDocumentsPanel';
import type { TicketDocumentsReadApi } from './ticketDocuments';
import { clientProgressSteps, type ClientProgressStep } from './clientProgressSteps';
import { PmCollapsibleRailCard, PmRailCard, PmTicketProgress } from './PmConversationRail';
import { time } from './ticketUi';
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

function nextStepText(detail: PmTicketDetail): string {
  const owners = { pm: 'You', client: 'Client', developer: 'Development team' } as const;
  const owner = detail.internal.actionOwner ? owners[detail.internal.actionOwner] : null;
  const action = pmTicketNextAction(detail.internal.nextAction);
  if (action) return owner ? owner + ' · ' + action : action;
  return owner ? owner + ' is up next.' : 'No action is pending.';
}

function projectNote(detail: PmTicketDetail): string {
  if (!detail.internal.projectId) return 'Link a project when you start the work.';
  return detail.internal.projectClientVisible ? 'The client can see this project' : 'PM-only project link';
}

/** The client's five steps, worded for the PM: a step waiting on the client says what they owe. */
const PM_STEP_LABELS = ['Received', 'Planning', 'In progress', 'Client review', 'Done'] as const;
const CLIENT_OWES = { reply: 'Client replies', agree_scope: 'Client approves plan', review_result: 'Client checks result' } as const;
export function pmTicketProgressSteps(detail: Pick<PmTicketDetail, 'status' | 'requestedAction' | 'scope' | 'delivery'>): ClientProgressStep[] {
  return clientProgressSteps(detail).map((step, index) => ({
    ...step,
    label: step.needsYou && detail.requestedAction ? CLIENT_OWES[detail.requestedAction] : PM_STEP_LABELS[index] ?? step.label,
  }));
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
      <Row label="Reference"><span className="font-mono text-[11.5px]">{detail.reference}</span></Row>
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

/**
 * The picked ticket in the PM's side panel, laid out like the client's picked request:
 * its head, progress, what happens next and what the client asked for, then
 * details, private notes and documents as cards that fold.
 */
export function PmSelectedTicket({ api = pmTicketApi, documentsApi, ticketId, clientName, refreshToken = '', onChanged }: Readonly<{
  api?: typeof pmTicketApi;
  documentsApi: TicketDocumentsReadApi;
  /** The picked ticket; null when the project has none, which shows a hint instead. */
  ticketId: string | null;
  clientName: string;
  refreshToken?: string;
  /** After a private note is saved, so the conversation shows it too. */
  onChanged?: () => void;
}>) {
  const [version, setVersion] = useState(0);
  const { detail, error } = usePmRequestDetail(api, ticketId, `${version}:${refreshToken}`);
  if (!ticketId) return <p className="pm-rail-note pm-rail-hint">Pick a ticket to see its next step, details, private notes and documents.</p>;
  if (error) return <p role="alert" className="pm-rail-note is-danger">{error}</p>;
  if (!detail) return <section className="pm-rail-card" aria-busy="true"><p className="pm-rail-note">Loading ticket…</p></section>;
  const steps = pmTicketProgressSteps(detail);
  return <>
    <PmRailCard icon={<Ticket size={16} />} title={detail.title} label="Selected ticket">
      <p className="pm-rail-meta">{detail.internal.projectName ?? 'No project linked'} · Created {day(detail.createdAt)}</p>
      <span className={`pm-tickets__status ${pmStatusStyle(detail.status)}`}>{pmStatusLabel(detail.status)}</span>
    </PmRailCard>
    {steps.length > 0 && <PmRailCard icon={<Route size={16} />} title="Ticket progress"><PmTicketProgress steps={steps} /></PmRailCard>}
    <PmRailCard icon={<CircleDot size={16} />} title="What happens next">
      <p className="pm-rail-note is-strong">{nextStepText(detail)}</p>
    </PmRailCard>
    <PmRailCard icon={<MessageSquareText size={16} />} title="What the client asked for">
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-content">{detail.description}</p>
    </PmRailCard>
    <PmCollapsibleRailCard id="details" icon={<Info size={16} />} title="Request details">
      <Details detail={detail} clientName={clientName} />
    </PmCollapsibleRailCard>
    <PmCollapsibleRailCard id="notes" icon={<StickyNote size={16} />} title="Private notes"
      aside={<span className="pm-rail-pill is-internal">Internal</span>}>
      <Notes api={api} detail={detail} onSaved={() => { setVersion(value => value + 1); onChanged?.(); }} />
    </PmCollapsibleRailCard>
    <PmCollapsibleRailCard id="documents" icon={<Paperclip size={16} />} title="Documents" initiallyOpen={false}>
      <TicketDocumentsPanel api={documentsApi} ticketId={detail.id} heading="Shared files" canUpload={false} showRefresh={false}
        refreshToken={refreshToken} emptyMessage="No client files have been uploaded to this request yet."
        readOnlyMessage="Only the client can upload files. You can download the files they share here." />
    </PmCollapsibleRailCard>
  </>;
}
