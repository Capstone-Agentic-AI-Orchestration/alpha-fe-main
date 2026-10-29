import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, FolderKanban, RefreshCw, Send, Plus, X } from 'lucide-react';

import type { ClientProject, ClientProjectFeedbackMessage, ClientProjectProposal, ClientProjectProposalInput,
  ClientProjectRequestItem, ClientProjectRequestQueue } from './clientApi';
import { clientTicketApi, ClientTicketApiError } from './clientApi';
import { clientTicketProgress } from './clientTicketProgress';
import { time } from './ticketUi';
import { ClientProjectQaStudio } from './ClientProjectQaStudio';

export function clientProjectKey(project: Pick<ClientProject, 'workspaceId' | 'projectId'>): string {
  return JSON.stringify([project.workspaceId, project.projectId]);
}

export function ClientOverviewPage({ requests, projects, requestsLoading, requestsError, projectsLoading, projectsError,
  onOpenRequest, onGoToProjects, onGoToRequests }: {
  requests: ClientProjectRequestQueue | null;
  projects: ClientProject[];
  requestsLoading: boolean;
  requestsError: string;
  projectsLoading: boolean;
  projectsError: string;
  onOpenRequest: (request: ClientProjectRequestItem) => void;
  onGoToProjects: () => void;
  onGoToRequests: () => void;
}) {
  const attention = requests?.items.filter(item => item.requestedAction !== null && item.status !== 'closed'
    && item.status !== 'declined' && item.status !== 'cancelled') ?? [];
  const recent = [...(requests?.items ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5);
  return <section className="client-page client-overview-page" aria-labelledby="client-overview-title">
    <header className="client-page-heading">
      <div><p className="client-eyebrow">CLIENT PORTAL</p><h1 id="client-overview-title">Overview</h1>
        <p className="client-page-description">What needs your attention and what changed recently.</p></div>
    </header>
    <section className="client-overview-section" aria-labelledby="client-attention-title">
      <div className="client-section-heading"><div><h2 id="client-attention-title">Needs your attention</h2>
        <p>Requests where your project manager is waiting for you.</p></div>
        <button type="button" className="client-text-action" onClick={onGoToRequests}>All requests <ArrowRight size={15} /></button></div>
      {requestsError && <p role="alert" className="client-project-error">{requestsError}</p>}
      {!requests && requestsLoading ? <p role="status" className="client-section-state">Loading requests…</p>
        : !requests ? null
        : attention.length ? <div className="client-activity-list">{attention.map(item => <RequestSummary key={requestKey(item)} item={item} onOpen={onOpenRequest} />)}</div>
          : <p className="client-section-state">You’re all caught up. There are no requests waiting for your reply.</p>}
    </section>
    <section className="client-overview-section" aria-labelledby="client-recent-title">
      <div className="client-section-heading"><div><h2 id="client-recent-title">Recent request updates</h2>
        <p>Latest activity across your requests.</p></div></div>
      {!requests && requestsLoading ? <p role="status" className="client-section-state">Loading updates…</p>
        : !requests ? null
        : recent.length ? <div className="client-activity-list">{recent.map(item => <RequestSummary key={requestKey(item)} item={item} onOpen={onOpenRequest} />)}</div>
          : <p className="client-section-state">No request updates yet. Your project manager will share requests here.</p>}
      {requests?.nextCursor && <button type="button" className="client-text-action" onClick={onGoToRequests}>See all requests <ArrowRight size={15} /></button>}
    </section>
    <section className="client-overview-section" aria-labelledby="client-projects-title">
      <div className="client-section-heading"><div><h2 id="client-projects-title">Your projects</h2>
        <p>Projects your account can currently access.</p></div>
        <button type="button" className="client-text-action" onClick={onGoToProjects}>View projects <ArrowRight size={15} /></button></div>
      {projectsError && <p role="alert" className="client-project-error">{projectsError}</p>}
      {projectsLoading && !projects.length ? <p role="status" className="client-section-state">Loading projects…</p>
        : projects.length ? <div className="client-project-preview-list">{projects.slice(0, 3).map(project => <div key={clientProjectKey(project)}>
        <FolderKanban size={17} aria-hidden /><span>{project.name}</span><small>Updated {time(project.updatedAt)}</small>
      </div>)}</div> : <p className="client-section-state">No projects have been shared with your account yet.</p>}
    </section>
  </section>;
}

export function ClientProjectsPage({ api = clientTicketApi, projects, loading, error, selectedProjectKey,
  onSelectedProjectKeyChange, onOpenRequest, onNewRequest, inspectionOnly, newRequestEnabled, newRequestLoading, projectFocusVersion, refreshToken,
  proposals, proposalsLoading, proposalsError, onRefreshProposals, onProposalSubmitted }: {
  api?: typeof clientTicketApi;
  projects: ClientProject[];
  loading: boolean;
  error: string;
  selectedProjectKey: string | null;
  onSelectedProjectKeyChange: (key: string | null) => void;
  onOpenRequest: (request: ClientProjectRequestItem) => void;
  onNewRequest: (project: ClientProject) => void;
  inspectionOnly: boolean;
  newRequestEnabled: boolean;
  newRequestLoading: boolean;
  projectFocusVersion: number;
  refreshToken: number;
  proposals: ClientProjectProposal[];
  proposalsLoading: boolean;
  proposalsError: string;
  onRefreshProposals: () => void;
  onProposalSubmitted: () => void;
}) {
  const selectedProject = projects.find(project => clientProjectKey(project) === selectedProjectKey) ?? null;
  const [proposalFormOpen, setProposalFormOpen] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalDeadline, setProposalDeadline] = useState('');
  const [proposalSubmitting, setProposalSubmitting] = useState(false);
  const [proposalNeedsRetry, setProposalNeedsRetry] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [proposalSuccess, setProposalSuccess] = useState('');
  const pendingProposal = useRef<ClientProjectProposalInput | null>(null);
  const [tab, setTab] = useState<'overview' | 'preview' | 'requests'>('overview');
  useEffect(() => { setTab('overview'); }, [selectedProjectKey, projectFocusVersion]);
  const [requestPage, setRequestPage] = useState<ClientProjectRequestQueue | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSearchInput, setRequestSearchInput] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestRefresh, setRequestRefresh] = useState(0);
  const [requestMoreLoading, setRequestMoreLoading] = useState(false);
  const [feedback, setFeedback] = useState<ClientProjectFeedbackMessage[]>([]);
  const [feedbackCursor, setFeedbackCursor] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackMoreLoading, setFeedbackMoreLoading] = useState(false);
  const [feedbackRefresh, setFeedbackRefresh] = useState(0);
  const [projectDrafts, setProjectDrafts] = useState<Record<string,string>>({});
  const projectKey=selectedProject?clientProjectKey(selectedProject):'';
  const activeProject=useRef(projectKey);activeProject.current=projectKey;
  const draft=projectDrafts[projectKey]??'';
  const setDraft=(value:string)=>{if(projectKey)setProjectDrafts(current=>({...current,[projectKey]:value}));};
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inspectionOnly || proposalSubmitting) return;
    const input = pendingProposal.current ?? {
      schemaVersion: 1 as const,
      operationId: crypto.randomUUID(),
      title: proposalTitle.trim(),
      description: proposalDescription.trim(),
      requestedDeadline: proposalDeadline || null,
    };
    pendingProposal.current = input;
    setProposalSubmitting(true); setProposalError(''); setProposalSuccess('');
    try {
      await api.submitProjectProposal(input);
      pendingProposal.current = null;
      setProposalNeedsRetry(false); setProposalFormOpen(false);
      setProposalTitle(''); setProposalDescription(''); setProposalDeadline('');
      setProposalSuccess('Proposal sent. Your project manager will review it; it does not create a project automatically.');
      onProposalSubmitted();
    } catch (submitError) {
      if (submitError instanceof ClientTicketApiError && submitError.reconciliationRequired) {
        setProposalNeedsRetry(true);
        setProposalError('We could not confirm the result. Retry to safely check this same proposal; do not start another one yet.');
      } else {
        pendingProposal.current = null;
        setProposalNeedsRetry(false);
        setProposalError(submitError instanceof ClientTicketApiError && submitError.status === 401
          ? 'Your sign-in expired. Sign in again before sending a proposal.'
          : submitError instanceof ClientTicketApiError && submitError.status === 503
            ? 'Project proposals are temporarily unavailable. Try again later.'
            : 'We could not send the proposal. Check the details and try again.');
      }
    } finally { setProposalSubmitting(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setRequestSearch(requestSearchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [requestSearchInput]);

  useEffect(() => {
    if (!selectedProject || tab !== 'requests') return;
    let active = true;
    setRequestLoading(true); setRequestError(''); setRequestPage(null);
    void api.listProjectRequests(selectedProject.workspaceId, selectedProject.projectId,
      { limit: 50, search: requestSearch, filter: 'all' }).then(page => {
      if (active) setRequestPage(page);
    }).catch(error => {
      if (active) setRequestError(projectLoadError(error, 'requests'));
    }).finally(() => { if (active) setRequestLoading(false); });
    return () => { active = false; };
  }, [api, selectedProject?.workspaceId, selectedProject?.projectId, requestSearch, requestRefresh, tab]);

  useEffect(() => {
    if (!selectedProject || tab !== 'preview') return;
    let active = true;
    setFeedbackLoading(true); setFeedbackError(''); setFeedback([]); setFeedbackCursor(null);
    void api.getProjectFeedbackMessages(selectedProject.workspaceId, selectedProject.projectId, { limit: 50 }).then(page => {
      if (active) { setFeedback(page.items); setFeedbackCursor(page.nextCursor); }
    }).catch(error => {
      if (active) setFeedbackError(projectLoadError(error, 'feedback'));
    }).finally(() => { if (active) setFeedbackLoading(false); });
    return () => { active = false; };
  }, [api, selectedProject?.workspaceId, selectedProject?.projectId, feedbackRefresh, tab]);

  async function loadMoreRequests() {
    if (!selectedProject || !requestPage?.nextCursor || requestMoreLoading) return;
    setRequestMoreLoading(true); setRequestError('');
    try {
      const page = await api.listProjectRequests(selectedProject.workspaceId, selectedProject.projectId,
        { limit: 50, after: requestPage.nextCursor, search: requestSearch, filter: 'all' });
      if(activeProject.current!==projectKey)return;
      const seen = new Set(requestPage.items.map(requestKey));
      setRequestPage({ ...page, items: [...requestPage.items, ...page.items.filter(item => !seen.has(requestKey(item)))] });
    } catch (error) { setRequestError(projectLoadError(error, 'requests')); }
    finally { setRequestMoreLoading(false); }
  }

  async function loadMoreFeedback() {
    if (!selectedProject || !feedbackCursor || feedbackMoreLoading) return;
    setFeedbackMoreLoading(true); setFeedbackError('');
    try {
      const page = await api.getProjectFeedbackMessages(selectedProject.workspaceId, selectedProject.projectId,
        { limit: 50, before: feedbackCursor });
      if(activeProject.current!==projectKey)return;
      setFeedback(current => [...page.items, ...current]); setFeedbackCursor(page.nextCursor);
    } catch (error) { setFeedbackError(projectLoadError(error, 'feedback')); }
    finally { setFeedbackMoreLoading(false); }
  }

  async function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || inspectionOnly || sending || !draft.trim()) return;
    const body = draft.trim(); const operationId = crypto.randomUUID();
    setSending(true); setSendError('');
    try {
      await api.sendProjectFeedbackMessage(selectedProject.workspaceId, selectedProject.projectId,
        { schemaVersion: 1, operationId, body });
      setDraft(''); setFeedbackRefresh(value => value + 1);
    } catch (error) { setSendError(projectLoadError(error, 'send')); }
    finally { setSending(false); }
  }

  if (selectedProject) return <section className="client-page client-project-detail" aria-labelledby="client-project-title">
    <header className="client-project-detail-heading">
      <div className="client-project-heading-copy">
        <button type="button" className="client-back-link" onClick={() => { onSelectedProjectKeyChange(null); setTab('overview'); }}>
          <ArrowLeft size={15} /> Projects
        </button>
        <p className="client-eyebrow">PROJECT</p><h1 id="client-project-title">{selectedProject.name}</h1>
        <p className="client-page-description">Project space shared with your account · updated {time(selectedProject.updatedAt)}</p>
      </div>
      {newRequestEnabled && <button type="button" className="client-primary-action" disabled={newRequestLoading} onClick={() => onNewRequest(selectedProject)}>
        {newRequestLoading ? 'Checking access…' : 'New request'}</button>}
    </header>
    <div className="client-project-tabs" role="tablist" aria-label="Project sections">
      {(['overview', 'preview', 'requests'] as const).map(value => <button key={value} type="button" role="tab"
        aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'preview' ? 'QA Studio' : value[0].toUpperCase() + value.slice(1)}</button>)}
    </div>
    {tab === 'overview' && <div className="client-project-overview">
      <div><p className="client-eyebrow">SHARED WITH YOU</p><h2>{selectedProject.name}</h2>
        <p>Requests linked by your project manager appear in this project. New requests are reviewed before they are linked or work begins.</p>
      </div>
      <div className="client-project-overview-meta">
        <span>Last updated <strong>{time(selectedProject.updatedAt)}</strong></span>
        <span>Preview <strong>{selectedProject.preview ? 'UAT · reviewed by your project manager' : 'Not shared yet'}</strong></span>
      </div>
      <button type="button" className="client-text-action" onClick={() => setTab('requests')}>View project requests <ArrowRight size={15} /></button>
    </div>}
    {tab === 'preview' && <ClientProjectQaStudio key={clientProjectKey(selectedProject)} workspaceId={selectedProject.workspaceId}
      projectId={selectedProject.projectId} projectName={selectedProject.name} inspectionOnly={inspectionOnly} refreshToken={refreshToken} feedback={
      <section className="client-feedback" aria-labelledby="client-feedback-title">
        <div className="client-section-heading"><div><h2 id="client-feedback-title">Project conversation</h2>
          <p>Feedback about this project preview, shared with your project manager.</p></div>
          <button type="button" className="client-icon-action" aria-label="Refresh project conversation" disabled={feedbackLoading}
            onClick={() => setFeedbackRefresh(value => value + 1)}><RefreshCw size={15} /></button></div>
        {feedbackError && <p role="alert" className="client-project-error">{feedbackError} <button type="button" onClick={() => setFeedbackRefresh(value => value + 1)}>Try again</button></p>}
        <div className="client-feedback-messages" aria-live="polite">
          {feedbackLoading ? <p role="status" className="client-section-state">Loading project conversation…</p>
            : feedback.length ? <>
              {feedbackCursor && <button type="button" className="client-text-action" disabled={feedbackMoreLoading} onClick={() => void loadMoreFeedback()}>
                {feedbackMoreLoading ? 'Loading…' : 'Load earlier messages'}
              </button>}
              {feedback.map(message => <FeedbackBubble key={message.id} message={message} />)}
            </> : !feedbackError && <p className="client-section-state">No project messages yet. Send a note if you have feedback or a question.</p>}
        </div>
        <form className="client-feedback-composer" onSubmit={event => void sendFeedback(event)}>
          <label className="sr-only" htmlFor="client-project-feedback">Message your project manager about this project</label>
          <textarea id="client-project-feedback" value={draft} maxLength={4000} disabled={inspectionOnly || sending}
            onChange={event => setDraft(event.target.value)} placeholder="Write a message about this project…" />
          {sendError && <p role="alert" className="client-project-error">{sendError}</p>}
          <div><span>Only you and your project manager can see this conversation.</span>
            <button type="submit" className="client-primary-action" disabled={inspectionOnly || sending || !draft.trim()}>
              <Send size={14} />{sending ? 'Sending…' : 'Send'}
            </button></div>
        </form>
      </section>
    }/>}
    {tab === 'requests' && <section className="client-project-requests" aria-labelledby="client-project-requests-title">
      <div className="client-section-heading"><div><h2 id="client-project-requests-title">Requests in this project</h2>
        <p>Only requests returned for this shared project are shown here.</p></div>
        <button type="button" className="client-icon-action" aria-label="Refresh project requests" disabled={requestLoading}
          onClick={() => setRequestRefresh(value => value + 1)}><RefreshCw size={15} /></button></div>
      <label className="client-search"><span className="sr-only">Search project requests</span>
        <input value={requestSearchInput} onChange={event => setRequestSearchInput(event.target.value)} placeholder="Search project requests" /></label>
      {requestError && <p role="alert" className="client-project-error">{requestError} <button type="button" onClick={() => setRequestRefresh(value => value + 1)}>Try again</button></p>}
      <div className="client-activity-list">
        {requestLoading ? <p role="status" className="client-section-state">Loading project requests…</p>
          : requestPage?.items.length ? requestPage.items.map(item => <RequestSummary key={requestKey(item)} item={item} onOpen={onOpenRequest} />)
            : !requestError && <p className="client-section-state">No requests are linked to this project yet.</p>}
      </div>
      {requestPage?.nextCursor && <button type="button" className="client-text-action" disabled={requestMoreLoading} onClick={() => void loadMoreRequests()}>
        {requestMoreLoading ? 'Loading…' : 'Load more requests'} <ArrowRight size={15} />
      </button>}
    </section>}
  </section>;

  return <section className="client-page client-projects-page" aria-labelledby="client-projects-page-title">
    <header className="client-projects-heading"><div><p className="client-eyebrow">CLIENT PORTAL</p><h1 id="client-projects-page-title">Projects</h1>
      <p className="client-page-description">Projects your project manager has shared with you.</p></div>
      {!inspectionOnly && <button type="button" className="client-primary-action" aria-expanded={proposalFormOpen} aria-controls={proposalFormOpen ? 'client-proposal-form' : undefined} onClick={() => { setProposalFormOpen(value => !value); setProposalError(''); setProposalSuccess(''); }}>
        {proposalFormOpen ? <X size={15} /> : <Plus size={15} />}{proposalFormOpen ? 'Close' : 'Propose a project'}
      </button>}
    </header>
    {error && <p role="alert" className="client-project-error">{error}</p>}
    {proposalFormOpen && <form id="client-proposal-form" className="client-proposal-form" onSubmit={submitProposal}>
      <div><h2>Propose a new project</h2><p>Describe the outcome you want. Your project manager will review it and choose the right workspace.</p></div>
      <label htmlFor="client-proposal-title">Project title<input id="client-proposal-title" value={proposalTitle} onChange={event => setProposalTitle(event.target.value)} maxLength={160} required disabled={proposalSubmitting || proposalNeedsRetry} /></label>
      <label htmlFor="client-proposal-description">What would you like to accomplish?<textarea id="client-proposal-description" value={proposalDescription} onChange={event => setProposalDescription(event.target.value)} maxLength={6000} rows={4} required disabled={proposalSubmitting || proposalNeedsRetry} /></label>
      <label htmlFor="client-proposal-deadline">Target date <span>(optional)</span><input id="client-proposal-deadline" type="date" value={proposalDeadline} onChange={event => setProposalDeadline(event.target.value)} disabled={proposalSubmitting || proposalNeedsRetry} /></label>
      <p id="client-proposal-note" className="client-proposal-note">Sending this proposal does not create a project or promise a start date. If your PM accepts it, a request will appear here so you can discuss the scope together.</p>
      {proposalError && <p role="alert" className="client-project-error">{proposalError}</p>}
      <div className="client-proposal-actions">
        {!proposalNeedsRetry && <button type="button" className="client-proposal-cancel" disabled={proposalSubmitting} onClick={() => { setProposalFormOpen(false); setProposalError(''); }}>Cancel</button>}
        <button type="submit" className="client-primary-action" aria-describedby="client-proposal-note" disabled={proposalSubmitting || (!proposalNeedsRetry && (!proposalTitle.trim() || !proposalDescription.trim()))}>
          <Send size={14} />{proposalSubmitting ? 'Sending…' : proposalNeedsRetry ? 'Retry same proposal' : 'Send proposal'}
        </button>
      </div>
    </form>}
    {proposalSuccess && <p role="status" className="client-proposal-success">{proposalSuccess}</p>}
    <section className="client-proposals" aria-labelledby="client-proposals-title">
      <div className="client-section-heading"><div><h2 id="client-proposals-title">Project proposals</h2>
        <p>These are proposals for your PM to review, not active projects.</p></div>
        <button type="button" className="client-icon-action" aria-label="Refresh project proposals" disabled={proposalsLoading} onClick={onRefreshProposals}><RefreshCw size={15} /></button>
      </div>
      {proposalsError && <p role="alert" className="client-project-error">{proposalsError} <button type="button" onClick={onRefreshProposals}>Try again</button></p>}
      {proposalsLoading ? <p role="status" className="client-section-state">Loading project proposals…</p>
        : proposals.length ? <div className="client-proposal-list">{proposals.map(proposal => <article key={proposal.id} className="client-proposal-row">
          <div><strong>{proposal.title}</strong><p>{proposal.description}</p><small>Sent {time(proposal.submittedAt)}{proposal.requestedDeadline ? ` · Target ${proposal.requestedDeadline}` : ''}</small>
            <small className="client-proposal-next">{proposal.status === 'pending'
              ? 'Your project manager will review this proposal and update you here.'
              : 'Your project manager decided not to move forward. No project was created.'}</small></div>
          <span className={`client-proposal-status ${proposal.status === 'pending' ? 'is-pending' : 'is-declined'}`}>
            {proposal.status === 'pending' ? 'Waiting for PM review' : 'Not moving forward'}
          </span>
        </article>)}</div>
          : !proposalsError && <p className="client-section-state">No project proposals yet.</p>}
    </section>
    {loading ? <p role="status" className="client-section-state">Loading your projects…</p>
      : projects.length ? <div className="client-project-list">{[...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).map(project => <button
        key={clientProjectKey(project)} type="button" onClick={() => { onSelectedProjectKeyChange(clientProjectKey(project)); setTab('overview'); }}>
        <span className="client-project-list-icon"><FolderKanban size={18} /></span>
        <span><strong>{project.name}</strong><small>{project.preview ? 'Preview available' : 'No preview shared'} · Updated {time(project.updatedAt)}</small></span>
        <ArrowRight size={16} aria-hidden />
      </button>)}</div>
        : !error && <div className="client-project-empty"><FolderKanban size={24} /><h2>No projects shared yet</h2>
          <p>When your project manager gives your account access to a project, it will appear here.</p></div>}
  </section>;
}

function RequestSummary({ item, onOpen }: { item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void }) {
  const pending = item.projectLinkStatus === 'pending_review';
  return <button type="button" className="client-activity-row" onClick={() => onOpen(item)}>
    <span className="client-activity-copy"><strong>{item.title}</strong><small>{item.reference} · {pending
      ? `PM review pending${item.requestedProjectName ? ` for ${item.requestedProjectName}` : ''}`
      : clientTicketProgress(item.status, item.requestedAction).label}</small></span>
    <span className={`client-activity-status ${pending ? 'is-pending' : ''}`}>{pending ? 'PM review pending' : clientTicketProgress(item.status, null).statusLabel}</span>
    <time dateTime={item.updatedAt}>Updated {time(item.updatedAt)}</time><ArrowRight size={15} aria-hidden />
  </button>;
}

function FeedbackBubble({ message }: { message: ClientProjectFeedbackMessage }) {
  const own = message.author === 'client';
  return <article className={`client-feedback-message ${own ? 'is-mine' : ''}`}>
    <span>{own ? 'You' : 'Project manager'}</span><p>{message.body}</p><time dateTime={message.createdAt}>{time(message.createdAt)}</time>
  </article>;
}

function requestKey(item: ClientProjectRequestItem): string { return `${item.workspaceId}\u0000${item.id}`; }

function projectLoadError(error: unknown, area: 'requests' | 'feedback' | 'send'): string {
  if (error instanceof ClientTicketApiError) {
    if (error.status === 401) return 'Your sign-in has expired. Sign in again to continue.';
    if (error.status === 403 || error.status === 404) return area === 'send'
      ? 'Project access could not be verified. Refresh and try again.' : 'This shared project is no longer available to your account.';
    if (error.reconciliationRequired) return 'We could not confirm whether your message was sent. Refresh the conversation before trying again.';
  }
  return area === 'send' ? 'Your message could not be sent. Try again.'
    : area === 'feedback' ? 'Could not load the project conversation.' : 'Could not load requests for this project.';
}
