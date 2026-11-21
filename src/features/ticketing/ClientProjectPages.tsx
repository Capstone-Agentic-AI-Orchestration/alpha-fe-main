import { LoadingRows } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BellRing, Check, ClipboardCheck, FolderKanban, Lightbulb, MessageSquare, Monitor, Plus, Sparkles } from 'lucide-react';

import type { ClientProject, ClientProjectFeedbackMessage, ClientProjectRequestItem, ClientProjectRequestQueue } from './clientApi';
import { clientTicketApi } from './clientApi';
import { CxActionCard, CxBadge, CxEmpty, CxHero, CxPageHeader, CxPanel, CxQuote, CxRing, CxRow, CxSection, CxStats } from './clientKit';
import { ClientPreviewThumb } from './ClientPreviewThumb';
import { clientTicketProgress } from './clientTicketProgress';
import { clientGreeting, clientNextStep, clientRequestGroup, listProgressIndex, projectProgress, relativeTime } from './clientFriendly';
import { time } from './ticketUi';
import { clientProjectKey } from './ClientProjectSections';

export { clientProjectKey } from './ClientProjectSections';

export function ClientOverviewPage({ clientName, requests, projects, requestsLoading, requestsError, projectsLoading, projectsError,
  onOpenRequest, onOpenProject, onOpenPreview, onGoToProjects, onGoToRequests, onProposeProject, proposalsNeedingReply = 0, onOpenProposals,
  api = clientTicketApi, refreshToken = 0 }: {
  /** Opens a project's page on its shared preview. */
  onOpenPreview?: (project: ClientProject) => void;
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
  const recent = [...items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6);
  const firstName = clientName?.trim().split(/\s+/)[0] ?? '';
  const shownProjects = [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 4);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const latestByProject = useLatestManagerMessages(api, shownProjects, refreshToken);
  const replyIdeas = onOpenProposals ? proposalsNeedingReply : 0;
  return <section className="cx-page" aria-labelledby="client-overview-title">
    <HomeHero greeting={clientGreeting() + (firstName ? ', ' + firstName : '')} today={today} requests={requests ? items : null}
      waiting={attention.length + (replyIdeas > 0 ? 1 : 0)} project={shownProjects[0] ?? null} />

    <section className="cx-section" aria-labelledby="client-attention-title" aria-busy={requestsLoading && !requests}>
      {requestsError && <p role="alert" className="cx-error">{requestsError}</p>}
      <NeedsYou loading={!requests && requestsLoading} loaded={Boolean(requests)} attention={attention} onOpenRequest={onOpenRequest}
        proposalsNeedingReply={replyIdeas} onOpenProposals={onOpenProposals} />
    </section>

    <CxSection titleId="client-projects-title" title={shownProjects.length === 1 ? 'Your project' : 'Your projects'}
      action={projects.length > shownProjects.length ? <Button type="button" variant="ghost" size="sm" className="cx-link h-auto px-0" onClick={onGoToProjects}>All projects <ArrowRight size={14} aria-hidden="true" /></Button> : undefined}>
      {projectsError && <p role="alert" className="cx-error">{projectsError}</p>}
      <HomeProjects loading={projectsLoading && !projects.length} failed={Boolean(projectsError)} projects={shownProjects} requests={items}
        latestByProject={latestByProject} onOpenProject={onOpenProject} onOpenPreview={onOpenPreview} />
    </CxSection>

    <CxSection titleId="client-recent-title" title="Latest updates"
      action={<Button type="button" variant="ghost" size="sm" className="cx-link h-auto px-0" onClick={onGoToRequests}>All requests <ArrowRight size={14} aria-hidden="true" /></Button>}>
      <LatestUpdates loading={!requests && requestsLoading} loaded={Boolean(requests)} recent={recent} onOpenRequest={onOpenRequest} />
    </CxSection>

    {onProposeProject && <CxPanel className="cx-idea">
      <div><strong>Have a new idea?</strong><p>Tell your project manager what you’d like to build next.</p></div>
      <Button type="button" variant="outline" onClick={onProposeProject}><Plus size={15} aria-hidden="true" />Propose a project</Button>
    </CxPanel>}
  </section>;
}

/** Home's opening band: the greeting, one line on where things stand, and how far the main project is along. */
function HomeHero({ greeting, today, requests, waiting, project }: {
  greeting: string; today: string; requests: ClientProjectRequestItem[] | null; waiting: number; project: ClientProject | null;
}) {
  const inProgress = requests?.filter(item => clientRequestGroup(item) === 'in_progress').length ?? 0;
  const done = requests?.filter(item => clientRequestGroup(item) === 'done').length ?? 0;
  const projectRequests = project && requests
    ? requests.filter(item => item.workspaceId === project.workspaceId && item.projectId === project.projectId) : [];
  const progress = project ? projectProgress(projectRequests) : null;
  const rest = inProgress + ' in progress · ' + done + ' done';
  let lead: ReactNode = null;
  if (requests) lead = waiting
    ? <><b>{waiting} {waiting === 1 ? 'thing needs' : 'things need'} you</b> · {rest}</>
    : <>Nothing needs you right now · {rest}</>;
  return <CxHero>
    <div className="cx-hero-row">
      <div className="cx-hero-copy">
        <p className="cx-eyebrow">{today}</p>
        <h1 id="client-overview-title">{greeting}</h1>
        {lead && <p className="cx-hero-lead">{lead}</p>}
      </div>
      {project && progress !== null && <div className="cx-hero-meter">
        <CxRing value={progress} label={project.name + ': requests are ' + progress + '% of the way along, on average'} />
        <div><strong>{project.name}</strong><span>Requests are {progress}% of the way along, on average</span></div>
      </div>}
    </div>
  </CxHero>;
}

const ACTION_ICONS = { reply: MessageSquare, agree_scope: ClipboardCheck, review_result: Sparkles } as const;

/** Home's "needs you" cards: requests waiting on the client, and project ideas with a question. */
function NeedsYou({ loading, loaded, attention, proposalsNeedingReply, onOpenProposals, onOpenRequest }: {
  loading: boolean; loaded: boolean; attention: ClientProjectRequestItem[]; proposalsNeedingReply: number;
  onOpenProposals?: () => void; onOpenRequest: (request: ClientProjectRequestItem) => void;
}) {
  if (loading) return <CxPanel><LoadingRows label="Loading requests needing attention" layout="detail" rows={1} className="w-full p-4" /></CxPanel>;
  if (!loaded) return null;
  if (!attention.length && proposalsNeedingReply <= 0) return <CxPanel><div className="cx-caught-up"><Check size={18} aria-hidden="true" /><div><h2 id="client-attention-title">You’re all caught up</h2>
    <p>Your project manager is on it. We’ll let you know here when something needs you.</p></div></div></CxPanel>;
  return <>
    <div className="cx-section-head"><h2 id="client-attention-title"><BellRing size={16} aria-hidden="true" className="cx-attention-icon" />Waiting on you</h2></div>
    <div className="cx-action-grid">
      {attention.map(item => {
        const step = clientNextStep(item.requestedAction);
        const Icon = item.requestedAction ? ACTION_ICONS[item.requestedAction] : MessageSquare;
        return <CxActionCard key={requestKey(item)} icon={<Icon size={20} />} title={item.title}
          meta={(step?.prompt ?? 'Your project manager needs you') + (item.projectName ? ' · ' + item.projectName : '')}
          index={listProgressIndex(item)} action={step?.action ?? 'Open request'} onClick={() => onOpenRequest(item)} />;
      })}
      {proposalsNeedingReply > 0 && onOpenProposals && <CxActionCard icon={<Lightbulb size={20} />}
        title={proposalsNeedingReply === 1 ? 'Your project idea' : proposalsNeedingReply + ' project ideas'} meta="Your project manager has a question"
        action="Reply" onClick={onOpenProposals} />}
    </div>
  </>;
}

/** Home's project covers, or a loading or empty state. */
function HomeProjects({ loading, failed, projects, requests, latestByProject, onOpenProject, onOpenPreview }: {
  loading: boolean; failed: boolean; projects: ClientProject[]; requests: ClientProjectRequestItem[];
  latestByProject: Record<string, ClientProjectFeedbackMessage>;
  onOpenProject: (project: ClientProject) => void; onOpenPreview?: (project: ClientProject) => void;
}) {
  if (loading) return <CxPanel><LoadingRows label="Loading shared projects" rows={2} className="p-4" /></CxPanel>;
  if (!projects.length) return failed ? null : <CxPanel><CxEmpty title="No projects yet" body="No projects have been shared with your account yet. When your project manager shares one, it will appear here." /></CxPanel>;
  return <div className="cx-project-list">{projects.map(project => <ClientProjectSpotlight key={clientProjectKey(project)}
    project={project} requests={requests} latest={latestByProject[clientProjectKey(project)] ?? null}
    onOpenProject={() => onOpenProject(project)} onOpenPreview={onOpenPreview ? () => onOpenPreview(project) : undefined} />)}</div>;
}

/** Home's recently updated requests. */
function LatestUpdates({ loading, loaded, recent, onOpenRequest }: {
  loading: boolean; loaded: boolean; recent: ClientProjectRequestItem[]; onOpenRequest: (request: ClientProjectRequestItem) => void;
}) {
  if (loading) return <CxPanel><LoadingRows label="Loading recent request updates" layout="table" rows={4} className="p-4" /></CxPanel>;
  if (!loaded) return null;
  if (!recent.length) return <CxPanel><CxEmpty title="No updates yet" body="Your project manager will share requests here." /></CxPanel>;
  return <CxPanel>{recent.map(item => <UpdateRow key={requestKey(item)} item={item} onOpen={onOpenRequest} />)}</CxPanel>;
}

/**
 * A project's cover on Home: a picture of the shared preview beside its counts and the project
 * manager's latest note. Its requests live on the project's page, so the cover keeps one size
 * however many requests the project has.
 */
export function ClientProjectSpotlight({ project, requests, onOpenProject, onOpenPreview, latest = null }: {
  project: ClientProject;
  requests: ClientProjectRequestItem[];
  onOpenProject: () => void;
  /** Opens the project's page on its shared preview. */
  onOpenPreview?: () => void;
  latest?: ClientProjectFeedbackMessage | null;
}) {
  const mine = requests.filter(item => item.workspaceId === project.workspaceId && item.projectId === project.projectId);
  const open = mine.filter(item => clientRequestGroup(item) !== 'done');
  const needsYou = open.filter(item => clientRequestGroup(item) === 'needs_you').length;
  return <Card role="article" className="cx-panel cx-cover">
    <div className={`cx-cover-top${project.preview ? '' : ' is-no-preview'}`}>
      {project.preview && <div className="cx-cover-shot"><ClientPreviewThumb preview={project.preview} projectName={project.name} onOpen={onOpenPreview} /></div>}
      <div className="cx-cover-body">
        <header className="cx-cover-head">
          <h3>{project.name}</h3>
          <ProjectLinks project={project} onOpenProject={onOpenProject} onOpenPreview={onOpenPreview} />
        </header>
        <p className="cx-cover-meta">{openCount(open.length)} · updated {relativeTime(project.updatedAt)} · {project.preview ? 'preview ready' : 'no preview yet'}</p>
        <CxStats label={'Requests in ' + project.name} items={[
          { label: 'Needs you', value: needsYou, tone: 'attention' },
          { label: 'Open', value: open.length },
          { label: 'Done', value: mine.length - open.length, tone: 'done' },
        ]} />
        {latest && <CxQuote body={latest.body}
          meta={<>Project conversation · <time dateTime={latest.createdAt} title={time(latest.createdAt)}>{relativeTime(latest.createdAt)}</time></>} />}
      </div>
    </div>
  </Card>;
}

/** A project card's two ways in: straight to its shared preview (once there is one), or to its conversation. */
function ProjectLinks({ project, onOpenProject, onOpenPreview }: { project: ClientProject; onOpenProject: () => void; onOpenPreview?: () => void }) {
  return <div className="cx-card-links">
    {project.preview && onOpenPreview && <Button type="button" variant="ghost" size="sm" className="cx-link h-auto px-0" onClick={onOpenPreview}
      aria-label={'Open preview for ' + project.name}><Monitor size={14} aria-hidden="true" />Open preview</Button>}
    <Button type="button" variant="ghost" size="sm" className="cx-link h-auto px-0" onClick={onOpenProject}
      aria-label={'Open conversation for ' + project.name}>Open conversation <ArrowRight size={14} aria-hidden="true" /></Button>
  </div>;
}

function openCount(count: number): string {
  if (!count) return 'No open requests';
  return count + ' open ' + (count === 1 ? 'request' : 'requests');
}

function UpdateRow({ item, onOpen }: { item: ClientProjectRequestItem; onOpen: (item: ClientProjectRequestItem) => void }) {
  const pending = item.projectLinkStatus === 'pending_review';
  const sentence = pending
    ? 'Your project manager is confirming the project' + (item.requestedProjectName ? ' for ' + item.requestedProjectName : '')
    : clientTicketProgress(item.status, item.requestedAction).label;
  return <CxRow title={item.title} onClick={() => onOpen(item)} meta={<>{sentence} · <time dateTime={item.updatedAt} title={time(item.updatedAt)}>{relativeTime(item.updatedAt)}</time></>}
    trailing={<span className={'cx-dot is-' + clientRequestGroup(item)} aria-hidden="true" />} />;
}

export function ClientProjectsPage({ api = clientTicketApi, projects, loading, error, onOpenConversation, onOpenPreview, inspectionOnly, refreshToken,
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
  /** Opens the project's page: its conversation, requests and details. */
  onOpenConversation: (project: ClientProject) => void;
  /** Opens the project's page on its shared preview. */
  onOpenPreview: (project: ClientProject) => void;
  inspectionOnly: boolean;
  refreshToken: number;
}) {
  const sortedProjects = [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const latestByProject = useLatestManagerMessages(api, sortedProjects, refreshToken);
  return <section className="cx-page" aria-labelledby={idPrefix + '-projects-page-title'}>
    <CxPageHeader titleId={idPrefix + '-projects-page-title'} title="Your projects" description="Everything your project manager has shared with you." />
    {proposalsNeedingReply > 0 && onOpenProposals && <CxPanel tone="attention"><div className="cx-row" role="status">
      <Lightbulb size={16} aria-hidden="true" />
      <span className="cx-row-copy"><strong>Your project manager is waiting on your reply to {proposalsNeedingReply === 1 ? 'a project idea' : proposalsNeedingReply + ' project ideas'}.</strong></span>
      <Button type="button" variant="ghost" size="sm" className="cx-link h-auto px-0" onClick={onOpenProposals}>Open project ideas <ArrowRight size={14} aria-hidden="true" /></Button>
    </div></CxPanel>}
    {error && <p role="alert" className="cx-error">{error}</p>}
    <section aria-label="Shared projects">
      {loading && <CxPanel><LoadingRows label="Loading your projects" className="p-4" /></CxPanel>}
      {!loading && projects.length > 0 && <div className="cx-project-stack">
        {sortedProjects.map(project => <ClientProjectOverviewCard key={clientProjectKey(project)} project={project} requests={requests}
          latest={latestByProject[clientProjectKey(project)] ?? null}
          onOpenProject={() => onOpenConversation(project)} onOpenPreview={() => onOpenPreview(project)} />)}
      </div>}
      {!loading && !projects.length && !error && <CxPanel><CxEmpty icon={<FolderKanban size={22} />} title="No projects shared yet"
        body="When your project manager gives your account access to a project, it will appear here." /></CxPanel>}
    </section>
    {!inspectionOnly && onProposeProject && <CxPanel className="cx-idea">
      <div><strong>Have something new in mind?</strong><p>Send your project manager an idea. They review it with you before anything is set up.</p></div>
      <Button type="button" variant="outline" onClick={onProposeProject}><Lightbulb size={15} aria-hidden="true" />Propose a project</Button>
    </CxPanel>}
  </section>;
}

/**
 * A project on the Projects page: its shared preview, its counts and the project manager's latest
 * note. Its requests live on the project's page, so every card keeps the same size.
 */
function ClientProjectOverviewCard({ project, requests, latest, onOpenProject, onOpenPreview }: {
  project: ClientProject;
  requests: ClientProjectRequestItem[];
  latest: ClientProjectFeedbackMessage | null;
  onOpenProject: () => void;
  onOpenPreview: () => void;
}) {
  const mine = requests.filter(item => item.workspaceId === project.workspaceId && item.projectId === project.projectId);
  const needsYou = mine.filter(item => clientRequestGroup(item) === 'needs_you').length;
  const open = mine.filter(item => clientRequestGroup(item) !== 'done').length;
  const titleId = 'client-project-card-' + project.projectId;
  return <Card role="article" className={`cx-panel cx-project-wide${project.preview ? '' : ' is-no-preview'}`} aria-labelledby={titleId}>
    {project.preview && <ClientPreviewThumb preview={project.preview} projectName={project.name} onOpen={onOpenPreview} />}
    <div className="cx-project-wide-body">
      <header className="cx-project-wide-head">
        <h3 id={titleId}>{project.name}</h3>
        {needsYou > 0 && <CxBadge tone="attention">{needsYou} {needsYou === 1 ? 'needs' : 'need'} you</CxBadge>}
        <ProjectLinks project={project} onOpenProject={onOpenProject} onOpenPreview={onOpenPreview} />
      </header>
      <p className="cx-project-wide-meta">Updated {relativeTime(project.updatedAt)} · {project.preview ? 'preview shared' : 'no preview yet'}</p>
      <CxStats label={'Requests in ' + project.name} items={[
        { label: 'Needs you', value: needsYou, tone: 'attention' },
        { label: 'Open', value: open },
        { label: 'Done', value: mine.length - open, tone: 'done' },
      ]} />
      {latest && <CxQuote body={latest.body}
        meta={<>Latest in the project conversation · <time dateTime={latest.createdAt} title={time(latest.createdAt)}>{relativeTime(latest.createdAt)}</time></>} />}
    </div>
  </Card>;
}

/** The project manager's latest conversation message, keyed by project. Reads at most six projects. */
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

function requestKey(item: ClientProjectRequestItem): string { return `${item.workspaceId}\u0000${item.id}`; }
