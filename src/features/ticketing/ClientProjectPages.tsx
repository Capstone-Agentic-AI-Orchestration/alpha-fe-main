import { LoadingRows } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BellRing, ClipboardCheck, Clock, FolderKanban, Lightbulb, MessageSquare, Monitor, Plus, Search, Sparkles } from 'lucide-react';

import type { ClientProject, ClientProjectFeedbackMessage, ClientProjectRequestItem, ClientProjectRequestQueue } from './clientApi';
import { clientTicketApi } from './clientApi';
import { CxActionCard, CxBadge, CxEmpty, CxOrbit, CxPageHeader, CxPanel, CxStats } from './clientKit';
import { ClientPreviewThumb } from './ClientPreviewThumb';
import { ClientProjectShowcase } from './ClientProjectShowcase';
import { clientGreeting, clientNextStep, clientRequestGroup, listProgressIndex, relativeTime } from './clientFriendly';
import { time } from './ticketUi';
import { clientProjectKey } from './ClientProjectSections';

export { clientProjectKey } from './ClientProjectSections';

export function ClientOverviewPage({ clientName, requests, projects, requestsLoading, requestsError, projectsLoading, projectsError,
  onOpenRequest, onOpenProject, onOpenPreview, onGoToProjects, onGoToRequests, onProposeProject, proposalsNeedingReply = 0, onOpenProposals,
  newRequestAction, api = clientTicketApi, refreshToken = 0 }: {
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
  /** Fallback proposal action when request creation is unavailable. */
  onProposeProject?: () => void;
  /** The existing request menu, moved into the page body from the global top bar. */
  newRequestAction?: ReactNode;
  /** Project ideas where the project manager is waiting on the client's reply. */
  proposalsNeedingReply?: number;
  onOpenProposals?: () => void;
}) {
  const items = requests?.items ?? [];
  const attention = items.filter(item => clientRequestGroup(item) === 'needs_you');
  const firstName = clientName?.trim().split(/\s+/)[0] ?? '';
  const shownProjects = [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 4);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const selectedProject = shownProjects.find(project => clientProjectKey(project) === selectedProjectKey) ?? shownProjects[0] ?? null;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const latestByProject = useLatestManagerMessages(api, shownProjects, refreshToken);
  const replyIdeas = onOpenProposals ? proposalsNeedingReply : 0;
  return <section className="cx-page cx-overview" aria-labelledby="client-overview-title">
    <HomeHero greeting={clientGreeting()} firstName={firstName} today={today}
      requestAction={newRequestAction} onProposeProject={!newRequestAction ? onProposeProject : undefined} />

    {(requestsError || projectsError) && <div className="cx-overview-alerts">
      {requestsError && <p role="alert" className="cx-error">{requestsError}</p>}
      {projectsError && <p role="alert" className="cx-error">{projectsError}</p>}
    </div>}

    {(requestsLoading && !requests || attention.length > 0 || replyIdeas > 0) && <section className="cx-section"
      aria-labelledby="client-attention-title" aria-busy={requestsLoading && !requests}>
      <NeedsYou loading={!requests && requestsLoading} loaded={Boolean(requests)} attention={attention} onOpenRequest={onOpenRequest}
        proposalsNeedingReply={replyIdeas} onOpenProposals={onOpenProposals} />
    </section>}

    <section className="cx-showcase-section" aria-labelledby="client-projects-title">
      <header className="cx-showcase-section-head">
        <div><h2 id="client-projects-title">Your projects</h2><p>Choose a project to see its latest updates.</p></div>
        {projects.length > shownProjects.length && <Button type="button" variant="ghost" size="sm" className="cx-link" onClick={onGoToProjects}>
          All projects <ArrowRight size={14} aria-hidden="true" /></Button>}
      </header>
      <ClientProjectShowcase project={selectedProject} projects={shownProjects} requests={items}
        latestMessage={selectedProject ? latestByProject[clientProjectKey(selectedProject)] ?? null : null}
        projectsLoading={projectsLoading && !projects.length} requestsLoading={!requests && requestsLoading}
        onSelectProject={project => setSelectedProjectKey(clientProjectKey(project))}
        onOpenRequest={onOpenRequest} onOpenProject={onOpenProject}
        onOpenPreview={onOpenPreview ?? onOpenProject} onGoToRequests={onGoToRequests} />
    </section>
  </section>;
}

/**
 * Home's opening band: the greeting with the client's name in the accent colour, the one main
 * action (proposing a project) and one line on where things stand.
 */
function HomeHero({ greeting, firstName, today, requestAction, onProposeProject }: {
  greeting: string; firstName: string; today: string; requestAction?: ReactNode; onProposeProject?: () => void;
}) {
  return <header className="cx-home-hero">
    <div className="cx-home-hero-copy">
      <p className="cx-eyebrow">{today}</p>
      <h1 id="client-overview-title">{greeting}{firstName && <>, <span className="cx-accent-word">{firstName}</span></>}</h1>
      <p className="cx-home-hero-description">Build, explore, and collaborate with Alphaexplora.</p>
    </div>
    {(requestAction || onProposeProject) && <div className="cx-home-hero-actions">
      {requestAction ?? <Button type="button" onClick={onProposeProject}><Plus size={15} aria-hidden="true" />Propose a project</Button>}
    </div>}
  </header>;
}

const ACTION_ICONS = { reply: MessageSquare, agree_scope: ClipboardCheck, review_result: Sparkles } as const;

/** Home's "needs you" cards: requests waiting on the client, and project ideas with a question. */
function NeedsYou({ loading, loaded, attention, proposalsNeedingReply, onOpenProposals, onOpenRequest }: {
  loading: boolean; loaded: boolean; attention: ClientProjectRequestItem[]; proposalsNeedingReply: number;
  onOpenProposals?: () => void; onOpenRequest: (request: ClientProjectRequestItem) => void;
}) {
  if (loading) return <CxPanel><LoadingRows label="Loading requests needing attention" layout="detail" rows={1} className="w-full p-4" /></CxPanel>;
  if (!loaded) return null;
  if (!attention.length && proposalsNeedingReply <= 0) return null;
  return <>
    <div className="cx-section-head"><h2 id="client-attention-title"><BellRing size={16} aria-hidden="true" className="cx-attention-icon" />Waiting on you</h2></div>
    <div className="cx-action-grid">
      {attention.map(item => {
        const step = clientNextStep(item.requestedAction);
        const Icon = item.requestedAction ? ACTION_ICONS[item.requestedAction] : MessageSquare;
        return <CxActionCard key={requestKey(item)} icon={<Icon size={20} />} title={item.title}
          meta={(step?.prompt ?? 'The project manager needs you') + (item.projectName ? ' · ' + item.projectName : '')}
          index={listProgressIndex(item)} action={step?.action ?? 'Open request'} onClick={() => onOpenRequest(item)} />;
      })}
      {proposalsNeedingReply > 0 && onOpenProposals && <CxActionCard icon={<Lightbulb size={20} />}
        title={proposalsNeedingReply === 1 ? 'Your project idea' : proposalsNeedingReply + ' project ideas'} meta="The project manager has a question"
        action="Reply" onClick={onOpenProposals} />}
    </div>
  </>;
}

/** A project card on the Projects page, with a real shared preview when one exists. */
function ClientProjectCard({ project, requests, onOpenProject, onOpenPreview, latest }: {
  project: ClientProject;
  requests: ClientProjectRequestItem[];
  onOpenProject: () => void;
  /** Opens the project's preview page (which says so when nothing is shared yet). */
  onOpenPreview?: () => void;
  latest: ClientProjectFeedbackMessage | null;
}) {
  const mine = requests.filter(item => item.workspaceId === project.workspaceId && item.projectId === project.projectId);
  const open = mine.filter(item => clientRequestGroup(item) !== 'done');
  const needsYou = open.filter(item => clientRequestGroup(item) === 'needs_you').length;
  const titleId = 'client-project-card-' + clientProjectKey(project).replace(/\W/g, '-');
  return <article className="cx-pcard" aria-labelledby={titleId}>
    <div className="cx-pcard-picture">
      {project.preview ? <ClientPreviewThumb preview={project.preview} projectName={project.name} onOpen={onOpenPreview} />
        : <div className="cx-pcard-no-preview" role="status">There is still no preview.</div>}
    </div>
    <div className="cx-pcard-body">
      <header className="cx-pcard-head">
        <h3 id={titleId}>{project.name}</h3>
        {needsYou > 0 && <CxBadge tone="attention">{needsYou} {needsYou === 1 ? 'needs' : 'need'} you</CxBadge>}
        {project.stage && project.stage.stage !== 'unset' && <CxBadge tone={project.stage.waitingOn === 'client' ? 'attention'
          : project.stage.stage === 'completed' ? 'done' : 'active'}>{project.stage.label}</CxBadge>}
      </header>
      <p className="cx-pcard-meta"><Clock size={14} aria-hidden="true" />
        <span>Updated <time dateTime={project.updatedAt} title={time(project.updatedAt)}>{relativeTime(project.updatedAt)}</time></span></p>
      <p className={'cx-showcase-preview-status' + (project.preview ? ' is-shared' : ' is-unshared')}>
        <span aria-hidden="true" />Preview status: {project.preview ? 'Shared · UAT' : 'Not shared yet'}
      </p>
      {latest && <div className="cx-pcard-note">
        <p>{latest.body}</p>
        <small>The project manager · <time dateTime={latest.createdAt} title={time(latest.createdAt)}>{relativeTime(latest.createdAt)}</time></small>
      </div>}
      <footer className="cx-pcard-foot">
        <CxStats label={'Requests in ' + project.name} items={[
          { label: 'Open', value: open.length },
          { label: 'Done', value: mine.length - open.length, tone: 'done' },
        ]} />
        <ProjectLinks project={project} onOpenProject={onOpenProject} onOpenPreview={onOpenPreview} />
      </footer>
    </div>
  </article>;
}

/**
 * A project card's two ways in: straight to its preview page, or to the project (its conversation,
 * requests and details). The preview page opens even before anything is shared; it then says so.
 */
function ProjectLinks({ project, onOpenProject, onOpenPreview }: { project: ClientProject; onOpenProject: () => void; onOpenPreview?: () => void }) {
  return <div className="cx-card-links">
    {onOpenPreview && <Button type="button" variant="ghost" size="sm" className="cx-link h-auto px-0" onClick={onOpenPreview}
      aria-label={'Open preview for ' + project.name}><Monitor size={14} aria-hidden="true" />Open preview</Button>}
    <button type="button" className="cx-button" onClick={onOpenProject}
      aria-label={'Open project: ' + project.name}>Open project <ArrowRight size={14} aria-hidden="true" /></button>
  </div>;
}

export function ClientProjectsPage({ api = clientTicketApi, projects, loading, error, onOpenConversation, onOpenPreview, inspectionOnly, refreshToken,
  proposalsNeedingReply = 0, onOpenProposals, onProposeProject, newRequestAction, idPrefix = 'client', requests = [] }: {
  idPrefix?: string;
  /** Proposals the project manager is waiting on the client for; they live on their own page. */
  proposalsNeedingReply?: number;
  onOpenProposals?: () => void;
  /** Opens the proposal form on the Proposals page; absent when the client cannot propose. */
  onProposeProject?: () => void;
  /** The existing request menu, placed in the page header rather than the global navigation. */
  newRequestAction?: ReactNode;
  /** Requests already loaded by the portal, used for each project card's counts. */
  requests?: ClientProjectRequestItem[];
  api?: typeof clientTicketApi;
  projects: ClientProject[];
  loading: boolean;
  error: string;
  /** Opens the project's page: its conversation, requests and details. */
  onOpenConversation: (project: ClientProject) => void;
  /** Opens the project's preview page (which says so when nothing is shared yet). */
  onOpenPreview: (project: ClientProject) => void;
  inspectionOnly: boolean;
  refreshToken: number;
}) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<ProjectSort>('updated');
  const sortedProjects = [...projects].sort(PROJECT_SORTS[sortBy].compare);
  const needle = query.trim().toLowerCase();
  const shownProjects = needle ? sortedProjects.filter(project => project.name.toLowerCase().includes(needle)) : sortedProjects;
  // Messages load for the most recently updated projects, whichever order the client picks to view them in.
  const latestByProject = useLatestManagerMessages(api, [...projects].sort(PROJECT_SORTS.updated.compare), refreshToken);
  const titleId = idPrefix + '-projects-page-title';
  return <section className="cx-page" aria-labelledby={titleId}>
    <CxPageHeader titleId={titleId} title={<>Your <span className="cx-accent-word">projects</span></>}
      description="Everything the project manager has shared with you." actions={newRequestAction} />
    {proposalsNeedingReply > 0 && onOpenProposals && <CxPanel tone="attention"><div className="cx-row" role="status">
      <Lightbulb size={16} aria-hidden="true" />
      <span className="cx-row-copy"><strong>The project manager is waiting on your reply to {proposalsNeedingReply === 1 ? 'a project idea' : proposalsNeedingReply + ' project ideas'}.</strong></span>
      <Button type="button" variant="ghost" size="sm" className="cx-link h-auto px-0" onClick={onOpenProposals}>Open project ideas <ArrowRight size={14} aria-hidden="true" /></Button>
    </div></CxPanel>}
    {error && <p role="alert" className="cx-error">{error}</p>}
    <section className="cx-section" aria-label="Shared projects">
      {/* Search and sorting only earn their place once there are more projects than fit at a glance. */}
      {projects.length > 3 && <div className="cx-toolbar">
        <label className="cx-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search projects</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects…" /></label>
        <label className="cx-sort"><span>Sort by</span>
          <select value={sortBy} onChange={event => setSortBy(event.target.value as ProjectSort)}>
            {Object.entries(PROJECT_SORTS).map(([id, option]) => <option key={id} value={id}>{option.label}</option>)}
          </select></label>
      </div>}
      {loading && <CxPanel><LoadingRows label="Loading your projects" className="p-4" /></CxPanel>}
      {!loading && shownProjects.length > 0 && <div className="cx-card-grid">
        {shownProjects.map(project => <ClientProjectCard key={clientProjectKey(project)} project={project} requests={requests}
          latest={latestByProject[clientProjectKey(project)] ?? null}
          onOpenProject={() => onOpenConversation(project)} onOpenPreview={() => onOpenPreview(project)} />)}
      </div>}
      {!loading && projects.length > 0 && !shownProjects.length && <CxPanel><CxEmpty icon={<Search size={22} />} title={'No projects match “' + query.trim() + '”'}
        body="Check the spelling, or clear the search to see every project." /></CxPanel>}
      {!loading && !projects.length && !error && <CxPanel><CxEmpty icon={<FolderKanban size={22} />} title="No projects shared yet"
        body="When the project manager gives your account access to a project, it will appear here." /></CxPanel>}
    </section>
    {!inspectionOnly && onProposeProject && <CxPanel className="cx-idea">
      <CxOrbit className="cx-idea-art" />
      <span className="cx-idea-icon" aria-hidden="true"><Lightbulb size={26} /></span>
      <div className="cx-idea-copy"><strong>Have something new in mind?</strong><p>Send the project manager an idea. They review it with you before anything is set up.</p></div>
      <button type="button" className="cx-button" onClick={onProposeProject}>Propose a project <ArrowRight size={14} aria-hidden="true" /></button>
    </CxPanel>}
  </section>;
}

type ProjectSort = 'updated' | 'name';
const PROJECT_SORTS: Record<ProjectSort, { label: string; compare: (a: ClientProject, b: ClientProject) => number }> = {
  updated: { label: 'Last updated', compare: (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
};

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
