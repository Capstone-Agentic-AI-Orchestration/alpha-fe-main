import { LoadingRows } from '@/shared/components/ui/skeleton';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ExternalLink, FolderKanban, Lightbulb, RefreshCw, Send, Plus } from 'lucide-react';

import type { ClientProject, ClientProjectFeedbackMessage, ClientProjectRequestItem, ClientProjectRequestQueue } from './clientApi';
import { clientTicketApi } from './clientApi';
import { CxBadge, CxEmpty, CxPageHeader, CxPanel, CxQuote, CxRequestRow, CxRow, CxSection, CxStats, CxTrack } from './clientKit';
import { ClientPreviewThumb } from './ClientPreviewThumb';
import { clientTicketProgress } from './clientTicketProgress';
import { clientGreeting, clientNextStep, clientRequestGroup, listProgressIndex, relativeTime } from './clientFriendly';
import { CLIENT_PROGRESS_LABELS } from './clientProgressSteps';
import { time } from './ticketUi';
import { QaPreview } from './ProjectQaStudio';
import { clientProjectKey, projectLoadError, ProjectRequestsTab, type ProjectRequestFilter } from './ClientProjectSections';

export { clientProjectKey } from './ClientProjectSections';

export function ClientOverviewPage({ clientName, requests, projects, requestsLoading, requestsError, projectsLoading, projectsError,
  onOpenRequest, onOpenProject, onGoToProjects, onGoToRequests, onProposeProject, proposalsNeedingReply = 0, onOpenProposals,
  api = clientTicketApi, refreshToken = 0 }: {
  api?: typeof clientTicketApi;
  /** Changes when the portal refreshes, so the latest project manager message reloads too. */
  refreshToken?: number;
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
  const inProgress = items.filter(item => clientRequestGroup(item) === 'in_progress').length;
  const done = items.filter(item => clientRequestGroup(item) === 'done').length;
  const latestByProject = useLatestManagerMessages(api, shownProjects, refreshToken);
  const latest = shownProjects.flatMap(project => {
    const message = latestByProject[clientProjectKey(project)];
    return message ? [{ project, message }] : [];
  }).sort((a, b) => Date.parse(b.message.createdAt) - Date.parse(a.message.createdAt))[0] ?? null;
  return <section className="cx-page" aria-labelledby="client-overview-title">
    <CxPageHeader titleId="client-overview-title" eyebrow={today} title={clientGreeting() + (firstName ? ', ' + firstName : '')} />
    {requests && items.length > 0 && <CxStats label="Your requests" items={[
      { label: 'Needs you', value: attention.length, tone: 'attention' },
      { label: 'In progress', value: inProgress },
      { label: 'Done', value: done, tone: 'done' },
    ]} />}

    <section className="cx-section" aria-labelledby="client-attention-title" aria-busy={requestsLoading && !requests}>
      {requestsError && <p role="alert" className="cx-error">{requestsError}</p>}
      {!requests && requestsLoading ? <CxPanel><LoadingRows label="Loading requests needing attention" layout="detail" rows={1} className="w-full p-4" /></CxPanel>
        : !requests ? null
        : waiting ? <>
          <div className="cx-section-head"><h2 id="client-attention-title">{waiting} {waiting === 1 ? 'thing needs' : 'things need'} you</h2></div>
          <CxPanel tone="attention">
            {attention.map(item => {
              const step = clientNextStep(item.requestedAction);
              const where = item.projectName ? ' · ' + item.projectName : '';
              return <CxRow key={requestKey(item)} title={item.title} meta={(step?.prompt ?? 'Your project manager needs you') + where} onClick={() => onOpenRequest(item)}
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
            project={project} requests={items} onOpenProject={() => onOpenProject(project)} onOpenRequest={onOpenRequest} showPreview />)}</div>
            : !projectsError && <CxPanel><CxEmpty title="No projects yet" body="No projects have been shared with your account yet. When your project manager shares one, it will appear here." /></CxPanel>}
      </CxSection>

      <CxSection titleId="client-recent-title" title={latest ? 'Latest from your project manager' : 'Latest updates'}
        action={<button type="button" className="cx-link" onClick={onGoToRequests}>All requests <ArrowRight size={14} aria-hidden="true" /></button>}>
        <LatestUpdates loading={!requests && requestsLoading} loaded={Boolean(requests)} recent={recent} latest={latest}
          onOpenProject={onOpenProject} onOpenRequest={onOpenRequest} />
      </CxSection>
    </div>

    {onProposeProject && <CxPanel className="cx-idea">
      <div><strong>Have a new idea?</strong><p>Tell your project manager what you’d like to build next.</p></div>
      <button type="button" className="cx-button" onClick={onProposeProject}><Plus size={15} aria-hidden="true" />Propose a project</button>
    </CxPanel>}
  </section>;
}

/** Home's right column: the project manager's latest project-chat message, then recently updated requests. */
function LatestUpdates({ loading, loaded, recent, latest, onOpenProject, onOpenRequest }: {
  loading: boolean; loaded: boolean; recent: ClientProjectRequestItem[];
  latest: { project: ClientProject; message: ClientProjectFeedbackMessage } | null;
  onOpenProject: (project: ClientProject) => void; onOpenRequest: (request: ClientProjectRequestItem) => void;
}) {
  if (loading) return <CxPanel><LoadingRows label="Loading recent request updates" layout="table" rows={4} className="p-4" /></CxPanel>;
  if (!loaded) return null;
  if (!recent.length && !latest) return <CxPanel><CxEmpty title="No updates yet" body="Your project manager will share requests here." /></CxPanel>;
  return <CxPanel>
    {latest && <CxQuote body={latest.message.body}
      meta={<>Project chat · {latest.project.name} · <time dateTime={latest.message.createdAt} title={time(latest.message.createdAt)}>{relativeTime(latest.message.createdAt)}</time></>}
      action={<button type="button" className="cx-link" onClick={() => onOpenProject(latest.project)}>Reply in the project chat <ArrowRight size={14} aria-hidden="true" /></button>} />}
    {recent.map(item => <UpdateRow key={requestKey(item)} item={item} onOpen={onOpenRequest} />)}
  </CxPanel>;
}

/** One project with each open request and where it is on the five steps. */
export function ClientProjectSpotlight({ project, requests, onOpenProject, onOpenRequest, showPreview = false }: {
  project: ClientProject;
  requests: ClientProjectRequestItem[];
  onOpenProject: () => void;
  onOpenRequest: (request: ClientProjectRequestItem) => void;
  /** Show a small picture of the shared preview under the header, when there is one. */
  showPreview?: boolean;
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
    {showPreview && project.preview && <div className="cx-project-thumb"><ClientPreviewThumb preview={project.preview} projectName={project.name} /></div>}
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
  const [requestFilter, setRequestFilter] = useState<ProjectRequestFilter>('all');
  useEffect(() => { setRequestFilter('all'); }, [selectedProjectKey, projectFocusVersion]);
  const sortedProjects = [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const latestByProject = useLatestManagerMessages(api, selectedProject ? [] : sortedProjects, refreshToken);

  if (selectedProject) {
    const projectRequests = requests.filter(item => item.workspaceId === selectedProject.workspaceId && item.projectId === selectedProject.projectId);
    const attention = projectRequests.filter(item => clientRequestGroup(item) === 'needs_you');
    const open = projectRequests.filter(item => clientRequestGroup(item) !== 'done').length;
    const titleId = idPrefix + '-project-title';
    return <section className="cx-page" aria-labelledby={titleId}>
      <CxPageHeader titleId={titleId} title={selectedProject.name} back={{ label: 'Projects', onClick: () => onSelectedProjectKeyChange(null) }}
        description={'Updated ' + relativeTime(selectedProject.updatedAt) + ' · ' + open + ' open ' + (open === 1 ? 'request' : 'requests')}
        actions={<>
          {selectedProject.preview && <a className="cx-button" href={selectedProject.preview.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} aria-hidden="true" />Open preview</a>}
          {newRequestEnabled && <button type="button" className="cx-button is-primary" disabled={newRequestLoading} onClick={() => onNewRequest(selectedProject)}>
            <Plus size={15} aria-hidden="true" />{newRequestLoading ? 'Checking access…' : 'New request'}</button>}
        </>} />
      {attention.length > 0 && <CxPanel tone="attention">{attention.map(item => {
        const step = clientNextStep(item.requestedAction);
        return <CxRow key={requestKey(item)} title={item.title} meta={step?.prompt} onClick={() => onOpenRequest(item)}
          trailing={<span className="cx-button is-primary">{step?.action ?? 'Open request'}</span>} />;
      })}</CxPanel>}
      <div className="cx-project-layout">
        <div className="cx-project-main">
          <ProjectRequestsTab api={api} project={selectedProject} refreshToken={refreshToken} filter={requestFilter}
            onFilterChange={setRequestFilter} onOpenRequest={onOpenRequest} newRequest={null} idPrefix={idPrefix} />
          {selectedProject.preview && <CxSection titleId={idPrefix + '-project-preview'} title="Preview">
            <div className="cx-preview-frame"><QaPreview audience="client"
              preview={{ branch: selectedProject.preview.branch, url: selectedProject.preview.url, embeddable: true, reason: null }} /></div>
          </CxSection>}
        </div>
        <ProjectChat key={clientProjectKey(selectedProject)} api={api} project={selectedProject} inspectionOnly={inspectionOnly}
          refreshToken={refreshToken} idPrefix={idPrefix} />
      </div>
    </section>;
  }

  return <section className="cx-page" aria-labelledby={idPrefix + '-projects-page-title'}>
    <CxPageHeader titleId={idPrefix + '-projects-page-title'} title="Your projects" description="Everything your project manager has shared with you." />
    {proposalsNeedingReply > 0 && onOpenProposals && <CxPanel tone="attention"><div className="cx-row" role="status">
      <Lightbulb size={16} aria-hidden="true" />
      <span className="cx-row-copy"><strong>Your project manager is waiting on your reply to {proposalsNeedingReply === 1 ? 'a project idea' : proposalsNeedingReply + ' project ideas'}.</strong></span>
      <button type="button" className="cx-link" onClick={onOpenProposals}>Open project ideas <ArrowRight size={14} aria-hidden="true" /></button>
    </div></CxPanel>}
    {error && <p role="alert" className="cx-error">{error}</p>}
    <section aria-label="Shared projects">
      {loading && <CxPanel><LoadingRows label="Loading your projects" className="p-4" /></CxPanel>}
      {!loading && projects.length > 0 && <div className="cx-project-stack">
        {sortedProjects.map(project => <ClientProjectOverviewCard key={clientProjectKey(project)} project={project} requests={requests}
          latest={latestByProject[clientProjectKey(project)] ?? null} onOpenRequest={onOpenRequest}
          onOpenProject={() => onSelectedProjectKeyChange(clientProjectKey(project))} />)}
      </div>}
      {!loading && !projects.length && !error && <CxPanel><CxEmpty icon={<FolderKanban size={22} />} title="No projects shared yet"
        body="When your project manager gives your account access to a project, it will appear here." /></CxPanel>}
    </section>
    {!inspectionOnly && onProposeProject && <CxPanel className="cx-idea">
      <div><strong>Have something new in mind?</strong><p>Send your project manager an idea. They review it with you before anything is set up.</p></div>
      <button type="button" className="cx-button" onClick={onProposeProject}><Lightbulb size={15} aria-hidden="true" />Propose a project</button>
    </CxPanel>}
  </section>;
}

/**
 * A project on the Projects page: its shared preview, counts, its requests with where each one is,
 * and the project manager's latest note in the project chat.
 */
function ClientProjectOverviewCard({ project, requests, latest, onOpenProject, onOpenRequest }: {
  project: ClientProject;
  requests: ClientProjectRequestItem[];
  latest: ClientProjectFeedbackMessage | null;
  onOpenProject: () => void;
  onOpenRequest: (request: ClientProjectRequestItem) => void;
}) {
  const order = { needs_you: 0, in_progress: 1, done: 2 } as const;
  const mine = requests.filter(item => item.workspaceId === project.workspaceId && item.projectId === project.projectId)
    .sort((a, b) => order[clientRequestGroup(a)] - order[clientRequestGroup(b)] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const needsYou = mine.filter(item => clientRequestGroup(item) === 'needs_you').length;
  const open = mine.filter(item => clientRequestGroup(item) !== 'done').length;
  const shown = mine.slice(0, 4);
  const titleId = 'client-project-card-' + project.projectId;
  return <article className="cx-panel cx-project-wide" aria-labelledby={titleId}>
    <ClientPreviewThumb preview={project.preview} projectName={project.name} />
    <div className="cx-project-wide-body">
      <header className="cx-project-wide-head">
        <h3 id={titleId}>{project.name}</h3>
        {needsYou > 0 && <CxBadge tone="attention">{needsYou} {needsYou === 1 ? 'needs' : 'need'} you</CxBadge>}
        <button type="button" className="cx-link" onClick={onOpenProject} aria-label={'View project ' + project.name}>View project <ArrowRight size={14} aria-hidden="true" /></button>
      </header>
      <p className="cx-project-wide-meta">Updated {relativeTime(project.updatedAt)} · {project.preview ? 'preview shared' : 'no preview yet'}</p>
      <CxStats label={'Requests in ' + project.name} items={[
        { label: 'Needs you', value: needsYou, tone: 'attention' },
        { label: 'Open', value: open },
        { label: 'Done', value: mine.length - open, tone: 'done' },
      ]} />
      {shown.length ? <div className="cx-project-wide-requests">
        {shown.map(item => <CxRequestRow key={requestKey(item)} item={item} onOpen={onOpenRequest} compact />)}
        {mine.length > shown.length && <button type="button" className="cx-row is-interactive cx-more" onClick={onOpenProject}>{mine.length - shown.length} more in this project</button>}
      </div> : <p className="cx-project-wide-meta">No requests in this project yet.</p>}
      {latest && <CxQuote body={latest.body}
        meta={<>Latest in the project chat · <time dateTime={latest.createdAt} title={time(latest.createdAt)}>{relativeTime(latest.createdAt)}</time></>} />}
    </div>
  </article>;
}

/** The project manager's latest message in each project's chat, keyed by project. Reads at most six projects. */
function useLatestManagerMessages(api: typeof clientTicketApi, projects: ClientProject[], refreshToken: number) {
  const [latest, setLatest] = useState<Record<string, ClientProjectFeedbackMessage>>({});
  const shown = projects.slice(0, 6);
  const keys = shown.map(clientProjectKey).join('|');
  useEffect(() => {
    if (!keys) { setLatest({}); return; }
    let active = true;
    void Promise.allSettled(shown.map(project => api.getProjectFeedbackMessages(project.workspaceId, project.projectId, { limit: 20 })))
      .then(results => {
        if (!active) return;
        const next: Record<string, ClientProjectFeedbackMessage> = {};
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') return;
          const message = [...result.value.items].reverse().find(item => item.author === 'pm');
          if (message) next[clientProjectKey(shown[index])] = message;
        });
        setLatest(next);
      });
    return () => { active = false; };
  }, [api, keys, refreshToken]);
  return latest;
}

/** The project's own conversation with the project manager, beside its requests. */
function ProjectChat({ api, project, inspectionOnly, refreshToken, idPrefix }: {
  api: typeof clientTicketApi; project: ClientProject; inspectionOnly: boolean; refreshToken: number; idPrefix: string;
}) {
  const [messages, setMessages] = useState<ClientProjectFeedbackMessage[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [moreLoading, setMoreLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const titleId = idPrefix + '-project-chat';

  useEffect(() => {
    let active = true;
    setLoadError('');
    void api.getProjectFeedbackMessages(project.workspaceId, project.projectId, { limit: 50 }).then(page => {
      if (active) { setMessages(page.items); setCursor(page.nextCursor); }
    }).catch(error => { if (active) setLoadError(projectLoadError(error, 'feedback')); });
    return () => { active = false; };
  }, [api, project.workspaceId, project.projectId, reload, refreshToken]);

  async function loadEarlier() {
    if (!cursor || moreLoading) return;
    setMoreLoading(true); setLoadError('');
    try {
      const page = await api.getProjectFeedbackMessages(project.workspaceId, project.projectId, { limit: 50, before: cursor });
      setMessages(current => [...page.items, ...(current ?? [])]); setCursor(page.nextCursor);
    } catch (error) { setLoadError(projectLoadError(error, 'feedback')); }
    finally { setMoreLoading(false); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (inspectionOnly || sending || !body) return;
    setSending(true); setSendError('');
    try {
      await api.sendProjectFeedbackMessage(project.workspaceId, project.projectId, { schemaVersion: 1, operationId: crypto.randomUUID(), body });
      setDraft(''); setReload(value => value + 1);
    } catch (error) { setSendError(projectLoadError(error, 'send')); }
    finally { setSending(false); }
  }

  return <section className="cx-panel cx-chat" aria-labelledby={titleId}>
    <div className="cx-chat-head">
      <div><h2 id={titleId}>Project chat</h2><p>General questions and feedback about this project.</p></div>
      <button type="button" className="cx-icon-button" aria-label="Refresh project chat" onClick={() => setReload(value => value + 1)}><RefreshCw size={15} /></button>
    </div>
    <div className="cx-chat-messages" aria-live="polite">
      {loadError && <p role="alert" className="cx-error">{loadError} <button type="button" onClick={() => setReload(value => value + 1)}>Try again</button></p>}
      {!messages && !loadError ? <LoadingRows label="Loading project chat" layout="conversation" />
        : messages?.length ? <>
          {cursor && <button type="button" className="cx-link" disabled={moreLoading} onClick={() => void loadEarlier()}>{moreLoading ? 'Loading…' : 'Load earlier messages'}</button>}
          {messages.map(message => <FeedbackBubble key={message.id} message={message} />)}
        </> : !loadError && <p className="cx-chat-empty">No messages yet. Send a note if you have a question or feedback.</p>}
    </div>
    <form className="cx-chat-composer" onSubmit={event => void send(event)}>
      <label className="sr-only" htmlFor={idPrefix + '-project-message'}>Message your project manager about this project</label>
      <textarea id={idPrefix + '-project-message'} value={draft} maxLength={4000} rows={2} disabled={inspectionOnly || sending}
        onChange={event => setDraft(event.target.value)} placeholder="Message your project manager…" />
      <button type="submit" className="cx-button is-primary" aria-label="Send message" disabled={inspectionOnly || sending || !draft.trim()}>
        <Send size={14} aria-hidden="true" />{sending ? 'Sending…' : 'Send'}</button>
    </form>
    {sendError && <p role="alert" className="cx-error cx-chat-send-error">{sendError}</p>}
    <p className="cx-chat-note">Only you and your project manager can see this chat.</p>
  </section>;
}

function FeedbackBubble({ message }: { message: ClientProjectFeedbackMessage }) {
  const own = message.author === 'client';
  return <article className={'cx-message' + (own ? ' is-mine' : '')}>
    <span>{own ? 'You' : 'Project manager'} · <time dateTime={message.createdAt}>{time(message.createdAt)}</time></span><p>{message.body}</p>
  </article>;
}

function requestKey(item: ClientProjectRequestItem): string { return `${item.workspaceId}\u0000${item.id}`; }
