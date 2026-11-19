import { LoadingRows } from '@/shared/components/ui/skeleton';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, FolderKanban, Hand, RefreshCw, Send, Plus } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { DatePicker } from '@/shared/components/ui/date-picker';

import type { ClientProject, ClientProjectFeedbackMessage, ClientProjectProposal, ClientProjectProposalInput,
  ClientProjectProposalReplyInput, ClientProjectRequestItem, ClientProjectRequestQueue } from './clientApi';
import { clientTicketApi, ClientTicketApiError } from './clientApi';
import { clientTicketProgress } from './clientTicketProgress';
import { clientGreeting, clientNextStep, clientRequestGroup, dayLabel, listProgressIndex, relativeTime } from './clientFriendly';
import { CLIENT_PROGRESS_LABELS } from './clientProgressSteps';
import { time } from './ticketUi';
import { ClientProjectQaStudio } from './ClientProjectQaStudio';
import { clientProjectKey, projectLoadError, ProjectOverviewTab, ProjectRequestsTab, type ProjectRequestFilter } from './ClientProjectSections';
import { clientProposalView } from './clientProposalPresentation';

export { clientProjectKey } from './ClientProjectSections';

export function ClientOverviewPage({ clientName, requests, projects, requestsLoading, requestsError, projectsLoading, projectsError,
  onOpenRequest, onOpenProject, onGoToProjects, onGoToRequests, onProposeProject }: {
  clientName?: string;
  requests: ClientProjectRequestQueue | null;
  projects: ClientProject[];
  requestsLoading: boolean;
  requestsError: string;
  projectsLoading: boolean;
  projectsError: string;
  onOpenRequest: (request: ClientProjectRequestItem) => void;
  onOpenProject: (project: ClientProject) => void;
  onGoToProjects: () => void;
  onGoToRequests: () => void;
  /** Shown as a closing "new idea" card when the client may propose projects. */
  onProposeProject?: () => void;
}) {
  const items = requests?.items ?? [];
  const attention = items.filter(item => clientRequestGroup(item) === 'needs_you');
  const recent = [...items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6);
  const days = recent.reduce<Array<{ day: string; rows: ClientProjectRequestItem[] }>>((groups, item) => {
    const day = dayLabel(item.updatedAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.rows.push(item); else groups.push({ day, rows: [item] });
    return groups;
  }, []);
  const firstName = clientName?.trim().split(/\s+/)[0] ?? '';
  const shownProjects = [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 4);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return <section className="client-page client-home is-wide" aria-labelledby="client-overview-title">
    <header className="client-home-hello">
      <p>{today}</p>
      <h1 id="client-overview-title">{clientGreeting()}{firstName ? `, ${firstName}` : ''}</h1>
    </header>

    <section aria-labelledby="client-attention-title" aria-busy={requestsLoading && !requests}>
      <h2 id="client-attention-title" className="sr-only">Needs you</h2>
      {requestsError && <p role="alert" className="client-project-error">{requestsError}</p>}
      {!requests && requestsLoading ? <div className="client-hero"><LoadingRows label="Loading requests needing attention" layout="detail" rows={1} className="w-full" /></div>
        : !requests ? null
        : attention.length ? <div className="client-hero is-attention">
          <div className="client-hero-head">
            <span className="client-hero-icon" aria-hidden="true"><Hand size={19} /></span>
            <div><strong>{attention.length} {attention.length === 1 ? 'thing needs' : 'things need'} you</strong><p>Everything else is moving along.</p></div>
          </div>
          <ul className="client-hero-list">{attention.map(item => {
            const step = clientNextStep(item.requestedAction);
            return <li key={requestKey(item)}><button type="button" className="client-hero-row" onClick={() => onOpenRequest(item)}>
              <span><strong>{item.title}</strong><small>{step?.prompt ?? 'Your project manager needs you'}</small></span>
              <span className="client-hero-action">{step?.action ?? 'Open request'}<ArrowRight size={14} aria-hidden /></span>
            </button></li>;
          })}</ul>
        </div>
          : <div className="client-hero is-clear">
            <span className="client-hero-icon" aria-hidden="true"><Check size={20} /></span>
            <div><strong>You’re all caught up</strong><p>Your project manager is on it. We’ll let you know here when something needs you.</p></div>
          </div>}
    </section>

    {/* Wide screens: projects and recent activity side by side, so the page uses the whole panel. */}
    <div className="client-home-grid">
    <section className="client-home-block" aria-labelledby="client-projects-title">
      <div className="client-home-block-head">
        <h2 id="client-projects-title">{shownProjects.length === 1 ? 'Your project' : 'Your projects'}</h2>
        {projects.length > shownProjects.length && <button type="button" className="client-text-action" onClick={onGoToProjects}>All projects <ArrowRight size={15} /></button>}
      </div>
      {projectsError && <p role="alert" className="client-project-error">{projectsError}</p>}
      {projectsLoading && !projects.length ? <div className="client-spotlight"><LoadingRows label="Loading shared projects" rows={2} /></div>
        : shownProjects.length ? <div className="client-spotlights">{shownProjects.map(project => <ClientProjectSpotlight key={clientProjectKey(project)}
          project={project} requests={items} onOpenProject={() => onOpenProject(project)} onOpenRequest={onOpenRequest} />)}</div>
          : !projectsError && <p className="client-home-empty">No projects have been shared with your account yet. When your project manager shares one, it will appear here.</p>}
    </section>

    <section className="client-home-block" aria-labelledby="client-recent-title">
      <div className="client-home-block-head">
        <h2 id="client-recent-title">Recent activity</h2>
        <button type="button" className="client-text-action" onClick={onGoToRequests}>All requests <ArrowRight size={15} /></button>
      </div>
      {!requests && requestsLoading ? <div className="client-spotlight"><LoadingRows label="Loading recent request updates" layout="table" rows={4} /></div>
        : !requests ? null
        : days.length ? <ol className="client-timeline">{days.map(group => <li key={group.day}>
          <p className="client-timeline-day">{group.day}</p>
          <ul>{group.rows.map(item => <li key={requestKey(item)}><UpdateRow item={item} onOpen={onOpenRequest} /></li>)}</ul>
        </li>)}</ol>
          : <p className="client-home-empty">No request updates yet. Your project manager will share requests here.</p>}
    </section>
    </div>

    {onProposeProject && <div className="client-home-idea">
      <div><strong>Have a new idea?</strong><p>Tell your project manager what you’d like to build next.</p></div>
      <button type="button" className="client-secondary-action" onClick={onProposeProject}><Plus size={15} />Propose a project</button>
    </div>}
  </section>;
}

/** One project with each open request and where it is on the five steps. */
export function ClientProjectSpotlight({ project, requests, onOpenProject, onOpenRequest }: {
  project: ClientProject;
  requests: ClientProjectRequestItem[];
  onOpenProject: () => void;
  onOpenRequest: (request: ClientProjectRequestItem) => void;
}) {
  const open = requests.filter(item => item.workspaceId === project.workspaceId && item.projectId === project.projectId
    && clientRequestGroup(item) !== 'done').sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const needsYou = open.filter(item => clientRequestGroup(item) === 'needs_you').length;
  const shown = open.slice(0, 3);
  return <article className="client-spotlight">
    <header className="client-spotlight-head">
      <span className="client-spotlight-icon" aria-hidden="true"><FolderKanban size={18} /></span>
      <div className="client-spotlight-title">
        <h3>{project.name}</h3>
        <p>{open.length ? `${open.length} open ${open.length === 1 ? 'request' : 'requests'}` : 'No open requests'} · updated {relativeTime(project.updatedAt)}{project.preview ? ' · preview ready' : ''}</p>
      </div>
      {needsYou > 0 && <span className="client-soft-badge is-attention">{needsYou} {needsYou === 1 ? 'needs' : 'need'} you</span>}
      <button type="button" className="client-text-action" onClick={onOpenProject} aria-label={`View project ${project.name}`}>View project <ArrowRight size={15} /></button>
    </header>
    {shown.length > 0 && <ul className="client-spotlight-requests">{shown.map(item => <li key={requestKey(item)}><RequestProgressRow item={item} onOpen={onOpenRequest} /></li>)}</ul>}
    {open.length > shown.length && <button type="button" className="client-spotlight-more" onClick={onOpenProject}>{open.length - shown.length} more in this project</button>}
  </article>;
}

function RequestProgressRow({ item, onOpen }: { item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void }) {
  const index = listProgressIndex(item);
  const label = clientTicketProgress(item.status, item.requestedAction).label;
  return <button type="button" className="client-spotlight-request" onClick={() => onOpen(item)}>
    <strong>{item.title}</strong>
    {index !== null && <span className="client-mini-track" aria-hidden="true">{CLIENT_PROGRESS_LABELS.map((step, stepIndex) => <span key={step}
      className={stepIndex < index ? 'is-done' : stepIndex === index ? 'is-current' : ''} />)}</span>}
    <small>{index !== null ? `Step ${index + 1} of ${CLIENT_PROGRESS_LABELS.length} · ${label}` : label}</small>
  </button>;
}

function UpdateRow({ item, onOpen }: { item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void }) {
  const pending = item.projectLinkStatus === 'pending_review';
  const sentence = pending
    ? `Your project manager is confirming the project${item.requestedProjectName ? ` for ${item.requestedProjectName}` : ''}`
    : clientTicketProgress(item.status, item.requestedAction).label;
  return <button type="button" className="client-timeline-row" onClick={() => onOpen(item)}>
    <span className={`client-feed-dot is-${clientRequestGroup(item)}`} aria-hidden="true" />
    <span className="client-feed-copy"><strong>{item.title}</strong><small>{sentence}</small></span>
    {/* The day heading already names the date, so older rows show only the time of day. */}
    <time dateTime={item.updatedAt} title={time(item.updatedAt)}>{dayLabel(item.updatedAt) === 'Today' ? relativeTime(item.updatedAt)
      : new Date(item.updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
  </button>;
}

export function ClientProjectsPage({ api = clientTicketApi, projects, loading, error, selectedProjectKey,
  onSelectedProjectKeyChange, onOpenRequest, onNewRequest, inspectionOnly, newRequestEnabled, newRequestLoading, projectFocusVersion, refreshToken,
  proposals, proposalsLoading, proposalsError, onRefreshProposals, onProposalSubmitted, idPrefix = 'client', requests = [],
  openProposalVersion = 0 }: {
  idPrefix?: string;
  /** Raised from Home's "Propose a project" card; each new value opens the proposal form once. */
  openProposalVersion?: number;
  /** Requests already loaded by the portal, used for each project card's counts. */
  requests?: ClientProjectRequestItem[];
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
  useEffect(() => {
    if (openProposalVersion > 0 && !inspectionOnly) { setProposalFormOpen(true); setProposalSuccess(''); }
  }, [openProposalVersion]);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalDeadline, setProposalDeadline] = useState('');
  const [proposalSubmitting, setProposalSubmitting] = useState(false);
  const [proposalNeedsRetry, setProposalNeedsRetry] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [proposalSuccess, setProposalSuccess] = useState('');
  const pendingProposal = useRef<ClientProjectProposalInput | null>(null);
  const [proposalReplyDrafts, setProposalReplyDrafts] = useState<Record<string, string>>({});
  const [proposalReplying, setProposalReplying] = useState<string | null>(null);
  const [proposalReplyErrors, setProposalReplyErrors] = useState<Record<string, string>>({});
  const pendingProposalReplies = useRef(new Map<string, ClientProjectProposalReplyInput>());
  const [tab, setTab] = useState<'overview' | 'preview' | 'requests'>('overview');
  const [requestFilter, setRequestFilter] = useState<ProjectRequestFilter>('all');
  useEffect(() => { setTab('overview'); setRequestFilter('all'); }, [selectedProjectKey, projectFocusVersion]);
  const [feedbackResult, setFeedbackResult] = useState<{ key: string; items: ClientProjectFeedbackMessage[] } | null>(null);
  const [feedbackCursor, setFeedbackCursor] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackMoreLoading, setFeedbackMoreLoading] = useState(false);
  const [feedbackRefresh, setFeedbackRefresh] = useState(0);
  const [projectDrafts, setProjectDrafts] = useState<Record<string,string>>({});
  const projectKey=selectedProject?clientProjectKey(selectedProject):'';
  const feedbackReady = feedbackResult?.key === projectKey;
  const feedback = feedbackReady ? feedbackResult.items : [];
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

  async function replyToProposal(proposal: ClientProjectProposal) {
    if (proposalReplying || inspectionOnly || proposal.status !== 'awaiting_client') return;
    const body = (proposalReplyDrafts[proposal.id] ?? '').trim();
    if (!body) return;
    let input = pendingProposalReplies.current.get(proposal.id);
    if (!input || input.body !== body) {
      input = { schemaVersion: 1, operationId: crypto.randomUUID(), body };
      pendingProposalReplies.current.set(proposal.id, input);
    }
    setProposalReplying(proposal.id);
    setProposalReplyErrors(current => ({ ...current, [proposal.id]: '' }));
    try {
      await api.replyToProjectProposal(proposal.id, input);
      pendingProposalReplies.current.delete(proposal.id);
      setProposalReplyDrafts(current => ({ ...current, [proposal.id]: '' }));
      onRefreshProposals();
    } catch (error) {
      if (!(error instanceof ClientTicketApiError)
        || (error.status !== null && error.status < 500 && !error.reconciliationRequired)) {
        pendingProposalReplies.current.delete(proposal.id);
      }
      setProposalReplyErrors(current => ({ ...current, [proposal.id]: error instanceof ClientTicketApiError && error.status === 401
        ? 'Your sign-in expired. Sign in again before replying.'
        : error instanceof ClientTicketApiError && error.reconciliationRequired
          ? 'We could not confirm your reply. Retry this same message to check safely.'
          : 'We could not send your reply. Refresh the proposal and try again.' }));
    } finally { setProposalReplying(null); }
  }

  useEffect(() => {
    if (!selectedProject || tab !== 'preview') return;
    let active = true;
    setFeedbackLoading(true); setFeedbackError('');
    void api.getProjectFeedbackMessages(selectedProject.workspaceId, selectedProject.projectId, { limit: 50 }).then(page => {
      if (active) { setFeedbackResult({ key: projectKey, items: page.items }); setFeedbackCursor(page.nextCursor); }
    }).catch(error => {
      if (active) setFeedbackError(projectLoadError(error, 'feedback'));
    }).finally(() => { if (active) setFeedbackLoading(false); });
    return () => { active = false; };
  }, [api, selectedProject?.workspaceId, selectedProject?.projectId, feedbackRefresh, tab]);

  async function loadMoreFeedback() {
    if (!selectedProject || !feedbackReady || !feedbackCursor || feedbackMoreLoading) return;
    setFeedbackMoreLoading(true); setFeedbackError('');
    try {
      const page = await api.getProjectFeedbackMessages(selectedProject.workspaceId, selectedProject.projectId,
        { limit: 50, before: feedbackCursor });
      if(activeProject.current!==projectKey)return;
      setFeedbackResult(current => current?.key === projectKey ? { key: projectKey, items: [...page.items, ...current.items] } : current); setFeedbackCursor(page.nextCursor);
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

  const newRequestButton = selectedProject && newRequestEnabled ? <button type="button" className="client-primary-action" disabled={newRequestLoading}
    onClick={() => onNewRequest(selectedProject)}><Plus size={15} />{newRequestLoading ? 'Checking access…' : 'New request'}</button> : null;

  if (selectedProject) return <section className="client-page client-project-detail" aria-labelledby={`${idPrefix}-project-title`}>
    <h1 id={`${idPrefix}-project-title`} className="sr-only">{selectedProject.name}</h1>
    <div className="client-project-bar">
      <button type="button" className="client-project-back" aria-label="Back to projects" title="Back to projects"
        onClick={() => { onSelectedProjectKeyChange(null); setTab('overview'); }}><ArrowLeft size={16} /></button>
      <div className="client-project-tabs" role="tablist" aria-label="Project sections">
        {(['overview', 'preview', 'requests'] as const).map(value => <button key={value} type="button" role="tab"
          aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'preview' ? 'Project Review' : value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
    </div>
    {tab === 'overview' && <ProjectOverviewTab api={api} project={selectedProject} refreshToken={refreshToken}
      onOpenRequest={item => onOpenRequest(item)} onShowReview={() => setTab('preview')}
      onShowRequests={filter => { setRequestFilter(filter); setTab('requests'); }} />}
    {tab === 'preview' && <ClientProjectQaStudio key={clientProjectKey(selectedProject)}
      projectName={selectedProject.name} preview={selectedProject.preview} feedback={
      <section className="client-feedback" aria-labelledby={`${idPrefix}-feedback-title`}>
        <div className="client-section-heading"><div><h2 id={`${idPrefix}-feedback-title`}>Project conversation</h2>
          <p>Feedback about this project preview, shared with your project manager.</p></div>
          <button type="button" className="client-icon-action" aria-label="Refresh project conversation" disabled={feedbackLoading}
            onClick={() => setFeedbackRefresh(value => value + 1)}><RefreshCw size={15} /></button></div>
        {feedbackError && <p role="alert" className="client-project-error">{feedbackError} <button type="button" onClick={() => setFeedbackRefresh(value => value + 1)}>Try again</button></p>}
        <div className="client-feedback-messages" aria-live="polite">
          {!feedbackReady && !feedbackError ? <LoadingRows label="Loading project conversation" layout="conversation" />
            : feedback.length ? <>
              {feedbackCursor && <button type="button" className="client-text-action" disabled={feedbackMoreLoading} onClick={() => void loadMoreFeedback()}>
                {feedbackMoreLoading ? 'Loading…' : 'Load earlier messages'}
              </button>}
              {feedback.map(message => <FeedbackBubble key={message.id} message={message} />)}
            </> : !feedbackError && <p className="client-section-state">No project messages yet. Send a note if you have feedback or a question.</p>}
        </div>
        <form className="client-feedback-composer" onSubmit={event => void sendFeedback(event)}>
          <label className="sr-only" htmlFor={`${idPrefix}-project-feedback`}>Message your project manager about this project</label>
          <textarea id={`${idPrefix}-project-feedback`} value={draft} maxLength={4000} disabled={inspectionOnly || sending}
            onChange={event => setDraft(event.target.value)} placeholder="Write a message about this project…" />
          {sendError && <p role="alert" className="client-project-error">{sendError}</p>}
          <div><span>Only you and your project manager can see this conversation.</span>
            <button type="submit" className="client-primary-action" disabled={inspectionOnly || sending || !draft.trim()}>
              <Send size={14} />{sending ? 'Sending…' : 'Send'}
            </button></div>
        </form>
      </section>
    }/>}
    {tab === 'requests' && <ProjectRequestsTab api={api} project={selectedProject} refreshToken={refreshToken} filter={requestFilter}
      onFilterChange={setRequestFilter} onOpenRequest={onOpenRequest} newRequest={newRequestButton} idPrefix={idPrefix} />}
  </section>;

  return <section className="client-page client-projects-page is-wide" aria-labelledby={`${idPrefix}-projects-page-title`}>
    <header className="client-page-head">
      <div className="client-home-hello">
        <h1 id={`${idPrefix}-projects-page-title`}>Your projects</h1>
        <p>Everything your project manager has shared with you.</p>
      </div>
      {!inspectionOnly && <button type="button" className="client-secondary-action" aria-haspopup="dialog" aria-expanded={proposalFormOpen}
        onClick={() => { setProposalFormOpen(true); setProposalSuccess(''); }}><Plus size={15} />Propose a project</button>}
    </header>
    {error && <p role="alert" className="client-project-error">{error}</p>}
    <section className="client-existing-projects" aria-label="Shared projects">
      {loading ? <div className="client-spotlight"><LoadingRows label="Loading your projects" /></div>
        : projects.length ? <div className="client-spotlights is-grid">
          {[...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).map(project => <ClientProjectSpotlight
            key={clientProjectKey(project)} project={project} requests={requests} onOpenRequest={onOpenRequest}
            onOpenProject={() => { onSelectedProjectKeyChange(clientProjectKey(project)); setTab('overview'); }} />)}
        </div>
          : !error && <div className="client-project-empty"><FolderKanban size={24} /><h2>No projects shared yet</h2>
            <p>When your project manager gives your account access to a project, it will appear here.</p></div>}
    </section>
    <Modal isOpen={proposalFormOpen} onClose={() => setProposalFormOpen(false)} closeDisabled={proposalSubmitting}
      title="Propose a project" subtitle="Describe the outcome you want. Your project manager will review it and choose the right workspace."
      dialogClassName="client-proposal-modal" maxWidth="max-w-xl">
    <form id="client-proposal-form" className="client-proposal-form" onSubmit={submitProposal}>
      <label htmlFor="client-proposal-title">Project title<input id="client-proposal-title" value={proposalTitle} onChange={event => setProposalTitle(event.target.value)} maxLength={160} required disabled={proposalSubmitting || proposalNeedsRetry} /></label>
      <label htmlFor="client-proposal-description">What would you like to accomplish?<textarea id="client-proposal-description" value={proposalDescription} onChange={event => setProposalDescription(event.target.value)} maxLength={6000} rows={4} required disabled={proposalSubmitting || proposalNeedsRetry} /></label>
      <label htmlFor="client-proposal-deadline">Target date (optional)<DatePicker id="client-proposal-deadline" value={proposalDeadline} onChange={setProposalDeadline} disabled={proposalSubmitting || proposalNeedsRetry} className="w-full" buttonClassName="h-10 w-full justify-start text-left" /></label>
      <p id="client-proposal-note" className="client-proposal-note">Sending this proposal does not create a project or promise a start date. If your PM accepts it, a request will appear here so you can discuss the scope together.</p>
      {proposalError && <p role="alert" className="client-project-error">{proposalError}</p>}
      <div className="client-proposal-actions">
        {!proposalNeedsRetry && <button type="button" className="client-proposal-cancel" disabled={proposalSubmitting} onClick={() => setProposalFormOpen(false)}>Cancel</button>}
        <button type="submit" className="client-primary-action" aria-describedby="client-proposal-note" disabled={proposalSubmitting || (!proposalNeedsRetry && (!proposalTitle.trim() || !proposalDescription.trim()))}>
          <Send size={14} />{proposalSubmitting ? 'Sending…' : proposalNeedsRetry ? 'Retry same proposal' : 'Send proposal'}
        </button>
      </div>
    </form>
    </Modal>
    {proposalSuccess && <p role="status" className="client-proposal-success">{proposalSuccess}</p>}
    <section className="client-proposals" aria-labelledby="client-proposals-title">
      <div className="client-section-heading"><div><h2 id="client-proposals-title">Project proposals</h2>
        <p>Ideas you’ve sent to your project manager. They’ll review each one and reply here.</p></div>
        <button type="button" className="client-icon-action" aria-label="Refresh project proposals" disabled={proposalsLoading} onClick={onRefreshProposals}><RefreshCw size={15} /></button>
      </div>
      {proposalsError && <p role="alert" className="client-project-error">{proposalsError} <button type="button" onClick={onRefreshProposals}>Try again</button></p>}
      {proposalsLoading && !proposals.length ? <LoadingRows label="Loading project proposals" rows={2} />
        : proposals.length ? <div className="client-proposal-list">{proposals.map(proposal => {
          const messages = proposal.clarificationMessages ?? [];
          const view = clientProposalView(proposal, projects);
          return <article key={proposal.id} className="client-proposal-row">
          <div className="client-proposal-content"><strong>{proposal.title}</strong><p>{proposal.description}</p><small>Sent {time(proposal.submittedAt)}{proposal.requestedDeadline ? ` · Target ${proposal.requestedDeadline}` : ''}</small>
            <small className="client-proposal-next">{view.next}</small>
            {view.project && <button type="button" className="client-proposal-open" onClick={() => { onSelectedProjectKeyChange(clientProjectKey(view.project!)); setTab('overview'); }}>
              View project <ArrowRight size={13} aria-hidden="true" />
            </button>}
            {messages.length > 0 && <div className="client-proposal-conversation" aria-label="Conversation with your project manager">
              {messages.map(message => <article key={message.id} className={`client-proposal-message${message.author === 'client' ? ' is-client' : ''}`}>
                <div><strong>{message.author === 'pm' ? 'Project manager' : 'You'}</strong><time dateTime={message.createdAt}>{time(message.createdAt)}</time></div>
                <p>{message.body}</p>
              </article>)}
            </div>}
            {proposal.status === 'awaiting_client' && <form className="client-proposal-reply" onSubmit={event => { event.preventDefault(); void replyToProposal(proposal); }}>
              <label htmlFor={`proposal-reply-${proposal.id}`}>Your reply</label>
              <textarea id={`proposal-reply-${proposal.id}`} maxLength={4000} rows={3} value={proposalReplyDrafts[proposal.id] ?? ''}
                disabled={inspectionOnly || proposalReplying !== null}
                onChange={event => setProposalReplyDrafts(current => ({ ...current, [proposal.id]: event.target.value }))}
                placeholder="Type your response…" />
              {proposalReplyErrors[proposal.id] && <p role="alert" className="client-project-error">{proposalReplyErrors[proposal.id]}</p>}
              <div><small>Your reply goes back to your project manager.</small><button type="submit" className="client-primary-action"
                disabled={inspectionOnly || proposalReplying !== null || !(proposalReplyDrafts[proposal.id] ?? '').trim()}>
                <Send size={14} />{proposalReplying === proposal.id ? 'Sending…' : 'Send reply'}
              </button></div>
            </form>}
          </div>
          <span className={`client-proposal-status is-${view.tone}`}>{view.badge}</span>
        </article>;
        })}</div>
          : !proposalsError && <p className="client-section-state">No project proposals yet.</p>}
    </section>
  </section>;
}


function FeedbackBubble({ message }: { message: ClientProjectFeedbackMessage }) {
  const own = message.author === 'client';
  return <article className={`client-feedback-message ${own ? 'is-mine' : ''}`}>
    <span>{own ? 'You' : 'Project manager'}</span><p>{message.body}</p><time dateTime={message.createdAt}>{time(message.createdAt)}</time>
  </article>;
}

function requestKey(item: ClientProjectRequestItem): string { return `${item.workspaceId}\u0000${item.id}`; }
