import { LoadingRows } from '@/shared/components/ui/skeleton';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, FolderKanban, Lightbulb, RefreshCw, Send, Plus } from 'lucide-react';

import type { ClientProject, ClientProjectFeedbackMessage, ClientProjectRequestItem, ClientProjectRequestQueue } from './clientApi';
import { clientTicketApi } from './clientApi';
import { CxBadge, CxEmpty, CxPageHeader, CxPanel, CxRow, CxSection, CxTrack } from './clientKit';
import { clientTicketProgress } from './clientTicketProgress';
import { clientGreeting, clientNextStep, clientRequestGroup, listProgressIndex, relativeTime } from './clientFriendly';
import { CLIENT_PROGRESS_LABELS } from './clientProgressSteps';
import { time } from './ticketUi';
import { ClientProjectQaStudio } from './ClientProjectQaStudio';
import { clientProjectKey, projectLoadError, ProjectOverviewTab, ProjectRequestsTab, type ProjectRequestFilter } from './ClientProjectSections';

export { clientProjectKey } from './ClientProjectSections';

export function ClientOverviewPage({ clientName, requests, projects, requestsLoading, requestsError, projectsLoading, projectsError,
  onOpenRequest, onOpenProject, onGoToProjects, onGoToRequests, onProposeProject, proposalsNeedingReply = 0, onOpenProposals }: {
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
  /** Project ideas where the project manager is waiting on the client's reply. */
  proposalsNeedingReply?: number;
  onOpenProposals?: () => void;
}) {
  const items = requests?.items ?? [];
  const attention = items.filter(item => clientRequestGroup(item) === 'needs_you');
  const waiting = attention.length + (proposalsNeedingReply && onOpenProposals ? 1 : 0);
  const recent = [...items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6);
  const firstName = clientName?.trim().split(/\s+/)[0] ?? '';
  const shownProjects = [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 4);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return <section className="cx-page client-home" aria-labelledby="client-overview-title">
    <CxPageHeader titleId="client-overview-title" eyebrow={today} title={clientGreeting() + (firstName ? ', ' + firstName : '')} />

    <section className="cx-section" aria-labelledby="client-attention-title" aria-busy={requestsLoading && !requests}>
      {requestsError && <p role="alert" className="cx-error">{requestsError}</p>}
      {!requests && requestsLoading ? <CxPanel><LoadingRows label="Loading requests needing attention" layout="detail" rows={1} className="w-full p-4" /></CxPanel>
        : !requests ? null
        : waiting ? <>
          <div className="cx-section-head"><h2 id="client-attention-title">{waiting} {waiting === 1 ? 'thing needs' : 'things need'} you</h2></div>
          <CxPanel tone="attention">
            {attention.map(item => {
              const step = clientNextStep(item.requestedAction);
              return <CxRow key={requestKey(item)} title={item.title} meta={step?.prompt ?? 'Your project manager needs you'} onClick={() => onOpenRequest(item)}
                trailing={<span className="cx-button is-primary">{step?.action ?? 'Open request'}</span>} />;
            })}
            {proposalsNeedingReply > 0 && onOpenProposals && <CxRow onClick={onOpenProposals}
              title={proposalsNeedingReply === 1 ? 'Your project idea' : proposalsNeedingReply + ' project ideas'} meta="Your project manager has a question"
              trailing={<span className="cx-button is-primary">Reply</span>} />}
          </CxPanel>
        </>
          : <CxPanel><div className="cx-caught-up"><Check size={18} aria-hidden="true" /><div><h2 id="client-attention-title">You’re all caught up</h2>
            <p>Your project manager is on it. We’ll let you know here when something needs you.</p></div></div></CxPanel>}
    </section>

    <div className="cx-home-grid">
      <CxSection titleId="client-projects-title" title={shownProjects.length === 1 ? 'Your project' : 'Your projects'}
        action={projects.length > shownProjects.length ? <button type="button" className="cx-link" onClick={onGoToProjects}>All projects <ArrowRight size={14} aria-hidden="true" /></button> : undefined}>
        {projectsError && <p role="alert" className="cx-error">{projectsError}</p>}
        {projectsLoading && !projects.length ? <CxPanel><LoadingRows label="Loading shared projects" rows={2} className="p-4" /></CxPanel>
          : shownProjects.length ? <div className="cx-project-list">{shownProjects.map(project => <ClientProjectSpotlight key={clientProjectKey(project)}
            project={project} requests={items} onOpenProject={() => onOpenProject(project)} onOpenRequest={onOpenRequest} />)}</div>
            : !projectsError && <CxPanel><CxEmpty title="No projects yet" body="No projects have been shared with your account yet. When your project manager shares one, it will appear here." /></CxPanel>}
      </CxSection>

      <CxSection titleId="client-recent-title" title="Latest updates"
        action={<button type="button" className="cx-link" onClick={onGoToRequests}>All requests <ArrowRight size={14} aria-hidden="true" /></button>}>
        {!requests && requestsLoading ? <CxPanel><LoadingRows label="Loading recent request updates" layout="table" rows={4} className="p-4" /></CxPanel>
          : !requests ? null
          : recent.length ? <CxPanel>{recent.map(item => <UpdateRow key={requestKey(item)} item={item} onOpen={onOpenRequest} />)}</CxPanel>
            : <CxPanel><CxEmpty title="No updates yet" body="Your project manager will share requests here." /></CxPanel>}
      </CxSection>
    </div>

    {onProposeProject && <CxPanel className="cx-idea">
      <div><strong>Have a new idea?</strong><p>Tell your project manager what you’d like to build next.</p></div>
      <button type="button" className="cx-button" onClick={onProposeProject}><Plus size={15} aria-hidden="true" />Propose a project</button>
    </CxPanel>}
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
  return <article className="cx-panel cx-project-card">
    <header className="cx-project-card-head">
      <span className="cx-project-icon" aria-hidden="true"><FolderKanban size={18} /></span>
      <div className="cx-project-card-title">
        <h3>{project.name}</h3>
        <p>{open.length ? open.length + ' open ' + (open.length === 1 ? 'request' : 'requests') : 'No open requests'} · updated {relativeTime(project.updatedAt)}{project.preview ? ' · preview ready' : ''}</p>
      </div>
      {needsYou > 0 && <CxBadge tone="attention">{needsYou} {needsYou === 1 ? 'needs' : 'need'} you</CxBadge>}
      <button type="button" className="cx-link" onClick={onOpenProject} aria-label={'View project ' + project.name}>View project <ArrowRight size={14} aria-hidden="true" /></button>
    </header>
    {shown.map(item => <RequestProgressRow key={requestKey(item)} item={item} onOpen={onOpenRequest} />)}
    {open.length > shown.length && <button type="button" className="cx-row is-interactive cx-more" onClick={onOpenProject}>{open.length - shown.length} more in this project</button>}
  </article>;
}

function RequestProgressRow({ item, onOpen }: { item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void }) {
  const index = listProgressIndex(item);
  const label = clientTicketProgress(item.status, item.requestedAction).label;
  return <CxRow title={item.title} onClick={() => onOpen(item)}
    meta={index !== null ? 'Step ' + (index + 1) + ' of ' + CLIENT_PROGRESS_LABELS.length + ' · ' + label : label}>
    {index !== null && <CxTrack index={index} total={CLIENT_PROGRESS_LABELS.length} />}
  </CxRow>;
}

function UpdateRow({ item, onOpen }: { item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void }) {
  const pending = item.projectLinkStatus === 'pending_review';
  const sentence = pending
    ? 'Your project manager is confirming the project' + (item.requestedProjectName ? ' for ' + item.requestedProjectName : '')
    : clientTicketProgress(item.status, item.requestedAction).label;
  return <CxRow title={item.title} onClick={() => onOpen(item)} meta={<>{sentence} · <time dateTime={item.updatedAt} title={time(item.updatedAt)}>{relativeTime(item.updatedAt)}</time></>}
    trailing={<span className={'cx-dot is-' + clientRequestGroup(item)} aria-hidden="true" />} />;
}

export function ClientProjectsPage({ api = clientTicketApi, projects, loading, error, selectedProjectKey,
  onSelectedProjectKeyChange, onOpenRequest, onNewRequest, inspectionOnly, newRequestEnabled, newRequestLoading, projectFocusVersion, refreshToken,
  proposalsNeedingReply = 0, onOpenProposals, onProposeProject, idPrefix = 'client', requests = [] }: {
  idPrefix?: string;
  /** Proposals the project manager is waiting on the client for; they live on their own page. */
  proposalsNeedingReply?: number;
  onOpenProposals?: () => void;
  /** Opens the proposal form on the Proposals page; absent when the client cannot propose. */
  onProposeProject?: () => void;
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
}) {
  const selectedProject = projects.find(project => clientProjectKey(project) === selectedProjectKey) ?? null;
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

  return <section className="cx-page client-projects-page" aria-labelledby={idPrefix + '-projects-page-title'}>
    <CxPageHeader titleId={idPrefix + '-projects-page-title'} title="Your projects" description="Everything your project manager has shared with you."
      actions={!inspectionOnly && onProposeProject ? <button type="button" className="cx-button" onClick={onProposeProject}><Plus size={15} aria-hidden="true" />Propose a project</button> : undefined} />
    {proposalsNeedingReply > 0 && onOpenProposals && <CxPanel tone="attention"><div className="cx-row" role="status">
      <Lightbulb size={16} aria-hidden="true" />
      <span className="cx-row-copy"><strong>Your project manager is waiting on your reply to {proposalsNeedingReply === 1 ? 'a project idea' : proposalsNeedingReply + ' project ideas'}.</strong></span>
      <button type="button" className="cx-link" onClick={onOpenProposals}>Open project ideas <ArrowRight size={14} aria-hidden="true" /></button>
    </div></CxPanel>}
    {error && <p role="alert" className="cx-error">{error}</p>}
    <section aria-label="Shared projects">
      {loading ? <CxPanel><LoadingRows label="Loading your projects" className="p-4" /></CxPanel>
        : projects.length ? <div className="cx-project-grid">
          {[...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).map(project => <ClientProjectSpotlight
            key={clientProjectKey(project)} project={project} requests={requests} onOpenRequest={onOpenRequest}
            onOpenProject={() => { onSelectedProjectKeyChange(clientProjectKey(project)); setTab('overview'); }} />)}
        </div>
          : !error && <CxPanel><CxEmpty icon={<FolderKanban size={22} />} title="No projects shared yet"
            body="When your project manager gives your account access to a project, it will appear here." /></CxPanel>}
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
