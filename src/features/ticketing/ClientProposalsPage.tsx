import { LoadingRows } from '@/shared/components/ui/skeleton';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Lightbulb, Plus, RefreshCw, Send } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { DatePicker } from '@/shared/components/ui/date-picker';

import type { ClientProject, ClientProjectProposal, ClientProjectProposalInput, ClientProjectProposalReplyInput } from './clientApi';
import { clientTicketApi, ClientTicketApiError } from './clientApi';
import { relativeTime } from './clientFriendly';
import { time } from './ticketUi';
import { clientProposalView } from './clientProposalPresentation';
import { CxEmpty } from './clientKit';
import './clientProposals.css';

/**
 * Project ideas the client has sent, shown as one view of Requests: a short list on the left and
 * the one selected on the right, with its conversation.
 */
export function ClientProposalsPage({ api = clientTicketApi, proposals, projects, loading, error, inspectionOnly,
  selectedProposalId, onSelectedProposalIdChange, onRefresh, onSubmitted, onOpenProject, openForm = false, onOpenFormHandled, idPrefix = 'client' }: {
  api?: typeof clientTicketApi;
  proposals: ClientProjectProposal[];
  /** Projects this client can open, so an accepted proposal can link to the project it became. */
  projects: ClientProject[];
  loading: boolean;
  error: string;
  inspectionOnly: boolean;
  /** Chosen by the client, or by a notification; null shows the list first on small screens. */
  selectedProposalId: string | null;
  onSelectedProposalIdChange: (id: string | null) => void;
  onRefresh: () => void;
  onSubmitted: () => void;
  onOpenProject: (project: ClientProject) => void;
  /**
   * Set by Home's and Projects' "Propose a project": opens the form once, then handed back, so
   * coming back to this page later does not open it again.
   */
  openForm?: boolean;
  onOpenFormHandled?: () => void;
  idPrefix?: string;
}) {
  const ordered = orderProposals(proposals);
  const chosen = ordered.find(proposal => proposal.id === selectedProposalId) ?? null;
  const shown = chosen ?? ordered[0] ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState('');
  useEffect(() => {
    if (!openForm) return;
    if (!inspectionOnly) { setFormOpen(true); setSuccess(''); }
    onOpenFormHandled?.();
  }, [openForm]);

  let body: ReactNode;
  if (loading && !proposals.length) body = <LoadingRows label="Loading project proposals" rows={3} />;
  else if (!ordered.length) body = error ? null : <CxEmpty icon={<Lightbulb size={22} />} title="No proposals yet"
    body="Have an idea for something new? Propose a project and the project manager will review it with you." />;
  else body = <div className="client-proposals-layout">
    <ul className="client-proposal-index" aria-label="Your proposals">
      {ordered.map(proposal => {
        const view = clientProposalView(proposal, projects);
        return <li key={proposal.id}><button type="button" className="client-proposal-item"
          aria-current={shown?.id === proposal.id ? 'true' : undefined} onClick={() => onSelectedProposalIdChange(proposal.id)}>
          <strong>{proposal.title}</strong>
          <span><span className={`client-proposal-status is-${view.tone}`}>{view.badge}</span>
            <small>{relativeTime(proposal.submittedAt)}</small></span>
        </button></li>;
      })}
    </ul>
    {shown && <ProposalDetail key={shown.id} api={api} proposal={shown} projects={projects} inspectionOnly={inspectionOnly}
      onBack={() => onSelectedProposalIdChange(null)} onReplied={onRefresh} onOpenProject={onOpenProject} />}
  </div>;

  const actions = <div className="client-proposals-head-actions">
    <button type="button" className="cx-icon-button" aria-label="Refresh project proposals" disabled={loading} onClick={onRefresh}><RefreshCw size={15} /></button>
    {!inspectionOnly && <button type="button" className="cx-button is-primary" aria-haspopup="dialog" aria-expanded={formOpen}
      onClick={() => { setFormOpen(true); setSuccess(''); }}><Plus size={15} />Propose a project</button>}
  </div>;
  return <section className={`cx-ideas client-proposals-page${chosen ? ' has-selected-proposal' : ''}`} aria-labelledby={`${idPrefix}-proposals-title`}>
    <div className="cx-toolbar">
      <div><h2 id={`${idPrefix}-proposals-title`} className="cx-subheading">Project ideas</h2>
        <p className="cx-page-description">Ideas you’ve sent to the project manager. They review each one and reply here.</p></div>
      {actions}
    </div>
    {success && <p role="status" className="client-proposal-success">{success}</p>}
    {error && <p role="alert" className="cx-error">{error} <button type="button" onClick={onRefresh}>Try again</button></p>}

    {body}

    <ProposalForm api={api} open={formOpen} onClose={() => setFormOpen(false)} inspectionOnly={inspectionOnly}
      onSent={id => { setFormOpen(false); setSuccess('Proposal sent. The project manager will review it; it does not create a project automatically.');
        onSelectedProposalIdChange(id); onSubmitted(); }} />
  </section>;
}

/** Proposals waiting on the client first, then newest first. */
function orderProposals(proposals: ClientProjectProposal[]): ClientProjectProposal[] {
  return [...proposals].sort((a, b) => Number(b.status === 'awaiting_client') - Number(a.status === 'awaiting_client')
    || Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
}

function ProposalDetail({ api, proposal, projects, inspectionOnly, onBack, onReplied, onOpenProject }: {
  api: typeof clientTicketApi;
  proposal: ClientProjectProposal;
  projects: ClientProject[];
  inspectionOnly: boolean;
  onBack: () => void;
  onReplied: () => void;
  onOpenProject: (project: ClientProject) => void;
}) {
  const view = clientProposalView(proposal, projects);
  const messages = proposal.clarificationMessages ?? [];
  const [draft, setDraft] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState('');
  const pendingReply = useRef<ClientProjectProposalReplyInput | null>(null);

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (replying || inspectionOnly || proposal.status !== 'awaiting_client' || !body) return;
    // The same message keeps its operation id, so a retry after an unconfirmed send cannot post it twice.
    if (pendingReply.current?.body !== body) pendingReply.current = { schemaVersion: 1, operationId: crypto.randomUUID(), body };
    setReplying(true); setReplyError('');
    try {
      await api.replyToProjectProposal(proposal.id, pendingReply.current);
      pendingReply.current = null;
      setDraft('');
      onReplied();
    } catch (error) {
      if (!(error instanceof ClientTicketApiError) || (error.status !== null && error.status < 500 && !error.reconciliationRequired)) pendingReply.current = null;
      setReplyError(replyFailure(error));
    } finally { setReplying(false); }
  }

  return <article className="client-proposal-detail" aria-labelledby={`proposal-${proposal.id}-title`}>
    <button type="button" className="client-proposal-back" onClick={onBack}><ArrowLeft size={15} />All proposals</button>
    <header className="client-proposal-detail-head">
      <div><h2 id={`proposal-${proposal.id}-title`}>{proposal.title}</h2>
        <small>Sent {time(proposal.submittedAt)}{proposal.requestedDeadline ? ` · Target ${proposal.requestedDeadline}` : ''}</small></div>
      <span className={`client-proposal-status is-${view.tone}`}>{view.badge}</span>
    </header>
    <p className="client-proposal-next">{view.next}</p>
    {view.project && <button type="button" className="cx-button is-primary client-proposal-open-project" onClick={() => onOpenProject(view.project!)}>
      View project <ArrowRight size={14} aria-hidden="true" />
    </button>}
    <section className="client-proposal-section" aria-label="What you asked for">
      <h3>What you asked for</h3>
      <p className="client-proposal-description">{proposal.description}</p>
    </section>
    {(messages.length > 0 || proposal.status === 'awaiting_client') && <section className="client-proposal-section" aria-label="Conversation with the project manager">
      <h3>Conversation</h3>
      {messages.length > 0 && <div className="client-proposal-conversation">
        {messages.map(message => <article key={message.id} className={`client-proposal-message${message.author === 'client' ? ' is-client' : ''}`}>
          <div><strong>{message.author === 'pm' ? 'Project manager' : 'You'}</strong><time dateTime={message.createdAt}>{time(message.createdAt)}</time></div>
          <p>{message.body}</p>
        </article>)}
      </div>}
      {proposal.status === 'awaiting_client' && <form className="client-proposal-reply" onSubmit={event => void reply(event)}>
        <label htmlFor={`proposal-reply-${proposal.id}`}>Your reply</label>
        <textarea id={`proposal-reply-${proposal.id}`} maxLength={4000} rows={3} value={draft} disabled={inspectionOnly || replying}
          onChange={event => setDraft(event.target.value)} placeholder="Type your response…" />
        {replyError && <p role="alert" className="cx-error">{replyError}</p>}
        <div><small>Your reply goes back to the project manager.</small><button type="submit" className="cx-button is-primary"
          disabled={inspectionOnly || replying || !draft.trim()}>
          <Send size={14} />{replying ? 'Sending…' : 'Send reply'}
        </button></div>
      </form>}
    </section>}
  </article>;
}

function ProposalForm({ api, open, onClose, onSent, inspectionOnly }: {
  api: typeof clientTicketApi;
  open: boolean;
  onClose: () => void;
  onSent: (proposalId: string) => void;
  inspectionOnly: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<ClientProjectProposalInput | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inspectionOnly || submitting) return;
    const input = pending.current ?? {
      schemaVersion: 1 as const,
      operationId: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      requestedDeadline: deadline || null,
    };
    pending.current = input;
    setSubmitting(true); setError('');
    try {
      const receipt = await api.submitProjectProposal(input);
      pending.current = null;
      setNeedsRetry(false);
      setTitle(''); setDescription(''); setDeadline('');
      onSent(receipt.id);
    } catch (submitError) {
      if (submitError instanceof ClientTicketApiError && submitError.reconciliationRequired) {
        setNeedsRetry(true);
        setError('We could not confirm the result. Retry to safely check this same proposal; do not start another one yet.');
      } else {
        pending.current = null;
        setNeedsRetry(false);
        setError(submitFailure(submitError));
      }
    } finally { setSubmitting(false); }
  }

  return <Modal isOpen={open} onClose={onClose} closeDisabled={submitting}
    title="Propose a project" subtitle="Describe the outcome you want. The project manager will review it and choose the right workspace."
    dialogClassName="client-proposal-modal cx-scope" maxWidth="max-w-xl">
    <form id="client-proposal-form" className="client-proposal-form" onSubmit={event => void submit(event)}>
      <label htmlFor="client-proposal-title">Project title<input id="client-proposal-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required disabled={submitting || needsRetry} /></label>
      <label htmlFor="client-proposal-description">What would you like to accomplish?<textarea id="client-proposal-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={6000} rows={4} required disabled={submitting || needsRetry} /></label>
      <label htmlFor="client-proposal-deadline">Target date (optional)<DatePicker id="client-proposal-deadline" value={deadline} onChange={setDeadline} disabled={submitting || needsRetry} className="w-full" buttonClassName="h-10 w-full justify-start text-left" /></label>
      <p id="client-proposal-note" className="client-proposal-note">Sending this proposal does not create a project or promise a start date. If your PM accepts it, the project will appear under Projects.</p>
      {error && <p role="alert" className="cx-error">{error}</p>}
      <div className="client-proposal-actions">
        {!needsRetry && <button type="button" className="cx-button" disabled={submitting} onClick={onClose}>Cancel</button>}
        <button type="submit" className="cx-button is-primary" aria-describedby="client-proposal-note" disabled={submitting || (!needsRetry && (!title.trim() || !description.trim()))}>
          <Send size={14} />{submitLabel(submitting, needsRetry)}
        </button>
      </div>
    </form>
  </Modal>;
}

function replyFailure(error: unknown): string {
  if (error instanceof ClientTicketApiError && error.status === 401) return 'Your sign-in expired. Sign in again before replying.';
  if (error instanceof ClientTicketApiError && error.reconciliationRequired) return 'We could not confirm your reply. Retry this same message to check safely.';
  return 'We could not send your reply. Refresh the proposal and try again.';
}

function submitFailure(error: unknown): string {
  if (error instanceof ClientTicketApiError && error.status === 401) return 'Your sign-in expired. Sign in again before sending a proposal.';
  if (error instanceof ClientTicketApiError && error.status === 503) return 'Project proposals are temporarily unavailable. Try again later.';
  return 'We could not send the proposal. Check the details and try again.';
}

function submitLabel(submitting: boolean, needsRetry: boolean): string {
  if (submitting) return 'Sending…';
  return needsRetry ? 'Retry same proposal' : 'Send proposal';
}

